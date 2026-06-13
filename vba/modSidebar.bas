Attribute VB_Name = "modSidebar"
' ============================================================
'  MODULE : modSidebar -- Sidebar navigation (Variante C)
'  Shapes fixes sur chaque onglet, sans UserForm.
'
'  PUBLIC :
'    ShowSidebar / HideSidebar / RepositionSidebar / ToggleSidebar
'    ExpandSidebar / CollapseSidebar / NavToFromSidebar(target)
'    NavSidebar_0..5        (OnAction des shapes icone/label)
'    PreviewSidebar_0..5    (OnAction : apercu titre par icone)
'    MarquerOngletActif
'    PoserSidebarSurTousLesOnglets / PoserSidebarSurFeuille(ws, zOverride)
' ============================================================
Option Explicit

' -- Dimensions en points ecran (invariants par rapport au zoom) --
Private Const W_COLLAPSED  As Single = 44
Private Const W_EXPANDED   As Single = 220
Private Const H_HAM        As Single = 36
Private Const H_ITEM       As Single = 38
Private Const SB_TOP       As Single = 6
Private Const ANIM_STEP    As Single = 22
Private Const AUTO_CLOSE_S As Integer = 4
Private Const NAV_COUNT    As Integer = 6
Private Const PREVIEW_DELAY As Integer = 2   ' secondes avant auto-repli du preview d'icone

Private Const SB_BG    As String = "sb_bg"
Private Const SB_HAM   As String = "sb_ham"
Private Const SB_HDR   As String = "sb_hdr"

Private g_Expanded  As Boolean
Private g_TimerTime As Date
Private g_TimerSet  As Boolean

' Etat pour le preview d'icone (clic individuel)
Private g_PreviewIdx    As Integer  ' index de l'icone en preview (-1 = aucun)
Private g_PreviewTimer  As Date
Private g_PreviewSet    As Boolean
Private g_PreviewSheet  As String   ' nom de la feuille du preview en cours

' Snapshot geometrie exacte de l'icone en apercu (corrige le decalage au repli)
Private g_SnapSet As Boolean
Private g_SnapW As Single, g_SnapH As Single, g_SnapL As Single, g_SnapT As Single
Private g_SnapIdx As Integer

' -- Facteur de zoom courant (1.0 = 100%) --------------------
Private Function ZoomFactor() As Single
    On Error Resume Next
    Dim z As Single: z = Application.ActiveWindow.Zoom / 100!
    On Error GoTo 0
    If z <= 0 Then z = 1
    ZoomFactor = z
End Function

' -- Calcule le zoom cible pour une feuille depuis la table Reglages --
Private Function ZoomForSheet(wsName As String) As Single
    Dim nCols As Long: nCols = ZoomColsFromReglages(wsName)
    If nCols = 0 Then
        ZoomForSheet = ZoomFactor()
        Exit Function
    End If

    Dim ws As Worksheet
    On Error Resume Next
    Set ws = ThisWorkbook.Worksheets(wsName)
    On Error GoTo 0
    If ws Is Nothing Then ZoomForSheet = ZoomFactor(): Exit Function

    Dim totalW As Double: totalW = 0
    Dim c As Long
    For c = 1 To nCols
        totalW = totalW + ws.Columns(c).Width
    Next c
    If totalW < 10 Then ZoomForSheet = ZoomFactor(): Exit Function

    Dim winW As Double
    On Error Resume Next
    winW = Application.ActiveWindow.Width - 18
    On Error GoTo 0
    If winW < 100 Then ZoomForSheet = ZoomFactor(): Exit Function

    Dim z As Single
    z = CSng(winW / totalW)
    z = CSng(Application.Max(0.5, Application.Min(2!, z)))
    ZoomForSheet = z
End Function

