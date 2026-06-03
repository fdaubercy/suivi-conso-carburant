// ============================================================
//  SUIVI CONSO E85 — Bilan annuel « Wrapped » par e-mail   v4.16.0.0
//  Pendant annuel du rapport mensuel (RapportMensuel.gs), aligne sur
//  la carte « Wrapped » de l'app (js/wrapped.js, W37).
//
//  Trigger : 1er du mois ~8h, MAIS le handler n'agit qu'en JANVIER
//  -> envoie le bilan de l'ANNEE ECOULEE. (GAS n'a pas de trigger
//  "annuel" direct ; on garde un trigger mensuel + garde-fou mois.)
//
//  INSTALLATION (une seule fois) :
//    1. Coller ce fichier dans le projet Apps Script (a cote de Code.gs
//       et RapportMensuel.gs : il REUTILISE leurs fonctions globales
//       SPREADSHEET_ID / getOrCreateSheet / lireSurconsoParam /
//       computeSurconsoDynamique / CO2_*_PER_L_GS).
//    2. Executer  installerTriggerWrappedAnnuel()  une fois.
//    3. Tester avec  testWrappedAnnuel()  -> bilan de l'annee la plus
//       recente, envoye tout de suite.
//
//  Destinataire : compte du script (Session.getEffectiveUser) ou
//  l'adresse forcee via WRAPPED_EMAIL ci-dessous.
// ============================================================

// Laisser '' pour envoyer au compte du script, ou mettre une adresse.
const WRAPPED_EMAIL = '';

const MOIS_FR_W = ['Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
                   'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'];

// ─────────────────────────────────────────────────────────────
//  TRIGGER (1er du mois 8h ; n'agit qu'en janvier). Idempotent.
// ─────────────────────────────────────────────────────────────
function installerTriggerWrappedAnnuel() {
  ScriptApp.getProjectTriggers().forEach(t => {
    if (t.getHandlerFunction() === 'wrappedTriggerHandler') ScriptApp.deleteTrigger(t);
  });
  ScriptApp.newTrigger('wrappedTriggerHandler')
    .timeBased().onMonthDay(1).atHour(8).create();
  Logger.log('Trigger Wrapped annuel installe (1er du mois 8h ; envoi en janvier seulement).');
}

function supprimerTriggerWrappedAnnuel() {
  ScriptApp.getProjectTriggers().forEach(t => {
    if (t.getHandlerFunction() === 'wrappedTriggerHandler') ScriptApp.deleteTrigger(t);
  });
  Logger.log('Trigger Wrapped annuel supprime.');
}

// Handler du trigger : n'envoie qu'en janvier, le bilan de l'annee ecoulee.
function wrappedTriggerHandler() {
  const now = new Date();
  if (now.getMonth() !== 0) return;           // 0 = janvier
  envoyerWrappedAnnuel(now.getFullYear() - 1);
}

// Test manuel : envoie le bilan de l'annee la plus recente tout de suite.
function testWrappedAnnuel() {
  envoyerWrappedAnnuel();
}

// ─────────────────────────────────────────────────────────────
//  ENVOI
// ─────────────────────────────────────────────────────────────
function envoyerWrappedAnnuel(year) {
  const ss    = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet = getOrCreateSheet(ss);
  const data  = sheet.getDataRange().getValues();
  if (data.length <= 1) { Logger.log('Wrapped : aucune donnee.'); return; }

  if (!year) year = anneeLaPlusRecente_(data);
  if (!year) { Logger.log('Wrapped : aucune annee exploitable.'); return; }

  const stats = calculerWrapped(data, year, lireSurconsoParam(ss));
  if (stats.nbPleins === 0) { Logger.log('Wrapped : aucun plein en ' + year + '.'); return; }

  const dest = WRAPPED_EMAIL || Session.getEffectiveUser().getEmail();
  if (!dest) { Logger.log('Wrapped : aucun destinataire resolu.'); return; }

  MailApp.sendEmail({
    to: dest,
    subject: '[Suivi Conso. Carburants] 🎉 Votre année ' + year + ' en carburant',
    htmlBody: construireCorpsWrapped(year, stats),
    name: 'Suivi Conso. Carburants'
  });
  Logger.log('Wrapped ' + year + ' envoye a ' + dest + ' (' + stats.nbPleins + ' pleins).');
}

