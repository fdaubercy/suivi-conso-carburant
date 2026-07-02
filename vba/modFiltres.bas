Attribute VB_Name = "modFiltres"
Option Explicit
' ============================================================
'  modFiltres — Filtres natifs du Tableau de bord (X39 / v5.12.0.0)
'  Segments Vehicule + Carburant (+ Chronologie inseree manuellement) sur un
'  TCD CACHE (ptFiltres) base sur la table tFilterSrc (derivee de GS_Pleins).
'  Le changement d'un controle declenche Workbook_SheetPivotTableUpdate ->
'  ApplyFiltersFromControls -> ecrit B5/B6 (+ periode) -> RecreerDashboardComplet.
'  --- INCREMENT 1+2 : source + pivot + segments (sans evenement ni layout final).
' ============================================================

Private Const WS_SRC    As String = "_FilterSrc"
Private Const T_SRC     As String = "tFilterSrc"
Private Const PT_NAME   As String = "ptFiltres"
Private Const SLC_VEH   As String = "slcVehicule"
Private Const SLC_FUEL  As String = "slcCarburant"
Private Const SLC_PER   As String = "slcPeriode"   ' X39 P4 : controle Chronologie
Private Const TL_CACHE  As String = "tlPeriode"    ' X39 P4 : cache de la Chronologie
Private Const WS_DASH   As String = "Tableau de bord"
Private Const GS_SHEET  As String = "GS_Pleins"
Private Const SLC_COLS  As Long = 3            ' colonnes d'items dans chaque segment
Private Const ROW_GAP   As Single = 16         ' X39 dispo C : ecart vertical entre les 2 rangees
Private Const TL_ROW_H  As Single = 80         ' X39 dispo C : hauteur chronologie (rangee 2)
Private Const SLC_STYLE As String = "SlicerStyleLight5"      ' X39 : BLEU charte (accent du theme)
Private Const TL_STYLE  As String = "TimeSlicerStyleLight5"  ' X39 : chronologie en bleu
Private g_Applying As Boolean                  ' X39 P5 : anti-reentrance du recalcul
Private g_PeriodDefaultDone As Boolean         ' X39 : calage chronologie min<->max applique 1x/session
Private g_RebuildAt As Double                  ' X43 : echeance OnTime du rebuild debounce (0 = aucun planifie)
Private Const REBUILD_DELAY As Long = 1        ' X43 : secondes de coalescence (plancher fiable d'Application.OnTime)
' X43c : signature de rebuild (no-op skip + classification rsNone/rsTargeted/rsFull)
Private Const WS_CARB    As String = "Suivi Carburant"
Private Const T2_NAME    As String = "Tableau2"
Private Const SIG_SHEET  As String = "_GraphData"
Private Const SIG_CELL   As String = "ZZ1"

' Ouverture : recale B5/B6 sur les segments restaures par Excel puis reconstruit
' le tableau -> KPI synchronises sur le dernier vehicule/carburant selectionne.
Public Sub SyncFiltersAndRebuildOnOpen()
    On Error Resume Next
    Dim wsd As Worksheet: Set wsd = SheetByName(WS_DASH)
    If wsd Is Nothing Then Exit Sub
    Application.EnableEvents = False
    wsd.Range("B5").value = SlicerCsv("Vehicule")
    wsd.Range("B6").value = SlicerCsv("Carburant")
    WritePeriodFromTimeline wsd
    Application.EnableEvents = True
    modDashboardGraphiques.RecreerDashboardComplet
    WriteLastSignature ComputeRebuildSignature()   ' X43c : etat de reference apres rebuild d'ouverture
    On Error GoTo 0
End Sub


' --------------------------------------------------------------------------
'  POINT D'ENTREE : (re)construit toute la chaine de filtres
' --------------------------------------------------------------------------
Public Sub SetupFilterControls()
    On Error GoTo EH
    Application.ScreenUpdating = False
    RemoveFilterSlicers          ' enleve segments + caches existants (idempotence)
    RebuildFilterSrc             ' (re)cree _FilterSrc + tFilterSrc
    EnsureFilterPivot            ' (re)cree ptFiltres
    EnsureSlicers                ' cree slcVehicule + slcCarburant sur le dashboard
    Dim ws As Worksheet: Set ws = SheetByName(WS_SRC)
    If Not ws Is Nothing Then ws.visible = xlSheetHidden
    Application.ScreenUpdating = True
    Application.StatusBar = "Filtres (segments) installes."
    Exit Sub
EH:
    Application.ScreenUpdating = True
    Application.StatusBar = "[Filtres] Erreur " & Err.Number & " : " & Err.Description
End Sub

' --------------------------------------------------------------------------
'  P5 : applique les selections des segments -> B5/B6 -> recalcule tous les graphiques
'        (appele par Workbook_SheetPivotTableUpdate quand le TCD ptFiltres change)
' --------------------------------------------------------------------------
Public Sub ApplyFiltersFromControls()
    If g_Applying Then Exit Sub
    g_Applying = True
    Dim evt As Boolean: evt = Application.EnableEvents
    On Error GoTo done
    Dim wsd As Worksheet: Set wsd = SheetByName(WS_DASH)
    If wsd Is Nothing Then GoTo done
    ' X43 : events OFF pendant l'ecriture de B5/B6 -> evite le cascade
    '  Feuil3.Worksheet_Change(B2:B6) qui relancait un rebuild COMPLET a CHAQUE
    '  cellule ecrite (B5 puis B6) EN PLUS du rebuild explicite -> jusqu'a 3 rebuilds.
    Application.EnableEvents = False
    wsd.Range("B5").value = SlicerCsv("Vehicule")
    wsd.Range("B6").value = SlicerCsv("Carburant")
    WritePeriodFromTimeline wsd          ' X39 P4 : Chronologie -> PERIODE_DEB/FIN (B9/B10)
    Application.EnableEvents = evt
    ScheduleRebuild                      ' X43 : un SEUL rebuild, coalesce (debounce)
