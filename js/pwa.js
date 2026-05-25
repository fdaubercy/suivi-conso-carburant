// ============================================================
//  PWA — Install prompt   W4
//  Android/Chrome : beforeinstallprompt -> bouton "Installer"
//  iOS Safari     : banner instruction manuelle (apres 4 s)
// ============================================================

let _deferred = null;
const BANNER_DISMISSED_KEY = 'pwa_banner_dismissed';

export function initPWA() {
  // Deja installee en mode standalone -> rien a faire
  const isStandalone =
    window.matchMedia('(display-mode: standalone)').matches ||
    window.navigator.standalone === true;
  if (isStandalone) return;

  // Deja dismissed par l'utilisateur
  if (sessionStorage.getItem(BANNER_DISMISSED_KEY)) return;

  // --- Android / Chrome ---
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    _deferred = e;
    _show('installBanner');
  });

  window.addEventListener('appinstalled', () => {
    _hide('installBanner');
    _deferred = null;
  });

  // --- iOS Safari ---
  const ua = navigator.userAgent.toLowerCase();
  const isIOS    = /iphone|ipad|ipod/.test(ua);
  const isSafari = /safari/.test(ua) && !/chrome|crios|fxios/.test(ua);
  if (isIOS && isSafari) {
    setTimeout(() => _show('iosBanner'), 4000);
  }

  // Expose pour les onclick HTML
  window._pwaInstall  = triggerInstall;
  window._pwaDismiss  = dismiss;
}

export function triggerInstall() {
  if (!_deferred) return;
  _deferred.prompt();
  _deferred.userChoice.then(() => {
    _deferred = null;
    _hide('installBanner');
  });
}

export function dismiss(id) {
  _hide(id);
  sessionStorage.setItem(BANNER_DISMISSED_KEY, '1');
}

function _show(id) {
  const el = document.getElementById(id);
  if (el) el.hidden = false;
}

function _hide(id) {
  const el = document.getElementById(id);
  if (el) el.hidden = true;
}
