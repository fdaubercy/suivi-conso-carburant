Attribute VB_Name = "modGraphiques"
' ============================================================
'  SUIVI CONSO CARBURANTS ? Graphiques du tableau de bord     v4.9.0.1
'
'  v4.8.0.0 (X27/X28/X29) :
'    ? Charte graphique alignee sur l'app web (vert #1D9E75, bleu fonce
'      #1B3A5C, bleu #2E75B6, ambre #F0A500, rouge #E24B4A).
'    ? Mise en page "Dashboard" : bandeau-titre, bloc parametres espace
'      des boutons, graphiques decales vers le bas (topBase plus grand).
'    ? Boutons "Recreer" / "Exporter PDF" en VRAIES IMAGES cliquables
'      (PNG dans excel\assets\, repli Shape stylee si fichier absent).
'    ? 3 graphiques "Rentabilite du kit" restaures depuis l'ancien
'      classeur : economie cumulee vs cout du kit (courbe + seuil),
'      cout au km c{e}/km par plein (barres), projection de rentabilite
'      (nuage de points + tendance lineaire). Donnees lues dans Tableau2
'      (colonnes deja calculees) ; cout du kit = "Suivi Carburant"!B5.
'    ? Rafraichissement a l'ouverture de l'onglet (Worksheet_Activate,
'      voir vba\Graphiques_snippet.bas).
'
'  Recree sur l'onglet "Graphiques" (remis a zero) les memes
'  visualisations que l'app web, en graphiques NATIFS Excel :
'    1. Evolution du prix (multi-carburant E85 / Gazole / SP98)
'    2. Cout mensuel du carburant
'    3. Tendance des depenses 6 mois + ligne objectif budget
'    4. Comparaison entre vehicules (conso & cout / 100 km)
'    5. CO2 evite ? cumul mensuel vs trajectoire d'objectif
'    6. Jauge objectif CO2 annuel (realise vs objectif)
'    7. Consommation L/100 km (refonte)
'    8. Bilan annuel ? KPIs (litres, EUR, km, station preferee)
'
'  Donnees :
'    ? "Suivi Carburant" / Tableau2 (vue chronologique, calculs) :
'      prix, cout, conso, CO2, mensuel, KPIs.
'    ? "GS_Pleins" (colonne Vehicule) : comparaison vehicules.
'  Agregats calcules en VBA -> feuille technique masquee _GraphData.
'
'  Parametres pilotables (onglet Graphiques, en haut a gauche) :
'    ? B2 = Budget mensuel (EUR)  ? vide = pas de ligne objectif
'    ? B3 = Objectif CO2 annuel (kg) ? defaut 200
'    ? B4 = Annee du bilan (X24)  ? vide = annee la plus recente
'    ? Surconso E85 : cellule J7 de "Suivi Carburant" (1+J7), defaut 0.20
'
'  X22 (v4.6.0.0) : l'appel auto (modSyncGS) ne se declenche que si
'    l'onglet "Graphiques" existe deja (pas de creation surprise).
'  X23 : bouton "Exporter en PDF" -> ExporterGraphiquesPDF.
'  X25 : rafraichissement incremental ? les ChartObjects et cartes KPI
'    sont NOMMES puis REUTILISES (reposition + SetSourceData) au lieu
'    d'etre supprimes/recrees ; seuls les objets inconnus sont purges.
'  X26 (v4.7.0.0) : mini-jauge budget annuel (depense de l'annee cible
'    vs Budget mensuel x 12), affichee si B2 (budget) est renseigne.
'
'  Point d'entree : CreerGraphiquesWeb (rejouable + bouton "Recreer").
'
'  Appel automatique (v4.5.0.0) : modSyncGS.SyncCore appelle
'  CreerGraphiquesWeb(silent:=True) en fin de sync UNIQUEMENT si des
'  donnees ont change (lignes ajoutees / mises a jour, dans un sens
'  ou l'autre). Couvre l'ouverture (SyncOnOpen) et le sync manuel.
'  En mode silencieux, aucune MsgBox : l'erreur eventuelle est
'  reportee en barre d'etat (le bouton "Recreer" garde la MsgBox).
' ============================================================
Option Explicit

' -- Feuilles / tables --
' X36 : l'onglet du dashboard (ex-"Graphiques") est renomm? "Tableau de bord".
Private Const WS_GRAPH  As String = "Tableau de bord"
' X36 : sentinelle ? tous ? des s?lecteurs v?hicule/carburant (= modDashboardKPI.KPI_TOUS).
Private Const FILTER_ALL As String = "(tous)"
Private Const PH_TABLE  As String = "PrixHistory"   ' X30/X35 : table Power Query _PrixHistory
Private Const WS_CARB  As String = "Suivi Carburant"
Private Const WS_DATA  As String = "_GraphData"
Private Const T2_NAME  As String = "Tableau2"
Private Const GS_SHEET As String = "GS_Pleins"

' -- Constantes CO2 (alignees sur js/config.js) --
Private Const CO2_ESSENCE_PER_L As Double = 2.21    ' kg CO2/L SP95-E10
Private Const CO2_E85_PER_L     As Double = 1.105   ' E85 ? -50 %
Private Const DEFAULT_CO2_OBJ   As Double = 200     ' kg CO2/an
Private Const DEFAULT_SURCONSO  As Double = 0.2     ' +20 %

' -- Cellules de parametres sur l'onglet Graphiques --
Private Const CELL_BUDGET     As String = "B2"
Private Const CELL_CO2OBJ     As String = "B3"
Private Const CELL_ANNEE      As String = "B4"   ' X24 : annee bilan (vide = recente)
Private Const CELL_GRAPH_AUTO As String = "B7"   ' X20 : "Oui"/"Non" ? recreer auto (defaut Oui si vide)
Private Const CELL_HORODATAGE As String = "B8"   ' X21 : horodatage derniere generation

' -- Couleurs ? alignees sur la charte de l'app web (css/style.css) --
'    valeur Long = RGB(r,g,b) = r + g*256 + b*65536
Private Const C_E85    As Long = 7708189   ' vert        #1D9E75 (--green)
Private Const C_GAZOLE As Long = 8417899   ' gris ardoise #6B7280 (--text-muted)
Private Const C_SP98   As Long = 11957550  ' bleu        #2E75B6 (--blue-mid)
Private Const C_COUT   As Long = 6044187   ' bleu fonce  #1B3A5C (--blue-dark)
Private Const C_OBJ    As Long = 42480     ' ambre       #F0A500 (--amber)
Private Const C_CONSO  As Long = 11957550  ' bleu        #2E75B6
Private Const C_RED    As Long = 4869090   ' rouge       #E24B4A (--red)
Private Const C_HEADER As Long = 6044187   ' bleu fonce  #1B3A5C
Private Const C_KPI    As Long = 6044187
Private Const C_CARD   As Long = 16250098  ' fond carte  #F2F5F8 (clair)

' -- Mise en page (v4.8) --
Private Const TOP_BASE As Double = 150     ' decalage vertical des graphiques (bandeau + params)
Private Const CHART_W  As Double = 460
Private Const CHART_H  As Double = 250

' -- T1c (X39) : filtre Periode -> TOUTES les series datees --
'    cellules d'etat B9/B10 du dashboard (cachees en P6), ecrites par la
'    Chronologie (event Workbook_SheetPivotTableUpdate). 0 = borne non definie.
Private Const CELL_PERDEB As String = "B9"
Private Const CELL_PERFIN As String = "B10"
Private mPerDeb As Double   ' borne basse (serial date) ; 0 = non borne
Private mPerFin As Double   ' borne haute (serial date) ; 0 = non borne

