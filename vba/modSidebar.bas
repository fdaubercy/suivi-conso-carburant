Attribute VB_Name = "modSidebar"
' ============================================================
'  MODULE : modSidebar  (Sidebar navigation verticale - Variante A)
'  UserForm modeless, persistant sur tous les onglets.
'
'  INSTALLATION :
'    1. Importer modSidebar.bas dans le VBA Project
'    2. Executer ShowSidebar une fois (ou appeler depuis Workbook_Open)
'
'  USAGE PUBLIC :
'    ShowSidebar          -> cree et affiche la sidebar
'    HideSidebar          -> masque la sidebar
'    RepositionSidebar    -> repositionne apres SheetActivate/WindowResize
'    ExpandSidebar        -> anime l'ouverture (appele par le form)
'    CollapseSidebar      -> anime la fermeture (appele par OnTime ou direct)
'    NavToFromSidebar(t)  -> navigation + collapse
' ============================================================
Option Explicit

' -- Dimensions --
Private Const FORM_NAME     As String = "frmSidebar"
Private Const W_COLLAPSED   As Single = 44
Private Const W_EXPANDED    As Single = 182
Private Const ANIM_STEP     As Single = 14
Private Const AUTO_CLOSE_S  As Integer = 4
Private Const NAV_COUNT     As Integer = 6

' -- Couleurs (charte #1B3A5C) --
Private Const C_DARK        As Long = 6044187    ' #1B3A5C
Private Const C_DARK2       As Long = 3347245    ' #12283D
Private Const C_SEPARATOR   As Long = 4671630    ' #474E6E
Private Const C_WHITE       As Long = 16777215

' -- Etat --
Private g_Expanded          As Boolean
Private g_TimerTime         As Date
Private g_TimerSet          As Boolean

' ═══════════════════════════════════════════════════════════
'  POINTS D'ENTREE PUBLICS
' ═══════════════════════════════════════════════════════════

Public Sub ShowSidebar()
    On Error GoTo EH
    If Not AccesVBProjectOK() Then
        MsgBox "Activez l'acces au modele objet VBA :" & vbNewLine & _
               "Options > Centre de confidentialite > Parametres des macros > " & _
               "Acces approuve au modele objet du projet VBA.", _
               vbExclamation, "Sidebar"
        Exit Sub
    End If
    If Not FormExiste() Then BuildForm
    Dim f As Object: Set f = GetFormInstance()
    If f Is Nothing Then BuildForm: Set f = GetFormInstance()
    If f Is Nothing Then Exit Sub
    RepositionSidebar
    If Not f.Visible Then f.Show vbModeless
    Exit Sub
EH:
    Debug.Print "modSidebar.ShowSidebar ERR " & Err.Number & ": " & Err.Description
End Sub

Public Sub HideSidebar()
    If g_TimerSet Then CancelTimer
    Dim f As Object: Set f = GetFormInstance()
    If Not f Is Nothing Then
        On Error Resume Next
        Unload f
        On Error GoTo 0
    End If
    g_Expanded = False
End Sub

Public Sub RepositionSidebar()
    Dim f As Object: Set f = GetFormInstance()
    If f Is Nothing Then Exit Sub
    On Error Resume Next
    Dim wb As Window: Set wb = Application.ActiveWindow
    If wb Is Nothing Then Exit Sub
    f.Left = Application.Left + wb.Left
    f.Top  = Application.Top  + wb.Top
    f.Height = wb.Height
    On Error GoTo 0
End Sub

Public Sub ExpandSidebar()
    Dim f As Object: Set f = GetFormInstance()
    If f Is Nothing Then Exit Sub
    If g_Expanded Then
        ' Deja ouvert : reset le timer auto-repli
        CancelTimer
        SetCollapseTimer
        Exit Sub
    End If
    g_Expanded = True
    ShowNavLabels f, True
    Dim w As Single
    For w = W_COLLAPSED To W_EXPANDED Step ANIM_STEP
        f.Width = w: DoEvents
    Next w
    f.Width = W_EXPANDED
    SetCollapseTimer
