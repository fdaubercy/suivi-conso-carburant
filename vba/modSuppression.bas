Attribute VB_Name = "modSuppression"
'  modSuppression - Suppression d'un plein accessible a l'utilisateur (S5)
'  Construit par CODE le UserForm frmSupprimerPlein (liste des pleins) et
'  reutilise le moteur SupprimerPleinExcel (modSyncGS) :
'  selection par sync_id -> ActiveCell sur GS_Pleins -> suppression
'  locale + propagation Google Sheets (action=bulkDelete).
'  Accessible meme en plein ecran (GS_Pleins inaccessible par onglet).
' ============================================================

Option Explicit

Private Const FORM_NAME   As String = "frmSupprimerPlein"
Private Const WS_GS        As String = "GS_Pleins"
Private Const COL_DATE     As Integer = 2    ' B
Private Const COL_TYPE     As Integer = 3    ' C
Private Const COL_KM       As Integer = 4    ' D
Private Const COL_STATION  As Integer = 7    ' G
Private Const COL_SYNC_ID  As Integer = 15   ' O


' ------------------------------------------------------------
'  POINT D'ENTREE : construire (si besoin) puis afficher
' ------------------------------------------------------------
Public Sub SupprimerUnPlein()
    On Error GoTo ErrHandler
    If Not FormExisteSuppr() Then
        If Not AccesVBProjectOK() Then
            MsgBox "Pour creer le formulaire, activez une fois :" & vbNewLine & vbNewLine & _
                   "Fichier > Options > Centre de gestion de la confidentialite >" & vbNewLine & _
                   "Parametres des macros > COCHER" & vbNewLine & _
                   "'Acces approuve au modele objet du projet VBA'.", _
                   vbExclamation, "Supprimer un plein"
            Exit Sub
        End If
        ConstruireFormSuppr
    End If
    VBA.UserForms.Add(FORM_NAME).Show
    Exit Sub
ErrHandler:
    MsgBox "Erreur " & Err.Number & " : " & Err.Description, vbExclamation, "Supprimer un plein"
End Sub

' Action cablee depuis la tuile "Supprimer un plein" de l'Accueil
Public Sub AccSupprimerPlein()
    SupprimerUnPlein
End Sub

Private Function FormExisteSuppr() As Boolean
    Dim c As Object
    On Error Resume Next
    Set c = ThisWorkbook.VBProject.VBComponents(FORM_NAME)
    On Error GoTo 0
    FormExisteSuppr = Not (c Is Nothing)
End Function

Private Function AccesVBProjectOK() As Boolean
    On Error Resume Next
    Dim n As Long: n = ThisWorkbook.VBProject.VBComponents.count
    AccesVBProjectOK = (Err.Number = 0)
    On Error GoTo 0
End Function

' Retire le form (pour le reconstruire apres modification)
Public Sub ReconstruireFormSuppr()
    On Error Resume Next
    ThisWorkbook.VBProject.VBComponents.Remove _
        ThisWorkbook.VBProject.VBComponents(FORM_NAME)
    On Error GoTo 0
End Sub

' ------------------------------------------------------------
'  Construction du UserForm par code + injection du code-behind
' ------------------------------------------------------------
Private Sub ConstruireFormSuppr()
    Dim vbc As Object, dz As Object, ctl As Object
    Set vbc = ThisWorkbook.VBProject.VBComponents.Add(3)  ' 3 = MSForm
    vbc.name = FORM_NAME
    With vbc
        .Properties("Caption") = "Supprimer un plein"
        .Properties("Width") = 462
        .Properties("Height") = 388
        .Properties("BackColor") = RGB(245, 248, 252)
    End With
    Set dz = vbc.Designer

    Set ctl = dz.Controls.Add("Forms.Label.1")
    With ctl
        .name = "lblHead"
        .caption = "Selectionnez le plein a supprimer (local + Google Sheets) :"
        .Left = 12: .Top = 10: .Width = 438: .Height = 16
        .Font.bold = True
        .ForeColor = RGB(27, 58, 92)
    End With

    Set ctl = dz.Controls.Add("Forms.Label.1")
    With ctl
        .name = "lblCols"
        .caption = "Date            Carburant         Station                            Km"
        .Left = 16: .Top = 30: .Width = 438: .Height = 14
        .Font.Size = 8
        .ForeColor = RGB(107, 114, 128)
    End With

    Set ctl = dz.Controls.Add("Forms.ListBox.1")
    With ctl
        .name = "lstPleins"
        .Left = 12: .Top = 46: .Width = 438: .Height = 250
        .ColumnCount = 5
    End With

    Set ctl = dz.Controls.Add("Forms.Label.1")
    With ctl
        .name = "lblInfo"
        .caption = ""
        .Left = 12: .Top = 304: .Width = 300: .Height = 16
        .ForeColor = RGB(180, 0, 0)
        .Font.Size = 9
    End With

    Set ctl = dz.Controls.Add("Forms.CommandButton.1")
    With ctl
        .name = "btnFermer"
        .caption = "Fermer"
        .Left = 232: .Top = 324: .Width = 78: .Height = 30
    End With

    Set ctl = dz.Controls.Add("Forms.CommandButton.1")
    With ctl
        .name = "btnSupprimer"
        .caption = ChrW(10005) & " Supprimer"
        .Left = 318: .Top = 324: .Width = 132: .Height = 30
        .BackColor = RGB(200, 35, 51)
        .ForeColor = vbWhite
        .Font.bold = True
    End With

    InjecterCodeSuppr vbc
End Sub

