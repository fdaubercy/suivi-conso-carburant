/* ═══════════════════════════════════════
   Suivi Conso E85 — Logique applicative
   v2.1.4.2 — Enrichissement OSM uniformisé (géoloc + recherche manuelle)
═══════════════════════════════════════ */

/* ─── Configuration ─── */
const APP_VERSION       = '2.1.4.2';
const GAS_URL           = 'https://script.google.com/macros/s/AKfycbzljFbh6Qcg9IadJ2yUePR56hpkSzrLsyuJLaxwB1qk7aoLcWzoHzH2btSbwV7tDeJGA/exec';
const GS_SHEET_ID       = '1uN170kt_n45sBRwqs2krTYfhapU3dMKjTguD-qSUqCE';
const PRIX_API          = 'https://data.economie.gouv.fr/api/explore/v2.1/catalog/datasets/prix-des-carburants-en-france-flux-instantane-v2/records';
const VEHICULES_KEY     = 'suivi_e85_vehicules';       // cache localStorage de la liste
const LAST_VEHICULE_KEY = 'suivi_e85_last_vehicule';   // dernier véhicule sélectionné

/* ─── État global ─── */
let currentType        = 'E85';
let s98Autofilled      = false;
let userLat = null, userLon = null;
let _nearbyStations    = [];
let currentVehiculeNom = '';
let searchRadiusM      = 20000; // null = ville seule

/* ─── Init ─── */
(function () {
  const t = new Date();
  document.getElementById('fDate').value =
    `${t.getFullYear()}-${String(t.getMonth()+1).padStart(2,'0')}-${String(t.getDate()).padStart(2,'0')}`;
  document.getElementById('s98Field').classList.remove('hidden');
  const btn = document.querySelector('.radius-btn[data-m="20000"]');
  if (btn) btn.classList.add('active');
})();

/* ═══════════════════════════════════════
   RAYON DE RECHERCHE
═══════════════════════════════════════ */

