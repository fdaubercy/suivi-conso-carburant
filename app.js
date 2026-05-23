/* ═══════════════════════════════════════
   Suivi Conso E85 — Logique applicative
   v1.9.9.0 — Nominatim reverse geocoding pour nom des stations
═══════════════════════════════════════ */

/* ─── Configuration ─── */
const APP_VERSION  = '1.9.9.0';
const GAS_URL      = 'https://script.google.com/macros/s/AKfycbzljFbh6Qcg9IadJ2yUePR56hpkSzrLsyuJLaxwB1qk7aoLcWzoHzH2btSbwV7tDeJGA/exec';
const GS_SHEET_ID  = '1uN170kt_n45sBRwqs2krTYfhapU3dMKjTguD-qSUqCE';
const PRIX_API     = 'https://data.economie.gouv.fr/api/explore/v2.1/catalog/datasets/prix-des-carburants-en-france-flux-instantane-v2/records';

/* ─── État global ─── */
let currentType   = 'E85';
let s98Autofilled = false;
let userLat = null, userLon = null;
let _nearbyStations = [];

/* ─── Init date ─── */
(function () {
  const t = new Date();
  document.getElementById('fDate').value =
    `${t.getFullYear()}-${String(t.getMonth()+1).padStart(2,'0')}-${String(t.getDate()).padStart(2,'0')}`;
  document.getElementById('s98Field').classList.remove('hidden');
})();

/* ═══════════════════════════════════════
   ENRICHISSEMENT — NOMINATIM REVERSE GEOCODING
   Requêtes séquentielles (1/s, CGU Nominatim).
   Retourne brand > name si type=fuel, sinon null.
═══════════════════════════════════════ */

const NOMINATIM_UA = 'suivi-e85/1.9.9 (https://fdaubercy.github.io/suivi-e85/)';
const NOMINATIM_DELAY = 1100; // ms entre requêtes (max 1 req/s)

/**
 * Interroge Nominatim pour UNE station.
 * Accepte le résultat uniquement si type/category = fuel.
 * @returns {Promise<string|null>} nom de la marque ou null
 */
