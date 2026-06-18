/* ─── W64/D3 — Carte des stations essence les moins chères autour de moi ──────
   Onglet Carte, EN HAUT (au-dessus des stations habituelles). Géoloc → stations
   dans un rayon réglable (10 / 15 / 20 km, défaut 15) → tri par prix du carburant
   courant → carte (top‑3 mises en valeur) + liste triée du - cher au + cher.
   Source prix : API live data.economie.gouv.fr (même flux que la recherche Saisie).
─────────────────────────────────────────────────────────────────────────────── */
import { FUEL_CONFIG, FUEL_KEYS, FUEL_SELECT } from './config.js';
import { state } from './state.js';
import { haversine, escHtml, getCoords, stationSubLabel, composeStationName, resolveEnseigne } from './utils.js';
import { renderMiniMap } from './carte.js';

const RADIUS_KEY    = 'suivi_carbu_alentour_radius';
const RADII         = [10000, 15000, 20000];
const DEFAULT_RADIUS = 15000;

let _radius   = _loadRadius();
let _loading  = false;
let _lastStations = [];

function _loadRadius() {
  try { const v = parseInt(localStorage.getItem(RADIUS_KEY), 10); return RADII.includes(v) ? v : DEFAULT_RADIUS; }
  catch { return DEFAULT_RADIUS; }
}
function _saveRadius(m) { try { localStorage.setItem(RADIUS_KEY, String(m)); } catch { /* quota */ } }

function _card()  { return document.getElementById('alentourCard'); }
function _km(m)   { return (m % 1000 === 0 ? (m / 1000) : (m / 1000).toFixed(1)) + ' km'; }
function _distLabel(d) { return d == null ? '' : d < 1000 ? d + ' m' : (d / 1000).toFixed(1) + ' km'; }

/** En-tête : titre + sélecteur de rayon. */
function _headerHtml(cfg) {
  const btns = RADII.map(m =>
    `<button type="button" class="al-radius-btn${m === _radius ? ' active' : ''}" data-radius="${m}">${m / 1000}</button>`
  ).join('');
  return `<div class="al-head">
      <p class="section-title">⛽ ${escHtml(cfg.short)} les moins chers autour de moi</p>
      <div class="al-radius" role="group" aria-label="Rayon de recherche">${btns}<span class="al-radius-unit">km</span></div>
    </div>`;
}

/** Liste triée (- cher → + cher), top‑3 mises en valeur. */
function _listHtml(stations, fuelKey) {
  const medals = ['🥇', '🥈', '🥉'];
  return stations.map((s, i) => {
    const prix  = s.prices?.[fuelKey];
    const top   = i < 3;
    const medal = `<span class="al-medal">${top ? medals[i] : ''}</span>`;
    return `<div class="al-item${top ? ' top' : ''}">
      ${medal}
      <span class="al-name"><strong>${escHtml(s.name)}</strong><span class="al-sub">${escHtml(s.sub || '')}</span></span>
      <span class="al-prix">${prix != null ? Number(prix).toFixed(3) + ' €/L' : '—'}</span>
      <span class="al-dist">${_distLabel(s.dist)}</span>
      <a class="al-map-btn" href="https://www.google.com/maps/search/?api=1&query=${s.lat},${s.lon}" target="_blank" rel="noopener" title="Itinéraire">🗺️</a>
    </div>`;
  }).join('');
}

/** Rend la carte alentour (squelette persistant : seul #alentourMap est régénéré par renderMiniMap). */
function _render(stations, status) {
  const card = _card();
  if (!card) return;
  const fuelKey = state.currentType || 'E85';
  const cfg = FUEL_CONFIG[fuelKey] || { short: fuelKey };
  card.classList.remove('hidden');

  if (!card.querySelector('#alentourMap')) {
    card.innerHTML = '<div class="al-top"></div>'
                   + '<div class="al-map static-map" id="alentourMap"></div>'
                   + '<div class="al-status" id="alentourStatus"></div>'
                   + '<div class="al-list" id="alentourList"></div>';
  }
  card.querySelector('.al-top').innerHTML = _headerHtml(cfg);

  const statusEl = card.querySelector('#alentourStatus');
  if (status) { statusEl.textContent = status; statusEl.hidden = false; } else { statusEl.hidden = true; }

  const listEl = card.querySelector('#alentourList');
  if (stations && stations.length) {
    listEl.innerHTML = _listHtml(stations, fuelKey);
    const top3 = stations.slice(0, 3).map((_, i) => i);
    renderMiniMap('alentourMap', state.userLat, state.userLon, stations, { radiusM: _radius, highlightIdxs: top3 });
  } else {
    listEl.innerHTML = '';
  }
}

