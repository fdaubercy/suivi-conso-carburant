/* ─── Stats live : conso, coût, économies E85 vs SP98 + sparkline prix + prédiction ─── */
import { state } from './state.js';
import { FUEL_CONFIG } from './config.js';
import { getAllRecords } from './historique.js';

const MONTHS_WINDOW = 6;

/** Matche un Type GS (label complet "SuperEthanol E85") avec une cle FUEL_CONFIG (E85). */
function matchType(rType, fuelKey) {
  if (!rType || !fuelKey) return false;
  const t = String(rType).toLowerCase();
  const cfg = FUEL_CONFIG[fuelKey];
  if (!cfg) return false;
  return t === cfg.label.toLowerCase()
      || t.includes(cfg.short.toLowerCase())
      || (fuelKey === 'E85' && t.includes('ethanol'));
}

/** Calcule les KPIs filtrés sur le véhicule courant + fenêtre N derniers mois. */
function computeStats() {
  const all = getAllRecords();
  if (!all.length) return null;

  const veh = state.currentVehiculeNom;
  const byVeh = veh
    ? all.filter(r => (r['Véhicule'] || r['Vehicule'] || '') === veh)
    : all;

  if (!byVeh.length) return null;

  const cutoff = new Date();
  cutoff.setMonth(cutoff.getMonth() - MONTHS_WINDOW);

  const recent = byVeh.filter(r => {
    const d = new Date(String(r.Date || r.Horodatage).replace(' ', 'T'));
    return !isNaN(d) && d >= cutoff;
  });

  const fuelKey  = state.currentType;
  const fuelCfg  = FUEL_CONFIG[fuelKey];
  const byFuel   = byVeh.filter(r => matchType(r.Type, fuelKey));

  const kmsFuel = byFuel
    .map(r => Number(r['Km compteur'] || 0))
    .filter(n => isFinite(n) && n > 0);
  const kmDeltaFuel     = kmsFuel.length > 1 ? Math.max(...kmsFuel) - Math.min(...kmsFuel) : 0;
  const totalLitresFuel = byFuel.reduce((s, r) => s + (Number(r['Nb. Litres']) || 0), 0);
  const consoFuel       = kmDeltaFuel > 0 ? (totalLitresFuel / kmDeltaFuel) * 100 : 0;

  const recentFuel = recent.filter(r => matchType(r.Type, fuelKey));
  const prixMoyenF = recentFuel.length
    ? recentFuel.reduce((s, r) => s + (Number(r['Prix €/L']) || 0), 0) / recentFuel.length
    : 0;
  const coutPer100 = consoFuel * prixMoyenF;

  const totalCout = recent.reduce(
    (s, r) => s + (Number(r['Nb. Litres']) || 0) * (Number(r['Prix €/L']) || 0), 0
  );

  const econ = recent.reduce((s, r) => {
    if (!String(r.Type || '').toLowerCase().includes('e85')) return s;
    const sp98 = Number(r['SP98 station (€/L)']) || 0;
    const prix = Number(r['Prix €/L']) || 0;
    const lit  = Number(r['Nb. Litres']) || 0;
    if (sp98 <= 0 || prix <= 0 || lit <= 0) return s;
    return s + (sp98 - prix) * lit;
  }, 0);

  return {
    fuelKey,
    fuelShort: fuelCfg?.short || '',
    conso: consoFuel,
    coutPer100,
    nbPleinsFuel: byFuel.length,
    totalCout,
    econ,
    nbPleins: recent.length,
    vehiculeName: veh || 'tous véhicules'
  };
}

/**
 * W28 — Génère un SVG sparkline des 10 derniers prix E85 payés.
 */
function buildE85Sparkline() {
  const all = getAllRecords();
  const veh = state.currentVehiculeNom;

  const e85 = all
    .filter(r => {
      if (veh && (r['Véhicule'] || r['Vehicule'] || '') !== veh) return false;
      const t = String(r.Type || '').toLowerCase();
      return t.includes('e85') || t.includes('ethanol');
    })
    .filter(r => Number(r['Prix €/L']) > 0)
    .sort((a, b) => {
      const da = new Date(String(a.Date || a.Horodatage || '').replace(' ', 'T'));
      const db = new Date(String(b.Date || b.Horodatage || '').replace(' ', 'T'));
      return da - db;
    })
    .slice(-10);

  if (e85.length < 2) return '';

  const prices = e85.map(r => Number(r['Prix €/L']));
  const minP = Math.min(...prices);
  const maxP = Math.max(...prices);
  const range = maxP - minP || 0.01;

  const W = 200, H = 44, padX = 4, padY = 5;
  const n  = prices.length;
  const toX = i => padX + (i / (n - 1)) * (W - 2 * padX);
  const toY = p => H - padY - ((p - minP) / range) * (H - 2 * padY);

  const pts = prices.map((p, i) => `${toX(i).toFixed(1)},${toY(p).toFixed(1)}`).join(' ');
  const lx  = toX(n - 1).toFixed(1);
  const ly  = toY(prices[n - 1]).toFixed(1);

  const diff   = prices[n - 1] - prices[0];
  const tClass = diff < -0.003 ? 'spark--down' : diff > 0.003 ? 'spark--up' : 'spark--flat';
  const tArrow = diff < -0.003 ? '↘' : diff > 0.003 ? '↗' : '→';

  return `
    <div class="e85-sparkline ${tClass}">
      <div class="spark-header">
        <span class="spark-label">Prix E85 (${n} pleins) ${tArrow}</span>
        <div class="spark-meta">
          <span class="spark-range">${minP.toFixed(3)} – ${maxP.toFixed(3)} €/L</span>
          <span class="spark-last">${prices[n - 1].toFixed(3)} €/L</span>
        </div>
      </div>
      <svg class="spark-svg" viewBox="0 0 ${W} ${H}" width="100%" height="${H}" preserveAspectRatio="none">
        <polyline class="spark-line" points="${pts}"/>
        <circle class="spark-dot" cx="${lx}" cy="${ly}" r="3.5"/>
      </svg>
    </div>`;
}

