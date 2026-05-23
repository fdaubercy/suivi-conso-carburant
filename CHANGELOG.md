# Changelog

Toutes les modifications notables de ce projet sont documentées ici.

Format : [Keep a Changelog](https://keepachangelog.com/fr/1.0.0/)

# Changelog

Toutes les modifications notables de ce projet sont documentées ici.

Format : [Keep a Changelog](https://keepachangelog.com/fr/1.0.0/)

## [1.7.9.0] — 2026-05-23

### Corrigé
- **Bouton Géolocalisation fonctionnel** : Remplacement du filtrage `geofilter` obsolète par une clause SQL `where` spatial utilisant `distance(geom, geom'POINT(...)', 8000m)` compatible avec l'API v2.1 de la plateforme d'État.
- **Rayon strict à 8 km** : Ajustement et limitation stricte du filtrage de distance à 8 km maximum conformément aux instructions pour éviter la pollution des résultats lointains.

---

## [1.7.8.2] — 2026-05-23

### Corrigé
- **Erreur CORS résolue** : Retour complet à l'API gouvernementale officielle (`data.economie.gouv.fr`) pour éviter le blocage d'origine croisée constaté sur l'API OSM communautaire.
- **Extraction intelligente des enseignes** : Utilisation d'un algorithme de détection sémantique basé sur les champs `services` et `adresse` de la base d'origine afin d'isoler la marque de l'établissement (Total, Leclerc, Carrefour...) directement depuis les flux autorisés.

---
## [1.7.8] — 2026-05-23

### Ajouté
- **Enseignes de stations réelles** : bascule de l'API brute gouvernementale vers l'API enrichie OpenStreetMap. Le champ `name` (contenant la marque/enseigne comme Total, Leclerc, Carrefour) est désormais capturé et affiché dynamiquement sur la carte, les listes de suggestions et la géolocalisation locale sans générer d'erreurs HTTP 400.

## [1.7.2] — 2026-05-23

### Corrigé
- **Marqueurs carte absents en recherche manuelle** : `requestAnimationFrame` était
  trop précoce pour lire `offsetWidth` après `hidden → visible`. Remplacé par
  `setTimeout(fn, 0)` + `getBoundingClientRect()` pour forcer un reflow complet
  avant le calcul de la grille de tuiles — les marqueurs apparaissent désormais
  correctement dès l'affichage de la liste de suggestions.
- **Géolocalisation sans résultat** : rayon API `geofilter.distance` porté de
  6 000 m à **8 000 m**. Filtre client assoupli à 10 000 m pour ne pas tronquer
  les résultats en bordure de rayon. Message d'état mis à jour (« dans 8 km »).

---

## [1.7.1] — 2026-05-23

### Ajouté
- **Noms officiels des stations** : le champ `nom` de l'API gouvernementale est récupéré
  dans tous les appels (`searchNearby`, `searchStationSuggestions`). `stationLabel()` l'utilise
  en priorité — la ville n'est affichée que si aucun nom n'est disponible.
- **Infobulles tactiles** : `onmouseenter` + `ontouchstart` sur chaque marqueur de carte
  affichent le nom (ou l'adresse) de la station pendant 2 secondes. Un timer par marqueur
  évite les conflits entre plusieurs touches.
- **Fonction `escHtml()`** : échappe les caractères spéciaux dans les labels de marqueurs
  et les lignes de liste pour éviter toute injection HTML.

### Modifié
- `APP_VERSION`, `GAS_URL` et `GS_SHEET_ID` regroupés en tête de fichier dans un bloc
  « Configuration » clairement commenté — plus de constante perdue en bas du fichier.
- `searchStationSuggestions` : recherche étendue au champ `nom` (`OR search(nom, "…")`),
  limite portée à 12 résultats.
- `stationSubLabel()` : affiche la ville en complément de l'adresse quand un nom officiel
  est disponible, pour identifier sans ambiguïté deux stations dans la même ville.
- `renderNearby` et `renderSuggestions` : noms et sous-titres passent par `escHtml()`.
- Sélection depuis la carte (`selectStationFromMap`) : utilise les ID `mapPinDot${i}` et
  `mapPinLbl${i}` générés proprement, et appelle `showPinLabel()` après sélection.

### Corrigé
- `APP_VERSION` définie en bas du fichier (variable en dur difficile à retrouver lors des
  déploiements) — remontée en tête de fichier avec les autres constantes de configuration.

---

## [1.7.0] — 2026-05-23

### Ajouté
- **Carte interactive tuiles OSM** : moteur de rendu maison en JS pur (zéro dépendance
  externe). Remplace l'iframe OpenStreetMap et supprime la dépendance à Leaflet.
- **Marqueurs de stations cliquables** : chaque station trouvée (géolocalisation ou
  recherche manuelle) est représentée par un marqueur ⛽ sur la carte. Un clic sur un
  marqueur sélectionne la station et met en surbrillance la ligne correspondante dans la liste.
- **Affichage automatique de la carte** lors de la recherche manuelle : dès que la liste
  de suggestions s'affiche, les stations géolocalisées apparaissent sur la carte.
- **Badge carburant dynamique** dans le bandeau : affiche 🌿 E85 ou 💧 S98 selon le
  mode sélectionné.
- **Version de l'application** affichée dans le bandeau (`APP_VERSION` dans `app.js`).

### Modifié
- Rayon de recherche géolocalisée réduit à **6 km** (filtre API + filtre strict côté client).
- Noms des stations : **ville** en titre, adresse en sous-titre (l'API ne retourne pas
  les enseignes).
- Structure du header : `<div class="header-title">` englobant `<h1>` et `<span id="appVersion">`.

### Corrigé
- **Erreur HTTP 400** sur la recherche géolocalisée : remplacement du filtre `distance()`
  ODSQL par le paramètre `geofilter.distance` natif de l'API ODS.
- **Erreur `L is not defined`** : suppression complète de la dépendance Leaflet.

---

## [1.6.0] — 2026-05-23

### Ajouté
- **Chargement dynamique des stations** depuis l'onglet `Stations` du Google Sheet.
- **Synchronisation automatique des nouvelles stations** après chaque plein validé.
- **Fallback statique** si le chargement de l'onglet `Stations` échoue.

### Modifié
- `GS_SHEET_ID` ajouté comme constante de configuration en tête de `app.js`.

---

## [1.5.0] — 2026-05-22

### Ajouté
- **Séparation HTML / CSS / JS** en trois fichiers distincts.

### Corrigé
- Alignement de la bannière « Coût du plein ».
- Police du coût (`.cout-val`).

---

## [1.4.0] — 2026-05-22

### Ajouté
- **Suggestions de station en saisie manuelle** avec debounce 500 ms.
- Sélection d'une suggestion : nom canonique, mise à jour dropdown, récupération des prix.

---

## [1.3.0] — 2026-05-22

### Ajouté
- Récupération simultanée des prix **E85 et SP98** en un seul appel API.
- Affichage `--` en grisé quand le prix n'est pas disponible.
- **Recherche par code postal** en dernier recours.

---

## [1.2.0] — 2026-05-22

### Ajouté
- **Récupération automatique du prix SP98** dès qu'une station est sélectionnée.

---

## [1.1.0] — 2026-05

### Ajouté
- **Géolocalisation** via Overpass / OpenStreetMap (rayon 8 km).

---

## [1.0.0] — 2026-05

### Ajouté
- Formulaire mobile E85 / Super 98, toggle, calcul temps réel, envoi GAS → Google Sheets.

---

[1.7.1]: https://github.com/fdaubercy/suivi-e85/compare/v1.7.0...v1.7.1
[1.7.0]: https://github.com/fdaubercy/suivi-e85/compare/v1.6.0...v1.7.0
[1.6.0]: https://github.com/fdaubercy/suivi-e85/compare/v1.5.0...v1.6.0
[1.5.0]: https://github.com/fdaubercy/suivi-e85/compare/v1.4.0...v1.5.0
[1.4.0]: https://github.com/fdaubercy/suivi-e85/compare/v1.3.0...v1.4.0
[1.3.0]: https://github.com/fdaubercy/suivi-e85/compare/v1.2.0...v1.3.0
[1.2.0]: https://github.com/fdaubercy/suivi-e85/compare/v1.1.0...v1.2.0
[1.1.0]: https://github.com/fdaubercy/suivi-e85/compare/v1.0.0...v1.1.0
[1.0.0]: https://github.com/fdaubercy/suivi-e85/releases/tag/v1.0.0
