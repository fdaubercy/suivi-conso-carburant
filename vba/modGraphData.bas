Attribute VB_Name = "modGraphData"
' ============================================================
'  modGraphData - Agregats dashboard (X44 P3)
' ============================================================
'  BuildAggregates + blocs (vehicules/conso/prix) + helpers, extraits de
'  modGraphiques. Config via modGraphCfg. Public : BuildAggregates,
'  EnsureDataSheet, EnsurePeriodNames, KitCost, SheetByName, NumOr0.
Option Explicit

Public Sub BuildAggregates(t2 As ListObject, gsT As ListObject, wsd As Worksheet, _
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
    ' X15 : conso E85 + prix par plein dans le temps (AP=42 date, AQ=43 conso, AR=44 prix)
    wsd.Range("AP1:AR1").value = Array("Date", "Conso L/100 km", "Prix E85 " & eu & "/L")

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
        ' X15 : conso + prix E85 par plein dans le temps ? uniquement pleins E85
        If fk = "E85" And prix > 0 And conso > 0 Then
            rSc = rSc + 1
            wsd.Cells(rSc, 42).value = d     ' AP : date
            wsd.Cells(rSc, 43).value = conso ' AQ : conso L/100 km (barres)
            wsd.Cells(rSc, 44).value = prix  ' AR : prix E85 ?/L (courbe)
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
            wsd.Cells(rw, 1).value = MoisDate(keys(k))
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
            wsd.Cells(rb, 19).value = MoisDate(keys(k))                    ' S
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
    ' Abscisses mensuelles (gCost/gCo2 col A ; gBudget col S) : vraies dates, format FR MM/AAAA
    wsd.Columns(1).NumberFormat = "mm/yyyy"
    wsd.Columns(19).NumberFormat = "mm/yyyy"
End Sub

' Vraie date (1er du mois) a partir d'une cle de tri "yyyy-mm".
' Les cles restent triees en "yyyy-mm" (chronologique) ; on ecrit une Date
' explicite (pas une string coercee, locale-dependante) en col A/S : les axes
' mensuels gCost/gCo2/gBudget affichent MM/AAAA via TickLabels.NumberFormat.
Private Function MoisDate(ByVal k As String) As Date
    If Len(k) = 7 And Mid$(k, 5, 1) = "-" And IsNumeric(Left$(k, 4)) And IsNumeric(Mid$(k, 6, 2)) Then
        MoisDate = DateSerial(CInt(Left$(k, 4)), CInt(Mid$(k, 6, 2)), 1)
    End If
End Function

Public Sub EnsurePeriodNames(wsG As Worksheet)
    On Error Resume Next
    ThisWorkbook.names.Add name:="PERIODE_DEB", _
        RefersTo:="='" & wsG.name & "'!" & wsG.Range(CELL_PERDEB).Address
    ThisWorkbook.names.Add name:="PERIODE_FIN", _
        RefersTo:="='" & wsG.name & "'!" & wsG.Range(CELL_PERFIN).Address
    On Error GoTo 0
End Sub

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

Private Function InCsvSel(ByVal value As String, ByVal csv As String) As Boolean
    If Len(csv) = 0 Or csv = FILTER_ALL Then InCsvSel = True: Exit Function
    Dim parts() As String: parts = Split(csv, ",")
    Dim i As Long
    For i = 0 To UBound(parts)
        If StrComp(Trim$(parts(i)), Trim$(value), vbTextCompare) = 0 Then InCsvSel = True: Exit Function
    Next i
End Function

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

Public Function KitCost(wsC As Worksheet) As Double
    Dim v As Double: v = 514.54
    On Error Resume Next
    If IsNumeric(wsC.Range("B6").value) Then
        If wsC.Range("B6").value > 0 Then v = CDbl(wsC.Range("B6").value)
    End If
    On Error GoTo 0
    KitCost = v
End Function

Public Function EnsureDataSheet() As Worksheet
    Dim ws As Worksheet
    Set ws = SheetByName(WS_DATA)
    If ws Is Nothing Then
        Set ws = ThisWorkbook.Worksheets.Add(After:=ThisWorkbook.Sheets(ThisWorkbook.Sheets.count))
        ws.name = WS_DATA
    End If
    ws.visible = xlSheetVeryHidden
    Set EnsureDataSheet = ws
End Function

Public Function SheetByName(nm As String) As Worksheet
    On Error Resume Next
    Set SheetByName = ThisWorkbook.Worksheets(nm)
    On Error GoTo 0
End Function

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

Public Function NumOr0(v As Variant) As Double
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