' ============================================================
'  POINT D'ENTREE
' ============================================================
Public Sub CreerGraphiquesWeb(Optional silent As Boolean = False)
    Dim wsG As Worksheet, wsC As Worksheet, wsd As Worksheet
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
        Set wsG = ThisWorkbook.Worksheets.Add(After:=ThisWorkbook.Sheets(ThisWorkbook.Sheets.count))
        wsG.name = WS_GRAPH
    End If

    Set gsT = Nothing
    On Error Resume Next
    Set gsT = SheetByName(GS_SHEET).ListObjects(1)
    On Error GoTo EH

    ' -- Surconso E85 (fraction) = "Suivi Carburant"!J8 ("Surconsommation E85 (%)") --
    '    NB : J7 = "Conso E85 reference (km/L)" (~15) ; ne pas la lire comme surconso.
    '    Garde-fou : fraction plausible (0 < x <= 1), sinon defaut 0.20.
    Dim surconso As Double
    surconso = DEFAULT_SURCONSO
    If IsNumeric(wsC.Range("J8").value) Then
        Dim vSc As Double: vSc = CDbl(wsC.Range("J8").value)
        If vSc > 0 And vSc <= 1 Then surconso = vSc
    End If

    ' -- Bloc parametres + lecture budget / objectif CO2 / annee (X24) --
    EnsureParamBlock wsG
    Dim budget As Double, co2Obj As Double, anneeSel As Long
    budget = 0
    If IsNumeric(wsG.Range(CELL_BUDGET).value) Then budget = CDbl(wsG.Range(CELL_BUDGET).value)
    co2Obj = DEFAULT_CO2_OBJ
    If IsNumeric(wsG.Range(CELL_CO2OBJ).value) Then
        If wsG.Range(CELL_CO2OBJ).value > 0 Then co2Obj = CDbl(wsG.Range(CELL_CO2OBJ).value)
    End If
    anneeSel = 0   ' 0 = automatique (annee la plus recente)
    If IsNumeric(wsG.Range(CELL_ANNEE).value) Then
        If wsG.Range(CELL_ANNEE).value >= 2000 Then anneeSel = CLng(wsG.Range(CELL_ANNEE).value)
    End If

    ' -- Feuille de donnees technique --
    Set wsd = EnsureDataSheet()

    ' -- Cout du kit ethanol (Suivi Carburant!B5, repli recherche libelle) --
    Dim coutKit As Double
    coutKit = KitCost(wsC)

    ' -- X36 : s?lecteurs v?hicule (B5) / carburant (B6) ? filtre des graphiques --
    Dim selVeh As String, selFuel As String
    selVeh = Trim$(CStr(wsG.Range("B5").value))
    selFuel = Trim$(CStr(wsG.Range("B6").value))

    ' -- T1c : periode (B9/B10) -> filtre TOUTES les series datees ; 0 = non borne --
    EnsurePeriodNames wsG
    mPerDeb = 0: mPerFin = 0
    If IsDate(wsG.Range(CELL_PERDEB).value) Then mPerDeb = CDbl(CDate(wsG.Range(CELL_PERDEB).value))
    If IsDate(wsG.Range(CELL_PERFIN).value) Then mPerFin = CDbl(CDate(wsG.Range(CELL_PERFIN).value))

    ' -- Calcul des agregats -> _GraphData --
    SetStatusG "Graphiques : calcul des agregats..."
    Dim rMonth As Long, rPrice As Long, rConso As Long, rConsoCols As Long, rVeh As Long, rBudg As Long
    Dim rKit As Long, rCoutKm As Long, rPriceCols As Long
    Dim rEcoDate As Long, rScatter As Long
    BuildAggregates t2, gsT, wsd, surconso, co2Obj, budget, anneeSel, coutKit, _
                    selVeh, selFuel, _
                    rMonth, rPrice, rConso, rConsoCols, rVeh, rBudg, rKit, rCoutKm, rPriceCols, _
                    rEcoDate, rScatter

    ' -- Bandeau-titre (dashboard) --
    EnsureHeaderBand wsG

    ' -- Creation / rafraichissement incremental des graphiques (X25) --
    SetStatusG "Graphiques : creation..."
    Dim L1 As Double, L2 As Double, w As Double, h As Double, topBase As Double
    Dim stepY As Double
    w = CHART_W: h = CHART_H: topBase = TOP_BASE
    stepY = h + 24
    L1 = 10: L2 = L1 + w + 24

    ' -- Colonne gauche --
    If rPrice > 1 And rPriceCols > 0 Then
        DeleteChartByName wsG, "gPrice"   ' X37 : force recreation to clear stale series
        AddChartXY wsG, "gPrice", wsd.Range("G1").Resize(rPrice, 1 + rPriceCols), xlLine, _
            "Evolution du prix moyen par carburant (" & ChrW(8364) & "/L)", L1, topBase, w, h, True
    Else
        DeleteChartByName wsG, "gPrice"
    End If
    If rMonth > 1 Then
        AddChartXY wsG, "gCost", wsd.Range("A1").Resize(rMonth, 2), xlColumnClustered, _
            "Cout mensuel du carburant (" & ChrW(8364) & ")", L1, topBase + stepY, w, h, False
    Else
        DeleteChartByName wsG, "gCost"
    End If
    If rConso > 1 And rConsoCols > 0 Then
        DeleteChartByName wsG, "gConso"            ' X39 : nb de series variable -> recreation
        AddChartXY wsG, "gConso", wsd.Cells(1, 55).Resize(rConso, 1 + rConsoCols), xlLine, _
            "Consommation par vehicule (L/100 km)", L1, topBase + 2 * stepY, w, h, True
    Else
        DeleteChartByName wsG, "gConso"
    End If
    If rVeh > 1 Then
        AddChartXY wsG, "gVeh", wsd.Range("O1").Resize(rVeh, 3), xlBarClustered, _
            "Comparaison vehicules (conso & cout /100 km)", L1, topBase + 3 * stepY, w, h, False
    Else
        DeleteChartByName wsG, "gVeh"
    End If
    ' X26 : jauge budget annuel (si budget mensuel renseigne)
    If budget > 0 Then
        AddBudgetYearGauge wsG, "gBudgetYear", wsd, L1, topBase + 4 * stepY, w, h
    Else
        DeleteChartByName wsG, "gBudgetYear"
    End If
    ' X27 : rentabilite kit ? economie cumulee vs cout du kit (courbe + seuil)
    If rKit > 1 Then
        AddKitCumulChart wsG, "gKitCumul", wsd, rKit, L1, topBase + 5 * stepY, w, h
    Else
        DeleteChartByName wsG, "gKitCumul"
    End If
    ' X9 : economies cumulees E85 vs SP98 (courbe date)
    If rEcoDate > 1 Then
        AddEcoCumDateChart wsG, "gEcoDate", wsd, rEcoDate, L1, topBase + 6 * stepY, w, h
    Else
        DeleteChartByName wsG, "gEcoDate"
    End If

    ' -- Colonne droite --
    If rBudg > 1 Then
        AddBudgetTrendChart wsG, "gBudget", wsd, rBudg, L2, topBase, w, h
    Else
        DeleteChartByName wsG, "gBudget"
    End If
    If rMonth > 1 Then
        AddCo2MonthlyChart wsG, "gCo2", wsd, rMonth, L2, topBase + stepY, w, h
    Else
        DeleteChartByName wsG, "gCo2"
    End If
    AddCo2GaugeChart wsG, "gGauge", wsd, co2Obj, L2, topBase + 2 * stepY, w, h
    ' X15 : scatter prix E85/L vs conso L/100 km (corr?lation comportementale)
    If rScatter > 1 Then
        AddScatterE85Chart wsG, "gScatterE85", wsd, rScatter, L2, topBase + 3 * stepY, w, h
    Else
        DeleteChartByName wsG, "gScatterE85"
    End If
    ' X36 : bloc "Bilan annuel" (BuildKPICards) RETIRE ? il n'etait pas repositionne
    ' par modDashboardGraphiques.LayoutCharts (formes, pas graphiques) -> un graphique
    ' se posait par-dessus (titre tronque). Ses donnees sont desormais dans les 2
    ' bandeaux meta de modDashboardGraphiques. Les formes residuelles kpiTitle/kpiCard*
    ' sont supprimees par CleanupDashShapes.
    ' X28 : cout au km c{e}/km par plein (barres)
    If rCoutKm > 1 Then
        AddCoutKmChart wsG, "gCoutKm", wsd, rCoutKm, L2, topBase + 4 * stepY, w, h
    Else
        DeleteChartByName wsG, "gCoutKm"
    End If
    ' X29 : projection de rentabilite du kit (nuage de points + tendance)
    If rKit > 1 Then
        AddKitProjChart wsG, "gKitProj", wsd, rKit, L2, topBase + 5 * stepY, w, h
    Else
        DeleteChartByName wsG, "gKitProj"
    End If

    ' -- Purge des objets inconnus (anciennes versions) + boutons --
    PurgeUnknown wsG
    EnsureButtons wsG

    Application.Calculation = xlCalculationAutomatic
    Application.ScreenUpdating = True
    ' X21 : horodatage derniere generation
    On Error Resume Next
    wsG.Range(CELL_HORODATAGE).value = now
    On Error GoTo 0
    SetStatusG "Graphiques : " & ChrW(10003) & " recrees (" & Format(now, "hh:mm:ss") & ")."
    Exit Sub
