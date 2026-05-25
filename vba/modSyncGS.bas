Attribute VB_Name = "modSyncGS"
' ============================================================
'  SUIVI E85 - Synchronisation bidirectionnelle
'  Google Sheets (_ImportGS) <-> Excel (GS_Pleins)
'  v2.4.0.0  - Public ForceFormatDates() pour Workbook_Open + extraction du format
' ============================================================
Option Explicit

Private Const GAS_URL     As String = "https://script.google.com/macros/s/AKfycbwIyCfZVTpDOGBANtFcHECcCdbg4J4t377pKQjIJ0NJYFT9FMjZm5_6XOsyQAas8jeTyA/exec"
Private Const WS_NAME     As String = "GS_Pleins"
Private Const COL_SYNC_ID As Integer = 15   ' v2.3.0.0 : col O (etait P avant suppression S98)

Private Const T_RESOLVE  As Long = 5000
Private Const T_CONNECT  As Long = 10000
Private Const T_SEND     As Long = 30000
Private Const T_RECEIVE  As Long = 30000

Private Function Euro() As String:   Euro = ChrW(8364): End Function
Private Function eAcc() As String:   eAcc = ChrW(233):  End Function

Private Function K(s As String) As String
    K = Replace(Replace(s, "{E}", Euro()), "{e}", eAcc())
End Function


' ════════════════════════════════════════════════════════════
'  HELPERS DE LOGGING
'  - Barre de statut Excel (non-bloquant, visible en bas)
'  - Immediate Window VBA (Ctrl+G) pour garder l'historique
' ════════════════════════════════════════════════════════════
Private Sub SetStatus(msg As String)
    Application.StatusBar = "[Sync E85] " & msg
    Debug.Print Format(Now(), "hh:mm:ss") & "  " & msg
End Sub

' Variante multi-ligne : barre de statut = 1re ligne, Immediate = tout
Private Sub SetStatusBlock(title As String, body As String)
    Application.StatusBar = "[Sync E85] " & title
    Debug.Print String(60, "-")
    Debug.Print Format(Now(), "hh:mm:ss") & "  " & title
    Debug.Print body
    Debug.Print String(60, "-")
End Sub

Private Sub ClearStatus()
    Application.StatusBar = False
End Sub


' ════════════════════════════════════════════════════════════
'  DIAGNOSTIC
' ════════════════════════════════════════════════════════════
Public Sub TestConnexion()
    Dim url    As String: url = GAS_URL & "?action=export"
    Dim status As Long
    Dim body   As String
    Dim errTxt As String
    Dim driver As String
    Dim h      As Object

    On Error Resume Next

    Set h = CreateObject("WinHttp.WinHttpRequest.5.1")
    If Err.Number = 0 Then
        driver = "WinHttp.WinHttpRequest.5.1"
        h.SetTimeouts T_RESOLVE, T_CONNECT, T_SEND, T_RECEIVE
        h.Open "GET", url, False
        h.Send
        If Err.Number <> 0 Then errTxt = Err.Description: Err.Clear
    Else
        Err.Clear
        Set h = CreateObject("MSXML2.XMLHTTP60")
        If Err.Number = 0 Then
            driver = "MSXML2.XMLHTTP60"
            h.Open "GET", url, False
            h.send
            If Err.Number <> 0 Then errTxt = Err.Description: Err.Clear
        Else
            errTxt = "Aucun composant HTTP disponible."
            Err.Clear
        End If
    End If

    If errTxt = "" And Not h Is Nothing Then
        status = h.Status
        body = Left(h.ResponseText, 300)
    End If
    On Error GoTo 0

    Dim cause As String
    If errTxt <> "" Then
        cause = "ERREUR : " & errTxt
    ElseIf status = 200 And InStr(body, """records""") > 0 Then
        cause = "OK - reponse JSON valide."
    ElseIf status = 200 Then
        cause = "HTTP 200 mais pas de JSON. GAS pas re-deploye ?"
    ElseIf status = 0 Then
        cause = "Aucune reponse - probleme reseau."
    ElseIf status = 401 Or status = 403 Then
        cause = "Acces refuse (" & status & "). Verifier deploiement GAS."
    Else
        cause = "Code HTTP inattendu : " & status
    End If

    Dim summary As String
    summary = "HTTP " & status & " (" & IIf(driver = "", "aucun", driver) & ") - " & cause

    SetStatusBlock summary, _
        "Composant : " & IIf(driver = "", "aucun", driver) & vbNewLine & _
        "Code HTTP : " & status & vbNewLine & _
        "Diagnostic: " & cause & vbNewLine & _
        "Reponse   : " & body
