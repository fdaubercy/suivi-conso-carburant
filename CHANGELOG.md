# Changelog

Toutes les modifications notables de ce projet sont documentées ici.

Format : [Keep a Changelog](https://keepachangelog.com/fr/1.0.0/)

---

## [1.5.0] — 2026-05-22

### Ajouté
- **Séparation HTML / CSS / JS** : le code source est désormais réparti en trois
  fichiers distincts (`index.html`, `style.css`, `app.js`) pour une meilleure
  maintenabilité.

### Corrigé
- **Alignement de la bannière "Coût du plein"** : label et montant sont maintenant
  sur la même ligne (`align-items: center`), au lieu d'être décalés verticalement.
- **Police du coût** : `.cout-val` passe de 24 px bold à 16 px semi-bold, identique
  aux champs de saisie du formulaire. La couleur bleue (`--blue-dark`) est conservée.

---

## [1.4.0] — 2026-05-22

### Ajouté
- **Suggestions de station en saisie manuelle** : dès 3 caractères tapés dans
  le champ « Autre », une recherche est lancée (avec debounce 500 ms) dans l'API
  gouvernementale par adresse et ville. Une liste de suggestions s'affiche sous
  le champ avec adresse complète, ville, CP et prix E85 si disponible.
- **Sélection d'une suggestion** :
  - Remplace le texte du champ par le nom canonique de la station
  - Met à jour dans le dropdown **toutes les options portant l'ancienne saisie**
    par le nouveau nom normalisé
  - Ajoute l'option dans le groupe « Stations habituelles » si elle n'y figure pas
  - Déclenche immédiatement la récupération des prix via les coordonnées exactes
    (`geom.lat` / `geom.lon`) retournées par l'API
- Indicateur visuel spinner pendant la recherche de suggestions.
- Message informatif si aucun résultat trouvé ou en cas d'erreur réseau.

### Modifié
- `onAutreBlur()` : attend 200 ms avant de lancer la recherche de prix, pour
  laisser le temps au `onmousedown` de `pickSuggestion` de s'exécuter avant
  que le `blur` ne masque la liste.
- `resetForm()` : ferme et vide la liste de suggestions, remet le statut à zéro.

---

## [1.3.0] — 2026-05-22

### Ajouté
- **Récupération simultanée des prix E85 et SP98** en un seul appel API dès la
  sélection d'une station (liste géo, dropdown, ou saisie manuelle).
- **Affichage `--` en grisé** dans les champs prix quand le prix correspondant
  n'est pas disponible dans l'API, pour indiquer clairement qu'une saisie manuelle
  est attendue.
- **Recherche par code postal** : si aucun résultat n'est trouvé par coordonnées,
  un champ code postal apparaît pour lancer une recherche de secours.
- Support des **stations saisies manuellement** : le prix est recherché via le GPS
  de l'utilisateur dès que le champ est quitté.
- Fonction `setFieldPrice()` : logique centralisée pour remplir un champ ou
  afficher `--` en placeholder grisé.

### Modifié
- `fetchPrixS98ByCoords` → `fetchPricesAtCoords` : récupère `e85_prix` **et**
  `sp98_prix` en un seul appel.
- `fetchPrixS98NearUser` → `fetchPricesNearUser`.
- `applyS98Result` → `applyPricesResult`.
- `fetchPrixS98ByCP` → `fetchPricesByCP`.
- `setType()` efface `fPrix` et re-déclenche la recherche si une station est déjà
  sélectionnée.
- `resetForm()` restaure les placeholders par défaut sur les deux champs prix.

---

## [1.2.0] — 2026-05-22

### Ajouté
- **Récupération automatique du prix SP98** dès qu'une station est sélectionnée,
  via l'API gouvernementale `data.economie.gouv.fr`.
- Rayon progressif 500 m → 2 km → 5 km ; fallback GPS utilisateur.
- Indicateur de statut, mise en forme verte du champ auto-rempli (6 s).
- Champ **code postal** en dernier recours.
- Support stations saisies manuellement (blur → GPS).

### Modifié
- `pickStation(name)` → `pickStation(name, lat, lon)`.
- GPS utilisateur stocké à la géolocalisation et réutilisé.
- `resetForm()` remet à zéro champ SP98, statut et mise en forme.

### Corrigé
- Champs API v1 → v2 (`sp98_prix`, `adresse`, `ville`).
- URLs construites avec `URLSearchParams`.

---

## [1.1.0] — 2026-05

### Ajouté
- **Géolocalisation** via Overpass / OpenStreetMap (rayon 8 km).
- Liste des 7 stations E85 les plus proches, triées par distance.
- Badge « connue » pour les stations déjà dans le dropdown.
- Gestion des erreurs de géolocalisation.

### Modifié
- Champ Station : `<input>` libre → `<select>` + option « Autre ».

---

## [1.0.0] — 2026-05

### Ajouté
- Formulaire mobile E85 / Super 98 (date, km, litres, prix, station).
- Toggle E85 / S98, calcul temps réel du coût, envoi GAS → Google Sheets.
- Interface iPhone optimisée, support PWA, hébergement GitHub Pages.

---

[1.5.0]: https://github.com/fdaubercy/suivi-e85/compare/v1.4.0...v1.5.0
[1.4.0]: https://github.com/fdaubercy/suivi-e85/compare/v1.3.0...v1.4.0
[1.3.0]: https://github.com/fdaubercy/suivi-e85/compare/v1.2.0...v1.3.0
[1.2.0]: https://github.com/fdaubercy/suivi-e85/compare/v1.1.0...v1.2.0
[1.1.0]: https://github.com/fdaubercy/suivi-e85/compare/v1.0.0...v1.1.0
[1.0.0]: https://github.com/fdaubercy/suivi-e85/releases/tag/v1.0.0
