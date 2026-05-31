/* ─── Stats live : conso, coût, économies E85 vs SP98 + sparkline prix multi-carburant + prédiction ─── */
import { state } from './state.js';
import { FUEL_CONFIG, DEFAULT_SURCONSO, KIT_PRIX_KEY, DEFAULT_KIT_PRIX,
         BUDGET_KEY, CO2_ESSENCE_PER_L, CO2_E85_PER_L,
         CO2_OBJECTIF_KEY, DEFAULT_CO2_OBJECTIF, CO2_THERMIQUE_PER_KM, CO2_ARBRE_PAR_AN } from './config.js';
import { getAllRecords, forceRefreshHistorique } from './historique.js';
import { renderComparatif } from './comparatif.js';
import { getCachedServerStats, getServerStats } from './statsApi.js';

/* ─── Prix du kit de conversion (localStorage, défaut = cellule B5 Excel) ─── */
export function getKitPrix() {
  const raw = localStorage.getItem(KIT_PRIX_KEY);
  const n = Number(raw);
  return raw != null && raw !== '' && isFinite(n) && n >= 0 ? n : DEFAULT_KIT_PRIX;
}

/* ─── W39 — Objectif de budget carburant mensuel (€, localStorage) ───
   0 / vide / invalide = budget désactivé (aucune barre affichée). */
export function getBudgetMensuel() {
  const n = Number(localStorage.getItem(BUDGET_KEY));
  return isFinite(n) && n > 0 ? n : 0;
}

/* ─── W51 — Objectif CO₂ annuel évité (kg, localStorage) ───
   Vide / invalide = valeur par défaut DEFAULT_CO2_OBJECTIF. */
export function getObjectifCo2() {
  const raw = localStorage.getItem(CO2_OBJECTIF_KEY);
  const n = Number(raw);
  return raw != null && raw !== '' && isFinite(n) && n > 0 ? n : DEFAULT_CO2_OBJECTIF;
}

/** Clé 'YYYY-MM' du mois courant. */
function _currentMonthKey() {
  const t = new Date();
  return t.getFullYear() + '-' + String(t.getMonth() + 1).padStart(2, '0');
}

/* ─── Surconsommation E85 dynamique (cellule J7 Excel) ───
   conso moyenne E85 / conso moyenne S98 − 1, calculée à partir des pleins.
   Défaut DEFAULT_SURCONSO si pas de données S98 exploitables. */
