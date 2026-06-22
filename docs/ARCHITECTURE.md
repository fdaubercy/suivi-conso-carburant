# Architecture — Suivi Conso Carburants

> Extrait de `CLAUDE.md` (découpe du 2026-06-21 pour alléger le démarrage). **À lire avant toute modification de module.**

## Vue d'ensemble
PWA sans framework (ES Modules), servie sur **GitHub Pages** via un build **Vite**.
Le backend est un **Google Apps Script** déployé en Web App, qui écrit dans un **Google Sheet**.
Un classeur **Excel `.xlsm`** se synchronise de façon bidirectionnelle avec le Sheet via **VBA + WinHttp**.

## Routing et point d'entrée
- `js/main.js` — câblage de tous les modules, événements auth, `renderStats()`
- `js/router.js` — routeur hash (`#/saisie`, `#/stats`, `#/carte`, `#/historique`, `#/params`, `#/accueil`)
- `js/config.js` — **source de vérité** : `APP_VERSION`, `GAS_URL`, `GS_SHEET_ID`, `APP_TOKEN`, `GOOGLE_CLIENT_ID`, `GOOGLE_MAPS_API_KEY`, `VAPID_PUBLIC_KEY`

## Modules JS (`js/`)
| Module | Rôle |
|---|---|
| `state.js` | État partagé (type carburant courant, prix stations, signal d'annulation OSM) |
| `utils.js` | Fonctions pures (haversine, `odsUrl`, formatage) |
| `ui.js` | Helpers DOM |
| `auth.js` | U7 — comptes Google (GIS / « Sign in with Google »), JWT en localStorage, événement `auth-changed` |
| `formulaire.js` | Soumission plein, brouillon auto-save, dictée vocale km, `idToken` dans le payload |
| `historique.js` | 5 derniers pleins + historique complet + sync différentielle + CSV export |
| `stats.js` | KPIs live, sparkline multi-carburant, prédiction prochain plein |
| `statsApi.js` | Agrégats pré-calculés depuis GAS (cache 1 h) |
| `prix.js` | API prix `data.economie.gouv.fr` (cache TTL 5 min par `(lat,lon,rayon)`) |
| `geo.js` | Géoloc + stations proches + comparateur W30 + cache localStorage 1 h |
| `osm.js` | Enrichissement Overpass (`enrichStationsBulk`) — requête groupée, appariement ≤ 200 m, annulable (`AbortController`) |
| `carte.js` | Rendu carte : Google Maps si clé présente, repli tuiles OSM maison sinon |
| `gmap.js` | Chargeur Google Maps JS API + clustering |
| `ticket.js` | Scan OCR (Gemini via GAS en principal, Tesseract.js en fallback local) |
| `secteur.js` | Prix mini secteur + carte « Moins cher du secteur » (relevé ~7h GAS) |
| `stationsmap.js` | Carte stations habituelles + coordonnées mémorisées |
| `recherche.js` | Géocodage BAN (Base Adresse Nationale) → stations dans le rayon |
| `stations.js` | Chargement liste stations depuis GAS au démarrage |
| `parametres.js` | P1 — sync LWW des paramètres métier (onglet `Parametres`) |
| `pwa.js` | Bannière install + détection SW en attente (`SKIP_WAITING`) |

## Backend GAS (`Google Drive/.../Google Apps Script/`)
- `Code.gs` — actions `doPost` : enregistrement plein, `addStation`, `syncStations`, `bulkAdd`, `bulkUpdate`, `bulkDelete`, `deletePlein`, `scanTicket`, `saveLastGeo`, `setParametres`. Actions `doGet` : `export` (+ `deleted:[]`), `lowprice`, `sectorPrices`, `stats`, `getParametres`.
- `Auth.gs` — U7 : vérifie l'`idToken` Google (`tokeninfo`), résout l'email propriétaire (`resolveOwner_`), `SYNC_SECRET` pour les outils propriétaire (Excel/PQ).
- Token optionnel `APP_TOKEN` : activer en posant la propriété dans GAS **et** dans `js/config.js`.

## Synchronisation bidirectionnelle Excel ↔ GAS
- Déduplication : `sync_id` (UUID, col O de `_ImportGS`).
- Conflits : last-write-wins par horodatage (col Q Excel `Modifie_local` vs col Q GAS `Modifié_le`).
- Suppression : soft-delete (tombstone col R `Supprimé`) propagé dans les deux sens.
- Paramètres métier partagés : onglet `Parametres` du Sheet, sync par `js/parametres.js` (app) et `modSyncParametres.bas` (Excel).

## Identité utilisateur (U7, multi-utilisateur)
- L'app envoie un **`idToken` (JWT Google)** à chaque requête ; GAS le **vérifie côté serveur** et stocke l'email vérifié en **colonne S (`Email`, index 18)** de `_ImportGS`.
- Toutes les lectures filtrent par cet email (`_rowBelongsTo_`). Lignes héritées (sans email) → `OWNER_EMAIL` (`fdaubercy@gmail.com`).
- Excel/Power Query utilise `SYNC_SECRET` (clé privée, jamais commitée) → résout vers `OWNER_EMAIL`.

## Versioning — format X.Y.Z.W (MAJOR.MINOR.PATCH.BUILD)
- `APP_VERSION` dans **`js/config.js`** est la source de vérité ; `package.json#version` est aligné par `commit.sh`.
- Incrémenter **BUILD (W)** pour chaque itération corrective dans la même session ; remettre W à 0 au changement de PATCH/MINOR/MAJOR.
- **Ne jamais réutiliser un numéro existant.** Mettre à jour `APP_VERSION` **et** l'entrée CHANGELOG en cohérence.

| Composante | Quand incrémenter |
|---|---|
| MAJOR (X) | Refonte / breaking change architectural |
| MINOR (Y) | Nouvelle fonctionnalité utilisateur visible |
| PATCH (Z) | Correction de bug, amélioration technique |
| BUILD (W) | Itération dans la même session de travail |

## Tests
- **Vitest** (`tests/*.test.js`) — env `node` par défaut ; suites DOM avec `// @vitest-environment jsdom` en tête.
- **Playwright** (`tests/e2e.spec.js`) — 5 scénarios E2E, mock GAS via `page.route()`.
- **CI GitHub Actions** (`ci.yml`) : bloque sur ESLint + Vitest ; couverture et `npm audit` non-bloquants.
