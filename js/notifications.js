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
     iOS Safari ≥ 16.4   : standalone PWA uniquement
     iOS Safari (browser): non supporté (API absente)
     Firefox Desktop     : supporté
═══════════════════════════════════════════════════════════════════════ */

const KEY_ENABLED = 'notif_e85_enabled';
const KEY_SEUIL   = 'notif_e85_seuil';
const DEFAULT_SEUIL = 0.850;

/* ─── Getters / setters ──────────────────────────────────────────────── */

export const isSupported = () => 'Notification' in window;
export const isEnabled   = () => isSupported() && localStorage.getItem(KEY_ENABLED) === '1';
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
    return false;     // l'utilisateur a bloqué dans les réglages OS
  }

  /* default → demander */
  const perm = await Notification.requestPermission();
  if (perm === 'granted') {
    localStorage.setItem(KEY_ENABLED, '1');
    updateNotifUI();
    /* Notification de confirmation */
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

/**
 * Émet une notification si le prix E85 est sous le seuil.
 * @param {number|string} prixE85   Prix E85 en €/L
 * @param {string}        [station] Nom de la station (optionnel)
 */
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
      tag:  'e85-price-alert',    // remplace la précédente (pas de spam)
      badge: 'icons/icon.svg',
    });
  }
}

/* ─── UI ─────────────────────────────────────────────────────────────── */

export function updateNotifUI() {
  const toggle    = document.getElementById('notifToggle');
  const seuilRow  = document.getElementById('notifSeuilRow');
  const denied    = document.getElementById('notifDenied');
  const noSupport = document.getElementById('notifNoSupport');

  const supported = isSupported();
  const enabled   = isEnabled();
  const perm      = getPermission();

  if (noSupport) noSupport.hidden = supported;        // affiché si API absente
  if (denied)    denied.hidden    = perm !== 'denied'; // affiché si bloqué

  if (toggle) {
    toggle.checked  = enabled;
    toggle.disabled = !supported || perm === 'denied';
  }
  if (seuilRow) seuilRow.hidden = !enabled;
}

/* ─── Init ───────────────────────────────────────────────────────────── */

export function initNotifications() {
  if (!isSupported()) { updateNotifUI(); return; }

  /* Seuil input */
  const inp = document.getElementById('notifSeuil');
  if (inp) {
    inp.value = getSeuil().toFixed(3);
    inp.addEventListener('change', () => {
      setSeuil(inp.value);
      inp.value = getSeuil().toFixed(3); // normalise
    });
  }

  /* Toggle */
  const toggle = document.getElementById('notifToggle');
  if (toggle) {
    toggle.addEventListener('change', async () => {
      const ok = await toggleNotifications(toggle.checked);
      if (!ok) toggle.checked = false;  // permission refusée → décocher
    });
  }

  updateNotifUI();
}
