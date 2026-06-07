# Graph Report - .  (2026-06-07)

## Corpus Check
- Large corpus: 148 files · ~623,739 words. Semantic extraction will be expensive (many Claude tokens). Consider running on a subfolder.

## Summary
- 1017 nodes · 2182 edges · 85 communities (49 shown, 36 thin omitted)
- Extraction: 98% EXTRACTED · 2% INFERRED · 0% AMBIGUOUS · INFERRED: 54 edges (avg confidence: 0.85)
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- [[_COMMUNITY_Google Maps Rendering|Google Maps Rendering]]
- [[_COMMUNITY_Station Search & Results|Station Search & Results]]
- [[_COMMUNITY_Excel VBA Dashboard|Excel VBA Dashboard]]
- [[_COMMUNITY_App Initialization & State|App Initialization & State]]
- [[_COMMUNITY_Fuel Price History|Fuel Price History]]
- [[_COMMUNITY_GAS Backend Sync|GAS Backend Sync]]
- [[_COMMUNITY_Saisie Form & Validation|Saisie Form & Validation]]
- [[_COMMUNITY_CSS Layout & Theming|CSS Layout & Theming]]
- [[_COMMUNITY_Map Fullscreen Controls|Map Fullscreen Controls]]
- [[_COMMUNITY_Vehicle Management|Vehicle Management]]
- [[_COMMUNITY_Notifications & PWA|Notifications & PWA]]
- [[_COMMUNITY_Authentication|Authentication]]
- [[_COMMUNITY_Excel Charts X9X15|Excel Charts X9/X15]]
- [[_COMMUNITY_Historical Records|Historical Records]]
- [[_COMMUNITY_Navigation Menu VBA|Navigation Menu VBA]]
- [[_COMMUNITY_Community 15|Community 15]]
- [[_COMMUNITY_Community 16|Community 16]]
- [[_COMMUNITY_Community 17|Community 17]]
- [[_COMMUNITY_Community 18|Community 18]]
- [[_COMMUNITY_Community 19|Community 19]]
- [[_COMMUNITY_Community 20|Community 20]]
- [[_COMMUNITY_Community 21|Community 21]]
- [[_COMMUNITY_Community 22|Community 22]]
- [[_COMMUNITY_Community 23|Community 23]]
- [[_COMMUNITY_Community 24|Community 24]]
- [[_COMMUNITY_Community 25|Community 25]]
- [[_COMMUNITY_Community 26|Community 26]]
- [[_COMMUNITY_Community 27|Community 27]]
- [[_COMMUNITY_Community 28|Community 28]]
- [[_COMMUNITY_Community 29|Community 29]]
- [[_COMMUNITY_Community 30|Community 30]]
- [[_COMMUNITY_Community 31|Community 31]]
- [[_COMMUNITY_Community 32|Community 32]]
- [[_COMMUNITY_Community 33|Community 33]]
- [[_COMMUNITY_Community 34|Community 34]]
- [[_COMMUNITY_Community 35|Community 35]]
- [[_COMMUNITY_Community 36|Community 36]]
- [[_COMMUNITY_Community 37|Community 37]]
- [[_COMMUNITY_Community 38|Community 38]]
- [[_COMMUNITY_Community 39|Community 39]]
- [[_COMMUNITY_Community 40|Community 40]]
- [[_COMMUNITY_Community 41|Community 41]]
- [[_COMMUNITY_Community 42|Community 42]]
- [[_COMMUNITY_Community 43|Community 43]]
- [[_COMMUNITY_Community 44|Community 44]]
- [[_COMMUNITY_Community 45|Community 45]]
- [[_COMMUNITY_Community 46|Community 46]]
- [[_COMMUNITY_Community 47|Community 47]]
- [[_COMMUNITY_Community 48|Community 48]]
- [[_COMMUNITY_Community 49|Community 49]]
- [[_COMMUNITY_Community 50|Community 50]]
- [[_COMMUNITY_Community 51|Community 51]]
- [[_COMMUNITY_Community 52|Community 52]]
- [[_COMMUNITY_Community 53|Community 53]]
- [[_COMMUNITY_Community 54|Community 54]]
- [[_COMMUNITY_Community 55|Community 55]]
- [[_COMMUNITY_Community 56|Community 56]]
- [[_COMMUNITY_Community 57|Community 57]]
- [[_COMMUNITY_Community 58|Community 58]]
- [[_COMMUNITY_Community 59|Community 59]]
- [[_COMMUNITY_Community 60|Community 60]]
- [[_COMMUNITY_Community 63|Community 63]]
- [[_COMMUNITY_Community 64|Community 64]]
- [[_COMMUNITY_Community 65|Community 65]]
- [[_COMMUNITY_Community 66|Community 66]]
- [[_COMMUNITY_Community 67|Community 67]]
- [[_COMMUNITY_Community 68|Community 68]]
- [[_COMMUNITY_Community 69|Community 69]]
- [[_COMMUNITY_Community 70|Community 70]]
- [[_COMMUNITY_Community 71|Community 71]]
- [[_COMMUNITY_Community 72|Community 72]]
- [[_COMMUNITY_Community 73|Community 73]]
- [[_COMMUNITY_Community 74|Community 74]]
- [[_COMMUNITY_Community 75|Community 75]]
- [[_COMMUNITY_Community 76|Community 76]]
- [[_COMMUNITY_Community 77|Community 77]]
- [[_COMMUNITY_Community 78|Community 78]]
- [[_COMMUNITY_Community 79|Community 79]]
- [[_COMMUNITY_Community 80|Community 80]]
- [[_COMMUNITY_Community 81|Community 81]]
- [[_COMMUNITY_Community 82|Community 82]]
- [[_COMMUNITY_Community 83|Community 83]]
- [[_COMMUNITY_Community 84|Community 84]]

