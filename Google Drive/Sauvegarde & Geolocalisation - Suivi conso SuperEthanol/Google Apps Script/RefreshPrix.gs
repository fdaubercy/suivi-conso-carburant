// ============================================================
//  SUIVI CONSO CARBURANTS — Refresh quotidien des prix    v5.11.0.0
//  v5.11.0.0 — S15 : detection d'anomalies de saisie au refresh quotidien
//  (km retrograde, conso aberrante). Email si nouvelle anomalie detectee.
//  Roadmap S8 + W38 + W48 (multi-carburant) + W49 (push multi-carburant)
//
//  v4.18.0.0 — W61 : le relevé ~7h couvre désormais 6 carburants —
//  E85, Gazole, SP98 + SP95, E10 et GPLc (nouveaux). Les 3 nouveaux sont
//  loggés dans _PrixHistory et synchronisés dans Excel ; ils ne déclenchent
//  PAS de push (aucun seuil SP95/E10/GPLc dans _PushSubs → ignorés par WebPush).
//
//  v3.10.0.0 — W48/W49 : le relevé ~7h couvrait E85, Gazole et SP98.
//  Pour chaque carburant : prix le moins cher des villes des stations curées
//  + scan 15 km autour de la dernière position connue (LAST_GEO), log dans
//  _PrixHistory (colonne Type = E85 / GAZOLE / SP98 / SP95 / E10 / GPLc),
//  mémorisation du meilleur prix du jour par carburant (SECTOR_BEST_TODAY =
//  objet par carburant) et push « prix bas » (E85/Gazole/SP98 uniquement).
//
//  L'app lit via ?action=sectorPrices&fuel=GAZOLE (defaut E85).
//
//  INSTALLATION (une seule fois) :
//    1. Coller ce fichier dans le projet Apps Script (Code.gs voisin).
//    2. Executer  installerTriggerRefreshPrix()  une fois.
//    3. Tester immediatement avec  testRefreshPrix().
//
//  Dépend des globales définies dans Code.gs :
//    SPREADSHEET_ID, STATIONS_SHEET, jsonResponse()
// ============================================================

const PRIXHIST_SHEET = '_PrixHistory';
const PUSHSUBS_SHEET = '_PushSubs';
const PRIX_API_URL =
  'https://data.economie.gouv.fr/api/explore/v2.1/catalog/datasets/' +
  'prix-des-carburants-en-france-flux-instantane-v2/records';

// W48/W61 — carburants suivis : clé interne (= colonne Type de _PrixHistory)
// ↔ champ de prix de l'API ODS. W61 ajoute SP95, E10 et GPLc.
const FUELS = [
  { key: 'E85',    field: 'e85_prix'    },
  { key: 'GAZOLE', field: 'gazole_prix' },
  { key: 'SP98',   field: 'sp98_prix'   },
  { key: 'SP95',   field: 'sp95_prix'   },
  { key: 'E10',    field: 'e10_prix'    },
  { key: 'GPLc',   field: 'gplc_prix'   },
];

// Seuils push par défaut (€/L) — repli backend uniquement. En pratique chaque
// abonné envoie ses propres seuils (colonnes Seuil* de _PushSubs).
const SEUIL_PUSH_DEFAULT = { E85: 0.700, GAZOLE: 1.600, SP98: 1.800 };
// Rétrocompat : certaines parties (WebPush.gs) référencent encore cette constante.
const SEUIL_PUSH_E85_DEFAULT = SEUIL_PUSH_DEFAULT.E85;

// ─────────────────────────────────────────────────────────────
//  Installer le déclencheur quotidien (~7h). Idempotent.
// ─────────────────────────────────────────────────────────────
function installerTriggerRefreshPrix() {
  ScriptApp.getProjectTriggers().forEach(t => {
    if (t.getHandlerFunction() === 'refreshPrixCarburants') ScriptApp.deleteTrigger(t);
  });
  ScriptApp.newTrigger('refreshPrixCarburants')
    .timeBased()
    .everyDays(1)
    .atHour(7)
    .create();
  Logger.log('Trigger refresh quotidien installé (tous les jours ~7h).');
}

// Retire le déclencheur quotidien.
function supprimerTriggerRefreshPrix() {
  ScriptApp.getProjectTriggers().forEach(t => {
    if (t.getHandlerFunction() === 'refreshPrixCarburants') ScriptApp.deleteTrigger(t);
  });
  Logger.log('Trigger refresh quotidien supprimé.');
}

// Test manuel : exécute le refresh immédiatement.
function testRefreshPrix() {
  refreshPrixCarburants();
}

