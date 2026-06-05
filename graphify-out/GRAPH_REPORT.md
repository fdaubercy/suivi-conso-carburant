# Graph Report - .  (2026-06-05)

## Corpus Check
- 125 files · ~215,814 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 886 nodes · 1897 edges · 63 communities (51 shown, 12 thin omitted)
- Extraction: 96% EXTRACTED · 4% INFERRED · 0% AMBIGUOUS · INFERRED: 71 edges (avg confidence: 0.78)
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- [[_COMMUNITY_Fuel Type & Price Fetching|Fuel Type & Price Fetching]]
- [[_COMMUNITY_Notification Badges System|Notification Badges System]]
- [[_COMMUNITY_Map & Brand Detection|Map & Brand Detection]]
- [[_COMMUNITY_Google Auth  GIS|Google Auth / GIS]]
- [[_COMMUNITY_PWA Architecture & Config|PWA Architecture & Config]]
- [[_COMMUNITY_Brand Icon Registry|Brand Icon Registry]]
- [[_COMMUNITY_Historique & Export CSV|Historique & Export CSV]]
- [[_COMMUNITY_GAS Backend API|GAS Backend API]]
- [[_COMMUNITY_Build & Dependencies|Build & Dependencies]]
- [[_COMMUNITY_Price Alerts & Notifications|Price Alerts & Notifications]]
- [[_COMMUNITY_Preferences & Routing|Preferences & Routing]]
- [[_COMMUNITY_GAS Deploy Tooling|GAS Deploy Tooling]]
- [[_COMMUNITY_Annual Wrapped Report|Annual Wrapped Report]]
- [[_COMMUNITY_Excel Dashboard & VBA|Excel Dashboard & VBA]]
- [[_COMMUNITY_Multi-Fuel & Price History|Multi-Fuel & Price History]]
- [[_COMMUNITY_KPIs & Analytics|KPIs & Analytics]]
- [[_COMMUNITY_PWA Manifest|PWA Manifest]]
- [[_COMMUNITY_Offline & Push Notifications|Offline & Push Notifications]]
- [[_COMMUNITY_Multi-User & Sheets Sync|Multi-User & Sheets Sync]]
- [[_COMMUNITY_Pull-to-Refresh Gesture|Pull-to-Refresh Gesture]]
- [[_COMMUNITY_Commit & CI Scripts|Commit & CI Scripts]]
- [[_COMMUNITY_Roadmap & Future Features|Roadmap & Future Features]]
- [[_COMMUNITY_Price History Tests|Price History Tests]]
- [[_COMMUNITY_Data Integrity & Cache|Data Integrity & Cache]]
- [[_COMMUNITY_Map Rendering & Navigation|Map Rendering & Navigation]]
- [[_COMMUNITY_GAS & OCR Integration|GAS & OCR Integration]]
- [[_COMMUNITY_Vehicle Management|Vehicle Management]]
- [[_COMMUNITY_Annual Stats & Savings|Annual Stats & Savings]]
- [[_COMMUNITY_Price History Test Suite|Price History Test Suite]]
- [[_COMMUNITY_CICD & Quality Gate|CI/CD & Quality Gate]]
- [[_COMMUNITY_Geolocation & OSM|Geolocation & OSM]]
- [[_COMMUNITY_PWA Install & Update|PWA Install & Update]]
- [[_COMMUNITY_Bidirectional Sync|Bidirectional Sync]]
- [[_COMMUNITY_Interactive Maps Layer|Interactive Maps Layer]]
- [[_COMMUNITY_Dev Tooling & Claude|Dev Tooling & Claude]]
- [[_COMMUNITY_Excel Power Query & Security|Excel Power Query & Security]]
- [[_COMMUNITY_E2E Test Suite|E2E Test Suite]]
- [[_COMMUNITY_Excel VBA Dashboards|Excel VBA Dashboards]]
- [[_COMMUNITY_UI Navigation & Tabs|UI Navigation & Tabs]]
- [[_COMMUNITY_QA & Dependency Audit|QA & Dependency Audit]]
- [[_COMMUNITY_Lint & Versioning CI|Lint & Versioning CI]]
- [[_COMMUNITY_Ticket Scan & OCR|Ticket Scan & OCR]]
- [[_COMMUNITY_UI Components Layer|UI Components Layer]]
- [[_COMMUNITY_Price API Tests|Price API Tests]]
- [[_COMMUNITY_Service Worker|Service Worker]]
- [[_COMMUNITY_Dark Theme|Dark Theme]]
- [[_COMMUNITY_Form Draft Autosave|Form Draft Autosave]]
- [[_COMMUNITY_Voice Input|Voice Input]]
- [[_COMMUNITY_Badges Module|Badges Module]]
- [[_COMMUNITY_Pull-to-Refresh Module|Pull-to-Refresh Module]]
- [[_COMMUNITY_Swipe Gesture Module|Swipe Gesture Module]]
- [[_COMMUNITY_Form Draft Autosave B|Form Draft Autosave B]]
- [[_COMMUNITY_Vehicle Comparison|Vehicle Comparison]]
- [[_COMMUNITY_Dark Mode Theme|Dark Mode Theme]]
- [[_COMMUNITY_CSV Export Feature|CSV Export Feature]]
- [[_COMMUNITY_Voice Odometer Input|Voice Odometer Input]]

