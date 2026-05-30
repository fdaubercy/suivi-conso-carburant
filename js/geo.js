/* ─── Géolocalisation + liste stations proches ─── */
import { FUEL_CONFIG, FUEL_KEYS, FUEL_SELECT, GAS_URL, APP_TOKEN } from './config.js';
import { state } from './state.js';
import { haversine, escHtml, getCoords, stationLabel, stationSubLabel, composeStationName } from './utils.js';
import { setGeoStatus } from './ui.js';
import { cacheStationCoords } from './stationsmap.js';
import { enrichWithOsmSerial } from './osm.js';
import { showMap } from './carte.js';
import { _buildTypeToggle, _updateHeaderBadges } from './carburant.js';
import { fetchPricesAtCoords } from './prix.js';

/* ─── W31 — Cache géoloc localStorage ─── */
const GEO_CACHE_KEY = 'suivi_e85_last_geo';
const GEO_CACHE_TTL = 60 * 60 * 1000; // 1 heure

function loadGeoCache() {
  try {
    const raw = localStorage.getItem(GEO_CACHE_KEY);
    if (!raw) return null;
    const d = JSON.parse(raw);
    if (!d?.stations?.length) return null;
    if (Date.now() - d.timestamp > GEO_CACHE_TTL) return null;
    return d;
  } catch { return null; }
}

function saveGeoCache(lat, lon, stations) {
  try {
    localStorage.setItem(GEO_CACHE_KEY, JSON.stringify({ lat, lon, stations, timestamp: Date.now() }));
  } catch { /* cache best-effort */ }
}

/* W38 — Mémorise la dernière position connue côté serveur (fire-and-forget).
   Le refresh quotidien (~7h) scanne les prix E85 dans 15 km autour. */
function saveLastGeoToServer(lat, lon) {
  try {
    fetch(GAS_URL, {
      method:  'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' }, // évite le preflight CORS
      body:    JSON.stringify({ action: 'saveLastGeo', lat, lon, token: APP_TOKEN }),
    }).catch(() => {});
  } catch { /* cache best-effort */ }
}

export function geolocate() {
  if (!navigator.geolocation) { setGeoStatus('err', 'Géolocalisation non disponible.'); return; }
  const btn = document.getElementById('geoBtn'); btn.classList.add('loading'); btn.textContent = '🔄';

  /* W31 — Pré-remplir depuis la dernière géoloc connue pendant l'actualisation */
  const cached = loadGeoCache();
  if (cached) {
    state._nearbyStations = cached.stations;
    renderNearby(cached.stations);
    renderComparateur(state._geoStations.length ? state._geoStations : cached.stations);
    setGeoStatus('info', '📍 Position mémorisée — mise à jour en cours…');
    document.getElementById('nearbyList').style.display = 'block';
  } else {
    setGeoStatus('info', 'Localisation en cours…');
    document.getElementById('nearbyList').style.display = 'none';
  }

  navigator.geolocation.getCurrentPosition(
    pos => {
      state.userLat = pos.coords.latitude; state.userLon = pos.coords.longitude;
      saveLastGeoToServer(state.userLat, state.userLon);   // W38 — alimente le scan 15 km du refresh 7h
      searchNearby(state.userLat, state.userLon, btn);
    },
    err => {
      btn.classList.remove('loading'); btn.textContent = '📍';
      const msgs = { 1: 'Accès refusé — autorisez dans Réglages.', 2: 'Position introuvable.', 3: 'Délai dépassé.' };
      setGeoStatus('err', msgs[err.code] || 'Erreur.');
    },
    { timeout: 10000, maximumAge: 60000 }
  );
}

