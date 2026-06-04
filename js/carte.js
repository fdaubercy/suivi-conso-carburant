/* ─── Carte des stations ───────────────────────────────────────────────────
   W63 — Deux moteurs de rendu, même point d'entrée showMap() :
     • Google Maps interactif (zoom pinch/molette, glisser, +/−, clusters)
       quand une clé GOOGLE_MAPS_API_KEY est configurée ;
     • repli OpenStreetMap « maison » (tuiles statiques, zoom auto-ajusté)
       sinon, ou si l'API Google échoue/refuse l'auth (facturation/clé/referrer).

   Marqueurs Google : AdvancedMarkerElement (HTML, non déprécié) si un Map ID
   (GOOGLE_MAPS_MAP_ID) est configuré ; sinon google.maps.Marker classique
   (fonctionne, mais émet un avertissement de dépréciation).
─────────────────────────────────────────────────────────────────────────── */
import { state } from './state.js';
import { escHtml } from './utils.js';
import { FUEL_CONFIG, GOOGLE_MAPS_MAP_ID } from './config.js';
import { googleMapsEnabled, loadGoogleMaps, loadClusterer } from './gmap.js';

const TILE_SZ = 256;

/* ═══════════════════════════════════════════════════════════════════════
   Point d'entrée commun
═══════════════════════════════════════════════════════════════════════ */