## God Nodes (most connected - your core abstractions)
1. `state` - 26 edges
2. `getAllRecords()` - 24 edges
3. `fetchPricesAtCoords()` - 23 edges
4. `authEnabled()` - 19 edges
5. `isAuthed()` - 18 edges
6. `submitForm()` - 18 edges
7. `applyHistPriceToForm()` - 18 edges
8. `showFeedback()` - 18 edges
9. `getIdToken()` - 16 edges
10. `renderStationsCard()` - 16 edges

## Surprising Connections (you probably didn't know these)
- `GAS legacy web-app HTML (single-file plein form)` --semantically_similar_to--> `PWA App Shell (index.html)`  [INFERRED] [semantically similar]
  Google Drive/Sauvegarde & Geolocalisation - Suivi conso SuperEthanol/Google Apps Script/index.html → index.html
- `js/brand.js BRANDS registry + getUnknownBrands()` --semantically_similar_to--> `Overpass API nearby E85 station search`  [INFERRED] [semantically similar]
  public/icons/brands/README.md → Google Drive/Sauvegarde & Geolocalisation - Suivi conso SuperEthanol/Google Apps Script/index.html
- `PWA App Shell (index.html)` --shares_data_with--> `Google Sheets data sync (bidirectional, last-write-wins)`  [INFERRED]
  index.html → Google Drive/Sauvegarde & Geolocalisation - Suivi conso SuperEthanol/Google Apps Script/GAS_UPDATE.md
- `Vite build job (npm run build -> dist)` --references--> `PWA App Shell (index.html)`  [INFERRED]
  .github/workflows/deploy.yml → index.html
- `APP_VERSION vs git tag coherence check` --references--> `main.js module entry`  [INFERRED]
  .github/workflows/ci.yml → index.html

## Import Cycles
- 3-file cycle: `js/comparatif.js -> js/historique.js -> js/stats.js -> js/comparatif.js`

