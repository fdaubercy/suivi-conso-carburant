Attribute VB_Name = "modSyncDiag"
' ============================================================
'  modSyncDiag - Diagnostic sync + rafraichissement prix (X44 P4)
' ============================================================
'  TestConnexion (HTTP GET brut), SyncDiagnose (comparaison GS<->Excel),
'  RafraichirPrixHistory (refresh PQ marche), extraits de modSyncGS.
'  Config via modSyncCfg ; HTTP via modSyncNet ; JSON via modSyncJson ;
'  SyncSecretQS (Public) via modSyncGS. SetStatus/SetStatusBlock
'  dupliques Private (SetStatus est Public dans ModuleImportGS -> ne pas
'  exporter, cf. lecon collision de noms).
Option Explicit

Private Sub SetStatus(msg As String)
    Application.StatusBar = "[Sync E85] " & msg
    Debug.Print Format(now(), "hh:mm:ss") & "  " & msg
End Sub

Private Sub SetStatusBlock(title As String, body As String)
    Application.StatusBar = "[Sync E85] " & title
    Debug.Print String(60, "-")
    Debug.Print Format(now(), "hh:mm:ss") & "  " & title
    Debug.Print body
    Debug.Print String(60, "-")
End Sub

' ============================================================
'  DIAGNOSTIC
' ============================================================
Public Sub TestConnexion()
    Dim url    As String: url = GAS_URL & "?action=export&token=" & APP_TOKEN & SyncSecretQS()
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
            h.Send
            If Err.Number <> 0 Then errTxt = Err.Description: Err.Clear
        Else
            errTxt = "Aucun composant HTTP disponible."
            Err.Clear
        End If
    End If

    If errTxt = "" And Not h Is Nothing Then
        status = h.status
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

' ============================================================
'  DIAGNOSTIC DE SYNC
' ============================================================
Public Sub SyncDiagnose()
    Dim ws       As Worksheet
    Dim jsonStr  As String
    Dim gsRecs() As String
    Dim i        As Long
    Dim r        As Long
    Dim lastRow  As Long
    Dim sid      As String

    Dim nGsTotal       As Long
    Dim nGsWithSid     As Long
    Dim nLocalTotal    As Long
    Dim nLocalWithSid  As Long
    Dim nMatching      As Long
    Dim nOnlyGs        As Long
    Dim nOnlyLocal     As Long
    Dim nGsNoSid       As Long
    Dim nLocalNoSid    As Long
    Dim nDirty         As Long  ' v2.9 : lignes avec modif locale non syncees

    Set ws = ThisWorkbook.Sheets(WS_NAME)

    SetStatus "Diagnose : recuperation export GS..."
    jsonStr = HttpGet(GAS_URL & "?action=export&token=" & APP_TOKEN & SyncSecretQS())
    If jsonStr = "" Or InStr(jsonStr, """records""") = 0 Then
        SetStatus "Diagnose ERREUR : export GS inaccessible (lancer TestConnexion)"
        Exit Sub
    End If

    gsRecs = ParseRecords(jsonStr)

    Dim gsIds As Object
    Set gsIds = CreateObject("Scripting.Dictionary")
    gsIds.CompareMode = vbTextCompare

    nGsTotal = UBound(gsRecs) + 1
    If gsRecs(0) = "" Then nGsTotal = 0

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

    Dim localIds As Object
    Set localIds = CreateObject("Scripting.Dictionary")
    localIds.CompareMode = vbTextCompare

    lastRow = ws.Cells(ws.rows.count, 1).End(xlUp).row
    nLocalTotal = lastRow - 1

    For r = 2 To lastRow
        sid = Trim(CStr(ws.Cells(r, COL_SYNC_ID).value))
        If sid <> "" Then
            localIds(sid) = True
            nLocalWithSid = nLocalWithSid + 1
        Else
            nLocalNoSid = nLocalNoSid + 1
        End If
        ' v2.9 : compter les lignes dirty (col P renseignee)
        If ws.Cells(r, COL_MODIFIED).value <> "" Then nDirty = nDirty + 1
    Next r

    Dim key As Variant
    For Each key In gsIds.keys
        If localIds.Exists(CStr(key)) Then
            nMatching = nMatching + 1
        Else
            nOnlyGs = nOnlyGs + 1
        End If
    Next key

    For Each key In localIds.keys
        If Not gsIds.Exists(CStr(key)) Then nOnlyLocal = nOnlyLocal + 1
    Next key

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
           "  Modif. local.: " & nDirty & " (col P set -- seront envoyes en bulkUpdate)" & vbNewLine & _
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

    If nDirty > 0 Then
        body = body & vbNewLine & vbNewLine & _
               "INFO v2.9 : " & nDirty & " ligne(s) avec modif. locale en attente." & vbNewLine & _
               "-> Lancer SyncManuel() pour propager vers GS (action=bulkUpdate)."
    End If

    Dim summary As String
    summary = "GS=" & nGsTotal & " (sid:" & nGsWithSid & ") | XL=" & nLocalTotal & _
              " (sid:" & nLocalWithSid & ") | dirty:" & nDirty & _
              " | sync->GS:" & nOnlyLocal & " ->XL:" & nOnlyGs

    SetStatusBlock "Diagnose : " & summary, body
End Sub

' ============================================================
'  RAFRAICHISSEMENT PRIX MARCHE (PrixHistory)
' ============================================================
Public Sub RafraichirPrixHistory(Optional silent As Boolean = False)
    Const pH As String = "PrixHistory"
    Dim ws As Worksheet, lo As ListObject, cn As WorkbookConnection
    Dim refreshed As Boolean

    Application.Cursor = xlWait

    ' 1) Voie principale : la QueryTable de la table "PrixHistory".
    For Each ws In ThisWorkbook.Worksheets
        For Each lo In ws.ListObjects
            If StrComp(lo.name, pH, vbTextCompare) = 0 Then
                On Error Resume Next
                If Not lo.QueryTable Is Nothing Then
                    lo.QueryTable.BackgroundQuery = False
                    lo.QueryTable.Refresh BackgroundQuery:=False
                    If Err.Number = 0 Then refreshed = True
                End If
                On Error GoTo 0
            End If
        Next lo
    Next ws

    ' 2) Repli : connexion Power Query dont le nom contient "PrixHistory"
    '    (le prefixe est localise : "Query - " ou "Requete - ").
    If Not refreshed Then
        On Error Resume Next
        For Each cn In ThisWorkbook.Connections
            If InStr(1, cn.name, pH, vbTextCompare) > 0 Then
                cn.OLEDBConnection.BackgroundQuery = False
                cn.Refresh
                If Err.Number = 0 Then refreshed = True
            End If
        Next cn
        On Error GoTo 0
    End If

    Application.Cursor = xlDefault
    If silent Then Exit Sub
    If refreshed Then
        SetStatus "[PrixHistory] " & ChrW(10003) & " Prix marche rafraichis depuis Google Sheets."
    Else
        SetStatus "[PrixHistory] " & ChrW(9888) & " Table 'PrixHistory' introuvable (importer powerquery\PrixHistory.m)."
    End If
End Sub
