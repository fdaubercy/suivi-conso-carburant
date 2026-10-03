// ============================================================
//  SUIVI CONSO CARBURANTS — Contrôle d'intégrité _ImportGS    v5.35.0.0
//
//  GET ?action=audit — même authentification / périmètre que action=export :
//   • token APP_TOKEN (?token=, contrôlé par doGet via tokenOk_) ;
//   • identité : idToken Google (?idToken=, app web) → email du compte,
//     ou clé propriétaire (?syncSecret=, Excel/VBA) → OWNER_EMAIL,
//     ou mode souple (REQUIRE_AUTH absent) → OWNER_EMAIL ;
//   • seules les lignes du compte (_rowBelongsTo_) sont analysées. Les lignes
//     « écho d'en-tête » (sans propriétaire réel) ne sont montrées qu'au
//     propriétaire (OWNER_EMAIL).
//
//  Réponse :
//   { success, version, generatedAt, total, active,
//     counts:{ error, warn },
//     issues:[{ type, severity, sync_id, row, date, km, litres, prix, vehicule,
//               message, related:[sync_id…], relatedRows:[n° ligne…] }],
//     depenses:{ total, actives, supprimees,                  ← ajout (dépenses)
//                issues:[{ type, severity, id, vehicule, date, intitule,
//                          montant, message }] } }
//  Les champs historiques (total/active/counts/issues = PLEINS) sont inchangés ;
//  `depenses` est calculé par la fonction PURE auditDepenses_ sur l'onglet
//  « Depenses » du compte.
//
//  La détection est une fonction PURE (auditRows_) sans accès au Sheet.
//  Lecture seule : aucune correction automatique.
//
//  Dépend de (Code.gs / Auth.gs) : SPREADSHEET_ID, getOrCreateSheet,
//  ensureSyncColumns_, _rowBelongsTo_, resolveOwner_, OWNER_EMAIL,
//  unauthorizedResponse_, jsonResponse, DEPENSES_SHEET, IDX_DEP_EMAIL.
// ============================================================

var AUDIT_VERSION = '5.35.0.0';

function handleAudit(e) {
  const email = resolveOwner_(e, null);
  if (!email) return unauthorizedResponse_();

  const ss    = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet = getOrCreateSheet(ss);
  ensureSyncColumns_(sheet);
  const data  = sheet.getDataRange().getValues();
  const headers = (data[0] || []).map(String);

  let syncIdx = headers.indexOf('sync_id'); if (syncIdx < 0) syncIdx = 14;
  let typeIdx = headers.indexOf('Type');    if (typeIdx < 0) typeIdx = 2;
  let mailIdx = headers.indexOf('Email');   if (mailIdx < 0) mailIdx = 18;

  const rows = [];
  const rowNums = [];
  for (let i = 1; i < data.length; i++) {
    const r = data[i];
    const ghost = auditIsGhost_(r[syncIdx], r[typeIdx]);
    if (_rowBelongsTo_(r[mailIdx], email) || (ghost && email === OWNER_EMAIL)) {
      rows.push(r);
      rowNums.push(i + 1);   // n° de ligne Sheet (1-based, en-tête = 1)
    }
  }

  const res = auditRows_(headers, rows, new Date(), rowNums);
  res.depenses = auditDepensesDuCompte_(ss, email);
  return jsonResponse(Object.assign({ success: true, version: AUDIT_VERSION, generatedAt: new Date().toISOString() }, res));
}

// Lignes de l'onglet Depenses du compte → auditDepenses_ (lecture seule).
// Une erreur ici ne casse jamais l'audit des pleins.
function auditDepensesDuCompte_(ss, email) {
  try {
    const sh = ss.getSheetByName(DEPENSES_SHEET);
    const data = sh ? sh.getDataRange().getValues() : [];
    const rows = [];
    for (let i = 1; i < data.length; i++) {
      if (!String(data[i][0] || '').trim()) continue;
      if (_rowBelongsTo_(data[i][IDX_DEP_EMAIL], email)) rows.push(data[i]);
    }
    return auditDepenses_(rows, new Date());
  } catch (e) {
    return { total: 0, actives: 0, supprimees: 0, issues: [], error: String(e && e.message || e) };
  }
}

var DEP_SUPPR_RECENTE_MS = 30 * 86400000;   // 30 jours

