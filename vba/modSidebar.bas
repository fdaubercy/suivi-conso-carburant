Attribute VB_Name = "modSidebar"
' ============================================================
'  modSidebar — Navigation horizontale (Option B)
'  Barre fixe en haut de chaque feuille.
'  Clic item => navigation directe. Zero survol, zero timer.
' ============================================================
Option Explicit

Private Const NAV_COUNT As Integer = 6
Private Const BAR_H     As Single = 40    ' hauteur visuelle barre (pts)
Private Const ITEM_W    As Single = 108   ' largeur visuelle d'un item (pts)
Private Const ITEM_H    As Single = 30    ' hauteur visuelle d'un item (pts)
Private Const BAR_TOP   As Single = 3     ' marge haute visuelle (pts)
Private Const BAR_PAD   As Single = 8     ' padding gauche avant les items (pts)
Private Const ITEM_GAP  As Single = 4     ' espace entre items (pts)
Private Const BAR_W     As Single = 3000  ' largeur fond — couvre tout ecran
Private Const NAV_PFX   As String = "sb_nav_"
Private Const SB_BG     As String = "sb_bg"

' =========================================================================
'  UTILITAIRES
' =========================================================================

Private Function ZoomFactor() As Single
    On Error Resume Next
    Dim z As Single: z = Application.ActiveWindow.Zoom / 100!
    On Error GoTo 0
    If z <= 0 Then z = 1
    ZoomFactor = z
End Function

Private Function WS_REGLAGES() As String
    WS_REGLAGES = "R" & ChrW(233) & "glages"
End Function

Private Function C_BG() As Long: C_BG = RGB(27, 58, 92):       End Function
Private Function C_ITEM() As Long: C_ITEM = RGB(15, 34, 55):    End Function
Private Function C_GRN() As Long: C_GRN = RGB(29, 158, 117):    End Function
Private Function C_WHT() As Long: C_WHT = RGB(255, 255, 255): End Function
Private Function C_DIM() As Long: C_DIM = RGB(150, 180, 210): End Function

Private Function GetShape(ws As Worksheet, nm As String) As Shape
    On Error Resume Next: Set GetShape = ws.Shapes(nm): On Error GoTo 0
End Function

Private Function Emo(ByVal cp As Long) As String
    If cp <= &HFFFF& Then
        Emo = ChrW(cp)
    Else
        Dim v As Long: v = cp - &H10000
        Emo = ChrW(&HD800& Or (v \ &H400&)) & ChrW(&HDC00& Or (v And &H3FF&))
    End If
End Function

' =========================================================================
'  API PUBLIQUE
' =========================================================================

Public Sub ShowSidebar()
    PoserSidebarSurTousLesOnglets
    MarquerOngletActif
End Sub

Public Sub HideSidebar()
    Dim ws As Worksheet, j As Long
    For Each ws In ThisWorkbook.Worksheets
        For j = ws.Shapes.count To 1 Step -1
            If Left$(ws.Shapes(j).name, 3) = "sb_" Then ws.Shapes(j).Delete
        Next j
    Next ws
End Sub

' Stubs de compatibilite (ancienne sidebar mobile — plus utilises)
Public Sub ToggleSidebar():   End Sub
Public Sub CollapseSidebar(): End Sub
Public Sub ExpandSidebar():   End Sub

' Appele par Workbook_SheetActivate
Public Sub RepositionSidebar()
    MarquerOngletActif
End Sub

Public Sub NavToFromSidebar(ByVal Target As String)
    On Error Resume Next
    ThisWorkbook.Sheets(Target).Activate
    On Error GoTo 0
End Sub

Public Sub NavSidebar_0(): NavToFromSidebar "Accueil":          End Sub
Public Sub NavSidebar_1(): NavToFromSidebar "Tableau de bord":  End Sub
Public Sub NavSidebar_2(): NavToFromSidebar "Carte":            End Sub
Public Sub NavSidebar_3(): NavToFromSidebar "Suivi Carburant":  End Sub
Public Sub NavSidebar_4(): NavToFromSidebar "Prix par Station": End Sub
Public Sub NavSidebar_5(): NavToFromSidebar WS_REGLAGES():      End Sub

