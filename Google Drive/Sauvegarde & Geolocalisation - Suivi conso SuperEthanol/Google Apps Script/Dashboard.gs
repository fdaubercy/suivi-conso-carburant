/**
 * Dashboard.gs — G3/G4 : onglet « Tableau de bord » natif Google Sheets.
 *
 * Construit un onglet de consultation (dépense mensuelle, CO2 évité, conso
 * L/100 km, prix moyen par carburant, budget vs objectif, KPIs) avec des
 * graphiques Google Sheets natifs, pour consulter le bilan sur mobile/web sans
 * ouvrir le classeur Excel. Additif : ne touche jamais les données sources
 * (_ImportGS). Réutilise les helpers globaux de Code.gs (statsFuelKey_,
 * statsParseDate_, statsMonthKey_, statsComputeSurconso_, readParamsMap_,
 * _rowBelongsTo_) et les constantes CO2.
 *
 * G4 :
 *   - Filtrage par email (U7) — le bilan n'agrège plus TOUS les comptes mais
 *     seulement les pleins du propriétaire (repli OWNER_EMAIL).
 *   - Graphiques additionnels : prix moyen par carburant, conso L/100 km,
 *     budget vs dépense mensuelle.
 *   - Rafraîchissement : menu onOpen « ⛽ Bilan → Rafraîchir » + déclencheur
 *     quotidien optionnel (installerTriggerDashboard).
 *
 * Déclenché via GET ?action=buildDashboard&token=APP_TOKEN[&idToken=…] (voir
 * doGet, qui résout le propriétaire), ou manuellement depuis l'éditeur.
 */

var DASH_SHEET_GS = 'Tableau de bord';

/**
 * Construit / rafraîchit l'onglet bilan pour UN compte.
 * @param {string=} emailArg  email du compte à agréger (défaut OWNER_EMAIL).
 */