done:
    Application.EnableEvents = evt
    g_Applying = False
    On Error GoTo 0
End Sub

' X43 : (re)planifie le rebuild lourd apres un court delai. Chaque changement de
'  filtre ANNULE le rendez-vous precedent -> N changements rapides (ex. Vehicule
'  puis Carburant puis glissement de la Chronologie) = UN SEUL rebuild au lieu de N
'  (chacun ~20-30 s). Le rebuild reel est fait par DebouncedRebuild.
Private Sub ScheduleRebuild()
    On Error Resume Next
    CancelPendingRebuild
    g_RebuildAt = now + TimeSerial(0, 0, REBUILD_DELAY)
    Application.OnTime g_RebuildAt, "DebouncedRebuild"
    Application.StatusBar = "Filtre pris en compte - mise a jour du tableau de bord..."
    On Error GoTo 0
End Sub

' X43 : annule un rebuild planifie non encore declenche (idempotent).
Private Sub CancelPendingRebuild()
    If g_RebuildAt = 0 Then Exit Sub
    On Error Resume Next
    Application.OnTime g_RebuildAt, "DebouncedRebuild", , False
    On Error GoTo 0
    g_RebuildAt = 0
End Sub

' X43 : execute le rebuild differe (appele par Application.OnTime). Rebuild SILENCIEUX
'  (meme chemin que Feuil3.Worksheet_Change) : erreurs en barre d'etat, pas de MsgBox
'  modale. Events OFF pendant le rebuild -> ne re-declenche pas ApplyFiltersFromControls.
'  Sablier + barre d'etat -> supprime l'effet "fige" pendant les ~20-30 s de calcul.
Public Sub DebouncedRebuild()
    g_RebuildAt = 0
    ' X43c : signature -> sauter le rebuild si rien d'observable n'a change (no-op).
    Dim newSig As String: newSig = ComputeRebuildSignature()
    Dim scope As Long: scope = ClassifyFilterDelta(ReadLastSignature(), newSig)
    If scope = 0 Then
        Application.StatusBar = "Tableau de bord deja a jour (aucun changement)."
        Exit Sub
    End If
    Dim evt As Boolean: evt = Application.EnableEvents
    Dim cur As Long: cur = Application.Cursor
    On Error GoTo restore
    Application.EnableEvents = False
    Application.Cursor = xlWait
    Application.StatusBar = "Mise a jour du tableau de bord..."
    ' X43c-opt : rsCheap -> mini-rebuild des seuls objectifs (budget/CO2), sans
    '  re-parcourir les donnees ni recreer les graphiques (gain sur ajustement
    '  budget/CO2 seul). rsTargeted/rsFull : meme chemin complet pour cet increment.
    If scope = 3 Then
        Application.StatusBar = "Mise a jour des objectifs..."
        RefreshObjectifs
    Else
        Application.Run "CreerGraphiquesWeb", True    ' rebuild data + graphiques (silencieux)
        Application.Run "MAJ_Dashboard_Graphiques"    ' restyle + layout + KPI + panneaux + boutons
    End If
    WriteLastSignature newSig                     ' X43c : enregistre l'etat reconstruit (apres succes)
    Application.StatusBar = False
    Application.Cursor = cur
    Application.EnableEvents = evt
    On Error GoTo 0
    Exit Sub
restore:
    Application.StatusBar = False
    Application.Cursor = cur
    Application.EnableEvents = evt
    On Error GoTo 0
End Sub

' ============================================================
'  X43c : signature de rebuild (no-op skip + classification)
' ============================================================
' Signature = filtres (B5 veh / B6 carb / B9-B10 periode / B2 budget / B3 CO2 /
'  B4 annee) + empreinte des donnees source. Identique au dernier rebuild reussi
'  -> rien d'observable n'a change -> on saute (rsNone).
Private Function ComputeRebuildSignature() As String
    Dim wsd As Worksheet: Set wsd = SheetByName(WS_DASH)
    If wsd Is Nothing Then Exit Function
    ComputeRebuildSignature = _
        CStr(wsd.Range("B5").value) & vbTab & CStr(wsd.Range("B6").value) & vbTab & _
        CStr(wsd.Range("B9").value) & vbTab & CStr(wsd.Range("B10").value) & vbTab & _
        CStr(wsd.Range("B2").value) & vbTab & CStr(wsd.Range("B3").value) & vbTab & _
        CStr(wsd.Range("B4").value) & vbTab & SourceFingerprint()
End Function

