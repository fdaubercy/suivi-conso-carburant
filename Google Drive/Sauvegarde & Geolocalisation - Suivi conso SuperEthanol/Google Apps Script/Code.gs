// ============================================================
//  SUIVI CONSO E85 — Web App Backend                v2.3.0.0
//
//  ⚠️  BREAKING CHANGE v2.3.0.0 : suppression colonne G "Prix S98 jour"
//  La colonne K "SP98 station (€/L)" est désormais la seule source SP98.
//  → exécuter migrateRemoveS98() une fois pour migrer les données.
// ============================================================
const SPREADSHEET_ID  = '1uN170kt_n45sBRwqs2krTYfhapU3dMKjTguD-qSUqCE';
const SHEET_NAME      = '_ImportGS';
const STATIONS_SHEET  = 'Stations';
const VEHICULES_SHEET = 'Vehicules';

const HEADERS = [
  'Horodatage', 'Date', 'Type', 'Km compteur',         // A B C D
  'Nb. Litres', 'Prix €/L', 'Station essence',         // E F G  (G était "Prix S98 jour" — supprimé)
  'Véhicule',                                           // H
  'E85 station (€/L)', 'SP98 station (€/L)',           // I J
  'SP95 station (€/L)', 'E10 station (€/L)',           // K L
  'Gazole station (€/L)', 'GPLc station (€/L)',        // M N
  'sync_id'                                             // O — identifiant unique
];