## God Nodes (most connected - your core abstractions)
1. `state` - 33 edges
2. `fetchPricesAtCoords()` - 27 edges
3. `getAllRecords()` - 24 edges
4. `authEnabled()` - 19 edges
5. `showFeedback()` - 19 edges
6. `isAuthed()` - 18 edges
7. `submitForm()` - 18 edges
8. `applyHistPriceToForm()` - 18 edges
9. `computeTriplet()` - 17 edges
10. `getIdToken()` - 16 edges

## Surprising Connections (you probably didn't know these)
- `Flux d'authentification Google — GIS One-Tap → JWT → session localStorage` --implements--> `initAuth()`  [INFERRED]
  C:/Users/fdaub/Documents/Github/suivi-conso-carburant/js/auth.js → js/auth.js
- `initAuth()` --implements--> `auth-changed CustomEvent — émis à chaque (dé)connexion Google`  [INFERRED]
  js/auth.js → C:/Users/fdaub/Documents/Github/suivi-conso-carburant/js/auth.js
- `Architecture carte duale — Google Maps (clé configurée) / OSM fallback` --implements--> `showMap()`  [INFERRED]
  C:/Users/fdaub/Documents/Github/suivi-conso-carburant/js/carte.js → js/carte.js
- `Offline & draft pattern — saveDraft localStorage + queuePlein offline fallback` --implements--> `saveDraft()`  [INFERRED]
  C:/Users/fdaub/Documents/Github/suivi-conso-carburant/js/formulaire.js → js/formulaire.js
- `Architecture carte duale — Google Maps (clé configurée) / OSM fallback` --implements--> `loadGoogleMaps()`  [INFERRED]
  C:/Users/fdaub/Documents/Github/suivi-conso-carburant/js/carte.js → js/gmap.js

## Import Cycles
- None detected.

