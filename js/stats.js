/* ─── Stats live : conso, coût, économies E85 vs SP98 ─── */
import { state } from './state.js';
import { getAllRecords } from './historique.js';

const MONTHS_WINDOW = 6;

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

  // Conso L/100km : sur l'ensemble du véhicule (km max - min)
  const kms = byVeh
    .map(r => Number(r['Km compteur'] || 0))
    .filter(n => isFinite(n) && n > 0);
  const kmDelta = kms.length > 1 ? Math.max(...kms) - Math.min(...kms) : 0;
  const totalLitres = byVeh.reduce((s, r) => s + (Number(r['Nb. Litres']) || 0), 0);
  const conso = kmDelta > 0 ? (totalLitres / kmDelta) * 100 : 0;

  // Sur la fenêtre récente
  const totalCout = recent.reduce(
    (s, r) => s + (Number(r['Nb. Litres']) || 0) * (Number(r['Prix €/L']) || 0), 0
  );

  // Coût aux 100 km récents : approximation conso × prix moyen
  const prixMoyen = recent.length
    ? recent.reduce((s, r) => s + (Number(r['Prix €/L']) || 0), 0) / recent.length
    : 0;
  const coutPer100 = conso * prixMoyen;

  // Économies E85 vs SP98 : Σ (sp98_station - prix_payé) × litres, sur pleins E85 récents
  const econ = recent.reduce((s, r) => {
    if (!String(r.Type || '').toLowerCase().includes('e85')) return s;
    const sp98 = Number(r['SP98 station (€/L)']) || 0;
    const prix = Number(r['Prix €/L']) || 0;
    const lit  = Number(r['Nb. Litres']) || 0;
    if (sp98 <= 0 || prix <= 0 || lit <= 0) return s;
    return s + (sp98 - prix) * lit;
  }, 0);

  return {
    conso,
    coutPer100,
    totalCout,
    econ,
    nbPleins: recent.length,
    vehiculeName: veh || 'tous véhicules'
  };
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

  el.innerHTML = `
    <div class="stats-grid">
      <div class="stat">
        <div class="stat-val">${s.conso.toFixed(1)}</div>
        <div class="stat-unit">L / 100 km</div>
      </div>
      <div class="stat">
        <div class="stat-val">${s.coutPer100.toFixed(1)} €</div>
        <div class="stat-unit">/ 100 km</div>
      </div>
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
  `;
}
