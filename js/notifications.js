/* ═══════════════════════════════════════════════════════════════════════
   notifications.js — Alertes prix par carburant (W11 → W49)

   E85 / Gazole / SP98 : chaque carburant a son interrupteur et son seuil.
   La permission Notification est globale (demandée au 1er carburant activé).

   Flux :
     Utilisateur active un carburant → requestPermission() → localStorage
       notif_<FUEL>_enabled = '1', notif_<FUEL>_seuil = <€/L>
     • foreground : applyPricesResult() → checkPrixAlert(fuel, prix, station)
     • background : refresh GAS ~7h → push sans payload → le Service Worker
       lit ?action=lowprices + les seuils mis en cache (/_push_thresholds)
       et affiche une notification par carburant sous son seuil.

   Support :
     Android Chrome/Edge : full · iOS Safari ≥ 16.4 : PWA installée uniquement
     iOS Safari (browser): non supporté · Firefox Desktop : supporté
═══════════════════════════════════════════════════════════════════════ */

import { GAS_URL, APP_TOKEN, VAPID_PUBLIC_KEY } from './config.js';
import { pushParam } from './parametres.js';
import { getIdToken } from './auth.js';

// Carburants alertables (clé interne, libellé, icône, seuil par défaut €/L).
export const ALERT_FUELS = [
  { key: 'E85',    label: 'E85',    icon: '🌿', def: 0.850 },
  { key: 'GAZOLE', label: 'Gazole', icon: '⚫', def: 1.600 },
  { key: 'SP98',   label: 'SP98',   icon: '💧', def: 1.800 },
];
const PREFS_CACHE     = 'suivi-prefs';
const THRESHOLDS_URL  = '/_push_thresholds';

const _kEnabled = f => `notif_${f}_enabled`;
const _kSeuil   = f => `notif_${f}_seuil`;
const _defOf    = f => (ALERT_FUELS.find(x => x.key === f) || {}).def || 1.0;

/* ─── Migration depuis l'ancien schéma E85 unique (notif_e85_*) ─── */
(function _migrate() {
  try {
    if (localStorage.getItem('notif_e85_enabled') === '1'
        && localStorage.getItem(_kEnabled('E85')) == null) {
      localStorage.setItem(_kEnabled('E85'), '1');
    }
    const oldSeuil = localStorage.getItem('notif_e85_seuil');
    if (oldSeuil != null && localStorage.getItem(_kSeuil('E85')) == null) {
      localStorage.setItem(_kSeuil('E85'), oldSeuil);
    }
  } catch { /* ignore */ }
})();

/* ─── Détection contexte ─────────────────────────────────────────────── */

export const isIOSBrowser = (() => {
  const ios = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
  if (!ios) return false;
  const standalone = window.matchMedia('(display-mode: standalone)').matches
                  || !!window.navigator.standalone;
  return !standalone;
})();

/* ─── Getters / setters par carburant ────────────────────────────────── */

export const isSupported = () => !isIOSBrowser && 'Notification' in window;
export const getPermission = () => isSupported() ? Notification.permission : 'unsupported';

export const isEnabled    = (fuel) => isSupported() && localStorage.getItem(_kEnabled(fuel)) === '1';
export const isAnyEnabled = () => ALERT_FUELS.some(f => isEnabled(f.key));

export function getSeuil(fuel) {
  const v = parseFloat(localStorage.getItem(_kSeuil(fuel)));
  return isFinite(v) && v > 0 ? v : _defOf(fuel);
}

export function setSeuil(fuel, val) {
  const v = parseFloat(val);
  if (isFinite(v) && v > 0 && v < 3.5) {
    localStorage.setItem(_kSeuil(fuel), v.toFixed(3));
    pushParam('seuil_' + fuel);   // P1 — propage le seuil vers le Sheet (et Excel)
  }
}

/* ─── Permission (globale) ───────────────────────────────────────────── */

async function ensurePermission() {
  if (!isSupported()) return false;
  if (Notification.permission === 'granted') return true;
  if (Notification.permission === 'denied')  return false;
  try { return (await Notification.requestPermission()) === 'granted'; }
  catch { return false; }
}

