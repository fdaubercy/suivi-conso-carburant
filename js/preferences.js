/* ═══════════════════════════════════════════════════════════════════════
   preferences.js — Réglages d'affichage & ergonomie (U4 / U5 / U6)

   U4 — Vue de départ configurable (Accueil / Saisie / dernière vue)
   U5 — Tuile « reprendre » sur l'Accueil (dernière vue + dernier plein)
   U6 — Blocs Réglages repliables (état persistant)
═══════════════════════════════════════════════════════════════════════ */

import { COLLAPSE_PREFIX } from './config.js';
import { getStartViewPref, setStartViewPref, getLastView, navigate } from './router.js';
import { getLastRecordSummary } from './historique.js';

/* Libellés/icônes des vues, pour la tuile « reprendre ». */
const VIEW_META = {
  saisie:     { ico: '⛽',  lbl: 'Saisie' },
  stats:      { ico: '📊',  lbl: 'Stats' },
  carte:      { ico: '🗺️',  lbl: 'Carte' },
  historique: { ico: '📜',  lbl: 'Historique' },
  params:     { ico: '⚙️',  lbl: 'Réglages' },
  accueil:    { ico: '🏠',  lbl: 'Accueil' },
};

/* ─── U4 — Sélecteur de vue de départ ──────────────────────────────────── */
export function initStartViewSetting() {
  const sel = document.getElementById('startView');
  if (!sel) return;
  sel.value = getStartViewPref();
  sel.addEventListener('change', () => setStartViewPref(sel.value));
}

/* ─── U5 — Tuile « reprendre » sur l'accueil ───────────────────────────── */
export function renderHomeResume() {
  const el = document.getElementById('homeResume');
  if (!el) return;

  const resumeView = getLastView();              // dernière vue ≠ accueil (ou null)
  const last       = getLastRecordSummary();     // dernier plein (ou null)

  if (!resumeView && !last) { el.hidden = true; return; }

  const target = resumeView || 'historique';
  const meta   = VIEW_META[target] || VIEW_META.historique;
  el.dataset.view = target;

  const main = resumeView
    ? `↩️ Reprendre — ${meta.ico} ${meta.lbl}`
    : `📜 Voir l'historique`;

  const sub = last
    ? `Dernier plein · ${last.date}`
      + (last.station && last.station !== '—' ? ` · ${last.station}` : '')
      + (last.prix > 0 ? ` · ${last.prix.toFixed(3)} €/L` : '')
    : '';

  el.innerHTML =
    `<span class="hr-main">${main}</span>`
    + (sub ? `<span class="hr-sub">${sub}</span>` : '');
  el.hidden = false;
}

function initHomeResume() {
  const el = document.getElementById('homeResume');
  if (!el) return;
  el.addEventListener('click', () => {
    const v = el.dataset.view;
    if (v) navigate(v);
  });
  // Rendu initial + à chaque retour sur l'accueil (données possiblement à jour).
  renderHomeResume();
  window.addEventListener('viewchange', e => {
    if (e.detail?.view === 'accueil') renderHomeResume();
  });
}

/* ─── U6 — Blocs Réglages repliables ───────────────────────────────────── */
function initCollapsibles() {
  document.querySelectorAll('.card.collapsible').forEach(card => {
    const title = card.querySelector('.section-title');
    if (!title) return;

    const key = COLLAPSE_PREFIX + (card.dataset.collapse || title.textContent.trim());

    // Chevron indicateur (replié = tourné).
    const chev = document.createElement('span');
    chev.className = 'collapse-chevron';
    chev.setAttribute('aria-hidden', 'true');
    chev.textContent = '▾';
    title.appendChild(chev);

    // État restauré.
    let collapsed = false;
    try { collapsed = localStorage.getItem(key) === '1'; } catch { /* privé */ }
    card.classList.toggle('collapsed', collapsed);

    // Accessibilité : le titre devient un bouton.
    title.setAttribute('role', 'button');
    title.setAttribute('tabindex', '0');
    title.setAttribute('aria-expanded', String(!collapsed));

    const toggle = () => {
      const now = card.classList.toggle('collapsed');
      title.setAttribute('aria-expanded', String(!now));
      try { localStorage.setItem(key, now ? '1' : '0'); } catch { /* privé */ }
    };

    title.addEventListener('click', toggle);
    title.addEventListener('keydown', e => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggle(); }
    });
  });
}

/* ─── Init global ──────────────────────────────────────────────────────── */
export function initPreferences() {
  initStartViewSetting();
  initHomeResume();
  initCollapsibles();
}
