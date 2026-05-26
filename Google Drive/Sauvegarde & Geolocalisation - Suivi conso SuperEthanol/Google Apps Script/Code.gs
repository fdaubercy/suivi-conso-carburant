// ============================================================
//  SUIVI CONSO E85 — Web App Backend                v2.9.0.0
//
//  ⚠️  BREAKING CHANGE v2.3.0.0 : suppression colonne G "Prix S98 jour"
//  La colonne K "SP98 station (€/L)" est désormais la seule source SP98.
//  → exécuter migrateRemoveS98() une fois pour migrer les données.
//
//  W17 — Scan ticket de caisse :
//  Configurer la clé Gemini dans : Extensions → Apps Script
//  → Paramètres du projet → Propriétés de script → GEMINI_API_KEY
//
//  v2.9.0.0 — Sync bidirectionnel complet (Excel ↔ GS)
//  Nouveau : action=bulkUpdate — upsert par sync_id depuis Excel VBA
//    • Ligne trouvée par sync_id → MAJ cols B–N (préserve col A horodatage)
//    • Ligne absente du GS      → ajout (upsert)
//    • Retourne { status:'ok', updated:N, added:M }
// ============================================================
const SPREADSHEET_ID  = '1uN170kt_n45sBRwqs2krTYfhapU3dMKjTguD-qSUqCE';
const SHEET_NAME      = '_ImportGS';
const STATIONS_SHEET  = 'Stations';
const VEHICULES_SHEET = 'Vehicules';

const HEADERS = [
  'Horodatage', 'Date', 'Type', 'Km compteur',         // A B C D
  'Nb. Litres', 'Prix €/L', 'Station essence',         // E F G
  'Véhicule',                                           // H
  'E85 station (€/L)', 'SP98 station (€/L)',           // I J
  'SP95 station (€/L)', 'E10 station (€/L)',           // K L
  'Gazole station (€/L)', 'GPLc station (€/L)',        // M N
  'sync_id'                                             // O — identifiant unique
];

// ─────────────────────────────────────────────────────────────
//  doGet
//  • ?action=export  → JSON de tous les enregistrements (sync Excel)
//  • ?v=mobile       → page HTML mobile
//  • (aucun param)   → page HTML index
// ─────────────────────────────────────────────────────────────
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

// ─────────────────────────────────────────────────────────────
//  handleExport — retourne tous les enreg. de _ImportGS en JSON
// ─────────────────────────────────────────────────────────────
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

