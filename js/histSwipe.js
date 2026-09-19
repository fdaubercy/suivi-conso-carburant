/* ═══════════════════════════════════════
   histSwipe.js — Swipe-gauche « iOS » sur une ligne d'historique (W92)

   Un balayage horizontal gauche sur une carte de plein fait glisser son contenu
   et révèle le tiroir d'actions (✏️ Modifier · 📤 Partager · 🗑️ Supprimer). Un
   balayage droit (ou un tap ailleurs) referme. Tactile uniquement : le tap et le
   clavier restent les accès universels à l'édition (cf. historique.js).

   Découplé du swipe INTER-ONGLETS (swipe.js) : `.hist-item` est exclu de sa liste
   NO_SWIPE pour que les deux gestes ne se déclenchent pas ensemble.
═══════════════════════════════════════ */

const OPEN_DX  = 45;   // déplacement gauche minimal pour ouvrir le tiroir (px)
const CLOSE_DX = 45;   // déplacement droit minimal pour refermer (px)
const MOVE_SLOP = 10;  // au-delà → geste (neutralise le clic d'édition)

const LIST_IDS = ['historiqueList', 'histoireFullList'];

/** Referme tous les tiroirs ouverts sauf, éventuellement, `except`. */
function closeAll(except) {
  document.querySelectorAll('.hist-item.open').forEach(el => {
    if (el !== except) el.classList.remove('open');
  });
}

function attach(list) {
  let startX = 0, startY = 0, item = null, active = false;

  list.addEventListener('pointerdown', e => {
    active = false; item = null;
    if (!e.isPrimary || e.pointerType === 'mouse') return;          // tactile uniquement
    if (e.target.closest('.hist-drawer')) return;                   // pas depuis un bouton d'action
    const content = e.target.closest && e.target.closest('.hist-swipe-content');
    if (!content) return;
    item = content.closest('.hist-item');
    startX = e.clientX; startY = e.clientY; active = true;
  }, { passive: true });

  list.addEventListener('pointermove', e => {
    if (!active || !item) return;
    const dx = e.clientX - startX, dy = e.clientY - startY;
    // Mouvement horizontal net → marquer la ligne : le clic « fantôme » qui suivra
    // le pointerup ne doit PAS déclencher l'édition (drapeau lu par historique.js).
    if (Math.abs(dx) > MOVE_SLOP && Math.abs(dx) > Math.abs(dy)) item.dataset.swiped = '1';
  }, { passive: true });

  list.addEventListener('pointerup', e => {
    if (!active || !item) { active = false; return; }
    active = false;
    const dx = e.clientX - startX, dy = e.clientY - startY;
    if (Math.abs(dy) > Math.abs(dx)) return;   // geste vertical → scroll, on ne touche à rien
    if (dx <= -OPEN_DX) { closeAll(item); item.classList.add('open'); }
    else if (dx >= CLOSE_DX) { item.classList.remove('open'); }
    item = null;
  }, { passive: true });

  list.addEventListener('pointercancel', () => { active = false; item = null; }, { passive: true });
}

export function initHistSwipe() {
  if (!window.PointerEvent) return;
  LIST_IDS.forEach(id => {
    const list = document.getElementById(id);
    if (list) attach(list);
  });
  // Referme tout tiroir ouvert au toucher hors d'une ligne d'historique.
  document.addEventListener('pointerdown', e => {
    if (!e.target.closest('.hist-item')) closeAll(null);
  }, { passive: true });
}
