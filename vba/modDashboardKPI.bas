Attribute VB_Name = "modDashboardKPI"
' ============================================================
'  SUIVI CONSO CARBURANTS � KPI dynamiques du dashboard        v4.9.0.0
'
'  X32/X33 : moteur de calcul des 3 KPI de l'onglet � Graphiques �
'  (cartes dash_kpivalue de modDashboardGraphiques), FILTRES par
'  vehicule + carburant selectionnes :
'    � CONSO MOYENNE        (L/100 km)
'    � COUT AUX 100 KM      (EUR/100 km)
'    � ECONOMIES E85 vs SP98 (EUR, uniquement pertinent si carburant = E85)
'
'  Source : table � GS_Pleins � (colonnes Vehicule / Type / Km / Litres /
'  PrixL / SP98 station). Surconso E85 : � Suivi Carburant �!J7 (defaut 0.20),
'  alignee sur modGraphiques.
'
'  Defauts : vehicule + carburant du DERNIER plein (derniere date GS_Pleins).
'  Listes de choix : valeurs distinctes presentes dans GS_Pleins.
'
'  Expose :
'    � KPIVehiculeList / KPICarburantList  -> tableaux de choix (pour validation)
'    � KPIDefautVehicule / KPIDefautCarburant -> selection par defaut
'    � ComputeKPIs(veh, fuel, conso, coutKm, eco) -> calcule les 3 KPI
'  Tout est defensif (On Error) : si GS_Pleins manque, renvoie 0.
' ============================================================
Option Explicit

Private Const GS_SHEET As String = "GS_Pleins"
Private Const WS_CARB  As String = "Suivi Carburant"
Private Const DEFAULT_SURCONSO As Double = 0.2
' Constantes CO2 (alignees sur js/config.js et modGraphiques).
Private Const CO2_ESSENCE_PER_L As Double = 2.21
Private Const CO2_E85_PER_L     As Double = 1.105

' Valeur sentinelle � tous � (pas de filtre carburant).
Public Const KPI_TOUS As String = "(tous)"

' X37 : structure regroupant toutes les valeurs du tableau de bord (filtrees).
Public Type DashStats
    conso       As Double   ' L/100 km (filtre veh+fuel)
    coutKm100   As Double   ' EUR/100 km (filtre veh+fuel)
    eco         As Double   ' EUR economie E85 vs SP98 (lignes E85)
    co2         As Double   ' kg CO2 evite (lignes E85)
    nbPleins    As Long     ' nb pleins du perimetre (hors plein de reference)
    km          As Double   ' distance kmMax - kmMin
    litres      As Double   ' litres cumules (hors plein de reference)
    depense     As Double   ' EUR depenses (hors plein de reference)
    pctE85      As Double   ' part de pleins E85 (sur le veh, fraction 0..1)
    prixMoyen   As Double   ' EUR/L moyen du carburant filtre (E85 si tous)
    dateDernier As Date     ' date du dernier plein du perimetre
    stationTop  As String   ' station la plus frequentee (perimetre vehicule)
End Type

'------------------------------------------------------------
'  Acces a la table GS_Pleins
'------------------------------------------------------------
Private Function GSTable() As ListObject
    Dim ws As Worksheet
    On Error Resume Next
    Set ws = ThisWorkbook.Worksheets(GS_SHEET)
    On Error GoTo 0
    If ws Is Nothing Then Exit Function
    If ws.ListObjects.count = 0 Then Exit Function
    Set GSTable = ws.ListObjects(1)
End Function

Private Function ColIdx(lo As ListObject, nm As String) As Long
    On Error Resume Next
    ColIdx = lo.ListColumns(nm).Index
    On Error GoTo 0
End Function

Private Function Nz(v As Variant) As Double
    If IsNumeric(v) Then Nz = CDbl(v) Else Nz = 0
End Function

Public Function FuelKeyK(t As String) As String
    Dim u As String: u = UCase$(Trim$(t))
    If InStr(u, "E85") > 0 Or InStr(u, "ETHANOL") > 0 Then
        FuelKeyK = "E85"
    ElseIf InStr(u, "GAZOLE") > 0 Or InStr(u, "DIESEL") > 0 Or InStr(u, "GASOIL") > 0 Then
        FuelKeyK = "GAZOLE"
    ElseIf InStr(u, "98") > 0 Then
        FuelKeyK = "SP98"
    ElseIf InStr(u, "95") > 0 Or InStr(u, "E10") > 0 Then
        FuelKeyK = "SP95"
    ElseIf InStr(u, "GPL") > 0 Then
        FuelKeyK = "GPL"
    ElseIf Len(u) > 0 Then
        FuelKeyK = u
    End If
