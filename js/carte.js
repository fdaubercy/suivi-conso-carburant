/* ─── Carte des stations ───────────────────────────────────────────────────
   W63 — Deux moteurs de rendu, même point d'entrée showMap() :
     • Google Maps interactif (zoom pinch/molette, glisser, +/−, clusters)
       quand une clé GOOGLE_MAPS_API_KEY est configurée ;
     • repli OpenStreetMap « maison » (tuiles statiques, zoom auto-ajusté)
       sinon, ou si l'API Google échoue à charger (réseau / clé invalide).
   Le repli garantit zéro régression tant que la clé n'est pas posée.
─────────────────────────────────────────────────────────────────────────── */
import { state } from './state.js';
import { escHtml } from './utils.js';
import { FUEL_CONFIG } from './config.js';
import { googleMapsEnabled, loadGoogleMaps, loadClusterer } from './gmap.js';

const TILE_SZ = 256;

/* ═══════════════════════════════════════════════════════════════════════
   Point d'entrée commun
═══════════════════════════════════════════════════════════════════════ */

export function showMap(uLat, uLon, stations) {
  state._mapStations = stations.filter(s => s.lat && s.lon);
  if (!state._mapStations.length) return;
  const wrap = document.getElementById('stationMapWrap');
  const wasHidden = wrap.classList.contains('hidden');
  wrap.classList.remove('hidden');

  const render = googleMapsEnabled()
    ? () => _renderGoogleMap(uLat, uLon)
    : () => _renderMap(uLat, uLon);

  // Conteneur rendu visible à l'instant : laisser le layout se faire (offsetWidth).
  wasHidden ? setTimeout(render, 0) : render();
}

export function hideMap() {
  document.getElementById('stationMapWrap').classList.add('hidden');
}

/* ═══════════════════════════════════════════════════════════════════════
   Moteur 1 — Google Maps interactif (W63)
═══════════════════════════════════════════════════════════════════════ */

let _gMaps       = null;   // espace de noms google.maps (mémorisé)
let _gmap        = null;   // instance google.maps.Map réutilisée
let _gMarkers    = [];     // marqueurs « stations » courants
let _gUserMarker = null;   // marqueur point de recherche (GPS ou adresse)
let _gCluster    = null;   // instance MarkerClusterer (si dispo)

async function _renderGoogleMap(uLat, uLon) {
  const container = document.getElementById('stationMap');
  if (!container) return;

  let maps;
  try { maps = await loadGoogleMaps(); }
  catch { _renderMap(uLat, uLon); return; }   // repli OSM si Google indisponible
  _gMaps = maps;

  // Filet de sécurité : toute erreur du rendu Google (clé mal configurée, API
  // qui évolue, etc.) bascule sur le rendu OpenStreetMap maison plutôt que de
  // laisser une carte vide.
  try {
    const stations = state._mapStations;
    const cfg = FUEL_CONFIG[state.currentType] || {};

    // (Ré)instancie la carte si besoin (sinon on réutilise → pas de re-création).
    if (!_gmap || _gmap.getDiv() !== container) {
      container.innerHTML = '';   // purge un éventuel rendu OSM antérieur
      _gmap = new maps.Map(container, {
        mapTypeControl:    false,
        streetViewControl: false,
        fullscreenControl: false,
        zoomControl:       true,
        clickableIcons:    false,
        gestureHandling:   'greedy',   // glisser à un doigt sur mobile
      });
      _gCluster = null;
    }

    // Nettoie le rendu précédent (nouvelle recherche).
    if (_gCluster) _gCluster.clearMarkers();
    _gMarkers.forEach(m => m.setMap(null));
    _gMarkers = [];
    if (_gUserMarker) { _gUserMarker.setMap(null); _gUserMarker = null; }

    const bounds = new maps.LatLngBounds();

    _gMarkers = stations.map((s, i) => {
      const pos = { lat: s.lat, lng: s.lon };
      const price = s.prices ? s.prices[state.currentType] : null;
      const text  = price != null ? Number(price).toFixed(3) : (cfg.short || '⛽');
      const marker = new maps.Marker({
        position: pos,
        title: s.name + (price != null ? ` — ${cfg.short || ''} ${Number(price).toFixed(3)} €/L` : ''),
        icon: _priceBadge(maps, text, false),
        optimized: false,
        zIndex: 100 + i,
      });
      marker.__badgeText = text;
      marker.addListener('click', () => {
        _highlightGoogleMarker(i);
        if (typeof window.selectStationFromMap === 'function') window.selectStationFromMap(i);
      });
      bounds.extend(pos);
      return marker;
    });

    // Point de recherche (position GPS ou adresse saisie).
    if (uLat != null && uLon != null) {
      _gUserMarker = new maps.Marker({
        position: { lat: uLat, lng: uLon },
        icon: _userIcon(maps),
        title: 'Point de recherche',
        clickable: false,
        zIndex: 50,
      });
      _gUserMarker.setMap(_gmap);
      bounds.extend({ lat: uLat, lng: uLon });
    }

    // Regroupement des marqueurs proches (optionnel : repli pose directe).
    const lib = await loadClusterer();
    if (lib && lib.MarkerClusterer) {
      if (_gCluster) _gCluster.addMarkers(_gMarkers);
      else _gCluster = new lib.MarkerClusterer({ map: _gmap, markers: _gMarkers });
    } else {
      _gMarkers.forEach(m => m.setMap(_gmap));
    }

    // Cadrage : station unique → centre + zoom rue ; sinon ajuste aux marqueurs.
    if (stations.length === 1 && uLat == null) {
      _gmap.setCenter({ lat: stations[0].lat, lng: stations[0].lon });
      _gmap.setZoom(15);
    } else {
      _gmap.fitBounds(bounds, { top: 60, right: 40, bottom: 24, left: 40 });
      // Évite le sur-zoom quand tous les points sont très proches.
      maps.event.addListenerOnce(_gmap, 'idle', () => {
        if (_gmap.getZoom() > 16) _gmap.setZoom(16);
      });
    }
  } catch (e) {
    console.warn('[carte] rendu Google Maps échoué → repli OSM', e);
    _gmap = null; _gCluster = null; _gMarkers = []; _gUserMarker = null;
    _renderMap(uLat, uLon);
  }
}