// ─────────────────────────────────────────────────────────────
//  doPost — dispatcher principal
// ─────────────────────────────────────────────────────────────
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

  // ── v2.9.0.0 — Sync bidir. : MAJ de lignes existantes depuis Excel ──
  if (payload.action === 'bulkUpdate') {
    return handleBulkUpdate(ss, payload.rows || []);
  }

  // ── W17 — Scan ticket de caisse via Gemini Vision ──
  if (payload.action === 'scanTicket') {
    return handleScanTicket(payload.imageBase64, payload.mimeType);
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

// ─────────────────────────────────────────────────────────────
//  handleScanTicket — W17
//  Analyse une photo de ticket de caisse via l'API Gemini Vision
// ─────────────────────────────────────────────────────────────
function handleScanTicket(imageBase64, mimeType) {
  const apiKey = PropertiesService.getScriptProperties().getProperty('GEMINI_API_KEY');

  if (!apiKey) {
    return jsonResponse({
      success: false,
      error:   'Clé GEMINI_API_KEY non configurée. ' +
               'Extensions → Apps Script → Paramètres du projet → Propriétés de script → Ajouter GEMINI_API_KEY.'
    });
  }

  const prompt =
    'Tu es un assistant spécialisé dans la lecture de tickets de caisse de stations-service françaises.\n' +
    'Analyse cette image et extrais les informations suivantes.\n' +
    'Réponds UNIQUEMENT avec un objet JSON valide (sans markdown, sans backticks, sans texte autour) :\n' +
    '{\n' +
    '  "date": "YYYY-MM-DD ou null",\n' +
    '  "km": nombre entier ou null,\n' +
    '  "litres": nombre décimal ou null,\n' +
    '  "prix_litre": nombre décimal ou null,\n' +
    '  "montant_total": nombre décimal ou null,\n' +
    '  "type_carburant": "E85|SP98|SP95|E10|Gazole|GPLc ou null",\n' +
    '  "station": "nom de la station ou null"\n' +
    '}\n' +
    'Si une information est absente ou illisible, mets null. Ne mets que le JSON.';

  const url = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=' + apiKey;

  try {
    const resp = UrlFetchApp.fetch(url, {
      method:      'post',
      contentType: 'application/json',
      muteHttpExceptions: true,
      payload: JSON.stringify({
        contents: [{
          parts: [
            { text: prompt },
            { inlineData: { mimeType: mimeType || 'image/jpeg', data: imageBase64 } }
          ]
        }],
        generationConfig: { temperature: 0.1, maxOutputTokens: 512 }
      })
    });

    const result = JSON.parse(resp.getContentText());

    if (result.error) {
      return jsonResponse({ success: false, error: result.error.message || 'Erreur API Gemini.' });
    }

    const text = (result.candidates?.[0]?.content?.parts?.[0]?.text || '').trim();

    const jsonMatch = text.match(/\{[\s\S]*?\}/);
    if (!jsonMatch) {
      return jsonResponse({ success: false, error: 'Réponse non parseable.', raw: text });
    }

    const data = JSON.parse(jsonMatch[0]);
    return jsonResponse({ success: true, data });

  } catch (err) {
    return jsonResponse({ success: false, error: err.message });
  }
}

// ─────────────────────────────────────────────────────────────
//  handleBulkAdd — insère des lignes envoyées par Excel
//  Déduplique par sync_id (col O = index 14)
// ─────────────────────────────────────────────────────────────
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

// ─────────────────────────────────────────────────────────────
//  handleBulkUpdate — v2.9.0.0
//  Propage les modifications Excel → GS (sync bidirectionnel).
//  Appelé par VBA ExportModificationsToGS (action=bulkUpdate).
//
//  Comportement par ligne :
//    • sync_id trouvé dans GS → MAJ cols B–N (préserve col A horodatage)
//    • sync_id absent du GS  → upsert (appendRow, cas bord de désync)
//
//  Retourne : { status:'ok', updated:N, added:M }
//  Le VBA efface la col P (last_modified) si status === 'ok'.
// ─────────────────────────────────────────────────────────────
function handleBulkUpdate(ss, rows) {
  if (!rows || rows.length === 0) {
    return jsonResponse({ status: 'ok', updated: 0, added: 0 });
  }

  const sheet = getOrCreateSheet(ss);
  const data  = sheet.getDataRange().getValues();

  // Construire la map sync_id → numéro de ligne dans le sheet (1-based)
  // data[0] = en-têtes, data[1] = ligne 2 du sheet, etc.
  const idToSheetRow = {};
  for (let i = 1; i < data.length; i++) {
    const sid = String(data[i][14] || '').trim();
    if (sid) idToSheetRow[sid] = i + 1;  // +1 : ligne 1 du sheet = data[0] (en-têtes)
  }

  let updated = 0;
  let added   = 0;

  rows.forEach(row => {
    if (!row.sync_id) return;

    const sp = row.stationPrices || {};

    // Valeurs cols B–O (indices 1–14 du schema, cols 2–15 du sheet)
    const colsBtoO = [
      row.date ? new Date(row.date) : '',           // B — Date
      row.type || '',                                // C — Type
      Number(row.km)     || 0,                       // D — Km compteur
      Number(row.litres) || 0,                       // E — Nb. Litres
      Number(row.prix)   || 0,                       // F — Prix €/L
      row.station   || '',                           // G — Station essence
      row.vehicule  || '',                           // H — Véhicule
      sp.E85    ? Number(sp.E85)    : '',            // I — E85 station
      sp.SP98   ? Number(sp.SP98)   : '',            // J — SP98 station
      sp.SP95   ? Number(sp.SP95)   : '',            // K — SP95 station
      sp.E10    ? Number(sp.E10)    : '',            // L — E10 station
      sp.GAZOLE ? Number(sp.GAZOLE) : '',            // M — Gazole station
      sp.GPLC   ? Number(sp.GPLC)   : '',            // N — GPLc station
      row.sync_id,                                   // O — sync_id (inchangé)
    ];

    if (idToSheetRow.hasOwnProperty(row.sync_id)) {
      // ── Ligne existante : MAJ cols B–O, col A (horodatage) preservee ──
      const sheetRow = idToSheetRow[row.sync_id];
      sheet.getRange(sheetRow, 2, 1, colsBtoO.length)
           .setValues([colsBtoO]);
      updated++;

    } else {
      // ── Ligne absente (desync edge case) : upsert ──
      sheet.appendRow([
        row.horodatage ? new Date(row.horodatage) : new Date(),  // A
        ...colsBtoO
      ]);
      idToSheetRow[row.sync_id] = sheet.getLastRow();
      added++;
    }
  });

  return jsonResponse({ status: 'ok', updated, added });
}

// ─────────────────────────────────────────────────────────────
//  migrateRemoveS98 — À exécuter UNE SEULE FOIS manuellement
// ─────────────────────────────────────────────────────────────
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

// ─────────────────────────────────────────────────────────────
//  migrateSyncId — À exécuter UNE SEULE FOIS (legacy)
// ─────────────────────────────────────────────────────────────
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

// ─────────────────────────────────────────────────────────────
//  migrateHeaders — Réécrit les 15 en-têtes A→O
// ─────────────────────────────────────────────────────────────
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

// ─────────────────────────────────────────────────────────────
//  Helpers
// ─────────────────────────────────────────────────────────────
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
