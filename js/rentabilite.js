/* ─── Indicateur rentabilité E85 vs SP98 temps réel ─── */
import { state } from './state.js';

// Seuils ratio prix_E85 / prix_SP98
const SEUIL_RENTABLE  = 0.66;   // sous ce ratio = rentable (densité énergétique E85)
const SEUIL_BREAKEVEN = 0.70;   // entre 0.66 et 0.70 = limite, au-dessus = perdant

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

  const ratio = e85 / sp98;
  const ecart = Math.round((1 - ratio) * 100);

  if (ratio < SEUIL_RENTABLE) {
    el.innerHTML = '🟢 <strong>E85 rentable ici</strong> — ' + ecart + '% moins cher que SP98 (ratio ' + ratio.toFixed(2) + ')';
    el.className = 'rentabilite ok';
  } else if (ratio < SEUIL_BREAKEVEN) {
    el.innerHTML = '🟡 <strong>E85 limite</strong> — proche du seuil de rentabilité (ratio ' + ratio.toFixed(2) + ')';
    el.className = 'rentabilite warn';
  } else {
    el.innerHTML = '🔴 <strong>E85 perdant ici</strong> — préférez SP98 (ratio ' + ratio.toFixed(2) + ')';
    el.className = 'rentabilite err';
  }
}
