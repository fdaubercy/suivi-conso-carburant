' ============================================================
'  A COLLER dans le module de la FEUILLE "Graphiques"
'  (Double-clic sur "Graphiques" dans l'explorateur VBA, sous
'   "Microsoft Excel Objects" — PAS dans un module standard)
'  v4.8.0.0
'
'  But : le tableau de bord se met a jour SANS manipulation de
'  l'utilisateur, simplement en ouvrant l'onglet "Graphiques".
'  - Recreation silencieuse (pas de MsgBox).
'  - Anti-rebond : au plus une regeneration toutes les 15 s, pour
'    ne pas relancer le calcul a chaque clic sur l'onglet.
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

    modDashboardGraphiques.MAJ_Dashboard_Graphiques
    On Error GoTo 0
End Sub