EH:
    Application.Calculation = xlCalculationAutomatic
    Application.ScreenUpdating = True
    SetStatusG "Graphiques : ERREUR " & Err.Number & " - " & Err.Description
    If Not silent Then _
        MsgBox "Erreur " & Err.Number & " : " & Err.Description, vbCritical, "modGraphiques"
End Sub

' T1c : cree/met a jour les noms PERIODE_DEB / PERIODE_FIN pointant vers les
'  cellules d'etat B9/B10 du dashboard (idempotent ; Names.Add ecrase si existe).
Private Sub EnsurePeriodNames(wsG As Worksheet)
    On Error Resume Next
    ThisWorkbook.names.Add name:="PERIODE_DEB", _
        RefersTo:="='" & wsG.name & "'!" & wsG.Range(CELL_PERDEB).Address
    ThisWorkbook.names.Add name:="PERIODE_FIN", _
        RefersTo:="='" & wsG.name & "'!" & wsG.Range(CELL_PERFIN).Address
    On Error GoTo 0
End Sub

' ============================================================
'  AGREGATS  -> _GraphData
' ============================================================
Private Sub BuildAggregates(t2 As ListObject, gsT As ListObject, wsd As Worksheet, _
                            surconso As Double, co2Obj As Double, budget As Double, _
                            anneeSel As Long, coutKit As Double, _
                            ByVal selVeh As String, ByVal selFuel As String, _
                            ByRef rMonth As Long, ByRef rPrice As Long, _
                            ByRef rConso As Long, ByRef rConsoCols As Long, ByRef rVeh As Long, ByRef rBudg As Long, _
                            ByRef rKit As Long, ByRef rCoutKm As Long, ByRef rPriceCols As Long, _
                            ByRef rEcoDate As Long, ByRef rScatter As Long)

    wsd.Cells.Clear

    ' X36 : filtre v?hicule / carburant (sentinelle "(tous)" ou vide = pas de filtre)
    Dim filtVeh As Boolean: filtVeh = (Len(selVeh) > 0 And selVeh <> FILTER_ALL)
    Dim filtFuel As Boolean: filtFuel = (Len(selFuel) > 0 And selFuel <> FILTER_ALL)

    ' En-tetes des blocs
    Dim eu As String: eu = ChrW(8364)
    wsd.Range("A1:E1").value = Array("Mois", "Cout (" & eu & ")", "CO2 evite (kg)", "CO2 cumule (kg)", "Objectif cumule (kg)")
    ' G1:... : en-tete prix ecrit dynamiquement par BuildPriceBlockMerged
    ' X39 : bloc conso ecrit par BuildConsoBlock (col BC=55, une colonne par vehicule)
    wsd.Range("O1:Q1").value = Array("Vehicule", "Conso L/100km", "Cout " & eu & "/100km")
    wsd.Range("S1:U1").value = Array("Mois", "Depense (" & eu & ")", "Objectif (" & eu & ")")
    wsd.Range("W1:X1").value = Array("Indicateur", "Valeur")
    ' X27/X29 : rentabilite kit (AF=N plein, AG=eco cumulee, AH=cout kit seuil)
    wsd.Range("AF1:AH1").value = Array("Plein n", "Economie cumulee (" & eu & ")", "Cout du kit (" & eu & ")")
    ' X28 : cout au km par plein (AJ=N plein, AK=cout c{e}/km)
    wsd.Range("AJ1:AK1").value = Array("Plein n", "Cout c" & eu & "/km")
    ' X9 : economie cumulee E85 par date (AM=39, AN=40)
    wsd.Range("AM1:AN1").value = Array("Date", "Economie cumulee E85 (" & eu & ")")
    ' X15 : scatter prix E85/L vs conso L/100 km (AP=42, AQ=43)
    wsd.Range("AP1:AQ1").value = Array("Prix E85 " & eu & "/L", "Conso L/100 km")

    rMonth = 1: rPrice = 1: rConso = 1: rVeh = 1: rBudg = 1: rKit = 1: rCoutKm = 1
    rEcoDate = 1: rScatter = 1

    ' ---- Lecture Tableau2 ----
    If t2.DataBodyRange Is Nothing Then Exit Sub
    Dim a As Variant: a = t2.DataBodyRange.value
    Dim ciDate As Long, ciType As Long, ciKm As Long, ciNbKm As Long
    Dim ciLitres As Long, ciPrix As Long, ciCout As Long, ciConso As Long, ciStation As Long
    Dim ciNum As Long, ciCkm As Long, ciEcoCum As Long
    ciDate = LCIdx(t2, "Date")
    ciType = LCIdx(t2, "Type")
    ciKm = LCIdx(t2, "Km compteur")
    ciNbKm = LCIdx(t2, "Nb. km")
    ciLitres = LCIdx(t2, "Nb. Litres")
    ciPrix = LCIdx(t2, "Prix " & ChrW(8364) & "/L")
    ciCout = LCIdx(t2, "Co" & ChrW(251) & "t Plein (" & ChrW(8364) & ")")  ' "Co?t Plein (?)"
    ciConso = LCIdx(t2, "Conso. (L/100km)")
    ciStation = LCIdx(t2, "Station essence")
    ciNum = LCIdx(t2, "N" & ChrW(176))                                       ' "N?"
    ciCkm = LCIdx(t2, "Co" & ChrW(251) & "t c" & ChrW(8364) & "/km")          ' "Co?t c?/km"
    ciEcoCum = LCIdx(t2, ChrW(201) & "conomie cumul" & ChrW(233) & "e (" & ChrW(8364) & ")") ' "?conomie cumul?e (?)"
    Dim ciVehT2 As Long: ciVehT2 = LCIdx(t2, "Vehicule")   ' X36 : filtre v?hicule

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
    ' rP supprime : bloc prix gere par BuildPriceBlockMerged
    ' X39 : rCo retire (conso desormais geree par BuildConsoBlock)
    Dim rK As Long: rK = 1   ' lignes ecrites bloc rentabilite kit (AF/AG/AH)
    Dim rCk As Long: rCk = 1 ' lignes ecrites bloc cout/km par plein (AJ/AK)
    Dim rEco As Long: rEco = 1 ' X9 : economie cumulee E85 par date (AM/AN)
    Dim rSc As Long: rSc = 1   ' X15 : scatter prix E85 vs conso (AP/AQ)

    ' 1er passage : determiner l'annee la plus recente
    For i = 1 To n
        If IsDate(a(i, ciDate)) Then
            If Year(a(i, ciDate)) > anneeMax Then anneeMax = Year(a(i, ciDate))
        End If
    Next i

    ' X24 : annee cible du bilan (param B4) ou annee la plus recente
    Dim anneeCible As Long
    anneeCible = anneeMax
    If anneeSel > 0 Then anneeCible = anneeSel

    For i = 1 To n
        If Not IsDate(a(i, ciDate)) Then GoTo NextRow
        Dim d As Date: d = CDate(a(i, ciDate))
        If mPerDeb > 0 Then If CDbl(d) < mPerDeb Then GoTo NextRow
        If mPerFin > 0 Then If CDbl(d) > mPerFin Then GoTo NextRow
        Dim fk As String: fk = FuelKey(CStr(a(i, ciType)))

        ' X36 : filtre v?hicule + carburant (graphiques r?actifs aux s?lecteurs B5/B6)
        If filtVeh And ciVehT2 > 0 Then
            If StrComp(Trim$(CStr(a(i, ciVehT2))), selVeh, vbTextCompare) <> 0 Then GoTo NextRow
        End If
        If filtFuel Then
            If Not modDashboardKPI.FuelInSel(fk, selFuel) Then GoTo NextRow
        End If

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

        ' X39 : conso deplacee vers BuildConsoBlock (par vehicule, depuis GS_Pleins)

        ' -- rentabilite kit : economie cumulee par plein E85 (AF/AG/AH) --
        If ciNum > 0 And ciEcoCum > 0 Then
            If IsNumeric(a(i, ciNum)) And IsNumeric(a(i, ciEcoCum)) Then
                rK = rK + 1
                wsd.Cells(rK, 32).value = CDbl(a(i, ciNum))      ' AF
                wsd.Cells(rK, 33).value = NumOr0(a(i, ciEcoCum)) ' AG
                wsd.Cells(rK, 34).value = coutKit                ' AH (seuil constant)
            End If
        End If

        ' -- cout au km c{e}/km par plein (AJ/AK) --
        If ciNum > 0 And ciCkm > 0 Then
            If IsNumeric(a(i, ciNum)) And IsNumeric(a(i, ciCkm)) Then
                If NumOr0(a(i, ciCkm)) > 0 Then
                    rCk = rCk + 1
                    wsd.Cells(rCk, 36).value = CDbl(a(i, ciNum))  ' AJ
                    wsd.Cells(rCk, 37).value = NumOr0(a(i, ciCkm)) ' AK
                End If
            End If
        End If
        ' X9 : economie cumulee E85 par date (AM=39, AN=40) ? toutes lignes avec eco valide
        If ciEcoCum > 0 Then
            If IsNumeric(a(i, ciEcoCum)) Then
                rEco = rEco + 1
                wsd.Cells(rEco, 39).value = d                       ' AM : date
                wsd.Cells(rEco, 40).value = NumOr0(a(i, ciEcoCum)) ' AN : eco cumulee
            End If
        End If
        ' X15 : scatter prix E85/L vs conso (AP=42, AQ=43) ? uniquement pleins E85
        If fk = "E85" And prix > 0 And conso > 0 Then
            rSc = rSc + 1
            wsd.Cells(rSc, 42).value = prix  ' AP : prix E85 ?/L
            wsd.Cells(rSc, 43).value = conso ' AQ : conso L/100 km
        End If

        ' -- station preferee + KPIs (annee cible : B4 ou plus recente) --
        If Year(d) = anneeCible Then
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
    ' X30/X35 : fusion PrixHistory (marche) + pleins, tous carburants detectes.
    ' X39 : filtre prix par carburants coches (CSV multi) ; "" / "(tous)" = tous
    Dim fuelFilter As String
    If filtFuel Then fuelFilter = selFuel Else fuelFilter = ""
    rPrice = BuildPriceBlockMerged(wsd, t2, rPriceCols, fuelFilter)
    rConso = BuildConsoBlock(gsT, wsd, selVeh, rConsoCols)
    rKit = rK
    rCoutKm = rCk
    rEcoDate = rEco
    rScatter = rSc

    ' -- bloc mensuel (trie) + CO2 cumule + objectif cumule --
    Dim keys() As String, k As Long
    Dim rw As Long: rw = 1
    Dim rb As Long: rb = 1
    If moisOrder.count > 0 Then
        ReDim keys(0 To moisOrder.count - 1)
        Dim kk As Variant: k = 0
        For Each kk In moisOrder.keys: keys(k) = CStr(kk): k = k + 1: Next kk
        TriStr keys
        Dim cumCO2 As Double: cumCO2 = 0
        Dim cibleMois As Double: cibleMois = co2Obj / 12
        For k = 0 To UBound(keys)
            rw = rw + 1
            wsd.Cells(rw, 1).value = keys(k)
            wsd.Cells(rw, 2).value = Round(NumDict(moisCost, keys(k)), 2)
            Dim cm As Double: cm = NumDict(moisCO2, keys(k))
            wsd.Cells(rw, 3).value = Round(cm, 1)
            cumCO2 = cumCO2 + cm
            wsd.Cells(rw, 4).value = Round(cumCO2, 1)
            wsd.Cells(rw, 5).value = Round(cibleMois * (k + 1), 1)
        Next k

        ' -- bloc budget 6 derniers mois --
        Dim startK As Long: startK = UBound(keys) - 5
        If startK < 0 Then startK = 0
        For k = startK To UBound(keys)
            rb = rb + 1
            wsd.Cells(rb, 19).value = keys(k)                              ' S
            wsd.Cells(rb, 20).value = Round(NumDict(moisCost, keys(k)), 2) ' T
            If budget > 0 Then wsd.Cells(rb, 21).value = budget            ' U
        Next k
    End If
    rMonth = rw
    rBudg = rb

    ' ---- Comparaison vehicules (GS_Pleins) ----
    rVeh = BuildVehiculesBlock(gsT, wsd)

    ' ---- KPIs (annee cible) ----
    Dim topSt As String: topSt = TopKey(stationCnt)
    wsd.Range("W2").value = "Annee": wsd.Range("X2").value = anneeCible
    wsd.Range("W3").value = "Pleins": wsd.Range("X3").value = nbAnnee
    wsd.Range("W4").value = "Litres": wsd.Range("X4").value = Round(litresAnnee, 1)
    wsd.Range("W5").value = ChrW(8364) & " depenses": wsd.Range("X5").value = Round(coutAnnee, 0)
    wsd.Range("W6").value = "Km parcourus": wsd.Range("X6").value = Round(kmAnnee, 0)
    wsd.Range("W7").value = "Station preferee": wsd.Range("X7").value = topSt

    ' ---- X26 : jauge budget annuel (depense annee cible vs budget x 12) ----
    wsd.Range("AC1").value = "Budget " & anneeCible: wsd.Range("AD1").value = eu
    wsd.Range("AC2").value = "Depense": wsd.Range("AD2").value = Round(coutAnnee, 0)
    wsd.Range("AC3").value = "Objectif": wsd.Range("AD3").value = Round(budget * 12, 0)

    ' Format colonnes date
    wsd.Columns(12).NumberFormat = "dd/mm/yyyy"   ' conso
    wsd.Columns(39).NumberFormat = "dd/mm/yyyy"   ' X9 eco cumulee