async function fetchNominatimName(lat, lon) {
  const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}&extratags=1&zoom=18`;
  try {
    const resp = await fetch(url, {
      headers: { 'User-Agent': NOMINATIM_UA },
      signal: AbortSignal.timeout(5000)
    });
    if (!resp.ok) return null;
    const d = await resp.json();
    // N'accepter que si c'est bien une station essence OSM
    const isFuel = d.type === 'fuel'
      || d.category === 'amenity' && d.type === 'fuel'
      || d.extratags?.amenity === 'fuel';
    if (!isFuel) return null;
    return d.extratags?.brand || d.extratags?.operator || d.name || null;
  } catch (e) {
    console.warn('[Nominatim] Erreur :', e.message);
    return null;
  }
}

/**
 * Enrichit un tableau de stations via Nominatim en série.
 * Affiche la progression dans le statut géolocalisation.
 * @param {Array<{lat,lon}>} stations
 * @returns {Promise<Array<string|null>>}
 */
async function enrichWithNominatim(stations) {
  const names = [];
  for (let i = 0; i < stations.length; i++) {
    setGeoStatus('info', `Identification station ${i + 1}/${stations.length}…`);
    names.push(await fetchNominatimName(stations[i].lat, stations[i].lon));
    if (i < stations.length - 1) {
      await new Promise(r => setTimeout(r, NOMINATIM_DELAY));
    }
  }
  return names;
}

/**
 * Nom de fallback depuis les données gouvernementales :
 * adresse capitalisée > ville > 'Station service'
 */
function stationLabel(r) {
  if (r.adresse) {
    return r.adresse.trim()
      .toLowerCase()
      .replace(/\b(\w)/g, c => c.toUpperCase());
  }
  return r.ville ? r.ville.trim().toUpperCase() : 'Station service';
}

/* ═══════════════════════════════════════
   CARTE — Tuiles OSM, marqueurs cliquables
═══════════════════════════════════════ */

const TILE_SZ = 256;
let _mapStations = [];

function tileXY(lat, lon, z) {
  const n  = 1 << z;
  const lr = lat * Math.PI / 180;
  return {
    x: Math.floor((lon + 180) / 360 * n),
    y: Math.floor((1 - Math.log(Math.tan(lr) + 1 / Math.cos(lr)) / Math.PI) / 2 * n)
  };
}

function latLonToPx(lat, lon, z, ox, oy) {
  const n  = 1 << z;
  const lr = lat * Math.PI / 180;
  return {
    x: Math.round((lon + 180) / 360 * n * TILE_SZ - ox * TILE_SZ),
    y: Math.round((1 - Math.log(Math.tan(lr) + 1 / Math.cos(lr)) / Math.PI) / 2 * n * TILE_SZ - oy * TILE_SZ)
  };
}

function bestZoom(allLats, allLons, maxW, maxH) {
  for (let z = 15; z >= 10; z--) {
    const nw = tileXY(Math.max(...allLats), Math.min(...allLons), z);
    const se = tileXY(Math.min(...allLats), Math.max(...allLons), z);
    if ((se.x - nw.x + 1) * TILE_SZ <= maxW + TILE_SZ &&
        (se.y - nw.y + 1) * TILE_SZ <= maxH + TILE_SZ) return z;
  }
  return 10;
}

function showMap(uLat, uLon, stations) {
  _mapStations = stations.filter(s => s.lat && s.lon);
  if (!_mapStations.length) return;
  const wrap = document.getElementById('stationMapWrap');
  const wasHidden = wrap.classList.contains('hidden');
  wrap.classList.remove('hidden');
  if (wasHidden) {
    setTimeout(() => _renderMap(uLat, uLon), 0);
  } else {
    _renderMap(uLat, uLon);
  }
}

function _renderMap(uLat, uLon) {
  const container = document.getElementById('stationMap');
  const rect = container.getBoundingClientRect();
  const W = rect.width  || container.offsetWidth  || 360;
  const H = rect.height || container.offsetHeight || 220;
  const mg = 0.008;

  const allLats = _mapStations.map(s => s.lat);
  const allLons = _mapStations.map(s => s.lon);
  if (uLat) { allLats.push(uLat); allLons.push(uLon); }

  const z  = bestZoom(
    [Math.min(...allLats) - mg, Math.max(...allLats) + mg],
    [Math.min(...allLons) - mg, Math.max(...allLons) + mg],
    W, H
  );
  const nw = tileXY(Math.max(...allLats) + mg, Math.min(...allLons) - mg, z);
  const se = tileXY(Math.min(...allLats) - mg, Math.max(...allLons) + mg, z);

  const gridW = (se.x - nw.x + 1) * TILE_SZ;
  const gridH = (se.y - nw.y + 1) * TILE_SZ;
  const offX  = Math.round((W - gridW) / 2);
  const offY  = Math.round((H - gridH) / 2);

  let html = `<div style="position:absolute;left:${offX}px;top:${offY}px;width:${gridW}px;height:${gridH}px">`;

  for (let ty = nw.y; ty <= se.y; ty++) {
    for (let tx = nw.x; tx <= se.x; tx++) {
      const tileUrl = `https://tile.openstreetmap.org/${z}/${tx}/${ty}.png`;
      const px = (tx - nw.x) * TILE_SZ, py = (ty - nw.y) * TILE_SZ;
      html += `<img src="${tileUrl}" `
            + `style="position:absolute;left:${px}px;top:${py}px;width:${TILE_SZ}px;height:${TILE_SZ}px" `
            + `loading="lazy" onerror="this.style.background='#ddd'">`;
    }
  }

  _mapStations.forEach((s, i) => {
    const p     = latLonToPx(s.lat, s.lon, z, nw.x, nw.y);
    const label = escHtml(s.name);
    html += `<div id="mapPin${i}"
      onclick="selectStationFromMap(${i})"
      onmouseenter="showPinLabel(${i})"
      ontouchstart="showPinLabel(${i})"
      style="position:absolute;left:${p.x-12}px;top:${p.y-30}px;z-index:10;
             cursor:pointer;-webkit-tap-highlight-color:transparent">
      <div class="map-pin" id="mapPinDot${i}" style="background:#2E75B6">
        <span style="transform:rotate(45deg)">⛽</span>
      </div>
      <div class="map-pin-label" id="mapPinLbl${i}">${label}</div>
    </div>`;
  });

  if (uLat && uLon) {
    const p = latLonToPx(uLat, uLon, z, nw.x, nw.y);
    html += `<div style="position:absolute;left:${p.x-8}px;top:${p.y-8}px;z-index:11;pointer-events:none">
      <div style="width:16px;height:16px;background:#1D9E75;border-radius:50%;
        border:3px solid #fff;box-shadow:0 0 0 3px rgba(29,158,117,.35),0 2px 6px rgba(0,0,0,.3)"></div>
    </div>`;
  }

  html += '</div>';
  html += `<a href="https://www.openstreetmap.org" target="_blank" rel="noopener"
    style="position:absolute;bottom:3px;right:5px;background:rgba(255,255,255,.8);
    font-size:9px;padding:1px 5px;border-radius:3px;color:#555;text-decoration:none;z-index:20">© OSM</a>`;

  container.innerHTML = html;
}

