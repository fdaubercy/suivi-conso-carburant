Attribute VB_Name = "modGraphiques"
' ============================================================
'  SUIVI CONSO CARBURANTS — Graphiques du tableau de bord     v4.4.0.0
'
'  Recree sur l'onglet "Graphiques" (remis a zero) les memes
'  visualisations que l'app web, en graphiques NATIFS Excel :
'    1. Evolution du prix (multi-carburant E85 / Gazole / SP98)
'    2. Cout mensuel du carburant
'    3. Tendance des depenses 6 mois + ligne objectif budget
'    4. Comparaison entre vehicules (conso & cout / 100 km)
'    5. CO2 evite — cumul mensuel vs trajectoire d'objectif
'    6. Jauge objectif CO2 annuel (realise vs objectif)
'    7. Consommation L/100 km (refonte)
'    8. Bilan annuel — KPIs (litres, EUR, km, station preferee)
'
'  Donnees :
'    • "Suivi Carburant" / Tableau2 (vue chronologique, calculs) :
'      prix, cout, conso, CO2, mensuel, KPIs.
'    • "GS_Pleins" (colonne Vehicule) : comparaison vehicules.
'  Agregats calcules en VBA -> feuille technique masquee _GraphData.
'
'  Parametres pilotables (onglet Graphiques, en haut a gauche) :
'    • B2 = Budget mensuel (EUR)  — vide = pas de ligne objectif
'    • B3 = Objectif CO2 annuel (kg) — defaut 200
'    • Surconso E85 : cellule J7 de "Suivi Carburant" (1+J7), defaut 0.20
'
'  Point d'entree : CreerGraphiquesWeb (rejouable + bouton "Recreer").
' ============================================================
Option Explicit

' ── Feuilles / tables ──
Private Const WS_GRAPH As String = "Graphiques"
Private Const WS_CARB  As String = "Suivi Carburant"
Private Const WS_DATA  As String = "_GraphData"
Private Const T2_NAME  As String = "Tableau2"
Private Const GS_SHEET As String = "GS_Pleins"

' ── Constantes CO2 (alignees sur js/config.js) ──
Private Const CO2_ESSENCE_PER_L As Double = 2.21    ' kg CO2/L SP95-E10
Private Const CO2_E85_PER_L     As Double = 1.105   ' E85 ≈ -50 %
Private Const DEFAULT_CO2_OBJ   As Double = 200     ' kg CO2/an
Private Const DEFAULT_SURCONSO  As Double = 0.2     ' +20 %

' ── Cellules de parametres sur l'onglet Graphiques ──
Private Const CELL_BUDGET As String = "B2"
Private Const CELL_CO2OBJ As String = "B3"

' ── Couleurs ──
Private Const C_E85    As Long = 3978097   ' vert  #71B53C (approx)
Private Const C_GAZOLE As Long = 3289800   ' gris-bleu
Private Const C_SP98   As Long = 13408512  ' bleu  #0080CC
Private Const C_COUT   As Long = 2240204   ' bleu fonce #1B3A5C
Private Const C_OBJ    As Long = 1085491   ' orange #F3A013 (BGR)
Private Const C_CONSO  As Long = 12092939
Private Const C_HEADER As Long = 6047027   ' #1B3A5C bleu fonce
Private Const C_KPI    As Long = 6047027

