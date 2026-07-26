/* ─── Indicateur rentabilité E85 vs carburant de référence, temps réel ─── */
import { state } from './state.js';
import { SURCONSO_KEY, DEFAULT_SURCONSO, SURCONSO_MIN, SURCONSO_MAX } from './config.js';

// X67 — le seuil de rentabilité n'est plus figé : il dérive de la surconso.
// E85 rentable si prix_E85 / prix_réf < 1 / (1 + surconso) (coût/km égal).
const BREAKEVEN_MARGE = 0.04;   // zone « limite » juste au-dessus du seuil

/** Seuil de ratio prix (E85/réf.) sous lequel l'E85 est rentable. */
export function seuilRentable(surconso) {
  return 1 / (1 + surconso);
}

/** Surconso courante pour la bannière : valeur synchronisée (Excel J8) bornée,
 *  défaut DEFAULT_SURCONSO. */
function getBannerSurconso() {
  const n = Number(localStorage.getItem(SURCONSO_KEY));
  if (!isFinite(n) || n <= 0) return DEFAULT_SURCONSO;
  return Math.min(SURCONSO_MAX, Math.max(SURCONSO_MIN, n));
}

/**
 * Met à jour le banner #rentabilite selon les prix E85/SP98 de la station courante.
 * Ne s'affiche que si les deux prix sont connus.
 */
export function updateRentabilite() {
  const el = document.getElementById('rentabilite');
  if (!el) return;

  const e85  = parseFloat(state._stationPrices.E85);
  const sp98 = parseFloat(state._stationPrices.SP98);

  if (!isFinite(e85) || !isFinite(sp98) || e85 <= 0 || sp98 <= 0) {
    el.textContent = '';
    el.className   = 'rentabilite';
    return;
  }

  const ratio     = e85 / sp98;
  const ecart     = Math.round((1 - ratio) * 100);
  const seuilR    = seuilRentable(getBannerSurconso());
  const seuilB    = seuilR + BREAKEVEN_MARGE;

  if (ratio < seuilR) {
    el.innerHTML = '🟢 <strong>E85 rentable ici</strong> — ' + ecart + '% moins cher que SP98 (ratio ' + ratio.toFixed(2) + ')';
    el.className = 'rentabilite ok';
  } else if (ratio < seuilB) {
    el.innerHTML = '🟡 <strong>E85 limite</strong> — proche du seuil de rentabilité (ratio ' + ratio.toFixed(2) + ')';
    el.className = 'rentabilite warn';
  } else {
    el.innerHTML = '🔴 <strong>E85 perdant ici</strong> — préférez SP98 (ratio ' + ratio.toFixed(2) + ')';
    el.className = 'rentabilite err';
  }
}
