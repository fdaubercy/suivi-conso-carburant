---
name: excel-vba-expert
description: >
  Expert-level skill for VBA Excel programming and professional dashboard/graphisme creation.
  Use this skill whenever the user wants to: write or debug VBA macros, create UserForms,
  automate Excel tasks with code, build dashboards, design charts or graphiques professionnels,
  create interactive navigation between sheets, manage events (Workbook_Open, Change, etc.),
  manipulate ranges/cells/sheets programmatically, build reporting tools, KPI trackers,
  or any Excel visual design. Trigger even when the user says "macro", "bouton", "formulaire",
  "graphique", "tableau de bord", "dashboard", "automatiser", "UserForm", or similar terms
  in French or English. Always use this skill for any Excel VBA or design task.
---

# Excel VBA Expert

## Principes fondamentaux

### Qualité du code VBA
- Toujours déclarer les variables : `Option Explicit` en tête de module
- Utiliser des noms de variables explicites en français ou anglais selon le contexte du projet
- Commenter les sections complexes avec `' ----`
- Gérer les erreurs avec `On Error GoTo ErrHandler`
- Libérer les objets : `Set obj = Nothing` en fin de procédure
- Optimiser les performances : désactiver le rafraîchissement écran et les calculs automatiques si nécessaire

```vba
' En-tête type d'une macro optimisée
Sub MaMacro()
    Application.ScreenUpdating = False
    Application.Calculation = xlCalculationManual
    
    On Error GoTo ErrHandler
    
    ' ... code ici ...
    
    GoTo Fin
ErrHandler:
    MsgBox "Erreur " & Err.Number & ": " & Err.Description, vbCritical
Fin:
    Application.ScreenUpdating = True
    Application.Calculation = xlCalculationAutomatic
End Sub
```

---

## VBA — Fondamentaux

### Manipulation de cellules et plages

```vba
' Référencer des cellules
Dim ws As Worksheet
Set ws = ThisWorkbook.Sheets("Feuil1")

ws.Range("A1").Value = "Valeur"
ws.Cells(1, 1).Value = "Valeur"          ' équivalent
ws.Range("A1:D10").Interior.Color = RGB(173, 216, 230)

' Dernière ligne/colonne remplie
Dim lastRow As Long
lastRow = ws.Cells(ws.Rows.Count, "A").End(xlUp).Row

Dim lastCol As Long
lastCol = ws.Cells(1, ws.Columns.Count).End(xlToLeft).Column

' Parcourir une plage
Dim cell As Range
For Each cell In ws.Range("A2:A" & lastRow)
    If cell.Value <> "" Then
        ' traitement
    End If
Next cell
```

### Manipulation des feuilles

```vba
' Créer / supprimer / renommer une feuille
Dim ws As Worksheet
Set ws = ThisWorkbook.Sheets.Add
ws.Name = "Rapport_2024"

' Supprimer sans confirmation
Application.DisplayAlerts = False
ThisWorkbook.Sheets("Ancienne").Delete
Application.DisplayAlerts = True

' Copier une feuille
ThisWorkbook.Sheets("Modèle").Copy After:=ThisWorkbook.Sheets(ThisWorkbook.Sheets.Count)
```

### Tableaux (Arrays)

```vba
' Tableau dynamique — très performant pour de grandes données
Dim data() As Variant
Dim n As Long

' Charger une plage entière en mémoire (beaucoup plus rapide que cellule par cellule)
data = ws.Range("A1:D" & lastRow).Value

' Manipuler en mémoire
For i = 1 To UBound(data, 1)
    data(i, 3) = data(i, 1) + data(i, 2)
Next i

' Réécrire d'un coup
ws.Range("A1:D" & lastRow).Value = data
```

---

## UserForms — Création, Modification & Paramétrage Expert

---

### 1. Création d'un UserForm par code VBA

```vba
' Créer un UserForm entièrement par code (sans passer par l'IDE)
Sub CreerUserFormDynamique()
    Dim uf As Object
    Dim ctrl As Object
    
    ' Créer le formulaire
    Set uf = ThisWorkbook.VBProject.VBComponents.Add(3) ' 3 = vbext_ct_MSForm
    uf.Properties("Caption") = "Saisie Patient"
    uf.Properties("Width")   = 400
    uf.Properties("Height")  = 300
    uf.Properties("BackColor") = RGB(245, 248, 252)
    
    ' Ajouter un Label
    Set ctrl = uf.Designer.Controls.Add("Forms.Label.1")
    With ctrl
        .Caption = "Nom du patient :"
        .Left = 12 : .Top = 20
        .Width = 120 : .Height = 18
        .Font.Size = 9
    End With
    
    ' Ajouter un TextBox
    Set ctrl = uf.Designer.Controls.Add("Forms.TextBox.1")
    With ctrl
        .Name = "txtNom"
        .Left = 140 : .Top = 18
        .Width = 200 : .Height = 20
    End With
    
    ' Ajouter un bouton Valider
    Set ctrl = uf.Designer.Controls.Add("Forms.CommandButton.1")
    With ctrl
        .Name    = "btnValider"
        .Caption = "Valider"
        .Left    = 140 : .Top = 240
        .Width   = 80  : .Height = 24
        .BackColor = RGB(51, 102, 0)
        .ForeColor = RGB(255, 255, 255)
    End With
    
    ' Afficher
    VBA.UserForms.Add(uf.Name).Show
End Sub
```

---

### 2. Paramétrage visuel du formulaire

#### Propriétés clés du UserForm

```vba
' Dans UserForm_Initialize ou via les Properties dans l'IDE

' Apparence générale
Me.Caption      = "Registre Maternité — Nouveau dossier"
Me.BackColor    = RGB(245, 248, 252)
Me.BorderStyle  = fmBorderStyleSingle
Me.Width        = 520
Me.Height       = 480

' Comportement
Me.StartUpPosition = 1          ' 1=centré par rapport au parent, 2=centré écran
Me.ShowModal       = True       ' Bloque l'accès à Excel pendant la saisie
Me.Zoom            = 100        ' Zoom du formulaire (75 à 400)

' Icône personnalisée dans la barre de titre (chemin vers .ico)
' Me.Picture = LoadPicture("C:\Icons\hopital.ico")

' Empêcher le redimensionnement
' (à faire dans le module ThisWorkbook > UserForm_Resize si besoin)
```

#### Style visuel d'un contrôle

```vba
' Appliquer un style uniforme à tous les TextBox du formulaire
Private Sub StylerControles()
    Dim ctrl As Control
    For Each ctrl In Me.Controls
        If TypeName(ctrl) = "TextBox" Then
            ctrl.BackColor    = RGB(255, 255, 255)
            ctrl.BorderColor  = RGB(180, 200, 220)
            ctrl.Font.Size    = 9
            ctrl.Font.Name    = "Calibri"
            ctrl.SpecialEffect = fmSpecialEffectSunken
        End If
        If TypeName(ctrl) = "Label" Then
            ctrl.Font.Bold    = True
            ctrl.Font.Size    = 9
            ctrl.ForeColor    = RGB(50, 80, 110)
        End If
    Next ctrl
End Sub
```

---

### 3. Tous les contrôles — Création et événements complets

#### TextBox

```vba
' --- Propriétés utiles ---
Me.txtNom.MaxLength      = 50          ' Limite caractères
Me.txtNom.PasswordChar   = "*"         ' Masquer (mot de passe)
Me.txtNom.MultiLine      = True        ' Texte multiligne
Me.txtNom.ScrollBars     = fmScrollBarsVertical
Me.txtNom.WordWrap       = True
Me.txtNom.Locked         = True        ' Lecture seule
Me.txtNom.TabIndex       = 1           ' Ordre de tabulation
Me.txtNom.EnterKeyBehavior = True      ' Entrée = nouvelle ligne (si MultiLine)

' --- Événements ---
Private Sub txtNom_Change()
    ' Déclenché à chaque frappe
    Me.lblCompteur.Caption = Len(Me.txtNom.Value) & " / 50"
End Sub

Private Sub txtNom_Exit(ByVal Cancel As MSForms.ReturnBoolean)
    ' Déclenché quand on quitte le champ — idéal pour validation
    If Me.txtNom.Value = "" Then
        MsgBox "Champ obligatoire !", vbExclamation
        Cancel = True   ' Empêche de quitter le champ
    End If
End Sub

Private Sub txtAge_KeyPress(ByVal KeyAscii As MSForms.ReturnInteger)
    ' Autoriser uniquement chiffres et touche Retour arrière
    Select Case KeyAscii
        Case 48 To 57   ' 0-9
        Case 8          ' Backspace
        Case Else
            KeyAscii = 0
            Beep
    End Select
End Sub

Private Sub txtDate_KeyPress(ByVal KeyAscii As MSForms.ReturnInteger)
    ' Autoriser chiffres et séparateur /
    Select Case KeyAscii
        Case 48 To 57, 47   ' 0-9 et /
        Case 8
        Case Else : KeyAscii = 0
    End Select
End Sub

Private Sub txtDate_Exit(ByVal Cancel As MSForms.ReturnBoolean)
    ' Valider le format de date
    If Me.txtDate.Value <> "" Then
        If Not IsDate(Me.txtDate.Value) Then
            MsgBox "Format de date invalide (JJ/MM/AAAA)", vbExclamation
            Cancel = True
        Else
            Me.txtDate.Value = Format(CDate(Me.txtDate.Value), "dd/mm/yyyy")
        End If
    End If
End Sub
```

#### ComboBox

```vba
' --- Remplissage ---
' Depuis une plage Excel
Private Sub RemplirCombo(cbo As MSForms.ComboBox, ws As Worksheet, colonne As Integer)
    cbo.Clear
    Dim lastRow As Long
    lastRow = ws.Cells(ws.Rows.Count, colonne).End(xlUp).Row
    Dim i As Long
    For i = 2 To lastRow
        If ws.Cells(i, colonne).Value <> "" Then
            cbo.AddItem ws.Cells(i, colonne).Value
        End If
    Next i
End Sub

' Depuis un tableau statique
Me.cboGroupe.List = Array("A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-")

' Depuis une plage nommée
Me.cboService.RowSource = "Listes!ServicesMedecine"  ' Plage nommée dans Excel

' --- Propriétés ---
Me.cboService.Style       = fmStyleDropDownList  ' Pas de saisie libre
' ou : fmStyleDropDownCombo pour permettre la saisie libre

Me.cboService.MatchRequired = True   ' Oblige à choisir dans la liste
Me.cboService.ListRows      = 10     ' Nb de lignes visibles dans le dropdown
Me.cboService.ColumnCount   = 2      ' Afficher 2 colonnes
Me.cboService.ColumnWidths  = "100;60"
Me.cboService.BoundColumn   = 1      ' Colonne dont la valeur est renvoyée

' --- Événements ---
Private Sub cboService_Change()
    ' Cascader : remplir un 2ème ComboBox selon la sélection du 1er
    Me.cboPraticien.Clear
    Dim ws As Worksheet
    Set ws = ThisWorkbook.Sheets("Listes")
    Dim i As Long
    Dim lastRow As Long
    lastRow = ws.Cells(ws.Rows.Count, 3).End(xlUp).Row
    For i = 2 To lastRow
        If ws.Cells(i, 2).Value = Me.cboService.Value Then
            Me.cboPraticien.AddItem ws.Cells(i, 3).Value
        End If
    Next i
End Sub

Private Sub cboService_DropButtonClick()
    ' Rafraîchir la liste à chaque ouverture du dropdown
    Call RemplirCombo(Me.cboService, ThisWorkbook.Sheets("Listes"), 1)
End Sub
```

#### ListBox

