Attribute VB_Name = "modGraphRender"
' ============================================================
'  modGraphRender - Rendu graphiques/formes (X44 P3)
' ============================================================
'  Add*Chart + BuildKPICards + Ensure*/Style/Purge, extraits de
'  modGraphiques. Config via modGraphCfg ; NumOr0 via modGraphData.
'  Public : les Add*Chart + Delete/Purge + StyleShape appeles par
'  l'orchestrateur / modGraphChrome. Le chrome (ParamBlock/HeaderBand/
'  Buttons/PictureButton) est extrait dans modGraphChrome (X44 P4).
Option Explicit

Public Sub AddChartXY(ws As Worksheet, key As String, src As Range, typ As Long, titre As String, _
                       L As Double, T As Double, w As Double, h As Double, _
                       smooth As Boolean, Optional catFmt As String = "dd/mm/yyyy")
    Dim co As ChartObject
    Set co = EnsureChart(ws, key, L, T, w, h)
    With co.Chart
        .ChartType = typ
        .SetSourceData Source:=src, PlotBy:=xlColumns
        .HasTitle = True
        .ChartTitle.text = titre
        .ChartTitle.Font.Size = 11
        .ChartTitle.Font.bold = True
        .HasLegend = (.SeriesCollection.count > 1)
        If .HasLegend Then .Legend.Position = xlLegendPositionBottom
        On Error Resume Next
        .ChartArea.Border.LineStyle = xlNone
        If smooth Then
            Dim si As Long
            For si = 1 To .SeriesCollection.count
                .SeriesCollection(si).smooth = False
                .SeriesCollection(si).MarkerStyle = xlMarkerStyleCircle
                .SeriesCollection(si).MarkerSize = 3
            Next si
        End If
        .Axes(xlCategory).CategoryType = xlTimeScale
        .Axes(xlCategory).TickLabels.NumberFormat = catFmt
        .Axes(xlCategory).TickLabels.NumberFormatLinked = False
        On Error GoTo 0
    End With
End Sub

Public Sub AddBudgetTrendChart(ws As Worksheet, key As String, wsd As Worksheet, rBudg As Long, _
                                L As Double, T As Double, w As Double, h As Double)
    Dim co As ChartObject
    Set co = EnsureChart(ws, key, L, T, w, h)
    With co.Chart
        .ChartType = xlColumnClustered
        .SetSourceData Source:=wsd.Range("S1").Resize(rBudg, 3), PlotBy:=xlColumns
        .HasTitle = True
        .ChartTitle.text = "Tendance depenses - 6 mois + objectif"
        .ChartTitle.Font.Size = 11: .ChartTitle.Font.bold = True
        On Error Resume Next
        ' 2e serie (Objectif) en ligne
        If .SeriesCollection.count >= 2 Then
            .SeriesCollection(2).ChartType = xlLine
            .SeriesCollection(2).Format.Line.ForeColor.RGB = C_OBJ
            .SeriesCollection(2).Format.Line.DashStyle = msoLineDash
        End If
        .SeriesCollection(1).Format.fill.ForeColor.RGB = C_COUT
        .HasLegend = True: .Legend.Position = xlLegendPositionBottom
        .ChartArea.Border.LineStyle = xlNone
        .Axes(xlCategory).TickLabels.NumberFormat = "mm/yyyy"
        .Axes(xlCategory).TickLabels.NumberFormatLinked = False
        On Error GoTo 0
    End With
End Sub

Public Sub AddCo2MonthlyChart(ws As Worksheet, key As String, wsd As Worksheet, rMonth As Long, _
                               L As Double, T As Double, w As Double, h As Double)
    Dim co As ChartObject
    Set co = EnsureChart(ws, key, L, T, w, h)
    With co.Chart
        .ChartType = xlLine
        ' Mois (A) + CO2 cumule (D) + Objectif cumule (E)
        Dim src As Range
        Set src = Union(wsd.Range("A1").Resize(rMonth, 1), wsd.Range("D1").Resize(rMonth, 2))
        .SetSourceData Source:=src, PlotBy:=xlColumns
        .HasTitle = True
        .ChartTitle.text = "CO2 evite - cumul mensuel vs objectif"
        .ChartTitle.Font.Size = 11: .ChartTitle.Font.bold = True
        On Error Resume Next
        .SeriesCollection(1).Format.Line.ForeColor.RGB = C_E85
        If .SeriesCollection.count >= 2 Then
            .SeriesCollection(2).Format.Line.ForeColor.RGB = C_OBJ
            .SeriesCollection(2).Format.Line.DashStyle = msoLineDash
        End If
        .HasLegend = True: .Legend.Position = xlLegendPositionBottom
        .ChartArea.Border.LineStyle = xlNone
        .Axes(xlCategory).TickLabels.NumberFormat = "mm/yyyy"
        .Axes(xlCategory).TickLabels.NumberFormatLinked = False
        On Error GoTo 0
    End With
End Sub

Public Sub AddCo2GaugeChart(ws As Worksheet, key As String, wsd As Worksheet, co2Obj As Double, _
                             L As Double, T As Double, w As Double, h As Double)
    ' Realise = dernier cumul (col D, derniere ligne mensuelle)
    Dim realise As Double: realise = 0
    Dim lr As Long: lr = wsd.Cells(wsd.rows.count, 4).End(xlUp).row
    If lr >= 2 Then If IsNumeric(wsd.Cells(lr, 4).value) Then realise = CDbl(wsd.Cells(lr, 4).value)

    ' Zone technique pour la jauge (col Z/AA)
    wsd.Range("Z1").value = "CO2 annuel": wsd.Range("AA1").value = "kg"
    wsd.Range("Z2").value = "Realise": wsd.Range("AA2").value = Round(realise, 0)
    wsd.Range("Z3").value = "Objectif": wsd.Range("AA3").value = Round(co2Obj, 0)

    Dim co As ChartObject
    Set co = EnsureChart(ws, key, L, T, w, h)
    With co.Chart
        .ChartType = xlBarClustered
        .SetSourceData Source:=wsd.Range("Z1:AA3"), PlotBy:=xlColumns
        .HasTitle = True
        .ChartTitle.text = "Objectif CO2 annuel (kg evites)"
        .ChartTitle.Font.Size = 11: .ChartTitle.Font.bold = True
        On Error Resume Next
        .SeriesCollection(1).Points(1).Format.fill.ForeColor.RGB = C_E85
        .SeriesCollection(1).Points(2).Format.fill.ForeColor.RGB = C_OBJ
        .SeriesCollection(1).HasDataLabels = True
        .HasLegend = False
        .ChartArea.Border.LineStyle = xlNone
        On Error GoTo 0
    End With
End Sub

Public Sub AddBudgetYearGauge(ws As Worksheet, key As String, wsd As Worksheet, _
                              L As Double, T As Double, w As Double, h As Double)
    Dim co As ChartObject
    Set co = EnsureChart(ws, key, L, T, w, h)
    With co.Chart
        .ChartType = xlBarClustered
        .SetSourceData Source:=wsd.Range("AC1:AD3"), PlotBy:=xlColumns
        .HasTitle = True
        .ChartTitle.text = "Budget annuel (" & ChrW(8364) & " depenses vs objectif)"
        .ChartTitle.Font.Size = 11: .ChartTitle.Font.bold = True
        On Error Resume Next
        Dim depense As Double, objectif As Double
        depense = NumOr0(wsd.Range("AD2").value)
        objectif = NumOr0(wsd.Range("AD3").value)
        ' Depense : rouge si depassement, vert sinon ; objectif en orange
        If objectif > 0 And depense > objectif Then
            .SeriesCollection(1).Points(1).Format.fill.ForeColor.RGB = RGB(200, 50, 50)
        Else
            .SeriesCollection(1).Points(1).Format.fill.ForeColor.RGB = C_E85
        End If
        .SeriesCollection(1).Points(2).Format.fill.ForeColor.RGB = C_OBJ
        .SeriesCollection(1).HasDataLabels = True
        .HasLegend = False
        .ChartArea.Border.LineStyle = xlNone
        On Error GoTo 0
    End With
End Sub

Public Sub AddKitCumulChart(ws As Worksheet, key As String, wsd As Worksheet, rKit As Long, _
                             L As Double, T As Double, w As Double, h As Double)
    Dim co As ChartObject
    Set co = EnsureChart(ws, key, L, T, w, h)
    With co.Chart
        .ChartType = xlLine
        ' AF (plein) + AG (eco cumulee) + AH (cout kit)
        .SetSourceData Source:=wsd.Range("AF1").Resize(rKit, 3), PlotBy:=xlColumns
        .HasTitle = True
        .ChartTitle.text = "Rentabilite du kit : economie cumulee vs cout"
        .ChartTitle.Font.Size = 11: .ChartTitle.Font.bold = True
        On Error Resume Next
        ' serie 1 = eco cumulee (vert), serie 2 = cout kit (seuil ambre pointille)
        .SeriesCollection(1).Format.Line.ForeColor.RGB = C_E85
        .SeriesCollection(1).Format.Line.Weight = 2.25
        If .SeriesCollection.count >= 2 Then
            .SeriesCollection(2).Format.Line.ForeColor.RGB = C_OBJ
            .SeriesCollection(2).Format.Line.DashStyle = msoLineDash
        End If
        .HasLegend = True: .Legend.Position = xlLegendPositionBottom
        .ChartArea.Border.LineStyle = xlNone
        On Error GoTo 0
    End With
End Sub

Public Sub AddCoutKmChart(ws As Worksheet, key As String, wsd As Worksheet, rCoutKm As Long, _
                           L As Double, T As Double, w As Double, h As Double)
    Dim co As ChartObject
    Set co = EnsureChart(ws, key, L, T, w, h)
    With co.Chart
        .ChartType = xlColumnClustered
        .SetSourceData Source:=wsd.Range("AJ1").Resize(rCoutKm, 2), PlotBy:=xlColumns
        .HasTitle = True
        .ChartTitle.text = "Cout au km (c" & ChrW(8364) & "/km) par plein"
        .ChartTitle.Font.Size = 11: .ChartTitle.Font.bold = True
        On Error Resume Next
        .SeriesCollection(1).Format.fill.ForeColor.RGB = C_SP98
        .HasLegend = False
        .ChartArea.Border.LineStyle = xlNone
        On Error GoTo 0
    End With
End Sub

Public Sub AddKitProjChart(ws As Worksheet, key As String, wsd As Worksheet, rKit As Long, _
                            L As Double, T As Double, w As Double, h As Double)
    Dim co As ChartObject
    Set co = EnsureChart(ws, key, L, T, w, h)
    With co.Chart
        .ChartType = xlXYScatter
        ' X = plein (AF), Y = eco cumulee (AG)
        .SetSourceData Source:=wsd.Range("AF1").Resize(rKit, 2), PlotBy:=xlColumns
        .HasTitle = True
        .ChartTitle.text = "Projection de rentabilite du kit (avec tendance)"
        .ChartTitle.Font.Size = 11: .ChartTitle.Font.bold = True
        On Error Resume Next
        ' garder seulement la serie eco cumulee (col AG) en points
        Do While .SeriesCollection.count > 1
            .SeriesCollection(2).Delete
        Loop
        With .SeriesCollection(1)
            .MarkerStyle = xlMarkerStyleCircle
            .MarkerSize = 5
            .Format.fill.ForeColor.RGB = C_E85
            .Format.Line.visible = msoFalse
            ' purge des tendances existantes (le graphique est reutilise, pas
            ' recree -> sinon accumulation d'une tendance par reconstruction)
            Do While .Trendlines.count > 0
                .Trendlines(1).Delete
            Loop
            ' tendance lineaire projetee de 5 pleins -> seuil de rentabilite
            Dim tl As Trendline
            Set tl = .Trendlines.Add(Type:=xlLinear, Forward:=5, DisplayEquation:=False, DisplayRSquared:=False)
            tl.Format.Line.ForeColor.RGB = C_OBJ
            tl.Format.Line.DashStyle = msoLineDash
        End With
        .HasLegend = False
        .ChartArea.Border.LineStyle = xlNone
        On Error GoTo 0
    End With
