// ============================================================
//  SUIVI CONSO CARBURANTS — Dépenses d'entretien par véhicule (W91)
//
//  Onglet « Depenses » — une ligne par dépense :
//    A id · B vehicule · C date · D categorie · E intitule · F montant
//    G modifie_le · H supprime · I email
//  Synchro = last-write-wins par `id` sur modifie_le (epoch ms).
//  Tombstone `supprime` = 1 pour propager les suppressions (le montant est
//  conservé par l'app sur la tombstone → restauration sans perte).
//
//  Dates : la colonne C est stockée en TEXTE 'yyyy-MM-dd' (format '@').
//  Une cellule convertie en Date par le Sheet (anciennes lignes) était
//  sérialisée en ISO UTC (« 2026-09-04T22:00:00.000Z ») → décalage d'un jour.
//  Elle est désormais lue dans le fuseau du classeur (Europe/Paris) puis
//  réécrite en texte, de façon idempotente (repairDepenseDates_).
//
//  Journal APPEND-ONLY « Depenses_journal » :
//    horodatage | email | id | action | source | avant | apres
//  action ∈ creation | mise_a_jour | suppression | restauration | ignore_ancien
//  source = payload.source (app : 'app') ou 'inconnu'. Aucune ligne du journal
//  n'est jamais supprimée ni réécrite (garde statique : tests/gasGarde.test.js).
//
//  Dépend de (Code.gs) : SPREADSHEET_ID, DEPENSES_SHEET, DEP_HEADERS,
//  IDX_DEP_EMAIL, _rowBelongsTo_, jsonResponse.
// ============================================================

var DEP_JOURNAL_SHEET   = 'Depenses_journal';
var DEP_JOURNAL_HEADERS = ['horodatage', 'email', 'id', 'action', 'source', 'avant', 'apres'];
var IDX_DEP_DATE        = 2;   // 0-based (colonne C)

function getOrCreateDepensesSheet_(ss) {
  let sheet = ss.getSheetByName(DEPENSES_SHEET);
  if (!sheet) sheet = ss.insertSheet(DEPENSES_SHEET);
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(DEP_HEADERS);
    sheet.getRange(1, 1, 1, DEP_HEADERS.length)
      .setFontWeight('bold')
      .setBackground('#1B3A5C')
      .setFontColor('#FFFFFF');
    sheet.setFrozenRows(1);
  }
  return sheet;
}

function getOrCreateDepensesJournal_(ss) {
  let sheet = ss.getSheetByName(DEP_JOURNAL_SHEET);
  if (!sheet) sheet = ss.insertSheet(DEP_JOURNAL_SHEET);
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(DEP_JOURNAL_HEADERS);
    sheet.getRange(1, 1, 1, DEP_JOURNAL_HEADERS.length)
      .setFontWeight('bold')
      .setBackground('#1B3A5C')
      .setFontColor('#FFFFFF');
    sheet.setFrozenRows(1);
  }
  return sheet;
}

// Date de dépense → 'yyyy-MM-dd' dans le fuseau `tz` (celui du classeur).
//   Date                       → jour dans tz
//   '2026-09-05'               → inchangée
//   '2026-09-04T22:00:00.000Z' → '2026-09-05' (Europe/Paris)
//   '05/09/2026'               → '2026-09-05'
// Vide → '' ; illisible → renvoyée telle quelle (jamais perdue).
function depDateIso_(v, tz) {
  if (v === null || v === undefined || v === '') return '';
  if (v instanceof Date) return isNaN(v.getTime()) ? '' : Utilities.formatDate(v, tz, 'yyyy-MM-dd');
  const s = String(v).trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  const fr = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (fr) return fr[3] + '-' + ('0' + fr[2]).slice(-2) + '-' + ('0' + fr[1]).slice(-2);
  if (/^\d{4}-\d{2}-\d{2}T/.test(s)) {
    const d = new Date(s);
    if (!isNaN(d.getTime())) return Utilities.formatDate(d, tz, 'yyyy-MM-dd');
  }
  return s;
}

function depTz_(ss) {
  try { return ss.getSpreadsheetTimeZone() || Session.getScriptTimeZone(); }
  catch (e) { return Session.getScriptTimeZone(); }
}

// Lit l'onglet Depenses → { id: { row, ... } } pour UN compte (date normalisée).
function readDepensesMap_(sheet, email, tz) {
  const data = sheet.getDataRange().getValues();
  const zone = tz || Session.getScriptTimeZone();
  const map  = {};
  for (let i = 1; i < data.length; i++) {
    const id = String(data[i][0] || '').trim();
    if (!id) continue;
    if (!_rowBelongsTo_(data[i][IDX_DEP_EMAIL], email)) continue;
    const raw = data[i][IDX_DEP_DATE];
    const iso = depDateIso_(raw, zone);
    map[id] = {
      row:        i + 1,
      vehicule:   data[i][1],
      date:       iso,
      dateBrute:  !(typeof raw === 'string' && raw === iso),   // à réécrire en texte
      categorie:  data[i][3],
      intitule:   data[i][4],
      montant:    data[i][5],
      modifie_le: Number(data[i][6]) || 0,
      supprime:   Number(data[i][7]) || 0,
    };
  }
  return map;
}