' -- Lit le nb de colonnes cible depuis Zoom_TableStart (Reglages) --
Private Function ZoomColsFromReglages(wsName As String) As Long
    ZoomColsFromReglages = 0
    On Error Resume Next
    Dim nm As Name: Set nm = ThisWorkbook.Names("Zoom_TableStart")
    If nm Is Nothing Then Exit Function
    Dim startRng As Range: Set startRng = nm.RefersToRange
    If startRng Is Nothing Then Exit Function
    On Error GoTo 0

    Dim wsReg As Worksheet: Set wsReg = startRng.Parent
    Dim r0 As Long: r0 = startRng.Row
    Dim cNm As Long: cNm = startRng.Column
    Dim cCols As Long: cCols = startRng.Column + 2

    Dim i As Long
    For i = 0 To 19
        Dim v As String
        On Error Resume Next
        v = CStr(wsReg.Cells(r0 + i, cNm).Value)
        On Error GoTo 0
        If Len(Trim$(v)) = 0 Then Exit For
        If StrComp(v, wsName, vbTextCompare) = 0 Then
            On Error Resume Next
            ZoomColsFromReglages = CLng(wsReg.Cells(r0 + i, cCols).Value)
            On Error GoTo 0
            Exit Function
        End If
    Next i
End Function

' -- Dimensions converties en pts feuille (doc coords) -------
Private Function DocW_Coll(z As Single) As Single: DocW_Coll = W_COLLAPSED / z: End Function
Private Function DocW_Exp(z As Single) As Single: DocW_Exp = W_EXPANDED / z: End Function
Private Function DocH_Ham(z As Single) As Single: DocH_Ham = H_HAM / z: End Function
Private Function DocH_Item(z As Single) As Single: DocH_Item = H_ITEM / z: End Function
Private Function DocSB_Top(z As Single) As Single: DocSB_Top = SB_TOP / z: End Function
Private Function DocAnim(z As Single) As Single: DocAnim = ANIM_STEP / z: End Function

' -- Nom de l'onglet Reglages (avec accent via ChrW) ---------
Private Function WS_REGLAGES() As String
    WS_REGLAGES = "R" & ChrW(233) & "glages"
End Function

' -- Couleurs (via charte si disponible) ---------------------
Private Function C_BG() As Long
    On Error Resume Next: C_BG = modCharte.CharteColor("Primaire"): On Error GoTo 0
    If C_BG = 0 Then C_BG = RGB(27, 58, 92)
End Function
Private Function C_BG2() As Long: C_BG2 = RGB(18, 40, 65):   End Function
Private Function C_GRN() As Long
    On Error Resume Next: C_GRN = modCharte.CharteColor("Vert"): On Error GoTo 0
    If C_GRN = 0 Then C_GRN = RGB(29, 158, 117)
End Function
Private Function C_WHT() As Long: C_WHT = RGB(255, 255, 255): End Function
Private Function C_SEP() As Long: C_SEP = RGB(50, 80, 115):   End Function

' =========================================================================
'  POINTS D'ENTREE PUBLICS
' =========================================================================

Public Sub ShowSidebar()
    PoserSidebarSurTousLesOnglets
    MarquerOngletActif
End Sub

Public Sub HideSidebar()
    If g_TimerSet Then CancelTimer
    CancelPreviewTimer
    Dim ws As Worksheet
    Dim j As Long
    For Each ws In ThisWorkbook.Worksheets
        For j = ws.Shapes.Count To 1 Step -1
            If Left$(ws.Shapes(j).Name, 3) = "sb_" Then ws.Shapes(j).Delete
        Next j
    Next ws
    g_Expanded = False
End Sub

' Appele par Workbook_SheetActivate : replie la sidebar sur changement d'onglet.
Public Sub RepositionSidebar()
    CancelTimer
    CancelPreviewTimer
    g_Expanded = False
    HideIconColumn ActiveSheet
    MarquerOngletActif
End Sub

Public Sub ToggleSidebar()
    If g_Expanded Then CollapseSidebar Else ExpandSidebar
End Sub

