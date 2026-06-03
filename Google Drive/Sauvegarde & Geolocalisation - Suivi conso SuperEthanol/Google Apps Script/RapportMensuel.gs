// ============================================================
//  SUIVI CONSO E85 — Rapport mensuel automatique     v4.14.0.4
//  Roadmap X16
//
//  Trigger temporel (1er du mois) -> MailApp.sendEmail() avec
//  resume du mois ECOULE : nb pleins, total EUR, conso moyenne,
//  economie E85 vs SP98 avec surconsommation E85 DYNAMIQUE,
//  mesuree sur l'historique (meme methode que l'app web / le
//  dashboard Excel), repli 20% si pas assez de donnees.
//
//  INSTALLATION (une seule fois) :
//    1. Coller ce fichier dans le projet Apps Script (Code.gs voisin).
//    2. Executer  installerTriggerRapportMensuel()  une fois
//       (autoriser l'acces Gmail demande).
//    3. Tester immediatement avec  testRapportMensuel().
//
//  Destinataire : compte qui execute le script
//  (Session.getEffectiveUser). Pour forcer une autre adresse,
//  renseigner RAPPORT_EMAIL ci-dessous.
// ============================================================

// Laisser '' pour envoyer au compte du script, ou mettre une adresse.
const RAPPORT_EMAIL = '';

// Surconsommation E85 de REPLI : utilisee seulement si le calcul dynamique
// ci-dessous (computeSurconsoDynamique) manque de donnees. Alignee sur
// DEFAULT_SURCONSO de l'app web.
const RAPPORT_SURCONSO = 0.20;

// ─────────────────────────────────────────────────────────────
//  Installer le declencheur mensuel (1er du mois, ~8h).
//  Idempotent : supprime un ancien trigger du meme handler avant.
// ─────────────────────────────────────────────────────────────
function installerTriggerRapportMensuel() {
  ScriptApp.getProjectTriggers().forEach(t => {
    if (t.getHandlerFunction() === 'envoyerRapportMensuel') {
      ScriptApp.deleteTrigger(t);
    }
  });
  ScriptApp.newTrigger('envoyerRapportMensuel')
    .timeBased()
    .onMonthDay(1)
    .atHour(8)
    .create();
  Logger.log('Trigger mensuel installe (1er du mois, 8h).');
}

// Retire le declencheur (si besoin de desactiver le rapport).
function supprimerTriggerRapportMensuel() {
  ScriptApp.getProjectTriggers().forEach(t => {
    if (t.getHandlerFunction() === 'envoyerRapportMensuel') {
      ScriptApp.deleteTrigger(t);
    }
  });
  Logger.log('Trigger mensuel supprime.');
}

// Test manuel : envoie le rapport du mois precedent tout de suite.
function testRapportMensuel() {
  envoyerRapportMensuel();
}

// ─────────────────────────────────────────────────────────────
//  Handler du trigger : calcule + envoie le rapport du mois ecoule.
// ─────────────────────────────────────────────────────────────
function envoyerRapportMensuel() {
  const ss    = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet = getOrCreateSheet(ss);
  const tz    = ss.getSpreadsheetTimeZone();
  const data  = sheet.getDataRange().getValues();
  if (data.length <= 1) {
    Logger.log('Rapport mensuel : aucune donnee.');
    return;
  }

  // Fenetre = mois precedent
  const now   = new Date();
  const debut = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const fin   = new Date(now.getFullYear(), now.getMonth(), 1); // 1er du mois courant (exclu)
  const moisLabel = moisEnFrancais(debut, tz);

  const stats = calculerStatsRapport(data, debut, fin);

  const dest = RAPPORT_EMAIL || Session.getEffectiveUser().getEmail();
  if (!dest) {
    Logger.log('Rapport mensuel : aucun destinataire resolu.');
    return;
  }

  const sujet = '[Suivi Conso. Carburants] Rapport mensuel — ' + moisLabel;
  const html  = construireCorpsRapport(moisLabel, stats);

  MailApp.sendEmail({
    to: dest,
    subject: sujet,
    htmlBody: html,
    name: 'Suivi Conso. Carburants'
  });
  Logger.log('Rapport mensuel envoye a ' + dest + ' (' + stats.nbPleins + ' pleins).');
}

// ─────────────────────────────────────────────────────────────
//  Libelle "mois annee" en francais (independant de la locale du
//  script). Ex : avril 2026.
// ─────────────────────────────────────────────────────────────
function moisEnFrancais(d, tz) {
  const MOIS_FR = ['Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
                   'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'];
  const numMois = Number(Utilities.formatDate(d, tz, 'MM'));   // 1..12
  const annee   = Utilities.formatDate(d, tz, 'yyyy');
  return MOIS_FR[numMois - 1] + ' ' + annee;
}