End Function

' Verifie si fk (cle normalisee) est dans la selection multi-carburant sel.
' sel peut etre "(tous)", une valeur simple, ou une liste "E85, SP95".
Public Function FuelInSel(ByVal fk As String, ByVal sel As String) As Boolean
    If Len(sel) = 0 Or sel = KPI_TOUS Then FuelInSel = True: Exit Function
    Dim parts() As String: parts = Split(sel, ",")
    Dim i As Long
    For i = 0 To UBound(parts)
        If StrComp(FuelKeyK(Trim(parts(i))), fk, vbTextCompare) = 0 Then
            FuelInSel = True: Exit Function
        End If
    Next i
End Function

Private Function surconso() As Double
    ' Surconso E85 (fraction, ex. 0.23) = "Suivi Carburant"!J8 ("Surconsommation E85 (%)").
    ' NB : J7 = "Conso E85 reference (km/L)" (~15) ; ne JAMAIS la lire comme surconso.
    ' Garde-fou : n'accepter qu'une fraction plausible (0 < x <= 1), sinon defaut 0.20.
    surconso = DEFAULT_SURCONSO
    On Error Resume Next
    Dim ws As Worksheet: Set ws = ThisWorkbook.Worksheets(WS_CARB)
    If Not ws Is Nothing Then
        If IsNumeric(ws.Range("J8").value) Then
            Dim v As Double: v = CDbl(ws.Range("J8").value)
            If v > 0 And v <= 1 Then surconso = v
        End If
    End If
    On Error GoTo 0
End Function

'------------------------------------------------------------
'  Listes de choix (valeurs distinctes presentes dans GS_Pleins)
'------------------------------------------------------------
Public Function KPIVehiculeList() As String()
    Dim out() As String, n As Long: n = 0
    ReDim out(0 To 0)
    Dim lo As ListObject: Set lo = GSTable()
    If lo Is Nothing Then KPIVehiculeList = out: Exit Function
    If lo.DataBodyRange Is Nothing Then KPIVehiculeList = out: Exit Function

    Dim ciVeh As Long: ciVeh = ColIdx(lo, "Vehicule")
    If ciVeh = 0 Then KPIVehiculeList = out: Exit Function

    Dim a As Variant: a = lo.DataBodyRange.value
    Dim seen As Object: Set seen = CreateObject("Scripting.Dictionary")
    seen.CompareMode = vbTextCompare
    Dim i As Long
    For i = 1 To UBound(a, 1)
        Dim v As String: v = Trim$(CStr(a(i, ciVeh)))
        If Len(v) > 0 And Not seen.Exists(v) Then
            seen(v) = True
            If n > UBound(out) Then ReDim Preserve out(0 To n)
            out(n) = v: n = n + 1
        End If
    Next i
    If n = 0 Then ReDim out(0 To 0) Else ReDim Preserve out(0 To n - 1)
    SortStr out
    KPIVehiculeList = out
End Function

Public Function KPICarburantList() As String()
    Dim out() As String, n As Long: n = 0
    ReDim out(0 To 0)
    Dim lo As ListObject: Set lo = GSTable()
    If lo Is Nothing Then KPICarburantList = out: Exit Function
    If lo.DataBodyRange Is Nothing Then KPICarburantList = out: Exit Function

    Dim ciType As Long: ciType = ColIdx(lo, "Type")
    If ciType = 0 Then KPICarburantList = out: Exit Function

    Dim a As Variant: a = lo.DataBodyRange.value
    Dim seen As Object: Set seen = CreateObject("Scripting.Dictionary")
    Dim i As Long
    For i = 1 To UBound(a, 1)
        Dim fk As String: fk = FuelKeyK(CStr(a(i, ciType)))
        If Len(fk) > 0 And Not seen.Exists(fk) Then
            seen(fk) = True
            If n > UBound(out) Then ReDim Preserve out(0 To n)
            out(n) = fk: n = n + 1
        End If
    Next i
    If n = 0 Then ReDim out(0 To 0) Else ReDim Preserve out(0 To n - 1)
    SortStr out
    KPICarburantList = out