' Clic hamburger : affiche la colonne d'icones (pas les libelles)
Public Sub ExpandSidebar()
    If g_Expanded Then
        CancelTimer
        SetCollapseTimer
        Exit Sub
    End If
    g_Expanded = True
    Dim ws As Worksheet: Set ws = ActiveSheet
    Dim bg As Shape: Set bg = GetShape(ws, SB_BG)
    If bg Is Nothing Then Exit Sub
    bg.Visible = msoTrue
    Dim sepH As Shape: Set sepH = GetShape(ws, "sb_sep_h")
    If Not sepH Is Nothing Then sepH.Visible = msoTrue
    Application.ScreenUpdating = True
    Dim k As Integer
    For k = 0 To NAV_COUNT - 1
        Dim ico As Shape: Set ico = GetShape(ws, "sb_ico_" & k)
        Dim sep As Shape: Set sep = GetShape(ws, "sb_sep_" & k)
        If Not ico Is Nothing Then ico.Visible = msoTrue
        If Not sep Is Nothing Then sep.Visible = msoTrue
        DoEvents
    Next k
    SetCollapseTimer
End Sub

' Replie la colonne d'icones
Public Sub CollapseSidebar()
    g_TimerSet = False
    If Not g_Expanded Then Exit Sub
    g_Expanded = False
    Dim ws As Worksheet: Set ws = ActiveSheet
    CancelPreviewTimer
    If g_SnapSet Then RestoreSnap ws
    HideIconColumn ws
End Sub

' Masque tout sauf sb_ham (etat par defaut)
Private Sub HideIconColumn(ws As Worksheet)
    Dim k As Integer
    For k = 0 To NAV_COUNT - 1
        Dim ico As Shape: Set ico = GetShape(ws, "sb_ico_" & k)
        Dim lbl As Shape: Set lbl = GetShape(ws, "sb_lbl_" & k)
        Dim sep As Shape: Set sep = GetShape(ws, "sb_sep_" & k)
        If Not lbl Is Nothing Then lbl.Visible = msoFalse
        If Not ico Is Nothing Then ico.Visible = msoFalse
        If Not sep Is Nothing Then sep.Visible = msoFalse
    Next k
    Dim sepH As Shape: Set sepH = GetShape(ws, "sb_sep_h")
    If Not sepH Is Nothing Then sepH.Visible = msoFalse
    Dim bg As Shape: Set bg = GetShape(ws, SB_BG)
    If Not bg Is Nothing Then bg.Visible = msoFalse
    Dim hdr As Shape: Set hdr = GetShape(ws, SB_HDR)
    If Not hdr Is Nothing Then hdr.Visible = msoFalse
End Sub

Public Sub NavToFromSidebar(ByVal target As String)
    CancelTimer
    CancelPreviewTimer
    CollapseSidebar
    On Error Resume Next
    ThisWorkbook.Sheets(target).Activate
    On Error GoTo 0
End Sub

' OnAction des 6 shapes icone : navigue directement
Public Sub NavSidebar_0(): NavToFromSidebar "Accueil":          End Sub
Public Sub NavSidebar_1(): NavToFromSidebar "Tableau de bord":  End Sub
Public Sub NavSidebar_2(): NavToFromSidebar "Carte":            End Sub
Public Sub NavSidebar_3(): NavToFromSidebar "Suivi Carburant":  End Sub
Public Sub NavSidebar_4(): NavToFromSidebar "Prix par Station": End Sub
Public Sub NavSidebar_5(): NavToFromSidebar WS_REGLAGES():      End Sub

' =========================================================================
'  APERCU TITRE : clic sur icone -> etend la shape vers la droite (titre visible)
'  Repli automatique apres PREVIEW_DELAY secondes.
' =========================================================================

Public Sub PreviewSidebar_0(): PreviewIcon 0: End Sub
Public Sub PreviewSidebar_1(): PreviewIcon 1: End Sub
Public Sub PreviewSidebar_2(): PreviewIcon 2: End Sub
Public Sub PreviewSidebar_3(): PreviewIcon 3: End Sub
Public Sub PreviewSidebar_4(): PreviewIcon 4: End Sub
Public Sub PreviewSidebar_5(): PreviewIcon 5: End Sub

