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
- **Détection de doublons** : warning inline si date + km + litres correspondent à un plein existant
- Version de l'application affichée dans le bandeau

### 🧾 Scan ticket de caisse (W17)
Bouton **"🧾 Scanner le ticket"** dans le formulaire : sélection d'une photo (galerie ou caméra) → compression automatique (canvas, max 1 200 px, JPEG ≤ 800 Ko) → envoi GAS → **API Gemini Vision** → extraction des données du ticket → pré-remplissage automatique de tous les champs.

Champs détectés : **date, km compteur, litres, prix/L, montant total, type de carburant, nom de la station**.

**Configuration requise :** ajouter la clé API Gemini dans Google Apps Script :

<details>
<summary>📋 Tuto : obtenir et configurer la clé API Gemini (gratuite)</summary>

**1. Créer la clé sur Google AI Studio**

1. Aller sur [aistudio.google.com/app/apikey](https://aistudio.google.com/app/apikey) (compte Google requis)
2. Accepter les conditions d'utilisation si c'est la première visite
3. Cliquer sur **"Créer une clé API"**
4. Donner un nom (ex. `suivi-e85-scan-ticket`) → **"Créer une clé"**
5. Copier la clé générée (format `AIzaSy...`)

> La clé est **gratuite** pour un usage personnel (quota : 15 req/min, 1 500 req/jour sur `gemini-1.5-flash`).

**2. Ajouter la clé dans Google Apps Script**

1. Ouvrir le Google Sheet → **Extensions → Apps Script**
2. Dans l'éditeur GAS, cliquer sur l'icône ⚙️ **Paramètres du projet** (barre gauche)
3. Faire défiler jusqu'à la section **"Propriétés de script"**
4. Cliquer sur **"Ajouter une propriété de script"**
5. Remplir :
   - **Propriété** : `GEMINI_API_KEY`
   - **Valeur** : coller la clé copiée à l'étape 1
6. Cliquer sur **"Enregistrer les propriétés de script"**

**3. Redéployer le GAS**

Après l'ajout de la clé, redéployer le web app pour qu'elle soit prise en compte :
1. Cliquer sur **"Déployer"** → **"Gérer les déploiements"**
2. Cliquer sur le crayon ✏️ → **"Nouvelle version"** → **"Déployer"**

</details>

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

### 🔁 CI — GitHub Actions (W13)
Deux jobs automatiques sur chaque `push` / `pull_request` :
- **ESLint** : lint de tous les fichiers `js/` (règles `no-var`, `no-unused-vars`, `no-undef`…)
- **Version check** : compare `APP_VERSION` dans `config.js` au dernier tag Git — avertissement si divergence

---

## 🗂️ Structure

```
suivi-e85/
├── index.html                       # Structure HTML
│
├── css/
│   └── style.css                    # Feuille de styles
│
├── excel/
│   └── Suivi conso E85.xlsm        # Classeur Excel (Power Query + GS_Pleins + VBA sync v2.9)
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
│   ├── prix.js                      # API prix carburants + badge rentabilité E85
│   ├── rentabilite.js               # Badge rentabilité E85 vs SP98 (W5)
│   ├── geo.js                       # Géolocalisation + liste stations proches
│   ├── recherche.js                 # Recherche manuelle par ville
│   ├── formulaire.js                # Soumission, réinitialisation, détection doublons
│   ├── stations.js                  # Chargement liste stations Google Sheets
│   ├── theme.js                     # Dark mode (toggle + persist localStorage)
│   ├── historique.js                # 5 derniers pleins (via GET ?action=export)
│   ├── stats.js                     # Stats live 4 KPIs filtrés par véhicule (W7)
│   ├── stationsmap.js               # Carte statique stations habituelles + prix moyens
│   ├── pwa.js                       # Installation PWA Android/iOS (W4)
│   └── ticket.js                    # Scan ticket de caisse → auto-fill (W17)
│
├── vba/                             # ── Sync Excel ↔ Google Sheets ──────
│   ├── modSyncGS.bas                # Module sync bidir. (sync_id, bulkAdd/Update, WinHttp)
│   ├── GS_Pleins_snippet.bas        # Module feuille GS_Pleins (F1-F4 : auto sync_id,
│   │                                #   dirty flag, validation km, doublons)
│   ├── modDashboard.bas             # Tableau de bord : 10 KPIs + graphiques X7/X8
│   └── ThisWorkbook_snippet.bas     # Snippet Workbook_Open à coller
│
├── .github/
│   └── workflows/
│       ├── ci.yml                   # W13 : ESLint + vérification APP_VERSION
│       └── deploy.yml               # W12 : build Vite → GitHub Pages
│
├── package.json                     # Config npm (Vite + ESLint + Vitest)
├── vite.config.js                   # Config Vite + Vitest
├── eslint.config.js                 # Flat config ESLint 9
│
├── Google Drive/                    # ── Sauvegardes et exports externes ─
│   ├── Réponses - Suivi E85.xlsx
│   └── Sauvegarde & Geolocalisation - Suivi conso SuperEthanol/
│       └── Google Apps Script/
│           ├── Code.gs              # Backend GAS v2.9.0.0 (15 col + sync bidir.)
│           ├── index.html           # Page HTML servie par GAS (standalone)
│           └── GAS_UPDATE.md        # Doc : actions doPost, schéma, migrations
│
├── README.md
├── CHANGELOG.md
├── ROADMAP.md                       # Propositions d'amélioration (web/Excel/sync)
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

Le code complet et à jour se trouve dans [`Google Drive/.../Code.gs`](Google%20Drive/Sauvegarde%20%26%20Geolocalisation%20-%20Suivi%20conso%20SuperEthanol/Google%20Apps%20Script/Code.gs).
Voir [`GAS_UPDATE.md`](Google%20Drive/Sauvegarde%20%26%20Geolocalisation%20-%20Suivi%20conso%20SuperEthanol/Google%20Apps%20Script/GAS_UPDATE.md) pour les instructions de déploiement et le détail de toutes les actions.

Actions `doPost` disponibles :

| Action | Émetteur | Rôle |
|---|---|---|
| _(aucune)_ | App web | Enregistrement d'un plein (cols A→O) |
| `addStation` | App web | Ajout d'une station dans l'onglet `Stations` |
| `syncStations` | App web | Remplacement complet de l'onglet `Stations` |
| `addVehicule` | App web | Ajout d'un véhicule dans l'onglet `Vehicules` |
| `removeVehicule` | App web | Suppression d'un véhicule |
| `bulkAdd` | VBA Excel | Import initial Excel → GS (dédupliqué par `sync_id`) |
| `bulkUpdate` | VBA Excel | MAJ bidirectionnelle : lignes modifiées Excel → GS |
| `scanTicket` | App web | Analyse photo ticket via Gemini Vision |

### 2. Connecter le formulaire

Dans `js/config.js` :

```javascript
export const APP_VERSION = '2.9.0.0';
export const GAS_URL     = 'https://script.google.com/macros/s/VOTRE_ID_GAS/exec';
export const GS_SHEET_ID = 'VOTRE_ID_GOOGLE_SHEET';
```

### 3. Google Sheet cible

**Onglet `_ImportGS`** (15 colonnes A→O) :

| A | B | C | D | E | F | G | H | I | J | K | L | M | N | O |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Horodatage | Date | Type | Km | Litres | Prix €/L | Station | Véhicule | E85 st. | SP98 st. | SP95 st. | E10 st. | Gazole st. | GPLc st. | sync_id |

> Les colonnes I→N sont remplies automatiquement par l'app via l'API prix carburants lors de la sélection d'une station.
>
> La colonne **O `sync_id`** est un UUID utilisé pour la déduplication et la synchronisation bidirectionnelle Excel ↔ Google Sheets.

**Onglet `Stations`** · **Onglet `Vehicules`** : une entrée par ligne, colonne A, sans en-tête obligatoire.

---

## 🔄 Synchronisation bidirectionnelle Excel ↔ Google Sheets

Depuis v2.9.0.0, le classeur `excel/Suivi conso E85.xlsm` synchronise en **4 directions** son onglet `GS_Pleins` avec `_ImportGS` :

### Principe
Chaque enregistrement est identifié par un **UUID** (`sync_id`, colonne O). À la saisie comme au sync, la macro VBA :

1. **GS → Excel (nouvelles lignes)** : lignes présentes dans GS et absentes d'Excel → `appendRow`
2. **GS → Excel (MAJ)** : lignes existantes non modifiées localement (col P vide) + valeurs GS différentes → `UpdateRowFromGS`
3. **Excel → GS (nouvelles lignes)** : lignes locales absentes de GS → POST `action=bulkAdd`
4. **Excel → GS (modifications)** : lignes modifiées localement (col P renseignée) et connues de GS → POST `action=bulkUpdate` ; col P effacée après succès

**Résolution de conflits** : si une ligne est modifiée des deux côtés, **Excel gagne** (col P renseignée = priorité locale).

### Col P — dirty flag
La colonne P (`Modifie_local`) est un horodatage `Now()` posé automatiquement par le module feuille `GS_Pleins` à chaque modification (A:N). Elle signale à `ExportModificationsToGS` que la ligne doit être propagée vers GS. Elle est effacée après confirmation du serveur (`status:'ok'`).

### Événements temps réel dans GS_Pleins (v2.9.0.0)
Le module `GS_Pleins_snippet.bas` ajoute un `Worksheet_Change` qui se déclenche à chaque saisie :

| Feature | Déclencheur | Comportement |
|---|---|---|
| **[F1] Auto sync_id** | Toute modif A:N | UUID généré en col O si absent |
| **[F2] Dirty flag** | Toute modif A:N | `Now()` inscrit en col P |
| **[F3] Validation km** | Saisie col D | Warning si km < max km du véhicule |
| **[F4] Détection doublons** | Saisie col B, D ou E | Warning si Date + Km + Litres identiques |

### Installation
```
Alt+F11 → Fichier → Importer → vba/modSyncGS.bas
Dans Microsoft Excel Objects → GS_Pleins : coller vba/GS_Pleins_snippet.bas
Dans "ThisWorkbook" : coller vba/ThisWorkbook_snippet.bas
GAS Editor → exécuter migrateSyncId() une seule fois (UUID sur lignes existantes)
```

### Fonctions VBA exposées

| Fonction | Usage |
|---|---|
| `SyncOnOpen` | Sync silencieuse à l'ouverture (appelée par `Workbook_Open`) |
| `SyncManuel` | Sync manuelle complète (4 directions) avec compte-rendu |
| `SyncDiagnose` | Compteurs GS/Excel/intersections/dirty pour debug |
| `TestConnexion` | Vérifie l'accès au GAS (code HTTP + extrait JSON) |
| `ForceFormatDates` | Applique le format date français + initialise col P |

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

## 🔧 Dépannage GAS

### "Vous n'êtes pas autorisé à appeler UrlFetchApp.fetch"

**Symptôme** : le scan de ticket (ou toute action GAS utilisant `UrlFetchApp`) retourne l'erreur :
> `Vous n'êtes pas autorisé à appeler UrlFetchApp.fetch. Autorisations requises : https://www.googleapis.com/auth/script.external_request`

**Cause** : le scope `script.external_request` (accès réseau externe) n'a pas été autorisé lors du déploiement initial — typiquement après avoir ajouté `UrlFetchApp.fetch` à un script déjà déployé.

**Correction** :

1. Ouvrir le Google Sheet → **Extensions → Apps Script**
2. Ajouter cette fonction temporaire et l'**exécuter** (▶) :
```javascript
function authoriserFetch() {
  UrlFetchApp.fetch('https://www.google.com');
}
```
3. Valider la fenêtre **"Autorisation requise"** → choisir son compte → **Autoriser**
4. Supprimer la fonction temporaire
5. **Déployer → Gérer les déploiements** → crayon ✏️ → **Nouvelle version → Déployer**

> Le GAS s'exécute sous l'identité du propriétaire du script (« Execute as: Me »). Chaque nouveau scope doit être explicitement consenti par le propriétaire avant d'être utilisable par le déploiement.

---

## 📦 Technologies

- HTML / CSS / JavaScript vanilla (ES Modules)
- [Vite](https://vitejs.dev/) — bundler + dev server + build GitHub Pages
- [Vitest](https://vitest.dev/) — tests unitaires
- [API Prix des Carburants v2](https://data.economie.gouv.fr/explore/dataset/prix-des-carburants-en-france-flux-instantane-v2/) — stations et prix (géoloc + recherche)
- [OpenStreetMap](https://www.openstreetmap.org/) — tuiles cartographiques + Overpass (enseignes)
- Google Apps Script — backend (enregistrement pleins, gestion stations/véhicules, export JSON, bulkAdd, bulkUpdate, scan ticket Gemini)
- Google Sheets — stockage des données + onglets `Stations` / `vehicules`
- GitHub Pages — hébergement de l'app mobile
- Excel + VBA — formulaire local + sync bidirectionnelle (`WinHttp`, `Scripting.Dictionary`, `Worksheet_Change`)
