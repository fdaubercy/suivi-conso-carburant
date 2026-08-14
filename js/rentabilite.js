/* ─── Indicateur rentabilité E85 vs carburant de référence, temps réel ─── */
import { state } from './state.js';
import { SURCONSO_KEY, DEFAULT_SURCONSO, SURCONSO_MIN, SURCONSO_MAX,
         CARBURANT_REF_KEY, DEFAULT_CARBURANT_REF, FUEL_CONFIG,
         CONSO_DIESEL_REF_KEY, VEHICULE_DIESEL_REF_KEY } from './config.js';
import { computeConsoMoy, resolveConsoDiesel } from './refmodel.js';
import { getAllRecords } from './historique.js';

// X67 — le seuil de rentabilité n'est plus figé : il dérive de la surconso
// (vs le carburant de référence choisi). E85 rentable si
// prix_E85 / prix_réf < 1 / (1 + surconso_vs_réf) (coût/km égal).
const BREAKEVEN_MARGE = 0.04;   // zone « limite » juste au-dessus du seuil

/** Seuil de ratio prix (E85/réf.) sous lequel l'E85 est rentable. */
export function seuilRentable(surconso) {
  return 1 / (1 + surconso);
}

/** Surconso essence pour la bannière : valeur synchronisée (Excel J8) bornée,
 *  défaut DEFAULT_SURCONSO. */
function getBannerSurconso() {
  const n = Number(localStorage.getItem(SURCONSO_KEY));
  if (!isFinite(n) || n <= 0) return DEFAULT_SURCONSO;
  return Math.min(SURCONSO_MAX, Math.max(SURCONSO_MIN, n));
}

/** Surconso E85 exprimée vs le carburant de référence courant (fraction).
 *  Essence : surconso synchronisée. Diesel : consoE85/consoDiesel − 1, mesurée. */
function surconsoVsRef(refKey) {
  if (refKey !== 'GAZOLE') return getBannerSurconso();
  const records = getAllRecords();
  const veh = state.currentVehiculeNom;
  const byVeh = veh ? records.filter(r => (r['Véhicule'] || r['Vehicule'] || '') === veh) : records;
  const consoE85    = computeConsoMoy(byVeh, 'E85');
  const consoDiesel = resolveConsoDiesel(
    records,
    localStorage.getItem(VEHICULE_DIESEL_REF_KEY) || '',
    Number(localStorage.getItem(CONSO_DIESEL_REF_KEY)) || 0
  );
  if (consoE85 > 0 && consoDiesel > 0) return Math.max(0, consoE85 / consoDiesel - 1);
  return getBannerSurconso();   // repli si conso E85 indéterminée
}

/**
 * Met à jour le banner #rentabilite selon les prix E85 / carburant de référence
 * de la station courante. Ne s'affiche que si les deux prix sont connus.
 */
export function updateRentabilite() {
  const el = document.getElementById('rentabilite');
  if (!el) return;

  const refKey   = localStorage.getItem(CARBURANT_REF_KEY) || DEFAULT_CARBURANT_REF;
  const refShort = (FUEL_CONFIG[refKey] && FUEL_CONFIG[refKey].short) || refKey;

  const e85 = parseFloat(state._stationPrices.E85);
  const ref = parseFloat(state._stationPrices[refKey]);

  if (!isFinite(e85) || !isFinite(ref) || e85 <= 0 || ref <= 0) {
    el.textContent = '';
    el.className   = 'rentabilite';
    return;
  }

  const ratio  = e85 / ref;
  const ecart  = Math.round((1 - ratio) * 100);
  const seuilR = seuilRentable(surconsoVsRef(refKey));
  const seuilB = seuilR + BREAKEVEN_MARGE;

  if (ratio < seuilR) {
    el.innerHTML = '🟢 <strong>E85 rentable ici</strong> — ' + ecart + '% moins cher que ' + refShort + ' (ratio ' + ratio.toFixed(2) + ')';
    el.className = 'rentabilite ok';
  } else if (ratio < seuilB) {
    el.innerHTML = '🟡 <strong>E85 limite</strong> — proche du seuil de rentabilité (ratio ' + ratio.toFixed(2) + ')';
    el.className = 'rentabilite warn';
  } else {
    el.innerHTML = '🔴 <strong>E85 perdant ici</strong> — préférez ' + refShort + ' (ratio ' + ratio.toFixed(2) + ')';
    el.className = 'rentabilite err';
  }
}
