// ============================================================
//  SUIVI CONSO E85 — Web App Backend
// ============================================================
const SPREADSHEET_ID = '1uN170kt_n45sBRwqs2krTYfhapU3dMKjTguD-qSUqCE';
const SHEET_NAME      = '_ImportGS';
const STATIONS_SHEET  = 'Stations';
const VEHICULES_SHEET = 'Vehicules';

const HEADERS = [
  'Horodatage','Date','Type','Km compteur',
  'Nb. Litres','Prix €/L','Prix S98 jour (€/L)','Station essence'
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
