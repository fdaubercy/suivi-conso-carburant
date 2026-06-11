' ============================================================
'  A COLLER dans le module de la FEUILLE du tableau de bord
'  (ex-"Graphiques", renommée "Tableau de bord" — X36).
'  Double-clic sur la feuille dans l'explorateur VBA, sous
'  "Microsoft Excel Objects" — PAS dans un module standard.
'  v4.11.0.0
'
'  But : le tableau de bord se met a jour SANS manipulation,
'  simplement en ouvrant l'onglet, ET reagit au changement des
'  selecteurs Vehicule (B5) / Carburant (B6) + parametres (B2:B4).
'  - Recreation silencieuse (pas de MsgBox).
'  - Anti-rebond : au plus une regeneration toutes les 15 s sur
'    l'activation (pour ne pas relancer a chaque clic sur l'onglet).
'  - Changement B2:B6 -> rebuild des donnees filtrees + restyle.
' ============================================================
Option Explicit

Private mLastRefresh As Double   ' horodatage (Timer) de la derniere regeneration

Private Sub Worksheet_Activate()
    On Error Resume Next
    ' Anti-rebond : Timer() = secondes depuis minuit ; tolere le passage minuit
    Dim now As Double: now = Timer
    If mLastRefresh > 0 Then
        Dim delta As Double: delta = now - mLastRefresh
        If delta >= 0 And delta < 15 Then Exit Sub
    End If
    mLastRefresh = now

    modFiltres.RefreshFilterData                 ' X39 : tFilterSrc + cache a jour -> segments & chronologie refletent les imports
    modDashboardGraphiques.MAJ_Dashboard_Graphiques
    modFiltres.ApplyDefaultPeriodOnce            ' X39 : 1re ouverture onglet -> chronologie calee sur min<->max des pleins
    On Error GoTo 0
End Sub

' X36 : changement d'un parametre/selecteur (B2 budget, B3 objectif CO2,
' B4 annee, B5 vehicule, B6 carburant) -> recalcul COMPLET (donnees filtrees
' + graphiques) puis restyle du dashboard. EnableEvents desactive pour eviter
' toute recursion (EnsureSelectors peut reecrire B5/B6).
Private Sub Worksheet_Change(ByVal Target As Range)
    On Error GoTo done
    If Intersect(Target, Me.Range("B2:B6")) Is Nothing Then Exit Sub

    Application.EnableEvents = False
    modGraphiques.CreerGraphiquesWeb silent:=True   ' rebuild _GraphData filtré + graphiques
    modDashboardGraphiques.MAJ_Dashboard_Graphiques ' KPI/méta filtrés + mise en page
    mLastRefresh = Timer
done:
    Application.EnableEvents = True
End Sub
