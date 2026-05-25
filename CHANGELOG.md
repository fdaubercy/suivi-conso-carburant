# Changelog

Toutes les modifications notables de ce projet sont documentées ici.

Format : [Keep a Changelog](https://keepachangelog.com/fr/1.0.0/)

## [2.3.1.4] — 2026-05-24

### Added
- **`ROADMAP.md`** : nouveau fichier dédié listant les propositions d'amélioration classées par axe (web / Excel / sync) et par effort (🔥 quick wins, 🎯 features visibles, 🛠️ tech debt, 🛡️ sécurité). Inclut un top 3 prioritaire et une section "déjà implémenté" rétro-documentée v2.2.4.x → v2.3.1.3. Référencé depuis README et listé dans la structure projet.

### Changed
- **`README.md`** : ajout d'un renvoi vers `ROADMAP.md` en tête de page + entrée dans l'arborescence projet.
- **`js/config.js`** : `APP_VERSION` passée à `2.3.1.4`.

---

## [2.3.1.3] — 2026-05-24

### Fixed
- **`style.css` — `.submit-wrap` transparent au-dessus de la carte** : les marqueurs `.map-pin` apparaissaient visiblement à travers le bouton "Enregistrer le plein". Le `background: linear-gradient(to top, var(--bg) 70%, transparent)` laissait passer la carte dans les 30 % supérieurs de la barre sticky.
  - Remplacement par `background: var(--bg)` (fond solide).
  - Ajout `z-index: 20` pour garantir l'empilement au-dessus de la carte et de ses marqueurs.
  - Ajout `box-shadow: 0 -8px 12px -6px rgba(0,0,0,.08)` pour conserver la séparation visuelle subtile que le dégradé apportait.

### Changed
- **`js/config.js`** : `APP_VERSION` passée à `2.3.1.3`.

---

## [2.3.1.2] — 2026-05-24

### Removed
- **Ligne `#s98Status` redondante** : suppression du résumé verbeux `E85 : 0.849 €/L · SP98 : 2.179 €/L · …` affiché sous le formulaire après chargement des prix. Les prix sont déjà visibles dans chacun des 6 boutons de carburant et l'adresse station figure dans la zone "Station essence", la duplication n'apporte rien.

### Changed
- **`js/prix.js` — `applyPricesResult`** : en cas de succès, `setS98Status('', '')` (statut effacé) au lieu du résumé concaténé. Le cas d'échec (`Aucun prix trouvé`) déclenchant le code postal est inchangé.
- **`js/carburant.js` — `setType`** : suppression du bloc qui réaffichait le résumé prix depuis le cache lors d'un changement de type. Import `setS98Status` retiré (devenu inutile).
- **`js/config.js`** : `APP_VERSION` passée à `2.3.1.2`.

---

## [2.3.1.1] — 2026-05-24

### Added
- **Prix affichés dans les boutons E85 et SP98** : la rangée primaire affiche désormais le prix `€/L` sous le libellé, comme la rangée secondaire (SP95/E10/Gazole/GPLc). Les 6 boutons ont une présentation strictement identique.

### Changed
- **`js/carburant.js` — `_buildTypeToggle`** : la boucle `primaryKeys` ajoute maintenant `dimmed` (si station sélectionnée sans ce carburant) et la balise `<span class="type-price">` quand le prix est disponible.
- **`style.css` — `.type-btn`** : `flex-direction: column` (au lieu de `row`) + `gap: 2px` pour empiler libellé et prix. Ajout de `.type-btn.dimmed` (opacité 0.38) et `.type-btn.active .type-price` (couleur `blue-mid`) pour cohérence avec les boutons secondaires.
- **`js/carburant.js` — `_updateHeaderBadges`** : la fonction vide simplement `#headerOtherFuels` au lieu de générer les mini-badges. Seul le carburant sélectionné (`#headerBadge`) reste visible dans le bandeau.
- **`index.html`** : suppression du conteneur `<div id="headerOtherFuels"></div>` (devenu inutile).
- **`js/config.js`** : `APP_VERSION` passée à `2.3.1.1`.

---

## [2.3.1.0] — 2026-05-24

### Changed
- **`style.css` — uniformisation des boutons carburant** : la rangée secondaire (SP95, E10, Gazole, GPLc) adopte le même pattern visuel que la rangée primaire (E85 / SP98).
  - **`.type-row-secondary`** : `display: grid` avec 4 colonnes égales, fond grisé conteneur `#e5e7eb`, padding `3px`, `border-radius: 10px` — identique à `.type-row-primary`.
  - **`.type-btn-sm`** : bordure et fond blanc supprimés → boutons transparents sur le conteneur grisé.
  - **`.type-btn-sm.active`** : fond `white` + ombre `0 1px 3px rgba(0,0,0,.12)` au lieu de `blue-light + border` → comportement identique à `.type-btn.active` (SuperEthanol E85 quand sélectionné).
  - **`.type-btn-sm:active`** (pseudo-classe tap) retirée : redondante avec `.active`.
- **`js/config.js`** : `APP_VERSION` passée à `2.3.1.0`.

---

## [2.3.0.1] — 2026-05-24

### Changed
- **`vba/modSyncGS.bas` — debug non-bloquant** : remplacement de tous les `MsgBox` par un helper `SetStatus(msg)` qui écrit dans :
  - **Application.StatusBar** (barre en bas d'Excel, non-bloquant)
  - **Immediate Window VBA** (Ctrl+G, garde l'historique avec horodatage `hh:mm:ss`)
- **`SetStatusBlock(title, body)`** : variante pour les rapports multi-lignes (`TestConnexion`, `SyncDiagnose`) — résumé d'une ligne dans la status bar + détail complet dans Immediate Window.
- **`SyncCore`** : tous les messages d'erreur (réseau, GAS pas déployé, exception) et le compte-rendu final (`OK : ←N reçues / →M envoyées`) utilisent maintenant `SetStatus`.
- **`SyncDiagnose`** : résumé compact dans la status bar (`GS=N (sid:X) | XL=N (sid:X) | sync→GS:N →XL:N`), rapport détaillé dans Immediate Window.
- **`TestConnexion`** : ligne unique dans la status bar (`HTTP 200 (WinHttp) - OK reponse JSON valide`), corps complet (composant, URL, code, diagnostic, réponse brute) dans Immediate Window.

### Removed
- **`MsgBox` actifs** : aucun MsgBox bloquant restant dans le module — l'exécution n'est plus interrompue par des popups au démarrage du classeur ni en sortie de sync.

---

## [2.3.0.0] — 2026-05-24

### ⚠️ BREAKING CHANGE — Schéma `_ImportGS` réduit à 15 colonnes (A→O)

La colonne `G` **"Prix S98 jour (€/L)"** est supprimée — elle faisait doublon avec `K` ("SP98 station") dans 99 % des cas. La colonne `K` (renommée en `J` après décalage) reste la seule source SP98.

### Removed
- **`Code.gs` — colonne G `Prix S98 jour`** : retirée de `HEADERS`, du `doPost` (plein web app) et du `handleBulkAdd` (sync Excel).
- **`js/formulaire.js`** : variable `prixS98`, lecture du champ `fPrixS98`, confirmation "Prix S98 du jour non saisi", `onS98ManualEdit`, reset du champ.
- **`js/state.js`** : flag `s98Autofilled` retiré.
- **`js/prix.js`** : appels `setFieldPrice('fPrixS98', …)` et `state.s98Autofilled = …` retirés (3 occurrences).
- **`js/carburant.js`** : toggle `s98Field.classList.toggle('hidden', …)` et autofill `fPrixS98` retirés.
- **`js/main.js`** : import et exposition de `onS98ManualEdit` retirés.
- **`index.html`** : bloc `<div class="field" id="s98Field">` (input + label) retiré.

### Changed
- **`Code.gs` — schéma 15 colonnes** : nouveau mapping A=Horodatage, B=Date, C=Type, D=Km, E=Litres, F=Prix €/L, **G=Station essence**, H=Véhicule, I=E85 station, J=SP98 station, K=SP95 station, L=E10 station, M=Gazole station, N=GPLc station, **O=sync_id** (avant : P).
- **`Code.gs` — `handleBulkAdd`** : dedup par `r[14]` au lieu de `r[15]` (colonne O au lieu de P).
- **`Code.gs` — `migrateSyncId` / `migrateHeaders`** : utilisent `getRange(_, 15)` au lieu de 16.
- **`vba/modSyncGS.bas` — `COL_SYNC_ID`** : passe de 16 à 15 (colonne O).
- **`vba/modSyncGS.bas` — `ImportGSToExcel`** : indices `rng(N)` décalés, le mapping suit le nouveau schéma A→O.
- **`vba/modSyncGS.bas` — `RowToJson`** : suppression de `jN("prixS98", …)`, indices `ws.Cells(r, N)` décalés.
- **`js/config.js`** : `APP_VERSION` passée à `2.3.0.0`.

### Added
- **`Code.gs` — `migrateRemoveS98()`** : fonction utilitaire à exécuter **une seule fois** dans GAS Editor pour supprimer l'ancienne colonne G de `_ImportGS`. Toutes les colonnes H→P sont automatiquement décalées en G→O par Google Sheets.
- **`vba/modSyncGS.bas`** (v2.3.0.0) : module VBA de synchronisation bidirectionnelle Excel ↔ Google Sheets aligné sur le nouveau schéma 15 colonnes — `COL_SYNC_ID = 15`, indices `rng()` et `ws.Cells()` décalés, `RowToJson` sans `prixS98`.

### Moved
- **Réorganisation arborescence** : `Google Apps Script/` déplacé sous `Google Drive/Sauvegarde & Geolocalisation - Suivi conso SuperEthanol/Google Apps Script/`. Le dossier `Google Drive/` regroupe désormais les exports/sauvegardes externes (`Réponses - Suivi E85.xlsx` ajouté).
- **`Suivi conso E85.xlsm`** : structure mise à jour (suppression colonne G `Prix S98 jour` dans `GS_Pleins`, ajout colonne O `sync_id`, Power Query rafraîchie sur le nouveau schéma 15 colonnes).

### Migration utilisateur (étapes obligatoires)
1. **GAS Editor** → coller le nouveau `Code.gs` → exécuter `migrateRemoveS98()` → re-déployer.
2. **Excel `Suivi conso E85.xlsm`** → tableau `GS_Pleins` → supprimer la colonne `Prix S98 jour (€/L)` (la colonne `sync_id` revient en colonne O).
3. **Excel Power Query** → Actualiser pour refléter le nouveau schéma 15 colonnes.
4. **VBA** → ré-importer `modSyncGS.bas` (v2.3.0.0).
5. **Web app** → déployer le nouveau code (formulaire sans champ S98 du jour).

---

## [2.2.4.5] — 2026-05-24

### Added
- **`vba/modSyncGS.bas` — `ParseDt()`** : nouvelle fonction qui parse correctement les dates ISO et `YYYY-MM-DD HH:MM:SS` en conservant **l'heure complète**. L'ancienne `IsoToDate` tronquait à `Left(iso, 10)` et perdait l'heure ; conservée comme alias pour compatibilité.
- **Format français appliqué automatiquement** : à chaque sync, les colonnes `Horodatage` (`dd/mm/yyyy hh:mm:ss`) et `Date` (`dd/mm/yyyy`) du tableau `GS_Pleins` reçoivent le format français — toutes lignes incluses (existantes et futures).

### Changed
- **`Code.gs` — `handleExport`** : utilise désormais `Utilities.formatDate(v, ss.getSpreadsheetTimeZone(), "yyyy-MM-dd HH:mm:ss")` au lieu de `toISOString()`. Les dates sont exportées en **heure locale du Google Sheet** (Europe/Paris). Évite l'écart de 1-2 h dû à la conversion UTC↔local.
- **`vba/modSyncGS.bas` — `RowToJson`** : envoie aussi les dates en heure locale (`yyyy-mm-dd hh:mm:ss` sans `T` ni `Z`). GAS les re-parse via `new Date()` en heure locale.
- **`ImportGSToExcel`** : utilise `ParseDt` au lieu de `IsoToDate` pour les colonnes 1 et 2.

---

## [2.2.4.4] — 2026-05-24

### Fixed
- **`vba/modSyncGS.bas` — `ParseRecords` — bug root cause** : la variable locale s'appelait `empty`, qui est un **mot-clé réservé** VBA (constante équivalente à `IsEmpty()`). L'éditeur VBA s'en trouvait perturbé au parsing — syntax error sur la première ligne sur certaines versions, comportement indéfini (gel/boucle) sur d'autres. Renommée en `emp`.
- **Approche simplifiée** : retour au parser `Split("},{")` (suffisant pour un JSON plat sans `},{` dans les valeurs, ce qui est le cas du dataset E85). Le parser à comptage d'accolades était sur-dimensionné pour ce cas d'usage et introduisait des chemins d'exécution complexes inutiles.
- **Toutes les variables déclarées en tête de fonction** (cohérence VBA classique).

---

## [2.2.4.3] — 2026-05-24

### Fixed
- **`vba/modSyncGS.bas` — `ParseRecords`** : remplacement du `Split(arrStr, "},{")` fragile par un parser à **comptage d'accolades** robuste. L'ancienne approche échouait si : (1) un nom de station contient `},{`, (2) GAS ajoute des espaces/sauts de ligne entre objets, (3) objets imbriqués dans les valeurs. Le nouveau parser traverse le JSON caractère par caractère, suit la profondeur d'imbrication et la présence dans une chaîne (détecte les `\"` échappés), et extrait chaque objet racine complet de manière fiable.

---

## [2.2.4.2] — 2026-05-24

### Fixed
- **`vba/modSyncGS.bas` — HTTP** : `ServerXMLHTTP60` absent sur cette machine (composant MSXML6 non enregistré). Remplacement par `WinHttp.WinHttpRequest.5.1` (natif Windows, toujours disponible depuis Vista, suit les redirections HTTPS Google). Fallback automatique sur `MSXML2.XMLHTTP60` si WinHttp lui-même est indisponible. Factorisation dans `CreateHttp()`.
- **`TestConnexion()`** : tente successivement WinHttp puis MSXML2, affiche le composant effectivement utilisé.
- **`SetTimeouts`** harmonisé pour WinHttp (méthode identique : resolve/connect/send/receive en ms).

---

## [2.2.4.1] — 2026-05-24

### Fixed
- **`vba/modSyncGS.bas` — HTTP** : remplacement de `MSXML2.XMLHTTP60` par `MSXML2.ServerXMLHTTP60` + `setTimeouts` (5 s resolve / 10 s connect / 30 s send+receive). `XMLHTTP60` (mode navigateur/WinInet) échouait silencieusement sur la double redirection HTTPS de Google Apps Script ; `ServerXMLHTTP60` (mode serveur/WinHTTP) la gère correctement.
- **Messages d'erreur distincts** : séparation des cas "réseau muet" (`jsonStr = ""`) et "réponse inattendue" (`InStr(..., "records") = 0` — GAS non re-déployé). Chaque cas affiche un message spécifique avec la marche à suivre.

### Added
- **`TestConnexion()`** : fonction de diagnostic publique — affiche le code HTTP, le début de la réponse brute et la cause probable (réseau KO, GAS non re-déployé, accès refusé, redirection non suivie…). À lancer en premier en cas de problème.

---

## [2.2.4.0] — 2026-05-24

### Added
- **`vba/modSyncGS.bas`** : module VBA de synchronisation bidirectionnelle `GS_Pleins` ↔ `_ImportGS`.
  - `SyncOnOpen` : appelé depuis `Workbook_Open`, silencieux si aucun changement, affiche un résumé si des lignes ont été échangées.
  - `SyncManuel` : point d'entrée pour un bouton dans le classeur, affiche toujours le compte-rendu.
  - `SyncCore` : moteur commun — appel `GET ?action=export`, parsing JSON, import GS→Excel, export Excel→GS.
  - `ImportGSToExcel` : insère dans `GS_Pleins` les lignes présentes dans GS mais absentes localement (déduplication par `sync_id`). Compatible ListObject (tableau Excel) et plage ordinaire.
  - `ExportExcelToGS` : envoie à GAS (`action=bulkAdd`) les lignes locales absentes de GS. Génère automatiquement un UUID pour les lignes sans `sync_id`.
  - `ParseRecords` : parser JSON minimal pour tableaux d'objets plats (sans dépendance externe).
  - `JsonGet` : extraction de valeur par clé dans un objet JSON plat (chaîne, nombre, null).
  - `GenerateUUID` : génère un UUID via `Scriptlet.TypeLib`, fallback horodatage+random.
  - `HttpGet` / `HttpPost` : wrappers `MSXML2.XMLHTTP60`.
  - `jS` / `jN` : sérialiseurs JSON (chaîne / nombre).
  - Gestion correcte des caractères Unicode dans les clés JSON (`€` via `ChrW(8364)`, `é` via `ChrW(233)`).
- **`vba/ThisWorkbook_snippet.bas`** : snippet `Workbook_Open` à coller dans le module `ThisWorkbook`.

### Note
> Étapes 3+4/4 du plan de synchronisation bidirectionnelle Excel ↔ Google Sheets.
> Prérequis : exécuter `migrateSyncId()` dans GAS Editor + ajouter colonne P `sync_id` dans `GS_Pleins` + importer le module VBA (voir README).

---

## [2.2.3.0] — 2026-05-24

### Added
- **`Code.gs` — colonne `sync_id` (P)** : UUID généré par `Utilities.getUuid()` à chaque nouveau plein enregistré via l'app web. Si le client fournit un `sync_id` dans le payload, il est utilisé tel quel (préparation étape 2). La réponse `doPost` retourne désormais `{ success: true, sync_id: "…" }`.
- **`Code.gs` — `doGet ?action=export`** : nouveau endpoint JSON retournant tous les enregistrements de `_ImportGS` sous la forme `{ records: [ {Horodatage, Date, …, sync_id}, … ] }`. Les `Date` sont sérialisées en ISO 8601. Utilisé par la macro VBA Excel (étape 3) pour récupérer les données Google Sheets.
- **`Code.gs` — `doPost action=bulkAdd`** : nouveau endpoint d'insertion en masse. Accepte un tableau `rows` depuis Excel, déduplique par `sync_id` (colonne P). Retourne `{ success, added, skipped }`.
- **`Code.gs` — `handleBulkAdd(ss, rows)`** : fonction interne gérant la déduplication et l'insertion des lignes Excel.
- **`Code.gs` — `migrateSyncId()`** : fonction utilitaire à exécuter **une seule fois** manuellement depuis l'éditeur GAS. Ajoute l'en-tête `sync_id` en colonne P et génère un UUID pour chaque ligne existante sans identifiant.

### Changed
- **`Code.gs` — `HEADERS`** : ajout de `'sync_id'` en 16ème position (colonne P). `getOrCreateSheet()` et `migrateHeaders()` alignés sur 16 colonnes.
- **`Code.gs` — `doPost` plein** : utilise `payload.sync_id || Utilities.getUuid()` pour garantir un identifiant unique sur chaque enregistrement.
- **`Code.gs` — `doPost` actions** : tous les blocs `return ContentService…` remplacés par `return jsonResponse(…)` pour cohérence.
- **`js/config.js`** : `APP_VERSION` passée à `2.2.3.0`.

### Note
> Étape 1/4 du plan de synchronisation bidirectionnelle Excel ↔ Google Sheets.
> Étapes suivantes : (2) web app envoie `sync_id` pré-généré, (3) macro VBA Excel sync à l'ouverture, (4) colonne `sync_id` dans `GS_Pleins`.

---

## [2.2.2.4] — 2026-05-24

### Changed
- **CHANGELOG.md** : entrées v2.2.2.1 → v2.2.2.3 rétro-documentées ; section [2.1.0.0] complétée avec les détails du sélecteur de véhicules et des helpers associés.
- **`CHANGELOG_entry.md`** supprimé — contenu fusionné dans `CHANGELOG.md`.
- **`image.png`** supprimé (asset obsolète).
- **`Suivi conso E85.xlsm`** : mise à jour du fichier Excel (import Power Query actualisé).
- **`APP_VERSION`** passée à `2.2.2.4` dans `js/config.js`.

---

## [2.2.2.3] — 2026-05-24

### Fixed
- **`Code.gs` — handler `syncStations` manquant** : la requête `action: 'syncStations'` envoyée par `stations.js` tombait dans la branche par défaut (enregistrement plein), ajoutant une ligne vide dans `_ImportGS`. Ajout du bloc conditionnel dédié : vide l'onglet `Stations` puis réécrit les stations reçues ligne par ligne.

---

## [2.2.2.2] — 2026-05-24

### Fixed
- **Prix E85 toujours enregistré** : lors d'un plein non-E85 (SP98, SP95…), `submitForm` appelait `fetchNearestE85Price(lat, lon)` pour garantir une valeur E85 dans `stationPrices` même si elle n'avait pas été chargée — utile comme référence de comparaison dans Google Sheets.
- **Coordonnées station mémorisées** : `pickStation` stocke désormais `state._selectedLat` / `state._selectedLon` pour que `submitForm` puisse les utiliser sans avoir à ré-interroger la géoloc.
- **Robustesse import VBA** (`Suivi conso E85.xlsm`) : amélioration de la macro d'import pour éviter les erreurs sur les nouvelles colonnes prix station J→O.

### Added
- **`fetchNearestE85Price(lat, lon)`** (`js/prix.js`) : nouvelle fonction asynchrone — requête API progressive (rayons 1 km → 5 km → 15 km) retournant le prix E85 le plus proche d'un point GPS. Retourne `null` si aucun résultat.
- **`state._selectedLat` / `state._selectedLon`** (`js/state.js`) : coordonnées persistées lors de `pickStation`.

---

## [2.2.2.1] — 2026-05-24

### Fixed
- **URL déploiement GAS** : `GAS_URL` mise à jour dans `js/config.js` après re-déploiement du script Google Apps Script (ancienne URL `/AKfycbzl…` → nouvelle `/AKfycbwI…`).

---

## [2.2.2.0] — 2026-05-24

### Added
- **Prix station envoyés au Google Sheet** : `formulaire.js` inclut désormais `stationPrices` (objet `{ E85, SP98, SP95, E10, GAZOLE, GPLC }`) dans le payload soumis. Toujours vide si aucune station sélectionnée via API (saisie manuelle).
- **`Code.gs` — 6 colonnes prix station** : `_ImportGS` Google Sheet reçoit désormais les colonnes J→O : `E85 station (€/L)`, `SP98 station (€/L)`, `SP95 station (€/L)`, `E10 station (€/L)`, `Gazole station (€/L)`, `GPLc station (€/L)`. Structure GS : A=Horodatage … I=Véhicule, J=E85 station … O=GPLc station (15 colonnes).

### Fixed
- **Excel `Suivi conso E85.xlsm` — formules section ANALYSE figées sur 10 lignes** : `COUNTIF(C16:C25,…)`, `SUM(L16:L25)`, `SUMIF(…,F16:F25)`, `AVERAGEIFS(J16:J25,C16:C25,…)`, `COUNTA(D16:D25)` remplacées par des références structurées `Tableau2[colonne]` qui s'étendent automatiquement à chaque nouveau plein.

### Docs
- **README** : structure `_ImportGS` mise à jour (15 colonnes A→O) + note sur l'ajout manuel de la colonne Véhicule en I dans Power Query Excel.

---

## [2.2.1.1] — 2026-05-24

### Fixed
- **`Code.gs` — constante `HEADERS`** : 'Véhicule' manquait en 9ème position ; le sheet créé automatiquement n'aurait pas eu la colonne.
- **`Code.gs` — `doPost` plein** : utilise désormais `getOrCreateSheet()` au lieu de `getSheetByName()` directement, pour garantir la création et l'en-tête si l'onglet n'existe pas.

### Docs
- **README** : liens directs vers le Google Sheet et le Google Apps Script dans la section Accès et Configuration.
- **README** : code GAS mis à jour avec `payload.vehicule`. Référence `app.js` → `js/config.js` pour les constantes.

---

## [2.2.1.0] — 2026-05-24

### Fixed
- **Carburants secondaires non sélectionnables** : SP95, E10, Gazole, GPLc n'apparaissaient que si la station avait déjà des prix chargés. La ligne secondaire est désormais **toujours affichée** — boutons actifs dès l'ouverture de l'app, grisés (`dimmed`) uniquement si la station sélectionnée ne vend pas ce carburant.

### Changed
- **Refactorisation en ES Modules** : `app.js` (772 lignes) découpé en 14 modules sous `js/` :
  `config.js`, `state.js`, `utils.js`, `ui.js`, `vehicules.js`, `osm.js`, `carte.js`, `carburant.js`, `prix.js`, `geo.js`, `recherche.js`, `formulaire.js`, `stations.js`, `main.js`.
- **`index.html`** : `<script src="app.js">` → `<script type="module" src="js/main.js">`.
- **Dépendance circulaire carburant ↔ prix** résolue via `registerPriceCallback()` câblé dans `main.js`.
- **Handlers HTML** exposés sur `window` dans `main.js` (`setType`, `geolocate`, `pickStation`, `selectStationFromMap`…).
- **`.type-btn-sm.dimmed`** (CSS) : opacité 0.38 pour les carburants indisponibles à la station courante.

### Added
- `app.js` supprimé — remplacé par `js/main.js` (point d'entrée).

---

## [2.2.0.0] — 2026-05-24

### Added
- **`FUEL_CONFIG`** : dictionnaire des 6 carburants (E85, SP98, SP95, E10, Gazole, GPLc) — `apiField`, `label`, `short`, `icon`, `ph`.
- **`FUEL_KEYS`, `FUEL_SELECT`, `FUEL_ANY`** : constantes dérivées pour les requêtes API.
- **`_stationPrices`** : état global stockant les prix de la station sélectionnée pour tous les carburants — évite les doubles appels API lors du changement de type.
- **`_buildTypeToggle(prices)`** : construit dynamiquement le toggle carburant. Ligne primaire (E85 + SP98 toujours visibles), ligne secondaire (SP95, E10, Gazole, GPLc) si prix disponibles à la station.
- **`_updateHeaderBadges()`** : affiche dans le bandeau des mini-badges cliquables pour les carburants disponibles à la station (hors type courant).
- **`#headerOtherFuels`** (HTML) : zone de mini-badges dans le header.
- **`.badge-sm`**, **`.header-right`** (CSS) : style des mini-badges et alignement header.
- **`.type-row-primary`**, **`.type-row-secondary`**, **`.type-btn-sm`**, **`.type-price`** (CSS) : styles du toggle dynamique.

### Changed
- **`setType(type)`** : reécrit pour utiliser `FUEL_CONFIG`. Applique les prix depuis le cache `_stationPrices` si disponibles (sans appel API). Met à jour le badge header et les mini-badges.
- **`onStationChange()`**, **`pickStation()`** : réinitialisent `_stationPrices` et reconstruisent le toggle lors d'un changement de station.
- **`searchNearby()`** : `where` et `select` dynamiques selon `currentType` — recherche le carburant sélectionné, pas E85 en dur. Messages de statut dynamiques.
- **`renderNearby()`** : affiche le prix du carburant courant (`currentType`) au lieu du prix E85 fixe.
- **`buildStations()`** : intègre tous les prix dans `s.prices` (objet `{ E85, SP98, … }`) au lieu de `s.e85` / `s.s98`.
- **`applyPricesResult()`** : parse tous les prix API dans `_stationPrices`, reconstruit le toggle et les badges, affiche le statut complet (ex. `E85 : 0.798 · SP98 : 2.091 · Gazole : 1.742`).
- **`fetchPricesAtCoords()`**, **`fetchPricesByCP()`** : utilisent `FUEL_ANY` et `FUEL_SELECT` au lieu des champs e85/sp98 en dur.
- **`searchStationSuggestions()`**, **`searchStationsCityOnly()`** : `where` et `select` dynamiques selon `currentType`.
- **`submitForm()`** : `type` envoyé via `FUEL_CONFIG[currentType].label` — supporte tous les carburants. `prixS98` uniquement pour le mode E85.
- **`resetForm()`** : réinitialise `_stationPrices` et reconstruit le toggle vide.
- **`index.html`** : toggle type statique remplacé par `<div id="typeToggle">` peuplé par JS. `#s98Status` et `#cpSearch` déplacés hors de `#s98Field` (visibles pour tous les carburants). Ajout `#headerOtherFuels` dans le header.

---

## [2.1.4.2] — 2026-05-24

### Fixed
- **Incohérence OSM géoloc vs recherche manuelle** : `searchStationSuggestions` et `searchStationsCityOnly` utilisaient l'adresse brute de l'API gouvernementale ; la géolocalisation utilisait déjà OSM. Les deux chemins affichent désormais le nom d'enseigne OSM (`brand` / `name` / `operator`).

### Changed
- **`enrichWithOsmSerial(stations, setStatus)`** : paramètre optionnel `setStatus` (défaut `setGeoStatus`) — permet d'afficher la progression dans la zone de statut correcte selon le contexte (géoloc ou manuel).
- **`searchStationSuggestions`** : enrichissement OSM appliqué après `buildStations`, via `setAutreStatus`.
- **`searchStationsCityOnly`** : idem.

### Style
- **`#vehiculeSel { margin-top: 8px }`** : décalage bas du sélecteur véhicule.

---

## [2.1.4.1] — 2026-05-24

### Changed
- **Import initial véhicules depuis GS** : au premier lancement (localStorage vide), `chargerVehicules()` interroge l'onglet `vehicules` (minuscule) du Google Sheet. Seule la première colonne est extraite pour éviter le chargement des lignes CSV complètes.
- **URL corrigée** : `sheet=Vehicules` → `sheet=vehicules` (nom réel de l'onglet).

---

## [2.1.4.0] — 2026-05-24

### Fixed
- **Liste véhicules affichait toutes les lignes de `_importgs`** : l'onglet `Vehicules` n'existait pas ; Google Sheets retournait la feuille par défaut. Correction : suppression du fetch GS, véhicules 100 % en localStorage.

### Removed
- `syncVehiculeToSheet()` — supprimée (ajout uniquement local désormais).
- `syncVehiculeRemoveFromSheet()` — supprimée (suppression uniquement locale).

### Changed
- **`chargerVehicules()`** : simplifié, synchrone, lecture localStorage uniquement.

---

## [2.1.3.0] — 2026-05-24

### Added
- **Auto-sélection du dernier véhicule** au démarrage via `localStorage[LAST_VEHICULE_KEY]`.
- **Persistance de la sélection** : véhicule courant sauvegardé à chaque changement.

### Changed
- Liste des véhicules chargée depuis l'onglet `Vehicules` du Google Sheet avec cache localStorage.

---

## [2.1.2.0] — 2026-05-24

### Changed
- **Recherche manuelle centrée sur la ville** : 2 étapes — localisation des coordonnées de la commune, puis stations dans le rayon autour de ce point (au lieu d'une clause `search(ville)` seule).
- **Rayon par défaut** : 20 km.
- **Champ `vehicule`** ajouté dans le payload envoyé au GAS.

---

## [2.1.1.0] — 2026-05-24

### Added
- **Sélecteur de rayon** pour la recherche manuelle : 20 km / 50 km / 100 km / Ville seule.
- **`setRadius(btn, metres)`** : met à jour `searchRadiusM` et relance la recherche si une ville est déjà saisie.

---

## [2.1.0.0] — 2026-05-24

### Added
- **Gestion des véhicules** : liste en localStorage, options `＋ Ajouter` et `✕ Supprimer` dans le select, champ de saisie inline.
- **Recherche accent-insensible** : `search(ville, 'q')` remplace `like` pour la recherche manuelle.
- **Sélecteur de véhicules** (localStorage) : nouvelle section en tête de formulaire. Liste déroulante avec les véhicules enregistrés + deux actions intégrées : `＋ Ajouter un véhicule` (champ inline avec confirmation) et `✕ Supprimer ce véhicule` (confirme la suppression du véhicule actuellement sélectionné). Les véhicules sont persistés dans `localStorage` sous la clé `suivi_e85_vehicules`. Le nom du véhicule est inclus dans le payload envoyé à Google Sheets (champ `vehicule`).
- **`chargerVehicules()`** : charge la liste depuis localStorage, restaure la sélection courante.
- **`sauvegarderVehicules(liste)`** : persiste le tableau en localStorage.
- **`onVehiculeChange()`** : gère les trois cas — sélection d'un véhicule, ajout, suppression.
- **`confirmerAjoutVehicule()`** : validation du nom, ajout à la liste, sélection automatique.
- **`setVehiculeStatus(cls, msg)`** : statut inline sous le sélecteur (même pattern que `setGeoStatus`).
- **`buildStations(results)`** : helper extrait pour factoriser la construction du tableau de stations (évite la duplication entre recherche avec et sans proximité).
- **`buildSearchClause(q)`** : détecte automatiquement si la saisie est un code postal (2-5 chiffres → `cp like 'q%'`) ou une ville (`search(ville, 'q')`).

### Changed
- **Recherche manuelle — champ ciblé** : remplacement du paramètre `q` (full-text tous champs) par `search(ville, 'q')` en ODSQL. La recherche est désormais accent-insensible et porte uniquement sur le champ `ville` — élimine les faux positifs (stations dont l'adresse contient le terme recherché dans une autre ville). Fallback automatique sans proximité si aucun résultat local.
- **`searchStationSuggestions`** : refactorisé pour utiliser `buildSearchClause` et `buildStations`.
- **`searchStationSuggestionsGlobal` renommée `searchStationSuggestionsNoProx`** : cohérence de nommage.
- **`resetForm`** : le véhicule sélectionné est intentionnellement conservé entre deux pleins consécutifs.
- **`submitForm`** : inclut `vehicule: currentVehiculeNom` dans le payload JSON envoyé au GAS.
- **`index.html`** : section "Véhicule" ajoutée en tête du formulaire ; placeholder du champ `fAutre` mis à jour ("Ville de la station", exemples de villes).

### Note GAS (optionnel)
Pour enregistrer le véhicule dans Google Sheets, ajouter la colonne `Véhicule` dans l'onglet `_ImportGS` et mettre à jour `doPost` :
```javascript
sheet.appendRow([
  new Date(), new Date(payload.date), payload.type,
  Number(payload.km), Number(payload.litres), Number(payload.prix),
  payload.prixS98 ? Number(payload.prixS98) : '',
  payload.station, payload.vehicule || ''   // ← nouvelle colonne
]);

---

## [2.0.2.0] — 2026-05-24

### Fixed
- **`getCoords(r)`** : gère les deux formats de coordonnées de l'API ODS — `{lat, lon}` (requêtes avec `distance()`) et GeoJSON `{type: "Point", coordinates: [lon, lat]}` (requêtes sans `distance()`).
- **Calcul de proximité** en recherche manuelle : extraction correcte des coordonnées pour le tri haversine.

---

## [2.0.1.0] — 2026-05-23

### Changed
- **Recherche manuelle accent-insensible** : utilisation du paramètre `q` de l'API ODS (full-text) au lieu de `like`. "raches" trouve désormais "Râches", "leclerc" trouve "E.LECLERC".
- **Résultats dans `nearbyList`** : la recherche manuelle affiche les stations dans la même liste que la géolocalisation, avec distance (si position connue) et carte.
- **`autreField` repositionné** dans `index.html` : apparaît immédiatement sous le sélecteur, avant `nearbyList` et la carte (ordre HTML corrigé).
- **Police réduite** dans le `<select>` : `font-size: 14px` sur le select, `13px` sur les options.
- **`setAutreStatus`** : nouveau helper de statut pour la saisie manuelle (remplace `setSuggStatus`).
- **`onStationChange`** : vide `nearbyList` et `fAutre` quand on repasse sur une station du dropdown.

### Removed
- `renderSuggestions`, `pickSuggestion`, `hideSuggestions`, `setSuggStatus`, `onAutreBlur` — remplacés par le flux `renderNearby` + `nearbyList`.
- `suggList`, `suggStatus` retirés de `index.html`.

---

## [2.0.0.0] — 2026-05-23

### Changed
- **Overpass `around` en série** remplace Nominatim reverse geocoding. Les coordonnées de l'API gouvernementale pouvant être décalées jusqu'à ~2 000 m de la vraie station, une recherche `around:2000` est effectuée autour du point fourni plutôt qu'un reverse geocoding exact.
- **`fetchOsmNameAround(lat, lon)`** : requête Overpass `node+way [amenity=fuel] around:OSM_RADIUS`. Résultats triés par distance haversine — retourne `brand > name > operator` du nœud OSM le plus proche.
- **`enrichWithOsmSerial(stations)`** : exécution séquentielle avec `OSM_SERIAL_DELAY = 600 ms` entre requêtes. Évite les 429 sans sacrifier la rapidité (4 s pour 7 stations).
- **`OSM_RADIUS = 2000`** : rayon de recherche autour du point gouvernemental.
- **Log console** : affiche le nom trouvé et l'écart en mètres entre le point gov et le nœud OSM — permet de mesurer l'imprécision.

### Removed
- `fetchNominatimName` / `enrichWithNominatim` / `NOMINATIM_UA` / `NOMINATIM_DELAY` — Nominatim retiré.

---

## [1.9.9.0] — 2026-05-23

### Added
- **`fetchNominatimName(lat, lon)`** : reverse geocoding Nominatim (`extratags=1`) pour récupérer `brand` ou `operator` OSM. Accepte le résultat uniquement si `type=fuel` ou `extratags.amenity=fuel` — évite les faux positifs sur bâtiments voisins. Timeout 5 s via `AbortSignal.timeout`.
- **`enrichWithNominatim(stations)`** : boucle séquentielle sur les candidats avec 1 100 ms de délai entre requêtes (CGU Nominatim : max 1 req/s). Progression affichée dans le statut : « Identification station 2/7… ».
- **`NOMINATIM_UA`** : `User-Agent` conforme aux CGU Nominatim.

### Changed
- **`searchNearby`** : enrichissement via Nominatim en série après sélection des 7 candidats. Fallback `stationLabel(r)` (adresse) si Nominatim ne trouve pas de `fuel`.
- **`searchStationSuggestions`** : inchangé — adresse directement (l'utilisateur cherche déjà par texte, Nominatim serait redondant et trop lent pour 15 résultats).

### Removed
- **`enrichAllStationsWithOsm`** (bbox Overpass) — définitivement retiré.

---

## [1.9.8.0] — 2026-05-23

### Changed
- **Suppression de l'enrichissement OSM** : l'API Overpass est entièrement retirée. Le dataset gouvernemental ne contient aucun nom d'enseigne — OSM était la seule source possible mais trop instable (429, timeouts).
- **`stationLabel(r)`** remplacée par une version simple : `adresse` capitalisée comme nom de station. Chaque station est désormais identifiée par son adresse (ex. "345 Boulevard Louis Breguet") plutôt que par la ville ou une enseigne supposée.
- **`stationSubLabel(r)`** inchangée : affiche `cp · VILLE` en sous-titre.
- **Constantes supprimées** : `OVERPASS_API` et `DISTANCE_THRESHOLD` retirées de la configuration.
- **`searchNearby`** et **`searchStationSuggestions`** simplifiés : plus d'appel async OSM, résultat immédiat.

### Removed
- `enrichAllStationsWithOsm()` — supprimée
- `resolveStationName()` — supprimée
- Dépendance à `overpass-api.de`

---

## [1.9.7.0] — 2026-05-23

### Changed
- **Requête OSM bbox** : remplacement des clauses `around` multiples (une par station) par **une seule requête bounding box** englobant l'ensemble des stations. Élimine les timeouts `net::ERR_CONNECTION_TIMED_OUT` causés par des requêtes Overpass trop complexes.
- **Calcul de la bbox** : marge de `DISTANCE_THRESHOLD / 111320` degrés ajoutée sur les quatre côtés de l'enveloppe des stations. Matching OSM → station identique (haversine ≤ DISTANCE_THRESHOLD, élément le plus proche).
- **Timeout Overpass** réduit à 15 s (suffisant pour une bbox simple).

---

## [1.9.6.0] — 2026-05-23

### Changed
- **`enrichAllStationsWithOsm`** : remplace les N appels `fetchOsmBrandAndName` parallèles (`Promise.all`) par une seule requête Overpass pour toutes les stations. Élimine les erreurs 429 (Too Many Requests).
- **Algorithme de matching** : pour chaque station du tableau gouvernemental, l'élément OSM retourné le plus proche (haversine ≤ DISTANCE_THRESHOLD) est sélectionné ; `brand` > `name` > `operator` écrasent le nom dans le tableau consolidé.
- **Gestion des `way` OSM** : surfaces cartographiées en polygone traitées via le champ `center` retourné par `out tags center`.
- **`searchNearby`** : message de statut intermédiaire « Identification des enseignes… » pendant la requête OSM.
- **`searchStationSuggestions`** : même approche groupée ; entrées sans coordonnées exclues de la requête OSM puis remappées par index.

### Removed
- **`fetchOsmBrandAndName`** : fonction supprimée, remplacée par `enrichAllStationsWithOsm`.

---

## [1.9.5.1] — 2026-05-23

### Fixed
- **HTTP 400 sur toutes les recherches** : le champ `nom` ajouté dans les `select` de l'API gouvernementale n'existe pas dans le dataset `prix-des-carburants-en-france-flux-instantane-v2`. Son ajout provoquait un rejet systématique de toutes les requêtes. Champ retiré des deux `select` (`searchNearby` et `searchStationSuggestions`).
- **`resolveStationName`** : suppression de l'étape `r.nom` (champ inexistant). Chaîne de priorité : OSM → `stationLabel(r)`.

---

## [1.9.5.0] — 2026-05-23

### Added
- **`resolveStationName(osmName, r)`** : nouvelle fonction centralisant la chaîne de priorité pour le nom affiché : OSM (`brand`/`name`/`operator`) → `r.nom` (API gov) → `stationLabel(r)` (sémantique) → ville.

### Changed
- **Champ `nom`** ajouté dans les `select` API gouvernementale (`searchNearby`, `searchStationSuggestions`) pour servir de fallback entre OSM et l'extraction sémantique.
- **`fetchOsmBrandAndName`** : support des `way` OSM avec champ `center` pour le tri haversine.

### Fixed
- **Bug interpolation `DISTANCE_THRESHOLD`** *(introduit en 1.9.4.1)* : la constante était insérée comme texte littéral (`around:DISTANCE_THRESHOLD`) au lieu d'être interpolée (`around:${DISTANCE_THRESHOLD}`), rendant le rayon Overpass invalide.
- **`escHtml`** : correction des entités HTML (`&` → `&amp;`, `<` → `&lt;`, etc.).

---

## [1.9.4.1] — 2026-05-23

### Changed
- **Refactoring `fetchOsmBrandAndName`** : remplacement de `enrichStationsWithOSM(results)` par une fonction unitaire appelée individuellement par station via `Promise.all`.
- **Support des surfaces OSM (`way`)** : la requête Overpass cible désormais `node` et `way` avec `amenity=fuel`.
- **Tri par distance** dans `fetchOsmBrandAndName` : éléments OSM triés par haversine.

---

## [1.9.3.1] — 2026-05-23

### Changed
- **`DISTANCE_THRESHOLD`** porté à **2000 mètres** pour améliorer la couverture des stations sur l'API Overpass.

---

## [1.9.2.2] — 2026-05-23

### Added
- **`enrichStationsWithOSM(results)`** : méthode asynchrone pour enrichir les données des stations avec les tags OSM (`brand`/`name`). Injection dans `searchNearby` et `searchStationSuggestions` via `_osmName`.

---

## [1.9.2.1] — 2026-05-23

### Added
- **Extraction multi-clés OSM** : priorité `brand` > `name` dans la fonction de croisement spatial.
- **Trace d'audit console** : URL de chaque requête, payload brut et collection finale enrichie.

---

## [1.9.2.0] — 2026-05-23

### Added
- **Extraction multi-clés OSM** : premier jet de la priorité `brand` > `name`.
- **Logs d'audit** : affichage console des payloads bruts des requêtes gouvernementales et Overpass.

---

## [1.9.1.1] — 2026-05-23

### Added
- **Logs de traçabilité réseau** : `console.log` sur les URLs gouvernementales, payload Overpass, et tableau d'enrichissement final.

---

## [1.9.1] — 2026-05-23

### Added
- **Croisement géospatial OSM** : validation de l'enseigne réelle via Overpass (rayon 300 m).
- **Rendu typographique** : enseigne affichée en `<strong>` dans les listes `renderNearby` et `renderSuggestions`.

---

## [1.9.0] — 2026-05-23

### Added
- **Intégration OpenStreetMap (Overpass)** : croisement automatique par coordonnées GPS.
- **Requête spatiale groupée** : clause Overpass unique `around:300` pour `amenity=fuel`.
- **Enrichissement des enseignes** : noms de marque OSM remplacent les labels génériques.

---

## [1.8.1] — 2026-05-23

### Added
- **Extraction sémantique des enseignes** : analyse de `services` et `adresse` pour déduire la marque (TotalEnergies, E.Leclerc, Carrefour, Système U, Esso…).
- **Enseigne en gras** dans les listes ; ville en majuscules comme valeur de secours.

---

## [1.8.0] — 2026-05-23

### Fixed
- **Syntaxe WKT** : suppression de la virgule erronée dans `geom'POINT(lon lat)'` (erreur 400 silencieuse).
- **Lien Google Maps** : URL HTTPS standard.

---

## [1.7.9.0] — 2026-05-23

### Fixed
- **Bouton géolocalisation** : remplacement du filtre `geofilter` obsolète par `distance(geom, geom'POINT(...)', 8000m)` compatible API v2.1.

---

## [1.7.8.2] — 2026-05-23

### Fixed
- **CORS** : retour à l'API gouvernementale officielle (`data.economie.gouv.fr`).
- **Extraction sémantique** des enseignes depuis `services`/`adresse`.

---

## [1.7.8] — 2026-05-23

### Added
- **Enseignes réelles** depuis l'API OpenStreetMap enrichie (champ `name`).

---

## [1.7.2] — 2026-05-23

### Fixed
- **Marqueurs carte absents** en recherche manuelle : `requestAnimationFrame` remplacé par `setTimeout(fn, 0)` + `getBoundingClientRect()`.
- **Géolocalisation sans résultat** : rayon API porté à **8 000 m**.

---

## [1.7.1] — 2026-05-23

### Added
- **Noms officiels des stations** depuis le champ `nom` de l'API gouvernementale.
- **Infobulles tactiles** sur les marqueurs de carte (2 s).
- **`escHtml()`** : échappement des caractères spéciaux.

### Changed
- Constantes de configuration regroupées en tête de `app.js`.
- `searchStationSuggestions` : recherche étendue au champ `nom`, limite à 12 résultats.
- `stationSubLabel()` : ville affichée en complément de l'adresse.

---

## [1.7.0] — 2026-05-23

### Added
- **Carte interactive tuiles OSM** : moteur JS pur, sans dépendance externe.
- **Marqueurs ⛽ cliquables** sur la carte ; synchronisation bidirectionnelle liste ↔ carte.
- **Affichage automatique de la carte** lors de la recherche manuelle.
- **Badge carburant dynamique** (🌿 / 💧) et version dans le bandeau.

### Fixed
- **HTTP 400** géolocalisation : remplacement de `distance()` ODSQL par `geofilter.distance`.
- **`L is not defined`** : suppression de la dépendance Leaflet.

---

## [1.6.0] — 2026-05-23

### Added
- **Chargement dynamique des stations** depuis l'onglet `Stations` du Google Sheet.
- **Synchronisation automatique** des nouvelles stations après chaque plein.
- **Fallback statique** si l'onglet `Stations` est inaccessible.

---

## [1.5.0] — 2026-05-22

### Added
- **Séparation HTML / CSS / JS** en trois fichiers distincts.

### Fixed
- Alignement bannière « Coût du plein » et police `.cout-val`.

---

## [1.4.0] — 2026-05-22

### Added
- **Suggestions de station** en saisie manuelle avec debounce 500 ms.

---

## [1.3.0] — 2026-05-22

### Added
- Récupération simultanée **E85 + SP98** en un seul appel API.
- **Recherche par code postal** en dernier recours.

---

## [1.2.0] — 2026-05-22

### Added
- **Récupération automatique du prix SP98** à la sélection d'une station.

---

## [1.1.0] — 2026-05

### Added
- **Géolocalisation** via Overpass / OpenStreetMap (rayon 8 km).

---

## [1.0.0] — 2026-05

### Added
- Formulaire mobile E85 / Super 98, toggle, calcul temps réel, envoi GAS → Google Sheets.

---

[1.9.7.0]: https://github.com/fdaubercy/suivi-e85/compare/v1.9.6.0...v1.9.7.0
[1.9.6.0]: https://github.com/fdaubercy/suivi-e85/compare/v1.9.5.1...v1.9.6.0
[1.9.5.1]: https://github.com/fdaubercy/suivi-e85/compare/v1.9.5.0...v1.9.5.1
[1.9.5.0]: https://github.com/fdaubercy/suivi-e85/compare/v1.9.4.1...v1.9.5.0
[1.9.4.1]: https://github.com/fdaubercy/suivi-e85/compare/v1.9.3.1...v1.9.4.1
[1.9.3.1]: https://github.com/fdaubercy/suivi-e85/compare/v1.9.2.2...v1.9.3.1
[1.9.2.2]: https://github.com/fdaubercy/suivi-e85/compare/v1.9.2.1...v1.9.2.2
[1.9.2.1]: https://github.com/fdaubercy/suivi-e85/compare/v1.9.2.0...v1.9.2.1
[1.9.2.0]: https://github.com/fdaubercy/suivi-e85/compare/v1.9.1.1...v1.9.2.0
[1.9.1.1]: https://github.com/fdaubercy/suivi-e85/compare/v1.9.1...v1.9.1.1
[1.9.1]: https://github.com/fdaubercy/suivi-e85/compare/v1.9.0...v1.9.1
[1.9.0]: https://github.com/fdaubercy/suivi-e85/compare/v1.8.1...v1.9.0
[1.8.1]: https://github.com/fdaubercy/suivi-e85/compare/v1.8.0...v1.8.1
[1.8.0]: https://github.com/fdaubercy/suivi-e85/compare/v1.7.9.0...v1.8.0
[1.7.9.0]: https://github.com/fdaubercy/suivi-e85/compare/v1.7.8.2...v1.7.9.0
[1.7.8.2]: https://github.com/fdaubercy/suivi-e85/compare/v1.7.8...v1.7.8.2
[1.7.8]: https://github.com/fdaubercy/suivi-e85/compare/v1.7.2...v1.7.8
[1.7.2]: https://github.com/fdaubercy/suivi-e85/compare/v1.7.1...v1.7.2
[1.7.1]: https://github.com/fdaubercy/suivi-e85/compare/v1.7.0...v1.7.1
[1.7.0]: https://github.com/fdaubercy/suivi-e85/compare/v1.6.0...v1.7.0
[1.6.0]: https://github.com/fdaubercy/suivi-e85/compare/v1.5.0...v1.6.0
[1.5.0]: https://github.com/fdaubercy/suivi-e85/compare/v1.4.0...v1.5.0
[1.4.0]: https://github.com/fdaubercy/suivi-e85/compare/v1.3.0...v1.4.0
[1.3.0]: https://github.com/fdaubercy/suivi-e85/compare/v1.2.0...v1.3.0
[1.2.0]: https://github.com/fdaubercy/suivi-e85/compare/v1.1.0...v1.2.0
[1.1.0]: https://github.com/fdaubercy/suivi-e85/compare/v1.0.0...v1.1.0
[1.0.0]: https://github.com/fdaubercy/suivi-e85/releases/tag/v1.0.0
