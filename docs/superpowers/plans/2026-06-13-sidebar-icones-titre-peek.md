# Sidebar icônes + aperçu titre — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:executing-plans (inline — la cible est une instance Excel ouverte pilotée en COM sur cette machine ; un sous-agent ne partage pas cet état). Steps use checkbox (`- [ ]`) syntax.

**Goal:** Sur `excel/Suivi Conso Carburants.xlsm`, n'afficher que le hamburger `sb_ham` par défaut ; le clic déplie la colonne d'icônes ; le clic sur une icône révèle son titre (icône immobile) puis replie en restaurant la taille exacte ; retirer le module mort `modNavMenu`.

**Architecture:** Refonte ciblée de `modSidebar.bas` (shapes par onglet, points document = pt_écran ÷ zoom, `Placement=xlFreeFloating`). Le bug de taille est corrigé par **snapshot/restauration** de la géométrie exacte de l'icône (jamais recalcul depuis le zoom). Déploiement via `vba-agent` (`set-module` depuis le `.bas` UTF-8, `remove` pour le module mort).

**Tech Stack:** VBA (Excel), pywin32/COM via `vba_agent.py`, miroir disque `vba/*.bas`.

---

## File Structure

- Modify: `vba/modSidebar.bas` — refonte comportement (déployé dans le classeur via `set-module`).
- Remove: `vba/modNavMenu.bas` (disque) + composant `modNavMenu` (classeur, via `remove`).
- Modify: `js/config.js:2` (`APP_VERSION` → 5.15.0.0), `CHANGELOG.md`, `ROADMAP.md`.
- Backup: `vba/backup_20260613_sidebar/` (via `vba-agent backup`).

---

### Task 1 : Sauvegarde du projet VBA

- [ ] **Step 1 : Backup**

Run: `python "C:\Users\fdaub\.claude\skills\vba-agent\vba_agent.py" backup --file "Suivi Conso Carburants.xlsm" --out "C:\Users\fdaub\Documents\Github\suivi-conso-carburant\vba\backup_20260613_sidebar"`
Expected: `"ok": true`, dossier créé avec tous les composants.

---

### Task 2 : Vérifier l'absence de références à modNavMenu

- [ ] **Step 1 : Grep des appels**

Grep (projet `vba/` actifs, hors backup) : `modNavMenu|ShowNavMenu|btnNavMenu|NavToSheetPublic|PoserBoutonsNavMenu|frmNavMenu`
Expected : occurrences uniquement dans `vba/modNavMenu.bas`. Si un `OnAction`/`Call`/`Run` ailleurs → le neutraliser AVANT le retrait (leçon : `Call` orphelin = erreur de compilation non rattrapable).

---

### Task 3 : Réécrire `vba/modSidebar.bas`

**Files:** Modify `vba/modSidebar.bas`

Changements (le reste du module inchangé) :

- [ ] **Step 1 : Variables module (après `g_PreviewSheet`, ~ligne 38)**

```vba
' Snapshot geometrie exacte de l'icone en apercu (corrige le decalage au repli)
Private g_SnapSet As Boolean
Private g_SnapW As Single, g_SnapH As Single, g_SnapL As Single, g_SnapT As Single
Private g_SnapIdx As Integer
```

- [ ] **Step 2 : `ExpandSidebar` — révéler la COLONNE D'ICÔNES (pas les libellés)**

Remplacer le corps : afficher `sb_bg` (largeur repliée), puis révéler `sb_ico_*` + `sb_sep_*` en cascade (progressif), sans header ni libellés.

```vba
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
```

- [ ] **Step 3 : `CollapseSidebar` — masquer la colonne d'icônes**

```vba
Public Sub CollapseSidebar()
    g_TimerSet = False
    If Not g_Expanded Then Exit Sub
    g_Expanded = False
    Dim ws As Worksheet: Set ws = ActiveSheet
    CancelPreviewTimer
    If g_SnapSet Then RestoreSnap ws
    HideIconColumn ws
End Sub
```

- [ ] **Step 4 : Nouvel helper `HideIconColumn` (masque tout sauf `sb_ham`)**

```vba
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
```

- [ ] **Step 5 : `ExpandIcon` — snapshot + extension droite (icône immobile)**

```vba
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
        lbl.Left = g_SnapL + g_SnapW          ' juste apres l'icone (alignee gauche)
        lbl.Width = wExp - g_SnapW - 4 / z
        lbl.Visible = msoTrue
    End If
    Application.ScreenUpdating = True
End Sub
```

- [ ] **Step 6 : `CollapseIcon` — repli progressif + restauration exacte**

```vba
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
```

- [ ] **Step 7 : Helpers `SiblingWidth` (filet anti-décalage) + `RestoreSnap`**

```vba
' Largeur d'une icone voisine non etendue (toutes a l'etat replie : 1 seul apercu a la fois)
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
```