End Sub


' ════════════════════════════════════════════════════════════
'  DIAGNOSTIC DE SYNC - decompose pour comprendre les 0/0
' ════════════════════════════════════════════════════════════
Public Sub SyncDiagnose()
    Dim ws       As Worksheet
    Dim jsonStr  As String
    Dim gsRecs() As String
    Dim i        As Long
    Dim r        As Long
    Dim lastRow  As Long
    Dim sid      As String

    Dim nGsTotal       As Long  ' Records dans GS
    Dim nGsWithSid     As Long  ' Records GS avec sync_id
    Dim nLocalTotal    As Long  ' Lignes locales (sauf entete)
    Dim nLocalWithSid  As Long  ' Lignes locales avec sync_id
    Dim nMatching      As Long  ' sync_id presents des 2 cotes
    Dim nOnlyGs        As Long  ' sync_id seulement dans GS
    Dim nOnlyLocal     As Long  ' sync_id seulement dans Excel
    Dim nGsNoSid       As Long  ' GS sans sync_id (skip a l'import)
    Dim nLocalNoSid    As Long  ' Local sans sync_id (UUID genere au prochain sync)

    Set ws = ThisWorkbook.Sheets(WS_NAME)

    ' ── Cote GS ───────────────────────────────────────────────
    SetStatus "Diagnose : recuperation export GS..."
    jsonStr = HttpGet(GAS_URL & "?action=export")
    If jsonStr = "" Or InStr(jsonStr, """records""") = 0 Then
        SetStatus "Diagnose ERREUR : export GS inaccessible (lancer TestConnexion)"
        Exit Sub
    End If

    gsRecs = ParseRecords(jsonStr)

    Dim gsIds As Object
    Set gsIds = CreateObject("Scripting.Dictionary")
    gsIds.CompareMode = vbTextCompare

    nGsTotal = UBound(gsRecs) + 1
    If gsRecs(0) = "" Then nGsTotal = 0   ' tableau vide

    For i = 0 To UBound(gsRecs)
        If Len(gsRecs(i)) > 10 Then
            sid = JsonGet(gsRecs(i), "sync_id")
            If sid <> "" Then
                gsIds(sid) = True
                nGsWithSid = nGsWithSid + 1
            Else
                nGsNoSid = nGsNoSid + 1
            End If
        End If
    Next i

    ' ── Cote Excel ────────────────────────────────────────────
    Dim localIds As Object
    Set localIds = CreateObject("Scripting.Dictionary")
    localIds.CompareMode = vbTextCompare

    lastRow = ws.Cells(ws.Rows.Count, 1).End(xlUp).Row
    nLocalTotal = lastRow - 1   ' moins l'entete

    For r = 2 To lastRow
        sid = Trim(CStr(ws.Cells(r, COL_SYNC_ID).Value))
        If sid <> "" Then
            localIds(sid) = True
            nLocalWithSid = nLocalWithSid + 1
        Else
            nLocalNoSid = nLocalNoSid + 1
        End If
    Next r

    ' ── Intersections ─────────────────────────────────────────
    Dim key As Variant
    For Each key In gsIds.Keys
        If localIds.Exists(CStr(key)) Then
            nMatching = nMatching + 1
        Else
            nOnlyGs = nOnlyGs + 1
        End If
    Next key

    For Each key In localIds.Keys
        If Not gsIds.Exists(CStr(key)) Then nOnlyLocal = nOnlyLocal + 1
    Next key

    ' ── Rapport ──────────────────────────────────────────────
    Dim body As String
    body = "GOOGLE SHEETS (_ImportGS)" & vbNewLine & _
           "  Total enreg. : " & nGsTotal & vbNewLine & _
           "  Avec sync_id : " & nGsWithSid & vbNewLine & _
           "  Sans sync_id : " & nGsNoSid & " (ignores a l'import)" & vbNewLine & _
           vbNewLine & _
           "EXCEL (GS_Pleins)" & vbNewLine & _
           "  Total lignes : " & nLocalTotal & vbNewLine & _
           "  Avec sync_id : " & nLocalWithSid & vbNewLine & _
           "  Sans sync_id : " & nLocalNoSid & " (UUID genere au prochain sync)" & vbNewLine & _
           vbNewLine & _
           "INTERSECTIONS" & vbNewLine & _
           "  Communs (deja sync)  : " & nMatching & vbNewLine & _
           "  Seulement dans GS    : " & nOnlyGs & "  -> seront importes" & vbNewLine & _
           "  Seulement dans Excel : " & nOnlyLocal & "  -> seront envoyes"

    If nGsNoSid > 0 Then
        body = body & vbNewLine & vbNewLine & _
               "ATTENTION : " & nGsNoSid & " enreg. GS sans sync_id" & vbNewLine & _
               "-> Executer migrateSyncId() dans GAS Editor."
    End If

    Dim summary As String
    summary = "GS=" & nGsTotal & " (sid:" & nGsWithSid & ") | XL=" & nLocalTotal & _
              " (sid:" & nLocalWithSid & ") | sync->GS:" & nOnlyLocal & " ->XL:" & nOnlyGs

    SetStatusBlock "Diagnose : " & summary, body