' Empreinte legere des donnees source : nb lignes + max(Date)/max(Km) de Tableau2
'  + nb lignes de GS_Pleins. Un import de pleins la change -> rebuild force (pas
'  de no-op a tort).
Private Function SourceFingerprint() As String
    Dim s As String, lo As ListObject, ws As Worksheet
    On Error Resume Next
    Set ws = SheetByName(WS_CARB)
    If Not ws Is Nothing Then Set lo = ws.ListObjects(T2_NAME)
    If Not lo Is Nothing Then _
        s = "T2:" & RowsOf(lo) & "/" & MaxOf(lo, "Date") & "/" & MaxOf(lo, "Km compteur")
    Set lo = Nothing: Set ws = SheetByName(GS_SHEET)
    If Not ws Is Nothing Then Set lo = ws.ListObjects(1)
    If Not lo Is Nothing Then s = s & "|GS:" & RowsOf(lo)
    On Error GoTo 0
    SourceFingerprint = s
End Function

Private Function RowsOf(lo As ListObject) As Long
    On Error Resume Next
    If Not lo.DataBodyRange Is Nothing Then RowsOf = lo.DataBodyRange.Rows.count
    On Error GoTo 0
End Function

Private Function MaxOf(lo As ListObject, ByVal colName As String) As Double
    On Error Resume Next
    Dim c As Range: Set c = lo.ListColumns(colName).DataBodyRange
    If Not c Is Nothing Then MaxOf = Application.WorksheetFunction.Max(c)
    On Error GoTo 0
End Function

Private Function ReadLastSignature() As String
    On Error Resume Next
    Dim ws As Worksheet: Set ws = SheetByName(SIG_SHEET)
    If Not ws Is Nothing Then ReadLastSignature = CStr(ws.Range(SIG_CELL).value)
    On Error GoTo 0
End Function

Private Sub WriteLastSignature(ByVal sig As String)
    On Error Resume Next
    Dim ws As Worksheet: Set ws = SheetByName(SIG_SHEET)
    If ws Is Nothing Then Exit Sub
    ws.Range(SIG_CELL).value = "'" & sig
    On Error GoTo 0
End Sub

' rsNone(0)     : signatures identiques -> aucun rebuild.
' rsFull(2)     : empreinte source OU vehicule OU periode change -> tout en depend.
' rsTargeted(1) : carburant OU annee change (filtre/KPIs) -> chemin complet.
' rsCheap(3)    : X43c-opt -> SEULS budget/CO2 changent (carburant/annee/source/
'                 vehicule/periode inchanges, presence jauge budget preservee) ->
'                 recalcul des seules cellules objectif (cf. RefreshObjectifs).
Private Function ClassifyFilterDelta(ByVal oldSig As String, ByVal newSig As String) As Long
    If Len(newSig) > 0 And oldSig = newSig Then ClassifyFilterDelta = 0: Exit Function
    Dim o() As String, n() As String
    o = Split(oldSig, vbTab): n = Split(newSig, vbTab)
    If UBound(o) <> 7 Or UBound(n) <> 7 Then ClassifyFilterDelta = 2: Exit Function
    If n(7) <> o(7) Or n(0) <> o(0) Or n(2) <> o(2) Or n(3) <> o(3) Then
        ClassifyFilterDelta = 2          ' source / vehicule / periode -> FULL
    ElseIf n(1) = o(1) And n(6) = o(6) And BudgetSet(o(4)) = BudgetSet(n(4)) Then
        ClassifyFilterDelta = 3          ' X43c-opt : seuls budget/CO2 -> CHEAP
    Else
        ClassifyFilterDelta = 1          ' carburant ou annee -> TARGETED
    End If
End Function

' ============================================================
'  X43c-opt : mini-rebuild CHEAP (objectifs budget / CO2)
' ============================================================
' Recalcule uniquement les cellules OBJECTIF derivees des parametres, sans
'  re-parcourir les donnees ni recreer les graphiques : objectif CO2 cumule
'  (col E), objectif budget 6 mois (col U), jauge budget annuel (AD3). Les
'  graphiques lies a ces plages se redessinent seuls (calcul auto). Applicable
'  seulement quand SEULS B2/B3 ont change (cf. ClassifyFilterDelta = 3).
Public Sub RefreshObjectifs()
    Dim wsG As Worksheet: Set wsG = SheetByName(WS_DASH)
    If wsG Is Nothing Then Exit Sub
    Dim wsd As Worksheet: Set wsd = EnsureDataSheet()
    If wsd Is Nothing Then Exit Sub

    Dim budget As Double: budget = 0
    If IsNumeric(wsG.Range(CELL_BUDGET).value) Then budget = CDbl(wsG.Range(CELL_BUDGET).value)
    Dim co2Obj As Double: co2Obj = DEFAULT_CO2_OBJ
    If IsNumeric(wsG.Range(CELL_CO2OBJ).value) Then
        If wsG.Range(CELL_CO2OBJ).value > 0 Then co2Obj = CDbl(wsG.Range(CELL_CO2OBJ).value)
    End If

    ' Objectif CO2 cumule (col E) : cibleMois * rang, sur les lignes mensuelles ecrites
    Dim cibleMois As Double: cibleMois = co2Obj / 12
    Dim lastMonth As Long: lastMonth = wsd.Cells(wsd.Rows.count, 1).End(xlUp).Row
    Dim r As Long
    For r = 2 To lastMonth
        wsd.Cells(r, 5).value = Round(cibleMois * (r - 1), 1)
    Next r

    ' Objectif budget (col U) : budget sur les lignes budget existantes (col S)
    Dim lastBudg As Long: lastBudg = wsd.Cells(wsd.Rows.count, 19).End(xlUp).Row
    For r = 2 To lastBudg
        If budget > 0 Then
            wsd.Cells(r, 21).value = budget
        Else
            wsd.Cells(r, 21).ClearContents
        End If
    Next r

    ' Jauge budget annuel (AD3 = objectif x 12)
    wsd.Range("AD3").value = Round(budget * 12, 0)
