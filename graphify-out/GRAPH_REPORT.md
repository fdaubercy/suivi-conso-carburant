# Graph Report - .  (2026-06-06)

## Corpus Check
- Large corpus: 145 files � ~618,715 words. Semantic extraction will be expensive (many Claude tokens). Consider running on a subfolder.

## Summary
- 937 nodes · 2117 edges · 54 communities (37 shown, 17 thin omitted)
- Extraction: 96% EXTRACTED · 4% INFERRED · 0% AMBIGUOUS · INFERRED: 94 edges (avg confidence: 0.86)
- Token cost: 0 input · 614,027 output

## Community Hubs (Navigation)
- [[_COMMUNITY_Community 0|Community 0]]
- [[_COMMUNITY_Community 1|Community 1]]
- [[_COMMUNITY_Community 2|Community 2]]
- [[_COMMUNITY_Community 3|Community 3]]
- [[_COMMUNITY_Community 4|Community 4]]
- [[_COMMUNITY_Community 5|Community 5]]
- [[_COMMUNITY_Community 6|Community 6]]
- [[_COMMUNITY_Community 7|Community 7]]
- [[_COMMUNITY_Community 8|Community 8]]
- [[_COMMUNITY_Community 9|Community 9]]
- [[_COMMUNITY_Community 10|Community 10]]
- [[_COMMUNITY_Community 11|Community 11]]
- [[_COMMUNITY_Community 12|Community 12]]
- [[_COMMUNITY_Community 13|Community 13]]
- [[_COMMUNITY_Community 14|Community 14]]
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
- [[_COMMUNITY_Community 50|Community 50]]
- [[_COMMUNITY_Community 51|Community 51]]
- [[_COMMUNITY_Community 52|Community 52]]
- [[_COMMUNITY_Community 53|Community 53]]

## God Nodes (most connected - your core abstractions)
1. `state` - 37 edges
2. `fetchPricesAtCoords()` - 27 edges
3. `getAllRecords()` - 24 edges
4. `submitForm()` - 22 edges
5. `authEnabled()` - 20 edges
6. `showFeedback()` - 19 edges
7. `isAuthed()` - 18 edges
8. `applyHistPriceToForm()` - 18 edges
9. `renderStationsCard()` - 17 edges
10. `computeTriplet()` - 17 edges

## Surprising Connections (you probably didn't know these)
- `Google Apps Script backend (Web App + Google Sheet)` --shares_data_with--> `gas-config.json (scriptId, sheetId, deployId, oauth, deployHistory)`  [INFERRED]
  CLAUDE.md → .claude/gas-config.example.json
- `commit.sh gate (lint + vitest + rebase + push)` --conceptually_related_to--> `Conventional Commits format with [vX.Y.Z.W] tag`  [INFERRED]
  commit.sh → .claude/CLAUDE.md
- `PWA SPA (Progressive Web App, ES Modules, GitHub Pages)` --conceptually_related_to--> `swVersionPlugin (Vite plugin injecting APP_VERSION into SW)`  [INFERRED]
  CLAUDE.md → vite.config.js
- `GAS deploy merge strategy (never delete remote files)` --rationale_for--> `Google Apps Script backend (Web App + Google Sheet)`  [EXTRACTED]
  gas-deploy.mjs → CLAUDE.md
- `Vitest unit tests + v8 coverage (235+ tests, 22 files)` --semantically_similar_to--> `Playwright E2E tests (Chromium, mock GAS via page.route)`  [INFERRED] [semantically similar]
  vite.config.js → playwright.config.js

## Import Cycles
- None detected.

