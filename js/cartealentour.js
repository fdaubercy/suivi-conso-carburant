/* ─── W64/D3 — Carte des stations essence les moins chères autour de moi ──────
   Onglet Carte, EN HAUT (au-dessus des stations habituelles). Calquée sur la
   carte « Stations habituelles » (stationsmap.js) :
     • sélecteur de carburant (E85 / Gazole / SP98) en tête ;
     • TOP 3 (carburant choisi) affiché AU-DESSUS de la carte ;
     • carte Google (logo d'enseigne + prix par marqueur, zoom +/-, plein écran)
       avec repli tuiles OSM ; rayon réglable 5 / 10 / 15 / 20 km ;
     • liste défilante du RESTE des stations sous la carte (≈3 visibles + ascenseur) ;
     • noms « Enseigne - Ville » (composeStationName + enrichissement OSM progressif).
   Source prix : API live data.economie.gouv.fr (les 3 carburants en une requête →
   le changement de carburant re-trie sans re-fetch ; le rayon, lui, re-fetch).
─────────────────────────────────────────────────────────────────────────────── */
import { FUEL_CONFIG, FUEL_KEYS, FUEL_SELECT } from './config.js';
import { state } from './state.js';
import { haversine, escHtml, getCoords, stationSubLabel, composeStationName, resolveEnseigne } from './utils.js';
import { renderMiniMap } from './carte.js';
import { loadGmapRender, gmapRenderCached } from './gmaprenderLazy.js';
import { detectBrand } from './brand.js';
import { showStationPopup } from './itineraire.js';
import { enrichStationsBulk, cancelOsmEnrich } from './osm.js';

const RADIUS_KEY     = 'suivi_carbu_alentour_radius';
const RADII          = [5000, 10000, 15000, 20000];
const DEFAULT_RADIUS = 15000;
const AL_FUELS       = ['E85', 'GAZOLE', 'SP98'];   // mêmes carburants que la carte habituelles

let _radius   = _loadRadius();
let _fuel     = _defaultFuel();
let _loading  = false;
let _stations = [];          // dernier fetch (avec prix par carburant)

function _loadRadius() {
  try { const v = parseInt(localStorage.getItem(RADIUS_KEY), 10); return RADII.includes(v) ? v : DEFAULT_RADIUS; }
  catch { return DEFAULT_RADIUS; }
}
function _saveRadius(m) { try { localStorage.setItem(RADIUS_KEY, String(m)); } catch { /* quota */ } }
function _defaultFuel() {
  const c = state.currentType;
  return AL_FUELS.includes(c) ? c : 'E85';
}

function _card()  { return document.getElementById('alentourCard'); }
function _km(m)   { return (m % 1000 === 0 ? (m / 1000) : (m / 1000).toFixed(1)) + ' km'; }
function _distLabel(d) { return d == null ? '' : d < 1000 ? d + ' m' : (d / 1000).toFixed(1) + ' km'; }

/** Stations vendant le carburant choisi, triées du - cher au + cher (égalité → distance). */
function _sortedFor(fuel) {
  return _stations
    .filter(s => Number(s.prices?.[fuel]) > 0)
    .sort((a, b) => {
      const pa = Number(a.prices[fuel]), pb = Number(b.prices[fuel]);
      return pa !== pb ? pa - pb : (a.dist || 0) - (b.dist || 0);
    });
}

/* ── Fragments HTML ───────────────────────────────────────────────────────── */

/** En-tête : titre + sélecteur de carburant + sélecteur de rayon. */
function _topHtml(cfg) {
  const fuelBtns = AL_FUELS.map(k => {
    const fc = FUEL_CONFIG[k] || {};
    const on = k === _fuel;
    return `<button type="button" class="smap-fuel-btn${on ? ' active' : ''}" data-al-fuel="${k}" role="tab" aria-selected="${on}">${fc.icon || ''} ${fc.short || k}</button>`;
  }).join('');
  const radiusBtns = RADII.map(m =>
    `<button type="button" class="al-radius-btn${m === _radius ? ' active' : ''}" data-radius="${m}">${m / 1000}</button>`
  ).join('');
  return `<p class="section-title">⛽ ${escHtml(cfg.short)} les moins chers autour de moi</p>
    <div class="smap-fuel-sel" role="tablist">${fuelBtns}</div>
    <div class="al-radius" role="group" aria-label="Rayon de recherche">${radiusBtns}<span class="al-radius-unit">km</span></div>`;
}

/** Une ligne station (utilisée pour le top 3 et la liste). Le span médaille est
 *  toujours rendu (vide hors top 3) → top 3 et liste partagent la même grille. */
