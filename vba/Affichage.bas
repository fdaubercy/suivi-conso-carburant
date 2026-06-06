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


' ════════════════════════════════════════════════════════════
'  BOUTON "Quitter le plein ecran" sur les onglets
'  En mode plein ecran le ruban est masque -> on pose une icone
'  cliquable (haut-droite, ligne 1) qui appelle DesactiverPleinEcran.
'  Le raccourci Ctrl+F11 reste disponible en complement.
' ════════════════════════════════════════════════════════════

' Pose (ou rafraichit) le bouton sur UNE feuille. Idempotent.
Public Sub AjouterBoutonPleinEcran(ws As Worksheet)
    Dim sh As Shape, L As Single
    On Error Resume Next
    ' Retire un eventuel bouton precedent (evite les doublons apres rebuild).
    For Each sh In ws.Shapes
        If sh.Name = "btnPleinEcran" Then sh.Delete
    Next sh
    ' Haut-droite, ligne 1 : a droite des titres, au-dessus des boutons de feuille.
    L = ws.Cells(1, 11).Left      ' colonne K
    Set sh = ws.Shapes.AddShape(msoShapeRoundedRectangle, L, 3, 150, 22)
    sh.Name = "btnPleinEcran"
    With sh
        .Fill.ForeColor.RGB = RGB(27, 58, 92)        ' bleu charte
        .Line.Visible = msoFalse
        With .TextFrame2
            .TextRange.Text = ChrW(&H2196&) & " Quitter le plein ecran"
            .TextRange.Font.Fill.ForeColor.RGB = RGB(255, 255, 255)
            .TextRange.Font.Bold = msoTrue
            .TextRange.Font.Size = 9
            .TextRange.ParagraphFormat.Alignment = msoAlignCenter
            .HorizontalAnchor = msoAnchorCenter
            .VerticalAnchor = msoAnchorMiddle
        End With
        .OnAction = "DesactiverPleinEcran"
        .AlternativeText = "Revenir a l'affichage normal (equivaut a Ctrl+F11)"
    End With
    On Error GoTo 0
End Sub

' Pose le bouton sur tous les onglets du dashboard miroir presents.
' Pose egalement le bouton hamburger de navigation (modNavMenu).
Public Sub PoserBoutonsPleinEcran()
    Dim noms As Variant, i As Long, ws As Worksheet, n As Long
    noms = Array("Accueil", "Reglages", "Historique", "Carte", "Tableau de bord", _
                 "Suivi Carburant", "Prix par Station")
    For i = LBound(noms) To UBound(noms)
        Set ws = Nothing
        On Error Resume Next
        Set ws = ThisWorkbook.Worksheets(CStr(noms(i)))
        On Error GoTo 0
        If Not ws Is Nothing Then
            AjouterBoutonPleinEcran ws
            n = n + 1
        End If
    Next i
    Application.StatusBar = "[Affichage] " & ChrW(10003&) & " Bouton 'Quitter le plein ecran' pose sur " & n & " onglet(s)."

    ' Boutons hamburger ☰ de navigation (modNavMenu, tolerant si module absent)
    On Error Resume Next
    Application.Run "modNavMenu.PoserBoutonsNavMenu"
    On Error GoTo 0
End Sub