End Sub

Public Sub AddEcoCumDateChart(ws As Worksheet, key As String, wsd As Worksheet, rEco As Long, _
                               L As Double, T As Double, w As Double, h As Double)
    Dim co As ChartObject
    Set co = EnsureChart(ws, key, L, T, w, h)
    With co.Chart
        .ChartType = xlLine
        .SetSourceData Source:=wsd.Range("AM1").Resize(rEco, 2), PlotBy:=xlColumns
        .HasTitle = True
        .ChartTitle.text = "Economies cumulees E85 vs SP98 (" & ChrW(8364) & ")"
        .ChartTitle.Font.Size = 11: .ChartTitle.Font.bold = True
        .HasLegend = False
        On Error Resume Next
        With .SeriesCollection(1)
            .Format.Line.ForeColor.RGB = C_E85
            .Format.Line.Weight = 2
            .smooth = True
        End With
        .Axes(xlCategory).TickLabels.NumberFormat = "mm/yyyy"
        .ChartArea.Border.LineStyle = xlNone
        On Error GoTo 0
    End With
End Sub

Public Sub AddScatterE85Chart(ws As Worksheet, key As String, wsd As Worksheet, rSc As Long, _
                               L As Double, T As Double, w As Double, h As Double)
    If rSc < 2 Then Exit Sub   ' pas assez de donnees
    Dim nPts As Long: nPts = rSc - 1  ' lignes de donnees (hors en-tete ligne 1)
    Dim co As ChartObject
    Set co = EnsureChart(ws, key, L, T, w, h)
    With co.Chart
        .ChartType = xlColumnClustered
        ' Vider les series existantes
        Do While .SeriesCollection.count > 0
            .SeriesCollection(1).Delete
        Loop

        ' Serie 1 : conso L/100 km (barres vertes, axe principal)
        Dim sConso As Series
        Set sConso = .SeriesCollection.NewSeries
        sConso.Name = "Conso L/100 km"
        sConso.Values = wsd.Range("AQ2").Resize(nPts, 1)
        sConso.XValues = wsd.Range("AP2").Resize(nPts, 1)
        sConso.ChartType = xlColumnClustered
        sConso.Format.fill.ForeColor.RGB = C_E85

        ' Barres : coins arrondis (Excel 365+), gap reduit
        On Error Resume Next
        Dim cg As ChartGroup: Set cg = .ChartGroups(1)
        cg.GapWidth = 60
        Dim dp As Long
        For dp = 1 To sConso.Points.count
            sConso.Points(dp).Format.fill.ForeColor.RGB = C_E85
            sConso.Points(dp).Format.ThreeD.BevelTopType = 1
            sConso.Points(dp).Format.ThreeD.BevelTopDepth = 2
            sConso.Points(dp).Format.ThreeD.BevelTopInset = 2
        Next dp
        On Error GoTo 0

        ' Serie 2 : prix E85 (courbe bleu mid, axe secondaire)
        Dim sPrix As Series
        Set sPrix = .SeriesCollection.NewSeries
        sPrix.Name = "Prix E85 " & ChrW(8364) & "/L"
        sPrix.Values = wsd.Range("AR2").Resize(nPts, 1)
        sPrix.XValues = wsd.Range("AP2").Resize(nPts, 1)
        sPrix.ChartType = xlLine
        sPrix.AxisGroup = xlSecondary
        sPrix.Format.Line.ForeColor.RGB = C_SP98
        sPrix.Format.Line.Weight = 1.5
        sPrix.MarkerStyle = xlMarkerStyleCircle
        sPrix.MarkerSize = 3
        sPrix.MarkerForegroundColor = C_SP98
        sPrix.MarkerBackgroundColor = C_SP98

        .HasTitle = True
        .ChartTitle.text = "Conso & prix E85 par plein"
        .ChartTitle.Font.Size = 11: .ChartTitle.Font.bold = True
        .HasLegend = True
        .Legend.Position = xlLegendPositionBottom

        On Error Resume Next
        ' Axe X : dates
        With .Axes(xlCategory)
            .TickLabels.NumberFormat = "dd/mm/yyyy"
            .TickLabels.Font.Size = 8
        End With
        ' Axe principal (conso L/100 km)
        With .Axes(xlValue, xlPrimary)
            .HasTitle = True
            .AxisTitle.text = "L/100 km"
            .AxisTitle.Font.Size = 9
            .MinimumScaleIsAuto = True
        End With
        ' Axe secondaire (prix)
        With .Axes(xlValue, xlSecondary)
            .HasTitle = True
            .AxisTitle.text = ChrW(8364) & "/L"
            .AxisTitle.Font.Size = 9
            .MinimumScaleIsAuto = True
        End With
        .ChartArea.Border.LineStyle = xlNone
        On Error GoTo 0
    End With
