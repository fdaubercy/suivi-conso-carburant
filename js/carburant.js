/* ─── Toggle type de carburant + badges header ─── */
import { FUEL_CONFIG, FUEL_KEYS } from './config.js';
import { state } from './state.js';
import { setS98Status, setFieldPrice, updateCout } from './ui.js';

/**
 * Callback enregistré par main.js pour éviter la dépendance circulaire
 * carburant.js ↔ prix.js.
 */
let _fetchPricesNearUser = () => {};
export function registerPriceCallback(fn) { _fetchPricesNearUser = fn; }

/**
 * Reconstruit le bloc type de carburant.
 * Ligne primaire   : E85 + SP98 (toujours visibles).
 * Ligne secondaire : SP95, E10, Gazole, GPLc — TOUJOURS affichés.
 *   • Prix disponible  → affiché en vert
 *   • Pas de prix mais station sélectionnée → bouton grisé (dimmed)
 *   • Aucune station sélectionnée → bouton normal sans prix
 */
export function _buildTypeToggle(prices) {
  const wrap = document.getElementById('typeToggle');
  if (!wrap) return;
  const primaryKeys   = ['E85', 'SP98'];
  const secondaryKeys = ['SP95', 'E10', 'GAZOLE', 'GPLC'];
  const hasPrices     = Object.keys(prices).length > 0;

  let html = '<div class="type-row-primary">';
  primaryKeys.forEach(k => {
    const cfg = FUEL_CONFIG[k], active = state.currentType === k ? ' active' : '';
    html += `<button class="type-btn${active}" onclick="setType('${k}')">${cfg.icon} ${cfg.label}</button>`;
  });
  html += '</div><div class="type-row-secondary">';
  secondaryKeys.forEach(k => {
    const cfg    = FUEL_CONFIG[k];
    const active = state.currentType === k ? ' active' : '';
    const dimmed = hasPrices && !prices[k] ? ' dimmed' : '';
    const prix   = prices[k] ? `<span class="type-price">${parseFloat(prices[k]).toFixed(3)} €/L</span>` : '';
    html += `<button class="type-btn-sm${active}${dimmed}" onclick="setType('${k}')">${cfg.icon} ${cfg.short}${prix}</button>`;
  });
  html += '</div>';
  wrap.innerHTML = html;
}

/** Mini-badges cliquables dans le bandeau (carburants dispo ≠ type courant). */
export function _updateHeaderBadges() {
  const el = document.getElementById('headerOtherFuels');
  if (!el) return;
  const others = FUEL_KEYS.filter(k => k !== state.currentType && state._stationPrices[k] != null);
  el.innerHTML = others.map(k =>
    `<span class="badge-sm" onclick="setType('${k}')">${FUEL_CONFIG[k].icon} ${FUEL_CONFIG[k].short}</span>`
  ).join('');
}

export function setType(type) {
  if (!FUEL_CONFIG[type]) return;
  state.currentType = type;
  const cfg = FUEL_CONFIG[type];

  document.getElementById('headerBadge').textContent = cfg.icon + ' ' + cfg.short;
  _updateHeaderBadges();
  _buildTypeToggle(state._stationPrices);
  document.getElementById('prixLabel').textContent = 'Prix ' + cfg.short + ' (€/L)';
  const fp = document.getElementById('fPrix'); fp.value = ''; fp.classList.remove('autofilled'); fp.placeholder = cfg.ph;
  updateCout();

  if (Object.keys(state._stationPrices).length > 0) {
    // Prix déjà chargés — application immédiate depuis le cache
    setFieldPrice('fPrix', state._stationPrices[type] || null, cfg.ph);
    updateCout();
    const found = FUEL_KEYS
      .filter(k => state._stationPrices[k])
      .map(k => FUEL_CONFIG[k].short + ' : ' + parseFloat(state._stationPrices[k]).toFixed(3) + ' €/L');
    if (found.length) setS98Status('ok', found.join(' · '));
  } else {
    const sel = document.getElementById('stationSel').value;
    if (sel && sel !== '__autre') _fetchPricesNearUser();
  }
}