## Hyperedges (group relationships)
- **CI quality gates: lint + tests + coverage + version-check** — workflows_ci_eslint, workflows_ci_vitest, workflows_ci_coverage, workflows_ci_version_check [EXTRACTED 1.00]
- **Vite build -> Pages artifact -> GitHub Pages deploy** — workflows_deploy_pipeline, workflows_deploy_vite_build, workflows_deploy_github_pages, index_app_shell [EXTRACTED 1.00]
- **PWA/Excel <-> doPost <-> _ImportGS Sheet sync flow** — google_apps_script_gas_update_dopost, google_apps_script_gas_update_sheet_importgs, google_apps_script_gas_update_sheets_sync, install_vba_excel_modules, index_app_shell [INFERRED 0.85]
- **Scan ticket: Gemini principal + repli Tesseract OCR + stockage Drive** — readme_ticket, readme_gemini, readme_tesseract, readme_gas_backend [EXTRACTED 1.00]
- **Sync bidirectionnelle Excel <-> GAS <-> Google Sheets via sync_id** — readme_vba_sync, readme_gas_backend, readme_importgs_sheet, readme_sync_id [EXTRACTED 1.00]
- **Relevé prix quotidien -> _PrixHistory -> alerte Web Push** — readme_refreshprix, readme_ods_api, readme_prixhistory_sheet, readme_webpush_gs [EXTRACTED 1.00]
- **CI pipeline: ESLint + Vitest + Playwright + npm audit** — eslint_config, concept_vitest_coverage, concept_playwright_e2e, package_json [EXTRACTED 1.00]
- **Commit workflow: commit.sh + commitMe command + settings auto-push hook** — commit_sh, commands_commitme, claude_settings_json [EXTRACTED 1.00]
- **GAS deploy pipeline: gas-deploy.mjs + gas-config.json + skill gas-api + gasManager command** — gas_deploy, concept_gas_config_json, skill_gas_api, commands_gasmanager [EXTRACTED 1.00]
- **VBA Agent skill: Python driver + form spec + setup guide enabling Claude to edit Excel VBA via COM** — vba_agent_py_vba_agent, vba_agent_form_spec_userform_spec, vba_agent_setup_install_guide [EXTRACTED 1.00]
- **Excel dashboard button assets: PowerShell generator produces PNG buttons used in Graphiques sheet** — assets_make_buttons_script, assets_btn_recreer_png, assets_btn_export_pdf_png [EXTRACTED 1.00]
- **Z900 photo wallpaper variants: source photos processed into light/medium/color faded versions for Excel background** — assets_z900_green_jpg, assets_z900_green_a_light_png, assets_z900_green_b_medium_png, assets_z900_green_c_color_png [INFERRED 0.95]
- **Flux U7 — Auth Google : initAuth → GIS JWT → session → auth-changed → main.js reload perso** — js_auth_initauth, js_auth_auth_changed_event, js_main_persoallowed, js_formulaire_submitform, js_historique_chargerhistorique [INFERRED 0.90]
- **Architecture carte duale — showMap() orchestrant Google Maps (gmaprender) ou repli OSM** — js_carte_showmap, js_gmaprender_rendergooglestationmap, js_carte_rendermap, js_gmap_loadgooglemaps [INFERRED 0.90]
- **Sélection station géolocalisée — geolocate → searchNearby → pickStation → formulaire** — js_geo_geolocate, js_geo_searchnearby, js_geo_pickstation, js_formulaire_onstationchange [INFERRED 0.85]
- **Offline sync queue flow — queuePlein, syncQueue, state, ui** — js_offline_queueplein, js_offline_syncqueue, js_offline_updateofflinebadge, js_state_state [INFERRED 0.95]
- **Price display pipeline — fetchPricesAtCoords, applyPricesResult, state, ui fields** — js_prix_fetchpricesatcoords, js_prix_applypricessresult, js_state_state, js_ui_setfieldprice, js_ui_computetriplet [EXTRACTED 0.95]
- **Historical price form fill — secteur loadSectorPrices, resolveHistPrice, applyHistPriceToForm, ui** — js_secteur_loadsectorprices, js_secteur_resolvehistprice, js_secteur_applphistpricetoform, js_ui_setfieldprice [INFERRED 0.90]
- **Chaîne de synchronisation Excel ↔ GAS ↔ Google Sheets via Power Query GS_Pleins + PrixHistory** — powerquery_gs_pleins_gs_pleins, powerquery_prixhistory_prixhistory, powerquery_gs_pleins_importgs_sheet, powerquery_prixhistory_prixhistory_sheet, concept_excel_gs_sync [INFERRED 0.95]
- **Infrastructure PWA offline : manifest + service worker + icône** — public_manifest_pwa_manifest, public_sw_service_worker, public_sw_cache_strategy, public_icons_icon_svg [INFERRED 0.95]
- **Bilan annuel Wrapped : buildWrapped + computeSurconso + renderWrapped + initWrapped** — js_wrapped_buildwrapped, js_wrapped_computesurconso, js_wrapped_renderwrapped, js_wrapped_initwrapped [EXTRACTED 1.00]
- **E2E test suite (Playwright) — mock GAS, prix, overpass, gsheets, 5 scenarios** — tests_e2e_spec, tests_prix_historique_spec, js_formulaire, js_historique, js_carburant [EXTRACTED 0.95]
- **Vitest unit test suite covering all JS modules with jsdom/node environments** — tests_auth_test, tests_carburant_test, tests_carte_test, tests_comparatif_test, tests_formulaire_test, tests_geo_test, tests_historique_test, tests_itineraire_test, tests_notifications_test, tests_offline_test, tests_prix_test, tests_pwa_test, tests_recherche_test, tests_state_test, tests_stationsmap_test, tests_stats_test [EXTRACTED 0.95]
- **Historical price resolution flow: secteur.js → resolveHistPrice → applyHistPriceToForm, covered by both unit and E2E tests** — js_secteur, tests_prix_historique_test, tests_prix_historique_spec [EXTRACTED 0.95]
- **statsApi test suite covers cache and URL building** — tests_statsapi_test, tests_statsapi_test_describe_statskey, tests_statsapi_test_describe_buildstatsurl, tests_statsapi_test_describe_isfresh, tests_statsapi_test_describe_readstatscache, tests_statsapi_test_describe_writestatscache, js_statsapi [EXTRACTED 1.00]
- **ticket.test.js covers parseOCRText across all field types** — tests_ticket_test, tests_ticket_test_describe_date, tests_ticket_test_describe_volume, tests_ticket_test_describe_prix, tests_ticket_test_describe_montant, tests_ticket_test_describe_km, tests_ticket_test_describe_mapping, tests_ticket_test_describe_station, js_ticket [EXTRACTED 1.00]
- **ui.test.js covers DOM helpers with jsdom environment** — tests_ui_test, tests_ui_test_describe_computetriplet, tests_ui_test_describe_setfieldprice, tests_ui_test_describe_status_setters, tests_ui_test_describe_cpsearch, tests_ui_test_describe_submitstate, tests_ui_test_describe_showfeedback, js_ui [EXTRACTED 1.00]
- **utils.test.js covers pure functions (no DOM, no fetch)** — tests_utils_test, tests_utils_test_describe_haversine, tests_utils_test_describe_eschtml, tests_utils_test_describe_getcoords, tests_utils_test_describe_stationlabel, tests_utils_test_describe_resolveenseigne, tests_utils_test_describe_stationsublabel, tests_utils_test_describe_formatville, tests_utils_test_describe_composestationname, tests_utils_test_describe_odsurl, js_utils [EXTRACTED 1.00]

