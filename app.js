/* ═══════════════════════════════════════
   Suivi Conso E85 — Logique applicative
═══════════════════════════════════════ */

const GAS_URL  = 'https://script.google.com/macros/s/AKfycbzljFbh6QcgQ9IadJ2yUePR56hpkSzrLsyuJLaxwB1qk7aoLcWzoHzH2btSbwV7tDeJGA/exec';
const PRIX_API = 'https://data.economie.gouv.fr/api/explore/v2.1/catalog/datasets/prix-des-carburants-en-france-flux-instantane-v2/records';

/* ─── État global ─── */
let currentType   = 'E85';
let s98Autofilled = false;
let userLat = null, userLon = null;

/* ─── État carte ─── */
let _map            = null;   // instance Leaflet
let _userMarker     = null;   // marqueur position utilisateur
let _stationMarkers = [];     // marqueurs stations
let _nearbyStations = [];     // données stations courantes
let _mapPlaceholder = null;   // contrôle hint initial

/* ─── Init ─── */
(function init() {
  const t = new Date();
  document.getElementById('fDate').value =
    `${t.getFullYear()}-${String(t.getMonth()+1).padStart(2,'0')}-${String(t.getDate()).padStart(2,'0')}`;
  document.getElementById('s98Field').classList.remove('hidden');
})();

/* ═══════════════════════════════════════
   CARTE LEAFLET
═══════════════════════════════════════ */

/** Icône personnalisée pour les stations */
function stationIcon(selected) {
  return L.divIcon({
    className: '',
    html: `<div style="
      background:${selected ? '#1B3A5C' : '#2E75B6'};
      color:#fff;
      border-radius:50% 50% 50% 0;
      transform:rotate(-45deg);
      width:32px; height:32px;
      display:flex; align-items:center; justify-content:center;
      box-shadow:0 2px 8px rgba(0,0,0,.3);
      border:2px solid #fff;
      font-size:14px;
    "><span style="transform:rotate(45deg)">⛽</span></div>`,
    iconSize:   [32, 32],
    iconAnchor: [16, 32],
    popupAnchor:[0, -34]
  });
}

/** Icône position utilisateur (créée à la demande pour éviter L non défini) */
function getUserIcon() {
  return L.divIcon({
    className: '',
    html: `<div style="
      background:#1D9E75;
      border-radius:50%;
      width:16px; height:16px;
      border:3px solid #fff;
      box-shadow:0 0 0 3px rgba(29,158,117,.35), 0 2px 8px rgba(0,0,0,.3);
    "></div>`,
    iconSize:   [16, 16],
    iconAnchor: [8, 8]
  });
}

/** Initialise la carte au chargement (centre France par défaut) */
function initMapOnLoad() {
  const wrap = document.getElementById('stationMapWrap');
  wrap.classList.remove('hidden');

  _map = L.map('stationMap', {
    zoomControl: true,
    attributionControl: true
  }).setView([46.8, 2.3], 6);   // France entière par défaut

  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '© <a href="https://www.openstreetmap.org/copyright">OSM</a>',
    maxZoom: 18
  }).addTo(_map);

  // Placeholder texte centre carte
  _mapPlaceholder = L.control({ position: 'topright' });
  _mapPlaceholder.onAdd = () => {
    const d = L.DomUtil.create('div');
    d.id = 'mapHint';
    d.style.cssText = 'background:rgba(255,255,255,.85);padding:5px 9px;border-radius:7px;font-size:11px;color:#6B7280;pointer-events:none;';
    d.textContent = '📍 Cliquez sur le bouton pour localiser les stations';
    return d;
  };
  _mapPlaceholder.addTo(_map);

  setTimeout(() => _map.invalidateSize(), 150);
}

/** Recentre la carte sur de nouvelles coordonnées */
function initMap(lat, lon) {
  if (!_map) { initMapOnLoad(); }

  // Supprime le placeholder d'aide si présent
  const hint = document.getElementById('mapHint');
  if (hint) hint.remove();

  _map.setView([lat, lon], 13);
  setTimeout(() => _map.invalidateSize(), 150);
}

/** Met à jour les marqueurs stations sur la carte */
function updateMapMarkers(stations, uLat, uLon) {
  if (!_map) return;

  // Supprime les anciens marqueurs
  _stationMarkers.forEach(m => _map.removeLayer(m));
  _stationMarkers = [];
  if (_userMarker) _map.removeLayer(_userMarker);

  // Marqueur utilisateur
  _userMarker = L.marker([uLat, uLon], { icon: getUserIcon(), zIndexOffset: 1000 })
    .addTo(_map)
    .bindTooltip('Vous êtes ici', { permanent: false, direction: 'top' });

  // Marqueurs stations
  stations.forEach((s, i) => {
    const m = L.marker([s.lat, s.lon], { icon: stationIcon(false) })
      .addTo(_map)
      .bindPopup(_buildPopupHtml(s, i), { maxWidth: 240, minWidth: 180 });
    _stationMarkers.push(m);
  });

  // Ajuste le zoom pour afficher tout
  const allPoints = [[uLat, uLon], ...stations.map(s => [s.lat, s.lon])];
  _map.fitBounds(L.latLngBounds(allPoints), { padding: [28, 28] });
}