function _itemHtml(s, fuel, rank) {
  const medals = ['🥇', '🥈', '🥉'];
  const prix = s.prices?.[fuel];
  const badge = `<span class="al-medal">${rank != null ? (medals[rank] || '') : ''}</span>`;
  return `<div class="al-item${rank != null ? ' top' : ''}">
    ${badge}
    <span class="al-name"><strong>${escHtml(s.name)}</strong><span class="al-sub">${escHtml(s.sub || '')}</span></span>
    <span class="al-prix">${prix != null ? Number(prix).toFixed(3) + ' €/L' : '—'}</span>
    <span class="al-dist">${_distLabel(s.dist)}</span>
    <a class="al-map-btn" href="https://www.google.com/maps/search/?api=1&query=${s.lat},${s.lon}" target="_blank" rel="noopener" title="Itinéraire">🗺️</a>
  </div>`;
}

/* ── Rendu de la carte (Google si dispo, sinon tuiles OSM) ─────────────────── */
async function _renderMap(sorted, fuel) {
  const id = 'alentourStationMap';
  const container = document.getElementById(id);
  if (!container) return;
  const short = FUEL_CONFIG[fuel]?.short || fuel;
  const top3 = new Set(sorted.slice(0, 3));

  // W78 — chargement à la demande de gmaprender.js (+ gmap.js, chunk séparé).
  const { googleMapsActive, renderGoogleStationMap } = await loadGmapRender();

  if (googleMapsActive()) {
    const gStations = sorted.map(s => ({
      lat: s.lat, lon: s.lon,
      text:  Number(s.prices[fuel]).toFixed(3),
      title: `${s.name} — ${short} ${Number(s.prices[fuel]).toFixed(3)} €/L`,
      brand: detectBrand(s.name),
      onClick: () => showStationPopup({
        name: s.name, lat: s.lat, lon: s.lon, dist: s.dist, sub: s.sub,
        priceLabel: `${short} ${Number(s.prices[fuel]).toFixed(3)} €/L`,
      }),
    }));
    const uPos = (state.userLat != null && state.userLon != null)
      ? { lat: state.userLat, lon: state.userLon, title: 'Votre position' } : null;
    renderGoogleStationMap(container, {
      stations: gStations, userPos: uPos, radiusM: _radius, zoomControl: false,
      fitStationsOnly: true,                 // zoom adapté à la zone des stations trouvées
      onFallback: () => _renderOsm(sorted, fuel, top3),
    });
  } else {
    _renderOsm(sorted, fuel, top3);
  }
}

function _renderOsm(sorted, fuel, top3) {
  const pts = sorted.map(s => ({
    lat: s.lat, lon: s.lon, name: s.name,
    priceText: Number(s.prices[fuel]).toFixed(3),
  }));
  const hi = sorted.map((s, i) => top3.has(s) ? i : -1).filter(i => i >= 0);
  renderMiniMap('alentourStationMap', state.userLat, state.userLon, pts, { radiusM: _radius, highlightIdxs: hi, fitStationsOnly: true });
}

/** (Re)construit la carte alentour (squelette persistant : seul le contenu dynamique change). */
function _render(status) {
  const card = _card();
  if (!card) return;
  const cfg = FUEL_CONFIG[_fuel] || { short: _fuel };
  card.classList.remove('hidden');

  if (!card.querySelector('#alentourStationMap')) {
    card.innerHTML =
        '<div class="al-top"></div>'
      + '<div class="al-top3"></div>'
      + '<div class="map-fs-wrap" id="alentourMapFsWrap">'
      +   '<div id="alentourStationMap" class="static-map"></div>'
      +   '<button class="map-fs-btn" type="button" data-fs-target="#alentourMapFsWrap" title="Plein écran" aria-label="Plein écran"><span class="mfs-ico">&#x26F6;</span></button>'
      +   '<div class="smap-zoom-ctrl">'
      +     '<button type="button" class="smap-zoom-btn" data-delta="1" title="Zoom avant" aria-label="Zoom avant">+</button>'
      +     '<button type="button" class="smap-zoom-btn" data-delta="-1" title="Zoom arrière" aria-label="Zoom arrière">&#8722;</button>'
      +   '</div>'
      + '</div>'
      + '<div class="al-status" id="alentourStatus"></div>'
      + '<div class="al-list" id="alentourList"></div>';
  }

  card.querySelector('.al-top').innerHTML = _topHtml(cfg);

  const sorted = _sortedFor(_fuel);
  const top3   = sorted.slice(0, 3);
  const rest   = sorted.slice(3);

  card.querySelector('.al-top3').innerHTML = top3.map((s, i) => _itemHtml(s, _fuel, i)).join('');
  card.querySelector('#alentourList').innerHTML = rest.length
    ? rest.map(s => _itemHtml(s, _fuel)).join('')
    : (sorted.length ? '<p class="al-empty">Aucune autre station.</p>' : '');

  const statusEl = card.querySelector('#alentourStatus');
  if (status) { statusEl.textContent = status; statusEl.hidden = false; }
  else if (sorted.length) {
    statusEl.textContent = `${sorted.length} station${sorted.length > 1 ? 's' : ''} ${cfg.short} · moins chère ${Number(sorted[0].prices[_fuel]).toFixed(3)} €/L`;
    statusEl.hidden = false;
  } else { statusEl.hidden = true; }

  if (sorted.length) _renderMap(sorted, _fuel);
  else document.getElementById('alentourStationMap').innerHTML = '';
}

