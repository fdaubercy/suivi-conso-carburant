Attribute VB_Name = "modSyncGS"
' ============================================================
'  SUIVI E85 - Synchronisation bidirectionnelle
'  Google Sheets (_ImportGS) <-> Excel (GS_Pleins)
'  v2.2.4.2
' ============================================================
'
'  INSTALLATION :
'    1. Alt+F11 -> Fichier -> Importer un fichier -> choisir ce .bas
'    2. Dans "ThisWorkbook" ajouter :
'         Private Sub Workbook_Open()
'             SyncOnOpen
'         End Sub
'    3. Ajouter la colonne sync_id (P) dans le tableau GS_Pleins
'    4. Executer migrateSyncId() dans l'editeur GAS (une seule fois)
'
'  DIAGNOSTIC : lancer TestConnexion() depuis l'editeur VBA (F5)
'
' ============================================================
Option Explicit

' ── Constantes ───────────────────────────────────────────────
Private Const GAS_URL     As String = "https://script.google.com/macros/s/AKfycbwIyCfZVTpDOGBANtFcHECcCdbg4J4t377pKQjIJ0NJYFT9FMjZm5_6XOsyQAas8jeTyA/exec"
Private Const WS_NAME     As String = "GS_Pleins"
Private Const COL_SYNC_ID As Integer = 16  ' Colonne P

' Timeouts HTTP en millisecondes (resolve, connect, send, receive)
Private Const T_RESOLVE  As Long = 5000
Private Const T_CONNECT  As Long = 10000
Private Const T_SEND     As Long = 30000
Private Const T_RECEIVE  As Long = 30000

' Unicode : evite les problemes d'encodage du .bas
Private Function Euro() As String:    Euro = ChrW(8364): End Function  ' euro
Private Function eAcc() As String:    eAcc = ChrW(233):  End Function  ' e accent

' Cle JSON avec substitution {E}=euro, {e}=e accent
Private Function K(s As String) As String
    K = Replace(Replace(s, "{E}", Euro()), "{e}", eAcc())
End Function


' ════════════════════════════════════════════════════════════
'  DIAGNOSTIC
'  Lancer en premier en cas de probleme (F5 dans l'editeur VBA)
'  Affiche : composant HTTP utilise, code HTTP, debut de reponse
' ════════════════════════════════════════════════════════════
Public Sub TestConnexion()
    Dim url As String: url = GAS_URL & "?action=export"
    Dim status As Long
    Dim body   As String
    Dim errTxt As String
    Dim driver As String

    On Error Resume Next
    Dim h As Object

    ' Essai 1 : WinHttp - natif Windows, toujours disponible, suit les redirections HTTPS
    Set h = CreateObject("WinHttp.WinHttpRequest.5.1")
    If Err.Number = 0 Then
        driver = "WinHttp.WinHttpRequest.5.1"
        h.SetTimeouts T_RESOLVE, T_CONNECT, T_SEND, T_RECEIVE
        h.Open "GET", url, False
        h.Send
        If Err.Number <> 0 Then errTxt = Err.Description: Err.Clear
    Else
        Err.Clear
        ' Essai 2 : MSXML2.XMLHTTP60
        Set h = CreateObject("MSXML2.XMLHTTP60")
        If Err.Number = 0 Then
            driver = "MSXML2.XMLHTTP60"
            h.Open "GET", url, False
            h.send
            If Err.Number <> 0 Then errTxt = Err.Description: Err.Clear
        Else
            errTxt = "Aucun composant HTTP disponible (WinHttp ni MSXML2)."
            Err.Clear
        End If
    End If

    If errTxt = "" And Not h Is Nothing Then
        status = h.Status
        body   = Left(h.ResponseText, 300)
    End If
    On Error GoTo 0

    Dim cause As String
    If errTxt <> "" Then
        cause = "ERREUR : " & errTxt
    Else
        Select Case True
            Case status = 200 And InStr(body, """records""") > 0
                cause = "OK - reponse JSON valide."
            Case status = 200
                cause = "HTTP 200 mais contenu non JSON." & vbNewLine & _
                        "-> GAS probablement pas RE-DEPLOYE apres la mise a jour du code." & vbNewLine & _
                        "GAS Editor -> Deployer -> Gerer les deploiements -> Nouvelle version."
            Case status = 0
                cause = "Aucune reponse (status 0) - probleme reseau ou URL incorrecte."
            Case status = 302
                cause = "Redirection non suivie (302) - " & driver & " ne suit pas les redirections."
            Case status = 401 Or status = 403
                cause = "Acces refuse (HTTP " & status & ")." & vbNewLine & _
                        "-> Deploiement GAS : choisir 'Tout le monde' sans connexion requise."
            Case Else
                cause = "Code HTTP inattendu : " & status
        End Select
    End If

    MsgBox "Composant HTTP : " & IIf(driver = "", "aucun trouve", driver) & vbNewLine & _
           "Code HTTP      : " & status                                    & vbNewLine & _
           "Diagnostic     : " & cause                                     & vbNewLine & vbNewLine & _
           "Debut de reponse :" & vbNewLine & body, _
           vbInformation, "Diagnostic Sync E85"
