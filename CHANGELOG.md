# Changelog

Toutes les modifications notables de ce projet sont documentées ici.

Format : [Keep a Changelog](https://keepachangelog.com/fr/1.0.0/)

## [1.9.2.0] — 2026-05-23

### Ajouté
- **Extraction intelligente multi-clés OSM** : Ajustement de la fonction de croisement spatial pour rechercher prioritairement la balise `brand` (la marque réseau de l'enseigne) et utiliser la balise `name` en cas d'absence.
- **Trace d'audit normalisée (Console)** : Affichage systématique dans la console web pour chaque requête réseau de l'URL exécutée, du tableau brut d'objets reçus (depuis `data.economie.gouv.fr` et `overpass-api.de`), ainsi que de la collection finale enrichie destinée au rendu graphique.

## [1.9.1.1] — 2026-05-23

### Ajouté
- **Logs de traçabilité réseau** : Ajout de marqueurs `console.log` explicites imprimant les URLs de requêtes exécutées vers l'API gouvernementale (`data.economie.gouv.fr`).
- **Audit de payload OpenStreetMap** : Sortie de la chaîne QL textuelle générée à destination de l'API Overpass pour inspecter le périmètre spatial exact (`around:300`).
- **Trace du tableau d'enrichissement** : Impression structurée dans la console (`console.log`) du tableau final d'objets `stations` après résolution et injection du nom de marque de l'enseigne validé.

## [1.9.1] — 2026-05-23

### Ajouté
- **Interopérabilité sémantique OpenStreetMap** : Croisement géospatial unifié entre la base gouvernementale et l'API Overpass pour valider l'enseigne réelle des stations à moins de 300 mètres.
- **Rendu typographique ciblé** : Modification de `renderNearby` et `renderSuggestions` pour isoler et afficher explicitement **le nom/enseigne de la station en gras** (`<strong>`). La localisation géographique et l'adresse complète sont reléguées en métadonnées secondaires textuelles pour maximiser la clarté opérationnelle.

## [1.9.0] — 2026-05-23

### Ajouté
- **Interopérabilité avec OpenStreetMap (Overpass)** : Intégration d'un module de croisement automatique basé sur les coordonnées GPS extraites de l'API gouvernementale.
- **Requête Spatiale Groupée** : Optimisation des performances réseau via l'agrégation des positions dans une clause Overpass unique `around:300` ciblant `amenity=fuel`.
- **Enrichissement des Enseignes** : Remplacement transparent des labels génériques par les noms de marque exacts enregistrés dans la base collaborative OSM (ex: identification de filiales ou de stations indépendantes complexes), puis insertion directe dans le tableau final des résultats.
- **Logs d'audit** : Sortie console du payload brut issu d'Overpass à des fins de débogage structurel.

## [1.8.1] — 2026-05-23

### Ajouté
- **Extraction sémantique des enseignes** : Analyse des métadonnées `services` et `adresse` pour en déduire de manière fiable l'enseigne commerciale (ex: *TotalEnergies, E.Leclerc, Carrefour, Système U, Esso*).
- **Mise en valeur typographique** : Affichage systématique de la marque de l'enseigne en **gras** au lieu de la commune dans les listes de résultats (recherche manuelle et géolocalisation). La commune en majuscules sert de valeur de secours en gras uniquement si aucune enseigne de marque n'est détectée.
- **Traçabilité sémantique** : Ajout de `console.log` d'audit sur les réponses brutes des requêtes pour permettre l'analyse structurelle des payloads dans la console du navigateur.

## [1.8.0] — 2026-05-23

### Corrigé
- **Syntaxe WKT de l'API d'État rectifiée** : Suppression de la virgule erronée séparent la longitude et la latitude dans l'expression SQL `geom'POINT(lon lat)'` qui générait une erreur 400 silencieuse dans `searchNearby()` et `fetchPricesAtCoords()`.
- **Lien Google Maps sécurisé** : Passage du protocole d'extraction cartographique de l'aperçu à l'URL de recherche d'API standard universelle HTTPS.

---

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
[1.4.0]: https://github.com/fdaubercy/suivi-e85/compare/v1.4.0...v1.4.0
[1.3.0]: https://github.com/fdaubercy/suivi-e85/compare/v1.2.0...v1.3.0
[1.2.0]: https://github.com/fdaubercy/suivi-e85/compare/v1.1.0...v1.2.0
[1.1.0]: https://github.com/fdaubercy/suivi-e85/compare/v1.0.0...v1.1.0
[1.0.0]: https://github.com/fdaubercy/suivi-e85/releases/tag/v1.0.0