/** Recolore le marqueur sélectionné (bleu foncé) et le passe au premier plan. */
function _highlightGoogleMarker(idx) {
  if (!_gMaps) return;
  _gMarkers.forEach((m, i) => {
    m.setIcon(_priceBadge(_gMaps, m.__badgeText, i === idx));
    m.setZIndex(i === idx ? 999 : 100 + i);
  });
}

/** Icône marqueur « station » : pastille prix avec pointeur (ancrée au point). */
function _priceBadge(maps, text, selected) {
  const bg = selected ? '#1B3A5C' : '#2E75B6';
  const h = 22, r = 6, ptr = 7, ptrH = 8;
  const w = Math.max(38, Math.ceil(String(text).length * 7.2) + 16);
  const totalH = h + ptrH;
  const cx = w / 2;
  const path =
    `M${r} 0 H${w - r} a${r} ${r} 0 0 1 ${r} ${r} V${h - r} a${r} ${r} 0 0 1 ${-r} ${r} ` +
    `H${cx + ptr} L${cx} ${totalH} L${cx - ptr} ${h} H${r} a${r} ${r} 0 0 1 ${-r} ${-r} ` +
    `V${r} a${r} ${r} 0 0 1 ${r} ${-r} Z`;
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${totalH}" viewBox="0 0 ${w} ${totalH}">` +
    `<path d="${path}" fill="${bg}" stroke="#fff" stroke-width="1.5"/>` +
    `<text x="${cx}" y="${h / 2}" text-anchor="middle" dominant-baseline="central" ` +
    `font-family="Arial,Helvetica,sans-serif" font-size="12" font-weight="700" fill="#fff">${escHtml(String(text))}</text>` +
    `</svg>`;
  return {
    url: 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(svg),
    scaledSize: new maps.Size(w, totalH),
    anchor: new maps.Point(cx, totalH),   // pointe = coordonnée exacte de la station
  };
}

/** Icône du point de recherche : pastille verte (cohérente avec le rendu OSM). */
function _userIcon(maps) {
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="22" height="22">` +
    `<circle cx="11" cy="11" r="7" fill="#1D9E75" stroke="#fff" stroke-width="3"/></svg>`;
  return {
    url: 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(svg),
    scaledSize: new maps.Size(22, 22),
    anchor: new maps.Point(11, 11),
  };
}

/* ═══════════════════════════════════════════════════════════════════════
   Moteur 2 — Repli OpenStreetMap « maison » (tuiles statiques)
   Inchangé : utilisé quand aucune clé Google n'est configurée ou si
   l'API Google échoue à charger.
═══════════════════════════════════════════════════════════════════════ */

function tileXY(lat, lon, z) {
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

export function _renderMap(uLat, uLon) {
  const container = document.getElementById('stationMap');
  const rect = container.getBoundingClientRect();
  const W = rect.width || container.offsetWidth || 360;
  const H = rect.height || container.offsetHeight || 220;
  const mg = 0.008;
  const allLats = state._mapStations.map(s => s.lat);
  const allLons = state._mapStations.map(s => s.lon);
  if (uLat) { allLats.push(uLat); allLons.push(uLon); }
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

export function showPinLabel(idx) {
  const lbl = document.getElementById('mapPinLbl' + idx); if (!lbl) return;
  lbl.style.opacity = '1'; clearTimeout(lbl._hideTimer);
  lbl._hideTimer = setTimeout(() => { lbl.style.opacity = ''; }, 2000);
}

/**
 * T2 — Délégation d'événements sur #stationMap (rendu OSM maison).
 * Remplace onclick/onmouseenter/ontouchstart inline sur les marqueurs.
 * Appelée une seule fois depuis main.js au démarrage. En mode Google Maps,
 * les marqueurs gèrent leur propre clic (cf. _renderGoogleMap) — ces écouteurs
 * restent inertes (aucun [data-map-pin-idx] présent).
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
