Attribute VB_Name = "modSidebar"
' ============================================================
'  modSidebar — Sidebar navigation (Variante C, hover Win32)
'  Shapes fixes sur chaque onglet.
'  Survol via GetCursorPos + SetTimer 200 ms => label glisse a droite.
'  Clic icone ou label => navigation directe vers l'onglet.
' ============================================================
Option Explicit

#If VBA7 Then
    Private Declare PtrSafe Function GetCursorPos Lib "user32" (lpPoint As POINTAPI) As Long
    Private Declare PtrSafe Function SetTimer Lib "user32" ( _
        ByVal hWnd As LongPtr, ByVal nIDEvent As LongPtr, _
        ByVal uElapse As Long, ByVal lpTimerFunc As LongPtr) As LongPtr
    Private Declare PtrSafe Function KillTimer Lib "user32" ( _
        ByVal hWnd As LongPtr, ByVal nIDEvent As LongPtr) As Long
#Else
    Private Declare Function GetCursorPos Lib "user32" (lpPoint As POINTAPI) As Long
    Private Declare Function SetTimer Lib "user32" ( _
        ByVal hWnd As Long, ByVal nIDEvent As Long, _
        ByVal uElapse As Long, ByVal lpTimerFunc As Long) As Long
    Private Declare Function KillTimer Lib "user32" ( _
        ByVal hWnd As Long, ByVal nIDEvent As Long) As Long
#End If

Private Type POINTAPI
    x As Long
    y As Long
End Type

' -- Dimensions en points ecran (invariants par rapport au zoom) --
Private Const W_COLLAPSED  As Single = 44
Private Const W_EXPANDED   As Single = 220
Private Const H_HAM        As Single = 36
Private Const H_ITEM       As Single = 38
Private Const SB_TOP       As Single = 6
Private Const AUTO_CLOSE_S As Integer = 4
Private Const NAV_COUNT    As Integer = 6
Private Const HOVER_MS     As Long = 200

Private Const SB_BG  As String = "sb_bg"
Private Const SB_HAM As String = "sb_ham"
Private Const SB_HDR As String = "sb_hdr"

Private g_Expanded  As Boolean
Private g_TimerTime As Date
Private g_TimerSet  As Boolean

#If VBA7 Then
    Private g_HoverTimerID As LongPtr
#Else
    Private g_HoverTimerID As Long
#End If
Private g_HoverIdx     As Integer      ' -1 = aucun survol actif
Private g_InHoverCheck As Boolean      ' anti re-entree SetTimer callback

' =========================================================================
'  ZOOM / COORDONNEES
' =========================================================================

Private Function ZoomFactor() As Single
    On Error Resume Next
    Dim z As Single: z = Application.ActiveWindow.Zoom / 100!
    On Error GoTo 0
    If z <= 0 Then z = 1
    ZoomFactor = z
End Function

Private Function ZoomForSheet(wsName As String) As Single
    Dim nCols As Long: nCols = ZoomColsFromReglages(wsName)
    If nCols = 0 Then ZoomForSheet = ZoomFactor(): Exit Function
    Dim ws As Worksheet
    On Error Resume Next: Set ws = ThisWorkbook.Worksheets(wsName): On Error GoTo 0
    If ws Is Nothing Then ZoomForSheet = ZoomFactor(): Exit Function
    Dim totalW As Double: totalW = 0
    Dim c As Long
    For c = 1 To nCols: totalW = totalW + ws.Columns(c).Width: Next c
    If totalW < 10 Then ZoomForSheet = ZoomFactor(): Exit Function
    Dim winW As Double
    On Error Resume Next: winW = Application.ActiveWindow.Width - 18: On Error GoTo 0
    If winW < 100 Then ZoomForSheet = ZoomFactor(): Exit Function
    Dim z As Single: z = CSng(winW / totalW)
    ZoomForSheet = CSng(Application.Max(0.5, Application.Min(2!, z)))
End Function

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
        On Error Resume Next: v = CStr(wsReg.Cells(r0 + i, cNm).Value): On Error GoTo 0
        If Len(Trim$(v)) = 0 Then Exit For
        If StrComp(v, wsName, vbTextCompare) = 0 Then
            On Error Resume Next
            ZoomColsFromReglages = CLng(wsReg.Cells(r0 + i, cCols).Value)
            On Error GoTo 0
            Exit Function
        End If
    Next i
End Function

Private Function WS_REGLAGES() As String: WS_REGLAGES = "R" & ChrW(233) & "glages": End Function

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
'  HOVER WIN32 — SetTimer 200 ms + GetCursorPos
' =========================================================================