End Function

'------------------------------------------------------------
'  Selection par defaut = dernier plein (derniere date GS_Pleins)
'------------------------------------------------------------
Private Sub DernierPlein(ByRef veh As String, ByRef fuel As String)
    veh = "": fuel = ""
    Dim lo As ListObject: Set lo = GSTable()
    If lo Is Nothing Then Exit Sub
    If lo.DataBodyRange Is Nothing Then Exit Sub

    Dim ciDate As Long, ciVeh As Long, ciType As Long
    ciDate = ColIdx(lo, "Date")
    ciVeh = ColIdx(lo, "Vehicule")
    ciType = ColIdx(lo, "Type")

    Dim a As Variant: a = lo.DataBodyRange.value
    Dim i As Long, bestRow As Long: bestRow = 0
    Dim bestDate As Date: bestDate = DateSerial(1900, 1, 1)
    For i = 1 To UBound(a, 1)
        If ciDate > 0 Then
            If IsDate(a(i, ciDate)) Then
                If CDate(a(i, ciDate)) >= bestDate Then
                    bestDate = CDate(a(i, ciDate)): bestRow = i
                End If
            End If
        End If
    Next i
    If bestRow = 0 Then bestRow = UBound(a, 1)   ' repli : derniere ligne
    If bestRow >= 1 Then
        If ciVeh > 0 Then veh = Trim$(CStr(a(bestRow, ciVeh)))
        If ciType > 0 Then fuel = FuelKeyK(CStr(a(bestRow, ciType)))
    End If
End Sub

Public Function KPIDefautVehicule() As String
    Dim v As String, f As String
    DernierPlein v, f
    KPIDefautVehicule = v
End Function

Public Function KPIDefautCarburant() As String
    Dim v As String, f As String
    DernierPlein v, f
    KPIDefautCarburant = f
End Function

'------------------------------------------------------------
'  CALCUL DES 3 KPI filtres par vehicule (+ carburant)
'  veh  : "" ou KPI_TOUS = tous vehicules ; sinon nom exact
'  fuel : "" ou KPI_TOUS = tous carburants ; sinon E85/GAZOLE/SP98/...
'------------------------------------------------------------
Public Sub ComputeKPIs(ByVal veh As String, ByVal fuel As String, _
                       ByRef outConso As Double, ByRef outCoutKm As Double, _
                       ByRef outEco As Double)
    outConso = 0: outCoutKm = 0: outEco = 0
    On Error GoTo EH

    Dim lo As ListObject: Set lo = GSTable()
    If lo Is Nothing Then Exit Sub
    If lo.DataBodyRange Is Nothing Then Exit Sub

    Dim ciVeh As Long, ciType As Long, ciKm As Long, ciLit As Long, ciPrix As Long, ciSP98 As Long
    ciVeh = ColIdx(lo, "Vehicule")
    ciType = ColIdx(lo, "Type")
    ciKm = ColIdx(lo, "Km")
    ciLit = ColIdx(lo, "Litres")
    ciPrix = ColIdx(lo, "PrixL")
    ciSP98 = ColIdx(lo, "SP98 station")
    If ciKm = 0 Or ciLit = 0 Then Exit Sub

    Dim filtVeh As Boolean: filtVeh = (Len(veh) > 0 And veh <> KPI_TOUS)
    Dim filtFuel As Boolean: filtFuel = (Len(fuel) > 0 And fuel <> KPI_TOUS)
    Dim sc As Double: sc = surconso()

    Dim a As Variant: a = lo.DataBodyRange.value
    Dim i As Long

    Dim litres As Double, cout As Double
    Dim kmMin As Double, kmMax As Double, haveKm As Boolean
    Dim eco As Double
    litres = 0: cout = 0: eco = 0: haveKm = False

    ' === PASSE 1 : trouver kmMin (plein de reference full-to-full) ===
    ' Methodologie full-to-full : le 1er plein etablit le point de depart.
    ' Son volume represente du carburant consomme AVANT notre fenetre de mesure
    ' (km inconnu -> kmMin) ; on l'exclut du cumul litres/cout.
    ' Les pleins suivants representent la consommation reelle sur kmMin->kmMax.
    For i = 1 To UBound(a, 1)
        If filtVeh And ciVeh > 0 Then
            If StrComp(Trim$(CStr(a(i, ciVeh))), veh, vbTextCompare) <> 0 Then GoTo P1NX
        End If
        Dim fk0 As String: fk0 = ""
        If ciType > 0 Then fk0 = FuelKeyK(CStr(a(i, ciType)))
        If filtFuel Then If Not FuelInSel(fk0, fuel) Then GoTo P1NX
        Dim km0 As Double: km0 = Nz(a(i, ciKm))
        If km0 > 0 Then
            If Not haveKm Then
                kmMin = km0: kmMax = km0: haveKm = True
            Else
                If km0 < kmMin Then kmMin = km0
                If km0 > kmMax Then kmMax = km0
            End If
        End If