// ─────────────────────────────────────────────────────────────
//  Calcule les indicateurs du mois sur les lignes [debut, fin[.
//  Index colonnes (schema A..P) : B Date, C Type, D Km,
//  E Litres, F Prix, J SP98 station.
// ─────────────────────────────────────────────────────────────
function calculerStatsRapport(data, debut, fin) {
  const headers = data[0].map(String);
  const idx = (name, fallback) => {
    const i = headers.indexOf(name);
    return i >= 0 ? i : fallback;
  };
  const cDate = idx('Date', 1);
  const cType = idx('Type', 2);
  const cKm   = idx('Km compteur', 3);
  const cLit  = idx('Nb. Litres', 4);
  const cPrix = idx('Prix €/L', 5);
  const cSp98 = idx('SP98 station (€/L)', 9);
  const cVeh  = idx('Véhicule', 7);

  const toNum = v => {
    const n = Number(String(v).replace(',', '.'));
    return isFinite(n) ? n : 0;
  };
  const isE85 = t => /e85|ethanol/i.test(String(t));

  const rows = data.slice(1).filter(r => {
    const v = r[cDate];
    const d = v instanceof Date ? v : new Date(String(v));
    return !isNaN(d.getTime()) && d >= debut && d < fin;
  });

  let nbPleins = 0, totalCout = 0, totalLitres = 0;
  let nbE85 = 0;
  let kmMin = Infinity, kmMax = -Infinity;
  let coutE85 = 0, coutSp98Equiv = 0;

  // Prix SP98 de reference (repli pour les pleins E85 sans SP98 renseigne).
  // Calcule sur TOUT l'historique (pas seulement le mois) sinon un mois sans
  // prix SP98 donne une economie nulle. Deux sources :
  //   - prix SP98 releve sur les pleins E85 (colonne "SP98 station") ;
  //   - prix paye sur les pleins Super 98 (leur prix EST un prix SP98).
  const sp98Refs = [];
  data.slice(1).forEach(r => {
    if (isE85(r[cType])) {
      const s = toNum(r[cSp98]);
      if (s > 0) sp98Refs.push(s);
    } else if (/98/.test(String(r[cType]))) {
      const p = toNum(r[cPrix]);
      if (p > 0) sp98Refs.push(p);
    }
  });
  const sp98Moyen = sp98Refs.length
    ? sp98Refs.reduce((s, p) => s + p, 0) / sp98Refs.length
    : 0;

  // Surconsommation E85 DYNAMIQUE (meme methode que l'app web / le dashboard) :
  // mesuree sur l'historique complet ; repli RAPPORT_SURCONSO si insuffisant.
  const surconso = computeSurconsoDynamique(data, cDate, cType, cKm, cLit, cVeh);

  rows.forEach(r => {
    const lit  = toNum(r[cLit]);
    const prix = toNum(r[cPrix]);
    const km   = toNum(r[cKm]);
    if (lit > 0 && prix > 0) { nbPleins++; totalCout += lit * prix; totalLitres += lit; }
    if (km > 0) { kmMin = Math.min(kmMin, km); kmMax = Math.max(kmMax, km); }

    if (isE85(r[cType]) && lit > 0 && prix > 0) {
      nbE85++;
      coutE85 += lit * prix;
      const sp98 = toNum(r[cSp98]) || sp98Moyen;
      if (sp98 > 0) coutSp98Equiv += (lit / (1 + surconso)) * sp98;
    }
  });

  const kmParcourus = (kmMax > kmMin) ? (kmMax - kmMin) : 0;
  const consoMoy = kmParcourus > 0 ? (totalLitres / kmParcourus) * 100 : 0;
  const ecoBrute = coutSp98Equiv - coutE85;

  return {
    nbPleins,
    nbE85,
    totalCout,
    totalLitres,
    kmParcourus,
    consoMoy,
    ecoBrute,
    surconso
  };
}

