/* ═══════════════════════════════════════════════════════════════════════
   gmap.js — Chargeur Google Maps JavaScript API (W63)

   • googleMapsEnabled() : une clé est-elle configurée ? (sinon → repli OSM)
   • loadGoogleMaps()    : injecte le script Google une seule fois (promesse
                            mémorisée) et résout l'espace de noms google.maps.
   • loadClusterer()     : charge @googlemaps/markerclusterer (regroupement des
                            marqueurs proches). Optionnel : résout null si échec.

   Aucun accès DOM/navigateur au niveau module (compatibilité tests Node/CI).
   Tout est encapsulé dans des fonctions appelées côté navigateur uniquement.
═══════════════════════════════════════════════════════════════════════ */
import { GOOGLE_MAPS_API_KEY } from './config.js';

// jsDelivr plutôt qu'unpkg : déjà autorisé par la CSP (`script-src … cdn.jsdelivr.net`).
const CLUSTERER_CDN = 'https://cdn.jsdelivr.net/npm/@googlemaps/markerclusterer/dist/index.min.js';
const CALLBACK_NAME = '__suiviGmapInit';

let _mapsPromise    = null;
let _clusterPromise = null;

/** Une clé Maps est-elle renseignée ? Sinon la carte reste en rendu OSM maison. */
export function googleMapsEnabled() {
  return typeof GOOGLE_MAPS_API_KEY === 'string' && GOOGLE_MAPS_API_KEY.trim().length > 0;
}

/**
 * Charge l'API Google Maps JS (une seule fois). Résout l'objet google.maps.
 * Rejette si aucune clé n'est configurée ou si le script échoue (réseau, clé
 * invalide…) → l'appelant bascule alors sur le rendu OpenStreetMap maison.
 */
export function loadGoogleMaps() {
  if (!googleMapsEnabled()) return Promise.reject(new Error('gmaps-no-key'));
  if (window.google && window.google.maps) return Promise.resolve(window.google.maps);
  if (_mapsPromise) return _mapsPromise;

  _mapsPromise = new Promise((resolve, reject) => {
    // Garde anti-fuite : si Google ne rappelle jamais (clé bloquée, offline…).
    const timer = setTimeout(() => {
      cleanup();
      reject(new Error('gmaps-timeout'));
    }, 12000);

    function cleanup() {
      clearTimeout(timer);
      try { delete window[CALLBACK_NAME]; } catch { window[CALLBACK_NAME] = undefined; }
    }

    window[CALLBACK_NAME] = () => {
      cleanup();
      if (window.google && window.google.maps) resolve(window.google.maps);
      else reject(new Error('gmaps-no-namespace'));
    };

    const s = document.createElement('script');
    s.src = 'https://maps.googleapis.com/maps/api/js?' + new URLSearchParams({
      key: GOOGLE_MAPS_API_KEY.trim(),
      libraries: 'marker',   // AdvancedMarkerElement (marqueurs non dépréciés, W63)
      callback: CALLBACK_NAME,
      loading: 'async',
      language: 'fr',
      region: 'FR',
    });
    s.async = true;
    s.defer = true;
    s.onerror = () => { cleanup(); _mapsPromise = null; reject(new Error('gmaps-script-error')); };
    document.head.appendChild(s);
  });

  // En cas d'échec, on autorise une nouvelle tentative au prochain appel.
  _mapsPromise.catch(() => { _mapsPromise = null; });
  return _mapsPromise;
}

/**
 * Charge la librairie de clustering (UMD via CDN). Le regroupement est un
 * « plus » : on résout null si le CDN est indisponible, et l'appelant pose
 * alors les marqueurs un par un.
 */
export function loadClusterer() {
  if (window.markerClusterer) return Promise.resolve(window.markerClusterer);
  if (_clusterPromise) return _clusterPromise;

  _clusterPromise = new Promise(resolve => {
    const s = document.createElement('script');
    s.src = CLUSTERER_CDN;
    s.async = true;
    s.onload  = () => resolve(window.markerClusterer || null);
    s.onerror = () => { _clusterPromise = null; resolve(null); };
    document.head.appendChild(s);
  });
  return _clusterPromise;
}
