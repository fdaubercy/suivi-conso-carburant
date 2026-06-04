/* ═══════════════════════════════════════════════════════════════════════
   gmap.js — Chargeur Google Maps JavaScript API (W63)

   • googleMapsEnabled() : une clé est-elle configurée ? (sinon → repli OSM)
   • loadGoogleMaps()    : injecte le script Google une seule fois (promesse
                            mémorisée) et résout l'espace de noms google.maps
                            (avec google.maps.importLibrary disponible).
   • loadClusterer()     : charge @googlemaps/markerclusterer depuis jsDelivr
                            (déjà autorisé par la CSP). Optionnel : résout null.

   Le rendu (gmaprender.js) charge ensuite les classes via importLibrary
   ('maps'/'core'/'marker') — méthode officielle avec loading=async, sans
   l'erreur « Map is not a constructor » ni l'avertissement de chargement.

   Aucun accès DOM/navigateur au niveau module (compatibilité tests Node/CI).
═══════════════════════════════════════════════════════════════════════ */
import { GOOGLE_MAPS_API_KEY } from './config.js';

const CLUSTERER_CDN = 'https://cdn.jsdelivr.net/npm/@googlemaps/markerclusterer/dist/index.min.js';
const CALLBACK_NAME = '__suiviGmapInit';

let _mapsPromise    = null;
let _clusterPromise = null;

/** Une clé Maps est-elle renseignée ? Sinon la carte reste en rendu OSM maison. */
export function googleMapsEnabled() {
  return typeof GOOGLE_MAPS_API_KEY === 'string' && GOOGLE_MAPS_API_KEY.trim().length > 0;
}

/**
 * Charge l'API Google Maps JS (une seule fois). Résout l'objet google.maps
 * (importLibrary disponible). Rejette si aucune clé ou si le script échoue.
 */
export function loadGoogleMaps() {
  if (!googleMapsEnabled()) return Promise.reject(new Error('gmaps-no-key'));
  if (window.google && window.google.maps) return Promise.resolve(window.google.maps);
  if (_mapsPromise) return _mapsPromise;

  _mapsPromise = new Promise((resolve, reject) => {
    const timer = setTimeout(() => { cleanup(); reject(new Error('gmaps-timeout')); }, 12000);
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
    // loading=async + callback : chargement asynchrone recommandé ; les classes
    // (Map, marker…) sont ensuite récupérées via google.maps.importLibrary().
    s.src = 'https://maps.googleapis.com/maps/api/js?' + new URLSearchParams({
      key: GOOGLE_MAPS_API_KEY.trim(),
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

  _mapsPromise.catch(() => { _mapsPromise = null; });   // autorise une nouvelle tentative
  return _mapsPromise;
}

/**
 * Charge la librairie de clustering (UMD via jsDelivr). Le regroupement est un
 * « plus » : résout null si le CDN est indisponible (l'appelant pose alors les
 * marqueurs un par un).
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
