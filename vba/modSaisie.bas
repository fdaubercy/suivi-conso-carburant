Attribute VB_Name = "modSaisie"
' ============================================================
'  SUIVI E85 - Formulaire de saisie d'un plein     v3.3.0.4
'
'  Construit par CODE le UserForm "frmPleinE85" + son code-behind,
'  puis l'affiche. Ajoute la ligne directement dans le tableau
'  de GS_Pleins (genere Horodatage + sync_id UUID).
'
'  PREREQUIS (une seule fois) :
'    Fichier -> Options -> Centre de gestion de la confidentialite
'      -> Parametres du Centre... -> Parametres des macros
'      -> COCHER "Acces approuve au modele objet du projet VBA"
'
'  INSTALLATION :
'    1. Alt+F11 -> Fichier -> Importer modSaisie.bas
'    2. Alt+F8 -> NouveauPlein   (ou bouton sur la feuille)
'
'  USAGE :
'    NouveauPlein        -> construit le form si besoin, puis l'affiche
'    AjouterBoutonSaisie -> place un bouton "+ Nouveau plein" sur GS_Pleins
'    SupprimerFormSaisie -> retire le UserForm (pour le reconstruire)
' ============================================================
Option Explicit

Private Const FORM_NAME As String = "frmPleinE85"
Private Const WS_GS     As String = "GS_Pleins"

' Types de carburant proposes (alignes sur l'app web / FUEL_CONFIG)
Private Const TYPES_LISTE As String = _
    "SuperEthanol E85|Super 98|Sans Plomb 95|Sans Plomb E10|Gazole|GPLc"


' ════════════════════════════════════════════════════════════
'  POINT D'ENTREE : construire (si besoin) puis afficher
' ════════════════════════════════════════════════════════════
Public Sub NouveauPlein()
    On Error GoTo ErrHandler

    If Not FormExiste() Then
        If Not AccesVBProjectOK() Then
            MsgBox "Pour creer le formulaire, activez une fois :" & vbNewLine & vbNewLine & _
                   "Fichier > Options > Centre de gestion de la confidentialite >" & vbNewLine & _
                   "Parametres du Centre... > Parametres des macros >" & vbNewLine & _
                   "COCHER 'Acces approuve au modele objet du projet VBA'." & vbNewLine & vbNewLine & _
                   "Puis relancez NouveauPlein.", vbExclamation, "Suivi E85"
            Exit Sub
        End If
        ConstruireForm
    End If

    ' Afficher
    VBA.UserForms.Add(FORM_NAME).Show
    Exit Sub

ErrHandler:
    SetStatus "[Suivi E85] " & ChrW(9888) & " Erreur " & Err.Number & " : " & Err.Description
End Sub


' ════════════════════════════════════════════════════════════
'  Construction du UserForm par code + injection du code-behind
' ════════════════════════════════════════════════════════════
Private Sub ConstruireForm()
    Dim vbc As Object, dz As Object, ctl As Object

    Set vbc = ThisWorkbook.VBProject.VBComponents.Add(3) ' 3 = vbext_ct_MSForm
    vbc.Name = FORM_NAME
    With vbc
        .Properties("Caption") = ChrW(9981) & " Nouveau plein - Suivi E85"
        .Properties("Width") = 320
        .Properties("Height") = 372
        .Properties("BackColor") = RGB(245, 248, 252)
    End With
    Set dz = vbc.Designer

    Dim y As Long: y = 12
    Dim labW As Long: labW = 92
    Dim inW As Long:  inW = 188
    Dim inX As Long:  inX = 112

    AjoutLabel dz, "lblVeh", "Vehicule", 12, y + 2, labW
    AjoutCombo dz, "cboVehicule", inX, y, inW: y = y + 28
    AjoutLabel dz, "lblType", "Carburant", 12, y + 2, labW
    AjoutCombo dz, "cboType", inX, y, inW: y = y + 28
    AjoutLabel dz, "lblDate", "Date", 12, y + 2, labW
    AjoutText dz, "txtDate", inX, y, inW: y = y + 28
    AjoutLabel dz, "lblKm", "Km compteur", 12, y + 2, labW
    AjoutText dz, "txtKm", inX, y, inW: y = y + 28
    AjoutLabel dz, "lblLitres", "Litres", 12, y + 2, labW
    AjoutText dz, "txtLitres", inX, y, inW: y = y + 28
    AjoutLabel dz, "lblPrix", "Prix " & ChrW(8364) & "/L", 12, y + 2, labW
    AjoutText dz, "txtPrix", inX, y, inW: y = y + 28
    AjoutLabel dz, "lblStation", "Station", 12, y + 2, labW
    AjoutCombo dz, "cboStation", inX, y, inW: y = y + 32

    ' Cout calcule
    AjoutLabel dz, "lblCout", "Cout : -", 12, y, 296
    With dz.Controls("lblCout")
        .Font.Bold = True
        .ForeColor = RGB(27, 58, 92)
    End With
    y = y + 22

    ' Avertissement (km / doublon)
    AjoutLabel dz, "lblWarn", "", 12, y, 296
    With dz.Controls("lblWarn")
        .ForeColor = RGB(180, 0, 0)
        .Font.Size = 9
    End With
    y = y + 26

    ' Boutons
    Set ctl = dz.Controls.Add("Forms.CommandButton.1")
    With ctl
        .Name = "btnAjouter"
        .Caption = "Enregistrer"
        .Left = 112: .Top = y: .Width = 110: .Height = 28
        .BackColor = RGB(29, 158, 117)
        .ForeColor = vbWhite
        .Font.Bold = True
    End With
    Set ctl = dz.Controls.Add("Forms.CommandButton.1")
    With ctl
        .Name = "btnFermer"
        .Caption = "Fermer"
        .Left = 228: .Top = y: .Width = 72: .Height = 28
    End With

    ' Injection du code-behind
    InjecterCode vbc
