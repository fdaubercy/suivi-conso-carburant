/* ─── Recherche manuelle par ville, code postal OU adresse (W63) ───
   Le champ accepte désormais une adresse complète. Le centre de recherche est
   résolu via la Base Adresse Nationale (gouv.fr) ; repli sur les coordonnées de
   la commune issues du dataset prix-carburants si la BAN est indisponible.
   La recherche des stations se fait dans le rayon choisi AUTOUR de ce point. */
import { PRIX_API, BAN_API, FUEL_CONFIG, FUEL_SELECT } from './config.js';
import { state } from './state.js';
import { haversine, getCoords, stationLabel, stationSubLabel, composeStationName, resolveEnseigne } from './utils.js';
import { setAutreStatus } from './ui.js';
import { enrichStationsBulk } from './osm.js';
import { showMap } from './carte.js';
import { renderNearby, updateNearbyName } from './geo.js';

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
  return /^\d{2,5}$/.test(q) ? `cp like '${q}%'` : `search(ville, '${q.replace(/'/g, "''")}')`;
}

/** Échappe une chaîne pour un littéral ODSQL (apostrophes doublées). */
function _sql(s) { return String(s).replace(/'/g, "''"); }

/**
 * Géocode une adresse / ville / code postal via la Base Adresse Nationale.
 * Renvoie { lat, lon, label, city, citycode, postcode, type } ou null.
 */
async function geocodeAddress(q) {
  try {
    const resp = await fetch(BAN_API + '?' + new URLSearchParams({ q, limit: '1', autocomplete: '0' }));
    if (!resp.ok) return null;
    const data = await resp.json();
    const f = data && data.features && data.features[0];
    const coords = f && f.geometry && f.geometry.coordinates;
    if (!coords) return null;
    const [lon, lat] = coords;
    if (!isFinite(lat) || !isFinite(lon)) return null;
    const p = f.properties || {};
    return {
      lat, lon,
      label:    p.label || q,
      city:     p.city || '',
      citycode: p.citycode || '',
      postcode: p.postcode || '',
      type:     p.type || '',
    };
  } catch { return null; }
}

/** Fabrique les stations affichables (distance calculée depuis `center`, à
 *  défaut depuis la position GPS connue). Trié par distance croissante. */
export function buildStations(results, center) {
  const ref = center || (state.userLat && state.userLon ? { lat: state.userLat, lon: state.userLon } : null);
  const knownNames = Array.from(document.querySelectorAll('#knownGroup option:not([value="__autre"])')).map(o => o.value.toLowerCase());
  return results.filter(r => getCoords(r)).map(r => {
    const c = getCoords(r);
    const dist = ref ? Math.round(haversine(ref.lat, ref.lon, c.lat, c.lon)) : null;
    const rawName = stationLabel(r);                       // conservé pour la détection "connue"
    const ville   = r.ville || '';
    const name    = composeStationName(resolveEnseigne(null, r.adresse), ville);
    const prices = {};
    Object.keys(FUEL_CONFIG).forEach(k => { if (r[FUEL_CONFIG[k].apiField] != null) prices[k] = r[FUEL_CONFIG[k].apiField]; });
    return { name, ville, adresse: r.adresse || '', sub: stationSubLabel(r), dist, lat: c.lat, lon: c.lon, prices,
             known: knownNames.some(k => k.includes(rawName.toLowerCase()) || k.includes(ville.toLowerCase())) };
  }).sort((a, b) => (a.dist ?? 99999) - (b.dist ?? 99999));
}

export async function searchStationSuggestions(q) {
  const cfg = FUEL_CONFIG[state.currentType];
  try {
    // ── Étape 1 : centre de recherche (BAN), repli dataset prix-carburants ──
    setAutreStatus('spin', 'Localisation de l’adresse…');
    let center = await geocodeAddress(q);
    let centerLabel;

    if (center) {
      centerLabel = center.label;
    } else {
      // Repli : coordonnées de la commune via le dataset prix.
      const searchClause = buildSearchClause(q);
      const respLoc = await fetch(PRIX_API + '?' + new URLSearchParams({
        where: `${searchClause} and ${cfg.apiField} is not null`, select: 'ville,geom', limit: 1
      }));
      if (!respLoc.ok) throw new Error('HTTP ' + respLoc.status);
      const dataLoc = await respLoc.json();
      if (!dataLoc.results?.length || !getCoords(dataLoc.results[0])) {
        setAutreStatus('err', 'Adresse ou commune introuvable. Précisez la ville.'); return;
      }
      const c = getCoords(dataLoc.results[0]);
      center = { lat: c.lat, lon: c.lon, city: (dataLoc.results[0].ville || q).trim(), label: (dataLoc.results[0].ville || q).trim() };
      centerLabel = center.label;
    }

    // ── Étape 2 : stations dans le rayon autour du centre (ou commune) ──
    const radiusLabel = state.searchRadiusM != null
      ? (state.searchRadiusM >= 1000 ? state.searchRadiusM/1000 + ' km' : state.searchRadiusM + ' m')
      : null;
    setAutreStatus('spin', radiusLabel
      ? `Stations ${cfg.short} dans ${radiusLabel} autour de ${centerLabel}…`
      : `Stations ${cfg.short} à ${centerLabel}…`);

    // Clause commune (pour "Ville seule" et le repli sans résultat dans le rayon).
    const cityClause = center.city ? `search(ville, '${_sql(center.city)}')` : buildSearchClause(q);
    const whereStep2 = state.searchRadiusM != null
      ? `${cfg.apiField} is not null and distance(geom, geom'POINT(${center.lon} ${center.lat})', ${state.searchRadiusM}m)`
      : `${cityClause} and ${cfg.apiField} is not null`;

    const resp = await fetch(PRIX_API + '?' + new URLSearchParams({ where: whereStep2, select: FUEL_SELECT, limit: 15 }));
    if (!resp.ok) throw new Error('HTTP ' + resp.status);
    const data = await resp.json();

    if (!data.results?.length || !buildStations(data.results, center).length) {
      setAutreStatus('info', 'Aucune station dans ce périmètre — affichage de la commune.');
      return searchStationsCityOnly(cityClause, centerLabel, center);
    }

    const stations = buildStations(data.results, center);
    const statusOk = () => setAutreStatus('ok', radiusLabel
      ? stations.length + ' station(s) ' + cfg.short + ' dans ' + radiusLabel + ' autour de ' + centerLabel
      : stations.length + ' station(s) ' + cfg.short + ' à ' + centerLabel);

    // Affichage immédiat (noms gouv.), puis enseignes OSM en arrière-plan.
    state._nearbyStations = stations;                 // pour le clic (sélection)
    statusOk();
    renderNearby(stations);
    showMap(center.lat, center.lon, stations.map((s, i) => ({...s, src: 'nearby', srcIdx: i})), state.searchRadiusM);

    enrichStationsBulk(stations,
      (i, osmName) => { stations[i].name = composeStationName(resolveEnseigne(osmName, stations[i].adresse), stations[i].ville); updateNearbyName(i, stations[i].name); },
      setAutreStatus
    ).then(ok => {
      if (!ok) return;                                // annulé (nouvelle recherche / station choisie)
      renderNearby(stations);
      showMap(center.lat, center.lon, stations.map((s, i) => ({...s, src: 'nearby', srcIdx: i})), state.searchRadiusM);
      statusOk();
    });
  } catch(e) {
    setAutreStatus('err', 'Erreur de recherche (' + e.message + ').');
    console.error('[Suggestions]', e);
  }
}

export async function searchStationsCityOnly(searchClause, cityName, center) {
  const cfg = FUEL_CONFIG[state.currentType];
  try {
    const resp = await fetch(PRIX_API + '?' + new URLSearchParams({
      where: `${searchClause} and ${cfg.apiField} is not null`, select: FUEL_SELECT, limit: 15
    }));
    if (!resp.ok) throw new Error('HTTP ' + resp.status);
    const data = await resp.json();
    if (!data.results?.length) { setAutreStatus('err', `Aucune station ${cfg.short} trouvée.`); return; }
    const stations = buildStations(data.results, center);
    if (!stations.length) { setAutreStatus('err', `Aucune station ${cfg.short} trouvée.`); return; }
    const statusOk = () => setAutreStatus('ok', stations.length + ' station(s) ' + cfg.short + ' à ' + cityName);

    // Affichage immédiat (noms gouv.), puis enseignes OSM en arrière-plan (idem suggestions).
    const mapLat = center ? center.lat : state.userLat;
    const mapLon = center ? center.lon : state.userLon;
    state._nearbyStations = stations;
    statusOk();
    renderNearby(stations);
    showMap(mapLat, mapLon, stations.map((s, i) => ({...s, src: 'nearby', srcIdx: i})));

    enrichStationsBulk(stations,
      (i, osmName) => { stations[i].name = composeStationName(resolveEnseigne(osmName, stations[i].adresse), stations[i].ville); updateNearbyName(i, stations[i].name); },
      setAutreStatus
    ).then(ok => {
      if (!ok) return;                                // annulé (nouvelle recherche / station choisie)
      renderNearby(stations);
      showMap(mapLat, mapLon, stations.map((s, i) => ({...s, src: 'nearby', srcIdx: i})));
      statusOk();
    });
  } catch(e) { setAutreStatus('err', 'Erreur (' + e.message + ').'); }
}
