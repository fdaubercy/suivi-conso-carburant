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


' ============================================================
'  BOUTON "Quitter le plein ecran" sur les onglets
'  En mode plein ecran le ruban est masque -> on pose une icone
'  cliquable (haut-droite, ligne 1) qui appelle DesactiverPleinEcran.
'  Le raccourci Ctrl+F11 reste disponible en complement.
' ============================================================

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

' ============================================================
'  AUTO-ZOOM : adapte le zoom de l'onglet actif pour que la largeur
'  du contenu (UsedRange) soit entierement visible.
'  Appele par Workbook_SheetActivate (ThisWorkbook).
' ============================================================
Public Sub AutoZoomFitWidth()
    On Error Resume Next
    Dim wb As Window: Set wb = Application.ActiveWindow
    If wb Is Nothing Then Exit Sub
    Dim ws As Worksheet: Set ws = ActiveSheet
    If ws Is Nothing Then Exit Sub
    Dim usedW As Double: usedW = ws.UsedRange.Width
    If usedW < 10 Then Exit Sub          ' feuille vide ou non calculee
    Dim winW As Double: winW = wb.Width - 18   ' -18 : approximation barre de defilement
    If winW < 100 Then Exit Sub
    Dim z As Long: z = CLng(winW / usedW * 100)
    z = Application.Max(50, Application.Min(200, z))
    wb.Zoom = z
    On Error Resume Next
    modSidebar.PoserSidebarSurFeuille ActiveSheet
    On Error GoTo 0
End Sub

' ============================================================
'  AUTO-ZOOM PAR ONGLET : lit le nb de colonnes cible depuis la
'  feuille Reglages (named range Zoom_TableStart).
'  Repli sur AutoZoomFitWidth si l'onglet n'est pas configure.
' ============================================================
Public Sub AutoZoomFitCols()
    On Error Resume Next
    Dim wb As Window: Set wb = Application.ActiveWindow
    If wb Is Nothing Then Exit Sub
    Dim ws As Worksheet: Set ws = ActiveSheet
    If ws Is Nothing Then Exit Sub

    Dim nCols As Long: nCols = ZoomColsForSheet(ws.Name)
    If nCols = 0 Then
        AutoZoomFitWidth
        Exit Sub
    End If

    Dim totalW As Double: totalW = 0
    Dim c As Long
    For c = 1 To nCols
        totalW = totalW + ws.Columns(c).Width
    Next c
    If totalW < 10 Then Exit Sub

    Dim winW As Double: winW = wb.Width - 18
    If winW < 100 Then Exit Sub

    Dim z As Long: z = CLng(winW / totalW * 100)
    z = Application.Max(50, Application.Min(200, z))
    wb.Zoom = z
    On Error Resume Next
    modSidebar.PoserSidebarSurFeuille ActiveSheet
    On Error GoTo 0
End Sub

Private Function ZoomColsForSheet(ByVal shName As String) As Long
    ZoomColsForSheet = 0
    On Error Resume Next
    Dim nm As Name: Set nm = ThisWorkbook.Names("Zoom_TableStart")
    If nm Is Nothing Then Exit Function
    Dim startRng As Range: Set startRng = nm.RefersToRange
    If startRng Is Nothing Then Exit Function
    On Error GoTo 0

    Dim wsReg As Worksheet: Set wsReg = startRng.Parent
    Dim r0 As Long:    r0 = startRng.Row
    Dim cNm As Long:   cNm = startRng.Column       ' col B : nom de feuille
    Dim cCols As Long: cCols = startRng.Column + 2 ' col D : nb colonnes cibles

    Dim i As Long
    For i = 0 To 19
        On Error Resume Next
        Dim v As String: v = CStr(wsReg.Cells(r0 + i, cNm).Value)
        On Error GoTo 0
        If Len(Trim$(v)) = 0 Then Exit For
        If StrComp(v, shName, vbTextCompare) = 0 Then
            On Error Resume Next
            ZoomColsForSheet = CLng(wsReg.Cells(r0 + i, cCols).Value)
            On Error GoTo 0
            Exit Function
        End If
    Next i
End Function

' Pose le bouton sur tous les onglets du dashboard miroir presents.
Public Sub PoserBoutonsPleinEcran()
    Dim noms As Variant, i As Long, ws As Worksheet, n As Long
    noms = Array("Accueil", "R" & ChrW(233) & "glages", "Hist. Carburant", "Carte", "Tableau de bord", _
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
End Sub
