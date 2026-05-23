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
- Toggle **E85 / Super 98** — adapte les libellés, les placeholders et la recherche de prix
- **Calcul en temps réel** du coût du plein (litres × prix)

### Récupération automatique des prix
Dès la sélection d'une station, l'API gouvernementale `data.economie.gouv.fr` est interrogée
pour récupérer simultanément le prix **E85** et le prix **SP98** :
- Prix trouvé → champ pré-rempli en vert pendant 6 secondes
- Prix non trouvé → placeholder `--` en grisé, saisie manuelle disponible
- Stratégie progressive : rayon 500 m → 2 km → 5 km → fallback GPS → code postal

### Géolocalisation (Overpass / OpenStreetMap)
- Bouton 📍 : détecte les stations E85 dans un rayon de 8 km
- Liste des 7 stations les plus proches, triées par distance
- Badge « connue » pour les stations déjà présentes dans le dropdown
- Tap sur une station → sélection + récupération des prix via ses coordonnées exactes

### Suggestions en saisie manuelle
- Dès 3 caractères tapés dans le champ « Autre station »,
  une recherche avec debounce 500 ms est lancée dans l'API gouvernementale
- Liste de suggestions : adresse, CP, ville, prix E85 si disponible
- Sélection d'une suggestion :
  - Remplace la saisie par le nom canonique de la station
  - Met à jour le dropdown et l'ajoute dans « Stations habituelles » si absente
  - Déclenche la récupération des prix via les coordonnées exactes de la station

### Gestion des stations
- **Chargement dynamique** depuis l'onglet `Stations` du Google Sheet au démarrage
- **Synchronisation automatique** : après chaque plein validé, si la station est nouvelle,
  elle est ajoutée dans Google Sheets et dans le dropdown pour la session en cours
- Fallback sur une liste statique si l'onglet `Stations` est inaccessible

### Enregistrement
- Envoi vers Google Sheets via Google Apps Script
- Validation des champs obligatoires avant envoi (date, km, litres, prix, station)
- Confirmation si le prix SP98 n'a pas été saisi en mode E85
- Feedback visuel succès / erreur ; remise à zéro automatique du formulaire après succès

---

## 🗂️ Structure

```
suivi-e85/
├── index.html      # Structure HTML
├── style.css       # Feuille de styles
├── app.js          # Logique JavaScript
├── README.md
└── CHANGELOG.md
```

---

## ⚙️ Configuration

### 1. Google Apps Script (backend)

Créer un projet sur [script.google.com](https://script.google.com) :

```javascript
const SPREADSHEET_ID = 'VOTRE_ID_GOOGLE_SHEET';
const SHEET_NAME     = '_ImportGS';
const STATIONS_SHEET = 'Stations';

function doPost(e) {
  const payload = JSON.parse(e.postData.contents);
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);

  // Ajout d'une nouvelle station
  if (payload.action === 'addStation') {
    const sheet = ss.getSheetByName(STATIONS_SHEET);
    sheet.appendRow([payload.station]);
    return ContentService
      .createTextOutput(JSON.stringify({ success: true }))
      .setMimeType(ContentService.MimeType.JSON);
  }

  // Enregistrement d'un plein
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

Déployer en **Application Web** → accès : Tout le monde.

### 2. Connecter le formulaire

Dans `app.js`, remplacer les deux constantes en tête de fichier :

```javascript
const GAS_URL     = 'https://script.google.com/macros/s/VOTRE_ID_GAS/exec';
const GS_SHEET_ID = 'VOTRE_ID_GOOGLE_SHEET';
```

### 3. Google Sheet cible

**Onglet `_ImportGS`** — données de saisie :

| Horodatage | Date | Type | Km compteur | Nb. Litres | Prix €/L | Prix S98 jour | Station |
|---|---|---|---|---|---|---|---|

**Onglet `Stations`** — liste des stations habituelles :

| Station |
|---|
| Carrefour Flers |
| Intermarché |
| … |

---

## 🔍 Récupération automatique des prix

| Étape | Méthode |
|---|---|
| 1 | Coordonnées de la station (OSM ou suggestion API) — rayon 500 m → 2 km → 5 km |
| 2 | Fallback GPS utilisateur (si position connue et distance > 100 m) |
| 3 | Code postal saisi manuellement en dernier recours |

---

## 🏪 Suggestions de station (saisie manuelle)

1. Saisie ≥ 3 caractères dans « Autre station »
2. Debounce 500 ms → recherche dans l'API par adresse et ville
3. Liste avec adresse complète, CP, ville et prix E85
4. Sélection → nom canonique, mise à jour du dropdown, récupération des prix

---

## 📦 Technologies

- HTML / CSS / JavaScript vanilla
- [Overpass API](https://overpass-api.de/) — géolocalisation des stations E85
- [API Prix des Carburants v2](https://data.economie.gouv.fr/explore/dataset/prix-des-carburants-en-france-flux-instantane-v2/) — prix temps réel E85 et SP98
- Google Apps Script — backend (enregistrement pleins + gestion des stations)
- Google Sheets — stockage des données (`_ImportGS`) et liste des stations (`Stations`)
- GitHub Pages — hébergement