/**
 * W33 — Prédiction prochain plein basée sur l'intervalle moyen entre pleins.
 * Renvoie '' si moins de 3 pleins disponibles.
 */
function buildPrediction() {
  const all = getAllRecords();
  const veh = state.currentVehiculeNom;

  const records = (veh
    ? all.filter(r => (r['Véhicule'] || r['Vehicule'] || '') === veh)
    : all
  )
  .filter(r => Number(r['Km compteur'] || 0) > 0)
  .sort((a, b) => {
    const da = new Date(String(a.Date || a.Horodatage || '').replace(' ', 'T'));
    const db = new Date(String(b.Date || b.Horodatage || '').replace(' ', 'T'));
    return da - db;
  });

  if (records.length < 3) return '';

  const kmDeltas  = [];
  const dayDeltas = [];

  for (let i = 1; i < records.length; i++) {
    const km0 = Number(records[i - 1]['Km compteur'] || 0);
    const km1 = Number(records[i]['Km compteur']     || 0);
    const dk  = km1 - km0;
    if (dk > 50 && dk < 5000) {
      kmDeltas.push(dk);
      const d0 = new Date(String(records[i - 1].Date || records[i - 1].Horodatage || '').replace(' ', 'T'));
      const d1 = new Date(String(records[i].Date     || records[i].Horodatage     || '').replace(' ', 'T'));
      const dd = (d1 - d0) / 86400000;
      if (dd > 0 && dd < 120) dayDeltas.push(dd);
    }
  }

  if (kmDeltas.length < 2) return '';

  const avgKm  = Math.round(kmDeltas.reduce((s, v) => s + v, 0) / kmDeltas.length);
  const avgDay = dayDeltas.length
    ? Math.round(dayDeltas.reduce((s, v) => s + v, 0) / dayDeltas.length)
    : null;

  const lastKm = Number(records[records.length - 1]['Km compteur']);
  const nextKm = lastKm + avgKm;

  const daysStr = avgDay ? ` · ~${avgDay} j` : '';

  return `
    <div class="prediction-box">
      <span class="pred-icon">🔮</span>
      <div class="pred-content">
        <div class="pred-main">Prochain plein dans <strong>~${avgKm.toLocaleString('fr-FR')} km</strong>${daysStr}</div>
        <div class="pred-sub">vers ${nextKm.toLocaleString('fr-FR')} km · basé sur ${kmDeltas.length} plein${kmDeltas.length > 1 ? 's' : ''}</div>
      </div>
    </div>`;
}

/** Affiche les stats dans #statsBox. */
export function renderStats() {
  const el = document.getElementById('statsBox');
  if (!el) return;

  const s = computeStats();
  if (!s || s.nbPleins === 0) {
    el.innerHTML = '<div class="stats-msg">Pas assez de données pour calculer les stats.</div>';
    return;
  }

  const econClass = s.econ > 0 ? 'pos' : (s.econ < 0 ? 'neg' : '');
  const econSign  = s.econ > 0 ? '+' : '';
  const fuelTag   = s.fuelShort ? '<span class="stat-tag">' + s.fuelShort + '</span>' : '';

  const consoCell = s.nbPleinsFuel > 1
    ? `<div class="stat-val">${s.conso.toFixed(1)}</div>
       <div class="stat-unit">L / 100 km ${fuelTag}</div>`
    : `<div class="stat-val">—</div>
       <div class="stat-unit">L / 100 km ${fuelTag}</div>`;

  const coutCell = s.nbPleinsFuel > 1
    ? `<div class="stat-val">${s.coutPer100.toFixed(1)} €</div>
       <div class="stat-unit">/ 100 km ${fuelTag}</div>`
    : `<div class="stat-val">—</div>
       <div class="stat-unit">/ 100 km ${fuelTag}</div>`;

  el.innerHTML = `
    <div class="stats-grid">
      <div class="stat">${consoCell}</div>
      <div class="stat">${coutCell}</div>
      <div class="stat">
        <div class="stat-val">${s.totalCout.toFixed(0)} €</div>
        <div class="stat-unit">dépensés ${MONTHS_WINDOW} mois</div>
      </div>
      <div class="stat ${econClass}">
        <div class="stat-val">${econSign}${s.econ.toFixed(0)} €</div>
        <div class="stat-unit">éco. E85 vs SP98</div>
      </div>
    </div>
    <div class="stats-sub">${s.nbPleins} plein(s) · ${s.vehiculeName} · ${MONTHS_WINDOW} derniers mois</div>
    ${buildE85Sparkline()}
    ${buildPrediction()}
  `;
}