function computeSurconso(records) {
  const sorted = records
    .filter(r => Number(r['Km compteur'] || 0) > 0)
    .sort((a, b) => {
      const da = new Date(String(a.Date || a.Horodatage || '').replace(' ', 'T'));
      const db = new Date(String(b.Date || b.Horodatage || '').replace(' ', 'T'));
      return da - db;
    });
  const consoE85 = [], consoS98 = [];
  for (let i = 1; i < sorted.length; i++) {
    const km0 = Number(sorted[i - 1]['Km compteur'] || 0);
    const km1 = Number(sorted[i]['Km compteur'] || 0);
    const lit = Number(sorted[i]['Nb. Litres'] || 0);
    const dk  = km1 - km0;
    if (dk <= 0 || lit <= 0) continue;
    const conso = (lit / dk) * 100;
    if (matchType(sorted[i].Type, 'E85')) consoE85.push(conso);
    else if (matchType(sorted[i].Type, 'SP98')) consoS98.push(conso);
  }
  if (!consoE85.length || !consoS98.length) return DEFAULT_SURCONSO;
  const avg = a => a.reduce((s, v) => s + v, 0) / a.length;
  const s = avg(consoE85) / avg(consoS98) - 1;
  return isFinite(s) && s > 0 ? s : DEFAULT_SURCONSO;
}

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
  try { localStorage.setItem(SPARK_KEY, JSON.stringify(fuels)); } catch { /* quota / navigation privée */ }
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
  const availFuels = Object.keys(SPARK_COLORS).filter(k => (series[k] || []).length >= 1);

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
        <button class="spark-refresh-btn" data-spark-refresh title="Recharger les prix depuis le serveur">🔄</button>
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

  // Économie E85 vs SP98 — méthode du dashboard Excel (feuille « Suivi Carburant ») :
  //   • sur TOUS les pleins E85 (pas la fenêtre 6 mois) pour refléter le ROI cumulé du kit ;
  //   • surconsommation E85 dynamique → litres SP98 équivalents = litres / (1 + surconso) ;
  //   • un plein E85 sans prix SP98 enregistré utilise le prix SP98 moyen connu
  //     (dans Excel chaque plein a toujours un « Prix S98 jour » ; on évite ainsi de
  //     sous-estimer l'économie quand le Google Sheet a une cellule SP98 vide).
  const surconso = computeSurconso(byVeh);
  const e85Pleins = byVeh.filter(r =>
    matchType(r.Type, 'E85') && Number(r['Prix €/L']) > 0 && Number(r['Nb. Litres']) > 0
  );
  // Prix SP98 moyen sur les pleins E85 qui en ont un (repli pour les autres)
  const sp98Connus = e85Pleins
    .map(r => Number(r['SP98 station (€/L)']) || 0)
    .filter(p => p > 0);
  const sp98Moyen = sp98Connus.length
    ? sp98Connus.reduce((s, p) => s + p, 0) / sp98Connus.length
    : 0;

  let totCoutE85 = 0, totCoutSP98Equiv = 0;
  e85Pleins.forEach(r => {
    const prix = Number(r['Prix €/L']);
    const lit  = Number(r['Nb. Litres']);
    const sp98 = (Number(r['SP98 station (€/L)']) || 0) || sp98Moyen;
    totCoutE85      += lit * prix;
    totCoutSP98Equiv += (lit / (1 + surconso)) * sp98;
  });

  const econBrute = totCoutSP98Equiv - totCoutE85;   // = J30 (J29 − B35)
  const kitPrix   = getKitPrix();                    // = B5
  const econNette = econBrute - kitPrix;             // = J31

  // W40 — CO₂ évité par l'E85 vs essence, à distance égale (cumul tous pleins E85).
  //   litres essence équivalents = litres E85 / (1 + surconso) ;
  //   CO₂ évité = essenceEquiv × CO2_ESSENCE − litresE85 × CO2_E85.
  const totLitresE85 = e85Pleins.reduce((s, r) => s + (Number(r['Nb. Litres']) || 0), 0);
  const essenceEquivL = totLitresE85 / (1 + surconso);
  const co2Evite = essenceEquivL * CO2_ESSENCE_PER_L - totLitresE85 * CO2_E85_PER_L;

  return {
    fuelKey,
    fuelShort: fuelCfg?.short || '',
    conso: consoFuel,
    coutPer100,
    nbPleinsFuel: byFuel.length,
    totalCout,
    econBrute,
    econNette,
    kitPrix,
    surconso,
    co2Evite,
    totLitresE85,
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

  const lastRecord = records[records.length - 1];
  const lastKm   = Number(lastRecord['Km compteur']);
  const lastDateRaw = String(lastRecord.Date || lastRecord.Horodatage || '').replace(' ', 'T');
  const lastDate = new Date(lastDateRaw);
  return {
    avgKm, avgDay, lastKm,
    nextKm: lastKm + avgKm,
    count: kmDeltas.length,
    lastDate: isNaN(lastDate.getTime()) ? null : lastDate,
  };
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

  const { avgKm, avgDay, nextKm, count, lastDate } = data;

  let mainText;
  if (avgDay && lastDate) {
    const daysElapsed  = (Date.now() - lastDate.getTime()) / 86400000;
    const daysLeft     = avgDay - daysElapsed;
    const kmLeft       = avgKm  - daysElapsed * (avgKm / avgDay);

    if (daysLeft > 1) {
      mainText = `Prochain plein dans <strong>~${Math.round(kmLeft).toLocaleString('fr-FR')} km</strong> · ~${Math.round(daysLeft)} j`;
    } else if (daysLeft > 0) {
      mainText = `Prochain plein dans <strong>~${Math.round(kmLeft).toLocaleString('fr-FR')} km</strong> · aujourd'hui`;
    } else {
      const overdue = Math.round(-daysLeft);
      mainText = `Plein prévu <strong>il y a ${overdue} j</strong>`;
    }
  } else {
    mainText = `Prochain plein dans <strong>~${avgKm.toLocaleString('fr-FR')} km</strong>`;
  }

  return `
    <div class="prediction-box">
      <span class="pred-icon">🔮</span>
      <div class="pred-content">
        <div class="pred-main">${mainText}</div>
        <div class="pred-sub">vers ${nextKm.toLocaleString('fr-FR')} km · basé sur ${count} plein${count > 1 ? 's' : ''}</div>
      </div>
    </div>`;
}

