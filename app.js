/* ═══════════════════════════════════════
   Suivi Conso E85 — Logique applicative
   v1.7 — carte OSM iframe, sans Leaflet
═══════════════════════════════════════ */

const GAS_URL  = 'https://script.google.com/macros/s/AKfycbzljFbh6QcgQ9IadJ2yUePR56hpkSzrLsyuJLaxwB1qk7aoLcWzoHzH2btSbwV7tDeJGA/exec';
const PRIX_API = 'https://data.economie.gouv.fr/api/explore/v2.1/catalog/datasets/prix-des-carburants-en-france-flux-instantane-v2/records';

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
   CARTE — Tuiles OSM, marqueurs cliquables
   (moteur maison, zéro dépendance externe)
═══════════════════════════════════════ */

const TILE_SZ = 256;
let _mapStations = [];   // stations actuellement sur la carte

/** Convertit lat/lon → numéro de tuile OSM */
function tileXY(lat, lon, z) {
  const n  = 1 << z;
  const lr = lat * Math.PI / 180;
  return {
    x: Math.floor((lon + 180) / 360 * n),
    y: Math.floor((1 - Math.log(Math.tan(lr) + 1 / Math.cos(lr)) / Math.PI) / 2 * n)
  };
}

/** Convertit lat/lon → position pixel dans la grille de tuiles */
function latLonToPx(lat, lon, z, ox, oy) {
  const n  = 1 << z;
  const lr = lat * Math.PI / 180;
  return {
    x: Math.round((lon + 180) / 360 * n * TILE_SZ - ox * TILE_SZ),
    y: Math.round((1 - Math.log(Math.tan(lr) + 1 / Math.cos(lr)) / Math.PI) / 2 * n * TILE_SZ - oy * TILE_SZ)
  };
}

/** Choisit le zoom pour que les stations tiennent dans le container */
function bestZoom(allLats, allLons, maxW, maxH) {
  for (let z = 15; z >= 10; z--) {
    const nw = tileXY(Math.max(...allLats), Math.min(...allLons), z);
    const se = tileXY(Math.min(...allLats), Math.max(...allLons), z);
    if ((se.x - nw.x + 1) * TILE_SZ <= maxW + TILE_SZ &&
        (se.y - nw.y + 1) * TILE_SZ <= maxH + TILE_SZ) return z;
  }
  return 10;
}

/** Affiche la carte avec marqueurs cliquables.
 *  stations[] : { name, lat, lon, src:'nearby'|'suggestion', srcIdx:number } */
function showMap(uLat, uLon, stations) {
  _mapStations = stations.filter(s => s.lat && s.lon);
  if (!_mapStations.length) return;
  document.getElementById('stationMapWrap').classList.remove('hidden');
  // Attendre un frame pour que le container soit rendu
  requestAnimationFrame(() => _renderMap(uLat, uLon));
}