End Sub

Private Sub InjecterCode(vbc As Object)
    Dim c As String
    c = ""
    c = c & "Option Explicit" & vbNewLine
    c = c & "Private mTypes As String" & vbNewLine & vbNewLine

    c = c & "Private Sub UserForm_Initialize()" & vbNewLine
    c = c & "    mTypes = """ & TYPES_LISTE & """" & vbNewLine
    c = c & "    Dim arr() As String, i As Long" & vbNewLine
    c = c & "    arr = Split(mTypes, ""|"")" & vbNewLine
    c = c & "    For i = 0 To UBound(arr): Me.cboType.AddItem arr(i): Next i" & vbNewLine
    c = c & "    modSaisie.RemplirCombo Me.cboVehicule, ""Vehicules"", 8" & vbNewLine
    c = c & "    modSaisie.RemplirCombo Me.cboStation, ""Stations"", 7" & vbNewLine
    c = c & "    Me.txtDate.Value = Format(Date, ""dd/mm/yyyy"")" & vbNewLine
    c = c & "    If Me.cboType.ListCount > 0 Then Me.cboType.ListIndex = 0" & vbNewLine
    c = c & "    Me.cboVehicule.SetFocus" & vbNewLine
    c = c & "End Sub" & vbNewLine & vbNewLine

    c = c & "Private Sub txtLitres_Change(): MajCout: End Sub" & vbNewLine
    c = c & "Private Sub txtPrix_Change(): MajCout: End Sub" & vbNewLine
    c = c & "Private Sub txtKm_Change(): VerifKm: End Sub" & vbNewLine
    c = c & "Private Sub cboVehicule_Change(): VerifKm: End Sub" & vbNewLine & vbNewLine

    c = c & "Private Sub MajCout()" & vbNewLine
    c = c & "    Dim l As Double, p As Double" & vbNewLine
    c = c & "    l = modSaisie.ToNum(Me.txtLitres.Value)" & vbNewLine
    c = c & "    p = modSaisie.ToNum(Me.txtPrix.Value)" & vbNewLine
    c = c & "    If l > 0 And p > 0 Then" & vbNewLine
    c = c & "        Me.lblCout.Caption = ""Cout : "" & Format(l * p, ""0.00"") & "" " & ChrW(8364) & """" & vbNewLine
    c = c & "    Else" & vbNewLine
    c = c & "        Me.lblCout.Caption = ""Cout : -""" & vbNewLine
    c = c & "    End If" & vbNewLine
    c = c & "End Sub" & vbNewLine & vbNewLine

    c = c & "Private Sub VerifKm()" & vbNewLine
    c = c & "    Dim km As Double, mx As Double" & vbNewLine
    c = c & "    km = modSaisie.ToNum(Me.txtKm.Value)" & vbNewLine
    c = c & "    If km <= 0 Or Me.cboVehicule.Value = """" Then Me.lblWarn.Caption = """": Exit Sub" & vbNewLine
    c = c & "    mx = modSaisie.MaxKmVehicule(CStr(Me.cboVehicule.Value))" & vbNewLine
    c = c & "    If mx > 0 And km < mx Then" & vbNewLine
    c = c & "        Me.lblWarn.Caption = ChrW(9888) & "" Km inferieur au dernier releve ("" & Format(mx, ""#,##0"") & "" km)""" & vbNewLine
    c = c & "    Else" & vbNewLine
    c = c & "        Me.lblWarn.Caption = """"" & vbNewLine
    c = c & "    End If" & vbNewLine
    c = c & "End Sub" & vbNewLine & vbNewLine

    c = c & "Private Sub btnFermer_Click(): Unload Me: End Sub" & vbNewLine & vbNewLine

    c = c & "Private Sub btnAjouter_Click()" & vbNewLine
    c = c & "    Dim msg As String" & vbNewLine
    c = c & "    msg = modSaisie.ValiderSaisie(Me.cboVehicule.Value, Me.cboType.Value, _" & vbNewLine
    c = c & "          Me.txtDate.Value, Me.txtKm.Value, Me.txtLitres.Value, Me.txtPrix.Value)" & vbNewLine
    c = c & "    If msg <> """" Then" & vbNewLine
    c = c & "        Me.lblWarn.Caption = msg: Exit Sub" & vbNewLine
    c = c & "    End If" & vbNewLine
    c = c & "    If modSaisie.EstDoublon(Me.txtDate.Value, Me.txtKm.Value, Me.txtLitres.Value) Then" & vbNewLine
    c = c & "        If MsgBox(""Un plein identique (date+km+litres) existe deja. Ajouter quand meme ?"", _" & vbNewLine
    c = c & "                  vbYesNo + vbQuestion, ""Doublon"") = vbNo Then Exit Sub" & vbNewLine
    c = c & "    End If" & vbNewLine
    c = c & "    modSaisie.EnregistrerPlein Me.cboVehicule.Value, Me.cboType.Value, _" & vbNewLine
    c = c & "        Me.txtDate.Value, Me.txtKm.Value, Me.txtLitres.Value, Me.txtPrix.Value, Me.cboStation.Value" & vbNewLine
    c = c & "    SetStatus ""[Suivi E85] Plein enregistre dans " & WS_GS & ".""" & vbNewLine
    c = c & "    Unload Me" & vbNewLine
    c = c & "End Sub" & vbNewLine

    vbc.CodeModule.AddFromString c