// Réécrit en TEXTE 'yyyy-MM-dd' les dates stockées en Date / ISO UTC (idempotent).
function repairDepenseDates_(sheet, map) {
  let n = 0;
  Object.keys(map).forEach(function (id) {
    const r = map[id];
    if (!r.dateBrute || !/^\d{4}-\d{2}-\d{2}$/.test(r.date)) return;
    sheet.getRange(r.row, IDX_DEP_DATE + 1).setNumberFormat('@').setValue(r.date);
    r.dateBrute = false;
    n++;
  });
  return n;
}

function _depenseToObj_(id, r) {
  return {
    id: id, vehicule: r.vehicule, date: r.date, categorie: r.categorie,
    intitule: r.intitule, montant: r.montant, modifie_le: r.modifie_le, supprime: r.supprime,
  };
}

// Action du journal pour un passage avant → apres ('' = aucun changement métier).
function depJournalAction_(avant, apres) {
  if (!avant) return 'creation';
  const sa = Number(avant.supprime) ? 1 : 0, sp = Number(apres.supprime) ? 1 : 0;
  if (sa === 0 && sp === 1) return 'suppression';
  if (sa === 1 && sp === 0) return 'restauration';
  const champs = ['vehicule', 'date', 'categorie', 'intitule'];
  for (let i = 0; i < champs.length; i++) {
    if (String(avant[champs[i]] == null ? '' : avant[champs[i]]) !== String(apres[champs[i]] == null ? '' : apres[champs[i]])) return 'mise_a_jour';
  }
  if ((Number(avant.montant) || 0) !== (Number(apres.montant) || 0)) return 'mise_a_jour';
  return '';
}

function handleGetDepenses(email) {
  const ss    = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet = getOrCreateDepensesSheet_(ss);
  const map   = readDepensesMap_(sheet, email, depTz_(ss));
  try { repairDepenseDates_(sheet, map); } catch (e) { Logger.log('repairDepenseDates_ : ' + e.message); }
  const depenses = Object.keys(map).map(id => _depenseToObj_(id, map[id]));
  return jsonResponse({ depenses: depenses });
}

// Upsert LWW par `id` + journal append-only. AUCUNE suppression de ligne :
// une dépense supprimée est une tombstone (supprime = 1).
function handleSetDepenses(ss, incoming, email, source) {
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(10000);
  } catch (lockErr) {
    return jsonResponse({ success: false, error: 'Serveur occupé, réessayez dans un instant.' });
  }
  try {
    const tz      = depTz_(ss);
    const sheet   = getOrCreateDepensesSheet_(ss);
    const map     = readDepensesMap_(sheet, email, tz);
    const src     = String(source || '').trim() || 'inconnu';
    const now     = new Date();
    const journal = [];
    const log = (id, action, avant, apres) => journal.push([
      now, email, id, action, src,
      avant ? JSON.stringify(_depenseToObj_(id, avant)) : '',
      apres ? JSON.stringify(_depenseToObj_(id, apres)) : '',
    ]);
    repairDepenseDates_(sheet, map);

    (incoming || []).forEach(function (d) {
      const id = String(d && d.id || '').trim();
      if (!id) return;
      const ts  = Number(d.modifie_le) || 0;
      const row = [
        id, d.vehicule || '', depDateIso_(d.date, tz), d.categorie || '',
        d.intitule || '', Number(d.montant) || 0, ts, Number(d.supprime) ? 1 : 0, email,
      ];
      const apres = {
        vehicule: row[1], date: row[2], categorie: row[3], intitule: row[4],
        montant: row[5], modifie_le: ts, supprime: row[7],
      };
      const cur = map[id];
      if (cur) {
        if (ts < cur.modifie_le) { log(id, 'ignore_ancien', cur, apres); return; }
        const action = depJournalAction_(cur, apres);
        if (!action && ts === cur.modifie_le) return;   // rejeu identique : rien à écrire
        sheet.getRange(cur.row, IDX_DEP_DATE + 1).setNumberFormat('@');
        sheet.getRange(cur.row, 1, 1, DEP_HEADERS.length).setValues([row]);
        if (action) log(id, action, Object.assign({}, cur), apres);
        Object.assign(cur, apres);
      } else {
        const r = sheet.getLastRow() + 1;   // sous verrou : pas de course entre requêtes
        sheet.getRange(r, IDX_DEP_DATE + 1).setNumberFormat('@');
        sheet.getRange(r, 1, 1, DEP_HEADERS.length).setValues([row]);
        map[id] = Object.assign({ row: r, dateBrute: false }, apres);
        log(id, 'creation', null, apres);
      }
    });

    if (journal.length) {
      const js = getOrCreateDepensesJournal_(ss);
      js.getRange(js.getLastRow() + 1, 1, journal.length, DEP_JOURNAL_HEADERS.length).setValues(journal);
    }

    const depenses = Object.keys(map).map(id => _depenseToObj_(id, map[id]));
    return jsonResponse({ success: true, depenses: depenses });
  } finally {
    SpreadsheetApp.flush();
    lock.releaseLock();
  }
}
