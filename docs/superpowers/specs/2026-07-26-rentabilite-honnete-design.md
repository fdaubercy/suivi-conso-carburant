# Design — Rentabilité honnête du kit E85 (X67 / X68 / X69 / X70 + X66)

Date : 2026-07-26
Statut : validé (brainstorming)
Branche : `feat/rentabilite-honnete`
Portée : 5 items du Top 5 ROADMAP. C9 (compte de service Google) **reporté** (exige des actions Google Cloud côté utilisateur).

---

## Contexte & problème

La date de rentabilité affichée (`Suivi Carburant`!J11 ≈ 03/10/2026, badge « amorti 54 % ») est **arithmétiquement juste** mais **optimiste**. Audit de session (25 pleins : 22 E85 + 3 SP98) :

- **B6** = 514,54 € = boîtier seul (pas la conversion complète).
- **B11** = 278,25 € = Σ`(Coût équiv. S98 − Coût réel E85)` sur pleins E85, référence **SP98** (prix S98 « jour » moyen relevé : 2,04 €/L — l'essence la plus chère).
- **B12** = MAX(0 ; B6 − B11) = 236,29 € (reste à amortir).
- **B13** = 0,0572 €/km (économie moyenne, tout-historique).
- **J8** = 22,76 % surconso, calculée sur **3 pleins SP98 seulement**.
- **J11** = date dernier plein + (J12 − km)/(rythme km-jour moyen) ; **J12** = km + B12/B13.

Biais (tous « trop tôt ») : (a) référence SP98 au lieu d'E10/SP95 réel ; (b) coût = boîtier seul ; (c) extrapolation du taux moyen alors que l'écart E85/SP98 se resserre ; (d) surconso sur échantillon minuscule.

## Décisions de cadrage (utilisateur, 2026-07-26)

1. **C9 reporté** → branche = X67/X68/X69/X70 + X66.
2. **X67** : écart €/L configurable vs SP98 (garde la finesse prix-par-plein-au-jour).
3. **X68** : tous les coûts en **one-off** (0 € permis).
4. **X68 postes** : boîtier, pose/main-d'œuvre, modification carte grise, entretiens supplémentaires, surcoût d'assurance (0 € actuellement), − aide/subvention (déduite).
5. **X69** : **date unique « prudente » = milieu** de [date_min ; date_max], annotée **« ± N j »** avec N = (date_max − date_min)/2.

---

## 1. Nouveaux paramètres (synchro Excel ↔ Google Sheet ↔ web, mécanisme P1)

Source de vérité = onglet GS « Parametres » ; miroir local = onglet « Notes » (F/G/H) ; cellules sur « Suivi Carburant » ; édition web dans Réglages. Tous acceptent **0**. On réutilise `modSyncParametres` (map `Mk`/`MkRO`), `js/parametres.js` (liste `PARAMS`), `js/config.js` (clés localStorage), GAS `getParametres`/`setParametres` (générique clé/valeur → aucun changement GAS requis).

| Clé param | Cellule | Rôle | Défaut |
|---|---|---|---|
| `cout_boitier` | B6 | ex-`kit_prix`, relabel « Coût du boîtier (kit) », valeur migrée | 514,54 |
| `cout_pose` | (nouvelle) | pose / main-d'œuvre | 0 |
| `cout_carte_grise` | (nouvelle) | démarches ANTS | 0 |
| `cout_entretien` | (nouvelle) | entretiens supplémentaires (estimation one-off) | 0 |
| `surcout_assurance` | (nouvelle) | surcoût d'assurance (one-off) | 0 |
| `aide_deduite` | (nouvelle) | subvention perçue (**soustraite**) | 0 |
| `carburant_ref` | (nouvelle) | libellé SP98 / SP95 / E10 | SP98 |
| `ecart_ref` | (nouvelle) | € /L retranché au prix SP98 du jour | 0 |
| `proj_nb_recents` | (nouvelle) | N derniers pleins E85 pour le rythme récent (0 = tout) | 6 |

- **Rétro-compat** : `kit_prix` reste la clé de sync de B6 (renommée en libellé seulement). Les nouveaux params sont additifs ; un ancien Sheet sans ces clés → défauts appliqués.
- **Placement Excel** : nouveau sous-bloc « COÛT DE CONVERSION » dans la zone PARAMÈTRES de « Suivi Carburant » (cellules libres à déterminer à l'implémentation via inspection COM ; feuille protégée → encadrer par `DeverrouillerSuivi`/`VerrouillerSuivi`). Cellule dérivée **`COUT_TOTAL`** = `MAX(0 ; B6 + cout_pose + cout_carte_grise + cout_entretien + surcout_assurance − aide_deduite)`.

## 2. X67 — Carburant de référence

- Colonne `Tableau2[Coût Plein équiv. S98 (€)]` : `[@[Nb. Litres]]/(1+$J$8)*[@[Prix S98 jour (€/L)]]` → `… * MAX(0 ; [@[Prix S98 jour (€/L)]] − ecart_ref)`. Relabel « Coût équiv. réf. (€) ».
- `carburant_ref` est **informatif** (libellé affiché) ; le calcul n'utilise que `ecart_ref` (écart €/L). Cohérence : quand `carburant_ref=SP98`, `ecart_ref` attendu = 0.
- B11 (SUMPRODUCT sur la colonne) inchangé dans sa mécanique.
- Web (`stats.js`) : `econBrute` applique le même écart au prix SP98 par plein.

## 3. X68 — Coût total de conversion

- `B12` (reste à amortir) = `MAX(0 ; COUT_TOTAL − B11)`.
- `J13` (progression) = `MIN(B11/COUT_TOTAL ; 1)` (garde-fou `COUT_TOTAL=0` → 0 ou 1 selon B11).
- Web (`stats.js`) : `getKitPrix()` → `getCoutTotalConversion()` = somme des postes (défauts 0) ; `econNette = econBrute − coutTotalConversion`. `getKitPrix` conservé comme alias/retro-compat interne = `cout_boitier`.

## 4. X69 — Projection prudente + marge

Deux taux d'économie/km calculés sur le sous-ensemble E85 du véhicule sélectionné :

- **taux_moyen** = B13 (tout-historique, actuel).
- **taux_recent** = `(éco_cumulée_dernier − éco_cumulée_(N pleins E85 avant)) / (km_dernier − km_(N avant))`, N = `proj_nb_recents` (0 ⇒ = taux_moyen). Utilise la colonne `Tableau2[Économie cumulée (€)]` et `[Km compteur]`, restreints E85 + véhicule.

Deux dates via la même mécanique que J11 actuel (km cible = km + reste/taux ; date = dernier plein + (km cible − km)/rythme km-jour) :

- `date_A` avec taux_moyen, `date_B` avec taux_recent.
- `date_min` = MIN(A,B), `date_max` = MAX(A,B).
- **J11** = `date_min + (date_max − date_min)/2` (milieu).
- **marge N** = `(date_max − date_min)/2` en jours ; affichage « ± N j » (cellule/annotation adjacente + badge dashboard `modDashboardGraphiques` si pertinent).
- `J12` (km cible) = calculé avec taux_recent (scénario prudent) pour cohérence, ou milieu des deux km cibles — **retenu : milieu** pour aligner J11/J12.
- Cas dégénéré (< N+1 pleins E85, ou B12=0) : repli sur le comportement actuel (date unique, marge 0, ou « En attente de plus de pleins »).

## 5. X70 — Fiabilité de la surconso

- `J8` : ajouter garde-fou. Soit `nRef` = `COUNTIFS(Type=SP98, Véhicule=sel)`.
  - Si `nRef < 4` **ou** surconso calculée ∉ `[0,15 ; 0,40]` → borner à la plage plausible (clamp) et lever un indicateur.
  - Cellule d'avertissement (label) : « Surconso peu fiable (n=nRef pleins SP98) » affichée si `nRef < 4`.
- Web : `getSurconsoFallback` / `computeSurconso` (`stats.js`) — appliquer le même clamp `[0,15 ; 0,40]` et exiger un minimum de pleins SP98 avant d'utiliser la valeur mesurée.

## 6. X66 — Export PNG `gKitProj` (0 octet)

- Reproduire via COM l'échec `Chart.Export(...,"PNG")` sur le nuage XY `gKitProj`.
- Hypothèses à tester dans l'ordre : (a) feuille protégée `DrawingObjects:=True` → déprotéger avant export ; (b) graphique non recalculé/rendu → `Application.CalculateFull` + `DoEvents` avant export ; (c) type `xlXYScatter` + tendance → exporter via une **feuille-graphe temporaire** (`Location xlLocationAsNewSheet`) puis supprimer ; (d) sélection/activation requise.
- Vérifier `ExporterGraphiquesPDF` : le nuage ne doit plus manquer/être vide.
- Retenir le correctif minimal qui produit un PNG > 0 o, injecté COM + vérifié live.

## 7. Parité web (`js/`)

- `js/config.js` : nouvelles clés localStorage + défauts.
- `js/parametres.js` : ajouter les params à `PARAMS` (sync GS) + map clés.
- `js/stats.js` : `getCoutTotalConversion`, `econBrute` avec `ecart_ref`, `econNette` sur coût total, clamp surconso.
- `js/rentabilite.js` : seuil dynamique `ratio < 1/(1+surconso)` (rentable) au lieu de `0,66` figé ; `SEUIL_BREAKEVEN` ≈ `1/(1+surconso)` + petite marge. Reste cohérent avec le carburant de référence si prix de référence dispo.
- `index.html` + Réglages : champs pour les nouveaux postes de coût, carburant de référence, écart, N récents.
- Tests Vitest : ajuster `stats.test.js` (économie nette, surconso clamp) + ajouter couverture des nouvelles fonctions pures.

## Sécurité des données — AUCUNE perte de pleins (contrainte absolue)

Les pleins déjà enregistrés (Excel local, Google Sheet, cache app web) **ne doivent jamais être effacés ni modifiés**. Toutes les évolutions sont **strictement additives** :

- **Excel** :
  - `Tableau2` est un tableau de **formules** miroir de `GS_Pleins` (leçon #62, `SourceType=xlSrcRange`). Éditer la **formule de colonne** de « Coût Plein équiv. S98 » ne modifie qu'une **colonne calculée** — les colonnes source (Date/Type/Km/Litres/Prix…) et `GS_Pleins` (QueryTable) sont intactes. Ne jamais `Cells.Clear`/`ListRows.Delete`/`Delete` sur des lignes de données.
  - Nouvelles cellules de paramètres : **vérifier qu'elles sont vides** (COM) **avant** écriture ; ne jamais écraser une cellule non vide sans confirmation.
  - **Backup** JSON de toutes les `cell.Formula` de « Suivi Carburant » avant chirurgie (leçon #57) ; filet de sécurité `wb.Close(SaveChanges:=False)` = retour disque tant que non sauvé.
  - Modif de B6 = **relabel du libellé seulement**, la **valeur 514,54 est conservée** (migrée telle quelle).
- **Google Sheet** : uniquement des **écritures clé/valeur** sur l'onglet « Parametres » via `setParametres` (upsert générique). **Aucun** `deleteDimension`, `clear`, ni écriture sur l'onglet des réponses/pleins (`_ImportGS`). Pas d'appel Sheets API destructif.
- **App web** : uniquement **ajout** de nouvelles clés `localStorage` (params) ; le cache des pleins et la file hors-ligne ne sont pas touchés. `getKitPrix` conservé (rétro-compat) : une absence des nouvelles clés retombe sur les défauts, jamais sur un effacement.
- **Vérification post-changement** : compter les lignes de `Tableau2`/`GS_Pleins` **avant/après** (doit être identique) et confirmer que les KPI (B11, J13) restent cohérents.

## Risques & garde-fous

- **Formules plutôt que VBA** pour tout ce qui touche le calcul (leçons COM #49/#50/#57) : écrire les formules via `Range.Formula2` si array/structured refs (leçon #57), vérifier la valeur après écriture (une formule cassée renvoie "" en silence).
- **Feuille protégée** : `DeverrouillerSuivi`/`VerrouillerSuivi` autour de toute écriture (leçon #58/#61).
- **Backup** JSON de toutes les `cell.Formula` de « Suivi Carburant » **avant** chirurgie (leçon #57).
- **Sync** : ne pas casser la rétro-compat des 4 params existants ; tester `SyncParametres` réel après ajout.
- **VBA `Attribute VB_Name`** : stripper avant tout `set-module` (leçons #11/#14/#50).
- **Web** : `new window.CustomEvent` si dispatch (leçon #47) ; lint `--max-warnings=0`.

## Critères de succès

- Le paramétrage des coûts (boîtier/pose/carte grise/entretien/aide) est éditable dans Excel **et** dans l'app, synchronisé, 0 € accepté.
- La référence carburant (écart €/L) modifie l'économie et repousse la date en conséquence.
- J11 affiche une date **médiane** entre les deux rythmes, annotée « ± N j ».
- J8 borne la surconso et signale un échantillon faible.
- `gKitProj` s'exporte en PNG > 0 o (et apparaît dans le PDF).
- Web : économie nette et bannière temps réel cohérentes avec Excel ; Vitest + lint verts.

## Hors périmètre (YAGNI)

- Coûts récurrents (assurance/entretien annuels) — tout en one-off.
- C9 (compte de service Google) — branche dédiée ultérieure.
- Prix de référence marché réel (PrixHistory) — on s'en tient à l'écart configurable.