' ============================================================
'  POINT D'ENTREE
' ============================================================
Public Sub CreerGraphiquesWeb()
    Dim wsG As Worksheet, wsC As Worksheet, wsD As Worksheet
    Dim t2 As ListObject, gsT As ListObject

    On Error GoTo EH
    Application.ScreenUpdating = False
    Application.Calculation = xlCalculationManual
    SetStatusG "Graphiques : preparation..."

    ' -- Feuilles requises --
    Set wsC = SheetByName(WS_CARB)
    If wsC Is Nothing Then Err.Raise vbObjectError + 1, , "Feuille '" & WS_CARB & "' introuvable."
    On Error Resume Next
    Set t2 = wsC.ListObjects(T2_NAME)
    On Error GoTo EH
    If t2 Is Nothing Then Err.Raise vbObjectError + 2, , "Tableau '" & T2_NAME & "' introuvable."

    Set wsG = SheetByName(WS_GRAPH)
    If wsG Is Nothing Then
        Set wsG = ThisWorkbook.Worksheets.Add(After:=ThisWorkbook.Sheets(ThisWorkbook.Sheets.Count))
        wsG.Name = WS_GRAPH
    End If

    Set gsT = Nothing
    On Error Resume Next
    Set gsT = SheetByName(GS_SHEET).ListObjects(1)
    On Error GoTo EH

    ' -- Surconso (Suivi Carburant!J7) --
    Dim surconso As Double
    surconso = DEFAULT_SURCONSO
    If IsNumeric(wsC.Range("J7").Value) Then
        If wsC.Range("J7").Value > 0 Then surconso = CDbl(wsC.Range("J7").Value)
    End If

    ' -- Bloc parametres + lecture budget / objectif CO2 --
    EnsureParamBlock wsG
    Dim budget As Double, co2Obj As Double
    budget = 0
    If IsNumeric(wsG.Range(CELL_BUDGET).Value) Then budget = CDbl(wsG.Range(CELL_BUDGET).Value)
    co2Obj = DEFAULT_CO2_OBJ
    If IsNumeric(wsG.Range(CELL_CO2OBJ).Value) Then
        If wsG.Range(CELL_CO2OBJ).Value > 0 Then co2Obj = CDbl(wsG.Range(CELL_CO2OBJ).Value)
    End If

    ' -- Feuille de donnees technique --
    Set wsD = EnsureDataSheet()

    ' -- Calcul des agregats -> _GraphData --
    SetStatusG "Graphiques : calcul des agregats..."
    Dim rMonth As Long, rPrice As Long, rConso As Long, rVeh As Long, rBudg As Long
    BuildAggregates t2, gsT, wsD, surconso, co2Obj, budget, _
                    rMonth, rPrice, rConso, rVeh, rBudg

    ' -- Remise a zero des graphiques existants --
    SetStatusG "Graphiques : nettoyage..."
    ClearAllCharts wsG

    ' -- Creation des graphiques --
    SetStatusG "Graphiques : creation..."
    Dim L1 As Double, L2 As Double, w As Double, h As Double, topBase As Double
    w = 460: h = 250: topBase = 90
    L1 = 10: L2 = L1 + w + 20

    ' Col gauche
    If rPrice > 1 Then AddChartXY wsG, wsD.Range("G1").Resize(rPrice, 4), xlLine, _
        "Evolution du prix par carburant (" & ChrW(8364) & "/L)", L1, topBase, w, h, True
    If rMonth > 1 Then AddChartXY wsG, wsD.Range("A1").Resize(rMonth, 2), xlColumnClustered, _
        "Cout mensuel du carburant (" & ChrW(8364) & ")", L1, topBase + (h + 20), w, h, False
    If rConso > 1 Then AddChartXY wsG, wsD.Range("L1").Resize(rConso, 2), xlLine, _
        "Consommation (L/100 km)", L1, topBase + 2 * (h + 20), w, h, True
    If rVeh > 1 Then AddChartXY wsG, wsD.Range("O1").Resize(rVeh, 3), xlBarClustered, _
        "Comparaison vehicules (conso & cout /100 km)", L1, topBase + 3 * (h + 20), w, h, False

    ' Col droite
    If rBudg > 1 Then AddBudgetTrendChart wsG, wsD, rBudg, L2, topBase, w, h
    If rMonth > 1 Then AddCo2MonthlyChart wsG, wsD, rMonth, L2, topBase + (h + 20), w, h
    AddCo2GaugeChart wsG, wsD, co2Obj, L2, topBase + 2 * (h + 20), w, h
    BuildKPICards wsG, wsD, L2, topBase + 3 * (h + 20)

    EnsureButton wsG

    Application.Calculation = xlCalculationAutomatic
    Application.ScreenUpdating = True
    SetStatusG "Graphiques : " & ChrW(10003) & " recrees (" & Format(Now, "hh:mm:ss") & ")."
    Exit Sub