- [ ] **Step 8 : `RepositionSidebar` — reset replié au changement d'onglet**

```vba
Public Sub RepositionSidebar()
    CancelTimer
    CancelPreviewTimer
    g_Expanded = False
    HideIconColumn ActiveSheet
    MarquerOngletActif
End Sub
```

- [ ] **Step 9 : `PoserSidebarSurFeuille` — défauts masqués + émoji aligné gauche**

Dans la boucle items : après création de `ico`, mettre l'émoji à gauche et masquer ;
masquer aussi le séparateur. Bloc icône modifié :

```vba
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
```

Et pour le libellé : aligné gauche (déjà), reste `Visible=False`.
Et le séparateur : après création, `sepN.Visible = msoFalse`.
`sb_sep_h` : après création, `sepH.Visible = msoFalse`.
(`sb_bg`, `sb_hdr` restent `Visible=False`. `sb_ham` reste visible.)

- [ ] **Step 10 : Écrire le fichier disque + déployer**

Écrire `vba/modSidebar.bas` complet (toutes modifs ci-dessus intégrées), puis :
Run: `python "...\vba_agent.py" set-module --file "Suivi Conso Carburants.xlsm" --name modSidebar --type std --code-file "<tmp utf-8>"`
Expected: `"ok": true`.

---

### Task 4 : Retirer le module mort `modNavMenu`

- [ ] **Step 1 : Retrait composant**

Run: `python "...\vba_agent.py" remove --file "Suivi Conso Carburants.xlsm" --name modNavMenu`
Expected: `"ok": true`.

- [ ] **Step 2 : Supprimer le miroir disque**

Run: `rm "C:\Users\fdaub\Documents\Github\suivi-conso-carburant\vba\modNavMenu.bas"`

---

### Task 5 : Redéploiement + sauvegarde

- [ ] **Step 1 : Reposer les shapes propres**

Run: `python "...\vba_agent.py" run --file "Suivi Conso Carburants.xlsm" --macro "modSidebar.PoserSidebarSurTousLesOnglets"`
Expected: `"ok": true`.

- [ ] **Step 2 : Sauvegarder**

Run: `python "...\vba_agent.py" save --file "Suivi Conso Carburants.xlsm"`
Expected: `"ok": true`.

---

### Task 6 : Vérification COM (automatisée)

- [ ] **Step 1 : État par défaut — seul `sb_ham` visible**

Script pywin32 lecture seule : pour chaque onglet nav, assert `sb_ham.Visible = True` ET tous `sb_ico_*`, `sb_sep_*`, `sb_bg` `Visible = False`.
Expected: PASS sur tous les onglets.

- [ ] **Step 2 : Régression bug taille — restauration exacte**

Script : sur un onglet, lire la largeur d'`sb_ico_0` (= largeur de référence des voisines). `run PreviewSidebar_1` puis `run AutoCollapsePreview`. Relire `sb_ico_1.Width`.
Expected: `sb_ico_1.Width == sb_ico_0.Width` (à 0,01 pt près) → décalage corrigé.

---

### Task 7 : Test utilisateur réel (manuel)

- [ ] **Step 1** : L'utilisateur ouvre chaque onglet → confirme : seul ☰ visible ; clic ☰ → colonne d'icônes en dépli progressif ; clic icône → titre à droite, icône immobile ; après ~2,5 s → repli progressif, icône à la bonne taille. (Clic/survol non testable en COM — leçon.)

---

### Task 8 : Version + documentation

- [ ] **Step 1** : `js/config.js` `APP_VERSION` 5.14.1.0 → **5.15.0.0**.
- [ ] **Step 2** : `CHANGELOG.md` entrée `[5.15.0.0]` (Added/Changed/Removed).
- [ ] **Step 3** : `ROADMAP.md` ligne « déjà implémentées » + retrait éventuel d'items liés.

---

### Task 9 : Pré-commit + commit

- [ ] **Step 1** : `/graphify --update`.
- [ ] **Step 2** : `./commit.sh "feat(excel): sidebar colonne d'icones + apercu titre par icone, fix taille au repli, retrait modNavMenu [v5.15.0.0]"`.

---

## Self-Review

- **Couverture spec** : règle #1 (Task 3 S9 + Task 6 S1) ; dépli icônes (S2) ; aperçu titre immobile (S5) ; repli progressif + restauration exacte (S6/S7, Task 6 S2) ; retrait modNavMenu (Task 2+4) ; version/docs (Task 8). ✓
- **Placeholders** : aucun — code complet par procédure modifiée.
- **Cohérence noms** : `HideIconColumn`, `SiblingWidth`, `RestoreSnap`, `g_Snap*` utilisés de façon cohérente entre Steps. ✓
- **Risques** : émoji aligné gauche → rendu collapsed légèrement à gauche (`MarginLeft` ajustable) ; timer auto-repli colonne conservé (4 s) — à confirmer au test réel.
