# Changelog

Toutes les modifications notables de ce projet sont documentées ici.

Format : [Keep a Changelog](https://keepachangelog.com/fr/1.0.0/)

## [2.12.2.0] — 2026-05-27

### Fixed
- **`css/style.css`** — Règle globale `[hidden] { display: none !important; }` ajoutée en tête de fichier : les éléments utilisant `display: flex/grid` en CSS ne peuvent plus écraser l'attribut HTML `[hidden]`. Corrige l'affichage parasite des deux messages de notification (`#notifNoSupport`, `#notifDenied`) sur iOS Safari et le seuil d'alerte (`#notifSeuilRow`) toujours visible.
- **`js/notifications.js`** — Détection iOS en mode navigateur (`isIOSBrowser`) : sur iPhone/iPad non installé en PWA, l'API est considérée non disponible → toggle désactivé dès le chargement, aucun appel à `requestPermission()`. Supprime le comportement incohérent (toggle sans réaction, messages contradictoires). Ajout d'un `try/catch` autour de `requestPermission()` pour les navigateurs qui lèvent une exception. Ordre d'initialisation corrigé : `updateNotifUI()` appelé en premier dans `initNotifications()`.
- **`index.html`** — Nouveau `<div id="notifIOS">` : message spécifique iPhone "Sur iPhone, les alertes nécessitent l'app installée — Safari → Partager → Sur l'écran d'accueil (iOS ≥ 16.4)". Remplace les messages génériques "non supporté" / "bloqué" qui s'affichaient simultanément sur iOS.

### Changed
- **`js/config.js`** — `APP_VERSION` → `2.12.2.0`

## [2.12.1.0] — 2026-05-27

### Added
- **`tests/e2e.spec.js`** — Suite Playwright E2E (5 scénarios, mode mock GAS) :
  - **TC-01** E85 complet → feedback succès + formulaire réinitialisé + historique rechargé (2ème GET GAS renvoie `HIST_RECORD` via flag `submissionDone`)
  - **TC-02** SP98 complet → feedback succès + formulaire réinitialisé
  - **TC-03** Champs obligatoires manquants → feedback `error` "Champs manquants", formulaire conservé
  - **TC-04** Station non sélectionnée → feedback `error` "Station manquante"
  - **TC-05** Erreur GAS (`success: false`) → feedback `error` "Erreur serveur", champs conservés
  - Mocks réseau : GAS (`script.google.com/**`), API prix (`data.economie.gouv.fr/**`), Google Sheets stations (`docs.google.com/**` → abort → fallback), Overpass (`overpass-api.de/**`)
- **`playwright.config.js`** — Configuration Playwright : serveur Vite (`npm run dev`), 1 worker séquentiel, Chromium headless, `testMatch: '**/*.spec.js'` (séparé de Vitest)
- **`package.json`** — `@playwright/test ^1.44.0` en devDependency + scripts `test:e2e`, `test:e2e:ui`, `test:e2e:headed`, `test:e2e:report`
- **`.gitignore`** — Entrées `playwright-report/` et `test-results/`

### Changed
- **`js/config.js`** — `APP_VERSION` → `2.12.1.0`

## [2.12.0.0] — 2026-05-27

### Added
- **`index.html`** — `<div id="swUpdateBanner">` : bannière "🔄 Mise à jour disponible" (W23), masquée par défaut, avec bouton "Actualiser". Placée avant le header pour apparaître en premier plan sans JavaScript d'affichage.
- **`js/pwa.js`** — `_showUpdateBanner(reg)` : détecte `reg.installing` (via `statechange`) et `reg.waiting` (SW déjà en attente au chargement). Câble le bouton "Actualiser" → `reg.waiting.postMessage({ type: 'SKIP_WAITING' })`. Reload automatique via `controllerchange`.
- **`public/sw.js`** — handler `message` pour `SKIP_WAITING` : déclenche `self.skipWaiting()`, ce qui active le nouveau SW immédiatement → `controllerchange` → `window.location.reload()`.
- **`js/stats.js`** — `buildE85Sparkline()` : courbe SVG inline des 10 derniers prix E85 payés (`getAllRecords()`). Tri chronologique, `polyline` SVG, cercle sur le dernier point, couleur selon tendance (baisse=vert, hausse=rouge, stable=bleu). Affiché sous la grille 2×2 dans la carte Statistiques.

### Changed
- **`js/formulaire.js`** — `submitForm()` : `window.scrollTo({ top: 0, behavior: 'smooth' })` ajouté après enregistrement réussi **et** après mise en file hors-ligne (W24). Le formulaire repasse automatiquement en vue, sans geste manuel.
- **`js/stats.js`** — `renderStats()` : appel `buildE85Sparkline()` intégré à la fin du HTML généré.
- **`js/pwa.js`** — `initPWA()` : appel SW registration refactorisé pour intégrer la détection de mise à jour W23 + listener `controllerchange`.
- **`css/style.css`** — ajout des styles `.update-banner`, `.update-apply-btn` (W23) et `.e85-sparkline`, `.spark-*` (W28) avec variantes dark mode et couleur dynamique selon tendance.
- **`js/config.js`** — `APP_VERSION` → `2.12.0.0`.

## [2.11.0.0] — 2026-05-27

### Added
- **`public/sw.js`** — Service Worker (Cache-First shell + Network-First dynamique).
  - Cache statique de la coquille applicative (HTML/CSS/JS/icônes) pour démarrage hors-ligne.
  - Stratégie Network-First pour les requêtes GET du même domaine ; fallback vers le cache si hors réseau.
  - Skip des ressources externes (GAS, ODS API, CDN) pour ne pas interférer avec la logique métier.
  - Fallback navigation : sert `index.html` depuis le cache pour toutes les routes SPA.
  - Background Sync : sur tag `sync-pleins`, notifie les clients `window` via `postMessage` pour déclencher la synchronisation.
- **`js/offline.js`** — Gestion de la file d'attente hors-ligne.
  - `queuePlein(payload)` : sauvegarde un plein dans `localStorage` quand la soumission échoue (hors réseau).
  - `syncQueue()` : envoie chaque entrée à GAS au retour de la connexion ; retire les succès, arrête sur erreur réseau persistante.
  - `updateOfflineBadge()` : met à jour le badge `📵 N hors-ligne` dans le header.
  - `initOffline()` : écoute `window.online`, messages Service Worker (`SYNC_PLEINS`), et enregistre un Background Sync.
- **`js/notifications.js`** — Alertes prix E85 via Web Notifications API.
  - `toggleNotifications(enable)` : demande la permission, enregistre l'état et envoie une notification de confirmation.
  - `checkPrixE85Alert(prix, station)` : émet une notification `tag: 'e85-price-alert'` (anti-spam) si le prix E85 est sous le seuil configuré.
  - `getSeuil() / setSeuil()` : seuil persisté en localStorage (`notif_e85_seuil`), défaut 0,850 €/L.
  - `updateNotifUI()` : synchronise le toggle, la ligne seuil, et les messages permission denied / not supported.
  - `initNotifications()` : câble le toggle et l'input seuil au chargement.
- **`index.html`** — Éléments UI pour les nouvelles fonctionnalités.
  - Badge `#offlineBadge` dans le header (visible si des pleins sont en attente de sync).
  - Carte « Paramètres » avec section hors-ligne (informatif) et section alertes prix E85 (toggle + seuil + messages denied/no-support).
- **`js/pwa.js`** — Enregistrement du Service Worker dans `initPWA()` (portée `import.meta.env.BASE_URL`).
- **`css/style.css`** — Styles pour les nouvelles fonctionnalités.
  - `.offline-badge` : badge ambre pulsant (`@keyframes pulse-badge`) dans le header.
  - `.notif-card`, `.notif-row`, `.notif-label`, `.notif-sub` : carte paramètres et ses composants.
  - `.switch`, `.switch-track` : toggle iOS-style (checked/disabled variants).
  - `.seuil-row`, `.seuil-input`, `.seuil-unit` : ligne saisie du seuil d'alerte.
  - `.feedback.info` : variante bleue du feedback (manquait pour les messages hors-ligne).

### Changed
- **`js/formulaire.js`** — `submitForm()` : en cas d'erreur réseau (`NetworkError` / `!navigator.onLine`), appelle `queuePlein(payload)` au lieu d'afficher une simple erreur, puis `resetForm()` et `updateOfflineBadge()`.
- **`js/prix.js`** — `applyPricesResult()` : appelle `checkPrixE85Alert()` après chaque chargement de prix station.
- **`js/main.js`** — Appels `initOffline()`, `initNotifications()`, `syncQueue()` au démarrage.

## [2.10.0.5] — 2026-05-27

### Fixed
- **`js/ticket.js`** — Deux bugs critiques dans le remplissage du formulaire post-scan.
  - **Ordre `setType` → `fPrix`** : `setType()` efface `fPrix.value = ''` (ligne 66 de `carburant.js`). `fillFormFromTicket` appelait `setType` *après* avoir rempli `fPrix`, effaçant immédiatement le prix détecté. Correction : `setType` est désormais appelé **en premier**, avant tout remplissage de champ numérique.
  - **`montant_total` faux** : le pattern `ttc` (seul) dans `totalPatterns` capturait "Prix unitaire **TTC** 1,799" → `montant_total = 1.799` au lieu de 76,61. Correction : `ttc` retiré de l'alternance principale ; seul `total ttc` et `montant ttc` restent valides comme déclencheurs.

## [2.10.0.4] — 2026-05-27

### Fixed
- **`js/ticket.js`** — Extraction prix/L refondée pour robustesse maximale.
  - **Collecte multi-candidats** : au lieu de s'arrêter au premier match, tous les candidats prix/L valides ([0,3–3,5]) sont collectés puis le **maximum** est retenu — élimine automatiquement TICPE (0,691 €/L) et autres taxes inférieures au prix carburant réel.
  - **Pattern ① élargi** : `€?` → `[€e£é]?` — gère l'artefact OCR "€" → "e"/"E"/"£" (fréquent avec Tesseract sur texte imprimé).
  - **`.matchAll()`** remplace `.match()` — permet de trouver tous les candidats dans le texte, pas seulement le premier.
  - **Km — séparateur milliers espace** : "87 450 km" (format français) désormais reconnu → 87450. 4 niveaux de fallback km (contigu, espace, libellé+contigu, libellé+espace).
  - **Station** : "totalenergies" ajouté à la liste des mots-clés.
  - **Log diagnostic** : `console.group('[OCR]…')` affiche le texte brut et les candidats prix dans la console DevTools pour faciliter le débogage.

## [2.10.0.3] — 2026-05-27

### Fixed
- **`js/ticket.js`** — Extraction du prix/L robustifiée pour les formats tickets courants.
  - **Pattern ② (EUR/L)** : `eur?` → `eur(?:os?)?` — couvre désormais "eur", "euro" et "euros" (avec `s` final). Exemple : `1,799 Euros/L` désormais reconnu.
  - **Pattern ③ (libellé)** : ajout de `prix unitaire` et `prix/litre(s)` — corrige la non-détection du libellé le plus courant sur les tickets de station (Total, Leclerc, Carrefour…).
  - **Pattern ④ (multiplication)** : `\d{2}` → `\d{2,3}` — quantité avec 3 décimales (ex. `25,000 L`) désormais prise en charge.
  - **Totaux** : `\d{2}` → `\d{2,3}` dans les deux patterns — capture les montants à 3 décimales (ex. `44,975 €`), ce qui rend le fallback `total ÷ litres` fonctionnel même lorsque le prix/L n'est pas lisible directement.

## [2.10.0.2] — 2026-05-27

### Fixed
- **`js/ticket.js`** — Extraction du prix/L améliorée (5 niveaux de fallback).
  - **Plage étendue** : `[01]` → `[0-3]` — couvre désormais SP98 (~2,09 €/L), GPLc (~0,85 €/L) et tout carburant jusqu'à 3,5 €/L.
  - **Artefacts OCR** : le séparateur `/L` toléré sous ses formes déformées `|L`, `\L`, `Il`, `lL` (erreurs Tesseract courantes sur les petits caractères).
  - **Nouveaux libellés** : `Prix au litre`, `Prix/l`, `prixlitre` ajoutés au pattern libellé.
  - **Fallback ⑤ — `montant_total ÷ litres`** : si le prix/L n'a pas été trouvé directement mais que le montant et le volume sont connus, le prix est calculé par division (arrondi à 3 décimales). Les grands nombres (ex. `36,23 €`, `20,14 L`) sont bien mieux reconnus par l'OCR que `1,799 €/L` — ce fallback est donc très fiable.

## [2.10.0.1] — 2026-05-27

### Fixed
- **`js/ticket.js`** — Détection du carburant "SP 95-E10" (E10) corrigée.
  - **`FUEL_LABEL_MAP`** : patterns composés (`sp95-e10`, `sp 95-e10`, `95-e10`, `sp95 e10`, `sp 95 e10`, `sans plomb 95-e10`…) positionnés **avant** `sp95` et `e10` séparément — ordre critique car `"sp95-e10".includes("sp95")` est vrai et causait un match prématuré sur `SP95`.
  - **Regex fallback** (codes courts) : pattern dédié `\bSP\s?95[\s-]E10\b|\b95[\s-]E10\b` testé avant l'alternance simple `SP95|E10` pour éviter que "SP95-E10" soit capturé par `SP95`.

## [2.10.0.0] — 2026-05-27

### Changed
- **`js/ticket.js`** — Suppression complète de la dépendance Gemini/GAS pour le scan de ticket.
  - Remplacé par **Tesseract.js** (OCR 100 % côté client, aucune clé API, fonctionne hors-ligne après premier chargement).
  - Nouveau flux : photo → redimensionnement canvas (max 1 200 px) → `Tesseract.recognize()` langue `fra` → `parseOCRText()` → champs auto-remplis.
  - `parseOCRText()` : extraction par regex heuristiques (date, litres, prix/L, montant, type carburant, station, km).
  - Barre de progression : affichage du % pendant la reconnaissance (`recognizing text`).
  - Validations : litres 0,5–200 L, prix 0,3–3,5 €/L pour rejeter les faux positifs OCR.

### Added
- **`package.json`** : dépendance `tesseract.js` (OCR navigateur, multi-langues).

### Removed
- Appel `fetch(GAS_URL, { action: 'scanTicket', imageBase64, … })` dans `ticket.js`.
- Fonction `compressImage()` remplacée par `resizeImage()` (même logique, renvoie Blob pour Tesseract).
- Import `GAS_URL` dans `ticket.js` (plus nécessaire pour le scan).
- Fonction `handleScanTicket` dans `Code.gs` : inopérante (`gemini-1.5-flash` non supporté sur endpoint `/v1/`), conservée dans GAS mais plus jamais appelée par l'app web.

## [2.9.0.2] — 2026-05-27

### Fixed
- **`Google Drive/.../Code.gs`** : `gemini-2.0-flash` non disponible sur le plan gratuit (quota `limit: 0`) → retour à `gemini-1.5-flash`, endpoint `v1` conservé (le problème précédent était `v1beta`, pas le nom du modèle).

---

## [2.9.0.1] — 2026-05-26

### Fixed
- **`Google Drive/.../Code.gs`** : modèle Gemini mis à jour `gemini-1.5-flash` (déprécié en `v1beta`) → `gemini-2.0-flash` via endpoint `v1`. Corrige l'erreur *"models/gemini-1.5-flash is not found for API version v1beta"* lors du scan de ticket.

---

## [2.9.0.0] — 2026-05-26

### Added

#### 🔄 Sync bidirectionnel Excel ↔ Google Sheets — complet

**VBA — `vba/GS_Pleins_snippet.bas`** (nouveau module feuille) :
- **[F1] Auto sync_id à la saisie** : `Worksheet_Change` génère un UUID en col O dès qu'une cellule de données (A:N) est modifiée sur une ligne active (Date ou Km renseigné). Le sync_id n'attend plus le prochain `SyncManuel()`.
- **[F2] Marquage modification locale** : toute modification sur A:N inscrit `Now()` en col P (`last_modified`). Flag consommé par `ExportModificationsToGS`.
- **[F3] Validation kilométrage** : warning `vbExclamation` si le km saisi est inférieur au max km enregistré pour le même véhicule. Comparaison par véhicule si renseigné, global sinon.
- **[F4] Détection doublons** : warning si Date + Km + Litres (au centilitre) correspondent à une ligne existante. Déclenché sur modification de col B, D ou E.

**VBA — `vba/modSyncGS.bas`** — mise à jour v2.9.0.0 :
- **Col P `Modifie_local`** : nouvelle colonne 16 (`COL_MODIFIED`). Initialisée automatiquement par `EnsureModifiedColHeader` (appelée à chaque `SyncCore` et `ForceFormatDates`).
- **`ExportModificationsToGS`** : collecte les lignes avec sync_id déjà dans GS + col P renseignée → POST `action=bulkUpdate`. Efface col P après succès HTTP 200. Tolère l'absence du handler GAS (conserve col P si réponse vide ou erreur).
- **`ImportGSToExcel`** — MAJ bidirectionnelle : pour les lignes existantes (sync_id connu), si col P vide (pas de modif locale) et valeurs GS différentes (Date/Km/Litres) → `UpdateRowFromGS` met à jour les cols 2–14. Si col P renseignée → Excel gagne, skip GS.
- **`BuildLocalRowMap`** : dictionnaire `sync_id → numéro de ligne` pour les MAJ GS→Excel.
- **`RowMatchesGS`** : compare Date (yyyy-mm-dd), Km (±0.5), Litres (±0.01) local vs GS.
- **`UpdateRowFromGS`** : écrase cols 2–14 depuis le record GS (préserve col 1 horodatage, col 15 sync_id, col 16 modified).
- **`SyncDiagnose`** : affiche le nombre de lignes dirty (col P set) dans le rapport.
- **`SyncCore`** : statut détaillé — `<-N nouv. +M MAJ / ->N nouv. +M MAJ`.

**GAS — `Google Drive/.../Code.gs`** — mise à jour v2.9.0.0 :
- **`handleBulkUpdate(ss, rows)`** : upsert par `sync_id` — ligne trouvée → MAJ cols B–N (préserve col A Horodatage) ; ligne absente → `appendRow` (cas de désync). Retourne `{ status:'ok', updated:N, added:M }`.
- Dispatch `action === 'bulkUpdate'` dans `doPost`.

**GAS — `Google Drive/.../GAS_UPDATE.md`** :
- Réécrit entièrement (était v2.1.3.0). Documente désormais toutes les actions `doGet`/`doPost` (`export`, `addStation`, `syncStations`, `addVehicule`, `removeVehicule`, `bulkAdd`, `bulkUpdate`, `scanTicket`), le schéma complet A→O, les fonctions de migration et l'historique des versions GAS.

### Changed
- **`excel/Suivi conso E85.xlsm`** : modules VBA mis à jour — `modSyncGS` (v2.9.0.0, sync bidir. complet) + module feuille `GS_Pleins` (F1–F4 : auto sync_id, dirty flag, validation km, doublons).
- **`package.json`** : `version` → `2.9.0.0`.

---

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
