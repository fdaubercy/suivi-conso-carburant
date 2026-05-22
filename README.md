# ⛽ Suivi Conso E85 — Formulaire de saisie

Formulaire mobile pour saisir les pleins de carburant (SuperEthanol E85 / Super 98) et les enregistrer automatiquement dans Google Sheets.

## 🌐 Accès

**https://fdaubercy.github.io/suivi-e85/**

Ajouter à l'écran d'accueil iPhone : Safari → Partager → "Sur l'écran d'accueil"

## ✨ Fonctionnalités

- Saisie rapide : date, km compteur, litres, prix, station
- Calcul automatique du coût du plein en temps réel
- **Géolocalisation** : détecte les stations E85 proches via OpenStreetMap
- Enregistrement direct dans Google Sheets via Google Apps Script
- Interface optimisée iPhone (safe areas, bouton sticky, font-size 16px)

## 🗂️ Structure

```
suivi-e85/
├── index.html      # Formulaire web (frontend)
└── README.md
```

Le backend (réception des données) est hébergé dans Google Apps Script — voir `Code.gs` ci-dessous.

## ⚙️ Configuration

### 1. Google Apps Script (backend)

Créer un projet sur [script.google.com](https://script.google.com) avec ce code :

```javascript
const SPREADSHEET_ID = 'VOTRE_ID_GOOGLE_SHEET';
const SHEET_NAME     = '_ImportGS';

function doGet(e) {
  return HtmlService.createHtmlOutputFromFile('index')
    .setTitle('Suivi E85')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

function doPost(e) {
  const payload = JSON.parse(e.postData.contents);
  const ss    = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet = ss.getSheetByName(SHEET_NAME);
  sheet.appendRow([
    new Date(),
    new Date(payload.date),
    payload.type,
    Number(payload.km),
    Number(payload.litres),
    Number(payload.prix),
    payload.prixS98 ? Number(payload.prixS98) : '',
    payload.station
  ]);
  return ContentService
    .createTextOutput(JSON.stringify({ success: true }))
    .setMimeType(ContentService.MimeType.JSON);
}
```

Déployer en **Application Web** → accès : Tout le monde.

### 2. Connecter le formulaire au backend

Dans `index.html`, ligne 6, remplacer :
```javascript
const GAS_URL = 'https://script.google.com/macros/s/VOTRE_ID_ICI/exec';
```
par l'URL du déploiement GAS.

### 3. Google Sheet cible

Le script écrit dans l'onglet `_ImportGS` du Google Sheet avec les colonnes :

| Horodatage | Date | Type | Km compteur | Nb. Litres | Prix €/L | Prix S98 jour | Station |
|---|---|---|---|---|---|---|---|

## 🛠️ Modifier le formulaire

1. Éditer `index.html` directement sur GitHub (icône ✏️)
2. GitHub Pages se met à jour en ~30 secondes

## 📦 Technologies

- HTML / CSS / JavaScript vanilla
- [Overpass API](https://overpass-api.de/) (OpenStreetMap) pour la géolocalisation des stations E85
- Google Apps Script pour le backend
- GitHub Pages pour l'hébergement
