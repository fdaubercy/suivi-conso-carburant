Attribute VB_Name = "modNavMenu"
' ============================================================
'  MODULE : modNavMenu
'  Objectif : Menu hamburger (?) accessible depuis tous les
'             onglets en mode plein ecran.
'
'  INSTALLATION (une seule fois) :
'    1. Alt+F11 -> Fichier -> Importer modNavMenu.bas
'    2. Alt+F8  -> PoserBoutonsNavMenu
'    (Prerequis : "Acces approuve au modele objet du projet VBA")
'
'  USAGE :
'    ShowNavMenu        -> ouvre le panneau de navigation
'    PoserBoutonsNavMenu -> place le bouton ? sur tous les onglets
'    NavToSheetPublic   -> cible des boutons du UserForm
' ============================================================
Option Explicit

Private Const FORM_NAME As String = "frmNavMenu"
Private Const BTN_NAME  As String = "btnNavMenu"

' Feuilles a afficher dans le menu (ordre + titre + macro cible)
Private Const NAV_COUNT As Integer = 6


' ------------------------------------------------------------
'  POINT D'ENTREE : ouvrir le menu hamburger
' ------------------------------------------------------------
Public Sub ShowNavMenu()
    On Error GoTo ErrH

    If Not FormExiste() Then
        If Not AccesVBProjectOK() Then
            MsgBox "Pour creer le menu, activez une fois :" & vbNewLine & vbNewLine & _
                   "Fichier > Options > Centre de gestion de la confidentialite >" & vbNewLine & _
                   "Parametres du Centre... > Parametres des macros >" & vbNewLine & _
                   "COCHER 'Acces approuve au modele objet du projet VBA'." & vbNewLine & vbNewLine & _
                   "Puis relancez la macro.", vbExclamation, "Navigation"
            Exit Sub
        End If
        ConstruireFormNav
    End If

    VBA.UserForms.Add(FORM_NAME).Show
    Exit Sub
ErrH:
    SetStatus "[NavMenu] " & ChrW(9888) & " Erreur " & Err.Number & " : " & Err.Description
End Sub


' ------------------------------------------------------------
'  CIBLE DES BOUTONS DU USERFORM (Public = accessible depuis
'  le code-behind injecte dans frmNavMenu)
' ------------------------------------------------------------
Public Sub NavToSheetPublic(sName As String)
    On Error Resume Next
    ThisWorkbook.Sheets(sName).Activate
    On Error GoTo 0
End Sub


' ------------------------------------------------------------
'  POSER LE BOUTON ? SUR TOUS LES ONGLETS DU DASHBOARD
' ------------------------------------------------------------
Public Sub PoserBoutonsNavMenu()
    Dim noms As Variant, i As Long, ws As Worksheet, n As Long
    noms = Array("Accueil", "Tableau de bord", "Carte", "Reglages", _
                 "Suivi Carburant", "Prix par Station")
    For i = LBound(noms) To UBound(noms)
        Set ws = Nothing
        On Error Resume Next
        Set ws = ThisWorkbook.Worksheets(CStr(noms(i)))
        On Error GoTo 0
        If Not ws Is Nothing Then
            AjouterBoutonNavMenu ws
            n = n + 1
        End If
    Next i
    Application.StatusBar = "[NavMenu] " & ChrW(10003) & " Bouton ? pose sur " & n & " onglet(s)."
End Sub