// ─────────────────────────────────────────────────────────────
//  Handler du trigger : refresh des prix (E85/Gazole/SP98) + log
//  _PrixHistory + mémorisation du meilleur prix du jour par carburant
//  + push éventuelle par carburant.
// ─────────────────────────────────────────────────────────────
function refreshPrixCarburants() {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const stationsSheet = ss.getSheetByName(STATIONS_SHEET);
  if (!stationsSheet) { Logger.log('Onglet "Stations" introuvable.'); return; }

  const names = stationsSheet.getDataRange().getValues()
    .map(r => String(r[0] || '').trim())
    .filter(Boolean);
  if (!names.length) { Logger.log('Aucune station à rafraîchir.'); return; }

  const hist  = getOrCreatePrixHistorySheet(ss);
  const tz    = ss.getSpreadsheetTimeZone();
  const today = Utilities.formatDate(new Date(), tz, 'yyyy-MM-dd');

  const best = {};                       // { fuelKey: { prix, station } }
  FUELS.forEach(f => best[f.key] = { prix: Infinity, station: '' });
  const rows = [];

  // ── Stations curées : 1 requête par ville (tous carburants) ──
  names.forEach(name => {
    const ville = villeFromStationName_(name);
    if (!ville) return;
    const prices = fetchPricesForVille_(ville);   // { <clé FUELS> : prix|null }
    FUELS.forEach(f => {
      const p = prices[f.key];
      if (p == null) return;
      rows.push([name, today, f.key, p]);
      if (p < best[f.key].prix) best[f.key] = { prix: p, station: name };
    });
    Utilities.sleep(300);   // courtoisie envers l'API publique
  });

  // ── W48 — scan 15 km autour de LAST_GEO (tous carburants, 1 requête) ──
  const geo = scanGeoAllFuels_(15000, 80);
  geo.forEach(g => {
    rows.push([g.name, today, g.fuel, g.prix]);
    if (g.prix < best[g.fuel].prix) best[g.fuel] = { prix: g.prix, station: g.name };
  });

  if (rows.length) {
    hist.getRange(hist.getLastRow() + 1, 1, rows.length, 4).setValues(rows);
  }
  Logger.log('Refresh : ' + rows.length + ' prix loggés (' + geo.length + ' via géo). ' +
    FUELS.map(f => f.key + '=' +
      (isFinite(best[f.key].prix) ? best[f.key].prix.toFixed(3) : 'n/d')).join('  '));

  // ── Meilleur prix du jour par carburant (lu par ?action=sectorPrices) ──
  const sectorBest = {}, lowPrices = {};
  FUELS.forEach(f => {
    if (isFinite(best[f.key].prix) && best[f.key].prix > 0) {
      const rec = { station: best[f.key].station, prix: best[f.key].prix, date: today };
      sectorBest[f.key] = rec;
      lowPrices[f.key]  = rec;
    }
  });
  const props = PropertiesService.getScriptProperties();
  props.setProperty('SECTOR_BEST_TODAY', JSON.stringify(sectorBest));
  props.setProperty('LAST_LOW_PRICES',   JSON.stringify(lowPrices));
  // Rétrocompat : anciens lecteurs E85 (?action=lowprice).
  if (lowPrices.E85) props.setProperty('LAST_LOW_PRICE', JSON.stringify(lowPrices.E85));

  // ── W49 — push par carburant (filtrée par le seuil de chaque abonné) ──
  if (typeof envoyerPushPrixBasMulti === 'function') {
    envoyerPushPrixBasMulti(sectorBest);
  } else {
    Logger.log('WebPush.gs absent — push non envoyée.');
  }

  // ── S15 — détection d'anomalies de saisie ──
  try { detecterAnomalies_(ss); } catch (e) {
    Logger.log('S15 detecterAnomalies_ erreur : ' + e.message);
  }
}

