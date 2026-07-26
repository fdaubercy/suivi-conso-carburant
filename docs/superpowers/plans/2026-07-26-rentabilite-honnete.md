# Rentabilité honnête du kit E85 — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rendre la date de rentabilité du kit E85 fiable et paramétrable (Excel + app web) : coût total de conversion, carburant de référence, projection médiane, garde-fou surconso, + fix export PNG du nuage.

**Architecture:** Paramètres additifs synchronisés via le mécanisme P1 existant (onglet GS « Parametres » ↔ cellules « Suivi Carburant » nommées ↔ miroir « Notes » ↔ `localStorage` web). Le calcul reste en **formules Excel** (pas de logique VBA nouvelle sur le calcul) ; le VBA ne fait que poser cellules/Names et la sync. Parité côté web dans `js/stats.js`/`rentabilite.js`. X66 = correctif COM isolé.

**Tech Stack:** Excel 365 (formules `Formula2`, defined Names, COM via `vba-agent`), VBA (`modSyncParametres`), JS ES modules + Vitest, ESLint, GAS (générique, inchangé).

## Global Constraints

- **Aucune perte de données de pleins** (Excel `Tableau2`/`GS_Pleins`, GS onglet réponses, cache web). Modifications strictement additives ; jamais de `Cells.Clear`/`ListRows.Delete`/`deleteDimension` ; vérifier cellule vide avant écriture ; backup formules avant chirurgie.
- **Fichiers < 500 lignes** (CLAUDE.md).
- **VBA** : stripper `Attribute VB_Name` avant `set-module` ; feuille « Suivi Carburant » protégée → `DeverrouillerSuivi`/`VerrouillerSuivi` autour des écritures ; formules array/structured refs via `Range.Formula2` ; vérifier la valeur après écriture (formule cassée = "" silencieux).
- **JS** : `new window.CustomEvent(...)` (jamais nu) ; lint `--max-warnings=0` ; tout param a un défaut, 0 € accepté et valide.
- **Réf. carburant** : `ecart_ref` défaut 0 → comportement inchangé tant que non paramétré.
- **Versionnage** : un item = un bump `X.Y.Z.W` (source `js/config.js` `APP_VERSION`), un commit par item, sur la branche `feat/rentabilite-honnete` (pas de push auto).

---

## Découpage des fichiers

| Fichier | Responsabilité | Action |
|---|---|---|
| `excel/Suivi Conso Carburants.xlsm` (live COM) | cellules params + Names + formules J8/J11/J12/J13/B12 + colonne équiv | Modifier via COM |
| `vba/modSyncParametres.bas` | map des params (Excel↔GS↔Notes) | Modifier |
| `js/config.js` | clés localStorage + défauts des params | Modifier |
| `js/parametres.js` | liste `PARAMS` (sync GS) + map clés | Modifier |
| `js/stats.js` | `getCoutTotalConversion`, économie (écart réf), surconso clamp | Modifier |
| `js/rentabilite.js` | seuil dynamique `1/(1+surconso)` | Modifier |
| `index.html` | champs Réglages (nouveaux params) | Modifier |
| `tests/*.test.js` | couverture calculs | Modifier/Ajouter |
| `vba/modGraphRender.bas` / `modGraphiques.bas` | fix export PNG gKitProj (X66) | Modifier |
| `CHANGELOG.md` / `README.md` / `ROADMAP.md` | doc + Top5 | Modifier |

**Defined Names workbook** (portée classeur, sur « Suivi Carburant ») créés en Task 1, utilisés par les formules : `COUT_BOITIER`(=B6), `COUT_POSE`, `COUT_CARTEGRISE`, `COUT_ENTRETIEN`, `SURCOUT_ASSURANCE`, `AIDE_DEDUITE`, `COUT_TOTAL`, `CARBURANT_REF`, `ECART_REF`, `PROJ_NB_RECENTS`.

---

