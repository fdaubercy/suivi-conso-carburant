# Design — MAJ d'ouverture en arrière-plan, « Accueil » figé au 1er plan

- **Date** : 2026-06-17
- **Demande d'origine** (export e85, L882) : « Au lancement du fichier Excel, le script ouvre tous les onglets pour les mettre à jour. Est-ce possible de mettre les onglets à jour en arrière-plan à l'ouverture en gardant l'onglet "Accueil" au 1er plan ? »
- **Statut** : design validé (approche A + « respecter mon clic »), spec en revue
- **Version cible** : `v5.18.0.0` → `v5.19.0.0` (MINOR — comportement utilisateur visible)
- **Périmètre** : classeur `excel/Suivi Conso Carburants.xlsm`, modules VBA. Aucune incidence sur la PWA/GAS.

## 1. Problème (preuves)

À l'ouverture, `ThisWorkbook.Workbook_Open` :
1. Partie **synchrone** : plein écran → `ForceFormatDates` → protection « Suivi Carburant » → `AfficherVueDeDepart` (termine sur **Accueil** via `GoSheet WS_ACCUEIL`) → `modSidebar.ShowSidebar`.
2. Partie **différée** (`Application.OnTime`) :
   - `+2 s` → `ImporterNouveauxPleinsAuto`
   - `+3 s` → `SyncFiltersAndRebuildOnOpen` → `RecreerDashboardComplet` → `CreerGraphiquesWeb` + `MAJ_Dashboard_Graphiques`
   - `+5 s` → `SyncOnOpen`

Le voleur de focus principal est `MAJ_Dashboard_Graphiques` (`modDashboardGraphiques.bas`) :
- l.121-123 (tail cosmétique) : `Application.ScreenUpdating = True : ws.Activate : ws.Range("A1").Select` → « Tableau de bord » passe au 1er plan **et y reste** (Accueil n'est jamais réactivé).
- l.154 (`PrepareSheet`) : `ws.Activate` **porteur** — requis car `ActiveWindow.DisplayGridlines/DisplayHeadings/Zoom` s'appliquent à la feuille active. À conserver (devient invisible si l'écran est gelé).

Résultat visible : Accueil s'affiche, puis ~3 s plus tard l'affichage bascule sur « Tableau de bord » (et d'éventuels flashs d'autres feuilles selon import/sync).

## 2. Objectif & critères de succès

- **Zéro clignotement** : pendant les ~5 s de MAJ différées, aucune feuille de fond ne s'affiche ; l'écran reste sur la feuille que l'utilisateur regarde.
- **Respecter la navigation manuelle** : si l'utilisateur ne touche à rien, Accueil reste au 1er plan ; s'il clique volontairement sur un autre onglet pendant les MAJ, il **n'est pas** ramené de force sur Accueil — il reste sur la feuille qu'il a choisie.
- Les MAJ (import, rebuild, sync) **s'exécutent bien** (données/KPI/graphes à jour), seul leur effet visuel de focus est supprimé.

## 3. Non-objectifs

- Ne pas traiter #4 (lien externe) — abandonné par l'utilisateur.
- Ne pas refondre l'intérieur des routines de rebuild (au-delà du garde cosmétique).
- Ne pas changer les délais d'ouverture (2/3/5 s conservés) ni l'architecture `OnTime`.

## 4. Conception (approche A)

### 4.1 Drapeau d'ouverture silencieuse
`Public gSilentOpen As Boolean` déclaré dans la section de déclarations de `modWorkbook.bas` (standard module → accessible depuis `modDashboardGraphiques`). `True` **uniquement** pendant l'exécution d'un wrapper.

### 4.2 Wrappers + capture/restauration de la feuille active
Au lieu de réactiver Accueil en dur, chaque wrapper **mémorise la feuille active au début** et la **restaure à la fin** → implémente « respecter mon clic » sans liste de feuilles codée en dur (l'utilisateur ne peut pas cliquer *pendant* l'exécution synchrone d'un wrapper ; ses clics n'ont lieu que dans les intervalles idle entre wrappers, donc la feuille capturée au début reflète son choix).

Dans `modWorkbook.bas` :
```vb
Private Sub RunSilentTask(ByVal taskName As String)
    Dim homeSheet As String
    On Error Resume Next
    homeSheet = ActiveSheet.name        ' Accueil si l'utilisateur n'a pas navigué, sinon SA feuille
    On Error GoTo 0

    gSilentOpen = True
    Application.ScreenUpdating = False
    On Error Resume Next
    Application.Run taskName              ' import / rebuild / sync (sans args -> pas de souci ByRef, leçon #33)
    Application.ScreenUpdating = False     ' re-gèle : une tâche a pu remettre True en interne (ex. SyncCore)
    If Len(homeSheet) > 0 Then ThisWorkbook.Sheets(homeSheet).Activate
    On Error GoTo 0
    gSilentOpen = False                   ' jamais laissé True (même sur erreur via On Error Resume Next)
    Application.ScreenUpdating = True      ' 1 seul repaint, sur la feuille restaurée
End Sub

Public Sub OpenTask_Import():  RunSilentTask "ImporterNouveauxPleinsAuto":  End Sub
Public Sub OpenTask_Rebuild(): RunSilentTask "SyncFiltersAndRebuildOnOpen": End Sub
Public Sub OpenTask_Sync():    RunSilentTask "SyncOnOpen":                   End Sub
```