' Met a jour la surbrillance de l'onglet actif sur toutes les feuilles
Public Sub MarquerOngletActif()
    Dim actName As String
    On Error Resume Next: actName = ActiveSheet.name: On Error GoTo 0
    Dim tgts(5) As String
    tgts(0) = "Accueil":          tgts(1) = "Tableau de bord"
    tgts(2) = "Carte":            tgts(3) = "Suivi Carburant"
    tgts(4) = "Prix par Station": tgts(5) = WS_REGLAGES()
    Dim ws As Worksheet
    For Each ws In ThisWorkbook.Worksheets
        Dim k As Integer
        For k = 0 To NAV_COUNT - 1
            Dim nav As Shape: Set nav = GetShape(ws, NAV_PFX & k)
            If Not nav Is Nothing Then
                Dim isAct As Boolean: isAct = (tgts(k) = actName)
                nav.fill.ForeColor.RGB = IIf(isAct, C_GRN(), C_ITEM())
                With nav.TextFrame2.TextRange
                    .Font.fill.ForeColor.RGB = IIf(isAct, C_WHT(), C_DIM())
                    .Font.bold = IIf(isAct, msoTrue, msoFalse)
                End With
            End If
        Next k
    Next ws
End Sub

' Recreer la barre sur toutes les feuilles (zoom correct par feuille)
Public Sub PoserSidebarSurTousLesOnglets()
    Dim noms As Variant
    noms = Array("Accueil", "Tableau de bord", "Carte", WS_REGLAGES(), _
                 "Suivi Carburant", "Prix par Station", "Hist. Carburant")
    Dim origWs As Worksheet
    On Error Resume Next: Set origWs = ActiveSheet: On Error GoTo 0
    Application.ScreenUpdating = False
    Dim i As Long, ws As Worksheet
    For i = LBound(noms) To UBound(noms)
        Set ws = Nothing
        On Error Resume Next: Set ws = ThisWorkbook.Worksheets(CStr(noms(i))): On Error GoTo 0
        If Not ws Is Nothing Then
            ws.Activate
            On Error Resume Next
            PoserSidebarSurFeuille ws, ZoomFactor()
            On Error GoTo 0
        End If
    Next i
    If Not origWs Is Nothing Then
        On Error Resume Next: origWs.Activate: On Error GoTo 0
    End If
    Application.ScreenUpdating = True
End Sub

