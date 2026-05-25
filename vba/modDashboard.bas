Attribute VB_Name = "modDashboard"
' ============================================================
'  SUIVI E85 - Tableau de bord (KPIs)                v2.4.0.3
'  Roadmap X6
'
'  INSTALLATION :
'    1. Alt+F11 -> Fichier -> Importer ce .bas
'    2. Ctrl+G pour ouvrir la fenetre Immediate
'    3. Curseur dans CreerTableauDeBord -> F5
'
'  IMPLEMENTATION :
'    - Detecte dynamiquement le nom du tableau (ListObject)
'    - Detecte dynamiquement les noms de colonnes PAR POSITION
'      (s'adapte aux variantes : "Km" vs "Km compteur", "Litres"
'      vs "Nb. Litres", "PrixL" vs "Prix EUR/L", etc.)
'    - Chaque KPI isole : si une formule plante, les autres continuent
'
'  EN CAS D'ERREUR : lancer DiagnoseDashboard() (F5) pour voir
'    feuilles, tableau et tous les en-tetes detectes.
' ============================================================
Option Explicit

Private Const WS_DASH As String = "Tableau de bord"
Private Const WS_DATA As String = "GS_Pleins"

' Positions semantiques des colonnes (1-based, ordre du schema E85)
Private Const COL_HORODATAGE As Long = 1
Private Const COL_DATE       As Long = 2
Private Const COL_TYPE       As Long = 3
Private Const COL_KM         As Long = 4
Private Const COL_LITRES     As Long = 5
Private Const COL_PRIX       As Long = 6
Private Const COL_STATION    As Long = 7
Private Const COL_VEHICULE   As Long = 8
Private Const COL_E85        As Long = 9
Private Const COL_SP98       As Long = 10
Private Const COL_SP95       As Long = 11
Private Const COL_E10        As Long = 12
Private Const COL_GAZOLE     As Long = 13
Private Const COL_GPLC       As Long = 14

' Detection dynamique
Private g_tbl  As String              ' Nom du ListObject
Private g_cols(1 To 14) As String     ' Noms reels des colonnes par position


' ════════════════════════════════════════════════════════════
'  DIAGNOSTIC
' ════════════════════════════════════════════════════════════
Public Sub DiagnoseDashboard()
    Dim ws As Worksheet
    Dim sh As Worksheet
    Dim tbl As ListObject
    Dim c As ListColumn

    Debug.Print String(50, "=")
    Debug.Print "DIAGNOSE DASHBOARD - " & Now()
    Debug.Print String(50, "=")

    Debug.Print vbNewLine & "FEUILLES DU CLASSEUR :"
    For Each sh In ThisWorkbook.Sheets
        Debug.Print "  - " & sh.Name
    Next sh

    On Error Resume Next
    Set ws = ThisWorkbook.Sheets(WS_DATA)
    On Error GoTo 0

    If ws Is Nothing Then
        Debug.Print vbNewLine & "[!] Feuille '" & WS_DATA & "' INTROUVABLE !"
        Exit Sub
    End If

    Debug.Print vbNewLine & "TABLEAUX (ListObjects) dans '" & WS_DATA & "' :"
    If ws.ListObjects.Count = 0 Then
        Debug.Print "  [!] AUCUN tableau detecte."
    Else
        For Each tbl In ws.ListObjects
            Debug.Print "  - " & tbl.Name & " (" & tbl.ListColumns.Count & " colonnes)"
            Debug.Print "    Colonnes :"
            For Each c In tbl.ListColumns
                Debug.Print "      " & c.Index & ". [" & c.Name & "]"
            Next c
        Next tbl
    End If

    Debug.Print vbNewLine & String(50, "=")
End Sub


