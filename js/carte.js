/* ─── Carte des résultats de recherche / géoloc (#stationMap) ───────────────
   W63 — Deux moteurs, même point d'entrée showMap() :
     • Google Maps interactif (zoom, glisser, +/−, clusters) via gmaprender.js
       quand une clé GOOGLE_MAPS_API_KEY est configurée ;
     • repli OpenStreetMap « maison » (tuiles statiques, zoom auto) sinon, ou si
       l'API Google échoue/refuse l'auth.
─────────────────────────────────────────────────────────────────────────── */
import { state } from './state.js';
import { escHtml } from './utils.js';
import { FUEL_CONFIG } from './config.js';
import { detectBrand } from './brand.js';
import { googleMapsActive, renderGoogleStationMap } from './gmaprender.js';

const TILE_SZ = 256;

/* ═══════════════════════════════════════════════════════════════════════
   Point d'entrée commun
═══════════════════════════════════════════════════════════════════════ */

export function showMap(uLat, uLon, stations, radiusM = null) {
  state._mapStations = stations.filter(s => s.lat && s.lon);
  if (!state._mapStations.length) return;
  const wrap = document.getElementById('stationMapWrap');
  const wasHidden = wrap.classList.contains('hidden');
  wrap.classList.remove('hidden');

  const render = googleMapsActive()
    ? () => _renderGoogleMap(uLat, uLon, radiusM)
    : () => _renderMap(uLat, uLon, radiusM);

  // Conteneur rendu visible à l'instant : laisser le layout se faire (offsetWidth).
  wasHidden ? setTimeout(render, 0) : render();
}

export function hideMap() {
  document.getElementById('stationMapWrap').classList.add('hidden');
}

/* ═══════════════════════════════════════════════════════════════════════
   Moteur 1 — Google Maps interactif (délégué à gmaprender.js)
═══════════════════════════════════════════════════════════════════════ */

function _renderGoogleMap(uLat, uLon, radiusM) {
  const container = document.getElementById('stationMap');
  if (!container) return;
  const cfg = FUEL_CONFIG[state.currentType] || {};
  const stations = state._mapStations.map((s, i) => {
    const price = s.prices ? s.prices[state.currentType] : null;
    return {
      lat: s.lat, lon: s.lon,
      text:  price != null ? Number(price).toFixed(3) : (cfg.short || '⛽'),
      title: s.name + (price != null ? ` — ${cfg.short || ''} ${Number(price).toFixed(3)} €/L` : ''),
      brand: detectBrand(s.name),
      onClick: () => { if (typeof window.selectStationFromMap === 'function') window.selectStationFromMap(i); },
    };
  });
  const userPos = (uLat != null && uLon != null) ? { lat: uLat, lon: uLon, title: 'Point de recherche' } : null;
  renderGoogleStationMap(container, { stations, userPos, radiusM, onFallback: () => _renderMap(uLat, uLon, radiusM) });
}

/* ═══════════════════════════════════════════════════════════════════════
   Moteur 2 — Repli OpenStreetMap « maison » (tuiles statiques)
   Utilisé quand aucune clé Google n'est configurée, ou si l'API Google
   échoue / refuse l'authentification.
═══════════════════════════════════════════════════════════════════════ */

/** Conversion lat/lon → indices de tuile Web-Mercator (zoom z).
 *  Exporté pour les tests unitaires (math pure). */
export function tileXY(lat, lon, z) {
  const n = 1 << z, lr = lat * Math.PI / 180;
  return {
    x: Math.floor((lon + 180) / 360 * n),
    y: Math.floor((1 - Math.log(Math.tan(lr) + 1 / Math.cos(lr)) / Math.PI) / 2 * n)
  };
}

function latLonToPx(lat, lon, z, ox, oy) {
  const n = 1 << z, lr = lat * Math.PI / 180;
  return {
    x: Math.round((lon + 180) / 360 * n * TILE_SZ - ox * TILE_SZ),
    y: Math.round((1 - Math.log(Math.tan(lr) + 1 / Math.cos(lr)) / Math.PI) / 2 * n * TILE_SZ - oy * TILE_SZ)
  };
}