export function showMap(uLat, uLon, stations) {
  state._mapStations = stations.filter(s => s.lat && s.lon);
  if (!state._mapStations.length) return;
  _lastU = { lat: uLat, lon: uLon };
  const wrap = document.getElementById('stationMapWrap');
  const wasHidden = wrap.classList.contains('hidden');
  wrap.classList.remove('hidden');

  const render = (googleMapsEnabled() && !_gAuthFailed)
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

let _gmap        = null;   // instance google.maps.Map réutilisée
let _gMarkers    = [];     // marqueurs « stations » courants
let _gUserMarker = null;   // marqueur point de recherche (GPS ou adresse)
let _gCluster    = null;   // instance MarkerClusterer (si dispo)
let _gAuthFailed = false;  // Google a refusé l'auth (clé/referrer/facturation) → bascule OSM
let _lastU       = { lat: null, lon: null };   // dernier point de recherche (pour le repli)

async function _renderGoogleMap(uLat, uLon) {
  const container = document.getElementById('stationMap');
  if (!container) return;

  let maps;
  try { maps = await loadGoogleMaps(); }
  catch { _renderMap(uLat, uLon); return; }   // repli OSM si Google indisponible

  // Repli OSM si Google REFUSE l'authentification (clé invalide, referrer non
  // autorisé, ou FACTURATION non activée → BillingNotEnabledMapError). Google
  // appelle ce hook de façon asynchrone, HORS du try/catch ci-dessous.
  window.gm_authFailure = () => {
    _gAuthFailed = true;
    _gmap = null; _gCluster = null; _gMarkers = []; _gUserMarker = null;
    console.warn('[carte] Google Maps : authentification refusée (facturation / clé / referrer) → repli OpenStreetMap');
    _renderMap(_lastU.lat, _lastU.lon);
  };

  // AdvancedMarkerElement (marqueurs HTML, non dépréciés) si un Map ID est
  // configuré ; sinon repli sur google.maps.Marker classique.
  const useAdvanced = !!GOOGLE_MAPS_MAP_ID && !!(maps.marker && maps.marker.AdvancedMarkerElement);

  // Filet de sécurité : toute erreur du rendu Google (API qui évolue, etc.)
  // bascule sur le rendu OpenStreetMap maison plutôt que de laisser une carte vide.
  try {
    const stations = state._mapStations;
    const cfg = FUEL_CONFIG[state.currentType] || {};

    // (Ré)instancie la carte si besoin (sinon on réutilise → pas de re-création).
    if (!_gmap || _gmap.getDiv() !== container) {
      container.innerHTML = '';   // purge un éventuel rendu OSM antérieur
      const opts = {
        mapTypeControl:    false,
        streetViewControl: false,
        fullscreenControl: false,
        zoomControl:       true,
        clickableIcons:    false,
        gestureHandling:   'greedy',   // glisser à un doigt sur mobile
      };
      if (GOOGLE_MAPS_MAP_ID) opts.mapId = GOOGLE_MAPS_MAP_ID;   // requis par AdvancedMarkerElement
      _gmap = new maps.Map(container, opts);
      _gCluster = null;
    }

    // Nettoie le rendu précédent (nouvelle recherche).
    if (_gCluster) _gCluster.clearMarkers();
    _gMarkers.forEach(_detach);
    _gMarkers = [];
    if (_gUserMarker) { _detach(_gUserMarker); _gUserMarker = null; }

    const bounds = new maps.LatLngBounds();

    _gMarkers = stations.map((s, i) => {
      const pos = { lat: s.lat, lng: s.lon };
      const price = s.prices ? s.prices[state.currentType] : null;
      const text  = price != null ? Number(price).toFixed(3) : (cfg.short || '⛽');
      const title = s.name + (price != null ? ` — ${cfg.short || ''} ${Number(price).toFixed(3)} €/L` : '');
      const onClick = () => {
        _highlightGoogleMarker(i);
        if (typeof window.selectStationFromMap === 'function') window.selectStationFromMap(i);
      };

      let marker;
      if (useAdvanced) {
        const content = _badgeEl(text, false);
        content.addEventListener('click', e => { e.stopPropagation(); onClick(); });
        marker = new maps.marker.AdvancedMarkerElement({ position: pos, title, content, zIndex: 100 + i, gmpClickable: true });
        marker.__setSel = sel => content.classList.toggle('sel', sel);
      } else {
        marker = new maps.Marker({ position: pos, title, icon: _priceBadge(maps, text, false), optimized: false, zIndex: 100 + i });
        marker.addListener('click', onClick);
        marker.__setSel = sel => marker.setIcon(_priceBadge(maps, text, sel));
      }
      bounds.extend(pos);
      return marker;
    });

    // Point de recherche (position GPS ou adresse saisie).
    if (uLat != null && uLon != null) {
      const upos = { lat: uLat, lng: uLon };
      if (useAdvanced) {
        _gUserMarker = new maps.marker.AdvancedMarkerElement({ position: upos, title: 'Point de recherche', content: _userDotEl(), zIndex: 50 });
      } else {
        _gUserMarker = new maps.Marker({ position: upos, icon: _userIcon(maps), title: 'Point de recherche', clickable: false, zIndex: 50 });
      }
      _attach(_gUserMarker, _gmap);
      bounds.extend(upos);
    }

    // Regroupement des marqueurs proches (optionnel : repli pose directe).
    const lib = await loadClusterer();
    if (lib && lib.MarkerClusterer) {
      if (_gCluster) {
        _gCluster.addMarkers(_gMarkers);
      } else {
        // En mode Advanced, le rendu par défaut des bulles utilise Marker
        // (déprécié) → on fournit un renderer AdvancedMarkerElement.
        const renderer = useAdvanced ? {
          render: ({ count, position }) => new maps.marker.AdvancedMarkerElement({
            position, zIndex: 1000 + count, content: _clusterEl(count),
          }),
        } : undefined;
        _gCluster = new lib.MarkerClusterer(
          renderer ? { map: _gmap, markers: _gMarkers, renderer } : { map: _gmap, markers: _gMarkers }
        );
      }
    } else {
      _gMarkers.forEach(m => _attach(m, _gmap));
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

/** Attache un marqueur (Advanced via .map / classique via setMap) à une carte. */
function _attach(m, map) { if (typeof m.setMap === 'function') m.setMap(map); else m.map = map; }
/** Détache un marqueur (Advanced ou classique). */
function _detach(m) { _attach(m, null); }

/** Met en évidence le marqueur sélectionné (via le hook __setSel posé au rendu). */
function _highlightGoogleMarker(idx) {
  _gMarkers.forEach((m, i) => {
    if (typeof m.__setSel === 'function') m.__setSel(i === idx);
    if (typeof m.setZIndex === 'function') m.setZIndex(i === idx ? 999 : 100 + i);
    else m.zIndex = (i === idx ? 999 : 100 + i);
  });
}

/** Contenu HTML d'un marqueur « station » (AdvancedMarkerElement) : pastille prix. */
function _badgeEl(text, selected) {
  const wrap = document.createElement('div');
  wrap.className = 'gmap-badge-wrap' + (selected ? ' sel' : '');
  const pill = document.createElement('div');
  pill.className = 'gmap-badge';
  pill.textContent = String(text);
  const tip = document.createElement('div');
  tip.className = 'gmap-badge-tip';
  wrap.appendChild(pill);
  wrap.appendChild(tip);
  return wrap;
}

/** Contenu HTML du point de recherche (AdvancedMarkerElement) : pastille verte. */
function _userDotEl() {
  const d = document.createElement('div');
  d.className = 'gmap-userdot';
  return d;
}

/** Contenu HTML d'une bulle de cluster (AdvancedMarkerElement). */
function _clusterEl(count) {
  const d = document.createElement('div');
  d.className = 'gmap-cluster';
  d.textContent = String(count);
  return d;
}

/** Icône SVG d'un marqueur « station » (google.maps.Marker classique, repli). */
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

/** Icône SVG du point de recherche (google.maps.Marker classique, repli). */
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
   l'API Google échoue/refuse l'authentification.
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
