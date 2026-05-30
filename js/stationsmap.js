/* ─── Carte statique Stations habituelles + prix moyens E85 ─── */
import { getAllRecords }  from './historique.js';
import { escHtml, getCoords } from './utils.js';
import { PRIX_API }       from './config.js';

const COORD_CACHE_KEY = 'suivi_e85_station_coords';
const TILE_SZ = 256;

// Noms déjà géocodés (ou tentés sans succès) durant cette session — évite de
// re-lancer une requête réseau à chaque rendu de la card.
const _geocodeTried = new Set();

// ── Projection Mercator : coordonnée pixel GLOBALE (origine = coin NO du monde) ─
function lonToGlobalPx(lon, z) {
  return (lon + 180) / 360 * (1 << z) * TILE_SZ;
}
function latToGlobalPx(lat, z) {
  const lr = lat * Math.PI / 180;
  return (1 - Math.log(Math.tan(lr) + 1 / Math.cos(lr)) / Math.PI) / 2 * (1 << z) * TILE_SZ;
}

// ── Cache coordonnées ────────────────────────────────────────────────────────

/** Persiste lat/lon d'une station sélectionnée pour la carte statique. */
export function cacheStationCoords(name, lat, lon) {
  if (!name || !lat || !lon) return;
  try {
    const cache = JSON.parse(localStorage.getItem(COORD_CACHE_KEY) || '{}');
    cache[name] = { lat: +lat, lon: +lon };
    localStorage.setItem(COORD_CACHE_KEY, JSON.stringify(cache));
  } catch (_) { /* quota / navigation privée — silencieux */ }
}

// ── Calcul prix moyens ───────────────────────────────────────────────────────

/** Retourne la liste [{name, avg, count}] triée par prix croissant (E85 uniquement). */
export function computeStationAverages() {
  const agg = {};
  getAllRecords().forEach(r => {
    const name = r['Station essence'];
    const prix = Number(r['Prix €/L']);
    if (!name || !isFinite(prix) || prix <= 0) return;
    const type = String(r.Type || '').toLowerCase();
    if (!type.includes('e85') && !type.includes('ethanol')) return;
    if (!agg[name]) agg[name] = { total: 0, count: 0 };
    agg[name].total += prix;
    agg[name].count++;
  });
  return Object.entries(agg)
    .map(([name, { total, count }]) => ({ name, avg: total / count, count }))
    .sort((a, b) => a.avg - b.avg);
}

// ── Rendu card ───────────────────────────────────────────────────────────────

/** Rend la card #stationsMapCard : mini-carte statique + liste prix moyens. */
export function renderStationsCard() {
  const card = document.getElementById('stationsMapCard');
  if (!card) return;

  const avgs = computeStationAverages();
  if (!avgs.length) { card.classList.add('hidden'); return; }
  card.classList.remove('hidden');

  const coordCache = _loadCoordCache();
  const mapStations = avgs
    .filter(s => coordCache[s.name])
    .map(s => ({ ...coordCache[s.name], name: s.name, avg: s.avg, count: s.count }));

  // Stations habituelles sans coordonnées connues → géocodage en tâche de fond
  // (parse la ville depuis le nom, résout via l'API gouv.) puis re-rendu de la card.
  const missing = avgs.filter(s => !coordCache[s.name] && !_geocodeTried.has(s.name));
  if (missing.length) _geocodeMissing(missing);

  const minAvg = avgs[0]?.avg ?? 0;

  const listHtml = avgs.slice(0, 8).map(s => {
    const isBest = (s.avg - minAvg) < 0.002;
    return `<div class="smap-item">
      <span class="smap-name">${escHtml(s.name)}</span>
      <span class="smap-prix">${s.avg.toFixed(3)} €/L</span>
      <span class="smap-count">${s.count} plein${s.count > 1 ? 's' : ''}</span>
      ${isBest ? '<span class="smap-best">★ meilleur</span>' : ''}
    </div>`;
  }).join('');

  const mapDiv = mapStations.length >= 1
    ? `<div id="staticStationMap" class="static-map"></div>` : '';

  card.innerHTML = `
    <p class="section-title">Stations E85 habituelles</p>
    ${mapDiv}
    <div class="smap-list">${listHtml}</div>
  `;

  if (mapStations.length >= 1) _renderStaticMap(mapStations);
}

// ── Rendu mini-carte statique ────────────────────────────────────────────────

