/* ─── Carte statique Stations habituelles + prix moyens (multi-carburant W47) ─── */
import { getAllRecords }  from './historique.js';
import { escHtml, getCoords, haversine } from './utils.js';
import { PRIX_API, FUEL_CONFIG, FAVORITE_MIN_PLEINS, STATION_SORT_KEY, PINNED_STATIONS_KEY } from './config.js';
import { state }          from './state.js';
import { showStationPopup } from './itineraire.js';
import { getSectorToday, loadSectorPrices } from './secteur.js';   // W48 prix secteur par carburant
import { googleMapsActive, renderGoogleStationMap } from './gmaprender.js';   // W63 carte Google (onglet Carte)

const COORD_CACHE_KEY = 'suivi_e85_station_coords';
const TILE_SZ = 256;

// W47 — carburants proposés par le sélecteur de la vue Carte.
const CARTE_FUELS = ['E85', 'GAZOLE', 'SP98'];
// Jetons de reconnaissance du type d'un plein (le champ "Type" stocke un libellé
// FUEL_CONFIG, mais on reste tolérant aux variantes/anciennes saisies).
const FUEL_TOKENS = {
  E85:    ['e85', 'ethanol', 'éthanol'],
  GAZOLE: ['gazole', 'diesel', 'gasoil', 'gazoil'],
  SP98:   ['sp98', 'super 98', 'super98', '98'],
};

// Carburant actuellement affiché sur la carte + suivi du choix utilisateur.
let _selectedFuel  = null;    // résolu au 1er rendu (défaut = dernier plein du véhicule)
let _userPickedFuel = false;  // l'utilisateur a-t-il cliqué le sélecteur cette session ?
let _lastVehForFuel = null;   // véhicule pour lequel le défaut a été calculé

// W36 — mode de tri de la liste des stations habituelles : 'prix' | 'freq'.
let _sortMode = (() => {
  try { return localStorage.getItem(STATION_SORT_KEY) === 'freq' ? 'freq' : 'prix'; }
  catch { return 'prix'; }
})();

/** Le type d'un plein correspond-il au carburant demandé ? */
function _fuelMatch(fuelKey, typeStr) {
  const t = String(typeStr || '').toLowerCase();
  return (FUEL_TOKENS[fuelKey] || []).some(tok => t.includes(tok));
}

// ── W53 — Stations épinglées manuellement (📌, indépendantes du prix/seuil) ──
/** Ensemble des noms de stations épinglés par l'utilisateur (localStorage). */
function _loadPinned() {
  try {
    const arr = JSON.parse(localStorage.getItem(PINNED_STATIONS_KEY) || '[]');
    return Array.isArray(arr) ? new Set(arr.map(String)) : new Set();
  } catch { return new Set(); }
}
function _savePinned(set) {
  try { localStorage.setItem(PINNED_STATIONS_KEY, JSON.stringify([...set])); }
  catch { /* quota / navigation privée */ }
}
/** Bascule l'épinglage d'une station ; renvoie le nouvel ensemble. */
function _togglePinned(name) {
  const set = _loadPinned();
  if (set.has(name)) set.delete(name); else set.add(name);
  _savePinned(set);
  return set;
}

// Noms déjà géocodés (ou tentés sans succès) durant cette session — évite de
// re-lancer une requête réseau à chaque rendu de la card.
const _geocodeTried = new Set();

// Position courante de l'utilisateur (session) + garde anti-redemande géoloc.
let _userPos = null;
let _userPosTried = false;

// Stations actuellement affichées sur la mini-carte (pour le clic → popup S11).
let _renderedStations = [];

// W48 — carburants dont le prix secteur a déjà été chargé (réseau) cette session.
const _sectorFetched = new Set();

/** Icône utilisateur selon le véhicule courant : 🏍️ moto / 🚗 voiture. */
function _vehicleIcon(name) {
  return /moto|scooter|deux.?roues|\bbike\b|cbr|scoot|harley|yamaha|kawasaki|ducati/i
    .test(String(name || '')) ? '🏍️' : '🚗';
}