Private Sub InjecterCodeSuppr(vbc As Object)
    Dim c As String
    c = ""
    c = c & "Option Explicit" & vbNewLine & vbNewLine
    c = c & "Private Sub UserForm_Initialize()" & vbNewLine
    c = c & "    Me.lstPleins.ColumnCount = 5" & vbNewLine
    c = c & "    Me.lstPleins.ColumnWidths = ""70 pt;82 pt;205 pt;48 pt;0 pt""" & vbNewLine
    c = c & "    modSuppression.RemplirListePleins Me.lstPleins" & vbNewLine
    c = c & "    If Me.lstPleins.ListCount = 0 Then Me.lblInfo.Caption = ""Aucun plein a supprimer.""" & vbNewLine
    c = c & "End Sub" & vbNewLine & vbNewLine
    c = c & "Private Sub btnFermer_Click(): Unload Me: End Sub" & vbNewLine & vbNewLine
    c = c & "Private Sub lstPleins_DblClick(ByVal Cancel As MSForms.ReturnBoolean)" & vbNewLine
    c = c & "    btnSupprimer_Click" & vbNewLine
    c = c & "End Sub" & vbNewLine & vbNewLine
    c = c & "Private Sub btnSupprimer_Click()" & vbNewLine
    c = c & "    If Me.lstPleins.ListIndex < 0 Then" & vbNewLine
    c = c & "        Me.lblInfo.Caption = ""Selectionnez d'abord un plein.""" & vbNewLine
    c = c & "        Exit Sub" & vbNewLine
    c = c & "    End If" & vbNewLine
    c = c & "    Dim sid As String" & vbNewLine
    c = c & "    sid = CStr(Me.lstPleins.List(Me.lstPleins.ListIndex, 4))" & vbNewLine
    c = c & "    Unload Me" & vbNewLine
    c = c & "    modSuppression.SupprimerParSyncId sid" & vbNewLine
    c = c & "End Sub" & vbNewLine
    With vbc.CodeModule
        If .CountOfLines > 0 Then .DeleteLines 1, .CountOfLines
        .AddFromString c
    End With
End Sub

' ------------------------------------------------------------
'  Remplit la ListBox depuis GS_Pleins (du plus recent au plus ancien)
'  Colonnes : 0=Date 1=Type 2=Station 3=Km 4=sync_id (masquee)
' ------------------------------------------------------------
Public Sub RemplirListePleins(lst As Object)
    Dim ws As Worksheet, lo As ListObject
    On Error Resume Next
    Set ws = ThisWorkbook.Worksheets(WS_GS)
    On Error GoTo 0
    If ws Is Nothing Then Exit Sub
    lst.Clear
    If ws.ListObjects.count = 0 Then Exit Sub
    Set lo = ws.ListObjects(1)
    If lo.ListRows.count = 0 Then Exit Sub

    Dim i As Long, rng As Range, idx As Long
    For i = lo.ListRows.count To 1 Step -1
        Set rng = lo.ListRows(i).Range
        Dim sid As String: sid = Trim(CStr(rng.Cells(1, COL_SYNC_ID).value))
        Dim dStr As String
        If IsDate(rng.Cells(1, COL_DATE).value) Then
            dStr = Format(rng.Cells(1, COL_DATE).value, "dd/mm/yyyy")
        Else
            dStr = Trim(CStr(rng.Cells(1, COL_DATE).value))
        End If
        lst.AddItem dStr
        idx = lst.ListCount - 1
        lst.List(idx, 1) = Trim(CStr(rng.Cells(1, COL_TYPE).value))
        lst.List(idx, 2) = Trim(CStr(rng.Cells(1, COL_STATION).value))
        lst.List(idx, 3) = Trim(CStr(rng.Cells(1, COL_KM).value))
        lst.List(idx, 4) = sid
    Next i
End Sub

' ------------------------------------------------------------
'  Supprime le plein identifie par sync_id en reutilisant
'  SupprimerPleinExcel (modSyncGS) : selectionne la ligne sur
'  GS_Pleins puis appelle le moteur complet.
' ------------------------------------------------------------
Public Sub SupprimerParSyncId(ByVal sid As String)
    sid = Trim(sid)
    If sid = "" Then
        MsgBox "Ce plein n'a pas d'identifiant de synchronisation.", _
               vbExclamation, "Supprimer un plein"
        Exit Sub
    End If
    Dim ws As Worksheet
    Set ws = ThisWorkbook.Worksheets(WS_GS)

    Dim r As Long, found As Long: found = 0
    Dim lastRow As Long
    lastRow = ws.Cells(ws.rows.count, 1).End(xlUp).row
    For r = 2 To lastRow
        If Trim(CStr(ws.Cells(r, COL_SYNC_ID).value)) = sid Then
            found = r: Exit For
        End If
    Next r
    If found = 0 Then
        MsgBox "Plein introuvable (deja supprime ?).", vbExclamation, "Supprimer un plein"
        Exit Sub
    End If

    Dim backSheet As String
    On Error Resume Next
    backSheet = ActiveSheet.name
    On Error GoTo 0

    Application.ScreenUpdating = False
    ws.Activate
    ws.Cells(found, 1).Select
    Application.ScreenUpdating = True

    ' Moteur complet : confirmation + propagation GS + suppression locale
    SupprimerPleinExcel

    On Error Resume Next
    If backSheet <> "" And backSheet <> WS_GS Then
        ThisWorkbook.Worksheets(backSheet).Activate
    Else
        ThisWorkbook.Worksheets("Accueil").Activate
    End If
    On Error GoTo 0
End Sub