Private Sub PreviewIcon(idx As Integer)
    ' Si meme icone en preview -> replie
    If g_PreviewSet And g_PreviewIdx = idx And g_PreviewSheet = ActiveSheet.Name Then
        CancelPreviewTimer
        CollapseIcon idx
        Exit Sub
    End If
    If g_Expanded Then
        ' Sidebar expanded : le clic navigue directement
        Select Case idx
            Case 0: NavToFromSidebar "Accueil"
            Case 1: NavToFromSidebar "Tableau de bord"
            Case 2: NavToFromSidebar "Carte"
            Case 3: NavToFromSidebar "Suivi Carburant"
            Case 4: NavToFromSidebar "Prix par Station"
            Case 5: NavToFromSidebar WS_REGLAGES()
        End Select
        Exit Sub
    End If

    ' Annule un preview precedent sur une autre icone
    CancelPreviewTimer
    If g_PreviewSet And g_PreviewIdx >= 0 Then CollapseIcon g_PreviewIdx

    ' Expand cet icone individuellement
    ExpandIcon idx
    g_PreviewIdx = idx
    g_PreviewSheet = ActiveSheet.Name

    ' Timer auto-repli
    g_PreviewTimer = Now + TimeSerial(0, 0, PREVIEW_DELAY)
    Application.OnTime g_PreviewTimer, "modSidebar.AutoCollapsePreview"
    g_PreviewSet = True
End Sub

Public Sub AutoCollapsePreview()
    If Not g_PreviewSet Then Exit Sub
    Dim idx As Integer: idx = g_PreviewIdx
    g_PreviewIdx = -1
    g_PreviewSet = False
    g_PreviewSheet = ""
    If idx >= 0 Then CollapseIcon idx
End Sub

' Snapshot + extension droite (icone immobile, titre revele a droite)
Private Sub ExpandIcon(idx As Integer)
    Dim ws As Worksheet: Set ws = ActiveSheet
    Dim ico As Shape: Set ico = GetShape(ws, "sb_ico_" & idx)
    Dim lbl As Shape: Set lbl = GetShape(ws, "sb_lbl_" & idx)
    If ico Is Nothing Then Exit Sub

    ' Snapshot de la geometrie EXACTE avant extension
    g_SnapIdx = idx
    g_SnapL = ico.Left: g_SnapT = ico.Top
    g_SnapW = ico.Width: g_SnapH = ico.Height
    g_SnapSet = True

    Dim z As Single: z = ZoomFactor()
    Dim wExp As Single: wExp = DocW_Exp(z)
    Dim step As Single: step = DocAnim(z) / 2

    Application.ScreenUpdating = False
    Dim W As Single
    For W = ico.Width To wExp Step step
        ico.Width = W
        DoEvents
    Next W
    ico.Width = wExp
    If Not lbl Is Nothing Then
        lbl.Left = g_SnapL + g_SnapW          ' juste apres l'icone
        lbl.Width = wExp - g_SnapW - 4 / z
        lbl.Visible = msoTrue
    End If
    Application.ScreenUpdating = True
End Sub

' Repli progressif + restauration exacte de la geometrie d'origine
Private Sub CollapseIcon(idx As Integer)
    On Error Resume Next
    Dim wsName As String: wsName = g_PreviewSheet
    If wsName = "" Then wsName = ActiveSheet.Name
    Dim ws As Worksheet: Set ws = ThisWorkbook.Worksheets(wsName)
    If ws Is Nothing Then Exit Sub
    Dim ico As Shape: Set ico = GetShape(ws, "sb_ico_" & idx)
    Dim lbl As Shape: Set lbl = GetShape(ws, "sb_lbl_" & idx)
    If ico Is Nothing Then Exit Sub

    If Not lbl Is Nothing Then lbl.Visible = msoFalse

    ' Repli progressif jusqu'a la largeur snapshotee
    Dim targetW As Single
    If g_SnapSet And g_SnapIdx = idx Then targetW = g_SnapW Else targetW = SiblingWidth(ws, idx)
    Dim z As Single: z = ZoomFactor()
    Dim step As Single: step = DocAnim(z) / 2
    Application.ScreenUpdating = False
    Dim W As Single
    For W = ico.Width To targetW Step -step
        ico.Width = W
        DoEvents
    Next W
    ' Restauration EXACTE de la geometrie d'origine
    If g_SnapSet And g_SnapIdx = idx Then
        ico.Left = g_SnapL: ico.Top = g_SnapT
        ico.Width = g_SnapW: ico.Height = g_SnapH
    Else
        ico.Width = targetW
    End If
    g_SnapSet = False
    Application.ScreenUpdating = True
    On Error GoTo 0
