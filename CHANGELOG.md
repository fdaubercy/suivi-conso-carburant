# Changelog

Toutes les modifications notables de ce projet sont documentées ici.

Format : [Keep a Changelog](https://keepachangelog.com/fr/1.0.0/)

## [2.8.0.1] — 2026-05-26

### Fixed
- **`css/style.css`** : marqueurs de carte passaient au premier plan lors du défilement derrière le header sticky. Cause : `z-index:10` des marqueurs et `z-index:10` du header étaient dans le même stacking context racine — ordre DOM décidait, marqueurs gagnaient. Fix : `isolation:isolate` ajouté sur `#stationMap` et `.static-map` → chaque carte forme désormais un stacking context fermé, les z-index internes ne s'échappent plus vers le contexte racine où le header règne.

---

## [2.8.0.0] — 2026-05-26

### Added

#### 🗺️ Carte statique Stations habituelles + prix moyens
- **`js/stationsmap.js`** (nouveau module) : calcule le prix moyen E85 par station depuis l'historique complet (`getAllRecords()`), trie par prix croissant, rend une card `#stationsMapCard` avec liste et mini-carte OSM statique (non-interactive, labels prix toujours visibles).
- **`js/geo.js`** : `pickStation()` appelle désormais `cacheStationCoords(name, lat, lon)` — les coordonnées de chaque station sélectionnée sont persistées en `localStorage` sous `suivi_e85_station_coords`. La carte statique se peuple automatiquement au fil des sessions.
- **`js/historique.js`** : appel `renderStationsCard()` après chaque chargement d'historique pour maintenir la card à jour.
- **`index.html`** : card `#stationsMapCard` insérée après le bloc Statistiques. Masquée (`hidden`) tant qu'aucun historique E85 n'est disponible.
- **`css/style.css`** : styles `.static-map`, `.smap-pin`, `.smap-pin-dot`, `.smap-list`, `.smap-item`, `.smap-name`, `.smap-prix`, `.smap-count`, `.smap-best` — adaptés dark mode.

#### ⚠️ Détection de doublons dans le formulaire
- **`js/formulaire.js`** : nouvelle fonction `checkDuplicate()` — compare date + km + litres (au centilitre près) avec tous les enregistrements existants via `getAllRecords()`. Warning inline `#dupeWarn` si correspondance trouvée. Confirmation `confirm()` supplémentaire lors de la soumission si doublon détecté.
- **`index.html`** : `<div id="dupeWarn">` ajouté sous les champs litres/prix ; `onchange="checkDuplicate()"` sur `fDate`, `oninput` enrichi sur `fKm` et `fLitres`.

---

## [2.7.0.4] — 2026-05-26

### Fixed
- **`js/carte.js`** : marqueurs de carte qui débordaient au-dessus du conteneur `#stationMap`. Cause : le `offY` (décalage vertical de la grille de tuiles) peut être très négatif quand la grille est plus haute que les 220 px de la carte ; les marqueurs nord avaient `top = offY + p.y - 30 < 0`, leur pin dépassait au-dessus de `.map-header`. Fix en deux points : ① `offY` est recalé à `max(offY, PIN_H - minPy)` pour garantir que le marqueur le plus haut reste dans l'espace visible ; ② `overflow:hidden` ajouté sur le conteneur `<div>` de tuiles comme filet de sécurité supplémentaire.

---

## [2.7.0.3] — 2026-05-26

### Changed
- **`js/pwa.js`** : bannière Android flottante (`#installBanner`) remplacée par un bouton 📲 discret dans le header (`#pwaInstallBtn`). Le bouton n'apparaît que lorsque `beforeinstallprompt` se déclenche et disparaît après installation — plus de sessionStorage nécessaire côté Android.
- **`index.html`** : suppression du `<div id="installBanner">` ; ajout `<button id="pwaInstallBtn">` dans le header entre le titre et le toggle thème. Le banner iOS (`#iosBanner`) est conservé (seule option sur Safari).
- **`css/style.css`** : suppression `.pwa-btn` (bouton flottant Android) ; ajout `.pwa-install-btn` (style identique au `.theme-toggle` — fond semi-transparent, arrondi, hover) ; nettoyage `.pwa-banner` (iOS uniquement).

---

## [2.7.0.2] — 2026-05-26

### Fixed
- **`vite.config.js`** : `minify: 'esbuild'` remplacé par `minify: true` — `esbuild` est déprécié dans Vite 8.x (qui utilise rolldown/OXC) et n'est plus embarqué ; le build CI échouait silencieusement depuis v2.7.0.0.
- **`manifest.json` → `public/manifest.json`** : déplacement dans `public/` pour éviter que Vite hash le fichier dans `assets/` (ex. `assets/manifest-CcE5tYcX.json`). Depuis ce sous-dossier, le chemin relatif `icons/icon.svg` se résolvait en `/suivi-e85/assets/icons/icon.svg` au lieu de `/suivi-e85/icons/icon.svg` → 404 sur l'icône PWA. Désormais le manifest est à `dist/manifest.json` et l'icône à `dist/icons/icon.svg` — chemins cohérents.

---

## [2.7.0.1] — 2026-05-25

### Fixed
- **`css/style.css`** : ajout `.pwa-banner[hidden] { display: none; }` — `display:flex` sur `.pwa-banner` écrasait l'attribut HTML `hidden`, rendant les 2 bannières PWA toujours visibles et les boutons ✕ inopérants. La règle `[hidden]` a une spécificité plus haute (0-2-0 vs 0-1-0) et corrige l'affichage.

---

## [2.7.0.0] — 2026-05-25

### Added — Vite bundler (W12) + Tests unitaires Vitest (W14)

#### ⚡ W12 — Vite bundler
- **`vite.config.js`** : config Vite — `base: '/suivi-e85/'` en build (GitHub Pages), `'/'` en dev (localhost) via `command === 'build'` ; `outDir: dist` ; config Vitest intégrée (`globals: true`, `environment: node`).
- **`public/icons/icon.svg`** : icône déplacée dans `public/` — Vite la copie sans hash dans `dist/icons/`, garantissant un chemin prévisible pour le manifest PWA.
- **`manifest.json`** : chemin icône mis à jour `images/icons/icon.svg` → `icons/icon.svg` (cohérent avec `public/icons/`).
- **`index.html`** : `<link rel="apple-touch-icon">` mis à jour `href="images/icons/icon.svg"` → `href="icons/icon.svg"`.
- **`.github/workflows/deploy.yml`** : nouveau workflow — `push main` → `npm ci` → `vite build` → `actions/upload-pages-artifact@v3` → `actions/deploy-pages@v4`. Prérequis : Settings → Pages → Source → **GitHub Actions**.
- **`.gitignore`** : ajout `dist/` et `.vite/`.

#### 🧪 W14 — Tests unitaires Vitest
- **`tests/utils.test.js`** : 30 assertions sur les 8 fonctions pures de `utils.js` — `haversine` (distance, symétrie), `escHtml` (XSS chars), `getCoords` (formats ODS lat/lon et GeoJSON), `stationLabel`, `stationSubLabel`, `formatVille`, `composeStationName`, `odsUrl`.
- **`tests/prix.test.js`** : 8 scénarios sur `fetchNearestE85Price` avec `global.fetch` mocké — prix trouvé au 1er rayon, fallback sur 2e/3e rayon, 3 rayons exhaustés, vérification des valeurs `1000m`/`5000m`/`15000m` dans les URLs, lat/lon dans la requête, erreur réseau, HTTP non-ok, `e85_prix: null` ignoré. Modules DOM (`ui.js`, `carburant.js`, `rentabilite.js`) mockés via `vi.mock()`.

### Changed
- **`package.json`** : scripts ajoutés `dev` (vite), `build` (vite build), `preview`, `test` (vitest run) ; `version` → `2.7.0.0`.
- **`.github/workflows/ci.yml`** : ajout job `test` (Vitest) en parallèle de `lint` et `version-check`.
- **`js/config.js`** : `APP_VERSION` → `2.7.0.0`.
- **`ROADMAP.md`** : W12 et W14 retirés de leurs tableaux, ajoutés à "✅ Idées déjà implémentées".

---

## [2.6.0.0] — 2026-05-25

### Added — PWA (W4)
- **`manifest.json`** : manifeste PWA — `name`, `short_name`, `display: standalone`, `theme_color: #1B3A5C`, `background_color`, icône SVG `any` + `maskable`, shortcut "Nouveau plein"
- **`images/icons/icon.svg`** : icône app 512×512 — fond bleu foncé, emoji ⛽, texte "E85" vert — compatible maskable (contenu dans la safe zone 80%)
- **`js/pwa.js`** : module `initPWA()` — détection `beforeinstallprompt` (Android/Chrome) → affiche bannière avec bouton "Installer" ; détection iOS Safari → bannière instruction manuelle après 4 s ; `sessionStorage` pour éviter la ré-affichage en session ; `triggerInstall()` + `dismiss()` exposés sur `window`
- **`index.html`** : `<meta name="theme-color">`, `<link rel="manifest">`, `<link rel="apple-touch-icon">`, bannières `#installBanner` (Android) et `#iosBanner` (iOS) en `hidden` par défaut
- **`css/style.css`** : classes `.pwa-banner`, `.pwa-btn`, `.pwa-close`, `.pwa-banner--ios` + dark mode

### Changed
- **`js/main.js`** : import + appel `initPWA()` après `initScanner()`
- **`js/config.js`** : `APP_VERSION` passée à `2.6.0.0`
- **`ROADMAP.md`** : W4 retiré du tableau "Quick wins", ajouté à "Idées déjà implémentées"

---

## [2.5.0.3] — 2026-05-25

### Fixed
- **`vba/modDashboard.bas`** : correction `ws.Activate` avant `ws.Range().Select` (erreur 1004)
- **`vba/modDashboard.bas`** : suppression `ChrW(128200)` hors BMP dans `BuildX7Chart` (erreur 5)
- **`vba/modDashboard.bas`** : remplacement de tous les tirets em `—` et flèches `→` par des équivalents ASCII pour compatibilité encodage ANSI à l'import VBA

### Changed
- **`README.md`** : ajout tuto complet `<details>` pour obtenir et configurer la clé API Gemini (AI Studio → GAS Script Properties → redéploiement)

---

## [2.5.0.0] — 2026-05-25

### Added

#### 🧾 W17 — Scan ticket de caisse → auto-complétion du formulaire
- **`js/ticket.js`** (nouveau module) : bouton "🧾 Scanner le ticket" → sélecteur de fichier (galerie ou caméra) → compression canvas (max 1 200 px, JPEG ≤ 800 Ko) → envoi base64 à GAS → Gemini Vision API → JSON parsé → pré-remplissage automatique des champs date / km / litres / prix / type carburant / station. Mapping robuste des libellés carburant (`FUEL_LABEL_MAP`) + correspondance partielle sur le dropdown station.
- **`Google Drive/.../Code.gs`** : nouvelle action `scanTicket` dans `doPost` → appelle `handleScanTicket(imageBase64, mimeType)` → API Gemini `gemini-1.5-flash` via `UrlFetchApp` avec clé `GEMINI_API_KEY` stockée dans les propriétés de script. Prompt structuré → JSON `{ date, km, litres, prix_litre, montant_total, type_carburant, station }`. Extraction robuste du JSON dans la réponse texte.
- **`index.html`** : bloc `.scan-row` avec `#scanTicketBtn` (🧾 Scanner le ticket) + texte d'aide, inséré entre le toggle carburant et les champs du plein.
- **`style.css`** : classes `.scan-row`, `.scan-btn`, `.scan-hint` — design cohérent avec les autres actions (border blue-mid, active inverted, dark mode).

#### 🔁 W13 — GitHub Actions CI
- **`.github/workflows/ci.yml`** : deux jobs parallèles —  `lint` (ESLint sur `js/`) et `version-check` (compare `APP_VERSION` dans `config.js` au dernier tag Git, avertissement seulement). Déclenchement sur `push` et `pull_request` toutes branches.
- **`package.json`** : configuration npm avec `"type": "module"`, script `lint`, dépendances dev `eslint` + `@eslint/js` v9.
- **`eslint.config.js`** : flat config ESLint 9 — `js.configs.recommended` + règles `no-unused-vars` (warn), `no-undef` (error), `no-var` (error), `prefer-const` (warn), `eqeqeq` (warn), `no-duplicate-imports` (error) + globals browser complets.
- **`.gitignore`** : ajout `node_modules/`.

#### 📈 X7 + X8 — Graphiques Excel (`modDashboard.bas`)
- **`vba/modDashboard.bas` — `CreerGraphiques()`** : nouvelle procédure publique créant / régénérant la feuille "Graphiques". Appelée automatiquement en fin de `CreerTableauDeBord()` ; exécutable seule si les KPIs sont déjà en place.
- **X7 — Prix E85 dans le temps** : helper data Date|Prix E85|Station (filtré sur Type contenant "E85") + graphique ligne bleu (`xlLineMarkers`) avec axe X dates (format `mmm yy`) et axe Y `€/L`.
- **X8 — Consommation L/100 km** : helper data Date|L/100km|Véhicule — conso calculée entre pleins consécutifs du même véhicule (bubble sort sur véhicule+km, filtre aberrations : delta 10–3 000 km, conso 3–25 L/100) + graphique ligne vert. Permet de détecter une dérive mécanique dans le temps.

### Changed
- **`js/main.js`** : import + appel de `initScanner()` après le chargement des données.
- **`js/config.js`** : `APP_VERSION` passée à `2.5.0.0`.
- **`ROADMAP.md`** : nettoyage complet — les items réalisés sont retirés de leurs tableaux d'origine (plus de strikethrough) et ajoutés uniquement dans "✅ Idées déjà implémentées". Suppression des 2 entrées W16 (absorbées par W17). W13, W17, X7, X8 ajoutés au tableau implemented.

---

## [2.4.5.1] — 2026-05-25

### Added
- **`ROADMAP.md` — nouvel item W17** : *"🧾 Scan ticket de caisse → auto-complétion du formulaire"* — reconnaissance OCR / API vision (Claude Vision, Gemini Vision, GPT-4 Vision) du ticket de caisse imprimé par la pompe ; extrait date, heure, type carburant, litres, prix/L, montant total et nom de station pour pré-remplir automatiquement tous les champs du formulaire en ligne. Avantage vs W16 : ticket papier imprimé, structuré, sans reflets — données plus fiables qu'un afficheur de pompe. Deux approches : (a) envoi base64 à GAS → API Vision → JSON parsé ; (b) Tesseract.js local pour tickets bien contrastés. Effort estimé : 3-5 h.

---

## [2.4.5.0] — 2026-05-25

### Added
- **`js/utils.js` — `formatVille(city)`** : premier segment d'une ville (avant `-` ou espace) converti en proper case. Ex : `FLERS-EN-ESCREBIEUX` → `Flers`, `DOUAI` → `Douai`.
- **`js/utils.js` — `composeStationName(name, ville)`** : compose le label final `"Nom - Ville"` (ex : `Carrefour - Flers`). Si l'un manque, retourne l'autre.
- **`ROADMAP.md` — nouvel item W16** : *"Photo ticket + OCR/AI"* — capture caméra → OCR (Tesseract.js côté client OU Vision API Claude/Gemini côté GAS) → parse date/litres/prix/station → pré-remplit le formulaire. Évolution naturelle de W9 (stockage photo seul).

### Changed
- **`js/geo.js` — `searchNearby`** : utilise `composeStationName(rawName, c.r.ville)` au lieu de `osmNames[i] || stationLabel(c.r)`. Les stations affichent désormais `Carrefour - Flers` au lieu de `Carrefour`. La détection "connue" reste basée sur le `rawName` brut pour ne pas casser le matching avec les stations habituelles.
- **`js/recherche.js`** :
  - `buildStations` stocke maintenant `ville` dans chaque station + compose le name via `composeStationName`.
  - Les deux callsites OSM (`searchStationSuggestions`, `searchStationsCityOnly`) recomposent le nom final avec ville après enrichissement OSM.
- **`js/stats.js`** :
  - Helper `matchType(rType, fuelKey)` qui mappe un Type GS (label complet "SuperEthanol E85") avec une clé `FUEL_CONFIG` (E85).
  - `computeStats` filtre désormais conso & coût/100km **par carburant courant** (`state.currentType`). Total dépensé et économies E85 vs SP98 restent globaux.
  - `renderStats` affiche un mini-tag `<span class="stat-tag">E85</span>` à côté des unités L/100km et €/100km. Affiche `—` si <2 pleins de ce type.
- **`style.css`** : nouvelle classe `.stat-tag` (badge bleu compact 9 px).
- **`js/carburant.js` — `setType`** : appelle `window.renderStats()` après chaque changement de carburant → les tuiles conso/€/100km se recalculent instantanément.
- **`js/config.js`** : `APP_VERSION` passée à `2.4.5.0`.

---

## [2.4.4.0] — 2026-05-25

### Added — 📈 Stats live (ROADMAP W7)
- **`js/stats.js`** : nouveau module exportant `renderStats()`. Calcule 4 KPIs filtrés sur le **véhicule courant** + fenêtre **6 derniers mois** :
  1. **Conso L/100 km** : `total_litres_véhicule × 100 / (km_max − km_min)`
  2. **Coût aux 100 km** : `conso × prix_moyen_récent`
  3. **Total dépensé** sur la fenêtre (Σ litres × prix)
  4. **Économies E85 vs SP98** : Σ (sp98_station − prix_payé) × litres pour chaque plein E85 récent
- **Carte HTML `<div class="card stats-card">`** insérée entre les cards du formulaire et la carte historique.
- **`style.css` — grille 2×2 `.stats-grid`** : 4 tuiles avec valeurs en tabular-nums, fond `var(--toggle-bg)`, dark mode supporté. Variante `.pos` (vert) / `.neg` (rouge) pour les économies.

### Changed
- **`js/historique.js`** :
  - Nouveau `export function getAllRecords()` qui retourne `_allRecords` (utilisé par stats.js).
  - `chargerHistorique` appelle `renderStats()` après le rendu de la liste — les stats se mettent à jour dès que les données arrivent.
- **`js/vehicules.js` — `onVehiculeChange`** : appelle aussi `window.renderStats()` car les KPIs sont filtrés par véhicule.
- **`js/main.js`** : import + exposition `renderStats` sur `window`.
- **`js/config.js`** : `APP_VERSION` passée à `2.4.4.0`.
- **`ROADMAP.md`** :
  - **W7 marqué ✅**
  - **W10** marqué ❌ "redondant avec W2 (📋 Dupliquer dernier)" — concept à redéfinir
  - **W8, W9, W11** annotés avec effort réaliste (3-4 h chacune)
  - **W15 nouveau** : Auto-save brouillon (formulaire → localStorage, restauré au reload)
  - **S8 nouveau** : Refresh quotidien des prix via GAS trigger temporel + onglet `_PrixHistory`

---

## [2.4.3.0] — 2026-05-25

### Added — 🌿 Badge rentabilité E85 (ROADMAP W5)
- **`js/config.js` — `E85_RENTABLE_RATIO = 0.66`** : nouvelle constante exportée. Seuil basé sur la surconsommation typique de l'E85 (~30 % de plus que SP98). Tant que `prix_E85 / prix_SP98 < 0.66`, le plein E85 est économiquement rentable malgré la surconsommation.
- **`js/prix.js` — `evalRentabiliteE85()`** : fonction exportée qui met à jour l'élément `#rentaBadge`. Affiche un badge vert (rentable) si le rapport prix est favorable, orange sinon. Masqué si l'un des deux prix est manquant.
- **`js/rentabilite.js`** : nouveau module léger qui expose `updateRentabilite()` — appelé depuis `formulaire.js` après chaque récupération de prix.
- **`style.css`** : `.renta-badge.ok` (vert + border) et `.renta-badge.warn` (amber + border) + surcharges dark mode.

### Changed
- **`js/formulaire.js`** : `onStationChange()` et `resetForm()` appellent `evalRentabiliteE85()` pour mettre à jour / effacer le badge.
- **`js/config.js`** : `APP_VERSION` passée à `2.4.3.0`.