End Sub

' X43c-opt : "budget renseigne" = valeur non vide et non nulle. Un franchissement
'  de ce seuil cree/supprime la jauge budget -> exige un rebuild complet, pas CHEAP.
Private Function BudgetSet(ByVal s As String) As Boolean
    s = Trim$(s)
    BudgetSet = (Len(s) > 0 And s <> "0" And Val(Replace(s, ",", ".")) <> 0)
End Function

' CSV des items SELECTIONNES d'un segment ; tous (ou aucun) coches -> "(tous)"
Private Function SlicerCsv(ByVal field As String) As String
    SlicerCsv = "(tous)"
    Dim sc As SlicerCache
    For Each sc In ThisWorkbook.SlicerCaches
        If sc.SourceName = field Then
            Dim total As Long, sel As Long, s As String, si As SlicerItem
            For Each si In sc.SlicerItems
                total = total + 1
                If si.selected Then
                    sel = sel + 1
                    If Len(s) > 0 Then s = s & ","
                    s = s & si.name
                End If
            Next si
            If sel > 0 And sel < total Then SlicerCsv = s
            Exit Function
        End If
    Next sc
End Function

' X39 P4 : lit la Chronologie (cache tlPeriode) -> ecrit PERIODE_DEB/FIN (B9/B10).
'  Chronologie absente ou etat illisible -> periode NON bornee (cellules videes).
'  Quand "tout" est selectionne, StartDate/EndDate = plage complete -> aucun effet.
Private Sub WritePeriodFromTimeline(wsd As Worksheet)
    Dim okR As Boolean: okR = False
    On Error Resume Next
    Dim sc As SlicerCache
    Set sc = ThisWorkbook.SlicerCaches(TL_CACHE)
    If Not sc Is Nothing Then
        Dim sdt As Variant, edt As Variant
        sdt = sc.TimelineState.StartDate
        edt = sc.TimelineState.EndDate
        If Err.Number = 0 Then
            If IsDate(sdt) And IsDate(edt) Then
                wsd.Range("B9").value = CDate(sdt)
                wsd.Range("B10").value = CDate(edt)
                okR = True
            End If
        End If
    End If
    Err.Clear
    On Error GoTo 0
    If Not okR Then
        wsd.Range("B9").ClearContents
        wsd.Range("B10").ClearContents
    End If
End Sub

' --------------------------------------------------------------------------
'  X39 : calage par defaut de la Chronologie a la 1re ouverture de l'onglet
' --------------------------------------------------------------------------
' A la 1re activation/session de l'onglet, cale slcPeriode sur [min ; max] des
'  dates de pleins (donnees REELLES du timeline = tFilterSrc <- GS_Pleins).
'  Evenements suspendus -> pas de cascade. Rebuild UNIQUEMENT si l'etat sauvegarde
'  bornait la periode (sinon plage complete = memes graphiques, rien a refaire).
'  Drapeau pose seulement apres calage reussi -> reessai si la chronologie absente.
Public Sub ApplyDefaultPeriodOnce()
    If g_PeriodDefaultDone Then Exit Sub
    Dim sc As SlicerCache
    On Error Resume Next
    Set sc = ThisWorkbook.SlicerCaches(TL_CACHE)
    On Error GoTo 0
    If sc Is Nothing Then Exit Sub                 ' chronologie absente -> reessai prochaine activation
    Dim dMin As Double, dMax As Double
    If Not PleinsDateSpan(dMin, dMax) Then Exit Sub ' aucune date -> reessai plus tard
    dMin = Int(dMin): dMax = Int(dMax)             ' JOURS PLEINS : SetFilterDateRange ignore (no-op) une borne a heure (ex. 02:00)

    Dim wsd As Worksheet: Set wsd = SheetByName(WS_DASH)
    ' l'etat sauvegarde borne-t-il la periode (plus etroite que la plage complete) ?
    Dim narrowed As Boolean
    If Not wsd Is Nothing Then
        Dim b9 As Variant, b10 As Variant
        b9 = wsd.Range("B9").value: b10 = wsd.Range("B10").value
        If IsDate(b9) Then If CDbl(CDate(b9)) > dMin + 0.5 Then narrowed = True
        If IsDate(b10) Then If CDbl(CDate(b10)) < dMax - 0.5 Then narrowed = True
    End If

    Dim evt As Boolean: evt = Application.EnableEvents
    On Error GoTo restore
    Application.EnableEvents = False                ' events OFF : le rebuild ne declenche pas ApplyFiltersFromControls
    sc.TimelineState.SetFilterDateRange CDate(dMin), CDate(dMax)   ' poignees sur 1er/dernier plein (jours pleins)
    If Not wsd Is Nothing Then
        wsd.Range("B9").ClearContents              ' plage complete = periode NON bornee -> tous les pleins
        wsd.Range("B10").ClearContents             '  (evite d'exclure un plein dont la date porte une heure)
    End If
    g_PeriodDefaultDone = True                      ' calage reussi -> respecter les reglages manuels ensuite
    ' si l'etat sauvegarde bornait la periode -> reconstruire les series (sinon deja complet)
    If narrowed Then Application.Run "RecreerDashboardComplet"
    Application.EnableEvents = evt
    On Error GoTo 0
    Exit Sub
