# ⛽ Suivi Conso E85 — Formulaire de saisie

Formulaire mobile pour saisir les pleins de carburant (SuperEthanol E85 / Super 98)
et les enregistrer automatiquement dans Google Sheets.

> 📋 Voir [`ROADMAP.md`](ROADMAP.md) pour les améliorations envisagées (web, Excel, sync).

## 🌐 Accès

| Ressource | Lien |
|---|---|
| 📱 Application | **https://fdaubercy.github.io/suivi-e85/** |
| 📊 Google Sheet | https://docs.google.com/spreadsheets/d/1uN170kt_n45sBRwqs2krTYfhapU3dMKjTguD-qSUqCE/edit |
| ⚙️ Google Apps Script | Google Sheet → Extensions → Apps Script |

Ajouter à l'écran d'accueil iPhone : Safari → Partager → « Sur l'écran d'accueil »

---

## ✨ Fonctionnalités

### Saisie du plein
- Formulaire rapide : date (pré-remplie à aujourd'hui), km compteur, litres, prix, station
- **Toggle multi-carburant** dynamique :
  - Ligne primaire : 🌿 E85 / 💧 SP98 (toujours visibles)
  - Ligne secondaire : 🔵 SP95, 🟢 E10, ⚫ Gazole, 🟡 GPLc — apparaît avec les prix dès qu'une station est sélectionnée
  - Mini-badges dans le bandeau : carburants disponibles ≠ type courant, cliquables pour changer de type
- **Calcul en temps réel** du coût du plein (litres × prix)
- Version de l'application affichée dans le bandeau

### Récupération automatique des prix — tous carburants
Dès la sélection d'une station, l'API gouvernementale `data.economie.gouv.fr` est interrogée
pour récupérer **tous les prix disponibles** (E85, SP98, SP95, E10, Gazole, GPLc) en une seule requête :
- Prix trouvé → champ pré-rempli en vert pendant 6 secondes
- Prix non trouvé → placeholder `--`, saisie manuelle disponible
- Stratégie progressive : rayon 500 m → 2 km → 5 km → fallback GPS → code postal
- Les prix chargés sont mis en cache (`_stationPrices`) — aucun appel supplémentaire lors du changement de type

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
- Feedback visuel succès / erreur ; remise à zéro automatique du formulaire

---

## 🗂️ Structure

```
suivi-e85/
├── index.html                       # Structure HTML
├── style.css                        # Feuille de styles
├── Suivi conso E85.xlsm             # Classeur Excel (Power Query + tableau GS_Pleins + VBA sync)
│
├── js/                              # ── Web app (ES Modules) ────────────
│   ├── main.js                      # Point d'entrée
│   ├── config.js                    # APP_VERSION, FUEL_CONFIG, GAS_URL, GS_SHEET_ID
│   ├── state.js                     # État partagé (currentType, _stationPrices…)
│   ├── utils.js                     # Fonctions pures (haversine, odsUrl…)
│   ├── ui.js                        # Helpers DOM
│   ├── vehicules.js                 # Gestion véhicules (localStorage)
│   ├── osm.js                       # Enrichissement Overpass (nom enseigne)
│   ├── carte.js                     # Rendu carte tuiles OSM
│   ├── carburant.js                 # Toggle type de carburant + badges header
│   ├── prix.js                      # API prix carburants
│   ├── geo.js                       # Géolocalisation + liste stations proches
│   ├── recherche.js                 # Recherche manuelle par ville
│   ├── formulaire.js                # Soumission et réinitialisation
│   ├── stations.js                  # Chargement liste stations Google Sheets
│   ├── theme.js                     # Dark mode (toggle + persist localStorage)
│   └── historique.js                # 5 derniers pleins (via GET ?action=export)
│
├── vba/                             # ── Sync Excel ↔ Google Sheets ──────
│   ├── modSyncGS.bas                # Module VBA bidirectionnel (sync_id + WinHttp)
│   ├── modDashboard.bas             # Tableau de bord : 10 KPIs auto
│   └── ThisWorkbook_snippet.bas     # Snippet Workbook_Open à coller
│
├── Google Drive/                    # ── Sauvegardes et exports externes ─
│   ├── Réponses - Suivi E85.xlsx
│   └── Sauvegarde & Geolocalisation - Suivi conso SuperEthanol/
│       └── Google Apps Script/
│           ├── Code.gs              # Backend GAS (15 col + sync_id + export/bulkAdd)
│           ├── index.html           # Page HTML servie par GAS (standalone)
│           └── GAS_UPDATE.md
│
├── README.md
├── CHANGELOG.md
├── ROADMAP.md                       # Propositions d'amelioration (web/Excel/sync)
└── .claude/
    ├── settings.json
    └── commands/
        ├── commitMe.md
        └── majFilesMe.md
```

---

## ⚙️ Configuration

> 📊 **Google Sheet** : https://docs.google.com/spreadsheets/d/1uN170kt_n45sBRwqs2krTYfhapU3dMKjTguD-qSUqCE/edit
> ⚙️ **Google Apps Script** : Google Sheet → Extensions → Apps Script *(le fichier source est dans `Google Drive/Sauvegarde & Geolocalisation - Suivi conso SuperEthanol/Google Apps Script/Code.gs`)*

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
    payload.station, payload.vehicule || ''
  ]);
  return ContentService
    .createTextOutput(JSON.stringify({ success: true }))
    .setMimeType(ContentService.MimeType.JSON);
}
```

### 2. Connecter le formulaire

Dans `js/config.js` :

```javascript
export const APP_VERSION = '2.3.0.0';   // ← mettre à jour à chaque déploiement
export const GAS_URL     = 'https://script.google.com/macros/s/VOTRE_ID_GAS/exec';
export const GS_SHEET_ID = 'VOTRE_ID_GOOGLE_SHEET';
```

### 3. Google Sheet cible

**Onglet `_ImportGS`** (15 colonnes A→O) — schéma v2.3.0.0 :

| A Horodatage | B Date | C Type | D Km | E Litres | F Prix €/L | G Station | H Véhicule | I E85 st. | J SP98 st. | K SP95 st. | L E10 st. | M Gazole st. | N GPLc st. | O sync_id |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|

> Les colonnes I→N sont remplies automatiquement par l'app via l'API prix carburants lors de la sélection d'une station. Elles restent vides si la station est saisie manuellement.
>
> La colonne **O `sync_id`** est un UUID utilisé pour la déduplication lors de la synchronisation bidirectionnelle Excel ↔ Google Sheets.
>
> ⚠️ Si vous utilisez **Power Query** dans Excel pour importer `_ImportGS`, pensez à actualiser la requête après chaque changement de schéma.

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

## 🔄 Synchronisation bidirectionnelle Excel ↔ Google Sheets

Depuis v2.2.4.x, le classeur `Suivi conso E85.xlsm` peut **synchroniser automatiquement** son onglet `GS_Pleins` avec l'onglet `_ImportGS` du Google Sheet — utile quand un plein est saisi soit via l'app web, soit via le formulaire Excel local.

### Principe
Chaque enregistrement est identifié par un **UUID** (colonne `sync_id`). À l'ouverture du classeur (ou via bouton manuel), la macro VBA :
1. Récupère tous les enregistrements GS via `GET ?action=export`
2. Compare les `sync_id` des deux côtés
3. Insère dans Excel les lignes présentes seulement dans GS
4. Envoie vers GS (`POST action=bulkAdd`) les lignes présentes seulement dans Excel

### Installation
```
Alt+F11 → Fichier → Importer → vba/modSyncGS.bas
Dans "ThisWorkbook" : coller vba/ThisWorkbook_snippet.bas
GAS Editor → exécuter migrateSyncId() une seule fois
```

### Fonctions VBA exposées
| Fonction | Usage |
|---|---|
| `SyncOnOpen` | Sync silencieuse à l'ouverture (appelée par `Workbook_Open`) |
| `SyncManuel` | Sync manuelle avec compte-rendu (bouton ou F5) |
| `SyncDiagnose` | Affiche compteurs GS/Excel/intersections pour debug |
| `TestConnexion` | Vérifie l'accès au GAS (code HTTP + extrait JSON) |

### Architecture technique
- **HTTP** : `WinHttp.WinHttpRequest.5.1` (natif Windows, gère les redirections HTTPS Google), fallback `MSXML2.XMLHTTP60`
- **JSON parser** : minimaliste maison (Split sur `},{` — suffisant pour le JSON plat exporté)
- **Format dates** : `dd/mm/yyyy hh:mm:ss` appliqué automatiquement sur colonnes Horodatage et Date
- **Heure locale** : GAS exporte via `Utilities.formatDate(v, tz, "yyyy-MM-dd HH:mm:ss")` (timezone du Sheet, pas UTC)

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

- HTML / CSS / JavaScript vanilla (ES Modules)
- [API Prix des Carburants v2](https://data.economie.gouv.fr/explore/dataset/prix-des-carburants-en-france-flux-instantane-v2/) — stations et prix (géoloc + recherche)
- [OpenStreetMap](https://www.openstreetmap.org/) — tuiles cartographiques + Overpass (enseignes)
- Google Apps Script — backend (enregistrement pleins, gestion des stations, export JSON, bulkAdd)
- Google Sheets — stockage des données + onglets `Stations` / `vehicules`
- GitHub Pages — hébergement de l'app mobile
- Excel + VBA — formulaire local + module de synchronisation bidirectionnelle (`WinHttp`, `Scripting.Dictionary`)