### 4.3 Garde du tail cosmétique de `MAJ_Dashboard_Graphiques` (l.121-123)
```vb
    If Not gSilentOpen Then
        Application.ScreenUpdating = True
        ws.Activate
        ws.Range("A1").Select
    End If
```
En ouverture silencieuse : pas de repaint ni d'activation cosmétique. `PrepareSheet` (l.154) active toujours `ws` (porteur, pour gridlines/zoom) mais l'écran est gelé → invisible ; le wrapper restaure ensuite la feuille mémorisée.

### 4.4 Replanification dans `ThisWorkbook.Workbook_Open`
- l.30 : `"ImporterNouveauxPleinsAuto"` → `"OpenTask_Import"`
- l.41 : `"SyncOnOpen"` → `"OpenTask_Sync"`
- l.63 : `"SyncFiltersAndRebuildOnOpen"` → `"OpenTask_Rebuild"`

La partie synchrone (qui termine déjà sur Accueil) est inchangée.

## 5. Analyse anti-flash (chaîne complète)
- `CreerGraphiquesWeb` (modGraphiques) bascule `ScreenUpdating` en interne mais **n'active aucune feuille** (vérifié : pas de `.Activate` dans modGraphiques) → ses repaints montrent la feuille mémorisée (pas de flash).
- `MAJ_Dashboard_Graphiques` : `PrepareSheet` active le dashboard sous écran gelé ; tail cosmétique neutralisé par `gSilentOpen`.
- Wrapper : repaint final unique sur la feuille restaurée.
- Bilan : « Tableau de bord » n'est jamais affiché visuellement pendant l'ouverture.

## 6. Cas limites
- **Bouton manuel** `btnRecreerGraph` → `RecreerDashboardComplet` → `MAJ` avec `gSilentOpen=False` → activation cosmétique conservée (l'utilisateur veut voir le dashboard). ✅
- **Navigation utilisateur** pendant les 5 s : capturée au début du wrapper suivant → restaurée (pas de retour forcé sur Accueil). ✅
- **Erreur** dans une tâche : `On Error Resume Next` garantit `gSilentOpen=False` + `ScreenUpdating=True` en sortie. ✅
- **Sérialisation** : les `OnTime` sont mis en file et exécutés à l'idle → pas de recouvrement de wrappers, drapeau jamais chevauché. ✅
- **`AfficherVueDeDepart` mode "saisie"/"last"** : termine sur Accueil (ou reprise) ; capture/restore s'adapte (mémorise la feuille réellement active). ✅

## 7. Déploiement & vérification
- **Pré-requis** : Excel ouvert sur le classeur (PID actif). Déploiement COM via skill `vba-agent` (set-module dans le CodeModule live), depuis les `.bas` UTF-8 en retirant la ligne `Attribute VB_Name` (leçon #15), **sans temp CP1252**.
- **Backups avant** : `vba-backup-20260617-onglets/` (export des composants) + copie `.xlsm`.
- **Après déploiement** : `wb.Save` puis **fermer/rouvrir** le classeur via COM (purge buffer VBE, leçon #16) pour tester la vraie séquence d'ouverture.
- **Vérification visuelle (par l'utilisateur, non COM — leçons #26/#32)** :
  1. À l'ouverture : Accueil s'affiche et **reste** ; aucun flash de « Tableau de bord »/log pendant ~5 s.
  2. Après ~5 s, aller manuellement sur « Tableau de bord » → KPI/graphes **à jour** (rebuild bien exécuté en fond).
  3. Rouvrir et cliquer un autre onglet dans les 5 s → on **n'est pas** ramené sur Accueil.
  4. Bouton « Recréer graphiques » → bascule bien sur le dashboard (comportement manuel intact).

## 8. Fichiers modifiés
- `vba/ThisWorkbook.cls` (3 noms d'`OnTime`)
- `vba/modWorkbook.bas` (déclaration `gSilentOpen` + `RunSilentTask` + 3 wrappers)
- `vba/modDashboardGraphiques.bas` (garde l.121-123)
- Miroir disque `vba/*.bas` resynchronisé après déploiement live.
- Docs : `CHANGELOG.md`, `ROADMAP.md` (retirer l'item « onglets arrière-plan » des « à faire » → « implémentées »), `js/config.js` (`APP_VERSION = 5.19.0.0`).

## 9. Rollback
Restaurer les 3 modules depuis `vba-backup-20260617-onglets/` (set-module) ou la copie `.xlsm`. Changements isolés et idempotents.
