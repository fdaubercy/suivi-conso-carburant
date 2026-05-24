# ⛽ Suivi Conso E85 — Formulaire de saisie

Formulaire mobile pour saisir les pleins de carburant (SuperEthanol E85 / Super 98)
et les enregistrer automatiquement dans Google Sheets.

## 🌐 Accès

**https://fdaubercy.github.io/suivi-e85/**

Ajouter à l'écran d'accueil iPhone : Safari → Partager → « Sur l'écran d'accueil »

---

## ✨ Fonctionnalités

### Saisie du plein
- Formulaire rapide : date (pré-remplie à aujourd'hui), km compteur, litres, prix, station
- Toggle **E85 / Super 98** — adapte les libellés, placeholders, badge du bandeau (🌿 / 💧)
- **Calcul en temps réel** du coût du plein (litres × prix)
- Version de l'application affichée dans le bandeau

### Récupération automatique des prix
Dès la sélection d'une station, l'API gouvernementale `data.economie.gouv.fr` est interrogée
pour récupérer simultanément le prix **E85** et le prix **SP98** :
- Prix trouvé → champ pré-rempli en vert pendant 6 secondes
- Prix non trouvé → placeholder `--`, saisie manuelle disponible
- Stratégie progressive : rayon 500 m → 2 km → 5 km → fallback GPS → code postal

### Identification des stations
Les stations sont enrichies via **OpenStreetMap (Overpass API)** pour afficher le nom d'enseigne réel (`brand` / `name` / `operator`) — aussi bien en géolocalisation qu'en recherche manuelle.
Exemple d'affichage :
```
Intermarché                    ← nom enseigne OSM (nom principal)
2 Rue de la Paix · BEUVRY      ← adresse · ville (sous-titre)
3,3 km · E85 0,798 €/L
```
Si OSM ne retourne pas de résultat, l'adresse de l'API gouvernementale est utilisée en fallback.

### Gestion des véhicules
- Liste stockée **100 % en localStorage** (aucune donnée envoyée côté serveur)
- **Import initial** au premier lancement depuis l'onglet `vehicules` du Google Sheet (si localStorage vide)
- **Ajout / suppression** directement depuis le sélecteur (local uniquement)
- **Dernier véhicule utilisé** auto-sélectionné au démarrage

### Carte interactive (moteur maison, sans librairie externe)
- Tuiles **OpenStreetMap** rendues en JS pur (zéro dépendance externe)
- Marqueurs ⛽ cliquables pour chaque station trouvée
- Cliquer sur un marqueur sélectionne la station et met en surbrillance sa ligne dans la liste
- Marqueur vert pour la position de l'utilisateur
- Synchronisation bidirectionnelle liste ↔ carte

### Géolocalisation
- Bouton 📍 : détecte les stations E85 dans un rayon de **8 km**
- Liste des 7 stations les plus proches, triées par distance
- Badge « connue » pour les stations déjà présentes dans le dropdown
- Tap sur une station (liste ou carte) → sélection + récupération des prix

### Recherche manuelle avec suggestions
- Dès 3 caractères saisis, recherche avec debounce 500 ms dans l'API gouvernementale
- Affichage simultané : liste de suggestions + marqueurs sur la carte
- Sélection possible depuis la liste **ou depuis la carte**
- Sélection d'une suggestion → nom canonique, mise à jour dropdown, récupération des prix

### Gestion des stations
- **Chargement dynamique** depuis l'onglet `Stations` du Google Sheet au démarrage
- **Synchronisation automatique** après chaque plein validé (nouvelles stations)
- Fallback sur liste statique si l'onglet `Stations` est inaccessible

### Enregistrement
- Envoi vers Google Sheets via Google Apps Script
- Validation des champs obligatoires avant envoi
- Confirmation si le prix SP98 n'a pas été saisi en mode E85
- Feedback visuel succès / erreur ; remise à zéro automatique du formulaire

---

## 🗂️ Structure

```
suivi-e85/
├── index.html           # Structure HTML
├── style.css            # Feuille de styles
├── app.js               # Logique JavaScript (APP_VERSION à mettre à jour)
├── README.md
├── CHANGELOG.md
└── .claude/
    ├── settings.json    # Hook Stop : rappel README/CHANGELOG
    └── commands/
        └── majFilesMe.md  # Commande /majFilesMe
```

---

## ⚙️ Configuration

### 1. Google Apps Script (backend)

```javascript
const SPREADSHEET_ID = 'VOTRE_ID_GOOGLE_SHEET';
const SHEET_NAME     = '_ImportGS';
const STATIONS_SHEET = 'Stations';

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
    new Date(), new Date(payload.date), payload.type,
    Number(payload.km), Number(payload.litres), Number(payload.prix),
    payload.prixS98 ? Number(payload.prixS98) : '', payload.station
  ]);
  return ContentService
    .createTextOutput(JSON.stringify({ success: true }))
    .setMimeType(ContentService.MimeType.JSON);
}
```

### 2. Connecter le formulaire

Dans `app.js`, constantes en tête de fichier :

```javascript
const APP_VERSION = '1.9.8.0';   // ← mettre à jour à chaque déploiement
const GAS_URL     = 'https://script.google.com/macros/s/VOTRE_ID_GAS/exec';
const GS_SHEET_ID = 'VOTRE_ID_GOOGLE_SHEET';
```

### 3. Google Sheet cible

**Onglet `_ImportGS`** :

| Horodatage | Date | Type | Km compteur | Nb. Litres | Prix €/L | Prix S98 jour | Station | Véhicule |
|---|---|---|---|---|---|---|---|---|

**Onglet `Stations`** :

| Station |
|---|
| Carrefour Flers |
| Intermarché |
| … |

**Onglet `vehicules`** :

| Vehicule |
|---|
| Citroën C5 X |
| … |

---

## 🗺️ Carte interactive

Moteur de rendu sans librairie externe :
- Tuiles OpenStreetMap chargées dynamiquement selon le bounding box
- Marqueurs positionnés via la projection Mercator (formule standard)
- Zoom optimal calculé automatiquement pour englober toutes les stations
- Attribution © OSM affichée conformément à la licence ODbL

---

## 🏷️ Identification des stations — Architecture

```
API gouvernementale (data.economie.gouv.fr)
        ↓  adresse, ville, cp, e85_prix, sp98_prix, geom, services
        ↓
enrichWithOsmSerial(stations, setStatus)
        ↓  requête Overpass around:2000m [amenity=fuel]
        ↓  priorité : brand > name > operator
        ↓
  → nom enseigne OSM    (ex. "Intermarché")
  → fallback : stationLabel(r) = adresse capitalisée

stationSubLabel(r)
  → adresse · cp · VILLE  (ex. "2 Rue de la Paix · 62660 · BEUVRY")
```

> L'enrichissement OSM s'applique désormais à la **géolocalisation ET à la recherche manuelle**.
> Fallback sur l'adresse gouvernementale si Overpass ne retourne aucun résultat.

---

## 📦 Technologies

- HTML / CSS / JavaScript vanilla
- [API Prix des Carburants v2](https://data.economie.gouv.fr/explore/dataset/prix-des-carburants-en-france-flux-instantane-v2/) — stations et prix (géoloc + recherche)
- [OpenStreetMap](https://www.openstreetmap.org/) — tuiles cartographiques
- Google Apps Script — backend (enregistrement pleins + gestion des stations)
- Google Sheets — stockage des données et liste des stations
- GitHub Pages — hébergement
