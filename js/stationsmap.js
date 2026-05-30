/* ─── Carte statique Stations habituelles + prix moyens E85 ─── */
import { getAllRecords }  from './historique.js';
import { escHtml, getCoords } from './utils.js';
import { PRIX_API }       from './config.js';

const COORD_CACHE_KEY = 'suivi_e85_station_coords';
const TILE_SZ = 256;

// Noms déjà géocodés (ou tentés sans succès) durant cette session — évite de
// re-lancer une requête réseau à chaque rendu de la card.
const _geocodeTried = new Set();

// ── Math tuiles (même logique que carte.js) ─────────────────────────────────
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
function bestZoomStatic(allLats, allLons, maxW, maxH) {
  for (let z = 14; z >= 10; z--) {
    const nw = tileXY(Math.max(...allLats), Math.min(...allLons), z);
    const se = tileXY(Math.min(...allLats), Math.max(...allLons), z);
    if ((se.x - nw.x + 1) * TILE_SZ <= maxW + TILE_SZ &&
        (se.y - nw.y + 1) * TILE_SZ <= maxH + TILE_SZ) return z;
  }
  return 10;
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
  const mg = 0.006;
  const allLats = stations.map(s => s.lat);
  const allLons = stations.map(s => s.lon);

  const z  = bestZoomStatic(
    [Math.min(...allLats) - mg, Math.max(...allLats) + mg],
    [Math.min(...allLons) - mg, Math.max(...allLons) + mg],
    W, H
  );
  const nw    = tileXY(Math.max(...allLats) + mg, Math.min(...allLons) - mg, z);
  const se    = tileXY(Math.min(...allLats) - mg, Math.max(...allLons) + mg, z);
  const gridW = (se.x - nw.x + 1) * TILE_SZ;
  const gridH = (se.y - nw.y + 1) * TILE_SZ;
  const offX  = Math.round((W - gridW) / 2);
  let   offY  = Math.round((H - gridH) / 2);

  // Sécurité : le pin le plus nord ne doit pas dépasser le haut
  const PIN_H = 26;
  const minPy = Math.min(...stations.map(s => latLonToPx(s.lat, s.lon, z, nw.x, nw.y).y));
  offY = Math.max(offY, PIN_H - minPy);

  // ── Tuiles ──
  let html = `<div style="position:absolute;left:${offX}px;top:${offY}px;width:${gridW}px;height:${gridH}px;overflow:hidden">`;
  for (let ty = nw.y; ty <= se.y; ty++)
    for (let tx = nw.x; tx <= se.x; tx++)
      html += `<img src="https://tile.openstreetmap.org/${z}/${tx}/${ty}.png"
        style="position:absolute;left:${(tx-nw.x)*TILE_SZ}px;top:${(ty-nw.y)*TILE_SZ}px;width:${TILE_SZ}px;height:${TILE_SZ}px"
        loading="lazy" onerror="this.style.background='#ddd'">`;
  html += '</div>';

  // ── Marqueurs prix (hors grille pour ne pas être clippés par overflow:hidden) ──
  stations.forEach(s => {
    const p   = latLonToPx(s.lat, s.lon, z, nw.x, nw.y);
    const ax  = offX + p.x;
    const ay  = offY + p.y;
    html += `
      <div style="position:absolute;left:${ax}px;top:${ay - PIN_H}px;
                  transform:translateX(-50%);z-index:10;pointer-events:none;text-align:center">
        <div class="smap-pin">${s.avg.toFixed(3)} €/L</div>
        <div class="smap-pin-dot"></div>
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
