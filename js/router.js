/* ═══════════════════════════════════════
   Router — navigation par vues (hash routing)
   Hybride : barre d'onglets + URL #/<vue> + retour navigateur/OS
═══════════════════════════════════════ */

/** Vues déclarées dans index.html (data-view) + titre affiché dans le header. */
const VIEWS = {
  saisie:     { title: "Saisie d'un plein" },
  stats:      { title: 'Statistiques' },
  carte:      { title: 'Carte des stations' },
  historique: { title: 'Historique' },
  params:     { title: 'Réglages' },
};
const DEFAULT_VIEW = 'saisie';

/** Extrait le nom de vue depuis window.location.hash (#/stats → "stats"). */
function viewFromHash() {
  const v = (window.location.hash || '').replace(/^#\/?/, '').trim();
  return VIEWS[v] ? v : DEFAULT_VIEW;
}

/** Affiche la vue demandée, masque les autres, met à jour onglets + header. */
function showView(view) {
  document.querySelectorAll('.view').forEach(sec => {
    sec.classList.toggle('view--active', sec.dataset.view === view);
  });
  document.querySelectorAll('.nav-tab').forEach(tab => {
    const active = tab.dataset.view === view;
    tab.classList.toggle('nav-tab--active', active);
    if (active) tab.setAttribute('aria-current', 'page');
    else        tab.removeAttribute('aria-current');
  });
  const h1 = document.querySelector('header h1');
  if (h1 && VIEWS[view]) h1.textContent = VIEWS[view].title;

  // Remonter en haut à chaque changement de vue (chaque vue est une "page").
  window.scrollTo({ top: 0, behavior: 'instant' in window ? 'instant' : 'auto' });

  // Notifie les modules (ex. re-cadrage d'une carte rendue hors écran).
  window.dispatchEvent(new window.CustomEvent('viewchange', { detail: { view } }));
}

/** Change de vue par programme (ex. après "dupliquer dernier plein"). */
export function navigate(view) {
  if (!VIEWS[view]) view = DEFAULT_VIEW;
  if (viewFromHash() === view) { showView(view); return; }
  window.location.hash = '#/' + view;   // déclenche hashchange → showView
}

/** Initialise le routeur : onglets, écoute du hash, vue de départ. */
export function initRouter() {
  document.getElementById('bottomNav')?.addEventListener('click', e => {
    const tab = e.target.closest('.nav-tab');
    if (!tab) return;
    navigate(tab.dataset.view);
  });

  window.addEventListener('hashchange', () => showView(viewFromHash()));

  // Vue de départ : respecte un hash existant (deep-link / rechargement),
  // sinon ouvre directement la Saisie sans polluer l'historique.
  if (window.location.hash && VIEWS[viewFromHash()]) showView(viewFromHash());
  else showView(DEFAULT_VIEW);
}