/** Récupère la position courante (une fois/session) puis re-rend la card. */
function _ensureUserPos() {
  if (_userPos || _userPosTried || !navigator.geolocation) return;
  _userPosTried = true;
  navigator.geolocation.getCurrentPosition(
    pos => {
      _userPos = { lat: pos.coords.latitude, lon: pos.coords.longitude };
      state.userLat = _userPos.lat; state.userLon = _userPos.lon;
      _geocodeTried.clear();   // re-géocode avec la position comme référence fiable
      renderStationsCard();
    },
    () => { /* refus / indisponible — pas de marqueur utilisateur */ },
    { timeout: 8000, maximumAge: 300000 }
  );
}

// ── Projection Mercator : coordonnée pixel GLOBALE (origine = coin NO du monde) ─
function lonToGlobalPx(lon, z) {
  return (lon + 180) / 360 * (1 << z) * TILE_SZ;
}
function latToGlobalPx(lat, z) {
  const lr = lat * Math.PI / 180;
  return (1 - Math.log(Math.tan(lr) + 1 / Math.cos(lr)) / Math.PI) / 2 * (1 << z) * TILE_SZ;
}

// ── Cache coordonnées ────────────────────────────────────────────────────────

/** Persiste lat/lon d'une station pour la carte statique.
 *  src : 'pick' = choisie par l'utilisateur (fiable) · 'geo' = géocodée auto. */
export function cacheStationCoords(name, lat, lon, src) {
  if (!name || !lat || !lon) return;
  try {
    const cache = JSON.parse(localStorage.getItem(COORD_CACHE_KEY) || '{}');
    cache[name] = { lat: +lat, lon: +lon, src: src || 'pick' };
    localStorage.setItem(COORD_CACHE_KEY, JSON.stringify(cache));
  } catch { /* quota / navigation privée — silencieux */ }
}

/** Coordonnées mémorisées d'une station (cache localStorage), ou null si inconnue.
 *  Sert à récupérer les prix À LA STATION choisie/dupliquée (pas autour du GPS
 *  courant) → colonnes prix I→N fiables même loin de la station. */
export function getStationCoords(name) {
  if (!name) return null;
  const c = _loadCoordCache()[name];
  return (c && isFinite(c.lat) && isFinite(c.lon)) ? { lat: +c.lat, lon: +c.lon, src: c.src } : null;
}

// ── Calcul prix moyens ───────────────────────────────────────────────────────

/** Liste [{name, avg, count}] triée par prix croissant pour un carburant donné. */
export function computeStationAverages(fuelKey = 'E85') {
  const agg = {};
  getAllRecords().forEach(r => {
    const name = r['Station essence'];
    const prix = Number(r['Prix €/L']);
    if (!name || !isFinite(prix) || prix <= 0) return;
    if (!_fuelMatch(fuelKey, r.Type)) return;
    if (!agg[name]) agg[name] = { total: 0, count: 0 };
    agg[name].total += prix;
    agg[name].count++;
  });
  return Object.entries(agg)
    .map(([name, { total, count }]) => ({ name, avg: total / count, count }))
    .sort((a, b) => a.avg - b.avg);
}

/** Carburant du dernier plein du véhicule courant (parmi CARTE_FUELS), sinon E85. */
function _defaultFuelForVehicle() {
  const veh = state.currentVehiculeNom || '';
  const recent = getAllRecords()
    .filter(r => !veh || (r['Véhicule'] || r['Vehicule'] || '') === veh)
    .sort((a, b) => String(b.Horodatage || '').localeCompare(String(a.Horodatage || '')));
  for (const r of recent) {
    const k = CARTE_FUELS.find(fk => _fuelMatch(fk, r.Type));
    if (k) return k;
  }
  return 'E85';
}

/** Fixe _selectedFuel : défaut = dernier plein du véhicule ; ré-évalué si le
 *  véhicule change (sauf si l'utilisateur a explicitement choisi un carburant). */