// ─────────────────────────────────────────────────────────────
//  auditDepenses_ — FONCTION PURE (aucun accès Sheet / service GAS).
//   rows : lignes de l'onglet Depenses (getValues(), sans en-tête) :
//          A id · B vehicule · C date · D categorie · E intitule · F montant
//          G modifie_le · H supprime · I email
//   now  : Date de référence (règle dep_suppression_recente)
//  Retourne { total, actives, supprimees, issues:[{ type, severity, id,
//            vehicule, date, intitule, montant, message }] }.
//  Types : dep_doublon (error) · dep_date_invalide (error) ·
//          dep_montant_invalide (error) · dep_suppression_recente (warn).
// ─────────────────────────────────────────────────────────────
function auditDepenses_(rows, now) {
  const nowMs = (now instanceof Date ? now : new Date()).getTime();
  const fmtJour = d => { const p = n => (n < 10 ? '0' : '') + n; return p(d.getDate()) + '/' + p(d.getMonth() + 1) + '/' + d.getFullYear(); };
  const issues = [];
  let actives = 0, supprimees = 0;
  const recs = [];

  (rows || []).forEach(r => {
    r = r || [];
    const id = String(r[0] == null ? '' : r[0]).trim();
    if (!id) return;
    const d = auditDate_(r[2]);
    const montant = auditNum_(r[5]);
    const rec = {
      id: id,
      vehicule: String(r[1] == null ? '' : r[1]).trim(),
      dateRaw:  r[2] instanceof Date ? '' : String(r[2] == null ? '' : r[2]).trim(),
      date:     d,
      intitule: String(r[4] == null ? '' : r[4]).trim(),
      montant:  montant,
      modif:    Number(r[6]) || 0,
      supprime: Number(r[7]) ? 1 : 0,
    };
    if (rec.supprime) supprimees++; else actives++;
    recs.push(rec);
  });

  const issue = (rec, type, severity, message) => issues.push({
    type: type, severity: severity, id: rec.id, vehicule: rec.vehicule,
    date: rec.date ? auditIsoDay_(rec.date) : rec.dateRaw,
    intitule: rec.intitule, montant: isFinite(rec.montant) ? rec.montant : null,
    message: message,
  });

  const act = recs.filter(x => !x.supprime);
  act.forEach(rec => {
    if (!rec.date) issue(rec, 'dep_date_invalide', 'error',
      rec.dateRaw ? 'Date illisible : « ' + rec.dateRaw + ' ».' : 'Date manquante.');
    if (!isFinite(rec.montant) || rec.montant <= 0) issue(rec, 'dep_montant_invalide', 'error',
      'Montant nul, négatif ou non numérique sur une dépense active.');
  });

  // Doublons : même véhicule + date + intitulé + montant, ids différents, actives.
  const groups = {};
  act.forEach(rec => {
    if (!rec.date || !isFinite(rec.montant)) return;
    const key = rec.vehicule.toLowerCase() + '|' + auditIsoDay_(rec.date) + '|' +
                rec.intitule.toLowerCase() + '|' + Math.round(rec.montant * 100);
    (groups[key] = groups[key] || []).push(rec);
  });
  Object.keys(groups).forEach(key => {
    const g = groups[key].slice().sort((a, b) => (a.modif - b.modif) || (a.id < b.id ? -1 : 1));
    const ids = {};
    const uniq = g.filter(x => (ids[x.id] ? false : (ids[x.id] = true)));
    if (uniq.length < 2) return;
    uniq.slice(1).forEach(rec => issue(rec, 'dep_doublon', 'error',
      'Doublon de la dépense « ' + (uniq[0].intitule || 'sans intitulé') + ' » (même véhicule, date et montant).'));
  });

  // Suppressions récentes (< 30 jours) : restaurables depuis l'app.
  recs.filter(x => x.supprime && x.modif > 0 && nowMs - x.modif < DEP_SUPPR_RECENTE_MS && x.modif <= nowMs + 86400000)
    .sort((a, b) => b.modif - a.modif)
    .forEach(rec => issue(rec, 'dep_suppression_recente', 'warn',
      'Supprimée le ' + fmtJour(new Date(rec.modif)) + ', restaurable'));

  issues.sort((a, b) => (a.severity === 'error' ? 0 : 1) - (b.severity === 'error' ? 0 : 1));
  return { total: recs.length, actives: actives, supprimees: supprimees, issues: issues };
}

// Ligne « écho d'en-tête » : sync_id === 'sync_id' ou Type === 'Type' (insensible à la casse).
function auditIsGhost_(syncVal, typeVal) {
  return String(syncVal == null ? '' : syncVal).trim().toLowerCase() === 'sync_id' ||
         String(typeVal == null ? '' : typeVal).trim().toLowerCase() === 'type';
}