## Hyperedges (group relationships)
- **Commit workflow: commit.sh + commitMe command + settings auto-push hook** — commit_sh, commands_commitme, claude_settings_json [EXTRACTED 1.00]
- **Excel dashboard button assets: PowerShell generator produces PNG buttons used in Graphiques sheet** — assets_make_buttons_script, assets_btn_recreer_png, assets_btn_export_pdf_png [EXTRACTED 1.00]
- **GAS deploy pipeline: gas-deploy.mjs + gas-config.json + skill gas-api + gasManager command** — gas_deploy, concept_gas_config_json, skill_gas_api, commands_gasmanager [EXTRACTED 1.00]
- **Architecture carte duale — showMap() orchestrant Google Maps (gmaprender) ou repli OSM** — js_carte_showmap, js_gmaprender_rendergooglestationmap, js_carte_rendermap, js_gmap_loadgooglemaps [INFERRED 0.90]
- **Geolocation → Station Discovery → Map + List render flow** — js_geo_geolocate, js_geo_searchnearby, js_geo_rendernearby, js_geo_rendercomparateur, js_geo_geocache [EXTRACTED 0.95]
- **Fullscreen button auto-injection via MutationObserver** — js_mapfullscreen_initmapfullscreen, js_mapfullscreen_mutationobserver, js_mapfullscreen_ensurecardbutttons, js_mapfullscreen_css_fullscreen_pattern [EXTRACTED 0.90]
- **Offline sync queue flow — queuePlein, syncQueue, state, ui** — js_offline_queueplein, js_offline_syncqueue, js_offline_updateofflinebadge, js_state_state [INFERRED 0.95]
- **Price display pipeline — fetchPricesAtCoords, applyPricesResult, state, ui fields** — js_prix_fetchpricesatcoords, js_prix_applypricessresult, js_state_state, js_ui_setfieldprice, js_ui_computetriplet [EXTRACTED 0.95]
- **Historical price form fill — secteur loadSectorPrices, resolveHistPrice, applyHistPriceToForm, ui** — js_secteur_loadsectorprices, js_secteur_resolvehistprice, js_secteur_applphistpricetoform, js_ui_setfieldprice [INFERRED 0.90]
- **Chaîne de synchronisation Excel ↔ GAS ↔ Google Sheets via Power Query GS_Pleins + PrixHistory** — powerquery_gs_pleins_gs_pleins, powerquery_prixhistory_prixhistory, powerquery_gs_pleins_importgs_sheet, powerquery_prixhistory_prixhistory_sheet, concept_excel_gs_sync [INFERRED 0.95]
- **Infrastructure PWA offline : manifest + service worker + icône** — public_manifest_pwa_manifest, public_sw_service_worker, public_sw_cache_strategy, public_icons_icon_svg [INFERRED 0.95]
- **E2E test suite (Playwright) — mock GAS, prix, overpass, gsheets, 5 scenarios** — tests_e2e_spec, tests_prix_historique_spec, js_formulaire, js_historique, js_carburant [EXTRACTED 0.95]
- **Historical price resolution flow: secteur.js → resolveHistPrice → applyHistPriceToForm, covered by both unit and E2E tests** — js_secteur, tests_prix_historique_test, tests_prix_historique_spec [EXTRACTED 0.95]
- **statsApi test suite covers cache and URL building** — tests_statsapi_test, tests_statsapi_test_describe_statskey, tests_statsapi_test_describe_buildstatsurl, tests_statsapi_test_describe_isfresh, tests_statsapi_test_describe_readstatscache, tests_statsapi_test_describe_writestatscache, js_statsapi [EXTRACTED 1.00]
- **ticket.test.js covers parseOCRText across all field types** — tests_ticket_test, tests_ticket_test_describe_date, tests_ticket_test_describe_volume, tests_ticket_test_describe_prix, tests_ticket_test_describe_montant, tests_ticket_test_describe_km, tests_ticket_test_describe_mapping, tests_ticket_test_describe_station, js_ticket [EXTRACTED 1.00]
- **ui.test.js covers DOM helpers with jsdom environment** — tests_ui_test, tests_ui_test_describe_computetriplet, tests_ui_test_describe_setfieldprice, tests_ui_test_describe_status_setters, tests_ui_test_describe_cpsearch, tests_ui_test_describe_submitstate, tests_ui_test_describe_showfeedback, js_ui [EXTRACTED 1.00]
- **utils.test.js covers pure functions (no DOM, no fetch)** — tests_utils_test, tests_utils_test_describe_haversine, tests_utils_test_describe_eschtml, tests_utils_test_describe_getcoords, tests_utils_test_describe_stationlabel, tests_utils_test_describe_resolveenseigne, tests_utils_test_describe_stationsublabel, tests_utils_test_describe_formatville, tests_utils_test_describe_composestationname, tests_utils_test_describe_odsurl, js_utils [EXTRACTED 1.00]
- **VBA Agent skill: Python driver + form spec + setup guide enabling Claude to edit Excel VBA via COM** — vba_agent_py_vba_agent, vba_agent_form_spec_userform_spec, vba_agent_setup_install_guide [EXTRACTED 1.00]
- **CI quality gates: lint + tests + coverage + version-check** — workflows_ci_eslint, workflows_ci_vitest, workflows_ci_coverage, workflows_ci_version_check [EXTRACTED 1.00]
- **Vite build -> Pages artifact -> GitHub Pages deploy** — workflows_deploy_pipeline, workflows_deploy_vite_build, workflows_deploy_github_pages, index_app_shell [EXTRACTED 1.00]
- **PWA/Excel <-> doPost <-> _ImportGS Sheet sync flow** — google_apps_script_gas_update_dopost, google_apps_script_gas_update_sheet_importgs, google_apps_script_gas_update_sheets_sync, install_vba_excel_modules, index_app_shell [INFERRED 0.85]
- **Scan ticket: Gemini principal + repli Tesseract OCR + stockage Drive** — readme_ticket, readme_gemini, readme_tesseract, readme_gas_backend [EXTRACTED 1.00]
- **Sync bidirectionnelle Excel <-> GAS <-> Google Sheets via sync_id** — readme_vba_sync, readme_gas_backend, readme_importgs_sheet, readme_sync_id [EXTRACTED 1.00]
- **Relevé prix quotidien -> _PrixHistory -> alerte Web Push** — readme_refreshprix, readme_ods_api, readme_prixhistory_sheet, readme_webpush_gs [EXTRACTED 1.00]
- **4 options de wallpaper SVG pour classeur Excel** — assets_wallpaper_opt1_moto_silhouette, assets_wallpaper_opt2_moto_voiture, assets_wallpaper_opt3_pattern_diagonal, assets_wallpaper_opt4_route_horizon [EXTRACTED 1.00]
- **Z900 photo wallpaper variants: source photos processed into light/medium/color faded versions for Excel background** — assets_z900_green_jpg, assets_z900_green_a_light_png, assets_z900_green_b_medium_png, assets_z900_green_c_color_png [INFERRED 0.95]

