/* ─── Stats live : conso, coût, économies E85 vs SP98 + sparkline prix multi-carburant + prédiction ─── */
import { state } from './state.js';
import { FUEL_CONFIG, DEFAULT_SURCONSO, KIT_PRIX_KEY, DEFAULT_KIT_PRIX,
         BUDGET_KEY, CO2_ESSENCE_PER_L, CO2_E85_PER_L } from './config.js';
import { getAllRecords, forceRefreshHistorique } from './historique.js';
import { renderComparatif } from './comparatif.js';

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
    ${buildBudgetBar()}
    ${buildPrixSparkline()}
    ${buildPrediction()}
  `;

  renderComparatif();   // W41 — graphe comparatif inter-véhicules (vue Stats)
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

/* ─── W39 — Barre de progression du budget carburant mensuel ───
   Compare la dépense du mois courant (véhicule sélectionné) à l'objectif €. */
function buildBudgetBar() {
  const budget = getBudgetMensuel();
  if (!budget) return '';

  const r = buildMonthlyReport(_currentMonthKey());
  const spent = r.nbPleins ? (r.totalCout || 0) : 0;
  const pct   = (spent / budget) * 100;
  const over  = spent > budget;
  const cls   = over ? 'over' : (pct >= 80 ? 'warn' : 'ok');
  const w     = Math.min(100, Math.max(0, pct)).toFixed(0);

  const right = over
    ? `<span class="budget-over">⚠️ +${(spent - budget).toFixed(0)} € au-dessus</span>`
    : `<span class="budget-left">reste ${(budget - spent).toFixed(0)} €</span>`;

  return `
    <div class="budget-box ${cls}">
      <div class="budget-head">
        <span class="budget-label">🎯 Budget ${r.label}</span>
        <span class="budget-amount">${spent.toFixed(0)} / ${budget.toFixed(0)} €</span>
      </div>
      <div class="budget-track"><div class="budget-fill" style="width:${w}%"></div></div>
      <div class="budget-foot">${right} · ${Math.round(pct)} %</div>
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
