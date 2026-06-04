# 🗺️ Roadmap — Suivi E85

Propositions d'amélioration classées par axe (web / Excel / sync) et par effort.
À piocher dans l'ordre qui te convient.

---

## 🌐 Web app

### 🔥 Quick wins (< 2 h chacun)

| # | Idée | Pourquoi |
|---|---|---|
| W57 | **Partage image du bilan « Wrapped »** : rendu de la carte Wrapped sur un `<canvas>` → `toBlob()` → **Web Share API** (`navigator.share`) avec repli téléchargement PNG | Partager son bilan E85 en 1 tap (réseaux, message) sans capture d'écran |
| W58 | **Prochain plein estimé** : à partir du rythme moyen (km/jour & autonomie), afficher « prochain plein ≈ le JJ/MM » dans la vue Stats + badge sur l'onglet | Anticiper le passage à la pompe |

### 🎨 UX / Ergonomie

| # | Idée | Pourquoi |
|---|---|---|
| U9 | **Filtre véhicule global persistant** : un sélecteur en header applique le périmètre véhicule à toutes les vues (Stats/Carte/Historique) au lieu d'un réglage par carte | Cohérence multi-véhicules, moins de clics |

---

## 🛠️ Dev / Outillage Claude

### ✅ Réalisé

| # | Idée | Version |
|---|---|---|
| C4 | **Pouvoirs navigateur — Claude in Chrome** — extension Chrome connectée ; capacités documentées dans `CLAUDE.md` | v4.10.0.1 |
| C5 | **Pouvoirs API Google (GAS + Sheets)** — config `gas-config.json`, artifact GAS Manager, token OAuth documentés dans `CLAUDE.md` | v4.10.0.1 |
| C3 | **Sécurité `.gitignore`** — `gas-config.json` exclu de git (scriptId, sheetId, deployId) | v4.10.0.2 |
| C1 | **Skill `gas-api`** — `.claude/skills/gas-api/SKILL.md` dédiée aux appels API REST GAS+Sheets | v4.10.0.2 |
| C2 | **Commande `/gasManager`** — `.claude/commands/gasManager.md` recharge l’artifact GAS Manager sans ressaisie | v4.10.0.2 |
| C6 | **Renouvellement automatique du token OAuth** — section `oauth` dans `gas-config.json` (`client_id`/`client_secret`/`refresh_token`) ; artifact GAS Manager renouvelle via `oauth2/token` sur 401 | v4.10.0.3 |
| C7 | **Historique des déploiements** — section `deployHistory` dans `gas-config.json` + onglet dédié dans `/gasManager` | v4.10.0.3 |
| C10 | **Hook PostToolUse Chrome** — matcher `mcp__.*__navigate` dans `settings.json` détecte les navigations GAS et suggère de mettre à jour `deployHistory` | v4.10.0.3 |

### 🔧 À faire

| # | Idée | Pourquoi | Effort |
|---|---|---|---|
| C8 | **Sync GAS → GitHub via clasp** — script `sync-gas.sh` : `clasp pull` + `git add` + commit auto pour versionner le code GAS dans le repo | Traçabilité complète du code GAS dans git | ~3h |
| C9 | **Service account Google** — remplacer le token OAuth Playground (1h, lié au compte perso) par un compte de service JSON credentials | Authentification stable sans renouvellement manuel | ~2h |

---

## 📊 Excel

### 🔥 Quick wins

| # | Idée | Pourquoi |
|---|---|---|
| X1 | **Bouton "Synchroniser"** sur la feuille `GS_Pleins` qui appelle `SyncManuel` | Pas besoin d'Alt+F11 pour lancer le sync |

### 🎯 Onglet "Tableau de bord"

| # | Idée | Pourquoi |
|---|---|---|
| X9 | **Économies cumulées E85 vs SP98** (calcul rétroactif depuis colonne J SP98 station) | Le ROI E85 chiffré |
| X15 | **Graphique scatter Prix E85/L vs L/100 km** : nuage de points pour voir si la conso augmente quand le prix baisse (comportemental) | Corrélation prix/comportement · effort ½ j · pure formule Excel |
| X20 | **Interrupteur « graphiques auto »** : cellule paramètre (ex. `Graphiques!B5` Oui/Non) lue par `SyncCore` avant l'appel auto v4.5.0.0 | Laisser l'utilisateur désactiver le recalcul auto sur un gros historique (sync plus rapide) |
| X21 | **Horodatage de dernière génération** sur l'onglet Graphiques (ex. `Graphiques!B6`) renseigné par `CreerGraphiquesWeb` | Savoir d'un coup d'œil si le tableau de bord reflète le dernier sync |

### 🛠️ Robustesse

| # | Idée | Pourquoi |
|---|---|---|
| X11 | **Onglet `_SyncLog`** : chaque sync ajoute une ligne (date, ←N, →N, durée) | Debug, historique des syncs |
| X12 | **Backup auto** dans `Google Drive/Sauvegardes/Suivi Conso Carburants_YYYYMMDD.xlsm` avant chaque sync majeure | Filet de sécurité |
| X17 | **Garde-fou de version du classeur** : `Workbook_Open` compare une constante `WB_VERSION` à la version attendue et avertit en barre d'état si le `.xlsm` est en retard sur le dépôt | Évite la dérive silencieuse `.xlsm` ↔ `vba/*.bas` (cf. retard token S6 / `modFeatures` constaté en v4.3.0.4) |
| X18 | **Script `check-vba-drift`** (CI ou local) : décompile le `vbaProject.bin` du `.xlsm` et `diff` chaque module contre `vba/*.bas`, échoue si divergence fonctionnelle | Détecte automatiquement un classeur non resynchronisé avant un commit |

---

## 🔄 Synchronisation Excel ↔ Google Sheets

### 🎯 Améliorations significatives

| # | Idée | Pourquoi |
|---|---|---|
| _(aucune en attente)_ | — | S3/S4/S5 implémentés en v4.8.0.0 |

### 🛡️ Sécurité

| # | Idée | Pourquoi |
|---|---|---|
| _(aucune en attente)_ | — | S6 (token secret) implémenté en v3.6.0.0 |

---

## ☁️ Google Apps Script / Google Sheets

### 🎯 Backend (GAS)

| # | Idée | Pourquoi |
|---|---|---|
| S13 | **Rapport mensuel illustré** : `RapportMensuel.gs` insère des mini-graphes via URLs **QuickChart** (image dans l'email HTML) | Email plus parlant sans pièce jointe lourde |
| S14 | **Sauvegarde quotidienne du classeur GS** : trigger journalier exporte le Google Sheet en `.xlsx` vers `Google Drive/Sauvegardes/` (rotation 30 j) | Filet de sécurité côté cloud, indépendant d'Excel |
| S15 | **Alerte d'anomalie de saisie** : au refresh, détecter conso aberrante (> seuil) ou km rétrograde et notifier (push/email) | Qualité des données, détection rapide d'une faute de frappe |

### 📋 Onglets Google Sheets

| # | Idée | Pourquoi |
|---|---|---|
| G1 | **Validation de données** sur l'onglet de saisie GS (listes déroulantes Carburant / Véhicule / Station depuis l'onglet `Stations`) | Saisie web directe fiable, mêmes valeurs que l'app |
| G2 | **MFC prix sur le Sheet** : dégradé couleur sur la colonne Prix €/L (vert = bas, rouge = haut) par carburant | Lecture rapide de l'historique directement dans le navigateur |
| G3 | **Onglet `Dashboard` natif Sheets** : graphiques Google (prix, conso, CO₂) répliquant le tableau de bord Excel | Consulter le bilan sans ouvrir le `.xlsm` (mobile/web) |

---

## 🏆 Top 5 recommandés en priorité

| Rang | Item | Effort | Bénéfice |
|---|---|---|---|
| 1 | **X1** — Bouton "Synchroniser" sur la feuille GS_Pleins | 15 min | Ergonomie immédiate, plus besoin d'ouvrir l'IDE |
| 2 | **X9** — Économies cumulées E85 vs SP98 | ½ j | ROI E85 chiffré depuis les données existantes |
| 3 | **X15** — Graphique scatter Prix E85/L vs L/100 km | ½ j | Corrélation prix/comportement, pure formule Excel |
| 4 | **X20** — Interrupteur « graphiques auto » (cellule param) | ½ j | Désactiver le recalcul auto sur un gros historique |
| 5 | **X11** — Onglet `_SyncLog` (date, ←N, →N, durée) | — | Debug, historique des syncs |

> ✅ S3/S4/S5 (suppression bidir., force resync, conflits par timestamp) implémentés en v4.8.0.0 — voir le tableau ci-dessous.

---

## ✅ Idées déjà implémentées

