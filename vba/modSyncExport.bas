Attribute VB_Name = "modSyncExport"
' ============================================================
'  modSyncExport - Export Excel -> Google Sheets (X44 P4)
' ============================================================
'  bulkAdd (lignes absentes), bulkUpdate (lignes modifiees),
'  syncStations, extraits de modSyncEngine. Config via modSyncCfg ;
'  JSON via modSyncJson (jS/jN/JEsc/k/JsonGet/GenerateUUID) ;
'  HTTP via modSyncNet (HttpPost) ; IsGarbageSid (Public) via
'  modSyncEngine. Public : appeles par SyncCore (modSyncEngine).
Option Explicit

Public Function ExportExcelToGS(ws As Worksheet, gsRecs() As String) As Long
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

    lastRow = ws.Cells(ws.rows.count, 1).End(xlUp).row
    ReDim rowsJson(lastRow - 2)
    count = 0

    For r = 2 To lastRow
        If ws.Cells(r, 1).value = "" Then GoTo NextRow

        lsid = Trim(CStr(ws.Cells(r, COL_SYNC_ID).value))
        ' Anti-corruption : ne jamais (re)pousser une ligne fantome vers GS
        ' (sinon un nettoyage cote GS la recreerait au prochain bulkAdd).
        If IsGarbageSid(lsid) Then GoTo NextRow
        If lsid = "" Then
            lsid = GenerateUUID()
            Application.EnableEvents = False
            ws.Cells(r, COL_SYNC_ID).value = lsid
            Application.EnableEvents = True
        End If

        ' Envoyer seulement les lignes absentes de GS
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
    payload = "{""action"":""bulkAdd"",""token"":""" & APP_TOKEN & """,""rows"":[" & Join(rowsJson, ",") & "]}"
    HttpPost GAS_URL, payload
    ExportExcelToGS = count
End Function

Public Function ExportModificationsToGS(ws As Worksheet, gsRecs() As String) As Long
    ' Construire le set des sync_id presents dans GS
    Dim gsIds As Object
    Set gsIds = CreateObject("Scripting.Dictionary")
    gsIds.CompareMode = vbTextCompare
    Dim i As Long
    For i = 0 To UBound(gsRecs)
        Dim gid As String: gid = JsonGet(gsRecs(i), "sync_id")
        If gid <> "" Then gsIds(gid) = True
    Next i

    Dim lastRow As Long
    lastRow = ws.Cells(ws.rows.count, 1).End(xlUp).row

    Dim rowsJson()  As String
    Dim dirtyRows() As Long           ' indices de ligne pour effacement col P
    ReDim rowsJson(lastRow - 2)
    ReDim dirtyRows(lastRow - 2)
    Dim count As Long: count = 0

    Dim r    As Long
    Dim lsid As String

    For r = 2 To lastRow
        If ws.Cells(r, 1).value = "" Then GoTo NextRow2

        lsid = Trim(CStr(ws.Cells(r, COL_SYNC_ID).value))

        ' Condition : sync_id connu de GS + col P renseignee (dirty)
        If lsid = "" Then GoTo NextRow2
        If Not gsIds.Exists(lsid) Then GoTo NextRow2
        If CStr(ws.Cells(r, COL_MODIFIED).value) = "" Then GoTo NextRow2

        rowsJson(count) = RowToJson(ws, r, lsid)
        dirtyRows(count) = r
        count = count + 1
NextRow2:
    Next r

    If count = 0 Then
        ExportModificationsToGS = 0
        Exit Function
    End If

    ReDim Preserve rowsJson(count - 1)
    ReDim Preserve dirtyRows(count - 1)

    Dim payload As String
    payload = "{""action"":""bulkUpdate"",""token"":""" & APP_TOKEN & """,""rows"":[" & Join(rowsJson, ",") & "]}"
    Dim resp As String
    resp = HttpPost(GAS_URL, payload)

    ' Effacer col P si le POST a reussi (reponse HTTP 200 non vide)
    ' et ne contient pas "error"
    Dim success As Boolean
    success = (resp <> "" And InStr(1, LCase(resp), "error") = 0)

    If success Then
        Application.EnableEvents = False
        Dim j As Long
        For j = 0 To count - 1
            ws.Cells(dirtyRows(j), COL_MODIFIED).value = ""
        Next j
        Application.EnableEvents = True
        ExportModificationsToGS = count
    Else
        ' GAS ne supporte pas encore bulkUpdate : col P conservee,
        ' les modifs seront renvoyees au prochain sync
        Debug.Print Format(now(), "hh:mm:ss") & _
            "  ExportModificationsToGS : reponse inattendue ou GAS sans bulkUpdate." & _
            " Reponse=" & Left(resp, 200)
        ExportModificationsToGS = 0
    End If
End Function

Private Function RowToJson(ws As Worksheet, r As Long, sid As String) As String
    Dim ts As String
    Dim ds As String
    Dim ms As String   ' S5 : horodatage de derniere modif (col Q, repli sur horodatage)

    If IsDate(ws.Cells(r, 1).value) Then
        ts = Format(ws.Cells(r, 1).value, "yyyy-mm-dd hh:mm:ss")
    End If
    If IsDate(ws.Cells(r, 2).value) Then
        ds = Format(ws.Cells(r, 2).value, "yyyy-mm-dd")
    End If
    If IsDate(ws.Cells(r, COL_MODIFIED).value) Then
        ms = Format(ws.Cells(r, COL_MODIFIED).value, "yyyy-mm-dd hh:mm:ss")
    Else
        ms = ts
    End If

    RowToJson = "{" & _
        jS("sync_id", sid) & "," & _
        jS("horodatage", ts) & "," & _
        jS("modifiedAt", ms) & "," & _
        jS("date", ds) & "," & _
        jS("type", CStr(ws.Cells(r, 3).value)) & "," & _
        jN("km", ws.Cells(r, 4).value) & "," & _
        jN("litres", ws.Cells(r, 5).value) & "," & _
        jN("prix", ws.Cells(r, 6).value) & "," & _
        jS("station", CStr(ws.Cells(r, 7).value)) & "," & _
        jS("vehicule", CStr(ws.Cells(r, 8).value)) & "," & _
        """stationPrices"":{" & _
            jN("E85", ws.Cells(r, 9).value) & "," & _
            jN("SP98", ws.Cells(r, 10).value) & "," & _
            jN("SP95", ws.Cells(r, 11).value) & "," & _
            jN("E10", ws.Cells(r, 12).value) & "," & _
            jN("GAZOLE", ws.Cells(r, 13).value) & "," & _
            jN("GPLC", ws.Cells(r, 14).value) & _
        "}}"
End Function

Public Function PushStationsToGS() As Long
    Dim ws   As Worksheet
    Dim tbl  As ListObject
    Dim seen As Object
    Dim c    As Range
    Dim v    As String
    Dim json As String
    Dim body As String
    Dim resp As String
    Dim cnt  As Long

    On Error GoTo done

    Set ws = Nothing
    On Error Resume Next
    Set ws = ThisWorkbook.Sheets(STATIONS_WS)
    If ws Is Nothing Then On Error GoTo 0: PushStationsToGS = -1: Exit Function
    Set tbl = ws.ListObjects(STATIONS_TBL)
    On Error GoTo done
    If tbl Is Nothing Then PushStationsToGS = -1: Exit Function
    If tbl.DataBodyRange Is Nothing Then PushStationsToGS = -1: Exit Function

    Set seen = CreateObject("Scripting.Dictionary")
    seen.CompareMode = vbTextCompare

    ' En-tete en premier (la feuille "Stations" attend un header en ligne 1)
    json = """" & JEsc(k("Station essence utilis{e}e")) & """"

    cnt = 0
    For Each c In tbl.DataBodyRange.Columns(1).Cells
        v = Trim(CStr(c.value))
        If v <> "" And Not seen.Exists(v) Then
            seen(v) = True
            json = json & ",""" & JEsc(v) & """"
            cnt = cnt + 1
        End If
    Next c

    body = "{""action"":""syncStations"",""token"":""" & APP_TOKEN & """,""stations"":[" & json & "]}"
    resp = HttpPost(GAS_URL, body)

    If InStr(resp, """success"":true") > 0 Then
        PushStationsToGS = cnt
    Else
        Debug.Print Format(now(), "hh:mm:ss") & _
            "  PushStationsToGS : reponse inattendue. Reponse=" & Left(resp, 200)
        PushStationsToGS = -1
    End If
    Exit Function
done:
    PushStationsToGS = -1
End Function