function construireDashboard(emailArg) {
  var email = String(emailArg || '').trim().toLowerCase() || OWNER_EMAIL;

  var ss  = SpreadsheetApp.openById(SPREADSHEET_ID);
  var src = ss.getSheetByName(SHEET_NAME);            // _ImportGS
  if (!src) return { ok: false, error: 'Onglet source _ImportGS introuvable' };

  var data = src.getDataRange().getValues();
  if (data.length <= 1) return { ok: false, error: 'Aucune donnée à agréger' };

  var headers = data[0].map(String);
  var idx = function (n) { return headers.indexOf(n); };
  var iDate = idx('Date'), iType = idx('Type'), iKm = idx('Km compteur'),
      iLit = idx('Nb. Litres'), iPrix = idx('Prix €/L'),
      iCout = idx('Coût €'), iSupp = idx('Supprimé'), iEmail = idx('Email');

  // Normalisation (exclut soft-delete + filtre le compte propriétaire — G4/U7)
  var recs = [];
  for (var r = 1; r < data.length; r++) {
    var row = data[r];
    if (iSupp >= 0 && String(row[iSupp] || '').trim() !== '') continue;
    if (iEmail >= 0 && !_rowBelongsTo_(row[iEmail], email)) continue;   // G4 — pleins du compte
    var d = statsParseDate_(iDate >= 0 ? row[iDate] : '');
    if (!d) continue;
    var lit  = Number(iLit  >= 0 ? row[iLit]  : 0) || 0;
    var prix = Number(iPrix >= 0 ? row[iPrix] : 0) || 0;
    var cout = (iCout >= 0 && Number(row[iCout]) > 0) ? Number(row[iCout]) : lit * prix;
    recs.push({
      date: d,
      fuel: statsFuelKey_(iType >= 0 ? row[iType] : ''),
      km: Number(iKm >= 0 ? row[iKm] : 0) || 0,
      litres: lit,
      prix: prix,
      cost: cout
    });
  }
  if (!recs.length) return { ok: false, error: 'Aucun plein daté exploitable pour ' + email };

  var surconso = statsComputeSurconso_(recs);

  // Agrégats mensuels : dépense + CO2 évité (E85) + litres
  var months = {}, order = [];
  recs.forEach(function (x) {
    var k = statsMonthKey_(x.date);
    if (!months[k]) { months[k] = { cost: 0, co2: 0, litres: 0 }; order.push(k); }
    months[k].cost += x.cost;
    months[k].litres += x.litres;
    if (x.fuel === 'E85' && x.litres > 0) {
      months[k].co2 += (x.litres / (1 + surconso)) * CO2_ESSENCE_PER_L_GS - x.litres * CO2_E85_PER_L_GS;
    }
  });
  order.sort();

  // Conso L/100 km par mois (méthode full-to-full : Δkm entre pleins consécutifs)
  var consoMonth = dashConsoParMois_(recs);

  // Prix moyen par carburant (€/L) sur tous les pleins du compte
  var prixFuel = dashPrixMoyenParCarburant_(recs);

  // Budget mensuel (Parametres du compte) → ligne cible
  var budget = dashLireParam_(ss, email, 'budget_mensuel');

  // KPIs de l'année la plus récente
  var anneeMax = 0;
  recs.forEach(function (x) { if (x.date.getFullYear() > anneeMax) anneeMax = x.date.getFullYear(); });
  var yr = recs.filter(function (x) { return x.date.getFullYear() === anneeMax; });
  var litresY = 0, costY = 0;
  yr.forEach(function (x) { litresY += x.litres; costY += x.cost; });

  // ── (Re)création de l'onglet ────────────────────────────────
  var sh = ss.getSheetByName(DASH_SHEET_GS);
  if (!sh) sh = ss.insertSheet(DASH_SHEET_GS);
  sh.getCharts().forEach(function (c) { sh.removeChart(c); });
  sh.clear();

  var eu = '€';
  sh.getRange('A1').setValue('Bilan carburant — ' + email + ' — mis à jour le ' +
    Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'dd/MM/yyyy HH:mm'))
    .setFontWeight('bold').setFontSize(13);

  // Bloc données mensuelles (A3:E…) : Mois | Dépense | CO2 évité | Conso | Budget
  var hasBudget = (budget !== null && budget > 0);
  sh.getRange('A3:E3').setValues([['Mois', 'Dépense (' + eu + ')', 'CO2 évité (kg)',
    'Conso (L/100km)', 'Budget (' + eu + ')']]).setFontWeight('bold');
  var rows = order.map(function (k) {
    var parts = k.split('-');
    return [
      new Date(Number(parts[0]), Number(parts[1]) - 1, 1),
      Math.round(months[k].cost * 100) / 100,
      Math.round(months[k].co2 * 10) / 10,
      consoMonth[k] ? Math.round(consoMonth[k] * 10) / 10 : '',
      hasBudget ? budget : ''
    ];
  });
  var lastRow = 3;
  if (rows.length) {
    sh.getRange(4, 1, rows.length, 5).setValues(rows);
    sh.getRange(4, 1, rows.length, 1).setNumberFormat('mm/yyyy');
    lastRow = 3 + rows.length;
  }

  // Bloc KPIs (G3:H…)
  sh.getRange('G3:H3').setValues([['Indicateur', 'Valeur']]).setFontWeight('bold');
  sh.getRange('G4:H7').setValues([
    ['Année', anneeMax],
    ['Pleins', yr.length],
    ['Litres', Math.round(litresY * 10) / 10],
    [eu + ' dépensés (' + anneeMax + ')', Math.round(costY)]
  ]);

  // Bloc prix moyen par carburant (G9:H…)
  var prixKeys = Object.keys(prixFuel);
  var prixLastRow = 8;
  if (prixKeys.length) {
    sh.getRange('G9:H9').setValues([['Carburant', 'Prix moyen (' + eu + '/L)']]).setFontWeight('bold');
    var prixRows = prixKeys.map(function (fk) { return [fk, Math.round(prixFuel[fk] * 1000) / 1000]; });
    sh.getRange(10, 7, prixRows.length, 2).setValues(prixRows);
    prixLastRow = 9 + prixRows.length;
  }

  // ── Graphiques natifs ───────────────────────────────────────
  var nCharts = 0;
  var chartTop = lastRow + 2;
  if (rows.length) {
    var moisRange = sh.getRange(3, 1, rows.length + 1, 1);   // A — catégories
    var costRange = sh.getRange(3, 2, rows.length + 1, 1);   // B — dépense
    var co2Range  = sh.getRange(3, 3, rows.length + 1, 1);   // C — CO2
    var consRange = sh.getRange(3, 4, rows.length + 1, 1);   // D — conso
    var budRange  = sh.getRange(3, 5, rows.length + 1, 1);   // E — budget

    sh.insertChart(sh.newChart().asColumnChart()
      .addRange(moisRange).addRange(costRange).setNumHeaders(1)
      .setPosition(chartTop, 1, 0, 0)
      .setOption('title', 'Dépense mensuelle (' + eu + ')')
      .setOption('legend', { position: 'none' }).build());
    nCharts++;

    sh.insertChart(sh.newChart().asLineChart()
      .addRange(moisRange).addRange(co2Range).setNumHeaders(1)
      .setPosition(chartTop, 6, 0, 0)
      .setOption('title', 'CO2 évité par mois (kg)')
      .setOption('legend', { position: 'none' }).build());
    nCharts++;

    sh.insertChart(sh.newChart().asLineChart()
      .addRange(moisRange).addRange(consRange).setNumHeaders(1)
      .setPosition(chartTop + 18, 1, 0, 0)
      .setOption('title', 'Consommation (L/100 km)')
      .setOption('legend', { position: 'none' }).build());
    nCharts++;

    if (hasBudget) {
      sh.insertChart(sh.newChart().asColumnChart()
        .addRange(moisRange).addRange(costRange).addRange(budRange).setNumHeaders(1)
        .setPosition(chartTop + 18, 6, 0, 0)
        .setOption('title', 'Budget vs dépense mensuelle (' + eu + ')')
        .setOption('series', { 1: { type: 'line', color: '#C0392B' } })
        .build());
      nCharts++;
    }
  }
  if (prixKeys.length) {
    sh.insertChart(sh.newChart().asBarChart()
      .addRange(sh.getRange(9, 7, prixKeys.length + 1, 1))
      .addRange(sh.getRange(9, 8, prixKeys.length + 1, 1)).setNumHeaders(1)
      .setPosition(chartTop + 36, 1, 0, 0)
      .setOption('title', 'Prix moyen par carburant (' + eu + '/L)')
      .setOption('legend', { position: 'none' }).build());
    nCharts++;
  }

  // Onglet en tête pour la consultation
  try { ss.setActiveSheet(sh); ss.moveActiveSheet(1); } catch (e) {}

  return {
    ok: true,
    tab: DASH_SHEET_GS,
    email: email,
    months: order.length,
    charts: nCharts,
    budget: hasBudget ? budget : null,
    surconso: Math.round(surconso * 1000) / 1000,
    generatedAt: new Date().toISOString()
  };
}