| Version | Idée |
|---|---|
| v5.0.0.0 | **Comptes utilisateurs — « Se connecter avec Google » (U7)** — passage **mono → multi-utilisateur public**. `js/auth.js` (GIS, One-Tap, session, `auth-changed`) + `Auth.gs` (`verifyIdToken_` via `tokeninfo`, `resolveOwner_`, `REQUIRE_AUTH`). `_ImportGS` col **S Email**, `Parametres` 4ᵉ col `email`, `_PushSubs` col `Email` → pleins/stats/historique/réglages/notifs **par compte** (`_rowBelongsTo_`, migration `migrerMultiUser()`). Mur de connexion (`router.js`) sur Stats/Historique/Réglages ; saisie réservée aux connectés. RGPD : `handleDeleteAccount` + bouton ⚙️. Power Query `GS_Pleins.m` filtré email propriétaire. Véhicules non seedés en multi-user. **Bascule souple** (placeholder = inactif). Tests `tests/auth.test.js` |
| v4.19.0.0 | **Prix historique à la saisie : SP95 / E10 / GPLc (W62)** — complète W60/W61 : `TOKENS` de `handleSectorPrices` (Code.gs) + `HIST_FUELS` (`js/secteur.js`) étendus aux **6 carburants** → le champ Prix se remplit depuis `_PrixHistory` pour une date passée sur ces 3 carburants (avant : « non relevé — prix du jour »). Lecture `SECTOR_BEST_TODAY` rendue insensible à la casse (`GPLc`↔`GPLC`). ⚠️ redéploiement GAS. Test SP95 mis à jour |
| v4.18.0.0 | **Relevé marché SP95 / E10 / GPLc (W61)** — `RefreshPrix.gs` `FUELS` étendu de 3 → **6 carburants** (champs API `sp95_prix`/`e10_prix`/`gplc_prix`) : loggés dans `_PrixHistory` (stations curées + scan géo 15 km) et `SECTOR_BEST_TODAY`. **Synchro Excel** sans changement Power Query (`PrixHistory.m` recopie les 4 colonnes ; *Actualiser tout*). **Fix** `vba/modPrixStation.bas` `FuelKeyP` (E10 ne tombe plus dans la colonne SP95) ; libellé **GPLc** harmonisé (`modPrixStation`/`modGraphiques`). Push inchangé (pas de seuil SP95/E10/GPLc dans `_PushSubs`) |
| v4.17.0.1 | **Déploiement GAS automatisé** — `gas-deploy.mjs` / `npm run gas:deploy` : push `.gs`/`.html` + version + mise à jour du déploiement (même URL `/exec`) via l'API `script.googleapis.com`, auth OAuth refresh_token (`.claude/gas-config.json`, gitignoré). Fusion **sans suppression** (conserve `appsscript` et tout fichier en ligne absent du repo) ; modes `--check`/`--diff`/`--pull`/`--no-deploy`. Fini le copier-coller dans l'éditeur |
| v4.17.0.0 | **Prix historique à la saisie d'un plein passé (W60)** — date ≠ aujourd'hui → champ Prix rempli depuis `_PrixHistory` : prix de la **station** ce jour-là → **relevé le plus proche avant** → repli **mini secteur** ; note de provenance `#histNote` ; SP95/E10/GPLc (non suivis) → prix du jour conservé ; retour à aujourd'hui → prix live restauré. `js/secteur.js` (`resolveHistPrice`/`applyHistPriceToForm`), câblage `main.js`/`prix.js`/`carburant.js`. GAS `handleSectorPrices` expose `byStationDate` (⚠️ redéploiement requis ; repli secteur en attendant). Tests `prix-historique.test.js` + `.spec.js` |
| v4.16.0.0 | **E-mail « Wrapped » annuel (GAS)** — `WrappedAnnuel.gs` : bilan de fin d'année par mail (hero festif + 8 KPI : pleins/litres/€/prix E85/km/moyenne L100/CO₂/surconso + station préférée + mois le plus cher), design aligné sur le rapport mensuel et `js/wrapped.js`. Trigger 1er du mois 8h n'envoyant qu'en **janvier** (année écoulée) ; `installerTriggerWrappedAnnuel`/`testWrappedAnnuel`/`supprimerTriggerWrappedAnnuel` |
| v4.15.x | **Rapport mensuel : redesign « modèle »** (header/hero/cartes KPI) + **surconso 1 décimale** lue depuis Excel J7 (onglet `Parametres`) + cartes **CO₂ évité / prix moyen E85 / station préférée** ; **bouton « Quitter le plein écran »** sur les onglets Excel ; fix `_PrixHistory` figé (`RafraichirPrixHistory`) ; `PousserParametresExcel` |
| v4.14.0.0 | **Installeur « GO ! » + recherche stations fiabilisée + duplication prix** — VBA : macro maître `Installer` (un clic, tolérante, bilan Ctrl+G) + `InstallerDashboard` monte enfin la feuille **Stats** (via `modGraphiques.CreerGraphiquesWeb`, appel tolérant — v4.14.0.1). Web : recherche stations refondue (**1 requête Overpass groupée**, appariement ≤ 200 m → **jamais de faux nom**, affichage immédiat + **renommage « Enseigne - Ville » au fur et à mesure**, **annulable** au clic via `AbortController`/`cancelOsmEnrich`) ; **duplication** d'un plein → prix relevés **à la vraie station** (`getStationCoords`) pour garantir les colonnes I→N |
| v4.13.2.0 | **Carte — tableau réactif au carburant** : `Worksheet_Change` sur C3 (`Carte_Fuel`) → `RafraichirTableauCarte` (recalcul prix moyens **sans réseau**, titre + prix mis à jour instantanément) ; snippet `Carte_snippet.bas` à coller dans le module de la feuille |
| v4.13.1.0 | **Carte — itinéraire cliquable** : popups des stations avec liens **Google Maps** + **Waze** vers la station. Décision : la carte interactive **en navigateur** (zoom + marqueurs + itinéraire) est la solution retenue ; embarquement *dans* Excel écarté (moteur IE trop fragile / Leaflet incompatible, WebView2 = composant tiers à installer) |
| v4.13.0.0 | **Dashboard Excel miroir — Étape 3 : onglet Carte** (`modCarte.bas`) — tableau prix moyens par carburant (fidèle `computeStationAverages`) + **carte OSM interactive Leaflet** (navigateur) avec marqueurs prix, **position utilisateur** (point GPS, cellule `Carte_Position` ou géoloc navigateur), géocodage gouv. v2.1 + **désambiguïsation homonymes** + cache éditable `_StationCoords` ; macros `ReinitialiserCoords`/`DiagnoseCarte`. Embarquement *dans* Excel (WebView2) = limite technique documentée |
| v4.12.0.0 | **Dashboard Excel miroir de l'app — Étape 1/3** — feuilles **Accueil** (tuiles + navigation `Nav*` + vue de départ `AfficherVueDeDepart`, `modWorkbook`), **Historique** (vue `GS_Pleins` filtrable Véhicule/Carburant + 5 derniers + export CSV `;`/`,` UTF-8, `modHistorique`) et **Reglages** (prefs classeur + **surface des params métier synchronisés** kit/budget/CO₂/surconso vers leurs cellules canoniques B5/J7/B2/B3 + bouton « Appliquer + Synchroniser », `modReglages`, snippet optionnel) ; **fix** `modSyncParametres.WS_GRAPH` (`Graphiques`→`Tableau de bord`) qui réparait la synchro budget/CO₂. Étapes 2 (Stats — déjà couvert par le dashboard existant) puis 3 (Carte OSM embarquée) à suivre |
| v4.11.0.0 | **X36/X37 — Tableau de bord Excel refondu (Phase 2)** — l'onglet « Graphiques » devient le « Tableau de bord » principal (ancien renommé « Tableau de bord 2 » puis supprimé) ; **réactivité totale** au filtre véhicule/carburant (B5/B6) : KPI + bandeau méta + CO₂ + **tous les graphiques temporels** (`modGraphiques.BuildAggregates` filtré, `BuildPriceBlockMerged` par carburant, comparaison véhicules globale) ; découplage via `modDashboardKPI.ComputeDashboardStats` (plus de lecture d'un autre onglet) ; fusion des KPI de l'ancien dashboard (dépense totale, prix moyen, dernier plein) ; `Worksheet_Change` sur B2:B6 ; module legacy `modDashboard.bas` retiré |
| v4.10.0.0 | **P1 — Paramètres métier partagés (Phase 1)** — onglet `Parametres` du Google Sheet (`cle\|valeur\|modifie_le`) comme source de vérité unique des réglages métier (kit, budget, objectif CO₂, surconso, seuils d'alerte) ; synchro **last-write-wins par clé** app ⇆ Excel. GAS : endpoints `getParametres`/`setParametres` (⚠️ redéploiement). App : `js/parametres.js` (`syncParametres`/`pushParam`), câblé dans `stats.js`/`notifications.js`/`main.js`. Excel : `vba/modSyncParametres.bas` (mapping cellules `B5`/`J7`/`Graphiques!B2`/`B3`, horodatage UTC, garde-fou formule), branché dans `SyncCore` |
| v4.8.0.0 | **Suppression bidirectionnelle + force resync + conflits par timestamp (S3/S4/S5)** — **S3** soft-delete par tombstone (col R `Supprimé` du GS), `handleExport` exclut les supprimés et renvoie `deleted:[…]`, action GAS `bulkDelete`, macro VBA `SupprimerPleinExcel`, purge cache web (`historique.js`) ; **S4** `ForceResync` (vide `GS_Pleins` + ré-import total) ; **S5** col GS `Modifié_le`, arbitrage du plus récent (Excel col Q vs GS) côté VBA *et* côté serveur (`handleBulkUpdate`). `Code.gs` v3.8.0.0 (⚠️ redéploiement), `modSyncGS.bas` v2.10.0.0 |
| v4.9.0.3 | **X35** — `gPrice` : PrixHistory filtre sur les carburants des pleins ; plus d'injection de séries non utilisées |
| v4.9.0.2 | **X32 fix** — centrage horizontal Véhicule/Carburant (B5:B6) dans le panneau Paramètres de l'onglet Graphiques |
| v4.9.0.1 | **X35** — `gPrice` fusion `PrixHistory` + pleins (`BuildPriceBlockMerged`) ; carburants dynamiques (SP95/E10/GPL) |
| v4.8.0.0 | **Tableau de bord Excel — dashboard moderne + 3 graphiques rentabilité kit + boutons image (X27/X28/X29)** — `vba/modGraphiques.bas` v4.8.0.0 : restauration depuis l'ancien classeur de **l'économie cumulée vs coût du kit** (courbe+seuil `Suivi Carburant!B5`), du **coût au km c€/km par plein** (barres) et de la **projection de rentabilité** (scatter + tendance linéaire 5 pleins) ; mise en page dashboard (bandeau-titre, params espacés des boutons, graphiques décalés `TOP_BASE` 150) ; **charte alignée sur l'app** ; **boutons PNG cliquables** (`excel/assets/`, repli Shape) ; **auto-refresh à l'ouverture de l'onglet** (`vba/Graphiques_snippet.bas`, `Worksheet_Activate`) |
| v4.8.0.0 | **`commit.sh` verbeux en direct** — tee `commit.log` + line-buffering `stdbuf` des étapes npm + `vitest --reporter=verbose` : les étapes (lint, tests) s'affichent au fil de l'eau dans l'interface au lieu d'apparaître seulement à la fin |
| v4.7.0.0 | **Agrégats serveur + résumé annuel + thème sombre + jauge budget Excel (S12/W59/U8/X26)** — **S12** endpoint GAS `?action=stats[&veh=&year=]` pré-agrège mensuel (coût/litres/CO₂), KPIs annuels et comparatif véhicules, cache `CacheService` ~1 h (`Code.gs` v3.7.0.0, ⚠️ redéploiement requis) ; **W59** client `js/statsApi.js` (cache localStorage TTL 1 h, `prewarmServerStats` au démarrage, helpers purs testés `tests/statsApi.test.js`) + carte « Bilan annuel ⚡ serveur » (`#serverSummary`) avec repli local si endpoint absent ; **U8** thème sombre confirmé (`js/theme.js` + `[data-theme="dark"]`) étendu au nouveau bloc ; **X26** mini-jauge budget annuel `gBudgetYear` (dépense année cible vs Budget mensuel × 12, rouge si dépassement) dans `vba/modGraphiques.bas` v4.7.0.0 |
| v4.6.0.0 | **Tableau de bord — export PDF, sélecteur d'année, refresh incrémental, garde-fou auto (X22-X25)** — `vba/modGraphiques.bas` + `vba/modSyncGS.bas` : **X23** bouton « Exporter en PDF » (`ExporterGraphiquesPDF` → `ExportAsFixedFormat` daté à côté du classeur) ; **X24** cellule `Graphiques!B4` « Année bilan » (vide = année récente) → KPIs + jauge CO₂ recalculés pour l'année choisie (`anneeCible`) ; **X25** graphiques/cartes nommés (`gPrice`…`gGauge`, `kpiTitle`/`kpiCard1..5`) **réutilisés** (`EnsureChart`/`EnsureShape`) au lieu de tout supprimer/recréer, `PurgeUnknown` ne nettoie que les objets inconnus ; **X22** l'appel auto en fin de `SyncCore` ne se déclenche que si l'onglet « Graphiques » existe déjà (`GraphSheetExists`) |
| v4.5.0.0 | **Graphiques recréés automatiquement après synchro (X19)** — `vba/modSyncGS.bas` appelle `modGraphiques.CreerGraphiquesWeb(silent:=True)` en fin de `SyncCore`, donc à l'ouverture (`SyncOnOpen`) **et** après un `SyncManuel`, **uniquement si des données ont changé** (`addedFromGS + updFromGS + sentToGS + sentUpdToGS > 0`) ; nouveau paramètre `silent` sur `CreerGraphiquesWeb` (pas de `MsgBox` bloquante en auto, barre d'état seulement ; le bouton « Recréer » garde la `MsgBox`) ; appel encadré par `On Error Resume Next` pour ne jamais casser la synchro |
| v4.4.0.0 | **Tableau de bord graphique Excel (`vba/modGraphiques.bas`)** — macro `CreerGraphiquesWeb` recréant sur l'onglet « Graphiques » les visualisations de l'app web en graphiques natifs : évolution prix multi-carburant, coût mensuel, tendance dépenses 6 mois + objectif, comparaison véhicules, CO₂ cumul mensuel, jauge CO₂ annuel, conso L/100 km, KPIs bilan annuel ; agrégats en VBA → feuille `_GraphData` masquée ; paramètres Budget/CO₂ sur l'onglet ; bouton de relance ; rejouable |
| v4.3.0.7 | **Date en vraie date (affichage JJ/MM/AAAA)** — `powerquery/GS_Pleins.m` convertit la colonne Date du texte US gviz (`M/d/yyyy`) en vraie date (`Date.From(DateTime.From(_,"en-US"))`) ; `Tableau2` affiche enfin JJ/MM/AAAA (le format ne s'appliquait pas à du texte) et le tri se fait directement sur la date |
| v4.3.0.6 | **Tri date ascendant de la requête `GS_Pleins` + fix cumul E85** — `powerquery/GS_Pleins.m` trie par Date en parsant le format US du CSV gviz (`DateTime.From(…, "en-US")`, sinon tri texte faux) ; corrige le `#VALEUR!` de la col N « Économie cumulée » de `Tableau2` sur la 1ʳᵉ ligne E85 (`N15<>""` → `ISNUMBER(N15)`, l'en-tête texte ne doit pas être additionné) |
| v4.3.0.5 | **Import de `Photo ticket` dans le classeur Excel** — l'URL Drive de la photo du ticket (col P du GS) est ramenée dans la table `GS_Pleins` par la Power Query (16 col A→P) ET la synchro VBA ; disposition : `P` = Photo ticket, `Q` = Modifie_local (déplacé de P) ; photo import-only (jamais renvoyée au GS) ; consts VBA `COL_PHOTO=16`/`COL_MODIFIED=17` (`modSyncGS.bas`, `GS_Pleins_snippet.bas`) |
| v4.3.0.4 | **Fix requête Power Query `GS_Pleins` + versionnement** — la requête lisait encore l'ancienne colonne `PrixS98` (supprimée du GAS en v2.3.0.0) sur 15 colonnes, décalant tout le mapping à partir de la 7 et corrompant la table à chaque *Actualiser*. Corrigée (`powerquery/GS_Pleins.m`, désormais traçée dans le dépôt) : lecture des 16 colonnes du schéma GAS, mapping A→O exact, endpoint gviz par nom d'onglet ; `Photo ticket` (col P du Sheet) volontairement exclue car la col P du classeur = marqueur VBA `Modifie_local` |
| v4.3.0.4 | **Audit alignement `.xlsm` ↔ GAS** — vérification VBA décompilé + Power Query + tables : modules de synchro conformes au backend ; détection du **retard du classeur local** (token S6 absent de `modSyncGS`, `modFeatures` v3.3.0.9 vs 3.3.0.10, fonction `General.SyncStationsGoogleForm` legacy à URL GAS obsolète — à retirer sans supprimer le reste du module) → procédure de resynchronisation documentée dans le CHANGELOG |
| v4.3.0.3 | **Renommage du Google Sheet → « Réponses - Suivi Conso Carburants »** — alignement du nom du classeur source. Aucun paramétrage à changer : accès par **ID** (`GS_SHEET_ID`/`SPREADSHEET_ID`) et **noms d'onglets** (`_ImportGS`, `Stations`…), jamais par le nom du fichier. Export local `Réponses - Suivi E85.xlsx` → `Réponses - Suivi Conso Carburants.xlsx` et classeur `excel/Suivi conso E85.xlsm` → `excel/Suivi Conso Carburants.xlsm` renommés (réfs README/INSTALL/ROADMAP) |
| v4.3.0.2 | **Renommage `suivi-e85` → `suivi-conso-carburant`** — dépôt GitHub + Pages (`/suivi-conso-carburant/`), `vite.config.js` base, `package.json`/`package-lock.json`, cache SW, préfixes CSV, doc & outillage `.claude`. `GAS_URL`/`GS_SHEET_ID`/tokens et clés localStorage `suivi_e85_*` conservés (zéro perte de données) |
| v4.3.0.1 | **Fix carte Budget/Tendance « invisibles » (W39/W50)** — encart d'état vide quand aucun budget n'est défini (au lieu d'un masquage silencieux) : « 💡 Définissez un budget mensuel… » → lien qui ouvre Réglages, déplie le bloc et focalise le champ (`buildBudgetBar`/`js/main.js`, CSS `.budget-box.hint`) |
| v4.3.0.0 | **Export comparatif véhicules CSV (W52)** — bouton 📥 dans l'en-tête de la carte `#comparatifCard` (vue Stats) ; `buildComparatifCSV()` (fonction pure testée) + `exportComparatifCSV()` exportent le tableau Véhicule / Pleins / Conso / Coût / Total / Litres / Km en `.csv` Excel FR (séparateur `;`, BOM UTF-8, virgule décimale) ; `initComparatifExport()` (délégation) câblé dans `main.js` |
| v4.3.0.0 | **Favori manuel épinglé 📌 (W53)** — bouton 📌 cliquable sur chaque station habituelle (vue Carte) pour l'épingler **en tête**, indépendamment du prix et du seuil de fréquentation auto ⭐ ; persistance `PINNED_STATIONS_KEY` (localStorage) ; les épinglées passent en haut dans l'ordre de tri courant (`_loadPinned`/`_togglePinned`, `stationsmap.js`) ; CSS `.smap-pin-btn`/`.smap-item.pinned` |
| v4.3.0.0 | **Export CSV global + séparateur (W54)** — second bouton 📦 « tout l'historique » à côté de l'export filtré 📥, et sélecteur de **séparateur** `;` (Excel FR) / `,` (tableurs anglo) persisté (`CSV_SEP_KEY`) ; `buildHistoriqueCSV(records, sep)` paramétré (décimale point quand `,` pour lever l'ambiguïté), `exportHistoriqueAllCSV()` + `initCsvSepSetting()` (`historique.js`) |
| v4.3.0.0 | **Objectif CO₂ : palier mensuel + courbe cumulée (W55)** — sous la jauge CO₂ annuelle (carte Stats), graphe SVG du **CO₂ évité cumulé mois par mois** de l'année + droite d'**objectif mensuel** (cible = objectif annuel / 12) pointillée ; états en avance / en retard sur la cible ; `computeCo2Monthly`/`buildCo2Monthly` (`stats.js`, même méthode « distance égale »), CSS `.co2m-*` |
| v4.3.0.0 | **Alerte de dépassement budget anticipée (W56)** — sous la barre Budget (carte Stats), encart « ⏰ À ce rythme, budget dépassé le JJ/MM · ≈ X € en fin de mois » calculé sur le **rythme du mois en cours** (dépense cumulée / jours écoulés → projection) ; `computeBudgetForecast()` (fonction pure testée), intégré à `buildBudgetBar` (affiché seulement si pas encore dépassé et franchissement prévu avant la fin du mois), CSS `.budget-forecast` |
| v4.2.0.0 | **Vue de départ configurable (U4)** — bloc « 🚀 Démarrage » dans Réglages (`#startView`, `START_VIEW_KEY`) : Accueil / Saisie / dernière vue consultée ; `resolveStartView()` au démarrage, deep-link prioritaire ; dernière vue ≠ accueil mémorisée (`LAST_VIEW_KEY`) |
| v4.2.0.0 | **Tuile « reprendre » sur l'Accueil (U5)** — `#homeResume` : « ↩️ Reprendre — <dernière vue> » + résumé du dernier plein (date · station · €/L) ; `getLastRecordSummary()` (mémoire vive ou cache localStorage), `renderHomeResume()` (`preferences.js`) à l'ouverture et au retour sur l'accueil |
| v4.2.0.0 | **Blocs Réglages repliables (U6)** — `.card.collapsible` repliée au clic sur le titre (chevron ▾/▸), état persistant par bloc (`COLLAPSE_PREFIX`), titre accessible clavier ; `initCollapsibles()` (`preferences.js`) |
| v4.2.0.0 | **Repères de cible sur les jauges (U7)** — marque 50 % (`.gauge-tick`) + échelle « 0 · 50 % · 🎯 cible · 100 % » (`.gauge-scale`) sous la barre Budget et la jauge CO₂ ; rend explicite que la valeur saisie = le max (100 %) (`buildBudgetBar`/`buildCo2Annuel`) |
| v4.1.0.0 | **Accueil par défaut à la connexion (U1)** — `DEFAULT_VIEW` passe de `saisie` à `accueil` (`router.js`) : au démarrage sans hash, l'app ouvre la page Accueil à tuiles ; deep-link `#/<vue>` toujours respecté |
| v4.1.0.0 | **Réglages regroupés par bloc (U2)** — chaque type de paramètre dans un encadré `.param-group` : Alertes+Seuil d'un même carburant (E85/Gazole/SP98) groupés (`buildFuelRows`), puis cartes distinctes Conversion E85 / Budget mensuel / Objectif CO₂ ; libellés budget & CO₂ précisant qu'ils fixent le maximum (100 %) de leur jauge |
| v4.1.0.0 | **Mise en page pleine hauteur (U3)** — `body` en flex colonne (`min-height: 100dvh`) + `#app-main { flex:1 }` : le footer reste collé en bas de l'écran sur toutes les pages, même quand le contenu ne remplit pas la hauteur |
| v4.0.0.0 | **Tendance du budget mensuel (W50)** — sous la barre de budget (carte Stats), mini-histogramme SVG des dépenses des 6 derniers mois + ligne d'objectif pointillée au niveau du budget ; barres vertes sous l'objectif / rouges au-dessus (`buildBudgetTrend`, réutilise `buildMonthlyReport`) ; affiché seulement si un budget est défini et qu'un mois a des dépenses |
| v4.0.0.0 | **Objectif CO₂ / éco-score annuel (W51)** — jauge « X kg CO₂ évités cette année » vers un objectif annuel configurable dans ⚙️ (`#objectifCo2`, `CO2_OBJECTIF_KEY`, défaut 200 kg) ; états go/near/done + équivalents parlants km thermiques (`CO2_THERMIQUE_PER_KM`) et arbres (`CO2_ARBRE_PAR_AN`) ; calcul distance égale sur les pleins E85 de l'année courante (`computeCo2Annuel`/`buildCo2Annuel`/`getObjectifCo2`/`initCo2ObjectifSetting`) |
| v4.0.0.0 | **Export CSV de l'historique (W25)** — bouton 📥 dans l'en-tête « Tous les pleins » exportant la vue filtrée courante en `.csv` (Excel FR : séparateur `;`, BOM UTF-8, décimales virgule) via `Blob`+`URL.createObjectURL` (`exportHistoriqueCSV`) ; fonction pure `buildHistoriqueCSV` testée (`tests/historique.test.js`, 4 cas) |
| v4.0.0.0 | **`commit.sh` verbeux** — sortie réécrite : étapes 1/9→9/9 annoncées (séparateur, icône, titre, temps écoulé `+Ns`), liste des fichiers modifiés, messages ✅/ℹ️/⚠️/❌ distincts, bilan final (durée, branche, hash court) |
| v2.2.4.x | Module VBA sync bidirectionnel `GS_Pleins` ↔ `_ImportGS` |
| v2.2.4.5 | Format date français + heure locale Paris pour Horodatage |
| v2.3.0.0 | Suppression colonne G "Prix S98 jour" (doublon avec K) |
| v2.3.0.1 | Logs sync via `SetStatus` (barre de statut + Immediate Window) au lieu de `MsgBox` |
| v2.3.1.x | Uniformisation visuelle des 6 boutons carburant + prix dans chaque bouton |
| v2.3.1.2 | Suppression du résumé prix verbeux sous le formulaire (redondant) |
| v2.3.1.3 | Fix overflow marqueurs carte sur bouton submit (z-index + fond opaque) |
| v2.3.2.0 | Dark mode **(W6)** — toggle header 🌙/☀️ + localStorage + auto `prefers-color-scheme` |
| v2.3.3.0 | Historique 5 derniers pleins **(W1)** — card en bas du formulaire, refresh auto après plein |
| v2.4.0.0 | **Tableau de bord Excel (X6)** — 10 KPIs + **format date français forcé (X5)** à l'ouverture |
| v2.4.0.3 | Fix `CreerTableauDeBord` — détection dynamique nom table + colonnes par position |
| v2.4.1.0 | **Dupliquer dernier plein (W2)** — bouton 📋 dans la carte historique, pré-remplit véhicule/type/station |
| v2.4.2.0 | **Validation km rétrograde (W3)** — warning live + confirm au submit, filtré par véhicule (web app) |
| v2.4.3.0 | **Badge rentabilité E85 (W5)** — vert/orange sous le toggle, seuil 66% du SP98 |
| v2.4.4.0 | **Stats live (W7)** — carte 4 KPIs (conso, €/100km, total 6 mois, éco E85) filtrée par véhicule |
| v2.4.5.0 | **Stats par carburant + station "Nom - Ville"** — conso/€/100km filtrés sur type courant + format station avec ville en proper case |
| v2.5.0.0 | **GitHub Actions CI (W13)** — lint ESLint sur `js/` + vérification cohérence `APP_VERSION` vs dernier tag Git |
| v2.5.0.0 | **Scan ticket de caisse (W17)** — bouton 🧾 dans le formulaire → photo → Gemini Vision API (GAS) → JSON → pré-remplissage automatique date / km / litres / prix / type / station |
| v2.5.0.0 | **Graphique prix E85 (X7)** — feuille "Graphiques" : ligne Date → Prix E85 filtrée depuis `GS_Pleins` |
| v2.5.0.0 | **Graphique conso L/100 km (X8)** — feuille "Graphiques" : ligne Date → L/100km calculée entre pleins consécutifs par véhicule |
| v2.6.0.0 | **PWA install prompt (W4)** — `manifest.json` + icône SVG ⛽ + bannière "Installer" Android/Chrome + bannière instruction iOS Safari + `theme-color` |
| v2.7.0.0 | **Vite bundler (W12)** — `vite.config.js`, `public/icons/`, workflow `deploy.yml` GitHub Actions → GitHub Pages, scripts `dev`/`build`/`preview` |
| v2.7.0.0 | **Tests unitaires Vitest (W14)** — `tests/utils.test.js` (30 cas) + `tests/prix.test.js` (8 cas, fetch mocké) ; job `test` ajouté dans `ci.yml` |
| v2.8.0.0 | **Carte statique stations habituelles + prix moyens (X10)** — card `#stationsMapCard` + mini-carte OSM non-interactive + liste triée par prix E85 moyen (`stationsmap.js`) ; coordonnées persistées en localStorage au fur et à mesure des sélections |
| v2.8.0.0 | **Détection doublons formulaire web** — warning inline `#dupeWarn` si date + km + litres identiques à un plein existant ; confirm supplémentaire à la soumission |
| v2.9.0.0 | **Auto sync_id à la saisie (X2)** — `Worksheet_Change` [F1] : UUID généré en col O dès la saisie, sans attendre le prochain `SyncManuel()` |
| v2.9.0.0 | **Validation kilométrage VBA (X3)** — `Worksheet_Change` [F3] : warning si km saisi < max km enregistré pour le même véhicule |
| v2.9.0.0 | **Détection doublons VBA (X13)** — `Worksheet_Change` [F4] : warning si Date + Km + Litres (au centilitre) correspondent à une ligne existante |
| v2.9.0.0 | **Édition bidirectionnelle complète (S2)** — col P dirty flag posé à la saisie + `ExportModificationsToGS` (bulkUpdate Excel→GS) + `UpdateRowFromGS` (GS→Excel si non dirty) ; résolution de conflit : Excel gagne si col P renseignée |
| v2.10.0.0 | **Scan ticket OCR client-side (W17 refonte)** — Tesseract.js remplace Gemini Vision ; multi-candidats prix/L + `Math.max()` ; détection SP95-E10 ; km séparateur espace ; ordre `setType` avant `fPrix` |
| v2.11.0.0 | **Mode hors-ligne (W8)** — Service Worker (Cache-First shell + Network-First dynamique) + file d'attente localStorage + badge `📵` + Background Sync + sync automatique au retour réseau |
| v2.11.0.0 | **Alertes prix E85 (W11)** — toggle + seuil configurable (défaut 0,850 €/L) + `new Notification()` avec `tag` anti-spam + carte Paramètres dans l'UI |
| v2.12.0.0 | **Scroll-to-top après submit (W24)** — `window.scrollTo({ top:0, behavior:'smooth' })` après enregistrement réussi et après mise en file hors-ligne ; le formulaire repasse en vue sans geste manuel |
| v2.12.0.0 | **Mini-graphique prix E85 inline (W28)** — `buildE85Sparkline()` dans `stats.js` : courbe SVG des 10 derniers prix E85, couleur selon tendance (↘ vert / ↗ rouge / → bleu), min/max + dernier prix affichés ; aucune lib externe |
| v2.12.0.0 | **Bannière "Mise à jour disponible" SW (W23)** — `_showUpdateBanner(reg)` dans `pwa.js` + handler `SKIP_WAITING` dans `sw.js` ; bouton "Actualiser" → `reg.waiting.postMessage` → `skipWaiting()` → `controllerchange` → reload automatique |
| v2.12.1.0 | **Tests E2E Playwright (T1)** — `tests/e2e.spec.js` : 5 scénarios (TC-01→TC-05) en mode mock GAS via `page.route()` ; `playwright.config.js` + `@playwright/test` ; scripts `test:e2e / test:e2e:ui / test:e2e:headed / test:e2e:report` |
| v2.13.0.0 | **Photo ticket Drive (W9)** — scan → base64 → transmis avec le plein → GAS upload Drive "Suivi E85 - Tickets" → URL en col P ; badge 📷 dans formulaire ; migration automatique col P sur sheets existants |
| v2.13.0.0 | **Comparateur multi-stations (W30)** — jusqu'à 40 stations retournées par l'API triées par prix E85 dans `#comparateurCard` ; station la moins chère mise en évidence (fond vert) ; `state._geoStations` |
| v2.13.0.0 | **Géoloc mémorisée localStorage (W31)** — `suivi_e85_last_geo` (TTL 1 h) ; stations précédentes affichées immédiatement pendant la mise à jour GPS |
| v2.13.0.0 | **Refactoring onclick → addEventListener (T2)** — suppression des ~20 handlers inline dans `index.html` ; `initStaticHandlers()`, `initTypeToggle()`, `initNearbyList()`, `initMapInteractions()` ; attributs `data-fuel-key`, `data-nearby-idx`, `data-map-pin-idx` |
| v2.13.0.0 | **Versioning dynamique cache SW (T3)** — plugin `swVersionPlugin` dans `vite.config.js` : token `__SW_VERSION__` → `APP_VERSION` en dev (middleware) et en build (remplacement dans `dist/sw.js`) |
| v2.14.0.0 | **Historique complet + filtres (W27→W32)** — bouton 📜 → carte `#histoireFullCard` ; filtres véhicule et carburant peuplés dynamiquement ; compteur ; scroll interne ; auto-refresh |
| v2.14.0.0 | **Prédiction prochain plein (W29→W33)** — `buildPrediction()` dans `stats.js` ; intervalle moyen km/jours entre pleins consécutifs (aberrations filtrées) ; "Prochain plein dans ~X km · ~Y j / vers Z km" |
| v2.15.0.0 | **Cache mémoire API ODS (T4)** — `Map _odsCache` clé `(lat,lon,rayon)` TTL 5 min dans `prix.js` ; zéro appel réseau redondant lors du changement de type de carburant |
| v2.15.0.0 | **Content Security Policy (T5)** — `<meta http-equiv="Content-Security-Policy">` dans `index.html` + fichier `_headers` Netlify ; origines autorisées : ODS, GAS, Google Sheets, Overpass, jsDelivr/unpkg, OSM tiles ; en-têtes complémentaires : `X-Frame-Options`, `Referrer-Policy`, `Permissions-Policy` |
| v2.15.0.0 | **Sync différentielle (S1)** — `?action=export&since=ISO` dans GAS `handleExport` filtre par `Horodatage >= since` ; cache localStorage `suivi_e85_hist_cache` + `suivi_e85_hist_since` dans `historique.js` ; fusion différentielle par `sync_id` ; fallback cache hors-ligne |
| v2.16.0.0 | **Web Share API (W26)** — bouton 📤 sur chaque entrée historique ; partage natif iOS/Android ; masqué via `body.no-share` si `navigator.share` non disponible ; délégation sur `#historiqueList` + `#histoireFullList` |
| v2.16.0.0 | **Auto-save brouillon (W15)** — `saveDraft()` sur chaque input formulaire ; `restoreDraft()` au démarrage avec délai 800 ms ; toast "📝 Brouillon restauré" ; `clearDraft()` après soumission/reset |
| v2.16.0.0 | **Rate limiting côté GAS (S7)** — `rateLimit(cid)` via `CacheService`, max 10 req/min par client UUID ; `_getClientId()` `crypto.randomUUID()` côté app, transmis dans chaque payload |
| v2.16.0.0 | **Audit dépendances npm + Dependabot (S9)** — job `audit` dans `ci.yml` (`npm audit --audit-level=moderate`, non-bloquant) ; `.github/dependabot.yml` npm hebdo + github-actions mensuel |
| v2.17.0.0 | **Sparkline multi-carburant + filtres (W34)** — `buildPrixSparkline()` remplace `buildE85Sparkline()` ; 6 carburants simultanés (E85/SP98/SP95/E10/Gazole/GPLc) sur axe temporel partagé ; toggles par carburant avec couleur `--spark-color` ; persistance localStorage `suivi_e85_spark_fuels` ; déduplication journalière, 20 points max par série |
| v3.0.0.0 | **Saisie km mains-libres (W35)** — champ km pré-rempli avec la valeur prédite par W33 (`getNextKmPrediction()`) dès le chargement de l'historique (`.then()`) ; bouton 🎤 avec icône SVG style iOS (`currentColor`) → `SpeechRecognition fr-FR` ; parser `_parseSpeechToNumber()` (chiffres + mots français) ; pulse rouge pendant l'écoute ; masqué si API indisponible ; conçu pour les motards avec gants |
| v3.0.0.1 | **Placeholder km dynamique + warning rétrograde brouillon** — placeholder statique obsolète `"11 596"` remplacé par `"km compteur"` puis mis à jour dynamiquement en `≥ X km` après chargement historique ; `restoreDraft()` appelle `onKmInput()` pour afficher immédiatement le warning si le km du brouillon est rétrograde |
| v3.0.0.3 | **Fix CSP scan ticket** — `https://cdn.jsdelivr.net` ajouté à `script-src` et `worker-src` dans `index.html` + `_headers` ; débloque `importScripts()` du worker Tesseract.js qui était rejeté par la Content Security Policy |
| v3.0.0.4 | **Fix CSP WebAssembly** — `'wasm-unsafe-eval'` ajouté à `script-src` dans `index.html` + `_headers` ; débloque `WebAssembly.instantiate()` de Tesseract.js lors du scan de ticket |
| v3.0.1.0 | **Amélioration OCR tickets** — prétraitement niveaux de gris + contraste + 1 600 px (`preprocessImage`) ; correction chiffres O→0, S→5 (`normalizeNumericText`) ; 4 formats de date dont mois français littéraux ; 5 patterns litres ; pattern prix après libellé carburant ; filtre station vs ligne montant ; km séparateur point ; marques AVIA, Netto, Agip, Gulf, Total Access |
| v3.0.1.1 | **Fix tickets Carrefour/TPE** — `quantite` (sans accent OCR) reconnu comme label litres ; `Prix unit.` (abrégé sans "aire") reconnu comme label prix |
| v3.0.0.2 | **Prédiction prochain plein dynamique** — `buildPrediction()` calcule le km et les jours **restants depuis aujourd'hui** (`daysLeft = avgDay − daysElapsed` · `kmLeft = avgKm − daysElapsed × avgKm/avgDay`) au lieu de l'intervalle moyen figé ; trois états : "Prochain plein dans ~X km · ~Y j" / "· aujourd'hui" / "Plein prévu il y a Y j" ; km cible absolu conservé en sous-titre |
| v3.1.0.0 | **Gemini Vision moteur principal de scan (W17)** — `scanWithGemini()` appelle le backend GAS (`action:scanTicket` → Gemini 2.0 Flash) en priorité quand en ligne ; fallback automatique vers Tesseract.js local si échec ou hors-ligne ; prompt GAS enrichi pour tickets abîmés (Quantite/Prix unit., années 2 chiffres, exclusion TVA, contrôle cohérence litres × prix ≈ total) ; parsing JSON robuste (fences ```` ```json ````) |
| v3.1.0.1 | **Bascule modèle Gemini 2.5 Flash** — `gemini-2.0-flash` renvoyait `RESOURCE_EXHAUSTED` / `limit: 0` (free tier non attribué sur certains projets) → `gemini-2.5-flash` dans `Code.gs`, quota gratuit séparé |
| v3.1.0.2 | **Fix « Réponse non parseable » Gemini 2.5** — modèle thinking : `thinkingConfig.thinkingBudget = 0` + `maxOutputTokens` 512 → 1024 pour que le JSON ne soit plus vidé par les jetons de réflexion |
| v3.1.0.3 | **Station lue reportée même si inconnue** — `fillFormFromTicket()` : si l'enseigne détectée par Gemini n'est pas dans le menu déroulant, bascule auto en saisie manuelle (`__autre`) + remplit `fAutre` avec le nom lu, au lieu de l'ignorer |
| v3.1.0.4 | **Station ticket → prix carburant auto + format "Enseigne - Ville"** — Gemini renvoie `enseigne`+`ville` séparés ; `applyTicketStation()` résout la station (liste connue / recherche ODS commune `_findStationInCommune` / saisie manuelle composée) et déclenche `fetchPricesAtCoords()` pour peupler les prix sur les boutons ; prix payé du ticket réinjecté après pour ne pas être écrasé ; corrige le « Aucune commune trouvée » |
| v3.1.0.5 | **Suppression d'un plein** — bouton 🗑️ sur chaque entrée d'historique ; confirmation puis suppression dans le Google Sheet `_ImportGS` (action `deletePlein` par `sync_id`), du cache local et de l'affichage ; stats + carte rafraîchies (`initHistoireDelete`, `handleDeletePlein`) |
| v3.1.0.6 | **Fix suppression « sync_id inconnu »** — `handleDeletePlein()` retrouve la colonne `sync_id` par en-tête (comme `handleExport`) au lieu d'un index codé en dur, comparaison après `trim()` |
| v3.1.0.7 | **Stations à jour automatiquement** — menu déroulant = union des stations curées (feuille « Stations » GS) ∪ stations vues dans l'historique des pleins (`mergeHistoryStations`) ; synchro Excel VBA pousse `tbl_stationEssence` → feuille « Stations » à chaque sync (`PushStationsToGS`) ; liste ne peut plus disparaître |
| v3.1.0.8 | **Fix import Excel « Erreur 13 »** — `ModuleImportGS` lisait le prix SP98 en colonne 7 (= Station essence, texte) → crash `ToDouble`. Corrigé : colonne SP98 détectée par en-tête + `ToDouble` blindé. Effet de bord résolu : la repousse auto des stations (en fin d'import) refonctionne |
| v3.1.0.9 | **Encart hors-ligne conditionnel** — « 📵 Mode hors-ligne » n'apparaît que si `navigator.onLine === false` (`updateOfflineRow` sur événements `online`/`offline`) + feedback au passage hors-ligne |
| v3.1.0.10 | **Fix dates import Excel à 1900** — `ParseGoogleDate` retire l'heure (format gviz `M/J/A HH:MM:SS`) et interprète le mois en premier (US) ; fini les dates `02/01/1900` sur les pleins importés |
| v3.1.0.11 | **Fix doublons import Excel** — déduplication par contenu (`PleinKey` = date\|km\|litres) au lieu du repère d'horodatage `Z1` peu fiable ; import idempotent |
| v3.1.0.12 | **Dédup immunisée + nettoyage doublons** — `PleinKey` = `km\|litres\|prix` (sans date, robuste aux dates mal parsées) + macro `NettoyerDoublons()` qui purge les doublons existants en gardant la 1ʳᵉ occurrence |
| v3.1.0.13 | **Sparkline tous carburants + rechargement forcé** — bouton 🔄 dans l'en-tête du graphique vide le cache localStorage et force un rechargement complet depuis le GAS ; seuil d'affichage abaissé à 1 point (au lieu de 2) pour que SP95/E10/Gazole/GPLc apparaissent dès la première donnée |
| v3.2.0.0 | **Économie brute / nette E85 (alignée Excel)** — surconsommation dynamique (conso E85 / conso S98 − 1, défaut 20 %), litres SP98 = litres / (1 + surconso) ; tuile « éco. brute E85 » + ligne « 💰 Économie nette » (brute − prix du kit) ; champ « Prix du kit E85 » dans Paramètres (défaut 514,54 € = cellule B5) |
| v3.2.0.1 | **Champ « Prix du kit E85 » visible dans Paramètres** — `#kitPrix` inséré dans la carte ⚙️ (la v3.2.0.0 avait la logique mais l'ancre HTML manquait) ; repli prix SP98 moyen quand la cellule SP98 d'un plein E85 est vide |
| v3.3.0.0 | **Mise en forme conditionnelle « Prix €/L » (X4)** — `vba/modFeatures.bas` `AppliquerMFCPrix` : colonne Prix en **vert** si le prix de la ligne < moyenne des 30 j précédents du **même carburant**, **rouge** si supérieur ; appliquée sur `GS_Pleins` **et** `Suivi Carburant` (colonnes Date/Type/Prix détectées par en-tête, formule `AVERAGEIFS` glissante) |
| v3.3.0.0 | **Onglet « Suivi (auto) » — vue dérivée (X14)** — `vba/modFeatures.bas` `CreerSuiviAuto` : table en lecture seule reconstruite par formules `INDEX` sur le tableau de `GS_Pleins` (Date, Type, Véhicule, Km, Nb km, Litres, Prix, Coût plein, L/100 km, Station) ; source unique de vérité, fin de la double saisie ; bouton « ↻ Rafraîchir » ; `RafraichirFeatures` lance MFC + vue |
| v3.3.0.0 | **Rapport mensuel automatique (X16)** — `Google Apps Script/RapportMensuel.gs` : trigger temporel le **1er du mois** → `MailApp.sendEmail()` avec le bilan du mois écoulé (nb pleins, total €, litres, distance, conso moyenne, économie E85 vs SP98 surconsommation +20 % incluse) ; `installerTriggerRapportMensuel()` une fois, `testRapportMensuel()` pour tester |
| v3.3.0.0 | **Formulaire de saisie d'un plein (VBA)** — `vba/modSaisie.bas` `NouveauPlein` : UserForm `frmPleinE85` construit par code (Véhicule/Carburant/Date/Km/Litres/Prix/Station, listes auto, coût live, validation km rétrograde, détection de doublon) ; ajout dans `GS_Pleins` avec `Horodatage` + `sync_id` UUID ; bouton « + Nouveau plein » |
| v3.3.0.2 | **Fix MFC Erreur 5 (Excel FR)** — `FormatConditions.Add` rejetait la formule à séparateurs US ; helpers `AjouterRegleMFC` + `TraduireFormuleLocale` (essai anglais → repli formule localisée via `FormulaLocal`) ; MFC « Prix €/L » robuste FR/US |
| v3.3.0.3 | **Messages barre d'état (VBA)** — helper `Statut` (`Application.StatusBar`) remplace les `MsgBox` de `modFeatures.bas` : retour discret non bloquant pour `RafraichirFeatures`/`AppliquerMFCPrix`/`CreerSuiviAuto` |
| v3.3.0.4 | **Barre d'état généralisée (VBA)** — tous les `MsgBox` non bloquants (`modFeatures`/`modSaisie`/`modDashboard`/`ModuleImportGS`/`GS_Pleins_snippet`) passent par le helper public `SetStatus` existant (doublon `Statut` supprimé) ; `MsgBox` réservé aux confirmations Oui/Non et au gate d'accès VBA |
| v3.3.0.5 | **Fix MFC « Colonnes introuvables sur GS_Pleins »** — `DetecterColonnes` assouplie (Date/Type/Prix par sous-chaîne, scan 25×40) + diagnostic `ListerEntetes` qui dump la ligne d'en-tête réelle dans l'Immediate Window |
| v3.3.0.6 | **Fix saisie « Instruction d'option dupliquée »** — `modSaisie.InjecterCode` vide le module du UserForm (`DeleteLines`) avant `AddFromString` : plus de double `Option Explicit` quand « Déclaration des variables obligatoire » est actif |
| v3.3.0.7 | **`frmNouveauPlein` branché sur `GS_Pleins`** — le formulaire perso (présentation conservée) enregistre désormais via `modSaisie.EnregistrerPlein` dans `GS_Pleins` (Horodatage + sync_id + anti-doublon) au lieu de `Tableau2` ; prix S98 → col J, véhicule = `DernierVehicule()` ; `EnregistrerPlein` gagne un param optionnel `prixS98Str` |
| v3.3.0.8 | **`frmNouveauPlein` multi-véhicules** — ComboBox `cmbVehicule` (liste `Vehicules` ∪ `GS_Pleins` col H, pré-sélection du dernier utilisé) ; véhicule choisi → col H ; validation ajoutée |
| v3.3.0.9 | **`Tableau2` = vue dérivée de `GS_Pleins`** — `SyncTableau2DepuisGS` tire les colonnes brutes par `INDEX`, **préserve les 9 colonnes de calcul**, aligne les lignes ; auto-déclenché après chaque saisie ; + macro `VerifierInstallation` + `INSTALL.md` |
| v3.3.0.10 | **Fix position INDEX Tableau2** — `ROW()-15` codé en dur remplacé par `ROW()-ROW(Tableau2[#Headers])` (robuste si la table est décalée) ; formule posée par macro (`.Formula` traduit la locale) |
| v3.3.0.11 | **Fix rapport mensuel** — économie E85 vs SP98 non nulle (prix SP98 de repli sur tout l'historique + prix des pleins Super 98) ; mois affiché en français (`moisEnFrancais`) au lieu de la locale anglaise |
| v3.4.0.0 | **Refresh quotidien des prix (S8)** — `RefreshPrix.gs` : trigger GAS `everyDays(1)` qui parcourt l'onglet `Stations`, fetch le prix E85 le plus bas de la ville via l'API gov et logue chaque résultat dans `_PrixHistory` (Station, Date, Type, Prix) ; `installerTriggerRefreshPrix()` / `testRefreshPrix()` |
| v3.4.0.0 | **Notification push depuis GAS (S10)** — `WebPush.gs` : Web Push VAPID **sans payload** (JWT ES256 / P-256 signé via jsrsasign, GAS ne supportant pas `BigInt`) envoyée quand un prix E85 ≤ seuil est détecté au refresh quotidien, **app fermée** ; abonnement côté client (`notifications.js` → `savePushSub`), handlers `push`/`notificationclick` du Service Worker (récupèrent le détail via `?action=lowprice`) ; `generateVapidKeys()` une fois |
| v3.4.0.0 | **Fix marqueurs carte « stations habituelles »** — `stationsmap.js` : les stations sans coordonnées en cache (saisies hors géoloc) n'apparaissaient pas ; géocodage de secours (ville extraite du nom → API gov) + re-rendu, tous les marqueurs s'affichent |
| v3.4.0.3 | **Carte habituelles — marqueurs ⛽ + cadrage fiable** — pin goutte vert E85 avec icône ⛽ ; moteur recentré sur l'empreinte des marqueurs + zoom adaptatif (corrige un marqueur rogné sous la carte) |
| v3.4.0.4 | **Carte habituelles — position utilisateur + push par seuil** — marqueur position courante avec icône véhicule (🏍️/🚗) ; push prix E85 filtrée par le seuil propre à chaque appareil (`_PushSubs.Seuil`) au lieu d'un seuil global |
| v3.4.0.0 | **Renommage « Suivi Conso. Carburants »** — titre de la page web + app (`index.html`, `manifest.json`, `Code.gs`) et rapport mensuel envoyé (`RapportMensuel.gs` : sujet, expéditeur, en-têtes) ; rapport mensuel déjà consultable dans l'app (carte X16) |
| v3.5.0.0 | **Itinéraire au clic sur un marqueur (S11)** — `js/itineraire.js` : popup d'infos station (nom, prix, distance, adresse) au clic d'un marqueur (carte habituelles **et** carte recherche/géoloc), avec demande de confirmation puis **itinéraire Waze** (`waze.com/ul?…&navigate=yes`, départ position GPS) et repli **Google Maps** |
| v3.5.0.1 | **Fix clic marqueurs carte habituelles** — `.smap-marker` était en `pointer-events:none` : les clics traversaient vers les tuiles et la popup S11 ne s'ouvrait pas (Windows + iPhone) ; `pointer-events:auto` rétabli |
| v3.6.0.0 | **Token secret sur les endpoints GAS (S6)** — `Code.gs` `tokenOk_()` en **mode souple** (contrôle actif seulement si la propriété de script `APP_TOKEN` est posée) ; token `APP_TOKEN` injecté dans tous les appels web (`config.js` + 7 modules) et VBA (`modSyncGS.bas` : export, bulkAdd/bulkUpdate/syncStations) ; la page HTML reste libre. Sécurité par obscurité (token dans le bundle public) mais relève le niveau d'accès |
| v3.6.0.0 | **Bilan annuel « Wrapped » (W37)** — `js/wrapped.js` + carte `#wrappedCard` : litres totaux, € dépensés, km parcourus, économie E85 cumulée vs SP98, station préférée, mois le plus cher ; sélecteur d'année + bascule de périmètre 🏍️/🚗🏍️ (véhicule courant ↔ tous, persistée) ; km = somme des deltas max−min par véhicule, économie alignée sur le dashboard (surconso E85 dynamique) |
| v3.6.0.0 | **Prix payé vs moins cher du secteur (W38)** — relevé quotidien ~7h (`RefreshPrix.gs`) étendu d'un scan des stations E85 les moins chères dans 15 km autour de `LAST_GEO` → `_PrixHistory` + `SECTOR_BEST_TODAY` ; `Code.gs` actions `saveLastGeo` (position mémorisée) + `sectorPrices` (prix mini secteur par jour) ; `js/secteur.js` (cache 2 h) ajoute « 💸 +X €/L vs le moins cher du secteur » sur chaque plein E85 + carte « 🏆 Moins cher du secteur » ; comportement prospectif (à partir du 1er refresh) |
| v3.7.0.0 | **Navigation par vues — onglets + pages (W42)** — `js/router.js` : routeur par hash (`#/saisie`, `#/stats`, `#/carte`, `#/historique`, `#/params`), barre d'onglets fixe en bas, retour navigateur/OS natif, titre header par vue ; `index.html` découpé en 5 `<section class="view">` ; fin du long scroll unique ; ouverture directe sur la Saisie ; carte habituelles re-cadrée au 1er affichage de l'onglet (event `viewchange`) ; « dupliquer dernier plein » bascule vers la Saisie |
| v3.8.0.0 | **Pull-to-refresh (W46)** — `js/pullrefresh.js` : tirer la page vers le bas en haut d'écran affiche un indicateur ↻ (résistance + seuil 70 px) puis recharge l'app ; pensé pour la PWA standalone iOS (pas de pull-to-refresh natif) ; tactile uniquement, n'interfère ni avec le scroll, ni avec les listes à défilement interne, ni avec la carte interactive |
| v3.9.0.0 | **Sélecteur de carburant sur la vue Carte (W47)** — `js/stationsmap.js` : sélecteur E85/Gazole/SP98 bascule le classement des stations habituelles + la mini-carte ; `computeStationAverages(fuelKey)` paramétré ; défaut = carburant du dernier plein du véhicule courant (ré-évalué au changement de véhicule) ; message dédié si pas de plein pour ce carburant ; segmented control CSS |
| v3.10.0.0 | **Prix secteur par carburant (W48)** — relevé quotidien GAS étendu E85/Gazole/SP98 (`RefreshPrix.gs` boucle 3 carburants, `SECTOR_BEST_TODAY`/`LAST_LOW_PRICES` par carburant) ; `Code.gs` `sectorPrices&fuel` + `lowprices` ; `secteur.js` cache par carburant ; « 🏆 Moins cher du secteur » affiché dans la vue Carte selon le sélecteur (prix live) |
| v3.10.0.0 | **Alertes push par carburant (W49)** — interrupteur + seuil indépendants E85/Gazole/SP98 dans Réglages (`#notifFuelRows`) ; `_PushSubs` + colonnes seuils par carburant ; `WebPush.gs envoyerPushPrixBasMulti` réveille selon le seuil de l'abonné ; `sw.js` lit `lowprices` + seuils en cache et notifie par carburant ; alertes foreground généralisées (`prix.js`) ; ⚠️ redéploiement GAS requis |
| v3.11.0.0 | **Budget carburant mensuel (W39)** — objectif € configurable dans ⚙️ (`#budgetMensuel`, `BUDGET_KEY`) + barre de progression dans la carte Stats comparant la dépense du mois courant (véhicule sélectionné, via `buildMonthlyReport`) à l'objectif ; 3 états vert/orange/rouge + alerte « ⚠️ +X € au-dessus » au dépassement (`buildBudgetBar`, `getBudgetMensuel`, `initBudgetSetting`) ; visuel uniquement, zéro réseau |
| v3.11.0.0 | **Empreinte CO₂ E85 vs essence (W40)** — tuile « 🌱 X kg CO₂ évités » dans la carte Stats ; référence SP95-E10 ≈ 2,21 kg CO₂/L, E85 ≈ −50 % à la combustion (`CO2_ESSENCE_PER_L`/`CO2_E85_RATIO`/`CO2_E85_PER_L`) ; calcul à distance égale (litres essence équivalents = litres E85 / (1 + surconso dynamique)) sur le cumul des pleins E85 ; méthodologie en sous-texte |
| v3.11.0.0 | **Comparaison entre véhicules (W41)** — `js/comparatif.js` + carte `#comparatifCard` (vue Stats) : `computeVehicleComparison()` agrège tous les véhicules (conso L/100 km + coût €/100 km), barres horizontales normalisées (SVG/CSS pur), véhicule courant surligné, plus économe mis en avant ; masquée si < 2 véhicules exploitables ; `renderComparatif()` appelée depuis `renderStats()` |
| v3.11.0.0 | **Tests des modules récents (T6)** — `jsdom` ajouté (env `// @vitest-environment jsdom` par fichier) ; `tests/itineraire.test.js` (popup station + liens Waze/Maps + échappement + fermetures), `tests/notifications.test.js` (seuils, activation, `checkPrixAlert` foreground, Notification mockée), `tests/stationsmap.test.js` (`computeStationAverages` + `cacheStationCoords`, `getAllRecords` mocké) ; **38 → 71 tests Vitest, tous au vert** |
| v3.12.0.0 | **Notion de station favorite (W36)** — vue Carte : badge ⭐ « favorite » dès `FAVORITE_MIN_PLEINS` pleins (défaut 4, `config.js`), distinct du ★ « meilleur prix » ; bouton de tri **💶 Prix ↔ ⭐ Fréquentation** persisté (`STATION_SORT_KEY`) ; tri d'affichage dans `renderStationsCard` (`computeStationAverages` inchangée). Pistes retenues (a)+(c) ; le favori manuel épinglé (b) reste en roadmap (W53) |
| v3.12.0.0 | **Écran d'accueil à tuiles (W43)** — 6ᵉ vue `#/accueil` : 5 tuiles cliquables (Saisie/Stats/Carte/Historique/Réglages) + 2 raccourcis (Nouveau plein / Dupliquer le dernier) ; bouton 🏠 dans le header ; vue de départ inchangée (Saisie), accueil hors séquence d'onglets (`router.js`, `index.html`, `main.js`) |
| v3.12.0.0 | **Gestes de navigation — swipe (W44)** — `js/swipe.js` : balayage gauche/droite (pointer events) entre onglets selon `SWIPE_ORDER`, transition latérale directionnelle (`view--slide-next/prev`) ; garde-fous geste horizontal + zones interactives ignorées + bord gauche réservé au retour natif ; `navigateRelative()` / `currentView()` ajoutés au routeur |
| v3.12.0.0 | **Badges de notification sur les onglets (W45)** — `js/badges.js` : pastille ⚙️ (alertes non configurées), compteur 📜 (pleins importés non consultés, persistant, se vide à l'ouverture), pastille 🗺️ (meilleur prix secteur du jour, se vide à l'ouverture, réarmé chaque jour) ; rafraîchi sur `viewchange`, après chargement historique/secteur et changement d'alerte |
| v3.12.1.0 | **Script `commit.sh` + lint propre (T7)** — création du script add → lint → tests → commit → pull --rebase → push (référencé par `CLAUDE.md`, jusqu'ici absent) ; gate qualité qui abandonne si lint/tests échouent. Nettoyage des 43 erreurs ESLint préexistantes pour rendre le gate vert : globals `Option`/`sessionStorage`, `\` inutiles dans les classes de caractères des regex OCR de `ticket.js`, blocs `catch {}` vides, **clé carburant dupliquée `'sp 95-e10'`** supprimée |
| v3.12.2.0 | **Hook `pre-commit` husky + lint-staged (T8)** — `.husky/pre-commit` → `lint-staged` (`eslint --max-warnings=0` + `vitest related --run`) sur les `js/**/*.js` mis en scène, à chaque commit même hors `commit.sh` ; script `prepare: husky` |
| v3.12.2.0 | **Synchro de version dans `commit.sh` (T9)** — extraction du `[vX.Y.Z.W]` du message → avertit si `APP_VERSION` (`config.js`) diverge et aligne `package.json` automatiquement (corrige le désalignement historique 3.11.0.0 ↔ 3.12.x) |
| v3.12.2.0 | **Tests parsing OCR `ticket.js` (T10)** — `tests/ticket.test.js` (22 cas, jsdom, tesseract mocké) sur `parseOCRText` : dates (5 formats), volume, prix €/L (+ artefact OCR), montant total + fallbacks, km, station, mapping carburant ; **71 → 93 tests Vitest** |
| v3.12.2.0 | **Lint strict `--max-warnings=0` (T11)** — 7 warnings résorbés (catch binding optionnel + import `FUEL_KEYS` retiré) puis CI/`commit.sh`/local échouent au moindre warning |
| v3.12.3.0 | **Fix swipe inopérant entre les vues (W44)** — `#app-main` sans `touch-action` → le navigateur annulait le pointer au moindre mouvement vertical (`pointercancel`), le balayage ne se déclenchait jamais ; `touch-action: pan-y pinch-zoom` réserve les gestes horizontaux au JS (scroll vertical + pinch conservés) |

---

> ✏️ Les améliorations réalisées sont retirées de leur tableau d'origine et ajoutées au tableau ci-dessus.
