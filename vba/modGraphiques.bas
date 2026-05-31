Attribute VB_Name = "modGraphiques"
' ============================================================
'  SUIVI CONSO CARBURANTS — Graphiques du tableau de bord     v4.9.0.1
'
'  v4.8.0.0 (X27/X28/X29) :
'    • Charte graphique alignee sur l'app web (vert #1D9E75, bleu fonce
'      #1B3A5C, bleu #2E75B6, ambre #F0A500, rouge #E24B4A).
'    • Mise en page "Dashboard" : bandeau-titre, bloc parametres espace
'      des boutons, graphiques decales vers le bas (topBase plus grand).
'    • Boutons "Recreer" / "Exporter PDF" en VRAIES IMAGES cliquables
'      (PNG dans excel\assets\, repli Shape stylee si fichier absent).
'    • 3 graphiques "Rentabilite du kit" restaures depuis l'ancien
'      classeur : economie cumulee vs cout du kit (courbe + seuil),
'      cout au km c{e}/km par plein (barres), projection de rentabilite
'      (nuage de points + tendance lineaire). Donnees lues dans Tableau2
'      (colonnes deja calculees) ; cout du kit = "Suivi Carburant"!B5.
'    • Rafraichissement a l'ouverture de l'onglet (Worksheet_Activate,
'      voir vba\Graphiques_snippet.bas).
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
'    • B4 = Annee du bilan (X24)  — vide = annee la plus recente
'    • Surconso E85 : cellule J7 de "Suivi Carburant" (1+J7), defaut 0.20
'
'  X22 (v4.6.0.0) : l'appel auto (modSyncGS) ne se declenche que si
'    l'onglet "Graphiques" existe deja (pas de creation surprise).
'  X23 : bouton "Exporter en PDF" -> ExporterGraphiquesPDF.
'  X25 : rafraichissement incremental — les ChartObjects et cartes KPI
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
Private Const CELL_ANNEE  As String = "B4"   ' X24 : annee bilan (vide = recente)

' ── Couleurs — alignees sur la charte de l'app web (css/style.css) ──
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

' ── Mise en page (v4.8) ──
Private Const TOP_BASE As Double = 150     ' decalage vertical des graphiques (bandeau + params)
Private Const CHART_W  As Double = 460
Private Const CHART_H  As Double = 250

' ============================================================
'  POINT D'ENTREE
' ============================================================
Public Sub CreerGraphiquesWeb(Optional silent As Boolean = False)
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

    ' -- Bloc parametres + lecture budget / objectif CO2 / annee (X24) --
    EnsureParamBlock wsG
    Dim budget As Double, co2Obj As Double, anneeSel As Long
    budget = 0
    If IsNumeric(wsG.Range(CELL_BUDGET).Value) Then budget = CDbl(wsG.Range(CELL_BUDGET).Value)
    co2Obj = DEFAULT_CO2_OBJ
    If IsNumeric(wsG.Range(CELL_CO2OBJ).Value) Then
        If wsG.Range(CELL_CO2OBJ).Value > 0 Then co2Obj = CDbl(wsG.Range(CELL_CO2OBJ).Value)
    End If
    anneeSel = 0   ' 0 = automatique (annee la plus recente)
    If IsNumeric(wsG.Range(CELL_ANNEE).Value) Then
        If wsG.Range(CELL_ANNEE).Value >= 2000 Then anneeSel = CLng(wsG.Range(CELL_ANNEE).Value)
    End If

    ' -- Feuille de donnees technique --
    Set wsD = EnsureDataSheet()

    ' -- Cout du kit ethanol (Suivi Carburant!B5, repli recherche libelle) --
    Dim coutKit As Double
    coutKit = KitCost(wsC)

    ' -- Calcul des agregats -> _GraphData --
    SetStatusG "Graphiques : calcul des agregats..."
    Dim rMonth As Long, rPrice As Long, rConso As Long, rVeh As Long, rBudg As Long
    Dim rKit As Long, rCoutKm As Long, rPriceCols As Long
    BuildAggregates t2, gsT, wsD, surconso, co2Obj, budget, anneeSel, coutKit, _
                    rMonth, rPrice, rConso, rVeh, rBudg, rKit, rCoutKm, rPriceCols

    ' -- Bandeau-titre (dashboard) --
    EnsureHeaderBand wsG

    ' -- Creation / rafraichissement incremental des graphiques (X25) --
    SetStatusG "Graphiques : creation..."
    Dim L1 As Double, L2 As Double, w As Double, h As Double, topBase As Double
    Dim stepY As Double
    w = CHART_W: h = CHART_H: topBase = TOP_BASE
    stepY = h + 24
    L1 = 10: L2 = L1 + w + 24

    ' ── Colonne gauche ──
    If rPrice > 1 And rPriceCols > 0 Then
        AddChartXY wsG, "gPrice", wsD.Range("G1").Resize(rPrice, 1 + rPriceCols), xlLine, _
            "Evolution du prix par carburant (" & ChrW(8364) & "/L)", L1, topBase, w, h, True
    Else
        DeleteChartByName wsG, "gPrice"
    End If
    If rMonth > 1 Then
        AddChartXY wsG, "gCost", wsD.Range("A1").Resize(rMonth, 2), xlColumnClustered, _
            "Cout mensuel du carburant (" & ChrW(8364) & ")", L1, topBase + stepY, w, h, False
    Else
        DeleteChartByName wsG, "gCost"
    End If
    If rConso > 1 Then
        AddChartXY wsG, "gConso", wsD.Range("L1").Resize(rConso, 2), xlLine, _
            "Consommation (L/100 km)", L1, topBase + 2 * stepY, w, h, True
    Else
        DeleteChartByName wsG, "gConso"
    End If
    If rVeh > 1 Then
        AddChartXY wsG, "gVeh", wsD.Range("O1").Resize(rVeh, 3), xlBarClustered, _
            "Comparaison vehicules (conso & cout /100 km)", L1, topBase + 3 * stepY, w, h, False
    Else
        DeleteChartByName wsG, "gVeh"
    End If
    ' X26 : jauge budget annuel (si budget mensuel renseigne)
    If budget > 0 Then
        AddBudgetYearGauge wsG, "gBudgetYear", wsD, L1, topBase + 4 * stepY, w, h
    Else
        DeleteChartByName wsG, "gBudgetYear"
    End If
    ' X27 : rentabilite kit — economie cumulee vs cout du kit (courbe + seuil)
    If rKit > 1 Then
        AddKitCumulChart wsG, "gKitCumul", wsD, rKit, L1, topBase + 5 * stepY, w, h
    Else
        DeleteChartByName wsG, "gKitCumul"
    End If

    ' ── Colonne droite ──
    If rBudg > 1 Then
        AddBudgetTrendChart wsG, "gBudget", wsD, rBudg, L2, topBase, w, h
    Else
        DeleteChartByName wsG, "gBudget"
    End If
    If rMonth > 1 Then
        AddCo2MonthlyChart wsG, "gCo2", wsD, rMonth, L2, topBase + stepY, w, h
    Else
        DeleteChartByName wsG, "gCo2"
    End If
    AddCo2GaugeChart wsG, "gGauge", wsD, co2Obj, L2, topBase + 2 * stepY, w, h
    BuildKPICards wsG, wsD, L2, topBase + 3 * stepY
    ' X28 : cout au km c{e}/km par plein (barres)
    If rCoutKm > 1 Then
        AddCoutKmChart wsG, "gCoutKm", wsD, rCoutKm, L2, topBase + 4 * stepY, w, h
    Else
        DeleteChartByName wsG, "gCoutKm"
    End If
    ' X29 : projection de rentabilite du kit (nuage de points + tendance)
    If rKit > 1 Then
        AddKitProjChart wsG, "gKitProj", wsD, rKit, L2, topBase + 5 * stepY, w, h
    Else
        DeleteChartByName wsG, "gKitProj"
    End If

    ' -- Purge des objets inconnus (anciennes versions) + boutons --
    PurgeUnknown wsG
    EnsureButtons wsG

    Application.Calculation = xlCalculationAutomatic
    Application.ScreenUpdating = True
    SetStatusG "Graphiques : " & ChrW(10003) & " recrees (" & Format(Now, "hh:mm:ss") & ")."
    Exit Sub
EH:
    Application.Calculation = xlCalculationAutomatic
    Application.ScreenUpdating = True
    SetStatusG "Graphiques : ERREUR " & Err.Number & " - " & Err.Description
    If Not silent Then _
        MsgBox "Erreur " & Err.Number & " : " & Err.Description, vbCritical, "modGraphiques"
End Sub

' ============================================================
'  AGREGATS  -> _GraphData
' ============================================================
Private Sub BuildAggregates(t2 As ListObject, gsT As ListObject, wsD As Worksheet, _
                            surconso As Double, co2Obj As Double, budget As Double, _
                            anneeSel As Long, coutKit As Double, _
                            ByRef rMonth As Long, ByRef rPrice As Long, _
                            ByRef rConso As Long, ByRef rVeh As Long, ByRef rBudg As Long, _
                            ByRef rKit As Long, ByRef rCoutKm As Long, ByRef rPriceCols As Long)

    wsD.Cells.Clear

    ' En-tetes des blocs
    Dim eu As String: eu = ChrW(8364)
    wsD.Range("A1:E1").Value = Array("Mois", "Cout (" & eu & ")", "CO2 evite (kg)", "CO2 cumule (kg)", "Objectif cumule (kg)")
    ' G1:... : en-tete prix ecrit dynamiquement par BuildPriceBlockMerged
    wsD.Range("L1:M1").Value = Array("Date", "L/100 km")
    wsD.Range("O1:Q1").Value = Array("Vehicule", "Conso L/100km", "Cout " & eu & "/100km")
    wsD.Range("S1:U1").Value = Array("Mois", "Depense (" & eu & ")", "Objectif (" & eu & ")")
    wsD.Range("W1:X1").Value = Array("Indicateur", "Valeur")
    ' X27/X29 : rentabilite kit (AF=N plein, AG=eco cumulee, AH=cout kit seuil)
    wsD.Range("AF1:AH1").Value = Array("Plein n", "Economie cumulee (" & eu & ")", "Cout du kit (" & eu & ")")
    ' X28 : cout au km par plein (AJ=N plein, AK=cout c{e}/km)
    wsD.Range("AJ1:AK1").Value = Array("Plein n", "Cout c" & eu & "/km")

    rMonth = 1: rPrice = 1: rConso = 1: rVeh = 1: rBudg = 1: rKit = 1: rCoutKm = 1

    ' ---- Lecture Tableau2 ----
    If t2.DataBodyRange Is Nothing Then Exit Sub
    Dim a As Variant: a = t2.DataBodyRange.Value
    Dim ciDate As Long, ciType As Long, ciKm As Long, ciNbKm As Long
    Dim ciLitres As Long, ciPrix As Long, ciCout As Long, ciConso As Long, ciStation As Long
    Dim ciNum As Long, ciCkm As Long, ciEcoCum As Long
    ciDate = LCIdx(t2, "Date")
    ciType = LCIdx(t2, "Type")
    ciKm = LCIdx(t2, "Km compteur")
    ciNbKm = LCIdx(t2, "Nb. km")
    ciLitres = LCIdx(t2, "Nb. Litres")
    ciPrix = LCIdx(t2, "Prix " & ChrW(8364) & "/L")
    ciCout = LCIdx(t2, "Co" & ChrW(251) & "t Plein (" & ChrW(8364) & ")")  ' "Coût Plein (€)"
    ciConso = LCIdx(t2, "Conso. (L/100km)")
    ciStation = LCIdx(t2, "Station essence")
    ciNum = LCIdx(t2, "N" & ChrW(176))                                       ' "N°"
    ciCkm = LCIdx(t2, "Co" & ChrW(251) & "t c" & ChrW(8364) & "/km")          ' "Coût c€/km"
    ciEcoCum = LCIdx(t2, ChrW(201) & "conomie cumul" & ChrW(233) & "e (" & ChrW(8364) & ")") ' "Économie cumulée (€)"

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
    Dim rCo As Long: rCo = 1 ' lignes ecrites bloc conso
    Dim rK As Long: rK = 1   ' lignes ecrites bloc rentabilite kit (AF/AG/AH)
    Dim rCk As Long: rCk = 1 ' lignes ecrites bloc cout/km par plein (AJ/AK)

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

        ' -- conso (X = Date) --
        If conso > 0 Then
            rCo = rCo + 1
            wsD.Cells(rCo, 12).Value = d
            wsD.Cells(rCo, 13).Value = conso
        End If

        ' -- rentabilite kit : economie cumulee par plein E85 (AF/AG/AH) --
        If ciNum > 0 And ciEcoCum > 0 Then
            If IsNumeric(a(i, ciNum)) And IsNumeric(a(i, ciEcoCum)) Then
                rK = rK + 1
                wsD.Cells(rK, 32).Value = CDbl(a(i, ciNum))      ' AF
                wsD.Cells(rK, 33).Value = NumOr0(a(i, ciEcoCum)) ' AG
                wsD.Cells(rK, 34).Value = coutKit                ' AH (seuil constant)
            End If
        End If

        ' -- cout au km c{e}/km par plein (AJ/AK) --
        If ciNum > 0 And ciCkm > 0 Then
            If IsNumeric(a(i, ciNum)) And IsNumeric(a(i, ciCkm)) Then
                If NumOr0(a(i, ciCkm)) > 0 Then
                    rCk = rCk + 1
                    wsD.Cells(rCk, 36).Value = CDbl(a(i, ciNum))  ' AJ
                    wsD.Cells(rCk, 37).Value = NumOr0(a(i, ciCkm)) ' AK
                End If
            End If
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
    rPrice = BuildPriceBlockMerged(wsD, t2, rPriceCols)
    rConso = rCo
    rKit = rK
    rCoutKm = rCk

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

    ' ---- KPIs (annee cible) ----
    Dim topSt As String: topSt = TopKey(stationCnt)
    wsD.Range("W2").Value = "Annee": wsD.Range("X2").Value = anneeCible
    wsD.Range("W3").Value = "Pleins": wsD.Range("X3").Value = nbAnnee
    wsD.Range("W4").Value = "Litres": wsD.Range("X4").Value = Round(litresAnnee, 1)
    wsD.Range("W5").Value = ChrW(8364) & " depenses": wsD.Range("X5").Value = Round(coutAnnee, 0)
    wsD.Range("W6").Value = "Km parcourus": wsD.Range("X6").Value = Round(kmAnnee, 0)
    wsD.Range("W7").Value = "Station preferee": wsD.Range("X7").Value = topSt

    ' ---- X26 : jauge budget annuel (depense annee cible vs budget x 12) ----
    wsD.Range("AC1").Value = "Budget " & anneeCible: wsD.Range("AD1").Value = eu
    wsD.Range("AC2").Value = "Depense": wsD.Range("AD2").Value = Round(coutAnnee, 0)
    wsD.Range("AC3").Value = "Objectif": wsD.Range("AD3").Value = Round(budget * 12, 0)

    ' Format colonne Date conso (col G est formatee dans BuildPriceBlockMerged)
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
Private Sub AddChartXY(ws As Worksheet, key As String, src As Range, typ As Long, titre As String, _
                       L As Double, t As Double, w As Double, h As Double, _
                       smooth As Boolean)
    Dim co As ChartObject
    Set co = EnsureChart(ws, key, L, t, w, h)
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
Private Sub AddBudgetTrendChart(ws As Worksheet, key As String, wsD As Worksheet, rBudg As Long, _
                                L As Double, t As Double, w As Double, h As Double)
    Dim co As ChartObject
    Set co = EnsureChart(ws, key, L, t, w, h)
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
Private Sub AddCo2MonthlyChart(ws As Worksheet, key As String, wsD As Worksheet, rMonth As Long, _
                               L As Double, t As Double, w As Double, h As Double)
    Dim co As ChartObject
    Set co = EnsureChart(ws, key, L, t, w, h)
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
Private Sub AddCo2GaugeChart(ws As Worksheet, key As String, wsD As Worksheet, co2Obj As Double, _
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
    Set co = EnsureChart(ws, key, L, t, w, h)
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

' X26 : jauge budget annuel — barres Depense vs Objectif (budget x 12)
Private Sub AddBudgetYearGauge(ws As Worksheet, key As String, wsD As Worksheet, _
                              L As Double, t As Double, w As Double, h As Double)
    Dim co As ChartObject
    Set co = EnsureChart(ws, key, L, t, w, h)
    With co.Chart
        .ChartType = xlBarClustered
        .SetSourceData Source:=wsD.Range("AC1:AD3"), PlotBy:=xlColumns
        .HasTitle = True
        .ChartTitle.Text = "Budget annuel (" & ChrW(8364) & " depenses vs objectif)"
        .ChartTitle.Font.Size = 11: .ChartTitle.Font.Bold = True
        On Error Resume Next
        Dim depense As Double, objectif As Double
        depense = NumOr0(wsD.Range("AD2").Value)
        objectif = NumOr0(wsD.Range("AD3").Value)
        ' Depense : rouge si depassement, vert sinon ; objectif en orange
        If objectif > 0 And depense > objectif Then
            .SeriesCollection(1).Points(1).Format.Fill.ForeColor.RGB = RGB(200, 50, 50)
        Else
            .SeriesCollection(1).Points(1).Format.Fill.ForeColor.RGB = C_E85
        End If
        .SeriesCollection(1).Points(2).Format.Fill.ForeColor.RGB = C_OBJ
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
Private Sub AddKitCumulChart(ws As Worksheet, key As String, wsD As Worksheet, rKit As Long, _
                             L As Double, t As Double, w As Double, h As Double)
    Dim co As ChartObject
    Set co = EnsureChart(ws, key, L, t, w, h)
    With co.Chart
        .ChartType = xlLine
        ' AF (plein) + AG (eco cumulee) + AH (cout kit)
        .SetSourceData Source:=wsD.Range("AF1").Resize(rKit, 3), PlotBy:=xlColumns
        .HasTitle = True
        .ChartTitle.Text = "Rentabilite du kit : economie cumulee vs cout"
        .ChartTitle.Font.Size = 11: .ChartTitle.Font.bold = True
        On Error Resume Next
        ' serie 1 = eco cumulee (vert), serie 2 = cout kit (seuil ambre pointille)
        .SeriesCollection(1).Format.Line.ForeColor.RGB = C_E85
        .SeriesCollection(1).Format.Line.Weight = 2.25
        If .SeriesCollection.Count >= 2 Then
            .SeriesCollection(2).Format.Line.ForeColor.RGB = C_OBJ
            .SeriesCollection(2).Format.Line.DashStyle = msoLineDash
        End If
        .HasLegend = True: .Legend.Position = xlLegendPositionBottom
        .ChartArea.Border.LineStyle = xlNone
        On Error GoTo 0
    End With
End Sub

' X28 : cout au km c{e}/km par plein (barres)
Private Sub AddCoutKmChart(ws As Worksheet, key As String, wsD As Worksheet, rCoutKm As Long, _
                           L As Double, t As Double, w As Double, h As Double)
    Dim co As ChartObject
    Set co = EnsureChart(ws, key, L, t, w, h)
    With co.Chart
        .ChartType = xlColumnClustered
        .SetSourceData Source:=wsD.Range("AJ1").Resize(rCoutKm, 2), PlotBy:=xlColumns
        .HasTitle = True
        .ChartTitle.Text = "Cout au km (c" & ChrW(8364) & "/km) par plein"
        .ChartTitle.Font.Size = 11: .ChartTitle.Font.bold = True
        On Error Resume Next
        .SeriesCollection(1).Format.Fill.ForeColor.RGB = C_SP98
        .HasLegend = False
        .ChartArea.Border.LineStyle = xlNone
        On Error GoTo 0
    End With
End Sub

' X29 : projection de rentabilite du kit (nuage de points + tendance lineaire)
Private Sub AddKitProjChart(ws As Worksheet, key As String, wsD As Worksheet, rKit As Long, _
                            L As Double, t As Double, w As Double, h As Double)
    Dim co As ChartObject
    Set co = EnsureChart(ws, key, L, t, w, h)
    With co.Chart
        .ChartType = xlXYScatter
        ' X = plein (AF), Y = eco cumulee (AG)
        .SetSourceData Source:=wsD.Range("AF1").Resize(rKit, 2), PlotBy:=xlColumns
        .HasTitle = True
        .ChartTitle.Text = "Projection de rentabilite du kit (avec tendance)"
        .ChartTitle.Font.Size = 11: .ChartTitle.Font.bold = True
        On Error Resume Next
        ' garder seulement la serie eco cumulee (col AG) en points
        Do While .SeriesCollection.Count > 1
            .SeriesCollection(2).Delete
        Loop
        With .SeriesCollection(1)
            .MarkerStyle = xlMarkerStyleCircle
            .MarkerSize = 5
            .Format.Fill.ForeColor.RGB = C_E85
            .Format.Line.Visible = msoFalse
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

' Cout du kit ethanol : "Suivi Carburant"!B5, repli recherche du libelle, defaut 514,54
Private Function KitCost(wsC As Worksheet) As Double
    Dim v As Double: v = 514.54
    On Error Resume Next
    If IsNumeric(wsC.Range("B5").Value) Then
        If wsC.Range("B5").Value > 0 Then v = CDbl(wsC.Range("B5").Value)
    End If
    ' repli : chercher un libelle "Cout du kit" et lire la cellule a droite
    If v = 514.54 Then
        Dim f As Range
        Set f = wsC.Cells.Find(What:="kit", LookIn:=xlValues, LookAt:=xlPart, MatchCase:=False)
        If Not f Is Nothing Then
            If IsNumeric(f.Offset(0, 1).Value) Then
                If f.Offset(0, 1).Value > 0 Then v = CDbl(f.Offset(0, 1).Value)
            End If
        End If
    End If
    On Error GoTo 0
    KitCost = v
End Function

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
    Set titre = EnsureShape(ws, "kpiTitle", msoShapeRectangle, L, t, 460, 26)
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
        Set sh = EnsureShape(ws, "kpiCard" & (i - 1), msoShapeRoundedRectangle, cx, cy, cardW, cardH)
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
    ' Largeurs pour que le bloc parametres tienne a gauche du bandeau
    ws.Columns("A").ColumnWidth = 24
    ws.Columns("B").ColumnWidth = 12

    ws.Range("A1").Value = "PARAMETRES"
    ws.Range("A1").Font.bold = True
    ws.Range("A1").Font.Color = C_HEADER
    ws.Range("A2").Value = "Budget mensuel (" & ChrW(8364) & ")"
    ws.Range("A3").Value = "Objectif CO2 annuel (kg)"
    ws.Range("A4").Value = "Annee bilan (vide = recente)"   ' X24
    If CStr(ws.Range(CELL_CO2OBJ).Value) = "" Then ws.Range(CELL_CO2OBJ).Value = DEFAULT_CO2_OBJ
    ws.Range("A2:A4").Font.Italic = True
    ws.Range("A2:A4").Font.Color = RGB(107, 114, 128)         ' --text-muted
    ' Cellules de saisie : fond clair + cadre discret (carte)
    With ws.Range(CELL_BUDGET & ":" & CELL_ANNEE)
        .Interior.Color = RGB(255, 252, 230)
        .Borders.Color = RGB(226, 232, 240)                   ' --border
        .Borders.Weight = xlThin
    End With
    On Error GoTo 0
End Sub

' X25 : reutilise un ChartObject par son nom (reposition) ou le cree
Private Function EnsureChart(ws As Worksheet, key As String, _
                             L As Double, t As Double, w As Double, h As Double) As ChartObject
    Dim co As ChartObject
    For Each co In ws.ChartObjects
        If co.Name = key Then
            co.Left = L: co.Top = t: co.Width = w: co.Height = h
            Set EnsureChart = co
            Exit Function
        End If
    Next co
    Set co = ws.ChartObjects.Add(L, t, w, h)
    co.Name = key
    Set EnsureChart = co
End Function

' X25 : reutilise une Shape par son nom (reposition) ou la cree
Private Function EnsureShape(ws As Worksheet, nm As String, shp As MsoAutoShapeType, _
                             L As Double, t As Double, w As Double, h As Double) As Shape
    Dim s As Shape
    For Each s In ws.Shapes
        If s.Name = nm Then
            s.Left = L: s.Top = t: s.Width = w: s.Height = h
            Set EnsureShape = s
            Exit Function
        End If
    Next s
    Set s = ws.Shapes.AddShape(shp, L, t, w, h)
    s.Name = nm
    Set EnsureShape = s
End Function

Private Sub DeleteChartByName(ws As Worksheet, key As String)
    Dim co As ChartObject
    For Each co In ws.ChartObjects
        If co.Name = key Then co.Delete: Exit Sub
    Next co
End Sub

' X25 : purge les graphiques/cartes inconnus (anciennes versions), garde
' les objets nommes que l'on reutilise + les boutons + le bandeau.
Private Sub PurgeUnknown(ws As Worksheet)
    Const OK_CHARTS As String = "|gPrice|gCost|gConso|gVeh|gBudget|gCo2|gGauge|gBudgetYear|" & _
        "gKitCumul|gCoutKm|gKitProj|"
    Const OK_SHAPES As String = "|hdrBand|btnRecreerGraph|btnExportGraph|kpiTitle|" & _
        "kpiCard1|kpiCard2|kpiCard3|kpiCard4|kpiCard5|"
    Dim i As Long
    For i = ws.ChartObjects.Count To 1 Step -1
        If InStr(OK_CHARTS, "|" & ws.ChartObjects(i).Name & "|") = 0 Then ws.ChartObjects(i).Delete
    Next i
    Dim sh As Shape
    For i = ws.Shapes.Count To 1 Step -1
        Set sh = ws.Shapes(i)
        ' AutoShapes (bandeau, cartes, boutons de repli) ET images (boutons PNG)
        If sh.Type = msoAutoShape Or sh.Type = msoPicture Then
            If InStr(OK_SHAPES, "|" & sh.Name & "|") = 0 Then sh.Delete
        End If
    Next i
End Sub

' v4.8 : bandeau-titre du tableau de bord (charte app)
Private Sub EnsureHeaderBand(ws As Worksheet)
    Dim b As Shape
    Set b = EnsureShape(ws, "hdrBand", msoShapeRoundedRectangle, 264, 6, 682, 30)
    StyleShape b, "TABLEAU DE BORD  " & ChrW(8226) & "  Suivi Conso Carburants", _
               C_HEADER, RGB(255, 255, 255), 13, True
    On Error Resume Next
    b.TextFrame2.TextRange.Font.Spacing = 1
    On Error GoTo 0
End Sub

' X27..X29 / boutons en VRAIES IMAGES cliquables (PNG dans excel\assets\),
' repli sur une Shape stylee si le fichier image est absent.
' Espaces des parametres (poses a gauche) et decales sous le bandeau.
Private Sub EnsureButtons(ws As Worksheet)
    EnsurePictureButton ws, "btnRecreerGraph", "btn_recreer.png", _
        "Recreer les graphiques", C_E85, 560, 44, 190, 30, "CreerGraphiquesWeb"
    EnsurePictureButton ws, "btnExportGraph", "btn_export_pdf.png", _
        "Exporter en PDF", C_COUT, 760, 44, 170, 30, "ExporterGraphiquesPDF"
End Sub

Private Sub EnsurePictureButton(ws As Worksheet, nm As String, fileName As String, _
                                fallbackTxt As String, fallbackFill As Long, _
                                L As Double, t As Double, w As Double, h As Double, _
                                action As String)
    ' supprime l'objet existant (image ou repli) pour repartir propre
    Dim s As Shape
    For Each s In ws.Shapes
        If s.Name = nm Then s.Delete: Exit For
    Next s

    Dim p As String
    p = ThisWorkbook.Path & Application.PathSeparator & "assets" & _
        Application.PathSeparator & fileName

    Dim ok As Boolean: ok = False
    On Error Resume Next
    If Dir(p) <> "" Then
        Dim pic As Shape
        Set pic = ws.Shapes.AddPicture(p, msoFalse, msoTrue, L, t, w, h)
        If Not pic Is Nothing Then
            pic.Name = nm
            pic.OnAction = action
            ok = True
        End If
    End If
    On Error GoTo 0

    If Not ok Then
        ' repli : bouton Shape stylee (charte)
        Dim b As Shape
        Set b = ws.Shapes.AddShape(msoShapeRoundedRectangle, L, t, w, h)
        b.Name = nm
        StyleShape b, fallbackTxt, fallbackFill, RGB(255, 255, 255), 10, True
        b.OnAction = action
    End If
End Sub

' X23 : exporte l'onglet Graphiques en PDF (a cote du classeur, date du jour)
Public Sub ExporterGraphiquesPDF()
    Dim ws As Worksheet, p As String
    On Error GoTo EH
    Set ws = SheetByName(WS_GRAPH)
    If ws Is Nothing Then Err.Raise vbObjectError + 10, , _
        "Onglet '" & WS_GRAPH & "' introuvable. Lancez d'abord CreerGraphiquesWeb."
    p = ThisWorkbook.Path
    If p = "" Then p = Environ$("USERPROFILE") & "\Documents"
    p = p & Application.PathSeparator & "Tableau de bord - " & Format(Date, "yyyy-mm-dd") & ".pdf"
    ws.ExportAsFixedFormat Type:=xlTypePDF, Filename:=p, Quality:=xlQualityStandard, _
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

' ============================================================
'  X30/X34 — Bloc prix depuis la table Power Query "PrixHistory"
'  (_PrixHistory du Google Sheet : Station | Date | Type | Prix).
'  Prix MARCHE releves quotidiennement (RefreshPrix.gs), en
'  remplacement des prix tires des pleins.
' ============================================================
Private Const PH_TABLE As String = "PrixHistory"

' ============================================================
'  X30/X35 — BuildPriceBlockMerged
'  Fusionne DEUX sources de prix :
'    1. Tableau2 (pleins saisis) — historique long, tous carburants
'    2. PrixHistory (table Power Query, marche quotidien) — si dispo
'  Pour chaque jour+carburant : prix minimum des deux sources.
'  Carburants detectes dynamiquement ; colonnes G: Date, H:...: carburants.
'  Retourne le nb de lignes ecrites (en-tete inclus).
'  nCols recoit le nb de colonnes carburant (sans Date).
' ============================================================
Private Function BuildPriceBlockMerged(wsD As Worksheet, t2 As ListObject, _
                                       ByRef nCols As Long) As Long
    BuildPriceBlockMerged = 1
    nCols = 0

    Dim prixData As Object: Set prixData = CreateObject("Scripting.Dictionary")
    Dim ordDates As Object: Set ordDates = CreateObject("Scripting.Dictionary")
    Dim fuelSet As Object: Set fuelSet = CreateObject("Scripting.Dictionary")

    ' === SOURCE 1 : Tableau2 (pleins) ===
    If Not t2 Is Nothing Then
        If Not t2.DataBodyRange Is Nothing Then
            Dim ciD2 As Long: ciD2 = LCIdx(t2, "Date")
            Dim ciT2 As Long: ciT2 = LCIdx(t2, "Type")
            Dim ciP2 As Long: ciP2 = LCIdx(t2, "Prix " & ChrW(8364) & "/L")
            If ciD2 > 0 And ciT2 > 0 And ciP2 > 0 Then
                Dim a2 As Variant: a2 = t2.DataBodyRange.Value
                Dim i2 As Long
                For i2 = 1 To UBound(a2, 1)
                    If IsDate(a2(i2, ciD2)) Then
                        Dim dk2 As String: dk2 = Format(CDate(a2(i2, ciD2)), "yyyy-mm-dd")
                        Dim fk2 As String: fk2 = FuelKey(CStr(a2(i2, ciT2)))
                        Dim p2 As Double: p2 = NumOr0(a2(i2, ciP2))
                        If Len(fk2) > 0 And p2 > 0 Then
                            SetMin prixData, dk2 & "|" & fk2, p2
                            If Not ordDates.Exists(dk2) Then ordDates(dk2) = 1
                            If Not fuelSet.Exists(fk2) Then fuelSet(fk2) = True
                        End If
                    End If
                Next i2
            End If
        End If
    End If

    ' === SOURCE 2 : PrixHistory (marche quotidien) ===
    Dim lo As ListObject: Set lo = FindListObject(PH_TABLE)
    If Not lo Is Nothing Then
        If Not lo.DataBodyRange Is Nothing Then
            Dim ciDH As Long: ciDH = LCIdx(lo, "Date")
            Dim ciTH As Long: ciTH = LCIdx(lo, "Type")
            Dim ciPH As Long: ciPH = LCIdx(lo, "Prix")
            If ciPH = 0 Then ciPH = LCIdx(lo, "Prix " & ChrW(8364) & "/L")
            If ciDH > 0 And ciTH > 0 And ciPH > 0 Then
                Dim aH As Variant: aH = lo.DataBodyRange.Value
                Dim iH As Long
                For iH = 1 To UBound(aH, 1)
                    If IsDate(aH(iH, ciDH)) Then
                        Dim dkH As String: dkH = Format(CDate(aH(iH, ciDH)), "yyyy-mm-dd")
                        Dim fkH As String: fkH = FuelKey(CStr(aH(iH, ciTH)))
                        Dim pH As Double: pH = NumOr0(aH(iH, ciPH))
                        ' X35 : PrixHistory enrichit uniquement les carburants
                        ' deja presents dans les pleins (fuelSet) ; ne cree pas
                        ' de nouvelles series pour des carburants non utilises.
                        If Len(fkH) > 0 And pH > 0 And fuelSet.Exists(fkH) Then
                            SetMin prixData, dkH & "|" & fkH, pH
                            If Not ordDates.Exists(dkH) Then ordDates(dkH) = 1
                        End If
                    End If
                Next iH
            End If
        End If
    End If

    If ordDates.count = 0 Then Exit Function

    ' === Tri chronologique des dates ===
    Dim dates() As String, dIdx As Long: dIdx = 0
    ReDim dates(0 To ordDates.count - 1)
    Dim kk As Variant
    For Each kk In ordDates.Keys: dates(dIdx) = CStr(kk): dIdx = dIdx + 1: Next kk
    TriStr dates

    ' === Ordre prefere des carburants ===
    Dim prefOrder As Variant
    prefOrder = Array("E85", "SP98", "GAZOLE", "SP95", "E10", "GPL")
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
    For Each fkR In fuelSet.Keys
        If Not seen.Exists(CStr(fkR)) Then
            fuels(fIdx) = CStr(fkR): fIdx = fIdx + 1
        End If
    Next fkR
    If fIdx = 0 Then Exit Function
    ReDim Preserve fuels(0 To fIdx - 1)
    nCols = fIdx

    ' === En-tete dynamique G1: Date + carburants ===
    wsD.Range(wsD.Cells(1, 7), wsD.Cells(1, 7 + nCols)).ClearContents
    wsD.Cells(1, 7).Value = "Date"
    Dim c As Long
    For c = 0 To nCols - 1: wsD.Cells(1, 8 + c).Value = fuels(c): Next c

    ' === Lignes de donnees ===
    wsD.Range(wsD.Cells(2, 7), wsD.Cells(wsD.Rows.count, 7 + nCols)).ClearContents
    Dim r As Long
    For r = 0 To UBound(dates)
        Dim dk3 As String: dk3 = dates(r)
        wsD.Cells(r + 2, 7).Value = CDate(dk3)
        For c = 0 To nCols - 1
            Dim pkey As String: pkey = dk3 & "|" & fuels(c)
            If prixData.Exists(pkey) Then wsD.Cells(r + 2, 8 + c).Value = prixData(pkey)
        Next c
    Next r

    wsD.Columns(7).NumberFormat = "dd/mm/yyyy"
    BuildPriceBlockMerged = UBound(dates) + 2
End Function

' Cherche un ListObject par nom sur toutes les feuilles du classeur.
Private Function FindListObject(nm As String) As ListObject
    Dim ws As Worksheet, lo As ListObject
    For Each ws In ThisWorkbook.Worksheets
        For Each lo In ws.ListObjects
            If LCase$(Trim$(lo.Name)) = LCase$(Trim$(nm)) Then
                Set FindListObject = lo
                Exit Function
            End If
        Next lo
    Next ws
    Set FindListObject = Nothing
End Function

' Memorise le minimum d'une valeur par cle dans un dictionnaire.
Private Sub SetMin(d As Object, k As String, v As Double)
    If Not d.Exists(k) Then
        d(k) = v
    ElseIf v < d(k) Then
        d(k) = v
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

Private Function FuelKey(t As String) As String
    Dim u As String: u = UCase$(Trim$(t))
    If InStr(u, "E85") > 0 Or InStr(u, "ETHANOL") > 0 Then
        FuelKey = "E85"
    ElseIf InStr(u, "GAZOLE") > 0 Or InStr(u, "DIESEL") > 0 Or InStr(u, "GASOIL") > 0 Then
        FuelKey = "GAZOLE"
    ElseIf InStr(u, "SP98") > 0 Or InStr(u, "S98") > 0 Then
        FuelKey = "SP98"
    ElseIf InStr(u, "SP95") > 0 Or InStr(u, "S95") > 0 Then
        FuelKey = "SP95"
    ElseIf InStr(u, "E10") > 0 Then
        FuelKey = "E10"
    ElseIf InStr(u, "GPL") > 0 Then
        FuelKey = "GPL"
    ElseIf Len(u) > 0 Then
        FuelKey = u      ' conserve le libelle brut (ex : "HVO", "GNV"…)
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
