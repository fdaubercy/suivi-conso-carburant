Attribute VB_Name = "Affichage"
Option Explicit

' ============================================================
'  MODULE : PleinEcran (objet VBA : "Affichage")
'  Objectif : Basculer Excel en mode plein écran (kiosk)
'             et restaurer l'interface normale.
'
'  Appelé par ThisWorkbook :
'    Workbook_Open       -> Call ActiverPleinEcran (+ OnKey Ctrl+F11)
'    Workbook_BeforeClose-> Call DesactiverPleinEcran
'  Raccourci Ctrl+F11    -> BasculerPleinEcran
'
'  NB : récupéré du classeur (snapshot v4.7.0.0) et versionné ici en
'  v4.14.0.2 — ce module n'avait jamais été commité (il ne vivait que
'  dans le .xlsm), ce qui l'avait rendu vulnérable à une suppression.
' ============================================================

' -- Activer le mode plein écran ------------------------------
Sub ActiverPleinEcran()
    On Error GoTo ErrHandler

    With Application
        .DisplayFullScreen = True       ' Mode plein écran natif Excel
        .DisplayFormulaBar = False      ' Masquer la barre de formule
        .DisplayStatusBar = False       ' Masquer la barre d'état (bas)
        .ShowMenuFloaties = False       ' Désactiver les mini-menus
        .CommandBars("Ribbon").Visible = False  ' Masquer le Ruban
    End With

    ' Masquer les onglets de feuilles et barres de défilement
    With ActiveWindow
        .DisplayWorkbookTabs = False    ' Masquer les onglets
        .DisplayHorizontalScrollBar = False
        .DisplayVerticalScrollBar = False
        .DisplayHeadings = False        ' Masquer les en-têtes lignes/colonnes
        .DisplayGridlines = False       ' Optionnel : masquer la grille
    End With

    Exit Sub
ErrHandler:
    MsgBox "Erreur lors de l'activation : " & Err.Description, vbCritical
End Sub


' -- Désactiver le mode plein écran (restaurer) ---------------
Sub DesactiverPleinEcran()
    On Error GoTo ErrHandler

    With Application
        .DisplayFullScreen = False
        .DisplayFormulaBar = True
        .DisplayStatusBar = True
        .ShowMenuFloaties = True
        .CommandBars("Ribbon").Visible = True
    End With

    With ActiveWindow
        .DisplayWorkbookTabs = True
        .DisplayHorizontalScrollBar = True
        .DisplayVerticalScrollBar = True
        .DisplayHeadings = True
        .DisplayGridlines = True
    End With

    Exit Sub
ErrHandler:
    MsgBox "Erreur lors de la restauration : " & Err.Description, vbCritical
End Sub


' -- Bascule toggle (un appel = ON, suivant = OFF) ------------
Sub BasculerPleinEcran()
    If Application.DisplayFullScreen Then
        Call DesactiverPleinEcran
    Else
        Call ActiverPleinEcran
    End If
End Sub