End Sub

' Largeur d'une icone voisine non etendue (filet anti-decalage)
Private Function SiblingWidth(ws As Worksheet, idx As Integer) As Single
    Dim k As Integer
    For k = 0 To NAV_COUNT - 1
        If k <> idx Then
            Dim s As Shape: Set s = GetShape(ws, "sb_ico_" & k)
            If Not s Is Nothing Then SiblingWidth = s.Width: Exit Function
        End If
    Next k
    SiblingWidth = DocW_Coll(ZoomFactor())
End Function

Private Sub RestoreSnap(ws As Worksheet)
    Dim ico As Shape: Set ico = GetShape(ws, "sb_ico_" & g_SnapIdx)
    If Not ico Is Nothing Then
        ico.Left = g_SnapL: ico.Top = g_SnapT
        ico.Width = g_SnapW: ico.Height = g_SnapH
    End If
    g_SnapSet = False
End Sub

Private Sub CancelPreviewTimer()
    If Not g_PreviewSet Then Exit Sub
    On Error Resume Next
    Application.OnTime g_PreviewTimer, "modSidebar.AutoCollapsePreview", , False
    On Error GoTo 0
    g_PreviewSet = False
    g_PreviewIdx = -1
    g_PreviewSheet = ""
End Sub

' Colorie en vert l'item correspondant a l'onglet actif sur toutes les feuilles.
Public Sub MarquerOngletActif()
    Dim actName As String
    On Error Resume Next: actName = ActiveSheet.Name: On Error GoTo 0
    Dim tgts(5) As String
    tgts(0) = "Accueil":          tgts(1) = "Tableau de bord"
    tgts(2) = "Carte":            tgts(3) = "Suivi Carburant"
    tgts(4) = "Prix par Station": tgts(5) = WS_REGLAGES()
    Dim ws As Worksheet
    For Each ws In ThisWorkbook.Worksheets
        Dim k As Integer
        For k = 0 To NAV_COUNT - 1
            Dim ico As Shape: Set ico = GetShape(ws, "sb_ico_" & k)
            If Not ico Is Nothing Then
                If tgts(k) = actName Then
                    ico.Fill.ForeColor.RGB = C_GRN()
                Else
                    ico.Fill.ForeColor.RGB = C_BG()
                End If
            End If
        Next k
    Next ws
End Sub

Public Sub PoserSidebarSurTousLesOnglets()
    Dim noms As Variant
    noms = Array("Accueil", "Tableau de bord", "Carte", WS_REGLAGES(), _
                 "Suivi Carburant", "Prix par Station", "Hist. Carburant")
    Dim i As Long, ws As Worksheet
    For i = LBound(noms) To UBound(noms)
        Set ws = Nothing
        On Error Resume Next
        Set ws = ThisWorkbook.Worksheets(CStr(noms(i)))
        On Error GoTo 0
        If Not ws Is Nothing Then
            Dim zFactor As Single
            zFactor = ZoomForSheet(CStr(noms(i)))
            On Error Resume Next
            PoserSidebarSurFeuille ws, zFactor
            On Error GoTo 0
        End If
    Next i
End Sub