End Sub

' Comparaison par vehicule depuis GS_Pleins (km = max-min compteur)
Private Function BuildVehiculesBlock(gsT As ListObject, wsd As Worksheet) As Long
    BuildVehiculesBlock = 1
    If gsT Is Nothing Then Exit Function
    If gsT.DataBodyRange Is Nothing Then Exit Function

    Dim ciDate As Long, ciKm As Long, ciLit As Long, ciPrix As Long, ciVeh As Long
    ciKm = LCIdx(gsT, "Km")
    ciLit = LCIdx(gsT, "Litres")
    ciPrix = LCIdx(gsT, "PrixL")
    ciVeh = LCIdx(gsT, "Vehicule")
    If ciVeh = 0 Or ciKm = 0 Then Exit Function

    Dim g As Variant: g = gsT.DataBodyRange.value
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
    For Each kv In litres.keys
        Dim veh As String: veh = CStr(kv)
        Dim dist As Double: dist = 0
        If kmMax.Exists(veh) And kmMin.Exists(veh) Then dist = kmMax(veh) - kmMin(veh)
        If dist > 0 Then
            rw = rw + 1
            wsd.Cells(rw, 15).value = veh                                   ' O
            wsd.Cells(rw, 16).value = Round(litres(veh) / dist * 100, 2)    ' P conso
            wsd.Cells(rw, 17).value = Round(cout(veh) / dist * 100, 2)      ' Q cout
        End If
    Next kv
    BuildVehiculesBlock = rw
