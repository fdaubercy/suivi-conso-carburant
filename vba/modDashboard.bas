Attribute VB_Name = "modDashboard"
' ============================================================
'  SUIVI E85 - Tableau de bord (KPIs + Graphiques)   v2.5.0.0
'  Roadmap X6 (KPIs) + X7 (prix E85) + X8 (conso L/100km)
'
'  INSTALLATION :
'    1. Alt+F11 -> Fichier -> Importer ce .bas
'    2. Ctrl+G pour ouvrir la fenetre Immediate
'
'  USAGE :
'    CreerTableauDeBord  -> KPIs + graphiques (tout en un)
'    CreerGraphiques     -> graphiques seuls (si KPIs deja en place)
'    DiagnoseDashboard   -> debug feuille + colonnes
'
'  IMPLEMENTATION :
'    - Detecte dynamiquement le nom du tableau (ListObject)
'    - Detecte dynamiquement les noms de colonnes PAR POSITION
'    - Chaque KPI isole : si une formule plante, les autres continuent
'    - X7 : helper data Date|Prix E85|Station -> graphique ligne
'    - X8 : helper data Date|L/100km|Vehicule -> graphique ligne
'           (conso calculee entre pleins consecutifs, meme vehicule)
' ============================================================
Option Explicit

Private Const WS_DASH  As String = "Tableau de bord"
Private Const WS_DATA  As String = "GS_Pleins"
Private Const WS_GRAPH As String = "Graphiques"

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
'  POINT D'ENTREE PRINCIPAL
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

    ' ── 7. Mise en forme finale KPIs ──
    ws.Columns("A").ColumnWidth = 42
    ws.Columns("B").ColumnWidth = 24

    Debug.Print "KPIs - OK : " & okCount & " | KO : " & koCount

    If koCount > 0 Then
        MsgBox okCount & " KPIs ajoutes, " & koCount & " en erreur." & vbNewLine & _
               "Voir Immediate Window (Ctrl+G) pour le detail.", vbExclamation, "Dashboard E85"
    End If

Cleanup:
    Application.ScreenUpdating = True

    ' ── 8. Graphiques X7 + X8 ──
    CreerGraphiques

    ws.Range("A1").Select
    ws.Activate

    Debug.Print String(50, "=")
End Sub


' ════════════════════════════════════════════════════════════
'  X7 + X8 — GRAPHIQUES (feuille "Graphiques")
'  Peut etre lance independamment de CreerTableauDeBord.
' ════════════════════════════════════════════════════════════
Public Sub CreerGraphiques()
    Dim dataWs As Worksheet
    Dim ws     As Worksheet
    Dim tbl    As ListObject
    Dim i      As Long

    Application.ScreenUpdating = False
    Debug.Print String(50, "=")
    Debug.Print "CreerGraphiques - " & Now()

    ' ── Feuille de donnees ──
    On Error Resume Next
    Set dataWs = ThisWorkbook.Sheets(WS_DATA)
    On Error GoTo 0
    If dataWs Is Nothing Then
        MsgBox "Feuille '" & WS_DATA & "' introuvable.", vbCritical, "Graphiques E85"
        GoTo CleanupG
    End If
    If dataWs.ListObjects.Count = 0 Then
        MsgBox "Aucun tableau dans '" & WS_DATA & "'.", vbCritical, "Graphiques E85"
        GoTo CleanupG
    End If
    Set tbl = dataWs.ListObjects(1)
    g_tbl = tbl.Name
    For i = 1 To 14
        If i <= tbl.ListColumns.Count Then g_cols(i) = tbl.ListColumns(i).Name Else g_cols(i) = ""
    Next i

    ' Verifier qu'il y a des donnees
    If tbl.DataBodyRange Is Nothing Then
        MsgBox "Aucune donnee dans " & g_tbl & ".", vbInformation, "Graphiques E85"
        GoTo CleanupG
    End If

    ' ── Creer / vider feuille Graphiques ──
    On Error Resume Next
    Set ws = ThisWorkbook.Sheets(WS_GRAPH)
    On Error GoTo 0
    If ws Is Nothing Then
        Set ws = ThisWorkbook.Sheets.Add(After:=ThisWorkbook.Sheets(ThisWorkbook.Sheets.Count))
        ws.Name = WS_GRAPH
    End If
    ws.Cells.Clear
    Dim co As ChartObject
    For Each co In ws.ChartObjects: co.Delete: Next co

    ' ── Titre ──
    With ws.Range("A1")
        .Value = ChrW(9110) & " Graphiques — Suivi E85"
        .Font.Size = 14
        .Font.Bold = True
        .Font.Color = RGB(27, 58, 92)
    End With
    ws.Rows(1).RowHeight = 30

    ' ── X7 : Prix E85 par date ──
    Dim lastX7 As Long
    lastX7 = BuildX7Data(tbl, ws, 3)
    If lastX7 >= 5 Then
        BuildX7Chart ws, 3, lastX7
    Else
        ws.Cells(3, 1).Value = "X7 : pas assez de pleins E85 pour tracer le graphique."
    End If

    ' ── X8 : Conso L/100 km dans le temps ──
    Dim x8Start As Long
    x8Start = lastX7 + 32      ' Laisse de la place pour le graphique X7

    Dim lastX8 As Long
    lastX8 = BuildX8Data(tbl, ws, x8Start)
    If lastX8 >= x8Start + 3 Then
        BuildX8Chart ws, x8Start, lastX8
    Else
        ws.Cells(x8Start, 1).Value = "X8 : pas assez de pleins consecutifs pour calculer la conso."
    End If

    ' ── Finalisation ──
    ws.Columns("A:C").AutoFit
    ws.Activate
    ws.Range("A1").Select

