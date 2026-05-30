/* ─── Formulaire — soumission, réinitialisation et auto-save brouillon (W15) ─── */
import { FUEL_CONFIG, FUEL_KEYS, GAS_URL, APP_TOKEN, DRAFT_KEY, CLIENT_ID_KEY } from './config.js';
import { state } from './state.js';
import { setAutreStatus, hideCpSearch, setSubmitState, showFeedback, updateCout } from './ui.js';
import { _buildTypeToggle, _updateHeaderBadges } from './carburant.js';
import { fetchPricesNearUser, fetchNearestE85Price, evalRentabiliteE85 } from './prix.js';
import { syncStationSiNouvelle } from './stations.js';
import { chargerHistorique, getMaxKmForVehicule, getAllRecords } from './historique.js';
import { updateRentabilite } from './rentabilite.js';
import { queuePlein, updateOfflineBadge } from './offline.js';

/* ─── Client ID persistant (S7 rate limiting) ─── */
function _getClientId() {
  try {
    let id = localStorage.getItem(CLIENT_ID_KEY);
    if (!id) {
      id = crypto.randomUUID
        ? crypto.randomUUID()
        : (Date.now().toString(36) + Math.random().toString(36).slice(2));
      localStorage.setItem(CLIENT_ID_KEY, id);
    }
    return id;
  } catch { return ''; }
}

/* ═══════════════════════════════════════
   W15 — Auto-save brouillon
   ═══════════════════════════════════════ */

/** Sauvegarde l'état courant du formulaire dans localStorage. */
export function saveDraft() {
  try {
    const km     = document.getElementById('fKm')?.value     || '';
    const litres = document.getElementById('fLitres')?.value || '';
    const prix   = document.getElementById('fPrix')?.value   || '';
    const autre  = document.getElementById('fAutre')?.value  || '';
    // Ne sauvegarder que si au moins un champ rempli
    if (!km && !litres && !prix && !autre) return;
    localStorage.setItem(DRAFT_KEY, JSON.stringify({
      date:    document.getElementById('fDate')?.value    || '',
      km, litres, prix, autre,
      station: document.getElementById('stationSel')?.value || '',
      type:    state.currentType,
    }));
  } catch { /* quota / private mode */ }
}

/** Restaure le brouillon depuis localStorage. Retourne l'objet draft ou null. */
export function restoreDraft() {
  try {
    const raw = localStorage.getItem(DRAFT_KEY);
    if (!raw) return null;
    const d = JSON.parse(raw);
    if (!d.km && !d.litres && !d.prix && !d.autre) return null;

    if (d.date)   document.getElementById('fDate').value   = d.date;
    if (d.km)     document.getElementById('fKm').value     = d.km;
    if (d.litres) document.getElementById('fLitres').value = d.litres;
    if (d.prix)   { document.getElementById('fPrix').value = d.prix; }

    if (d.autre) {
      document.getElementById('fAutre').value = d.autre;
      const sel = document.getElementById('stationSel');
      if (sel) sel.value = '__autre';
      document.getElementById('autreField')?.classList.remove('hidden');
    } else if (d.station) {
      const sel = document.getElementById('stationSel');
      if (sel && Array.from(sel.options).some(o => o.value === d.station)) {
        sel.value = d.station;
      }
    }
    updateCout();
    onKmInput();    // déclenche le warning rétrograde si le km du brouillon est invalide
    checkDuplicate();
    return d;
  } catch { return null; }
}

/** Efface le brouillon (appelé après soumission réussie ou reset). */
export function clearDraft() {
  try { localStorage.removeItem(DRAFT_KEY); } catch { /* quota */ }
}

/* ═══════════════════════════════════════
   Détection doublon + validation km
   ═══════════════════════════════════════ */

/**
 * Détection de doublon : warning si date + km + litres identiques à un enregistrement existant.
 * Appelée sur oninput de fDate, fKm, fLitres.
 */
