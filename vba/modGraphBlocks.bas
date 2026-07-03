Attribute VB_Name = "modGraphBlocks"
' ============================================================
'  modGraphBlocks - Constructeurs de blocs du dashboard (X44 P4)
' ============================================================
'  Sous-blocs agreges extraits de modGraphData : prix (marche + pleins),
'  conso L/100km par vehicule, comparaison vehicules. Appeles par
'  modGraphData.BuildAggregates. Helpers partages restes Public dans
'  modGraphData : FuelKey / LCIdx / NumDict / NumOr0 / TriStr.
'  Public : BuildPriceBlockMerged, BuildConsoBlock, BuildVehiculesBlock.
Option Explicit


Public Function BuildPriceBlockMerged(wsd As Worksheet, t2 As ListObject, _
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


Public Function BuildConsoBlock(gsT As ListObject, wsd As Worksheet, _
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


Public Function BuildVehiculesBlock(gsT As ListObject, wsd As Worksheet) As Long
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
