# Suivi E85 — Google Apps Script — v2.9.0.0

## Déploiement

1. Ouvrir le Google Sheet → **Extensions → Apps Script**
2. Remplacer tout le contenu de `Code.gs` par le fichier `Code.gs` de ce dossier
3. **Déployer → Gérer les déploiements → Nouvelle version → Déployer**
4. Copier l'URL de déploiement et la reporter dans `js/config.js` → `GAS_URL`

---

## Configuration requise

| Constante       | Valeur                                        |
|-----------------|-----------------------------------------------|
| `SPREADSHEET_ID`| ID du Google Sheet (extrait de l'URL)          |
| `SHEET_NAME`    | `_ImportGS` (créé automatiquement)             |
| `STATIONS_SHEET`| `Stations`                                    |
| `VEHICULES_SHEET`| `Vehicules`                                  |

### Clé Gemini (optionnel — scan ticket)
Extensions → Apps Script → Paramètres du projet → Propriétés de script  
→ Ajouter `GEMINI_API_KEY`

---

## Schema de la feuille `_ImportGS`

| Col | Lettre | Nom                   | Type       |
|-----|--------|-----------------------|------------|
| 1   | A      | Horodatage            | Date/heure |
| 2   | B      | Date                  | Date       |
| 3   | C      | Type                  | Texte      |
| 4   | D      | Km compteur           | Nombre     |
| 5   | E      | Nb. Litres            | Nombre     |
| 6   | F      | Prix €/L              | Nombre     |
| 7   | G      | Station essence       | Texte      |
| 8   | H      | Véhicule              | Texte      |
| 9   | I      | E85 station (€/L)     | Nombre     |
| 10  | J      | SP98 station (€/L)    | Nombre     |
| 11  | K      | SP95 station (€/L)    | Nombre     |
| 12  | L      | E10 station (€/L)     | Nombre     |
| 13  | M      | Gazole station (€/L)  | Nombre     |
| 14  | N      | GPLc station (€/L)    | Nombre     |
| 15  | O      | sync_id               | UUID       |

---

## Actions `doGet`

| Paramètre        | Comportement                              |
|------------------|-------------------------------------------|
| `?action=export` | Retourne tous les enregistrements en JSON |
| `?v=mobile`      | Page HTML mobile (iphone.html)            |
| _(aucun)_        | Page HTML index                           |

Réponse `export` : `{ records: [ { "Horodatage": "...", "Date": "...", ..., "sync_id": "..." }, ... ] }`

---

## Actions `doPost`

### Plein depuis l'app web _(aucun `action`)_
```json
{
  "date": "2025-05-15",
  "type": "E85",
  "km": 87543,
  "litres": 42.5,
  "prix": 0.799,
  "station": "Total Autobahn",
  "vehicule": "Kangoo",
  "sync_id": "uuid-optionnel",
  "stationPrices": { "E85": 0.799, "SP98": 2.089 }
}
```
Retourne : `{ "success": true, "sync_id": "uuid-généré-ou-fourni" }`

---

### `addStation`
```json
{ "action": "addStation", "station": "Leclerc Niort" }
```
Ajoute une ligne dans l'onglet `Stations`.

---

### `syncStations`
```json
{ "action": "syncStations", "stations": ["Leclerc Niort", "Total Autobahn"] }
```
Remplace tout le contenu de l'onglet `Stations`.

---

### `addVehicule`
```json
{ "action": "addVehicule", "vehicule": "Kangoo" }
```
Ajoute dans l'onglet `Vehicules` (dédupliqué).

---

### `removeVehicule`
```json
{ "action": "removeVehicule", "vehicule": "Kangoo" }
```
Supprime la première ligne correspondante dans `Vehicules`.

---

### `bulkAdd`
Envoyé par le VBA Excel lors du **premier sync** (import initial vers GS).  
Déduplique par `sync_id` — ne crée que les lignes absentes.

```json
{
  "action": "bulkAdd",
  "rows": [
    {
      "sync_id":     "uuid-1",
      "horodatage":  "2025-05-15 10:30:00",
      "date":        "2025-05-15",
      "type":        "E85",
      "km":          87543,
      "litres":      42.5,
      "prix":        0.799,
      "station":     "Total Autobahn",
      "vehicule":    "Kangoo",
      "stationPrices": { "E85": 0.799, "SP98": 2.089 }
    }
  ]
}
```
Retourne : `{ "success": true, "added": N, "skipped": M }`

---

### `bulkUpdate` _(v2.9.0.0 — sync bidirectionnel)_
Envoyé par le VBA Excel lors d'un **sync bidirectionnel** : propage les lignes modifiées dans Excel vers GS.

- Ligne trouvée par `sync_id` → MAJ cols **B–N** (col A `Horodatage` préservée)
- Ligne absente du GS → upsert (`appendRow`, cas de désynchronisation)

```json
{
  "action": "bulkUpdate",
  "rows": [
    {
      "sync_id":  "uuid-existant",
      "date":     "2025-05-16",
      "type":     "E85",
      "km":       87890,
      "litres":   41.0,
      "prix":     0.802,
      "station":  "Leclerc Niort",
      "vehicule": "Kangoo",
      "stationPrices": { "E85": 0.802 }
    }
  ]
}
```
Retourne : `{ "status": "ok", "updated": N, "added": M }`  
Le VBA vérifie l'absence de `"error"` dans la réponse avant d'effacer le marqueur `Modifie_local` (col P).

---

### `scanTicket` _(W17 — nécessite GEMINI_API_KEY)_
```json
{
  "action":      "scanTicket",
  "imageBase64": "<base64>",
  "mimeType":    "image/jpeg"
}
```
Retourne :
```json
{
  "success": true,
  "data": {
    "date": "2025-05-15",
    "km": 87543,
    "litres": 42.5,
    "prix_litre": 0.799,
    "montant_total": 33.95,
    "type_carburant": "E85",
    "station": "Total Autobahn"
  }
}
```

---

## Fonctions de migration (à exécuter manuellement une fois)

| Fonction              | Quand l'utiliser                                              |
|-----------------------|---------------------------------------------------------------|
| `migrateHeaders()`    | Réécrire les 15 en-têtes A→O (après changement de schéma)    |
| `migrateSyncId()`     | Générer les `sync_id` manquants sur les lignes existantes     |
| `migrateRemoveS98()`  | ⚠️ Supprimer l'ancienne col G "Prix S98 jour" (v2.3.0.0)     |

---

## Historique des versions GAS

| Version   | Date       | Changements                                                         |
|-----------|------------|---------------------------------------------------------------------|
| 2.9.0.0   | 2026-05-26 | Sync bidir. : `bulkUpdate` (Excel → GS, upsert par sync_id)        |
| 2.5.0.0   | —          | `bulkAdd`, `handleExport`, `action=export` doGet, Gemini scan       |
| 2.3.0.0   | —          | Suppression col G "Prix S98 jour" — `migrateRemoveS98()`            |
| 2.1.3.0   | —          | `addVehicule`, `removeVehicule`, onglet Vehicules                   |
| 2.0.0.0   | —          | `sync_id` col O, `migrateSyncId()`, `migrateHeaders()`              |
| 1.x       | —          | Saisie plein simple (A→I, 9 colonnes)                               |