End Function

' X39 : appartenance d'une valeur a une liste CSV (insensible casse ; "" / "(tous)" = vrai).
Private Function InCsvSel(ByVal value As String, ByVal csv As String) As Boolean
    If Len(csv) = 0 Or csv = FILTER_ALL Then InCsvSel = True: Exit Function
    Dim parts() As String: parts = Split(csv, ",")
    Dim i As Long
    For i = 0 To UBound(parts)
        If StrComp(Trim$(parts(i)), Trim$(value), vbTextCompare) = 0 Then InCsvSel = True: Exit Function
    Next i
End Function

' X39 : conso L/100km par vehicule (serie temporelle) depuis GS_Pleins.
'  conso d'un plein = Litres / (Km - Km_precedent_du_meme_vehicule) * 100.
'  Tableau croise Date (col 55=BC) x Vehicule (BD..). selVeh CSV ("" / "(tous)" = tous).
'  Retour = nb lignes (>=1) ; nVehCols = nb de colonnes vehicule.
Private Function BuildConsoBlock(gsT As ListObject, wsd As Worksheet, _
                                 ByVal selVeh As String, ByRef nVehCols As Long) As Long
    Const COL0 As Long = 55                ' BC : Date ; BD.. : vehicules
    BuildConsoBlock = 1: nVehCols = 0
    If gsT Is Nothing Then Exit Function
    If gsT.DataBodyRange Is Nothing Then Exit Function
    Dim ciDate As Long, ciKm As Long, ciLit As Long, ciVeh As Long
    ciDate = LCIdx(gsT, "Date"): ciKm = LCIdx(gsT, "Km")
    ciLit = LCIdx(gsT, "Litres"): ciVeh = LCIdx(gsT, "Vehicule")
    If ciDate = 0 Or ciKm = 0 Or ciLit = 0 Or ciVeh = 0 Then Exit Function

    Dim g As Variant: g = gsT.DataBodyRange.value
    Dim filt As Boolean: filt = (Len(selVeh) > 0 And selVeh <> FILTER_ALL)
    Dim vehData As Object: Set vehData = CreateObject("Scripting.Dictionary")
    Dim i As Long
    For i = 1 To UBound(g, 1)
        If Not IsDate(g(i, ciDate)) Then GoTo NX
        Dim v As String: v = Trim$(CStr(g(i, ciVeh)))
        If Len(v) = 0 Then GoTo NX
        If filt Then If Not InCsvSel(v, selVeh) Then GoTo NX
        Dim km As Double: km = NumOr0(g(i, ciKm))
        Dim li As Double: li = NumOr0(g(i, ciLit))
        If km <= 0 Or li <= 0 Then GoTo NX
        If Not vehData.Exists(v) Then vehData.Add v, New Collection
        vehData(v).Add Array(CDate(g(i, ciDate)), km, li)
NX:
    Next i
    If vehData.count = 0 Then Exit Function

    Dim consoSum As Object: Set consoSum = CreateObject("Scripting.Dictionary")
    Dim consoCnt As Object: Set consoCnt = CreateObject("Scripting.Dictionary")
    Dim dateSet As Object: Set dateSet = CreateObject("Scripting.Dictionary")
    Dim vehOrder() As String, nv As Long: nv = 0
    ReDim vehOrder(0 To vehData.count - 1)
    Dim vk As Variant
    For Each vk In vehData.keys
        Dim col As Collection: Set col = vehData(vk)
        Dim arr() As Variant: ReDim arr(1 To col.count)
        Dim j As Long
        For j = 1 To col.count: arr(j) = col(j): Next j
        Dim a1 As Long, b1 As Long          ' tri par km croissant
        For a1 = 1 To UBound(arr) - 1
            For b1 = a1 + 1 To UBound(arr)
                If arr(b1)(1) < arr(a1)(1) Then
                    Dim tmp As Variant: tmp = arr(a1): arr(a1) = arr(b1): arr(b1) = tmp
                End If
            Next b1
        Next a1
        For j = 2 To UBound(arr)
            Dim dist As Double: dist = arr(j)(1) - arr(j - 1)(1)
            If dist > 0 Then
                Dim cons As Double: cons = arr(j)(2) / dist * 100
                If cons > 0 And cons < 60 Then          ' garde-fou aberrations
                    If mPerDeb > 0 Then If CDbl(arr(j)(0)) < mPerDeb Then GoTo SkipJ
                    If mPerFin > 0 Then If CDbl(arr(j)(0)) > mPerFin Then GoTo SkipJ
                    Dim dk As String: dk = Format(arr(j)(0), "yyyy-mm-dd")
                    Dim ky As String: ky = dk & "|" & CStr(vk)
                    consoSum(ky) = NumDict(consoSum, ky) + cons
                    consoCnt(ky) = NumDict(consoCnt, ky) + 1
                    If Not dateSet.Exists(dk) Then dateSet(dk) = 1
                End If
            End If