function _resolveFuel() {
  const veh = state.currentVehiculeNom || '';
  if (veh !== _lastVehForFuel) {           // changement de véhicule → on re-défaut
    _userPickedFuel = false;
    _selectedFuel = null;
    _lastVehForFuel = veh;
  }
  if (!_userPickedFuel || _selectedFuel == null) {
    _selectedFuel = _defaultFuelForVehicle();
  }
  if (!CARTE_FUELS.includes(_selectedFuel)) _selectedFuel = 'E85';
}

// ── Rendu card ───────────────────────────────────────────────────────────────

/** Rend la card #stationsMapCard : mini-carte statique + liste prix moyens. */
export function renderStationsCard() {
  const card = document.getElementById('stationsMapCard');
  if (!card) return;

  _resolveFuel();

  // Carte masquée seulement si AUCUN carburant n'a de station habituelle.
  const anyData = CARTE_FUELS.some(k => computeStationAverages(k).length > 0);
  if (!anyData) { card.classList.add('hidden'); return; }
  card.classList.remove('hidden');

  const avgs = computeStationAverages(_selectedFuel);
  const short = FUEL_CONFIG[_selectedFuel]?.short || _selectedFuel;

  const coordCache = _loadCoordCache();

  // Point de référence pour lever l'ambiguïté de villes homonymes (ex. plusieurs
  // « Flers ») et repérer les coordonnées aberrantes : position de l'utilisateur,
  // sinon barycentre des stations choisies à la main, sinon de toutes.
  const ref = _refPoint(coordCache);
  const MAX_DIST_M = 80000;   // au-delà → coord auto. jugée aberrante → re-géocodage

  // À (re)géocoder : stations sans coord, ou auto-géocodées trop loin de la référence.
  const toGeocode = avgs.filter(s => {
    if (_geocodeTried.has(s.name)) return false;
    const c = coordCache[s.name];
    if (!c) return true;                               // aucune coord connue
    if (c.src === 'pick') return false;               // choisie par l'utilisateur → fiable
    return ref && haversine(c.lat, c.lon, ref.lat, ref.lon) > MAX_DIST_M; // aberrante
  });
  if (toGeocode.length) _geocodeMissing(toGeocode, ref);

  // N'affiche QUE les coords plausibles (cache à jour sauf re-géocodage en cours)
  const mapStations = avgs
    .filter(s => coordCache[s.name])
    .map(s => ({ ...coordCache[s.name], name: s.name, avg: s.avg, count: s.count }));

  const minAvg = avgs[0]?.avg ?? 0;          // meilleur prix (avgs trié par prix)

  // W36 — ordre d'affichage selon le tri choisi (prix croissant / fréquence décr.).
  // W53 — les stations épinglées manuellement (📌) passent en tête, dans leur
  // ordre de tri, indépendamment du prix et du seuil de fréquentation.
  const pinned = _loadPinned();
  const sorted = _sortMode === 'freq'
    ? avgs.slice().sort((a, b) => b.count - a.count || a.avg - b.avg)
    : avgs.slice();
  const displayed = sorted
    .slice()
    .sort((a, b) => (pinned.has(b.name) ? 1 : 0) - (pinned.has(a.name) ? 1 : 0))
    .slice(0, 8);

  // W36 — bouton de tri : prix ↔ fréquentation.
  const sortHtml = `<div class="smap-sort">
    <button type="button" class="smap-sort-btn${_sortMode === 'prix' ? ' active' : ''}"
      data-sort="prix">💶 Prix</button>
    <button type="button" class="smap-sort-btn${_sortMode === 'freq' ? ' active' : ''}"
      data-sort="freq">⭐ Fréquentation</button>
  </div>`;

  const listHtml = displayed.map(s => {
    const isBest = (s.avg - minAvg) < 0.002;                 // ★ meilleur prix
    const isFav  = s.count >= FAVORITE_MIN_PLEINS;           // ⭐ station favorite (auto)
    const isPin  = pinned.has(s.name);                       // 📌 épinglée (manuel, W53)
    return `<div class="smap-item${isPin ? ' pinned' : ''}">
      <button type="button" class="smap-pin-btn${isPin ? ' on' : ''}"
        data-pin="${escHtml(s.name)}" aria-pressed="${isPin}"
        title="${isPin ? 'Désépingler' : 'Épingler en tête'}">📌</button>
      <span class="smap-name">${isFav ? '⭐ ' : ''}${escHtml(s.name)}</span>
      <span class="smap-prix">${s.avg.toFixed(3)} €/L</span>
      <span class="smap-count">${s.count} plein${s.count > 1 ? 's' : ''}</span>
      ${isBest ? '<span class="smap-best">★ meilleur</span>' : ''}
    </div>`;
  }).join('');

  // Position utilisateur : connue (bouton 📍) ou demandée une fois en arrière-plan.
  if (state.userLat != null && state.userLon != null) {
    _userPos = { lat: state.userLat, lon: state.userLon };
  } else {
    _ensureUserPos();
  }

  const mapDiv = mapStations.length >= 1
    ? `<div id="staticStationMap" class="static-map"></div>` : '';

  // Sélecteur de carburant (W47) — défaut = dernier plein du véhicule.
  const fuelSel = `<div class="smap-fuel-sel" role="tablist">${
    CARTE_FUELS.map(k => {
      const cfg = FUEL_CONFIG[k] || {};
      const on  = k === _selectedFuel;
      return `<button type="button" class="smap-fuel-btn${on ? ' active' : ''}"
        data-fuel="${k}" role="tab" aria-selected="${on}">${cfg.icon || ''} ${cfg.short || k}</button>`;
    }).join('')
  }</div>`;

  // W48 — « moins cher du secteur » (relevé quotidien) pour le carburant choisi.
  const sect = getSectorToday(_selectedFuel);
  const sectorHtml = (sect && sect.prix != null)
    ? `<div class="smap-sector">🏆 Moins cher du secteur : <b>${Number(sect.prix).toFixed(3)} €/L</b>${
        sect.station ? ` · ${escHtml(String(sect.station).replace(/^Secteur - /, ''))}` : ''}</div>`
    : '';

  const body = listHtml
    ? `${mapDiv}${sortHtml}<div class="smap-list">${listHtml}</div>`
    : `<p class="smap-empty">Aucun plein ${escHtml(short)} enregistré pour ce véhicule.</p>`;

  card.innerHTML = `
    <p class="section-title">Stations ${escHtml(short)} habituelles</p>
    ${fuelSel}
    ${sectorHtml}
    ${body}
  `;

  if (listHtml && mapStations.length >= 1) _renderHabituellesMap(mapStations, _userPos);

  // Charge le prix secteur du carburant (1×/session) puis re-rend si toujours actif.
  if (!_sectorFetched.has(_selectedFuel)) {
    const fuel = _selectedFuel;
    _sectorFetched.add(fuel);
    loadSectorPrices(fuel).then(d => {
      if (d && _selectedFuel === fuel) renderStationsCard();
    });
  }
}

