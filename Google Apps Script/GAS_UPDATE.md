# Mise à jour Google Apps Script — v2.1.3.0

## Nouveaux `action` supportés dans `doPost`

Ajouter ces blocs dans `doPost`, avant le bloc d'enregistrement du plein :

```javascript
const VEHICULES_SHEET = 'Vehicules'; // nom de l'onglet à créer dans le Google Sheet

// ── Véhicules : ajout ──
if (payload.action === 'addVehicule') {
  const sheet = ss.getSheetByName(VEHICULES_SHEET)
              || ss.insertSheet(VEHICULES_SHEET); // crée l'onglet si inexistant
  const values = sheet.getDataRange().getValues();
  const exists = values.some(row => row[0] === payload.vehicule);
  if (!exists) sheet.appendRow([payload.vehicule]);
  return ContentService
    .createTextOutput(JSON.stringify({ success: true }))
    .setMimeType(ContentService.MimeType.JSON);
}

// ── Véhicules : suppression ──
if (payload.action === 'removeVehicule') {
  const sheet = ss.getSheetByName(VEHICULES_SHEET);
  if (sheet) {
    const data = sheet.getDataRange().getValues();
    for (let i = data.length - 1; i >= 0; i--) {
      if (data[i][0] === payload.vehicule) { sheet.deleteRow(i + 1); break; }
    }
  }
  return ContentService
    .createTextOutput(JSON.stringify({ success: true }))
    .setMimeType(ContentService.MimeType.JSON);
}
```

## doPost complet mis à jour

```javascript
const SPREADSHEET_ID  = 'VOTRE_ID';
const SHEET_NAME      = '_ImportGS';
const STATIONS_SHEET  = 'Stations';
const VEHICULES_SHEET = 'Vehicules';

function doPost(e) {
  const payload = JSON.parse(e.postData.contents);
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);

  if (payload.action === 'addStation') {
    const sheet = ss.getSheetByName(STATIONS_SHEET);
    sheet.appendRow([payload.station]);
    return ContentService.createTextOutput(JSON.stringify({ success: true })).setMimeType(ContentService.MimeType.JSON);
  }

  if (payload.action === 'addVehicule') {
    const sheet = ss.getSheetByName(VEHICULES_SHEET) || ss.insertSheet(VEHICULES_SHEET);
    const values = sheet.getDataRange().getValues();
    if (!values.some(r => r[0] === payload.vehicule)) sheet.appendRow([payload.vehicule]);
    return ContentService.createTextOutput(JSON.stringify({ success: true })).setMimeType(ContentService.MimeType.JSON);
  }

  if (payload.action === 'removeVehicule') {
    const sheet = ss.getSheetByName(VEHICULES_SHEET);
    if (sheet) {
      const data = sheet.getDataRange().getValues();
      for (let i = data.length - 1; i >= 0; i--) {
        if (data[i][0] === payload.vehicule) { sheet.deleteRow(i + 1); break; }
      }
    }
    return ContentService.createTextOutput(JSON.stringify({ success: true })).setMimeType(ContentService.MimeType.JSON);
  }

  // Enregistrement d'un plein
  const sheet = ss.getSheetByName(SHEET_NAME);
  sheet.appendRow([
    new Date(),
    new Date(payload.date),
    payload.type,
    Number(payload.km),
    Number(payload.litres),
    Number(payload.prix),
    payload.prixS98 ? Number(payload.prixS98) : '',
    payload.station,
    payload.vehicule || ''   // colonne I — Véhicule
  ]);
  return ContentService.createTextOutput(JSON.stringify({ success: true })).setMimeType(ContentService.MimeType.JSON);
}
```

## Redéploiement
Déployer → Gérer les déploiements → Nouvelle version → Déployer.

## Onglet Vehicules dans le Google Sheet
L'onglet est créé automatiquement au premier ajout de véhicule.
Pour pré-remplir manuellement : créer un onglet `Vehicules` avec une ligne par véhicule (colonne A, sans en-tête ou avec en-tête — les lignes vides sont ignorées par le chargeur).