function _renderStaticMap(stations) {
  const container = document.getElementById('staticStationMap');
  if (!container) return;

  const W = container.offsetWidth  || 340;
  const H = container.offsetHeight || 160;

  // Marges réservées aux marqueurs (le pin monte au-dessus du point, badge prix large)
  const PAD_X = 30;   // demi-largeur badge prix
  const PAD_TOP = 50; // hauteur badge + pin ⛽ au-dessus du point
  const PAD_BOT = 10;

  // Choix du zoom : le plus détaillé où l'empreinte des marqueurs tient dans la carte
  let z = 9;
  for (let zz = 16; zz >= 9; zz--) {
    const xs = stations.map(s => lonToGlobalPx(s.lon, zz));
    const ys = stations.map(s => latToGlobalPx(s.lat, zz));
    const spanX = Math.max(...xs) - Math.min(...xs);
    const spanY = Math.max(...ys) - Math.min(...ys);
    if (spanX <= W - 2 * PAD_X && spanY <= H - PAD_TOP - PAD_BOT) { z = zz; break; }
  }

  // Coordonnées pixel globales des stations au zoom retenu
  const gx = stations.map(s => lonToGlobalPx(s.lon, z));
  const gy = stations.map(s => latToGlobalPx(s.lat, z));
  const minX = Math.min(...gx), maxX = Math.max(...gx);
  const minY = Math.min(...gy), maxY = Math.max(...gy);

  // Origine écran (pixel global du coin haut-gauche) : centre l'empreinte des marqueurs…
  let originX = (minX + maxX) / 2 - W / 2;
  let originY = (minY + maxY) / 2 - H / 2;
  // …puis garantit la marge haute (pin) et basse pour tous les marqueurs
  originY = Math.min(originY, minY - PAD_TOP);
  originY = Math.max(originY, maxY - (H - PAD_BOT));

  // ── Tuiles couvrant le viewport [origin, origin+W/H] ──
  const tx0 = Math.floor(originX / TILE_SZ), tx1 = Math.floor((originX + W) / TILE_SZ);
  const ty0 = Math.floor(originY / TILE_SZ), ty1 = Math.floor((originY + H) / TILE_SZ);
  const nTiles = 1 << z;

  let html = '';
  for (let ty = ty0; ty <= ty1; ty++)
    for (let tx = tx0; tx <= tx1; tx++) {
      if (ty < 0 || ty >= nTiles) continue;
      const wtx = ((tx % nTiles) + nTiles) % nTiles;   // wrap longitude
      html += `<img src="https://tile.openstreetmap.org/${z}/${wtx}/${ty}.png"
        style="position:absolute;left:${tx * TILE_SZ - originX}px;top:${ty * TILE_SZ - originY}px;width:${TILE_SZ}px;height:${TILE_SZ}px"
        loading="lazy" onerror="this.style.background='#ddd'">`;
    }

  // ── Marqueurs « stations habituelles » : pin ⛽ + badge prix ──
  // x clampé pour que le badge ne soit jamais coupé au bord.
  stations.forEach((s, i) => {
    const ax = Math.max(PAD_X, Math.min(W - PAD_X, Math.round(gx[i] - originX)));
    const ay = Math.round(gy[i] - originY);
    html += `
      <div class="smap-marker" style="left:${ax}px;top:${ay}px">
        <span class="smap-marker-price">${s.avg.toFixed(3)} €/L</span>
        <span class="smap-marker-pin"><span>⛽</span></span>
      </div>`;
  });

  html += `<a href="https://www.openstreetmap.org" target="_blank" rel="noopener"
    style="position:absolute;bottom:3px;right:5px;background:rgba(255,255,255,.8);
           font-size:9px;padding:1px 5px;border-radius:3px;color:#555;
           text-decoration:none;z-index:20">© OSM</a>`;

  container.innerHTML = html;
}

// ── Géocodage des stations habituelles sans coordonnées ──────────────────────

/** Extrait la ville d'un nom de station "Enseigne - Ville" → "Ville". */
function _villeFromName(name) {
  const parts = String(name).split(/\s[-–]\s/);            // " - " ou " – "
  const ville = (parts.length > 1 ? parts[parts.length - 1] : '').trim();
  return ville;
}

/**
 * Résout les coordonnées des stations manquantes via l'API gouv. (1 requête par
 * station, sur la ville), persiste dans le cache, puis re-rend la card une fois
 * terminé. Tolérant aux erreurs réseau (chaque station marquée « tentée »).
 */
async function _geocodeMissing(stations) {
  let resolved = 0;
  for (const s of stations) {
    _geocodeTried.add(s.name);
    const ville = _villeFromName(s.name);
    if (!ville) continue;
    try {
      const url = PRIX_API + '?' + new URLSearchParams({
        where:  `e85_prix is not null and ville like "${ville.replace(/"/g, '')}%"`,
        select: 'geom',
        limit:  '1'
      });
      const resp = await fetch(url);
      if (!resp.ok) continue;
      const data = await resp.json();
      const c = data.results?.[0] ? getCoords(data.results[0]) : null;
      if (c && c.lat && c.lon) { cacheStationCoords(s.name, c.lat, c.lon); resolved++; }
    } catch (_) { /* réseau indisponible — réessai possible plus tard */ }
  }
  if (resolved) renderStationsCard();   // re-rendu avec les nouveaux marqueurs
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function _loadCoordCache() {
  try { return JSON.parse(localStorage.getItem(COORD_CACHE_KEY) || '{}'); }
  catch (_) { return {}; }
}