function bestZoom(allLats, allLons, maxW, maxH) {
  for (let z = 15; z >= 10; z--) {
    const nw = tileXY(Math.max(...allLats), Math.min(...allLons), z);
    const se = tileXY(Math.min(...allLats), Math.max(...allLons), z);
    if ((se.x - nw.x + 1) * TILE_SZ <= maxW + TILE_SZ && (se.y - nw.y + 1) * TILE_SZ <= maxH + TILE_SZ) return z;
  }
  return 10;
}

export function _renderMap(uLat, uLon, radiusM = null) {
  const container = document.getElementById('stationMap');
  const rect = container.getBoundingClientRect();
  const W = rect.width || container.offsetWidth || 360;
  const H = rect.height || container.offsetHeight || 220;
  const mg = 0.008;
  const allLats = state._mapStations.map(s => s.lat);
  const allLons = state._mapStations.map(s => s.lon);
  if (uLat) { allLats.push(uLat); allLons.push(uLon); }
  // Étend le cadrage à tout le périmètre du rayon (cercle visible en entier).
  if (uLat && radiusM > 0) {
    const dLat = radiusM / 111320;
    const dLon = radiusM / (111320 * Math.cos(uLat * Math.PI / 180));
    allLats.push(uLat + dLat, uLat - dLat);
    allLons.push(uLon + dLon, uLon - dLon);
  }
  const z  = bestZoom([Math.min(...allLats)-mg, Math.max(...allLats)+mg], [Math.min(...allLons)-mg, Math.max(...allLons)+mg], W, H);
  const nw = tileXY(Math.max(...allLats)+mg, Math.min(...allLons)-mg, z);
  const se = tileXY(Math.min(...allLats)-mg, Math.max(...allLons)+mg, z);
  const gridW = (se.x - nw.x + 1) * TILE_SZ, gridH = (se.y - nw.y + 1) * TILE_SZ;
  const offX  = Math.round((W - gridW) / 2);
  let   offY  = Math.round((H - gridH) / 2);

  // Empêche les marqueurs du bord nord de déborder au-dessus du conteneur :
  // le haut d'un marqueur = offY + p.y - PIN_H ; doit être >= 0.
  const PIN_H = 32; // hauteur du pin au-dessus du point d'ancrage (px)
  const minPy = Math.min(...state._mapStations.map(s => latLonToPx(s.lat, s.lon, z, nw.x, nw.y).y));
  offY = Math.max(offY, PIN_H - minPy);

  let html = `<div style="position:absolute;left:${offX}px;top:${offY}px;width:${gridW}px;height:${gridH}px;overflow:hidden">`;
  for (let ty = nw.y; ty <= se.y; ty++) for (let tx = nw.x; tx <= se.x; tx++) {
    html += `<img src="https://tile.openstreetmap.org/${z}/${tx}/${ty}.png" `
          + `style="position:absolute;left:${(tx-nw.x)*TILE_SZ}px;top:${(ty-nw.y)*TILE_SZ}px;width:${TILE_SZ}px;height:${TILE_SZ}px" `
          + `loading="lazy" onerror="this.style.background='#ddd'">`;
  }
  /* T2 : data-map-pin-idx remplace onclick/onmouseenter/ontouchstart inline */
  state._mapStations.forEach((s, i) => {
    const p = latLonToPx(s.lat, s.lon, z, nw.x, nw.y);
    html += `<div id="mapPin${i}" data-map-pin-idx="${i}"
      style="position:absolute;left:${p.x-12}px;top:${p.y-30}px;z-index:10;cursor:pointer;-webkit-tap-highlight-color:transparent">
      <div class="map-pin" id="mapPinDot${i}" style="background:#2E75B6"><span style="transform:rotate(45deg)">⛽</span></div>
      <div class="map-pin-label" id="mapPinLbl${i}">${escHtml(s.name)}</div></div>`;
  });
  // Cercle du rayon de recherche (repli OSM) — sous les marqueurs (z-index 9).
  if (uLat && uLon && radiusM > 0) {
    const mPerPx = 156543.03392 * Math.cos(uLat * Math.PI / 180) / (1 << z);
    const rPx = radiusM / mPerPx;
    const pc = latLonToPx(uLat, uLon, z, nw.x, nw.y);
    html += `<div style="position:absolute;left:${pc.x-rPx}px;top:${pc.y-rPx}px;width:${2*rPx}px;height:${2*rPx}px;border-radius:50%;background:rgba(29,158,117,.12);border:2.5px solid rgba(29,158,117,.92);box-sizing:border-box;z-index:9;pointer-events:none"></div>`;
  }
  if (uLat && uLon) {
    const p = latLonToPx(uLat, uLon, z, nw.x, nw.y);
    html += `<div style="position:absolute;left:${p.x-8}px;top:${p.y-8}px;z-index:11;pointer-events:none">
      <div style="width:16px;height:16px;background:#1D9E75;border-radius:50%;border:3px solid #fff;box-shadow:0 0 0 3px rgba(29,158,117,.35),0 2px 6px rgba(0,0,0,.3)"></div></div>`;
  }
  html += '</div>';
  html += `<a href="https://www.openstreetmap.org" target="_blank" rel="noopener"
    style="position:absolute;bottom:3px;right:5px;background:rgba(255,255,255,.8);font-size:9px;padding:1px 5px;border-radius:3px;color:#555;text-decoration:none;z-index:20">© OSM</a>`;
  container.innerHTML = html;
}