End Sub


' ════════════════════════════════════════════════════════════
'  FORMAT DATES FRANCAIS (X5)
'  A appeler depuis Workbook_Open pour restaurer le format
'  meme si Power Query l'a ecrase lors d'un refresh.
' ════════════════════════════════════════════════════════════
Public Sub ForceFormatDates()
    Dim ws  As Worksheet
    Dim tbl As ListObject

    On Error Resume Next
    Set ws = ThisWorkbook.Sheets(WS_NAME)
    If ws Is Nothing Then Exit Sub

    If ws.ListObjects.Count > 0 Then Set tbl = ws.ListObjects(1)

    If Not tbl Is Nothing Then
        tbl.ListColumns(1).DataBodyRange.NumberFormat = "dd/mm/yyyy hh:mm:ss"
        tbl.ListColumns(2).DataBodyRange.NumberFormat = "dd/mm/yyyy"
    Else
        ws.Columns(1).NumberFormat = "dd/mm/yyyy hh:mm:ss"
        ws.Columns(2).NumberFormat = "dd/mm/yyyy"
    End If
    On Error GoTo 0
End Sub


' ════════════════════════════════════════════════════════════
'  POINTS D'ENTREE
' ════════════════════════════════════════════════════════════
Public Sub SyncOnOpen()
    On Error Resume Next
    Dim a As Long
    Dim s As Long
    SyncCore a, s, True
    On Error GoTo 0
End Sub

Public Sub SyncManuel()
    Dim a As Long
    Dim s As Long
    SyncCore a, s, False
End Sub


