Attribute VB_Name = "modGraphRender"
' ============================================================
'  modGraphRender - Rendu graphiques/formes (X44 P3)
' ============================================================
'  Add*Chart + BuildKPICards + Ensure*/Style/Purge, extraits de
'  modGraphiques. Config via modGraphCfg ; NumOr0 via modGraphData.
'  Public : les Add*Chart + Ensure(Buttons/HeaderBand/ParamBlock) + Delete/Purge appeles par l'orchestrateur.
Option Explicit

Public Sub AddChartXY(ws As Worksheet, key As String, src As Range, typ As Long, titre As String, _
                       L As Double, T As Double, w As Double, h As Double, _
                       smooth As Boolean)
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
        .Axes(xlCategory).NumberFormat = "dd/mm"
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
        .Axes(xlCategory).TickLabels.NumberFormat = "mm/yy"
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
            .TickLabels.NumberFormat = "mmm aa"
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

Private Sub StyleShape(sh As Shape, txt As String, fillC As Long, fontC As Long, _
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

Public Sub EnsureParamBlock(ws As Worksheet)
    On Error Resume Next
    ' Largeurs pour que le bloc parametres tienne a gauche du bandeau
    ws.Columns("A").ColumnWidth = 24
    ws.Columns("B").ColumnWidth = 12

    ws.Range("A1").value = "PARAMETRES"
    ws.Range("A1").Font.bold = True
    ws.Range("A1").Font.color = C_HEADER
    ws.Range("A2").value = "Budget mensuel (" & ChrW(8364) & ")"
    ws.Range("A3").value = "Objectif CO2 annuel (kg)"
    ws.Range("A4").value = "Annee bilan (vide = recente)"   ' X24
    ws.Range("A7").value = "Graphiques auto (Oui/Non)"      ' X20
    ws.Range("A8").value = "Derniere generation"             ' X21
    If CStr(ws.Range(CELL_CO2OBJ).value) = "" Then ws.Range(CELL_CO2OBJ).value = DEFAULT_CO2_OBJ
    Dim gaCur As String: gaCur = UCase$(Trim$(CStr(ws.Range(CELL_GRAPH_AUTO).value))): If gaCur <> "OUI" And gaCur <> "NON" Then ws.Range(CELL_GRAPH_AUTO).value = "Oui"
    ws.Range("A2:A4").Font.Italic = True
    ws.Range("A2:A4").Font.color = RGB(107, 114, 128)         ' --text-muted
    ws.Range("A7:A8").Font.Italic = True
    ws.Range("A7:A8").Font.color = RGB(107, 114, 128)
    ' Cellules de saisie : fond clair + cadre discret (carte)
    With ws.Range(CELL_BUDGET & ":" & CELL_ANNEE)
        .Interior.color = RGB(255, 252, 230)
        .Borders.color = RGB(226, 232, 240)                   ' --border
        .Borders.Weight = xlThin
    End With
    ' B7 : saisie (Oui/Non) ; B8 : horodatage, lecture seule, grise
    With ws.Range(CELL_GRAPH_AUTO)
        .Interior.color = RGB(255, 252, 230)
        .Borders.color = RGB(226, 232, 240)
        .Borders.Weight = xlThin
    End With
    With ws.Range(CELL_HORODATAGE)
        .NumberFormat = "dd/mm/yyyy hh:mm"
        .Interior.color = RGB(240, 240, 240)
        .Font.color = RGB(107, 114, 128)
        .Locked = True
    End With
    ' B7 : liste deroulante Oui / Non (au lieu de texte libre)
    ws.Cells(1, 54).value = "Oui"   ' BB1
    ws.Cells(2, 54).value = "Non"   ' BB2
    ws.Columns(54).Hidden = True
    With ws.Range(CELL_GRAPH_AUTO).Validation
        .Delete
        .Add Type:=xlValidateList, AlertStyle:=xlValidAlertStop, _
             Formula1:="='" & ws.name & "'!$BB$1:$BB$2"
        .IgnoreBlank = True
        .InCellDropdown = True
    End With
    On Error GoTo 0
End Sub

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

Public Sub EnsureHeaderBand(ws As Worksheet)
    ' hdrBand supprime (doublon visuel avec dash_banner)
    On Error Resume Next
    ws.Shapes("hdrBand").Delete
    On Error GoTo 0
End Sub

Public Sub EnsureButtons(ws As Worksheet)
    ' Positions dans la zone du bandeau, sous le titre/sous-titre (Top ~88)
    ' BringToFront appele par MAJ_Dashboard_Graphiques apres creation du bandeau
    ' Boutons-icone carres (28x28) alignes dans le bas du bandeau bleu.
    ' Actualiser (dash_btn) est pose a gauche par modDashboardGraphiques (Left 338).
    Dim btnTop As Double: btnTop = ws.Range("A7").top - 42
    EnsurePictureButton ws, "btnRecreerGraph", "btn_recreer.png", _
        "Recreer les graphiques", C_E85, 66, btnTop, 26, 26, "RecreerDashboardComplet"
    EnsurePictureButton ws, "btnExportGraph", "btn_export_pdf.png", _
        "Exporter en PDF", C_E85, 116, btnTop, 26, 26, "ExporterGraphiquesPDF"
    ' S'assurer qu'ils sont au premier plan
    Dim s As Shape
    For Each s In ws.Shapes
        If s.name = "btnRecreerGraph" Or s.name = "btnExportGraph" Then
            s.ZOrder msoBringToFront
        End If
    Next s
End Sub

Private Sub EnsurePictureButton(ws As Worksheet, nm As String, fileName As String, _
                                fallbackTxt As String, fallbackFill As Long, _
                                L As Double, T As Double, w As Double, h As Double, _
                                action As String)
    ' supprime l'objet existant (image ou repli) pour repartir propre
    Dim s As Shape
    For Each s In ws.Shapes
        If s.name = nm Then s.Delete: Exit For
    Next s

    Dim p As String
    p = ThisWorkbook.path & Application.PathSeparator & "assets" & _
        Application.PathSeparator & fileName

    Dim ok As Boolean: ok = False
    On Error Resume Next
    If Dir(p) <> "" Then
        Dim pic As Shape
        Set pic = ws.Shapes.AddPicture(p, msoFalse, msoTrue, L, T, w, h)
        If Not pic Is Nothing Then
            pic.name = nm
            pic.OnAction = action
            pic.AlternativeText = fallbackTxt
            pic.Placement = xlFreeFloating      ' ne pas deriver au redim. des colonnes A:B
            ok = True
        End If
    End If
    On Error GoTo 0

    If Not ok Then
        ' repli : bouton Shape stylee (charte)
        Dim b As Shape
        Set b = ws.Shapes.AddShape(msoShapeRoundedRectangle, L, T, w, h)
        b.name = nm
        StyleShape b, fallbackTxt, fallbackFill, RGB(255, 255, 255), 10, True
        b.OnAction = action
        b.Placement = xlFreeFloating
    End If
End Sub