// Annee la plus recente presente dans les donnees.
function anneeLaPlusRecente_(data) {
  const headers = data[0].map(String);
  let cDate = headers.indexOf('Date'); if (cDate < 0) cDate = 1;
  let maxY = 0;
  data.slice(1).forEach(r => {
    const d = (r[cDate] instanceof Date) ? r[cDate] : new Date(String(r[cDate]));
    if (!isNaN(d.getTime()) && d.getFullYear() > maxY) maxY = d.getFullYear();
  });
  return maxY || null;
}

// ─────────────────────────────────────────────────────────────
//  CALCUL DU BILAN ANNUEL (meme methode que js/wrapped.js, tous vehicules)
// ─────────────────────────────────────────────────────────────
function calculerWrapped(data, year, surconsoOverride) {
  const headers = data[0].map(String);
  const idx = (name, fb) => { const i = headers.indexOf(name); return i >= 0 ? i : fb; };
  const cDate = idx('Date', 1), cType = idx('Type', 2), cKm = idx('Km compteur', 3),
        cLit = idx('Nb. Litres', 4), cPrix = idx('Prix €/L', 5), cSp98 = idx('SP98 station (€/L)', 9),
        cVeh = idx('Véhicule', 7), cSta = idx('Station essence', 6);

  const toNum = v => { const n = Number(String(v).replace(',', '.')); return isFinite(n) ? n : 0; };
  const isE85 = t => /e85|ethanol/i.test(String(t));
  const dOf = v => { const d = (v instanceof Date) ? v : new Date(String(v)); return isNaN(d.getTime()) ? null : d; };

  const surconso = (surconsoOverride > 0)
    ? surconsoOverride
    : computeSurconsoDynamique(data, cDate, cType, cKm, cLit, cVeh);

  // Prix SP98 de reference (repli) sur TOUT l'historique (idem rapport mensuel).
  const sp98Refs = [];
  data.slice(1).forEach(r => {
    if (isE85(r[cType])) { const s = toNum(r[cSp98]); if (s > 0) sp98Refs.push(s); }
    else if (/98/.test(String(r[cType]))) { const p = toNum(r[cPrix]); if (p > 0) sp98Refs.push(p); }
  });
  const sp98Moyen = sp98Refs.length ? sp98Refs.reduce((a, b) => a + b, 0) / sp98Refs.length : 0;

  const rows = data.slice(1).filter(r => { const d = dOf(r[cDate]); return d && d.getFullYear() === year; });

  let nbPleins = 0, nbE85 = 0, totalLitres = 0, totalCout = 0, litresE85 = 0, coutE85 = 0, coutSp98Equiv = 0;
  const stationCount = {}, moisCout = {}, kmByVeh = {};

  rows.forEach(r => {
    const lit = toNum(r[cLit]), prix = toNum(r[cPrix]), km = toNum(r[cKm]);
    const d = dOf(r[cDate]);
    if (lit > 0 && prix > 0) {
      nbPleins++; totalLitres += lit; totalCout += lit * prix;
      const st = String(r[cSta] || '').trim();
      if (st) stationCount[st] = (stationCount[st] || 0) + 1;
      if (d) moisCout[d.getMonth()] = (moisCout[d.getMonth()] || 0) + lit * prix;
    }
    if (km > 0) {
      const v = String(r[cVeh] || '');
      const o = kmByVeh[v] || (kmByVeh[v] = { min: km, max: km });
      if (km < o.min) o.min = km;
      if (km > o.max) o.max = km;
    }
    if (isE85(r[cType]) && lit > 0 && prix > 0) {
      nbE85++; litresE85 += lit; coutE85 += lit * prix;
      const sp98 = toNum(r[cSp98]) || sp98Moyen;
      if (sp98 > 0) coutSp98Equiv += (lit / (1 + surconso)) * sp98;
    }
  });

  let kmParcourus = 0;
  Object.keys(kmByVeh).forEach(v => { const o = kmByVeh[v]; if (o.max > o.min) kmParcourus += o.max - o.min; });

  const consoMoy = kmParcourus > 0 ? (totalLitres / kmParcourus) * 100 : 0;   // L/100 km annuelle
  const econE85 = coutSp98Equiv - coutE85;
  const prixMoyenE85 = litresE85 > 0 ? coutE85 / litresE85 : 0;
  const essenceEquivL = litresE85 / (1 + surconso);
  const co2Evite = essenceEquivL * CO2_ESSENCE_PER_L_GS - litresE85 * CO2_E85_PER_L_GS;

  let stationPref = '', stationPrefN = 0;
  Object.keys(stationCount).forEach(st => { if (stationCount[st] > stationPrefN) { stationPrefN = stationCount[st]; stationPref = st; } });

  let moisCher = null, moisCherCout = 0;
  Object.keys(moisCout).forEach(m => { if (moisCout[m] > moisCherCout) { moisCherCout = moisCout[m]; moisCher = Number(m); } });

  return {
    year, nbPleins, nbE85, totalLitres, totalCout, kmParcourus, consoMoy,
    econE85, co2Evite, prixMoyenE85, surconso, stationPref, stationPrefN, moisCher, moisCherCout
  };
}