## Hyperedges (group relationships)
- **Pipeline prix marché quotidien → app/Excel** — changelog_refresh_prix, changelog_prix_history, changelog_secteur, changelog_powerquery [EXTRACTED 0.90]
- **Synchro bidirectionnelle Excel ↔ Google Sheet** — changelog_vba_sync, changelog_powerquery, changelog_google_sheet, changelog_gas_backend [EXTRACTED 0.90]
- **Capture ticket → OCR/IA → formulaire** — changelog_ticket_scan, changelog_gemini_vision, changelog_tesseract_ocr, changelog_ticket_photo_drive [EXTRACTED 0.85]
- **Scan ticket: Gemini principal + repli Tesseract OCR + stockage Drive** — readme_ticket, readme_gemini, readme_tesseract, readme_gas_backend [EXTRACTED 1.00]
- **Sync bidirectionnelle Excel <-> GAS <-> Google Sheets via sync_id** — readme_vba_sync, readme_gas_backend, readme_importgs_sheet, readme_sync_id [EXTRACTED 1.00]
- **Relevé prix quotidien -> _PrixHistory -> alerte Web Push** — readme_refreshprix, readme_ods_api, readme_prixhistory_sheet, readme_webpush_gs [EXTRACTED 1.00]
- **Pipeline scan ticket OCR (Gemini + Tesseract + Drive)** — roadmap_scan_ticket, roadmap_gemini_vision, roadmap_ocr_tesseract, roadmap_photo_ticket_drive, roadmap_csp [INFERRED 0.85]
- **Flux de synchronisation Excel ↔ Google Sheets** — roadmap_sync_bidirectionnel_vba, roadmap_power_query_gs_pleins, roadmap_suppression_bidirectionnelle, roadmap_auto_sync_id, roadmap_parametres_metier_partages [INFERRED 0.85]
- **Flux relevé prix secteur + alertes push** — roadmap_refresh_prix_quotidien, roadmap_prix_history, roadmap_releve_prix_secteur, roadmap_notification_push_gas, roadmap_alertes_push_carburant [INFERRED 0.85]
- **Vite build -> Pages artifact -> GitHub Pages deploy** — workflows_deploy_pipeline, workflows_deploy_vite_build, workflows_deploy_github_pages, index_app_shell [EXTRACTED 1.00]
- **PWA/Excel <-> doPost <-> _ImportGS Sheet sync flow** — google_apps_script_gas_update_dopost, google_apps_script_gas_update_sheet_importgs, google_apps_script_gas_update_sheets_sync, install_vba_excel_modules, index_app_shell [INFERRED 0.85]
- **CI quality gates: lint + tests + coverage + version-check** — workflows_ci_eslint, workflows_ci_vitest, workflows_ci_coverage, workflows_ci_version_check [EXTRACTED 1.00]

## Communities (63 total, 12 thin omitted)

### Community 0 - "Fuel Type & Price Fetching"
Cohesion: 0.08
Nodes (62): _buildTypeToggle(), _fetchPricesNearUser(), initTypeToggle(), registerPriceCallback(), setType(), _updateHeaderBadges(), FUEL_CONFIG, FUEL_KEYS (+54 more)

### Community 1 - "Notification Badges System"
Cohesion: 0.06
Nodes (63): _getNum(), initBadges(), _markSeen(), refreshBadges(), SECTOR_FUELS, _setBadge(), _todayIso(), buildComparatifCSV() (+55 more)

### Community 2 - "Map & Brand Detection"
Cohesion: 0.07
Nodes (55): detectBrand(), bestZoom(), hideMap(), initMapInteractions(), latLonToPx(), _renderGoogleMap(), _renderMap(), showMap() (+47 more)

### Community 3 - "Google Auth / GIS"
Cohesion: 0.08
Nodes (52): authEnabled(), _avatarHtml(), _b64urlToJson(), _clearSession(), _dispatch(), ensureGis(), getIdToken(), getUser() (+44 more)

### Community 4 - "PWA Architecture & Config"
Cohesion: 0.05
Nodes (54): Suivi Conso Carburant (PWA), Token APP_TOKEN sur endpoints GAS (S6), Authentification Google (GIS / Auth.gs), Base Adresse Nationale (géocodage gouv.fr), Carte des résultats (js/carte.js), Configuration app (js/config.js), Content Security Policy (meta + _headers), deploy.yml (build Vite -> GitHub Pages) (+46 more)

### Community 5 - "Brand Icon Registry"
Cohesion: 0.07
Nodes (43): brandIconUrl(), brandInfo(), BRANDS, GENERIC_BRAND_ICON, _logUnknownBrand(), _unknownSeen, googleMapsEnabled(), loadClusterer() (+35 more)