## Communities (85 total, 36 thin omitted)

### Community 0 - "Google Maps Rendering"
Cohesion: 0.06
Nodes (71): Flux d'authentification Google — GIS One-Tap → JWT → session localStorage, Offline & draft pattern — saveDraft localStorage + queuePlein offline fallback, Offline sync queue — localStorage queue for failed GAS POSTs, auth-changed CustomEvent — émis à chaque (dé)connexion Google, authEnabled(), _avatarHtml(), _b64urlToJson(), _clearSession() (+63 more)

### Community 1 - "Station Search & Results"
Cohesion: 0.07
Nodes (70): DOM helper functions, E85 profitability — E85/SP98 ratio analysis with dynamic overconsumption, Historical price resolution — nearest-prior sector/station price for past fills, _buildTypeToggle(), _fetchPricesNearUser(), initTypeToggle(), registerPriceCallback(), setType() (+62 more)

### Community 2 - "Excel VBA Dashboard"
Cohesion: 0.06
Nodes (68): Geolocation localStorage cache TTL 1h (W31), OCR ticket parsing logic, OSM brand enrichment — single Overpass grouped query to name stations, OSM enrichment (enrichStationsBulk) — background station name resolution, Pure utility functions, detectBrand(), Geo localStorage cache (GEO_CACHE_KEY, 1h TTL), geolocate() (+60 more)