EH:
    Application.Calculation = xlCalculationAutomatic
    Application.ScreenUpdating = True
    MsgBox "Erreur " & Err.Number & " : " & Err.Description, vbCritical, "modGraphiques"
    SetStatusG "Graphiques : ERREUR " & Err.Number & " - " & Err.Description
End Sub

' ============================================================
'  AGREGATS  -> _GraphData
' ============================================================
Private Sub BuildAggregates(t2 As ListObject, gsT As ListObject, wsD As Worksheet, _
                            surconso As Double, co2Obj As Double, budget As Double, _
                            ByRef rMonth As Long, ByRef rPrice As Long, _
                            ByRef rConso As Long, ByRef rVeh As Long, ByRef rBudg As Long)

    wsD.Cells.Clear

    ' En-tetes des blocs
    Dim eu As String: eu = ChrW(8364)
    wsD.Range("A1:E1").Value = Array("Mois", "Cout (" & eu & ")", "CO2 evite (kg)", "CO2 cumule (kg)", "Objectif cumule (kg)")
    wsD.Range("G1:J1").Value = Array("Date", "E85", "Gazole", "SP98")
    wsD.Range("L1:M1").Value = Array("Date", "L/100 km")
    wsD.Range("O1:Q1").Value = Array("Vehicule", "Conso L/100km", "Cout " & eu & "/100km")
    wsD.Range("S1:U1").Value = Array("Mois", "Depense (" & eu & ")", "Objectif (" & eu & ")")
    wsD.Range("W1:X1").Value = Array("Indicateur", "Valeur")

    rMonth = 1: rPrice = 1: rConso = 1: rVeh = 1: rBudg = 1

    ' ---- Lecture Tableau2 ----
    If t2.DataBodyRange Is Nothing Then Exit Sub
    Dim a As Variant: a = t2.DataBodyRange.Value
    Dim ciDate As Long, ciType As Long, ciKm As Long, ciNbKm As Long
    Dim ciLitres As Long, ciPrix As Long, ciCout As Long, ciConso As Long, ciStation As Long
    ciDate = LCIdx(t2, "Date")
    ciType = LCIdx(t2, "Type")
    ciKm = LCIdx(t2, "Km compteur")
    ciNbKm = LCIdx(t2, "Nb. km")
    ciLitres = LCIdx(t2, "Nb. Litres")
    ciPrix = LCIdx(t2, "Prix " & ChrW(8364) & "/L")
    ciCout = LCIdx(t2, "Co" & ChrW(251) & "t Plein (" & ChrW(8364) & ")")  ' "Coût Plein (€)"
    ciConso = LCIdx(t2, "Conso. (L/100km)")
    ciStation = LCIdx(t2, "Station essence")

    Dim moisCost As Object, moisCO2 As Object, stationCnt As Object
    Set moisCost = CreateObject("Scripting.Dictionary")
    Set moisCO2 = CreateObject("Scripting.Dictionary")
    Set stationCnt = CreateObject("Scripting.Dictionary")
    Dim moisOrder As Object: Set moisOrder = CreateObject("Scripting.Dictionary")

    Dim totLitres As Double, totCout As Double, totKm As Double, nbP As Long
    Dim anneeMax As Long: anneeMax = 0
    Dim litresAnnee As Double, coutAnnee As Double, kmAnnee As Double, nbAnnee As Long

    Dim i As Long, n As Long
    n = UBound(a, 1)
    Dim rP As Long: rP = 1   ' lignes ecrites bloc prix
    Dim rCo As Long: rCo = 1 ' lignes ecrites bloc conso

    ' 1er passage : determiner l'annee la plus recente
    For i = 1 To n
        If IsDate(a(i, ciDate)) Then
            If Year(a(i, ciDate)) > anneeMax Then anneeMax = Year(a(i, ciDate))
        End If
    Next i

    For i = 1 To n
        If Not IsDate(a(i, ciDate)) Then GoTo NextRow
        Dim d As Date: d = CDate(a(i, ciDate))
        Dim fk As String: fk = FuelKey(CStr(a(i, ciType)))
        Dim litres As Double: litres = NumOr0(a(i, ciLitres))
        Dim prix As Double: prix = NumOr0(a(i, ciPrix))
        Dim cout As Double: cout = NumOr0(a(i, ciCout))
        Dim conso As Double: conso = NumOr0(a(i, ciConso))
        Dim mKey As String: mKey = Format(d, "yyyy-mm")

        ' -- mensuel cout + CO2 --
        moisCost(mKey) = NumDict(moisCost, mKey) + cout
        If fk = "E85" And litres > 0 Then
            Dim essEq As Double: essEq = litres / (1 + surconso)
            Dim co2 As Double: co2 = essEq * CO2_ESSENCE_PER_L - litres * CO2_E85_PER_L
            moisCO2(mKey) = NumDict(moisCO2, mKey) + co2
        End If
        If Not moisOrder.Exists(mKey) Then moisOrder(mKey) = 1

        ' -- prix par carburant (X = Date) --
        rP = rP + 1
        wsD.Cells(rP, 7).Value = d
        If fk = "E85" Then wsD.Cells(rP, 8).Value = prix
        If fk = "GAZOLE" Then wsD.Cells(rP, 9).Value = prix
        If fk = "SP98" Then wsD.Cells(rP, 10).Value = prix

        ' -- conso (X = Date) --
        If conso > 0 Then
            rCo = rCo + 1
            wsD.Cells(rCo, 12).Value = d
            wsD.Cells(rCo, 13).Value = conso
        End If

        ' -- station preferee (annee max) --
        If Year(d) = anneeMax Then
            Dim st As String: st = Trim(CStr(a(i, ciStation)))
            If st <> "" Then stationCnt(st) = NumDict(stationCnt, st) + 1
            litresAnnee = litresAnnee + litres
            coutAnnee = coutAnnee + cout
            kmAnnee = kmAnnee + NumOr0(a(i, ciNbKm))
            nbAnnee = nbAnnee + 1
        End If

        totLitres = totLitres + litres
        totCout = totCout + cout
        totKm = totKm + NumOr0(a(i, ciNbKm))
        nbP = nbP + 1