' Callback SetTimer : doit etre Public dans un module standard
#If VBA7 Then
Public Sub HoverTimerProc(ByVal hWnd As LongPtr, ByVal uMsg As Long, _
                          ByVal nIDEvent As LongPtr, ByVal dwTime As Long)
#Else
Public Sub HoverTimerProc(ByVal hWnd As Long, ByVal uMsg As Long, _
                          ByVal nIDEvent As Long, ByVal dwTime As Long)
#End If
    If g_InHoverCheck Or Not g_Expanded Then Exit Sub
    g_InHoverCheck = True
    On Error Resume Next
    DoHoverCheck
    On Error GoTo 0
    g_InHoverCheck = False
End Sub

' RangeFromPoint prend les coordonnees physiques de GetCursorPos et retourne
' directement l'objet sous le curseur — aucune conversion DPI/zoom necessaire.
Private Sub DoHoverCheck()
    Dim pt As POINTAPI
    If GetCursorPos(pt) = 0 Then Exit Sub

    Dim ws As Worksheet
    On Error Resume Next: Set ws = ActiveSheet: On Error GoTo 0
    If ws Is Nothing Then Exit Sub

    Dim win As Window: Set win = Application.ActiveWindow
    Dim hotIdx As Integer: hotIdx = -1

    Dim v As Object
    On Error Resume Next
    Set v = win.RangeFromPoint(pt.x, pt.y)
    On Error GoTo 0

    If Not v Is Nothing Then
        If TypeName(v) = "Shape" Then
            Dim nm As String: nm = v.Name
            Dim k As Integer
            If Left$(nm, 7) = "sb_ico_" Then
                k = Val(Mid$(nm, 8))
                If k >= 0 And k < NAV_COUNT Then hotIdx = k
            ElseIf Left$(nm, 7) = "sb_lbl_" Then
                k = Val(Mid$(nm, 8))
                If k >= 0 And k < NAV_COUNT Then hotIdx = k
            End If
        End If
    End If

    If hotIdx = g_HoverIdx Then Exit Sub
    If g_HoverIdx >= 0 Then CollapseIconHover g_HoverIdx
    g_HoverIdx = hotIdx
    If hotIdx >= 0 Then
        CancelTimer: SetCollapseTimer
        ExpandIconHover hotIdx
    End If
End Sub

' Extension instantanee : icone s'elargit, label apparait a droite
Private Sub ExpandIconHover(idx As Integer)
    Dim ws As Worksheet: Set ws = ActiveSheet
    Dim ico As Shape: Set ico = GetShape(ws, "sb_ico_" & idx)
    Dim lbl As Shape: Set lbl = GetShape(ws, "sb_lbl_" & idx)
    If ico Is Nothing Then Exit Sub
    Dim z As Single: z = ZoomFactor()
    Dim origW As Single: origW = (W_COLLAPSED - 4) / z
    ico.Width = W_EXPANDED / z
    If Not lbl Is Nothing Then
        lbl.Left  = ico.Left + origW + 2 / z
        lbl.Width = W_EXPANDED / z - origW - 6 / z
        lbl.Visible = msoTrue
    End If
End Sub

' Repli instantane : icone revient a sa largeur initiale, label masque
Private Sub CollapseIconHover(idx As Integer)
    On Error Resume Next
    Dim ws As Worksheet: Set ws = ActiveSheet
    Dim ico As Shape: Set ico = GetShape(ws, "sb_ico_" & idx)
    Dim lbl As Shape: Set lbl = GetShape(ws, "sb_lbl_" & idx)
    If Not ico Is Nothing Then ico.Width = (W_COLLAPSED - 4) / ZoomFactor()
    If Not lbl Is Nothing Then lbl.Visible = msoFalse
    On Error GoTo 0
End Sub

Private Sub StartHoverTimer()
    If g_HoverTimerID <> 0 Then Exit Sub
    g_HoverIdx = -1
    g_HoverTimerID = SetTimer(0, 0, HOVER_MS, AddressOf HoverTimerProc)
End Sub

Private Sub StopHoverTimer()
    If g_HoverTimerID = 0 Then Exit Sub
    KillTimer 0, g_HoverTimerID
    g_HoverTimerID = 0
    On Error Resume Next
    If g_HoverIdx >= 0 Then CollapseIconHover g_HoverIdx
    On Error GoTo 0
    g_HoverIdx = -1
End Sub

' =========================================================================
'  API PUBLIQUE
' =========================================================================

Public Sub ShowSidebar()
    PoserSidebarSurTousLesOnglets
    MarquerOngletActif
End Sub