End Sub

Private Sub BuildKPICards(ws As Worksheet, wsd As Worksheet, L As Double, T As Double)
    ' Lit les KPIs ecrits en W2:X7
    Dim labels(1 To 6) As String, vals(1 To 6) As String, i As Long
    For i = 1 To 6
        labels(i) = CStr(wsd.Cells(i + 1, 23).value)   ' W
        vals(i) = CStr(wsd.Cells(i + 1, 24).value)      ' X
    Next i

    Dim titre As Shape
    Set titre = EnsureShape(ws, "kpiTitle", msoShapeRectangle, L, T, 460, 26)
    StyleShape titre, "Bilan annuel " & vals(1), C_KPI, RGB(255, 255, 255), 11, True

    Dim cardW As Double, cardH As Double, gap As Double
    cardW = 145: cardH = 60: gap = 12
    Dim col As Long, row As Long
    For i = 2 To 6
        col = (i - 2) Mod 3
        row = (i - 2) \ 3
        Dim cx As Double, cy As Double
        cx = L + col * (cardW + gap)
        cy = T + 34 + row * (cardH + gap)
        Dim sh As Shape
        Set sh = EnsureShape(ws, "kpiCard" & (i - 1), msoShapeRoundedRectangle, cx, cy, cardW, cardH)
        StyleShape sh, vals(i) & vbLf & labels(i), RGB(238, 242, 247), RGB(27, 58, 92), 10, False
    Next i