function _renderMap(uLat, uLon) {
  const container = document.getElementById('stationMap');
  const W = container.offsetWidth  || 320;
  const H = container.offsetHeight || 220;
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
  // Centre la grille dans le container
  const offX  = Math.round((W - gridW) / 2);
  const offY  = Math.round((H - gridH) / 2);

  let html = `<div style="position:absolute;left:${offX}px;top:${offY}px;width:${gridW}px;height:${gridH}px">`;

  // ── Tuiles ──
  for (let ty = nw.y; ty <= se.y; ty++) {
    for (let tx = nw.x; tx <= se.x; tx++) {
      const px = (tx - nw.x) * TILE_SZ, py = (ty - nw.y) * TILE_SZ;
      html += `<img src="https://tile.openstreetmap.org/${z}/${tx}/${ty}.png" `
            + `style="position:absolute;left:${px}px;top:${py}px;width:${TILE_SZ}px;height:${TILE_SZ}px" `
            + `loading="lazy" onerror="this.style.background='#ddd'">`;
    }
  }

  // ── Marqueurs stations ──
  _mapStations.forEach((s, i) => {
    const p = latLonToPx(s.lat, s.lon, z, nw.x, nw.y);
    html += `<div id="mapPin${i}" onclick="selectStationFromMap(${i})"
      style="position:absolute;left:${p.x-12}px;top:${p.y-30}px;z-index:10;cursor:pointer;-webkit-tap-highlight-color:transparent">
      <div class="map-pin" style="background:#2E75B6">
        <span style="transform:rotate(45deg)">⛽</span>
      </div>
      <div class="map-pin-label">${s.name}</div>
    </div>`;
  });

  // ── Position utilisateur ──
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

/** Sélection d'une station depuis la carte */
function selectStationFromMap(idx) {
  const s = _mapStations[idx];
  if (!s) return;

  // Surligne le marqueur sélectionné
  _mapStations.forEach((_, i) => {
    const pin = document.querySelector(`#mapPin${i} .map-pin`);
    if (pin) pin.style.background = i === idx ? '#1B3A5C' : '#2E75B6';
  });

  pickStation(s.name, s.lat, s.lon);

  // Surligne la ligne correspondante dans la liste
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

/* ─── Nom lisible d'une station depuis l'API ─── */
function stationLabel(r) {
  const cap = s => s ? s.charAt(0).toUpperCase() + s.slice(1).toLowerCase() : '';
  if (r.ville) return cap(r.ville);
  return cap(r.adresse || 'Station inconnue');
}

/* ─── Sous-titre lisible (adresse courte) ─── */
function stationSubLabel(r) {
  const cap = s => s ? s.charAt(0).toUpperCase() + s.slice(1).toLowerCase() : '';
  const addr = cap(r.adresse || '');
  const cp   = r.cp || '';
  if (addr && cp) return addr + ' · ' + cp;
  return addr || cp;
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
      const msgs = { 1: 'Accès refusé — autorisez dans Réglages > Safari.', 2: 'Position introuvable.', 3: 'Délai dépassé.' };
      setGeoStatus('err', msgs[err.code] || 'Erreur.');
    },
    { timeout: 10000, maximumAge: 60000 }
  );
}

async function searchNearby(lat, lon, btn) {
  setGeoStatus('info', 'Recherche des stations E85 dans 6 km…');
  try {
    const params = new URLSearchParams({
      'geofilter.distance': lat + ',' + lon + ',6000',
      where:  'e85_prix is not null',
      select: 'adresse,ville,cp,e85_prix,sp98_prix,geom',
      limit:  10
    });
    const resp = await fetch(PRIX_API + '?' + params.toString());
    if (!resp.ok) throw new Error('HTTP ' + resp.status);
    const data = await resp.json();

    btn.classList.remove('loading'); btn.textContent = '📍';

    if (!data.results?.length) {
      setGeoStatus('info', 'Aucune station E85 trouvée dans 6 km.');
      return;
    }

    const knownNames = Array.from(
      document.querySelectorAll('#knownGroup option:not([value="__autre"])')
    ).map(o => o.value.toLowerCase());

    const stations = data.results
      .filter(r => r.geom?.lat != null && r.geom?.lon != null)
      .map(r => {
        const sLat = r.geom.lat, sLon = r.geom.lon;
        const d    = haversine(lat, lon, sLat, sLon);
        const name = stationLabel(r);
        const sub  = stationSubLabel(r);
        const known = knownNames.some(k => k.includes((r.ville || '').toLowerCase()));
        return { name, sub, dist: Math.round(d), lat: sLat, lon: sLon,
                 e85: r.e85_prix, s98: r.sp98_prix, known };
      })
      .filter(s => s.dist <= 6000)      // filtre strict 6 km côté client
      .sort((a, b) => a.dist - b.dist)
      .slice(0, 7);

    _nearbyStations = stations;
    renderNearby(stations);
    showMap(lat, lon, stations.map((s, i) => ({ ...s, src: 'nearby', srcIdx: i })));
    setGeoStatus('ok', stations.length + ' station(s) E85 trouvée(s)');
  } catch (e) {
    btn.classList.remove('loading'); btn.textContent = '📍';
    setGeoStatus('err', 'Erreur de recherche (' + e.message + ').');
  }
}