restore:
    Application.EnableEvents = evt
    On Error GoTo 0
End Sub

' X39 : min/max des dates de pleins. Priorite tFilterSrc (donnees REELLES du timeline,
'  dates garanties dans sa plage) ; repli GS_Pleins (table maitre des pleins).
Private Function PleinsDateSpan(ByRef dMin As Double, ByRef dMax As Double) As Boolean
    If ScanDateColumn(WS_SRC, T_SRC, "Date", dMin, dMax) Then
        PleinsDateSpan = True
    ElseIf ScanDateColumn(GS_SHEET, GS_SHEET, "Date", dMin, dMax) Then
        PleinsDateSpan = True
    End If
End Function

' Min/max (serials) de la colonne <colName> de la table <loName> sur la feuille <wsName>.
Private Function ScanDateColumn(wsName As String, loName As String, colName As String, ByRef dMin As Double, ByRef dMax As Double) As Boolean
    Dim ws As Worksheet: Set ws = SheetByName(wsName)
    If ws Is Nothing Then Exit Function
    Dim lo As ListObject
    On Error Resume Next
    Set lo = ws.ListObjects(loName)
    On Error GoTo 0
    If lo Is Nothing Then Exit Function
    If lo.DataBodyRange Is Nothing Then Exit Function
    Dim ci As Long: ci = LCIdxF(lo, colName)
    If ci = 0 Then Exit Function
    Dim cel As Range, mn As Double, mx As Double, found As Boolean
    For Each cel In lo.ListColumns(ci).DataBodyRange.Cells
        If IsDate(cel.value) Then
            Dim d As Double: d = CDbl(CDate(cel.value))
            If Not found Then
                mn = d: mx = d: found = True
            Else
                If d < mn Then mn = d
                If d > mx Then mx = d
            End If
        End If
    Next cel
    If found Then dMin = mn: dMax = mx
    ScanDateColumn = found
End Function

' --------------------------------------------------------------------------
'  X39 : rafraichit les DONNEES de filtre a CHAQUE ouverture de l'onglet
' --------------------------------------------------------------------------
' Reecrit tFilterSrc EN PLACE depuis GS_Pleins (+ seeds carburants canoniques)
'  puis rafraichit le cache du TCD -> segments Vehicule/Carburant ET chronologie
'  refletent les imports recents (sinon figes au dernier SetupFilterControls).
'  EN PLACE (ClearContents + Resize + reecriture) : ne detruit NI la table NI le
'  pivot NI la chronologie COM (contrairement a RebuildFilterSrc qui Unlist/Clear).
'  Events suspendus -> le refresh ne declenche pas ApplyFiltersFromControls.
Public Sub RefreshFilterData()
    Dim evt As Boolean: evt = Application.EnableEvents
    On Error GoTo done
    Dim wsG As Worksheet: Set wsG = SheetByName(GS_SHEET)
    Dim wsS As Worksheet: Set wsS = SheetByName(WS_SRC)
    If wsG Is Nothing Or wsS Is Nothing Then Exit Sub
    Dim loG As ListObject, loS As ListObject
    On Error Resume Next
    Set loG = wsG.ListObjects(GS_SHEET)
    Set loS = wsS.ListObjects(T_SRC)
    On Error GoTo done
    If loG Is Nothing Or loS Is Nothing Then Exit Sub
    If loG.DataBodyRange Is Nothing Then Exit Sub

    Dim ciD As Long, ciV As Long, ciT As Long
    ciD = LCIdxF(loG, "Date"): ciV = LCIdxF(loG, "Vehicule"): ciT = LCIdxF(loG, "Type")
    If ciD = 0 Or ciV = 0 Or ciT = 0 Then Exit Sub
    Dim a As Variant: a = loG.DataBodyRange.value
    Dim n As Long: n = UBound(a, 1)

    Dim tmp() As Variant: ReDim tmp(1 To n + 6, 1 To 3)
    Dim w As Long, r As Long
    For r = 1 To n
        If IsDate(a(r, ciD)) Then
            Dim v As String: v = Trim$(CStr(a(r, ciV)))
            If Len(v) > 0 Then
                w = w + 1
                tmp(w, 1) = CDate(a(r, ciD))
                tmp(w, 2) = v
                tmp(w, 3) = FuelKeyF(CStr(a(r, ciT)))
            End If
        End If
    Next r
    If w = 0 Then Exit Sub

    ' seeds carburants canoniques (memes regles que RebuildFilterSrc)
    Dim present As Object: Set present = CreateObject("Scripting.Dictionary")
    Dim k As Long
    For k = 1 To w: present(UCase$(CStr(tmp(k, 3)))) = True: Next k
    Dim canon As Variant: canon = Array("E85", "SP95", "SP98", "E10", "GAZOLE", "GPLc")
    Dim sd As Variant: sd = tmp(1, 1)
    Dim sv As String: sv = CStr(tmp(1, 2))
    Dim fc As Long
    For fc = LBound(canon) To UBound(canon)
        If Not present.Exists(UCase$(CStr(canon(fc)))) Then
            w = w + 1
            tmp(w, 1) = sd: tmp(w, 2) = sv: tmp(w, 3) = canon(fc)
        End If
    Next fc

    ' compacter en exactement w lignes (sinon on reecrirait des lignes vides)
    Dim body() As Variant: ReDim body(1 To w, 1 To 3)
    Dim i As Long
    For i = 1 To w
        body(i, 1) = tmp(i, 1): body(i, 2) = tmp(i, 2): body(i, 3) = tmp(i, 3)
    Next i

    Application.EnableEvents = False
    Application.ScreenUpdating = False
    If Not loS.DataBodyRange Is Nothing Then loS.DataBodyRange.ClearContents
    loS.Resize loS.HeaderRowRange.Resize(w + 1, 3)     ' header + w lignes (EN PLACE)
    loS.DataBodyRange.value = body
    wsS.Columns(1).NumberFormat = "dd/mm/yyyy"
    Dim pt As PivotTable: Set pt = GetFilterPivot()
    If Not pt Is Nothing Then pt.PivotCache.Refresh     ' -> segments + chronologie a jour