SkipJ:
        Next j
        vehOrder(nv) = CStr(vk): nv = nv + 1
    Next vk
    If dateSet.count = 0 Then Exit Function
    ReDim Preserve vehOrder(0 To nv - 1): TriStr vehOrder
    nVehCols = nv

    Dim dates() As String, di As Long: di = 0
    ReDim dates(0 To dateSet.count - 1)
    Dim dkk As Variant
    For Each dkk In dateSet.keys: dates(di) = CStr(dkk): di = di + 1: Next dkk
    TriStr dates

    wsd.Range(wsd.Cells(1, COL0), wsd.Cells(1, COL0 + nVehCols)).ClearContents
    wsd.Cells(1, COL0).value = "Date"
    Dim c As Long
    For c = 0 To nVehCols - 1: wsd.Cells(1, COL0 + 1 + c).value = vehOrder(c): Next c
    Dim r As Long
    For r = 0 To UBound(dates)
        wsd.Cells(r + 2, COL0).value = CDate(dates(r))
        For c = 0 To nVehCols - 1
            Dim pk As String: pk = dates(r) & "|" & vehOrder(c)
            If consoCnt.Exists(pk) Then _
                wsd.Cells(r + 2, COL0 + 1 + c).value = Round(consoSum(pk) / consoCnt(pk), 2)
        Next c
    Next r
    wsd.Columns(COL0).NumberFormat = "dd/mm/yyyy"
    BuildConsoBlock = UBound(dates) + 2
End Function

