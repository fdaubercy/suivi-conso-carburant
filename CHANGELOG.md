# Changelog

Toutes les modifications notables de ce projet sont documentées ici.

Format : [Keep a Changelog](https://keepachangelog.com/fr/1.0.0/)

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

[1.7.0]: https://github.com/fdaubercy/suivi-e85/compare/v1.6.0...v1.7.0
[1.6.0]: https://github.com/fdaubercy/suivi-e85/compare/v1.5.0...v1.6.0
[1.5.0]: https://github.com/fdaubercy/suivi-e85/compare/v1.4.0...v1.5.0
[1.4.0]: https://github.com/fdaubercy/suivi-e85/compare/v1.3.0...v1.4.0
[1.3.0]: https://github.com/fdaubercy/suivi-e85/compare/v1.2.0...v1.3.0
[1.2.0]: https://github.com/fdaubercy/suivi-e85/compare/v1.1.0...v1.2.0
[1.1.0]: https://github.com/fdaubercy/suivi-e85/compare/v1.0.0...v1.1.0
[1.0.0]: https://github.com/fdaubercy/suivi-e85/releases/tag/v1.0.0