' Pose (ou rafraichit) le bouton ? sur UNE feuille. Idempotent.
Public Sub AjouterBoutonNavMenu(ws As Worksheet)
    Dim sh As Shape
    On Error Resume Next
    For Each sh In ws.Shapes
        If sh.name = BTN_NAME Then sh.Delete
    Next sh
    On Error GoTo 0

    Set sh = ws.Shapes.AddShape(msoShapeRoundedRectangle, 4, 3, 32, 22)
    sh.name = BTN_NAME
    With sh
        .fill.ForeColor.RGB = RGB(29, 158, 117)      ' vert #1D9E75
        .Line.Visible = msoFalse
        .Adjustments.Item(1) = 0.3
        With .TextFrame2
            .TextRange.text = ChrW(9776)             ' ?
            .TextRange.Font.fill.ForeColor.RGB = RGB(255, 255, 255)
            .TextRange.Font.bold = msoTrue
            .TextRange.Font.Size = 13
            .TextRange.ParagraphFormat.Alignment = msoAlignCenter
            .HorizontalAnchor = msoAnchorCenter
            .VerticalAnchor = msoAnchorMiddle
            .MarginLeft = 0
            .MarginRight = 0
            .MarginTop = 0
            .MarginBottom = 0
        End With
        .OnAction = "modNavMenu.ShowNavMenu"
        .AlternativeText = "Ouvrir le menu de navigation"
        .Placement = xlFreeFloating
    End With
End Sub


' ------------------------------------------------------------
'  CONSTRUCTION DU USERFORM PAR CODE
' ------------------------------------------------------------
Private Sub ConstruireFormNav()
    Dim vbc As Object, dz As Object

    ' Supprimer une eventuelle version precedente
    On Error Resume Next
    ThisWorkbook.VBProject.VBComponents.Remove _
        ThisWorkbook.VBProject.VBComponents(FORM_NAME)
    On Error GoTo 0

    Dim DARK  As Long: DARK = RGB(27, 58, 92)       ' #1B3A5C
    Dim WHITE As Long: WHITE = RGB(255, 255, 255)
    Dim FW    As Integer: FW = 280   ' W73-bis : elargi 210->280 pour eviter debordement

    Set vbc = ThisWorkbook.VBProject.VBComponents.Add(3)  ' vbext_ct_MSForm
    vbc.name = FORM_NAME
    With vbc
        .Properties("Caption") = "Navigation"
        .Properties("Width") = FW
        .Properties("Height") = 30
        .Properties("BackColor") = DARK
        .Properties("BorderStyle") = 0   ' fmBorderStyleNone
    End With
    Set dz = vbc.Designer

    ' --- En-tete ---
    Dim hdr As Object
    Set hdr = dz.Controls.Add("Forms.Label.1")
    With hdr
        .name = "lblHdr"
        .caption = ChrW(9776) & "   Navigation"
        .Left = 0: .Top = 0: .Width = FW: .Height = 30
        .ForeColor = WHITE
        .BackColor = RGB(18, 40, 65)     ' #12283E encore plus fonce
        .BackStyle = 1
        .Font.Size = 11: .Font.bold = True
        .Font.name = "Calibri"
        .TextAlign = 2   ' fmTextAlignCenter
    End With

    ' --- Boutons de navigation ---
    ' Format : icone(code), libelle, feuille cible, couleur fond
    Dim icons(5) As Long, labels(5) As String, targets(5) As String, clrs(5) As Long

    icons(0) = &H1F3E0:  labels(0) = "  Accueil":           targets(0) = "Accueil"
    icons(1) = &H1F4CA:  labels(1) = "  Tableau de bord":   targets(1) = "Tableau de bord"
    icons(2) = &H1F5FA:  labels(2) = "  Carte":             targets(2) = "Carte"
    icons(3) = &H26FD:   labels(3) = "  Suivi Carburant":   targets(3) = "Suivi Carburant"
    icons(4) = &H1F4B6:  labels(4) = "  Prix par Station":  targets(4) = "Prix par Station"
    icons(5) = &H2699:   labels(5) = "  Reglages":          targets(5) = "Reglages"

    clrs(0) = RGB(46, 117, 182)    ' #2E75B6 bleu
    clrs(1) = RGB(29, 158, 117)    ' #1D9E75 vert
    clrs(2) = RGB(217, 119, 6)     ' #D97706 orange
    clrs(3) = RGB(46, 117, 182)    ' #2E75B6 bleu
    clrs(4) = RGB(124, 58, 237)    ' #7C3AED violet
    clrs(5) = RGB(75, 85, 99)      ' #4B5563 gris

    Dim y As Long: y = 36
    Dim i As Integer
    Dim ctl As Object
    For i = 0 To 5
        Set ctl = dz.Controls.Add("Forms.CommandButton.1")
        With ctl
            .name = "btn" & i
            .caption = Emo(icons(i)) & labels(i)
            .Left = 10: .Top = y: .Width = FW - 20: .Height = 28
            .BackColor = clrs(i)
            .ForeColor = WHITE
            .Font.Size = 9
            .Font.name = "Calibri"
            .Font.bold = False
        End With
        y = y + 32
    Next i

    ' --- Separateur ---
    Dim sep As Object
    Set sep = dz.Controls.Add("Forms.Label.1")
    With sep
        .name = "lblSep"
        .caption = ""
        .Left = 0: .Top = y + 2: .Width = FW: .Height = 1
        .BackColor = RGB(60, 100, 140)
        .BackStyle = 1
    End With

    ' --- Bouton Fermer ---
    Set ctl = dz.Controls.Add("Forms.CommandButton.1")
    With ctl
        .name = "btnFermer"
        .caption = ChrW(10005) & "  Fermer"
        .Left = 10: .Top = y + 8: .Width = FW - 20: .Height = 22
        .BackColor = RGB(45, 45, 60)
        .ForeColor = RGB(160, 185, 210)
        .Font.Size = 8
        .Font.name = "Calibri"
    End With

    ' Ajuster la hauteur du formulaire
    vbc.Properties("Height") = y + 40

    ' Injecter le code-behind
    InjecterCodeNav vbc, targets