' ════════════════════════════════════════════════════════════
'  POINT D'ENTREE
' ════════════════════════════════════════════════════════════
Public Sub CreerTableauDeBord()
    Dim ws As Worksheet
    Dim dataWs As Worksheet
    Dim tbl As ListObject
    Dim r As Long
    Dim i As Long
    Dim okCount As Long, koCount As Long

    Application.ScreenUpdating = False
    Debug.Print String(50, "=")
    Debug.Print "CreerTableauDeBord - " & Now()

    ' ── 1. Verifier la feuille de donnees ──
    On Error Resume Next
    Set dataWs = ThisWorkbook.Sheets(WS_DATA)
    On Error GoTo 0
    If dataWs Is Nothing Then
        MsgBox "Feuille '" & WS_DATA & "' introuvable.", vbCritical, "Dashboard E85"
        GoTo Cleanup
    End If

    ' ── 2. Detecter le ListObject + noms reels des colonnes ──
    If dataWs.ListObjects.Count = 0 Then
        MsgBox "Aucun tableau dans '" & WS_DATA & "'.", vbCritical, "Dashboard E85"
        GoTo Cleanup
    End If
    Set tbl = dataWs.ListObjects(1)
    g_tbl = tbl.Name
    Debug.Print "Table detectee : " & g_tbl

    For i = 1 To 14
        If i <= tbl.ListColumns.Count Then
            g_cols(i) = tbl.ListColumns(i).Name
        Else
            g_cols(i) = ""
        End If
    Next i

    Debug.Print "Mapping colonnes :"
    Debug.Print "  Horodatage [" & g_cols(COL_HORODATAGE) & "]"
    Debug.Print "  Date       [" & g_cols(COL_DATE) & "]"
    Debug.Print "  Type       [" & g_cols(COL_TYPE) & "]"
    Debug.Print "  Km         [" & g_cols(COL_KM) & "]"
    Debug.Print "  Litres     [" & g_cols(COL_LITRES) & "]"
    Debug.Print "  Prix       [" & g_cols(COL_PRIX) & "]"
    Debug.Print "  SP98       [" & g_cols(COL_SP98) & "]"

    ' ── 3. Creer / vider la feuille dashboard ──
    On Error Resume Next
    Set ws = ThisWorkbook.Sheets(WS_DASH)
    On Error GoTo 0
    If ws Is Nothing Then
        Set ws = ThisWorkbook.Sheets.Add(Before:=dataWs)
        ws.Name = WS_DASH
    End If
    ws.Cells.Clear

    ' ── 4. Titre ──
    On Error Resume Next
    ws.Range("A1:B1").Merge
    On Error GoTo 0
    With ws.Range("A1")
        .Value = ChrW(9981) & " TABLEAU DE BORD"
        .Font.Size = 18
        .Font.Bold = True
        .Font.Color = vbWhite
        .Interior.Color = RGB(27, 58, 92)
        .HorizontalAlignment = xlCenter
    End With
    ws.Rows(1).RowHeight = 38

    On Error Resume Next
    ws.Range("A2:B2").Merge
    On Error GoTo 0
    With ws.Range("A2")
        .Value = "Mise a jour automatique a chaque modification des donnees"
        .Font.Italic = True
        .Font.Color = RGB(107, 114, 128)
        .Font.Size = 10
        .HorizontalAlignment = xlCenter
    End With

    ' ── 5. En-tete KPIs ──
    ws.Cells(4, 1).Value = "INDICATEUR"
    ws.Cells(4, 2).Value = "VALEUR"
    With ws.Range("A4:B4")
        .Font.Bold = True
        .Font.Color = vbWhite
        .Interior.Color = RGB(46, 117, 182)
        .HorizontalAlignment = xlCenter
    End With
    ws.Rows(4).RowHeight = 26

    ' ── 6. Lignes KPI ──
    r = 5

    If AjouterKPI(ws, r, "Consommation moyenne", _
        "=IFERROR(SUM(" & cr(COL_LITRES) & ")/(MAX(" & cr(COL_KM) & ")-MIN(" & cr(COL_KM) & "))*100,0)", _
        "0.00"" L/100km""") Then okCount = okCount + 1 Else koCount = koCount + 1
    r = r + 1

    If AjouterKPI(ws, r, "Cout au km", _
        "=IFERROR(SUMPRODUCT(" & cr(COL_LITRES) & "," & cr(COL_PRIX) & ")/(MAX(" & cr(COL_KM) & ")-MIN(" & cr(COL_KM) & ")),0)", _
        "0.000"" " & ChrW(8364) & "/km""") Then okCount = okCount + 1 Else koCount = koCount + 1
    r = r + 1

    If AjouterKPI(ws, r, "Total depense YTD", _
        "=SUMPRODUCT((YEAR(" & cr(COL_DATE) & ")=YEAR(TODAY()))*" & cr(COL_LITRES) & "*" & cr(COL_PRIX) & ")", _
        "0"" " & ChrW(8364) & """") Then okCount = okCount + 1 Else koCount = koCount + 1
    r = r + 1

    If AjouterKPI(ws, r, "Nombre de pleins YTD", _
        "=SUMPRODUCT((YEAR(" & cr(COL_DATE) & ")=YEAR(TODAY()))*1)", _
        "0") Then okCount = okCount + 1 Else koCount = koCount + 1
    r = r + 1

    If AjouterKPI(ws, r, "% pleins E85", _
        "=IFERROR(COUNTIF(" & cr(COL_TYPE) & ",""*E85*"")/COUNTA(" & cr(COL_TYPE) & "),0)", _
        "0%") Then okCount = okCount + 1 Else koCount = koCount + 1
    r = r + 1

    If AjouterKPI(ws, r, "Economies estimees E85 vs SP98", _
        "=IFERROR(SUMIF(" & cr(COL_TYPE) & ",""*E85*""," & cr(COL_LITRES) & ")*(AVERAGEIFS(" & cr(COL_SP98) & "," & cr(COL_SP98) & ","">0"")-AVERAGEIF(" & cr(COL_TYPE) & ",""*E85*""," & cr(COL_PRIX) & ")),0)", _
        "0"" " & ChrW(8364) & " cumules""") Then okCount = okCount + 1 Else koCount = koCount + 1
    r = r + 1

    If AjouterKPI(ws, r, "Prix moyen E85 (30 derniers jours)", _
        "=IFERROR(AVERAGEIFS(" & cr(COL_PRIX) & "," & cr(COL_TYPE) & ",""*E85*""," & cr(COL_DATE) & ","">=""&TODAY()-30),0)", _
        "0.000"" " & ChrW(8364) & "/L""") Then okCount = okCount + 1 Else koCount = koCount + 1
    r = r + 1

    If AjouterKPI(ws, r, "Date dernier plein", _
        "=IFERROR(MAX(" & cr(COL_HORODATAGE) & "),"""")", _
        "dd/mm/yyyy hh:mm") Then okCount = okCount + 1 Else koCount = koCount + 1
    r = r + 1

    If AjouterKPI(ws, r, "Litres totaux cumules", _
        "=SUM(" & cr(COL_LITRES) & ")", _
        "0"" L""") Then okCount = okCount + 1 Else koCount = koCount + 1
    r = r + 1

    If AjouterKPI(ws, r, "Km parcourus", _
        "=IFERROR(MAX(" & cr(COL_KM) & ")-MIN(" & cr(COL_KM) & "),0)", _
        "#,##0"" km""") Then okCount = okCount + 1 Else koCount = koCount + 1
    r = r + 1

    ' ── 7. Mise en forme finale ──
    ws.Columns("A").ColumnWidth = 42
    ws.Columns("B").ColumnWidth = 24
    ws.Range("A1").Select
    ws.Activate