## Communities (54 total, 17 thin omitted)

### Community 0 - "Community 0"
Cohesion: 0.05
Nodes (99): DOM helper functions, E85 profitability — E85/SP98 ratio analysis with dynamic overconsumption, Historical price resolution — nearest-prior sector/station price for past fills, Offline & draft pattern — saveDraft localStorage + queuePlein offline fallback, authEnabled(), promptLogin(), _buildTypeToggle(), _fetchPricesNearUser() (+91 more)

### Community 1 - "Community 1"
Cohesion: 0.05
Nodes (77): OCR ticket parsing logic, OSM brand enrichment — single Overpass grouped query to name stations, Pure utility functions, detectBrand(), bestZoom(), hideMap(), initMapInteractions(), latLonToPx() (+69 more)

### Community 2 - "Community 2"
Cohesion: 0.06
Nodes (62): Stats cache TTL & freshness, buildComparatifCSV(), CMP_COLS, computeVehicleComparison(), exportComparatifCSV(), initComparatifExport(), renderComparatif(), getAllRecords() (+54 more)

### Community 3 - "Community 3"
Cohesion: 0.06
Nodes (53): Architecture carte duale — Google Maps (clé configurée) / OSM fallback, brandIconUrl(), brandInfo(), BRANDS, GENERIC_BRAND_ICON, _logUnknownBrand(), _unknownSeen, GOOGLE_MAPS_API_KEY — clé publique Maps JS API (restriction domaine) (+45 more)