/** Active/désactive les alertes d'UN carburant. Retourne l'état effectif. */
export async function toggleFuel(fuel, enable) {
  if (!isSupported()) return false;

  if (!enable) {
    localStorage.removeItem(_kEnabled(fuel));
    pushParam('seuil_' + fuel + '_enabled');   // P1 — propage l'état (désactivé)
    if (isAnyEnabled()) registerPushSubscription();   // met à jour seuils + cache
    else { unregisterPushSubscription(); writeThresholdsToCache(); }
    updateNotifUI();
    return false;
  }

  const granted = await ensurePermission();
  if (!granted) { updateNotifUI(); return false; }

  localStorage.setItem(_kEnabled(fuel), '1');
  pushParam('seuil_' + fuel + '_enabled');   // P1 — propage l'état (activé)
  registerPushSubscription();
  updateNotifUI();
  return true;
}

/* ─── S8/W49 — Abonnement Web Push (VAPID) + cache des seuils ─────────── */

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64  = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw     = atob(base64);
  const out     = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

/** Seuils par carburant pour GAS : { E85: 0.85|null, GAZOLE:…, SP98:… }.
 *  null = carburant désactivé (pas d'alerte). */
function seuilsPayload() {
  const out = {};
  ALERT_FUELS.forEach(f => { out[f.key] = isEnabled(f.key) ? getSeuil(f.key) : null; });
  return out;
}

/** Écrit les seuils dans le Cache pour que le Service Worker filtre les pushes. */
export async function writeThresholdsToCache() {
  try {
    const data = {};
    ALERT_FUELS.forEach(f => { data[f.key] = { enabled: isEnabled(f.key), seuil: getSeuil(f.key) }; });
    const cache = await caches.open(PREFS_CACHE);
    await cache.put(THRESHOLDS_URL,
      new Response(JSON.stringify(data), { headers: { 'Content-Type': 'application/json' } }));
  } catch { /* Cache indisponible — non bloquant */ }
}

export async function registerPushSubscription() {
  writeThresholdsToCache();                         // toujours, même sans clé VAPID
  if (!VAPID_PUBLIC_KEY) return;
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) return;
  if (Notification.permission !== 'granted') return;

  try {
    const reg = await navigator.serviceWorker.ready;
    let sub   = await reg.pushManager.getSubscription();
    if (!sub) {
      sub = await reg.pushManager.subscribe({
        userVisibleOnly:      true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY)
      });
    }
    await fetch(GAS_URL, {
      method:  'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },   // évite le preflight CORS
      body:    JSON.stringify({
        action:       'savePushSub',
        subscription: sub.toJSON(),
        seuils:       seuilsPayload(),
        token:        APP_TOKEN,
        idToken:      getIdToken()   // U7 — rattache l'abonnement au compte
      })
    });
  } catch (e) {
    console.warn('Push subscribe échoué :', e?.message || e);
  }
}

export async function unregisterPushSubscription() {
  if (!('serviceWorker' in navigator)) return;
  try {
    const reg = await navigator.serviceWorker.ready;
    const sub = await reg.pushManager.getSubscription();
    if (sub) await sub.unsubscribe();
  } catch { /* silencieux */ }
}

/* ─── Vérification prix (foreground) ─────────────────────────────────── */

/** Alerte locale si le prix d'un carburant est sous son seuil (app ouverte). */
export function checkPrixAlert(fuel, prixVal, station) {
  if (!isEnabled(fuel)) return;
  if (Notification.permission !== 'granted') return;
  const prix  = parseFloat(prixVal);
  const seuil = getSeuil(fuel);
  if (!isFinite(prix) || prix <= 0 || prix >= seuil) return;

  const f = ALERT_FUELS.find(x => x.key === fuel) || { label: fuel, icon: '⛽' };
  const body = [
    station ? `📍 Station : ${station}` : null,
    `${f.icon} ${f.label} à ${prix.toFixed(3)} €/L`,
    `🎯 Seuil : ${seuil.toFixed(3)} €/L`,
  ].filter(Boolean).join('\n');

  new Notification(`${f.icon} Prix ${f.label} avantageux !`, {
    body, icon: 'icons/icon.svg', badge: 'icons/icon.svg', tag: `price-alert-${fuel}`,
  });
}

/** Rétrocompat : ancien appel E85 (prix.js historique). */
export function checkPrixE85Alert(prixE85, station) {
  checkPrixAlert('E85', prixE85, station);
}

