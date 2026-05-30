/* ─── Toggle type de carburant + badges header ─── */
import { FUEL_CONFIG } from './config.js';
import { state } from './state.js';
import { setFieldPrice, updateCout } from './ui.js';

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
 *
 * T2 : les boutons utilisent data-fuel-key au lieu d'onclick inline.
 *      La délégation d'événements est dans initTypeToggle().
 */
export function _buildTypeToggle(prices) {
  const wrap = document.getElementById('typeToggle');
  if (!wrap) return;
  const primaryKeys   = ['E85', 'SP98'];
  const secondaryKeys = ['SP95', 'E10', 'GAZOLE', 'GPLC'];
  const hasPrices     = Object.keys(prices).length > 0;

  let html = '<div class="type-row-primary">';
  primaryKeys.forEach(k => {
    const cfg    = FUEL_CONFIG[k];
    const active = state.currentType === k ? ' active' : '';
    const dimmed = hasPrices && !prices[k] ? ' dimmed' : '';
    const prix   = prices[k] ? `<span class="type-price">${parseFloat(prices[k]).toFixed(3)} €/L</span>` : '';
    html += `<button class="type-btn${active}${dimmed}" data-fuel-key="${k}">${cfg.icon} ${cfg.label}${prix}</button>`;
  });
  html += '</div><div class="type-row-secondary">';
  secondaryKeys.forEach(k => {
    const cfg    = FUEL_CONFIG[k];
    const active = state.currentType === k ? ' active' : '';
    const dimmed = hasPrices && !prices[k] ? ' dimmed' : '';
    const prix   = prices[k] ? `<span class="type-price">${parseFloat(prices[k]).toFixed(3)} €/L</span>` : '';
    html += `<button class="type-btn-sm${active}${dimmed}" data-fuel-key="${k}">${cfg.icon} ${cfg.short}${prix}</button>`;
  });
  html += '</div>';
  wrap.innerHTML = html;
}

/** Bandeau : seul le carburant sélectionné est affiché (via #headerBadge dans setType). */
export function _updateHeaderBadges() {
  const el = document.getElementById('headerOtherFuels');
  if (el) el.innerHTML = '';
}

export function setType(type) {
  if (!FUEL_CONFIG[type]) return;
  state.currentType = type;
  const cfg = FUEL_CONFIG[type];

  document.getElementById('headerBadge').textContent = cfg.icon + ' ' + cfg.short;
  _updateHeaderBadges();
  _buildTypeToggle(state._stationPrices);
  document.getElementById('prixLabel').textContent = 'Prix ' + cfg.short + ' (€/L)';

  // Re-rendu des stats : conso/coût/100km sont filtrés par carburant courant
  if (typeof window.renderStats === 'function') window.renderStats();
  const fp = document.getElementById('fPrix'); fp.value = ''; fp.classList.remove('autofilled'); fp.placeholder = cfg.ph;
  updateCout();

  if (Object.keys(state._stationPrices).length > 0) {
    // Prix déjà chargés — application immédiate depuis le cache
    setFieldPrice('fPrix', state._stationPrices[type] || null, cfg.ph);
    updateCout();
  } else {
    const sel = document.getElementById('stationSel').value;
    if (sel && sel !== '__autre') _fetchPricesNearUser();
  }
}

/**
 * T2 — Délégation d'événements sur #typeToggle.
 * Appelée une seule fois depuis main.js au démarrage.
 */
export function initTypeToggle() {
  document.getElementById('typeToggle')?.addEventListener('click', e => {
    const btn = e.target.closest('[data-fuel-key]');
    if (!btn) return;
    setType(btn.dataset.fuelKey);
  });
}