/** Contenu HTML du popup d'une station */
function _buildPopupHtml(station, idx) {
  const dist = station.dist < 1000
    ? station.dist + ' m'
    : (station.dist / 1000).toFixed(1) + ' km';
  return `<div class="map-popup">
    <div class="map-popup-name">⛽ ${station.name}</div>
    <div class="map-popup-dist">${dist}</div>
    <button class="map-popup-btn"
      onclick="pickStationFromMap(${idx})">Sélectionner</button>
  </div>`;
}

/** Sélection d'une station depuis le popup de la carte */
function pickStationFromMap(idx) {
  const s = _nearbyStations[idx];
  if (!s) return;
  _map.closePopup();
  // Met l'icône en surbrillance
  _stationMarkers.forEach((m, i) => m.setIcon(stationIcon(i === idx)));
  pickStation(s.name, s.lat, s.lon);
  // Scroll vers la liste pour voir la sélection
  document.getElementById('stationSel').scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

/** Masque la carte */
function hideMap() {
  document.getElementById('stationMapWrap').classList.add('hidden');
}


/* ─── Type de carburant ─── */
function setType(type) {
  currentType = type;
  document.getElementById('btnE85').classList.toggle('active', type === 'E85');
  document.getElementById('btnS98').classList.toggle('active', type === 'S98');
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
   GÉOLOCALISATION (Overpass / OSM)
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
  setGeoStatus('info', 'Recherche des stations E85 dans 8 km…');
  const q = '[out:json][timeout:15];(node["fuel:e85"="yes"](around:8000,'+lat+','+lon+');way["fuel:e85"="yes"](around:8000,'+lat+','+lon+'););out center;';
  try {
    const data = await fetch('https://overpass-api.de/api/interpreter',
      { method: 'POST', body: 'data=' + encodeURIComponent(q) }).then(r => r.json());
    btn.classList.remove('loading'); btn.textContent = '📍';
    if (!data.elements?.length) { setGeoStatus('info', 'Aucune station E85 trouvée dans 8 km.'); return; }
    const known = ['Carrefour Flers', 'Leclerc Douai', 'Leclerc Drive Beuvry', 'Total Waziers'];
    const stations = data.elements.map(el => {
      const eLat = el.lat ?? el.center?.lat, eLon = el.lon ?? el.center?.lon;
      const d = haversine(lat, lon, eLat, eLon);
      const brand = el.tags?.brand || el.tags?.name || el.tags?.operator || 'Station';
      const city  = el.tags?.['addr:city'] || el.tags?.['addr:suburb'] || '';
      const name  = city ? brand+' '+city : brand;
      return { name, dist: Math.round(d), lat: eLat, lon: eLon,
               known: known.some(k => k.toLowerCase().startsWith(brand.toLowerCase().slice(0, 5))) };
    }).sort((a, b) => a.dist - b.dist).slice(0, 7);

    _nearbyStations = stations;
    renderNearby(stations);
    initMap(lat, lon);
    updateMapMarkers(stations, lat, lon);
    setGeoStatus('ok', stations.length + ' station(s) trouvée(s)');
  } catch (e) {
    btn.classList.remove('loading'); btn.textContent = '📍';
    setGeoStatus('err', 'Impossible de joindre OpenStreetMap.');
  }
}

function renderNearby(stations) {
  const list = document.getElementById('nearbyList');
  list.innerHTML = stations.map((s, i) =>
    '<div class="nearby-item" id="nearbyItem'+i+'" onclick="pickStation(\''+s.name.replace(/'/g,"\\'")+'\',' +s.lat+','+s.lon+'); highlightNearbyItem('+i+')">'
    +'<span>📍</span><span>'+s.name+'</span>'
    +(s.known ? '<span class="nearby-badge">connue</span>' : '')
    +'<span class="nearby-dist">'+(s.dist < 1000 ? s.dist+' m' : (s.dist/1000).toFixed(1)+' km')+'</span>'
    +'</div>').join('');
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
      where:    'search(adresse, "'+q+'") OR search(ville, "'+q+'")',
      select:   'id,adresse,ville,cp,e85_prix,sp98_prix,geom',
      order_by: 'ville',
      limit:    8
    }));
    if (!resp.ok) throw new Error('HTTP '+resp.status);
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
    const label = [r.adresse, r.cp, r.ville].filter(Boolean).join(' · ');
    const prix  = r.e85_prix ? 'E85 '+parseFloat(r.e85_prix).toFixed(3)+' €/L' : '';
    return '<div class="suggestion-item" onmousedown="pickSuggestion('+i+')">'
      +'<span class="suggestion-item-name">⛽ '+(r.ville || r.adresse)+'</span>'
      +'<span class="suggestion-item-addr">'+label+(prix ? '  ·  '+prix : '')+'</span>'
      +'</div>';
  }).join('');
  list._results = results;
  list.style.display = 'block';
}

