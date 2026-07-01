// ============================================================
//  SUIVI CONSO E85 — Rapport mensuel automatique     v4.15.1.0
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

  const stats = calculerStatsRapport(data, debut, fin, lireSurconsoParam(ss));

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
function calculerStatsRapport(data, debut, fin, surconsoOverride) {
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
  const cSta  = idx('Station essence', 6);   // col G (repli si en-tete different)

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
  let nbE85 = 0, litresE85 = 0;
  let kmMin = Infinity, kmMax = -Infinity;
  let coutE85 = 0, coutSp98Equiv = 0;
  const stationCount = {};   // frequence des stations sur le mois
  const detailPleins = [];  // {d, date, prix, type} pour le mini-graphe QuickChart

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

  // Surconsommation E85 : PRIORITE a la valeur partagee Excel J7 (onglet
  // Parametres, cle "surconso", synchronisee app/Excel) -> le rapport affiche
  // exactement la meme surconso que le classeur. A defaut, calcul dynamique sur
  // l'historique (conso E85 / conso SP98 - 1) ; repli 20% en dernier recours.
  const surconso = (surconsoOverride > 0)
    ? surconsoOverride
    : computeSurconsoDynamique(data, cDate, cType, cKm, cLit, cVeh);

  rows.forEach(r => {
    const lit  = toNum(r[cLit]);
    const prix = toNum(r[cPrix]);
    const km   = toNum(r[cKm]);
    if (lit > 0 && prix > 0) {
      nbPleins++; totalCout += lit * prix; totalLitres += lit;
      const st = String(r[cSta] || '').trim();
      if (st) stationCount[st] = (stationCount[st] || 0) + 1;   // station preferee
      const dRaw = r[cDate];
      const dObj = dRaw instanceof Date ? dRaw : new Date(String(dRaw));
      if (!isNaN(dObj.getTime())) {
        detailPleins.push({ d: dObj, prix: prix, type: String(r[cType] || '') });
      }
    }
    if (km > 0) { kmMin = Math.min(kmMin, km); kmMax = Math.max(kmMax, km); }

    if (isE85(r[cType]) && lit > 0 && prix > 0) {
      nbE85++;
      litresE85 += lit;
      coutE85 += lit * prix;
      const sp98 = toNum(r[cSp98]) || sp98Moyen;
      if (sp98 > 0) coutSp98Equiv += (lit / (1 + surconso)) * sp98;
    }
  });

  const kmParcourus = (kmMax > kmMin) ? (kmMax - kmMin) : 0;
  const consoMoy = kmParcourus > 0 ? (totalLitres / kmParcourus) * 100 : 0;
  const ecoBrute = coutSp98Equiv - coutE85;

  // Prix moyen E85 du mois (pondere = cout total E85 / litres E85).
  const prixMoyenE85 = litresE85 > 0 ? coutE85 / litresE85 : 0;

  // CO2 evite par l'E85 vs essence, a distance egale (meme methode que l'app W40).
  const essenceEquivL = litresE85 / (1 + surconso);
  const co2Evite = essenceEquivL * CO2_ESSENCE_PER_L_GS - litresE85 * CO2_E85_PER_L_GS;

  // Station preferee = la plus frequente sur le mois.
  let stationPref = '', stationPrefN = 0;
  Object.keys(stationCount).forEach(st => {
    if (stationCount[st] > stationPrefN) { stationPrefN = stationCount[st]; stationPref = st; }
  });

  // Detail des pleins, trie chronologiquement (les rows filtrees ne le sont
  // pas forcement) -> utilise pour le mini-graphe QuickChart du rapport.
  detailPleins.sort((a, b) => a.d - b.d);

  return {
    nbPleins,
    nbE85,
    totalCout,
    totalLitres,
    kmParcourus,
    consoMoy,
    ecoBrute,
    surconso,
    co2Evite,
    prixMoyenE85,
    stationPref,
    stationPrefN,
    detailPleins
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
//  Surconsommation partagee : onglet "Parametres", cle "surconso"
//  (= cellule Excel "Suivi Carburant!J7", synchronisee app/Excel).
//  Retourne une FRACTION (ex. 0.22) ou null si absente/invalide.
//  Reutilise readParamsMap_ / getOrCreateParamsSheet_ de Code.gs.
//  Tolere une valeur saisie en % (ex. 22 -> 0.22).
// ─────────────────────────────────────────────────────────────
function lireSurconsoParam(ss) {
  try {
    const map = readParamsMap_(getOrCreateParamsSheet_(ss));
    if (map && map['surconso']) {
      let n = Number(String(map['surconso'].valeur).replace(',', '.'));
      if (isFinite(n) && n > 0) return (n > 1) ? n / 100 : n;
    }
  } catch (e) { /* onglet Parametres absent -> repli dynamique */ }
  return null;
}

// ─────────────────────────────────────────────────────────────
//  Construit l'URL QuickChart (image) du mini-graphe "prix paye
//  sur le mois" -> insere dans le mail via <img src="...">.
//  Une seule serie (prix paye au litre), point colore selon le
//  type de carburant (E85 vert / autre bleu fonce). GET only (pas
//  de POST possible dans une balise <img>) -> JSON compact.
//  Retourne '' si detailPleins est vide ou n'a pas au moins 2
//  points (un graphe a 0-1 point n'apporte rien).
// ─────────────────────────────────────────────────────────────
function construireUrlGraphePrix(detailPleins) {
  if (!detailPleins || detailPleins.length < 2) return '';

  const isE85 = t => /e85|ethanol/i.test(String(t));
  const COULEUR_E85   = '#1D9E75';
  const COULEUR_AUTRE = '#2E75B6';

  const labels = detailPleins.map(p => Utilities.formatDate(p.d, Session.getScriptTimeZone(), 'dd/MM'));
  const prix   = detailPleins.map(p => Math.round(p.prix * 1000) / 1000);
  const couleurs = detailPleins.map(p => isE85(p.type) ? COULEUR_E85 : COULEUR_AUTRE);

  const config = {
    type: 'line',
    data: {
      labels: labels,
      datasets: [{
        label: 'Prix paye (EUR/L)',
        data: prix,
        borderColor: '#94a3b8',
        borderWidth: 2,
        pointBackgroundColor: couleurs,
        pointBorderColor: couleurs,
        pointRadius: 5,
        pointHoverRadius: 6,
        fill: false,
        tension: 0.25
      }]
    },
    options: {
      plugins: { legend: { display: false } },
      scales: {
        y: { ticks: { callback: 'function(v){return v.toFixed(2)+" EUR";}' } }
      }
    }
  };

  const params = [
    'c=' + encodeURIComponent(JSON.stringify(config)),
    'w=560',
    'h=220',
    'devicePixelRatio=2',
    'backgroundColor=white',
    'f=png'
  ].join('&');

  return 'https://quickchart.io/chart?' + params;
}

// ─────────────────────────────────────────────────────────────
//  Construit le corps HTML du mail (style aligne sur l'app).
// ─────────────────────────────────────────────────────────────
function construireCorpsRapport(moisLabel, s) {
  const eur = n => Math.round(n).toLocaleString('fr-FR');
  const f1  = n => n.toLocaleString('fr-FR', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
  const ecoSign = s.ecoBrute >= 0 ? '+' : '';
  const surconsoPct = (((s.surconso != null ? s.surconso : RAPPORT_SURCONSO) * 100)).toFixed(1).replace('.', ',');
  const prix3 = n => n.toLocaleString('fr-FR', { minimumFractionDigits: 3, maximumFractionDigits: 3 });
  const escHtml = t => String(t).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const co2Val     = (s.nbE85 && s.co2Evite > 0) ? Math.round(s.co2Evite) + ' kg' : '—';
  const prixE85Val = (s.prixMoyenE85 > 0) ? prix3(s.prixMoyenE85) + ' €/L' : '—';
  const genere = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'dd/MM/yyyy à HH:mm');
  const urlGraphe = construireUrlGraphePrix(s.detailPleins);

  if (s.nbPleins === 0) {
    return `<div style="font-family:Arial,Helvetica,sans-serif;color:#334155;max-width:600px;margin:0 auto;padding:24px;">
      <h2 style="color:#1B3A5C;border-bottom:2px solid #1D9E75;padding-bottom:6px;">⛽ Suivi Conso. Carburants — ${moisLabel}</h2>
      <p>Aucun plein enregistré sur cette période.</p></div>`;
  }

  // Carte KPI (cellule de tableau).
  const card = (icon, val, sub) => `
            <td width="50%" style="padding:8px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" bgcolor="#f5f7fa" style="background:#f5f7fa;border:1px solid #e9edf2;border-radius:12px;">
                <tr><td style="padding:15px 16px;">
                  <div style="font-size:20px;">${icon}</div>
                  <div style="color:#1B3A5C;font-size:25px;font-weight:800;margin-top:5px;">${val}</div>
                  <div style="color:#6B7280;font-size:12px;margin-top:3px;">${sub}</div>
                </td></tr>
              </table>
            </td>`;

  // Hero : économie E85 (vert) si des pleins E85, sinon encart neutre.
  const hero = s.nbE85
    ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" bgcolor="#1D9E75" style="background:#1D9E75;border-radius:14px;">
          <tr><td style="padding:20px 24px;">
            <div style="color:#d7f5e9;font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:.6px;">💰 Économie E85 vs SP98</div>
            <div style="color:#ffffff;font-size:38px;font-weight:800;line-height:1.05;margin-top:8px;">${ecoSign}${eur(s.ecoBrute)} €</div>
            <div style="color:#c8efdd;font-size:12px;margin-top:7px;">ce mois-ci grâce au SuperÉthanol</div>
          </td></tr>
        </table>`
    : `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" bgcolor="#f1f5f9" style="background:#f1f5f9;border:1px solid #e2e8f0;border-radius:14px;">
          <tr><td style="padding:18px 22px;">
            <div style="color:#64748b;font-size:13px;font-weight:600;">Aucun plein E85 ce mois — pas d'économie calculée.</div>
          </td></tr>
        </table>`;

  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#eef1f5;font-family:Arial,Helvetica,sans-serif;">
   <tr><td align="center" style="padding:28px 12px;">
    <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="width:600px;max-width:600px;background:#ffffff;border-radius:16px;overflow:hidden;">

      <tr><td style="background:#1B3A5C;padding:26px 30px 22px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
          <td style="vertical-align:middle;width:48px;">
            <div style="width:46px;height:46px;background:#1D9E75;border-radius:12px;text-align:center;font-size:25px;line-height:46px;">⛽</div>
          </td>
          <td style="vertical-align:middle;padding-left:14px;">
            <div style="color:#ffffff;font-size:18px;font-weight:700;">Suivi Conso. Carburants</div>
            <div style="color:#9fb3c8;font-size:12px;margin-top:3px;letter-spacing:.3px;">RAPPORT MENSUEL</div>
          </td>
          <td style="vertical-align:middle;text-align:right;">
            <div style="color:#ffffff;font-size:21px;font-weight:800;">${moisLabel}</div>
          </td>
        </tr></table>
      </td></tr>
      <tr><td style="height:4px;background:#1D9E75;font-size:0;line-height:0;">&nbsp;</td></tr>

      <tr><td style="padding:24px 30px 4px;">
        <div style="color:#334155;font-size:15px;line-height:1.55;">Bonjour 👋<br>Voici le bilan de vos pleins pour <strong>${moisLabel}</strong>.</div>
      </td></tr>

      <tr><td style="padding:18px 30px 4px;">${hero}</td></tr>

      ${urlGraphe ? `<tr><td style="padding:14px 30px 4px;text-align:center;">
        <img src="${urlGraphe}" width="560" alt="Évolution du prix payé sur le mois" style="max-width:100%;border-radius:8px;">
      </td></tr>` : ''}

      <tr><td style="padding:14px 22px 2px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
          <tr>
            ${card('⛽', s.nbPleins, 'pleins' + (s.nbE85 ? ' · dont ' + s.nbE85 + ' E85' : ''))}
            ${card('💶', eur(s.totalCout) + ' €', 'dépensés')}
          </tr>
          <tr>
            ${card('🛢️', f1(s.totalLitres) + ' L', 'consommés')}
            ${card('🛣️', eur(s.kmParcourus) + ' km', 'parcourus')}
          </tr>
          <tr>
            <td width="50%" style="padding:8px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" bgcolor="#eef6f2" style="background:#eef6f2;border:1px solid #d3e9df;border-radius:12px;">
                <tr><td style="padding:15px 16px;">
                  <div style="font-size:20px;">🌱</div>
                  <div style="color:#15805f;font-size:25px;font-weight:800;margin-top:5px;">${co2Val}</div>
                  <div style="color:#6B7280;font-size:12px;margin-top:3px;">CO₂ évité (vs essence)</div>
                </td></tr>
              </table>
            </td>
            ${card('🌿', prixE85Val, 'prix moyen E85')}
          </tr>
        </table>
      </td></tr>

      <tr><td style="padding:8px 30px 6px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" bgcolor="#eef6f2" style="background:#eef6f2;border:1px solid #d8ebe2;border-radius:12px;">
          <tr>
            <td style="padding:15px 18px;vertical-align:middle;">
              <span style="font-size:20px;">📊</span>
              <span style="color:#334155;font-size:14px;font-weight:600;padding-left:6px;">Consommation moyenne</span>
            </td>
            <td style="padding:15px 18px;vertical-align:middle;text-align:right;">
              <span style="color:#1B3A5C;font-size:22px;font-weight:800;">${s.consoMoy > 0 ? f1(s.consoMoy) : 'n/d'}</span>
              <span style="color:#6B7280;font-size:13px;font-weight:600;">${s.consoMoy > 0 ? ' L/100 km' : ''}</span>
            </td>
          </tr>
        </table>
      </td></tr>

      ${s.stationPref ? `<tr><td style="padding:6px 30px 6px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" bgcolor="#f5f7fa" style="background:#f5f7fa;border:1px solid #e9edf2;border-radius:12px;">
          <tr>
            <td style="padding:14px 18px;vertical-align:middle;">
              <span style="font-size:20px;">⭐</span>
              <span style="color:#334155;font-size:14px;font-weight:600;padding-left:6px;">Station préférée</span>
            </td>
            <td style="padding:14px 18px;vertical-align:middle;text-align:right;">
              <span style="color:#1B3A5C;font-size:15px;font-weight:800;">${escHtml(s.stationPref)}</span>
              <span style="color:#6B7280;font-size:12px;font-weight:600;"> · ${s.stationPrefN} plein${s.stationPrefN > 1 ? 's' : ''}</span>
            </td>
          </tr>
        </table>
      </td></tr>` : ''}

      <tr><td style="padding:16px 30px 26px;">
        <div style="border-top:1px solid #eceff3;padding-top:14px;color:#94a3b8;font-size:11px;line-height:1.65;">
          Économie brute — surconsommation E85 <strong style="color:#64748b;">+${surconsoPct}&nbsp;%</strong> prise en compte (valeur partagée Excel J7 / app), hors amortissement du kit de conversion.${s.nbE85 ? ' CO₂ évité estimé à distance égale (essence 2,21 · E85 1,105 kg/L).' : ''}<br>
          Rapport généré automatiquement le ${genere} · <span style="color:#1B3A5C;font-weight:700;">Suivi Conso. Carburants</span>
        </div>
      </td></tr>

    </table>
   </td></tr>
  </table>`;
}
