/* ─── Géolocalisation + liste stations proches ─── */
import { FUEL_CONFIG, FUEL_KEYS, FUEL_SELECT } from './config.js';
import { state } from './state.js';
import { haversine, escHtml, getCoords, stationLabel, stationSubLabel } from './utils.js';
import { setGeoStatus } from './ui.js';
import { enrichWithOsmSerial } from './osm.js';
import { showMap } from './carte.js';
import { _buildTypeToggle, _updateHeaderBadges } from './carburant.js';
import { fetchPricesAtCoords } from './prix.js';

export function geolocate() {
  if (!navigator.geolocation) { setGeoStatus('err', 'Géolocalisation non disponible.'); return; }
  const btn = document.getElementById('geoBtn'); btn.classList.add('loading'); btn.textContent = '🔄';
  setGeoStatus('info', 'Localisation en cours…'); document.getElementById('nearbyList').style.display = 'none';
  navigator.geolocation.getCurrentPosition(
    pos => { state.userLat = pos.coords.latitude; state.userLon = pos.coords.longitude; searchNearby(state.userLat, state.userLon, btn); },
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
    const candidates = data.results
      .filter(r => getCoords(r) && r[cfg.apiField] != null)
      .map(r => { const c = getCoords(r); return { r, lat: c.lat, lon: c.lon, dist: Math.round(haversine(lat, lon, c.lat, c.lon)) }; })
      .filter(c => c.dist <= 8000).sort((a, b) => a.dist - b.dist).slice(0, 7);
    if (!candidates.length) { setGeoStatus('info', `Aucune station ${cfg.short} trouvée dans 8 km.`); return; }
    const osmNames   = await enrichWithOsmSerial(candidates);
    if (!osmNames) return; // annulé par une recherche manuelle plus récente
    const knownNames = Array.from(document.querySelectorAll('#knownGroup option:not([value="__autre"])')).map(o => o.value.toLowerCase());
    const stations   = candidates.map((c, i) => {
      const name = osmNames[i] || stationLabel(c.r);
      const prices = {};
      FUEL_KEYS.forEach(k => { if (c.r[FUEL_CONFIG[k].apiField] != null) prices[k] = c.r[FUEL_CONFIG[k].apiField]; });
      return { name, sub: stationSubLabel(c.r), dist: c.dist, lat: c.lat, lon: c.lon, prices,
               known: knownNames.some(k => k.includes(name.toLowerCase()) || k.includes((c.r.ville||'').toLowerCase())) };
    });
    state._nearbyStations = stations;
    renderNearby(stations);
    showMap(lat, lon, stations.map((s, i) => ({...s, src: 'nearby', srcIdx: i})));
    setGeoStatus('ok', stations.length + ' station(s) ' + cfg.short + ' trouvée(s)');
  } catch(e) {
    document.getElementById('geoBtn').classList.remove('loading'); document.getElementById('geoBtn').textContent = '📍';
    setGeoStatus('err', 'Erreur de recherche (' + e.message + ').');
  }
}

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
      + '<div class="nearby-main" onclick="pickStation(\'' + s.name.replace(/'/g, "\\'") + '\',' + s.lat + ',' + s.lon + ');highlightNearbyItem(' + i + ')">'
      + '<span class="nearby-name"><strong>' + escHtml(s.name) + '</strong></span>'
      + '<span class="nearby-sub">' + escHtml(s.sub) + '</span>'
      + '<span class="nearby-meta">' + dist + prix + (s.known ? ' <span class="nearby-badge">connue</span>' : '') + '</span>'
      + '</div><a class="nearby-map-btn" href="https://www.google.com/maps/search/?api=1&query=' + s.lat + ',' + s.lon + '" target="_blank" rel="noopener">🗺️</a></div>';
  }).join('');
  list.style.display = 'block';
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
  state._selectedLat = lat; state._selectedLon = lon;
  state._stationPrices = {}; _buildTypeToggle({}); _updateHeaderBadges();
  fetchPricesAtCoords(lat, lon, true);
}