done:
    On Error Resume Next
    Application.ScreenUpdating = True
    Application.EnableEvents = evt
    On Error GoTo 0
End Sub

' --------------------------------------------------------------------------
'  P1 : source tFilterSrc (Date | Vehicule | Carburant normalise) depuis GS_Pleins
' --------------------------------------------------------------------------
Public Sub RebuildFilterSrc()
    Dim wsG As Worksheet: Set wsG = SheetByName(GS_SHEET)
    If wsG Is Nothing Then Exit Sub
    Dim lo As ListObject
    On Error Resume Next
    Set lo = wsG.ListObjects(GS_SHEET)
    On Error GoTo 0
    If lo Is Nothing Then Exit Sub
    If lo.DataBodyRange Is Nothing Then Exit Sub

    Dim ciD As Long, ciV As Long, ciT As Long
    ciD = LCIdxF(lo, "Date"): ciV = LCIdxF(lo, "Vehicule"): ciT = LCIdxF(lo, "Type")
    If ciD = 0 Or ciV = 0 Or ciT = 0 Then Exit Sub
    Dim a As Variant: a = lo.DataBodyRange.value
    Dim n As Long: n = UBound(a, 1)

    Dim ws As Worksheet: Set ws = SheetByName(WS_SRC)
    If ws Is Nothing Then
        Set ws = ThisWorkbook.Worksheets.Add(After:=ThisWorkbook.Sheets(ThisWorkbook.Sheets.count))
        ws.name = WS_SRC
    End If
    ws.visible = xlSheetVisible
    ' purge ancienne table + contenu
    On Error Resume Next
    Dim oldLo As ListObject
    For Each oldLo In ws.ListObjects: oldLo.Unlist: Next oldLo
    Dim pt As PivotTable
    For Each pt In ws.PivotTables: pt.TableRange2.Clear: Next pt
    ws.Cells.Clear
    On Error GoTo 0

    ws.Range("A1:C1").value = Array("Date", "Vehicule", "Carburant")
    Dim r As Long, w As Long: w = 1
    For r = 1 To n
        If IsDate(a(r, ciD)) Then
            Dim v As String: v = Trim$(CStr(a(r, ciV)))
            If Len(v) > 0 Then
                w = w + 1
                ws.Cells(w, 1).value = CDate(a(r, ciD))
                ws.Cells(w, 2).value = v
                ws.Cells(w, 3).value = FuelKeyF(CStr(a(r, ciT)))
            End If
        End If
    Next r

    ' X39 : seed des carburants POSSIBLES (meme sans plein) pour le segment Carburant,
    '        en reutilisant date + vehicule reels -> ne pollue ni Vehicule ni la chronologie.
    If w >= 2 Then
        Dim canon As Variant: canon = Array("E85", "SP95", "SP98", "E10", "GAZOLE", "GPLc")
        Dim present As Object: Set present = CreateObject("Scripting.Dictionary")
        Dim rr As Long
        For rr = 2 To w: present(UCase$(CStr(ws.Cells(rr, 3).value))) = True: Next rr
        Dim seedDate As Variant: seedDate = ws.Cells(2, 1).value
        Dim seedVeh As String: seedVeh = CStr(ws.Cells(2, 2).value)
        Dim fc As Long
        For fc = LBound(canon) To UBound(canon)
            If Not present.Exists(UCase$(CStr(canon(fc)))) Then
                w = w + 1
                ws.Cells(w, 1).value = seedDate
                ws.Cells(w, 2).value = seedVeh
                ws.Cells(w, 3).value = canon(fc)
            End If
        Next fc
    End If
    ws.Columns(1).NumberFormat = "dd/mm/yyyy"
    If w >= 2 Then
        Dim lo2 As ListObject
        Set lo2 = ws.ListObjects.Add(xlSrcRange, ws.Range(ws.Cells(1, 1), ws.Cells(w, 3)), , xlYes)
        lo2.name = T_SRC
    End If
End Sub

' --------------------------------------------------------------------------
'  P2 : TCD cache ptFiltres sur tFilterSrc (hote des segments + chronologie)
' --------------------------------------------------------------------------
Public Sub EnsureFilterPivot()
    Dim ws As Worksheet: Set ws = SheetByName(WS_SRC)
    If ws Is Nothing Then Exit Sub
    Dim lo As ListObject
    On Error Resume Next
    Set lo = ws.ListObjects(T_SRC)
    On Error GoTo 0
    If lo Is Nothing Then Exit Sub

    On Error Resume Next
    Dim oldpt As PivotTable
    For Each oldpt In ws.PivotTables
        If oldpt.name = PT_NAME Then oldpt.TableRange2.Clear
    Next oldpt
    On Error GoTo 0

    Dim pc As PivotCache
    Set pc = ThisWorkbook.PivotCaches.Create(xlDatabase, T_SRC)
    Dim npt As PivotTable
    Set npt = pc.CreatePivotTable(ws.Range("F1"), PT_NAME)
    npt.PivotFields("Vehicule").Orientation = xlRowField
    npt.AddDataField npt.PivotFields("Carburant"), "n", xlCount
