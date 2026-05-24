// ============================================================
//  SUIVI CONSO E85 — Web App Backend                v2.2.3.0
// ============================================================
const SPREADSHEET_ID  = '1uN170kt_n45sBRwqs2krTYfhapU3dMKjTguD-qSUqCE';
const SHEET_NAME      = '_ImportGS';
const STATIONS_SHEET  = 'Stations';
const VEHICULES_SHEET = 'Vehicules';

// Optionnel : décommenter et définir pour protéger l'export
// const SYNC_TOKEN = 'REMPLACER_PAR_UN_TOKEN_SECRET';

const HEADERS = [
  'Horodatage', 'Date', 'Type', 'Km compteur',
  'Nb. Litres', 'Prix €/L', 'Prix S98 jour (€/L)', 'Station essence', 'Véhicule',
  'E85 station (€/L)', 'SP98 station (€/L)', 'SP95 station (€/L)',
  'E10 station (€/L)', 'Gazole station (€/L)', 'GPLc station (€/L)',
  'sync_id'   // P — identifiant unique de synchronisation (UUID)
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
//  Appelé par la macro VBA Excel pour la synchronisation
//
//  Format réponse :
//  { records: [ { Horodatage, Date, Type, ..., sync_id }, … ] }
// ────────────────────────────────────────────────────────────
function handleExport() {
  const ss    = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet = getOrCreateSheet(ss);
  const data  = sheet.getDataRange().getValues();
  const tz    = ss.getSpreadsheetTimeZone();   // heure locale du Sheet (Europe/Paris)

  if (data.length <= 1) return jsonResponse({ records: [] });

  const headers = data[0].map(String);
  const records = data.slice(1).map(row => {
    const obj = {};
    headers.forEach((h, i) => {
      const v = row[i];
      // Dates formatées en heure locale : "2026-05-22 06:01:55" (pas d'UTC, pas de Z)
      obj[h] = (v instanceof Date)
        ? Utilities.formatDate(v, tz, "yyyy-MM-dd HH:mm:ss")
        : v;
    });
    return obj;
  });

  return jsonResponse({ records });
}

// ────────────────────────────────────────────────────────────
//  doPost — reçoit le JSON du formulaire
// ────────────────────────────────────────────────────────────
function doPost(e) {
  const payload = JSON.parse(e.postData.contents);
  const ss      = SpreadsheetApp.openById(SPREADSHEET_ID);

  // ── Gestion des stations ────────────────────────────────────
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

  // ── Gestion des véhicules ───────────────────────────────────
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

  // ── Insertion en masse depuis Excel (sync bidirectionnelle) ──
  if (payload.action === 'bulkAdd') {
    return handleBulkAdd(ss, payload.rows || []);
  }

  // ── Enregistrement d'un plein depuis l'app web (A→P) ────────
  const sp     = payload.stationPrices || {};
  const syncId = payload.sync_id || Utilities.getUuid(); // web app peut pré-générer son UUID
  const sheet  = getOrCreateSheet(ss);

  sheet.appendRow([
    new Date(),                                         // A — Horodatage
    new Date(payload.date),                             // B — Date
    payload.type,                                       // C — Type
    Number(payload.km),                                 // D — Km compteur
    Number(payload.litres),                             // E — Nb. Litres
    Number(payload.prix),                               // F — Prix €/L
    payload.prixS98 ? Number(payload.prixS98) : '',     // G — Prix S98 jour
    payload.station,                                    // H — Station essence
    payload.vehicule || '',                             // I — Véhicule
    sp.E85    ? Number(sp.E85)    : '',                 // J — E85 station
    sp.SP98   ? Number(sp.SP98)   : '',                 // K — SP98 station
    sp.SP95   ? Number(sp.SP95)   : '',                 // L — SP95 station
    sp.E10    ? Number(sp.E10)    : '',                 // M — E10 station
    sp.GAZOLE ? Number(sp.GAZOLE) : '',                 // N — Gazole station
    sp.GPLC   ? Number(sp.GPLC)   : '',                 // O — GPLc station
    syncId,                                             // P — sync_id
  ]);

  // On retourne le sync_id au client (utile à l'étape 2 côté web app)
  return jsonResponse({ success: true, sync_id: syncId });
}

// ────────────────────────────────────────────────────────────
//  handleBulkAdd — insère des lignes envoyées par Excel
//  Déduplique par sync_id (colonne P = index 15)
//
//  Format attendu pour chaque ligne de payload.rows :
//  {
//    sync_id, horodatage, date, type, km, litres, prix,
//    prixS98, station, vehicule,
//    stationPrices: { E85, SP98, SP95, E10, GAZOLE, GPLC }
//  }
//
//  Réponse : { success: true, added: N, skipped: M }
// ────────────────────────────────────────────────────────────
function handleBulkAdd(ss, rows) {
  const sheet = getOrCreateSheet(ss);
  const data  = sheet.getDataRange().getValues();

  // Index des sync_id existants (colonne P = index 15)
  const existingIds = new Set(
    data.slice(1).map(r => r[15]).filter(id => id !== '' && id !== null && id !== undefined)
  );

  let added = 0;
  rows.forEach(row => {
    // Ignorer si sync_id absent ou déjà présent
    if (!row.sync_id || existingIds.has(row.sync_id)) return;

    const sp = row.stationPrices || {};
    sheet.appendRow([
      row.horodatage ? new Date(row.horodatage) : new Date(), // A
      new Date(row.date),                                      // B
      row.type       || '',                                    // C
      Number(row.km)     || 0,                                 // D
      Number(row.litres) || 0,                                 // E
      Number(row.prix)   || 0,                                 // F
      row.prixS98 ? Number(row.prixS98) : '',                  // G
      row.station    || '',                                    // H
      row.vehicule   || '',                                    // I
      sp.E85    ? Number(sp.E85)    : '',                      // J
      sp.SP98   ? Number(sp.SP98)   : '',                      // K
      sp.SP95   ? Number(sp.SP95)   : '',                      // L
      sp.E10    ? Number(sp.E10)    : '',                      // M
      sp.GAZOLE ? Number(sp.GAZOLE) : '',                      // N
      sp.GPLC   ? Number(sp.GPLC)   : '',                      // O
      row.sync_id,                                             // P
    ]);

    existingIds.add(row.sync_id);
    added++;
  });

  return jsonResponse({ success: true, added, skipped: rows.length - added });
}

// ────────────────────────────────────────────────────────────
//  migrateSyncId — À exécuter UNE SEULE FOIS manuellement
//  Ajoute l'en-tête 'sync_id' en colonne P et génère un UUID
//  pour toutes les lignes existantes qui n'en ont pas encore.
// ────────────────────────────────────────────────────────────
function migrateSyncId() {
  const ss    = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet = getOrCreateSheet(ss);
  const last  = sheet.getLastRow();

  // En-tête colonne P
  const headerCell = sheet.getRange(1, 16);
  if (!headerCell.getValue()) {
    headerCell.setValue('sync_id');
    headerCell.setFontWeight('bold')
      .setBackground('#1B3A5C')
      .setFontColor('#FFFFFF')
      .setHorizontalAlignment('center');
    sheet.setColumnWidth(16, 260);
  }

  // Génère les UUID manquants ligne par ligne
  let count = 0;
  for (let i = 2; i <= last; i++) {
    const cell = sheet.getRange(i, 16);
    if (!cell.getValue()) {
      cell.setValue(Utilities.getUuid());
      count++;
    }
  }

  Logger.log(`✅ migrateSyncId — ${count} UUID générés sur ${last - 1} lignes.`);
}

// ────────────────────────────────────────────────────────────
//  migrateHeaders — À exécuter UNE SEULE FOIS manuellement
//  Met à jour la ligne 1 de _ImportGS vers 16 colonnes A→P
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
  [9, 10, 11, 12, 13, 14, 15].forEach(col => sheet.setColumnWidth(col, 110));
  sheet.setColumnWidth(16, 260); // P — sync_id

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