export function checkDuplicate() {
  const warn   = document.getElementById('dupeWarn');
  if (!warn) return;

  const date   = document.getElementById('fDate').value;
  const km     = document.getElementById('fKm').value.trim();
  const litres = document.getElementById('fLitres').value.trim();

  if (!date || !km || !litres) { warn.hidden = true; return; }

  const kmN  = Number(km);
  const litN = Math.round(Number(litres) * 100);

  const found = getAllRecords().find(r => {
    const rDate = String(r.Date || r.Horodatage || '').slice(0, 10);
    const rKm   = Number(r['Km compteur'] || 0);
    const rLit  = Math.round(Number(r['Nb. Litres'] || 0) * 100);
    return rDate === date && rKm === kmN && rLit === litN;
  });

  if (found) {
    const d = new Date(date);
    const label = isNaN(d) ? date
      : String(d.getDate()).padStart(2,'0') + '/'
      + String(d.getMonth()+1).padStart(2,'0') + '/'
      + d.getFullYear();
    warn.textContent = `⚠️ Doublon probable — un plein de ${Number(litres).toFixed(2)} L à ${km} km existe déjà le ${label}.`;
    warn.hidden = false;
  } else {
    warn.hidden = true;
  }
}

/** Validation live du km saisi par rapport au dernier plein du véhicule courant. */
export function onKmInput() {
  const el = document.getElementById('kmWarn');
  if (!el) return;

  const km = Number(document.getElementById('fKm').value);
  const lastKm = getMaxKmForVehicule(state.currentVehiculeNom);

  if (!lastKm || !km) { el.textContent = ''; el.className = 'km-warn'; return; }

  const fmt = lastKm.toLocaleString('fr-FR');
  if (km < lastKm) {
    el.textContent = '⚠️ Inférieur au dernier plein (' + fmt + ' km)';
    el.className   = 'km-warn err';
  } else if (km === lastKm) {
    el.textContent = '⚠️ Identique au dernier plein';
    el.className   = 'km-warn info';
  } else {
    el.textContent = '✓ +' + (km - lastKm).toLocaleString('fr-FR') + ' km depuis le dernier plein';
    el.className   = 'km-warn ok';
  }
}

export function onStationChange() {
  const sel = document.getElementById('stationSel'), isManual = sel.value === '__autre';
  document.getElementById('autreField').classList.toggle('hidden', !isManual);
  if (!isManual) {
    document.getElementById('nearbyList').style.display = 'none';
    document.getElementById('fAutre').value = '';
    setAutreStatus('', '');
  }
  if (sel.value && !isManual) {
    state._stationPrices = {}; _buildTypeToggle({}); _updateHeaderBadges();
    evalRentabiliteE85();
    fetchPricesNearUser();
  }
}

