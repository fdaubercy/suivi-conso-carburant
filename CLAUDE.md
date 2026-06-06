# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

---

## Graphify — Carte des connaissances

**Au démarrage de chaque session sur ce projet**, charger la carte des connaissances :

```
graphify-out/graph.json        → graphe principal (entités, relations, hyperedges)
graphify-out/GRAPH_REPORT.md   → rapport texte (god nodes, communautés, questions ouvertes)
graphify-out/graph.html        → visualisation interactive (navigateur)
```

Avant de lire un fichier source, interroger le graphe pour cibler les nœuds pertinents.  
Pour mettre à jour la carte après un changement significatif : `/graphify --update`.

---

## Commandes

```bash
npm run dev              # Serveur Vite local → http://localhost:5173/
npm run build            # Build Vite → dist/ (base /suivi-conso-carburant/)
npm run preview          # Prévisualise le build (base /suivi-conso-carburant/)

npm test                 # Vitest — 235+ cas unitaires (run once)
npm run test:coverage    # Vitest + couverture v8 → coverage/
npm run test:e2e         # Playwright E2E — headless Chromium (démarre Vite auto)
npm run test:e2e:headed  # Playwright visible
npm run test:e2e:report  # Ouvre le rapport HTML Playwright

npm run lint             # ESLint sur js/ — strict --max-warnings=0

./commit.sh "type(scope): description [vX.Y.Z.W]"
# Gate complet : lint → tests → git add -A → commit → pull --rebase → push
```

Le hook pre-commit (husky + lint-staged) passe automatiquement `eslint + vitest related` sur les fichiers `js/` mis en scène.

---

## Architecture

### Vue d'ensemble

PWA sans framework (ES Modules), servie sur GitHub Pages via un build Vite.  
Le backend est un **Google Apps Script** déployé en Web App, qui écrit dans un **Google Sheet**.  
Un classeur Excel (`.xlsm`) se synchronise de façon bidirectionnelle avec le Sheet via VBA + WinHttp.

### Routing et point d'entrée

- `js/main.js` — câblage de tous les modules, événements auth, `renderStats()`
- `js/router.js` — routeur hash (`#/saisie`, `#/stats`, `#/carte`, `#/historique`, `#/params`, `#/accueil`)
- `js/config.js` — **source de vérité** de `APP_VERSION`, `GAS_URL`, `GS_SHEET_ID`, `APP_TOKEN`, `GOOGLE_MAPS_API_KEY`, `VAPID_PUBLIC_KEY`

### Modules JS (`js/`)

| Module | Rôle |
|---|---|
| `state.js` | État partagé (type carburant courant, prix stations, signal d'annulation OSM) |
| `utils.js` | Fonctions pures (haversine, `odsUrl`, formatage) |
| `ui.js` | Helpers DOM |
| `formulaire.js` | Soumission plein, brouillon auto-save, dictée vocale km |
| `historique.js` | 5 derniers pleins + historique complet + sync différentielle + CSV export |
| `stats.js` | KPIs live, sparkline multi-carburant, prédiction prochain plein |
| `statsApi.js` | Agrégats pré-calculés depuis GAS (cache 1 h) |
| `prix.js` | API prix `data.economie.gouv.fr` (cache TTL 5 min par `(lat,lon,rayon)`) |
| `geo.js` | Géoloc + stations proches + comparateur W30 + cache localStorage 1 h |
| `osm.js` | Enrichissement Overpass (`enrichStationsBulk`) — requête groupée, appariement ≤ 200 m, annulable via `AbortController` |
| `carte.js` | Rendu carte : Google Maps si clé présente, repli tuiles OSM maison sinon |
| `gmap.js` | Chargeur Google Maps JS API + clustering |
| `ticket.js` | Scan OCR (Gemini via GAS en principal, Tesseract.js en fallback local) |
| `secteur.js` | Prix mini secteur + carte « Moins cher du secteur » (relevé quotidien ~7h GAS) |
| `stationsmap.js` | Carte stations habituelles + coordonnées mémorisées |
| `recherche.js` | Geocodage BAN (Base Adresse Nationale) → stations dans le rayon |
| `stations.js` | Chargement liste stations depuis GAS au démarrage |
| `router.js` | Navigation par hash + swipe directionnel + vue de départ configurable |
| `pwa.js` | Bannière install + détection SW en attente (message `SKIP_WAITING`) |

### Backend GAS (`Google Drive/.../Code.gs`)

Actions `doPost` : enregistrement plein, `addStation`, `syncStations`, `bulkAdd`, `bulkUpdate`, `bulkDelete`, `deletePlein`, `scanTicket`, `saveLastGeo`, `setParametres`.  
Actions `doGet` : `export` (historique + `deleted:[]`), `lowprice`, `sectorPrices`, `stats`, `getParametres`.

Token optionnel `APP_TOKEN` : activer en posant la propriété dans GAS **et** dans `js/config.js`.

### Synchronisation bidirectionnelle Excel ↔ GAS

Clé de déduplication : `sync_id` (UUID, col O du Sheet `_ImportGS`).  
Résolution de conflits : last-write-wins par horodatage (col Q Excel `Modifie_local` vs col Q GAS `Modifié_le`).  
Suppression : soft-delete (tombstone col R `Supprimé`) propagé dans les deux sens.  
Paramètres métier partagés (kit prix, budget, objectif CO₂, seuils alertes) : onglet `Parametres` du Sheet, synchronisé par `js/parametres.js` (app) et `modSyncParametres.bas` (Excel).

### Versioning

Format **X.Y.Z.W** (MAJOR.MINOR.PATCH.BUILD) :
- `APP_VERSION` dans `js/config.js` est la source de vérité ; `package.json#version` est aligné par `commit.sh`.
- Incrémenter BUILD (W) pour chaque itération corrective dans la même session ; remettre W à 0 au changement de PATCH/MINOR/MAJOR.

### Tests

- **Vitest** (`tests/*.test.js`) — environnement `node` par défaut ; les suites qui touchent le DOM déclarent `// @vitest-environment jsdom` en tête.
- **Playwright** (`tests/e2e.spec.js`) — 5 scénarios E2E avec mock GAS via `page.route()` ; serveur Vite démarré automatiquement par la config Playwright.
- La CI GitHub Actions (`ci.yml`) bloque sur ESLint et les tests Vitest ; la couverture et `npm audit` sont non-bloquants.

### Règles VBA (à respecter)

- `Private Const`, `Dim`, `Type`, `Enum` au niveau module → toujours dans la section de déclarations en tête de fichier, avant la première `Sub`/`Function`.
- Après chaque import de `.bas` → exécuter **Débogage → Compiler VBAProject** avant tout `Alt+F8`.
