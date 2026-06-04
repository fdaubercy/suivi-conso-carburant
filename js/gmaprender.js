/* ═══════════════════════════════════════════════════════════════════════
   gmaprender.js — Rendu Google Maps RÉUTILISABLE de stations (W63)

   Utilisé par :
     • carte.js        → carte des résultats de recherche / géoloc (#stationMap)
     • stationsmap.js  → carte des stations habituelles, onglet « Carte »

   renderGoogleStationMap(container, { stations, userPos, onFallback }) :
     • stations : [{ lat, lon, text, title, onClick }]  (text = libellé pastille)
     • userPos  : { lat, lon, title } | null            (point de référence)
     • onFallback : appelé si Google indisponible / auth refusée / erreur
                    → l'appelant rend SA carte OpenStreetMap de repli.

   Marqueurs : AdvancedMarkerElement (HTML, non déprécié) si GOOGLE_MAPS_MAP_ID
   est configuré ; sinon google.maps.Marker classique (warning bénin).
═══════════════════════════════════════════════════════════════════════ */
import { escHtml } from './utils.js';
import { GOOGLE_MAPS_MAP_ID } from './config.js';
import { googleMapsEnabled, loadGoogleMaps, loadClusterer } from './gmap.js';

let _authFailed = false;                 // Google a refusé l'auth → repli OSM (session)
const _inst = new WeakMap();             // container HTMLElement → { map, cluster, markers, userMarker }

/** Google Maps est-il utilisable (clé configurée ET auth non refusée) ? */
export function googleMapsActive() {
  return googleMapsEnabled() && !_authFailed;
}

export async function renderGoogleStationMap(container, opts) {
  const { stations = [], userPos = null, onFallback } = opts || {};
  if (!container) return;

  let maps;
  try { maps = await loadGoogleMaps(); }
  catch { onFallback && onFallback(); return; }   // API indisponible → repli OSM

  // Repli OSM si Google REFUSE l'authentification (clé invalide, referrer non
  // autorisé, ou FACTURATION non activée → BillingNotEnabledMapError). Hook
  // asynchrone, hors du try/catch ci-dessous.
  window.gm_authFailure = () => {
    _authFailed = true;
    _inst.delete(container);
    console.warn('[gmap] authentification refusée (facturation / clé / referrer) → repli OpenStreetMap');
    onFallback && onFallback();
  };

  // AdvancedMarkerElement (non déprécié) si un Map ID est configuré, sinon Marker.
  const useAdvanced = !!GOOGLE_MAPS_MAP_ID && !!(maps.marker && maps.marker.AdvancedMarkerElement);

  try {
    let it = _inst.get(container);
    if (!it || it.map.getDiv() !== container) {
      container.innerHTML = '';   // purge un éventuel rendu OSM antérieur
      const o = {
        mapTypeControl: false, streetViewControl: false, fullscreenControl: false,
        zoomControl: true, clickableIcons: false, gestureHandling: 'greedy',
      };
      if (GOOGLE_MAPS_MAP_ID) o.mapId = GOOGLE_MAPS_MAP_ID;
      it = { map: new maps.Map(container, o), cluster: null, markers: [], userMarker: null };
      _inst.set(container, it);
    }

    // Nettoie le rendu précédent.
    if (it.cluster) it.cluster.clearMarkers();
    it.markers.forEach(m => _attach(m, null));
    it.markers = [];
    if (it.userMarker) { _attach(it.userMarker, null); it.userMarker = null; }

    const highlight = idx => it.markers.forEach((m, i) => {
      if (typeof m.__setSel === 'function') m.__setSel(i === idx);
      if (typeof m.setZIndex === 'function') m.setZIndex(i === idx ? 999 : 100 + i);
      else m.zIndex = (i === idx ? 999 : 100 + i);
    });

    const bounds = new maps.LatLngBounds();

    it.markers = stations.map((s, i) => {
      const pos = { lat: s.lat, lng: s.lon };
      const onClick = () => { highlight(i); if (typeof s.onClick === 'function') s.onClick(i); };
      let marker;
      if (useAdvanced) {
        const content = _badgeEl(s.text, false);
        content.addEventListener('click', e => { e.stopPropagation(); onClick(); });
        marker = new maps.marker.AdvancedMarkerElement({ position: pos, title: s.title || '', content, zIndex: 100 + i, gmpClickable: true });
        marker.__setSel = sel => content.classList.toggle('sel', sel);
      } else {
        marker = new maps.Marker({ position: pos, title: s.title || '', icon: _priceBadge(maps, s.text, false), optimized: false, zIndex: 100 + i });
        marker.addListener('click', onClick);
        marker.__setSel = sel => marker.setIcon(_priceBadge(maps, s.text, sel));
      }
      bounds.extend(pos);
      return marker;
    });

    // Point de référence (position GPS ou adresse saisie).
    if (userPos && userPos.lat != null && userPos.lon != null) {
      const upos = { lat: userPos.lat, lng: userPos.lon };
      if (useAdvanced) {
        it.userMarker = new maps.marker.AdvancedMarkerElement({ position: upos, title: userPos.title || 'Votre position', content: _userDotEl(), zIndex: 50 });
      } else {
        it.userMarker = new maps.Marker({ position: upos, icon: _userIcon(maps), title: userPos.title || 'Votre position', clickable: false, zIndex: 50 });
      }
      _attach(it.userMarker, it.map);
      bounds.extend(upos);
    }

    // Regroupement des marqueurs proches (optionnel : repli pose directe).
    const lib = await loadClusterer();
    if (lib && lib.MarkerClusterer) {
      if (it.cluster) {
        it.cluster.addMarkers(it.markers);
      } else {
        // En mode Advanced, le rendu par défaut des bulles utilise Marker
        // (déprécié) → renderer AdvancedMarkerElement.
        const renderer = useAdvanced ? {
          render: ({ count, position }) => new maps.marker.AdvancedMarkerElement({
            position, zIndex: 1000 + count, content: _clusterEl(count),
          }),
        } : undefined;
        it.cluster = new lib.MarkerClusterer(
          renderer ? { map: it.map, markers: it.markers, renderer } : { map: it.map, markers: it.markers }
        );
      }
    } else {
      it.markers.forEach(m => _attach(m, it.map));
    }

    // Cadrage : station unique sans point de réf → centre + zoom rue ; sinon ajuste.
    if (stations.length === 1 && !userPos) {
      it.map.setCenter({ lat: stations[0].lat, lng: stations[0].lon });
      it.map.setZoom(15);
    } else if (stations.length || userPos) {
      it.map.fitBounds(bounds, { top: 60, right: 40, bottom: 24, left: 40 });
      maps.event.addListenerOnce(it.map, 'idle', () => {
        if (it.map.getZoom() > 16) it.map.setZoom(16);
      });
    }
  } catch (e) {
    console.warn('[gmap] rendu Google Maps échoué → repli OSM', e);
    _inst.delete(container);
    onFallback && onFallback();
  }
}

/* ── Helpers ──────────────────────────────────────────────────────────── */

/** Attache un marqueur (Advanced via .map / classique via setMap) à une carte. */
function _attach(m, map) { if (typeof m.setMap === 'function') m.setMap(map); else m.map = map; }

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

/** Contenu HTML du point de référence (AdvancedMarkerElement) : pastille verte. */
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

/** Icône SVG du point de référence (google.maps.Marker classique, repli). */
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
