/**
 * Dashboard.gs — G3 : onglet « Tableau de bord » natif Google Sheets.
 *
 * Construit un onglet de consultation (dépense mensuelle, CO2 évité, KPIs) avec
 * des graphiques Google Sheets natifs, pour consulter le bilan sur mobile/web
 * sans ouvrir le classeur Excel. Additif : ne touche jamais les données sources
 * (_ImportGS). Réutilise les helpers globaux de Code.gs (statsFuelKey_,
 * statsParseDate_, statsMonthKey_, statsComputeSurconso_) et les constantes CO2.
 *
 * Déclenché via GET ?action=buildDashboard&token=APP_TOKEN (voir doGet), ou
 * appelable manuellement depuis l'éditeur Apps Script.
 */

var DASH_SHEET_GS = 'Tableau de bord';

function construireDashboard() {
  var ss  = SpreadsheetApp.openById(SPREADSHEET_ID);
  var src = ss.getSheetByName(SHEET_NAME);            // _ImportGS
  if (!src) return { ok: false, error: 'Onglet source _ImportGS introuvable' };

  var data = src.getDataRange().getValues();
  if (data.length <= 1) return { ok: false, error: 'Aucune donnée à agréger' };

  var headers = data[0].map(String);
  var idx = function (n) { return headers.indexOf(n); };
  var iDate = idx('Date'), iType = idx('Type'), iKm = idx('Km compteur'),
      iLit = idx('Nb. Litres'), iPrix = idx('Prix €/L'),
      iCout = idx('Coût €'), iSupp = idx('Supprimé');

  // Normalisation (exclut les lignes soft-delete)
  var recs = [];
  for (var r = 1; r < data.length; r++) {
    var row = data[r];
    if (iSupp >= 0 && String(row[iSupp] || '').trim() !== '') continue;
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
      cost: cout
    });
  }
  if (!recs.length) return { ok: false, error: 'Aucun plein daté exploitable' };

  var surconso = statsComputeSurconso_(recs);

  // Agrégats mensuels : dépense + CO2 évité (E85)
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

  // KPIs de l'année la plus récente
  var anneeMax = 0;
  recs.forEach(function (x) { if (x.date.getFullYear() > anneeMax) anneeMax = x.date.getFullYear(); });
  var yr = recs.filter(function (x) { return x.date.getFullYear() === anneeMax; });
  var litresY = 0, costY = 0;
  yr.forEach(function (x) { litresY += x.litres; costY += x.cost; });

  // (Re)création de l'onglet
  var sh = ss.getSheetByName(DASH_SHEET_GS);
  if (!sh) sh = ss.insertSheet(DASH_SHEET_GS);
  sh.getCharts().forEach(function (c) { sh.removeChart(c); });
  sh.clear();

  var eu = '€';
  sh.getRange('A1').setValue('Bilan carburant — mis à jour le ' +
    Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'dd/MM/yyyy HH:mm'))
    .setFontWeight('bold').setFontSize(13);

  // Bloc données mensuelles (A3:C…)
  sh.getRange('A3:C3').setValues([['Mois', 'Dépense (' + eu + ')', 'CO2 évité (kg)']])
    .setFontWeight('bold');
  var rows = order.map(function (k) {
    var parts = k.split('-');
    return [
      new Date(Number(parts[0]), Number(parts[1]) - 1, 1),
      Math.round(months[k].cost * 100) / 100,
      Math.round(months[k].co2 * 10) / 10
    ];
  });
  var lastRow = 3;
  if (rows.length) {
    sh.getRange(4, 1, rows.length, 3).setValues(rows);
    sh.getRange(4, 1, rows.length, 1).setNumberFormat('mm/yyyy');
    lastRow = 3 + rows.length;
  }

  // Bloc KPIs (E3:F…)
  sh.getRange('E3:F3').setValues([['Indicateur', 'Valeur']]).setFontWeight('bold');
  sh.getRange('E4:F7').setValues([
    ['Année', anneeMax],
    ['Pleins', yr.length],
    ['Litres', Math.round(litresY * 10) / 10],
    [eu + ' dépensés (' + anneeMax + ')', Math.round(costY)]
  ]);

  // Graphiques natifs
  var nCharts = 0;
  if (rows.length) {
    var moisRange = sh.getRange(3, 1, rows.length + 1, 1);   // A3:A(last) — catégories
    var costRange = sh.getRange(3, 2, rows.length + 1, 1);   // B — dépense
    var co2Range  = sh.getRange(3, 3, rows.length + 1, 1);   // C — CO2

    sh.insertChart(sh.newChart().asColumnChart()
      .addRange(moisRange).addRange(costRange)
      .setNumHeaders(1)
      .setPosition(lastRow + 2, 1, 0, 0)
      .setOption('title', 'Dépense mensuelle (' + eu + ')')
      .setOption('legend', { position: 'none' })
      .build());
    nCharts++;

    sh.insertChart(sh.newChart().asLineChart()
      .addRange(moisRange).addRange(co2Range)
      .setNumHeaders(1)
      .setPosition(lastRow + 2, 6, 0, 0)
      .setOption('title', 'CO2 évité par mois (kg)')
      .setOption('legend', { position: 'none' })
      .build());
    nCharts++;
  }

  // Onglet en tête pour la consultation
  try { ss.setActiveSheet(sh); ss.moveActiveSheet(1); } catch (e) {}

  return {
    ok: true,
    tab: DASH_SHEET_GS,
    months: order.length,
    charts: nCharts,
    surconso: Math.round(surconso * 1000) / 1000,
    generatedAt: new Date().toISOString()
  };
}