// ────────────────────────────────────────────────────────────
//  doGet
//  • ?action=export  → JSON de tous les enregistrements (sync Excel)
//  • ?v=mobile       → page HTML mobile
//  • (aucun param)   → page HTML index
// ────────────────────────────────────────────────────────────
function doGet(e) {
  if (e.parameter.action === 'export') {
    return handleExport();
  }

  const isMobile = (e.parameter.v === 'mobile');
  return HtmlService
    .createHtmlOutputFromFile(isMobile ? 'iphone' : 'index')
    .setTitle('Suivi E85 — Saisie plein')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

// ────────────────────────────────────────────────────────────
//  handleExport — retourne tous les enreg. de _ImportGS en JSON
// ────────────────────────────────────────────────────────────
function handleExport() {
  const ss    = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet = getOrCreateSheet(ss);
  const data  = sheet.getDataRange().getValues();
  const tz    = ss.getSpreadsheetTimeZone();

  if (data.length <= 1) return jsonResponse({ records: [] });

  const headers = data[0].map(String);
  const records = data.slice(1).map(row => {
    const obj = {};
    headers.forEach((h, i) => {
      const v = row[i];
      obj[h] = (v instanceof Date)
        ? Utilities.formatDate(v, tz, "yyyy-MM-dd HH:mm:ss")
        : v;
    });
    return obj;
  });

  return jsonResponse({ records });
}

// ────────────────────────────────────────────────────────────
//  doPost
// ────────────────────────────────────────────────────────────
function doPost(e) {
  const payload = JSON.parse(e.postData.contents);
  const ss      = SpreadsheetApp.openById(SPREADSHEET_ID);

  if (payload.action === 'addStation') {
    const sheet = ss.getSheetByName(STATIONS_SHEET);
    sheet.appendRow([payload.station]);
    return jsonResponse({ success: true });
  }

  if (payload.action === 'syncStations') {
    const sheet = ss.getSheetByName(STATIONS_SHEET);
    if (sheet && payload.stations && payload.stations.length > 0) {
      sheet.clearContents();
      payload.stations.forEach((s, i) => sheet.getRange(i + 1, 1).setValue(s));
    }
    return jsonResponse({ success: true });
  }

  if (payload.action === 'addVehicule') {
    const sheet = ss.getSheetByName(VEHICULES_SHEET) || ss.insertSheet(VEHICULES_SHEET);
    const values = sheet.getDataRange().getValues();
    if (!values.some(r => r[0] === payload.vehicule)) sheet.appendRow([payload.vehicule]);
    return jsonResponse({ success: true });
  }

  if (payload.action === 'removeVehicule') {
    const sheet = ss.getSheetByName(VEHICULES_SHEET);
    if (sheet) {
      const data = sheet.getDataRange().getValues();
      for (let i = data.length - 1; i >= 0; i--) {
        if (data[i][0] === payload.vehicule) { sheet.deleteRow(i + 1); break; }
      }
    }
    return jsonResponse({ success: true });
  }

  if (payload.action === 'bulkAdd') {
    return handleBulkAdd(ss, payload.rows || []);
  }

  // ── Enregistrement d'un plein depuis l'app web (A→O, 15 col) ──
  const sp     = payload.stationPrices || {};
  const syncId = payload.sync_id || Utilities.getUuid();
  const sheet  = getOrCreateSheet(ss);

  sheet.appendRow([
    new Date(),                                         // A — Horodatage
    new Date(payload.date),                             // B — Date
    payload.type,                                       // C — Type
    Number(payload.km),                                 // D — Km compteur
    Number(payload.litres),                             // E — Nb. Litres
    Number(payload.prix),                               // F — Prix €/L
    payload.station,                                    // G — Station essence
    payload.vehicule || '',                             // H — Véhicule
    sp.E85    ? Number(sp.E85)    : '',                 // I — E85 station
    sp.SP98   ? Number(sp.SP98)   : '',                 // J — SP98 station
    sp.SP95   ? Number(sp.SP95)   : '',                 // K — SP95 station
    sp.E10    ? Number(sp.E10)    : '',                 // L — E10 station
    sp.GAZOLE ? Number(sp.GAZOLE) : '',                 // M — Gazole station
    sp.GPLC   ? Number(sp.GPLC)   : '',                 // N — GPLc station
    syncId,                                             // O — sync_id
  ]);

  return jsonResponse({ success: true, sync_id: syncId });
}

// ────────────────────────────────────────────────────────────
//  handleBulkAdd — insère des lignes envoyées par Excel
//  Déduplique par sync_id (colonne O = index 14)
// ────────────────────────────────────────────────────────────
function handleBulkAdd(ss, rows) {
  const sheet = getOrCreateSheet(ss);
  const data  = sheet.getDataRange().getValues();

  const existingIds = new Set(
    data.slice(1).map(r => r[14]).filter(id => id !== '' && id !== null && id !== undefined)
  );

  let added = 0;
  rows.forEach(row => {
    if (!row.sync_id || existingIds.has(row.sync_id)) return;

    const sp = row.stationPrices || {};
    sheet.appendRow([
      row.horodatage ? new Date(row.horodatage) : new Date(), // A
      new Date(row.date),                                      // B
      row.type       || '',                                    // C
      Number(row.km)     || 0,                                 // D
      Number(row.litres) || 0,                                 // E
      Number(row.prix)   || 0,                                 // F
      row.station    || '',                                    // G
      row.vehicule   || '',                                    // H
      sp.E85    ? Number(sp.E85)    : '',                      // I
      sp.SP98   ? Number(sp.SP98)   : '',                      // J
      sp.SP95   ? Number(sp.SP95)   : '',                      // K
      sp.E10    ? Number(sp.E10)    : '',                      // L
      sp.GAZOLE ? Number(sp.GAZOLE) : '',                      // M
      sp.GPLC   ? Number(sp.GPLC)   : '',                      // N
      row.sync_id,                                             // O
    ]);

    existingIds.add(row.sync_id);
    added++;
  });

  return jsonResponse({ success: true, added, skipped: rows.length - added });
}

// ────────────────────────────────────────────────────────────
//  migrateRemoveS98 — À exécuter UNE SEULE FOIS manuellement
//  Supprime l'ancienne colonne G "Prix S98 jour (€/L)" du sheet.
//  Toutes les colonnes H→P sont décalées vers G→O.
// ────────────────────────────────────────────────────────────
function migrateRemoveS98() {
  const ss    = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet = getOrCreateSheet(ss);

  const headerG = sheet.getRange(1, 7).getValue();
  if (headerG !== 'Prix S98 jour (€/L)') {
    Logger.log(`⚠️  Colonne G n'est pas "Prix S98 jour" (trouvé: "${headerG}"). Migration annulée.`);
    return;
  }

  sheet.deleteColumn(7);
  Logger.log('✅ migrateRemoveS98 — colonne G supprimée, schéma réduit à 15 colonnes (A→O).');
}

// ────────────────────────────────────────────────────────────
//  migrateSyncId — À exécuter UNE SEULE FOIS (legacy)
//  Génère un UUID pour les lignes existantes sans sync_id.
//  Schéma 2.3.0.0 : sync_id en colonne O (index 15).
// ────────────────────────────────────────────────────────────
function migrateSyncId() {
  const ss    = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet = getOrCreateSheet(ss);
  const last  = sheet.getLastRow();

  const headerCell = sheet.getRange(1, 15);
  if (!headerCell.getValue()) {
    headerCell.setValue('sync_id');
    headerCell.setFontWeight('bold')
      .setBackground('#1B3A5C')
      .setFontColor('#FFFFFF')
      .setHorizontalAlignment('center');
    sheet.setColumnWidth(15, 260);
  }

  let count = 0;
  for (let i = 2; i <= last; i++) {
    const cell = sheet.getRange(i, 15);
    if (!cell.getValue()) {
      cell.setValue(Utilities.getUuid());
      count++;
    }
  }

  Logger.log(`✅ migrateSyncId — ${count} UUID générés sur ${last - 1} lignes.`);
}

// ────────────────────────────────────────────────────────────
//  migrateHeaders — Réécrit les 15 en-têtes A→O
// ────────────────────────────────────────────────────────────
function migrateHeaders() {
  const ss    = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet = getOrCreateSheet(ss);

  sheet.getRange(1, 1, 1, HEADERS.length).setValues([HEADERS]);
  sheet.getRange(1, 1, 1, HEADERS.length)
    .setFontWeight('bold')
    .setBackground('#1B3A5C')
    .setFontColor('#FFFFFF')
    .setHorizontalAlignment('center');

  sheet.setFrozenRows(1);
  [8, 9, 10, 11, 12, 13, 14].forEach(col => sheet.setColumnWidth(col, 110));
  sheet.setColumnWidth(15, 260); // O — sync_id

  Logger.log('✅ migrateHeaders — ' + HEADERS.length + ' colonnes en ligne 1.');
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