function setRadius(btn, metres) {
  searchRadiusM = metres;
  document.querySelectorAll('.radius-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  const q = document.getElementById('fAutre').value.trim();
  if (q.length >= 3) {
    setAutreStatus('spin', 'Recherche…');
    clearTimeout(_autreDebounce);
    _autreDebounce = setTimeout(() => searchStationSuggestions(q), 200);
  }
}

/* ═══════════════════════════════════════
   VÉHICULES
   ─────────────────────────────────────
   Stockage       : localStorage uniquement (VEHICULES_KEY)
   Dernière sélec : localStorage[LAST_VEHICULE_KEY]
   Ajout/suppression : local uniquement (pas de sync Google Sheets)
═══════════════════════════════════════ */

function getVehicules() {
  try { return JSON.parse(localStorage.getItem(VEHICULES_KEY) || '[]'); }
  catch { return []; }
}
function sauvegarderVehicules(liste) { localStorage.setItem(VEHICULES_KEY, JSON.stringify(liste)); }

/** Remplit le <select> avec la liste donnée (conserve les options système) */
function _populateVehiculeSelect(liste) {
  const group  = document.getElementById('vehiculeGroup');
  Array.from(group.querySelectorAll('option[data-v]')).forEach(o => o.remove());
  const addOpt = group.querySelector('[value="__ajouter"]');
  liste.forEach(nom => {
    const opt = new Option(nom, nom); opt.dataset.v = '1';
    group.insertBefore(opt, addOpt);
  });
}

/** Sélectionne automatiquement le dernier véhicule connu */
function _autoSelectLastVehicule() {
  const last = localStorage.getItem(LAST_VEHICULE_KEY);
  if (!last) return;
  const sel = document.getElementById('vehiculeSel');
  if (Array.from(sel.options).some(o => o.value === last)) {
    sel.value          = last;
    currentVehiculeNom = last;
  }
}

/**
 * Charge la liste des véhicules :
 * — Si localStorage non vide → affichage immédiat + auto-sélection (nominal)
 * — Si localStorage vide     → import unique depuis l'onglet "Vehicules" du GS,
 *                              puis sauvegarde locale (1er lancement / nouvel appareil)
 */
async function chargerVehicules() {
  const listeLocale = getVehicules();

  if (listeLocale.length > 0) {
    // Cas nominal : données déjà en local
    _populateVehiculeSelect(listeLocale);
    _autoSelectLastVehicule();
    return;
  }

  // Premier lancement (localStorage vide) → import depuis Google Sheets
  try {
    const url = 'https://docs.google.com/spreadsheets/d/' + GS_SHEET_ID
              + '/gviz/tq?tqx=out:csv&sheet=vehicules';
    const resp = await fetch(url);
    if (!resp.ok) throw new Error('HTTP ' + resp.status);
    const csv   = await resp.text();
    const liste = csv.split('\n')
      .map(l => l.trim().split(',')[0].replace(/^"|"$/g, ''))  // 1re colonne uniquement
      .slice(1)                                                  // ignorer l'en-tête
      .filter(s => s.length > 0);

    if (liste.length > 0) {
      sauvegarderVehicules(liste);
      console.log('[Véhicules] Import initial depuis GS :', liste);
    }
  } catch(e) {
    console.warn('[Véhicules] Import initial GS échoué, départ liste vide :', e.message);
  }

  // Affichage final (liste importée ou vide si import échoué)
  _populateVehiculeSelect(getVehicules());
  _autoSelectLastVehicule();
}

function onVehiculeChange() {
  const sel      = document.getElementById('vehiculeSel');
  const addField = document.getElementById('vehiculeAddField');
  const val      = sel.value;

  if (val === '__ajouter') {
    sel.value = currentVehiculeNom || '';
    addField.classList.remove('hidden');
    document.getElementById('fNouveauVehicule').focus();
    return;
  }

  if (val === '__supprimer') {
    addField.classList.add('hidden');
    if (!currentVehiculeNom) {
      setVehiculeStatus('err', 'Sélectionnez d\'abord un véhicule à supprimer.');
      sel.value = ''; return;
    }
    if (confirm('Supprimer "' + currentVehiculeNom + '" ?')) {
      const nom = currentVehiculeNom;
      sauvegarderVehicules(getVehicules().filter(v => v !== nom));
      // Effacer la dernière sélection si c'était ce véhicule
      if (localStorage.getItem(LAST_VEHICULE_KEY) === nom)
        localStorage.removeItem(LAST_VEHICULE_KEY);
      currentVehiculeNom = '';
      _populateVehiculeSelect(getVehicules());
      sel.value = '';
      setVehiculeStatus('', '');
      // suppression locale uniquement
    } else {
      sel.value = currentVehiculeNom;
    }
    return;
  }

  // Sélection normale d'un véhicule
  currentVehiculeNom = val;
  if (val) localStorage.setItem(LAST_VEHICULE_KEY, val); // persister la sélection
  addField.classList.add('hidden');
  setVehiculeStatus('', '');
}

async function confirmerAjoutVehicule() {
  const nom = document.getElementById('fNouveauVehicule').value.trim();
  if (!nom) { setVehiculeStatus('err', 'Nom requis.'); return; }
  const liste = getVehicules();
  if (!liste.includes(nom)) { liste.push(nom); sauvegarderVehicules(liste); }
  _populateVehiculeSelect(getVehicules());
  document.getElementById('vehiculeSel').value = nom;
  currentVehiculeNom = nom;
  localStorage.setItem(LAST_VEHICULE_KEY, nom); // persister
  document.getElementById('fNouveauVehicule').value = '';
  document.getElementById('vehiculeAddField').classList.add('hidden');
  setVehiculeStatus('ok', '"' + nom + '" enregistré');
  setTimeout(() => setVehiculeStatus('', ''), 3000);
}


function setVehiculeStatus(cls, msg) {
  const el = document.getElementById('vehiculeStatus'); el.className = 'geo-status ' + cls; el.textContent = msg;
}

/* ═══════════════════════════════════════
   ENRICHISSEMENT — OVERPASS around EN SÉRIE
═══════════════════════════════════════ */

const OVERPASS_API     = 'https://overpass-api.de/api/interpreter';
const OSM_RADIUS       = 2000;
const OSM_SERIAL_DELAY = 600;

async function fetchOsmNameAround(lat, lon) {
  const query =
    `[out:json][timeout:8];(node(around:${OSM_RADIUS},${lat},${lon})[amenity=fuel];` +
    `way(around:${OSM_RADIUS},${lat},${lon})[amenity=fuel];);out tags center;`;
  try {
    const resp = await fetch(OVERPASS_API, { method:'POST', body:'data='+encodeURIComponent(query), signal:AbortSignal.timeout(8000) });
    if (!resp.ok) return null;
    const data = await resp.json();
    const elements = data.elements || []; if (!elements.length) return null;
    const sorted = elements
      .map(el => { const eLat=el.lat??el.center?.lat, eLon=el.lon??el.center?.lon; if (eLat==null) return null; return { tags:el.tags||{}, dist:haversine(lat,lon,eLat,eLon) }; })
      .filter(Boolean).sort((a,b)=>a.dist-b.dist);
    const tags=sorted[0].tags, name=tags.brand||tags.name||tags.operator||null;
    console.log(`[OSM] around(${lat.toFixed(4)},${lon.toFixed(4)}) → "${name||'—'}" (Δ${Math.round(sorted[0].dist)} m)`);
    return name;
  } catch(e) { console.warn('[OSM] Erreur:', e.message); return null; }
}

async function enrichWithOsmSerial(stations, setStatus = setGeoStatus) {
  const names = [];
  for (let i = 0; i < stations.length; i++) {
    setStatus('info', `Identification station ${i+1}/${stations.length}…`);
    names.push(await fetchOsmNameAround(stations[i].lat, stations[i].lon));
    if (i < stations.length-1) await new Promise(r => setTimeout(r, OSM_SERIAL_DELAY));
  }
  return names;
}

function stationLabel(r) {
  if (r.adresse) return r.adresse.trim().toLowerCase().replace(/\b(\w)/g, c => c.toUpperCase());
  return r.ville ? r.ville.trim().toUpperCase() : 'Station service';
}

/* ═══════════════════════════════════════
   CARTE — Tuiles OSM, marqueurs cliquables
═══════════════════════════════════════ */

const TILE_SZ = 256;
let _mapStations = [];

function tileXY(lat, lon, z) {
  const n=1<<z, lr=lat*Math.PI/180;
  return { x:Math.floor((lon+180)/360*n), y:Math.floor((1-Math.log(Math.tan(lr)+1/Math.cos(lr))/Math.PI)/2*n) };
}
function latLonToPx(lat, lon, z, ox, oy) {
  const n=1<<z, lr=lat*Math.PI/180;
  return { x:Math.round((lon+180)/360*n*TILE_SZ-ox*TILE_SZ), y:Math.round((1-Math.log(Math.tan(lr)+1/Math.cos(lr))/Math.PI)/2*n*TILE_SZ-oy*TILE_SZ) };
}
function bestZoom(allLats, allLons, maxW, maxH) {
  for (let z=15; z>=10; z--) {
    const nw=tileXY(Math.max(...allLats),Math.min(...allLons),z), se=tileXY(Math.min(...allLats),Math.max(...allLons),z);
    if ((se.x-nw.x+1)*TILE_SZ<=maxW+TILE_SZ && (se.y-nw.y+1)*TILE_SZ<=maxH+TILE_SZ) return z;
  }
  return 10;
}

function showMap(uLat, uLon, stations) {
  _mapStations = stations.filter(s => s.lat && s.lon);
  if (!_mapStations.length) return;
  const wrap = document.getElementById('stationMapWrap');
  const wasHidden = wrap.classList.contains('hidden');
  wrap.classList.remove('hidden');
  wasHidden ? setTimeout(() => _renderMap(uLat, uLon), 0) : _renderMap(uLat, uLon);
}

function _renderMap(uLat, uLon) {
  const container = document.getElementById('stationMap');
  const rect = container.getBoundingClientRect();
  const W=rect.width||container.offsetWidth||360, H=rect.height||container.offsetHeight||220, mg=0.008;
  const allLats=_mapStations.map(s=>s.lat), allLons=_mapStations.map(s=>s.lon);
  if (uLat) { allLats.push(uLat); allLons.push(uLon); }
  const z=bestZoom([Math.min(...allLats)-mg,Math.max(...allLats)+mg],[Math.min(...allLons)-mg,Math.max(...allLons)+mg],W,H);
  const nw=tileXY(Math.max(...allLats)+mg,Math.min(...allLons)-mg,z), se=tileXY(Math.min(...allLats)-mg,Math.max(...allLons)+mg,z);
  const gridW=(se.x-nw.x+1)*TILE_SZ, gridH=(se.y-nw.y+1)*TILE_SZ;
  const offX=Math.round((W-gridW)/2), offY=Math.round((H-gridH)/2);
  let html=`<div style="position:absolute;left:${offX}px;top:${offY}px;width:${gridW}px;height:${gridH}px">`;
  for (let ty=nw.y;ty<=se.y;ty++) for (let tx=nw.x;tx<=se.x;tx++) {
    html+=`<img src="https://tile.openstreetmap.org/${z}/${tx}/${ty}.png" `
        +`style="position:absolute;left:${(tx-nw.x)*TILE_SZ}px;top:${(ty-nw.y)*TILE_SZ}px;width:${TILE_SZ}px;height:${TILE_SZ}px" `
        +`loading="lazy" onerror="this.style.background='#ddd'">`;
  }
  _mapStations.forEach((s,i) => {
    const p=latLonToPx(s.lat,s.lon,z,nw.x,nw.y);
    html+=`<div id="mapPin${i}" onclick="selectStationFromMap(${i})" onmouseenter="showPinLabel(${i})" ontouchstart="showPinLabel(${i})"
      style="position:absolute;left:${p.x-12}px;top:${p.y-30}px;z-index:10;cursor:pointer;-webkit-tap-highlight-color:transparent">
      <div class="map-pin" id="mapPinDot${i}" style="background:#2E75B6"><span style="transform:rotate(45deg)">⛽</span></div>
      <div class="map-pin-label" id="mapPinLbl${i}">${escHtml(s.name)}</div></div>`;
  });
  if (uLat && uLon) {
    const p=latLonToPx(uLat,uLon,z,nw.x,nw.y);
    html+=`<div style="position:absolute;left:${p.x-8}px;top:${p.y-8}px;z-index:11;pointer-events:none">
      <div style="width:16px;height:16px;background:#1D9E75;border-radius:50%;border:3px solid #fff;box-shadow:0 0 0 3px rgba(29,158,117,.35),0 2px 6px rgba(0,0,0,.3)"></div></div>`;
  }
  html+='</div>';
  html+=`<a href="https://www.openstreetmap.org" target="_blank" rel="noopener"
    style="position:absolute;bottom:3px;right:5px;background:rgba(255,255,255,.8);font-size:9px;padding:1px 5px;border-radius:3px;color:#555;text-decoration:none;z-index:20">© OSM</a>`;
  container.innerHTML=html;
}

function showPinLabel(idx) {
  const lbl=document.getElementById('mapPinLbl'+idx); if (!lbl) return;
  lbl.style.opacity='1'; clearTimeout(lbl._hideTimer);
  lbl._hideTimer=setTimeout(()=>{ lbl.style.opacity=''; },2000);
}
function escHtml(str) { return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }
function selectStationFromMap(idx) {
  const s=_mapStations[idx]; if (!s) return;
  _mapStations.forEach((_,i)=>{ const p=document.getElementById('mapPinDot'+i); if (p) p.style.background=i===idx?'#1B3A5C':'#2E75B6'; });
  showPinLabel(idx); pickStation(s.name,s.lat,s.lon);
  if (s.src==='nearby') { highlightNearbyItem(s.srcIdx); document.getElementById('nearbyItem'+s.srcIdx)?.scrollIntoView({behavior:'smooth',block:'nearest'}); }
}
function hideMap() { document.getElementById('stationMapWrap').classList.add('hidden'); }

/* ─── Extraction coordonnées ─────────────────────────────
   Deux formats selon requête ODS v2.1 :
   • Avec distance() → {lat, lon}
   • Sans distance() → {type:"Point", coordinates:[lon, lat]}
───────────────────────────────────────────────────────── */
function getCoords(r) {
  if (!r.geom) return null;
  if (r.geom.lat!=null && r.geom.lon!=null) return { lat:+r.geom.lat, lon:+r.geom.lon };
  if (r.geom.type==='Point' && Array.isArray(r.geom.coordinates) && r.geom.coordinates.length>=2)
    return { lat:+r.geom.coordinates[1], lon:+r.geom.coordinates[0] };
  return null;
}

function stationSubLabel(r) {
  const cap=s=>s?s.charAt(0).toUpperCase()+s.slice(1).toLowerCase():'';
  return [cap(r.adresse||''), r.cp||'', r.ville?r.ville.trim().toUpperCase():''].filter(Boolean).join(' · ');
}

/* ─── Type de carburant ─── */
function setType(type) {
  currentType=type;
  document.getElementById('btnE85').classList.toggle('active',type==='E85');
  document.getElementById('btnS98').classList.toggle('active',type==='S98');
  document.getElementById('headerBadge').textContent=type==='E85'?'🌿 E85':'💧 S98';
  document.getElementById('s98Field').classList.toggle('hidden',type!=='E85');
  document.getElementById('prixLabel').textContent=type==='E85'?'Prix E85 (€/L)':'Prix S98 (€/L)';
  const fp=document.getElementById('fPrix'); fp.value=''; fp.classList.remove('autofilled'); fp.placeholder=type==='E85'?'0.798':'2.091';
  updateCout();
  const sel=document.getElementById('stationSel').value;
  if (sel && sel!=='__autre') fetchPricesNearUser();
}

function updateCout() {
  const l=parseFloat(document.getElementById('fLitres').value), p=parseFloat(document.getElementById('fPrix').value);
  const box=document.getElementById('coutBox');
  if (!isNaN(l)&&!isNaN(p)&&l>0&&p>0) { box.style.display='flex'; document.getElementById('coutVal').textContent=(l*p).toFixed(2)+' €'; }
  else box.style.display='none';
}

function onStationChange() {
  const sel=document.getElementById('stationSel'), isManual=sel.value==='__autre';
  document.getElementById('autreField').classList.toggle('hidden',!isManual);
  if (!isManual) { document.getElementById('nearbyList').style.display='none'; document.getElementById('fAutre').value=''; setAutreStatus('',''); }
  if (sel.value && !isManual) fetchPricesNearUser();
}

function onS98ManualEdit() {
  s98Autofilled=false; const el=document.getElementById('fPrixS98'); el.classList.remove('autofilled');
  if (!el.value) el.placeholder='2.091';
  document.getElementById('s98Status').className='s98-status'; document.getElementById('s98Status').textContent='';
}

/* ═══════════════════════════════════════
   GÉOLOCALISATION
═══════════════════════════════════════ */

function geolocate() {
  if (!navigator.geolocation) { setGeoStatus('err','Géolocalisation non disponible.'); return; }
  const btn=document.getElementById('geoBtn'); btn.classList.add('loading'); btn.textContent='🔄';
  setGeoStatus('info','Localisation en cours…'); document.getElementById('nearbyList').style.display='none';
  navigator.geolocation.getCurrentPosition(
    pos=>{ userLat=pos.coords.latitude; userLon=pos.coords.longitude; searchNearby(userLat,userLon,btn); },
    err=>{ btn.classList.remove('loading'); btn.textContent='📍';
      const msgs={1:'Accès refusé — autorisez dans Réglages.',2:'Position introuvable.',3:'Délai dépassé.'};
      setGeoStatus('err',msgs[err.code]||'Erreur.'); },
    { timeout:10000, maximumAge:60000 }
  );
}

async function searchNearby(lat, lon, btn) {
  setGeoStatus('info','Recherche des stations E85 dans 8 km…');
  try {
    const resp=await fetch(odsUrl({ where:`e85_prix is not null and distance(geom, geom'POINT(${lon} ${lat})', 8000m)`, select:'adresse,ville,cp,e85_prix,sp98_prix,geom,services', limit:40 }));
    if (!resp.ok) throw new Error('HTTP '+resp.status);
    const data=await resp.json();
    btn.classList.remove('loading'); btn.textContent='📍';
    if (!data.results?.length) { setGeoStatus('info','Aucune station E85 trouvée dans 8 km.'); return; }
    const candidates=data.results.filter(r=>getCoords(r)&&r.e85_prix!=null)
      .map(r=>{ const c=getCoords(r); return {r,lat:c.lat,lon:c.lon,dist:Math.round(haversine(lat,lon,c.lat,c.lon))}; })
      .filter(c=>c.dist<=8000).sort((a,b)=>a.dist-b.dist).slice(0,7);
    if (!candidates.length) { setGeoStatus('info','Aucune station E85 trouvée dans 8 km.'); return; }
    const osmNames=await enrichWithOsmSerial(candidates);
    const knownNames=Array.from(document.querySelectorAll('#knownGroup option:not([value="__autre"])')).map(o=>o.value.toLowerCase());
    const stations=candidates.map((c,i)=>{
      const name=osmNames[i]||stationLabel(c.r);
      return { name, sub:stationSubLabel(c.r), dist:c.dist, lat:c.lat, lon:c.lon, e85:c.r.e85_prix, s98:c.r.sp98_prix,
               known:knownNames.some(k=>k.includes(name.toLowerCase())||k.includes((c.r.ville||'').toLowerCase())) };
    });
    _nearbyStations=stations;
    renderNearby(stations);
    showMap(lat,lon,stations.map((s,i)=>({...s,src:'nearby',srcIdx:i})));
    setGeoStatus('ok',stations.length+' station(s) E85 trouvée(s)');
  } catch(e) {
    document.getElementById('geoBtn').classList.remove('loading'); document.getElementById('geoBtn').textContent='📍';
    setGeoStatus('err','Erreur de recherche ('+e.message+').');
  }
}

function renderNearby(stations) {
  const list=document.getElementById('nearbyList');
  if (!stations.length) { list.style.display='none'; return; }
  list.innerHTML=stations.map((s,i)=>{
    const d=s.dist!=null?s.dist:null, dist=d==null?'':d<1000?d+' m':(d/1000).toFixed(1)+' km';
    const prix=s.e85?(dist?' · ':'')+' E85 '+parseFloat(s.e85).toFixed(3)+' €/L':'';
    return '<div class="nearby-item" id="nearbyItem'+i+'">'
      +'<div class="nearby-main" onclick="pickStation(\''+s.name.replace(/'/g,"\\'")+'\','+s.lat+','+s.lon+');highlightNearbyItem('+i+')">'
      +'<span class="nearby-name"><strong>'+escHtml(s.name)+'</strong></span>'
      +'<span class="nearby-sub">'+escHtml(s.sub)+'</span>'
      +'<span class="nearby-meta">'+dist+prix+(s.known?' <span class="nearby-badge">connue</span>':'')+'</span>'
      +'</div><a class="nearby-map-btn" href="https://www.google.com/maps/search/?api=1&query='+s.lat+','+s.lon+'" target="_blank" rel="noopener">🗺️</a></div>';
  }).join('');
  list.style.display='block';
}

function highlightNearbyItem(idx) { document.querySelectorAll('.nearby-item').forEach((el,i)=>el.classList.toggle('selected',i===idx)); }
function pickStation(name, lat, lon) {
  const sel=document.getElementById('stationSel');
  if (!Array.from(sel.options).map(o=>o.value).includes(name)) document.getElementById('knownGroup').appendChild(new Option(name,name));
  sel.value=name; document.getElementById('nearbyList').style.display='none';
  document.getElementById('autreField').classList.add('hidden'); setGeoStatus('',''); fetchPricesAtCoords(lat,lon,true);
}

/* ═══════════════════════════════════════
   RECHERCHE MANUELLE PAR VILLE (2 étapes)
   1. Localiser la commune → obtenir ses coordonnées
   2. Stations E85 dans le rayon AUTOUR DE LA COMMUNE
═══════════════════════════════════════ */

let _autreDebounce = null;

function onAutreInput() {
  const q=document.getElementById('fAutre').value.trim(); clearTimeout(_autreDebounce);
  document.getElementById('nearbyList').style.display='none';
  if (q.length<3) { setAutreStatus('',''); return; }
  setAutreStatus('spin','Recherche…');
  _autreDebounce=setTimeout(()=>searchStationSuggestions(q),500);
}
function setAutreStatus(cls, msg) { const el=document.getElementById('autreStatus'); el.className=cls; el.textContent=msg; }

function buildSearchClause(q) {
  return /^\d{2,5}$/.test(q) ? `cp like '${q}%'` : `search(ville, '${q}')`;
}

function buildStations(results) {
  const knownNames=Array.from(document.querySelectorAll('#knownGroup option:not([value="__autre"])')).map(o=>o.value.toLowerCase());
  return results.filter(r=>getCoords(r)).map(r=>{
    const c=getCoords(r), dist=(userLat&&userLon)?Math.round(haversine(userLat,userLon,c.lat,c.lon)):null;
    const name=stationLabel(r);
    return { name, sub:stationSubLabel(r), dist, lat:c.lat, lon:c.lon, e85:r.e85_prix, s98:r.sp98_prix,
             known:knownNames.some(k=>k.includes(name.toLowerCase())||k.includes((r.ville||'').toLowerCase())) };
  }).sort((a,b)=>(a.dist??99999)-(b.dist??99999));
}

async function searchStationSuggestions(q) {
  try {
    const searchClause = buildSearchClause(q);

    // ── Étape 1 : coordonnées de la commune ──
    setAutreStatus('spin', 'Localisation de la commune…');
    const respLoc = await fetch(PRIX_API + '?' + new URLSearchParams({
      where: `${searchClause} and e85_prix is not null`, select:'ville,geom', limit:1
    }));
    if (!respLoc.ok) throw new Error('HTTP ' + respLoc.status);
    const dataLoc = await respLoc.json();

    if (!dataLoc.results?.length || !getCoords(dataLoc.results[0])) {
      setAutreStatus('err', 'Aucune commune E85 trouvée avec ce nom.'); return;
    }
    const cityCoords = getCoords(dataLoc.results[0]);
    const cityName   = (dataLoc.results[0].ville || q).trim();

    // ── Étape 2 : stations dans le rayon autour de la commune ──
    const radiusLabel = searchRadiusM != null
      ? (searchRadiusM >= 1000 ? searchRadiusM/1000 + ' km' : searchRadiusM + ' m')
      : null;
    setAutreStatus('spin', radiusLabel
      ? `Stations dans ${radiusLabel} autour de ${cityName}…`
      : `Stations à ${cityName}…`);

    const proximityClause = searchRadiusM != null
      ? ` and distance(geom, geom'POINT(${cityCoords.lon} ${cityCoords.lat})', ${searchRadiusM}m)`
      : '';
    const whereStep2 = searchRadiusM != null
      ? `e85_prix is not null${proximityClause}`
      : `${searchClause} and e85_prix is not null`;

    const resp = await fetch(PRIX_API + '?' + new URLSearchParams({ where:whereStep2, select:'adresse,ville,cp,e85_prix,sp98_prix,geom,services', limit:15 }));
    if (!resp.ok) throw new Error('HTTP ' + resp.status);
    const data = await resp.json();

    console.log(`[DEBUG] Stations autour de "${cityName}" (${radiusLabel||'ville seule'}) :`, data.results);

    if (!data.results?.length || !buildStations(data.results).length) {
      setAutreStatus('info', `Aucune station dans ce périmètre — affichage de la ville.`);
      return searchStationsCityOnly(searchClause, cityName);
    }

    const stations = buildStations(data.results);
    // Enrichissement OSM — nom enseigne (cohérent avec la géolocalisation)
    const osmNames = await enrichWithOsmSerial(stations, setAutreStatus);
    const stationsFinal = stations.map((s, i) => ({ ...s, name: osmNames[i] || s.name }));
    setAutreStatus('ok', radiusLabel
      ? stationsFinal.length + ' station(s) E85 dans ' + radiusLabel + ' autour de ' + cityName
      : stationsFinal.length + ' station(s) E85 à ' + cityName);
    renderNearby(stationsFinal);
    showMap(userLat, userLon, stationsFinal.map((s,i)=>({...s,src:'nearby',srcIdx:i})));
  } catch(e) {
    setAutreStatus('err','Erreur de recherche ('+e.message+').');
    console.error('[Suggestions]',e);
  }
}

async function searchStationsCityOnly(searchClause, cityName) {
  try {
    const resp=await fetch(PRIX_API+'?'+new URLSearchParams({ where:`${searchClause} and e85_prix is not null`, select:'adresse,ville,cp,e85_prix,sp98_prix,geom,services', limit:15 }));
    if (!resp.ok) throw new Error('HTTP '+resp.status);
    const data=await resp.json();
    if (!data.results?.length) { setAutreStatus('err','Aucune station E85 trouvée.'); return; }
    const stations=buildStations(data.results);
    if (!stations.length) { setAutreStatus('err','Aucune station E85 trouvée.'); return; }
    // Enrichissement OSM — nom enseigne (cohérent avec la géolocalisation)
    const osmNames = await enrichWithOsmSerial(stations, setAutreStatus);
    const stationsFinal = stations.map((s, i) => ({ ...s, name: osmNames[i] || s.name }));
    setAutreStatus('ok', stationsFinal.length+' station(s) E85 à '+cityName);
    renderNearby(stationsFinal);
    showMap(userLat,userLon,stationsFinal.map((s,i)=>({...s,src:'nearby',srcIdx:i})));
  } catch(e) { setAutreStatus('err','Erreur ('+e.message+').'); }
}

/* ─── Helpers API ─── */
function odsUrl(params) { return PRIX_API+'?'+new URLSearchParams(params).toString(); }

function setFieldPrice(id, value, defaultPh) {
  const el=document.getElementById(id), v=value?parseFloat(value):0;
  if (v>0) { el.value=v.toFixed(3); el.placeholder=defaultPh; el.classList.add('autofilled'); setTimeout(()=>el.classList.remove('autofilled'),6000); }
  else { el.value=''; el.placeholder='--'; }
}
function applyPricesResult(data) {
  const r=data.results[0], label=[r.adresse,r.ville].filter(Boolean).join(' · ');
  setFieldPrice('fPrix',currentType==='E85'?r.e85_prix:r.sp98_prix,currentType==='E85'?'0.798':'2.091');
  setFieldPrice('fPrixS98',r.sp98_prix,'2.091'); s98Autofilled=!!(r.sp98_prix); updateCout();
  const found=[];
  if (currentType==='E85'&&r.e85_prix) found.push('E85 : '+parseFloat(r.e85_prix).toFixed(3)+' €/L');
  if (r.sp98_prix) found.push('SP98 : '+parseFloat(r.sp98_prix).toFixed(3)+' €/L');
  found.length?setS98Status('ok',found.join(' · ')+(label?' — '+label:'')):(setS98Status('info','Aucun prix trouvé — code postal :'),showCpSearch());
}

async function fetchPricesAtCoords(lat, lon, fallbackToUser=false) {
  setS98Status('spin','Recherche des prix…'); hideCpSearch();
  for (const r of [500,2000,5000]) {
    try {
      const resp=await fetch(odsUrl({ where:`(e85_prix is not null or sp98_prix is not null) and distance(geom, geom'POINT(${lon} ${lat})', ${r}m)`, select:'e85_prix,sp98_prix,adresse,ville,services', limit:1 }));
      if (!resp.ok) throw new Error('HTTP '+resp.status);
      const data=await resp.json(); if (data.results?.length) { applyPricesResult(data); return; }
    } catch(e) { setS98Status('err','Erreur API ('+e.message+') — saisie manuelle.'); return; }
  }
  if (fallbackToUser&&userLat&&userLon&&haversine(lat,lon,userLat,userLon)>100) { await fetchPricesAtCoords(userLat,userLon,false); }
  else { setFieldPrice('fPrix',null,currentType==='E85'?'0.798':'2.091'); setFieldPrice('fPrixS98',null,'2.091'); updateCout(); setS98Status('info','Prix non trouvés — entrez le code postal :'); showCpSearch(); }
}

async function fetchPricesNearUser() {
  userLat&&userLon?await fetchPricesAtCoords(userLat,userLon,false):(setS98Status('info','Position inconnue — entrez le code postal :'),showCpSearch());
}

async function fetchPricesByCP() {
  const cp=document.getElementById('fCp').value.trim();
  if (cp.length!==5) { setS98Status('err','Code postal invalide (5 chiffres requis).'); return; }
  setS98Status('spin','Recherche dans '+cp+'…');
  try {
    const resp=await fetch(odsUrl({ where:`(e85_prix is not null OR sp98_prix is not null) AND cp="${cp}"`, select:'e85_prix,sp98_prix,adresse,ville,services', limit:1 }));
    if (!resp.ok) throw new Error('HTTP '+resp.status);
    const data=await resp.json();
    data.results?.length?(hideCpSearch(),applyPricesResult(data)):setS98Status('info','Aucune station trouvée pour '+cp+' — saisie manuelle.');
  } catch(e) { setS98Status('err','Erreur ('+e.message+') — saisie manuelle.'); }
}

function showCpSearch() { document.getElementById('cpSearch').classList.remove('hidden'); document.getElementById('fCp').focus(); }
function hideCpSearch()  { document.getElementById('cpSearch').classList.add('hidden'); document.getElementById('fCp').value=''; }
function setS98Status(cls,msg) { const el=document.getElementById('s98Status'); el.className='s98-status '+cls; el.textContent=msg; }
function setGeoStatus(cls,msg) { const el=document.getElementById('geoStatus'); el.className='geo-status '+cls; el.textContent=msg; }

function haversine(lat1,lon1,lat2,lon2) {
  const R=6371000,dLat=(lat2-lat1)*Math.PI/180,dLon=(lon2-lon1)*Math.PI/180;
  const a=Math.sin(dLat/2)**2+Math.cos(lat1*Math.PI/180)*Math.cos(lat2*Math.PI/180)*Math.sin(dLon/2)**2;
  return R*2*Math.atan2(Math.sqrt(a),Math.sqrt(1-a));
}

async function submitForm() {
  const date=document.getElementById('fDate').value, km=document.getElementById('fKm').value.trim();
  const litres=document.getElementById('fLitres').value.trim(), prix=document.getElementById('fPrix').value.trim();
  const prixS98=document.getElementById('fPrixS98').value.trim(), vehicule=currentVehiculeNom||'';
  let station=document.getElementById('stationSel').value;
  if (station==='__autre') station=document.getElementById('fAutre').value.trim();
  if (!date||!km||!litres||!prix) { showFeedback('error','Champs manquants','Date, km, litres et prix sont obligatoires.'); return; }
  if (!station) { showFeedback('error','Station manquante','Sélectionnez ou saisissez le nom de la station.'); return; }
  if (currentType==='E85'&&!prixS98) if (!confirm('Prix S98 du jour non saisi. Continuer quand même ?')) return;
  setSubmitState(true);
  try {
    const json=await fetch(GAS_URL,{method:'POST',redirect:'follow',body:JSON.stringify({
      date, type:currentType==='E85'?'SuperEthanol E85':'Super 98', km, litres, prix, prixS98, station, vehicule
    })}).then(r=>r.json());
    if (json.success) { showFeedback('success','Plein enregistré ✓',json.message||litres+' L à '+prix+' €/L — '+station); await syncStationSiNouvelle(station); resetForm(); }
    else showFeedback('error','Erreur serveur',json.error||'Veuillez réessayer.');
  } catch(e) { showFeedback('error','Connexion impossible','Vérifiez votre accès internet.'); }
  finally { setSubmitState(false); }
}

function setSubmitState(loading) {
  document.getElementById('submitBtn').disabled=loading;
  document.getElementById('submitIcon').textContent=loading?'⏳':'✓';
  document.getElementById('submitText').textContent=loading?'Enregistrement…':'Enregistrer le plein';
}
function showFeedback(type,title,msg) {
  const el=document.getElementById('feedback'); el.className='feedback '+type; el.innerHTML='<strong>'+title+'</strong>'+msg;
  el.style.display='block'; el.scrollIntoView({behavior:'smooth',block:'nearest'});
  if (type==='success') setTimeout(()=>el.style.display='none',5000);
}
function resetForm() {
  const n=new Date();
  document.getElementById('fDate').value=n.getFullYear()+'-'+String(n.getMonth()+1).padStart(2,'0')+'-'+String(n.getDate()).padStart(2,'0');
  ['fKm','fLitres','fAutre'].forEach(id=>document.getElementById(id).value='');
  const fp=document.getElementById('fPrix'); fp.value=''; fp.placeholder=currentType==='E85'?'0.798':'2.091'; fp.classList.remove('autofilled');
  const fs=document.getElementById('fPrixS98'); fs.value=''; fs.placeholder='2.091'; fs.classList.remove('autofilled');
  document.getElementById('stationSel').value=''; document.getElementById('coutBox').style.display='none';
  document.getElementById('nearbyList').style.display='none'; document.getElementById('autreField').classList.add('hidden');
  document.getElementById('s98Status').className='s98-status'; document.getElementById('s98Status').textContent='';
  setAutreStatus('',''); hideCpSearch(); s98Autofilled=false;
  // Véhicule conservé intentionnellement (sélection + localStorage)
}

async function syncStationSiNouvelle(nom) {
  if (!nom) return;
  const group=document.getElementById('knownGroup');
  const options=Array.from(group.querySelectorAll('option')).map(o=>o.value.toLowerCase()).filter(v=>v!=='__autre');
  if (options.includes(nom.toLowerCase())) return;
  try {
    await fetch(GAS_URL,{method:'POST',redirect:'follow',body:JSON.stringify({action:'addStation',station:nom})});
    group.insertBefore(new Option(nom,nom),group.querySelector('[value="__autre"]'));
  } catch(e) { console.warn('[Stations] Sync échouée :',e.message); }
}

async function chargerStations() {
  const url='https://docs.google.com/spreadsheets/d/'+GS_SHEET_ID+'/gviz/tq?tqx=out:csv&sheet=Stations';
  try {
    const resp=await fetch(url); if (!resp.ok) throw new Error('HTTP '+resp.status);
    const csv=await resp.text(), group=document.getElementById('knownGroup');
    Array.from(group.querySelectorAll('option:not([value="__autre"])')).forEach(o=>o.remove());
    const autreOpt=group.querySelector('[value="__autre"]');
    csv.split('\n').map(l=>l.trim().replace(/^"|"$/g,'')).slice(1).filter(s=>s&&s!=='__autre')
      .forEach(nom=>group.insertBefore(new Option(nom,nom),autreOpt));
  } catch(e) {
    console.warn('Chargement stations échoué :',e.message);
    ['Carrefour Flers','Intermarché','Leclerc Douai','Total Access','Total Waziers',
     'ZONE DU MOULIN RUE ARTHUR LAMENDIN — Beuvry'].forEach(nom=>{
      const g=document.getElementById('knownGroup'); g.insertBefore(new Option(nom,nom),g.querySelector('[value="__autre"]'));
    });
  }
}

chargerStations();
chargerVehicules(); // async : cache local immédiat + rechargement GS en arrière-plan
document.getElementById('appVersion').textContent='v'+APP_VERSION;