End Sub

' --------------------------------------------------------------------------
'  P3 : Segments Vehicule + Carburant sur le Tableau de bord
' --------------------------------------------------------------------------
Public Sub EnsureSlicers()
    Dim wsd As Worksheet: Set wsd = SheetByName(WS_DASH)
    If wsd Is Nothing Then Exit Sub
    Dim pt As PivotTable: Set pt = GetFilterPivot()
    If pt Is Nothing Then Exit Sub

    Dim topY As Single: topY = KpiBottom(wsd) + 8
    Dim leftX As Single: leftX = 270

    Dim scV As SlicerCache, scF As SlicerCache
    Set scV = ThisWorkbook.SlicerCaches.Add2(pt, "Vehicule")
    Dim slV As Slicer
    Set slV = scV.Slicers.Add(wsd, , SLC_VEH, "Vehicule", topY, leftX, 150, 84)
    Set scF = ThisWorkbook.SlicerCaches.Add2(pt, "Carburant")
    Dim slF As Slicer
    Set slF = scF.Slicers.Add(wsd, , SLC_FUEL, "Carburant", topY, leftX + 158, 150, 84)

    On Error Resume Next
    slV.Style = SLC_STYLE: slF.Style = SLC_STYLE
    slV.NumberOfColumns = SLC_COLS: slF.NumberOfColumns = SLC_COLS
    wsd.Shapes(SLC_VEH).Placement = xlFreeFloating
    wsd.Shapes(SLC_FUEL).Placement = xlFreeFloating
    On Error GoTo 0
End Sub

' X39 dispo C : chronologie en bleu (style natif bleu ; repli silencieux).
Private Sub StyleTimelineBlue()
    On Error Resume Next
    ThisWorkbook.SlicerCaches(TL_CACHE).Slicers(1).Style = TL_STYLE
    On Error GoTo 0
End Sub

' X39 dispo C : applique un style a tous les segments d'un champ (par SourceName).
Private Sub StyleSlicerCache(field As String, sty As String)
    Dim sc As SlicerCache, sl As Slicer
    On Error Resume Next
    For Each sc In ThisWorkbook.SlicerCaches
        If sc.SourceName = field Then
            For Each sl In sc.Slicers: sl.Style = sty: Next sl
        End If
    Next sc
    On Error GoTo 0
End Sub

' --------------------------------------------------------------------------
'  Positionne les 2 segments dans la bande reservee + premier plan
' --------------------------------------------------------------------------
Public Sub PlaceSlicers(ws As Worksheet, ByVal topY As Single, ByVal leftX As Single, ByVal bandW As Single)
    On Error Resume Next
    ' X39 dispo C : 2 rangees. rightEdge = bord droit de la bande (avant ajustement leftX).
    Dim rightEdge As Single: rightEdge = leftX + bandW
    ' commencer apres la sidebar (rail d'icones a gauche)
    Dim sbR As Single: sbR = SidebarRight(ws)
    If sbR > leftX And sbR < 140 Then leftX = sbR + 6
    Dim gap As Single: gap = 16
    ' 3 controles ALIGNES sur 1 rangee, occupant la largeur du bandeau (chacun ~1/3)
    Dim wEach As Single: wEach = (rightEdge - leftX - 2 * gap) / 3
    ' meme hauteur pour les 2 segments = la plus haute des deux
    Dim hU As Single: hU = SlicerH(ItemCount("Vehicule"))
    Dim hF As Single: hF = SlicerH(ItemCount("Carburant"))
    If hF > hU Then hU = hF
    ' X39 dispo C : (re)applique le style BLEU charte a CHAQUE MAJ (les segments
    '  existants conservaient sinon l'ancien style orange cree a l'origine).
    StyleSlicerCache "Vehicule", SLC_STYLE
    StyleSlicerCache "Carburant", SLC_STYLE
    Dim sh As Shape
    Set sh = ws.Shapes(SLC_VEH)
    If Not sh Is Nothing Then ApplySlicerBox sh, leftX, topY, wEach, hU
    Set sh = Nothing
    Set sh = ws.Shapes(SLC_FUEL)
    If Not sh Is Nothing Then ApplySlicerBox sh, leftX + wEach + gap, topY, wEach, hU
    ' X39 : Chronologie sur la MEME rangee (3e tiers), alignee avec les 2 segments
    Set sh = Nothing
    Set sh = ws.Shapes(SLC_PER)
    If Not sh Is Nothing Then
        ApplySlicerBox sh, leftX + 2 * (wEach + gap), topY, wEach - 8, hU
        StyleTimelineBlue
    End If
    On Error GoTo 0
End Sub

Private Sub ApplySlicerBox(sh As Shape, ByVal L As Single, ByVal T As Single, ByVal wd As Single, ByVal ht As Single)
    On Error Resume Next
    sh.Left = L: sh.top = T: sh.Width = wd: sh.Height = ht
    sh.Placement = xlFreeFloating: sh.ZOrder msoBringToFront
    On Error GoTo 0