### Community 3 - "App Initialization & State"
Cohesion: 0.05
Nodes (69): Stats cache TTL & freshness, _getNum(), initBadges(), _markSeen(), refreshBadges(), SECTOR_FUELS, _setBadge(), _todayIso() (+61 more)

### Community 4 - "Fuel Price History"
Cohesion: 0.05
Nodes (60): Architecture carte duale — Google Maps (clé configurée) / OSM fallback, brandIconUrl(), brandInfo(), BRANDS, GENERIC_BRAND_ICON, _logUnknownBrand(), _unknownSeen, bestZoom() (+52 more)

### Community 5 - "GAS Backend Sync"
Cohesion: 0.05
Nodes (54): Suivi Conso Carburant (PWA), Token APP_TOKEN sur endpoints GAS (S6), Authentification Google (GIS / Auth.gs), Base Adresse Nationale (géocodage gouv.fr), Carte des résultats (js/carte.js), Configuration app (js/config.js), Content Security Policy (meta + _headers), deploy.yml (build Vite -> GitHub Pages) (+46 more)

### Community 6 - "Saisie Form & Validation"
Cohesion: 0.05
Nodes (43): _comment, deployHistory, deployId, _doc, endpoints, createVersion, readScript, readSheet (+35 more)

### Community 7 - "CSS Layout & Theming"
Cohesion: 0.07
Nodes (33): _allRecords, buildHistoriqueCSV(), chargerHistorique(), CSV_COLS, _csvSep(), escapeHtml(), _filteredRecords(), fmtDate() (+25 more)

### Community 8 - "Map Fullscreen Controls"
Cohesion: 0.17
Nodes (31): build_parser(), cmd_backup(), cmd_build_form(), cmd_import(), cmd_inspect(), cmd_list(), cmd_remove(), cmd_run() (+23 more)

### Community 9 - "Vehicle Management"
Cohesion: 0.15
Nodes (26): LWW parameters sync — last-write-wins reconciliation across app/Excel/GAS, ALERT_FUELS, buildFuelRows(), checkPrixAlert(), checkPrixE85Alert(), _defOf(), ensurePermission(), getPermission() (+18 more)

### Community 10 - "Notifications & PWA"
Cohesion: 0.16
Nodes (24): initCollapsibles(), initHomeResume(), initPreferences(), initStartViewSetting(), renderHomeResume(), VIEW_META, currentView(), dirBetween() (+16 more)

### Community 11 - "Authentication"
Cohesion: 0.13
Nodes (20): VBA UserForm control kind (Label, TextBox, ComboBox, CommandButton, etc.), UserForm JSON spec (build-form schema), build_parser — argparse CLI parser for all subcommands, cmd_backup — export all VBA components to .bas/.cls/.frm files, cmd_build_form — create/replace a UserForm from JSON spec, cmd_import — import a .bas/.cls/.frm component file into workbook, cmd_inspect — inspect VBA components in workbook, cmd_list — list open Excel workbooks (+12 more)

### Community 12 - "Excel Charts X9/X15"
Cohesion: 0.12
Nodes (17): js/brand.js BRANDS registry + getUnknownBrands(), Fuel brand icon catalogue (public/icons/brands), GAS backend Code.gs (doGet/doPost web app), doGet endpoints (export / stats / sectorPrices / lowprices / getParametres), doPost actions (plein / addStation / bulkAdd / bulkUpdate / scanTicket / setParametres), Parametres sheet (shared business params app<->Excel, P1), RefreshPrix.gs daily price releve (6 fuels, _PrixHistory), scanTicket endpoint (Gemini OCR, W17) (+9 more)