// ── Rendu mini-carte statique ────────────────────────────────────────────────

/** Onglet « Carte » — W63 : Google Maps interactif si dispo, sinon repli tuiles
 *  OSM maison. Mêmes données (stations habituelles + position) dans les deux cas. */
function _renderHabituellesMap(stations, userPos) {
  _renderedStations = stations;   // S11 — pour le clic (popup itinéraire) en repli OSM
  const container = document.getElementById('staticStationMap');
  if (!container) return;
  if (!googleMapsActive()) { _renderStaticMap(stations, userPos); return; }

  const short = FUEL_CONFIG[_selectedFuel]?.short || _selectedFuel;
  const gStations = stations.map(s => ({
    lat: s.lat, lon: s.lon,
    text:  Number(s.avg).toFixed(3),
    title: `${s.name} — ${short} moy. ${Number(s.avg).toFixed(3)} €/L`,
    onClick: () => showStationPopup({
      name: s.name, lat: s.lat, lon: s.lon,
      priceLabel: `${short} moy. ${Number(s.avg).toFixed(3)} €/L`,
    }),
  }));
  const uPos = userPos ? { lat: userPos.lat, lon: userPos.lon, title: 'Votre position' } : null;
  renderGoogleStationMap(container, {
    stations: gStations, userPos: uPos,
    onFallback: () => _renderStaticMap(stations, userPos),
  });
}

