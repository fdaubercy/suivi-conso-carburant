/* ─── Stats live : conso, coût, économies E85 vs SP98 + sparkline prix multi-carburant + prédiction ─── */
import { state } from './state.js';
import { FUEL_CONFIG } from './config.js';
import { getAllRecords } from './historique.js';

const MONTHS_WINDOW = 6;
const SPARK_KEY = 'suivi_e85_spark_fuels';

/* ─── W34 — Couleurs des courbes par carburant ─── */
const SPARK_COLORS = {
  E85:    '#1D9E75',
  SP98:   '#2E75B6',
  SP95:   '#60a5fa',
  E10:    '#10b981',
  GAZOLE: '#94a3b8',
  GPLC:   '#f59e0b',
};

/* ─── Colonnes GS pour les prix station ─── */
const FUEL_PRICE_COL = {
  E85:    'E85 station (€/L)',
  SP98:   'SP98 station (€/L)',
  SP95:   'SP95 station (€/L)',
  E10:    'E10 station (€/L)',
  GAZOLE: 'Gazole station (€/L)',
  GPLC:   'GPLc station (€/L)',
};

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

/* ─── LocalStorage : carburants actifs sur le sparkline ─── */
function _loadSparkFuels(availFuels) {
  try {
    const raw = localStorage.getItem(SPARK_KEY);
    if (!raw) return availFuels.includes('E85') ? ['E85'] : [availFuels[0]];
    const saved = JSON.parse(raw);
    const valid = saved.filter(k => availFuels.includes(k));
    return valid.length ? valid : (availFuels.includes('E85') ? ['E85'] : [availFuels[0]]);
  } catch { return availFuels.includes('E85') ? ['E85'] : [availFuels[0]]; }
}

function _saveSparkFuels(fuels) {
  try { localStorage.setItem(SPARK_KEY, JSON.stringify(fuels)); } catch {}
}

/* ─── Construction des séries de prix par carburant ─── */
function buildFuelSeries(records, veh) {
  const filtered = veh
    ? records.filter(r => (r['Véhicule'] || r['Vehicule'] || '') === veh)
    : records;

  const series = {};

  filtered.forEach(r => {
    const dateStr = String(r.Date || r.Horodatage || '').replace(' ', 'T');
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return;

    const isE85Plein = matchType(r.Type, 'E85');

    // E85 : Prix €/L pour les pleins E85, colonne station pour les autres
    const e85Price = isE85Plein
      ? Number(r['Prix €/L'] || 0)
      : Number(r[FUEL_PRICE_COL.E85] || 0);
    if (e85Price > 0) {
      if (!series.E85) series.E85 = [];
      series.E85.push({ date, price: e85Price });
    }

    // Autres carburants : colonnes station uniquement
    ['SP98', 'SP95', 'E10', 'GAZOLE', 'GPLC'].forEach(key => {
      const p = Number(r[FUEL_PRICE_COL[key]] || 0);
      if (p > 0) {
        if (!series[key]) series[key] = [];
        series[key].push({ date, price: p });
      }
    });
  });

  // Tri chronologique + déduplication (dernier prix par jour) + 20 points max
  Object.keys(series).forEach(key => {
    const sorted = series[key].sort((a, b) => a.date - b.date);
    const byDay = new Map();
    sorted.forEach(pt => byDay.set(pt.date.toISOString().slice(0, 10), pt));
    series[key] = Array.from(byDay.values()).slice(-20);
  });

  return series;
}

/* ─── Rendu SVG multi-courbes sur axe temporel partagé ─── */
function buildSparklineSVG(activeSeries) {
  const allPts   = activeSeries.flatMap(s => s.points);
  if (!allPts.length) return '';

  const allPrices = allPts.map(p => p.price);
  const allTimes  = allPts.map(p => p.date.getTime());

  const minP = Math.min(...allPrices);
  const maxP = Math.max(...allPrices);
  const minT = Math.min(...allTimes);
  const maxT = Math.max(...allTimes);

  const priceRange = maxP - minP || 0.01;
  const timeRange  = maxT - minT || 1;

  const W = 220, H = 52, padX = 6, padY = 6;
  const toX = t => padX + ((t  - minT) / timeRange)  * (W - 2 * padX);
  const toY = p => H - padY - ((p - minP) / priceRange) * (H - 2 * padY);

  const elements = activeSeries.map(({ points, color }) => {
    if (!points.length) return '';
    if (points.length === 1) {
      const x = toX(points[0].date.getTime()).toFixed(1);
      const y = toY(points[0].price).toFixed(1);
      return `<circle cx="${x}" cy="${y}" r="3" fill="${color}"/>`;
    }
    const pts = points.map(pt =>
      `${toX(pt.date.getTime()).toFixed(1)},${toY(pt.price).toFixed(1)}`
    ).join(' ');
    const lx = toX(points[points.length - 1].date.getTime()).toFixed(1);
    const ly = toY(points[points.length - 1].price).toFixed(1);
    return `<polyline points="${pts}" fill="none" stroke="${color}" stroke-width="1.8" stroke-linejoin="round" stroke-linecap="round"/>`
         + `<circle cx="${lx}" cy="${ly}" r="2.5" fill="${color}"/>`;
  }).join('');

  return `<svg class="spark-svg" viewBox="0 0 ${W} ${H}" width="100%" height="${H}" preserveAspectRatio="none">${elements}</svg>`;
}

