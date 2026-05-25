Attribute VB_Name = "modDashboard"
' ============================================================
'  SUIVI E85 - Tableau de bord (10 KPIs)              v2.4.0.0
'  Roadmap X6
'
'  INSTALLATION :
'    1. Alt+F11 -> Fichier -> Importer ce .bas
'    2. Lancer CreerTableauDeBord() une fois (F5 depuis l'editeur VBA)
'    3. La feuille "Tableau de bord" est creee + remplie de formules
'       qui se mettent a jour automatiquement quand GS_Pleins change.
'
'  Pour rafraichir l'affichage : il suffit de re-executer CreerTableauDeBord
'  (les formules suivent automatiquement de toute facon).
' ============================================================
Option Explicit

Private Const WS_DASH  As String = "Tableau de bord"
Private Const WS_DATA  As String = "GS_Pleins"
Private Const TBL_NAME As String = "Tableau2"

' Palette (RGB)
Private Const C_BLUE_DK As Long = 6042395     ' #5C3A1B en BGR = #1B3A5C en RGB
Private Const C_BLUE_MD As Long = 11957550    ' #2E75B6
Private Const C_GREY    As Long = 7368816     ' #6B7280
Private Const C_BORDER  As Long = 15131618    ' #E2E8F0


' ════════════════════════════════════════════════════════════
'  POINT D'ENTREE
' ════════════════════════════════════════════════════════════
Public Sub CreerTableauDeBord()
    Dim ws As Worksheet
    Dim r  As Long

    Application.ScreenUpdating = False

    On Error Resume Next
    Set ws = ThisWorkbook.Sheets(WS_DASH)
    On Error GoTo 0

    If ws Is Nothing Then
        Set ws = ThisWorkbook.Sheets.Add(Before:=ThisWorkbook.Sheets(WS_DATA))
        ws.Name = WS_DASH
    End If

    ws.Cells.Clear

    ' ── Titre ──
    With ws.Range("A1:B1")
        .Merge
        .Value = ChrW(9981) & " TABLEAU DE BORD"        ' ChrW(9981) = ⛽
        .Font.Size = 18
        .Font.Bold = True
        .Font.Color = vbWhite
        .Interior.Color = RGB(27, 58, 92)
        .HorizontalAlignment = xlCenter
        .RowHeight = 38
    End With

    With ws.Range("A2:B2")
        .Merge
        .Value = "Mise a jour automatique a chaque modification des donnees"
        .Font.Italic = True
        .Font.Color = RGB(107, 114, 128)
        .Font.Size = 10
        .HorizontalAlignment = xlCenter
    End With

    ' ── En-tete KPIs ──
    With ws.Range("A4:B4")
        .Value = Array("INDICATEUR", "VALEUR")
        .Font.Bold = True
        .Font.Color = vbWhite
        .Interior.Color = RGB(46, 117, 182)
        .HorizontalAlignment = xlCenter
        .RowHeight = 26
    End With

    ' ── Lignes KPI ──
    r = 5

    AjouterKPI ws, r, "Consommation moyenne", _
        "=IFERROR(SUM(" & TBL_NAME & "[Nb. Litres])/(MAX(" & TBL_NAME & "[Km compteur])-MIN(" & TBL_NAME & "[Km compteur]))*100,0)", _
        "0.00"" L/100km"""
    r = r + 1

    AjouterKPI ws, r, "Cout au km", _
        "=IFERROR(SUMPRODUCT(" & TBL_NAME & "[Nb. Litres]," & TBL_NAME & "[Prix " & ChrW(8364) & "/L])/(MAX(" & TBL_NAME & "[Km compteur])-MIN(" & TBL_NAME & "[Km compteur])),0)", _
        "0.000"" " & ChrW(8364) & "/km"""
    r = r + 1

    AjouterKPI ws, r, "Total depense YTD", _
        "=SUMPRODUCT((YEAR(" & TBL_NAME & "[Date])=YEAR(TODAY()))*" & TBL_NAME & "[Nb. Litres]*" & TBL_NAME & "[Prix " & ChrW(8364) & "/L])", _
        "0"" " & ChrW(8364) & """"
    r = r + 1

    AjouterKPI ws, r, "Nombre de pleins YTD", _
        "=SUMPRODUCT((YEAR(" & TBL_NAME & "[Date])=YEAR(TODAY()))*1)", _
        "0"
    r = r + 1

    AjouterKPI ws, r, "% pleins E85", _
        "=IFERROR(COUNTIF(" & TBL_NAME & "[Type],""*E85*"")/COUNTA(" & TBL_NAME & "[Type]),0)", _
        "0%"
    r = r + 1

    AjouterKPI ws, r, "Economies estimees E85 vs SP98", _
        "=IFERROR(SUMIF(" & TBL_NAME & "[Type],""*E85*""," & TBL_NAME & "[Nb. Litres])*(AVERAGEIFS(" & TBL_NAME & "[SP98 station (" & ChrW(8364) & "/L)]," & TBL_NAME & "[SP98 station (" & ChrW(8364) & "/L)],"">0"")-AVERAGEIF(" & TBL_NAME & "[Type],""*E85*""," & TBL_NAME & "[Prix " & ChrW(8364) & "/L])),0)", _
        "0"" " & ChrW(8364) & " cumules"""
    r = r + 1

    AjouterKPI ws, r, "Prix moyen E85 (30 derniers jours)", _
        "=IFERROR(AVERAGEIFS(" & TBL_NAME & "[Prix " & ChrW(8364) & "/L]," & TBL_NAME & "[Type],""*E85*""," & TBL_NAME & "[Date],"">=""&TODAY()-30),0)", _
        "0.000"" " & ChrW(8364) & "/L"""
    r = r + 1

    AjouterKPI ws, r, "Date dernier plein", _
        "=IFERROR(MAX(" & TBL_NAME & "[Horodatage]),"""")", _
        "dd/mm/yyyy hh:mm"
    r = r + 1

    AjouterKPI ws, r, "Litres totaux cumules", _
        "=SUM(" & TBL_NAME & "[Nb. Litres])", _
        "0"" L"""
    r = r + 1

    AjouterKPI ws, r, "Km parcourus", _
        "=IFERROR(MAX(" & TBL_NAME & "[Km compteur])-MIN(" & TBL_NAME & "[Km compteur]),0)", _
        "#,##0"" km"""
    r = r + 1

    ' ── Largeurs et activation ──
    ws.Columns("A").ColumnWidth = 40
    ws.Columns("B").ColumnWidth = 24
    ws.Range("A1").Select
    ws.Activate

    Application.ScreenUpdating = True

    MsgBox "Tableau de bord cree avec succes." & vbNewLine & _
           "Les KPIs se mettent a jour automatiquement.", vbInformation, "KPIs E85"
End Sub


' ════════════════════════════════════════════════════════════
'  HELPER : ajoute une ligne KPI formatee
' ════════════════════════════════════════════════════════════
Private Sub AjouterKPI(ws As Worksheet, r As Long, label As String, _
                        formula As String, fmt As String)
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
End Sub
