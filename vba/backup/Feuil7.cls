VERSION 1.0 CLASS
BEGIN
  MultiUse = -1  'True
END
Attribute VB_Name = "Feuil7"
Attribute VB_GlobalNameSpace = False
Attribute VB_Creatable = False
Attribute VB_PredeclaredId = True
Attribute VB_Exposed = True
' ============================================================
'  OPTIONNEL - A COLLER dans le module de la feuille "Reglages"
'  (clic droit sur l'onglet Reglages -> Visualiser le code)
'  Ne PAS importer : colle uniquement le contenu ci-dessous.
'  v1.0.0.0
'
'  Rafraichit l'affichage des 4 parametres metier (kit/budget/CO2/
'  surconso) depuis leurs cellules sources a chaque ouverture de la
'  feuille, pour refleter une eventuelle MAJ venue de l'app.
' ============================================================
Option Explicit

Private Sub Worksheet_Activate()
    On Error Resume Next
    ReglagePullParametres
    On Error GoTo 0
End Sub