### Community 6 - "Historique & Export CSV"
Cohesion: 0.09
Nodes (33): _allRecords, buildHistoriqueCSV(), chargerHistorique(), CSV_COLS, _csvSep(), _downloadCSV(), dupliquerDernier(), escapeHtml() (+25 more)

### Community 7 - "GAS Backend API"
Cohesion: 0.07
Nodes (36): js/brand.js BRANDS registry + getUnknownBrands(), Fuel brand icon catalogue (public/icons/brands), Dependabot github-actions ecosystem (monthly), Dependabot npm ecosystem (weekly), GAS backend Code.gs (doGet/doPost web app), doGet endpoints (export / stats / sectorPrices / lowprices / getParametres), doPost actions (plein / addStation / bulkAdd / bulkUpdate / scanTicket / setParametres), Parametres sheet (shared business params app<->Excel, P1) (+28 more)

### Community 8 - "Build & Dependencies"
Cohesion: 0.06
Nodes (33): dependencies, tesseract.js, description, devDependencies, eslint, @eslint/js, husky, jsdom (+25 more)

### Community 9 - "Price Alerts & Notifications"
Cohesion: 0.15
Nodes (25): ALERT_FUELS, buildFuelRows(), checkPrixAlert(), checkPrixE85Alert(), _defOf(), ensurePermission(), getPermission(), getSeuil() (+17 more)

### Community 10 - "Preferences & Routing"
Cohesion: 0.16
Nodes (23): initCollapsibles(), initHomeResume(), initPreferences(), initStartViewSetting(), renderHomeResume(), VIEW_META, currentView(), dirBetween() (+15 more)

### Community 11 - "GAS Deploy Tooling"
Cohesion: 0.13
Nodes (16): apiJson(), args, authHeaders(), C, cfg, CONFIG_PATH, DEFAULT_GAS_DIR, die() (+8 more)

### Community 12 - "Annual Wrapped Report"
Cohesion: 0.23
Nodes (11): buildWrapped(), computeSurconso(), escapeHtml(), getAvailableYears(), getScope(), initWrapped(), matchType(), MOIS_FR (+3 more)

### Community 13 - "Excel Dashboard & VBA"
Cohesion: 0.15
Nodes (15): Backup auto Google Drive (X12), Bouton Synchroniser GS_Pleins (X1), Script check-vba-drift (X18), Champ Coût du plein + calcul tri-directionnel (W71), Coût réel dans les agrégats Excel (W73), Dashboard Excel miroir de l'app (Accueil/Historique/Carte), Économies cumulées E85 vs SP98 (X9), Excel (axe) (+7 more)

### Community 14 - "Multi-Fuel & Price History"
Cohesion: 0.15
Nodes (13): Prix historique à la saisie d'un plein passé (W60), Signature ES256/P-256 via jsrsasign, Support multi-carburant (E85/Gazole/SP98/SP95/E10/GPLc), Alertes prix par carburant (notifications.js), File d'attente hors-ligne (offline.js), Onglet _PrixHistory (prix marché), Pull-to-refresh (pullrefresh.js, W46), PWA Service Worker (sw.js / pwa.js) (+5 more)

### Community 15 - "KPIs & Analytics"
Cohesion: 0.18
Nodes (12): Budget mensuel + tendance + alerte (W39/W50/W56), Empreinte CO₂ évité E85 vs essence (W40/W51/W55), Comparaison entre véhicules (comparatif.js, W41), Prédiction prochain plein (W33), Rapport mensuel par email (RapportMensuel.gs), Badge rentabilité E85 (rentabilite.js, W5), Sparkline multi-carburant des prix (W34), Statistiques live / KPIs (stats.js) (+4 more)

### Community 16 - "PWA Manifest"
Cohesion: 0.17
Nodes (11): background_color, description, display, icons, lang, name, orientation, short_name (+3 more)

