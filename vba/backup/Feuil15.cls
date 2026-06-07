VERSION 1.0 CLASS
BEGIN
  MultiUse = -1  'True
END
Attribute VB_Name = "Feuil15"
Attribute VB_GlobalNameSpace = False
Attribute VB_Creatable = False
Attribute VB_PredeclaredId = True
Attribute VB_Exposed = True
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

Private Sub Worksheet_Change(ByVal target As Range)
    If Intersect(target, Me.Range("C3")) Is Nothing Then Exit Sub
    Application.EnableEvents = False
    On Error Resume Next
    RafraichirTableauCarte
    On Error GoTo 0
    Application.EnableEvents = True
End Sub