### Community 13 - "Historical Records"
Cohesion: 0.21
Nodes (13): E85 economy calculation (surconso + SP98 reference price), Annual fuel recap (W37) — litres, €, km, économie E85, buildWrapped(), computeSurconso(), escapeHtml(), getAvailableYears(), getScope(), initWrapped() (+5 more)

### Community 14 - "Navigation Menu VBA"
Cohesion: 0.16
Nodes (15): brand.js, cacheStationCoords(), _geocodeMissing(), gmap.js, gmaprender.js, PRIX_API, S11 — Popup itinéraire, smap-zoom-ctrl (boutons zoom custom) (+7 more)

### Community 15 - "Community 15"
Cohesion: 0.19
Nodes (15): auth.js (U7), computeStationAverages(), historique.js, index.html, main.js, pwa.js, router.js (W42), secteur.js (+7 more)

### Community 16 - "Community 16"
Cohesion: 0.15
Nodes (13): scripts, build, dev, gas:deploy, lint, prepare, preview, test (+5 more)

### Community 17 - "Community 17"
Cohesion: 0.45
Nodes (11): setVehiculeStatus(), _autoSelectLastVehicule(), chargerVehicules(), confirmerAjoutVehicule(), getVehicules(), onVehiculeChange(), _populateGlobalVehiculeSelect(), _populateVehiculeSelect() (+3 more)

### Community 18 - "Community 18"
Cohesion: 0.21
Nodes (12): Plan d'implémentation — Découvrabilité boutons-icônes, Tâche 1 — Groupe A clusters en-tête (boutons 4-10), Tâche 2 — Groupe B boutons de champ (1-2), Tâche 3 — Groupe C superposition carte (bouton 3), Tâche 4 — Vérification complète + docs + version + push, Tableau des 10 boutons et libellés validés, Spec Design — Découvrabilité boutons-icônes, Approche Labels Partout — icône + micro-libellé (+4 more)

### Community 19 - "Community 19"
Cohesion: 0.17
Nodes (11): background_color, description, display, icons, lang, name, orientation, short_name (+3 more)

### Community 20 - "Community 20"
Cohesion: 0.18
Nodes (11): APP_TOKEN, APP_VERSION, BAN_API, CHANGELOG.md, Constantes CO2, config.js, FUEL_CONFIG, GAS_URL (+3 more)

### Community 21 - "Community 21"
Cohesion: 0.20
Nodes (11): C8 — Versionnage GAS, chargerVehicules(), Classeur Excel (.xlsm), gas-deploy.mjs, Google Apps Script (GAS), GOOGLE_CLIENT_ID, Google Sheets, P1 — Sync paramètres LWW (+3 more)

### Community 22 - "Community 22"
Cohesion: 0.27
Nodes (8): CSS Fullscreen Pattern (position:fixed, no Fullscreen API), _ensureCardButtons(), _ensureCardButtons(), _exitAll(), initMapFullscreen(), MutationObserver for button re-injection, setFsButtonState(), mapfullscreen-fsstate.test.js — setFsButtonState tests

### Community 23 - "Community 23"
Cohesion: 0.33
Nodes (10): atTop(), buildIndicator(), initPullRefresh(), innerCanScrollUp(), onEnd(), onMove(), onStart(), reset() (+2 more)

### Community 24 - "Community 24"
Cohesion: 0.18
Nodes (10): caption, code, controls, height, name, properties, BackColor, ShowModal (+2 more)

### Community 25 - "Community 25"
Cohesion: 0.20
Nodes (9): Suivi Conso Carburant, dependencies, tesseract.js, vitest, Tesseract.js, GROUP_A, html, Vite (build) (+1 more)

