' ============================================================
'  A COLLER dans le module de la feuille "Carte"
'  (clic droit sur l'onglet Carte -> Visualiser le code)
'  Ne PAS importer : colle uniquement le contenu ci-dessous.
'  v1.0.0.0
'
'  Met a jour le tableau des prix moyens automatiquement quand on
'  change le carburant dans la cellule C3 (Carte_Fuel).
'  (Si le module de la feuille a deja "Option Explicit", ne pas le re-coller.)
' ============================================================
Option Explicit

Private Sub Worksheet_Change(ByVal Target As Range)
    If Intersect(Target, Me.Range("C3")) Is Nothing Then Exit Sub
    Application.EnableEvents = False
    On Error Resume Next
    RafraichirTableauCarte
    On Error GoTo 0
    Application.EnableEvents = True
End Sub