End Sub


' ------------------------------------------------------------
'  INJECTION DU CODE-BEHIND (handlers des boutons)
' ------------------------------------------------------------
Private Sub InjecterCodeNav(vbc As Object, targets() As String)
    Dim c As Object: Set c = vbc.CodeModule
    c.DeleteLines 1, c.CountOfLines

    Dim code As String
    code = "Option Explicit" & vbLf
    code = code & "Private Sub UserForm_Initialize()" & vbLf
    code = code & "    Me.StartUpPosition = 1" & vbLf   ' centre sur la fenetre Excel
    code = code & "End Sub" & vbLf

    Dim i As Integer
    For i = 0 To 5
        code = code & "Private Sub btn" & i & "_Click()" & vbLf
        code = code & "    Me.Hide" & vbLf
        code = code & "    modNavMenu.NavToSheetPublic """ & targets(i) & """" & vbLf
        code = code & "    Unload Me" & vbLf
        code = code & "End Sub" & vbLf
    Next i

    code = code & "Private Sub btnFermer_Click(): Unload Me: End Sub" & vbLf

    c.AddFromString code
End Sub


' ------------------------------------------------------------
'  UTILITAIRES
' ------------------------------------------------------------
' Encode un code point Unicode (y compris > U+FFFF via paire de substitution)
Private Function Emo(ByVal cp As Long) As String
    If cp <= &HFFFF& Then
        Emo = ChrW(cp)
    Else
        Dim v As Long: v = cp - &H10000
        Emo = ChrW(&HD800 + (v \ &H400)) & ChrW(&HDC00 + (v And &H3FF))
    End If
End Function

Private Function FormExiste() As Boolean
    Dim vbc As Object
    On Error Resume Next
    Set vbc = ThisWorkbook.VBProject.VBComponents(FORM_NAME)
    FormExiste = Not (vbc Is Nothing)
    On Error GoTo 0
End Function

Private Function AccesVBProjectOK() As Boolean
    On Error Resume Next
    Dim n As Long: n = ThisWorkbook.VBProject.VBComponents.count
    AccesVBProjectOK = (Err.Number = 0)
    Err.Clear
End Function


