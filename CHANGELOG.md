# Changelog

Toutes les modifications notables de ce projet sont documentées ici.

Format : [Keep a Changelog](https://keepachangelog.com/fr/1.0.0/)

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
