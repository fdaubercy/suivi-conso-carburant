/* ─── Recherche manuelle par ville ─── */
import { PRIX_API, FUEL_CONFIG, FUEL_SELECT } from './config.js';
import { state } from './state.js';
import { haversine, getCoords, stationLabel, stationSubLabel, composeStationName } from './utils.js';
import { setAutreStatus } from './ui.js';
import { enrichWithOsmSerial } from './osm.js';
import { showMap } from './carte.js';
import { renderNearby } from './geo.js';

let _autreDebounce = null;

export function setRadius(btn, metres) {
  state.searchRadiusM = metres;
  document.querySelectorAll('.radius-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  const q = document.getElementById('fAutre').value.trim();
  if (q.length >= 3) {
    setAutreStatus('spin', 'Recherche…');
    clearTimeout(_autreDebounce);
    _autreDebounce = setTimeout(() => searchStationSuggestions(q), 200);
  }
}

export function onAutreInput() {
  const q = document.getElementById('fAutre').value.trim();
  clearTimeout(_autreDebounce);
  document.getElementById('nearbyList').style.display = 'none';
  if (q.length < 3) { setAutreStatus('', ''); return; }
  setAutreStatus('spin', 'Recherche…');
  _autreDebounce = setTimeout(() => searchStationSuggestions(q), 500);
}

export function buildSearchClause(q) {
  return /^\d{2,5}$/.test(q) ? `cp like '${q}%'` : `search(ville, '${q}')`;
}

export function buildStations(results) {
  const knownNames = Array.from(document.querySelectorAll('#knownGroup option:not([value="__autre"])')).map(o => o.value.toLowerCase());
  return results.filter(r => getCoords(r)).map(r => {
    const c = getCoords(r);
    const dist = (state.userLat && state.userLon) ? Math.round(haversine(state.userLat, state.userLon, c.lat, c.lon)) : null;
    const rawName = stationLabel(r);
    const ville   = r.ville || '';
    const name    = composeStationName(rawName, ville);
    const prices = {};
    Object.keys(FUEL_CONFIG).forEach(k => { if (r[FUEL_CONFIG[k].apiField] != null) prices[k] = r[FUEL_CONFIG[k].apiField]; });
    return { name, ville, sub: stationSubLabel(r), dist, lat: c.lat, lon: c.lon, prices,
             known: knownNames.some(k => k.includes(rawName.toLowerCase()) || k.includes(ville.toLowerCase())) };
  }).sort((a, b) => (a.dist ?? 99999) - (b.dist ?? 99999));
}

export async function searchStationSuggestions(q) {
  const cfg = FUEL_CONFIG[state.currentType];
  try {
    const searchClause = buildSearchClause(q);

    // Étape 1 : coordonnées de la commune
    setAutreStatus('spin', 'Localisation de la commune…');
    const respLoc = await fetch(PRIX_API + '?' + new URLSearchParams({
      where: `${searchClause} and ${cfg.apiField} is not null`, select: 'ville,geom', limit: 1
    }));
    if (!respLoc.ok) throw new Error('HTTP ' + respLoc.status);
    const dataLoc = await respLoc.json();
    if (!dataLoc.results?.length || !getCoords(dataLoc.results[0])) {
      setAutreStatus('err', `Aucune commune ${cfg.short} trouvée avec ce nom.`); return;
    }
    const cityCoords = getCoords(dataLoc.results[0]);
    const cityName   = (dataLoc.results[0].ville || q).trim();

    // Étape 2 : stations dans le rayon
    const radiusLabel = state.searchRadiusM != null
      ? (state.searchRadiusM >= 1000 ? state.searchRadiusM/1000 + ' km' : state.searchRadiusM + ' m')
      : null;
    setAutreStatus('spin', radiusLabel ? `Stations dans ${radiusLabel} autour de ${cityName}…` : `Stations à ${cityName}…`);

    const proximityClause = state.searchRadiusM != null
      ? ` and distance(geom, geom'POINT(${cityCoords.lon} ${cityCoords.lat})', ${state.searchRadiusM}m)`
      : '';
    const whereStep2 = state.searchRadiusM != null
      ? `${cfg.apiField} is not null${proximityClause}`
      : `${searchClause} and ${cfg.apiField} is not null`;

    const resp = await fetch(PRIX_API + '?' + new URLSearchParams({ where: whereStep2, select: FUEL_SELECT, limit: 15 }));
    if (!resp.ok) throw new Error('HTTP ' + resp.status);
    const data = await resp.json();

    if (!data.results?.length || !buildStations(data.results).length) {
      setAutreStatus('info', 'Aucune station dans ce périmètre — affichage de la ville.');
      return searchStationsCityOnly(searchClause, cityName);
    }

    const stations = buildStations(data.results);
    const osmNames = await enrichWithOsmSerial(stations, setAutreStatus);
    if (!osmNames) return; // annulé par une recherche plus récente
    const stationsFinal = stations.map((s, i) => ({ ...s, name: composeStationName(osmNames[i] || s.name.split(' - ')[0], s.ville) }));
    setAutreStatus('ok', radiusLabel
      ? stationsFinal.length + ' station(s) ' + cfg.short + ' dans ' + radiusLabel + ' autour de ' + cityName
      : stationsFinal.length + ' station(s) ' + cfg.short + ' à ' + cityName);
    renderNearby(stationsFinal);
    showMap(state.userLat, state.userLon, stationsFinal.map((s, i) => ({...s, src: 'nearby', srcIdx: i})));
  } catch(e) {
    setAutreStatus('err', 'Erreur de recherche (' + e.message + ').');
    console.error('[Suggestions]', e);
  }
}

export async function searchStationsCityOnly(searchClause, cityName) {
  const cfg = FUEL_CONFIG[state.currentType];
  try {
    const resp = await fetch(PRIX_API + '?' + new URLSearchParams({
      where: `${searchClause} and ${cfg.apiField} is not null`, select: FUEL_SELECT, limit: 15
    }));
    if (!resp.ok) throw new Error('HTTP ' + resp.status);
    const data = await resp.json();
    if (!data.results?.length) { setAutreStatus('err', `Aucune station ${cfg.short} trouvée.`); return; }
    const stations = buildStations(data.results);
    if (!stations.length) { setAutreStatus('err', `Aucune station ${cfg.short} trouvée.`); return; }
    const osmNames = await enrichWithOsmSerial(stations, setAutreStatus);
    if (!osmNames) return; // annulé par une recherche plus récente
    const stationsFinal = stations.map((s, i) => ({ ...s, name: composeStationName(osmNames[i] || s.name.split(' - ')[0], s.ville) }));
    setAutreStatus('ok', stationsFinal.length + ' station(s) ' + cfg.short + ' à ' + cityName);
    renderNearby(stationsFinal);
    showMap(state.userLat, state.userLon, stationsFinal.map((s, i) => ({...s, src: 'nearby', srcIdx: i})));
  } catch(e) { setAutreStatus('err', 'Erreur (' + e.message + ').'); }
}