NextRow:
    Next i
    rPrice = rP
    rConso = rCo

    ' -- bloc mensuel (trie) + CO2 cumule + objectif cumule --
    Dim keys() As String, k As Long
    Dim rw As Long: rw = 1
    Dim rb As Long: rb = 1
    If moisOrder.Count > 0 Then
        ReDim keys(0 To moisOrder.Count - 1)
        Dim kk As Variant: k = 0
        For Each kk In moisOrder.Keys: keys(k) = CStr(kk): k = k + 1: Next kk
        TriStr keys
        Dim cumCO2 As Double: cumCO2 = 0
        Dim cibleMois As Double: cibleMois = co2Obj / 12
        For k = 0 To UBound(keys)
            rw = rw + 1
            wsD.Cells(rw, 1).Value = keys(k)
            wsD.Cells(rw, 2).Value = Round(NumDict(moisCost, keys(k)), 2)
            Dim cm As Double: cm = NumDict(moisCO2, keys(k))
            wsD.Cells(rw, 3).Value = Round(cm, 1)
            cumCO2 = cumCO2 + cm
            wsD.Cells(rw, 4).Value = Round(cumCO2, 1)
            wsD.Cells(rw, 5).Value = Round(cibleMois * (k + 1), 1)
        Next k

        ' -- bloc budget 6 derniers mois --
        Dim startK As Long: startK = UBound(keys) - 5
        If startK < 0 Then startK = 0
        For k = startK To UBound(keys)
            rb = rb + 1
            wsD.Cells(rb, 19).Value = keys(k)                              ' S
            wsD.Cells(rb, 20).Value = Round(NumDict(moisCost, keys(k)), 2) ' T
            If budget > 0 Then wsD.Cells(rb, 21).Value = budget            ' U
        Next k
    End If
    rMonth = rw
    rBudg = rb

    ' ---- Comparaison vehicules (GS_Pleins) ----
    rVeh = BuildVehiculesBlock(gsT, wsD)

    ' ---- KPIs (annee max) ----
    Dim topSt As String: topSt = TopKey(stationCnt)
    wsD.Range("W2").Value = "Annee": wsD.Range("X2").Value = anneeMax
    wsD.Range("W3").Value = "Pleins": wsD.Range("X3").Value = nbAnnee
    wsD.Range("W4").Value = "Litres": wsD.Range("X4").Value = Round(litresAnnee, 1)
    wsD.Range("W5").Value = ChrW(8364) & " depenses": wsD.Range("X5").Value = Round(coutAnnee, 0)
    wsD.Range("W6").Value = "Km parcourus": wsD.Range("X6").Value = Round(kmAnnee, 0)
    wsD.Range("W7").Value = "Station preferee": wsD.Range("X7").Value = topSt

    ' Format colonnes Date
    wsD.Columns(7).NumberFormat = "dd/mm/yyyy"
    wsD.Columns(12).NumberFormat = "dd/mm/yyyy"
