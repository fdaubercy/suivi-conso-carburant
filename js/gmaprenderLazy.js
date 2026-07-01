/* ─── W78 — Lazy loader partagé pour gmaprender.js (+ gmap.js) ─────────────
   gmaprender.js importe statiquement gmap.js, qui charge le script externe
   Google Maps JS API (+ clusterer) : la chaîne la plus lourde du bundle.
   Pour ne pas la tirer au boot, carte.js / cartealentour.js / stationsmap.js
   importent ce loader au lieu d'importer gmaprender.js directement. Vite en
   fait un chunk séparé, chargé à la demande (1ère consultation d'une carte).
─────────────────────────────────────────────────────────────────────────── */

let _mod = null;
let _promise = null;

/** Charge (une seule fois) et renvoie le module gmaprender.js. */
export function loadGmapRender() {
  if (_mod) return Promise.resolve(_mod);
  if (!_promise) _promise = import('./gmaprender.js').then(m => { _mod = m; return m; });
  return _promise;
}

/** Référence synchrone si déjà chargé (utile pour les handlers de zoom,
 *  appelés seulement après qu'une carte Google ait déjà été rendue une
 *  première fois — donc le module est nécessairement déjà en cache). */
export function gmapRenderCached() { return _mod; }