### Community 17 - "Offline & Push Notifications"
Cohesion: 0.20
Nodes (12): Alertes prix E85 (W11), Alertes push par carburant (W49), API ODS prix carburant (data.gouv), Mode hors-ligne (W8), Notification push depuis GAS — Web Push VAPID (S10), Prix historique à la saisie d'un plein passé (W60/W61/W62), _PrixHistory (historique prix relevés), PWA install prompt (W4) (+4 more)

### Community 18 - "Multi-User & Sheets Sync"
Cohesion: 0.18
Nodes (11): Comptes Google / authentification GIS (U7), Auth.gs — vérification idToken JWT, Coût du plein éditable / calcul tri-directionnel (W71), Google Sheet (_ImportGS / source de vérité), Multi-utilisateur / isolation par email, Paramètres métier partagés (parametres.js, P1), Power Query GS_Pleins / PrixHistory (.m), Suppression de compte / RGPD (+3 more)

### Community 19 - "Pull-to-Refresh Gesture"
Cohesion: 0.33
Nodes (10): atTop(), buildIndicator(), initPullRefresh(), innerCanScrollUp(), onEnd(), onMove(), onStart(), reset() (+2 more)

### Community 20 - "Commit & CI Scripts"
Cohesion: 0.36
Nodes (9): commit.sh script, CI, die(), FORCE_COLOR, hr(), info(), ok(), step() (+1 more)

### Community 21 - "Roadmap & Future Features"
Cohesion: 0.20
Nodes (10): Roadmap — Suivi E85, Alerte d'anomalie de saisie (S15), Onglet Dashboard natif Sheets (G3), Filtre véhicule global persistant (U9), Google Apps Script / Google Sheets (backend), Prédiction prochain plein (W29/W33), Prochain plein estimé (W58), Rapport mensuel illustré QuickChart (S13) (+2 more)

### Community 22 - "Price History Tests"
Cohesion: 0.22
Nodes (6): D_OLD, D_RECENT, dMinus(), iso(), SECTOR_CACHE, TODAY

### Community 23 - "Data Integrity & Cache"
Cohesion: 0.22
Nodes (9): Token secret APP_TOKEN sur endpoints GAS (S6), Export CSV historique / comparatif (W25/W52/W54), Suppression de plein + tombstone soft-delete (S3), Détection de doublons à la saisie, Cache localStorage + sync différentielle ?since=, Historique des pleins + filtres (historique.js), Formulaire de saisie VBA (frmNouveauPlein / modSaisie), Synchro bidirectionnelle Excel ↔ GS (modSyncGS.bas) (+1 more)

### Community 24 - "Map Rendering & Navigation"
Cohesion: 0.22
Nodes (9): Icônes / logos d'enseignes (brand.js), Content Security Policy (index.html + _headers), Module de rendu Google Maps partagé (gmaprender.js), Carte interactive Google Maps (W63), Itinéraire vers station — Waze/Google Maps (itineraire.js), Plein écran des cartes/cards (mapfullscreen.js), Regroupement en clusters (markerclusterer), Favori épinglé 📌 / favorite auto ⭐ (W36/W53) (+1 more)

### Community 25 - "GAS & OCR Integration"
Cohesion: 0.28
Nodes (9): Backend Google Apps Script (Code.gs), Déploiement GAS automatisé (gas-deploy.mjs), GAS Manager (artifact + gas-config.json), Gemini Vision API (scan ticket), Renouvellement auto token OAuth (C6), Rate limiting côté GAS (S7), OCR Tesseract.js (repli hors-ligne), Photo ticket stockée sur Drive (W9) (+1 more)

### Community 26 - "Vehicle Management"
Cohesion: 0.56
Nodes (8): setVehiculeStatus(), _autoSelectLastVehicule(), chargerVehicules(), confirmerAjoutVehicule(), getVehicules(), onVehiculeChange(), _populateVehiculeSelect(), sauvegarderVehicules()