Public Sub HideSidebar()
    CancelTimer
    StopHoverTimer
    Dim ws As Worksheet, j As Long
    For Each ws In ThisWorkbook.Worksheets
        For j = ws.Shapes.Count To 1 Step -1
            If Left$(ws.Shapes(j).Name, 3) = "sb_" Then ws.Shapes(j).Delete
        Next j
    Next ws
    g_Expanded = False
End Sub

' Appele par Workbook_SheetActivate : replie la sidebar sur changement d'onglet
Public Sub RepositionSidebar()
    CancelTimer
    StopHoverTimer
    g_Expanded = False
    HideIconColumn ActiveSheet
    MarquerOngletActif
End Sub

Public Sub ToggleSidebar()
    If g_Expanded Then CollapseSidebar Else ExpandSidebar
End Sub

' Clic hamburger : affiche la colonne d'icones + demarre le timer de survol
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
    Dim k As Integer
    For k = 0 To NAV_COUNT - 1
        Dim ico As Shape: Set ico = GetShape(ws, "sb_ico_" & k)
        Dim sep As Shape: Set sep = GetShape(ws, "sb_sep_" & k)
        If Not ico Is Nothing Then ico.Visible = msoTrue
        If Not sep Is Nothing Then sep.Visible = msoTrue
        DoEvents
    Next k
    SetCollapseTimer
    StartHoverTimer
End Sub

' Repli complet : arrete le timer de survol, masque la colonne d'icones
Public Sub CollapseSidebar()
    g_TimerSet = False
    If Not g_Expanded Then Exit Sub
    g_Expanded = False
    StopHoverTimer
    HideIconColumn ActiveSheet
End Sub

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
    CollapseSidebar
    On Error Resume Next
    ThisWorkbook.Sheets(target).Activate
    On Error GoTo 0
End Sub

Public Sub NavSidebar_0(): NavToFromSidebar "Accueil":          End Sub
Public Sub NavSidebar_1(): NavToFromSidebar "Tableau de bord":  End Sub
Public Sub NavSidebar_2(): NavToFromSidebar "Carte":            End Sub
Public Sub NavSidebar_3(): NavToFromSidebar "Suivi Carburant":  End Sub
Public Sub NavSidebar_4(): NavToFromSidebar "Prix par Station": End Sub
Public Sub NavSidebar_5(): NavToFromSidebar WS_REGLAGES():      End Sub

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
                ico.Fill.ForeColor.RGB = IIf(tgts(k) = actName, C_GRN(), C_BG())
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
        On Error Resume Next: Set ws = ThisWorkbook.Worksheets(CStr(noms(i))): On Error GoTo 0
        If Not ws Is Nothing Then
            On Error Resume Next
            PoserSidebarSurFeuille ws, ZoomForSheet(CStr(noms(i)))
            On Error GoTo 0
        End If
    Next i
End Sub

