// ============================================================
//  PWA — Install prompt   W4
//  Android/Chrome : beforeinstallprompt -> bouton 📲 dans le header
//  iOS Safari     : banner instruction manuelle (apres 4 s)
//  Service Worker : enregistrement + gestion des mises à jour (W23)
// ============================================================

let _deferred = null;
const IOS_DISMISSED_KEY = 'pwa_ios_dismissed';

export function initPWA() {
  /* ── Service Worker ─────────────────────────────────────────────────
   * SW placé dans public/sw.js → servi à la racine du scope PWA.
   * import.meta.env.BASE_URL vaut '/' en dev et '/suivi-e85/' en build.
   * ─────────────────────────────────────────────────────────────────── */
  if ('serviceWorker' in navigator) {
    const swUrl = import.meta.env.BASE_URL + 'sw.js';
    navigator.serviceWorker.register(swUrl, { scope: import.meta.env.BASE_URL })
      .then(reg => {
        /* Vérification de mise à jour silencieuse toutes les 60 min */
        setInterval(() => reg.update(), 60 * 60 * 1000);

        /* W23 — Détection mise à jour disponible ──────────────────────
         * 1) Nouveau SW en cours d'installation → attendre "installed"
         * 2) SW déjà en attente au chargement (refresh manuel entre versions)
         * ───────────────────────────────────────────────────────────── */
        const trackInstalling = (worker) => {
          worker.addEventListener('statechange', () => {
            if (worker.state === 'installed' && navigator.serviceWorker.controller) {
              _showUpdateBanner(reg);
            }
          });
        };

        if (reg.installing) trackInstalling(reg.installing);

        reg.addEventListener('updatefound', () => {
          if (reg.installing) trackInstalling(reg.installing);
        });

        /* Cas : une MàJ est déjà en attente dès le chargement */
        if (reg.waiting && navigator.serviceWorker.controller) {
          _showUpdateBanner(reg);
        }
      })
      .catch(err => console.warn('[SW] Enregistrement échoué :', err));

    /* Rechargement automatique quand le nouveau SW prend le contrôle */
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      window.location.reload();
    });
  }

  /* Deja installee en mode standalone -> pas de banniere install */
  const isStandalone =
    window.matchMedia('(display-mode: standalone)').matches ||
    window.navigator.standalone === true;
  if (isStandalone) return;

  /* ── Android / Chrome : bouton 📲 dans le header ─── */
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    _deferred = e;
    _show('pwaInstallBtn');
  });

  window.addEventListener('appinstalled', () => {
    _hide('pwaInstallBtn');
    _deferred = null;
  });

  /* ── iOS Safari : banner instruction manuelle ─── */
  const ua = navigator.userAgent.toLowerCase();
  const isIOS    = /iphone|ipad|ipod/.test(ua);
  const isSafari = /safari/.test(ua) && !/chrome|crios|fxios/.test(ua);
  if (isIOS && isSafari && !sessionStorage.getItem(IOS_DISMISSED_KEY)) {
    setTimeout(() => _show('iosBanner'), 4000);
  }

  /* Expose pour les onclick HTML */
  window._pwaInstall = triggerInstall;
  window._pwaDismiss = dismiss;
}

/**
 * W23 — Affiche la bannière "Mise à jour disponible" et câble le bouton "Actualiser".
 * Envoie SKIP_WAITING au SW en attente, qui prend le contrôle → controllerchange → reload.
 */
function _showUpdateBanner(reg) {
  const banner = document.getElementById('swUpdateBanner');
  if (!banner || !banner.hidden) return;
  banner.hidden = false;
  const btn = banner.querySelector('.update-apply-btn');
  if (btn) {
    btn.addEventListener('click', () => {
      if (reg.waiting) reg.waiting.postMessage({ type: 'SKIP_WAITING' });
      banner.hidden = true;
    });
  }
}

export function triggerInstall() {
  if (!_deferred) return;
  _deferred.prompt();
  _deferred.userChoice.then(() => {
    _deferred = null;
    _hide('pwaInstallBtn');
  });
}

export function dismiss(id) {
  _hide(id);
  if (id === 'iosBanner') sessionStorage.setItem(IOS_DISMISSED_KEY, '1');
}

function _show(id) {
  const el = document.getElementById(id);
  if (el) el.hidden = false;
}

function _hide(id) {
  const el = document.getElementById(id);
  if (el) el.hidden = true;
}