Public Sub PoserSidebarSurFeuille(ws As Worksheet, Optional zOverride As Single = 0)
    ' Supprimer tous les anciens shapes sb_ (ancienne sidebar + nouveau)
    On Error Resume Next
    Dim j As Long
    For j = ws.Shapes.count To 1 Step -1
        If Left$(ws.Shapes(j).name, 3) = "sb_" Then ws.Shapes(j).Delete
    Next j
    On Error GoTo 0

    Dim z As Single: z = IIf(zOverride > 0, zOverride, ZoomFactor())

    ' Dimensions en points document (/ z pour compenser le zoom et rester
    ' visuellement constant quelle que soit la valeur de zoom de la feuille)
    Dim bH   As Single: bH = BAR_H / z
    Dim iW   As Single: iW = ITEM_W / z
    Dim iH   As Single: iH = ITEM_H / z
    Dim bT   As Single: bT = BAR_TOP / z
    Dim bWd  As Single: bWd = BAR_W / z
    Dim padL As Single: padL = BAR_PAD / z
    Dim gap  As Single: gap = ITEM_GAP / z
    Dim iTop As Single: iTop = bT + (bH - iH) / 2   ' centrage vertical

    ' -- Fond de barre
    Dim bg As Shape
    Set bg = ws.Shapes.AddShape(msoShapeRectangle, 0, bT, bWd, bH)
    bg.name = SB_BG: bg.Placement = xlFreeFloating
    bg.fill.ForeColor.RGB = C_BG(): bg.Line.visible = msoFalse
    ' Bandeau toujours en arriere-plan : les boutons d'action propres a une
    ' feuille (ex. GS_Pleins : Synchroniser / Nouveau plein / Supprimer) restent
    ' visibles DEVANT la barre. Sans ca, la recreation de la sidebar a chaque
    ' activation de feuille repassait le fond bleu par-dessus et les masquait.
    bg.ZOrder msoSendToBack

    ' -- Labels et cibles de navigation
    Dim labels(5) As String, tgts(5) As String
    labels(0) = Emo(&H1F3E0) & " Accueil":          tgts(0) = "Accueil"
    labels(1) = Emo(&H1F4CA) & " Tableau de bord":  tgts(1) = "Tableau de bord"
    labels(2) = Emo(&H1F5FA) & " Carte":            tgts(2) = "Carte"
    labels(3) = Emo(&H26FD) & " Suivi Carburant":   tgts(3) = "Suivi Carburant"
    labels(4) = Emo(&H1F4B6) & " Prix / Station":   tgts(4) = "Prix par Station"
    labels(5) = Emo(&H2699) & " R" & ChrW(233) & "glages": tgts(5) = WS_REGLAGES()

    Dim actName As String
    On Error Resume Next: actName = ActiveSheet.name: On Error GoTo 0

    Dim x As Single: x = padL
    Dim k As Integer
    For k = 0 To NAV_COUNT - 1
        Dim isAct As Boolean: isAct = (tgts(k) = actName)
        Dim nav As Shape
        Set nav = ws.Shapes.AddShape(msoShapeRoundedRectangle, x, iTop, iW, iH)
        nav.name = NAV_PFX & k: nav.Placement = xlFreeFloating
        nav.fill.ForeColor.RGB = IIf(isAct, C_GRN(), C_ITEM())
        nav.Line.visible = msoFalse
        nav.OnAction = "modSidebar.NavSidebar_" & k
        With nav.TextFrame2
            ' Pas de retour a la ligne : le libelle reste sur UNE ligne et reste
            ' integralement visible (sinon "Tableau de bord"/"Reglages" se coupaient).
            .WordWrap = msoFalse
            .TextRange.text = labels(k)
            .TextRange.Font.fill.ForeColor.RGB = IIf(isAct, C_WHT(), C_DIM())
            .TextRange.Font.Size = 10
            ' Mesurer en GRAS (cas le plus large) : ainsi le surlignage de l'onglet
            ' actif (qui met le texte en gras) ne deborde jamais de son bouton.
            .TextRange.Font.bold = msoTrue
            .TextRange.ParagraphFormat.Alignment = msoAlignCenter
            .HorizontalAnchor = 2: .VerticalAnchor = 3
            .MarginLeft = 10 / z: .MarginRight = 10 / z
            .MarginTop = 0: .MarginBottom = 0
            ' Largeur du bouton = largeur du texte (une ligne) + marges.
            .AutoSize = msoAutoSizeShapeToFitText
        End With
        ' +24 pt visuels de securite : certains emojis (maison, carte...) s'affichent
        ' plus larges qu'Excel ne les MESURE -> sans cette marge, le libelle se tronque.
        Dim wReal As Single: wReal = nav.Width + 24 / z
        nav.TextFrame2.AutoSize = msoAutoSizeNone
        nav.Height = iH                              ' hauteur uniforme conservee
        nav.Width = wReal
        nav.top = iTop
        nav.Adjustments(1) = 0.25
        ' Retablir l'etat gras reel (mesure faite en gras pour tous).
        nav.TextFrame2.TextRange.Font.bold = IIf(isAct, msoTrue, msoFalse)
        x = x + wReal + gap                          ' avancer selon largeur reelle
    Next k
    ' Pass 2 : re-distribuer SANS chevauchement (largeurs finales reelles)
    Dim xx As Single: xx = padL
    Dim kk As Integer
    For kk = 0 To NAV_COUNT - 1
        Dim nv As Shape: Set nv = GetShape(ws, NAV_PFX & kk)
        If Not nv Is Nothing Then
            nv.Left = xx
            xx = xx + nv.Width + gap
        End If
    Next kk
End Sub