/** Affiche les stats dans #statsBox. */
export function renderStats() {
  renderRapportMensuel();          // rafraîchit aussi le rapport mensuel consultable
  const el = document.getElementById('statsBox');
  if (!el) return;

  const s = computeStats();
  if (!s || s.nbPleins === 0) {
    el.innerHTML = '<div class="stats-msg">Pas assez de données pour calculer les stats.</div>';
    return;
  }

  const bruteClass = s.econBrute > 0 ? 'pos' : (s.econBrute < 0 ? 'neg' : '');
  const bruteSign  = s.econBrute > 0 ? '+' : '';
  const netClass   = s.econNette > 0 ? 'pos' : (s.econNette < 0 ? 'neg' : '');
  const netSign    = s.econNette > 0 ? '+' : '';
  const fuelTag    = s.fuelShort ? '<span class="stat-tag">' + s.fuelShort + '</span>' : '';

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
      <div class="stat ${bruteClass}">
        <div class="stat-val">${bruteSign}${s.econBrute.toFixed(0)} €</div>
        <div class="stat-unit">éco. brute E85</div>
      </div>
    </div>
    <div class="stats-sub">${s.nbPleins} plein(s) · ${s.vehiculeName} · ${MONTHS_WINDOW} derniers mois</div>
    <div class="econ-net ${netClass}">
      <span class="econ-net-label">💰 Économie nette</span>
      <span class="econ-net-val">${netSign}${s.econNette.toFixed(0)} €</span>
      <span class="econ-net-sub">brute ${s.econBrute.toFixed(0)} € − kit ${s.kitPrix.toFixed(2)} € · surconso +${Math.round(s.surconso * 100)}% · total</span>
    </div>
    ${buildCO2Tile(s)}
    ${buildCo2Annuel()}
    ${buildCo2Monthly()}
    ${buildBudgetBar()}
    ${buildBudgetTrend()}
    ${buildPrixSparkline()}
    ${buildPrediction()}
  `;

  renderComparatif();   // W41 — graphe comparatif inter-véhicules (vue Stats)
  renderServerSummary();   // W59 — résumé annuel pré-agrégé (serveur)
}

/* ─── W59 — Résumé annuel pré-agrégé côté serveur (endpoint GAS S12) ───
   Affichage instantané depuis le cache, puis rafraîchi en tâche de fond.
   Repli local si l'endpoint n'est pas (encore) déployé. */
function _serverSummaryHTML(d) {
  if (!d || !d.kpis) return '';
  const k = d.kpis;
  const cells = [
    ['Pleins', k.pleins ?? '—'],
    ['Litres', (k.litres != null ? Math.round(k.litres) : '—') + ' L'],
    ['Dépensé', (k.cost != null ? k.cost : '—') + ' €'],
    ['Km', (k.km != null ? k.km : '—') + ' km'],
  ].map(([lab, val]) => `<div class="srv-kpi"><div class="srv-kpi-val">${val}</div><div class="srv-kpi-lab">${lab}</div></div>`).join('');
  const station = k.station ? `<div class="srv-station">⛽ Station préférée : <strong>${escHtmlLocal(k.station)}</strong></div>` : '';
  return `
    <p class="section-title">Bilan ${k.year || ''} <span class="srv-badge" title="Agrégé côté serveur (Apps Script), mis en cache 1 h">⚡ serveur</span></p>
    <div class="srv-grid">${cells}</div>
    ${station}`;
}

function escHtmlLocal(s) {
  return String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
}

/** Repli local : KPIs annuels calculés depuis getAllRecords (si pas de serveur). */
function _localAnnualKpis(veh) {
  const all = getAllRecords();
  if (!all.length) return null;
  const byVeh = veh ? all.filter(r => (r['Véhicule'] || r['Vehicule'] || '') === veh) : all;
  let yearMax = 0;
  byVeh.forEach(r => {
    const dt = new Date(String(r.Date || r.Horodatage || '').replace(' ', 'T'));
    if (!isNaN(dt) && dt.getFullYear() > yearMax) yearMax = dt.getFullYear();
  });
  if (!yearMax) return null;
  const yr = byVeh.filter(r => {
    const dt = new Date(String(r.Date || r.Horodatage || '').replace(' ', 'T'));
    return !isNaN(dt) && dt.getFullYear() === yearMax;
  });
  const kmByVeh = {}, stationCnt = {};
  let litres = 0, cost = 0;
  yr.forEach(r => {
    litres += Number(r['Nb. Litres'] || 0);
    cost   += Number(r['Nb. Litres'] || 0) * Number(r['Prix €/L'] || 0);
    const st = String(r['Station essence'] || '').trim();
    if (st) stationCnt[st] = (stationCnt[st] || 0) + 1;
    const km = Number(r['Km compteur'] || 0);
    if (km > 0) {
      const v = r['Véhicule'] || r['Vehicule'] || '';
      const o = kmByVeh[v] || (kmByVeh[v] = { min: km, max: km });
      if (km < o.min) o.min = km; if (km > o.max) o.max = km;
    }
  });
  let km = 0; Object.values(kmByVeh).forEach(o => { km += o.max - o.min; });
  let station = '', top = -1;
  Object.entries(stationCnt).forEach(([s, n]) => { if (n > top) { top = n; station = s; } });
  return { kpis: { year: yearMax, pleins: yr.length, litres: Math.round(litres), cost: Math.round(cost), km: Math.round(km), station } };
}

export function renderServerSummary() {
  const el = document.getElementById('serverSummary');
  if (!el) return;
  const veh = state.currentVehiculeNom || '';

  const cached = getCachedServerStats(veh) || _localAnnualKpis(veh);
  const html = _serverSummaryHTML(cached);
  if (html) { el.innerHTML = html; el.classList.remove('hidden'); }
  else { el.classList.add('hidden'); }

  // Rafraîchissement serveur en tâche de fond (silencieux si endpoint absent)
  getServerStats(veh).then(d => {
    const h = _serverSummaryHTML(d);
    if (h) { el.innerHTML = h; el.classList.remove('hidden'); }
  }).catch(() => { /* repli déjà affiché */ });
}

/* ─── W40 — Tuile « kg CO₂ évités » (cumul des pleins E85) ─── */
function buildCO2Tile(s) {
  if (!s || !(s.totLitresE85 > 0) || !(s.co2Evite > 0)) return '';
  const kg = s.co2Evite;
  const val = kg >= 1000 ? (kg / 1000).toFixed(2) + ' t' : kg.toFixed(0) + ' kg';
  return `
    <div class="co2-tile">
      <span class="co2-ico">🌱</span>
      <div class="co2-content">
        <div class="co2-main"><strong>${val}</strong> de CO₂ évités</div>
        <div class="co2-sub">E85 vs essence (≈ −50 % à la combustion) · ${s.totLitresE85.toFixed(0)} L E85 · distance égale</div>
      </div>
    </div>`;
}

/* ─── W51 — CO₂ évité sur l'année en cours (cumul des pleins E85) ───
   Même méthode que computeStats (distance égale), restreint à l'année courante
   et au véhicule sélectionné. */
function computeCo2Annuel() {
  const all = getAllRecords();
  const veh = state.currentVehiculeNom;
  const byVeh = veh ? all.filter(r => (r['Véhicule'] || r['Vehicule'] || '') === veh) : all;

  const year = new Date().getFullYear();
  const surconso = computeSurconso(byVeh);

  const e85Annee = byVeh.filter(r => {
    if (!matchType(r.Type, 'E85') || !(Number(r['Nb. Litres']) > 0)) return false;
    const d = new Date(String(r.Date || r.Horodatage || '').replace(' ', 'T'));
    return !isNaN(d) && d.getFullYear() === year;
  });

  const totLitresE85 = e85Annee.reduce((s, r) => s + (Number(r['Nb. Litres']) || 0), 0);
  const essenceEquivL = totLitresE85 / (1 + surconso);
  const co2 = essenceEquivL * CO2_ESSENCE_PER_L - totLitresE85 * CO2_E85_PER_L;

  return { year, co2, totLitresE85 };
}

/* ─── W51 — Jauge « X kg CO₂ évités cette année » + objectif + équivalents parlants ─── */
function buildCo2Annuel() {
  const { year, co2 } = computeCo2Annuel();
  if (!(co2 > 0)) return '';

  const obj   = getObjectifCo2();
  const pct   = Math.min(100, (co2 / obj) * 100);
  const w     = pct.toFixed(0);
  const atteint = co2 >= obj;
  const cls   = atteint ? 'done' : (pct >= 70 ? 'near' : 'go');

  const kmTherm = Math.round(co2 / CO2_THERMIQUE_PER_KM);
  const arbres  = co2 / CO2_ARBRE_PAR_AN;
  const arbresTxt = arbres >= 1
    ? `${Math.round(arbres)} arbre${arbres >= 2 ? 's' : ''} sur un an`
    : `${(arbres * 12).toFixed(0)} mois d'absorption d'un arbre`;

  const right = atteint
    ? `<span class="co2y-done">🎉 objectif atteint</span>`
    : `<span class="co2y-left">reste ${(obj - co2).toFixed(0)} kg</span>`;

  return `
    <div class="co2y-box ${cls}">
      <div class="co2y-head">
        <span class="co2y-label">🌍 CO₂ évité ${year}</span>
        <span class="co2y-amount">${co2.toFixed(0)} / ${obj.toFixed(0)} kg</span>
      </div>
      <div class="co2y-track gauge-track">
        <div class="co2y-fill" style="width:${w}%"></div>
        <span class="gauge-tick" style="left:50%"></span>
      </div>
      <div class="gauge-scale"><span>0</span><span>50 %</span><span class="gauge-target">🎯 ${obj.toFixed(0)} kg · 100 %</span></div>
      <div class="co2y-foot">${right} · ${Math.round(pct)} %</div>
      <div class="co2y-equiv">≈ <strong>${kmTherm.toLocaleString('fr-FR')} km</strong> de conduite thermique évités · ${arbresTxt} 🌳</div>
    </div>`;
}

/* ─── W55 — CO₂ évité mois par mois sur l'année en cours (cumul) ───
   Décline l'objectif annuel en cible mensuelle (objectif / 12) et calcule le
   CO₂ évité par mois (même méthode « distance égale » que computeCo2Annuel),
   restreint au véhicule courant et à l'année en cours. */
function computeCo2Monthly() {
  const all = getAllRecords();
  const veh = state.currentVehiculeNom;
  const byVeh = veh ? all.filter(r => (r['Véhicule'] || r['Vehicule'] || '') === veh) : all;

  const year = new Date().getFullYear();
  const surconso = computeSurconso(byVeh);

  const litresParMois = Array(12).fill(0);
  byVeh.forEach(r => {
    if (!matchType(r.Type, 'E85')) return;
    const lit = Number(r['Nb. Litres']) || 0;
    if (!(lit > 0)) return;
    const d = new Date(String(r.Date || r.Horodatage || '').replace(' ', 'T'));
    if (isNaN(d) || d.getFullYear() !== year) return;
    litresParMois[d.getMonth()] += lit;
  });

  const co2ParMois = litresParMois.map(L =>
    (L / (1 + surconso)) * CO2_ESSENCE_PER_L - L * CO2_E85_PER_L);

  return { year, co2ParMois, surconso };
}

/* ─── W55 — Courbe cumulée du CO₂ évité + trajectoire d'objectif mensuel ───
   Ligne SVG du cumul réel (Jan → mois courant) vs droite d'objectif linéaire
   (cible mensuelle = objectif annuel / 12). Affichée si au moins un mois > 0. */
function buildCo2Monthly() {
  const { year, co2ParMois } = computeCo2Monthly();
  if (!co2ParMois.some(v => v > 0)) return '';

  const obj      = getObjectifCo2();
  const cibleMois = obj / 12;
  const moisCourant = (new Date().getFullYear() === year) ? new Date().getMonth() : 11;
  const n = moisCourant + 1;                       // Jan..mois courant inclus

  // Cumul réel mois par mois
  const cumul = [];
  let acc = 0;
  for (let i = 0; i < n; i++) { acc += co2ParMois[i]; cumul.push(acc); }
  const cumulFinal = acc;

  // Échelle : max du cumul réel et de la trajectoire d'objectif sur la période
  const objLine = cibleMois * n;
  const maxV = Math.max(cumulFinal, objLine, cibleMois) || 1;

  const W = 240, H = 76, padT = 8, padB = 16, padL = 4, padR = 4;
  const plotW = W - padL - padR, plotH = H - padT - padB;
  const toX = i => (n === 1 ? padL + plotW / 2 : padL + (i / (n - 1)) * plotW);
  const toY = v => padT + (1 - v / maxV) * plotH;

  // Droite d'objectif (0 → cibleMois×(n)) : du début du mois 0 à la fin du mois n-1
  const objY0 = toY(cibleMois).toFixed(1);         // fin du 1er mois
  const objYn = toY(objLine).toFixed(1);           // fin du dernier mois
  const objLineSvg = `<line x1="${toX(0).toFixed(1)}" y1="${objY0}" x2="${toX(n - 1).toFixed(1)}" y2="${objYn}" class="co2m-objline"/>`;

  // Polyligne du cumul réel + point final
  const pts = cumul.map((v, i) => `${toX(i).toFixed(1)},${toY(v).toFixed(1)}`).join(' ');
  const lastX = toX(n - 1).toFixed(1), lastY = toY(cumulFinal).toFixed(1);
  const lineSvg = n > 1
    ? `<polyline points="${pts}" fill="none" class="co2m-line"/><circle cx="${lastX}" cy="${lastY}" r="2.6" class="co2m-dot"/>`
    : `<circle cx="${lastX}" cy="${lastY}" r="3" class="co2m-dot"/>`;

  // Étiquettes de mois (3 lettres), une sur deux si trop de mois
  const step = n > 8 ? 2 : 1;
  const labels = cumul.map((_, i) =>
    (i % step === 0 || i === n - 1)
      ? `<text x="${toX(i).toFixed(1)}" y="${H - 4}" class="co2m-mlbl">${MOIS_FR_LONG[i].slice(0, 3)}</text>`
      : '').join('');

  const tempo = cumulFinal >= objLine ? 'ahead' : 'behind';
  const tempoTxt = cumulFinal >= objLine
    ? `✅ en avance sur la cible (${objLine.toFixed(0)} kg attendus)`
    : `reste ${(objLine - cumulFinal).toFixed(0)} kg pour suivre la cible`;

  return `
    <div class="co2m-box ${tempo}">
      <div class="co2m-head">
        <span class="co2m-label">🌿 CO₂ évité — cumul ${year}</span>
        <span class="co2m-cible">🎯 ${cibleMois.toFixed(0)} kg/mois</span>
      </div>
      <svg class="co2m-svg" viewBox="0 0 ${W} ${H}" width="100%" height="${H}" preserveAspectRatio="none">
        ${objLineSvg}
        ${lineSvg}
        ${labels}
      </svg>
      <div class="co2m-foot">${cumulFinal.toFixed(0)} kg cumulés · ${tempoTxt}</div>
    </div>`;
}

/* ─── W56 — Projection de dépassement du budget au rythme du mois en cours ───
   À partir de la dépense cumulée et des jours écoulés, projette la dépense de
   fin de mois et la date de franchissement du budget. Fonction pure (testable).
   Renvoie null si pas de dépassement prévu ou pas assez de données.
     spent        : dépense cumulée du mois (€)
     daysElapsed  : jours écoulés dans le mois (≈ jour du mois, ≥ 1)
     daysInMonth  : nombre de jours du mois
     budget       : objectif mensuel (€)
   → { projected, crossDay, rate } */
export function computeBudgetForecast(spent, daysElapsed, daysInMonth, budget) {
  if (!(budget > 0) || !(spent > 0) || !(daysElapsed >= 2) || spent >= budget) return null;
  const rate      = spent / daysElapsed;          // €/jour à ce rythme
  const projected = rate * daysInMonth;           // dépense estimée en fin de mois
  if (projected <= budget) return null;           // budget tenu au rythme actuel
  const crossDay = Math.ceil(budget / rate);      // jour du mois où le budget est franchi
  if (crossDay > daysInMonth) return null;
  return { projected, crossDay, rate };
}

/* ─── W39 — Barre de progression du budget carburant mensuel ───
   Compare la dépense du mois courant (véhicule sélectionné) à l'objectif €.
   W56 — ajoute une alerte anticipée « budget dépassé le JJ/MM » au rythme actuel. */
function buildBudgetBar() {
  const budget = getBudgetMensuel();
  const r = buildMonthlyReport(_currentMonthKey());
  const spent = r.nbPleins ? (r.totalCout || 0) : 0;

  // W39 — état vide : aucun budget défini. Plutôt que de masquer silencieusement
  // la section (l'utilisateur ne comprend pas pourquoi elle manque), on invite à
  // en définir un — uniquement s'il y a des dépenses ce mois-ci. Le lien ouvre
  // Réglages et focalise le champ (data-focus, géré dans main.js).
  if (!budget) {
    if (spent <= 0) return '';
    return `
      <div class="budget-box hint">
        <div class="budget-head">
          <span class="budget-label">🎯 Budget ${r.label}</span>
          <span class="budget-amount">${spent.toFixed(0)} € ce mois</span>
        </div>
        <a class="budget-hint-link" href="#/params" data-focus="budgetMensuel">
          💡 Définissez un budget mensuel dans ⚙️ Réglages pour suivre vos dépenses et activer l'alerte de dépassement →
        </a>
      </div>`;
  }
  const pct   = (spent / budget) * 100;
  const over  = spent > budget;
  const cls   = over ? 'over' : (pct >= 80 ? 'warn' : 'ok');
  const w     = Math.min(100, Math.max(0, pct)).toFixed(0);

  const right = over
    ? `<span class="budget-over">⚠️ +${(spent - budget).toFixed(0)} € au-dessus</span>`
    : `<span class="budget-left">reste ${(budget - spent).toFixed(0)} €</span>`;

  // W56 — alerte anticipée (uniquement si pas encore dépassé)
  let forecastHtml = '';
  if (!over) {
    const now  = new Date();
    const dim  = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
    const fc   = computeBudgetForecast(spent, now.getDate(), dim, budget);
    if (fc) {
      const dd = String(fc.crossDay).padStart(2, '0');
      const mm = String(now.getMonth() + 1).padStart(2, '0');
      forecastHtml = `<div class="budget-forecast">⏰ À ce rythme, budget dépassé le <strong>${dd}/${mm}</strong> · ≈ ${fc.projected.toFixed(0)} € en fin de mois</div>`;
    }
  }

  return `
    <div class="budget-box ${cls}">
      <div class="budget-head">
        <span class="budget-label">🎯 Budget ${r.label}</span>
        <span class="budget-amount">${spent.toFixed(0)} / ${budget.toFixed(0)} €</span>
      </div>
      <div class="budget-track gauge-track">
        <div class="budget-fill" style="width:${w}%"></div>
        <span class="gauge-tick" style="left:50%"></span>
      </div>
      <div class="gauge-scale"><span>0</span><span>50 %</span><span class="gauge-target">🎯 ${budget.toFixed(0)} € · 100 %</span></div>
      <div class="budget-foot">${right} · ${Math.round(pct)} %</div>
      ${forecastHtml}
    </div>`;
}

/* ─── W50 — Tendance du budget : dépenses des 6 derniers mois + ligne d'objectif ───
   Mini histogramme SVG (réutilise buildMonthlyReport mois par mois). Affiché
   uniquement si un budget est défini et qu'au moins un mois a des dépenses. */
function buildBudgetTrend() {
  const budget = getBudgetMensuel();
  if (!budget) return '';

  // 6 derniers mois, du plus ancien au plus récent
  const now = new Date();
  const data = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const key = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0');
    const r = buildMonthlyReport(key);
    data.push({
      spent: r.nbPleins ? (r.totalCout || 0) : 0,
      mois:  MOIS_FR_LONG[d.getMonth()].slice(0, 3),
    });
  }
  if (!data.some(d => d.spent > 0)) return '';

  const maxV = Math.max(budget, ...data.map(d => d.spent)) || 1;
  const W = 240, H = 70, padT = 8, padB = 16, n = data.length;
  const slot = W / n, bw = slot * 0.5;
  const plotH = H - padT - padB;
  const toY = v => padT + (1 - v / maxV) * plotH;
  const objY = toY(budget).toFixed(1);

  const bars = data.map((d, i) => {
    const x = (i * slot + (slot - bw) / 2).toFixed(1);
    const y = toY(d.spent).toFixed(1);
    const h = Math.max(0, padT + plotH - parseFloat(y)).toFixed(1);
    const fill = d.spent > budget ? '#ef4444' : '#1D9E75';
    const label = `<text x="${(i * slot + slot / 2).toFixed(1)}" y="${H - 4}" class="trend-mlbl">${d.mois}</text>`;
    const bar = d.spent > 0
      ? `<rect x="${x}" y="${y}" width="${bw.toFixed(1)}" height="${h}" rx="2" fill="${fill}"/>`
      : '';
    return bar + label;
  }).join('');

  return `
    <div class="trend-box">
      <div class="trend-head">
        <span class="trend-label">📈 Tendance 6 mois</span>
        <span class="trend-obj">objectif ${budget.toFixed(0)} €</span>
      </div>
      <svg class="trend-svg" viewBox="0 0 ${W} ${H}" width="100%" height="${H}" preserveAspectRatio="none">
        <line x1="0" y1="${objY}" x2="${W}" y2="${objY}" class="trend-objline"/>
        ${bars}
      </svg>
    </div>`;
}

/* ════════════════════════════════════════════════════════════
   RAPPORT MENSUEL CONSULTABLE (réplique le mail GAS RapportMensuel.gs)
   ════════════════════════════════════════════════════════════ */
const MOIS_FR_LONG = ['Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
                      'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'];

function _monthKey(r) {
  const d = new Date(String(r.Date || r.Horodatage || '').replace(' ', 'T'));
  if (isNaN(d)) return null;
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0');
}
function _monthLabel(key) {
  const [y, m] = key.split('-').map(Number);
  return MOIS_FR_LONG[m - 1] + ' ' + y;
}

/** Mois présents dans l'historique (clé 'YYYY-MM'), du plus récent au plus ancien. */
export function getReportMonths() {
  const veh = state.currentVehiculeNom;
  const all = getAllRecords();
  const rows = veh ? all.filter(r => (r['Véhicule'] || r['Vehicule'] || '') === veh) : all;
  const set = new Set();
  rows.forEach(r => { const k = _monthKey(r); if (k) set.add(k); });
  return [...set].sort().reverse();
}

/** Bilan d'un mois 'YYYY-MM' pour le véhicule courant (mêmes calculs que le mail). */
export function buildMonthlyReport(monthKey) {
  const veh = state.currentVehiculeNom;
  const all = getAllRecords();
  const byVeh = veh ? all.filter(r => (r['Véhicule'] || r['Vehicule'] || '') === veh) : all;
  const rows = byVeh.filter(r => _monthKey(r) === monthKey);
  if (!rows.length) return { monthKey, label: _monthLabel(monthKey), nbPleins: 0 };

  let nbPleins = 0, totalCout = 0, totalLitres = 0, nbE85 = 0;
  let kmMin = Infinity, kmMax = -Infinity;
  rows.forEach(r => {
    const lit  = Number(r['Nb. Litres']) || 0;
    const prix = Number(r['Prix €/L']) || 0;
    const km   = Number(r['Km compteur']) || 0;
    if (lit > 0 && prix > 0) { nbPleins++; totalCout += lit * prix; totalLitres += lit; }
    if (km > 0) { kmMin = Math.min(kmMin, km); kmMax = Math.max(kmMax, km); }
    if (matchType(r.Type, 'E85')) nbE85++;
  });
  const kmParcourus = (kmMax > kmMin) ? (kmMax - kmMin) : 0;
  const consoMoy = kmParcourus > 0 ? (totalLitres / kmParcourus) * 100 : 0;

  // Prix SP98 de repli sur TOUT l'historique : pleins E85 avec prix SP98 relevé
  // + prix payé des pleins Super 98 (dont le prix EST un prix SP98).
  const surconso = computeSurconso(byVeh);
  const sp98Refs = [];
  byVeh.forEach(r => {
    if (matchType(r.Type, 'E85')) {
      const s = Number(r['SP98 station (€/L)']) || 0;
      if (s > 0) sp98Refs.push(s);
    } else if (matchType(r.Type, 'SP98')) {
      const p = Number(r['Prix €/L']) || 0;
      if (p > 0) sp98Refs.push(p);
    }
  });
  const sp98Moyen = sp98Refs.length ? sp98Refs.reduce((s, p) => s + p, 0) / sp98Refs.length : 0;

  let coutE85 = 0, coutSp98Equiv = 0;
  rows.forEach(r => {
    if (!matchType(r.Type, 'E85')) return;
    const lit  = Number(r['Nb. Litres']) || 0;
    const prix = Number(r['Prix €/L']) || 0;
    if (lit <= 0 || prix <= 0) return;
    const sp98 = (Number(r['SP98 station (€/L)']) || 0) || sp98Moyen;
    coutE85 += lit * prix;
    if (sp98 > 0) coutSp98Equiv += (lit / (1 + surconso)) * sp98;
  });
  const econBrute = coutSp98Equiv - coutE85;

  return { monthKey, label: _monthLabel(monthKey), nbPleins, nbE85,
           totalCout, totalLitres, kmParcourus, consoMoy, econBrute, surconso };
}

/** Affiche le rapport mensuel dans #rapportBox et (re)peuple le sélecteur de mois. */
export function renderRapportMensuel() {
  const box = document.getElementById('rapportBox');
  if (!box) return;
  const sel = document.getElementById('rapportMois');

  const months = getReportMonths();
  if (!months.length) {
    if (sel) sel.innerHTML = '';
    box.innerHTML = '<div class="stats-msg">Aucun plein enregistré.</div>';
    return;
  }

  if (sel) {
    const prev = sel.value;
    sel.innerHTML = months.map(k => `<option value="${k}">${_monthLabel(k)}</option>`).join('');
    sel.value = months.includes(prev) ? prev : months[0];
  }
  const key = (sel && sel.value) || months[0];
  const s = buildMonthlyReport(key);

  if (!s.nbPleins) {
    box.innerHTML = `<div class="stats-msg">Aucun plein en ${s.label}.</div>`;
    return;
  }

  const ecoClass = s.nbE85 ? (s.econBrute > 0 ? 'pos' : (s.econBrute < 0 ? 'neg' : '')) : '';
  const ecoSign  = s.econBrute > 0 ? '+' : '';
  const ecoCell  = s.nbE85
    ? `<div class="stat-val">${ecoSign}${s.econBrute.toFixed(0)} €</div>
       <div class="stat-unit">éco. E85 vs SP98</div>`
    : `<div class="stat-val">—</div>
       <div class="stat-unit">aucun plein E85</div>`;

  box.innerHTML = `
    <div class="stats-grid">
      <div class="stat">
        <div class="stat-val">${s.nbPleins}</div>
        <div class="stat-unit">plein(s)${s.nbE85 ? ' · ' + s.nbE85 + ' E85' : ''}</div>
      </div>
      <div class="stat">
        <div class="stat-val">${s.totalCout.toFixed(0)} €</div>
        <div class="stat-unit">dépensés</div>
      </div>
      <div class="stat">
        <div class="stat-val">${s.totalLitres.toFixed(1)}</div>
        <div class="stat-unit">litres</div>
      </div>
      <div class="stat">
        <div class="stat-val">${s.kmParcourus.toLocaleString('fr-FR')}</div>
        <div class="stat-unit">km parcourus</div>
      </div>
      <div class="stat">
        <div class="stat-val">${s.consoMoy > 0 ? s.consoMoy.toFixed(1) : '—'}</div>
        <div class="stat-unit">L / 100 km</div>
      </div>
      <div class="stat ${ecoClass}">${ecoCell}</div>
    </div>
    <div class="stats-sub">${s.label} · ${state.currentVehiculeNom || 'tous véhicules'}</div>`;
}

/** Câble le sélecteur de mois du rapport. À appeler une fois depuis main.js. */
export function initRapport() {
  document.getElementById('rapportMois')?.addEventListener('change', () => renderRapportMensuel());
}

/**
 * W34 — Câble les boutons de filtre du sparkline multi-carburant.
 * Délégation sur #statsBox — à appeler une seule fois depuis main.js.
 */
export function initSparkToggles() {
  document.getElementById('statsBox')?.addEventListener('click', e => {
    if (e.target.closest('[data-spark-refresh]')) {
      const btn = e.target.closest('[data-spark-refresh]');
      btn.textContent = '⏳';
      btn.disabled = true;
      forceRefreshHistorique().finally(() => renderStats());
      return;
    }

    const btn = e.target.closest('[data-spark-fuel]');
    if (!btn) return;

    const fuel = btn.dataset.sparkFuel;
    const series = buildFuelSeries(getAllRecords(), state.currentVehiculeNom);
    const availFuels = Object.keys(SPARK_COLORS).filter(k => (series[k] || []).length >= 1);

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

/**
 * Câble le champ « prix du kit de conversion » de la carte Paramètres.
 * Persiste dans localStorage et rafraîchit les stats (économie nette).
 */
export function initKitSetting() {
  const el = document.getElementById('kitPrix');
  if (!el) return;
  el.value = getKitPrix();
  el.addEventListener('change', () => {
    const v = Number(el.value);
    if (el.value === '' || !isFinite(v) || v < 0) {
      localStorage.removeItem(KIT_PRIX_KEY);
      el.value = getKitPrix();
    } else {
      localStorage.setItem(KIT_PRIX_KEY, String(v));
    }
    renderStats();
  });
}

/**
 * W39 — Câble le champ « budget carburant mensuel » de la carte Paramètres.
 * 0 / vide désactive la barre ; toute valeur > 0 l'affiche dans les stats.
 */
export function initBudgetSetting() {
  const el = document.getElementById('budgetMensuel');
  if (!el) return;
  const cur = getBudgetMensuel();
  el.value = cur > 0 ? cur : '';
  el.addEventListener('change', () => {
    const v = Number(el.value);
    if (el.value === '' || !isFinite(v) || v <= 0) {
      localStorage.removeItem(BUDGET_KEY);
      el.value = '';
    } else {
      localStorage.setItem(BUDGET_KEY, String(v));
    }
    renderStats();
  });
}

/**
 * W51 — Câble le champ « objectif CO₂ annuel » de la carte Paramètres.
 * Vide → revient à la valeur par défaut (DEFAULT_CO2_OBJECTIF).
 */
export function initCo2ObjectifSetting() {
  const el = document.getElementById('objectifCo2');
  if (!el) return;
  el.value = getObjectifCo2();
  el.addEventListener('change', () => {
    const v = Number(el.value);
    if (el.value === '' || !isFinite(v) || v <= 0) {
      localStorage.removeItem(CO2_OBJECTIF_KEY);
      el.value = getObjectifCo2();
    } else {
      localStorage.setItem(CO2_OBJECTIF_KEY, String(v));
    }
    renderStats();
  });
}
