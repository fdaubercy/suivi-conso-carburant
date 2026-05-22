# Changelog

Toutes les modifications notables de ce projet sont documentées ici.

Format : [Keep a Changelog](https://keepachangelog.com/fr/1.0.0/)

---

## [1.2.0] — 2026-05-22

### Ajouté
- **Récupération automatique du prix SP98** dès qu'une station est sélectionnée,
  via l'API gouvernementale `data.economie.gouv.fr` (données temps réel).
- Deux stratégies de recherche selon la source de sélection :
  - station choisie depuis la liste géo → recherche par **coordonnées** (rayon 600 m, plus précise)
  - station choisie dans le dropdown fixe → recherche par **nom de marque**
- Indicateur de statut sous le champ SP98 : spinner pendant la recherche,
  confirmation avec nom et ville de la station si trouvé, message d'info sinon.
- Mise en forme visuelle du champ SP98 auto-rempli (fond vert clair, bordure verte),
  disparaissant après 6 secondes.
- Détection de la saisie manuelle : la mise en forme automatique est immédiatement
  retirée si l'utilisateur modifie le prix à la main.

### Modifié
- `pickStation(name)` → `pickStation(name, lat, lon)` : les coordonnées OSM sont
  maintenant transmises depuis `renderNearby` pour affiner la recherche de prix.
- Les objets station dans `searchNearby` incluent désormais `lat` et `lon`.
- `resetForm()` remet à zéro le champ SP98, son statut et sa mise en forme.

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

[1.2.0]: https://github.com/fdaubercy/suivi-e85/compare/v1.1.0...v1.2.0
[1.1.0]: https://github.com/fdaubercy/suivi-e85/compare/v1.0.0...v1.1.0
[1.0.0]: https://github.com/fdaubercy/suivi-e85/releases/tag/v1.0.0