/* ── Données : géoloc + fetch ─────────────────────────────────────────────── */

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

/** Fetch des stations vendant l'un des 3 carburants dans le rayon (une requête, tous prix). */
async function _fetchStations(lat, lon) {
  const anyFuel = AL_FUELS.map(k => FUEL_CONFIG[k].apiField + ' is not null').join(' or ');
  const resp = await fetch(
    'https://data.economie.gouv.fr/api/explore/v2.1/catalog/datasets/prix-des-carburants-en-france-flux-instantane-v2/records?' +
    new URLSearchParams({
      where:  `(${anyFuel}) and distance(geom, geom'POINT(${lon} ${lat})', ${_radius}m)`,
      select: FUEL_SELECT,
      limit:  100
    })
  );
  if (!resp.ok) throw new Error('HTTP ' + resp.status);
  const data = await resp.json();
  return (data.results || [])
    .filter(r => getCoords(r))
    .map(r => {
      const c = getCoords(r);
      const prices = {};
      FUEL_KEYS.forEach(k => { if (r[FUEL_CONFIG[k].apiField] != null) prices[k] = r[FUEL_CONFIG[k].apiField]; });
      return {
        name: composeStationName(resolveEnseigne(null, r.adresse), r.ville || ''),
        ville: r.ville || '', adresse: r.adresse || '', sub: stationSubLabel(r),
        lat: c.lat, lon: c.lon, prices,
        dist: Math.round(haversine(lat, lon, c.lat, c.lon)),
      };
    })
    .filter(s => s.dist <= _radius);
}

/** Entrée publique : (re)charge la carte alentour (géoloc + fetch + enrichissement OSM). */
export async function renderAlentour() {
  const card = _card();
  if (!card || _loading) return;
  _loading = true;
  cancelOsmEnrich();                       // annule un enrichissement précédent en cours
  _render(`Recherche des stations dans ${_km(_radius)}…`);
  try {
    const ok = await _ensurePosition();
    if (!ok) { _stations = []; _render('📍 Active la géolocalisation pour voir les stations autour de toi.'); return; }

    _stations = await _fetchStations(state.userLat, state.userLon);
    if (!_stations.length) { _render(`Aucune station trouvée dans ${_km(_radius)}.`); return; }
    _render();                             // affichage immédiat (noms gouvernement)

    // Enrichissement OSM des enseignes en arrière-plan → renommage « Enseigne - Ville ».
    enrichStationsBulk(
      _stations,
      (i, osmName) => { _stations[i].name = composeStationName(resolveEnseigne(osmName, _stations[i].adresse), _stations[i].ville); },
      () => {}
    ).then(okEnrich => { if (okEnrich) _render(); }).catch(() => {});
  } catch (e) {
    _render('Erreur de recherche (' + (e.message || e) + ').');
  } finally {
    _loading = false;
  }
}

/* ── Câblage (une fois, depuis main.js) ───────────────────────────────────── */
export function initAlentour() {
  const card = _card();
  if (!card) return;
  card.addEventListener('click', e => {
    // Rayon → re-fetch
    const rb = e.target.closest('.al-radius-btn');
    if (rb) {
      const m = parseInt(rb.dataset.radius, 10);
      if (RADII.includes(m) && m !== _radius) { _radius = m; _saveRadius(m); renderAlentour(); }
      return;
    }
    // Carburant → re-tri sans re-fetch
    const fb = e.target.closest('.smap-fuel-btn');
    if (fb) {
      const k = fb.dataset.alFuel;
      if (AL_FUELS.includes(k) && k !== _fuel) { _fuel = k; _render(); }
      return;
    }
    // Zoom (carte Google) — module nécessairement déjà chargé (une carte Google
    // a dû être rendue au moins une fois pour que ces boutons soient pertinents).
    const zb = e.target.closest('.smap-zoom-btn');
    if (zb) {
      const delta = parseInt(zb.dataset.delta, 10);
      const container = document.getElementById('alentourStationMap');
      const cached = gmapRenderCached();
      if (container && cached?.googleMapsActive()) cached.zoomGoogleMap(container, delta);
    }
  });
}