End Sub


' ════════════════════════════════════════════════════════════
'  POINTS D'ENTREE
' ════════════════════════════════════════════════════════════

' Appele depuis Workbook_Open - silencieux si rien a synchroniser
Public Sub SyncOnOpen()
    On Error Resume Next
    Dim a As Long, s As Long
    SyncCore a, s, silentIfEmpty:=True
    On Error GoTo 0
End Sub

' Appele depuis un bouton - affiche toujours le compte-rendu
Public Sub SyncManuel()
    Dim a As Long, s As Long
    SyncCore a, s, silentIfEmpty:=False
End Sub


' ════════════════════════════════════════════════════════════
'  COEUR DE LA SYNCHRONISATION
' ════════════════════════════════════════════════════════════
Private Sub SyncCore(ByRef addedFromGS As Long, ByRef sentToGS As Long, _
                     silentIfEmpty As Boolean)
    Dim ws As Worksheet
    On Error GoTo ErrHandler

    Application.StatusBar = "Sync E85 - Connexion a Google Sheets..."
    Application.Cursor = xlWait

    Set ws = ThisWorkbook.Sheets(WS_NAME)

    ' 1. Export GAS -> JSON
    Dim jsonStr As String
    jsonStr = HttpGet(GAS_URL & "?action=export")

    ' Cas A : erreur reseau
    If jsonStr = "" Then
        If Not silentIfEmpty Then
            MsgBox "Erreur reseau : impossible de joindre Google Sheets." & vbNewLine & vbNewLine & _
                   "Lancez TestConnexion() pour diagnostiquer.", _
                   vbExclamation, "Sync E85"
        End If
        GoTo Cleanup
    End If

    ' Cas B : reponse recue mais pas du JSON attendu (GAS pas re-deploye ?)
    If InStr(jsonStr, """records""") = 0 Then
        If Not silentIfEmpty Then
            MsgBox "Reponse inattendue de Google Sheets." & vbNewLine & vbNewLine & _
                   "Cause probable : script GAS pas RE-DEPLOYE apres modification." & vbNewLine & _
                   "GAS Editor -> Deployer -> Gerer les deploiements" & vbNewLine & _
                   "-> Modifier -> Nouvelle version -> Deployer" & vbNewLine & vbNewLine & _
                   "Lancez TestConnexion() pour voir la reponse brute.", _
                   vbExclamation, "Sync E85"
        End If
        GoTo Cleanup
    End If

    ' 2. Parse les enregistrements GS
    Dim gsRecs() As String
    gsRecs = ParseRecords(jsonStr)

    ' 3. Index des sync_id locaux
    Dim localIds As Object
    Set localIds = BuildLocalIndex(ws)

    ' 4. GS -> Excel
    Application.StatusBar = "Sync E85 - Import depuis Google Sheets..."
    addedFromGS = ImportGSToExcel(ws, gsRecs, localIds)

    ' 5. Excel -> GS
    Application.StatusBar = "Sync E85 - Export vers Google Sheets..."
    sentToGS = ExportExcelToGS(ws, gsRecs)

    ' 6. Compte-rendu
    If Not silentIfEmpty Or addedFromGS > 0 Or sentToGS > 0 Then
        MsgBox "Synchronisation terminee :" & vbNewLine & vbNewLine & _
               "  <- " & addedFromGS & " ligne(s) recues depuis Google Sheets" & vbNewLine & _
               "  -> " & sentToGS    & " ligne(s) envoyees vers Google Sheets", _
               vbInformation, "Sync E85"
    End If

Cleanup:
    Application.StatusBar = False
    Application.Cursor = xlDefault
    Exit Sub

ErrHandler:
    Application.StatusBar = False
    Application.Cursor = xlDefault
    If Not silentIfEmpty Then
        MsgBox "Erreur inattendue :" & vbNewLine & Err.Description & vbNewLine & vbNewLine & _
               "Lancez TestConnexion() pour verifier l'acces au GAS.", _
               vbCritical, "Sync E85"
    End If
End Sub


' ════════════════════════════════════════════════════════════
'  DIRECTION 1 : GS -> EXCEL
' ════════════════════════════════════════════════════════════