End Sub


' ════════════════════════════════════════════════════════════
'  LOGIQUE METIER (appelee par le code-behind du form)
' ════════════════════════════════════════════════════════════

' Remplit un ComboBox avec les valeurs distinctes :
'  - depuis la feuille nomFeuille (col A) si elle existe,
'  - sinon depuis la colonne colGS de GS_Pleins (valeurs distinctes).
Public Sub RemplirCombo(cbo As Object, nomFeuille As String, colGS As Long)
    cbo.Clear
    Dim ws As Worksheet, dic As Object, i As Long, v As String
    Set dic = CreateObject("Scripting.Dictionary")

    On Error Resume Next
    Set ws = ThisWorkbook.Sheets(nomFeuille)
    On Error GoTo 0

    If Not ws Is Nothing Then
        Dim lastR As Long
        lastR = ws.Cells(ws.Rows.Count, 1).End(xlUp).Row
        For i = 1 To lastR
            v = Trim$(CStr(ws.Cells(i, 1).Value))
            If v <> "" And LCase$(v) <> "stations" And LCase$(v) <> "vehicules" Then
                If Not dic.Exists(v) Then dic.Add v, 1
            End If
        Next i
    End If

    ' Repli / complement : valeurs distinctes de GS_Pleins
    Dim tbl As ListObject, dataWs As Worksheet
    On Error Resume Next
    Set dataWs = ThisWorkbook.Sheets(WS_GS)
    If Not dataWs Is Nothing Then If dataWs.ListObjects.Count > 0 Then Set tbl = dataWs.ListObjects(1)
    On Error GoTo 0
    If Not tbl Is Nothing Then
        If Not tbl.DataBodyRange Is Nothing Then
            Dim arr As Variant: arr = tbl.DataBodyRange.Value
            Dim n As Long: n = UBound(arr, 1)
            For i = 1 To n
                If colGS <= UBound(arr, 2) Then
                    v = Trim$(CStr(arr(i, colGS)))
                    If v <> "" Then If Not dic.Exists(v) Then dic.Add v, 1
                End If
            Next i
        End If
    End If

    Dim k As Variant
    For Each k In dic.Keys: cbo.AddItem k: Next k