CleanupG:
    Application.ScreenUpdating = True
    Debug.Print String(50, "=")
    MsgBox "Graphiques mis a jour.", vbInformation, "Graphiques E85"
End Sub


' ════════════════════════════════════════════════════════════
'  X7 — Helper data : Date | Prix E85 | Station
'       Retourne la derniere ligne utilisee.
' ════════════════════════════════════════════════════════════
Private Function BuildX7Data(tbl As ListObject, ws As Worksheet, startRow As Long) As Long
    ' En-tete de section
    With ws.Cells(startRow, 1)
        .Value = ChrW(9123) & " X7 — Evolution du prix E85 par date"
        .Font.Bold = True
        .Font.Color = RGB(46, 117, 182)
    End With

    ' En-tetes colonnes
    ws.Cells(startRow + 1, 1).Value = "Date"
    ws.Cells(startRow + 1, 2).Value = "Prix E85 (" & ChrW(8364) & "/L)"
    ws.Cells(startRow + 1, 3).Value = "Station"
    With ws.Range(ws.Cells(startRow + 1, 1), ws.Cells(startRow + 1, 3))
        .Font.Bold = True
        .Interior.Color = RGB(219, 234, 254)
    End With

    ' Lecture des donnees
    Dim data As Variant
    On Error Resume Next
    data = tbl.DataBodyRange.Value
    On Error GoTo 0
    If Not IsArray(data) Then BuildX7Data = startRow + 2: Exit Function

    Dim n As Long: n = UBound(data, 1)
    Dim outRow As Long: outRow = startRow + 2
    Dim r As Long

    For r = 1 To n
        Dim cellType As String
        cellType = CStr(data(r, COL_TYPE))
        If InStr(1, cellType, "E85", vbTextCompare) = 0 Then GoTo NextX7

        Dim cellDate As Variant: cellDate = data(r, COL_DATE)
        Dim cellPrix As Variant: cellPrix = data(r, COL_PRIX)
        If Not IsDate(cellDate) Then GoTo NextX7
        If Not IsNumeric(cellPrix) Then GoTo NextX7
        If CDbl(cellPrix) <= 0 Then GoTo NextX7

        ws.Cells(outRow, 1).Value = CDate(cellDate)
        ws.Cells(outRow, 1).NumberFormat = "dd/mm/yyyy"
        ws.Cells(outRow, 2).Value = CDbl(cellPrix)
        ws.Cells(outRow, 2).NumberFormat = "0.000"
        ws.Cells(outRow, 3).Value = CStr(data(r, COL_STATION))
        outRow = outRow + 1

NextX7:
    Next r

    BuildX7Data = outRow - 1
End Function