// ─────────────────────────────────────────────────────────────
//  Prix le moins cher de chaque carburant suivi dans une ville (1 requête).
//  Retourne un objet { clé FUELS : prix|null } (null si indisponible).
// ─────────────────────────────────────────────────────────────
function fetchPricesForVille_(ville) {
  const out = {};
  FUELS.forEach(f => out[f.key] = null);
  try {
    const anyNotNull = FUELS.map(f => f.field + ' is not null').join(' OR ');
    const where = '(' + anyNotNull + ') and ville like "' + ville.replace(/"/g, '') + '%"';
    const url = PRIX_API_URL +
      '?where='  + encodeURIComponent(where) +
      '&select=' + encodeURIComponent(FUELS.map(f => f.field).join(',')) +
      '&limit=50';
    const resp = UrlFetchApp.fetch(url, { muteHttpExceptions: true });
    if (resp.getResponseCode() !== 200) return out;
    const recs = (JSON.parse(resp.getContentText()).results) || [];
    recs.forEach(r => FUELS.forEach(f => {
      const p = Number(r[f.field]);
      if (isFinite(p) && p > 0 && (out[f.key] == null || p < out[f.key])) out[f.key] = p;
    }));
  } catch (e) {
    Logger.log('fetchPricesForVille_ (' + ville + ') : ' + e.message);
  }
  return out;
}

// ─────────────────────────────────────────────────────────────
//  W48 — Scan des stations dans un rayon autour de LAST_GEO, tous
//  carburants confondus, en UNE requête. Retourne une liste plate
//  [{ name:'Secteur - Ville', fuel:'E85'|'GAZOLE'|'SP98', prix }].
// ─────────────────────────────────────────────────────────────
function scanGeoAllFuels_(radiusM, limit) {
  const raw = PropertiesService.getScriptProperties().getProperty('LAST_GEO');
  if (!raw) { Logger.log('W48 : LAST_GEO absente — scan géo ignoré.'); return []; }

  let geo;
  try { geo = JSON.parse(raw); } catch (e) { return []; }
  const lat = Number(geo.lat), lon = Number(geo.lon);
  if (!isFinite(lat) || !isFinite(lon)) return [];

  try {
    const anyNotNull = FUELS.map(f => f.field + ' is not null').join(' OR ');
    const where = '(' + anyNotNull + ") and distance(geom, geom'POINT(" +
      lon + ' ' + lat + ")', " + radiusM + 'm)';
    const url = PRIX_API_URL +
      '?where='  + encodeURIComponent(where) +
      '&select=' + encodeURIComponent('adresse,ville,' + FUELS.map(f => f.field).join(',')) +
      '&limit='  + (limit || 80);
    const resp = UrlFetchApp.fetch(url, { muteHttpExceptions: true });
    if (resp.getResponseCode() !== 200) return [];
    const recs = (JSON.parse(resp.getContentText()).results) || [];
    const out = [];
    recs.forEach(r => {
      const ville = String(r.ville || '').trim();
      const adr   = String(r.adresse || '').trim();
      const name  = (ville || adr) ? ('Secteur - ' + (ville || adr)) : 'Secteur';
      FUELS.forEach(f => {
        const p = Number(r[f.field]);
        if (isFinite(p) && p > 0) out.push({ name: name, fuel: f.key, prix: p });
      });
    });
    return out;
  } catch (e) {
    Logger.log('scanGeoAllFuels_ : ' + e.message);
    return [];
  }
}

// ─────────────────────────────────────────────────────────────
//  Ville depuis un nom de station "Enseigne - Ville" → "Ville".
// ─────────────────────────────────────────────────────────────
function villeFromStationName_(name) {
  const parts = String(name).split(/\s[-–]\s/);   // " - " ou " – "
  return (parts.length > 1 ? parts[parts.length - 1] : '').trim();
}

// ─────────────────────────────────────────────────────────────
//  Onglet _PrixHistory (création + en-têtes au besoin).
// ─────────────────────────────────────────────────────────────
function getOrCreatePrixHistorySheet(ss) {
  let sh = ss.getSheetByName(PRIXHIST_SHEET);
  if (!sh) {
    sh = ss.insertSheet(PRIXHIST_SHEET);
    sh.appendRow(['Station', 'Date', 'Type', 'Prix €/L']);
    sh.getRange(1, 1, 1, 4)
      .setFontWeight('bold').setBackground('#1B3A5C').setFontColor('#FFFFFF');
    sh.setFrozenRows(1);
    sh.setColumnWidth(1, 220);
  }
  return sh;
}

// ─────────────────────────────────────────────────────────────
//  S15 — Detection d'anomalies de saisie
//
//  Seuils configurables via les proprietes de script :
//    ANOMALIE_CONSO_MIN : L/100km minimum acceptable (defaut 3)
//    ANOMALIE_CONSO_MAX : L/100km maximum acceptable (defaut 25)
//
//  Les anomalies deja signalees sont memorisees dans ANOMALIE_REPORTED
//  pour ne pas envoyer de doublons d'email.
// ─────────────────────────────────────────────────────────────
function detecterAnomalies_(ss) {
  const sheet = ss.getSheetByName(SHEET_NAME);
  if (!sheet || sheet.getLastRow() < 2) {
    Logger.log('S15 : onglet ' + SHEET_NAME + ' vide ou absent.');
    return;
  }

  const data = sheet.getDataRange().getValues();
  const headers = data[0].map(String);

  const idx = {
    km:    headers.findIndex(h => h.includes('Km compteur')),
    lit:   headers.findIndex(h => h.includes('Litres')),
    veh:   headers.findIndex(h => h.includes('ehicule')),
    del:   headers.findIndex(h => h.includes('upprim')),
    date:  headers.findIndex(h => h === 'Date'),
  };

  if (idx.km < 0 || idx.lit < 0 || idx.veh < 0) {
    Logger.log('S15 : colonnes introuvables dans ' + SHEET_NAME);
    return;
  }

  const props    = PropertiesService.getScriptProperties();
  const consoMin = Number(props.getProperty('ANOMALIE_CONSO_MIN') || '3');
  const consoMax = Number(props.getProperty('ANOMALIE_CONSO_MAX') || '25');

  let reported = {};
  try { reported = JSON.parse(props.getProperty('ANOMALIE_REPORTED') || '{}'); } catch(e) {}

  // Grouper les lignes actives par vehicule
  const byVeh = {};
  data.slice(1).forEach(row => {
    if (idx.del >= 0 && row[idx.del]) return;
    const veh = String(row[idx.veh] || '').trim();
    const km  = Number(row[idx.km]);
    const lit = Number(row[idx.lit]);
    if (!veh || !isFinite(km) || km <= 0) return;
    if (!byVeh[veh]) byVeh[veh] = [];
    byVeh[veh].push({ km, lit, date: row[idx.date] });
  });

  const nouvelles = [];

  Object.entries(byVeh).forEach(function(entry) {
    const veh     = entry[0];
    const records = entry[1];
    records.sort(function(a, b) { return a.km - b.km; });

    for (var i = 1; i < records.length; i++) {
      const prev = records[i - 1];
      const curr = records[i];
      const dKm  = curr.km - prev.km;

      // km retrograde
      if (dKm < 0) {
        const key = veh + '|retro|' + curr.km;
        if (!reported[key]) {
          nouvelles.push({ key: key, vehicule: veh,
            msg: 'km retrograde : ' + prev.km + ' -> ' + curr.km + ' km (delta ' + dKm + ' km)' });
        }
      }

      // conso aberrante
      if (dKm > 0 && curr.lit > 0) {
        const conso = (curr.lit / dKm) * 100;
        if (conso < consoMin || conso > consoMax) {
          const key = veh + '|conso|' + curr.km;
          if (!reported[key]) {
            nouvelles.push({ key: key, vehicule: veh,
              msg: 'conso aberrante : ' + conso.toFixed(1) + ' L/100km' +
                   ' (seuils : ' + consoMin + '-' + consoMax + ')' +
                   ' au plein de ' + curr.km + ' km' });
          }
        }
      }
    }
  });

  if (!nouvelles.length) {
    Logger.log('S15 : aucune nouvelle anomalie.');
    return;
  }

  // Email recapitulatif
  const dest = Session.getActiveUser().getEmail() ||
               PropertiesService.getScriptProperties().getProperty('OWNER_EMAIL') || '';
  if (dest) {
    const sujet = '[Suivi Carburant] ' + nouvelles.length + ' anomalie(s) de saisie detectee(s)';
    const corps = nouvelles.map(function(a) {
      return '- [' + a.vehicule + '] ' + a.msg;
    }).join('\n');
    MailApp.sendEmail(dest, sujet, corps);
    Logger.log('S15 : email envoye a ' + dest + ' (' + nouvelles.length + ' anomalie(s))');
  } else {
    Logger.log('S15 : ' + nouvelles.length + ' anomalie(s) detectee(s) (pas de destinataire email configure)');
    nouvelles.forEach(function(a) { Logger.log('  ' + a.vehicule + ' : ' + a.msg); });
  }

  // Memoriser les nouvelles anomalies pour ne pas re-notifier
  nouvelles.forEach(function(a) { reported[a.key] = true; });
  props.setProperty('ANOMALIE_REPORTED', JSON.stringify(reported));
}

// ─────────────────────────────────────────────────────────────
//  S15 — Trigger autonome quotidien (optionnel, en plus du refresh prix).
//  Utile si refreshPrixCarburants() ne tourne pas tous les jours.
// ─────────────────────────────────────────────────────────────
function installerTriggerAnomalies() {
  ScriptApp.getProjectTriggers().forEach(function(t) {
    if (t.getHandlerFunction() === 'triggerAnomalies') ScriptApp.deleteTrigger(t);
  });
  ScriptApp.newTrigger('triggerAnomalies').timeBased().everyDays(1).atHour(8).create();
  Logger.log('S15 : trigger anomalies installe (quotidien ~8h).');
}

function supprimerTriggerAnomalies() {
  ScriptApp.getProjectTriggers().forEach(function(t) {
    if (t.getHandlerFunction() === 'triggerAnomalies') ScriptApp.deleteTrigger(t);
  });
  Logger.log('S15 : trigger anomalies supprime.');
}

function triggerAnomalies() {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  detecterAnomalies_(ss);
}

// Test immediat : appeler manuellement depuis l'editeur GAS.
function testDetecterAnomalies() {
  triggerAnomalies();
}
