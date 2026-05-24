/* ─── Enrichissement Overpass (nom enseigne OSM) ─── */
import { haversine } from './utils.js';
import { setGeoStatus } from './ui.js';

const OVERPASS_API     = 'https://overpass-api.de/api/interpreter';
const OSM_RADIUS       = 2000;
const OSM_SERIAL_DELAY = 600;

// Token d'annulation : chaque enrichissement concurrent annule le précédent
let _enrichToken = 0;

/** Cherche le nom de la station la plus proche (brand > name > operator) via Overpass. */
export async function fetchOsmNameAround(lat, lon) {
  const query =
    `[out:json][timeout:8];(node(around:${OSM_RADIUS},${lat},${lon})[amenity=fuel];` +
    `way(around:${OSM_RADIUS},${lat},${lon})[amenity=fuel];);out tags center;`;
  try {
    const resp = await fetch(OVERPASS_API, {
      method: 'POST', body: 'data=' + encodeURIComponent(query),
      signal: AbortSignal.timeout(8000)
    });
    if (!resp.ok) return null;
    const data = await resp.json();
    const elements = data.elements || [];
    if (!elements.length) return null;
    const sorted = elements
      .map(el => {
        const eLat = el.lat ?? el.center?.lat, eLon = el.lon ?? el.center?.lon;
        if (eLat == null) return null;
        return { tags: el.tags || {}, dist: haversine(lat, lon, eLat, eLon) };
      })
      .filter(Boolean)
      .sort((a, b) => a.dist - b.dist);
    const tags = sorted[0].tags;
    const name = tags.brand || tags.name || tags.operator || null;
    console.log(`[OSM] around(${lat.toFixed(4)},${lon.toFixed(4)}) → "${name||'—'}" (Δ${Math.round(sorted[0].dist)} m)`);
    return name;
  } catch(e) { console.warn('[OSM] Erreur :', e.message); return null; }
}

/**
 * Enrichit un tableau de stations en série (anti-429).
 * setStatus : fonction de statut à appeler (défaut setGeoStatus).
 * Retourne null si un appel plus récent a démarré (annulation automatique).
 */
export async function enrichWithOsmSerial(stations, setStatus = setGeoStatus) {
  const myToken = ++_enrichToken;
  const names = [];
  for (let i = 0; i < stations.length; i++) {
    if (myToken !== _enrichToken) return null; // annulé par une recherche plus récente
    setStatus('info', `Identification station ${i+1}/${stations.length}…`);
    names.push(await fetchOsmNameAround(stations[i].lat, stations[i].lon));
    if (i < stations.length - 1) await new Promise(r => setTimeout(r, OSM_SERIAL_DELAY));
  }
  return names;
}