function _renderStaticMap(stations, userPos) {
  const container = document.getElementById('staticStationMap');
  if (!container) return;

  _renderedStations = stations;   // S11 — mémorise pour le clic (popup itinéraire)

  const W = container.offsetWidth  || 340;
  const H = container.offsetHeight || 160;

  // Marges réservées aux marqueurs (le pin monte au-dessus du point, badge prix large)
  const PAD_X = 30;   // demi-largeur badge prix
  const PAD_TOP = 50; // hauteur badge + pin ⛽ au-dessus du point
  const PAD_BOT = 16;

  // Points à cadrer = stations habituelles (+ position utilisateur si connue)
  const fitPts = userPos ? stations.concat([{ lat: userPos.lat, lon: userPos.lon }]) : stations;

  // Choix du zoom : le plus détaillé où l'empreinte des marqueurs tient dans la carte
  let z = 9;
  for (let zz = 16; zz >= 9; zz--) {
    const xs = fitPts.map(s => lonToGlobalPx(s.lon, zz));
    const ys = fitPts.map(s => latToGlobalPx(s.lat, zz));
    const spanX = Math.max(...xs) - Math.min(...xs);
    const spanY = Math.max(...ys) - Math.min(...ys);
    if (spanX <= W - 2 * PAD_X && spanY <= H - PAD_TOP - PAD_BOT) { z = zz; break; }
  }

  // Coordonnées pixel globales des stations au zoom retenu
  const gx = stations.map(s => lonToGlobalPx(s.lon, z));
  const gy = stations.map(s => latToGlobalPx(s.lat, z));
  const fitX = fitPts.map(s => lonToGlobalPx(s.lon, z));
  const fitY = fitPts.map(s => latToGlobalPx(s.lat, z));
  const minX = Math.min(...fitX), maxX = Math.max(...fitX);
  const minY = Math.min(...fitY), maxY = Math.max(...fitY);

  // Origine écran (pixel global du coin haut-gauche) : centre l'empreinte des marqueurs…
  const originX = (minX + maxX) / 2 - W / 2;
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
      <div class="smap-marker" data-smap-idx="${i}" style="left:${ax}px;top:${ay}px">
        <span class="smap-marker-price">${s.avg.toFixed(3)} €/L</span>
        <span class="smap-marker-pin"><span>⛽</span></span>
      </div>`;
  });

  // ── Marqueur position utilisateur : icône véhicule (🏍️ / 🚗) ──
  if (userPos) {
    const ux = Math.max(16, Math.min(W - 16, Math.round(lonToGlobalPx(userPos.lon, z) - originX)));
    const uy = Math.max(16, Math.min(H - 16, Math.round(latToGlobalPx(userPos.lat, z) - originY)));
    html += `
      <div class="smap-user" style="left:${ux}px;top:${uy}px" title="Votre position">
        <span class="smap-user-pin">${_vehicleIcon(state.currentVehiculeNom)}</span>
      </div>`;
  }

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
 * Résout les coordonnées des stations via l'API gouv. (requête sur la ville).
 * Parmi les candidats (villes homonymes), retient celui le plus proche du point
 * de référence `ref` (position utilisateur / barycentre) pour éviter les faux
 * positifs (ex. « Flers » dans l'Orne vs « Flers-en-Escrebieux » près de Douai).
 * Persiste avec src:'geo' puis re-rend la card. Tolérant aux erreurs réseau.
 */
async function _geocodeMissing(stations, ref) {
  let resolved = 0;
  for (const s of stations) {
    _geocodeTried.add(s.name);
    const ville = _villeFromName(s.name);
    if (!ville) continue;
    try {
      const url = PRIX_API + '?' + new URLSearchParams({
        where:  `e85_prix is not null and ville like "${ville.replace(/"/g, '')}%"`,
        select: 'geom',
        limit:  '20'
      });
      const resp = await fetch(url);
      if (!resp.ok) continue;
      const data = await resp.json();
      const cands = (data.results || []).map(getCoords).filter(c => c && c.lat && c.lon);
      if (!cands.length) continue;
      const best = ref
        ? cands.reduce((a, b) =>
            haversine(b.lat, b.lon, ref.lat, ref.lon) < haversine(a.lat, a.lon, ref.lat, ref.lon) ? b : a)
        : cands[0];
      cacheStationCoords(s.name, best.lat, best.lon, 'geo');
      resolved++;
    } catch { /* réseau indisponible — réessai possible plus tard */ }
  }
  if (resolved) renderStationsCard();   // re-rendu avec les nouveaux marqueurs
}