function renderNearby(stations) {
  const list = document.getElementById('nearbyList');
  list.innerHTML = stations.map((s, i) => {
    const dist    = s.dist < 1000 ? s.dist + ' m' : (s.dist / 1000).toFixed(1) + ' km';
    const mapsUrl = 'https://maps.google.com/?q=' + s.lat + ',' + s.lon;
    const prix    = s.e85 ? ' · E85 ' + parseFloat(s.e85).toFixed(3) + ' €/L' : '';
    return '<div class="nearby-item" id="nearbyItem' + i + '">'
      + '<div class="nearby-main" onclick="pickStation(\'' + s.name.replace(/'/g, "\\'") + '\',' + s.lat + ',' + s.lon + '); highlightNearbyItem(' + i + ')">'
      + '<span class="nearby-name">' + s.name + '</span>'
      + '<span class="nearby-sub">' + s.sub + '</span>'
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

/* ═══════════════════════════════════════
   SUGGESTIONS STATION MANUELLE
═══════════════════════════════════════ */

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
    const resp = await fetch(odsUrl({
      where:    'search(adresse, "' + q + '") OR search(ville, "' + q + '")',
      select:   'id,adresse,ville,cp,e85_prix,sp98_prix,geom',
      order_by: 'ville',
      limit:    8
    }));
    if (!resp.ok) throw new Error('HTTP ' + resp.status);
    const data = await resp.json();
    if (!data.results?.length) {
      setSuggStatus('', "Aucun résultat — vérifiez l'orthographe ou utilisez la géolocalisation.");
      return;
    }
    renderSuggestions(data.results);
    setSuggStatus('', '');
  } catch (e) {
    setSuggStatus('', 'Erreur de recherche — saisie libre conservée.');
  }
}

function renderSuggestions(results) {
  const list = document.getElementById('suggList');
  list.innerHTML = results.map((r, i) => {
    const label = stationLabel(r);
    const addr  = [r.adresse, r.cp, r.ville].filter(Boolean).join(' · ');
    const prix  = r.e85_prix ? 'E85 ' + parseFloat(r.e85_prix).toFixed(3) + ' €/L' : '';
    return '<div class="suggestion-item" onmousedown="pickSuggestion(' + i + ')">'
      + '<span class="suggestion-item-name">⛽ ' + label + '</span>'
      + '<span class="suggestion-item-addr">' + addr + (prix ? '  ·  ' + prix : '') + '</span>'
      + '</div>';
  }).join('');
  list._results = results;
  list.style.display = 'block';

  // Affiche les stations géolocalisées sur la carte avec marqueurs cliquables
  const stationsGeo = results.reduce((acc, r, origIdx) => {
    if (r.geom?.lat != null && r.geom?.lon != null)
      acc.push({ name: stationLabel(r), lat: r.geom.lat, lon: r.geom.lon,
                 src: 'suggestion', srcIdx: origIdx });
    return acc;
  }, []);
  if (stationsGeo.length) showMap(userLat, userLon, stationsGeo);
}

function pickSuggestion(idx) {
  const list    = document.getElementById('suggList');
  const r       = list._results[idx];
  const oldName = document.getElementById('fAutre').value.trim();
  const newName = stationLabel(r);

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

  if (r.geom?.lon != null && r.geom?.lat != null) {
    showMap(userLat, userLon,
      [{ name: stationLabel(r), lat: r.geom.lat, lon: r.geom.lon, src: 'suggestion', srcIdx: idx }]);
    fetchPricesAtCoords(r.geom.lat, r.geom.lon, false);
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

/* ═══════════════════════════════════════
   PRIX — API gouvernementale
═══════════════════════════════════════ */

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
  setFieldPrice('fPrix', mainVal, mainPh);
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
        where:    "(e85_prix is not null OR sp98_prix is not null) AND distance(geom, geom'POINT(" + lon + " " + lat + ")', " + r + "m)",
        select:   'e85_prix,sp98_prix,adresse,ville',
        order_by: 'sp98_prix',
        limit:    1
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
      where:    '(e85_prix is not null OR sp98_prix is not null) AND cp="' + cp + '"',
      select:   'e85_prix,sp98_prix,adresse,ville',
      order_by: 'sp98_prix',
      limit:    1
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

/* ═══════════════════════════════════════
   SOUMISSION
═══════════════════════════════════════ */

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

/* ═══════════════════════════════════════
   SYNC STATION VERS GOOGLE SHEETS
═══════════════════════════════════════ */

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

/* ═══════════════════════════════════════
   CHARGEMENT DES STATIONS
═══════════════════════════════════════ */

const APP_VERSION = '1.7.0';
const GS_SHEET_ID = '1uN170kt_n45sBRwqs2krTYfhapU3dMKjTguD-qSUqCE';

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

/* ─── Démarrage ─── */
chargerStations();
document.getElementById('appVersion').textContent = 'v' + APP_VERSION;