export async function submitForm() {
  const date    = document.getElementById('fDate').value;
  const km      = document.getElementById('fKm').value.trim();
  const litres  = document.getElementById('fLitres').value.trim();
  const prix    = document.getElementById('fPrix').value.trim();
  const vehicule = state.currentVehiculeNom || '';
  let station = document.getElementById('stationSel').value;
  if (station === '__autre') station = document.getElementById('fAutre').value.trim();
  if (!date || !km || !litres || !prix) { showFeedback('error', 'Champs manquants', 'Date, km, litres et prix sont obligatoires.'); return; }
  if (!station) { showFeedback('error', 'Station manquante', 'Sélectionnez ou saisissez le nom de la station.'); return; }

  // Détection doublon (date + km + litres identiques)
  const kmN2  = Number(km);
  const litN2 = Math.round(Number(litres) * 100);
  const dupeFound = getAllRecords().find(r => {
    const rDate = String(r.Date || r.Horodatage || '').slice(0, 10);
    return rDate === date && Number(r['Km compteur']||0) === kmN2
        && Math.round(Number(r['Nb. Litres']||0)*100) === litN2;
  });
  if (dupeFound) {
    const ok = confirm(
      '⚠️ Doublon détecté\n\n' +
      'Un plein de ' + litres + ' L à ' + km + ' km existe déjà pour cette date.\n\n' +
      'Continuer quand même ?'
    );
    if (!ok) return;
  }

  // Validation km rétrograde
  const lastKm = getMaxKmForVehicule(vehicule);
  if (lastKm && Number(km) < lastKm) {
    const fmt = lastKm.toLocaleString('fr-FR');
    const ok = confirm(
      '⚠️ Kilométrage rétrograde\n\n' +
      'Saisi         : ' + Number(km).toLocaleString('fr-FR') + ' km\n' +
      'Dernier plein : ' + fmt + ' km\n\n' +
      'Continuer quand même ?'
    );
    if (!ok) return;
  }

  setSubmitState(true);

  // Prix station pour tous les carburants disponibles lors du plein
  const stationPrices = Object.keys(state._stationPrices).length > 0
    ? Object.fromEntries(FUEL_KEYS.map(k => [k, state._stationPrices[k] || '']))
    : {};

  // Garantir le prix E85 même pour les pleins non-E85
  if (!stationPrices.E85) {
    const lat = state._selectedLat || state.userLat;
    const lon = state._selectedLon || state.userLon;
    if (lat && lon) {
      const e85Price = await fetchNearestE85Price(lat, lon);
      if (e85Price) stationPrices.E85 = e85Price;
    }
  }

  const payload = {
    date, type: FUEL_CONFIG[state.currentType].label,
    km, litres, prix, station, vehicule, stationPrices,
    cid: _getClientId(),   // S7 — rate limiting côté GAS
    token: APP_TOKEN,      // S6 — token secret (souple)
  };

  // W9 — joindre la photo du ticket si disponible
  if (state._ticketPhoto) payload.ticketPhoto = state._ticketPhoto;

  /* ── Envoi réseau ────────────────────────────────────────────────────
   * Hors-ligne (NetworkError / TypeError) → file d'attente localStorage
   * ─────────────────────────────────────────────────────────────────── */
  try {
    const json = await fetch(GAS_URL, {
      method: 'POST', redirect: 'follow',
      body: JSON.stringify(payload),
    }).then(r => r.json());

    if (json.success) {
      showFeedback('success', 'Plein enregistré ✓', json.message || litres + ' L à ' + prix + ' €/L — ' + station);
      await syncStationSiNouvelle(station);
      resetForm();
      chargerHistorique();
      window.scrollTo({ top: 0, behavior: 'smooth' }); // W24
    } else {
      showFeedback('error', 'Erreur serveur', json.error || 'Veuillez réessayer.');
    }

  } catch (e) {
    /* Détection hors-ligne : NetworkError ou pas de connexion */
    if (!navigator.onLine || e instanceof TypeError) {
      queuePlein(payload);
      showFeedback(
        'info',
        '📵 Enregistré hors-ligne',
        `Le plein de ${litres} L sera synchronisé au retour de la connexion.`
      );
      resetForm();
      updateOfflineBadge();
      window.scrollTo({ top: 0, behavior: 'smooth' }); // W24
    } else {
      showFeedback('error', 'Connexion impossible', 'Vérifiez votre accès internet.');
    }
  } finally {
    setSubmitState(false);
  }
}

/* ═══════════════════════════════════════
   W35 — Saisie km par dictée vocale
   ═══════════════════════════════════════ */