End Sub

' Plus grand Km enregistre pour un vehicule donne (0 si aucun).
Public Function MaxKmVehicule(vehicule As String) As Double
    Dim tbl As ListObject, dataWs As Worksheet
    On Error Resume Next
    Set dataWs = ThisWorkbook.Sheets(WS_GS)
    If Not dataWs Is Nothing Then If dataWs.ListObjects.Count > 0 Then Set tbl = dataWs.ListObjects(1)
    On Error GoTo 0
    If tbl Is Nothing Then Exit Function
    If tbl.DataBodyRange Is Nothing Then Exit Function

    Dim arr As Variant: arr = tbl.DataBodyRange.Value
    Dim i As Long, mx As Double, km As Double
    For i = 1 To UBound(arr, 1)
        If CStr(arr(i, 8)) = vehicule Then       ' H = Vehicule
            km = ToNum(arr(i, 4))                 ' D = Km
            If km > mx Then mx = km
        End If
    Next i
    MaxKmVehicule = mx
End Function

' Doublon : meme Date + Km + Litres deja present.
Public Function EstDoublon(dateStr As String, kmStr As String, litStr As String) As Boolean
    Dim tbl As ListObject, dataWs As Worksheet
    On Error Resume Next
    Set dataWs = ThisWorkbook.Sheets(WS_GS)
    If Not dataWs Is Nothing Then If dataWs.ListObjects.Count > 0 Then Set tbl = dataWs.ListObjects(1)
    On Error GoTo 0
    If tbl Is Nothing Then Exit Function
    If tbl.DataBodyRange Is Nothing Then Exit Function

    Dim d As Date: If IsDate(dateStr) Then d = CDate(dateStr) Else Exit Function
    Dim km As Double: km = ToNum(kmStr)
    Dim lit As Double: lit = ToNum(litStr)

    Dim arr As Variant: arr = tbl.DataBodyRange.Value
    Dim i As Long
    For i = 1 To UBound(arr, 1)
        If IsDate(arr(i, 2)) Then
            If CDate(arr(i, 2)) = d _
               And Abs(ToNum(arr(i, 4)) - km) < 0.5 _
               And Abs(ToNum(arr(i, 5)) - lit) < 0.01 Then
                EstDoublon = True
                Exit Function
            End If
        End If
    Next i
End Function

' Validation des champs. Retourne "" si OK, sinon le message d'erreur.
Public Function ValiderSaisie(veh As String, typ As String, dateStr As String, _
                               kmStr As String, litStr As String, prixStr As String) As String
    If Trim$(veh) = "" Then ValiderSaisie = ChrW(9888) & " Choisissez un vehicule": Exit Function
    If Trim$(typ) = "" Then ValiderSaisie = ChrW(9888) & " Choisissez un carburant": Exit Function
    If Not IsDate(dateStr) Then ValiderSaisie = ChrW(9888) & " Date invalide (jj/mm/aaaa)": Exit Function
    If ToNum(kmStr) <= 0 Then ValiderSaisie = ChrW(9888) & " Km invalide": Exit Function
    If ToNum(litStr) <= 0 Then ValiderSaisie = ChrW(9888) & " Litres invalides": Exit Function
    If ToNum(prixStr) <= 0 Then ValiderSaisie = ChrW(9888) & " Prix invalide": Exit Function
    ValiderSaisie = ""
End Function

' Ajoute la ligne dans le tableau de GS_Pleins (A..P) + sync_id UUID.
Public Sub EnregistrerPlein(veh As String, typ As String, dateStr As String, _
                             kmStr As String, litStr As String, prixStr As String, station As String)
    Dim dataWs As Worksheet, tbl As ListObject
    Set dataWs = ThisWorkbook.Sheets(WS_GS)
    Set tbl = dataWs.ListObjects(1)

    Dim lr As ListRow
    Set lr = tbl.ListRows.Add
    Dim rng As Range
    Set rng = lr.Range

    ' Colonnes A..P (1..16) du schema E85
    rng.Cells(1, 1).Value = Now                          ' A Horodatage
    rng.Cells(1, 2).Value = CDate(dateStr)               ' B Date
    rng.Cells(1, 2).NumberFormat = "dd/mm/yyyy"
    rng.Cells(1, 3).Value = typ                          ' C Type
    rng.Cells(1, 4).Value = ToNum(kmStr)                 ' D Km
    rng.Cells(1, 5).Value = ToNum(litStr)                ' E Litres
    rng.Cells(1, 6).Value = ToNum(prixStr)               ' F Prix
    rng.Cells(1, 7).Value = station                      ' G Station
    rng.Cells(1, 8).Value = veh                          ' H Vehicule
    ' I..N : prix station laisses vides (remplis par sync web)
    If rng.Columns.Count >= 15 Then rng.Cells(1, 15).Value = NewUUID()  ' O sync_id
