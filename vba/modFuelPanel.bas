Option Explicit
' ============================================================
'  MODULE : modFuelPanel  --  Panneau de filtre carburant (Option C)
'  Principe : bouton shape sur B6 -> panneau toggle shapes sous B6.
'  Selection stockee dans g_Selected().
'  Navigation : clic bouton = ouvre/ferme ; clic item = toggle ;
'               clic Appliquer = ecrit B6 + rafraichit dashboard.
' ============================================================

Private Const FUP_BTN     As String = "fup_btn"
Private Const FUP_BG      As String = "fup_bg"
Private Const FUP_ITM_PFX As String = "fup_itm_"
Private Const FUP_APPLY   As String = "fup_apply"
Private Const FUEL_CELL   As String = "B6"
Private Const COL_FUELS   As Long = 53   ' colonne BA
Private Const WS_NAME     As String = "Tableau de bord"
Private Const MAX_FUELS   As Integer = 10

Private g_PanelOpen As Boolean
Private g_Selected(MAX_FUELS) As Boolean
Private g_FuelCount As Integer

' -----------------------------------------------------------------------
'  Helpers couleurs / feuille
' -----------------------------------------------------------------------
Private Function C_SEL()   As Long: C_SEL   = RGB(29, 158, 117):  End Function
Private Function C_UNSEL() As Long: C_UNSEL = RGB(200, 210, 225): End Function
Private Function C_PANELBG() As Long: C_PANELBG = RGB(27, 58, 92):   End Function
Private Function C_WHITE() As Long: C_WHITE = RGB(255, 255, 255): End Function
Private Function C_DARK()  As Long: C_DARK  = RGB(26, 26, 26):    End Function
Private Function C_BORD()  As Long: C_BORD  = RGB(46, 117, 182):  End Function
Private Function C_BTNBG() As Long: C_BTNBG = RGB(230, 241, 251): End Function

Private Function DashWs() As Worksheet
    On Error Resume Next
    Set DashWs = ThisWorkbook.Worksheets(WS_NAME)
    On Error GoTo 0
End Function

Private Function ReadFuels() As String()
    Dim ws As Worksheet: Set ws = DashWs()
    Dim arr(MAX_FUELS) As String
    Dim n As Integer: n = 0
    If Not ws Is Nothing Then
        Dim i As Long
        For i = 1 To MAX_FUELS
            Dim v As String: v = Trim$(CStr(ws.Cells(i, COL_FUELS).Value))
            If Len(v) = 0 Then Exit For
            arr(n) = v
            n = n + 1
        Next i
    End If
    g_FuelCount = n
    ReadFuels = arr
End Function

Private Sub ParseCurrentSelection(fuels() As String)
    Dim ws As Worksheet: Set ws = DashWs()
    Dim k As Integer
    For k = 0 To MAX_FUELS: g_Selected(k) = False: Next k
    If ws Is Nothing Or g_FuelCount = 0 Then Exit Sub

    Dim curVal As String: curVal = Trim$(CStr(ws.Range(FUEL_CELL).Value))
    If Len(curVal) = 0 Or curVal = "(tous)" Or curVal = "(Tous)" Then
        g_Selected(0) = True
        Exit Sub
    End If

    Dim parts() As String: parts = Split(curVal, ",")
    Dim p As Integer, k2 As Integer
    For p = 0 To UBound(parts)
        Dim part As String: part = Trim$(parts(p))
        For k2 = 0 To g_FuelCount - 1
            If StrComp(part, fuels(k2), vbTextCompare) = 0 Then
                g_Selected(k2) = True
                Exit For
            End If
        Next k2
    Next p
    ' Si rien de selectionne -> (tous)
    Dim anySet As Boolean: anySet = False
    For k2 = 0 To g_FuelCount - 1
        If g_Selected(k2) Then anySet = True
    Next k2
    If Not anySet Then g_Selected(0) = True
