/* ═══════════════════════════════════════
   Pull-to-refresh (W46)
   Tirer la page vers le bas en haut d'écran → recharge l'app.
   Utile surtout en PWA standalone iOS, où Safari n'offre PAS de
   pull-to-refresh natif (et où body a overscroll-behavior-y:none).
═══════════════════════════════════════ */

const THRESHOLD = 70;    // distance à tirer (px, après résistance) pour déclencher
const MAX_PULL   = 110;  // déplacement visuel maximal de l'indicateur
const RESIST     = 0.5;  // résistance : le doigt avance 2× plus vite que l'indicateur

let startY  = 0;
let pulling = false;     // un geste de tir est-il en cours ?
let armed   = false;     // seuil dépassé → relâcher = recharger
let indicator, icon;

/** Sommet de page atteint ? */
function atTop() {
  const se = document.scrollingElement || document.documentElement;
  return (window.scrollY || se.scrollTop || 0) <= 0;
}

/** L'élément touché (ou un ancêtre) peut-il encore défiler vers le haut ?
 *  Si oui, le geste doit faire défiler ce conteneur, pas recharger. */
function innerCanScrollUp(el) {
  while (el && el !== document.body && el !== document.documentElement) {
    if (el.scrollTop > 0) {
      const oy = window.getComputedStyle(el).overflowY;
      if (oy === 'auto' || oy === 'scroll') return true;
    }
    el = el.parentElement;
  }
  return false;
}

function buildIndicator() {
  indicator = document.createElement('div');
  indicator.className = 'ptr';
  indicator.setAttribute('aria-hidden', 'true');
  icon = document.createElement('span');
  icon.className = 'ptr-icon';
  icon.textContent = '↻';
  indicator.appendChild(icon);
  document.body.appendChild(indicator);
}

/** Positionne l'indicateur en fonction de la distance tirée. */
function showPull(dist) {
  const y = dist - 50;                       // -50 = caché au-dessus de l'écran
  const opacity = Math.min(dist / THRESHOLD, 1);
  indicator.style.transform = `translate(-50%, ${y}px)`;
  indicator.style.opacity   = opacity;
  icon.style.transform      = `rotate(${Math.min(dist / MAX_PULL, 1) * 270}deg)`;
  indicator.classList.toggle('ptr--armed', armed);
}

/** Replie l'indicateur (geste annulé). */
function reset() {
  pulling = armed = false;
  indicator.style.transition = 'transform .2s ease, opacity .2s ease';
  indicator.style.transform  = 'translate(-50%, -60px)';
  indicator.style.opacity    = 0;
  icon.style.transform       = 'rotate(0deg)';
  indicator.classList.remove('ptr--armed');
  setTimeout(() => { indicator.style.transition = ''; }, 220);
}

/** Affiche le spinner puis recharge l'app. */
function triggerRefresh() {
  indicator.style.transition = 'transform .15s ease';
  indicator.style.transform  = 'translate(-50%, 16px)';
  indicator.style.opacity    = 1;
  indicator.classList.add('ptr--refreshing');
  // Laisse le spinner s'afficher avant de recharger.
  setTimeout(() => window.location.reload(), 280);
}

function onStart(e) {
  pulling = armed = false;
  if (e.touches.length !== 1) return;
  if (!atTop()) return;
  if (innerCanScrollUp(e.target)) return;
  // Ne pas capturer les gestes sur la carte interactive (panoramique).
  if (e.target.closest && e.target.closest('#stationMap, [data-no-ptr]')) return;
  startY  = e.touches[0].clientY;
  pulling = true;
}

function onMove(e) {
  if (!pulling) return;
  const dy = e.touches[0].clientY - startY;
  if (dy <= 0 || !atTop()) { reset(); return; }   // remontée ou plus en haut → annule
  e.preventDefault();                              // bloque scroll / overscroll natif
  const dist = Math.min(dy * RESIST, MAX_PULL);
  armed = dist >= THRESHOLD;
  showPull(dist);
}

function onEnd() {
  if (!pulling) return;
  pulling = false;
  if (armed) triggerRefresh();
  else       reset();
}

/** Initialise le pull-to-refresh (uniquement sur appareils tactiles). */
export function initPullRefresh() {
  if (!('ontouchstart' in window)) return;   // pas de souris → tactile uniquement
  buildIndicator();
  // touchmove NON passif : indispensable pour preventDefault().
  window.addEventListener('touchstart', onStart, { passive: true });
  window.addEventListener('touchmove',  onMove,  { passive: false });
  window.addEventListener('touchend',   onEnd,   { passive: true });
  window.addEventListener('touchcancel', reset,  { passive: true });
}