End Sub

Public Sub CollapseSidebar()
    g_TimerSet = False
    Dim f As Object: Set f = GetFormInstance()
    If f Is Nothing Or Not g_Expanded Then Exit Sub
    g_Expanded = False
    Dim w As Single
    For w = W_EXPANDED To W_COLLAPSED Step -ANIM_STEP
        f.Width = w: DoEvents
    Next w
    f.Width = W_COLLAPSED
    ShowNavLabels f, False
End Sub

Public Sub NavToFromSidebar(ByVal target As String)
    CancelTimer
    CollapseSidebar
    On Error Resume Next
    ThisWorkbook.Sheets(target).Activate
    On Error GoTo 0
End Sub

' ═══════════════════════════════════════════════════════════
'  CONSTRUCTION DU FORMULAIRE
' ═══════════════════════════════════════════════════════════
Private Sub BuildForm()
    ' Supprimer l'ancienne version si elle existe
    On Error Resume Next
    ThisWorkbook.VBProject.VBComponents.Remove _
        ThisWorkbook.VBProject.VBComponents(FORM_NAME)
    On Error GoTo 0

    Dim vbc As Object
    Set vbc = ThisWorkbook.VBProject.VBComponents.Add(3)  ' vbext_ct_MSForm
    vbc.Name = FORM_NAME

    Dim h As Single: h = 400
    With vbc
        .Properties("Caption")         = ""
        .Properties("Width")           = W_COLLAPSED
        .Properties("Height")          = h
        .Properties("BackColor")       = C_DARK
        .Properties("BorderStyle")     = 0      ' fmBorderStyleNone
        .Properties("ShowModal")       = False
        .Properties("StartUpPosition") = 0      ' positionne manuellement
    End With

    Dim dz As Object: Set dz = vbc.Designer

    ' ── Bouton hamburger ─────────────────────────────────
    AddLabel dz, "lblHam", ChrW(9776), 0, 2, 44, 36, C_WHITE, C_DARK2, 1, 16, True, 2

    ' Separateur sous le ham
    AddSeparator dz, "lblSep0", 4, 38, 36, 1

    ' ── Items de navigation ──────────────────────────────
    Dim icons(5) As Long, labels(5) As String, tgts(5) As String
    icons(0) = &H1F3E0: labels(0) = "  Accueil":          tgts(0) = "Accueil"
    icons(1) = &H1F4CA: labels(1) = "  Tableau de bord":  tgts(1) = "Tableau de bord"
    icons(2) = &H1F5FA: labels(2) = "  Carte":            tgts(2) = "Carte"
    icons(3) = &H26FD:  labels(3) = "  Suivi Carburant":  tgts(3) = "Suivi Carburant"
    icons(4) = &H1F4B6: labels(4) = "  Prix / Station":   tgts(4) = "Prix par Station"
    icons(5) = &H2699:  labels(5) = "  Reglages":         tgts(5) = "Reglages"

    Dim y As Single: y = 44
    Dim i As Integer
    For i = 0 To NAV_COUNT - 1
        ' Icone (toujours visible, largeur = zone collapsed)
        AddLabel dz, "lblIco" & i, Emo(icons(i)), 0, y, W_COLLAPSED, 36, C_WHITE, C_DARK, 1, 14, False, 2
        ' Texte (masque par defaut, visible seulement quand expanded)
        AddLabel dz, "lblTxt" & i, labels(i), W_COLLAPSED, y, W_EXPANDED - W_COLLAPSED, 36, _
                 C_WHITE, C_DARK, 1, 10, False, 1
        SetVisible dz, "lblTxt" & i, False
        ' Separateur entre items
        AddSeparator dz, "lblSepN" & i, 8, y + 36, W_COLLAPSED - 16, 1
        y = y + 40
    Next i

    vbc.Properties("Height") = y + 10
    InjectFormCode vbc, tgts
End Sub

