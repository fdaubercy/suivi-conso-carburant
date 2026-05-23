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
   CARTE — iframe OpenStreetMap (sans lib)
═══════════════════════════════════════ */

/** Affiche la carte OSM centrée sur la position utilisateur */
function showMap(uLat, uLon, stations) {
  const validStations = stations.filter(s => s.lat && s.lon);
  if (!validStations.length) return;

  // Bounding box englobant position utilisateur (si connue) + toutes les stations
  const allLats = validStations.map(s => s.lat);
  const allLons = validStations.map(s => s.lon);
  if (uLat) { allLats.push(uLat); allLons.push(uLon); }

  const minLat = Math.min(...allLats), maxLat = Math.max(...allLats);
  const minLon = Math.min(...allLons), maxLon = Math.max(...allLons);
  const dLat = (maxLat - minLat) * 0.15 || 0.02;
  const dLon = (maxLon - minLon) * 0.15 || 0.02;

  const bbox    = `${(minLon-dLon).toFixed(5)},${(minLat-dLat).toFixed(5)},${(maxLon+dLon).toFixed(5)},${(maxLat+dLat).toFixed(5)}`;
  // Marqueur sur la position utilisateur si connue, sinon sur la 1ère station
  const mLat    = uLat || validStations[0].lat;
  const mLon    = uLon || validStations[0].lon;
  const src     = `https://www.openstreetmap.org/export/embed.html?bbox=${bbox}&layer=mapnik&marker=${mLat},${mLon}`;

  document.getElementById('stationMap').src = src;
  document.getElementById('stationMapWrap').classList.remove('hidden');
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
    showMap(lat, lon, stations);
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

  // Affiche toutes les stations ayant des coordonnées sur la carte
  const stationsGeo = results
    .filter(r => r.geom?.lat != null && r.geom?.lon != null)
    .map(r => ({ lat: r.geom.lat, lon: r.geom.lon }));
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
    showMap(userLat, userLon, [{ lat: r.geom.lat, lon: r.geom.lon }]);
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