Private Function BuildLocalIndex(ws As Worksheet) As Object
    Dim dict As Object
    Set dict = CreateObject("Scripting.Dictionary")
    dict.CompareMode = vbTextCompare

    Dim lastRow As Long
    lastRow = ws.Cells(ws.Rows.Count, 1).End(xlUp).Row

    Dim i As Long
    For i = 2 To lastRow
        Dim sid As String
        sid = Trim(CStr(ws.Cells(i, COL_SYNC_ID).Value))
        If sid <> "" Then dict(sid) = True
    Next i

    Set BuildLocalIndex = dict
End Function

Private Function ImportGSToExcel(ws As Worksheet, gsRecs() As String, _
                                  localIds As Object) As Long
    Dim added As Long: added = 0

    Dim tbl As ListObject
    If ws.ListObjects.Count > 0 Then Set tbl = ws.ListObjects(1)

    Dim i As Integer
    For i = 0 To UBound(gsRecs)
        Dim rec As String: rec = gsRecs(i)
        If Len(rec) < 10 Then GoTo NextRec

        Dim sid As String: sid = JsonGet(rec, "sync_id")
        If sid = "" Then GoTo NextRec
        If localIds.Exists(sid) Then GoTo NextRec

        Dim rng As Range
        If Not tbl Is Nothing Then
            Set rng = tbl.ListRows.Add.Range
        Else
            Dim lr As Long
            lr = ws.Cells(ws.Rows.Count, 1).End(xlUp).Row + 1
            Set rng = ws.Range(ws.Cells(lr, 1), ws.Cells(lr, COL_SYNC_ID))
        End If

        rng(1).Value  = IsoToDate(JsonGet(rec, "Horodatage"))
        rng(2).Value  = IsoToDate(JsonGet(rec, "Date"))
        rng(3).Value  = JsonGet(rec, "Type")
        rng(4).Value  = ToNum(JsonGet(rec, "Km compteur"))
        rng(5).Value  = ToNum(JsonGet(rec, "Nb. Litres"))
        rng(6).Value  = ToNum(JsonGet(rec, K("Prix {E}/L")))
        rng(7).Value  = ToNum(JsonGet(rec, K("Prix S98 jour ({E}/L)")))
        rng(8).Value  = JsonGet(rec, "Station essence")
        rng(9).Value  = JsonGet(rec, K("V{e}hicule"))
        rng(10).Value = ToNum(JsonGet(rec, K("E85 station ({E}/L)")))
        rng(11).Value = ToNum(JsonGet(rec, K("SP98 station ({E}/L)")))
        rng(12).Value = ToNum(JsonGet(rec, K("SP95 station ({E}/L)")))
        rng(13).Value = ToNum(JsonGet(rec, K("E10 station ({E}/L)")))
        rng(14).Value = ToNum(JsonGet(rec, K("Gazole station ({E}/L)")))
        rng(15).Value = ToNum(JsonGet(rec, K("GPLc station ({E}/L)")))
        rng(16).Value = sid

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
    Dim gsIds As Object
    Set gsIds = CreateObject("Scripting.Dictionary")
    gsIds.CompareMode = vbTextCompare

    Dim i As Integer
    For i = 0 To UBound(gsRecs)
        Dim gid As String: gid = JsonGet(gsRecs(i), "sync_id")
        If gid <> "" Then gsIds(gid) = True
    Next i

    Dim lastRow As Long
    lastRow = ws.Cells(ws.Rows.Count, 1).End(xlUp).Row

    Dim rowsJson() As String
    ReDim rowsJson(lastRow - 2)
    Dim count As Long: count = 0

    Dim r As Long
    For r = 2 To lastRow
        If ws.Cells(r, 1).Value = "" Then GoTo NextRow

        Dim lsid As String
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

    If count = 0 Then ExportExcelToGS = 0: Exit Function

    ReDim Preserve rowsJson(count - 1)

    Dim payload As String
    payload = "{""action"":""bulkAdd"",""rows"":[" & Join(rowsJson, ",") & "]}"

    HttpPost GAS_URL, payload
    ExportExcelToGS = count
End Function

