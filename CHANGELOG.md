# Changelog

Toutes les modifications notables de ce projet sont documentées ici.

Format : [Keep a Changelog](https://keepachangelog.com/fr/1.0.0/)

---

## [1.3.0] — 2026-05-22

### Ajouté
- **Récupération simultanée des prix E85 et SP98** en un seul appel API dès la
  sélection d'une station (liste géo, dropdown, ou saisie manuelle).
- **Affichage `--` en grisé** dans les champs prix quand le prix correspondant
  n'est pas disponible dans l'API, pour indiquer clairement qu'une saisie manuelle
  est attendue (plutôt qu'un champ vide ambigü).
- **Recherche par code postal** : si aucun résultat n'est trouvé par coordonnées,
  un champ code postal apparaît pour lancer une recherche de secours.
- Support des **stations saisies manuellement** : le prix est recherché via le GPS
  de l'utilisateur (stocké lors de la géolocalisation) dès que le champ est quitté.
- Fonction `setFieldPrice()` : logique centralisée pour remplir un champ ou
  afficher `--` en placeholder grisé selon disponibilité du prix.

### Modifié
- `fetchPrixS98ByCoords` → `fetchPricesAtCoords` : récupère désormais `e85_prix`
  **et** `sp98_prix` en un seul appel (select groupé).
- `fetchPrixS98NearUser` → `fetchPricesNearUser` : même logique étendue aux deux prix.
- `applyS98Result` → `applyPricesResult` : remplit `fPrix` (E85 ou SP98 selon le
  type sélectionné) **et** `fPrixS98`, avec message de statut consolidé.
- `fetchPrixS98ByCP` → `fetchPricesByCP` : inclut aussi `e85_prix` dans la requête.
- `setType()` efface maintenant `fPrix` et re-déclenche la recherche de prix si
  une station est déjà sélectionnée.
- `resetForm()` restaure les placeholders par défaut (`0.798` / `2.091`) sur les
  deux champs prix au lieu de laisser `--`.

---

## [1.2.0] — 2026-05-22

### Ajouté
- **Récupération automatique du prix SP98** dès qu'une station est sélectionnée,
  via l'API gouvernementale `data.economie.gouv.fr` (données temps réel).
- Deux stratégies de recherche selon la source de sélection :
  - station choisie depuis la liste géo → recherche par **coordonnées** (rayon progressif
    500 m → 2 km → 5 km, plus précise)
  - station choisie dans le dropdown fixe → utilise le **GPS de l'utilisateur** stocké
- Fallback automatique : si les coordonnées OSM ne donnent aucun résultat dans 5 km,
  retente avec la position GPS réelle de l'utilisateur.
- Indicateur de statut sous le champ SP98 : spinner pendant la recherche,
  confirmation avec adresse et ville de la station si trouvé, message d'info sinon.
- Mise en forme visuelle du champ SP98 auto-rempli (fond vert clair, bordure verte),
  disparaissant après 6 secondes.
- Détection de la saisie manuelle : la mise en forme automatique est immédiatement
  retirée si l'utilisateur modifie le prix à la main.
- Champ **code postal** affiché en dernier recours si aucun résultat géographique.
- Support des **stations saisies manuellement** : recherche déclenchée au `blur` du
  champ, en utilisant le GPS de l'utilisateur.

### Modifié
- `pickStation(name)` → `pickStation(name, lat, lon)` : les coordonnées OSM sont
  maintenant transmises depuis `renderNearby` pour affiner la recherche de prix.
- Les objets station dans `searchNearby` incluent désormais `lat` et `lon`.
- GPS utilisateur (`userLat`, `userLon`) stocké dès la géolocalisation et réutilisé
  pour toutes les recherches de prix ultérieures dans la session.
- `resetForm()` remet à zéro le champ SP98, son statut et sa mise en forme.

### Corrigé
- Champs API v1 (`prix_nom`, `prix_valeur`, `nom`) remplacés par les vrais champs
  v2 (`sp98_prix`, `adresse`, `ville`).
- Construction des URLs avec `URLSearchParams` pour un encodage correct des
  apostrophes dans la syntaxe ODS `geom'POINT(lon lat)'`.

---

## [1.1.0] — 2026-05

### Ajouté
- **Géolocalisation** : bouton 📍 dans le sélecteur de station pour détecter
  les stations E85 proches via l'API [Overpass / OpenStreetMap](https://overpass-api.de/).
- Rayon de recherche : 8 km autour de la position GPS de l'utilisateur.
- Liste déroulante des 7 stations les plus proches triées par distance,
  avec badge « connue » pour les stations déjà présentes dans le dropdown.
- Affichage de la distance en mètres ou en km selon l'éloignement.
- Ajout automatique de la station choisie dans le dropdown si elle n'y figure pas encore.
- Messages de statut géo (localisation en cours, résultats, erreurs d'accès).
- Gestion des erreurs de géolocalisation : refus d'accès, position introuvable, délai dépassé.

### Modifié
- Le champ « Station » passe d'un `<input>` libre à un `<select>` avec stations habituelles
  et option « + Autre (saisie manuelle) ».
- Le champ de saisie manuelle n'apparaît que si « Autre » est sélectionné.

---

## [1.0.0] — 2026-05

### Ajouté
- Formulaire mobile de saisie d'un plein carburant (SuperEthanol E85 / Super 98).
- Champs : date (pré-remplie au jour J), km compteur, litres, prix au litre, station.
- Toggle **E85 / Super 98** : adapte le libellé du champ prix et affiche/masque
  le champ « Prix S98 du jour » (uniquement pertinent en mode E85).
- **Calcul temps réel du coût du plein** (litres × prix) affiché dans une bannière bleue.
- Confirmation avant soumission si le prix S98 du jour est absent (mode E85).
- Envoi des données vers **Google Apps Script** (POST JSON) puis enregistrement
  dans l'onglet `_ImportGS` du Google Sheet `Suivi_conso_E85`.
- Feedback visuel après soumission : succès (vert) ou erreur (rouge) avec message détaillé.
- Remise à zéro automatique du formulaire après un enregistrement réussi.
- Interface optimisée iPhone : `font-size: 16px` sur tous les inputs (bloque le zoom auto Safari),
  safe areas notch + home indicator, bouton « Enregistrer » sticky en bas d'écran.
- Support PWA : balises `apple-mobile-web-app-*` pour l'ajout à l'écran d'accueil iOS.
- Hébergement statique sur **GitHub Pages**.

---

[1.3.0]: https://github.com/fdaubercy/suivi-e85/compare/v1.2.0...v1.3.0
[1.2.0]: https://github.com/fdaubercy/suivi-e85/compare/v1.1.0...v1.2.0
[1.1.0]: https://github.com/fdaubercy/suivi-e85/compare/v1.0.0...v1.1.0
[1.0.0]: https://github.com/fdaubercy/suivi-e85/releases/tag/v1.0.0