/** Position utilisateur : connue (réutilisée) ou demandée une fois. */
function _ensurePosition() {
  return new Promise(resolve => {
    if (state.userLat != null && state.userLon != null) { resolve(true); return; }
    if (!navigator.geolocation) { resolve(false); return; }
    navigator.geolocation.getCurrentPosition(
      pos => { state.userLat = pos.coords.latitude; state.userLon = pos.coords.longitude; resolve(true); },
      () => resolve(false),
      { timeout: 10000, maximumAge: 60000 }
    );
  });
}

/** Fetch live + tri par prix du carburant courant, dans le rayon choisi. */
async function _fetchSorted(lat, lon, fuelKey) {
  const cfg = FUEL_CONFIG[fuelKey];
  const resp = await fetch(
    'https://data.economie.gouv.fr/api/explore/v2.1/catalog/datasets/prix-des-carburants-en-france-flux-instantane-v2/records?' +
    new URLSearchParams({
      where:  `${cfg.apiField} is not null and distance(geom, geom'POINT(${lon} ${lat})', ${_radius}m)`,
      select: FUEL_SELECT,
      limit:  100
    })
  );
  if (!resp.ok) throw new Error('HTTP ' + resp.status);
  const data = await resp.json();
  return (data.results || [])
    .filter(r => getCoords(r) && r[cfg.apiField] != null)
    .map(r => {
      const c = getCoords(r);
      const prices = {};
      FUEL_KEYS.forEach(k => { if (r[FUEL_CONFIG[k].apiField] != null) prices[k] = r[FUEL_CONFIG[k].apiField]; });
      return {
        name: composeStationName(resolveEnseigne(null, r.adresse), r.ville || ''),
        sub:  stationSubLabel(r), adresse: r.adresse || '',
        lat:  c.lat, lon: c.lon, prices,
        dist: Math.round(haversine(lat, lon, c.lat, c.lon)),
      };
    })
    .filter(s => s.dist <= _radius)
    .sort((a, b) => {
      const pa = Number(a.prices[fuelKey]), pb = Number(b.prices[fuelKey]);
      return pa !== pb ? pa - pb : a.dist - b.dist;
    });
}

/** Entrée publique : (re)charge la carte alentour. Appelée à l'ouverture de l'onglet
 *  Carte et au changement de rayon / véhicule. Best-effort, non bloquant. */
export async function renderAlentour() {
  const card = _card();
  if (!card || _loading) return;
  const fuelKey = state.currentType || 'E85';
  const cfg = FUEL_CONFIG[fuelKey] || { short: fuelKey };
  _loading = true;
  _render(_lastStations, `Recherche des stations ${cfg.short} dans ${_km(_radius)}…`);
  try {
    const ok = await _ensurePosition();
    if (!ok) { _render([], '📍 Active la géolocalisation pour voir les stations autour de toi.'); return; }
    const stations = await _fetchSorted(state.userLat, state.userLon, fuelKey);
    _lastStations = stations;
    if (!stations.length) { _render([], `Aucune station ${cfg.short} trouvée dans ${_km(_radius)}.`); return; }
    const best = Number(stations[0].prices[fuelKey]).toFixed(3);
    _render(stations, `${stations.length} station${stations.length > 1 ? 's' : ''} ${cfg.short} · moins chère ${best} €/L`);
  } catch (e) {
    _render(_lastStations, 'Erreur de recherche (' + (e.message || e) + ').');
  } finally {
    _loading = false;
  }
}

/** Wiring (une fois, depuis main.js) : délégation sur le sélecteur de rayon. */
export function initAlentour() {
  const card = _card();
  if (!card) return;
  card.addEventListener('click', e => {
    const btn = e.target.closest('.al-radius-btn');
    if (!btn) return;
    const m = parseInt(btn.dataset.radius, 10);
    if (!RADII.includes(m) || m === _radius) return;
    _radius = m; _saveRadius(m);
    renderAlentour();
  });
}
