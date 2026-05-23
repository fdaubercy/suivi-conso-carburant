## [2.0.2.0] — 2026-05-23

### Fixed
- **`getCoords` — support GeoJSON Point** : l'API ODS v2.1 retourne `geom` dans deux formats selon la requête. Avec `distance()` dans le `where` → `{lat, lon}` plat (fonctionnait). Sans `distance()` (recherche manuelle par `q`) → `{type:"Point", coordinates:[lon, lat]}` GeoJSON (ne fonctionnait pas). `getCoords` gère désormais les deux formats — c'est la cause pour laquelle les 15 résultats de la recherche manuelle n'étaient ni affichés dans la liste ni sur la carte.
- **`renderNearby` — dist null** : la distance `null` (position inconnue) n'affiche plus `"null m"` mais est simplement omise.
- **`renderNearby` — liste vide** : `style.display` reste `none` si `stations` est vide (au lieu de montrer une liste vide).

### Changed
- **Filtre de proximité en recherche manuelle** : quand la position GPS est connue, la requête `q` inclut un filtre `distance(geom, …, 100000m)` (100 km). Évite de retourner des stations de toute la France qui matchent le terme recherché. Si aucun résultat dans ce rayon, fallback automatique sur France entière avec mention "(France entière)" dans le statut.
- **`searchStationSuggestionsGlobal`** : nouveau helper pour le fallback sans filtre de proximité.