End Sub

' -----------------------------------------------------------------------
'  POINT D'ENTREE : installe le bouton trigger sur le Tableau de bord
'  Appele depuis modDashboardGraphiques.MAJ_Dashboard_Graphiques
' -----------------------------------------------------------------------
Public Sub InstallFuelPanel()
    Dim ws As Worksheet: Set ws = DashWs()
    If ws Is Nothing Then Exit Sub

    ' Fermer le panel si ouvert
    If g_PanelOpen Then ClosePanelShapes ws

    ' Nettoyer ancien bouton et residus de l'ancienne ListBox
    Dim j As Long
    For j = ws.Shapes.Count To 1 Step -1
        Dim nm As String: nm = ws.Shapes(j).Name
        If nm = FUP_BTN Or nm = "btnRefreshFuel" Then ws.Shapes(j).Delete
    Next j
    On Error Resume Next
    For j = ws.OLEObjects.Count To 1 Step -1
        If ws.OLEObjects(j).Name = "lstFuels" Then ws.OLEObjects(j).Delete
    Next j
    On Error GoTo 0

    ' Lire etat courant de B6
    Dim fuels() As String: fuels = ReadFuels()
    ParseCurrentSelection fuels

    ' Position et dimensions EXACTES de B6 (points = coord. document,
    ' invariantes au zoom : le bouton recouvre B6 a tout niveau de zoom).
    Dim b6 As Range: Set b6 = ws.Range(FUEL_CELL)
    Dim bL As Single: bL = b6.Left
    Dim bT As Single: bT = b6.Top
    Dim bW As Single: bW = b6.Width
    Dim bH As Single: bH = b6.Height

    Dim curVal As String: curVal = Trim$(CStr(ws.Range(FUEL_CELL).Value))
    Dim btnTxt As String
    If Len(curVal) > 14 Then
        btnTxt = ChrW(&H25BC) & " " & Left$(curVal, 13) & Chr(133)
    Else
        btnTxt = ChrW(&H25BC) & " " & curVal
    End If

    Dim btn As Shape
    Set btn = ws.Shapes.AddShape(msoShapeRoundedRectangle, bL, bT, bW, bH)
    btn.Name = FUP_BTN
    btn.Placement = xlFreeFloating
    btn.Adjustments(1) = 0.05
    btn.Fill.ForeColor.RGB = C_BTNBG()
    btn.Line.ForeColor.RGB = C_BORD()
    btn.Line.Weight = 1
    btn.OnAction = "modFuelPanel.ToggleFuelPanel"
    With btn.TextFrame2
        .TextRange.Text = btnTxt
        .TextRange.Font.Fill.ForeColor.RGB = C_DARK()
        .TextRange.Font.Size = 9
        .TextRange.Font.Name = "Segoe UI"
        .TextRange.ParagraphFormat.Alignment = msoAlignLeft
        .HorizontalAnchor = msoAnchorCenter
        .VerticalAnchor = msoAnchorMiddle
    End With
End Sub

' -----------------------------------------------------------------------
'  TOGGLE PANEL
' -----------------------------------------------------------------------
Public Sub ToggleFuelPanel()
    Dim ws As Worksheet: Set ws = DashWs()
    If ws Is Nothing Then Exit Sub
    If g_PanelOpen Then
        ClosePanelShapes ws
        g_PanelOpen = False
    Else
        OpenPanel ws
    End If
End Sub