/* ─── UI ─────────────────────────────────────────────────────────────── */

function _highlightIOSBanner() {
  const el = document.getElementById('notifIOS');
  if (!el) return;
  el.hidden = false;
  el.classList.remove('notif-flash');
  void el.offsetWidth;
  el.classList.add('notif-flash');
}

/** Construit les lignes toggle + seuil par carburant dans #notifFuelRows. */
function buildFuelRows() {
  const host = document.getElementById('notifFuelRows');
  if (!host || host.dataset.built === '1') return;
  host.dataset.built = '1';
  // Un bloc « param-group » par carburant : la ligne Alertes et son Seuil sont
  // visuellement regroupés (même paragraphe), pour qu'on identifie d'un coup
  // d'œil à quel carburant se rapporte chaque seuil.
  host.innerHTML = ALERT_FUELS.map(f => `
    <div class="param-group" data-fuel-group="${f.key}">
      <div class="notif-row">
        <div>
          <span class="notif-label">${f.icon} Alertes ${f.label}</span>
          <span class="notif-sub">Notification quand le ${f.label} passe sous votre seuil</span>
        </div>
        <label class="switch" title="Activer les alertes ${f.label}">
          <input type="checkbox" data-fuel="${f.key}">
          <span class="switch-track"></span>
        </label>
      </div>
      <div class="seuil-row notif-fuel-seuil" data-fuel-seuil="${f.key}" hidden>
        <label class="notif-label">Seuil ${f.label}</label>
        <div style="display:flex;align-items:center;gap:6px">
          <input type="number" class="seuil-input" data-fuel-input="${f.key}"
                 step="0.001" min="0.3" max="3.0" inputmode="decimal">
          <span class="seuil-unit">€/L</span>
        </div>
      </div>
    </div>`).join('');
}

export function updateNotifUI() {
  const denied    = document.getElementById('notifDenied');
  const noSupport = document.getElementById('notifNoSupport');
  const iosBanner = document.getElementById('notifIOS');

  const supported = isSupported();
  const perm      = getPermission();

  if (iosBanner)  iosBanner.hidden  = !isIOSBrowser;
  if (noSupport)  noSupport.hidden  = isIOSBrowser || supported;
  if (denied)     denied.hidden     = isIOSBrowser || perm !== 'denied';

  ALERT_FUELS.forEach(f => {
    const toggle = document.querySelector(`#notifFuelRows input[data-fuel="${f.key}"]`);
    const seuilRow = document.querySelector(`#notifFuelRows [data-fuel-seuil="${f.key}"]`);
    const seuilInp = document.querySelector(`#notifFuelRows input[data-fuel-input="${f.key}"]`);
    const enabled = isEnabled(f.key);
    if (toggle) {
      toggle.checked  = enabled;
      toggle.disabled = !isIOSBrowser && (!supported || perm === 'denied');
    }
    if (seuilRow) seuilRow.hidden = !enabled;
    if (seuilInp && document.activeElement !== seuilInp) seuilInp.value = getSeuil(f.key).toFixed(3);
  });
}

/* ─── Init ───────────────────────────────────────────────────────────── */

export function initNotifications() {
  buildFuelRows();
  updateNotifUI();

  if (isAnyEnabled()) registerPushSubscription();   // réabonne + cache seuils
  else writeThresholdsToCache();

  const host = document.getElementById('notifFuelRows');
  if (!host) return;

  // Toggles (délégation) — câblés même sur iOS browser pour le message d'install.
  host.addEventListener('change', async e => {
    const toggle = e.target.closest('input[data-fuel]');
    if (toggle) {
      const fuel = toggle.dataset.fuel;
      if (isIOSBrowser)      { toggle.checked = false; _highlightIOSBanner(); return; }
      if (!isSupported())    { toggle.checked = false; return; }
      const ok = await toggleFuel(fuel, toggle.checked);
      if (!ok) toggle.checked = false;
      return;
    }
    const inp = e.target.closest('input[data-fuel-input]');
    if (inp) {
      const fuel = inp.dataset.fuelInput;
      setSeuil(fuel, inp.value);
      inp.value = getSeuil(fuel).toFixed(3);
      if (isAnyEnabled()) registerPushSubscription();   // propage seuils à GAS + cache
      else writeThresholdsToCache();
    }
  });
}
