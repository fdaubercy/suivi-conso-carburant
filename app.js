/* ═══════════════════════════════════════
   Suivi Conso E85 — Logique applicative
   v1.8.0 — Priorité Enseigne en Gras & Traces Console
═══════════════════════════════════════ */

/* ─── Configuration — à mettre à jour à chaque déploiement ─── */
const APP_VERSION = '1.8.2';
const GAS_URL     = 'https://script.google.com/macros/s/AKfycbzljFbh6Qcg9IadJ2yUePR56hpkSzrLsyuJLaxwB1qk7aoLcWzoHzH2btSbwV7tDeJGA/exec';
const GS_SHEET_ID = '1uN170kt_n45sBRwqs2krTYfhapU3dMKjTguD-qSUqCE';
const PRIX_API    = 'https://data.economie.gouv.fr/api/explore/v2.1/catalog/datasets/prix-des-carburants-en-france-flux-instantane-v2/records';

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
      const px = (tx - nw.x) * TILE_SZ, py = (ty - nw.y) * TILE_SZ;
      html += `<img src="https://tile.openstreetmap.org/${z}/${tx}/${ty}.png" `
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
    .replace(/&/g,'&').replace(/</g,'<')
    .replace(/>/g,'>').replace(/"/g,'"');
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

/* ─── Extraction sémantique de l'enseigne de la station ─── */
function stationLabel(r) {
  const targets = [
    { key: 'total', display: 'TotalEnergies' },
    { key: 'carrefour', display: 'Carrefour' },
    { key: 'leclerc', display: 'E.Leclerc' },
    { key: 'intermarche', display: 'Intermarché' },
    { key: 'systeme u', display: 'Système U' },
    { key: 'super u', display: 'Système U' },
    { key: 'hyper u', display: 'Système U' },
    { key: 'u express', display: 'Système U' },
    { key: 'esso', display: 'Esso' },
    { key: 'auchan', display: 'Auchan' },
    { key: 'avanti', display: 'Avanti' },
    { key: 'bp', display: 'BP' },
    { key: 'casino', display: 'Casino' },
    { key: 'cora', display: 'Cora' },
    { key: 'shell', display: 'Shell' },
    { key: 'elan', display: 'Elan' },
    { key: 'agip', display: 'Agip' }
  ];

  const searchStr = `${r.services || ''} ${r.adresse || ''}`.toLowerCase();
  for (const target of targets) {
    if (searchStr.includes(target.key)) return target.display;
  }

  if (r.ville) return r.ville.trim().toUpperCase();
  return 'STATION SERVICE';
}

/* ─── Formattage de la ligne secondaire d'adresse ─── */
function stationSubLabel(r) {
  const cap = s => s ? s.charAt(0).toUpperCase() + s.slice(1).toLowerCase() : '';
  const addr = cap(r.adresse || '');
  const cp   = r.cp || '';
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
  if (sel && sel !== '__autre') {
    fetchPricesNearUser();
  }
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
    const resp = await fetch(odsUrl({
      where:  `e85_prix is not null and distance(geom, geom'POINT(${lon} ${lat})', 8000m)`,
      select: 'adresse,ville,cp,e85_prix,sp98_prix,geom,services',
      limit:  40
    }));
    if (!resp.ok) throw new Error('HTTP ' + resp.status);
    const data = await resp.json();
    
    // Affichage des résultats bruts dans la console pour l'analyse utilisateur
    console.log('[DEBUG] Résultats bruts de géolocalisation :', data.results);

    btn.classList.remove('loading'); btn.textContent = '📍';

    if (!data.results?.length) {
      setGeoStatus('info', 'Aucune station E85 trouvée dans 8 km.');
      return;
    }

    const knownNames = Array.from(
      document.querySelectorAll('#knownGroup option:not([value="__autre"])')
    ).map(o => o.value.toLowerCase());

    const stations = data.results
      .filter(r => {
        const c = getCoords(r);
        return c && r.e85_prix != null;
      })
      .map(r => {
        const c    = getCoords(r);
        const sLat = c.lat, sLon = c.lon;
        const d    = haversine(lat, lon, sLat, sLon);
        const name = stationLabel(r);
        const sub  = stationSubLabel(r);
        const known = knownNames.some(k => k.includes((r.ville || '').toLowerCase()) || k.includes(name.toLowerCase()));
        return { name, sub, dist: Math.round(d), lat: sLat, lon: sLon,
                 e85: r.e85_prix, s98: r.sp98_prix, known };
      })
      .filter(s => s.dist <= 8000)
      .sort((a, b) => a.dist - b.dist)
      .slice(0, 7);

    if (!stations.length) {
      setGeoStatus('info', 'Aucune station E85 trouvée dans 8 km.');
      return;
    }

    _nearbyStations = stations;
    renderNearby(stations);
    showMap(lat, lon, stations.map((s, i) => ({ ...s, src: 'nearby', srcIdx: i })));
    setGeoStatus('ok', stations.length + ' station(s) E85 trouvée(s)');
  } catch (e) {
    btn.classList.