### Community 26 - "Community 26"
Cohesion: 0.36
Nodes (9): commit.sh script, CI, die(), FORCE_COLOR, hr(), info(), ok(), step() (+1 more)

### Community 27 - "Community 27"
Cohesion: 0.22
Nodes (10): Dependabot github-actions ecosystem (monthly), Dependabot npm ecosystem (weekly), Vitest coverage job (W72, non-blocking), ESLint job, CI workflow (lint/test/coverage/audit/version), APP_VERSION vs git tag coherence check, Vitest tests job (W14), GitHub Pages deployment target (+2 more)

### Community 28 - "Community 28"
Cohesion: 0.22
Nodes (6): D_OLD, D_RECENT, dMinus(), iso(), SECTOR_CACHE, TODAY

### Community 29 - "Community 29"
Cohesion: 0.22
Nodes (8): description, engines, node, lint-staged, js/**/*.js, name, type, version

### Community 30 - "Community 30"
Cohesion: 0.22
Nodes (9): devDependencies, eslint, @eslint/js, husky, jsdom, lint-staged, @playwright/test, vite (+1 more)

### Community 31 - "Community 31"
Cohesion: 0.29
Nodes (8): Logos d'enseignes (W65/W66), GOOGLE_MAPS_MAP_ID, AdvancedMarkerElement, MarkerClusterer, Projection Mercator (OSM), Repli OSM (tuiles OpenStreetMap), renderGoogleStationMap(), renderStationsCard()

### Community 32 - "Community 32"
Cohesion: 0.39
Nodes (4): dismiss(), _hide(), initPWA(), triggerInstall()

### Community 33 - "Community 33"
Cohesion: 0.33
Nodes (5): .claude/settings.json, command: commitMe, commit.sh gate (lint + vitest + rebase + push), settings.json hooks (Stop/PostToolUse: auto-push, doc agent, GAS nav detection), package.json

### Community 34 - "Community 34"
Cohesion: 0.40
Nodes (6): Synchronisation Excel ↔ Google Sheets via Power Query + VBA, FilteredUser — filtre multi-utilisateur sur Email (U7), GS_Pleins — requête Power Query v4.3.0.7 : import CSV Google Sheets _ImportGS, _ImportGS — onglet source Google Sheets (gviz CSV endpoint), PrixHistory — requête Power Query v4.18.0.0 : import prix marché depuis _PrixHistory, _PrixHistory — onglet Google Sheets source (relevé quotidien ~7h par RefreshPrix.gs)

### Community 35 - "Community 35"
Cohesion: 0.33
Nodes (3): Playwright E2E tests (Chromium, mock GAS via page.route), swVersionPlugin (Vite plugin injecting APP_VERSION into SW), Vitest unit tests + v8 coverage (235+ tests, 22 files)

### Community 36 - "Community 36"
Cohesion: 0.33
Nodes (6): X15 — Graphique scatter Prix E85 vs L/100, X20 — Interrupteur graphiques auto, X21 — Horodatage dernière génération, X9 — Graphique Économies cumulées, tasks/lessons.md, modGraphiques.bas

### Community 37 - "Community 37"
Cohesion: 0.50
Nodes (4): btn_export_pdf.png — dark blue rounded button 'Exporter en PDF' for Excel dashboard, btn_recreer.png — green rounded button 'Recreer les graphiques' for Excel dashboard, New-Button(), _make_buttons.ps1 — PowerShell script generating Excel dashboard button PNGs

### Community 38 - "Community 38"
Cohesion: 0.50
Nodes (5): wallpaper_opt1 — very faint outline silhouette of a motorcycle (filigrane), white background, wallpaper_opt2 — faint illustration of motorcycle + car side by side, multi-vehicle theme, wallpaper_opt3 — repeating diagonal pattern of small motorcycle + car icons, wallpaper style, wallpaper_opt4 — motorcycle in foreground + car at horizon on a road, depth perspective, wallpaper_preview.html — browser preview grid of all 4 wallpaper options

