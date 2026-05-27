/* ═══════════════════════════════════════════════════════════════════════
   notifications.js — Alertes prix E85

   Flux :
     Utilisateur active le toggle
       → requestPermission()
       → localStorage : notif_e85_enabled = '1'
     applyPricesResult() reçoit les prix d'une station
       → checkPrixE85Alert(prix, station)
       → si E85 < seuil && permission granted → new Notification(...)

   Support :
     Android Chrome/Edge : full (foreground + standalone)
     iOS Safari ≥ 16.4   : standalone PWA uniquement (installée via "Sur l'écran d'accueil")
     iOS Safari (browser): non supporté — toggle répond visuellement mais revient à off
                           + message d'installation mis en évidence
     Firefox Desktop     : supporté
═══════════════════════════════════════════════════════════════════════ */

const KEY_ENABLED   = 'notif_e85_enabled';
const KEY_SEUIL     = 'notif_e85_seuil';
const DEFAULT_SEUIL = 0.850;

/* ─── Détection contexte ─────────────────────────────────────────────── */

/**
 * Vrai si l'app tourne sur iOS dans Safari (navigateur) — PAS installée en PWA.
 * Sur iOS en mode standalone (ajoutée à l'écran d'accueil), les notifications
 * fonctionnent à partir de iOS 16.4 → ce cas est traité comme un navigateur normal.
 */
export const isIOSBrowser = (() => {
  const ios = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
  if (!ios) return false;
  const standalone = window.matchMedia('(display-mode: standalone)').matches
                  || !!window.navigator.standalone;
  return !standalone;   // iOS browser = iOS ET non installée
})();

/* ─── Getters / setters ──────────────────────────────────────────────── */

/** L'API Notification est utilisable dans ce contexte. */
export const isSupported = () => !isIOSBrowser && 'Notification' in window;

export const isEnabled     = () => isSupported() && localStorage.getItem(KEY_ENABLED) === '1';
export const getPermission = () => isSupported() ? Notification.permission : 'unsupported';

export function getSeuil() {
  const v = parseFloat(localStorage.getItem(KEY_SEUIL));
  return isFinite(v) && v > 0 ? v : DEFAULT_SEUIL;
}

export function setSeuil(val) {
  const v = parseFloat(val);
  if (isFinite(v) && v > 0 && v < 3.5) {
    localStorage.setItem(KEY_SEUIL, v.toFixed(3));
  }
}

/* ─── Permission ─────────────────────────────────────────────────────── */

/**
 * Active ou désactive les notifications.
 * Si activation demandée → request permission → retourne true si accordée.
 */
export async function toggleNotifications(enable) {
  if (!isSupported()) return false;

  if (!enable) {
    localStorage.removeItem(KEY_ENABLED);
    updateNotifUI();
    return false;
  }

  if (Notification.permission === 'granted') {
    localStorage.setItem(KEY_ENABLED, '1');
    updateNotifUI();
    return true;
  }

  if (Notification.permission === 'denied') {
    updateNotifUI();
    return false;
  }

  /* default → demander (peut lever une exception sur certains navigateurs) */
  let perm;
  try {
    perm = await Notification.requestPermission();
  } catch {
    localStorage.removeItem(KEY_ENABLED);
    updateNotifUI();
    return false;
  }

  if (perm === 'granted') {
    localStorage.setItem(KEY_ENABLED, '1');
    updateNotifUI();
    new Notification('✓ Alertes E85 activées', {
      body: `Vous serez alerté quand l'E85 passe sous ${getSeuil().toFixed(3)} €/L.`,
      icon: 'icons/icon.svg',
      tag: 'e85-activation',
    });
    return true;
  } else {
    localStorage.removeItem(KEY_ENABLED);
    updateNotifUI();
    return false;
  }
}

/* ─── Vérification prix ──────────────────────────────────────────────── */

export function checkPrixE85Alert(prixE85, station) {
  if (!isEnabled()) return;
  if (Notification.permission !== 'granted') return;

  const prix  = parseFloat(prixE85);
  const seuil = getSeuil();
  if (!isFinite(prix) || prix <= 0) return;

  if (prix < seuil) {
    const body = [
      station ? `📍 Station : ${station}` : null,
      `⛽ E85 à ${prix.toFixed(3)} €/L`,
      `🎯 Seuil : ${seuil.toFixed(3)} €/L`,
    ].filter(Boolean).join('\n');

    new Notification('🌿 Prix E85 avantageux !', {
      body,
      icon: 'icons/icon.svg',
      tag:  'e85-price-alert',
      badge: 'icons/icon.svg',
    });
  }
}

/* ─── UI helpers ─────────────────────────────────────────────────────── */

/**
 * Met en évidence le message iOS (#notifIOS) avec une animation ambre.
 * Appelé quand l'utilisateur tape le toggle sur iOS browser.
 */
function _highlightIOSBanner() {
  const el = document.getElementById('notifIOS');
  if (!el) return;
  el.hidden = false;
  /* Force un reflow pour relancer l'animation si déjà présente */
  el.classList.remove('notif-flash');
  void el.offsetWidth;
  el.classList.add('notif-flash');
}

/* ─── UI ─────────────────────────────────────────────────────────────── */

export function updateNotifUI() {
  const toggle    = document.getElementById('notifToggle');
  const seuilRow  = document.getElementById('notifSeuilRow');
  const denied    = document.getElementById('notifDenied');
  const noSupport = document.getElementById('notifNoSupport');
  const iosBanner = document.getElementById('notifIOS');

  const supported = isSupported();
  const enabled   = isEnabled();
  const perm      = getPermission();

  /* Message iOS browser : prioritaire sur "non supporté" et "bloqué" */
  if (iosBanner)  iosBanner.hidden  = !isIOSBrowser;

  /* Message "non supporté" — caché sur iOS (a son propre message) */
  if (noSupport)  noSupport.hidden  = isIOSBrowser || supported;

  /* Message "bloqué" — caché sur iOS (message iOS est plus pertinent) */
  if (denied)     denied.hidden     = isIOSBrowser || perm !== 'denied';

  if (toggle) {
    toggle.checked  = enabled;
    /* iOS browser : toggle NON désactivé → garde le retour visuel au tap,
       géré dans initNotifications() pour afficher le message d'installation. */
    toggle.disabled = !isIOSBrowser && (!supported || perm === 'denied');
  }
  if (seuilRow) seuilRow.hidden = !enabled;
}

/* ─── Init ───────────────────────────────────────────────────────────── */

export function initNotifications() {
  updateNotifUI();

  /* Le toggle est toujours câblé, même sur iOS browser, pour fournir
     un retour visuel (bref flash vert → retour à off) + message animé. */
  const toggle = document.getElementById('notifToggle');
  if (toggle) {
    toggle.addEventListener('change', async () => {
      if (isIOSBrowser) {
        /* iOS browser : réinitialiser immédiatement + mettre en évidence
           le message d'installation */
        toggle.checked = false;
        _highlightIOSBanner();
        return;
      }
      if (!isSupported()) {
        toggle.checked = false;
        return;
      }
      const ok = await toggleNotifications(toggle.checked);
      if (!ok) toggle.checked = false;
    });
  }

  /* Seuil input — seulement si l'API est disponible */
  if (!isSupported()) return;

  const inp = document.getElementById('notifSeuil');
  if (inp) {
    inp.value = getSeuil().toFixed(3);
    inp.addEventListener('change', () => {
      setSeuil(inp.value);
      inp.value = getSeuil().toFixed(3);
    });
  }
}
