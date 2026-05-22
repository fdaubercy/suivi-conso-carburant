# ⛽ Suivi Conso E85 — Formulaire de saisie

Formulaire mobile pour saisir les pleins de carburant (SuperEthanol E85 / Super 98) et les enregistrer automatiquement dans Google Sheets.

## 🌐 Accès

**https://fdaubercy.github.io/suivi-e85/**

Ajouter à l'écran d'accueil iPhone : Safari → Partager → "Sur l'écran d'accueil"

## ✨ Fonctionnalités

- Saisie rapide : date, km compteur, litres, prix, station
- **Récupération automatique des prix** E85 et SP98 dès la sélection d'une station, via l'API gouvernementale `data.economie.gouv.fr`
  - Prix trouvé → champ pré-rempli en vert, avec nom et adresse de la station source
  - Prix non trouvé → champ affiche `--` en grisé, saisie manuelle possible
- **Géolocalisation** : détecte les stations E85 proches via OpenStreetMap (rayon 8 km)
- **Suggestions de station** : en saisie manuelle, propose une liste de stations correspondantes après 3 caractères ; la sélection met à jour le dropdown et récupère les prix automatiquement
- Calcul automatique du coût du plein en temps réel
- Enregistrement direct dans Google Sheets via Google Apps Script
- Interface optimisée iPhone (safe areas, bouton sticky, font-size 16px)

## 🗂️ Structure

```
suivi-e85/
├── index.html      # Formulaire web (frontend)
├── README.md
└── CHANGELOG.md
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

Dans `index.html`, remplacer :
```javascript
const GAS_URL = 'https://script.google.com/macros/s/VOTRE_ID_ICI/exec';
```
par l'URL du déploiement GAS.

### 3. Google Sheet cible

Le script écrit dans l'onglet `_ImportGS` du Google Sheet avec les colonnes :

| Horodatage | Date | Type | Km compteur | Nb. Litres | Prix €/L | Prix S98 jour | Station |
|---|---|---|---|---|---|---|---|

## 🔍 Récupération automatique des prix

Dès qu'une station est sélectionnée (liste géo, dropdown, ou saisie manuelle), le formulaire interroge l'API officielle des prix carburants :

```
https://data.economie.gouv.fr/api/explore/v2.1/catalog/datasets/
prix-des-carburants-en-france-flux-instantane-v2/records
```

**Stratégie de recherche par priorité :**

1. **Coordonnées OSM** (station choisie via géoloc ou suggestion) — rayon progressif 500 m → 2 km → 5 km
2. **GPS utilisateur** (fallback si coords ne donnent rien)
3. **Code postal** (saisi manuellement en dernier recours)

**Comportement des champs prix :**
- Prix trouvé → valeur pré-remplie, fond vert clair pendant 6 secondes
- Prix non trouvé → placeholder `--` en grisé, saisie manuelle disponible

La saisie manuelle désactive immédiatement le style auto-rempli.

## 🏪 Suggestions de station (saisie manuelle)

Quand l'utilisateur choisit "+ Autre" et commence à taper (≥ 3 caractères) :

1. Une recherche est lancée après 500 ms (debounce) dans l'API gouvernementale par adresse et ville
2. Une liste de suggestions s'affiche sous le champ avec adresse complète et prix E85 si disponible
3. La sélection d'une suggestion :
   - Met à jour le champ avec le nom canonique de la station
   - **Remplace dans le dropdown** toutes les options portant l'ancienne saisie par le nouveau nom
   - Déclenche la récupération des prix via les coordonnées exactes de la station

## 🛠️ Modifier le formulaire

1. Éditer `index.html` directement sur GitHub (icône ✏️)
2. GitHub Pages se met à jour en ~30 secondes

## 📦 Technologies

- HTML / CSS / JavaScript vanilla
- [Overpass API](https://overpass-api.de/) (OpenStreetMap) pour la géolocalisation des stations E85
- [API Prix des Carburants](https://data.economie.gouv.fr/explore/dataset/prix-des-carburants-en-france-flux-instantane-v2/) (data.economie.gouv.fr) pour les prix temps réel et les suggestions de station
- Google Apps Script pour le backend
- GitHub Pages pour l'hébergement