export async function searchNearby(lat, lon, btn) {
  const cfg = FUEL_CONFIG[state.currentType];
  setGeoStatus('info', `Recherche des stations ${cfg.short} dans 8 km…`);
  try {
    const resp = await fetch(
      `https://data.economie.gouv.fr/api/explore/v2.1/catalog/datasets/prix-des-carburants-en-france-flux-instantane-v2/records?` +
      new URLSearchParams({
        where:  `${cfg.apiField} is not null and distance(geom, geom'POINT(${lon} ${lat})', 8000m)`,
        select: FUEL_SELECT,
        limit:  40
      })
    );
    if (!resp.ok) throw new Error('HTTP ' + resp.status);
    const data = await resp.json();
    btn.classList.remove('loading'); btn.textContent = '📍';
    if (!data.results?.length) { setGeoStatus('info', `Aucune station ${cfg.short} trouvée dans 8 km.`); return; }

    /* Tous les candidats triés par distance */
    const rawCandidates = data.results
      .filter(r => getCoords(r) && r[cfg.apiField] != null)
      .map(r => { const c = getCoords(r); return { r, lat: c.lat, lon: c.lon, dist: Math.round(haversine(lat, lon, c.lat, c.lon)) }; })
      .filter(c => c.dist <= 8000)
      .sort((a, b) => a.dist - b.dist);

    if (!rawCandidates.length) { setGeoStatus('info', `Aucune station ${cfg.short} trouvée dans 8 km.`); return; }

    /* Top 7 — enrichissement OSM + nearby list */
    const top7     = rawCandidates.slice(0, 7);
    const osmNames = await enrichWithOsmSerial(top7);
    if (!osmNames) return; // annulé par une recherche manuelle plus récente

    const knownNames = Array.from(document.querySelectorAll('#knownGroup option:not([value="__autre"])')).map(o => o.value.toLowerCase());

    const stations = top7.map((c, i) => {
      const rawName = osmNames[i] || stationLabel(c.r);
      const name    = composeStationName(rawName, c.r.ville);
      const prices  = {};
      FUEL_KEYS.forEach(k => { if (c.r[FUEL_CONFIG[k].apiField] != null) prices[k] = c.r[FUEL_CONFIG[k].apiField]; });
      return { name, sub: stationSubLabel(c.r), dist: c.dist, lat: c.lat, lon: c.lon, prices,
               known: knownNames.some(k => k.includes(rawName.toLowerCase()) || k.includes((c.r.ville||'').toLowerCase())) };
    });

    /* W30 — Toutes les stations pour le comparateur (noms API pour les 7+) */
    const allStations = rawCandidates.map((c, i) => {
      const rawName = i < 7 ? (osmNames[i] || stationLabel(c.r)) : stationLabel(c.r);
      const name    = composeStationName(rawName, c.r.ville);
      const prices  = {};
      FUEL_KEYS.forEach(k => { if (c.r[FUEL_CONFIG[k].apiField] != null) prices[k] = c.r[FUEL_CONFIG[k].apiField]; });
      return { name, sub: stationSubLabel(c.r), dist: c.dist, lat: c.lat, lon: c.lon, prices };
    });

    state._nearbyStations = stations;
    state._geoStations    = allStations;
    saveGeoCache(lat, lon, stations); // W31
    renderNearby(stations);
    renderComparateur(allStations);   // W30
    showMap(lat, lon, stations.map((s, i) => ({...s, src: 'nearby', srcIdx: i})));
    setGeoStatus('ok', stations.length + ' station(s) ' + cfg.short + ' trouvée(s)');
  } catch(e) {
    document.getElementById('geoBtn').classList.remove('loading'); document.getElementById('geoBtn').textContent = '📍';
    setGeoStatus('err', 'Erreur de recherche (' + e.message + ').');
  }
}