P1NX:
    Next i

    If Not haveKm Then GoTo CalcFin

    ' === PASSE 2 : accumule litres/cout/eco en excluant le plein de reference ===
    For i = 1 To UBound(a, 1)
        ' -- filtres --
        If filtVeh And ciVeh > 0 Then
            If StrComp(Trim$(CStr(a(i, ciVeh))), veh, vbTextCompare) <> 0 Then GoTo NX
        End If
        Dim fk As String
        fk = ""
        If ciType > 0 Then fk = FuelKeyK(CStr(a(i, ciType)))
        If filtFuel Then
            If Not FuelInSel(fk, fuel) Then GoTo NX
        End If

        Dim km As Double: km = Nz(a(i, ciKm))
        Dim li As Double: li = Nz(a(i, ciLit))
        Dim pr As Double: pr = Nz(a(i, ciPrix))

        ' Exclut le plein de reference (km = kmMin) : methode full-to-full.
        If km = kmMin Then GoTo NX

        litres = litres + li
        ' W73 : cout reel (col 20) si saisi, sinon litres * prix
        Dim ct As Double: ct = 0
        If UBound(a, 2) >= 20 Then If IsNumeric(a(i, 20)) Then ct = CDbl(a(i, 20))
        cout = cout + IIf(ct > 0, ct, li * pr)

        ' -- economie E85 vs SP98 (ligne E85 uniquement) --
        If fk = "E85" And li > 0 Then
            Dim prixSP98 As Double: prixSP98 = 0
            If ciSP98 > 0 Then prixSP98 = Nz(a(i, ciSP98))
            If prixSP98 <= 0 Then prixSP98 = DernierPrixSP98()
            If prixSP98 > 0 Then
                Dim essEq As Double: essEq = li / (1 + sc)
                eco = eco + (essEq * prixSP98) - (li * pr)
            End If
        End If
NX:
    Next i

CalcFin:
    Dim dist As Double: dist = 0
    If haveKm Then dist = kmMax - kmMin
    If dist > 0 Then
        outConso = litres / dist * 100
        outCoutKm = cout / dist * 100
    End If
    outEco = eco
    Exit Sub
EH:
    outConso = 0: outCoutKm = 0: outEco = 0
End Sub