// ─────────────────────────────────────────────────────────────
//  Surconsommation E85 dynamique — alignee sur l'app web :
//  conso moyenne E85 / conso moyenne SP98 - 1, calculee sur les
//  pleins CONSECUTIFS d'un MEME vehicule (tout l'historique).
//  Repli RAPPORT_SURCONSO si pas de couple E85/SP98 exploitable.
// ─────────────────────────────────────────────────────────────
function computeSurconsoDynamique(data, cDate, cType, cKm, cLit, cVeh) {
  const toNum = v => { const n = Number(String(v).replace(',', '.')); return isFinite(n) ? n : 0; };
  const isE85 = t => /e85|ethanol/i.test(String(t));
  const is98  = t => /98/.test(String(t));
  const toDate = v => (v instanceof Date) ? v : new Date(String(v));

  // Regroupe les pleins par vehicule (km > 0 requis pour calculer une conso).
  const byVeh = {};
  data.slice(1).forEach(r => {
    const km = toNum(r[cKm]);
    if (km <= 0) return;
    const veh = String(r[cVeh] || '');
    (byVeh[veh] || (byVeh[veh] = [])).push({ d: toDate(r[cDate]), km: km, lit: toNum(r[cLit]), type: r[cType] });
  });

  const consoE85 = [], consoS98 = [];
  Object.keys(byVeh).forEach(veh => {
    const rows = byVeh[veh].filter(x => !isNaN(x.d.getTime())).sort((a, b) => a.d - b.d);
    for (let i = 1; i < rows.length; i++) {
      const dk  = rows[i].km - rows[i - 1].km;
      const lit = rows[i].lit;
      if (dk <= 0 || lit <= 0) continue;
      const conso = (lit / dk) * 100;                  // L/100 km du plein courant
      if (isE85(rows[i].type)) consoE85.push(conso);
      else if (is98(rows[i].type)) consoS98.push(conso);
    }
  });

  if (!consoE85.length || !consoS98.length) return RAPPORT_SURCONSO;
  const avg = a => a.reduce((s, v) => s + v, 0) / a.length;
  const s = avg(consoE85) / avg(consoS98) - 1;
  return (isFinite(s) && s > 0) ? s : RAPPORT_SURCONSO;
}

// ─────────────────────────────────────────────────────────────
//  Construit le corps HTML du mail (style aligne sur l'app).
// ─────────────────────────────────────────────────────────────
function construireCorpsRapport(moisLabel, s) {
  const eur = n => n.toLocaleString('fr-FR', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
  const f2  = n => n.toLocaleString('fr-FR', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
  const ecoColor = s.ecoBrute >= 0 ? '#1D9E75' : '#E24B4A';
  const ecoSign  = s.ecoBrute >= 0 ? '+' : '';

  if (s.nbPleins === 0) {
    return '<div style="font-family:Arial,sans-serif;color:#333">' +
      '<h2 style="color:#1B3A5C">⛽ Suivi Conso. Carburants — ' + moisLabel + '</h2>' +
      '<p>Aucun plein enregistre sur cette periode.</p></div>';
  }

  const ligne = (label, val) =>
    '<tr>' +
    '<td style="padding:8px 12px;border-bottom:1px solid #eee;color:#6B7280">' + label + '</td>' +
    '<td style="padding:8px 12px;border-bottom:1px solid #eee;text-align:right;' +
    'font-weight:700;color:#1B3A5C">' + val + '</td></tr>';

  return '' +
    '<div style="font-family:Arial,Helvetica,sans-serif;font-size:14px;color:#333;max-width:520px">' +
      '<h2 style="color:#1B3A5C;border-bottom:2px solid #1D9E75;padding-bottom:6px">' +
        '⛽ Suivi Conso. Carburants — ' + moisLabel +
      '</h2>' +
      '<p>Voici le bilan de vos pleins pour <strong>' + moisLabel + '</strong> :</p>' +
      '<table style="border-collapse:collapse;width:100%">' +
        ligne('Nombre de pleins', s.nbPleins + (s.nbE85 ? ' (dont ' + s.nbE85 + ' E85)' : '')) +
        ligne('Total depense', eur(s.totalCout) + ' €') +
        ligne('Litres consommes', f2(s.totalLitres) + ' L') +
        ligne('Distance parcourue', eur(s.kmParcourus) + ' km') +
        ligne('Consommation moyenne', (s.consoMoy > 0 ? f2(s.consoMoy) + ' L/100 km' : 'n/d')) +
        '<tr>' +
          '<td style="padding:8px 12px;color:#6B7280">Économie E85 vs SP98</td>' +
          '<td style="padding:8px 12px;text-align:right;font-weight:700;color:' +
            (s.nbE85 ? ecoColor : '#9CA3AF') + '">' +
            (s.nbE85 ? (ecoSign + eur(s.ecoBrute) + ' €')
                     : '— <span style="font-weight:400;font-size:11px">(aucun plein E85)</span>') +
          '</td>' +
        '</tr>' +
      '</table>' +
      '<p style="font-size:11px;color:#999;margin-top:18px;border-top:1px solid #eee;padding-top:8px">' +
        'Économie brute (surconsommation E85 +' + Math.round((s.surconso != null ? s.surconso : RAPPORT_SURCONSO) * 100) + '% mesurée sur l\'historique), ' +
        'hors amortissement du kit. Rapport genere automatiquement le ' +
        Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'dd/MM/yyyy à HH:mm') + '.' +
      '</p>' +
    '</div>';
}