End Sub

' Comparaison par vehicule depuis GS_Pleins (km = max-min compteur)
Private Function BuildVehiculesBlock(gsT As ListObject, wsD As Worksheet) As Long
    BuildVehiculesBlock = 1
    If gsT Is Nothing Then Exit Function
    If gsT.DataBodyRange Is Nothing Then Exit Function

    Dim ciDate As Long, ciKm As Long, ciLit As Long, ciPrix As Long, ciVeh As Long
    ciKm = LCIdx(gsT, "Km")
    ciLit = LCIdx(gsT, "Litres")
    ciPrix = LCIdx(gsT, "PrixL")
    ciVeh = LCIdx(gsT, "Vehicule")
    If ciVeh = 0 Or ciKm = 0 Then Exit Function

    Dim g As Variant: g = gsT.DataBodyRange.Value
    Dim litres As Object, cout As Object, kmMin As Object, kmMax As Object
    Set litres = CreateObject("Scripting.Dictionary")
    Set cout = CreateObject("Scripting.Dictionary")
    Set kmMin = CreateObject("Scripting.Dictionary")
    Set kmMax = CreateObject("Scripting.Dictionary")

    Dim i As Long
    For i = 1 To UBound(g, 1)
        Dim v As String: v = Trim(CStr(g(i, ciVeh)))
        If v = "" Then GoTo NX
        Dim km As Double: km = NumOr0(g(i, ciKm))
        Dim li As Double: li = NumOr0(g(i, ciLit))
        Dim pr As Double: pr = NumOr0(g(i, ciPrix))
        litres(v) = NumDict(litres, v) + li
        cout(v) = NumDict(cout, v) + li * pr
        If km > 0 Then
            If Not kmMin.Exists(v) Then kmMin(v) = km Else If km < kmMin(v) Then kmMin(v) = km
            If Not kmMax.Exists(v) Then kmMax(v) = km Else If km > kmMax(v) Then kmMax(v) = km
        End If
NX:
    Next i

    Dim rw As Long: rw = 1
    Dim kv As Variant
    For Each kv In litres.Keys
        Dim veh As String: veh = CStr(kv)
        Dim dist As Double: dist = 0
        If kmMax.Exists(veh) And kmMin.Exists(veh) Then dist = kmMax(veh) - kmMin(veh)
        If dist > 0 Then
            rw = rw + 1
            wsD.Cells(rw, 15).Value = veh                                   ' O
            wsD.Cells(rw, 16).Value = Round(litres(veh) / dist * 100, 2)    ' P conso
            wsD.Cells(rw, 17).Value = Round(cout(veh) / dist * 100, 2)      ' Q cout
        End If
    Next kv
    BuildVehiculesBlock = rw
End Function