' ============================================================
'  CREATION DES GRAPHIQUES
' ============================================================
' Graphique generique X/Y a partir d'une plage (1re col = categories)
Private Sub AddChartXY(ws As Worksheet, key As String, src As Range, typ As Long, titre As String, _
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
            Next si
        End If
        On Error GoTo 0
    End With
End Sub

' Tendance budget 6 mois : barres depense + ligne objectif
Private Sub AddBudgetTrendChart(ws As Worksheet, key As String, wsd As Worksheet, rBudg As Long, _
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

' CO2 cumule mensuel vs trajectoire objectif (2 courbes)
Private Sub AddCo2MonthlyChart(ws As Worksheet, key As String, wsd As Worksheet, rMonth As Long, _
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

' Jauge CO2 annuel : barre Realise vs Objectif
Private Sub AddCo2GaugeChart(ws As Worksheet, key As String, wsd As Worksheet, co2Obj As Double, _
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

' X26 : jauge budget annuel ? barres Depense vs Objectif (budget x 12)
Private Sub AddBudgetYearGauge(ws As Worksheet, key As String, wsd As Worksheet, _
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

' ============================================================
'  RENTABILITE DU KIT (3 graphiques restaures de l'ancien classeur)
' ============================================================
' X27 : economie cumulee par plein E85 vs cout du kit (courbe + seuil)
Private Sub AddKitCumulChart(ws As Worksheet, key As String, wsd As Worksheet, rKit As Long, _
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

' X28 : cout au km c{e}/km par plein (barres)
Private Sub AddCoutKmChart(ws As Worksheet, key As String, wsd As Worksheet, rCoutKm As Long, _
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

' X29 : projection de rentabilite du kit (nuage de points + tendance lineaire)
Private Sub AddKitProjChart(ws As Worksheet, key As String, wsd As Worksheet, rKit As Long, _
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

' X9 : economie cumulee E85 vs SP98 au fil du temps (courbe date / montant)
Private Sub AddEcoCumDateChart(ws As Worksheet, key As String, wsd As Worksheet, rEco As Long, _
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

' X15 : scatter prix E85/L vs conso L/100 km (correlation prix/comportement)
Private Sub AddScatterE85Chart(ws As Worksheet, key As String, wsd As Worksheet, rSc As Long, _
                               L As Double, T As Double, w As Double, h As Double)
    Dim co As ChartObject
    Set co = EnsureChart(ws, key, L, T, w, h)
    With co.Chart
        .ChartType = xlXYScatter
        .SetSourceData Source:=wsd.Range("AP1").Resize(rSc, 2), PlotBy:=xlColumns
        .HasTitle = True
        .ChartTitle.text = "Prix E85 (" & ChrW(8364) & "/L) vs Conso (L/100 km)"
        .ChartTitle.Font.Size = 11: .ChartTitle.Font.bold = True
        .HasLegend = False
        On Error Resume Next
        With .SeriesCollection(1)
            .MarkerStyle = xlMarkerStyleCircle
            .MarkerSize = 5
            .Format.fill.ForeColor.RGB = C_E85
            .Format.Line.visible = msoFalse
            ' tendance lineaire : montre la correlation
            Dim tl As Trendline
            Set tl = .Trendlines.Add(Type:=xlLinear, DisplayEquation:=False, DisplayRSquared:=False)
            tl.Format.Line.ForeColor.RGB = C_OBJ
            tl.Format.Line.DashStyle = msoLineDash
        End With
        With .Axes(xlCategory)
            .HasTitle = True
            .AxisTitle.text = "Prix E85 " & ChrW(8364) & "/L"
            .AxisTitle.Font.Size = 9
        End With
        With .Axes(xlValue)
            .HasTitle = True
            .AxisTitle.text = "L/100 km"
            .AxisTitle.Font.Size = 9
        End With
        .ChartArea.Border.LineStyle = xlNone
        On Error GoTo 0
    End With
End Sub

' Cout du kit ethanol : "Suivi Carburant"!B5, repli recherche du libelle, defaut 514,54
Private Function KitCost(wsC As Worksheet) As Double
    Dim v As Double: v = 514.54
    On Error Resume Next
    If IsNumeric(wsC.Range("B5").value) Then
        If wsC.Range("B5").value > 0 Then v = CDbl(wsC.Range("B5").value)
    End If
    ' repli : chercher un libelle "Cout du kit" et lire la cellule a droite
    If v = 514.54 Then
        Dim f As Range
        Set f = wsC.Cells.Find(What:="kit", LookIn:=xlValues, LookAt:=xlPart, MatchCase:=False)
        If Not f Is Nothing Then
            If IsNumeric(f.Offset(0, 1).value) Then
                If f.Offset(0, 1).value > 0 Then v = CDbl(f.Offset(0, 1).value)
            End If
        End If
    End If
    On Error GoTo 0
    KitCost = v
End Function

' ============================================================
'  KPIs (cartes)
' ============================================================
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

' ============================================================
'  PARAMETRES + BOUTON + NETTOYAGE
' ============================================================
Private Sub EnsureParamBlock(ws As Worksheet)
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

' X20 : retourne True si les graphiques auto sont actifs (B7 = "Oui" ou vide)
Public Function GraphAutoActif() As Boolean
    Dim wsG As Worksheet
    Set wsG = SheetByName(WS_GRAPH)
    If wsG Is Nothing Then GraphAutoActif = True: Exit Function
    Dim v As String
    v = UCase$(Trim$(CStr(wsG.Range(CELL_GRAPH_AUTO).value)))
    GraphAutoActif = (v = "OUI" Or v = "")
End Function

' X25 : reutilise un ChartObject par son nom (reposition) ou le cree
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

' X25 : reutilise une Shape par son nom (reposition) ou la cree
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

Private Sub DeleteChartByName(ws As Worksheet, key As String)
    Dim co As ChartObject
    For Each co In ws.ChartObjects
        If co.name = key Then co.Delete: Exit Sub
    Next co
End Sub

' X25 : purge les graphiques/cartes inconnus (anciennes versions), garde
' les objets nommes que l'on reutilise + les boutons + le bandeau.
Private Sub PurgeUnknown(ws As Worksheet)
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

' v4.8 : bandeau-titre du tableau de bord (charte app)
Private Sub EnsureHeaderBand(ws As Worksheet)
    ' hdrBand supprime (doublon visuel avec dash_banner)
    On Error Resume Next
    ws.Shapes("hdrBand").Delete
    On Error GoTo 0
End Sub

' X27..X29 / boutons en VRAIES IMAGES cliquables (PNG dans excel\assets\),
' repli sur une Shape stylee si le fichier image est absent.
' Espaces des parametres (poses a gauche) et decales sous le bandeau.
Private Sub EnsureButtons(ws As Worksheet)
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

' X23 : exporte l'onglet Graphiques en PDF (a cote du classeur, date du jour)
Public Sub ExporterGraphiquesPDF()
    Dim ws As Worksheet, p As String
    On Error GoTo EH
    Set ws = SheetByName(WS_GRAPH)
    If ws Is Nothing Then Err.Raise vbObjectError + 10, , _
        "Onglet '" & WS_GRAPH & "' introuvable. Lancez d'abord CreerGraphiquesWeb."
    p = ThisWorkbook.path
    If p = "" Then p = Environ$("USERPROFILE") & "\Documents"
    p = p & Application.PathSeparator & "Tableau de bord - " & Format(Date, "yyyy-mm-dd") & ".pdf"
    ws.ExportAsFixedFormat Type:=xlTypePDF, fileName:=p, Quality:=xlQualityStandard, _
        IncludeDocProperties:=True, IgnorePrintAreas:=False, OpenAfterPublish:=True
    SetStatusG "Graphiques : PDF exporte -> " & p
    Exit Sub
EH:
    SetStatusG "Graphiques : ERREUR export PDF " & Err.Number & " - " & Err.Description
    MsgBox "Erreur export PDF " & Err.Number & " : " & Err.Description, vbCritical, "modGraphiques"
End Sub

' ============================================================
'  HELPERS
' ============================================================
Private Function EnsureDataSheet() As Worksheet
    Dim ws As Worksheet
    Set ws = SheetByName(WS_DATA)
    If ws Is Nothing Then
        Set ws = ThisWorkbook.Worksheets.Add(After:=ThisWorkbook.Sheets(ThisWorkbook.Sheets.count))
        ws.name = WS_DATA
    End If
    ws.visible = xlSheetVeryHidden
    Set EnsureDataSheet = ws
End Function

Private Function SheetByName(nm As String) As Worksheet
    On Error Resume Next
    Set SheetByName = ThisWorkbook.Worksheets(nm)
    On Error GoTo 0
End Function

' ============================================================
'  X30/X35 ? BuildPriceBlockMerged
'  Fusionne DEUX sources de prix :
'    1. Tableau2 (pleins saisis) ? historique long, tous carburants
'    2. PrixHistory (table Power Query, marche quotidien) ? si dispo
'  Pour chaque jour+carburant : prix minimum des deux sources.
'  Carburants detectes dynamiquement ; colonnes G: Date, H:...: carburants.
'  Retourne le nb de lignes ecrites (en-tete inclus).
'  nCols recoit le nb de colonnes carburant (sans Date).
' ============================================================
Private Function BuildPriceBlockMerged(wsd As Worksheet, t2 As ListObject, _
                                       ByRef nCols As Long, _
                                       Optional ByVal selFuels As String = "") As Long
    BuildPriceBlockMerged = 1
    nCols = 0
    Dim filtF As Boolean: filtF = (Len(selFuels) > 0 And selFuels <> FILTER_ALL)
    Dim wantSet As Object: Set wantSet = CreateObject("Scripting.Dictionary")
    If filtF Then
        Dim wp() As String: wp = Split(selFuels, ",")
        Dim wi As Long
        For wi = 0 To UBound(wp)
            Dim wkf As String: wkf = FuelKey(Trim$(wp(wi)))
            If Len(wkf) > 0 Then wantSet(wkf) = True
        Next wi
        If wantSet.count = 0 Then filtF = False
    End If

    Dim prixSum  As Object: Set prixSum = CreateObject("Scripting.Dictionary")
    Dim prixCnt  As Object: Set prixCnt = CreateObject("Scripting.Dictionary")
    Dim ordDates As Object: Set ordDates = CreateObject("Scripting.Dictionary")
    Dim fuelSet  As Object: Set fuelSet = CreateObject("Scripting.Dictionary")

    ' X37/X39 : si filtre -> uniquement carburants coches ; sinon cibles par defaut
    If filtF Then
        Dim wsk As Variant
        For Each wsk In wantSet.keys: fuelSet(CStr(wsk)) = True: Next wsk
    Else
        Dim tf As Variant
        For Each tf In Array("E85", "SP98", "SP95", "GAZOLE")
            fuelSet(CStr(tf)) = True
        Next tf
    End If

    ' === SOURCE 1 : Tableau2 (pleins) ===
    If Not t2 Is Nothing Then
        If Not t2.DataBodyRange Is Nothing Then
            Dim ciD2 As Long: ciD2 = LCIdx(t2, "Date")
            Dim ciT2 As Long: ciT2 = LCIdx(t2, "Type")
            Dim ciP2 As Long: ciP2 = LCIdx(t2, "Prix " & ChrW(8364) & "/L")
            ' X38 : prix SP98 du marche (enregistre par GAS a chaque plein, meme E85)
            Dim ciP98J As Long: ciP98J = LCIdx(t2, "Prix S98 jour (" & ChrW(8364) & "/L)")
            If ciD2 > 0 And ciT2 > 0 And ciP2 > 0 Then
                Dim a2 As Variant: a2 = t2.DataBodyRange.value
                Dim i2 As Long
                For i2 = 1 To UBound(a2, 1)
                    If IsDate(a2(i2, ciD2)) Then
                        Dim dk2 As String: dk2 = Format(CDate(a2(i2, ciD2)), "yyyy-mm-dd")
                        If mPerDeb > 0 Then If CDbl(CDate(a2(i2, ciD2))) < mPerDeb Then GoTo NextP2
                        If mPerFin > 0 Then If CDbl(CDate(a2(i2, ciD2))) > mPerFin Then GoTo NextP2
                        Dim fk2 As String: fk2 = FuelKey(CStr(a2(i2, ciT2)))
                        Dim p2 As Double: p2 = NumOr0(a2(i2, ciP2))
                        ' X38 : ajoute SP98 marche avant le filtrage ? couvre TOUS les
                        ' jours de plein (meme les pleins E85 qui ont toujours SP98 renseigne).
                        If ciP98J > 0 Then
                            Dim wantSP98T2 As Boolean
                            wantSP98T2 = (Not filtF And fuelSet.Exists("SP98")) Or _
                                         (filtF And wantSet.Exists("SP98"))
                            If wantSP98T2 Then
                                Dim p98J As Double: p98J = NumOr0(a2(i2, ciP98J))
                                If p98J > 0 Then
                                    AddToSum prixSum, prixCnt, dk2 & "|SP98", p98J
                                    If Not ordDates.Exists(dk2) Then ordDates(dk2) = 1
                                End If
                            End If
                        End If
                        If filtF Then If Not wantSet.Exists(fk2) Then GoTo NextP2
                        If Len(fk2) > 0 And p2 > 0 Then
                            AddToSum prixSum, prixCnt, dk2 & "|" & fk2, p2
                            If Not ordDates.Exists(dk2) Then ordDates(dk2) = 1
                            If Not fuelSet.Exists(fk2) Then fuelSet(fk2) = True
                        End If
                    End If
NextP2:
                Next i2
            End If
        End If
    End If

    ' === SOURCE 2 : PrixHistory ? colonnes croisees par carburant ===
    ' X38 : la table PrixHistory stocke les prix de TOUS les carburants a la
    ' station au moment du plein (colonnes "E85 station", "SP98 station",
    ' "SP95 station", "Gazole station", etc.). On les lit directement ici
    ' au lieu de chercher une colonne "Type"+"Prix" inexistante (nom reel : PrixL).
    Dim lo As ListObject: Set lo = FindListObject(PH_TABLE)
    If Not lo Is Nothing Then
        If Not lo.DataBodyRange Is Nothing Then
            ' X39 (fix) : PrixHistory (PQ, miroir de _PrixHistory) est en format
            ' LONG -> Station | Date | Type | Prix. L'ancienne lecture cherchait
            ' des colonnes LARGES "E85 station"/... INEXISTANTES ici -> SOURCE 2
            ' n'ecrivait rien (gPrice ne tracait que les pleins, d'ou SP95/GAZOLE
            ' quasi vides). On lit Date/Type/Prix et on agrege par jour+carburant
            ' (moyenne) -> le releve marche quotidien (6 carburants) alimente gPrice.
            Dim ciDH As Long: ciDH = LCIdx(lo, "Date")
            Dim ciTH As Long: ciTH = LCIdx(lo, "Type")
            Dim ciPH As Long: ciPH = LCIdx(lo, "Prix")
            If ciDH > 0 And ciTH > 0 And ciPH > 0 Then
                Dim aH As Variant: aH = lo.DataBodyRange.value
                Dim iH As Long
                For iH = 1 To UBound(aH, 1)
                    If IsDate(aH(iH, ciDH)) Then
                        Dim dkH As String: dkH = Format(CDate(aH(iH, ciDH)), "yyyy-mm-dd")
                        If mPerDeb > 0 Then If CDbl(CDate(aH(iH, ciDH))) < mPerDeb Then GoTo NextH
                        If mPerFin > 0 Then If CDbl(CDate(aH(iH, ciDH))) > mPerFin Then GoTo NextH
                        Dim fkH As String: fkH = FuelKey(CStr(aH(iH, ciTH)))
                        If Len(fkH) > 0 Then
                            Dim wantFuelH As Boolean
                            If filtF Then
                                wantFuelH = wantSet.Exists(fkH)
                            Else
                                wantFuelH = fuelSet.Exists(fkH)
                            End If
                            If wantFuelH Then
                                Dim pH As Double: pH = NumOr0(aH(iH, ciPH))
                                If pH > 0 Then
                                    AddToSum prixSum, prixCnt, dkH & "|" & fkH, pH
                                    If Not ordDates.Exists(dkH) Then ordDates(dkH) = 1
                                End If
                            End If
                        End If
                    End If
NextH:
                Next iH
            End If
        End If
    End If

    If ordDates.count = 0 Then Exit Function

    ' === Tri chronologique des dates ===
    Dim dates() As String, dIdx As Long: dIdx = 0
    ReDim dates(0 To ordDates.count - 1)
    Dim kk As Variant
    For Each kk In ordDates.keys: dates(dIdx) = CStr(kk): dIdx = dIdx + 1: Next kk
    TriStr dates

    ' === Ordre prefere des carburants ===
    Dim prefOrder As Variant
    prefOrder = Array("E85", "SP98", "GAZOLE", "SP95", "E10", "GPLc")
    Dim fuels() As String, fIdx As Long: fIdx = 0
    ReDim fuels(0 To fuelSet.count - 1)
    Dim seen As Object: Set seen = CreateObject("Scripting.Dictionary")
    Dim fo As Variant
    For Each fo In prefOrder
        If fuelSet.Exists(CStr(fo)) Then
            fuels(fIdx) = CStr(fo): fIdx = fIdx + 1
            seen(CStr(fo)) = True
        End If
    Next fo
    Dim fkR As Variant
    For Each fkR In fuelSet.keys
        If Not seen.Exists(CStr(fkR)) Then
            fuels(fIdx) = CStr(fkR): fIdx = fIdx + 1
        End If
    Next fkR
    If fIdx = 0 Then Exit Function
    ReDim Preserve fuels(0 To fIdx - 1)
    nCols = fIdx

    ' === En-tete dynamique G1: Date + carburants ===
    wsd.Range(wsd.Cells(1, 7), wsd.Cells(1, 7 + nCols)).ClearContents
    wsd.Cells(1, 7).value = "Date"
    Dim c As Long
    For c = 0 To nCols - 1: wsd.Cells(1, 8 + c).value = fuels(c): Next c

    ' === Lignes de donnees ===
    wsd.Range(wsd.Cells(2, 7), wsd.Cells(wsd.rows.count, 7 + nCols)).ClearContents
    Dim r As Long
    For r = 0 To UBound(dates)
        Dim dk3 As String: dk3 = dates(r)
        wsd.Cells(r + 2, 7).value = CDate(dk3)
        For c = 0 To nCols - 1
            Dim pkey As String: pkey = dk3 & "|" & fuels(c)
            If prixCnt.Exists(pkey) Then wsd.Cells(r + 2, 8 + c).value = Round(prixSum(pkey) / prixCnt(pkey), 3)
        Next c
    Next r

    wsd.Columns(7).NumberFormat = "dd/mm/yyyy"
    BuildPriceBlockMerged = UBound(dates) + 2
End Function

' Cherche un ListObject par nom sur toutes les feuilles du classeur.
Private Function FindListObject(nm As String) As ListObject
    Dim ws As Worksheet, lo As ListObject
    For Each ws In ThisWorkbook.Worksheets
        For Each lo In ws.ListObjects
            If LCase$(Trim$(lo.name)) = LCase$(Trim$(nm)) Then
                Set FindListObject = lo
                Exit Function
            End If
        Next lo
    Next ws
    Set FindListObject = Nothing
End Function

' X37 : Accumule somme et compte pour calcul de prix moyen journalier.
Private Sub AddToSum(dSum As Object, dCnt As Object, k As String, v As Double)
    If Not dSum.Exists(k) Then
        dSum(k) = v
        dCnt(k) = 1
    Else
        dSum(k) = dSum(k) + v
        dCnt(k) = dCnt(k) + 1
    End If
End Sub

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

Private Function FuelKey(T As String) As String
    Dim u As String: u = UCase$(Trim$(T))
    If InStr(u, "E85") > 0 Or InStr(u, "ETHANOL") > 0 Then
        FuelKey = "E85"
    ElseIf InStr(u, "GAZOLE") > 0 Or InStr(u, "DIESEL") > 0 Or InStr(u, "GASOIL") > 0 Then
        FuelKey = "GAZOLE"
    ElseIf InStr(u, "SP98") > 0 Or InStr(u, "S98") > 0 Or _
           (InStr(u, "SUPER") > 0 And InStr(u, "98") > 0) Then
        FuelKey = "SP98"
    ElseIf InStr(u, "SP95") > 0 Or InStr(u, "S95") > 0 Then
        FuelKey = "SP95"
    ElseIf InStr(u, "E10") > 0 Then
        FuelKey = "E10"
    ElseIf InStr(u, "GPL") > 0 Then
        FuelKey = "GPLc"      ' W61 : coherent avec _PrixHistory / modPrixStation
    ElseIf Len(u) > 0 Then
        FuelKey = u      ' conserve le libelle brut (ex : "HVO", "GNV"?)
    End If
End Function

Private Function TopKey(d As Object) As String
    Dim best As String, bestN As Double, kv As Variant
    bestN = -1
    For Each kv In d.keys
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
    Debug.Print Format(now, "hh:mm:ss") & "  " & msg
End Sub