// Nombre depuis une cellule (accepte la virgule décimale) ; NaN si vide / invalide.
function auditNum_(v) {
  if (v === null || v === undefined) return NaN;
  if (typeof v === 'number') return v;
  const s = String(v).trim().replace(/\s/g, '').replace(',', '.');
  if (s === '') return NaN;
  return Number(s);
}

// Date depuis une cellule (Date, 'yyyy-mm-dd[ hh:mm:ss]', 'dd/mm/yyyy') ; null si invalide.
function auditDate_(v) {
  if (v instanceof Date) return isNaN(v.getTime()) ? null : v;
  const s = String(v == null ? '' : v).trim();
  if (!s) return null;
  let m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:\s+(\d{1,2}):(\d{2})(?::(\d{2}))?)?$/);
  if (m) {
    const d = new Date(+m[3], +m[2] - 1, +m[1], +(m[4] || 0), +(m[5] || 0), +(m[6] || 0));
    return isNaN(d.getTime()) ? null : d;
  }
  m = s.match(/^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{1,2}):(\d{2})(?::(\d{2}))?)?$/);
  if (m) {
    const d = new Date(+m[1], +m[2] - 1, +m[3], +(m[4] || 0), +(m[5] || 0), +(m[6] || 0));
    return isNaN(d.getTime()) ? null : d;
  }
  const d = new Date(s);
  return isNaN(d.getTime()) ? null : d;
}

function auditIsoDay_(d) {
  if (!d) return '';
  const p = n => (n < 10 ? '0' : '') + n;
  return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate());
}

