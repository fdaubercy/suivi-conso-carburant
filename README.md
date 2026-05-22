# ⛽ Suivi Conso E85 — Formulaire de saisie

Formulaire mobile pour saisir les pleins de carburant (SuperEthanol E85 / Super 98)
et les enregistrer automatiquement dans Google Sheets.

## 🌐 Accès

**https://fdaubercy.github.io/suivi-e85/**

Ajouter à l'écran d'accueil iPhone : Safari → Partager → "Sur l'écran d'accueil"

## ✨ Fonctionnalités

- Saisie rapide : date, km compteur, litres, prix, station
- **Récupération automatique des prix** E85 et SP98 dès la sélection d'une station
  (API gouvernementale `data.economie.gouv.fr`)
  - Prix trouvé → champ pré-rempli en vert pendant 6 secondes
  - Prix non trouvé → placeholder `--` en grisé, saisie manuelle disponible
- **Géolocalisation** : détecte les stations E85 proches via OpenStreetMap (rayon 8 km)
- **Suggestions de station** : en saisie manuelle (≥ 3 caractères), propose des
  stations correspondantes ; la sélection met à jour le dropdown et récupère les prix
- Calcul automatique du coût du plein en temps réel
- Enregistrement direct dans Google Sheets via Google Apps Script
- Interface optimisée iPhone (safe areas, bouton sticky, font-size 16px)

## 🗂️ Structure

```
suivi-e85/
├── index.html      # Structure HTML
├── style.css       # Feuille de styles
├── app.js          # Logique JavaScript
├── README.md
└── CHANGELOG.md
```

## ⚙️ Configuration

### 1. Google Apps Script (backend)

Créer un projet sur [script.google.com](https://script.google.com) :

```javascript
const SPREADSHEET_ID = 'VOTRE_ID_GOOGLE_SHEET';
const SHEET_NAME     = '_ImportGS';

function doPost(e) {
  const payload = JSON.parse(e.postData.contents);
  const sheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(SHEET_NAME);
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

Déployer en **Application Web** → accès : Tout le monde.

### 2. Connecter le formulaire

Dans `app.js`, ligne 1, remplacer :
```javascript
const GAS_URL = 'https://script.google.com/macros/s/VOTRE_ID_ICI/exec';
```

### 3. Google Sheet cible — onglet `_ImportGS`

| Horodatage | Date | Type | Km compteur | Nb. Litres | Prix €/L | Prix S98 jour | Station |
|---|---|---|---|---|---|---|---|

## 🔍 Récupération automatique des prix

Stratégie de recherche :

1. **Coordonnées OSM** (station via géoloc ou suggestion) — rayon 500 m → 2 km → 5 km
2. **GPS utilisateur** (fallback)
3. **Code postal** (saisie manuelle en dernier recours)

## 🏪 Suggestions de station (saisie manuelle)

Dès 3 caractères tapés dans « Autre station » :
1. Recherche debounce 500 ms dans l'API par adresse/ville
2. Liste de suggestions avec adresse, CP, ville et prix E85
3. Sélection → nom canonique, mise à jour du dropdown, récupération des prix

## 📦 Technologies

- HTML / CSS / JavaScript vanilla
- [Overpass API](https://overpass-api.de/) — géolocalisation des stations E85
- [API Prix des Carburants](https://data.economie.gouv.fr/explore/dataset/prix-des-carburants-en-france-flux-instantane-v2/) — prix temps réel
- Google Apps Script — backend
- GitHub Pages — hébergement