' ════════════════════════════════════════════════════════════
'  COEUR
' ════════════════════════════════════════════════════════════
Private Sub SyncCore(ByRef addedFromGS As Long, ByRef sentToGS As Long, _
                     silentIfEmpty As Boolean)
    Dim ws       As Worksheet
    Dim jsonStr  As String
    Dim gsRecs() As String
    Dim localIds As Object

    On Error GoTo ErrHandler

    SetStatus "Connexion a Google Sheets..."
    Application.Cursor = xlWait

    Set ws = ThisWorkbook.Sheets(WS_NAME)

    jsonStr = HttpGet(GAS_URL & "?action=export")

    If jsonStr = "" Then
        SetStatus "ERREUR reseau - lancer TestConnexion() pour diagnostiquer"
        GoTo Cleanup
    End If

    If InStr(jsonStr, """records""") = 0 Then
        SetStatus "ERREUR : reponse non-JSON - GAS pas re-deploye ? (TestConnexion pour details)"
        GoTo Cleanup
    End If

    SetStatus "Parsing JSON GS..."
    gsRecs = ParseRecords(jsonStr)
    Set localIds = BuildLocalIndex(ws)

    SetStatus "Import GS -> Excel..."
    addedFromGS = ImportGSToExcel(ws, gsRecs, localIds)

    SetStatus "Export Excel -> GS..."
    sentToGS = ExportExcelToGS(ws, gsRecs)

    SetStatus "OK : <-" & addedFromGS & " recues / ->" & sentToGS & " envoyees"

Cleanup:
    Application.Cursor = xlDefault
    Exit Sub

ErrHandler:
    Application.Cursor = xlDefault
    SetStatus "ERREUR : " & Err.Description & " (TestConnexion pour verifier)"
End Sub


' ════════════════════════════════════════════════════════════
'  DIRECTION 1 : GS -> EXCEL
' ════════════════════════════════════════════════════════════
Private Function BuildLocalIndex(ws As Worksheet) As Object
    Dim dict    As Object
    Dim lastRow As Long
    Dim i       As Long
    Dim sid     As String

    Set dict = CreateObject("Scripting.Dictionary")
    dict.CompareMode = vbTextCompare
    lastRow = ws.Cells(ws.Rows.Count, 1).End(xlUp).Row

    For i = 2 To lastRow
        sid = Trim(CStr(ws.Cells(i, COL_SYNC_ID).Value))
        If sid <> "" Then dict(sid) = True
    Next i

    Set BuildLocalIndex = dict
End Function

Private Function ImportGSToExcel(ws As Worksheet, gsRecs() As String, _
                                  localIds As Object) As Long
    Dim added As Long
    Dim tbl   As ListObject
    Dim i     As Long
    Dim rec   As String
    Dim sid   As String
    Dim rng   As Range
    Dim lr    As Long

    added = 0
    If ws.ListObjects.Count > 0 Then Set tbl = ws.ListObjects(1)

    ' Reapplique le format francais (s'applique a toutes les lignes existantes + futures)
    ForceFormatDates

    For i = 0 To UBound(gsRecs)
        rec = gsRecs(i)
        If Len(rec) < 10 Then GoTo NextRec

        sid = JsonGet(rec, "sync_id")
        If sid = "" Then GoTo NextRec
        If localIds.Exists(sid) Then GoTo NextRec

        If Not tbl Is Nothing Then
            Set rng = tbl.ListRows.Add.Range
        Else
            lr = ws.Cells(ws.Rows.Count, 1).End(xlUp).Row + 1
            Set rng = ws.Range(ws.Cells(lr, 1), ws.Cells(lr, COL_SYNC_ID))
        End If

        ' v2.3.0.0 : schema A-O (15 colonnes), col G "Prix S98 jour" supprimee
        rng(1).Value  = ParseDt(JsonGet(rec, "Horodatage"))
        rng(2).Value  = ParseDt(JsonGet(rec, "Date"))
        rng(3).Value  = JsonGet(rec, "Type")
        rng(4).Value  = ToNum(JsonGet(rec, "Km compteur"))
        rng(5).Value  = ToNum(JsonGet(rec, "Nb. Litres"))
        rng(6).Value  = ToNum(JsonGet(rec, K("Prix {E}/L")))
        rng(7).Value  = JsonGet(rec, "Station essence")
        rng(8).Value  = JsonGet(rec, K("V{e}hicule"))
        rng(9).Value  = ToNum(JsonGet(rec, K("E85 station ({E}/L)")))
        rng(10).Value = ToNum(JsonGet(rec, K("SP98 station ({E}/L)")))
        rng(11).Value = ToNum(JsonGet(rec, K("SP95 station ({E}/L)")))
        rng(12).Value = ToNum(JsonGet(rec, K("E10 station ({E}/L)")))
        rng(13).Value = ToNum(JsonGet(rec, K("Gazole station ({E}/L)")))
        rng(14).Value = ToNum(JsonGet(rec, K("GPLc station ({E}/L)")))
        rng(15).Value = sid

        localIds(sid) = True
        added = added + 1
