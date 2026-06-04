/* ═══════════════════════════════════════════════════════════════════════
   mapfullscreen.js — Plein écran des cartes ET de toutes les .card (W63 / W64)

   Plein écran « CSS » (la cible passe en position:fixed plein viewport) plutôt
   que l'API Fullscreen — celle-ci n'est pas supportée pour un élément sur
   iOS Safari / PWA. L'onglet/vue de l'app n'est PAS modifié : sortir du plein
   écran restaure exactement l'écran (et l'onglet) précédent.

   • Cartes géo : bouton `.map-fs-btn[data-fs-target="#cible"]` (déclaré en dur).
   • Toutes les autres .card : un bouton ⛶ est INJECTÉ automatiquement (sans
     data-fs-target → la cible est la .card la plus proche). Un MutationObserver
     ré-injecte le bouton après chaque re-rendu (innerHTML remplacé).
═══════════════════════════════════════════════════════════════════════ */

function _exitAll() {
  document.querySelectorAll('.map-fs').forEach(t => t.classList.remove('map-fs'));
  document.body.classList.remove('map-fs-open');
  document.querySelectorAll('.map-fs-btn').forEach(b => {
    b.textContent = '⛶';
    b.title = 'Plein écran';
    b.setAttribute('aria-label', 'Plein écran');
  });
  setTimeout(() => window.dispatchEvent(new Event('resize')), 60);
}

/** Crée un bouton ⛶ plein écran (sans data-fs-target → cible = .card parente). */
function _makeFsButton(extraClass) {
  const b = document.createElement('button');
  b.type = 'button';
  b.className = 'map-fs-btn card-fs-btn' + (extraClass ? ' ' + extraClass : '');
  b.textContent = '⛶';
  b.title = 'Plein écran';
  b.setAttribute('aria-label', 'Plein écran');
  return b;
}

/** Garantit qu'un bouton ⛶ existe sur chaque .card de contenu.
 *  Cartes avec barre d'actions (.hist-actions) → bouton intégré (style .hist-btn).
 *  Sinon → bouton flottant en coin haut-droit. Idempotent. */
function _ensureCardButtons() {
  document.querySelectorAll('#app-main .card').forEach(card => {
    if (card.hasAttribute('data-no-fs')) return;
    // Déjà un bouton plein écran (carte géo en dur, ou injection précédente) ?
    if (card.querySelector('.map-fs-btn')) return;

    const actions = card.querySelector('.hist-actions');
    if (actions) {
      actions.insertBefore(_makeFsButton('hist-btn'), actions.firstChild);
    } else {
      card.insertBefore(_makeFsButton(), card.firstChild);
    }
  });
}

/** Délégation globale : bascule plein écran au clic sur `.map-fs-btn`,
 *  sortie au clic sur la fermeture de carte (`.map-close-btn`) ou via Échap. */
export function initMapFullscreen() {
  _ensureCardButtons();

  // Ré-injection après chaque re-rendu de carte (innerHTML remplacé, vues
  // dynamiques, etc.). On se déconnecte le temps de l'injection pour ne pas
  // réagir à nos propres ajouts (anti-boucle), puis on se reconnecte.
  const main = document.getElementById('app-main');
  if (main && 'MutationObserver' in window) {
    // Réinjection SYNCHRONE dans le callback (avant le paint) → le bouton réapparaît
    // dans la même frame que le re-rendu qui l'a effacé : pas de clignotement.
    // On se déconnecte le temps de l'injection pour ne pas réagir à nos propres
    // ajouts (anti-boucle), puis on se reconnecte.
    const obs = new window.MutationObserver(() => {
      obs.disconnect();
      _ensureCardButtons();
      obs.observe(main, { childList: true, subtree: true });
    });
    obs.observe(main, { childList: true, subtree: true });
  }

  document.addEventListener('click', e => {
    const fsBtn = e.target.closest('.map-fs-btn');
    if (fsBtn) {
      // Cible explicite (cartes géo) ou .card parente (boutons injectés).
      const target = fsBtn.dataset.fsTarget
        ? document.querySelector(fsBtn.dataset.fsTarget)
        : fsBtn.closest('.card, .map-fs-wrap');
      if (!target) return;
      const entering = !target.classList.contains('map-fs');
      _exitAll();                                   // ne garder qu'un plein écran à la fois
      if (entering) {
        target.classList.add('map-fs');
        document.body.classList.add('map-fs-open');
        target.scrollTop = 0;
        fsBtn.textContent = '✕';
        fsBtn.title = 'Quitter le plein écran';
        fsBtn.setAttribute('aria-label', 'Quitter le plein écran');
        setTimeout(() => window.dispatchEvent(new Event('resize')), 60);
      }
      return;
    }
    // Fermer la carte recherche pendant le plein écran → on en sort aussi.
    if (e.target.closest('.map-close-btn')) _exitAll();
  });

  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && document.querySelector('.map-fs')) _exitAll();
  });
}