// ─────────────────────────────────────────────────────────────
//  auditRows_ — FONCTION PURE (aucun accès Sheet / service GAS).
//   headers : tableau des libellés de la ligne 1 de _ImportGS
//   rows    : lignes de données (tableaux getValues(), sans l'en-tête)
//   now     : Date de référence (règle date_future)
//   rowNums : n° de ligne Sheet de chaque ligne (défaut : index + 2)
//  Retourne { total, active, counts:{error,warn}, issues:[…] }.
//  Les lignes supprimées (col « Supprimé » non vide) sont exclues de toutes
//  les règles, sauf l'écho d'en-tête (dont la col R contient le libellé).
// ─────────────────────────────────────────────────────────────
function auditRows_(headers, rows, now, rowNums) {
  const H = (headers || []).map(h => String(h).trim());
  const col = (name, fallback) => { const i = H.indexOf(name); return i >= 0 ? i : fallback; };
  const C = {
    horo: col('Horodatage', 0), date: col('Date', 1), type: col('Type', 2),
    km: col('Km compteur', 3), litres: col('Nb. Litres', 4), prix: col('Prix €/L', 5),
    veh: col('Véhicule', 7), sync: col('sync_id', 14), del: col('Supprimé', 17),
  };
  const nowMs = (now instanceof Date ? now : new Date()).getTime();
  const issues = [];

  // Normalisation des lignes actives. Une ligne « écho d'en-tête » porte le
  // libellé « Supprimé » dans sa col R : ce n'est PAS un tombstone → testée avant.
  const recs = [];
  let active = 0;
  (rows || []).forEach((r, i) => {
    r = r || [];
    const ghost = auditIsGhost_(r[C.sync], r[C.type]);
    if (!ghost && String(r[C.del] == null ? '' : r[C.del]).trim() !== '') return;   // supprimée → ignorée
    if (!ghost) active++;
    const d = auditDate_(r[C.date]);
    const h = auditDate_(r[C.horo]);
    const rec = {
      row:    rowNums && rowNums[i] != null ? rowNums[i] : i + 2,
      sid:    String(r[C.sync] == null ? '' : r[C.sync]).trim(),
      ghost:  ghost,
      date:   d,
      horoMs: h ? h.getTime() : (d ? d.getTime() : 0),
      km:     auditNum_(r[C.km]),
      litres: auditNum_(r[C.litres]),
      prix:   auditNum_(r[C.prix]),
      veh:    String(r[C.veh] == null ? '' : r[C.veh]).trim(),
    };
    rec.kmOk     = isFinite(rec.km) && rec.km > 0;
    rec.litresOk = isFinite(rec.litres) && rec.litres > 0;
    rec.prixOk   = isFinite(rec.prix) && rec.prix > 0;
    recs.push(rec);
  });

  const issue = (rec, type, severity, message, relatedRecs) => {
    const rel = relatedRecs || [];
    issues.push({
      type: type, severity: severity, sync_id: rec.sid, row: rec.row,
      date: auditIsoDay_(rec.date),
      km:     isFinite(rec.km) ? rec.km : null,
      litres: isFinite(rec.litres) ? rec.litres : null,
      prix:   isFinite(rec.prix) ? rec.prix : null,
      vehicule: rec.veh, message: message,
      related: rel.map(x => x.sid).filter(Boolean),
      relatedRows: rel.map(x => x.row),
    });
  };
  const byAge = (a, b) => (a.horoMs - b.horoMs) || (a.row - b.row);

  // 1. Écho d'en-tête — exclu de toutes les autres règles.
  const real = [];
  recs.forEach(rec => {
    if (rec.ghost) issue(rec, 'entete_fantome', 'error', "Ligne fantôme : écho de la ligne d'en-tête (à supprimer dans le Sheet).");
    else real.push(rec);
  });

  // 2. Champs obligatoires / sync_id / date future.
  real.forEach(rec => {
    const miss = [];
    if (!rec.kmOk) miss.push('km');
    if (!rec.litresOk) miss.push('litres');
    if (!rec.prixOk) miss.push('prix');
    if (miss.length) issue(rec, 'champ_manquant', 'error', 'Champ(s) manquant(s), nul(s) ou non numérique(s) : ' + miss.join(', ') + '.');
    if (!rec.sid) issue(rec, 'sync_id_manquant', 'warn', 'Plein sans sync_id : non synchronisable (ni modifiable ni supprimable depuis l\'app).');
    if (rec.date && rec.date.getTime() > nowMs + 86400000) issue(rec, 'date_future', 'warn', 'Date du plein dans le futur.');
  });

  // 3. Même sync_id sur plusieurs lignes actives (la plus ancienne est l'originale).
  const flagged = new Set();
  const bySid = {};
  real.forEach(rec => { if (rec.sid) (bySid[rec.sid] = bySid[rec.sid] || []).push(rec); });
  Object.keys(bySid).forEach(sid => {
    const g = bySid[sid].slice().sort(byAge);
    if (g.length < 2) return;
    g.slice(1).forEach(rec => {
      flagged.add(rec);
      issue(rec, 'dup_sync_id', 'error',
        'sync_id présent sur ' + g.length + ' lignes actives : copie en trop (original ligne ' + g[0].row + ').',
        g.filter(x => x !== rec));
    });
  });

  // 4. Même contenu (véhicule, km, litres, prix) sous des sync_id différents.
  const byContent = {};
  real.forEach(rec => {
    if (!rec.kmOk || !rec.litresOk || !rec.prixOk) return;
    const key = rec.veh.toLowerCase() + '|' + Math.round(rec.km) + '|' +
                Math.round(rec.litres * 100) + '|' + Math.round(rec.prix * 1000);
    (byContent[key] = byContent[key] || []).push(rec);
  });
  Object.keys(byContent).forEach(key => {
    const g = byContent[key].slice().sort(byAge);
    // Une seule entrée par sync_id (les copies de même sync_id relèvent de dup_sync_id).
    const seen = new Set();
    const uniq = g.filter(rec => {
      if (!rec.sid) return true;
      if (seen.has(rec.sid)) return false;
      seen.add(rec.sid);
      return true;
    });
    if (uniq.length < 2) return;
    const orig = uniq[0];
    uniq.slice(1).forEach(rec => {
      flagged.add(rec);
      issue(rec, 'dup_contenu', 'error',
        'Doublon du plein de la ligne ' + orig.row + ' (même véhicule, km, litres et prix).', [orig]);
    });
  });

  // 5. Kilométrage non croissant par véhicule (hors doublons déjà signalés).
  const byVeh = {};
  real.forEach(rec => {
    if (!rec.kmOk || flagged.has(rec)) return;
    (byVeh[rec.veh.toLowerCase()] = byVeh[rec.veh.toLowerCase()] || []).push(rec);
  });
  Object.keys(byVeh).forEach(v => {
    const g = byVeh[v].slice().sort((a, b) =>
      ((a.date ? a.date.getTime() : 0) - (b.date ? b.date.getTime() : 0)) || byAge(a, b));
    for (let i = 1; i < g.length; i++) {
      const prev = g[i - 1], rec = g[i];
      if (rec.km <= prev.km) {
        issue(rec, 'km_non_croissant', 'warn',
          'Kilométrage ' + rec.km + ' km ≤ plein précédent (' + prev.km + ' km, ligne ' + prev.row + ').', [prev]);
      }
    }
  });

  issues.sort((a, b) =>
    ((a.severity === 'error' ? 0 : 1) - (b.severity === 'error' ? 0 : 1)) || (a.row - b.row));

  return {
    total: (rows || []).length,
    active: active,
    counts: {
      error: issues.filter(x => x.severity === 'error').length,
      warn:  issues.filter(x => x.severity === 'warn').length,
    },
    issues: issues,
  };
}