' ============================================================
'  CREATION DES GRAPHIQUES
' ============================================================
' Graphique generique X/Y a partir d'une plage (1re col = categories)
Private Sub AddChartXY(ws As Worksheet, src As Range, typ As Long, titre As String, _
                       L As Double, t As Double, w As Double, h As Double, _
                       smooth As Boolean)
    Dim co As ChartObject
    Set co = ws.ChartObjects.Add(L, t, w, h)
    With co.Chart
        .ChartType = typ
        .SetSourceData Source:=src, PlotBy:=xlColumns
        .HasTitle = True
        .ChartTitle.Text = titre
        .ChartTitle.Font.Size = 11
        .ChartTitle.Font.Bold = True
        .HasLegend = (.SeriesCollection.Count > 1)
        If .HasLegend Then .Legend.Position = xlLegendPositionBottom
        On Error Resume Next
        .ChartArea.Border.LineStyle = xlNone
        If smooth Then
            Dim si As Long
            For si = 1 To .SeriesCollection.Count
                .SeriesCollection(si).smooth = False
            Next si
        End If
        On Error GoTo 0
    End With
End Sub

' Tendance budget 6 mois : barres depense + ligne objectif
Private Sub AddBudgetTrendChart(ws As Worksheet, wsD As Worksheet, rBudg As Long, _
                                L As Double, t As Double, w As Double, h As Double)
    Dim co As ChartObject
    Set co = ws.ChartObjects.Add(L, t, w, h)
    With co.Chart
        .ChartType = xlColumnClustered
        .SetSourceData Source:=wsD.Range("S1").Resize(rBudg, 3), PlotBy:=xlColumns
        .HasTitle = True
        .ChartTitle.Text = "Tendance depenses - 6 mois + objectif"
        .ChartTitle.Font.Size = 11: .ChartTitle.Font.Bold = True
        On Error Resume Next
        ' 2e serie (Objectif) en ligne
        If .SeriesCollection.Count >= 2 Then
            .SeriesCollection(2).ChartType = xlLine
            .SeriesCollection(2).Format.Line.ForeColor.RGB = C_OBJ
            .SeriesCollection(2).Format.Line.DashStyle = msoLineDash
        End If
        .SeriesCollection(1).Format.Fill.ForeColor.RGB = C_COUT
        .HasLegend = True: .Legend.Position = xlLegendPositionBottom
        .ChartArea.Border.LineStyle = xlNone
        On Error GoTo 0
    End With
End Sub

' CO2 cumule mensuel vs trajectoire objectif (2 courbes)
Private Sub AddCo2MonthlyChart(ws As Worksheet, wsD As Worksheet, rMonth As Long, _
                               L As Double, t As Double, w As Double, h As Double)
    Dim co As ChartObject
    Set co = ws.ChartObjects.Add(L, t, w, h)
    With co.Chart
        .ChartType = xlLine
        ' Mois (A) + CO2 cumule (D) + Objectif cumule (E)
        Dim src As Range
        Set src = Union(wsD.Range("A1").Resize(rMonth, 1), wsD.Range("D1").Resize(rMonth, 2))
        .SetSourceData Source:=src, PlotBy:=xlColumns
        .HasTitle = True
        .ChartTitle.Text = "CO2 evite - cumul mensuel vs objectif"
        .ChartTitle.Font.Size = 11: .ChartTitle.Font.Bold = True
        On Error Resume Next
        .SeriesCollection(1).Format.Line.ForeColor.RGB = C_E85
        If .SeriesCollection.Count >= 2 Then
            .SeriesCollection(2).Format.Line.ForeColor.RGB = C_OBJ
            .SeriesCollection(2).Format.Line.DashStyle = msoLineDash
        End If
        .HasLegend = True: .Legend.Position = xlLegendPositionBottom
        .ChartArea.Border.LineStyle = xlNone
        On Error GoTo 0
    End With
End Sub

