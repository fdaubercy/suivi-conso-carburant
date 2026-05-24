Attribute VB_Name = "modSyncGS"
' ============================================================
'  SUIVI E85 - Synchronisation bidirectionnelle
'  Google Sheets (_ImportGS) <-> Excel (GS_Pleins)
'  v2.2.4.3
' ============================================================
Option Explicit

Private Const GAS_URL     As String = "https://script.google.com/macros/s/AKfycbwIyCfZVTpDOGBANtFcHECcCdbg4J4t377pKQjIJ0NJYFT9FMjZm5_6XOsyQAas8jeTyA/exec"
Private Const WS_NAME     As String = "GS_Pleins"
Private Const COL_SYNC_ID As Integer = 16

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

    MsgBox "Composant : " & IIf(driver = "", "aucun", driver) & vbNewLine & _
           "Code HTTP : " & status & vbNewLine & _
           "Diagnostic: " & cause & vbNewLine & vbNewLine & _
           "Reponse   : " & body, vbInformation, "Diagnostic Sync E85"
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
    Dim ws      As Worksheet
    Dim jsonStr As String
    Dim gsRecs() As String
    Dim localIds As Object

    On Error GoTo ErrHandler

    Application.StatusBar = "Sync E85 - Connexion..."
    Application.Cursor = xlWait

    Set ws = ThisWorkbook.Sheets(WS_NAME)

    jsonStr = HttpGet(GAS_URL & "?action=export")

    If jsonStr = "" Then
        If Not silentIfEmpty Then
            MsgBox "Erreur reseau : impossible de joindre Google Sheets." & vbNewLine & _
                   "Lancez TestConnexion() pour diagnostiquer.", vbExclamation, "Sync E85"
        End If
        GoTo Cleanup
    End If

    If InStr(jsonStr, """records""") = 0 Then
        If Not silentIfEmpty Then
            MsgBox "Reponse inattendue. GAS pas re-deploye apres modification ?" & vbNewLine & _
                   "GAS Editor -> Deployer -> Gerer les deploiements -> Nouvelle version." & vbNewLine & _
                   "Lancez TestConnexion() pour voir la reponse brute.", vbExclamation, "Sync E85"
        End If
        GoTo Cleanup
    End If

    gsRecs = ParseRecords(jsonStr)
    Set localIds = BuildLocalIndex(ws)

    Application.StatusBar = "Sync E85 - Import GS -> Excel..."
    addedFromGS = ImportGSToExcel(ws, gsRecs, localIds)

    Application.StatusBar = "Sync E85 - Export Excel -> GS..."
    sentToGS = ExportExcelToGS(ws, gsRecs)

    If Not silentIfEmpty Or addedFromGS > 0 Or sentToGS > 0 Then
        MsgBox "Synchronisation terminee :" & vbNewLine & vbNewLine & _
               "  <- " & addedFromGS & " ligne(s) recues depuis Google Sheets" & vbNewLine & _
               "  -> " & sentToGS & " ligne(s) envoyees vers Google Sheets", _
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
        MsgBox "Erreur : " & Err.Description & vbNewLine & _
               "Lancez TestConnexion() pour verifier.", vbCritical, "Sync E85"
    End If
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
    Dim empty(0)   As String
    Dim recs()     As String
    Dim startPos   As Long
    Dim pos        As Long
    Dim depth      As Long
    Dim inStr      As Boolean
    Dim recStart   As Long
    Dim recCount   As Long
    Dim ch         As String
    Dim done       As Boolean
    Dim slashCount As Long
    Dim bp         As Long

    empty(0) = ""

    startPos = InStr(jsonStr, """records"":[")
    If startPos = 0 Then
        ParseRecords = empty
        Exit Function
    End If
    startPos = startPos + Len("""records"":[")

    Do While startPos <= Len(jsonStr) And Mid(jsonStr, startPos, 1) = " "
        startPos = startPos + 1
    Loop

    If startPos > Len(jsonStr) Then
        ParseRecords = empty
        Exit Function
    End If
    If Mid(jsonStr, startPos, 1) = "]" Then
        ParseRecords = empty
        Exit Function
    End If

    ReDim recs(100)
    recCount = 0
    pos = startPos
    depth = 0
    inStr = False
    recStart = 0
    done = False

    Do While pos <= Len(jsonStr) And Not done
        ch = Mid(jsonStr, pos, 1)

        If inStr Then
            If ch = """" Then
                slashCount = 0
                bp = pos - 1
                Do While bp >= 1 And Mid(jsonStr, bp, 1) = "\"
                    slashCount = slashCount + 1
                    bp = bp - 1
                Loop
                If (slashCount Mod 2) = 0 Then
                    inStr = False
                End If
            End If
        Else
            If ch = "{" Then
                depth = depth + 1
                If depth = 1 Then recStart = pos
            ElseIf ch = "}" Then
                depth = depth - 1
                If depth = 0 And recStart > 0 Then
                    If recCount > UBound(recs) Then
                        ReDim Preserve recs(recCount + 100)
                    End If
                    recs(recCount) = Mid(jsonStr, recStart, pos - recStart + 1)
                    recCount = recCount + 1
                    recStart = 0
                End If
            ElseIf ch = "]" And depth = 0 Then
                done = True
            ElseIf ch = """" Then
                inStr = True
            End If
        End If

        pos = pos + 1
    Loop

    If recCount = 0 Then
        ParseRecords = empty
        Exit Function
    End If

    ReDim Preserve recs(recCount - 1)
    ParseRecords = recs
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
Private Function IsoToDate(iso As String) As Variant
    If iso = "" Then
        IsoToDate = ""
        Exit Function
    End If
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
