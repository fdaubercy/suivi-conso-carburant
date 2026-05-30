/* ═══════════════════════════════════════
   badges.js — Pastilles de notification sur les onglets (W45)

   • ⚙️ Réglages   : point — alertes prix non configurées (aucun carburant activé)
   • 📜 Historique : compteur — pleins importés non encore consultés (persistant)
   • 🗺️ Carte      : point — un « moins cher du secteur » a été relevé aujourd'hui

   Le badge Historique est un compteur permanent : il ne se vide qu'à l'ouverture
   de la vue (consultation). Le badge Carte se vide aussi à l'ouverture, et se
   réarme chaque nouveau jour de relevé.
═══════════════════════════════════════ */

import { HIST_SEEN_KEY, CARTE_SEEN_KEY } from './config.js';
import { getAllRecords } from './historique.js';
import { getSectorToday } from './secteur.js';
import { isSupported, getPermission, isAnyEnabled } from './notifications.js';

const SECTOR_FUELS = ['E85', 'GAZOLE', 'SP98'];

function _todayIso() {
  const t = new Date();
  return [t.getFullYear(), String(t.getMonth() + 1).padStart(2, '0'),
          String(t.getDate()).padStart(2, '0')].join('-');
}

function _getNum(key) {
  const v = parseInt(localStorage.getItem(key), 10);
  return isFinite(v) ? v : null;
}

function _setBadge(name, show, text) {
  const el = document.querySelector(`.nav-badge[data-badge="${name}"]`);
  if (!el) return;
  el.hidden = !show;
  if (show && text != null && !el.classList.contains('nav-badge--dot')) {
    el.textContent = text;
  }
}

/** Recalcule et applique les trois pastilles. */
export function refreshBadges() {
  // ⚙️ Réglages — alertes non configurées (et notifications possibles).
  const paramsShow = isSupported() && getPermission() !== 'denied' && !isAnyEnabled();
  _setBadge('params', paramsShow);

  // 📜 Historique — nouveaux pleins depuis la dernière consultation.
  const total = getAllRecords().length;
  let seen = _getNum(HIST_SEEN_KEY);
  if (seen == null || total < seen) {          // 1ère visite ou suppressions → resync
    seen = total;
    try { localStorage.setItem(HIST_SEEN_KEY, String(total)); } catch { /* quota */ }
  }
  const fresh = Math.max(0, total - seen);
  _setBadge('historique', fresh > 0, fresh > 99 ? '99+' : String(fresh));

  // 🗺️ Carte — un meilleur prix du secteur a été relevé aujourd'hui.
  const today   = _todayIso();
  const hasBest = SECTOR_FUELS.some(f => {
    const t = getSectorToday(f);
    return t && t.date === today && t.prix != null;
  });
  const carteSeen = localStorage.getItem(CARTE_SEEN_KEY);
  _setBadge('carte', hasBest && carteSeen !== today);
}

/** Marque une vue comme consultée (vide son badge) puis rafraîchit. */
function _markSeen(view) {
  try {
    if (view === 'historique') {
      localStorage.setItem(HIST_SEEN_KEY, String(getAllRecords().length));
    } else if (view === 'carte') {
      localStorage.setItem(CARTE_SEEN_KEY, _todayIso());
    }
  } catch { /* quota */ }
}

/** Branche le rafraîchissement automatique des badges. */
export function initBadges() {
  window.addEventListener('viewchange', e => {
    const v = e.detail?.view;
    if (v === 'historique' || v === 'carte') _markSeen(v);
    refreshBadges();
  });
  refreshBadges();
}