/* T2 : utilise data-nearby-idx au lieu de onclick inline */
export function renderNearby(stations) {
  const list = document.getElementById('nearbyList');
  if (!stations.length) { list.style.display = 'none'; return; }
  const cfg = FUEL_CONFIG[state.currentType];
  list.innerHTML = stations.map((s, i) => {
    const d = s.dist != null ? s.dist : null;
    const dist = d == null ? '' : d < 1000 ? d + ' m' : (d/1000).toFixed(1) + ' km';
    const mainPrice = s.prices ? s.prices[state.currentType] : null;
    const prix = mainPrice ? (dist ? ' · ' : '') + cfg.short + ' ' + parseFloat(mainPrice).toFixed(3) + ' €/L' : '';
    return '<div class="nearby-item" id="nearbyItem' + i + '">'
      + '<div class="nearby-main" data-nearby-idx="' + i + '">'
      + '<span class="nearby-name"><strong>' + escHtml(s.name) + '</strong></span>'
      + '<span class="nearby-sub">' + escHtml(s.sub) + '</span>'
      + '<span class="nearby-meta">' + dist + prix + (s.known ? ' <span class="nearby-badge">connue</span>' : '') + '</span>'
      + '</div><a class="nearby-map-btn" href="https://www.google.com/maps/search/?api=1&query=' + s.lat + ',' + s.lon + '" target="_blank" rel="noopener">🗺️</a></div>';
  }).join('');
  list.style.display = 'block';
}

/* W30 — Comparateur multi-stations trié par prix E85 */
export function renderComparateur(stations) {
  const card = document.getElementById('comparateurCard');
  if (!card) return;
  const withE85 = (stations || []).filter(s => s.prices?.E85);
  if (!withE85.length) { card.hidden = true; return; }

  const sorted = [...withE85].sort((a, b) => {
    const pa = parseFloat(a.prices.E85);
    const pb = parseFloat(b.prices.E85);
    return pa !== pb ? pa - pb : (a.dist || 0) - (b.dist || 0);
  });

  const rows = sorted.map((s, idx) => {
    const prix = parseFloat(s.prices.E85).toFixed(3);
    const dist = s.dist == null ? '—' : s.dist < 1000 ? s.dist + ' m' : (s.dist/1000).toFixed(1) + ' km';
    const best = idx === 0 ? ' class="comp-best"' : '';
    return `<tr${best}><td class="comp-name">${escHtml(s.name)}</td><td class="comp-prix">${prix} €/L</td><td class="comp-dist">${dist}</td></tr>`;
  }).join('');

  card.innerHTML = `<p class="section-title">🏆 Comparateur E85 (${sorted.length} station${sorted.length > 1 ? 's' : ''})</p>
    <table class="comp-table">
      <thead><tr><th>Station</th><th>E85 €/L</th><th>Dist.</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>`;
  card.hidden = false;
}

export function highlightNearbyItem(idx) {
  document.querySelectorAll('.nearby-item').forEach((el, i) => el.classList.toggle('selected', i === idx));
}

export function pickStation(name, lat, lon) {
  const sel = document.getElementById('stationSel');
  if (!Array.from(sel.options).map(o => o.value).includes(name))
    document.getElementById('knownGroup').appendChild(new Option(name, name));
  sel.value = name;
  document.getElementById('nearbyList').style.display = 'none';
  document.getElementById('autreField').classList.add('hidden');
  setGeoStatus('', '');
  cacheStationCoords(name, lat, lon);
  state._selectedLat = lat; state._selectedLon = lon;
  state._stationPrices = {}; _buildTypeToggle({}); _updateHeaderBadges();
  fetchPricesAtCoords(lat, lon, true);
}

/**
 * T2 — Délégation d'événements sur #nearbyList.
 * Remplace les onclick inline dans renderNearby().
 * Appelée une seule fois depuis main.js au démarrage.
 */
export function initNearbyList() {
  const list = document.getElementById('nearbyList');
  if (!list) return;
  list.addEventListener('click', e => {
    const main = e.target.closest('.nearby-main');
    if (!main) return;
    const idx = parseInt(main.dataset.nearbyIdx, 10);
    const s = state._nearbyStations[idx];
    if (!s) return;
    pickStation(s.name, s.lat, s.lon);
    highlightNearbyItem(idx);
  });
}