### Community 39 - "Community 39"
Cohesion: 0.40
Nodes (5): icon.svg — icône PWA : fond bleu marine #1B3A5C, emoji ⛽, texte E85 vert, manifest.json — PWA manifest (Suivi Conso. Carburants), Cache strategy — network-first same-origin, suivi-conso-carburant-shell cache, push event handler — alertes prix bas E85/Gazole/SP98 (payload-less VAPID), sw.js — Service Worker : network-first + cache fallback + Web Push alertes prix

### Community 40 - "Community 40"
Cohesion: 0.50
Nodes (5): commit.sh (gate versionnement/lint/test), Dependabot (MAJ deps hebdo), ESLint (flat config, max-warnings=0), GitHub Actions CI (lint/test/audit/version), Vitest (tests unitaires)

### Community 41 - "Community 41"
Cohesion: 0.67
Nodes (4): Wallpaper opt1 — Moto silhouette minimaliste (SVG), Wallpaper opt2 — Moto + Voiture côte à côte (SVG), Wallpaper opt3 — Pattern diagonal répété moto+voiture (SVG), Wallpaper opt4 — Route en perspective avec moto + voiture (SVG)

### Community 42 - "Community 42"
Cohesion: 0.83
Nodes (4): z900_green_A_light.png — very faint/bleached version of Z900 green photo for Excel background, z900_green_B_medium.png — slightly more visible bleached version of Z900 green photo, z900_green_C_color.png — faint color-tinted (green/blue hue) version of Z900 green photo, z900_green.jpg — photo of real green Kawasaki Z900 motorcycle (source photo)

### Community 43 - "Community 43"
Cohesion: 0.50
Nodes (3): hooks, PostToolUse, Stop

### Community 44 - "Community 44"
Cohesion: 0.50
Nodes (4): command: excel-vba-expert, VBA Agent COM injection via pywin32 (set-module, build-form, run), skill: vba-agent, vba-agent exemple-form.json

### Community 45 - "Community 45"
Cohesion: 0.50
Nodes (4): C9 — Service account Google, ROADMAP.md, W57 — Partage image Wrapped, X39 — Historique journalier des prix

### Community 47 - "Community 47"
Cohesion: 0.67
Nodes (3): Z900 Kawasaki — filigrane moyen N&B (opacité ~16%, flou Gaussien r=5), Z900 Kawasaki — filigrane couleur léger (opacité ~13%, flou r=3), z900_preview.html — galerie HTML des 6 variantes de filigrane Kawasaki Z900

## Knowledge Gaps
- **263 isolated node(s):** `_comment`, `_doc`, `_scopes`, `scriptId`, `sheetId` (+258 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **36 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `vitest` connect `Community 25` to `Community 30`?**
  _High betweenness centrality (0.029) - this node is a cross-community bridge._
- **Why does `devDependencies` connect `Community 30` to `Community 25`, `Community 29`?**
  _High betweenness centrality (0.029) - this node is a cross-community bridge._
- **Why does `scripts` connect `Community 16` to `Community 29`?**
  _High betweenness centrality (0.019) - this node is a cross-community bridge._
- **What connects `_comment`, `_doc`, `_scopes` to the rest of the system?**
  _277 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Google Maps Rendering` be split into smaller, more focused modules?**
  _Cohesion score 0.06162464985994398 - nodes in this community are weakly interconnected._
- **Should `Station Search & Results` be split into smaller, more focused modules?**
  _Cohesion score 0.07114170969592656 - nodes in this community are weakly interconnected._
- **Should `Excel VBA Dashboard` be split into smaller, more focused modules?**
  _Cohesion score 0.05740740740740741 - nodes in this community are weakly interconnected._