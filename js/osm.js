/* ─── Enrichissement Overpass (enseigne OSM) ───
   Refonte : UNE seule requête Overpass (union de clauses `around` par station)
   au lieu de N requêtes en série. Appariement par proximité avec seuil
   (sinon on garde le nom gouv. → jamais de faux nom). Annulable au clic. */
import { haversine } from './utils.js';

const OVERPASS_API      = 'https://overpass-api.de/api/interpreter';
const QUERY_RADIUS_M    = 300;   // rayon interrogé autour de chaque station
const MATCH_THRESHOLD_M = 200;   // au-delà → on garde le nom gouv. (pas de faux nom)
const OVERPASS_TIMEOUT  = 25000; // ms

// Token d'annulation : une nouvelle recherche OU la sélection d'une station l'incrémente.
let _osmToken = 0;
// Requête en vol : permet d'avorter réellement le fetch sur annulation.
let _osmAbort = null;

/** Annule tout enrichissement OSM en cours (nouvelle recherche OU station choisie) :
 *  invalide le token (le résultat sera ignoré) ET avorte la requête réseau en vol. */
export function cancelOsmEnrich() {
  _osmToken++;
  if (_osmAbort) { try { _osmAbort.abort(); } catch { /* déjà terminé */ } _osmAbort = null; }
}

/** Extrait l'enseigne d'un élément OSM fuel (brand > name > operator). */
function osmName(tags) {
  return (tags && (tags.brand || tags.name || tags.operator)) || null;
}

/**
 * Renomme `stations` (objets {lat, lon, …}) via UNE requête Overpass groupée.
 * Pour chaque station, on prend l'enseigne du nœud `amenity=fuel` le plus proche
 * dans MATCH_THRESHOLD_M ; au-delà, le nom n'est pas touché.
 * onUpdate(i, enseigne) est appelé pour chaque station appariée.
 * setStatus(type, msg) : retour visuel optionnel.
 * Retourne false si annulé (nouvelle recherche / station choisie), true sinon.
 */
export async function enrichStationsBulk(stations, onUpdate, setStatus) {
  const myToken = ++_osmToken;
  if (!stations || !stations.length) return true;

  setStatus?.('spin', 'Identification des enseignes…');

  // Union de clauses `around` (une par station) → 1 seule requête, réponse compacte.
  const clauses = stations.map(s =>
    `node(around:${QUERY_RADIUS_M},${s.lat},${s.lon})[amenity=fuel];` +
    `way(around:${QUERY_RADIUS_M},${s.lat},${s.lon})[amenity=fuel];`
  ).join('');
  const query = `[out:json][timeout:25];(${clauses});out tags center;`;

  const controller = new AbortController();
  _osmAbort = controller;
  const timer = setTimeout(() => controller.abort(), OVERPASS_TIMEOUT);

  let osm = [];
  try {
    const resp = await fetch(OVERPASS_API, {
      method: 'POST', body: 'data=' + encodeURIComponent(query),
      signal: controller.signal
    });
    if (resp.ok) {
      const data = await resp.json();
      osm = (data.elements || []).map(el => {
        const eLat = el.lat ?? el.center?.lat, eLon = el.lon ?? el.center?.lon;
        const name = osmName(el.tags);
        return (eLat != null && name) ? { lat: eLat, lon: eLon, name } : null;
      }).filter(Boolean);
    }
  } catch (e) {
    if (e.name !== 'AbortError') console.warn('[OSM] requête groupée :', e.message);
  } finally {
    clearTimeout(timer);
    if (_osmAbort === controller) _osmAbort = null;
  }

  if (myToken !== _osmToken) return false;   // annulé entre-temps
  if (!osm.length) return true;              // aucune enseigne → on garde les noms gouv.

  stations.forEach((s, i) => {
    let best = null, bestD = Infinity;
    for (const o of osm) {
      const d = haversine(s.lat, s.lon, o.lat, o.lon);
      if (d < bestD) { bestD = d; best = o; }
    }
    if (best && bestD <= MATCH_THRESHOLD_M && typeof onUpdate === 'function') onUpdate(i, best.name);
  });
  return true;
}