Private Sub OpenPanel(ws As Worksheet)
    Dim fuels() As String: fuels = ReadFuels()
    ParseCurrentSelection fuels
    If g_FuelCount = 0 Then Exit Sub

    Dim b6 As Range: Set b6 = ws.Range(FUEL_CELL)
    Dim panL As Single: panL = b6.Left - 2
    Dim panT As Single: panT = b6.Top + b6.Height + 2
    Dim panW As Single: panW = 165
    Dim itmH As Single: itmH = 22
    Dim gap  As Single: gap = 3
    Dim panH As Single: panH = 8 + g_FuelCount * (itmH + gap) + 32

    ' Fond
    Dim bg As Shape
    Set bg = ws.Shapes.AddShape(msoShapeRectangle, panL, panT, panW, panH)
    bg.Name = FUP_BG
    bg.Placement = xlFreeFloating
    bg.Fill.ForeColor.RGB = C_PANELBG()
    bg.Line.Visible = msoFalse
    bg.ZOrder msoBringToFront

    ' Items
    Dim k As Integer
    For k = 0 To g_FuelCount - 1
        Dim iY As Single: iY = panT + 5 + k * (itmH + gap)
        Dim itm As Shape
        Set itm = ws.Shapes.AddShape(msoShapeRoundedRectangle, panL + 5, iY, panW - 10, itmH)
        itm.Name = FUP_ITM_PFX & k
        itm.Placement = xlFreeFloating
        itm.Adjustments(1) = 0.04
        itm.Fill.ForeColor.RGB = IIf(g_Selected(k), C_SEL(), C_UNSEL())
        itm.Line.Visible = msoFalse
        itm.OnAction = "modFuelPanel.FuelToggle_" & k
        itm.ZOrder msoBringToFront
        SetItemText itm, fuels(k), g_Selected(k)
    Next k

    ' Bouton Appliquer
    Dim applyY As Single: applyY = panT + 5 + g_FuelCount * (itmH + gap) + 3
    Dim aBtn As Shape
    Set aBtn = ws.Shapes.AddShape(msoShapeRoundedRectangle, panL + 5, applyY, panW - 10, 26)
    aBtn.Name = FUP_APPLY
    aBtn.Placement = xlFreeFloating
    aBtn.Adjustments(1) = 0.04
    aBtn.Fill.ForeColor.RGB = C_SEL()
    aBtn.Line.Visible = msoFalse
    aBtn.OnAction = "modFuelPanel.FuelApply"
    aBtn.ZOrder msoBringToFront
    With aBtn.TextFrame2
        .TextRange.Text = ChrW(&H2714) & " Appliquer"
        .TextRange.Font.Fill.ForeColor.RGB = C_WHITE()
        .TextRange.Font.Size = 9
        .TextRange.Font.Bold = msoTrue
        .TextRange.Font.Name = "Segoe UI"
        .TextRange.ParagraphFormat.Alignment = msoAlignCenter
        .HorizontalAnchor = msoAnchorCenter
        .VerticalAnchor = msoAnchorMiddle
    End With

    g_PanelOpen = True
End Sub

Private Sub SetItemText(sh As Shape, label As String, isSel As Boolean)
    With sh.TextFrame2
        .TextRange.Text = IIf(isSel, ChrW(&H2713) & "  " & label, "    " & label)
        .TextRange.Font.Fill.ForeColor.RGB = IIf(isSel, C_WHITE(), C_DARK())
        .TextRange.Font.Size = 9
        .TextRange.Font.Name = "Segoe UI"
        .HorizontalAnchor = msoAnchorCenter
        .VerticalAnchor = msoAnchorMiddle
    End With
End Sub

Private Sub ClosePanelShapes(ws As Worksheet)
    Dim j As Long
    For j = ws.Shapes.Count To 1 Step -1
        Dim nm As String: nm = ws.Shapes(j).Name
        If nm = FUP_BG Or nm = FUP_APPLY Then
            ws.Shapes(j).Delete
        ElseIf Left$(nm, Len(FUP_ITM_PFX)) = FUP_ITM_PFX Then
            ws.Shapes(j).Delete
        End If
    Next j
End Sub

