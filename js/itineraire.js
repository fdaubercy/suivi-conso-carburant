/* ═══════════════════════════════════════════════════════════════════════
   itineraire.js — Popup « renseignements station » + itinéraire S11

   Au clic sur un marqueur (carte favorites ou carte recherche/géoloc) :
     showStationPopup(st) affiche une popup avec les infos de la station
     (nom, prix, distance, adresse) et propose l'itinéraire.

   L'itinéraire part de la POSITION GPS de l'utilisateur (gérée par
   l'application de navigation) vers la station :
     • Waze   : https://waze.com/ul?ll=<lat>,<lon>&navigate=yes
     • Repli  : Google Maps (https://www.google.com/maps/dir/?api=1&destination=…)

   Le clic sur le bouton Waze sert de CONFIRMATION explicite avant de lancer
   l'application (« Obtenir l'itinéraire vers cette station ? »).
═══════════════════════════════════════════════════════════════════════ */
import { escHtml, haversine } from './utils.js';
import { state } from './state.js';

const WAZE_URL  = (lat, lon) => `https://waze.com/ul?ll=${lat},${lon}&navigate=yes`;
const GMAPS_URL = (lat, lon) => `https://www.google.com/maps/dir/?api=1&destination=${lat},${lon}`;

let _overlay = null;

function _close() {
  if (_overlay) { _overlay.remove(); _overlay = null; }
  document.removeEventListener('keydown', _onKey);
}

function _onKey(e) { if (e.key === 'Escape') _close(); }

/**
 * Affiche la popup d'infos station + boutons d'itinéraire.
 * @param {{name:string, lat:number, lon:number, priceLabel?:string, sub?:string, dist?:number}} st
 */
export function showStationPopup(st) {
  if (!st || st.lat == null || st.lon == null) return;
  _close();

  // Distance depuis la position connue si non fournie.
  let dist = st.dist;
  if (dist == null && state.userLat != null && state.userLon != null) {
    dist = Math.round(haversine(state.userLat, state.userLon, st.lat, st.lon));
  }
  const distTxt = dist == null ? '' : dist < 1000 ? dist + ' m' : (dist / 1000).toFixed(1) + ' km';

  const rows = [
    st.priceLabel ? `<div class="stpop-row"><span>⛽</span><span>${escHtml(st.priceLabel)}</span></div>` : '',
    distTxt       ? `<div class="stpop-row"><span>📏</span><span>${escHtml(distTxt)}</span></div>` : '',
    st.sub        ? `<div class="stpop-row"><span>📍</span><span>${escHtml(st.sub)}</span></div>` : '',
  ].filter(Boolean).join('');

  _overlay = document.createElement('div');
  _overlay.className = 'stpop-overlay';
  _overlay.innerHTML = `
    <div class="stpop" role="dialog" aria-modal="true" aria-label="Renseignements station">
      <button class="stpop-x" type="button" aria-label="Fermer">×</button>
      <p class="stpop-title">${escHtml(st.name)}</p>
      <div class="stpop-info">${rows || '<div class="stpop-row"><span>📍</span><span>Station E85</span></div>'}</div>
      <p class="stpop-ask">Obtenir l'itinéraire vers cette station ?</p>
      <div class="stpop-actions">
        <a class="stpop-btn stpop-waze" href="${WAZE_URL(st.lat, st.lon)}" target="_blank" rel="noopener">🚗 Itinéraire Waze</a>
        <a class="stpop-btn stpop-gmaps" href="${GMAPS_URL(st.lat, st.lon)}" target="_blank" rel="noopener">🗺️ Google Maps</a>
      </div>
      <p class="stpop-hint">Waze non installé ? Utilisez Google Maps.</p>
    </div>`;

  _overlay.addEventListener('click', e => {
    if (e.target === _overlay || e.target.closest('.stpop-x')) { _close(); return; }
    if (e.target.closest('.stpop-btn')) _close();   // ferme après lancement de l'app
  });

  document.body.appendChild(_overlay);
  document.addEventListener('keydown', _onKey);
}