### Community 27 - "Annual Stats & Savings"
Cohesion: 0.22
Nodes (9): Bilan annuel Wrapped (W37), Budget carburant mensuel (W39), Économie brute / nette E85 alignée Excel (surconso + kit), E-mail Wrapped annuel (GAS), Empreinte CO₂ E85 + objectif (W40/W51/W55), Paramètres métier partagés last-write-wins (P1), Partage image du bilan Wrapped (W57), Rapport mensuel automatique (X16) (+1 more)

### Community 28 - "Price History Test Suite"
Cohesion: 0.25
Nodes (7): D_MID, D_OLD, D_RECENT, dMinus(), iso(), SECTOR_E85, TODAY

### Community 29 - "CI/CD & Quality Gate"
Cohesion: 0.29
Nodes (8): Suivi Conso Carburant (PWA), CI GitHub Actions (lint/test/coverage/audit, Node 24), Script commit.sh (gate qualité + sync version), ESLint flat config strict (--max-warnings=0), Hook pre-commit husky + lint-staged (T8), Tests E2E Playwright, Versioning X.Y.Z.W + APP_VERSION, Tests unitaires Vitest + couverture v8

### Community 30 - "Geolocation & OSM"
Cohesion: 0.29
Nodes (8): Géocodage Base Adresse Nationale (BAN), Géolocalisation des stations (js/geo.js), API prix carburants gouv (ODS), Carte OpenStreetMap maison (tuiles statiques), Enrichissement OSM / Overpass (js/osm.js), Recherche de station (ville/CP/adresse), Repli nom de station par adresse (resolveEnseigne), Onglet Carte Excel — Leaflet/OSM (modCarte.bas)

### Community 31 - "PWA Install & Update"
Cohesion: 0.39
Nodes (4): dismiss(), _hide(), initPWA(), triggerInstall()

### Community 32 - "Bidirectional Sync"
Cohesion: 0.29
Nodes (8): Agrégats serveur + résumé annuel (S12/W59), Auto sync_id UUID à la saisie (X2), Déduplication par contenu PleinKey, Formulaire de saisie d'un plein VBA (frmNouveauPlein), Suppression bidirectionnelle + force resync + conflits timestamp (S3/S4/S5), Sync bidirectionnel VBA GS_Pleins ↔ _ImportGS, Sync différentielle since=ISO (S1), Synchronisation Excel ↔ Google Sheets

### Community 33 - "Interactive Maps Layer"
Cohesion: 0.25
Nodes (8): Carte interactive Google Maps, Carte OSM stations (statique/Leaflet), Itinéraire Waze / Google Maps (S11), Icônes/logos d'enseignes sur marqueurs (W65/W66), Plein écran des cartes CSS (W63/W64), Recherche par adresse — Base Adresse Nationale (W63), Recherche stations Overpass groupée, Station favorite + favori épinglé (W36/W53)

### Community 34 - "Dev Tooling & Claude"
Cohesion: 0.32
Nodes (8): Dev / Outillage Claude, Déploiement GAS automatisé (gas-deploy.mjs), Pouvoirs API Google GAS + Sheets (C5), Pouvoirs navigateur — Claude in Chrome (C4), Renouvellement automatique du token OAuth (C6), Service account Google (C9), Skill gas-api (C1), Sync GAS → GitHub via clasp (C8)

### Community 35 - "Excel Power Query & Security"
Cohesion: 0.29
Nodes (7): Comptes utilisateurs — Se connecter avec Google (U7), Helper SetStatus barre d'état (VBA), Mise en forme conditionnelle Prix €/L (X4), Power Query GS_Pleins.m, Rate limiting côté GAS (S7), Token secret sur les endpoints GAS (S6), Vues dérivées par formules INDEX (Tableau2 / Suivi auto)

### Community 36 - "E2E Test Suite"
Cohesion: 0.29
Nodes (4): GAS_ERROR, GAS_SUCCESS, HIST_RECORD, PRIX_MOCK

