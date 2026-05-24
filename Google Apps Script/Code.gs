// ============================================================
//  SUIVI CONSO E85 — Web App Backend
// ============================================================
const SPREADSHEET_ID = '1uN170kt_n45sBRwqs2krTYfhapU3dMKjTguD-qSUqCE';
const SHEET_NAME      = '_ImportGS';
const STATIONS_SHEET  = 'Stations';
const VEHICULES_SHEET = 'Vehicules';

const HEADERS = [
  'Horodatage', 'Date', 'Type', 'Km compteur',
  'Nb. Litres', 'Prix €/L', 'Prix S98 jour (€/L)', 'Station essence', 'Véhicule',
  'E85 station (€/L)', 'SP98 station (€/L)', 'SP95 station (€/L)',
  'E10 station (€/L)', 'Gazole station (€/L)', 'GPLc station (€/L)'
];

// ────────────────────────────────────────────────────────────
//  doGet — sert la page HTML selon l'appareil
// ────────────────────────────────────────────────────────────
function doGet(e) {
  const isMobile = (e.parameter.v === 'mobile');

  const page = HtmlService
    .createHtmlOutputFromFile(isMobile ? 'iphone' : 'index')
    .setTitle('Suivi E85 — Saisie plein')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);

  return page;
}

// ────────────────────────────────────────────────────────────
//  doPost — reçoit le JSON du formulaire
// ────────────────────────────────────────────────────────────
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

  if (payload.action === 'syncStations') {
    const sheet = ss.getSheetByName(STATIONS_SHEET);
    if (sheet && payload.stations && payload.stations.length > 0) {
      sheet.clearContents();
      payload.stations.forEach((s, i) => sheet.getRange(i + 1, 1).setValue(s));
    }
    return ContentService.createTextOutput(JSON.stringify({ success: true })).setMimeType(ContentService.MimeType.JSON);
  }

  // Enregistrement d'un plein (colonnes A→O)
  const sp = payload.stationPrices || {};
  const sheet = getOrCreateSheet(ss);
  sheet.appendRow([
    new Date(),                                          // A — Horodatage
    new Date(payload.date),                              // B — Date
    payload.type,                                        // C — Type
    Number(payload.km),                                  // D — Km compteur
    Number(payload.litres),                              // E — Nb. Litres
    Number(payload.prix),                                // F — Prix €/L
    payload.prixS98 ? Number(payload.prixS98) : '',      // G — Prix S98 jour
    payload.station,                                     // H — Station essence
    payload.vehicule || '',                              // I — Véhicule
    sp.E85    ? Number(sp.E85)    : '',                  // J — E85 station
    sp.SP98   ? Number(sp.SP98)   : '',                  // K — SP98 station
    sp.SP95   ? Number(sp.SP95)   : '',                  // L — SP95 station
    sp.E10    ? Number(sp.E10)    : '',                  // M — E10 station
    sp.GAZOLE ? Number(sp.GAZOLE) : '',                  // N — Gazole station
    sp.GPLC   ? Number(sp.GPLC)   : '',                  // O — GPLc station
  ]);
  return ContentService.createTextOutput(JSON.stringify({ success: true })).setMimeType(ContentService.MimeType.JSON);
}

// ────────────────────────────────────────────────────────────
//  migrateHeaders — À exécuter UNE SEULE FOIS manuellement
//  Met à jour la ligne 1 de _ImportGS vers 15 colonnes A→O
//  sans toucher aux lignes de données existantes.
// ────────────────────────────────────────────────────────────
function migrateHeaders() {
  const ss    = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet = getOrCreateSheet(ss);

  // Écrire les 15 en-têtes en ligne 1
  sheet.getRange(1, 1, 1, HEADERS.length).setValues([HEADERS]);

  // Reformater la ligne d'en-tête
  sheet.getRange(1, 1, 1, HEADERS.length)
    .setFontWeight('bold')
    .setBackground('#1B3A5C')
    .setFontColor('#FFFFFF')
    .setHorizontalAlignment('center');

  // Figer la ligne 1 si ce n'est pas déjà fait
  sheet.setFrozenRows(1);

  // Ajuster la largeur des colonnes nouvelles (I→O)
  sheet.setColumnWidth(9,  100);  // I — Véhicule
  sheet.setColumnWidth(10, 110);  // J — E85 station
  sheet.setColumnWidth(11, 110);  // K — SP98 station
  sheet.setColumnWidth(12, 110);  // L — SP95 station
  sheet.setColumnWidth(13, 110);  // M — E10 station
  sheet.setColumnWidth(14, 110);  // N — Gazole station
  sheet.setColumnWidth(15, 110);  // O — GPLc station

  Logger.log('✅ Migration terminée — ' + HEADERS.length + ' colonnes en ligne 1.');
}

// ────────────────────────────────────────────────────────────
//  Helpers
// ────────────────────────────────────────────────────────────
function getOrCreateSheet(ss) {
  let sheet = ss.getSheetByName(SHEET_NAME);
  if (!sheet) sheet = ss.insertSheet(SHEET_NAME);
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(HEADERS);
    sheet.getRange(1, 1, 1, HEADERS.length)
      .setFontWeight('bold')
      .setBackground('#1B3A5C')
      .setFontColor('#FFFFFF');
    sheet.setFrozenRows(1);
  }
  return sheet;
}

function jsonResponse(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
