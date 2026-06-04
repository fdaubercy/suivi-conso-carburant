/* ═══════════════════════════════════════
   Router — navigation par vues (hash routing)
   Hybride : barre d'onglets + URL #/<vue> + retour navigateur/OS
   W43 : vue d'accueil à tuiles (#/accueil)
   W44 : transition latérale selon la direction (swipe / onglets)
   U4  : vue de départ configurable (Accueil / Saisie / dernière vue)
═══════════════════════════════════════ */

import { START_VIEW_KEY, LAST_VIEW_KEY, DEFAULT_START_VIEW } from './config.js';
import { authEnabled, isAuthed, mountGsiButton } from './auth.js';

/** Vues déclarées dans index.html (data-view) + titre affiché dans le header. */
const VIEWS = {
  accueil:    { title: 'Accueil' },
  saisie:     { title: "Saisie d'un plein" },
  stats:      { title: 'Statistiques' },
  carte:      { title: 'Carte des stations' },
  historique: { title: 'Historique' },
  params:     { title: 'Réglages' },
};
const DEFAULT_VIEW = 'accueil';

/* U7 — Vues « personnelles » protégées par la connexion Google. Quand l'auth
   est active et l'utilisateur déconnecté, le routeur affiche le mur #loginGate
   à la place de ces vues. accueil / saisie / carte restent publiques (la saisie
   reste consultable ; seul l'enregistrement d'un plein exige la connexion). */
const PERSO_VIEWS = new Set(['stats', 'historique', 'params']);
function _gateActive(view) {
  return authEnabled() && !isAuthed() && PERSO_VIEWS.has(view);
}

/* ─── U4 — Vue de départ configurable ─────────────────────────────────
   'accueil' | 'saisie' = vue fixe ; 'last' = reprend la dernière consultée. */
export function getStartViewPref() {
  const v = localStorage.getItem(START_VIEW_KEY);
  return v === 'saisie' || v === 'last' || v === 'accueil' ? v : DEFAULT_START_VIEW;
}

export function setStartViewPref(v) {
  if (v === 'saisie' || v === 'last' || v === 'accueil') localStorage.setItem(START_VIEW_KEY, v);
}

/** Dernière vue consultée (persistée par showView), pour la préférence 'last'
 *  et la tuile « reprendre » de l'accueil. */
export function getLastView() {
  const v = localStorage.getItem(LAST_VIEW_KEY);
  return VIEWS[v] ? v : null;
}

/** Vue à afficher au démarrage selon la préférence (résout 'last'). */
function resolveStartView() {
  const pref = getStartViewPref();
  if (pref === 'last') return getLastView() || DEFAULT_VIEW;
  return VIEWS[pref] ? pref : DEFAULT_VIEW;
}

/** W44 — ordre des onglets (= séquence de swipe). L'accueil est hors séquence
 *  (accessible via le bouton 🏠), il n'entre donc pas dans le balayage. */
export const SWIPE_ORDER = ['saisie', 'stats', 'carte', 'historique', 'params'];

// Direction de la prochaine transition, posée par navigate() avant le hashchange.
let _slideDir = null;   // 'next' | 'prev' | null

/** Extrait le nom de vue depuis window.location.hash (#/stats → "stats"). */
function viewFromHash() {
  const v = (window.location.hash || '').replace(/^#\/?/, '').trim();
  return VIEWS[v] ? v : DEFAULT_VIEW;
}

/** Vue actuellement affichée (d'après le hash). */
export function currentView() {
  return viewFromHash();
}

/** Affiche la vue demandée, masque les autres, met à jour onglets + header. */
function showView(view) {
  const dir = _slideDir; _slideDir = null;   // consommé une seule fois

  // U7 — Mur de connexion : sur une vue perso, si l'auth est active et que
  // l'utilisateur est déconnecté, on masque la vue et on affiche #loginGate.
  const gated = _gateActive(view);
  const gate  = document.getElementById('loginGate');
  if (gate) {
    gate.hidden = !gated;
    if (gated) mountGsiButton(document.getElementById('gsiBtnGate'), { size: 'large' });
  }

  document.querySelectorAll('.view').forEach(sec => {
    const active = !gated && sec.dataset.view === view;
    sec.classList.toggle('view--active', active);
    sec.classList.remove('view--slide-next', 'view--slide-prev');
    if (active && dir) sec.classList.add(dir === 'next' ? 'view--slide-next' : 'view--slide-prev');
  });
  document.querySelectorAll('.nav-tab').forEach(tab => {
    const active = tab.dataset.view === view;
    tab.classList.toggle('nav-tab--active', active);
    if (active) tab.setAttribute('aria-current', 'page');
    else        tab.removeAttribute('aria-current');
  });
  const h1 = document.querySelector('header h1');
  if (h1 && VIEWS[view]) h1.textContent = VIEWS[view].title;

  // U4/U5 — mémorise la dernière vue « utile » (≠ accueil) pour la préférence
  // 'last' et la tuile « reprendre » : reprendre vers l'accueil n'aurait pas de sens.
  if (view !== 'accueil') {
    try { localStorage.setItem(LAST_VIEW_KEY, view); } catch { /* quota / privé */ }
  }

  // Remonter en haut à chaque changement de vue (chaque vue est une "page").
  window.scrollTo({ top: 0, behavior: 'instant' in window ? 'instant' : 'auto' });

  // Notifie les modules (ex. re-cadrage d'une carte rendue hors écran, badges).
  window.dispatchEvent(new window.CustomEvent('viewchange', { detail: { view } }));
}

/** Calcule la direction de transition entre deux vues (selon SWIPE_ORDER). */
function dirBetween(from, to) {
  const i = SWIPE_ORDER.indexOf(from), j = SWIPE_ORDER.indexOf(to);
  if (i < 0 || j < 0 || i === j) return null;
  return j > i ? 'next' : 'prev';
}

/** Change de vue par programme (ex. après "dupliquer dernier plein"). */
export function navigate(view) {
  if (!VIEWS[view]) view = DEFAULT_VIEW;
  const cur = viewFromHash();
  _slideDir = dirBetween(cur, view);
  if (cur === view) { showView(view); return; }
  window.location.hash = '#/' + view;   // déclenche hashchange → showView
}

/** W44 — passe à la vue voisine dans SWIPE_ORDER (delta = +1 / −1). */
export function navigateRelative(delta) {
  const cur = viewFromHash();
  const i = SWIPE_ORDER.indexOf(cur);
  if (i < 0) return;                       // vue hors séquence (ex. accueil)
  const next = SWIPE_ORDER[i + delta];
  if (next) navigate(next);
}

/** Initialise le routeur : onglets, écoute du hash, vue de départ. */
export function initRouter() {
  document.getElementById('bottomNav')?.addEventListener('click', e => {
    const tab = e.target.closest('.nav-tab');
    if (!tab) return;
    navigate(tab.dataset.view);
  });

  window.addEventListener('hashchange', () => showView(viewFromHash()));

  // U7 — (dé)connexion : rouvre ou ferme le mur sur la vue courante.
  window.addEventListener('auth-changed', () => showView(viewFromHash()));

  // Vue de départ : respecte un hash existant (deep-link / rechargement),
  // sinon applique la préférence U4 (Accueil / Saisie / dernière vue).
  if (window.location.hash && VIEWS[viewFromHash()]) showView(viewFromHash());
  else showView(resolveStartView());
}