// ─────────────────────────────────────────────────────────────
//  CORPS HTML (style « modele », aligne sur le rapport mensuel)
// ─────────────────────────────────────────────────────────────
function construireCorpsWrapped(year, s) {
  const eur = n => Math.round(n).toLocaleString('fr-FR');
  const f0  = n => Math.round(n).toLocaleString('fr-FR');
  const prix3 = n => n.toLocaleString('fr-FR', { minimumFractionDigits: 3, maximumFractionDigits: 3 });
  const escHtml = t => String(t).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const surconsoPct = ((s.surconso || RAPPORT_SURCONSO) * 100).toFixed(1).replace('.', ',');
  const ecoSign = s.econE85 >= 0 ? '+' : '';
  const co2Txt = s.co2Evite >= 1000
    ? (s.co2Evite / 1000).toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' t'
    : Math.round(s.co2Evite) + ' kg';
  const co2Val     = (s.nbE85 && s.co2Evite > 0) ? co2Txt : '—';
  const prixE85Val = (s.prixMoyenE85 > 0) ? prix3(s.prixMoyenE85) + ' €/L' : '—';
  const f1 = n => n.toLocaleString('fr-FR', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
  const consoVal    = (s.consoMoy > 0) ? f1(s.consoMoy) : '—';
  const surconsoVal = '+' + surconsoPct + ' %';

  const card = (icon, val, sub, bg, brd, valCol) => `
            <td width="50%" style="padding:8px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" bgcolor="${bg || '#f5f7fa'}" style="background:${bg || '#f5f7fa'};border:1px solid ${brd || '#e9edf2'};border-radius:12px;">
                <tr><td style="padding:15px 16px;">
                  <div style="font-size:20px;">${icon}</div>
                  <div style="color:${valCol || '#1B3A5C'};font-size:25px;font-weight:800;margin-top:5px;">${val}</div>
                  <div style="color:#6B7280;font-size:12px;margin-top:3px;">${sub}</div>
                </td></tr>
              </table>
            </td>`;

  const hero = s.nbE85
    ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" bgcolor="#1D9E75" style="background:#1D9E75;border-radius:14px;">
          <tr><td style="padding:22px 24px;">
            <div style="color:#d7f5e9;font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:.6px;">🎉 Votre année ${year} en E85</div>
            <div style="color:#ffffff;font-size:40px;font-weight:800;line-height:1.05;margin-top:8px;">${ecoSign}${eur(s.econE85)} €</div>
            <div style="color:#c8efdd;font-size:13px;margin-top:7px;">économisés vs SP98${(s.co2Evite > 0) ? ' · ' + co2Txt + ' de CO₂ évités 🌿' : ''}</div>
          </td></tr>
        </table>`
    : `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" bgcolor="#f1f5f9" style="background:#f1f5f9;border:1px solid #e2e8f0;border-radius:14px;">
          <tr><td style="padding:20px 24px;">
            <div style="color:#1B3A5C;font-size:20px;font-weight:800;">🎉 ${year} en carburant</div>
            <div style="color:#64748b;font-size:13px;margin-top:6px;">Aucun plein E85 cette année — pas d'économie calculée.</div>
          </td></tr>
        </table>`;

  const bandeau = (icon, label, valHtml, bg, brd) => `
      <tr><td style="padding:6px 30px 6px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" bgcolor="${bg}" style="background:${bg};border:1px solid ${brd};border-radius:12px;"><tr>
          <td style="padding:14px 18px;vertical-align:middle;">
            <span style="font-size:20px;">${icon}</span>
            <span style="color:#334155;font-size:14px;font-weight:600;padding-left:6px;">${label}</span>
          </td>
          <td style="padding:14px 18px;vertical-align:middle;text-align:right;">${valHtml}</td>
        </tr></table>
      </td></tr>`;

  const stationBandeau = s.stationPref
    ? bandeau('⭐', 'Station préférée',
        `<span style="color:#1B3A5C;font-size:15px;font-weight:800;">${escHtml(s.stationPref)}</span><span style="color:#6B7280;font-size:12px;font-weight:600;"> · ${s.stationPrefN} plein${s.stationPrefN > 1 ? 's' : ''}</span>`,
        '#f5f7fa', '#e9edf2')
    : '';

  const moisBandeau = (s.moisCher != null)
    ? bandeau('📅', 'Mois le plus cher',
        `<span style="color:#1B3A5C;font-size:15px;font-weight:800;">${MOIS_FR_W[s.moisCher]}</span><span style="color:#6B7280;font-size:12px;font-weight:600;"> · ${eur(s.moisCherCout)} €</span>`,
        '#fff7ed', '#fde8cf')
    : '';

  const genere = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'dd/MM/yyyy à HH:mm');

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
            <div style="color:#9fb3c8;font-size:12px;margin-top:3px;letter-spacing:.3px;">BILAN ANNUEL</div>
          </td>
          <td style="vertical-align:middle;text-align:right;">
            <div style="color:#ffffff;font-size:24px;font-weight:800;">${year}</div>
          </td>
        </tr></table>
      </td></tr>
      <tr><td style="height:4px;background:#1D9E75;font-size:0;line-height:0;">&nbsp;</td></tr>

      <tr><td style="padding:24px 30px 4px;">
        <div style="color:#334155;font-size:15px;line-height:1.55;">Bonjour 👋<br>Voici votre bilan carburant de l'année <strong>${year}</strong>.</div>
      </td></tr>

      <tr><td style="padding:18px 30px 4px;">${hero}</td></tr>

      <tr><td style="padding:14px 22px 2px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
          <tr>
            ${card('⛽', s.nbPleins, 'pleins' + (s.nbE85 ? ' · dont ' + s.nbE85 + ' E85' : ''))}
            ${card('🛢️', f0(s.totalLitres) + ' L', 'consommés')}
          </tr>
          <tr>
            ${card('💶', eur(s.totalCout) + ' €', 'dépensés')}
            ${card('🌿', prixE85Val, 'prix moyen E85')}
          </tr>
          <tr>
            ${card('🛣️', eur(s.kmParcourus) + ' km', 'parcourus')}
            ${card('📊', consoVal, 'L/100 km · moyenne')}
          </tr>
          <tr>
            ${card('🌱', co2Val, 'CO₂ évité (vs essence)', '#eef6f2', '#d3e9df', '#15805f')}
            ${card('🔺', surconsoVal, 'surconso E85')}
          </tr>
        </table>
      </td></tr>

      ${stationBandeau}
      ${moisBandeau}

      <tr><td style="padding:16px 30px 26px;">
        <div style="border-top:1px solid #eceff3;padding-top:14px;color:#94a3b8;font-size:11px;line-height:1.65;">
          Économie brute — surconsommation E85 <strong style="color:#64748b;">+${surconsoPct}&nbsp;%</strong> prise en compte (valeur partagée Excel J7 / app), hors amortissement du kit.${s.nbE85 ? ' CO₂ évité estimé à distance égale (essence 2,21 · E85 1,105 kg/L).' : ''}<br>
          Bilan annuel généré automatiquement le ${genere} · <span style="color:#1B3A5C;font-weight:700;">Suivi Conso. Carburants</span>
        </div>
      </td></tr>

    </table>
   </td></tr>
  </table>`;
}
