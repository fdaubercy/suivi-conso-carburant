# MAJ d'ouverture en arrière-plan (« Accueil » figé) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** À l'ouverture du classeur `Suivi Conso Carburants.xlsm`, exécuter les MAJ différées (import +2 s, rebuild +3 s, sync +5 s) en arrière-plan sans voler le focus, en gardant la feuille active (« Accueil » par défaut, ou celle choisie par l'utilisateur) au 1er plan, sans aucun clignotement.

**Architecture:** Approche A (drapeau `gSilentOpen`). Trois wrappers `OpenTask_*` enrobent les routines différées : ils gèlent `ScreenUpdating`, exécutent la tâche, restaurent la feuille active mémorisée au début (= « respecter mon clic »), puis font un repaint unique. Le drapeau neutralise la seule activation cosmétique du rebuild (`MAJ_Dashboard_Graphiques` l.121-123) ; l'activation porteuse de `PrepareSheet` reste mais invisible (écran gelé). `Workbook_Open` planifie les wrappers au lieu des routines brutes.

**Tech Stack:** VBA (Excel), déploiement COM via skill `vba-agent` (pywin32) dans le classeur **déjà ouvert**. Vérification : COM (présence des symboles) + **visuelle par l'utilisateur** (comportement d'ouverture non testable en COM — leçons #26/#32).

**Spec:** `docs/superpowers/specs/2026-06-17-onglets-arriere-plan-design.md`