'------------------------------------------------------------
'  X37 � STATISTIQUES COMPLETES DU DASHBOARD (filtrees veh/fuel)
'  Regroupe en une passe toutes les valeurs affichees par le
'  tableau de bord (KPI + bandeau meta + fusion ancien dashboard),
'  pour DECOUPLER le dashboard de l'ancien onglet "Tableau de bord".
'  Methode conso/cout : full-to-full (exclut le plein de reference),
'  identique a ComputeKPIs. (Type DashStats + constantes CO2 declares en tete.)
'------------------------------------------------------------
Public Sub ComputeDashboardStats(ByVal veh As String, ByVal fuel As String, _
                                 ByRef ds As DashStats)
    Dim zeroDs As DashStats: ds = zeroDs
    On Error GoTo EH

    Dim lo As ListObject: Set lo = GSTable()
    If lo Is Nothing Then Exit Sub
    If lo.DataBodyRange Is Nothing Then Exit Sub

    Dim ciVeh As Long, ciType As Long, ciKm As Long, ciLit As Long, ciPrix As Long, ciSP98 As Long, ciDate As Long, ciStation As Long
    ciVeh = ColIdx(lo, "Vehicule")
    ciType = ColIdx(lo, "Type")
    ciKm = ColIdx(lo, "Km")
    ciLit = ColIdx(lo, "Litres")
    ciPrix = ColIdx(lo, "PrixL")
    ciSP98 = ColIdx(lo, "SP98 station")
    ciDate = ColIdx(lo, "Date")
    ciStation = ColIdx(lo, "Station essence")
    If ciKm = 0 Or ciLit = 0 Then Exit Sub

    Dim filtVeh As Boolean: filtVeh = (Len(veh) > 0 And veh <> KPI_TOUS)
    Dim filtFuel As Boolean: filtFuel = (Len(fuel) > 0 And fuel <> KPI_TOUS)
    Dim sc As Double: sc = surconso()

    Dim a As Variant: a = lo.DataBodyRange.value
    Dim i As Long

    ' --- p�rim�tre VEHICULE (pour %E85, prix moyen, date dernier plein, station) ---
    Dim nVeh As Long, nE85 As Long
    Dim sumPrix As Double, nPrix As Long
    Dim dLast As Date: dLast = DateSerial(1900, 1, 1)
    Dim stationCnt As Object: Set stationCnt = CreateObject("Scripting.Dictionary")
    stationCnt.CompareMode = vbTextCompare

    ' --- p�rim�tre VEHICULE+FUEL (full-to-full pour conso/cout/eco/co2) ---
    Dim kmMin As Double, kmMax As Double, haveKm As Boolean: haveKm = False

    ' PASSE 1 : kmMin/kmMax (filtre veh+fuel) + agr�gats veh-scope
    For i = 1 To UBound(a, 1)
        Dim fkA As String: fkA = ""
        If ciType > 0 Then fkA = FuelKeyK(CStr(a(i, ciType)))

        ' -- p�rim�tre v�hicule (filtre veh seulement) --
        Dim okVeh As Boolean: okVeh = True
        If filtVeh And ciVeh > 0 Then okVeh = (StrComp(Trim$(CStr(a(i, ciVeh))), veh, vbTextCompare) = 0)
        If okVeh Then
            nVeh = nVeh + 1
            If fkA = "E85" Then nE85 = nE85 + 1
            ' prix moyen : carburant filtr�, sinon E85 par d�faut
            If FuelInSel(fkA, IIf(filtFuel, fuel, "E85")) Then
                Dim pp As Double: pp = Nz(a(i, ciPrix))
                If pp > 0 Then sumPrix = sumPrix + pp: nPrix = nPrix + 1
            End If
            If ciDate > 0 Then
                If IsDate(a(i, ciDate)) Then If CDate(a(i, ciDate)) > dLast Then dLast = CDate(a(i, ciDate))
            End If
            If ciStation > 0 Then
                Dim stv As String: stv = Trim$(CStr(a(i, ciStation)))
                If Len(stv) > 0 Then stationCnt(stv) = stationCnt(stv) + 1
            End If
        End If

        ' -- p�rim�tre v�hicule+carburant (km) --
        If filtVeh And ciVeh > 0 Then
            If StrComp(Trim$(CStr(a(i, ciVeh))), veh, vbTextCompare) <> 0 Then GoTo P1NX
        End If
        If filtFuel Then If Not FuelInSel(fkA, fuel) Then GoTo P1NX
        Dim km0 As Double: km0 = Nz(a(i, ciKm))
        If km0 > 0 Then
            If Not haveKm Then
                kmMin = km0: kmMax = km0: haveKm = True
            Else
                If km0 < kmMin Then kmMin = km0
                If km0 > kmMax Then kmMax = km0
            End If
        End If
