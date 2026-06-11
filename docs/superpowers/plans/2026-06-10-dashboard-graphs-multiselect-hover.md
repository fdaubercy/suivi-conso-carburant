# Tableau de bord — Filtres natifs (Segments + Chronologie), gConso/gPrice réactifs, légendes survol

> **Exécution :** inline (classeur ouvert = singleton COM). Déploiement live via skill `vba-agent` (set-module, retirer `Attribute VB_Name`). Vérif/tâche = `Débogage→Compiler` + exécution macro + inspection du classeur.

**Goal :** Remplacer B4/B5/B6 par des **Segments natifs (Véhicule, Carburant) + une Chronologie (Période)** qui filtrent les graphiques du Tableau de bord ; gConso = 1 courbe L/100km **par véhicule** (depuis `GS_Pleins`) ; gPrice = prix par carburant (`PrixHistory` + pleins) respectant la sélection ; `btnRecreerGraph` reproduit le rendu d'ouverture ; 3 boutons verts avec **étiquette stylée au survol**.

**Architecture filtres (point clé) :** les graphiques ne sont PAS des graphiques croisés dynamiques → un Segment/Chronologie ne peut pas les filtrer directement. Solution : **TCD caché** (`ptFiltres` sur table `tFilterSrc` dérivée de `GS_Pleins`) qui héberge Segments + Chronologie ; tout changement déclenche `Workbook_SheetPivotTableUpdate` → VBA lit les sélections → écrit l'état (B5/B6 + noms `PERIODE_DEB/FIN`) → `RecreerDashboardComplet` recalcule **tous** les graphiques.

**Décisions (2026-06-10) :** Chronologie = **hybride** (PoC : `Add2(…,xlTimeline)` échoue Err 5 en VBA ici → l'utilisateur l'insère 1× à la main, VBA la pilote ensuite). Disposition **A** (barre horizontale sous bannière). Carburant **normalisé** (FuelKey). Périmètre **pragmatique** : Période + Carburant → tous les graphiques ; **Véhicule → gConso** (les autres viennent de `Suivi Carburant`/Tableau2 sans colonne véhicule ; gVeh reste une comparaison tous-véhicules).

**Version :** `WB_VERSION`/`APP_VERSION` 5.11.2.0 → **5.12.0.0**. Tag : **X39**.

**Faits classeur (COM, 2026-06-10) :** Feuilles dont `Tableau de bord` (codename **Feuil3**, `Worksheet_Activate`→`MAJ_Dashboard_Graphiques`, anti-rebond 15 s), `GS_Pleins` (Date,Km,Litres,PrixL,Vehicule,Type), `_PrixHistory`/`PrixHistory` (Date,Type,PrixL,`E85 station`…`GPLc station`), `Tableau2`/Suivi Carburant (**sans Vehicule**, colonnes calculées économie/coût-km/kit). Staging `_GraphData` (conso L:M, prix G:.., véhicules O:Q). Segments **créables par VBA** (PoC OK) ; **Chronologie non** (Err 5). Helpers : `FuelInSel`, `KPI_TOUS`, `FILTER_ALL`, `FuelKey`, `LCIdx`, `NumOr0`, `NumDict`, `TriStr`, `DeleteChartByName`, `AddChartXY`.

---

# PHASE 1 — Moteur filtrable (fondation, sans UI segments)

