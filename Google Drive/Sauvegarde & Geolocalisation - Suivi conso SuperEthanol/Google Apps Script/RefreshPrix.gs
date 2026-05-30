// ============================================================
//  SUIVI CONSO CARBURANTS — Refresh quotidien des prix    v3.4.0.0
//  Roadmap S8
//
//  Trigger temporel (1×/jour) qui parcourt l'onglet "Stations",
//  fetch le prix E85 actuel via l'API gouv (data.economie.gouv.fr)
//  pour la ville de chaque station, et logue chaque résultat dans
//  un onglet "_PrixHistory" (Station, Date, Type, Prix €/L).
//
//  Couplé S8 : si un prix E85 <= seuil est détecté, on mémorise le
//  meilleur prix (LAST_LOW_PRICE) et on envoie une Web Push (VAPID)
//  via envoyerPushPrixBas() — voir WebPush.gs — même app fermée.
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

// Seuil par défaut (€/L) pour déclencher une push « prix E85 bas ».
// Surchargé par la propriété de script SEUIL_PUSH_E85 si présente.
const SEUIL_PUSH_E85_DEFAULT = 0.700;

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
//  Handler du trigger : refresh des prix E85 + log + push éventuelle.
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

  let bestPrix = Infinity, bestStation = '';
  const rows = [];

  names.forEach(name => {
    const ville = villeFromStationName_(name);
    if (!ville) return;
    const prix = fetchE85PriceForVille_(ville);
    if (prix == null) return;
    rows.push([name, today, 'E85', prix]);
    if (prix < bestPrix) { bestPrix = prix; bestStation = name; }
    Utilities.sleep(300);   // courtoisie envers l'API publique
  });

  if (rows.length) {
    hist.getRange(hist.getLastRow() + 1, 1, rows.length, 4).setValues(rows);
  }
  Logger.log('Refresh : ' + rows.length + ' prix loggés. Min E85 = ' +
    (isFinite(bestPrix) ? bestPrix.toFixed(3) + ' (' + bestStation + ')' : 'n/d'));

  // ── S8/S10 — mémorisation du prix mini + push filtrée PAR ABONNÉ ──
  // On mémorise toujours le meilleur prix (le Service Worker le lit via
  // ?action=lowprice). L'envoi est ensuite filtré par le seuil propre à
  // chaque abonné (colonne Seuil de _PushSubs), repli sur SEUIL_PUSH_E85.
  if (isFinite(bestPrix) && bestPrix > 0) {
    PropertiesService.getScriptProperties().setProperty('LAST_LOW_PRICE',
      JSON.stringify({ station: bestStation, prix: bestPrix, date: today }));

    if (typeof envoyerPushPrixBas === 'function') {
      envoyerPushPrixBas(bestStation, bestPrix);   // chaque abonné notifié selon SON seuil
    } else {
      Logger.log('WebPush.gs absent — push non envoyée.');
    }
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
//  Prix E85 le plus bas dans une ville via l'API gouv (ou null).
// ─────────────────────────────────────────────────────────────
function fetchE85PriceForVille_(ville) {
  try {
    const where = 'e85_prix is not null and ville like "' + ville.replace(/"/g, '') + '%"';
    const url = PRIX_API_URL +
      '?where='    + encodeURIComponent(where) +
      '&select='   + encodeURIComponent('e85_prix') +
      '&order_by=' + encodeURIComponent('e85_prix asc') +
      '&limit=1';
    const resp = UrlFetchApp.fetch(url, { muteHttpExceptions: true });
    if (resp.getResponseCode() !== 200) return null;
    const data = JSON.parse(resp.getContentText());
    const rec  = data.results && data.results[0];
    if (!rec || rec.e85_prix == null) return null;
    const prix = Number(rec.e85_prix);
    return isFinite(prix) && prix > 0 ? prix : null;
  } catch (e) {
    Logger.log('fetchE85PriceForVille_ (' + ville + ') : ' + e.message);
    return null;
  }
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