Cleanup:
    Application.ScreenUpdating = True

    Debug.Print "OK : " & okCount & " | KO : " & koCount
    Debug.Print String(50, "=")

    If koCount > 0 Then
        MsgBox okCount & " KPIs ajoutes, " & koCount & " en erreur." & vbNewLine & _
               "Voir Immediate Window (Ctrl+G) pour le detail.", vbExclamation, "Dashboard E85"
    Else
        MsgBox "Tableau de bord cree avec succes (" & okCount & " KPIs).", _
               vbInformation, "Dashboard E85"
    End If
End Sub


' ════════════════════════════════════════════════════════════
'  HELPERS
' ════════════════════════════════════════════════════════════

' Construit une reference structuree : "GS_Pleins[Litres]"
Private Function cr(colIdx As Long) As String
    cr = g_tbl & "[" & g_cols(colIdx) & "]"
End Function

' Ajoute une ligne KPI - retourne True si succes
Private Function AjouterKPI(ws As Worksheet, r As Long, label As String, _
                             formula As String, fmt As String) As Boolean
    On Error GoTo Err_

    With ws.Cells(r, 1)
        .Value = label
        .Font.Color = RGB(107, 114, 128)
        .Font.Size = 11
        .HorizontalAlignment = xlLeft
        .IndentLevel = 1
    End With

    With ws.Cells(r, 2)
        .Formula = formula
        .NumberFormat = fmt
        .Font.Bold = True
        .Font.Color = RGB(27, 58, 92)
        .Font.Size = 13
        .HorizontalAlignment = xlRight
    End With

    ws.Rows(r).RowHeight = 26

    With ws.Range("A" & r & ":B" & r).Borders(xlEdgeBottom)
        .LineStyle = xlContinuous
        .Color = RGB(226, 232, 240)
        .Weight = xlThin
    End With

    AjouterKPI = True
    Exit Function

Err_:
    Debug.Print "  [KO] L" & r & " '" & label & "' : " & Err.Description
    Debug.Print "       Formule : " & formula
    ws.Cells(r, 1).Value = label & " (erreur)"
    ws.Cells(r, 2).Value = "#ERR"
    ws.Cells(r, 2).Font.Color = RGB(226, 75, 74)
    AjouterKPI = False
End Function