End Sub


' ════════════════════════════════════════════════════════════
'  UTILITAIRES
' ════════════════════════════════════════════════════════════

' Conversion robuste en Double (gere virgule decimale, vide, texte).
Public Function ToNum(v As Variant) As Double
    Dim s As String
    s = Trim$(CStr(v))
    If s = "" Then ToNum = 0: Exit Function
    s = Replace(s, " ", "")
    s = Replace(s, ",", ".")
    If IsNumeric(s) Then ToNum = CDbl(val(s)) Else ToNum = 0
End Function

' UUID v4 (meme format que Utilities.getUuid cote GAS).
Public Function NewUUID() As String
    Dim h As String, i As Long
    Randomize
    For i = 1 To 32
        h = h & Hex$(Int(Rnd * 16))
        If i = 8 Or i = 12 Or i = 16 Or i = 20 Then h = h & "-"
    Next i
    NewUUID = LCase$(h)
End Function

Private Function FormExiste() As Boolean
    Dim vbc As Object
    On Error Resume Next
    Set vbc = ThisWorkbook.VBProject.VBComponents(FORM_NAME)
    On Error GoTo 0
    FormExiste = Not (vbc Is Nothing)
End Function

Private Function AccesVBProjectOK() As Boolean
    On Error Resume Next
    Dim n As Long
    n = ThisWorkbook.VBProject.VBComponents.Count
    AccesVBProjectOK = (Err.Number = 0)
    On Error GoTo 0
End Function

' Place un bouton "+ Nouveau plein" en haut de GS_Pleins.
Public Sub AjouterBoutonSaisie()
    Dim ws As Worksheet
    On Error Resume Next
    Set ws = ThisWorkbook.Sheets(WS_GS)
    On Error GoTo 0
    If ws Is Nothing Then Exit Sub

    Dim sh As Shape
    On Error Resume Next
    ws.Shapes("btnNouveauPlein").Delete
    On Error GoTo 0

    Set sh = ws.Shapes.AddShape(msoShapeRoundedRectangle, 8, 4, 130, 26)
    sh.Name = "btnNouveauPlein"
    sh.Fill.ForeColor.RGB = RGB(29, 158, 117)
    sh.Line.Visible = msoFalse
    sh.TextFrame.Characters.Text = "+ Nouveau plein"
    sh.TextFrame.Characters.Font.Color = vbWhite
    sh.TextFrame.Characters.Font.Bold = True
    sh.TextFrame.Characters.Font.Size = 10
    sh.TextFrame.HorizontalAlignment = xlHAlignCenter
    sh.TextFrame.VerticalAlignment = xlVAlignCenter
    sh.OnAction = "NouveauPlein"
End Sub

Public Sub SupprimerFormSaisie()
    On Error Resume Next
    ThisWorkbook.VBProject.VBComponents.Remove _
        ThisWorkbook.VBProject.VBComponents(FORM_NAME)
    On Error GoTo 0
End Sub


' ── Helpers de construction de controles ──
Private Sub AjoutLabel(dz As Object, nom As String, cap As String, x As Long, y As Long, w As Long)
    Dim ctl As Object
    Set ctl = dz.Controls.Add("Forms.Label.1")
    With ctl
        .Name = nom
        .Caption = cap
        .Left = x: .Top = y: .Width = w: .Height = 16
        .Font.Size = 9
        .ForeColor = RGB(50, 80, 110)
    End With
End Sub

Private Sub AjoutText(dz As Object, nom As String, x As Long, y As Long, w As Long)
    Dim ctl As Object
    Set ctl = dz.Controls.Add("Forms.TextBox.1")
    With ctl
        .Name = nom
        .Left = x: .Top = y: .Width = w: .Height = 20
        .Font.Size = 10
    End With
End Sub

Private Sub AjoutCombo(dz As Object, nom As String, x As Long, y As Long, w As Long)
    Dim ctl As Object
    Set ctl = dz.Controls.Add("Forms.ComboBox.1")
    With ctl
        .Name = nom
        .Left = x: .Top = y: .Width = w: .Height = 20
        .Font.Size = 10
    End With
End Sub
