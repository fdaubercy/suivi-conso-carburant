# Mise à jour Google Apps Script — v2.1.2.0

## Ajout de la colonne Véhicule dans `_ImportGS`

### 1. Ajouter la colonne dans Google Sheets
Dans l'onglet `_ImportGS`, ajouter un en-tête en colonne I :
```
Véhicule
```

### 2. Mettre à jour la fonction `doPost` dans le GAS

Remplacer l'instruction `sheet.appendRow(...)` dans le `doPost` par :

```javascript
function doPost(e) {
  const payload = JSON.parse(e.postData.contents);
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);

  if (payload.action === 'addStation') {
    const sheet = ss.getSheetByName(STATIONS_SHEET);
    sheet.appendRow([payload.station]);
    return ContentService
      .createTextOutput(JSON.stringify({ success: true }))
      .setMimeType(ContentService.MimeType.JSON);
  }

  const sheet = ss.getSheetByName(SHEET_NAME);
  sheet.appendRow([
    new Date(),
    new Date(payload.date),
    payload.type,
    Number(payload.km),
    Number(payload.litres),
    Number(payload.prix),
    payload.prixS98 ? Number(payload.prixS98) : '',
    payload.station,
    payload.vehicule || ''        // ← NOUVEAU : colonne Véhicule (colonne I)
  ]);

  return ContentService
    .createTextOutput(JSON.stringify({ success: true }))
    .setMimeType(ContentService.MimeType.JSON);
}
```

### 3. Redéployer le GAS
Après modification : Déployer → Gérer les déploiements → Nouvelle version → Déployer.

---

## [2.1.2.0] — 2026-05-24

### Changed
- **Recherche manuelle — logique centrée sur la ville** : refonte en deux étapes.
  - Étape 1 : `search(ville, 'q') limit:1` → obtenir les coordonnées de la commune dont le nom ressemble à la saisie.
  - Étape 2 : `distance(geom, city_point, radiusM)` → chercher toutes les stations E85 dans le rayon AUTOUR DE CES COORDONNÉES (et non plus autour de l'utilisateur). Ainsi "raches 20km" retourne les stations dans un cercle de 20km centré sur Râches, quelle que soit la position de l'utilisateur.
  - Dernier bouton renommé "Ville seule" (remplace "France") : `searchRadiusM = null` → retourne uniquement les stations dans la commune exacte, sans extension géographique.
  - Fallback `searchStationsCityOnly` : si aucune station dans le rayon choisi, affiche les stations de la ville exacte.
  - Statut informatif à chaque étape : "Localisation de la commune…" → "Stations dans X km autour de Y…" → résultat.
- **Rayon par défaut : 20 km** (était 50 km).
- **`index.html`** : libellé du sélecteur de rayon mis à jour ("Rayon autour de la ville :") ; bouton "France" renommé "Ville seule".

### Fixed
- **Véhicule dans Google Sheets** : le champ `vehicule` est maintenant inclus dans le payload `submitForm`. Le GAS doit être mis à jour (voir fichier `GAS_UPDATE.md`) pour persister cette valeur en colonne I de `_ImportGS`.