' -----------------------------------------------------------------------
'  TOGGLE INDIVIDUEL
' -----------------------------------------------------------------------
Private Sub ToggleItemState(k As Integer)
    Dim ws As Worksheet: Set ws = DashWs()
    If ws Is Nothing Or Not g_PanelOpen Then Exit Sub

    Dim fuels() As String: fuels = ReadFuels()
    If k < 0 Or k >= g_FuelCount Then Exit Sub

    If fuels(k) = "(tous)" Then
        ' (tous) selectionne : deselecte tout le reste
        Dim j As Integer
        For j = 0 To g_FuelCount - 1
            g_Selected(j) = (j = 0)
        Next j
    Else
        ' Toggle l'item
        g_Selected(k) = Not g_Selected(k)
        ' Si on selectionne un fuel precis, deselecte (tous)
        If g_Selected(k) Then g_Selected(0) = False
        ' Si plus rien de selectionne -> retour a (tous)
        Dim anySet As Boolean: anySet = False
        Dim m As Integer
        For m = 0 To g_FuelCount - 1
            If g_Selected(m) Then anySet = True
        Next m
        If Not anySet Then g_Selected(0) = True
    End If

    ' Redessiner tous les items
    For j = 0 To g_FuelCount - 1
        Dim itm As Shape
        On Error Resume Next
        Set itm = ws.Shapes(FUP_ITM_PFX & j)
        On Error GoTo 0
        If Not itm Is Nothing Then
            itm.Fill.ForeColor.RGB = IIf(g_Selected(j), C_SEL(), C_UNSEL())
            SetItemText itm, fuels(j), g_Selected(j)
        End If
    Next j
End Sub

Public Sub FuelToggle_0(): ToggleItemState 0: End Sub
Public Sub FuelToggle_1(): ToggleItemState 1: End Sub
Public Sub FuelToggle_2(): ToggleItemState 2: End Sub
Public Sub FuelToggle_3(): ToggleItemState 3: End Sub
Public Sub FuelToggle_4(): ToggleItemState 4: End Sub
Public Sub FuelToggle_5(): ToggleItemState 5: End Sub
Public Sub FuelToggle_6(): ToggleItemState 6: End Sub
Public Sub FuelToggle_7(): ToggleItemState 7: End Sub
Public Sub FuelToggle_8(): ToggleItemState 8: End Sub
Public Sub FuelToggle_9(): ToggleItemState 9: End Sub

' -----------------------------------------------------------------------
'  APPLIQUER
' -----------------------------------------------------------------------
Public Sub FuelApply()
    Dim ws As Worksheet: Set ws = DashWs()
    If ws Is Nothing Or Not g_PanelOpen Then Exit Sub

    Dim fuels() As String: fuels = ReadFuels()
    Dim sel() As String
    Dim n As Integer: n = 0
    Dim k As Integer
    For k = 0 To g_FuelCount - 1
        If g_Selected(k) Then
            ReDim Preserve sel(n)
            sel(n) = fuels(k)
            n = n + 1
        End If
    Next k

    Dim result As String
    If n = 0 Or (n = 1 And sel(0) = "(tous)") Then
        result = "(tous)"
    ElseIf n = 1 Then
        result = sel(0)
    Else
        result = Join(sel, ",")
    End If

    ws.Range(FUEL_CELL).Value = result

    ' Fermer le panel
    ClosePanelShapes ws
    g_PanelOpen = False

    ' Mettre a jour le label du bouton trigger
    Dim btn As Shape
    On Error Resume Next
    Set btn = ws.Shapes(FUP_BTN)
    On Error GoTo 0
    If Not btn Is Nothing Then
        Dim lbl As String
        If Len(result) > 14 Then
            lbl = ChrW(&H25BC) & " " & Left$(result, 13) & Chr(133)
        Else
            lbl = ChrW(&H25BC) & " " & result
        End If
        btn.TextFrame2.TextRange.Text = lbl
    End If

    ' Rafraichir le dashboard
    On Error Resume Next
    modDashboardGraphiques.MAJ_Dashboard_Graphiques
    On Error GoTo 0
End Sub