### Community 4 - "Community 4"
Cohesion: 0.05
Nodes (54): Suivi Conso Carburant (PWA), Token APP_TOKEN sur endpoints GAS (S6), Authentification Google (GIS / Auth.gs), Base Adresse Nationale (géocodage gouv.fr), Carte des résultats (js/carte.js), Configuration app (js/config.js), Content Security Policy (meta + _headers), deploy.yml (build Vite -> GitHub Pages) (+46 more)

### Community 5 - "Community 5"
Cohesion: 0.10
Nodes (40): Flux d'authentification Google — GIS One-Tap → JWT → session localStorage, LWW parameters sync — last-write-wins reconciliation across app/Excel/GAS, Offline sync queue — localStorage queue for failed GAS POSTs, auth-changed CustomEvent — émis à chaque (dé)connexion Google, _avatarHtml(), _b64urlToJson(), _clearSession(), _dispatch() (+32 more)

### Community 6 - "Community 6"
Cohesion: 0.07
Nodes (37): _allRecords, buildHistoriqueCSV(), chargerHistorique(), CSV_COLS, _csvSep(), _downloadCSV(), dupliquerDernier(), escapeHtml() (+29 more)

### Community 7 - "Community 7"
Cohesion: 0.12
Nodes (32): _getNum(), initBadges(), _markSeen(), refreshBadges(), SECTOR_FUELS, _setBadge(), _todayIso(), VAPID_PUBLIC_KEY — clé publique Web Push pour notifications (S8) (+24 more)

### Community 8 - "Community 8"
Cohesion: 0.07
Nodes (36): js/brand.js BRANDS registry + getUnknownBrands(), Fuel brand icon catalogue (public/icons/brands), Dependabot github-actions ecosystem (monthly), Dependabot npm ecosystem (weekly), GAS backend Code.gs (doGet/doPost web app), doGet endpoints (export / stats / sectorPrices / lowprices / getParametres), doPost actions (plein / addStation / bulkAdd / bulkUpdate / scanTicket / setParametres), Parametres sheet (shared business params app<->Excel, P1) (+28 more)

### Community 9 - "Community 9"
Cohesion: 0.06
Nodes (33): dependencies, tesseract.js, description, devDependencies, eslint, @eslint/js, husky, jsdom (+25 more)

### Community 10 - "Community 10"
Cohesion: 0.17
Nodes (31): build_parser(), cmd_backup(), cmd_build_form(), cmd_import(), cmd_inspect(), cmd_list(), cmd_remove(), cmd_run() (+23 more)

### Community 11 - "Community 11"
Cohesion: 0.15
Nodes (26): mountGsiButton(), getLastRecordSummary(), initCollapsibles(), initHomeResume(), initPreferences(), initStartViewSetting(), renderHomeResume(), VIEW_META (+18 more)

### Community 12 - "Community 12"
Cohesion: 0.13
Nodes (16): apiJson(), args, authHeaders(), C, cfg, CONFIG_PATH, DEFAULT_GAS_DIR, die() (+8 more)

### Community 13 - "Community 13"
Cohesion: 0.13
Nodes (20): VBA UserForm control kind (Label, TextBox, ComboBox, CommandButton, etc.), UserForm JSON spec (build-form schema), build_parser — argparse CLI parser for all subcommands, cmd_backup — export all VBA components to .bas/.cls/.frm files, cmd_build_form — create/replace a UserForm from JSON spec, cmd_import — import a .bas/.cls/.frm component file into workbook, cmd_inspect — inspect VBA components in workbook, cmd_list — list open Excel workbooks (+12 more)

### Community 14 - "Community 14"
Cohesion: 0.12
Nodes (13): D_OLD, D_RECENT, dMinus(), iso(), SECTOR_CACHE, TODAY, D_MID, D_OLD (+5 more)