End Sub

Public Sub StyleShape(sh As Shape, txt As String, fillC As Long, fontC As Long, _
                       sz As Single, bold As Boolean)
    sh.fill.ForeColor.RGB = fillC
    sh.Line.visible = msoFalse
    With sh.TextFrame2.TextRange
        .text = txt
        .Font.Size = sz
        .Font.bold = IIf(bold, msoTrue, msoFalse)
        .Font.fill.ForeColor.RGB = fontC
    End With
    sh.TextFrame2.HorizontalAnchor = msoAnchorCenter
    sh.TextFrame2.VerticalAnchor = msoAnchorMiddle
End Sub

' ============================================================
'  Styles des graphiques du Tableau de bord (galerie ChartStyle)
'  Applique apres la creation de TOUS les graphiques (survit aux
'  reconstructions de CreerGraphiquesWeb). Cas particuliers :
'   - gVeh   : titre sur 2 lignes (retour apres "Comparaison vehicules ")
'   - gKitProj : la courbe de tendance reste en orange (C_OBJ) malgre le style
' ============================================================
Public Sub ApplyChartStyles(ws As Worksheet)
    On Error Resume Next
    SetChartStyleByName ws, "gCost", 13
    SetChartStyleByName ws, "gPrice", 9
    SetChartStyleByName ws, "gVeh", 11
    SetChartStyleByName ws, "gBudget", 6
    SetChartStyleByName ws, "gCo2", 9
    SetChartStyleByName ws, "gKitCumul", 9
    SetChartStyleByName ws, "gCoutKm", 12
    SetChartStyleByName ws, "gKitProj", 6
    SetChartStyleByName ws, "gEcoDate", 10
    SetChartStyleByName ws, "gScatterE85", 6
    SetChartStyleByName ws, "gConso", 10

    ' gVeh : titre sur 2 lignes (idempotent : n'ajoute pas 2 fois le saut de ligne)
    Dim coVeh As ChartObject: Set coVeh = FindChartByName(ws, "gVeh")
    If Not coVeh Is Nothing Then
        If coVeh.Chart.HasTitle Then
            Dim ttl As String: ttl = coVeh.Chart.ChartTitle.text
            If InStr(ttl, vbLf) = 0 Then
                ttl = Replace(ttl, "Comparaison vehicules ", "Comparaison vehicules " & vbLf)
                coVeh.Chart.ChartTitle.text = ttl
            End If
        End If
    End If

    ' gKitProj : conserver la tendance en orange pointille malgre le style applique
    Dim coKit As ChartObject: Set coKit = FindChartByName(ws, "gKitProj")
    If Not coKit Is Nothing Then
        If coKit.Chart.SeriesCollection.count >= 1 Then
            If coKit.Chart.SeriesCollection(1).Trendlines.count >= 1 Then
                With coKit.Chart.SeriesCollection(1).Trendlines(1).Format.Line
                    .ForeColor.RGB = C_OBJ
                    .DashStyle = msoLineDash
                End With
            End If
        End If
    End If
    On Error GoTo 0