```vba
' --- Remplissage multi-colonnes ---
Me.lstDossiers.ColumnCount  = 4
Me.lstDossiers.ColumnWidths = "80;120;80;60"
Me.lstDossiers.ColumnHeads  = True   ' Afficher en-têtes (si RowSource)
Me.lstDossiers.RowSource    = "Base!A1:D100"

' Remplissage manuel ligne par ligne
Dim i As Long
For i = 2 To lastRow
    Me.lstDossiers.AddItem ws.Cells(i, 1).Value
    Me.lstDossiers.List(Me.lstDossiers.ListCount - 1, 1) = ws.Cells(i, 2).Value
    Me.lstDossiers.List(Me.lstDossiers.ListCount - 1, 2) = ws.Cells(i, 3).Value
Next i

' --- Sélection ---
Me.lstDossiers.MultiSelect = fmMultiSelectSingle    ' 1 seul élément
' ou fmMultiSelectMulti  (Ctrl+clic)
' ou fmMultiSelectExtended (Shift+clic)

' Lire la sélection simple
Dim valeur As String
valeur = Me.lstDossiers.Value

' Lire les sélections multiples
Dim j As Integer
For j = 0 To Me.lstDossiers.ListCount - 1
    If Me.lstDossiers.Selected(j) Then
        MsgBox "Sélectionné : " & Me.lstDossiers.List(j, 0)
    End If
Next j

' --- Événements ---
Private Sub lstDossiers_Click()
    ' Remplir les champs du formulaire avec la ligne sélectionnée
    If Me.lstDossiers.ListIndex = -1 Then Exit Sub
    Me.txtNom.Value   = Me.lstDossiers.List(Me.lstDossiers.ListIndex, 0)
    Me.txtPrenom.Value = Me.lstDossiers.List(Me.lstDossiers.ListIndex, 1)
End Sub

Private Sub lstDossiers_DblClick(ByVal Cancel As MSForms.ReturnBoolean)
    ' Double-clic = ouvrir le dossier sélectionné
    Call OuvrirDossier(Me.lstDossiers.Value)
End Sub
```

#### CheckBox & OptionButton

```vba
' --- CheckBox ---
Me.chkCesarienne.Value   = False
Me.chkCesarienne.Caption = "Césarienne"
Me.chkCesarienne.TripleState = False  ' Pas d'état indéterminé

Private Sub chkCesarienne_Click()
    ' Afficher/masquer des champs liés
    Me.fraTypeC.Visible = Me.chkCesarienne.Value
End Sub

' Lire l'état
If Me.chkCesarienne.Value = True Then typeNaissance = "C"

' --- OptionButton (boutons radio) ---
' Les OptionButtons d'un même Frame forment un groupe automatique
' Frame nommé fraGenre contient optFille et optGarcon

Me.optFille.GroupName   = "Sexe"   ' Alternative au Frame pour grouper
Me.optGarcon.GroupName  = "Sexe"

' Lire la sélection
Dim sexe As String
If Me.optFille.Value   Then sexe = "F"
If Me.optGarcon.Value  Then sexe = "M"

' Sélectionner par code
Me.optFille.Value = True

Private Sub optFille_Click()
    Me.lblGenreSelectionne.Caption = "Genre : Féminin"
End Sub
```

#### Frame (groupe de contrôles)

```vba
' Le Frame permet de grouper visuellement et logiquement des contrôles
' Propriétés utiles
Me.fraAccouchement.Caption     = "Modalités d'accouchement"
Me.fraAccouchement.BorderStyle = fmBorderStyleSingle
Me.fraAccouchement.BackColor   = RGB(240, 248, 255)
Me.fraAccouchement.SpecialEffect = fmSpecialEffectEtched

' Afficher/masquer tout un groupe d'un coup
Me.fraComplications.Visible = Me.chkComplications.Value
```

#### SpinButton & ScrollBar

```vba
' --- SpinButton couplé à un TextBox ---
Me.spnTerme.Min   = 22
Me.spnTerme.Max   = 42
Me.spnTerme.Value = 39
Me.spnTerme.SmallChange = 1

Private Sub spnTerme_Change()
    Me.txtTerme.Value = Me.spnTerme.Value & " SA"
End Sub

Private Sub txtTerme_Change()
    ' Synchroniser dans l'autre sens
    Dim v As Integer
    v = Val(Me.txtTerme.Value)
    If v >= Me.spnTerme.Min And v <= Me.spnTerme.Max Then
        Me.spnTerme.Value = v
    End If
End Sub

' --- ScrollBar ---
Me.scrPoids.Min          = 500
Me.scrPoids.Max          = 5000
Me.scrPoids.SmallChange  = 10
Me.scrPoids.LargeChange  = 100
Me.scrPoids.Value        = 3300

Private Sub scrPoids_Change()
    Me.txtPoids.Value = Me.scrPoids.Value & " g"
End Sub
```

#### Image

```vba
' Afficher une image dans le formulaire
Me.imgLogo.Picture       = LoadPicture(ThisWorkbook.Path & "\logo.jpg")
Me.imgLogo.PictureSizeMode = fmPictureSizeModeZoom  ' Ajuster sans déformer
' ou fmPictureSizeModeStretch / fmPictureSizeModeClip

' Image depuis les ressources du classeur (sans fichier externe)
Me.imgLogo.Picture = ThisWorkbook.Sheets("Assets").Shapes("LogoHopital").OLEFormat.Object
```

---

### 4. Événements du UserForm lui-même

```vba
Private Sub UserForm_Initialize()
    ' Premier événement déclenché — initialiser tous les contrôles
    Call StylerControles
    Call ChargerListesDeReference
    Me.txtDate.Value = Format(Date, "dd/mm/yyyy")
    Me.txtNomPatient.SetFocus
End Sub

Private Sub UserForm_Activate()
    ' Déclenché à chaque affichage (Show) — rafraîchir si nécessaire
    Call RemplirCombo(Me.cboPraticien, ThisWorkbook.Sheets("Listes"), 2)
End Sub

Private Sub UserForm_QueryClose(Cancel As Integer, CloseMode As Integer)
    ' Déclenché avant fermeture (croix rouge ou Unload)
    ' CloseMode : 0=croix rouge, 1=code Unload Me, 2=fermeture Windows
    If CloseMode = 0 Then   ' Clic sur la croix
        If MsgBox("Quitter sans enregistrer ?", vbYesNo + vbQuestion) = vbNo Then
            Cancel = True   ' Annule la fermeture
        End If
    End If
End Sub

Private Sub UserForm_Terminate()
    ' Déclenché après fermeture définitive — libérer les ressources
    Set gFormSaisie = Nothing
End Sub

Private Sub UserForm_KeyDown(ByVal KeyCode As MSForms.ReturnInteger, _
                              ByVal Shift As Integer)
    ' Raccourcis clavier globaux sur le formulaire
    Select Case KeyCode
        Case 27     ' Échap → fermer
            Unload Me
        Case 13     ' Entrée → valider (si pas dans MultiLine)
            Call btnValider_Click
        Case 112    ' F1 → aide
            MsgBox "Aide contextuelle du formulaire", vbInformation
    End Select
End Sub
```

---

### 5. Validation avancée et retours visuels

```vba
' Surligner un champ en erreur
Private Sub MarquerErreur(ctrl As Control, estErreur As Boolean)
    If estErreur Then
        ctrl.BackColor   = RGB(255, 220, 220)
        ctrl.BorderColor = RGB(200, 0, 0)
    Else
        ctrl.BackColor   = RGB(255, 255, 255)
        ctrl.BorderColor = RGB(180, 200, 220)
    End If
End Sub

' Validation complète avec retour visuel
Private Function ValiderFormulaire() As Boolean
    Dim ok As Boolean : ok = True
    
    ' Réinitialiser toutes les erreurs
    Dim ctrl As Control
    For Each ctrl In Me.Controls
        If TypeName(ctrl) = "TextBox" Or TypeName(ctrl) = "ComboBox" Then
            Call MarquerErreur(ctrl, False)
        End If
    Next ctrl
    
    ' Vérifier champs obligatoires
    If Me.txtNomPatient.Value = "" Then
        Call MarquerErreur(Me.txtNomPatient, True)
        ok = False
    End If
    If Me.cboService.Value = "" Then
        Call MarquerErreur(Me.cboService, True)
        ok = False
    End If
    If Not IsDate(Me.txtDate.Value) Then
        Call MarquerErreur(Me.txtDate, True)
        ok = False
    End If
    
    If Not ok Then
        Me.lblErreur.Caption  = "⚠ Veuillez corriger les champs en rouge."
        Me.lblErreur.ForeColor = RGB(180, 0, 0)
        Me.lblErreur.Visible   = True
    Else
        Me.lblErreur.Visible = False
    End If
    
    ValiderFormulaire = ok
End Function
```

---

### 6. Mode Édition vs Mode Création (formulaire réutilisable)

```vba
' Variable module : numéro de ligne en cours d'édition (-1 = nouveau)
Private mLigneEdition As Long

' Ouvrir en création
Sub OuvrirFormulaireSaisie()
    mLigneEdition = -1
    Load frmSaisie
    frmSaisie.Caption = "Nouveau dossier"
    frmSaisie.btnValider.Caption = "Enregistrer"
    frmSaisie.Show
End Sub

' Ouvrir en modification (passer le numéro de ligne)
Sub OuvrirFormulaireEdition(numLigne As Long)
    mLigneEdition = numLigne
    Load frmSaisie
    frmSaisie.Caption = "Modifier le dossier n°" & numLigne
    frmSaisie.btnValider.Caption = "Mettre à jour"
    Call ChargerDonneesLigne(numLigne)
    frmSaisie.Show
End Sub

Private Sub ChargerDonneesLigne(ligne As Long)
    Dim ws As Worksheet
    Set ws = ThisWorkbook.Sheets("Base")
    Me.txtNomPatient.Value = ws.Cells(ligne, 1).Value
    Me.txtDate.Value       = Format(ws.Cells(ligne, 2).Value, "dd/mm/yyyy")
    Me.cboService.Value    = ws.Cells(ligne, 3).Value
    ' ... autres champs ...
End Sub

Private Sub Enregistrer()
    Dim ws As Worksheet
    Set ws = ThisWorkbook.Sheets("Base")
    Dim ligne As Long
    
    If mLigneEdition = -1 Then
        ligne = ws.Cells(ws.Rows.Count, 1).End(xlUp).Row + 1  ' Nouvelle ligne
    Else
        ligne = mLigneEdition   ' Écraser la ligne existante
    End If
    
    ws.Cells(ligne, 1).Value = Me.txtNomPatient.Value
    ws.Cells(ligne, 2).Value = CDate(Me.txtDate.Value)
    ws.Cells(ligne, 3).Value = Me.cboService.Value
End Sub
```

---

### 7. Navigation multi-pages (MultiPage & TabStrip)

```vba
' MultiPage : plusieurs pages dans un même formulaire (comme des onglets)

Private Sub UserForm_Initialize()
    ' Nommer les onglets
    Me.mpgDossier.Pages(0).Caption = "Identité"
    Me.mpgDossier.Pages(1).Caption = "Accouchement"
    Me.mpgDossier.Pages(2).Caption = "Nouveau-né"
    Me.mpgDossier.Pages(3).Caption = "Suites de couches"
    
    ' Commencer à la première page
    Me.mpgDossier.Value = 0
End Sub

Private Sub mpgDossier_Change()
    ' Valider la page courante avant de passer à la suivante
    Select Case Me.mpgDossier.Value
        Case 1  ' On arrive sur "Accouchement"
            If Me.txtNomPatient.Value = "" Then
                MsgBox "Remplissez d'abord l'identité !", vbExclamation
                Me.mpgDossier.Value = 0
            End If
    End Select
End Sub

' Boutons Précédent / Suivant pour guider l'utilisateur
Private Sub btnSuivant_Click()
    If Me.mpgDossier.Value < Me.mpgDossier.Pages.Count - 1 Then
        Me.mpgDossier.Value = Me.mpgDossier.Value + 1
    End If
    Me.btnPrecedent.Enabled = (Me.mpgDossier.Value > 0)
    Me.btnSuivant.Enabled   = (Me.mpgDossier.Value < Me.mpgDossier.Pages.Count - 1)
    Me.btnValider.Visible   = (Me.mpgDossier.Value = Me.mpgDossier.Pages.Count - 1)
End Sub

Private Sub btnPrecedent_Click()
    If Me.mpgDossier.Value > 0 Then
        Me.mpgDossier.Value = Me.mpgDossier.Value - 1
    End If
End Sub
```

---

### 8. Formulation avancée : formulaire avec barre de progression

```vba
Private Sub MettreAJourProgression(etape As Integer, total As Integer)
    ' Simuler une barre de progression avec un Label
    Dim pct As Integer
    pct = Int((etape / total) * 100)
    
    Me.lblProgression.Width = (pct / 100) * Me.fraProgression.Width
    Me.lblProgression.BackColor = RGB(51, 153, 102)
    Me.lblPourcentage.Caption   = pct & "%"
    DoEvents   ' Forcer le rafraîchissement de l'affichage
End Sub

' Utilisation pendant un traitement long
Private Sub btnTraiter_Click()
    Dim i As Long
    Dim total As Long
    total = 500
    
    Me.btnTraiter.Enabled = False
    For i = 1 To total
        ' ... traitement ligne i ...
        If i Mod 10 = 0 Then Call MettreAJourProgression(i, total)
    Next i
    Me.btnTraiter.Enabled = True
    MsgBox "Traitement terminé !", vbInformation
End Sub
```

---