NextRec:
    Next i

    ImportGSToExcel = added
End Function


' ════════════════════════════════════════════════════════════
'  DIRECTION 2 : EXCEL -> GS
' ════════════════════════════════════════════════════════════
Private Function ExportExcelToGS(ws As Worksheet, gsRecs() As String) As Long
    Dim gsIds    As Object
    Dim i        As Long
    Dim gid      As String
    Dim lastRow  As Long
    Dim rowsJson() As String
    Dim count    As Long
    Dim r        As Long
    Dim lsid     As String
    Dim payload  As String

    Set gsIds = CreateObject("Scripting.Dictionary")
    gsIds.CompareMode = vbTextCompare

    For i = 0 To UBound(gsRecs)
        gid = JsonGet(gsRecs(i), "sync_id")
        If gid <> "" Then gsIds(gid) = True
    Next i

    lastRow = ws.Cells(ws.Rows.Count, 1).End(xlUp).Row
    ReDim rowsJson(lastRow - 2)
    count = 0

    For r = 2 To lastRow
        If ws.Cells(r, 1).Value = "" Then GoTo NextRow

        lsid = Trim(CStr(ws.Cells(r, COL_SYNC_ID).Value))
        If lsid = "" Then
            lsid = GenerateUUID()
            ws.Cells(r, COL_SYNC_ID).Value = lsid
        End If

        If gsIds.Exists(lsid) Then GoTo NextRow

        rowsJson(count) = RowToJson(ws, r, lsid)
        count = count + 1
NextRow:
    Next r

    If count = 0 Then
        ExportExcelToGS = 0
        Exit Function
    End If

    ReDim Preserve rowsJson(count - 1)
    payload = "{""action"":""bulkAdd"",""rows"":[" & Join(rowsJson, ",") & "]}"
    HttpPost GAS_URL, payload
    ExportExcelToGS = count
End Function

Private Function RowToJson(ws As Worksheet, r As Long, sid As String) As String
    Dim ts As String
    Dim ds As String

    ' Format heure locale (pas d'UTC) - GAS le parse en local via new Date()
    If IsDate(ws.Cells(r, 1).Value) Then
        ts = Format(ws.Cells(r, 1).Value, "yyyy-mm-dd hh:mm:ss")
    End If
    If IsDate(ws.Cells(r, 2).Value) Then
        ds = Format(ws.Cells(r, 2).Value, "yyyy-mm-dd")
    End If

    ' v2.3.0.0 : schema A-O (15 col), col G "Prix S98 jour" supprimee
    RowToJson = "{" & _
        jS("sync_id",    sid)                                 & "," & _
        jS("horodatage", ts)                                  & "," & _
        jS("date",       ds)                                  & "," & _
        jS("type",       CStr(ws.Cells(r, 3).Value))          & "," & _
        jN("km",         ws.Cells(r, 4).Value)                & "," & _
        jN("litres",     ws.Cells(r, 5).Value)                & "," & _
        jN("prix",       ws.Cells(r, 6).Value)                & "," & _
        jS("station",    CStr(ws.Cells(r, 7).Value))          & "," & _
        jS("vehicule",   CStr(ws.Cells(r, 8).Value))          & "," & _
        """stationPrices"":{" & _
            jN("E85",    ws.Cells(r, 9).Value)                & "," & _
            jN("SP98",   ws.Cells(r, 10).Value)               & "," & _
            jN("SP95",   ws.Cells(r, 11).Value)               & "," & _
            jN("E10",    ws.Cells(r, 12).Value)               & "," & _
            jN("GAZOLE", ws.Cells(r, 13).Value)               & "," & _
            jN("GPLC",   ws.Cells(r, 14).Value)               & _
        "}}"
End Function


' ════════════════════════════════════════════════════════════
'  JSON PARSER
' ════════════════════════════════════════════════════════════
Private Function JsonGet(jsonObj As String, key As String) As String
    Dim pat As String
    Dim pos As Long
    Dim ch  As String
    Dim vs  As Long
    Dim ve  As Long
    Dim ns  As Long

    pat = """" & key & """:"
    pos = InStr(jsonObj, pat)
    If pos = 0 Then Exit Function
    pos = pos + Len(pat)

    Do While pos <= Len(jsonObj) And Mid(jsonObj, pos, 1) = " "
        pos = pos + 1
    Loop

    ch = Mid(jsonObj, pos, 1)

    If ch = """" Then
        vs = pos + 1
        ve = vs
        Do While ve <= Len(jsonObj)
            If Mid(jsonObj, ve, 1) = """" And Mid(jsonObj, ve - 1, 1) <> "\" Then Exit Do
            ve = ve + 1
        Loop
        JsonGet = Mid(jsonObj, vs, ve - vs)
    ElseIf ch = "n" Then
        JsonGet = ""
    Else
        ns = pos
        Do While pos <= Len(jsonObj)
            ch = Mid(jsonObj, pos, 1)
            If ch = "," Or ch = "}" Then Exit Do
            pos = pos + 1
        Loop
        JsonGet = Trim(Mid(jsonObj, ns, pos - ns))
    End If