Private Function RowToJson(ws As Worksheet, r As Long, sid As String) As String
    Dim ts As String, ds As String

    If IsDate(ws.Cells(r, 1).Value) Then
        ts = Format(ws.Cells(r, 1).Value, "yyyy-mm-ddThh:mm:ss") & ".000Z"
    End If
    If IsDate(ws.Cells(r, 2).Value) Then
        ds = Format(ws.Cells(r, 2).Value, "yyyy-mm-dd")
    End If

    RowToJson = "{" & _
        jS("sync_id",    sid)                                 & "," & _
        jS("horodatage", ts)                                  & "," & _
        jS("date",       ds)                                  & "," & _
        jS("type",       CStr(ws.Cells(r, 3).Value))          & "," & _
        jN("km",         ws.Cells(r, 4).Value)                & "," & _
        jN("litres",     ws.Cells(r, 5).Value)                & "," & _
        jN("prix",       ws.Cells(r, 6).Value)                & "," & _
        jN("prixS98",    ws.Cells(r, 7).Value)                & "," & _
        jS("station",    CStr(ws.Cells(r, 8).Value))          & "," & _
        jS("vehicule",   CStr(ws.Cells(r, 9).Value))          & "," & _
        """stationPrices"":{" & _
            jN("E85",    ws.Cells(r, 10).Value)               & "," & _
            jN("SP98",   ws.Cells(r, 11).Value)               & "," & _
            jN("SP95",   ws.Cells(r, 12).Value)               & "," & _
            jN("E10",    ws.Cells(r, 13).Value)               & "," & _
            jN("GAZOLE", ws.Cells(r, 14).Value)               & "," & _
            jN("GPLC",   ws.Cells(r, 15).Value)               & _
        "}}"
End Function


' ════════════════════════════════════════════════════════════
'  JSON PARSER MINIMAL (objets plats uniquement)
' ════════════════════════════════════════════════════════════

Private Function JsonGet(jsonObj As String, key As String) As String
    Dim pat As String: pat = """" & key & """:"
    Dim pos As Long:   pos = InStr(jsonObj, pat)
    If pos = 0 Then Exit Function

    pos = pos + Len(pat)
    Do While pos <= Len(jsonObj) And Mid(jsonObj, pos, 1) = " "
        pos = pos + 1
    Loop

    Dim ch As String: ch = Mid(jsonObj, pos, 1)

    Select Case ch
        Case """"
            Dim vs As Long: vs = pos + 1
            Dim ve As Long: ve = vs
            Do While ve <= Len(jsonObj)
                If Mid(jsonObj, ve, 1) = """" And Mid(jsonObj, ve - 1, 1) <> "\" Then Exit Do
                ve = ve + 1
            Loop
            JsonGet = Mid(jsonObj, vs, ve - vs)
        Case "n"
            JsonGet = ""
        Case Else
            Dim ns As Long: ns = pos
            Do While pos <= Len(jsonObj)
                ch = Mid(jsonObj, pos, 1)
                If ch = "," Or ch = "}" Then Exit Do
                pos = pos + 1
            Loop
            JsonGet = Trim(Mid(jsonObj, ns, pos - ns))
    End Select
End Function

Private Function ParseRecords(jsonStr As String) As String()
    Dim empty(0) As String: empty(0) = ""

    Dim p As Long
    p = InStr(jsonStr, """records"":[")
    If p = 0 Then ParseRecords = empty: Exit Function
    p = p + Len("""records"":[")

    Dim ep As Long
    ep = InStrRev(jsonStr, "]}")
    If ep = 0 Then ep = InStrRev(jsonStr, "]")
    If ep = 0 Or ep <= p Then ParseRecords = empty: Exit Function

    Dim arrStr As String
    arrStr = Trim(Mid(jsonStr, p, ep - p))
    If arrStr = "" Then ParseRecords = empty: Exit Function

    Dim parts() As String
    parts = Split(arrStr, "},{")

    Dim i As Integer
    For i = 0 To UBound(parts)
        If Left(parts(i), 1) <> "{" Then parts(i) = "{" & parts(i)
        If Right(parts(i), 1) <> "}" Then parts(i) = parts(i) & "}"
    Next i

    ParseRecords = parts
End Function


' ════════════════════════════════════════════════════════════
'  HELPERS JSON (serialisation)
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

Private Function IsoToDate(iso As String) As Variant
    If iso = "" Then IsoToDate = "": Exit Function
    On Error Resume Next
    IsoToDate = CDate(Replace(Left(iso, 10), "-", "/"))
    On Error GoTo 0
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
    On Error GoTo Fallback
    Dim g As String
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
'  HTTP  -  WinHttp.WinHttpRequest.5.1 en priorite
'           (natif Windows, suit les redirections HTTPS Google)
'           Fallback sur MSXML2.XMLHTTP60 si WinHttp indisponible
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
    On Error GoTo Err_
    Dim h As Object
    Set h = CreateHttp()
    If h Is Nothing Then Exit Function
    h.SetTimeouts T_RESOLVE, T_CONNECT, T_SEND, T_RECEIVE
    h.Open "GET", url, False
    h.Send
    If h.Status = 200 Then HttpGet = h.ResponseText
    Exit Function
Err_: HttpGet = ""
End Function

Private Function HttpPost(url As String, body As String) As String
    On Error GoTo Err_
    Dim h As Object
    Set h = CreateHttp()
    If h Is Nothing Then Exit Function
    h.SetTimeouts T_RESOLVE, T_CONNECT, T_SEND, T_RECEIVE
    h.Open "POST", url, False
    h.setRequestHeader "Content-Type", "application/json; charset=utf-8"
    h.Send body
    If h.Status = 200 Then HttpPost = h.ResponseText
    Exit Function
Err_: HttpPost = ""
End Function
