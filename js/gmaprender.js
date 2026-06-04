/* ═══════════════════════════════════════════════════════════════════════
   gmaprender.js — Rendu Google Maps RÉUTILISABLE de stations (W63)

   Utilisé par :
     • carte.js        → carte des résultats de recherche / géoloc (#stationMap)
     • stationsmap.js  → carte des stations habituelles, onglet « Carte »

   renderGoogleStationMap(container, { stations, userPos, onFallback }) :
     • stations : [{ lat, lon, text, title, brand:{label,color}|null, onClick }]
     • userPos  : { lat, lon, title } | null
     • onFallback : appelé si Google indisponible / auth refusée / erreur
                    → l'appelant rend SA carte OpenStreetMap de repli.

   Classes chargées via google.maps.importLibrary ('maps'/'core'/'marker') :
   méthode officielle avec loading=async (évite « Map is not a constructor »).
   Marqueurs : AdvancedMarkerElement (HTML, non déprécié) si GOOGLE_MAPS_MAP_ID
   est configuré ; sinon google.maps.Marker classique.
   Distinction par enseigne : couleur + nom court (brand) + prix conservé.
═══════════════════════════════════════════════════════════════════════ */
import { escHtml } from './utils.js';
import { GOOGLE_MAPS_MAP_ID } from './config.js';
import { DEFAULT_BRAND_COLOR } from './brand.js';
import { googleMapsEnabled, loadGoogleMaps, loadClusterer } from './gmap.js';

let _authFailed = false;                 // Google a refusé l'auth → repli OSM (session)
const _inst = new WeakMap();             // container → { map, cluster, markers, userMarker }

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

  // ── Récupère les classes via importLibrary (officiel, loading=async) ──
  let Map, LatLngBounds, Size, Point, eventNs, Marker, AdvancedMarkerElement;
  try {
    if (typeof maps.importLibrary === 'function') {
      const [mapsLib, coreLib, markerLib] = await Promise.all([
        maps.importLibrary('maps'),
        maps.importLibrary('core'),
        maps.importLibrary('marker'),
      ]);
      Map = mapsLib.Map;
      ({ LatLngBounds, Size, Point, event: eventNs } = coreLib);
      ({ Marker, AdvancedMarkerElement } = markerLib);
    }
  } catch { /* repli sur l'accès direct au namespace ci-dessous */ }
  // Repli : namespace peuplé par importLibrary ou par un chargement legacy.
  Map = Map || maps.Map;
  LatLngBounds = LatLngBounds || maps.LatLngBounds;
  Size = Size || maps.Size;
  Point = Point || maps.Point;
  eventNs = eventNs || maps.event;
  Marker = Marker || maps.Marker;
  AdvancedMarkerElement = AdvancedMarkerElement || (maps.marker && maps.marker.AdvancedMarkerElement);
  if (!Map) { onFallback && onFallback(); return; }

  const useAdvanced = !!GOOGLE_MAPS_MAP_ID && !!AdvancedMarkerElement;

  try {
    let it = _inst.get(container);
    if (!it || it.map.getDiv() !== container) {
      container.innerHTML = '';   // purge un éventuel rendu OSM antérieur
      const o = {
        mapTypeControl: false, streetViewControl: false, fullscreenControl: false,
        zoomControl: true, clickableIcons: false, gestureHandling: 'greedy',
      };
      if (GOOGLE_MAPS_MAP_ID) o.mapId = GOOGLE_MAPS_MAP_ID;
      it = { map: new Map(container, o), cluster: null, markers: [], userMarker: null };
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

    const bounds = new LatLngBounds();

    it.markers = stations.map((s, i) => {
      const pos = { lat: s.lat, lng: s.lon };
      const brand = s.brand || null;
      const onClick = () => { highlight(i); if (typeof s.onClick === 'function') s.onClick(i); };
      let marker;
      if (useAdvanced) {
        const content = _markerEl(s.text, brand, false);
        content.addEventListener('click', e => { e.stopPropagation(); onClick(); });
        marker = new AdvancedMarkerElement({ position: pos, title: s.title || '', content, zIndex: 100 + i, gmpClickable: true });
        marker.__setSel = sel => content.classList.toggle('sel', sel);
      } else {
        const color = (brand && brand.color) || DEFAULT_BRAND_COLOR;
        marker = new Marker({ position: pos, title: s.title || '', icon: _priceBadge(Size, Point, s.text, color, false), optimized: false, zIndex: 100 + i });
        marker.addListener('click', onClick);
        marker.__setSel = sel => marker.setIcon(_priceBadge(Size, Point, s.text, color, sel));
      }
      bounds.extend(pos);
      return marker;
    });

    // Point de référence (position GPS ou adresse saisie).
    if (userPos && userPos.lat != null && userPos.lon != null) {
      const upos = { lat: userPos.lat, lng: userPos.lon };
      if (useAdvanced) {
        it.userMarker = new AdvancedMarkerElement({ position: upos, title: userPos.title || 'Votre position', content: _userDotEl(), zIndex: 50 });
      } else {
        it.userMarker = new Marker({ position: upos, icon: _userIcon(Size, Point), title: userPos.title || 'Votre position', clickable: false, zIndex: 50 });
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
        const renderer = (useAdvanced && AdvancedMarkerElement) ? {
          render: ({ count, position }) => new AdvancedMarkerElement({
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
      it.map.fitBounds(bounds, { top: 64, right: 40, bottom: 24, left: 40 });
      eventNs.addListenerOnce(it.map, 'idle', () => {
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

/** Contenu HTML d'un marqueur « station » (AdvancedMarkerElement) :
 *  bandeau enseigne (couleur + nom) + pastille prix (bordure couleur enseigne). */
function _markerEl(text, brand, selected) {
  const color = (brand && brand.color) || DEFAULT_BRAND_COLOR;
  const wrap = document.createElement('div');
  wrap.className = 'gmap-marker' + (selected ? ' sel' : '');

  if (brand && brand.label) {
    const b = document.createElement('div');
    b.className = 'gmap-brand';
    b.textContent = brand.label;
    b.style.background = color;
    wrap.appendChild(b);
  }

  const pill = document.createElement('div');
  pill.className = 'gmap-badge' + (brand && brand.label ? ' has-brand' : '');
  pill.textContent = String(text);
  pill.style.borderColor = color;
  pill.style.color = color;
  wrap.appendChild(pill);

  const tip = document.createElement('div');
  tip.className = 'gmap-badge-tip';
  tip.style.borderTopColor = color;
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
function _priceBadge(Size, Point, text, color, selected) {
  const bg = selected ? '#1B3A5C' : (color || DEFAULT_BRAND_COLOR);
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
    scaledSize: new Size(w, totalH),
    anchor: new Point(cx, totalH),   // pointe = coordonnée exacte de la station
  };
}

/** Icône SVG du point de référence (google.maps.Marker classique, repli). */
function _userIcon(Size, Point) {
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="22" height="22">` +
    `<circle cx="11" cy="11" r="7" fill="#1D9E75" stroke="#fff" stroke-width="3"/></svg>`;
  return {
    url: 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(svg),
    scaledSize: new Size(22, 22),
    anchor: new Point(11, 11),
  };
}