// Conso L/100 km moyenne par mois (full-to-full : Δkm entre pleins consécutifs
// > 0, rattachée au mois du plein d'arrivée). { 'YYYY-MM': litres/dist*100 }.
function dashConsoParMois_(recs) {
  var sorted = recs.filter(function (r) { return r.km > 0; })
    .sort(function (a, b) { return a.date.getTime() - b.date.getTime(); });
  var acc = {};   // monthKey -> { lit, dist }
  for (var i = 1; i < sorted.length; i++) {
    var dk  = sorted[i].km - sorted[i - 1].km;
    var lit = sorted[i].litres;
    if (dk <= 0 || lit <= 0) continue;
    var k = statsMonthKey_(sorted[i].date);
    if (!acc[k]) acc[k] = { lit: 0, dist: 0 };
    acc[k].lit += lit; acc[k].dist += dk;
  }
  var out = {};
  Object.keys(acc).forEach(function (k) {
    if (acc[k].dist > 0) out[k] = acc[k].lit / acc[k].dist * 100;
  });
  return out;
}

// Prix moyen (€/L) par carburant, dans l'ordre de première apparition.
function dashPrixMoyenParCarburant_(recs) {
  var acc = {}, order = [];
  recs.forEach(function (x) {
    if (!(x.prix > 0)) return;
    var fk = x.fuel || 'AUTRE';
    if (!acc[fk]) { acc[fk] = { sum: 0, n: 0 }; order.push(fk); }
    acc[fk].sum += x.prix; acc[fk].n++;
  });
  var out = {};
  order.forEach(function (fk) { if (acc[fk].n) out[fk] = acc[fk].sum / acc[fk].n; });
  return out;
}

// Lit une valeur numérique de l'onglet Parametres pour un compte (repli null).
function dashLireParam_(ss, email, cle) {
  var sh = ss.getSheetByName(PARAMS_SHEET);
  if (!sh) return null;
  var map = readParamsMap_(sh, email);
  if (!map[cle]) return null;
  var v = Number(map[cle].valeur);
  return isFinite(v) ? v : null;
}

// ── Rafraîchissement : menu + déclencheur quotidien (G4) ──────

// Menu à l'ouverture du classeur : « ⛽ Bilan → Rafraîchir le bilan ».
function onOpen() {
  try {
    SpreadsheetApp.getUi()
      .createMenu('⛽ Bilan')
      .addItem('Rafraîchir le bilan', 'rafraichirBilanMenu')
      .addToUi();
  } catch (e) {}
}

// Action de menu : reconstruit le bilan du propriétaire et signale via toast.
function rafraichirBilanMenu() {
  var res = construireDashboard(OWNER_EMAIL);
  try {
    SpreadsheetApp.getActiveSpreadsheet().toast(
      res.ok ? (res.months + ' mois · ' + res.charts + ' graphiques') : ('Échec : ' + res.error),
      res.ok ? '✅ Bilan à jour' : '⚠️ Bilan', 6);
  } catch (e) {}
  return res;
}

// Handler du déclencheur quotidien (time-based, propriétaire).
function rafraichirBilanQuotidien() { return construireDashboard(OWNER_EMAIL); }

// Installe un déclencheur quotidien (~6 h) de rafraîchissement. Idempotent.
function installerTriggerDashboard() {
  ScriptApp.getProjectTriggers().forEach(function (t) {
    if (t.getHandlerFunction() === 'rafraichirBilanQuotidien') ScriptApp.deleteTrigger(t);
  });
  ScriptApp.newTrigger('rafraichirBilanQuotidien').timeBased().everyDays(1).atHour(6).create();
  return { ok: true };
}

// Retire le déclencheur quotidien de rafraîchissement.
function supprimerTriggerDashboard() {
  ScriptApp.getProjectTriggers().forEach(function (t) {
    if (t.getHandlerFunction() === 'rafraichirBilanQuotidien') ScriptApp.deleteTrigger(t);
  });
  return { ok: true };
}