Public Sub PoserSidebarSurFeuille(ws As Worksheet, Optional zOverride As Single = 0)
    On Error Resume Next
    Dim j As Long
    For j = ws.Shapes.Count To 1 Step -1
        If Left$(ws.Shapes(j).Name, 3) = "sb_" Then ws.Shapes(j).Delete
    Next j
    On Error GoTo 0

    Dim z As Single: z = IIf(zOverride > 0, zOverride, ZoomFactor())

    Dim totalH_sc As Single: totalH_sc = SB_TOP + H_HAM + 2 + NAV_COUNT * (H_ITEM + 2) + 10
    On Error Resume Next
    Dim winH As Single: winH = Application.ActiveWindow.Height
    On Error GoTo 0
    If winH > 50 Then
        Dim maxH_sc As Single: maxH_sc = winH - 40 - SB_TOP
        If totalH_sc > maxH_sc And maxH_sc > 50 Then totalH_sc = maxH_sc
    End If

    Dim wC  As Single: wC  = W_COLLAPSED / z
    Dim wE  As Single: wE  = W_EXPANDED / z
    Dim hh  As Single: hh  = H_HAM / z
    Dim hIt As Single: hIt = H_ITEM / z
    Dim top As Single: top = SB_TOP / z
    Dim tot As Single: tot = totalH_sc / z

    ' -- Background (masque par defaut)
    Dim bg As Shape
    Set bg = ws.Shapes.AddShape(158, 0, top, tot, wC)
    bg.Name = SB_BG: bg.Placement = xlFreeFloating
    bg.Adjustments(1) = 0.04: bg.Rotation = 90
    bg.Left = 0: bg.top = top
    bg.Fill.ForeColor.RGB = C_BG(): bg.Line.Visible = msoFalse: bg.Visible = msoFalse

    ' -- Hamburger (toujours visible)
    Dim ham As Shape
    Set ham = ws.Shapes.AddShape(msoShapeRoundedRectangle, 2 / z, top + 2 / z, wC - 4 / z, hh)
    ham.Name = SB_HAM: ham.Placement = xlFreeFloating: ham.Adjustments(1) = 0.03
    ham.Fill.ForeColor.RGB = C_BG2(): ham.Line.Visible = msoFalse
    ham.OnAction = "modSidebar.ToggleSidebar"
    With ham.TextFrame2
        .TextRange.Text = ChrW(9776)
        .TextRange.Font.Fill.ForeColor.RGB = C_WHT()
        .TextRange.Font.Bold = msoTrue: .TextRange.Font.Size = 14
        .TextRange.ParagraphFormat.Alignment = msoAlignCenter
        .HorizontalAnchor = 2: .VerticalAnchor = 3
    End With

    ' -- Separateur sous hamburger (masque)
    Dim sepH As Shape
    Set sepH = ws.Shapes.AddShape(msoShapeRectangle, 4 / z, top + hh + 4 / z, wC - 8 / z, 1 / z)
    sepH.Name = "sb_sep_h": sepH.Placement = xlFreeFloating
    sepH.Fill.ForeColor.RGB = C_SEP(): sepH.Line.Visible = msoFalse: sepH.Visible = msoFalse

    ' -- Header (masque)
    Dim hdr As Shape
    Set hdr = ws.Shapes.AddTextBox(msoTextOrientationHorizontal, _
                wC + 2 / z, top + 4 / z, wE - wC - 4 / z, hh - 4 / z)
    hdr.Name = SB_HDR: hdr.Placement = xlFreeFloating
    hdr.Fill.Visible = msoFalse: hdr.Line.Visible = msoFalse: hdr.Visible = False
    With hdr.TextFrame2
        .TextRange.Text = "Navigation"
        .TextRange.Font.Fill.ForeColor.RGB = C_WHT()
        .TextRange.Font.Bold = msoTrue: .TextRange.Font.Size = 11
        .HorizontalAnchor = 1: .VerticalAnchor = 3
    End With

    ' -- Items de navigation
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
        Dim clr As Long: clr = IIf(tgts(k) = actName, C_GRN(), C_BG())

        ' Icone (masquee) — survol = label glisse a droite, clic = navigation
        Dim ico As Shape
        Set ico = ws.Shapes.AddShape(msoShapeRoundedRectangle, 2 / z, y, wC - 4 / z, hIt)
        ico.Name = "sb_ico_" & k: ico.Placement = xlFreeFloating: ico.Adjustments(1) = 0.03
        ico.Fill.ForeColor.RGB = clr: ico.Line.Visible = msoFalse
        ico.OnAction = "modSidebar.NavSidebar_" & k
        With ico.TextFrame2
            .TextRange.Text = Emo(icons(k))
            .TextRange.Font.Fill.ForeColor.RGB = C_WHT()
            .TextRange.Font.Size = 15
            .TextRange.ParagraphFormat.Alignment = msoAlignLeft
            .HorizontalAnchor = 1: .VerticalAnchor = 3: .MarginLeft = 7 / z
        End With
        ico.Visible = msoFalse

        ' Label (masque) — survol = visible, clic = navigation, texte aligne gauche
        Dim lbl As Shape
        Set lbl = ws.Shapes.AddTextBox(msoTextOrientationHorizontal, _
                    wC + 2 / z, y + 4 / z, wE - wC - 6 / z, hIt - 8 / z)
        lbl.Name = "sb_lbl_" & k: lbl.Placement = xlFreeFloating
        lbl.Fill.Visible = msoFalse: lbl.Line.Visible = msoFalse: lbl.Visible = False
        lbl.OnAction = "modSidebar.NavSidebar_" & k
        With lbl.TextFrame2
            .TextRange.Text = labels(k)
            .TextRange.Font.Fill.ForeColor.RGB = C_WHT()
            .TextRange.Font.Size = 10: .TextRange.Font.Bold = msoFalse
            .HorizontalAnchor = 1: .VerticalAnchor = 3
        End With

        ' Separateur (masque)
        Dim sepN As Shape
        Set sepN = ws.Shapes.AddShape(msoShapeRectangle, 4 / z, y + hIt + 1 / z, wC - 8 / z, 1 / z)
        sepN.Name = "sb_sep_" & k: sepN.Placement = xlFreeFloating
        sepN.Fill.ForeColor.RGB = C_SEP(): sepN.Line.Visible = msoFalse: sepN.Visible = msoFalse

        y = y + hIt + 3 / z
    Next k
End Sub

' =========================================================================
'  HELPERS INTERNES
' =========================================================================

Private Function GetShape(ws As Worksheet, nm As String) As Shape
    On Error Resume Next: Set GetShape = ws.Shapes(nm): On Error GoTo 0
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
