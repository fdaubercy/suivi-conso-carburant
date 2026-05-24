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