' ════════════════════════════════════════════════════════════
'  X7 — Graphique ligne : Date → Prix E85
' ════════════════════════════════════════════════════════════
Private Sub BuildX7Chart(ws As Worksheet, dataStart As Long, dataEnd As Long)
    Dim headerRow As Long: headerRow = dataStart + 1
    Dim firstData As Long: firstData = dataStart + 2

    If firstData > dataEnd Then Exit Sub

    Dim co As ChartObject
    Set co = ws.ChartObjects.Add( _
        Left:=ws.Columns("E").Left, _
        Top:=ws.Rows(dataStart).Top, _
        Width:=480, Height:=260)

    With co.Chart
        .ChartType = xlLineMarkers

        Dim rngX As Range: Set rngX = ws.Range(ws.Cells(firstData, 1), ws.Cells(dataEnd, 1))
        Dim rngY As Range: Set rngY = ws.Range(ws.Cells(firstData, 2), ws.Cells(dataEnd, 2))

        .SetSourceData Source:=rngY
        With .SeriesCollection(1)
            .Name     = "Prix E85 (" & ChrW(8364) & "/L)"
            .XValues  = rngX
            .Values   = rngY
            .Format.Line.ForeColor.RGB = RGB(46, 117, 182)
            .MarkerStyle = xlMarkerStyleCircle
            .MarkerSize  = 5
            .Format.Line.Weight = 2
        End With

        .HasTitle = True
        .ChartTitle.Text = ChrW(128200) & " Evolution du prix E85"
        .ChartTitle.Font.Size  = 12
        .ChartTitle.Font.Bold  = True
        .ChartTitle.Font.Color = RGB(27, 58, 92)

        With .Axes(xlCategory)
            .HasTitle = True
            .AxisTitle.Text = "Date"
            .TickLabels.NumberFormat = "mmm yy"
            .TickLabels.Font.Size    = 8
            .TickLabelSpacingIsAuto  = True
        End With

        With .Axes(xlValue)
            .HasTitle = True
            .AxisTitle.Text = ChrW(8364) & "/L"
            .TickLabels.NumberFormat = "0.000"
            .TickLabels.Font.Size    = 9
        End With

        On Error Resume Next
        .Legend.Delete
        On Error GoTo 0

        .PlotArea.Format.Fill.ForeColor.RGB = RGB(248, 250, 252)
        .ChartArea.Format.Line.Visible      = msoFalse
    End With
End Sub


' ════════════════════════════════════════════════════════════
'  X8 — Helper data : Date | L/100km | Vehicule
'       Calcule la conso entre pleins consecutifs (meme vehicule).
'       Retourne la derniere ligne utilisee.
' ════════════════════════════════════════════════════════════
Private Function BuildX8Data(tbl As ListObject, ws As Worksheet, startRow As Long) As Long
    ' En-tete de section
    With ws.Cells(startRow, 1)
        .Value = ChrW(9123) & " X8 — Consommation L/100 km dans le temps"
        .Font.Bold = True
        .Font.Color = RGB(29, 158, 117)
    End With

    ' En-tetes colonnes
    ws.Cells(startRow + 1, 1).Value = "Date"
    ws.Cells(startRow + 1, 2).Value = "L/100 km"
    ws.Cells(startRow + 1, 3).Value = "Vehicule"
    With ws.Range(ws.Cells(startRow + 1, 1), ws.Cells(startRow + 1, 3))
        .Font.Bold = True
        .Interior.Color = RGB(209, 250, 229)
    End With

    ' Lecture des donnees
    Dim data As Variant
    On Error Resume Next
    data = tbl.DataBodyRange.Value
    On Error GoTo 0
    If Not IsArray(data) Then BuildX8Data = startRow + 2: Exit Function

    Dim n As Long: n = UBound(data, 1)
    If n < 2 Then BuildX8Data = startRow + 2: Exit Function

    ' ── Copie dans une plage temporaire pour tri par vehicule+km ──
    ' On utilise un tableau de structure (vehicule, km, litres, date, indexOriginal)
    ' Tri: vehicule ASC puis km ASC (bubble sort — suffisant pour < 1000 lignes)
    Dim idx()  As Long
    ReDim idx(1 To n)
    Dim i As Long
    For i = 1 To n: idx(i) = i: Next i

    ' Bubble sort sur vehicule & km
    Dim j As Long, tmp As Long
    Dim vi As String, vj As String
    For i = 1 To n - 1
        For j = 1 To n - i
            vi = CStr(data(idx(j),   COL_VEHICULE)) & Format(Val(CStr(data(idx(j),   COL_KM))), "0000000000")
            vj = CStr(data(idx(j+1), COL_VEHICULE)) & Format(Val(CStr(data(idx(j+1), COL_KM))), "0000000000")
            If vi > vj Then
                tmp = idx(j): idx(j) = idx(j+1): idx(j+1) = tmp
            End If
        Next j
    Next i

    ' ── Calcul L/100 km entre pleins consecutifs (meme vehicule) ──
    Dim outRow As Long: outRow = startRow + 2
    Dim ri As Long, riPrev As Long

    For i = 2 To n
        ri     = idx(i)
        riPrev = idx(i - 1)

        ' Meme vehicule ?
        If CStr(data(ri, COL_VEHICULE)) <> CStr(data(riPrev, COL_VEHICULE)) Then GoTo NextX8

        ' Valeurs numeriques valides ?
        If Not IsNumeric(data(ri,     COL_KM))     Then GoTo NextX8
        If Not IsNumeric(data(riPrev, COL_KM))     Then GoTo NextX8
        If Not IsNumeric(data(ri,     COL_LITRES)) Then GoTo NextX8

        Dim kmCur   As Double: kmCur   = CDbl(data(ri,     COL_KM))
        Dim kmPrev  As Double: kmPrev  = CDbl(data(riPrev, COL_KM))
        Dim litCur  As Double: litCur  = CDbl(data(ri,     COL_LITRES))
        Dim delta   As Double: delta   = kmCur - kmPrev

        ' Filtre valeurs aberrantes (delta trop faible ou trop grand)
        If delta < 10 Or delta > 3000 Then GoTo NextX8

        Dim conso As Double: conso = litCur * 100# / delta

        ' Filtre conso aberrante (< 3 ou > 25 L/100)
        If conso < 3# Or conso > 25# Then GoTo NextX8

        Dim dateCur As Variant: dateCur = data(ri, COL_DATE)
        If Not IsDate(dateCur) Then GoTo NextX8

        ws.Cells(outRow, 1).Value = CDate(dateCur)
        ws.Cells(outRow, 1).NumberFormat = "dd/mm/yyyy"
        ws.Cells(outRow, 2).Value = Round(conso, 2)
        ws.Cells(outRow, 2).NumberFormat = "0.00"
        ws.Cells(outRow, 3).Value = CStr(data(ri, COL_VEHICULE))
        outRow = outRow + 1