/**
 * W64/D3 — Mini-carte OSM autonome dans un conteneur arbitraire, indépendante de
 * la carte Saisie (#stationMap / state._mapStations). Affiche une liste explicite
 * de stations + la position utilisateur + le cercle de rayon. Les index de
 * `highlightIdxs` (top‑3 moins chères) sont mis en valeur (marqueur vert + médaille).
 * Display-only : l'interaction se fait via la liste sous la carte.
 */
export function renderMiniMap(containerId, uLat, uLon, stations, { radiusM = null, highlightIdxs = [], fitStationsOnly = false } = {}) {
  const container = document.getElementById(containerId);
  if (!container) return;
  const pts = (stations || []).filter(s => s.lat && s.lon);
  if (!pts.length) { container.innerHTML = ''; return; }

  const rect = container.getBoundingClientRect();
  const W = rect.width || container.offsetWidth || 360;
  const H = rect.height || container.offsetHeight || 220;
  const mg = 0.008;
  const allLats = pts.map(s => s.lat);
  const allLons = pts.map(s => s.lon);
  if (uLat) { allLats.push(uLat); allLons.push(uLon); }
  // fitStationsOnly (carte alentour) : ne pas étendre le cadrage au rayon complet
  // → on zoome sur la zone réelle des stations trouvées (le cercle reste dessiné).
  if (!fitStationsOnly && uLat && radiusM > 0) {
    const dLat = radiusM / 111320;
    const dLon = radiusM / (111320 * Math.cos(uLat * Math.PI / 180));
    allLats.push(uLat + dLat, uLat - dLat);
    allLons.push(uLon + dLon, uLon - dLon);
  }
  const z  = bestZoom([Math.min(...allLats)-mg, Math.max(...allLats)+mg], [Math.min(...allLons)-mg, Math.max(...allLons)+mg], W, H);
  const nw = tileXY(Math.max(...allLats)+mg, Math.min(...allLons)-mg, z);
  const se = tileXY(Math.min(...allLats)-mg, Math.max(...allLons)+mg, z);
  const gridW = (se.x - nw.x + 1) * TILE_SZ, gridH = (se.y - nw.y + 1) * TILE_SZ;
  const offX  = Math.round((W - gridW) / 2);
  let   offY  = Math.round((H - gridH) / 2);
  const PIN_H = 32;
  const minPy = Math.min(...pts.map(s => latLonToPx(s.lat, s.lon, z, nw.x, nw.y).y));
  offY = Math.max(offY, PIN_H - minPy);

  let html = `<div style="position:absolute;left:${offX}px;top:${offY}px;width:${gridW}px;height:${gridH}px;overflow:hidden">`;
  for (let ty = nw.y; ty <= se.y; ty++) for (let tx = nw.x; tx <= se.x; tx++) {
    html += `<img src="https://tile.openstreetmap.org/${z}/${tx}/${ty}.png" `
          + `style="position:absolute;left:${(tx-nw.x)*TILE_SZ}px;top:${(ty-nw.y)*TILE_SZ}px;width:${TILE_SZ}px;height:${TILE_SZ}px" `
          + `loading="lazy" onerror="this.style.background='#ddd'">`;
  }
  // Cercle du rayon (sous les marqueurs).
  if (uLat && uLon && radiusM > 0) {
    const mPerPx = 156543.03392 * Math.cos(uLat * Math.PI / 180) / (1 << z);
    const rPx = radiusM / mPerPx;
    const pc = latLonToPx(uLat, uLon, z, nw.x, nw.y);
    html += `<div style="position:absolute;left:${pc.x-rPx}px;top:${pc.y-rPx}px;width:${2*rPx}px;height:${2*rPx}px;border-radius:50%;background:rgba(29,158,117,.10);border:2.5px solid rgba(29,158,117,.85);box-sizing:border-box;z-index:9;pointer-events:none"></div>`;
  }
  // Marqueurs : badge prix (si fourni) + pin ⛽ ; top‑3 en vert, autres en bleu.
  pts.forEach((s, i) => {
    const p = latLonToPx(s.lat, s.lon, z, nw.x, nw.y);
    const top = highlightIdxs.indexOf(i) >= 0;
    const bg  = top ? '#1D9E75' : '#2E75B6';
    const price = s.priceText != null
      ? `<span style="display:block;background:#fff;color:#1B3A5C;font-size:9px;font-weight:700;line-height:1;padding:1px 4px;border-radius:4px;box-shadow:0 1px 2px rgba(0,0,0,.3);white-space:nowrap;margin-bottom:1px">${escHtml(String(s.priceText))}</span>`
      : '';
    html += `<div title="${escHtml(s.name)}" style="position:absolute;left:${p.x}px;top:${p.y-42}px;transform:translateX(-50%);z-index:${top ? 12 : 10};text-align:center">
      ${price}<span class="map-pin" style="background:${bg};display:inline-flex"><span style="transform:rotate(45deg)">⛽</span></span></div>`;
  });
  // Position utilisateur.
  if (uLat && uLon) {
    const p = latLonToPx(uLat, uLon, z, nw.x, nw.y);
    html += `<div style="position:absolute;left:${p.x-8}px;top:${p.y-8}px;z-index:13;pointer-events:none">
      <div style="width:16px;height:16px;background:#1D9E75;border-radius:50%;border:3px solid #fff;box-shadow:0 0 0 3px rgba(29,158,117,.35),0 2px 6px rgba(0,0,0,.3)"></div></div>`;
  }
  html += '</div>';
  html += `<a href="https://www.openstreetmap.org" target="_blank" rel="noopener"
    style="position:absolute;bottom:3px;right:5px;background:rgba(255,255,255,.8);font-size:9px;padding:1px 5px;border-radius:3px;color:#555;text-decoration:none;z-index:20">© OSM</a>`;
  container.innerHTML = html;
}