## Task 1 : Excel — cellules de paramètres de coût + Names + COUT_TOTAL (X68 structure)

**Files:**
- Modify: `excel/Suivi Conso Carburants.xlsm` (live, COM)
- Test: lecture COM (read-back)

**Interfaces:**
- Produces: defined Names `COUT_BOITIER, COUT_POSE, COUT_CARTEGRISE, COUT_ENTRETIEN, SURCOUT_ASSURANCE, AIDE_DEDUITE, COUT_TOTAL, CARBURANT_REF, ECART_REF, PROJ_NB_RECENTS` sur « Suivi Carburant ».

- [ ] **Step 1 : Backup formules + inspection cellules libres**

Script COM (scratchpad) : dumper toutes les `cell.Formula` non vides de « Suivi Carburant » vers `scratchpad/backup_suivi_formules_YYYYMMDD.json` ; lister l'`UsedRange` et repérer un bloc de cellules **vides** contiguës sous le bloc PARAMÈTRES (ex. colonnes A/B lignes 15-24) pour poser labels (col A) + valeurs (col B). Confirmer vide avant d'écrire.

- [ ] **Step 2 : Déverrouiller la feuille**

`run --macro DeverrouillerSuivi` (ou `ws.Unprotect("")` COM) ; vérifier `ProtectContents=False`.

- [ ] **Step 3 : Écrire labels + valeurs par défaut (cellules vides uniquement)**

Bloc « COÛT DE CONVERSION » (adresses définitives = cellules vides repérées Step 1, ex. A15:B21) :
```
A15 "COÛT DE CONVERSION"          (titre)
A16 "Coût du boîtier (kit) (€)"   B16 -> = B6 (miroir) ou déplacer ; garder B6 comme source COUT_BOITIER
A17 "Pose / main-d'œuvre (€)"      B17 = 0
A18 "Modification carte grise (€)" B18 = 0
A19 "Entretiens supplémentaires (€)" B19 = 0
A20 "Surcoût d'assurance (€)"      B20 = 0
A21 "Aide / subvention déduite (€)" B21 = 0
A22 "Coût total de conversion (€)" B22 = formule COUT_TOTAL
```
Relabel `A6` → « Coût du boîtier (kit) (€) » (valeur B6 = 514,54 conservée). Écrire les valeurs 0 seulement si la cellule est vide.

- [ ] **Step 4 : Créer les defined Names (portée classeur)**

COM : `wb.Names.Add "COUT_BOITIER", "='Suivi Carburant'!$B$6"` ; idem `COUT_POSE`→$B$17, `COUT_CARTEGRISE`→$B$18, `COUT_ENTRETIEN`→$B$19, `SURCOUT_ASSURANCE`→$B$20, `AIDE_DEDUITE`→$B$21, `COUT_TOTAL`→$B$22, plus (Task 5/6) `CARBURANT_REF`, `ECART_REF`, `PROJ_NB_RECENTS` (cellules à poser ici aussi, ex. B23/B24/B25 + labels A23/A24/A25 : « Carburant de référence », « Écart réf. vs SP98 (€/L) », « Nb pleins récents (projection) », valeurs "SP98", 0, 6).

- [ ] **Step 5 : Écrire la formule COUT_TOTAL (B22)**

`B22.Formula = "=MAX(0,COUT_BOITIER+COUT_POSE+COUT_CARTEGRISE+COUT_ENTRETIEN+SURCOUT_ASSURANCE-AIDE_DEDUITE)"`

- [ ] **Step 6 : Re-protéger + save + vérifier**

`VerrouillerSuivi` (ou `ws.Protect DrawingObjects:=True`) ; `save`. Read-back COM : `COUT_TOTAL` = 514,54 (tous postes 0) ; nb lignes `Tableau2` inchangé vs avant.

- [ ] **Step 7 : Commit**