P1NX:
    Next i

    ' PASSE 2 : cumuls litres/cout/eco/co2/nbPleins (exclut le plein de r�f�rence)
    If haveKm Then
        For i = 1 To UBound(a, 1)
            If filtVeh And ciVeh > 0 Then
                If StrComp(Trim$(CStr(a(i, ciVeh))), veh, vbTextCompare) <> 0 Then GoTo P2NX
            End If
            Dim fk As String: fk = ""
            If ciType > 0 Then fk = FuelKeyK(CStr(a(i, ciType)))
            If filtFuel Then If Not FuelInSel(fk, fuel) Then GoTo P2NX

            Dim km As Double: km = Nz(a(i, ciKm))
            Dim li As Double: li = Nz(a(i, ciLit))
            Dim pr As Double: pr = Nz(a(i, ciPrix))

            If km = kmMin Then GoTo P2NX     ' exclut le plein de r�f�rence (full-to-full)

            ds.litres = ds.litres + li
            ' W73 : cout reel (col 20) si saisi, sinon litres * prix
            Dim ctD As Double: ctD = 0
            If UBound(a, 2) >= 20 Then If IsNumeric(a(i, 20)) Then ctD = CDbl(a(i, 20))
            ds.depense = ds.depense + IIf(ctD > 0, ctD, li * pr)
            ds.nbPleins = ds.nbPleins + 1

            If fk = "E85" And li > 0 Then
                Dim prixSP98 As Double: prixSP98 = 0
                If ciSP98 > 0 Then prixSP98 = Nz(a(i, ciSP98))
                If prixSP98 <= 0 Then prixSP98 = DernierPrixSP98()
                Dim essEq As Double: essEq = li / (1 + sc)
                If prixSP98 > 0 Then ds.eco = ds.eco + (essEq * prixSP98) - (li * pr)
                ds.co2 = ds.co2 + (essEq * CO2_ESSENCE_PER_L) - (li * CO2_E85_PER_L)
            End If
P2NX:
        Next i
    End If

    Dim dist As Double: dist = 0
    If haveKm Then dist = kmMax - kmMin
    ds.km = dist
    If dist > 0 Then
        ds.conso = ds.litres / dist * 100
        ds.coutKm100 = ds.depense / dist * 100
    End If
    If nVeh > 0 Then ds.pctE85 = nE85 / nVeh
    If nPrix > 0 Then ds.prixMoyen = sumPrix / nPrix
    If dLast > DateSerial(1900, 1, 1) Then ds.dateDernier = dLast
    ' station la plus fr�quent�e (p�rim�tre v�hicule)
    Dim bestSt As String, bestN As Double, kSt As Variant
    bestN = -1
    For Each kSt In stationCnt.keys
        If stationCnt(kSt) > bestN Then bestN = stationCnt(kSt): bestSt = CStr(kSt)
    Next kSt
    ds.stationTop = bestSt
    Exit Sub
EH:
    Dim e As DashStats: ds = e
End Sub

' Dernier prix SP98 marche (table PrixHistory) � repli pour l'economie.
Private Function DernierPrixSP98() As Double
    On Error GoTo Fail
    Dim ws As Worksheet, lo As ListObject
    For Each ws In ThisWorkbook.Worksheets
        For Each lo In ws.ListObjects
            If LCase$(Trim$(lo.name)) = "prixhistory" Then
                If lo.DataBodyRange Is Nothing Then Exit Function
                Dim ciD As Long, ciT As Long, ciP As Long
                ciD = ColIdx(lo, "Date"): ciT = ColIdx(lo, "Type"): ciP = ColIdx(lo, "Prix")
                If ciD = 0 Or ciT = 0 Or ciP = 0 Then Exit Function
                Dim a As Variant: a = lo.DataBodyRange.value
                Dim i As Long, best As Date, bestP As Double
                best = DateSerial(1900, 1, 1)
                For i = 1 To UBound(a, 1)
                    If FuelKeyK(CStr(a(i, ciT))) = "SP98" Then
                        If IsDate(a(i, ciD)) Then
                            If CDate(a(i, ciD)) >= best And Nz(a(i, ciP)) > 0 Then
                                best = CDate(a(i, ciD)): bestP = Nz(a(i, ciP))
                            End If
                        End If
                    End If
                Next i
                DernierPrixSP98 = bestP
                Exit Function
            End If
        Next lo
    Next ws
Fail:
End Function

'------------------------------------------------------------
'  Tri simple (bulle) d'un tableau de chaines
'------------------------------------------------------------
Private Sub SortStr(arr() As String)
    On Error Resume Next
    Dim i As Long, j As Long, tmp As String
    For i = LBound(arr) To UBound(arr) - 1
        For j = i + 1 To UBound(arr)
            If arr(j) < arr(i) Then tmp = arr(i): arr(i) = arr(j): arr(j) = tmp
        Next j
    Next i
End Sub