### Community 15 - "Community 15"
Cohesion: 0.12
Nodes (17): Station brand logos — collection SVG des enseignes pétrolières et grande distribution, auchan.svg — logo Auchan (rouge #D6180B, silhouette stylisée Auchan), avia.svg — logo Avia (fond rouge #E2001A, lettres AV blanches), bp.svg — logo BP (fleur hélicoïdale verte Helios, couleurs #009900 et #99CC00), carrefour.svg — logo Carrefour (chevron rouge + flèches bleu #005bab/#ed1c24), casino.svg — logo Casino (enseigne Casino rouge #cc2131, lettres stylisées), colruyt.svg — logo Colruyt (fond rouge #E2001A, lettres CR blanches), cora.svg — logo Cora (ellipse bleu #283f93, texte CORA rouge #eb212e) (+9 more)

### Community 16 - "Community 16"
Cohesion: 0.17
Nodes (14): CLAUDE.md (root), command: excel-vba-expert, command: majFilesMe, Content Security Policy (index.html + _headers, Google Maps, BAN, OSM, CDN), Excel VBA bidirectional sync (xlsm + VBA + WinHttp), Google Apps Script backend (Web App + Google Sheet), GAS deploy merge strategy (never delete remote files), Graphify knowledge map (graph.json, GRAPH_REPORT.md, graph.html) (+6 more)

### Community 17 - "Community 17"
Cohesion: 0.23
Nodes (12): buildWrapped(), computeSurconso(), escapeHtml(), getAvailableYears(), getScope(), initWrapped(), matchType(), MOIS_FR (+4 more)

### Community 18 - "Community 18"
Cohesion: 0.14
Nodes (13): _comment, deployHistory, deployId, _doc, oauth, client_id, client_secret, _howto (+5 more)

### Community 19 - "Community 19"
Cohesion: 0.21
Nodes (8): .claude/settings.json, command: commitMe, commit.sh gate (lint + vitest + rebase + push), settings.json hooks (Stop/PostToolUse: auto-push, doc agent, GAS nav detection), Playwright E2E tests (Chromium, mock GAS via page.route), PWA SPA (Progressive Web App, ES Modules, GitHub Pages), swVersionPlugin (Vite plugin injecting APP_VERSION into SW), Vitest unit tests + v8 coverage (235+ tests, 22 files)

### Community 20 - "Community 20"
Cohesion: 0.17
Nodes (11): background_color, description, display, icons, lang, name, orientation, short_name (+3 more)

### Community 21 - "Community 21"
Cohesion: 0.33
Nodes (10): atTop(), buildIndicator(), initPullRefresh(), innerCanScrollUp(), onEnd(), onMove(), onStart(), reset() (+2 more)

### Community 22 - "Community 22"
Cohesion: 0.18
Nodes (10): caption, code, controls, height, name, properties, BackColor, ShowModal (+2 more)

### Community 23 - "Community 23"
Cohesion: 0.36
Nodes (9): commit.sh script, CI, die(), FORCE_COLOR, hr(), info(), ok(), step() (+1 more)

### Community 24 - "Community 24"
Cohesion: 0.28
Nodes (9): .claude/CLAUDE.md, command: gasManager, Conventional Commits format with [vX.Y.Z.W] tag, gas-config.json (scriptId, sheetId, deployId, oauth, deployHistory), GAS Manager artifact (5-tab HTML interface: Script/Deploy/Sheets/Config/History), Multi-agent parallel execution (js-feature, bug-fix, css-ui, gas-sync, doc-writer), OAuth 2.0 refresh_token for GAS REST API, skill: gas-api (+1 more)

### Community 25 - "Community 25"
Cohesion: 0.39
Nodes (4): dismiss(), _hide(), initPWA(), triggerInstall()

### Community 26 - "Community 26"
Cohesion: 0.29
Nodes (7): endpoints, createVersion, readScript, readSheet, redeploy, saveScript, writeSheet

### Community 27 - "Community 27"
Cohesion: 0.40
Nodes (6): Synchronisation Excel ↔ Google Sheets via Power Query + VBA, FilteredUser — filtre multi-utilisateur sur Email (U7), GS_Pleins — requête Power Query v4.3.0.7 : import CSV Google Sheets _ImportGS, _ImportGS — onglet source Google Sheets (gviz CSV endpoint), PrixHistory — requête Power Query v4.18.0.0 : import prix marché depuis _PrixHistory, _PrixHistory — onglet Google Sheets source (relevé quotidien ~7h par RefreshPrix.gs)

### Community 28 - "Community 28"
Cohesion: 0.50
Nodes (4): btn_export_pdf.png — dark blue rounded button 'Exporter en PDF' for Excel dashboard, btn_recreer.png — green rounded button 'Recreer les graphiques' for Excel dashboard, New-Button(), _make_buttons.ps1 — PowerShell script generating Excel dashboard button PNGs

### Community 29 - "Community 29"
Cohesion: 0.50
Nodes (5): wallpaper_opt1 — very faint outline silhouette of a motorcycle (filigrane), white background, wallpaper_opt2 — faint illustration of motorcycle + car side by side, multi-vehicle theme, wallpaper_opt3 — repeating diagonal pattern of small motorcycle + car icons, wallpaper style, wallpaper_opt4 — motorcycle in foreground + car at horizon on a road, depth perspective, wallpaper_preview.html — browser preview grid of all 4 wallpaper options

### Community 31 - "Community 31"
Cohesion: 0.40
Nodes (5): icon.svg — icône PWA : fond bleu marine #1B3A5C, emoji ⛽, texte E85 vert, manifest.json — PWA manifest (Suivi Conso. Carburants), Cache strategy — network-first same-origin, suivi-conso-carburant-shell cache, push event handler — alertes prix bas E85/Gazole/SP98 (payload-less VAPID), sw.js — Service Worker : network-first + cache fallback + Web Push alertes prix

### Community 32 - "Community 32"
Cohesion: 0.50
Nodes (5): commit.sh (gate versionnement/lint/test), Dependabot (MAJ deps hebdo), ESLint (flat config, max-warnings=0), GitHub Actions CI (lint/test/audit/version), Vitest (tests unitaires)

### Community 33 - "Community 33"
Cohesion: 0.83
Nodes (4): z900_green_A_light.png — very faint/bleached version of Z900 green photo for Excel background, z900_green_B_medium.png — slightly more visible bleached version of Z900 green photo, z900_green_C_color.png — faint color-tinted (green/blue hue) version of Z900 green photo, z900_green.jpg — photo of real green Kawasaki Z900 motorcycle (source photo)

### Community 34 - "Community 34"
Cohesion: 0.50
Nodes (3): hooks, PostToolUse, Stop

### Community 36 - "Community 36"
Cohesion: 0.67
Nodes (3): Z900 Kawasaki — filigrane moyen N&B (opacité ~16%, flou Gaussien r=5), Z900 Kawasaki — filigrane couleur léger (opacité ~13%, flou r=3), z900_preview.html — galerie HTML des 6 variantes de filigrane Kawasaki Z900

## Knowledge Gaps
- **260 isolated node(s):** `_comment`, `_doc`, `_scopes`, `scriptId`, `sheetId` (+255 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **17 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `state` connect `Community 0` to `Community 1`, `Community 2`, `Community 3`, `Community 6`, `Community 14`, `Community 17`?**
  _High betweenness centrality (0.019) - this node is a cross-community bridge._
- **Why does `getAllRecords()` connect `Community 2` to `Community 0`, `Community 3`, `Community 6`, `Community 7`, `Community 17`?**
  _High betweenness centrality (0.009) - this node is a cross-community bridge._
- **Why does `GAS_URL — endpoint Google Apps Script (source de vérité)` connect `Community 1` to `Community 0`, `Community 2`, `Community 5`, `Community 6`, `Community 7`?**
  _High betweenness centrality (0.004) - this node is a cross-community bridge._
- **What connects `_comment`, `_doc`, `_scopes` to the rest of the system?**
  _270 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Community 0` be split into smaller, more focused modules?**
  _Cohesion score 0.05345501955671447 - nodes in this community are weakly interconnected._
- **Should `Community 1` be split into smaller, more focused modules?**
  _Cohesion score 0.052594670406732116 - nodes in this community are weakly interconnected._
- **Should `Community 2` be split into smaller, more focused modules?**
  _Cohesion score 0.0578386605783866 - nodes in this community are weakly interconnected._