/** Convertit une chaîne parlée en entier (gère chiffres + mots français courants). */
function _parseSpeechToNumber(text) {
  const t = text.trim().toLowerCase();
  // Cas numérique direct : "12 430", "12.430", "12,430", "12430"
  const stripped = t.replace(/[\s.,]/g, '');
  if (/^\d+$/.test(stripped)) return parseInt(stripped, 10);
  // Premier bloc de chiffres séparés par espaces/ponctuation
  const m = t.match(/\d[\d\s.,]*/);
  if (m) {
    const n = parseInt(m[0].replace(/[\s.,]/g, ''), 10);
    if (!isNaN(n) && n > 0) return n;
  }
  // Mots français (fallback)
  const UNITS = {
    'zéro':0,'zero':0,'un':1,'une':1,'deux':2,'trois':3,'quatre':4,
    'cinq':5,'six':6,'sept':7,'huit':8,'neuf':9,'dix':10,'onze':11,
    'douze':12,'treize':13,'quatorze':14,'quinze':15,'seize':16,
    'dix-sept':17,'dix-huit':18,'dix-neuf':19,'vingt':20,'trente':30,
    'quarante':40,'cinquante':50,'soixante':60,'soixante-dix':70,
    'quatre-vingt':80,'quatre-vingt-dix':90,'cent':100,'cents':100,'mille':1000,
  };
  let total = 0, current = 0;
  for (const w of t.split(/[\s-]+/)) {
    const v = UNITS[w];
    if (v === undefined) continue;
    if (v === 1000) { current = current || 1; total += current * 1000; current = 0; }
    else if (v === 100) { current = current || 1; current *= 100; }
    else current += v;
  }
  total += current;
  return total > 0 ? total : NaN;
}

/**
 * W35 — Initialise le bouton 🎤 pour dicter le kilométrage.
 * Masqué automatiquement si SpeechRecognition n'est pas disponible.
 */
export function initVoiceKm() {
  const btn = document.getElementById('voiceKmBtn');
  if (!btn) return;
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SR) { btn.style.display = 'none'; return; }

  const rec = new SR();
  rec.lang = 'fr-FR';
  rec.continuous = false;
  rec.interimResults = false;

  let listening = false;

  const stop = () => {
    listening = false;
    btn.classList.remove('mic-active');
    btn.title = 'Dicter le kilométrage';
  };

  rec.onresult = e => {
    const transcript = e.results[0][0].transcript;
    const num = _parseSpeechToNumber(transcript);
    if (num > 0) {
      const inp = document.getElementById('fKm');
      if (inp) {
        inp.value = num;
        onKmInput();
        checkDuplicate();
        saveDraft();
      }
    }
    stop();
  };
  rec.onerror = stop;
  rec.onend   = stop;

  btn.addEventListener('click', () => {
    if (listening) {
      rec.stop();
    } else {
      listening = true;
      btn.classList.add('mic-active');
      btn.title = 'Écoute en cours…';
      try { rec.start(); } catch { stop(); }
    }
  });
}

export function resetForm() {
  clearDraft(); // W15 — effacer le brouillon après submit ou reset
  const n = new Date();
  document.getElementById('fDate').value = n.getFullYear() + '-' + String(n.getMonth()+1).padStart(2,'0') + '-' + String(n.getDate()).padStart(2,'0');
  ['fKm', 'fLitres', 'fAutre'].forEach(id => document.getElementById(id).value = '');
  const fp = document.getElementById('fPrix'); fp.value = ''; fp.placeholder = FUEL_CONFIG[state.currentType].ph; fp.classList.remove('autofilled');
  document.getElementById('stationSel').value = '';
  document.getElementById('coutBox').style.display = 'none';
  document.getElementById('nearbyList').style.display = 'none';
  document.getElementById('autreField').classList.add('hidden');
  document.getElementById('s98Status').className = 's98-status';
  document.getElementById('s98Status').textContent = '';
  setAutreStatus('', ''); hideCpSearch();
  state._stationPrices = {}; _buildTypeToggle({}); _updateHeaderBadges();
  evalRentabiliteE85();
  updateCout();
  updateRentabilite();

  // W9 — effacer la photo du ticket
  state._ticketPhoto = null;
  const photoIndicator = document.getElementById('ticketPhotoIndicator');
  if (photoIndicator) photoIndicator.hidden = true;
}