' Jauge CO2 annuel : barre Realise vs Objectif
Private Sub AddCo2GaugeChart(ws As Worksheet, wsD As Worksheet, co2Obj As Double, _
                             L As Double, t As Double, w As Double, h As Double)
    ' Realise = dernier cumul (col D, derniere ligne mensuelle)
    Dim realise As Double: realise = 0
    Dim lr As Long: lr = wsD.Cells(wsD.Rows.Count, 4).End(xlUp).Row
    If lr >= 2 Then If IsNumeric(wsD.Cells(lr, 4).Value) Then realise = CDbl(wsD.Cells(lr, 4).Value)

    ' Zone technique pour la jauge (col Z/AA)
    wsD.Range("Z1").Value = "CO2 annuel": wsD.Range("AA1").Value = "kg"
    wsD.Range("Z2").Value = "Realise": wsD.Range("AA2").Value = Round(realise, 0)
    wsD.Range("Z3").Value = "Objectif": wsD.Range("AA3").Value = Round(co2Obj, 0)

    Dim co As ChartObject
    Set co = ws.ChartObjects.Add(L, t, w, h)
    With co.Chart
        .ChartType = xlBarClustered
        .SetSourceData Source:=wsD.Range("Z1:AA3"), PlotBy:=xlColumns
        .HasTitle = True
        .ChartTitle.Text = "Objectif CO2 annuel (kg evites)"
        .ChartTitle.Font.Size = 11: .ChartTitle.Font.Bold = True
        On Error Resume Next
        .SeriesCollection(1).Points(1).Format.Fill.ForeColor.RGB = C_E85
        .SeriesCollection(1).Points(2).Format.Fill.ForeColor.RGB = C_OBJ
        .SeriesCollection(1).HasDataLabels = True
        .HasLegend = False
        .ChartArea.Border.LineStyle = xlNone
        On Error GoTo 0
    End With
End Sub

' ============================================================
'  KPIs (cartes)
' ============================================================
Private Sub BuildKPICards(ws As Worksheet, wsD As Worksheet, L As Double, t As Double)
    ' Lit les KPIs ecrits en W2:X7
    Dim labels(1 To 6) As String, vals(1 To 6) As String, i As Long
    For i = 1 To 6
        labels(i) = CStr(wsD.Cells(i + 1, 23).Value)   ' W
        vals(i) = CStr(wsD.Cells(i + 1, 24).Value)      ' X
    Next i

    Dim titre As Shape
    Set titre = ws.Shapes.AddShape(msoShapeRectangle, L, t, 460, 26)
    StyleShape titre, "Bilan annuel " & vals(1), C_KPI, RGB(255, 255, 255), 11, True

    Dim cardW As Double, cardH As Double, gap As Double
    cardW = 145: cardH = 60: gap = 12
    Dim col As Long, row As Long
    For i = 2 To 6
        col = (i - 2) Mod 3
        row = (i - 2) \ 3
        Dim cx As Double, cy As Double
        cx = L + col * (cardW + gap)
        cy = t + 34 + row * (cardH + gap)
        Dim sh As Shape
        Set sh = ws.Shapes.AddShape(msoShapeRoundedRectangle, cx, cy, cardW, cardH)
        StyleShape sh, vals(i) & vbLf & labels(i), RGB(238, 242, 247), RGB(27, 58, 92), 10, False
    Next i
End Sub

Private Sub StyleShape(sh As Shape, txt As String, fillC As Long, fontC As Long, _
                       sz As Single, bold As Boolean)
    sh.Fill.ForeColor.RGB = fillC
    sh.Line.Visible = msoFalse
    With sh.TextFrame2.TextRange
        .Text = txt
        .Font.Size = sz
        .Font.bold = IIf(bold, msoTrue, msoFalse)
        .Font.Fill.ForeColor.RGB = fontC
    End With
    sh.TextFrame2.HorizontalAnchor = msoAnchorCenter
    sh.TextFrame2.VerticalAnchor = msoAnchorMiddle
End Sub

' ============================================================
'  PARAMETRES + BOUTON + NETTOYAGE
' ============================================================
Private Sub EnsureParamBlock(ws As Worksheet)
    On Error Resume Next
    If CStr(ws.Range("A1").Value) = "" Then ws.Range("A1").Value = "Parametres"
    ws.Range("A1").Font.bold = True
    ws.Range("A2").Value = "Budget mensuel (" & ChrW(8364) & ")"
    ws.Range("A3").Value = "Objectif CO2 annuel (kg)"
    If CStr(ws.Range(CELL_CO2OBJ).Value) = "" Then ws.Range(CELL_CO2OBJ).Value = DEFAULT_CO2_OBJ
    ws.Range("A2:A3").Font.Italic = True
    ws.Range(CELL_BUDGET & ":" & CELL_CO2OBJ).Interior.Color = RGB(255, 252, 230)
    On Error GoTo 0