function showPinLabel(idx) {
  const lbl = document.getElementById('mapPinLbl' + idx);
  if (!lbl) return;
  lbl.style.opacity = '1';
  clearTimeout(lbl._hideTimer);
  lbl._hideTimer = setTimeout(() => { lbl.style.opacity = ''; }, 2000);
}

function escHtml(str) {
  return String(str)
    .replace(/&/g,'&amp;').replace(/</g,'&lt;')
    .replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function selectStationFromMap(idx) {
  const s = _mapStations[idx];
  if (!s) return;

  _mapStations.forEach((_, i) => {
    const pin = document.getElementById('mapPinDot' + i);
    if (pin) pin.style.background = i === idx ? '#1B3A5C' : '#2E75B6';
  });
  showPinLabel(idx);
  pickStation(s.name, s.lat, s.lon);

  if (s.src === 'nearby') {
    highlightNearbyItem(s.srcIdx);
    document.getElementById('nearbyItem' + s.srcIdx)
      ?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  } else if (s.src === 'suggestion') {
    document.querySelectorAll('.suggestion-item').forEach((el, i) =>
      el.classList.toggle('selected', i === s.srcIdx));
    document.querySelectorAll('.suggestion-item')[s.srcIdx]
      ?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }
}

function hideMap() {
  document.getElementById('stationMapWrap').classList.add('hidden');
}

/* ─── Extraction coordonnées ─── */
function getCoords(r) {
  if (r.geom?.lat != null && r.geom?.lon != null) {
    return { lat: +r.geom.lat, lon: +r.geom.lon };
  }
  return null;
}



/* ─── Ligne d'adresse secondaire ─── */
function stationSubLabel(r) {
  const cap = s => s ? s.charAt(0).toUpperCase() + s.slice(1).toLowerCase() : '';
  const addr  = cap(r.adresse || '');
  const cp    = r.cp || '';
  const ville = r.ville ? r.ville.trim().toUpperCase() : '';
  return [addr, cp, ville].filter(Boolean).join(' · ');
}

/* ─── Type de carburant ─── */
function setType(type) {
  currentType = type;
  document.getElementById('btnE85').classList.toggle('active', type === 'E85');
  document.getElementById('btnS98').classList.toggle('active', type === 'S98');
  document.getElementById('headerBadge').textContent = type === 'E85' ? '🌿 E85' : '💧 S98';
  document.getElementById('s98Field').classList.toggle('hidden', type !== 'E85');
  document.getElementById('prixLabel').textContent = type === 'E85' ? 'Prix E85 (€/L)' : 'Prix S98 (€/L)';
  const fp = document.getElementById('fPrix');
  fp.value = ''; fp.classList.remove('autofilled');
  fp.placeholder = type === 'E85' ? '0.798' : '2.091';
  updateCout();
  const sel = document.getElementById('stationSel').value;
  if (sel && sel !== '__autre') fetchPricesNearUser();
}

/* ─── Coût du plein ─── */
function updateCout() {
  const l = parseFloat(document.getElementById('fLitres').value);
  const p = parseFloat(document.getElementById('fPrix').value);
  const box = document.getElementById('coutBox');
  if (!isNaN(l) && !isNaN(p) && l > 0 && p > 0) {
    box.style.display = 'flex';
    document.getElementById('coutVal').textContent = (l * p).toFixed(2) + ' €';
  } else {
    box.style.display = 'none';
  }
}

/* ─── Station (dropdown) ─── */
function onStationChange() {
  const sel = document.getElementById('stationSel');
  document.getElementById('autreField').classList.toggle('hidden', sel.value !== '__autre');
  if (sel.value && sel.value !== '__autre') fetchPricesNearUser();
}

/* ─── Saisie manuelle S98 ─── */
function onS98ManualEdit() {
  s98Autofilled = false;
  const el = document.getElementById('fPrixS98');
  el.classList.remove('autofilled');
  if (!el.value) el.placeholder = '2.091';
  document.getElementById('s98Status').className = 's98-status';
  document.getElementById('s98Status').textContent = '';
}

/* ═══════════════════════════════════════
   GÉOLOCALISATION
═══════════════════════════════════════ */

function geolocate() {
  if (!navigator.geolocation) { setGeoStatus('err', 'Géolocalisation non disponible.'); return; }
  const btn = document.getElementById('geoBtn');
  btn.classList.add('loading'); btn.textContent = '🔄';
  setGeoStatus('info', 'Localisation en cours…');
  document.getElementById('nearbyList').style.display = 'none';
  navigator.geolocation.getCurrentPosition(
    pos => {
      userLat = pos.coords.latitude;
      userLon = pos.coords.longitude;
      searchNearby(userLat, userLon, btn);
    },
    err => {
      btn.classList.remove('loading'); btn.textContent = '📍';
      const msgs = { 1: 'Accès refusé — autorisez dans Réglages.', 2: 'Position introuvable.', 3: 'Délai dépassé.' };
      setGeoStatus('err', msgs[err.code] || 'Erreur.');
    },
    { timeout: 10000, maximumAge: 60000 }
  );
}

async function searchNearby(lat, lon, btn) {
  setGeoStatus('info', 'Recherche des stations E85 dans 8 km…');
  try {
    // ① Requête API gouvernementale
    const resp = await fetch(odsUrl({
      where:  `e85_prix is not null and distance(geom, geom'POINT(${lon} ${lat})', 8000m)`,
      select: 'adresse,ville,cp,e85_prix,sp98_prix,geom,services',
      limit:  40
    }));
    if (!resp.ok) throw new Error('HTTP ' + resp.status);
    const data = await resp.json();

    console.log('[DEBUG] Résultats bruts géolocalisation (API Gouvernementale) :', data.results);

    btn.classList.remove('loading'); btn.textContent = '📍';

    if (!data.results?.length) {
      setGeoStatus('info', 'Aucune station E85 trouvée dans 8 km.');
      return;
    }

    // ② Construire les candidats (coordonnées + données brutes)
    const candidates = data.results
      .filter(r => getCoords(r) && r.e85_prix != null)
      .map(r => {
        const c    = getCoords(r);
        const dist = Math.round(haversine(lat, lon, c.lat, c.lon));
        return { r, lat: c.lat, lon: c.lon, dist };
      })
      .filter(c => c.dist <= 8000)
      .sort((a, b) => a.dist - b.dist)
      .slice(0, 7);

    if (!candidates.length) {
      setGeoStatus('info', 'Aucune station E85 trouvée dans 8 km.');
      return;
    }

    // ③ Enrichissement Nominatim en série (brand/operator OSM)
    const nominatimNames = await enrichWithNominatim(candidates);

    // ④ Tableau final enrichi
    const knownNames = Array.from(
      document.querySelectorAll('#knownGroup option:not([value="__autre"])')
    ).map(o => o.value.toLowerCase());

    const stations = candidates.map((c, i) => {
      const name  = nominatimNames[i] || stationLabel(c.r);
      const sub   = stationSubLabel(c.r);
      const known = knownNames.some(k => k.includes(name.toLowerCase()) || k.includes((c.r.ville || '').toLowerCase()));
      return { name, sub, dist: c.dist, lat: c.lat, lon: c.lon,
               e85: c.r.e85_prix, s98: c.r.sp98_prix, known };
    });

    _nearbyStations = stations;

    console.log('[DEBUG] Tableau enrichi (_nearbyStations) — OSM > sémantique :');
    console.table(_nearbyStations);

    renderNearby(stations);
    showMap(lat, lon, stations.map((s, i) => ({ ...s, src: 'nearby', srcIdx: i })));
    setGeoStatus('ok', stations.length + ' station(s) E85 trouvée(s)');
  } catch (e) {
    document.getElementById('geoBtn').classList.remove('loading');
    document.getElementById('geoBtn').textContent = '📍';
    setGeoStatus('err', 'Erreur de recherche (' + e.message + ').');
  }
}

function renderNearby(stations) {
  const list = document.getElementById('nearbyList');
  list.innerHTML = stations.map((s, i) => {
    const dist    = s.dist < 1000 ? s.dist + ' m' : (s.dist / 1000).toFixed(1) + ' km';
    const mapsUrl = 'https://www.google.com/maps/search/?api=1&query=' + s.lat + ',' + s.lon;
    const prix    = s.e85 ? ' · E85 ' + parseFloat(s.e85).toFixed(3) + ' €/L' : '';
    return '<div class="nearby-item" id="nearbyItem' + i + '">'
      + '<div class="nearby-main" onclick="pickStation(\'' + s.name.replace(/'/g, "\\'") + '\',' + s.lat + ',' + s.lon + '); highlightNearbyItem(' + i + ')">'
      + '<span class="nearby-name"><strong>' + escHtml(s.name) + '</strong></span>'
      + '<span class="nearby-sub">'  + escHtml(s.sub)  + '</span>'
      + '<span class="nearby-meta">' + dist + prix + (s.known ? ' <span class="nearby-badge">connue</span>' : '') + '</span>'
      + '</div>'
      + '<a class="nearby-map-btn" href="' + mapsUrl + '" target="_blank" rel="noopener" title="Voir sur la carte">🗺️</a>'
      + '</div>';
  }).join('');
  list.style.display = 'block';
}

function highlightNearbyItem(idx) {
  document.querySelectorAll('.nearby-item').forEach((el, i) =>
    el.classList.toggle('selected', i === idx));
}

function pickStation(name, lat, lon) {
  const sel = document.getElementById('stationSel');
  if (!Array.from(sel.options).map(o => o.value).includes(name))
    document.getElementById('knownGroup').appendChild(new Option(name, name));
  sel.value = name;
  document.getElementById('nearbyList').style.display = 'none';
  document.getElementById('autreField').classList.add('hidden');
  setGeoStatus('', '');
  fetchPricesAtCoords(lat, lon, true);
}

/* ─── SUGGESTIONS STATION MANUELLE ─── */

let _autreDebounce = null;

function onAutreInput() {
  const q = document.getElementById('fAutre').value.trim();
  clearTimeout(_autreDebounce);
  hideSuggestions();
  if (q.length < 3) { setSuggStatus('', ''); return; }
  setSuggStatus('spin', 'Recherche…');
  _autreDebounce = setTimeout(() => searchStationSuggestions(q), 500);
}

async function searchStationSuggestions(q) {
  try {
    // ① Requête API gouvernementale
    const resp = await fetch(odsUrl({
      where:  `ville like "${q}%" OR adresse like "${q}%" OR services like "%${q}%"`,
      select: 'adresse,ville,cp,e85_prix,sp98_prix,geom,services',
      limit:  15
    }));
    if (!resp.ok) throw new Error('HTTP ' + resp.status);
    const data = await resp.json();

    console.log('[DEBUG] Résultats bruts suggestions (API Gouvernementale) :', data.results);

    if (!data.results?.length) {
      setSuggStatus('', "Aucun résultat — vérifiez l'orthographe ou utilisez la géolocalisation.");
      return;
    }

    // ② Construire les suggestions (adresse comme nom, pas d'appel externe)
    const enrichedResults = data.results.map(r => ({
      ...r,
      _calculatedLabel: stationLabel(r)
    }));

    renderSuggestions(enrichedResults);
    setSuggStatus('', '');
  } catch (e) {
    setSuggStatus('', 'Erreur de recherche — saisie libre conservée.');
    console.error('[Suggestions]', e);
  }
}

function renderSuggestions(results) {
  const list = document.getElementById('suggList');
  list.innerHTML = results.map((r, i) => {
    const label = r._calculatedLabel;
    const sub   = stationSubLabel(r);
    const prix  = r.e85_prix ? 'E85 ' + parseFloat(r.e85_prix).toFixed(3) + ' €/L' : '';
    return '<div class="suggestion-item" onmousedown="pickSuggestion(' + i + ')">'
      + '<span class="suggestion-item-name">⛽ <strong>' + escHtml(label) + '</strong></span>'
      + '<span class="suggestion-item-addr">' + escHtml(sub) + (prix ? '  ·  ' + prix : '') + '</span>'
      + '</div>';
  }).join('');
  list._results = results;
  list.style.display = 'block';

  const stationsGeo = results.reduce((acc, r, origIdx) => {
    const c = getCoords(r);
    if (c) acc.push({ name: r._calculatedLabel, lat: c.lat, lon: c.lon, src: 'suggestion', srcIdx: origIdx });
    return acc;
  }, []);
  if (stationsGeo.length) showMap(userLat, userLon, stationsGeo);
}

function pickSuggestion(idx) {
  const list    = document.getElementById('suggList');
  const r       = list._results[idx];
  const oldName = document.getElementById('fAutre').value.trim();
  const newName = r._calculatedLabel;

  document.getElementById('fAutre').value = newName;
  hideSuggestions();
  setSuggStatus('', '');

  const sel = document.getElementById('stationSel');
  Array.from(sel.options).forEach(opt => {
    if (opt.value !== '__autre' && opt.value.toLowerCase() === oldName.toLowerCase()) {
      opt.value = newName; opt.text = newName;
    }
  });
  if (!Array.from(sel.options).some(o => o.value === newName)) {
    document.getElementById('knownGroup').insertBefore(
      new Option(newName, newName),
      document.querySelector('#knownGroup option[value="__autre"]')
    );
  }
  sel.value = '__autre';

  const gc = getCoords(r);
  if (gc) {
    showMap(userLat, userLon, [{ name: r._calculatedLabel, lat: gc.lat, lon: gc.lon, src: 'suggestion', srcIdx: idx }]);
    fetchPricesAtCoords(gc.lat, gc.lon, false);
  } else {
    fetchPricesNearUser();
  }
}

function hideSuggestions() {
  const list = document.getElementById('suggList');
  list.style.display = 'none';
  list.innerHTML = '';
  list._results = [];
}

function setSuggStatus(cls, msg) {
  const el = document.getElementById('suggStatus');
  el.className = 'suggestion-status ' + cls;
  el.textContent = msg;
}

function onAutreBlur() {
  setTimeout(() => {
    if (document.getElementById('suggList').style.display !== 'none') return;
    const q = document.getElementById('fAutre').value.trim();
    if (q) fetchPricesNearUser();
  }, 200);
}

/* ─── Helpers API ─── */
function odsUrl(params) {
  return PRIX_API + '?' + new URLSearchParams(params).toString();
}

function setFieldPrice(id, value, defaultPh) {
  const el = document.getElementById(id);
  const v  = value ? parseFloat(value) : 0;
  if (v > 0) {
    el.value       = v.toFixed(3);
    el.placeholder = defaultPh;
    el.classList.add('autofilled');
    setTimeout(() => el.classList.remove('autofilled'), 6000);
  } else {
    el.value       = '';
    el.placeholder = '--';
  }
}

function applyPricesResult(data) {
  const r     = data.results[0];
  const label = [r.adresse, r.ville].filter(Boolean).join(' · ');

  const mainVal = currentType === 'E85' ? r.e85_prix : r.sp98_prix;
  const mainPh  = currentType === 'E85' ? '0.798'    : '2.091';
  setFieldPrice('fPrix',    mainVal, mainPh);
  setFieldPrice('fPrixS98', r.sp98_prix, '2.091');
  s98Autofilled = !!(r.sp98_prix);
  updateCout();

  const found = [];
  if (currentType === 'E85' && r.e85_prix) found.push('E85 : ' + parseFloat(r.e85_prix).toFixed(3) + ' €/L');
  if (r.sp98_prix) found.push('SP98 : ' + parseFloat(r.sp98_prix).toFixed(3) + ' €/L');
  if (found.length) {
    setS98Status('ok', found.join(' · ') + (label ? ' — ' + label : ''));
  } else {
    setS98Status('info', 'Aucun prix trouvé — code postal :');
    showCpSearch();
  }
}

async function fetchPricesAtCoords(lat, lon, fallbackToUser = false) {
  setS98Status('spin', 'Recherche des prix…');
  hideCpSearch();

  for (const r of [500, 2000, 5000]) {
    try {
      const resp = await fetch(odsUrl({
        where:  `(e85_prix is not null or sp98_prix is not null) and distance(geom, geom'POINT(${lon} ${lat})', ${r}m)`,
        select: 'e85_prix,sp98_prix,adresse,ville,services',
        limit:  1
      }));
      if (!resp.ok) throw new Error('HTTP ' + resp.status);
      const data = await resp.json();
      if (data.results?.length) { applyPricesResult(data); return; }
    } catch (e) {
      console.error('[PRIX] fetchAtCoords r=' + r, e);
      setS98Status('err', 'Erreur API (' + e.message + ') — saisie manuelle.');
      return;
    }
  }

  if (fallbackToUser && userLat && userLon && haversine(lat, lon, userLat, userLon) > 100) {
    await fetchPricesAtCoords(userLat, userLon, false);
  } else {
    setFieldPrice('fPrix',    null, currentType === 'E85' ? '0.798' : '2.091');
    setFieldPrice('fPrixS98', null, '2.091');
    updateCout();
    setS98Status('info', 'Prix non trouvés — entrez le code postal :');
    showCpSearch();
  }
}

async function fetchPricesNearUser() {
  if (userLat && userLon) {
    await fetchPricesAtCoords(userLat, userLon, false);
  } else {
    setS98Status('info', 'Position inconnue — entrez le code postal :');
    showCpSearch();
  }
}

async function fetchPricesByCP() {
  const cp = document.getElementById('fCp').value.trim();
  if (cp.length !== 5) { setS98Status('err', 'Code postal invalide (5 chiffres requis).'); return; }
  setS98Status('spin', 'Recherche dans ' + cp + '…');
  try {
    const resp = await fetch(odsUrl({
      where:  `(e85_prix is not null OR sp98_prix is not null) AND cp="${cp}"`,
      select: 'e85_prix,sp98_prix,adresse,ville,services',
      limit:  1
    }));
    if (!resp.ok) throw new Error('HTTP ' + resp.status);
    const data = await resp.json();
    if (data.results?.length) { hideCpSearch(); applyPricesResult(data); }
    else setS98Status('info', 'Aucune station trouvée pour ' + cp + ' — saisie manuelle.');
  } catch (e) {
    setS98Status('err', 'Erreur (' + e.message + ') — saisie manuelle.');
  }
}

function showCpSearch() { document.getElementById('cpSearch').classList.remove('hidden'); document.getElementById('fCp').focus(); }
function hideCpSearch()  { document.getElementById('cpSearch').classList.add('hidden');   document.getElementById('fCp').value = ''; }

function setS98Status(cls, msg) {
  const el = document.getElementById('s98Status');
  el.className   = 's98-status ' + cls;
  el.textContent = msg;
}

function setGeoStatus(cls, msg) {
  const el = document.getElementById('geoStatus');
  el.className = 'geo-status ' + cls;
  el.textContent = msg;
}

function haversine(lat1, lon1, lat2, lon2) {
  const R = 6371000, dLat = (lat2-lat1)*Math.PI/180, dLon = (lon2-lon1)*Math.PI/180;
  const a = Math.sin(dLat/2)**2 + Math.cos(lat1*Math.PI/180)*Math.cos(lat2*Math.PI/180)*Math.sin(dLon/2)**2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
}

async function submitForm() {
  const date    = document.getElementById('fDate').value;
  const km      = document.getElementById('fKm').value.trim();
  const litres  = document.getElementById('fLitres').value.trim();
  const prix    = document.getElementById('fPrix').value.trim();
  const prixS98 = document.getElementById('fPrixS98').value.trim();
  let station   = document.getElementById('stationSel').value;
  if (station === '__autre') station = document.getElementById('fAutre').value.trim();

  if (!date || !km || !litres || !prix) {
    showFeedback('error', 'Champs manquants', 'Date, km, litres et prix sont obligatoires.'); return;
  }
  if (!station) {
    showFeedback('error', 'Station manquante', 'Sélectionnez ou saisissez le nom de la station.'); return;
  }
  if (currentType === 'E85' && !prixS98)
    if (!confirm('Prix S98 du jour non saisi. Continuer quand même ?')) return;

  setSubmitState(true);
  try {
    const body = JSON.stringify({ date, type: currentType === 'E85' ? 'SuperEthanol E85' : 'Super 98', km, litres, prix, prixS98, station });
    const json = await fetch(GAS_URL, { method: 'POST', body, redirect: 'follow' }).then(r => r.json());
    if (json.success) {
      showFeedback('success', 'Plein enregistré ✓', json.message || litres + ' L à ' + prix + ' €/L — ' + station);
      await syncStationSiNouvelle(station);
      resetForm();
    } else {
      showFeedback('error', 'Erreur serveur', json.error || 'Veuillez réessayer.');
    }
  } catch (e) {
    showFeedback('error', 'Connexion impossible', 'Vérifiez votre accès internet.');
  } finally {
    setSubmitState(false);
  }
}

function setSubmitState(loading) {
  document.getElementById('submitBtn').disabled     = loading;
  document.getElementById('submitIcon').textContent = loading ? '⏳' : '✓';
  document.getElementById('submitText').textContent = loading ? 'Enregistrement…' : 'Enregistrer le plein';
}

function showFeedback(type, title, msg) {
  const el = document.getElementById('feedback');
  el.className = 'feedback ' + type;
  el.innerHTML = '<strong>' + title + '</strong>' + msg;
  el.style.display = 'block';
  el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  if (type === 'success') setTimeout(() => el.style.display = 'none', 5000);
}

function resetForm() {
  const n = new Date();
  document.getElementById('fDate').value = n.getFullYear() + '-' + String(n.getMonth()+1).padStart(2,'0') + '-' + String(n.getDate()).padStart(2,'0');
  ['fKm','fLitres','fAutre'].forEach(id => document.getElementById(id).value = '');
  const fp = document.getElementById('fPrix');
  fp.value = ''; fp.placeholder = currentType === 'E85' ? '0.798' : '2.091';
  fp.classList.remove('autofilled');
  const fs = document.getElementById('fPrixS98');
  fs.value = ''; fs.placeholder = '2.091';
  fs.classList.remove('autofilled');
  document.getElementById('stationSel').value = '';
  document.getElementById('coutBox').style.display = 'none';
  document.getElementById('nearbyList').style.display = 'none';
  document.getElementById('autreField').classList.add('hidden');
  document.getElementById('s98Status').className = 's98-status';
  document.getElementById('s98Status').textContent = '';
  hideSuggestions();
  setSuggStatus('', '');
  hideCpSearch();
  s98Autofilled = false;
}

async function syncStationSiNouvelle(nom) {
  if (!nom) return;
  const group   = document.getElementById('knownGroup');
  const options = Array.from(group.querySelectorAll('option'))
    .map(o => o.value.toLowerCase())
    .filter(v => v !== '__autre');
  if (options.includes(nom.toLowerCase())) return;
  try {
    await fetch(GAS_URL, {
      method: 'POST', redirect: 'follow',
      body:   JSON.stringify({ action: 'addStation', station: nom })
    });
    const autreOpt = group.querySelector('[value="__autre"]');
    group.insertBefore(new Option(nom, nom), autreOpt);
  } catch (e) {
    console.warn('[Stations] Sync échouée :', e.message);
  }
}

async function chargerStations() {
  const url = 'https://docs.google.com/spreadsheets/d/' + GS_SHEET_ID + '/gviz/tq?tqx=out:csv&sheet=Stations';
  try {
    const resp = await fetch(url);
    if (!resp.ok) throw new Error('HTTP ' + resp.status);
    const csv  = await resp.text();
    const lignes = csv.split('\n').map(l => l.trim().replace(/^"|"$/g, ''));
    const stations = lignes.slice(1).filter(s => s && s !== '__autre');
    const group = document.getElementById('knownGroup');
    Array.from(group.querySelectorAll('option:not([value="__autre"])')).forEach(o => o.remove());
    const autreOpt = group.querySelector('[value="__autre"]');
    stations.forEach(nom => group.insertBefore(new Option(nom, nom), autreOpt));
  } catch(e) {
    console.warn('Chargement stations échoué :', e.message);
    ['Carrefour Flers','Intermarché','Leclerc Douai','Total Access','Total Waziers',
     'ZONE DU MOULIN RUE ARTHUR LAMENDIN — Beuvry'].forEach(nom => {
      const group = document.getElementById('knownGroup');
      group.insertBefore(new Option(nom, nom), group.querySelector('[value="__autre"]'));
    });
  }
}

chargerStations();
document.getElementById('appVersion').textContent = 'v' + APP_VERSION;