Private Sub AddLabel(dz As Object, nm As String, caption As String, _
                     L As Single, T As Single, W As Single, H As Single, _
                     foreClr As Long, backClr As Long, backStyle As Integer, _
                     fontSize As Single, bold As Boolean, align As Integer)
    Dim ctl As Object
    Set ctl = dz.Controls.Add("Forms.Label.1")
    With ctl
        .Name = nm: .Caption = caption
        .Left = L: .Top = T: .Width = W: .Height = H
        .ForeColor = foreClr: .BackColor = backClr: .BackStyle = backStyle
        .Font.Size = fontSize: .Font.Bold = bold: .Font.Name = "Segoe UI"
        .TextAlign = align
    End With
End Sub

Private Sub AddSeparator(dz As Object, nm As String, L As Single, T As Single, W As Single, H As Single)
    Dim ctl As Object
    Set ctl = dz.Controls.Add("Forms.Label.1")
    With ctl
        .Name = nm: .Caption = ""
        .Left = L: .Top = T: .Width = W: .Height = H
        .BackColor = C_SEPARATOR: .BackStyle = 1
    End With
End Sub

Private Sub SetVisible(dz As Object, nm As String, visible As Boolean)
    On Error Resume Next
    dz.Controls(nm).Visible = visible
    On Error GoTo 0
End Sub

Private Sub InjectFormCode(vbc As Object, tgts() As String)
    Dim c As Object: Set c = vbc.CodeModule
    c.DeleteLines 1, c.CountOfLines

    Dim code As String
    code = "Option Explicit" & vbLf

    ' Empeche la fermeture (bouton X) : masquer plutot
    code = code & "Private Sub UserForm_QueryClose(Cancel As Integer, CloseMode As Integer)" & vbLf
    code = code & "    If CloseMode = 0 Then Cancel = True: Me.Hide" & vbLf
    code = code & "End Sub" & vbLf

    ' Click sur le hamburger -> expand/collapse
    code = code & "Private Sub lblHam_Click()" & vbLf
    code = code & "    modSidebar.ExpandSidebar" & vbLf
    code = code & "End Sub" & vbLf

    ' Click sur icone ou texte -> navigation directe
    Dim i As Integer
    For i = 0 To NAV_COUNT - 1
        code = code & "Private Sub lblIco" & i & "_Click()" & vbLf
        code = code & "    modSidebar.NavToFromSidebar """ & tgts(i) & """" & vbLf
        code = code & "End Sub" & vbLf
        code = code & "Private Sub lblTxt" & i & "_Click()" & vbLf
        code = code & "    modSidebar.NavToFromSidebar """ & tgts(i) & """" & vbLf
        code = code & "End Sub" & vbLf
    Next i

    c.AddFromString code
End Sub

' ═══════════════════════════════════════════════════════════
'  HELPERS INTERNES
' ═══════════════════════════════════════════════════════════

Private Function GetFormInstance() As Object
    Dim uf As Object
    For Each uf In VBA.UserForms
        If uf.Name = FORM_NAME Then
            Set GetFormInstance = uf
            Exit Function
        End If
    Next uf
End Function

Private Sub ShowNavLabels(f As Object, visible As Boolean)
    On Error Resume Next
    Dim i As Integer
    For i = 0 To NAV_COUNT - 1
        f.Controls("lblTxt" & i).Visible = visible
    Next i
    On Error GoTo 0
End Sub

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
        Emo = ChrW(&HD800 + (v \ &H400)) & ChrW(&HDC00 + (v And &H3FF))
    End If
End Function

Private Function FormExiste() As Boolean
    On Error Resume Next
    Dim vbc As Object
    Set vbc = ThisWorkbook.VBProject.VBComponents(FORM_NAME)
    FormExiste = Not (vbc Is Nothing)
    On Error GoTo 0
End Function

Private Function AccesVBProjectOK() As Boolean
    On Error Resume Next
    Dim n As Long: n = ThisWorkbook.VBProject.VBComponents.Count
    AccesVBProjectOK = (Err.Number = 0)
    Err.Clear
End Function