NextX8:
    Next i

    BuildX8Data = outRow - 1
End Function


' ════════════════════════════════════════════════════════════
'  X8 — Graphique ligne : Date → L/100 km
' ════════════════════════════════════════════════════════════
Private Sub BuildX8Chart(ws As Worksheet, dataStart As Long, dataEnd As Long)
    Dim headerRow As Long: headerRow = dataStart + 1
    Dim firstData As Long: firstData = dataStart + 2

    If firstData > dataEnd Then Exit Sub

    Dim co As ChartObject
    Set co = ws.ChartObjects.Add( _
        Left:=ws.Columns("E").Left, _
        Top:=ws.Rows(dataStart).Top, _
        Width:=480, Height:=260)

    With co.Chart
        .ChartType = xlLineMarkers

        Dim rngX As Range: Set rngX = ws.Range(ws.Cells(firstData, 1), ws.Cells(dataEnd, 1))
        Dim rngY As Range: Set rngY = ws.Range(ws.Cells(firstData, 2), ws.Cells(dataEnd, 2))

        .SetSourceData Source:=rngY
        With .SeriesCollection(1)
            .Name    = "L/100 km"
            .XValues = rngX
            .Values  = rngY
            .Format.Line.ForeColor.RGB = RGB(29, 158, 117)
            .MarkerStyle = xlMarkerStyleCircle
            .MarkerSize  = 5
            .Format.Line.Weight = 2
        End With

        .HasTitle = True
        .ChartTitle.Text = ChrW(9981) & " Consommation L/100 km"
        .ChartTitle.Font.Size  = 12
        .ChartTitle.Font.Bold  = True
        .ChartTitle.Font.Color = RGB(27, 58, 92)

        With .Axes(xlCategory)
            .HasTitle = True
            .AxisTitle.Text = "Date"
            .TickLabels.NumberFormat = "mmm yy"
            .TickLabels.Font.Size    = 8
            .TickLabelSpacingIsAuto  = True
        End With

        With .Axes(xlValue)
            .HasTitle = True
            .AxisTitle.Text = "L/100 km"
            .TickLabels.NumberFormat = "0.00"
            .TickLabels.Font.Size    = 9
        End With

        On Error Resume Next
        .Legend.Delete
        On Error GoTo 0

        .PlotArea.Format.Fill.ForeColor.RGB = RGB(240, 253, 244)
        .ChartArea.Format.Line.Visible      = msoFalse
    End With
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
