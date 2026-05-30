/* ═══════════════════════════════════════
   swipe.js — Gestes de navigation entre onglets (W44)

   Balayage horizontal gauche/droite (pointer events) pour passer d'une vue à
   l'autre, en complément de la barre d'onglets. La transition latérale est
   gérée par le routeur (classes view--slide-next / view--slide-prev).

   Garde-fous : ne se déclenche que pour un geste nettement horizontal, ignore
   les zones interactives (cartes, formulaires, sélecteurs, listes scrollables)
   et le tout premier pixel du bord gauche (geste « retour » natif iOS).
═══════════════════════════════════════ */

import { navigateRelative, currentView, SWIPE_ORDER } from './router.js';

const THRESHOLD   = 55;   // déplacement horizontal minimal (px)
const RATIO       = 1.4;  // |dx| doit dépasser RATIO × |dy| (geste horizontal)
const MAX_OFF_AXIS = 90;  // au-delà → considéré comme un scroll vertical
const EDGE_GUARD  = 24;   // bord gauche réservé au « retour » natif

// Éléments où un balayage horizontal a un autre sens (pan carte, scroll, saisie).
const NO_SWIPE = [
  'input', 'select', 'textarea', 'button', 'a',
  '.static-map', '#staticStationMap', '#stationMap', '.leaflet-container',
  '.smap-fuel-sel', '.smap-sort', '.switch', '.radius-row',
  '[data-no-swipe]'
].join(',');

let startX = 0, startY = 0, tracking = false;

export function initSwipe() {
  const root = document.getElementById('app-main');
  if (!root || !window.PointerEvent) return;

  root.addEventListener('pointerdown', e => {
    tracking = false;
    if (!e.isPrimary) return;
    if (e.pointerType === 'mouse') return;                 // tactile / stylet seulement
    if (e.clientX <= EDGE_GUARD) return;                   // laisse le « retour » natif
    if (!SWIPE_ORDER.includes(currentView())) return;      // vue hors séquence (accueil)
    if (e.target.closest && e.target.closest(NO_SWIPE)) return;
    startX = e.clientX; startY = e.clientY; tracking = true;
  }, { passive: true });

  root.addEventListener('pointerup', e => {
    if (!tracking) return;
    tracking = false;
    const dx = e.clientX - startX;
    const dy = e.clientY - startY;
    if (Math.abs(dy) > MAX_OFF_AXIS) return;
    if (Math.abs(dx) < THRESHOLD)    return;
    if (Math.abs(dx) <= RATIO * Math.abs(dy)) return;
    navigateRelative(dx < 0 ? 1 : -1);   // gauche → suivante · droite → précédente
  }, { passive: true });

  root.addEventListener('pointercancel', () => { tracking = false; }, { passive: true });
}