/** Point de référence : position utilisateur, sinon barycentre des coords
 *  choisies à la main ('pick'), sinon de toutes les coords connues. */
function _refPoint(coordCache) {
  if (state.userLat != null && state.userLon != null) {
    return { lat: state.userLat, lon: state.userLon };
  }
  const all   = Object.values(coordCache).filter(c => c && isFinite(c.lat) && isFinite(c.lon));
  const picks = all.filter(c => c.src === 'pick');
  const pool  = picks.length ? picks : all;
  if (!pool.length) return null;
  return {
    lat: pool.reduce((s, c) => s + c.lat, 0) / pool.length,
    lon: pool.reduce((s, c) => s + c.lon, 0) / pool.length
  };
}

// ── S11 — Clic sur un marqueur « station habituelle » → popup itinéraire ──────

/**
 * Délégation d'événements sur la card #stationsMapCard (qui persiste même si
 * son innerHTML est reconstruit à chaque rendu). Appelée une fois depuis main.js.
 */
export function initStationsMapInteractions() {
  const card = document.getElementById('stationsMapCard');
  if (!card) return;
  card.addEventListener('click', e => {
    // W53 — bouton 📌 épingler / désépingler une station (en tête de liste)
    const pinBtn = e.target.closest('.smap-pin-btn');
    if (pinBtn) {
      _togglePinned(pinBtn.dataset.pin);
      renderStationsCard();
      return;
    }

    // W36 — bouton de tri (prix / fréquentation)
    const sortBtn = e.target.closest('.smap-sort-btn');
    if (sortBtn) {
      const m = sortBtn.dataset.sort === 'freq' ? 'freq' : 'prix';
      if (m !== _sortMode) {
        _sortMode = m;
        try { localStorage.setItem(STATION_SORT_KEY, m); } catch { /* quota */ }
        renderStationsCard();
      }
      return;
    }

    // W47 — sélecteur de carburant
    const fuelBtn = e.target.closest('.smap-fuel-btn');
    if (fuelBtn) {
      const k = fuelBtn.dataset.fuel;
      if (CARTE_FUELS.includes(k) && k !== _selectedFuel) {
        _selectedFuel = k;
        _userPickedFuel = true;
        renderStationsCard();
      }
      return;
    }

    const marker = e.target.closest('.smap-marker');
    if (!marker) return;
    const idx = parseInt(marker.dataset.smapIdx, 10);
    const s = _renderedStations[idx];
    if (!s) return;
    const short = FUEL_CONFIG[_selectedFuel]?.short || _selectedFuel;
    showStationPopup({
      name: s.name,
      lat:  s.lat,
      lon:  s.lon,
      priceLabel: `${short} moy. ${Number(s.avg).toFixed(3)} €/L`,
    });
  });
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function _loadCoordCache() {
  try { return JSON.parse(localStorage.getItem(COORD_CACHE_KEY) || '{}'); }
  catch { return {}; }
}