### Community 37 - "Excel VBA Dashboards"
Cohesion: 0.33
Nodes (6): Tableau de bord Excel graphique (modGraphiques.bas), KPI dynamiques filtrés Excel (modDashboardKPI.bas), Macro maître Installer (modWorkbook.bas), Dashboard Excel miroir de l'app (Accueil/Historique/Reglages), Export PDF du tableau de bord Excel (X23), Mode plein écran kiosk Excel (Affichage.bas)

### Community 38 - "UI Navigation & Tabs"
Cohesion: 0.33
Nodes (6): Badges de notification sur les onglets (W45), Écran d'accueil à tuiles (W43), Navigation par vues — onglets + pages (W42), Pull-to-refresh (W46), Routeur par hash (router.js), Gestes de navigation — swipe (W44)

### Community 39 - "QA & Dependency Audit"
Cohesion: 0.40
Nodes (6): Script commit.sh — gate qualité (T7/T9), Audit dépendances npm + Dependabot (S9), GitHub Actions CI — lint + version (W13), Hook pre-commit husky + lint-staged (T8), Tests E2E Playwright (T1), Tests unitaires Vitest (W14/W72)

### Community 40 - "Lint & Versioning CI"
Cohesion: 0.50
Nodes (5): commit.sh (gate versionnement/lint/test), Dependabot (MAJ deps hebdo), ESLint (flat config, max-warnings=0), GitHub Actions CI (lint/test/audit/version), Vitest (tests unitaires)

### Community 41 - "Ticket Scan & OCR"
Cohesion: 0.50
Nodes (5): Content Security Policy (T5), Gemini Vision moteur de scan (GAS), OCR client-side Tesseract.js, Photo ticket Drive (W9), Scan ticket de caisse (W17)

### Community 42 - "UI Components Layer"
Cohesion: 0.50
Nodes (4): Badges de notification sur onglets (badges.js, W45), Écran d'accueil à tuiles (W43), Navigation par vues / routeur hash (router.js), Gestes de navigation swipe (swipe.js, W44)

### Community 43 - "Price API Tests"
Cohesion: 0.83
Nodes (3): emptyResp(), makeResp(), priceResp()

## Knowledge Gaps
- **205 isolated node(s):** `FORCE_COLOR`, `CI`, `ROOT`, `CONFIG_PATH`, `DEFAULT_GAS_DIR` (+200 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **12 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `state` connect `Map & Brand Detection` to `Fuel Type & Price Fetching`, `Notification Badges System`, `Google Auth / GIS`, `Brand Icon Registry`, `Historique & Export CSV`, `Annual Wrapped Report`, `Vehicle Management`, `Price History Test Suite`?**
  _High betweenness centrality (0.012) - this node is a cross-community bridge._
- **Why does `getAllRecords()` connect `Notification Badges System` to `Fuel Type & Price Fetching`, `Google Auth / GIS`, `Brand Icon Registry`, `Historique & Export CSV`, `Annual Wrapped Report`?**
  _High betweenness centrality (0.009) - this node is a cross-community bridge._
- **Why does `Backend Google Apps Script (Code.gs)` connect `GAS & OCR Integration` to `Multi-Fuel & Price History`, `KPIs & Analytics`, `Multi-User & Sheets Sync`, `Data Integrity & Cache`, `CI/CD & Quality Gate`?**
  _High betweenness centrality (0.005) - this node is a cross-community bridge._
- **What connects `FORCE_COLOR`, `CI`, `ROOT` to the rest of the system?**
  _224 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Fuel Type & Price Fetching` be split into smaller, more focused modules?**
  _Cohesion score 0.08385964912280702 - nodes in this community are weakly interconnected._
- **Should `Notification Badges System` be split into smaller, more focused modules?**
  _Cohesion score 0.05693693693693694 - nodes in this community are weakly interconnected._
- **Should `Map & Brand Detection` be split into smaller, more focused modules?**
  _Cohesion score 0.07315315315315316 - nodes in this community are weakly interconnected._