## Task 0 : Pré-vol
- [ ] Backup `vba\*.bas` → `vba\backup_X39_<ts>\` ; `wb.SaveCopyAs` → `excel\backup_X39\`.
- [ ] Baseline : `CreerGraphiquesWeb True` + `MAJ_Dashboard_Graphiques` sans erreur (StatusBar).

## Task 1 : gPrice respecte la multi-sélection carburant (B6 CSV)
`vba/modGraphiques.bas`. (Code détaillé déjà spécifié — version antérieure du plan.)
- [ ] Site d'appel (~467) : passer `selFuel` complet (retirer la restriction `InStr(selFuel, ",")=0`).
- [ ] `BuildPriceBlockMerged` : param `onlyFuel`→`selFuels` (CSV) ; construire `wantSet` (FuelKey) ; seed `fuelSet` depuis wantSet quand filtré ; adapter les 3 tests (SP98 marché, pleins, PrixHistory) en `wantSet.Exists(fk)`. Garde les 2 sources.
- [ ] Déployer + compiler + vérifier (B6=`E85,SP98` → 2 séries ; `(tous)` → toutes).

## Task 2 : gConso = 1 courbe/véhicule (depuis GS_Pleins)
`vba/modGraphiques.bas`. (Code complet `BuildConsoBlock` + `InCsvSel` déjà spécifié.)
- [ ] Helper `InCsvSel(value, csv)` ; nouvelle `BuildConsoBlock(gsT, wsD, selVeh, ByRef nVehCols)` (conso = Litres ÷ Δkm × 100, tableau croisé Date×Véhicule en L.., garde-fou 0<conso<60).
- [ ] BuildAggregates : retirer conso inline (407-412) + en-tête L1:M1 (312) ; `rConso = BuildConsoBlock(gsT, wsD, selVeh, rConsoCols)` ; ajouter `ByRef rConsoCols`.
- [ ] CreerGraphiquesWeb : déclarer `rConsoCols`, le filer ; gConso = `Resize(rConso, 1+rConsoCols)` + `DeleteChartByName` (recréation) + titre « Consommation par véhicule (L/100 km) ».
- [ ] Déployer + vérifier (B5 vide → 1 courbe/véhicule).

## Task 1c : Filtre PÉRIODE dans le moteur
`vba/modGraphiques.bas`.
- [ ] Créer noms classeur `PERIODE_DEB` / `PERIODE_FIN` (cellules cachées, ex. `_GraphData!BC1/BC2`).
- [ ] CreerGraphiquesWeb : lire `perDeb`/`perFin` (Date, 0 = non borné) ; passer à BuildAggregates, BuildConsoBlock, BuildPriceBlockMerged.
- [ ] Dans chaque boucle de lignes : `If perDeb>0 And d<perDeb Then skip` ; `If perFin>0 And d>perFin Then skip`. (Filtre période → TOUS les graphiques.)
- [ ] Déployer + vérifier (poser PERIODE_DEB/FIN à la main → graphiques se restreignent).

## Task 4 : btnRecreerGraph = rendu d'ouverture
- [ ] `modDashboardGraphiques` : `Public Sub RecreerDashboardComplet()` = `Application.Run "CreerGraphiquesWeb", False` puis `MAJ_Dashboard_Graphiques`.
- [ ] `modGraphiques.EnsureButtons` : action `btnRecreerGraph` → `"RecreerDashboardComplet"`.
- [ ] Vérifier rendu identique à l'activation d'onglet.

## Task 5 : Étiquette stylée au survol (ActiveX + filet natif)
`modGraphiques.EnsurePictureButton`, `modDashboardGraphiques.AddButton`, module **Feuil3**. (Code détaillé déjà spécifié.)
- [ ] 3 boutons → ActiveX `Forms.Image.1` (Picture=PNG, `ControlTipText` natif).
- [ ] Feuil3 : `WithEvents` imgRecreer/imgExport/imgActu ; `_MouseMove`→`ShowTip` (textbox stylé `hoverTip`), `_Click`→macro ; `WireDashButtons` dans `Worksheet_Activate` ; masquage via Image de fond ou `OnTime`.
- [ ] Repli documenté si instabilité ActiveX : retour image+OnAction + ScreenTip natif (hyperlink), consigner dans `lessons.md`.

---

# PHASE 2 — UI Segments + Chronologie (hybride) — REMPLACE l'ancienne « Task 3 cases à cocher »

## Task P1 : Source filtres `tFilterSrc`
`vba/modFiltres.bas` (nouveau).
- [ ] Feuille cachée `_FilterSrc` + Table `tFilterSrc` (colonnes `Date`, `Vehicule`, `Carburant`=FuelKey(Type)), reconstruite depuis `GS_Pleins`. Procédure `RebuildFilterSrc()` appelée en tête de `CreerGraphiquesWeb`.

## Task P2 : TCD caché `ptFiltres`
- [ ] `EnsureFilterPivot()` : si absent, `PivotCaches.Create(xlDatabase, "tFilterSrc").CreatePivotTable(_FilterSrc!<zone cachée>, "ptFiltres")` + 1 champ valeur (Count) pour validité. Idempotent (réutilise si existe).

## Task P3 : Segments Véhicule + Carburant
- [ ] `EnsureSlicers()` : `SlicerCaches.Add2(ptFiltres,"Vehicule")`→`slcVehicule` ; `Add2(ptFiltres,"Carburant")`→`slcCarburant` ; `Slicers.Add` sur **Tableau de bord**, stylés charte (`SlicerStyleLight…` ou couleurs), posés en **barre A** (sous la bannière, Top ~ sous KPI/bandeau), `Placement=xlFreeFloating`, colonnes/largeurs compactes. Idempotent.

## Task P4 : HANDOFF Chronologie (manuel 1×)
- [ ] Je pose TCD + segments + `save`. **Utilisateur** : sélectionne `ptFiltres` → *Insertion → Chronologie* → coche **Date** → OK.
- [ ] Utilisateur me donne le nom (ou je le détecte : nouveau SlicerCache de type Timeline). Je le renomme `tlPeriode`, le style, le positionne dans la barre A (à droite des segments, large), le connecte (auto via `ptFiltres`).

## Task P5 : Évènement → recalcul
`ThisWorkbook`.
- [ ] `Workbook_SheetPivotTableUpdate(ByVal Sh, ByVal Target)` : si `Target.Name="ptFiltres"` → anti-rebond (Static/Timer) → lire `slcVehicule`/`slcCarburant.VisibleSlicerItems` → CSV (vide/tous → `(tous)`) → écrire B5/B6 ; lire `ThisWorkbook.SlicerCaches("tlPeriode").TimelineState.StartDate/EndDate` → écrire `PERIODE_DEB`/`PERIODE_FIN` → `RecreerDashboardComplet`.

## Task P6 : Retrait B4/B5/B6 visibles + layout barre A
- [ ] `modDashboardGraphiques.EnsureSelectors` : ne plus créer dropdowns/validation B4/B5/B6 ; B5/B6 = cellules d'état cachées. Supprimer `fup_btn` + appel `modFuelPanel` (panneau carburant dessiné) devenus obsolètes.
- [ ] `CleanupDashShapes`/`LayoutCharts` : ne PAS supprimer/déplacer `slcVehicule`/`slcCarburant`/`tlPeriode` ; grille de graphiques descendue sous la barre A.
- [ ] Vérif end-to-end : cocher véhicule(s)/carburant(s) + glisser la chronologie → tous les graphiques se recalculent ; Véhicule n'affecte que gConso.

---

# PHASE 3 — Documentation + commit
- [ ] Miroir disque des `.bas` modifiés (+ nouveau `modFiltres.bas`) avec `Attribute VB_Name`.
- [ ] `WB_VERSION`/`APP_VERSION` → `5.12.0.0`.
- [ ] CHANGELOG `## [5.12.0.0]` (Added: Segments Véhicule/Carburant + Chronologie pilotant les graphiques ; gConso multi-véhicule ; légendes survol. Changed: gPrice multi-carburant. Fixed: btnRecreerGraph). ROADMAP (✅ X39). lessons.md (chronologie non scriptable Err 5 → hybride ; TCD caché comme hôte de filtres + évènement).
- [ ] `/graphify --update` → `git add` → `./commit.sh "feat(excel): filtres natifs Segments+Chronologie, gConso multi-vehicule, legendes survol [v5.12.0.0]"` (sans `Co-Authored-By`).

---

## Couverture
gConso/véhicule ✓(T2) · gPrice multi-carburant ✓(T1) · filtre période tous graphiques ✓(T1c) · Segments+Chronologie remplacent B4/B5/B6 ✓(P1-P6) · btnRecreer ✓(T4) · survol ✓(T5). Contrainte assumée : filtre Véhicule limité à gConso (lignée Tableau2 sans véhicule).