End Sub

' Hauteur de la bande = max des 2 segments (+ marge). Appelee par BuildHeaderAndKPIs.
Public Function SegBandHeight() As Single
    Dim a As Single: a = SlicerH(ItemCount("Vehicule"))
    Dim b As Single: b = SlicerH(ItemCount("Carburant"))
    Dim m As Single: m = a: If b > m Then m = b
    ' X39 : 1 rangee (les 3 controles alignes) -> hauteur du plus haut + marge
    SegBandHeight = m + 8
End Function

Private Function SlicerH(ByVal n As Long) As Single
    If n < 1 Then n = 1
    Dim rows As Long: rows = (n + SLC_COLS - 1) \ SLC_COLS
    If rows > 5 Then rows = 5            ' au-dela : barre de defilement
    SlicerH = 22 + rows * 22 + 11        ' entete + lignes + marge
End Function

Private Function ItemCount(ByVal field As String) As Long
    Dim sc As SlicerCache
    On Error Resume Next
    For Each sc In ThisWorkbook.SlicerCaches
        If sc.SourceName = field Then ItemCount = sc.SlicerItems.count: Exit Function
    Next sc
    On Error GoTo 0
End Function

Private Function SidebarRight(ws As Worksheet) As Single
    Dim r As Single: r = 0
    Dim sh As Shape
    On Error Resume Next
    For Each sh In ws.Shapes
        If Left$(sh.name, 3) = "sb_" Then
            If sh.visible Then
                If sh.Left + sh.Width > r Then r = sh.Left + sh.Width
            End If
        End If
    Next sh
    On Error GoTo 0
    SidebarRight = r
End Function

' Cree les filtres si absents (1x) puis positionne au 1er plan. Appele par MAJ.
Public Sub EnsureFilterUI(ws As Worksheet, ByVal topY As Single, ByVal leftX As Single, ByVal bandW As Single)
    Dim sh As Shape
    On Error Resume Next
    Set sh = ws.Shapes(SLC_VEH)
    On Error GoTo 0
    If sh Is Nothing Then SetupFilterControls
    PlaceSlicers ws, topY, leftX, bandW
End Sub

' --------------------------------------------------------------------------
'  Nettoyage : enleve les 2 segments + leurs caches (idempotence)
' --------------------------------------------------------------------------
Public Sub RemoveFilterSlicers()
    On Error Resume Next
    Dim wsd As Worksheet: Set wsd = SheetByName(WS_DASH)
    If Not wsd Is Nothing Then
        wsd.Shapes(SLC_VEH).Delete          ' un segment EST une shape (msoSlicer)
        wsd.Shapes(SLC_FUEL).Delete
    End If
    ' supprimer les caches devenus orphelins (0 segment) — parcours a rebours
    Dim i As Long
    For i = ThisWorkbook.SlicerCaches.count To 1 Step -1
        If ThisWorkbook.SlicerCaches(i).Slicers.count = 0 Then ThisWorkbook.SlicerCaches(i).Delete
    Next i
    On Error GoTo 0
End Sub

' --------------------------------------------------------------------------
'  Helpers
' --------------------------------------------------------------------------
Private Function GetFilterPivot() As PivotTable
    Dim ws As Worksheet: Set ws = SheetByName(WS_SRC)
    If ws Is Nothing Then Exit Function
    Dim pt As PivotTable
    On Error Resume Next
    For Each pt In ws.PivotTables
        If pt.name = PT_NAME Then Set GetFilterPivot = pt: Exit Function
    Next pt
    On Error GoTo 0
End Function

Private Function KpiBottom(ws As Worksheet) As Single
    Dim mb As Single: mb = 118
    Dim sh As Shape
    For Each sh In ws.Shapes
        If sh.name = "dash_kpi" Then
            If sh.top + sh.Height > mb Then mb = sh.top + sh.Height
        End If
    Next sh
    KpiBottom = mb
End Function

Private Function SheetByName(nm As String) As Worksheet
    On Error Resume Next
    Set SheetByName = ThisWorkbook.Worksheets(nm)
    On Error GoTo 0
End Function

Private Function LCIdxF(lo As ListObject, nm As String) As Long
    Dim c As ListColumn
    For Each c In lo.ListColumns
        If LCase$(Trim$(c.name)) = LCase$(Trim$(nm)) Then LCIdxF = c.Index: Exit Function
    Next c
End Function

Private Function FuelKeyF(T As String) As String
    Dim s As String: s = LCase$(Trim$(T))
    If InStr(s, "e85") > 0 Then FuelKeyF = "E85": Exit Function
    If InStr(s, "gazole") > 0 Or InStr(s, "diesel") > 0 Then FuelKeyF = "GAZOLE": Exit Function
    If InStr(s, "sp98") > 0 Or InStr(s, "s98") > 0 Or InStr(s, "98") > 0 Then FuelKeyF = "SP98": Exit Function
    If InStr(s, "e10") > 0 Then FuelKeyF = "E10": Exit Function
    If InStr(s, "sp95") > 0 Or InStr(s, "s95") > 0 Or InStr(s, "95") > 0 Then FuelKeyF = "SP95": Exit Function
    If InStr(s, "gpl") > 0 Then FuelKeyF = "GPLc": Exit Function
    FuelKeyF = UCase$(s)
End Function