/**
 * W34 — Sparkline multi-carburant avec filtres cliquables.
 * Sources : Prix €/L (pleins) + colonnes station (€/L) du Google Sheet.
 */
function buildPrixSparkline() {
  const all = getAllRecords();
  const veh = state.currentVehiculeNom;

  const series     = buildFuelSeries(all, veh);
  const availFuels = Object.keys(SPARK_COLORS).filter(k => (series[k] || []).length >= 2);

  if (!availFuels.length) return '';

  const activeFuels = _loadSparkFuels(availFuels);

  const togglesHtml = availFuels.map(k => {
    const cfg     = FUEL_CONFIG[k];
    const isActive = activeFuels.includes(k);
    const color   = SPARK_COLORS[k];
    return `<button class="spark-toggle${isActive ? ' active' : ''}" data-spark-fuel="${k}" style="--spark-color:${color}" title="${cfg.label}">${cfg.icon} ${cfg.short}</button>`;
  }).join('');

  const activeSeries = activeFuels
    .filter(k => series[k]?.length >= 1)
    .map(k => ({ key: k, points: series[k], color: SPARK_COLORS[k] }));

  const svgHtml = activeSeries.length
    ? buildSparklineSVG(activeSeries)
    : '<div class="spark-empty">Sélectionnez un carburant ci-dessus</div>';

  const footerParts = activeSeries
    .filter(s => s.points.length)
    .map(({ key, points, color }) => {
      const last = points[points.length - 1].price;
      return `<span class="spark-price-tag" style="color:${color}">${FUEL_CONFIG[key].icon} ${last.toFixed(3)} €/L</span>`;
    });
  const footerHtml = footerParts.length
    ? `<div class="spark-footer">${footerParts.join('')}</div>`
    : '';

  return `
    <div class="e85-sparkline">
      <div class="spark-header">
        <span class="spark-label">Prix carburants</span>
      </div>
      <div class="spark-toggles">${togglesHtml}</div>
      ${svgHtml}
      ${footerHtml}
    </div>`;
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

/** W33 — Calcule les données de prédiction (partagé par buildPrediction + getNextKmPrediction). */
function _computePrediction(veh) {
  const all = getAllRecords();

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

  if (records.length < 3) return null;

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

  if (kmDeltas.length < 2) return null;

  const avgKm  = Math.round(kmDeltas.reduce((s, v) => s + v, 0) / kmDeltas.length);
  const avgDay = dayDeltas.length
    ? Math.round(dayDeltas.reduce((s, v) => s + v, 0) / dayDeltas.length)
    : null;

  const lastKm = Number(records[records.length - 1]['Km compteur']);
  return { avgKm, avgDay, lastKm, nextKm: lastKm + avgKm, count: kmDeltas.length };
}

/**
 * W35 — Retourne le prochain kilométrage estimé (pour pré-remplissage du champ fKm).
 * Retourne null si pas assez de données.
 */
export function getNextKmPrediction() {
  const data = _computePrediction(state.currentVehiculeNom);
  return data ? data.nextKm : null;
}

/**
 * W33 — Prédiction prochain plein basée sur l'intervalle moyen entre pleins.
 * Renvoie '' si moins de 3 pleins disponibles.
 */
function buildPrediction() {
  const data = _computePrediction(state.currentVehiculeNom);
  if (!data) return '';

  const { avgKm, avgDay, nextKm, count } = data;

  const daysStr = avgDay ? ` · ~${avgDay} j` : '';

  return `
    <div class="prediction-box">
      <span class="pred-icon">🔮</span>
      <div class="pred-content">
        <div class="pred-main">Prochain plein dans <strong>~${avgKm.toLocaleString('fr-FR')} km</strong>${daysStr}</div>
        <div class="pred-sub">vers ${nextKm.toLocaleString('fr-FR')} km · basé sur ${count} plein${count > 1 ? 's' : ''}</div>
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
    ${buildPrixSparkline()}
    ${buildPrediction()}
  `;
}

/**
 * W34 — Câble les boutons de filtre du sparkline multi-carburant.
 * Délégation sur #statsBox — à appeler une seule fois depuis main.js.
 */
export function initSparkToggles() {
  document.getElementById('statsBox')?.addEventListener('click', e => {
    const btn = e.target.closest('[data-spark-fuel]');
    if (!btn) return;

    const fuel = btn.dataset.sparkFuel;
    const series = buildFuelSeries(getAllRecords(), state.currentVehiculeNom);
    const availFuels = Object.keys(SPARK_COLORS).filter(k => (series[k] || []).length >= 2);

    let active = _loadSparkFuels(availFuels);
    if (active.includes(fuel)) {
      active = active.filter(k => k !== fuel);
    } else {
      active = [...active, fuel];
    }
    if (!active.length) return;

    _saveSparkFuels(active);
    renderStats();
  });
}