function pickSuggestion(idx) {
  const list    = document.getElementById('suggList');
  const r       = list._results[idx];
  const oldName = document.getElementById('fAutre').value.trim();
  const newName = [r.adresse, r.ville].filter(Boolean).join(' — ');

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
    // Affiche la station sélectionnée sur la carte
    _nearbyStations = [{ name: newName, dist: 0, lat: r.geom.lat, lon: r.geom.lon }];
    initMap(r.geom.lat, r.geom.lon);
    updateMapMarkers(_nearbyStations, r.geom.lat, r.geom.lon);
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
  if (currentType === 'E85' && r.e85_prix) found.push('E85 : '+parseFloat(r.e85_prix).toFixed(3)+' €/L');
  if (r.sp98_prix) found.push('SP98 : '+parseFloat(r.sp98_prix).toFixed(3)+' €/L');
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
        where:    '(e85_prix is not null OR sp98_prix is not null) AND distance(geom, geom\'POINT('+lon+' '+lat+')\', '+r+'m)',
        select:   'e85_prix,sp98_prix,adresse,ville',
        order_by: 'sp98_prix',
        limit:    1
      }));
      if (!resp.ok) throw new Error('HTTP '+resp.status);
      const data = await resp.json();
      if (data.results?.length) { applyPricesResult(data); return; }
    } catch (e) {
      console.error('[PRIX] fetchAtCoords r='+r, e);
      setS98Status('err', 'Erreur API ('+e.message+') — saisie manuelle.');
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
  setS98Status('spin', 'Recherche dans '+cp+'…');
  try {
    const resp = await fetch(odsUrl({
      where:    '(e85_prix is not null OR sp98_prix is not null) AND cp="'+cp+'"',
      select:   'e85_prix,sp98_prix,adresse,ville',
      order_by: 'sp98_prix',
      limit:    1
    }));
    if (!resp.ok) throw new Error('HTTP '+resp.status);
    const data = await resp.json();
    if (data.results?.length) { hideCpSearch(); applyPricesResult(data); }
    else setS98Status('info', 'Aucune station trouvée pour '+cp+' — saisie manuelle.');
  } catch (e) {
    setS98Status('err', 'Erreur ('+e.message+') — saisie manuelle.');
  }
}

function showCpSearch() { document.getElementById('cpSearch').classList.remove('hidden'); document.getElementById('fCp').focus(); }
function hideCpSearch()  { document.getElementById('cpSearch').classList.add('hidden');   document.getElementById('fCp').value = ''; }

function setS98Status(cls, msg) {
  const el = document.getElementById('s98Status');
  el.className   = 's98-status ' + cls;
  el.textContent = msg;
}

/* ─── Utilitaires ─── */
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
      showFeedback('success', 'Plein enregistré ✓', json.message || litres+' L à '+prix+' €/L — '+station);
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
  el.innerHTML = '<strong>'+title+'</strong>'+msg;
  el.style.display = 'block';
  el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  if (type === 'success') setTimeout(() => el.style.display = 'none', 5000);
}

function resetForm() {
  const n = new Date();
  document.getElementById('fDate').value = n.getFullYear()+'-'+String(n.getMonth()+1).padStart(2,'0')+'-'+String(n.getDate()).padStart(2,'0');
  ['fKm', 'fLitres', 'fAutre'].forEach(id => document.getElementById(id).value = '');
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
  // Ne masque pas la carte — elle reste affichée pour la prochaine saisie
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
      method:   'POST',
      redirect: 'follow',
      body:     JSON.stringify({ action: 'addStation', station: nom })
    });
    const autreOpt = group.querySelector('[value="__autre"]');
    group.insertBefore(new Option(nom, nom), autreOpt);
    console.log('[Stations] Nouvelle station synchronisée :', nom);
  } catch (e) {
    console.warn('[Stations] Sync échouée (silencieux) :', e.message);
  }
}

/* ═══════════════════════════════════════
   CHARGEMENT DES STATIONS
═══════════════════════════════════════ */

const GS_SHEET_ID = '1uN170kt_n45sBRwqs2krTYfhapU3dMKjTguD-qSUqCE';

async function chargerStations() {
  const url = 'https://docs.google.com/spreadsheets/d/'+GS_SHEET_ID
            + '/gviz/tq?tqx=out:csv&sheet=Stations';
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
    const fallback = ['Carrefour Flers', 'Intermarché', 'Leclerc Douai', 'Total Access', 'Total Waziers', 'ZONE DU MOULIN RUE ARTHUR LAMENDIN — Beuvry'];
    const group    = document.getElementById('knownGroup');
    const autreOpt = group.querySelector('[value="__autre"]');
    fallback.forEach(nom => group.insertBefore(new Option(nom, nom), autreOpt));
  }
}

/* ─── Démarrage ─── */
const _t = new Date();
document.getElementById('fDate').value =
  _t.getFullYear()+'-'+String(_t.getMonth()+1).padStart(2,'0')+'-'+String(_t.getDate()).padStart(2,'0');

chargerStations();
initMapOnLoad();