End Sub

Private Sub SetChartStyleByName(ws As Worksheet, key As String, n As Long)
    Dim co As ChartObject: Set co = FindChartByName(ws, key)
    If co Is Nothing Then Exit Sub
    On Error Resume Next
    co.Chart.ChartStyle = n
    On Error GoTo 0
End Sub

Private Function FindChartByName(ws As Worksheet, key As String) As ChartObject
    Dim co As ChartObject
    For Each co In ws.ChartObjects
        If co.name = key Then Set FindChartByName = co: Exit Function
    Next co
End Function

Private Function EnsureChart(ws As Worksheet, key As String, _
                             L As Double, T As Double, w As Double, h As Double) As ChartObject
    Dim co As ChartObject
    For Each co In ws.ChartObjects
        If co.name = key Then
            co.Left = L: co.top = T: co.Width = w: co.Height = h
            Set EnsureChart = co
            Exit Function
        End If
    Next co
    Set co = ws.ChartObjects.Add(L, T, w, h)
    co.name = key
    Set EnsureChart = co
End Function

Private Function EnsureShape(ws As Worksheet, nm As String, shp As MsoAutoShapeType, _
                             L As Double, T As Double, w As Double, h As Double) As Shape
    Dim s As Shape
    For Each s In ws.Shapes
        If s.name = nm Then
            s.Left = L: s.top = T: s.Width = w: s.Height = h
            Set EnsureShape = s
            Exit Function
        End If
    Next s
    Set s = ws.Shapes.AddShape(shp, L, T, w, h)
    s.name = nm
    Set EnsureShape = s