export function showPinLabel(idx) {
  const lbl = document.getElementById('mapPinLbl' + idx); if (!lbl) return;
  lbl.style.opacity = '1'; clearTimeout(lbl._hideTimer);
  lbl._hideTimer = setTimeout(() => { lbl.style.opacity = ''; }, 2000);
}

/**
 * T2 — Délégation d'événements sur #stationMap (rendu OSM maison).
 * En mode Google Maps, les marqueurs gèrent leur propre clic (gmaprender.js) —
 * ces écouteurs restent inertes (aucun [data-map-pin-idx] présent).
 */
export function initMapInteractions() {
  const container = document.getElementById('stationMap');
  if (!container) return;

  container.addEventListener('click', e => {
    const pin = e.target.closest('[data-map-pin-idx]');
    if (!pin) return;
    const idx = parseInt(pin.dataset.mapPinIdx, 10);
    if (typeof window.selectStationFromMap === 'function') window.selectStationFromMap(idx);
  });

  container.addEventListener('mouseover', e => {
    const pin = e.target.closest('[data-map-pin-idx]');
    if (!pin) return;
    showPinLabel(parseInt(pin.dataset.mapPinIdx, 10));
  });

  container.addEventListener('touchstart', e => {
    const pin = e.target.closest('[data-map-pin-idx]');
    if (!pin) return;
    showPinLabel(parseInt(pin.dataset.mapPinIdx, 10));
  }, { passive: true });
}