### 9. Créer un UserForm accessible depuis un classeur protégé

```vba
' Ouvrir le formulaire tout en gardant les feuilles protégées
Sub OuvrirFormulaire()
    ' Déprotéger temporairement uniquement pour la macro (UserInterfaceOnly)
    Dim ws As Worksheet
    For Each ws In ThisWorkbook.Worksheets
        ws.Protect Password:="MotDePasse", UserInterfaceOnly:=True
    Next ws
    
    frmSaisie.Show
End Sub

' Dans le formulaire, les macros peuvent écrire malgré la protection
' (UserInterfaceOnly:=True permet l'accès VBA mais bloque l'utilisateur)
```

---

### 10. Checklist UserForm — Qualité et ergonomie

- [ ] `TabIndex` défini sur tous les contrôles (ordre logique de navigation)
- [ ] `SetFocus` sur le premier champ dans `Initialize`
- [ ] `Cancel = True` dans `QueryClose` si modifications non sauvegardées
- [ ] Tous les champs obligatoires validés avant enregistrement
- [ ] Retour visuel sur les erreurs (couleur fond + label d'erreur)
- [ ] Raccourci Échap = fermer, Entrée = valider
- [ ] `Me.Hide` + traitement + `Unload Me` (ne pas utiliser `End`)
- [ ] ComboBox avec `Style = fmStyleDropDownList` si liste fermée
- [ ] `DoEvents` dans les boucles longues pour maintenir la réactivité
- [ ] Test avec base vide (ComboBox vide, liste vide, lastRow = 1)

---

## Graphiques et Dashboards

### Créer un graphique professionnel

```vba
Sub CreerGraphique(ws As Worksheet, plage As Range, titre As String)
    Dim cht As ChartObject
    Dim chart As Chart
    
    ' Créer le graphique
    Set cht = ws.ChartObjects.Add(Left:=50, Top:=50, Width:=480, Height:=280)
    Set chart = cht.Chart
    
    ' Type et données
    chart.ChartType = xlColumnClustered   ' ou xlLine, xlPie, xlBar, xlArea...
    chart.SetSourceData Source:=plage
    
    ' Titre
    chart.HasTitle = True
    chart.ChartTitle.Text = titre
    chart.ChartTitle.Font.Size = 12
    chart.ChartTitle.Font.Bold = True
    
    ' Style professionnel
    chart.ChartStyle = 2
    chart.PlotArea.Interior.Color = RGB(245, 245, 245)
    chart.ChartArea.Border.LineStyle = xlNone
    
    ' Légende
    chart.HasLegend = True
    chart.Legend.Position = xlLegendPositionBottom
    
    ' Étiquettes de données
    chart.SeriesCollection(1).HasDataLabels = True
    chart.SeriesCollection(1).DataLabels.ShowValue = True
End Sub
```

### Palette de couleurs professionnelle (santé/hôpital)

```vba
' Couleurs recommandées pour secteur médical/hospitalier
Const COULEUR_PRINCIPAL  As Long = 4366160   ' Bleu hospitalier   #429890
Const COULEUR_SECONDAIRE As Long = 8443000   ' Vert doux          #80B800 — approx
Const COULEUR_ALERTE     As Long = 13369344  ' Rouge              #CC0000
Const COULEUR_NEUTRE     As Long = 11842740  ' Gris clair         #B4B4B4
Const COULEUR_FOND       As Long = 15921906  ' Blanc cassé        #F2F2F2

' Vert foncé (utilisé dans vos newsletters)
Const COULEUR_VERT_SOMBRE As Long = 3368704  ' #336600
```

### Structure type d'un Dashboard

```vba
Sub CreerDashboard()
    ' 1. Préparer la feuille Dashboard
    Dim wsDash As Worksheet
    On Error Resume Next
    Application.DisplayAlerts = False
    ThisWorkbook.Sheets("Dashboard").Delete
    Application.DisplayAlerts = True
    On Error GoTo 0
    
    Set wsDash = ThisWorkbook.Sheets.Add(Before:=ThisWorkbook.Sheets(1))
    wsDash.Name = "Dashboard"
    
    ' 2. Fond et mise en forme générale
    wsDash.Tab.Color = COULEUR_PRINCIPAL
    Cells.Interior.Color = RGB(240, 245, 250)
    
    ' 3. Entête
    With wsDash.Range("A1:Z1")
        .Merge
        .Value = "TABLEAU DE BORD — " & UCase(ThisWorkbook.Sheets("Params").Range("B1").Value)
        .Font.Size = 18
        .Font.Bold = True
        .Font.Color = RGB(255, 255, 255)
        .Interior.Color = COULEUR_PRINCIPAL
        .HorizontalAlignment = xlCenter
        .RowHeight = 40
    End With
    
    ' 4. KPI Cards
    Call AjouterKPICard(wsDash, "B3", "Naissances ce mois", "=STATS!B2", COULEUR_PRINCIPAL)
    Call AjouterKPICard(wsDash, "D3", "Césariennes", "=STATS!B3", COULEUR_SECONDAIRE)
    Call AjouterKPICard(wsDash, "F3", "Taux allaitement", "=STATS!B4", COULEUR_VERT_SOMBRE)
    
    ' 5. Graphiques
    Call CreerGraphiqueMensuel(wsDash)
    
    ' 6. Masquer le quadrillage
    wsDash.DisplayGridlines = False
    ActiveWindow.DisplayHeadings = False
End Sub

Sub AjouterKPICard(ws As Worksheet, adresse As String, libelle As String, _
                    formule As String, couleur As Long)
    Dim rng As Range
    Set rng = ws.Range(adresse).Resize(3, 2)
    
    ' Fond coloré
    rng.Interior.Color = couleur
    rng.BorderAround Weight:=xlThin, Color:=RGB(255, 255, 255)
    
    ' Libellé
    rng.Cells(1, 1).Resize(1, 2).Merge
    rng.Cells(1, 1).Value = libelle
    rng.Cells(1, 1).Font.Color = RGB(255, 255, 255)
    rng.Cells(1, 1).Font.Size = 9
    rng.Cells(1, 1).HorizontalAlignment = xlCenter
    
    ' Valeur
    rng.Cells(2, 1).Resize(1, 2).Merge
    rng.Cells(2, 1).Formula = formule
    rng.Cells(2, 1).Font.Color = RGB(255, 255, 255)
    rng.Cells(2, 1).Font.Size = 20
    rng.Cells(2, 1).Font.Bold = True
    rng.Cells(2, 1).HorizontalAlignment = xlCenter
    rng.RowHeight = 30
End Sub
```

---

## Navigation entre feuilles

### Boutons de navigation stylisés

```vba
Sub CreerBoutonNavigation(ws As Worksheet, gauche As Long, haut As Long, _
                           libelle As String, cible As String)
    Dim btn As Shape
    Set btn = ws.Shapes.AddShape(msoShapeRoundedRectangle, gauche, haut, 120, 28)
    
    ' Style
    btn.Fill.ForeColor.RGB = COULEUR_PRINCIPAL
    btn.Line.ForeColor.RGB = COULEUR_PRINCIPAL
    btn.TextFrame.Characters.Text = libelle
    btn.TextFrame.Characters.Font.Color = RGB(255, 255, 255)
    btn.TextFrame.Characters.Font.Size = 9
    btn.TextFrame.HorizontalAlignment = xlHAlignCenter
    btn.TextFrame.VerticalAlignment = xlVAlignCenter
    
    ' Assigner la macro de navigation
    btn.OnAction = "NavVers_" & cible
End Sub

' Macro de navigation générée dynamiquement
Sub NavVers_Dashboard()
    ThisWorkbook.Sheets("Dashboard").Activate
    ThisWorkbook.Sheets("Dashboard").Range("A1").Select
End Sub
```

---

## Événements utiles

```vba
' Dans ThisWorkbook
Private Sub Workbook_Open()
    ' Afficher la feuille d'accueil au démarrage
    ThisWorkbook.Sheets("Dashboard").Activate
    Application.DisplayAlerts = False
End Sub

' Dans une feuille spécifique
Private Sub Worksheet_Change(ByVal Target As Range)
    ' Réagir à la modification d'une cellule précise
    If Not Intersect(Target, Me.Range("B2")) Is Nothing Then
        Call ActualiserDashboard
    End If
End Sub

Private Sub Worksheet_Activate()
    ' Rafraîchir à chaque activation de la feuille
    Call ActualiserStatistiques
End Sub
```

---

## Mise en forme conditionnelle via VBA

```vba
Sub AppliquerMiseEnFormeConditionnelle(ws As Worksheet, plage As Range)
    plage.FormatConditions.Delete
    
    ' Règle 1 : valeur élevée → vert
    Dim fc1 As FormatCondition
    Set fc1 = plage.FormatConditions.Add(xlCellValue, xlGreaterThan, 80)
    fc1.Interior.Color = RGB(198, 239, 206)
    fc1.Font.Color = RGB(0, 97, 0)
    
    ' Règle 2 : valeur faible → rouge
    Dim fc2 As FormatCondition
    Set fc2 = plage.FormatConditions.Add(xlCellValue, xlLessThan, 30)
    fc2.Interior.Color = RGB(255, 199, 206)
    fc2.Font.Color = RGB(156, 0, 6)
    
    ' Règle 3 : barre de données
    plage.FormatConditions.AddDatabar
    plage.FormatConditions(plage.FormatConditions.Count).BarColor.Color = COULEUR_PRINCIPAL
End Sub
```

---

## Impression et export PDF

```vba
Sub ExporterPDF(ws As Worksheet, cheminFichier As String)
    ws.PageSetup.Orientation = xlLandscape
    ws.PageSetup.FitToPagesWide = 1
    ws.PageSetup.FitToPagesTall = False
    ws.PageSetup.LeftMargin = Application.InchesToPoints(0.5)
    ws.PageSetup.RightMargin = Application.InchesToPoints(0.5)
    
    ws.ExportAsFixedFormat _
        Type:=xlTypePDF, _
        Filename:=cheminFichier, _
        Quality:=xlQualityStandard, _
        IncludeDocProperties:=True, _
        IgnorePrintAreas:=False, _
        OpenAfterPublish:=True
    
    MsgBox "Export PDF réussi : " & cheminFichier, vbInformation
End Sub
```

---

## Patterns courants en milieu hospitalier/médical

### Calcul de statistiques de salle

```vba
Function CalculerStats(wsData As Worksheet, colonne As Integer, _
                        dateDebut As Date, dateFin As Date) As Double
    Dim i As Long
    Dim lastRow As Long
    Dim total As Long
    
    lastRow = wsData.Cells(wsData.Rows.Count, 1).End(xlUp).Row
    total = 0
    
    For i = 2 To lastRow
        Dim dateCell As Date
        If IsDate(wsData.Cells(i, 1).Value) Then
            dateCell = CDate(wsData.Cells(i, 1).Value)
            If dateCell >= dateDebut And dateCell <= dateFin Then
                If wsData.Cells(i, colonne).Value <> "" Then
                    total = total + 1
                End If
            End If
        End If
    Next i
    
    CalculerStats = total
End Function
```

### Recherche/Filtrage dans une base de données

```vba
Sub RechercherDossier(critere As String, wsSource As Worksheet, wsCible As Worksheet)
    wsCible.Rows("2:" & wsCible.Rows.Count).ClearContents
    
    Dim lastRow As Long
    lastRow = wsSource.Cells(wsSource.Rows.Count, 1).End(xlUp).Row
    
    Dim cibleRow As Long
    cibleRow = 2
    
    Dim i As Long
    For i = 2 To lastRow
        ' Recherche sur toute la ligne
        Dim j As Integer
        For j = 1 To 10
            If InStr(1, CStr(wsSource.Cells(i, j).Value), critere, vbTextCompare) > 0 Then
                wsSource.Rows(i).Copy Destination:=wsCible.Rows(cibleRow)
                cibleRow = cibleRow + 1
                Exit For
            End If
        Next j
    Next i
    
    MsgBox cibleRow - 2 & " résultat(s) trouvé(s).", vbInformation
End Sub
```

---

## Débogage & Tests — Arsenal complet

---

### 1. Logger VBA — Traçabilité complète des exécutions

Le logger est le premier outil à mettre en place. Il écrit chaque événement dans une feuille dédiée et/ou un fichier texte, avec horodatage et niveau de gravité.

```vba
' ============================================================
' MODULE : modLogger
' Logger universel — à inclure dans tout projet VBA sérieux
' ============================================================
Option Explicit

Public Enum NiveauLog
    LOG_DEBUG = 0
    LOG_INFO  = 1
    LOG_WARN  = 2
    LOG_ERROR = 3
    LOG_FATAL = 4
End Enum

Private Const FEUILLE_LOG  As String = "Journal"
Private Const FICHIER_LOG  As String = "C:\Temp\VBA_Debug.log"
Private Const NIVEAU_MIN   As Integer = LOG_DEBUG   ' Changer à LOG_INFO en prod

' Point d'entrée principal
Public Sub Log(niveau As NiveauLog, source As String, message As String, _
               Optional valeur As Variant = "")
    If niveau < NIVEAU_MIN Then Exit Sub
    
    Dim ligne As String
    Dim ts As String
    ts = Format(Now, "yyyy-mm-dd hh:mm:ss")
    
    Dim niveauTexte As String
    Select Case niveau
        Case LOG_DEBUG : niveauTexte = "DEBUG"
        Case LOG_INFO  : niveauTexte = "INFO "
        Case LOG_WARN  : niveauTexte = "WARN "
        Case LOG_ERROR : niveauTexte = "ERROR"
        Case LOG_FATAL : niveauTexte = "FATAL"
    End Select
    
    Dim valStr As String
    If Not IsMissing(valeur) And CStr(valeur) <> "" Then
        valStr = " | Val=" & CStr(valeur)
    End If
    
    ligne = "[" & ts & "] [" & niveauTexte & "] [" & source & "] " & message & valStr
    
    Call EcrireFeuille(ligne, niveau, ts, niveauTexte, source, message, valStr)
    Call EcrireFichier(ligne)
    
    ' Afficher dans la fenêtre Exécution (Ctrl+G dans l'IDE)
    Debug.Print ligne
End Sub

Private Sub EcrireFeuille(ligne As String, niveau As NiveauLog, ts As String, _
                           niveauTexte As String, source As String, _
                           message As String, valStr As String)
    On Error Resume Next
    Dim ws As Worksheet
    Set ws = ThisWorkbook.Sheets(FEUILLE_LOG)
    If ws Is Nothing Then
        Set ws = ThisWorkbook.Sheets.Add
        ws.Name = FEUILLE_LOG
        ws.Tab.Color = RGB(255, 200, 0)
        ' En-têtes
        ws.Range("A1:F1").Value = Array("Horodatage", "Niveau", "Source", "Message", "Valeur", "Ligne brute")
        ws.Range("A1:F1").Font.Bold = True
    End If
    On Error GoTo 0
    
    Dim nextRow As Long
    nextRow = ws.Cells(ws.Rows.Count, 1).End(xlUp).Row + 1
    ws.Cells(nextRow, 1).Value = ts
    ws.Cells(nextRow, 2).Value = niveauTexte
    ws.Cells(nextRow, 3).Value = source
    ws.Cells(nextRow, 4).Value = message
    ws.Cells(nextRow, 5).Value = valStr
    ws.Cells(nextRow, 6).Value = ligne
    
    ' Coloriser selon le niveau
    Dim couleurLigne As Long
    Select Case niveau
        Case LOG_DEBUG : couleurLigne = RGB(245, 245, 245)
        Case LOG_INFO  : couleurLigne = RGB(255, 255, 255)
        Case LOG_WARN  : couleurLigne = RGB(255, 243, 205)
        Case LOG_ERROR : couleurLigne = RGB(255, 210, 210)
        Case LOG_FATAL : couleurLigne = RGB(200, 0, 0)
    End Select
    ws.Rows(nextRow).Interior.Color = couleurLigne
End Sub

Private Sub EcrireFichier(ligne As String)
    On Error Resume Next
    Dim f As Integer
    f = FreeFile
    Open FICHIER_LOG For Append As #f
    Print #f, ligne
    Close #f
End Sub

' Vider le journal
Public Sub ViderJournal()
    On Error Resume Next
    ThisWorkbook.Sheets(FEUILLE_LOG).Rows("2:" & Rows.Count).ClearContents
    Log LOG_INFO, "Logger", "Journal vidé"
End Sub
```

**Utilisation dans le code :**

```vba
Sub ImporterDonnees()
    Log LOG_INFO, "ImporterDonnees", "Début import"
    
    Dim lastRow As Long
    lastRow = Sheets("Base").Cells(Rows.Count, 1).End(xlUp).Row
    Log LOG_DEBUG, "ImporterDonnees", "Nombre de lignes trouvées", lastRow
    
    If lastRow < 2 Then
        Log LOG_WARN, "ImporterDonnees", "Base vide — import annulé"
        Exit Sub
    End If
    
    On Error GoTo ErrHandler
    ' ... traitement ...
    Log LOG_INFO, "ImporterDonnees", "Import terminé avec succès", lastRow - 1 & " lignes"
    Exit Sub
    
ErrHandler:
    Log LOG_ERROR, "ImporterDonnees", "Erreur " & Err.Number & " : " & Err.Description
    MsgBox "Erreur lors de l'import. Consultez le journal.", vbCritical
End Sub
```

---

### 2. Assertions — Vérifier les invariants du code

Les assertions arrêtent l'exécution si une condition supposée vraie ne l'est pas. Indispensable pour attraper les bugs logiques tôt.

```vba
' ============================================================
' MODULE : modAssert
' ============================================================
Option Explicit

' Assert simple — stoppe en mode DEBUG, log en production
Public Sub Assert(condition As Boolean, message As String, _
                  Optional source As String = "Assert")
    If condition Then Exit Sub
    
    Dim msg As String
    msg = "ASSERTION ÉCHOUÉE" & vbCrLf & _
          "Source  : " & source & vbCrLf & _
          "Condition: " & message & vbCrLf & vbCrLf & _
          "Voulez-vous ouvrir le débogueur ?"
    
    Log LOG_FATAL, source, "Assertion échouée : " & message
    
    If MsgBox(msg, vbCritical + vbYesNo) = vbYes Then
        Stop   ' Place le curseur ici dans l'IDE pour déboguer
    End If
End Sub

' Assert sur un type de valeur
Public Sub AssertEstNombre(valeur As Variant, nomChamp As String)
    Assert IsNumeric(valeur), "'" & nomChamp & "' doit être numérique (reçu: " & CStr(valeur) & ")"
End Sub

Public Sub AssertEstDate(valeur As Variant, nomChamp As String)
    Assert IsDate(valeur), "'" & nomChamp & "' doit être une date (reçu: " & CStr(valeur) & ")"
End Sub

Public Sub AssertNonVide(valeur As Variant, nomChamp As String)
    Assert CStr(valeur) <> "", "'" & nomChamp & "' ne peut pas être vide"
End Sub

Public Sub AssertPlageValide(ws As Worksheet, adresse As String)
    On Error Resume Next
    Dim r As Range
    Set r = ws.Range(adresse)
    Assert Not r Is Nothing, "Plage invalide : " & adresse & " sur " & ws.Name
    On Error GoTo 0
End Sub

Public Sub AssertFeuillleExiste(nomFeuille As String)
    Dim ws As Worksheet
    On Error Resume Next
    Set ws = ThisWorkbook.Sheets(nomFeuille)
    On Error GoTo 0
    Assert Not ws Is Nothing, "Feuille introuvable : '" & nomFeuille & "'"
End Sub
```

**Utilisation :**

```vba
Sub TraiterNaissance(nomMere As String, dateNaissance As Date, poids As Double)
    ' Garder les assertions en tête de procédure
    AssertNonVide nomMere, "nomMere"
    AssertEstDate dateNaissance, "dateNaissance"
    Assert poids > 200 And poids < 6000, "Poids hors plage : " & poids & "g"
    AssertFeuillleExiste "Base"
    
    ' ... code métier ...
End Sub
```

---

### 3. Tests Unitaires — Cadre de test maison

VBA n'a pas de framework de test natif. Voici un cadre léger mais complet.

```vba
' ============================================================
' MODULE : modTests
' Framework de tests unitaires léger pour VBA
' ============================================================
Option Explicit

Private mTestsTotal   As Long
Private mTestsReussis As Long
Private mTestsEchoues As Long
Private mRapport      As String

' --- Initialiser une session de tests ---
Public Sub DebutTests(nomSuite As String)
    mTestsTotal = 0 : mTestsReussis = 0 : mTestsEchoues = 0
    mRapport = "═══ SUITE DE TESTS : " & nomSuite & " ═══" & vbCrLf & _
               "Démarré : " & Format(Now, "dd/mm/yyyy hh:mm:ss") & vbCrLf & vbCrLf
    Log LOG_INFO, "Tests", "Début suite : " & nomSuite
End Sub

' --- Vérifier une condition ---
Public Sub EstVrai(condition As Boolean, nomTest As String)
    mTestsTotal = mTestsTotal + 1
    If condition Then
        mTestsReussis = mTestsReussis + 1
        mRapport = mRapport & "  ✓ " & nomTest & vbCrLf
        Log LOG_DEBUG, "Tests", "PASS : " & nomTest
    Else
        mTestsEchoues = mTestsEchoues + 1
        mRapport = mRapport & "  ✗ ÉCHEC : " & nomTest & vbCrLf
        Log LOG_ERROR, "Tests", "FAIL : " & nomTest
    End If
End Sub

Public Sub SontEgaux(attendu As Variant, obtenu As Variant, nomTest As String)
    EstVrai CStr(attendu) = CStr(obtenu), _
            nomTest & " [attendu=" & CStr(attendu) & " / obtenu=" & CStr(obtenu) & "]"
End Sub

Public Sub EstDansPlage(valeur As Double, mini As Double, maxi As Double, nomTest As String)
    EstVrai valeur >= mini And valeur <= maxi, _
            nomTest & " [" & valeur & " dans [" & mini & ";" & maxi & "]]"
End Sub

Public Sub EstVide(valeur As Variant, nomTest As String)
    EstVrai CStr(valeur) = "" Or IsEmpty(valeur), nomTest & " [doit être vide]"
End Sub

Public Sub NEstPasVide(valeur As Variant, nomTest As String)
    EstVrai CStr(valeur) <> "" And Not IsEmpty(valeur), nomTest & " [ne doit pas être vide]"
End Sub

' --- Clore et afficher le rapport ---
Public Sub FinTests()
    Dim tauxReussite As String
    If mTestsTotal > 0 Then
        tauxReussite = Format(mTestsReussis / mTestsTotal, "0%")
    Else
        tauxReussite = "N/A"
    End If
    
    mRapport = mRapport & vbCrLf & "═══ RÉSULTATS ═══" & vbCrLf & _
               "  Total   : " & mTestsTotal & vbCrLf & _
               "  Réussis : " & mTestsReussis & vbCrLf & _
               "  Échecs  : " & mTestsEchoues & vbCrLf & _
               "  Taux    : " & tauxReussite
    
    Log LOG_INFO, "Tests", "Fin suite — " & mTestsReussis & "/" & mTestsTotal & " réussis"
    
    ' Écrire le rapport dans la feuille Journal
    Call EcrireRapportFeuille
    
    ' Afficher dans la fenêtre Exécution
    Debug.Print mRapport
    
    ' Popup seulement si des tests échouent
    If mTestsEchoues > 0 Then
        MsgBox mRapport, vbExclamation, "Tests — " & mTestsEchoues & " échec(s)"
    Else
        MsgBox "Tous les tests ont réussi (" & mTestsTotal & ").", vbInformation, "Tests OK"
    End If
End Sub

Private Sub EcrireRapportFeuille()
    On Error Resume Next
    Dim ws As Worksheet
    Set ws = ThisWorkbook.Sheets("Journal")
    If ws Is Nothing Then Exit Sub
    Dim nextRow As Long
    nextRow = ws.Cells(ws.Rows.Count, 1).End(xlUp).Row + 2
    ws.Cells(nextRow, 1).Value = mRapport
    ws.Cells(nextRow, 1).Font.Name = "Courier New"
    ws.Cells(nextRow, 1).Font.Size = 8
End Sub
```

**Exemple de suite de tests pour le registre maternité :**

```vba
Sub LancerTousLesTests()
    Call DebutTests("Registre Maternité v1.0")
    
    Call Tests_Validations
    Call Tests_Calculs
    Call Tests_FeuilleDonnees
    
    Call FinTests
End Sub

Private Sub Tests_Validations()
    ' Test : date valide
    EstVrai IsDate("15/06/2024"), "IsDate — format JJ/MM/AAAA valide"
    EstVrai Not IsDate("32/01/2024"), "IsDate — jour 32 invalide"
    EstVrai IsDate("2024-06-15"), "IsDate — format ISO valide"
    
    ' Test : poids nouveau-né
    EstDansPlage 3450, 200, 6000, "Poids 3450g dans plage normale"
    EstVrai Not (150 >= 200), "Poids 150g hors plage détecté"
    
    ' Test : terme gestationnel
    EstDansPlage 39, 22, 42, "Terme 39 SA dans plage"
    EstVrai Not (20 >= 22), "Terme 20 SA hors plage détecté"
End Sub

Private Sub Tests_Calculs()
    ' Test : calcul âge gestationnel
    Dim dateConception As Date
    dateConception = DateSerial(2024, 1, 1)
    Dim dateAccouchement As Date
    dateAccouchement = DateSerial(2024, 10, 1)
    Dim semaines As Long
    semaines = DateDiff("ww", dateConception, dateAccouchement)
    EstDansPlage semaines, 36, 42, "Calcul semaines aménorrhée"
    
    ' Test : formatage NIP
    SontEgaux "2 75 06 59 038 042 22", FormatNIP("2750659038042"), "Formatage NIP féminin"
End Sub

Private Sub Tests_FeuilleDonnees()
    ' Vérifier que les feuilles requises existent
    Dim ws As Worksheet
    
    For Each ws In ThisWorkbook.Worksheets
        ' skip
    Next ws
    
    On Error Resume Next
    Set ws = Nothing
    Set ws = ThisWorkbook.Sheets("Base")
    NEstPasVide IIf(ws Is Nothing, "", ws.Name), "Feuille 'Base' existe"
    
    Set ws = Nothing
    Set ws = ThisWorkbook.Sheets("Listes")
    NEstPasVide IIf(ws Is Nothing, "", ws.Name), "Feuille 'Listes' existe"
    On Error GoTo 0
    
    ' Vérifier la structure de la feuille Base (en-têtes)
    Set ws = ThisWorkbook.Sheets("Base")
    SontEgaux "Nom", ws.Cells(1, 1).Value, "En-tête col.1 = 'Nom'"
    SontEgaux "Prénom", ws.Cells(1, 2).Value, "En-tête col.2 = 'Prénom'"
    SontEgaux "Date naissance", ws.Cells(1, 3).Value, "En-tête col.3 = 'Date naissance'"
End Sub
```

---

### 4. Profilage — Mesurer les performances

```vba
' ============================================================
' MODULE : modProfiler
' Mesurer le temps d'exécution de chaque procédure
' ============================================================
Option Explicit

Private Type ProfileEntry
    Nom       As String
    Debut     As Double
    DureeTotale As Double
    NbAppels  As Long
End Type

Private mProfils(100) As ProfileEntry
Private mNbProfils    As Integer

Public Sub ProfilDebut(nom As String)
    Dim i As Integer
    ' Chercher si ce profil existe déjà
    For i = 0 To mNbProfils - 1
        If mProfils(i).Nom = nom Then
            mProfils(i).Debut = Timer
            mProfils(i).NbAppels = mProfils(i).NbAppels + 1
            Exit Sub
        End If
    Next i
    ' Nouveau profil
    mProfils(mNbProfils).Nom = nom
    mProfils(mNbProfils).Debut = Timer
    mProfils(mNbProfils).NbAppels = 1
    mNbProfils = mNbProfils + 1
End Sub

Public Sub ProfilFin(nom As String)
    Dim i As Integer
    For i = 0 To mNbProfils - 1
        If mProfils(i).Nom = nom Then
            mProfils(i).DureeTotale = mProfils(i).DureeTotale + (Timer - mProfils(i).Debut)
            Exit Sub
        End If
    Next i
End Sub

Public Sub AfficherRapportPerformances()
    Dim rapport As String
    rapport = "═══ RAPPORT DE PERFORMANCES ═══" & vbCrLf
    rapport = rapport & String(55, "─") & vbCrLf
    rapport = rapport & Format("Procédure", "!@@@@@@@@@@@@@@@@@@@@@@@@@") & _
                        Format("Appels", "!@@@@@@@@") & _
                        Format("Total (ms)", "!@@@@@@@@@@@") & _
                        Format("Moy. (ms)", "!@@@@@@@@@@") & vbCrLf
    rapport = rapport & String(55, "─") & vbCrLf
    
    Dim i As Integer
    For i = 0 To mNbProfils - 1
        Dim moy As Double
        If mProfils(i).NbAppels > 0 Then
            moy = (mProfils(i).DureeTotale / mProfils(i).NbAppels) * 1000
        End If
        rapport = rapport & _
            Format(mProfils(i).Nom, "!@@@@@@@@@@@@@@@@@@@@@@@@@") & _
            Format(mProfils(i).NbAppels, "!@@@@@@@@") & _
            Format(Format(mProfils(i).DureeTotale * 1000, "0.0"), "!@@@@@@@@@@@") & _
            Format(Format(moy, "0.0"), "!@@@@@@@@@@") & vbCrLf
    Next i
    
    Debug.Print rapport
    MsgBox rapport, vbInformation, "Performances"
End Sub

' Réinitialiser les mesures
Public Sub ResetProfils()
    mNbProfils = 0
    ReDim mProfils(100)
End Sub
```

**Utilisation du profilage :**

```vba
Sub TraiterBase()
    ProfilDebut "TraiterBase"
    
    ProfilDebut "Lecture"
    Dim data As Variant
    data = Sheets("Base").Range("A1:Z500").Value
    ProfilFin "Lecture"
    
    ProfilDebut "Calculs"
    Dim i As Long
    For i = 1 To UBound(data, 1)
        ' ... traitement ...
    Next i
    ProfilFin "Calculs"
    
    ProfilDebut "Écriture"
    Sheets("Résultats").Range("A1").Resize(UBound(data,1), 5).Value = data
    ProfilFin "Écriture"
    
    ProfilFin "TraiterBase"
    AfficherRapportPerformances
End Sub
```

---

### 5. Gestion d'erreurs structurée — Au-delà du simple On Error

```vba
' ============================================================
' Patron de gestion d'erreurs professionnel
' ============================================================

' Gestionnaire d'erreur centralisé
Public Sub GererErreur(err As ErrObject, source As String, _
                        Optional relancer As Boolean = False)
    Dim msg As String
    msg = "Erreur n°" & err.Number & " dans [" & source & "]" & vbCrLf & _
          "Description : " & err.Description
    
    Log LOG_ERROR, source, msg
    
    Select Case err.Number
        Case 9         ' Indice hors plage
            MsgBox msg & vbCrLf & "(Vérifiez les noms de feuilles et indices de tableaux)", _
                   vbCritical, "Erreur d'indice"
        Case 13        ' Incompatibilité de type
            MsgBox msg & vbCrLf & "(Problème de conversion de données)", _
                   vbCritical, "Erreur de type"
        Case 1004      ' Erreur application Excel
            MsgBox msg & vbCrLf & "(Plage ou objet Excel invalide)", _
                   vbCritical, "Erreur Excel"
        Case 91        ' Variable objet non définie
            MsgBox msg & vbCrLf & "(Objet non initialisé — Set manquant ?)", _
                   vbCritical, "Objet non initialisé"
        Case Else
            MsgBox msg, vbCritical, "Erreur inattendue"
    End Select
    
    If relancer Then Err.Raise err.Number, source, err.Description
End Sub

' Template de procédure avec gestion d'erreurs complète
Sub TemplateProc(param1 As String, param2 As Long)
    Const NOM_PROC As String = "TemplateProc"
    Log LOG_DEBUG, NOM_PROC, "Entrée", "param1=" & param1 & " param2=" & param2
    
    ' Préconditions
    AssertNonVide param1, "param1"
    Assert param2 > 0, "param2 doit être > 0"
    
    On Error GoTo ErrHandler
    
    ' --- Corps de la procédure ---
    ProfilDebut NOM_PROC
    
    ' ... code métier ...
    
    ProfilFin NOM_PROC
    Log LOG_DEBUG, NOM_PROC, "Sortie normale"
    Exit Sub

ErrHandler:
    ProfilFin NOM_PROC
    Call GererErreur(Err, NOM_PROC)
End Sub
```

---

### 6. Inspecteur de classeur — Diagnostic automatique

```vba
' ============================================================
' Lancer un diagnostic complet du classeur
' ============================================================
Sub DiagnosticClasseur()
    Dim rapport As String
    rapport = "═══ DIAGNOSTIC CLASSEUR ═══" & vbCrLf & _
              "Fichier  : " & ThisWorkbook.Name & vbCrLf & _
              "Chemin   : " & ThisWorkbook.Path & vbCrLf & _
              "Date     : " & Format(Now, "dd/mm/yyyy hh:mm") & vbCrLf & vbCrLf
    
    ' 1. Feuilles
    rapport = rapport & "── FEUILLES (" & ThisWorkbook.Sheets.Count & ") ──" & vbCrLf
    Dim ws As Worksheet
    For Each ws In ThisWorkbook.Worksheets
        Dim lastR As Long, lastC As Long
        lastR = ws.Cells.Find("*", SearchOrder:=xlByRows, SearchDirection:=xlPrevious).Row
        lastC = ws.Cells.Find("*", SearchOrder:=xlByColumns, SearchDirection:=xlPrevious).Column
        rapport = rapport & "  • " & ws.Name & _
                  " | " & lastR & " lignes × " & lastC & " colonnes" & _
                  " | Protégée: " & IIf(ws.ProtectContents, "Oui", "Non") & vbCrLf
    Next ws
    
    ' 2. Plages nommées
    rapport = rapport & vbCrLf & "── PLAGES NOMMÉES (" & ThisWorkbook.Names.Count & ") ──" & vbCrLf
    Dim n As Name
    For Each n In ThisWorkbook.Names
        On Error Resume Next
        Dim refTest As String
        refTest = n.RefersToRange.Address
        Dim estValide As Boolean
        estValide = (Err.Number = 0)
        On Error GoTo 0
        rapport = rapport & "  " & IIf(estValide, "✓", "✗ BRISÉE") & _
                  " " & n.Name & " → " & n.RefersTo & vbCrLf
    Next n
    
    ' 3. Erreurs de formules
    rapport = rapport & vbCrLf & "── ERREURS DE FORMULES ──" & vbCrLf
    Dim nbErreurs As Long : nbErreurs = 0
    For Each ws In ThisWorkbook.Worksheets
        Dim errCell As Range
        On Error Resume Next
        Set errCell = ws.Cells.SpecialCells(xlCellTypeFormulas, xlErrors)
        On Error GoTo 0
        If Not errCell Is Nothing Then
            Dim cell As Range
            For Each cell In errCell
                rapport = rapport & "  ✗ " & ws.Name & "!" & cell.Address & _
                          " = " & CStr(cell.Value) & vbCrLf
                nbErreurs = nbErreurs + 1
            Next cell
        End If
    Next ws
    If nbErreurs = 0 Then rapport = rapport & "  ✓ Aucune erreur de formule" & vbCrLf
    
    ' 4. Connexions de données
    rapport = rapport & vbCrLf & "── CONNEXIONS (" & ThisWorkbook.Connections.Count & ") ──" & vbCrLf
    Dim conn As WorkbookConnection
    For Each conn In ThisWorkbook.Connections
        rapport = rapport & "  • " & conn.Name & vbCrLf
    Next conn
    
    ' 5. Modules VBA
    rapport = rapport & vbCrLf & "── MODULES VBA ──" & vbCrLf
    Dim comp As Object
    For Each comp In ThisWorkbook.VBProject.VBComponents
        rapport = rapport & "  • " & comp.Name & " (" & comp.Type & ")" & vbCrLf
    Next comp
    
    ' Afficher et logger
    Debug.Print rapport
    Log LOG_INFO, "Diagnostic", "Rapport généré"
    
    ' Écrire dans une feuille dédiée
    On Error Resume Next
    Dim wsDiag As Worksheet
    Set wsDiag = ThisWorkbook.Sheets("Diagnostic")
    If wsDiag Is Nothing Then
        Set wsDiag = ThisWorkbook.Sheets.Add
        wsDiag.Name = "Diagnostic"
    End If
    On Error GoTo 0
    wsDiag.Cells.Clear
    wsDiag.Range("A1").Value = rapport
    wsDiag.Range("A1").Font.Name = "Courier New"
    wsDiag.Range("A1").Font.Size = 9
    wsDiag.Columns("A").ColumnWidth = 120
    wsDiag.Activate
End Sub
```

---

### 7. Techniques de débogage interactif dans l'IDE

```vba
' ── Arrêts conditionnels (plus puissants que les breakpoints fixes) ──
Sub TraiterLignes()
    Dim i As Long
    For i = 1 To 1000
        Dim valeur As Variant
        valeur = Sheets("Base").Cells(i, 3).Value
        
        ' Arrêt conditionnel : stopper uniquement sur la valeur problématique
        If CStr(valeur) = "ERREUR" Or i = 547 Then
            Stop   ' Cursor place ici dans l'IDE — inspecter les variables
        End If
        
        ' Trace légère dans la fenêtre Exécution (Ctrl+G)
        If i Mod 100 = 0 Then Debug.Print "Ligne " & i & " / 1000 — val=" & valeur
    Next i
End Sub

' ── Simuler des données de test sans toucher à la vraie base ──
Sub CreerJeuDonneesTest()
    Dim wsTest As Worksheet
    On Error Resume Next
    Application.DisplayAlerts = False
    ThisWorkbook.Sheets("BASE_TEST").Delete
    Application.DisplayAlerts = True
    On Error GoTo 0
    
    Set wsTest = ThisWorkbook.Sheets.Add
    wsTest.Name = "BASE_TEST"
    wsTest.Tab.Color = RGB(255, 165, 0)   ' Orange = attention, c'est du test
    
    ' En-têtes identiques à la vraie base
    Dim wsBase As Worksheet
    Set wsBase = ThisWorkbook.Sheets("Base")
    wsBase.Rows(1).Copy Destination:=wsTest.Rows(1)
    
    ' Données synthétiques
    Dim jeuTest As Variant
    jeuTest = Array( _
        Array("DUPONT", "Marie", "15/03/2024", 3420, 39, "VB", "Épidural"), _
        Array("MARTIN", "Sophie", "16/03/2024", 2950, 37, "CS", "AG"), _
        Array("DURAND", "Claire", "", 0, 0, "", ""),        ' Ligne incomplète
        Array("LEBLANC", "Julie", "20/03/2024", 4100, 41, "VB", "Aucune") _
    )
    
    Dim i As Integer
    For i = 0 To UBound(jeuTest)
        Dim j As Integer
        For j = 0 To UBound(jeuTest(i))
            wsTest.Cells(i + 2, j + 1).Value = jeuTest(i)(j)
        Next j
    Next i
    
    MsgBox "Jeu de données test créé : " & UBound(jeuTest) + 1 & " lignes.", vbInformation
End Sub

' ── Exécuter sur le jeu de test plutôt que sur la vraie base ──
#Const MODE_TEST = True   ' Constante de compilation conditionnelle

Sub TraiterNaissances()
    Dim nomFeuille As String
    #If MODE_TEST Then
        nomFeuille = "BASE_TEST"
        Log LOG_WARN, "TraiterNaissances", "MODE TEST ACTIF — base réelle non modifiée"
    #Else
        nomFeuille = "Base"
    #End If
    
    Dim ws As Worksheet
    Set ws = ThisWorkbook.Sheets(nomFeuille)
    ' ... traitement sur ws ...
End Sub
```

---

### 8. Checklist débogage — Réflexes en cas de bug

```
SYMPTÔME                      PREMIER RÉFLEXE
─────────────────────────────────────────────────────────────────
Erreur 9 (indice hors plage)  → Vérifier nom de feuille (casse, espace)
Erreur 91 (objet rien)        → Chercher un Set manquant ou un objet non créé
Erreur 13 (incompatibilité)   → Inspecter la valeur avec Debug.Print TypeName(x)
Résultat inattendu            → Ajouter Debug.Print avant et après la ligne
Boucle infinie                → Ajouter Debug.Print i en début de boucle
lastRow = 1 (base vide)       → Vérifier que la colonne de référence n'est pas vide
Formule #REF!                 → Feuille supprimée ou plage déplacée ?
ComboBox vide                 → Vérifier que Initialize est bien appelé
MsgBox ne s'affiche pas       → ScreenUpdating ou DisplayAlerts coupés ?
Macro trop lente              → Activer le profilage, chercher les boucles sur cellules
```

---

## Checklist qualité avant livraison

- [ ] `Option Explicit` présent dans tous les modules
- [ ] `modLogger` intégré — toutes les procédures principales loggées
- [ ] `modAssert` intégré — préconditions sur les paramètres critiques
- [ ] Suite de tests `modTests` passée à 100% avant livraison
- [ ] Profilage lancé — aucune procédure > 2 secondes sans justification
- [ ] `DiagnosticClasseur` exécuté — zéro erreur de formule, zéro plage brisée
- [ ] Gestion d'erreurs sur toutes les procédures principales
- [ ] `ScreenUpdating = False` sur les macros lourdes
- [ ] Validation des entrées dans les UserForms
- [ ] Constante `MODE_TEST = False` avant livraison finale
- [ ] Feuilles "Journal", "Diagnostic", "BASE_TEST" supprimées avant livraison
- [ ] Pas de références à des cellules codées en dur
- [ ] Test sur jeu de données vide (lastRow = 1)
- [ ] Graphiques lisibles en noir et blanc (pour impression)
- [ ] Feuilles protégées avec `ws.Protect Password:="xxx", UserInterfaceOnly:=True`
- [ ] Sauvegarde automatique proposée à la fermeture si modifications

---

## Connexions à des données externes

---

### 1. Import de fichiers CSV / TXT / XML

```vba
' ── Import CSV robuste avec détection du séparateur ──
Sub ImporterCSV(cheminFichier As String, wsDestination As Worksheet, _
                Optional separateur As String = ";")
    Const NOM_PROC As String = "ImporterCSV"
    Log LOG_INFO, NOM_PROC, "Import : " & cheminFichier

    If Dir(cheminFichier) = "" Then
        Log LOG_ERROR, NOM_PROC, "Fichier introuvable : " & cheminFichier
        MsgBox "Fichier introuvable : " & cheminFichier, vbCritical
        Exit Sub
    End If

    wsDestination.Cells.Clear

    Dim f As Integer : f = FreeFile
    Open cheminFichier For Input As #f

    Dim ligne As String
    Dim numLigne As Long : numLigne = 1
    Dim numCol As Integer

    Do While Not EOF(f)
        Line Input #f, ligne
        Dim champs() As String
        champs = Split(ligne, separateur)
        For numCol = 0 To UBound(champs)
            wsDestination.Cells(numLigne, numCol + 1).Value = Trim(champs(numCol))
        Next numCol
        numLigne = numLigne + 1
    Loop
    Close #f

    Log LOG_INFO, NOM_PROC, "Import terminé", numLigne - 1 & " lignes"
    MsgBox numLigne - 1 & " lignes importées.", vbInformation
End Sub

' ── Import XML avec parsing du DOM ──
Sub ImporterXML(cheminXML As String, wsDestination As Worksheet, _
                noeudCible As String)
    Dim xmlDoc As Object
    Set xmlDoc = CreateObject("MSXML2.DOMDocument.6.0")
    xmlDoc.async = False
    xmlDoc.Load cheminXML

    If xmlDoc.parseError.errorCode <> 0 Then
        MsgBox "Erreur XML : " & xmlDoc.parseError.reason, vbCritical
        Exit Sub
    End If

    Dim noeuds As Object
    Set noeuds = xmlDoc.getElementsByTagName(noeudCible)

    wsDestination.Cells.Clear
    Dim i As Long
    For i = 0 To noeuds.Length - 1
        Dim noeud As Object
        Set noeud = noeuds.Item(i)
        Dim j As Integer
        For j = 0 To noeud.childNodes.Length - 1
            wsDestination.Cells(i + 2, j + 1).Value = noeud.childNodes(j).Text
            If i = 0 Then
                wsDestination.Cells(1, j + 1).Value = noeud.childNodes(j).nodeName
                wsDestination.Cells(1, j + 1).Font.Bold = True
            End If
        Next j
    Next i
    Log LOG_INFO, "ImporterXML", "Import XML terminé", noeuds.Length & " noeuds"
End Sub
```

---

### 2. Requêtes SQL vers Access ou SQL Server

```vba
' ── Connexion et requête vers une base Access ──
Sub RequeteAccess(cheminAccess As String, requeteSQL As String, _
                  wsDestination As Worksheet)
    Const NOM_PROC As String = "RequeteAccess"
    Log LOG_INFO, NOM_PROC, "Connexion : " & cheminAccess

    Dim conn As Object
    Set conn = CreateObject("ADODB.Connection")

    Dim chaineConnexion As String
    chaineConnexion = "Provider=Microsoft.ACE.OLEDB.12.0;" & _
                      "Data Source=" & cheminAccess & ";"

    On Error GoTo ErrHandler
    conn.Open chaineConnexion

    Dim rs As Object
    Set rs = CreateObject("ADODB.Recordset")
    rs.Open requeteSQL, conn, 1, 1   ' adOpenKeyset, adLockReadOnly

    ' En-têtes
    wsDestination.Cells.Clear
    Dim col As Integer
    For col = 0 To rs.Fields.Count - 1
        wsDestination.Cells(1, col + 1).Value = rs.Fields(col).Name
        wsDestination.Cells(1, col + 1).Font.Bold = True
    Next col

    ' Données — méthode rapide CopyFromRecordset
    wsDestination.Range("A2").CopyFromRecordset rs

    Dim nbLignes As Long
    nbLignes = wsDestination.Cells(wsDestination.Rows.Count, 1).End(xlUp).Row - 1
    Log LOG_INFO, NOM_PROC, "Requête exécutée", nbLignes & " enregistrements"

    rs.Close : conn.Close
    Set rs = Nothing : Set conn = Nothing
    Exit Sub

ErrHandler:
    Log LOG_ERROR, NOM_PROC, "Erreur ADO : " & Err.Description
    If Not rs Is Nothing Then On Error Resume Next : rs.Close
    If Not conn Is Nothing Then On Error Resume Next : conn.Close
    MsgBox "Erreur connexion base de données : " & Err.Description, vbCritical
End Sub

' ── Requête vers SQL Server ──
Function ConnexionSQLServer(serveur As String, baseDeDonnees As String, _
                             Optional login As String = "", _
                             Optional motDePasse As String = "") As Object
    Dim conn As Object
    Set conn = CreateObject("ADODB.Connection")

    Dim chaine As String
    If login = "" Then
        ' Authentification Windows (recommandé en environnement hospitalier)
        chaine = "Provider=SQLOLEDB;" & _
                 "Data Source=" & serveur & ";" & _
                 "Initial Catalog=" & baseDeDonnees & ";" & _
                 "Integrated Security=SSPI;"
    Else
        chaine = "Provider=SQLOLEDB;" & _
                 "Data Source=" & serveur & ";" & _
                 "Initial Catalog=" & baseDeDonnees & ";" & _
                 "User ID=" & login & ";Password=" & motDePasse & ";"
    End If

    conn.Open chaine
    Set ConnexionSQLServer = conn
End Function

' ── Exemple d'utilisation SQL Server ──
Sub ExtrairePatients()
    Dim conn As Object
    On Error GoTo ErrHandler

    Set conn = ConnexionSQLServer("SRV-HOSPITAL\SQL2019", "DPI_Maternite")

    Dim sql As String
    sql = "SELECT nom, prenom, date_naissance, service " & _
          "FROM patients " & _
          "WHERE service = 'MATERNITE' " & _
          "AND date_admission >= DATEADD(month, -1, GETDATE()) " & _
          "ORDER BY date_admission DESC"

    Dim rs As Object
    Set rs = CreateObject("ADODB.Recordset")
    rs.Open sql, conn

    Sheets("Patients").Cells.Clear
    Sheets("Patients").Range("A2").CopyFromRecordset rs

    rs.Close : conn.Close
    Exit Sub
ErrHandler:
    Log LOG_ERROR, "ExtrairePatients", Err.Description
    MsgBox "Erreur : " & Err.Description, vbCritical
End Sub
```

---

### 3. Appels à des APIs REST (WinHTTP)

```vba
' ── Appel GET générique ──
Function AppelAPIGet(url As String, Optional token As String = "") As String
    Dim http As Object
    Set http = CreateObject("WinHttp.WinHttpRequest.5.1")

    http.Open "GET", url, False
    http.SetRequestHeader "Content-Type", "application/json"
    If token <> "" Then
        http.SetRequestHeader "Authorization", "Bearer " & token
    End If

    http.Send

    If http.Status = 200 Then
        AppelAPIGet = http.ResponseText
        Log LOG_DEBUG, "AppelAPIGet", "HTTP 200 — " & Len(http.ResponseText) & " chars"
    Else
        Log LOG_ERROR, "AppelAPIGet", "HTTP " & http.Status & " — " & url
        AppelAPIGet = ""
        MsgBox "Erreur API : HTTP " & http.Status & vbCrLf & url, vbExclamation
    End If
End Function

' ── Appel POST avec body JSON ──
Function AppelAPIPost(url As String, bodyJSON As String, _
                       Optional token As String = "") As String
    Dim http As Object
    Set http = CreateObject("WinHttp.WinHttpRequest.5.1")

    http.Open "POST", url, False
    http.SetRequestHeader "Content-Type", "application/json"
    http.SetRequestHeader "Accept", "application/json"
    If token <> "" Then
        http.SetRequestHeader "Authorization", "Bearer " & token
    End If

    http.Send bodyJSON

    AppelAPIPost = http.ResponseText
    Log LOG_DEBUG, "AppelAPIPost", "HTTP " & http.Status
End Function

' ── Parser JSON léger (sans référence externe) ──
' Pour des JSON simples clé:valeur à un niveau
Function ExtraireValeurJSON(json As String, cle As String) As String
    Dim pattern As String
    pattern = """" & cle & """\s*:\s*""([^""]*)"""

    Dim regex As Object
    Set regex = CreateObject("VBScript.RegExp")
    regex.Pattern = pattern
    regex.IgnoreCase = True

    Dim matches As Object
    Set matches = regex.Execute(json)

    If matches.Count > 0 Then
        ExtraireValeurJSON = matches(0).SubMatches(0)
    Else
        ' Essayer sans guillemets (valeur numérique)
        regex.Pattern = """" & cle & """\s*:\s*([0-9.]+)"
        Set matches = regex.Execute(json)
        If matches.Count > 0 Then
            ExtraireValeurJSON = matches(0).SubMatches(0)
        End If
    End If
End Function

' ── Exemple concret : récupérer un référentiel depuis une API interne ──
Sub ChargerReferentielPraticiens()
    Dim url As String
    url = "https://api.ch-bethune.fr/v1/praticiens?service=maternite"

    Dim reponse As String
    reponse = AppelAPIGet(url, "MON_TOKEN_API")
    If reponse = "" Then Exit Sub

    ' Écrire la réponse brute pour inspection
    Log LOG_DEBUG, "ChargerReferentiel", "Réponse reçue", Len(reponse) & " chars"

    ' Ici : parser le JSON et remplir la feuille Listes
    ' (utiliser un parser JSON complet comme VBA-JSON pour des structures complexes)
End Sub
```

---

### 4. Connexion SharePoint / OneDrive

```vba
' ── Lire un fichier Excel depuis SharePoint via chemin réseau mappé ──
Sub ImporterDepuisSharePoint()
    ' SharePoint synchronisé via OneDrive for Desktop apparaît comme un lecteur local
    Dim cheminSP As String
    cheminSP = Environ("USERPROFILE") & "\CH Béthune\Maternité - Documents\Registres\Base.xlsx"

    If Dir(cheminSP) = "" Then
        MsgBox "Fichier SharePoint introuvable." & vbCrLf & _
               "Vérifiez que OneDrive est synchronisé.", vbExclamation
        Exit Sub
    End If

    Dim wbSource As Workbook
    Application.ScreenUpdating = False
    Set wbSource = Workbooks.Open(cheminSP, ReadOnly:=True)

    ' Copier les données
    wbSource.Sheets("Base").UsedRange.Copy _
        Destination:=ThisWorkbook.Sheets("Import").Range("A1")

    wbSource.Close SaveChanges:=False
    Application.ScreenUpdating = True

    Log LOG_INFO, "ImporterDepuisSharePoint", "Import SharePoint réussi"
    MsgBox "Données importées depuis SharePoint.", vbInformation
End Sub

' ── Publier un fichier vers SharePoint ──
Sub PublierVersSharePoint(cheminLocal As String, cheminSP As String)
    On Error GoTo ErrHandler
    FileCopy cheminLocal, cheminSP
    Log LOG_INFO, "PublierVersSharePoint", "Publié : " & cheminSP
    MsgBox "Fichier publié sur SharePoint.", vbInformation
    Exit Sub
ErrHandler:
    Log LOG_ERROR, "PublierVersSharePoint", Err.Description
    MsgBox "Erreur publication : " & Err.Description, vbCritical
End Sub
```

---

## Gestion des fichiers et dossiers

---

### 1. Opérations de base sur les fichiers

```vba
' ============================================================
' MODULE : modFichiers
' Boîte à outils complète pour la gestion des fichiers
' ============================================================
Option Explicit

' ── Vérifications ──
Public Function FichierExiste(chemin As String) As Boolean
    FichierExiste = (Dir(chemin) <> "")
End Function

Public Function DossierExiste(chemin As String) As Boolean
    DossierExiste = (Dir(chemin, vbDirectory) <> "")
End Function

' ── Créer un dossier et tous ses parents si nécessaire ──
Public Sub CreerDossier(chemin As String)
    If DossierExiste(chemin) Then Exit Sub
    ' Créer les dossiers parents récursivement
    Dim parent As String
    parent = Left(chemin, InStrRev(chemin, "\") - 1)
    If Not DossierExiste(parent) Then CreerDossier parent
    MkDir chemin
    Log LOG_DEBUG, "CreerDossier", "Créé : " & chemin
End Sub

' ── Copier un fichier avec horodatage optionnel ──
Public Function CopierFichier(source As String, destination As String, _
                               Optional horodater As Boolean = False) As Boolean
    If Not FichierExiste(source) Then
        Log LOG_ERROR, "CopierFichier", "Source introuvable : " & source
        CopierFichier = False : Exit Function
    End If

    Dim dest As String
    If horodater Then
        Dim ext As String : ext = Mid(source, InStrRev(source, "."))
        Dim base As String : base = Left(destination, Len(destination) - Len(ext))
        dest = base & "_" & Format(Now, "yyyymmdd_hhmmss") & ext
    Else
        dest = destination
    End If

    FileCopy source, dest
    Log LOG_INFO, "CopierFichier", source & " → " & dest
    CopierFichier = True
End Function

' ── Déplacer un fichier ──
Public Sub DeplacerFichier(source As String, destination As String)
    CopierFichier source, destination
    Kill source
    Log LOG_INFO, "DeplacerFichier", source & " → " & destination
End Sub

' ── Supprimer un fichier avec confirmation ──
Public Sub SupprimerFichier(chemin As String, Optional confirmer As Boolean = True)
    If Not FichierExiste(chemin) Then Exit Sub
    If confirmer Then
        If MsgBox("Supprimer : " & chemin & " ?", vbYesNo + vbQuestion) = vbNo Then Exit Sub
    End If
    Kill chemin
    Log LOG_WARN, "SupprimerFichier", "Supprimé : " & chemin
End Sub

' ── Renommer un fichier ──
Public Sub RenommerFichier(ancienChemin As String, nouveauChemin As String)
    If Not FichierExiste(ancienChemin) Then Exit Sub
    Name ancienChemin As nouveauChemin
    Log LOG_INFO, "RenommerFichier", ancienChemin & " → " & nouveauChemin
End Sub
```

---

### 2. Lister et filtrer le contenu d'un dossier

```vba
' ── Lister tous les fichiers d'un dossier (avec sous-dossiers optionnel) ──
Public Function ListerFichiers(dossier As String, _
                                Optional filtre As String = "*.*", _
                                Optional recursif As Boolean = False) As Collection
    Dim liste As New Collection

    If Not DossierExiste(dossier) Then
        Set ListerFichiers = liste : Exit Function
    End If

    ' Fichiers du dossier courant
    Dim fichier As String
    fichier = Dir(dossier & "\" & filtre)
    Do While fichier <> ""
        liste.Add dossier & "\" & fichier
        fichier = Dir
    Loop

    ' Sous-dossiers si récursif
    If recursif Then
        Dim sousDossier As String
        sousDossier = Dir(dossier & "\*", vbDirectory)
        Do While sousDossier <> ""
            If sousDossier <> "." And sousDossier <> ".." Then
                Dim chemin As String
                chemin = dossier & "\" & sousDossier
                If GetAttr(chemin) And vbDirectory Then
                    Dim sousListe As Collection
                    Set sousListe = ListerFichiers(chemin, filtre, True)
                    Dim item As Variant
                    For Each item In sousListe
                        liste.Add item
                    Next item
                End If
            End If
            sousDossier = Dir
        Loop
    End If

    Set ListerFichiers = liste
End Function

' ── Écrire la liste dans une feuille ──
Sub ListerFichiersVers(dossier As String, wsDestination As Worksheet, _
                        Optional filtre As String = "*.xlsx")
    wsDestination.Cells.Clear
    wsDestination.Range("A1:E1").Value = Array("Nom", "Chemin complet", "Taille (Ko)", "Modifié le", "Extension")
    wsDestination.Range("A1:E1").Font.Bold = True

    Dim fichiers As Collection
    Set fichiers = ListerFichiers(dossier, filtre, True)

    Dim i As Long : i = 2
    Dim f As Variant
    For Each f In fichiers
        wsDestination.Cells(i, 1).Value = Dir(CStr(f))
        wsDestination.Cells(i, 2).Value = CStr(f)
        wsDestination.Cells(i, 3).Value = Round(FileLen(CStr(f)) / 1024, 1)
        wsDestination.Cells(i, 4).Value = FileDateTime(CStr(f))
        wsDestination.Cells(i, 5).Value = Mid(CStr(f), InStrRev(CStr(f), ".") + 1)
        i = i + 1
    Next f

    Log LOG_INFO, "ListerFichiersVers", i - 2 & " fichiers listés dans " & dossier
End Sub
```

---

### 3. Archivage automatique

```vba
' ── Archiver un fichier dans un sous-dossier daté ──
Public Function ArchiverFichier(cheminFichier As String, _
                                  dossierArchive As String) As String
    If Not FichierExiste(cheminFichier) Then
        Log LOG_ERROR, "ArchiverFichier", "Fichier introuvable : " & cheminFichier
        ArchiverFichier = "" : Exit Function
    End If

    ' Créer le dossier d'archive AAAA\MM
    Dim dossierDate As String
    dossierDate = dossierArchive & "\" & Format(Date, "yyyy") & "\" & Format(Date, "mm")
    CreerDossier dossierDate

    ' Nom de destination avec horodatage
    Dim nomFichier As String
    nomFichier = Dir(cheminFichier)
    Dim ext As String : ext = Mid(nomFichier, InStrRev(nomFichier, "."))
    Dim base As String : base = Left(nomFichier, Len(nomFichier) - Len(ext))
    Dim destination As String
    destination = dossierDate & "\" & base & "_" & Format(Now, "yyyymmdd_hhmmss") & ext

    FileCopy cheminFichier, destination
    Log LOG_INFO, "ArchiverFichier", "Archivé : " & destination
    ArchiverFichier = destination
End Function

' ── Purger les archives de plus de N jours ──
Public Sub PurgerArchivesAnciennes(dossierArchive As String, _
                                    joursRetention As Integer)
    Dim fichiers As Collection
    Set fichiers = ListerFichiers(dossierArchive, "*.*", True)

    Dim nbSupprimes As Long : nbSupprimes = 0
    Dim f As Variant
    For Each f In fichiers
        If FileDateTime(CStr(f)) < Date - joursRetention Then
            Kill CStr(f)
            Log LOG_WARN, "PurgerArchives", "Supprimé (> " & joursRetention & "j) : " & CStr(f)
            nbSupprimes = nbSupprimes + 1
        End If
    Next f

    Log LOG_INFO, "PurgerArchives", nbSupprimes & " fichiers supprimés"
    MsgBox nbSupprimes & " fichier(s) archivés supprimés (rétention : " & joursRetention & " jours).", vbInformation
End Sub
```

---

### 4. Surveillance de dossier — traitement automatique à l'arrivée d'un fichier

```vba
' ── Surveiller un dossier et traiter les nouveaux fichiers ──
' À appeler depuis Workbook_Open ou un bouton "Démarrer surveillance"
Public Sub SurveillerDossier(dossierSurveille As String, _
                               filtre As String, _
                               intervalleSecondes As Integer)
    Log LOG_INFO, "SurveillerDossier", "Surveillance démarrée : " & dossierSurveille

    ' Mémoriser les fichiers déjà présents
    Dim dejaPresents As New Collection
    Dim fichiers As Collection
    Set fichiers = ListerFichiers(dossierSurveille, filtre)
    Dim f As Variant
    For Each f In fichiers
        dejaPresents.Add CStr(f), CStr(f)
    Next f

    ' Boucle de surveillance (s'arrête si la cellule "Stop" vaut TRUE)
    Dim continuer As Boolean : continuer = True
    Do While continuer
        Application.Wait Now + TimeValue("00:00:" & Format(intervalleSecondes, "00"))
        DoEvents

        Set fichiers = ListerFichiers(dossierSurveille, filtre)
        For Each f In fichiers
            On Error Resume Next
            dejaPresents.Item CStr(f)   ' Chercher si déjà connu
            If Err.Number <> 0 Then     ' Nouveau fichier !
                On Error GoTo 0
                Log LOG_INFO, "SurveillerDossier", "Nouveau fichier détecté : " & CStr(f)
                Call TraiterNouveauFichier(CStr(f))
                dejaPresents.Add CStr(f), CStr(f)
            End If
            On Error GoTo 0
        Next f

        ' Condition d'arrêt : mettre TRUE dans une cellule dédiée
        continuer = Not (ThisWorkbook.Sheets("Params").Range("StopSurveillance").Value = True)
    Loop

    Log LOG_INFO, "SurveillerDossier", "Surveillance arrêtée"
End Sub

Private Sub TraiterNouveauFichier(chemin As String)
    ' Adapter selon le type de fichier attendu
    Select Case LCase(Mid(chemin, InStrRev(chemin, ".") + 1))
        Case "xlsx", "xls"
            Call ImporterClasseurEntrant(chemin)
        Case "csv"
            Call ImporterCSV(chemin, ThisWorkbook.Sheets("Import"))
        Case "xml"
            Call ImporterXML(chemin, ThisWorkbook.Sheets("Import"), "record")
    End Select
    Call ArchiverFichier(chemin, ThisWorkbook.Path & "\Archives")
End Sub
```

---

## Envoi automatique d'emails via Outlook

---

### 1. Envoi simple et robuste

```vba
' ============================================================
' MODULE : modEmail
' Envoi d'emails via Outlook depuis VBA
' ============================================================
Option Explicit

' ── Vérifier qu'Outlook est disponible ──
Private Function OutlookDisponible() As Boolean
    On Error Resume Next
    Dim ol As Object
    Set ol = GetObject(, "Outlook.Application")
    If ol Is Nothing Then Set ol = CreateObject("Outlook.Application")
    OutlookDisponible = Not (ol Is Nothing)
    On Error GoTo 0
End Function

' ── Email simple texte ou HTML ──
Public Sub EnvoyerEmail(destinataire As String, sujet As String, corps As String, _
                         Optional copie As String = "", _
                         Optional pieceJointe As String = "", _
                         Optional formatHTML As Boolean = True, _
                         Optional afficherAvantEnvoi As Boolean = False)
    Const NOM_PROC As String = "EnvoyerEmail"

    If Not OutlookDisponible() Then
        Log LOG_ERROR, NOM_PROC, "Outlook non disponible"
        MsgBox "Outlook n'est pas installé ou accessible.", vbCritical
        Exit Sub
    End If

    On Error GoTo ErrHandler

    Dim ol As Object
    Set ol = GetObject(, "Outlook.Application")
    If ol Is Nothing Then Set ol = CreateObject("Outlook.Application")

    Dim mail As Object
    Set mail = ol.CreateItem(0)   ' 0 = olMailItem

    With mail
        .To      = destinataire
        .CC      = copie
        .Subject = sujet

        If formatHTML Then
            .HTMLBody = corps
        Else
            .Body = corps
        End If

        If pieceJointe <> "" And FichierExiste(pieceJointe) Then
            .Attachments.Add pieceJointe
            Log LOG_DEBUG, NOM_PROC, "Pièce jointe : " & pieceJointe
        End If

        If afficherAvantEnvoi Then
            .Display   ' Ouvrir la fenêtre de composition
        Else
            .Send      ' Envoyer directement
            Log LOG_INFO, NOM_PROC, "Email envoyé à : " & destinataire & " | Sujet : " & sujet
        End If
    End With

    Set mail = Nothing : Set ol = Nothing
    Exit Sub

ErrHandler:
    Log LOG_ERROR, NOM_PROC, "Erreur : " & Err.Description
    MsgBox "Erreur envoi email : " & Err.Description, vbCritical
End Sub
```

---

### 2. Email avec corps HTML professionnel

```vba
' ── Générer un corps HTML stylisé ──
Public Function GenererCorpsHTML(titre As String, intro As String, _
                                   tableauHTML As String, _
                                   Optional piedPage As String = "") As String
    Dim html As String
    html = "<!DOCTYPE html><html><head>" & _
           "<style>" & _
           "  body { font-family: Calibri, Arial, sans-serif; font-size: 13px; color: #333; }" & _
           "  h2   { color: #336600; border-bottom: 2px solid #336600; padding-bottom: 5px; }" & _
           "  table{ border-collapse: collapse; width: 100%; margin-top: 10px; }" & _
           "  th   { background-color: #336600; color: white; padding: 8px 12px; text-align: left; }" & _
           "  td   { padding: 6px 12px; border-bottom: 1px solid #ddd; }" & _
           "  tr:nth-child(even) { background-color: #f5f5f5; }" & _
           "  .footer { font-size: 11px; color: #999; margin-top: 20px; border-top: 1px solid #eee; }" & _
           "</style></head><body>" & _
           "<h2>" & titre & "</h2>" & _
           "<p>" & intro & "</p>" & _
           tableauHTML & _
           "<p class='footer'>" & piedPage & "<br>Envoyé automatiquement le " & _
           Format(Now, "dd/mm/yyyy à hh:mm") & " — CH Béthune-Beuvry</p>" & _
           "</body></html>"
    GenererCorpsHTML = html
End Function

' ── Convertir une plage Excel en tableau HTML ──
Public Function PlageVersHTML(ws As Worksheet, plage As Range, _
                               Optional avecEnTetes As Boolean = True) As String
    Dim html As String
    html = "<table>"

    Dim premiereLigne As Long : premiereLigne = plage.Row
    Dim derniereColonne As Long : derniereColonne = plage.Column + plage.Columns.Count - 1

    Dim r As Long, c As Long
    For r = plage.Row To plage.Row + plage.Rows.Count - 1
        html = html & "<tr>"
        For c = plage.Column To derniereColonne
            Dim valCell As String
            valCell = CStr(ws.Cells(r, c).Value)
            If r = premiereLigne And avecEnTetes Then
                html = html & "<th>" & valCell & "</th>"
            Else
                html = html & "<td>" & valCell & "</td>"
            End If
        Next c
        html = html & "</tr>"
    Next r

    PlageVersHTML = html & "</table>"
End Function
```

---

### 3. Envois groupés et rapports automatiques

```vba
' ── Rapport mensuel maternité envoyé automatiquement ──
Sub EnvoyerRapportMensuel()
    Const NOM_PROC As String = "EnvoyerRapportMensuel"
    Log LOG_INFO, NOM_PROC, "Génération du rapport mensuel"

    ' 1. Générer le PDF du rapport
    Dim cheminPDF As String
    cheminPDF = ThisWorkbook.Path & "\Exports\Rapport_" & Format(Date, "yyyymm") & ".pdf"
    CreerDossier ThisWorkbook.Path & "\Exports"
    Call ExporterPDF(ThisWorkbook.Sheets("Rapport"), cheminPDF)

    ' 2. Préparer le tableau HTML des statistiques clés
    Dim tableauHTML As String
    tableauHTML = PlageVersHTML(ThisWorkbook.Sheets("Stats"), _
                                ThisWorkbook.Sheets("Stats").Range("A1:E10"))

    ' 3. Corps de l'email
    Dim intro As String
    intro = "Veuillez trouver ci-dessous les statistiques de la maternité " & _
            "pour le mois de <strong>" & Format(Date, "mmmm yyyy") & "</strong>." & _
            " Le rapport complet est joint en pièce jointe."

    Dim corps As String
    corps = GenererCorpsHTML("Rapport Mensuel — Pôle Mère-Enfant", intro, tableauHTML, _
                              "Pôle Mère-Enfant — CH Béthune-Beuvry")

    ' 4. Lire la liste des destinataires depuis la feuille Params
    Dim wsParams As Worksheet
    Set wsParams = ThisWorkbook.Sheets("Params")
    Dim i As Long
    For i = 2 To wsParams.Cells(wsParams.Rows.Count, "F").End(xlUp).Row
        Dim dest As String
        dest = wsParams.Cells(i, "F").Value
        If dest <> "" And InStr(dest, "@") > 0 Then
            Call EnvoyerEmail( _
                destinataire:=dest, _
                sujet:="[Maternité] Rapport mensuel — " & Format(Date, "mmmm yyyy"), _
                corps:=corps, _
                pieceJointe:=cheminPDF, _
                formatHTML:=True _
            )
        End If
    Next i

    Log LOG_INFO, NOM_PROC, "Rapport mensuel envoyé"
    MsgBox "Rapport mensuel envoyé avec succès.", vbInformation
End Sub

' ── Alerte automatique sur un seuil ──
Sub AlerterSiSeuilDepasse(indicateur As String, valeur As Double, _
                           seuil As Double, destinataire As String)
    If valeur <= seuil Then Exit Sub

    Dim sujet As String
    sujet = "[ALERTE] " & indicateur & " dépasse le seuil (" & valeur & " > " & seuil & ")"

    Dim corps As String
    corps = GenererCorpsHTML( _
        "⚠ Alerte Qualité — " & indicateur, _
        "L'indicateur <strong>" & indicateur & "</strong> a atteint <strong>" & _
        valeur & "</strong>, dépassant le seuil fixé à <strong>" & seuil & "</strong>.", _
        "", "Surveillance automatique — Pôle Mère-Enfant" _
    )

    Call EnvoyerEmail(destinataire, sujet, corps, formatHTML:=True)
    Log LOG_WARN, "AlerterSiSeuilDepasse", indicateur & " : " & valeur & " > " & seuil
End Sub

' ── Planifier l'exécution automatique (via Workbook_Open) ──
' Dans ThisWorkbook :
Private Sub Workbook_Open()
    ' Planifier le rapport mensuel le 1er du mois
    If Day(Date) = 1 And Hour(Now) >= 8 Then
        ' Vérifier qu'il n'a pas déjà été envoyé ce mois-ci
        Dim dernierEnvoi As Date
        On Error Resume Next
        dernierEnvoi = CDate(ThisWorkbook.Sheets("Params").Range("DernierEnvoiRapport").Value)
        On Error GoTo 0

        If Month(dernierEnvoi) <> Month(Date) Or Year(dernierEnvoi) <> Year(Date) Then
            Call EnvoyerRapportMensuel
            ThisWorkbook.Sheets("Params").Range("DernierEnvoiRapport").Value = Now
        End If
    End If
End Sub
```

---

### 4. Brouillons et suivi des envois

```vba
' ── Créer un brouillon (pour relecture avant envoi) ──
Public Sub CreerBrouillon(destinataire As String, sujet As String, corps As String, _
                            Optional pieceJointe As String = "")
    Dim ol As Object
    Set ol = GetObject(, "Outlook.Application")
    If ol Is Nothing Then Set ol = CreateObject("Outlook.Application")

    Dim mail As Object
    Set mail = ol.CreateItem(0)

    With mail
        .To      = destinataire
        .Subject = sujet
        .HTMLBody = corps
        If pieceJointe <> "" And FichierExiste(pieceJointe) Then
            .Attachments.Add pieceJointe
        End If
        .Save   ' Enregistrer dans les brouillons sans envoyer
    End With

    Log LOG_INFO, "CreerBrouillon", "Brouillon créé pour : " & destinataire
    MsgBox "Brouillon créé dans Outlook. Vérifiez avant d'envoyer.", vbInformation
End Sub

' ── Journaliser les envois dans une feuille dédiée ──
Public Sub LoggerEnvoi(destinataire As String, sujet As String, _
                        statut As String, Optional erreur As String = "")
    Dim ws As Worksheet
    On Error Resume Next
    Set ws = ThisWorkbook.Sheets("Envois")
    If ws Is Nothing Then
        Set ws = ThisWorkbook.Sheets.Add
        ws.Name = "Envois"
        ws.Range("A1:E1").Value = Array("Date", "Destinataire", "Sujet", "Statut", "Erreur")
        ws.Range("A1:E1").Font.Bold = True
    End If
    On Error GoTo 0

    Dim nextRow As Long
    nextRow = ws.Cells(ws.Rows.Count, 1).End(xlUp).Row + 1
    ws.Cells(nextRow, 1).Value = Now
    ws.Cells(nextRow, 2).Value = destinataire
    ws.Cells(nextRow, 3).Value = sujet
    ws.Cells(nextRow, 4).Value = statut
    ws.Cells(nextRow, 5).Value = erreur

    Dim couleur As Long
    Select Case statut
        Case "Envoyé"   : couleur = RGB(198, 239, 206)
        Case "Brouillon": couleur = RGB(255, 243, 205)
        Case "Erreur"   : couleur = RGB(255, 199, 206)
    End Select
    ws.Rows(nextRow).Interior.Color = couleur
End Sub
```