End Sub

Private Sub ClearAllCharts(ws As Worksheet)
    Dim co As ChartObject
    For Each co In ws.ChartObjects
        co.Delete
    Next co
    ' Retire les anciennes cartes KPI (shapes auto-shape) sans toucher au bouton
    Dim sh As Shape, i As Long
    For i = ws.Shapes.Count To 1 Step -1
        Set sh = ws.Shapes(i)
        If sh.Name <> "btnRecreerGraph" Then
            If sh.Type = msoAutoShape Then sh.Delete
        End If
    Next i
End Sub

Private Sub EnsureButton(ws As Worksheet)
    Dim found As Boolean, sh As Shape
    For Each sh In ws.Shapes
        If sh.Name = "btnRecreerGraph" Then found = True
    Next sh
    If found Then Exit Sub
    Dim b As Shape
    Set b = ws.Shapes.AddShape(msoShapeRoundedRectangle, 320, 8, 200, 26)
    b.Name = "btnRecreerGraph"
    StyleShape b, "Recreer les graphiques", C_HEADER, RGB(255, 255, 255), 10, True
    b.OnAction = "CreerGraphiquesWeb"
End Sub

' ============================================================
'  HELPERS
' ============================================================
Private Function EnsureDataSheet() As Worksheet
    Dim ws As Worksheet
    Set ws = SheetByName(WS_DATA)
    If ws Is Nothing Then
        Set ws = ThisWorkbook.Worksheets.Add(After:=ThisWorkbook.Sheets(ThisWorkbook.Sheets.Count))
        ws.Name = WS_DATA
    End If
    ws.Visible = xlSheetVeryHidden
    Set EnsureDataSheet = ws
End Function

Private Function SheetByName(nm As String) As Worksheet
    On Error Resume Next
    Set SheetByName = ThisWorkbook.Worksheets(nm)
    On Error GoTo 0
End Function

Private Function LCIdx(lo As ListObject, nm As String) As Long
    On Error Resume Next
    LCIdx = lo.ListColumns(nm).Index
    On Error GoTo 0
End Function

Private Function NumOr0(v As Variant) As Double
    If IsNumeric(v) Then NumOr0 = CDbl(v) Else NumOr0 = 0
End Function

Private Function NumDict(d As Object, k As String) As Double
    If d.Exists(k) Then NumDict = d(k) Else NumDict = 0
End Function

Private Function FuelKey(t As String) As String
    Dim u As String: u = UCase(t)
    If InStr(u, "E85") > 0 Or InStr(u, "ETHANOL") > 0 Then
        FuelKey = "E85"
    ElseIf InStr(u, "GAZOLE") > 0 Or InStr(u, "DIESEL") > 0 Or InStr(u, "GASOIL") > 0 Then
        FuelKey = "GAZOLE"
    ElseIf InStr(u, "98") > 0 Then
        FuelKey = "SP98"
    Else
        FuelKey = "AUTRE"
    End If
End Function

Private Function TopKey(d As Object) As String
    Dim best As String, bestN As Double, kv As Variant
    bestN = -1
    For Each kv In d.Keys
        If d(kv) > bestN Then bestN = d(kv): best = CStr(kv)
    Next kv
    TopKey = best
End Function

Private Sub TriStr(arr() As String)
    Dim i As Long, j As Long, tmp As String
    For i = LBound(arr) To UBound(arr) - 1
        For j = i + 1 To UBound(arr)
            If arr(j) < arr(i) Then tmp = arr(i): arr(i) = arr(j): arr(j) = tmp
        Next j
    Next i
End Sub

Private Sub SetStatusG(msg As String)
    Application.StatusBar = "[Graphiques] " & msg
    Debug.Print Format(Now, "hh:mm:ss") & "  " & msg
End Sub