End Function

Public Sub DeleteChartByName(ws As Worksheet, key As String)
    Dim co As ChartObject
    For Each co In ws.ChartObjects
        If co.name = key Then co.Delete: Exit Sub
    Next co
End Sub

Public Sub PurgeUnknown(ws As Worksheet)
    Const OK_CHARTS As String = "|gPrice|gCost|gConso|gVeh|gBudget|gCo2|gGauge|gBudgetYear|" & _
        "gKitCumul|gCoutKm|gKitProj|gEcoDate|gScatterE85|"
    Const OK_SHAPES As String = "|hdrBand|btnRecreerGraph|btnExportGraph|kpiTitle|" & _
        "kpiCard1|kpiCard2|kpiCard3|kpiCard4|kpiCard5|"
    Dim i As Long
    For i = ws.ChartObjects.count To 1 Step -1
        If InStr(OK_CHARTS, "|" & ws.ChartObjects(i).name & "|") = 0 Then ws.ChartObjects(i).Delete
    Next i
    Dim sh As Shape
    For i = ws.Shapes.count To 1 Step -1
        Set sh = ws.Shapes(i)
        ' AutoShapes (bandeau, cartes, boutons de repli) ET images (boutons PNG)
        ' X39 : ne JAMAIS toucher la sidebar (sb_*) ni le panneau carburant (fup_*) ?
        '       cycle de vie propre (modSidebar / modFuelPanel), sinon nav cassee au rebuild.
        If Left$(sh.name, 3) <> "sb_" And Left$(sh.name, 4) <> "fup_" Then
            If sh.Type = msoAutoShape Or sh.Type = msoPicture Then
                If InStr(OK_SHAPES, "|" & sh.name & "|") = 0 Then sh.Delete
            End If
        End If
    Next i
End Sub