**Règles projet à respecter :** déploiement depuis `.bas` UTF-8 en retirant `Attribute VB_Name`, sans temp CP1252 (#15) ; après set-module, save + close/reopen pour purger le buffer VBE (#16) ; éditer le CodeModule live par remplacement de sous-chaînes ancrées sur des littéraux (#40) ; « commit » ≠ « push », jamais pousser sans accord (#36) ; ne pas committer un graphe amputé — VBA hors graphe (#44).

---

## File Structure

| Fichier | Responsabilité | Changement |
|---|---|---|
| `vba/modWorkbook.bas` | Navigation + démarrage | + `Public gSilentOpen` ; + `RunSilentTask` (privé) ; + `OpenTask_Import/Rebuild/Sync` (publics) |
| `vba/modDashboardGraphiques.bas` | Rendu dashboard | Garde `If Not gSilentOpen` autour du tail cosmétique de `MAJ_Dashboard_Graphiques` (l.121-123) |
| `vba/ThisWorkbook.cls` | Événements classeur | 3 noms d'`OnTime` → wrappers |
| `CHANGELOG.md`, `ROADMAP.md`, `js/config.js` | Docs + version | `v5.19.0.0` |

Toutes les éditions de code visent **le CodeModule LIVE** (classeur ouvert) ; le miroir disque `vba/*.bas` est resynchronisé après coup (Task 6).

---

## Task 0: Pré-vol — vérifier l'état & sauvegarder

**Files:**
- Create: `vba-backup-20260617-onglets/` (export des composants)
- Create: `backups/Suivi Conso Carburants_backup_20260617-onglets.xlsm`

- [ ] **Step 1: Vérifier qu'Excel est ouvert sur le bon classeur**

Run (PowerShell):
```powershell
$xlsm = 'C:\Users\fdaub\Documents\Github\suivi-conso-carburant\excel\Suivi Conso Carburants.xlsm'
Get-Process EXCEL -ErrorAction SilentlyContinue | Select-Object Id,StartTime
```
Expected: au moins un process EXCEL. Si absent → demander à l'utilisateur d'ouvrir `excel\Suivi Conso Carburants.xlsm` avant de continuer (le déploiement COM exige le classeur ouvert).

- [ ] **Step 2: Confirmer via COM que le classeur cible est chargé et lister les modules**

Via skill `vba-agent` : attacher à l'instance Excel, confirmer que `Suivi Conso Carburants.xlsm` est dans `Application.Workbooks`, et lister les composants VBA. Confirmer la présence de `modWorkbook`, `modDashboardGraphiques`, `ThisWorkbook`.
Expected: les 3 composants existent.

- [ ] **Step 3: Backup VBA (export des composants) + copie .xlsm**

Via `vba-agent`, exporter tous les composants vers `vba-backup-20260617-onglets/`. Puis copier le classeur fermé n'est pas possible (ouvert) → faire un `wb.SaveCopyAs` :
```
wb.SaveCopyAs "C:\Users\fdaub\Documents\Github\suivi-conso-carburant\backups\Suivi Conso Carburants_backup_20260617-onglets.xlsm"
```
Expected: dossier `vba-backup-20260617-onglets/` non vide + fichier backup présent.

---

## Task 1: modWorkbook — drapeau + wrappers (live)

**Files:**
- Modify (live CodeModule): `modWorkbook` — declarations (après `WB_VERSION`, l.29) et après `AfficherVueDeDepart` (`End Sub` l.297)
- Mirror later: `vba/modWorkbook.bas`

- [ ] **Step 1: Lire le CodeModule live de modWorkbook et confirmer les ancres**

Via `vba-agent`, lire `modWorkbook` (live). Confirmer la présence des littéraux d'ancrage :
- `Public Const WB_VERSION  As String = "5.13.0.1"`
- la fin de `AfficherVueDeDepart` :
```
        Case Else
            GoSheet WS_ACCUEIL, "Accueil"
    End Select
    On Error GoTo 0
End Sub
```
Expected: les deux ancres présentes (sinon, le VBE a pu re-caser — relire et ajuster l'ancre sur le littéral réel).

- [ ] **Step 2: Insérer la déclaration du drapeau**

Remplacement ancré (live) :
- OLD:
```
Public Const WB_VERSION  As String = "5.13.0.1"
```
- NEW:
```
Public Const WB_VERSION  As String = "5.13.0.1"

' #6 (v5.19) : drapeau d'ouverture silencieuse -- voir RunSilentTask / OpenTask_*
Public gSilentOpen As Boolean
```

- [ ] **Step 3: Insérer le helper + les 3 wrappers après AfficherVueDeDepart**

Remplacement ancré (live) :
- OLD:
```
        Case Else
            GoSheet WS_ACCUEIL, "Accueil"
    End Select
    On Error GoTo 0
End Sub
```
- NEW:
```
        Case Else
            GoSheet WS_ACCUEIL, "Accueil"
    End Select
    On Error GoTo 0
End Sub

' ============================================================
'  #6 (v5.19) : MAJ d'ouverture en arriere-plan
'  Chaque tache differee (import / rebuild / sync) tourne ecran gele
'  et RESTAURE la feuille active memorisee a son debut -> Accueil (ou
'  la feuille choisie par l'utilisateur) reste au 1er plan, aucune
'  feuille de fond ne flashe. gSilentOpen neutralise l'activation
'  cosmetique de MAJ_Dashboard_Graphiques (l.121-123).
' ============================================================
Private Sub RunSilentTask(ByVal taskName As String)
    Dim homeSheet As String
    On Error Resume Next
    homeSheet = ActiveSheet.name
    On Error GoTo 0

    gSilentOpen = True
    Application.ScreenUpdating = False
    On Error Resume Next
    Application.Run taskName
    Application.ScreenUpdating = False               ' re-gele : la tache a pu remettre True (ex. SyncCore)
    If Len(homeSheet) > 0 Then ThisWorkbook.Sheets(homeSheet).Activate
    On Error GoTo 0
    gSilentOpen = False
    Application.ScreenUpdating = True
End Sub

Public Sub OpenTask_Import()
    RunSilentTask "ImporterNouveauxPleinsAuto"
End Sub

Public Sub OpenTask_Rebuild()
    RunSilentTask "SyncFiltersAndRebuildOnOpen"
End Sub

Public Sub OpenTask_Sync()
    RunSilentTask "SyncOnOpen"
End Sub
```

- [ ] **Step 4: Vérifier (COM) la présence des nouveaux symboles**

Via `vba-agent`, relire `modWorkbook` (live) et assert que le texte contient : `Public gSilentOpen As Boolean`, `Private Sub RunSilentTask`, `Public Sub OpenTask_Import`, `Public Sub OpenTask_Rebuild`, `Public Sub OpenTask_Sync`.
Expected: les 5 chaînes présentes.

- [ ] **Step 5: Compiler le VBAProject**

Via `vba-agent`/COM : `Application.Run` d'un compile (ou `VBE` Debug→Compile équivalent). À défaut, vérifier qu'aucune erreur de compilation n'apparaît en exécutant `Application.Run "OpenTask_Import"` plus tard (Task 4). Ne pas exécuter les wrappers maintenant (les routines feraient un import réseau).
Expected: pas d'erreur de compilation (`gSilentOpen` reconnu).

---

## Task 2: modDashboardGraphiques — garde du tail cosmétique (live)

**Files:**
- Modify (live CodeModule): `modDashboardGraphiques` — `MAJ_Dashboard_Graphiques`, l.121-123

- [ ] **Step 1: Lire le live et confirmer l'ancre**

Via `vba-agent`, lire `modDashboardGraphiques` (live). Confirmer le bloc :
```
    Application.ScreenUpdating = True
    ws.Activate
    ws.Range("A1").Select
    Application.StatusBar = "Dashboard « Graphiques » mis à jour."
```
Expected: bloc présent (le « caractère » accentué peut différer ; ancrer au besoin sur `ws.Range("A1").Select` + ligne suivante).

- [ ] **Step 2: Encadrer le tail cosmétique**

Remplacement ancré (live) :
- OLD:
```
    Application.ScreenUpdating = True
    ws.Activate
    ws.Range("A1").Select
    Application.StatusBar = "Dashboard « Graphiques » mis à jour."
```
- NEW:
```
    If Not gSilentOpen Then
        Application.ScreenUpdating = True
        ws.Activate
        ws.Range("A1").Select
    End If
    Application.StatusBar = "Dashboard « Graphiques » mis à jour."
```

- [ ] **Step 3: Vérifier (COM)**

Relire `modDashboardGraphiques` (live), assert présence de `If Not gSilentOpen Then` dans `MAJ_Dashboard_Graphiques`.
Expected: chaîne présente. Si VBA lève « Ambiguous name » ou ne résout pas `gSilentOpen` → qualifier en `modWorkbook.gSilentOpen` dans le NEW et réappliquer.

---

## Task 3: ThisWorkbook — planifier les wrappers (live)

**Files:**
- Modify (live CodeModule): `ThisWorkbook` — `Workbook_Open` (3 lignes `OnTime`)

- [ ] **Step 1: Remplacer le nom de l'import (+2 s)**

Remplacement ancré (live) :
- OLD: `    Application.OnTime now + TimeValue("00:00:02"), "ImporterNouveauxPleinsAuto"`
- NEW: `    Application.OnTime now + TimeValue("00:00:02"), "OpenTask_Import"`

- [ ] **Step 2: Remplacer le nom de la sync (+5 s)**

- OLD: `    Application.OnTime now + TimeValue("00:00:05"), "SyncOnOpen"`
- NEW: `    Application.OnTime now + TimeValue("00:00:05"), "OpenTask_Sync"`

- [ ] **Step 3: Remplacer le nom du rebuild (+3 s)**

- OLD: `    Application.OnTime now + TimeValue("00:00:03"), "SyncFiltersAndRebuildOnOpen"`
- NEW: `    Application.OnTime now + TimeValue("00:00:03"), "OpenTask_Rebuild"`

- [ ] **Step 4: Vérifier (COM)**

Relire `ThisWorkbook` (live), assert présence de `"OpenTask_Import"`, `"OpenTask_Sync"`, `"OpenTask_Rebuild"` et **absence** des 3 anciens noms dans `Workbook_Open`.
Expected: 3 nouveaux noms présents, anciens absents.

---

## Task 4: Sauvegarde, recompilation propre & vérification visuelle

**Files:** (aucun — opérations classeur)

- [ ] **Step 1: Save + close/reopen via COM (purge buffer VBE, #16)**

Via `vba-agent`/COM :
```
wb.Save
path = wb.FullName
wb.Close SaveChanges:=False
Workbooks.Open path
```
Expected: classeur rouvert sans erreur. **C'est aussi le 1er test réel de la nouvelle séquence d'ouverture** (les `OnTime` rejouent).

- [ ] **Step 2: Vérifier (COM) que les wrappers compilent et tournent sans erreur**

Après réouverture, via COM exécuter une fois manuellement le wrapper rebuild (qui ne fait pas d'appel réseau) :
```
Application.Run "OpenTask_Rebuild"
```
Puis lire `ActiveSheet.Name`.
Expected: pas d'erreur ; `ActiveSheet.Name` = la feuille active d'avant l'appel (pas forcée sur « Tableau de bord »). `gSilentOpen` doit valoir `False` après (lire via un Sub diag temporaire si besoin, ou se fier au code error-safe).

- [ ] **Step 3: Vérification VISUELLE par l'utilisateur (bloquant)**

Demander à l'utilisateur de fermer puis rouvrir `excel\Suivi Conso Carburants.xlsm` et de confirmer, point par point :
1. Accueil s'affiche et **reste** ; aucun flash de « Tableau de bord »/log pendant ~5 s.
2. Après ~5 s, aller sur « Tableau de bord » → KPI/graphes **à jour**.
3. Rouvrir et cliquer un autre onglet dans les 5 s → on **n'est pas** ramené sur Accueil.
4. Bouton « Recréer graphiques » → bascule bien sur le dashboard.
Expected: les 4 points OK. Sinon → diagnostic ciblé (ne pas marquer la tâche finie tant que non confirmé — règle reprise « pas de finalisée sans preuve »).

---

## Task 5: Resynchroniser le miroir disque `vba/`

**Files:**
- Modify: `vba/modWorkbook.bas`, `vba/modDashboardGraphiques.bas`, `vba/ThisWorkbook.cls`

- [ ] **Step 1: Ré-exporter les 3 modules live vers le miroir disque**

Via `vba-agent`, exporter `modWorkbook`, `modDashboardGraphiques`, `ThisWorkbook` du live vers `vba/` (UTF-8). Confirmer que les 3 fichiers contiennent les nouveaux symboles (`gSilentOpen`, `OpenTask_*`, `If Not gSilentOpen`, les 3 `OnTime`).

- [ ] **Step 2: Diff de contrôle (cosmétique seulement attendu ailleurs, #40)**

Run (PowerShell) :
```powershell
$p='C:\Users\fdaub\Documents\Github\suivi-conso-carburant'
git -C $p diff --stat -- vba/modWorkbook.bas vba/modDashboardGraphiques.bas vba/ThisWorkbook.cls
```
Expected: seuls ces 3 fichiers VBA modifiés, diffs = les changements voulus (+ éventuel re-casing cosmétique du VBE, sans incidence).

---

## Task 6: Docs, version & commit (sur accord utilisateur)

**Files:**
- Modify: `js/config.js` (`APP_VERSION`), `CHANGELOG.md`, `ROADMAP.md`
- Delete: `{len(wb.sheetnames)}` (parasite 0-octet, #29)

- [ ] **Step 1: Nettoyer le parasite**

Run (PowerShell) :
```powershell
Remove-Item -LiteralPath 'C:\Users\fdaub\Documents\Github\suivi-conso-carburant\{len(wb.sheetnames)}' -Force
```

- [ ] **Step 2: Bumper la version → 5.19.0.0**

Dans `js/config.js`, passer `APP_VERSION` à `5.19.0.0`. Ajouter l'entrée `CHANGELOG.md` :
```
## [5.19.0.0] — 2026-06-17
### Changed
- Ouverture : import/rebuild/sync différés exécutés en arrière-plan (écran gelé) ; la feuille active (« Accueil » par défaut) reste au 1er plan, plus de bascule d'onglets. Respecte la navigation manuelle pendant les MAJ.
```
Et dans `ROADMAP.md`, déplacer l'item « onglets à jour en arrière-plan » vers « ✅ Idées déjà implémentées » : `| v5.19.0.0 | **MAJ d'ouverture en arrière-plan (#6)** — wrappers OpenTask_* + gSilentOpen, Accueil figé au 1er plan |`.

- [ ] **Step 3: Pré-commit graphify — décision**

Le VBA n'est pas dans le graphe (#44) et `/graphify --update` ampute. Pour un changement VBA-only : **sauter** `graphify --update` (ne rien re-committer du graphe), OU si lancé, vérifier le compte de nœuds AVANT/APRÈS et restaurer `git checkout HEAD -- graphify-out/` en cas de chute. Choix par défaut : sauter.

- [ ] **Step 4: Commit manuel (gate husky), SANS push (#36)**

Staging sélectif (éviter `git add -A` qui embarquerait tout l'arbre) :
```powershell
$p='C:\Users\fdaub\Documents\Github\suivi-conso-carburant'
git -C $p add vba/modWorkbook.bas vba/modDashboardGraphiques.bas vba/ThisWorkbook.cls js/config.js CHANGELOG.md ROADMAP.md `
  docs/superpowers/specs/2026-06-17-onglets-arriere-plan-design.md `
  docs/superpowers/plans/2026-06-17-onglets-arriere-plan.md tasks/lessons.md
git -C $p add "excel/Suivi Conso Carburants.xlsm"   # classeur avec le VBA #6 deploye
git -C $p commit -m "feat(excel): MAJ d'ouverture en arriere-plan, Accueil fige au 1er plan [v5.19.0.0]"
```
Expected: hook husky (eslint + vitest related sur `js/`) **passe** ; commit créé. **STOP avant `git push`** — présenter le commit à l'utilisateur pour accord explicite avant de pousser (`git push origin main`).

- [ ] **Step 5: Mettre à jour le mini-export de reprise**

Marquer #6 ✅ dans `tasks/reprise-2026-06-17-essence.md` (preuve = commit + confirmation visuelle), #4 abandonné.

---

## Notes de risque
- Si après réouverture les KPI ne sont PAS à jour alors qu'aucun flash : vérifier que `OpenTask_Rebuild` appelle bien `SyncFiltersAndRebuildOnOpen` (faute de frappe du nom passé à `Application.Run` = no-op silencieux car `On Error Resume Next`).
- Si `gSilentOpen` reste `True` (bug de cycle de vie) : le bouton manuel « Recréer graphiques » n'activerait plus le dashboard → signal de régression. Le code error-safe (`On Error Resume Next` + remise `False`) doit l'empêcher ; vérifier au Step 4.2.
- `Application.Run` sur un nom inexistant échoue silencieusement (On Error) → la vérif COM des noms (Task 1 Step 4) est la garde.