End Function

Private Function ParseRecords(jsonStr As String) As String()
    ' NOTE : ne pas nommer une variable "empty" (mot reserve VBA)
    Dim emp(0)   As String
    Dim parts()  As String
    Dim result() As String
    Dim p        As Long
    Dim endP     As Long
    Dim arr      As String
    Dim i        As Long
    Dim n        As Long
    Dim s        As String

    emp(0) = ""

    ' Position apres "records":[
    p = InStr(jsonStr, """records"":[")
    If p = 0 Then
        ParseRecords = emp
        Exit Function
    End If
    p = p + Len("""records"":[")

    ' Dernier ] du JSON
    endP = InStrRev(jsonStr, "]")
    If endP <= p Then
        ParseRecords = emp
        Exit Function
    End If

    ' Contenu entre [ et ]
    arr = Trim(Mid(jsonStr, p, endP - p))
    If arr = "" Then
        ParseRecords = emp
        Exit Function
    End If

    ' Split sur },{ - safe pour JSON plat sans },{ dans les valeurs
    parts = Split(arr, "},{")
    n = UBound(parts)

    ReDim result(n)

    For i = 0 To n
        s = parts(i)
        If Left(s, 1) <> "{" Then s = "{" & s
        If Right(s, 1) <> "}" Then s = s & "}"
        result(i) = s
    Next i

    ParseRecords = result
End Function


' ════════════════════════════════════════════════════════════
'  HELPERS JSON
' ════════════════════════════════════════════════════════════
Private Function jS(key As String, val As String) As String
    val = Replace(val, "\", "\\")
    val = Replace(val, """", "\""")
    jS = """" & key & """:""" & val & """"
End Function

Private Function jN(key As String, val As Variant) As String
    Dim n As String
    If IsEmpty(val) Or IsNull(val) Or val = "" Then
        n = "null"
    ElseIf IsNumeric(val) Then
        n = Replace(CStr(CDbl(val)), ",", ".")
    Else
        n = "null"
    End If
    jN = """" & key & """:" & n
End Function


' ════════════════════════════════════════════════════════════
'  HELPERS DIVERS
' ════════════════════════════════════════════════════════════
' Parse une date ISO ou "YYYY-MM-DD HH:MM:SS" en valeur Date VBA complete
' Conserve l'heure (l'ancienne IsoToDate la jetait avec Left(iso,10))
Private Function ParseDt(s As String) As Variant
    Dim norm  As String
    Dim sp    As Long
    Dim dotP  As Long
    Dim dStr  As String
    Dim tStr  As String
    Dim dp()  As String
    Dim tp()  As String
    Dim y As Integer, m As Integer, d As Integer
    Dim hh As Integer, mm As Integer, ss As Integer

    If s = "" Then
        ParseDt = ""
        Exit Function
    End If

    On Error GoTo Bad

    norm = s
    norm = Replace(norm, "T", " ")          ' ISO "2026-05-22T17:41:04..." -> "2026-05-22 17:41:04..."

    dotP = InStr(norm, ".")
    If dotP > 0 Then norm = Left(norm, dotP - 1)     ' Coupe les millisecondes
    If Right(norm, 1) = "Z" Then norm = Left(norm, Len(norm) - 1)

    sp = InStr(norm, " ")
    If sp > 0 Then
        dStr = Left(norm, sp - 1)
        tStr = Mid(norm, sp + 1)
    Else
        dStr = norm
        tStr = ""
    End If

    dp = Split(dStr, "-")
    If UBound(dp) <> 2 Then GoTo Bad
    y = CInt(dp(0)): m = CInt(dp(1)): d = CInt(dp(2))

    If tStr <> "" Then
        tp = Split(tStr, ":")
        If UBound(tp) >= 2 Then
            hh = CInt(tp(0)): mm = CInt(tp(1)): ss = CInt(tp(2))
            ParseDt = DateSerial(y, m, d) + TimeSerial(hh, mm, ss)
        Else
            ParseDt = DateSerial(y, m, d)
        End If
    Else
        ParseDt = DateSerial(y, m, d)
    End If
    Exit Function
Bad:
    ParseDt = ""
End Function

' Conserve le nom legacy pour compatibilite
Private Function IsoToDate(iso As String) As Variant
    IsoToDate = ParseDt(iso)
End Function

Private Function ToNum(s As String) As Variant
    If s = "" Or s = "null" Then
        ToNum = ""
    ElseIf IsNumeric(Replace(s, ".", ",")) Then
        ToNum = CDbl(Replace(s, ".", ","))
    Else
        ToNum = ""
    End If
End Function

Public Function GenerateUUID() As String
    Dim g As String
    On Error GoTo Fallback
    g = CreateObject("Scriptlet.TypeLib").GUID
    GenerateUUID = Mid(g, 2, Len(g) - 2)
    Exit Function
Fallback:
    Randomize
    GenerateUUID = Format(Now(), "yyyymmddHHmmss") & "-" & _
                   Right("000000" & CStr(Int(Rnd() * 1000000)), 6) & "-" & _
                   Right("000000" & CStr(Int(Rnd() * 1000000)), 6)
End Function


' ════════════════════════════════════════════════════════════
'  HTTP
' ════════════════════════════════════════════════════════════
Private Function CreateHttp() As Object
    On Error Resume Next
    Set CreateHttp = CreateObject("WinHttp.WinHttpRequest.5.1")
    If Err.Number <> 0 Or CreateHttp Is Nothing Then
        Err.Clear
        Set CreateHttp = CreateObject("MSXML2.XMLHTTP60")
    End If
    On Error GoTo 0
End Function

Private Function HttpGet(url As String) As String
    Dim h As Object
    On Error GoTo Err_
    Set h = CreateHttp()
    If h Is Nothing Then Exit Function
    h.SetTimeouts T_RESOLVE, T_CONNECT, T_SEND, T_RECEIVE
    h.Open "GET", url, False
    h.Send
    If h.Status = 200 Then HttpGet = h.ResponseText
    Exit Function
Err_:
    HttpGet = ""
End Function

Private Function HttpPost(url As String, body As String) As String
    Dim h As Object
    On Error GoTo Err_
    Set h = CreateHttp()
    If h Is Nothing Then Exit Function
    h.SetTimeouts T_RESOLVE, T_CONNECT, T_SEND, T_RECEIVE
    h.Open "POST", url, False
    h.setRequestHeader "Content-Type", "application/json; charset=utf-8"
    h.Send body
    If h.Status = 200 Then HttpPost = h.ResponseText
    Exit Function
Err_:
    HttpPost = ""
End Function