' zOverride = 0 -> utilise ZoomFactor() (zoom actuel de la fenetre)
Public Sub PoserSidebarSurFeuille(ws As Worksheet, Optional zOverride As Single = 0)
    On Error Resume Next
    Dim j As Long
    For j = ws.Shapes.Count To 1 Step -1
        If Left$(ws.Shapes(j).Name, 3) = "sb_" Then ws.Shapes(j).Delete
    Next j
    On Error GoTo 0

    Dim z As Single
    If zOverride > 0 Then
        z = zOverride
    Else
        z = ZoomFactor()
    End If

    ' Hauteur en pts ecran, plafonnee a la fenetre visible
    Dim totalH_sc As Single
    totalH_sc = SB_TOP + H_HAM + 2 + NAV_COUNT * (H_ITEM + 2) + 10
    On Error Resume Next
    Dim winH As Single: winH = Application.ActiveWindow.Height
    On Error GoTo 0
    If winH > 50 Then
        Dim maxH_sc As Single: maxH_sc = winH - 40 - SB_TOP
        If totalH_sc > maxH_sc And maxH_sc > 50 Then totalH_sc = maxH_sc
    End If

    ' Conversion en pts feuille (coordonnees document)
    Dim wC  As Single: wC = W_COLLAPSED / z
    Dim wE  As Single: wE = W_EXPANDED / z
    Dim hh  As Single: hh = H_HAM / z
    Dim hIt As Single: hIt = H_ITEM / z
    Dim top As Single: top = SB_TOP / z
    Dim tot As Single: tot = totalH_sc / z

    ' -- Background : coins DROITS arrondis, coins gauches plats (masque par defaut)
    Dim bg As Shape
    Set bg = ws.Shapes.AddShape(158, 0, top, tot, wC)
    bg.Name = SB_BG
    bg.Placement = xlFreeFloating
    bg.Adjustments(1) = 0.04
    bg.Rotation = 90
    bg.Left = 0
    bg.top = top
    bg.Fill.ForeColor.RGB = C_BG()
    bg.Line.Visible = msoFalse
    bg.Visible = msoFalse

    ' -- Hamburger (toujours visible) -------------------------
    Dim ham As Shape
    Set ham = ws.Shapes.AddShape(msoShapeRoundedRectangle, 2 / z, top + 2 / z, wC - 4 / z, hh)
    ham.Name = SB_HAM
    ham.Placement = xlFreeFloating
    ham.Adjustments(1) = 0.03
    ham.Fill.ForeColor.RGB = C_BG2()
    ham.Line.Visible = msoFalse
    ham.OnAction = "modSidebar.ToggleSidebar"
    With ham.TextFrame2
        .TextRange.Text = ChrW(9776)
        .TextRange.Font.Fill.ForeColor.RGB = C_WHT()
        .TextRange.Font.Bold = msoTrue
        .TextRange.Font.Size = 14
        .TextRange.ParagraphFormat.Alignment = msoAlignCenter
        .HorizontalAnchor = 2
        .VerticalAnchor = 3
    End With

    ' -- Separateur sous hamburger (masque par defaut) --------
    Dim sepH As Shape
    Set sepH = ws.Shapes.AddShape(msoShapeRectangle, 4 / z, top + hh + 4 / z, wC - 8 / z, 1 / z)
    sepH.Name = "sb_sep_h"
    sepH.Placement = xlFreeFloating
    sepH.Fill.ForeColor.RGB = C_SEP()
    sepH.Line.Visible = msoFalse
    sepH.Visible = msoFalse

    ' -- Header (masque par defaut) ---------------------------
    Dim hdr As Shape
    Set hdr = ws.Shapes.AddTextBox(msoTextOrientationHorizontal, _
                wC + 2 / z, top + 4 / z, wE - wC - 4 / z, hh - 4 / z)
    hdr.Name = SB_HDR
    hdr.Placement = xlFreeFloating
    hdr.Fill.Visible = msoFalse
    hdr.Line.Visible = msoFalse
    hdr.Visible = False
    With hdr.TextFrame2
        .TextRange.Text = "Navigation"
        .TextRange.Font.Fill.ForeColor.RGB = C_WHT()
        .TextRange.Font.Bold = msoTrue
        .TextRange.Font.Size = 11
        .HorizontalAnchor = 1
        .VerticalAnchor = 3
    End With

    ' -- Items de navigation ----------------------------------
    Dim icons(5) As Long, labels(5) As String, tgts(5) As String
    icons(0) = &H1F3E0: labels(0) = "Accueil":          tgts(0) = "Accueil"
    icons(1) = &H1F4CA: labels(1) = "Tableau de bord":  tgts(1) = "Tableau de bord"
    icons(2) = &H1F5FA: labels(2) = "Carte":            tgts(2) = "Carte"
    icons(3) = &H26FD:  labels(3) = "Suivi Carburant":  tgts(3) = "Suivi Carburant"
    icons(4) = &H1F4B6: labels(4) = "Prix / Station":   tgts(4) = "Prix par Station"
    icons(5) = &H2699:  labels(5) = "R" & ChrW(233) & "glages": tgts(5) = WS_REGLAGES()

    Dim actName As String
    On Error Resume Next: actName = ActiveSheet.Name: On Error GoTo 0

    Dim y As Single: y = top + hh + 6 / z
    Dim k As Integer
    For k = 0 To NAV_COUNT - 1
        Dim isAct As Boolean: isAct = (tgts(k) = actName)
        Dim clr As Long: clr = IIf(isAct, C_GRN(), C_BG())

        ' Icone -- masquee par defaut, emoji aligne a gauche
        Dim ico As Shape
        Set ico = ws.Shapes.AddShape(msoShapeRoundedRectangle, 2 / z, y, wC - 4 / z, hIt)
        ico.Name = "sb_ico_" & k
        ico.Placement = xlFreeFloating
        ico.Adjustments(1) = 0.03
        ico.Fill.ForeColor.RGB = clr
        ico.Line.Visible = msoFalse
        ico.OnAction = "modSidebar.PreviewSidebar_" & k
        With ico.TextFrame2
            .TextRange.Text = Emo(icons(k))
            .TextRange.Font.Fill.ForeColor.RGB = C_WHT()
            .TextRange.Font.Size = 15
            .TextRange.ParagraphFormat.Alignment = msoAlignLeft
            .HorizontalAnchor = 1
            .VerticalAnchor = 3
            .MarginLeft = 7 / z
        End With
        ico.Visible = msoFalse

        ' Label (masque par defaut) -- navigue au clic
        Dim lbl As Shape
        Set lbl = ws.Shapes.AddTextBox(msoTextOrientationHorizontal, _
                    wC + 2 / z, y + 4 / z, wE - wC - 6 / z, hIt - 8 / z)
        lbl.Name = "sb_lbl_" & k
        lbl.Placement = xlFreeFloating
        lbl.Fill.Visible = msoFalse
        lbl.Line.Visible = msoFalse
        lbl.Visible = False
        lbl.OnAction = "modSidebar.NavSidebar_" & k
        With lbl.TextFrame2
            .TextRange.Text = labels(k)
            .TextRange.Font.Fill.ForeColor.RGB = C_WHT()
            .TextRange.Font.Size = 10
            .TextRange.Font.Bold = msoFalse
            .HorizontalAnchor = 1
            .VerticalAnchor = 3
        End With

        ' Separateur (masque par defaut)
        Dim sepN As Shape
        Set sepN = ws.Shapes.AddShape(msoShapeRectangle, 4 / z, y + hIt + 1 / z, wC - 8 / z, 1 / z)
        sepN.Name = "sb_sep_" & k
        sepN.Placement = xlFreeFloating
        sepN.Fill.ForeColor.RGB = C_SEP()
        sepN.Line.Visible = msoFalse
        sepN.Visible = msoFalse

        y = y + hIt + 3 / z
    Next k
End Sub

' =========================================================================
'  HELPERS INTERNES
' =========================================================================

Private Function GetShape(ws As Worksheet, nm As String) As Shape
    On Error Resume Next
    Set GetShape = ws.Shapes(nm)
    On Error GoTo 0
End Function

Private Sub SetCollapseTimer()
    g_TimerTime = Now + TimeSerial(0, 0, AUTO_CLOSE_S)
    Application.OnTime g_TimerTime, "modSidebar.CollapseSidebar"
    g_TimerSet = True
End Sub

Private Sub CancelTimer()
    If Not g_TimerSet Then Exit Sub
    On Error Resume Next
    Application.OnTime g_TimerTime, "modSidebar.CollapseSidebar", , False
    On Error GoTo 0
    g_TimerSet = False
End Sub

Private Function Emo(ByVal cp As Long) As String
    If cp <= &HFFFF& Then
        Emo = ChrW(cp)
    Else
        Dim v As Long: v = cp - &H10000
        Emo = ChrW(&HD800& Or (v \ &H400&)) & ChrW(&HDC00& Or (v And &H3FF&))
    End If
End Function
