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
' X36 : sentinelle ? tous ? des s?lecteurs v?hicule/carburant (= modDashboardKPI.KPI_TOUS).

' -- Constantes CO2 (alignees sur js/config.js) --

' -- Cellules de parametres sur l'onglet Graphiques --

' -- Couleurs ? alignees sur la charte de l'app web (css/style.css) --
'    valeur Long = RGB(r,g,b) = r + g*256 + b*65536

' -- Mise en page (v4.8) --

' -- T1c (X39) : filtre Periode -> TOUTES les series datees --
'    Les bornes mPerDeb/mPerFin (etat module partage) sont declarees Public
'    dans modGraphCfg (X44 P3) car lues par modGraphData (agregats).

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

' ============================================================
'  AGREGATS  -> _GraphData
' ============================================================

' Comparaison par vehicule depuis GS_Pleins (km = max-min compteur)

' X39 : appartenance d'une valeur a une liste CSV (insensible casse ; "" / "(tous)" = vrai).

' X39 : conso L/100km par vehicule (serie temporelle) depuis GS_Pleins.
'  conso d'un plein = Litres / (Km - Km_precedent_du_meme_vehicule) * 100.
'  Tableau croise Date (col 55=BC) x Vehicule (BD..). selVeh CSV ("" / "(tous)" = tous).
'  Retour = nb lignes (>=1) ; nVehCols = nb de colonnes vehicule.

' ============================================================
'  CREATION DES GRAPHIQUES
' ============================================================
' Graphique generique X/Y a partir d'une plage (1re col = categories)

' Tendance budget 6 mois : barres depense + ligne objectif

' CO2 cumule mensuel vs trajectoire objectif (2 courbes)

' Jauge CO2 annuel : barre Realise vs Objectif

' X26 : jauge budget annuel ? barres Depense vs Objectif (budget x 12)

' ============================================================
'  RENTABILITE DU KIT (3 graphiques restaures de l'ancien classeur)
' ============================================================
' X27 : economie cumulee par plein E85 vs cout du kit (courbe + seuil)

' X28 : cout au km c{e}/km par plein (barres)

' X29 : projection de rentabilite du kit (nuage de points + tendance lineaire)

' X9 : economie cumulee E85 vs SP98 au fil du temps (courbe date / montant)

' X15 : scatter prix E85/L vs conso L/100 km (correlation prix/comportement)
' X15 : conso E85 (barres vertes) + prix E85 (courbe ambre, axe secondaire) par
' plein dans le temps. Combine lisible remplacant l'ancien nuage de points.

' Cout du kit ethanol : "Suivi Carburant"!B6 (libelle "Cout du kit ethanol" en A6), defaut 514,54.
' (B5 etait lu a tort - cellule vide sous le titre PARAMETRES ; la feuille calcule avec B6.)

' ============================================================
'  KPIs (cartes)
' ============================================================


' ============================================================
'  PARAMETRES + BOUTON + NETTOYAGE
' ============================================================

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

' X25 : reutilise une Shape par son nom (reposition) ou la cree


' X25 : purge les graphiques/cartes inconnus (anciennes versions), garde
' les objets nommes que l'on reutilise + les boutons + le bandeau.

' v4.8 : bandeau-titre du tableau de bord (charte app)

' X27..X29 / boutons en VRAIES IMAGES cliquables (PNG dans excel\assets\),
' repli sur une Shape stylee si le fichier image est absent.
' Espaces des parametres (poses a gauche) et decales sous le bandeau.


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

' Cherche un ListObject par nom sur toutes les feuilles du classeur.

' X37 : Accumule somme et compte pour calcul de prix moyen journalier.







Private Sub SetStatusG(msg As String)
    Application.StatusBar = "[Graphiques] " & msg
    Debug.Print Format(now, "hh:mm:ss") & "  " & msg
End Sub