```bash
git add vba/ CHANGELOG.md
git commit -m "feat(excel): bloc COÛT DE CONVERSION + Names paramétrables (X68) [vX.Y.Z.W]"
```
(Le `.xlsm` n'est pas re-committé si `assume-unchanged` — leçon #43 ; les formules restent dans le classeur live. Documenter la structure dans le CHANGELOG.)

---

## Task 2 : Excel — synchronisation des nouveaux paramètres (Excel ↔ GS ↔ Notes)

**Files:**
- Modify: `vba/modSyncParametres.bas` (fonction de mapping `BuildMap`/`Mk`)
- Test: `run --macro SyncParametresManuel` + read-back GS via API

**Interfaces:**
- Consumes: Names/cellules de Task 1.
- Produces: params `cout_pose, cout_carte_grise, cout_entretien, surcout_assurance, aide_deduite, carburant_ref, ecart_ref, proj_nb_recents` round-trippés.

- [ ] **Step 1 : Lire le mapping actuel**

`inspect --component` de `modSyncParametres` ; localiser le tableau `d(0..3)` (`Mk("kit_prix",WS_CARB,"B6",False)` …).

- [ ] **Step 2 : Étendre le mapping**

Ajouter les entrées (writable, cellule sur WS_CARB = « Suivi Carburant ») :
```vba
d(4) = Mk("cout_pose", WS_CARB, "B17", False)
d(5) = Mk("cout_carte_grise", WS_CARB, "B18", False)
d(6) = Mk("cout_entretien", WS_CARB, "B19", False)
d(7) = Mk("surcout_assurance", WS_CARB, "B20", False)
d(8) = Mk("aide_deduite", WS_CARB, "B21", False)
d(9) = Mk("carburant_ref", WS_CARB, "B23", False)
d(10) = Mk("ecart_ref", WS_CARB, "B24", False)
d(11) = Mk("proj_nb_recents", WS_CARB, "B25", False)
```
Redimensionner le `ReDim d(0 To 11)`. Adapter aux adresses réelles retenues en Task 1.

- [ ] **Step 3 : Déployer (strip Attribute) + compile**

`set-module` depuis le .bas (retirer `Attribute VB_Name`) ; `run` d'une macro pour prouver la compilation.

- [ ] **Step 4 : Test round-trip réel**

`run --macro SyncParametresManuel` ; via Sheets API lire l'onglet « Parametres » → les 8 clés présentes. Modifier `ecart_ref=0.15` côté GS puis `SyncParametres` → B24 = 0,15 en Excel. Remettre 0.

- [ ] **Step 5 : Commit**

```bash
git add vba/modSyncParametres.bas CHANGELOG.md
git commit -m "feat(excel): sync des paramètres de coût/référence (X68) [vX.Y.Z.W]"
```

---

## Task 3 : Excel — carburant de référence (écart) sur la colonne équiv (X67)

**Files:**
- Modify: `excel/Suivi Conso Carburants.xlsm` (colonne `Tableau2[Coût Plein équiv. S98 (€)]`)

**Interfaces:**
- Consumes: Name `ECART_REF`.

- [ ] **Step 1 : Déverrouiller + backup de la formule de colonne**

Sauver la formule actuelle de la colonne 12 (`Coût Plein équiv. S98`).

- [ ] **Step 2 : Réécrire la formule de colonne (Formula2, structured refs)**

```
=IF(OR([@Type]<>"SuperEthanol E85",[@[Nb. Litres]]="",[@[Prix S98 jour (€/L)]]=""),"",
   [@[Nb. Litres]]/(1+$J$8)*MAX(0,[@[Prix S98 jour (€/L)]]-ECART_REF))
```
Appliquer à toute la colonne (`lo.ListColumns(12).DataBodyRange.Formula2 = ...`).

- [ ] **Step 3 : Vérifier + re-protéger + save**

Read-back : avec `ECART_REF=0`, B11 inchangé (278,25 €) ; avec `ECART_REF=0.15`, B11 baisse. Remettre 0. Nb lignes `Tableau2` inchangé.

- [ ] **Step 4 : Commit**

```bash
git add CHANGELOG.md
git commit -m "feat(excel): carburant de référence via écart €/L configurable (X67) [vX.Y.Z.W]"
```

---

## Task 4 : Excel — reste à amortir & progression sur COUT_TOTAL (X68 câblage)

**Files:**
- Modify: `excel/Suivi Conso Carburants.xlsm` (B12, J13)

- [ ] **Step 1 : Déverrouiller + backup B12/J13**

- [ ] **Step 2 : Réécrire B12 et J13**

```
B12 = =MAX(0,COUT_TOTAL-B11)
J13 = =IFERROR(IF(COUT_TOTAL<=0,1,MIN(B11/COUT_TOTAL,1)),0)
```

- [ ] **Step 3 : Vérifier + re-protéger + save**

Postes à 0 → COUT_TOTAL=514,54 → B12=236,29, J13=0,54 (identiques à aujourd'hui). Ajouter pose=100 → B12=336,29, J13 baisse.

- [ ] **Step 4 : Commit**

```bash
git add CHANGELOG.md
git commit -m "feat(excel): reste à amortir & progression sur coût total de conversion (X68) [vX.Y.Z.W]"
```

---

## Task 5 : Excel — projection médiane + marge « ± N j » (X69)

**Files:**
- Modify: `excel/Suivi Conso Carburants.xlsm` (J11, J12, + cellules dérivées `date_min`/`date_max`/`marge`)

**Interfaces:**
- Consumes: Name `PROJ_NB_RECENTS`, colonne `Tableau2[Économie cumulée (€)]`, `[Km compteur]`.

- [ ] **Step 1 : Poser les cellules auxiliaires (zone technique libre, ex. L-colonne ou N/O)**

Cellules nommées : `TAUX_MOYEN` (=B13), `TAUX_RECENT`, `KM_ACTUEL`, `RYTHME_KMJ`, `DATE_A`, `DATE_B`. Repérer cellules vides.

- [ ] **Step 2 : Formule TAUX_RECENT**

Taux €/km sur les N derniers pleins E85 du véhicule sélectionné :
```
TAUX_RECENT =
 IFERROR( ( derniere("Économie cumulée",E85,véh) - Nème_avant("Économie cumulée") )
        / ( derniere("Km compteur") - Nème_avant("Km compteur") ), TAUX_MOYEN)
```
Implémentation concrète via `LARGE`/`INDEX`/`MATCH` sur le sous-ensemble E85 (idiome `IF($B$3="(tous)","*",$B$3)`), N = `PROJ_NB_RECENTS` (0 ⇒ TAUX_MOYEN). Écrire via `Formula2`. (Détail des sous-formules à finaliser sur le classeur live ; borner : si < N+1 pleins E85 → TAUX_MOYEN.)

- [ ] **Step 3 : DATE_A / DATE_B / J11 / marge**

```
KM_ACTUEL  = MAXIFS(Tableau2[Km compteur],Tableau2[Véhicule],IF($B$3="(tous)","*",$B$3))
RYTHME_KMJ = (MAXIFS(Km)-MINIFS(Km)) / (MAXIFS(Date)-MINIFS(Date))   (même idiome véhicule)
DATE_A = dernierPlein + (B12/TAUX_MOYEN)/RYTHME_KMJ
DATE_B = dernierPlein + (B12/TAUX_RECENT)/RYTHME_KMJ
J11 = IFERROR(IF(B12=0, dernierPlein, MIN(DATE_A,DATE_B) + (MAX(DATE_A,DATE_B)-MIN(DATE_A,DATE_B))/2), "En attente de plus de pleins")
J12 = IFERROR(IF(B12=0, KM_ACTUEL, KM_ACTUEL + (B12/TAUX_MOYEN + B12/TAUX_RECENT)/2), "En attente d'un plein E85")
marge (cellule K11 ou adjacente) = "± " & ROUND((MAX(DATE_A,DATE_B)-MIN(DATE_A,DATE_B))/2,0) & " j"
```
Conserver la formule J11 actuelle en backup ; format date de J11 inchangé.

- [ ] **Step 4 : Vérifier + re-protéger + save**

Read-back : J11 date plausible entre DATE_A et DATE_B ; marge cohérente (≥ 0). Cas B12=0 → date = dernier plein, marge 0.

- [ ] **Step 5 : (option) badge dashboard**

Si le badge « amorti X% » (`modDashboardGraphiques.AddKpiCardKit`) doit afficher la date ± marge : lire J11 + marge et l'ajouter au libellé. Sinon, laisser (hors périmètre strict).

- [ ] **Step 6 : Commit**

```bash
git add CHANGELOG.md
git commit -m "feat(excel): date de rentabilité médiane + marge ± j (X69) [vX.Y.Z.W]"
```

---

## Task 6 : Excel — garde-fou surconso J8 (X70)

**Files:**
- Modify: `excel/Suivi Conso Carburants.xlsm` (J8 + cellule d'avertissement)

- [ ] **Step 1 : Déverrouiller + backup J8**

- [ ] **Step 2 : Réécrire J8 avec clamp + comptage**

```
nRef = COUNTIFS(Tableau2[Type],"SuperEthanol E85"...) -> pour E85 ; réf = COUNTIFS(Type="Super 98",Véhicule=sel)
J8 = IF(OR(B7="",B7=0,COUNTIFS(...E85...)=0), 0.2,
        MEDIAN(0.15, AVERAGEIFS(E85 conso)/B7-1, 0.40))   ' clamp [0.15,0.40]
```
Cellule d'avertissement (ex. K8) : `=IF(COUNTIFS(Tableau2[Type],"Super 98",Tableau2[Véhicule],IF($B$3="(tous)","*",$B$3))<4,"⚠ surconso peu fiable (n<4 pleins SP98)","")`.

- [ ] **Step 3 : Vérifier + re-protéger + save**

Read-back : J8 dans [0,15;0,40] ; avec 3 pleins SP98 actuels → avertissement affiché. B11 recalculé cohérent.

- [ ] **Step 4 : Commit**

```bash
git add CHANGELOG.md
git commit -m "feat(excel): garde-fou fiabilité surconso J8 (X70) [vX.Y.Z.W]"
```

---

## Task 7 : Web — clés config + liste PARAMS (X67/X68 sync web)

**Files:**
- Modify: `js/config.js`, `js/parametres.js`
- Test: `tests/parametres.test.js` (si présent) ou nouveau

- [ ] **Step 1 : Ajouter les clés + défauts (config.js)**

```js
export const COUT_POSE_KEY        = 'suivi_e85_cout_pose';
export const COUT_CARTEGRISE_KEY  = 'suivi_e85_cout_carte_grise';
export const COUT_ENTRETIEN_KEY   = 'suivi_e85_cout_entretien';
export const SURCOUT_ASSURANCE_KEY= 'suivi_e85_surcout_assurance';
export const AIDE_DEDUITE_KEY     = 'suivi_e85_aide_deduite';
export const ECART_REF_KEY        = 'suivi_e85_ecart_ref';
export const CARBURANT_REF_KEY    = 'suivi_e85_carburant_ref';
export const PROJ_NB_RECENTS_KEY  = 'suivi_e85_proj_nb_recents';
export const DEFAULT_ECART_REF = 0;
export const DEFAULT_PROJ_NB_RECENTS = 6;
```

- [ ] **Step 2 : Étendre PARAMS (parametres.js)**

Ajouter chaque param `{ cle, local, kind }` (`kind:'num'` sauf `carburant_ref` `kind:'str'`) + la map clé Sheet→local.

- [ ] **Step 3 : Lint + commit**

```bash
npx eslint js/config.js js/parametres.js
git add js/config.js js/parametres.js CHANGELOG.md
git commit -m "feat(web): clés + sync des paramètres de rentabilité (X67/X68) [vX.Y.Z.W]"
```

---

## Task 8 : Web — coût total + économie (écart réf) + surconso clamp (stats.js)

**Files:**
- Modify: `js/stats.js`
- Test: `tests/stats.test.js`

- [ ] **Step 1 : Test échouant — coût total**

```js
import { getCoutTotalConversion } from '../js/stats.js';
test('coût total = somme postes − aide, 0 par défaut sauf boîtier', () => {
  localStorage.clear();
  localStorage.setItem('suivi_e85_kit_prix','500');
  localStorage.setItem('suivi_e85_cout_pose','100');
  localStorage.setItem('suivi_e85_aide_deduite','50');
  expect(getCoutTotalConversion()).toBe(550);
});
```

- [ ] **Step 2 : Run → FAIL** `npx vitest run tests/stats.test.js -t "coût total"`

- [ ] **Step 3 : Implémenter `getCoutTotalConversion`**

Somme `getKitPrix()` + pose + carte grise + entretien + assurance − aide (chaque poste : `Number(localStorage)||0`, borné ≥ 0 global).

- [ ] **Step 4 : Run → PASS.**

- [ ] **Step 5 : Câbler économie nette + écart réf + clamp surconso**

`econNette = econBrute − getCoutTotalConversion()` ; dans le calcul `econBrute`, prix SP98 par plein → `Math.max(0, sp98 − getEcartRef())` ; `computeSurconso`/`getSurconsoFallback` → clamp `[0.15,0.40]` + exiger ≥ 1 (idéalement ≥ 4) plein SP98. Adapter l'affichage (le sous-texte « − kit » devient « − conversion »).

- [ ] **Step 6 : Tests économie/surconso + run all** `npx vitest run tests/stats.test.js`

- [ ] **Step 7 : Lint + commit**

```bash
npx eslint js/stats.js
git add js/stats.js tests/stats.test.js CHANGELOG.md
git commit -m "feat(web): coût total conversion + écart réf + clamp surconso (X67/X68/X70) [vX.Y.Z.W]"
```

---

## Task 9 : Web — seuil dynamique bannière temps réel (rentabilite.js)

**Files:**
- Modify: `js/rentabilite.js`
- Test: `tests/rentabilite.test.js` (nouveau)

- [ ] **Step 1 : Test échouant**

```js
// seuil rentable = 1/(1+surconso) ; surconso 0.25 -> 0.8
test('seuil dynamique selon surconso', () => {
  expect(seuilRentable(0.25)).toBeCloseTo(0.8, 3);
});
```

- [ ] **Step 2 : Run → FAIL.**

- [ ] **Step 3 : Extraire `seuilRentable(surconso)=1/(1+surconso)`** et l'utiliser dans `updateRentabilite` (remplace `SEUIL_RENTABLE=0.66` figé ; `SEUIL_BREAKEVEN = seuil + 0.04`). Récupérer la surconso courante (même source que stats).

- [ ] **Step 4 : Run → PASS + lint + commit**

```bash
npx eslint js/rentabilite.js
git add js/rentabilite.js tests/rentabilite.test.js CHANGELOG.md
git commit -m "feat(web): seuil de rentabilité temps réel dynamique selon surconso (X67) [vX.Y.Z.W]"
```

---

## Task 10 : Web — champs Réglages pour les nouveaux paramètres

**Files:**
- Modify: `index.html` (carte Réglages), `js/stats.js` (init des champs, sur le modèle `initKitSetting`)

- [ ] **Step 1 : Ajouter les champs HTML** (inputs `number` pour les coûts/écart/N, `select` pour `carburant_ref`) dans la carte Réglages, avec `aria-label` (a11y, gate W81).

- [ ] **Step 2 : Câbler init + persist + pushParam** sur le modèle `initKitSetting` (une fonction `initRentabiliteSettings` ; `change` → localStorage → `pushParam(cle)` → `renderStats()`).

- [ ] **Step 3 : Vérif navigateur** (preview) : saisir pose=100 → économie nette baisse de 100 ; select carburant_ref ; pas d'erreur console ; a11y (0 violation grave).

- [ ] **Step 4 : Lint + tests + commit**

```bash
npx eslint js/stats.js
npx vitest run
git add index.html js/stats.js CHANGELOG.md
git commit -m "feat(web): paramétrage rentabilité dans Réglages (X67/X68/X69/X70) [vX.Y.Z.W]"
```

---

## Task 11 : Excel — fix export PNG de gKitProj (X66)

**Files:**
- Modify: `vba/modGraphRender.bas` et/ou `vba/modGraphiques.bas` (chemin d'export)

- [ ] **Step 1 : Reproduire l'échec** via COM : localiser l'export (`ExporterGraphiquesPDF` / `Chart.Export`), exporter `gKitProj` seul → confirmer 0 o.

- [ ] **Step 2 : Tester les correctifs (ordre)** : (a) déprotéger `DrawingObjects` avant export ; (b) `Application.CalculateFull`+`DoEvents` avant `Export` ; (c) export via feuille-graphe temporaire (`Location xlLocationAsNewSheet`) puis suppression ; (d) activer/sélectionner. Retenir le premier qui produit un PNG > 0 o.

- [ ] **Step 3 : Appliquer le correctif minimal** dans le module, déployer (strip Attribute), `run` de l'export complet.

- [ ] **Step 4 : Vérifier** : `gKitProj.png` > 0 o ; `ExporterGraphiquesPDF` contient le nuage. Lint VBA (`check_vba_compile.py`) 0 violation.

- [ ] **Step 5 : Commit**

```bash
git add vba/ CHANGELOG.md
git commit -m "fix(excel): export PNG du nuage gKitProj (0 octet) (X66) [vX.Y.Z.W]"
```

---

## Task 12 : Docs + reconstruction Top 5 + vérification globale

**Files:**
- Modify: `CHANGELOG.md`, `README.md` (si usage/paramètres changent), `ROADMAP.md`

- [ ] **Step 1 : Déplacer X67/X68/X69/X70/X66** de « à faire » vers « ✅ Idées déjà implémentées » (une ligne par version livrée).

- [ ] **Step 2 : Reconstruire le Top 5** avec les items restants priorisés (C9, X65, X62, C11, X63, W83/W84… selon bénéfice/effort). Documenter la révision (date, raison).

- [ ] **Step 3 : Vérification données** : nb lignes `Tableau2`/`GS_Pleins` identiques à l'état initial ; B6=514,54 ; économie/date cohérentes app↔Excel.

- [ ] **Step 4 : Tests complets** : `npx vitest run` (lire « Tests X passed » — leçon #54) ; `npm run lint`.

- [ ] **Step 5 : Commit**

```bash
git add CHANGELOG.md README.md ROADMAP.md
git commit -m "docs(rentabilite): clôture X66-X70, Top5 reconstruit [vX.Y.Z.W]"
```

---

## Self-review (couverture spec)

- X67 → Tasks 3, 7, 8, 9. X68 → Tasks 1, 2, 4, 7, 8, 10. X69 → Task 5. X70 → Tasks 6, 8. X66 → Task 11. Sync GS↔Excel↔web → Tasks 2, 7. Sécurité données → contrainte globale + steps de vérification (1,3,4,6,12). Top5 → Task 12.
- Ordre du plus sûr au plus risqué : structure & sync (1-2) → rewires formules (3-4) → projection (5) → surconso (6) → web (7-10) → X66 (11) → docs (12).
- Chaque item Excel = formules (pas de logique VBA de calcul) → risque COM limité à la pose de cellules/Names + sync.
