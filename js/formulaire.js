/* ─── Formulaire — soumission, réinitialisation et auto-save brouillon (W15) ─── */
import { FUEL_CONFIG, FUEL_KEYS, GAS_URL, APP_TOKEN, DRAFT_KEY, CLIENT_ID_KEY } from './config.js';
import { state } from './state.js';
import { setAutreStatus, hideCpSearch, setSubmitState, showFeedback, computeTriplet } from './ui.js';
import { _buildTypeToggle, _updateHeaderBadges } from './carburant.js';
import { fetchPricesNearUser, fetchPricesAtCoords, fetchNearestE85Price, fetchStationPricesSilent, evalRentabiliteE85 } from './prix.js';
import { cancelOsmEnrich } from './osm.js';
import { getStationCoords } from './stationsmap.js';
import { syncStationSiNouvelle } from './stations.js';
import { getMaxKmForVehicule, getAllRecords, updateLocalRecord } from './historique.js';
import { setCurrentVehicule } from './vehicules.js';
import { updateRentabilite } from './rentabilite.js';
import { queuePlein, updateOfflineBadge } from './offline.js';
import { getIdToken, isAuthed, authEnabled, promptLogin } from './auth.js';

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

/** Identifiant unique d'un NOUVEAU plein, généré côté client AVANT l'envoi :
 *  le même sync_id accompagne le payload mis en file hors-ligne puis rejoué,
 *  ce qui rend l'enregistrement idempotent côté GAS (pas de doublon si la
 *  1re requête avait abouti malgré une réponse perdue).
 *  Exporté (préfixe `_`) pour les tests unitaires — usage interne uniquement. */
export function _newSyncId() {
  try {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
      return crypto.randomUUID();
    }
  } catch { /* contexte non sécurisé : repli ci-dessous */ }
  const hex = n => Array.from({ length: n }, () => Math.floor(Math.random() * 16).toString(16)).join('');
  return hex(8) + '-' + hex(4) + '-4' + hex(3) + '-' + (8 + Math.floor(Math.random() * 4)).toString(16) + hex(3) + '-' + hex(12);
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
    const cout   = document.getElementById('fCout')?.value   || '';
    const autre  = document.getElementById('fAutre')?.value  || '';
    // Ne sauvegarder que si au moins un champ rempli
    if (!km && !litres && !prix && !autre) return;
    localStorage.setItem(DRAFT_KEY, JSON.stringify({
      date:    document.getElementById('fDate')?.value    || '',
      km, litres, prix, cout, autre,
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
    if (d.prix)   document.getElementById('fPrix').value   = d.prix;
    if (d.cout)   document.getElementById('fCout').value   = d.cout;

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
    if (!document.getElementById('fCout')?.value) computeTriplet('litres');
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
  cancelOsmEnrich();   // P5 — choisir une station (liste déroulante) arrête la recherche/renommage OSM en cours
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
    // P4 — prix À LA STATION choisie (coords mémorisées) plutôt qu'autour du GPS courant :
    // garantit que les prix tous-carburants (colonnes I→N) sont relevés pour la bonne station,
    // y compris lors d'une duplication du dernier plein faite à distance de la station.
    const coords = getStationCoords(sel.value);
    if (coords) {
      state._selectedLat = coords.lat; state._selectedLon = coords.lon;
      fetchPricesAtCoords(coords.lat, coords.lon, true);
    } else {
      state._selectedLat = null; state._selectedLon = null;
      fetchPricesNearUser();
    }
  }
}

/* ═══════════════════════════════════════
   W92 — Modification d'un plein existant
   Le formulaire d'ajout est réutilisé en « mode édition » : pré-rempli avec le
   plein sélectionné, sa validation MET À JOUR la ligne (action GAS updatePlein
   par sync_id) au lieu d'en créer une nouvelle. Les pleins sans sync_id (locaux
   / doublons fantômes) sont mis à jour uniquement dans le cache local.
   ═══════════════════════════════════════ */

let _editRecord = null;   // enregistrement en cours d'édition (référence de _allRecords), ou null

/** Vrai si le formulaire est en mode édition (une ligne existante est modifiée). */
export function isEditingPlein() { return _editRecord != null; }

/** Bascule l'UI du formulaire en mode ajout/édition (libellé bouton + bandeau). */
function _setEditUI(on) {
  const txt = document.getElementById('submitText');
  if (txt) txt.textContent = on ? 'Mettre à jour le plein' : 'Enregistrer le plein';
  const banner = document.getElementById('editBanner');
  if (banner) banner.hidden = !on;
}

/** Sort du mode édition (remet l'UI en mode ajout). N'efface pas les champs. */
function _endEdit() { _editRecord = null; _setEditUI(false); }

/** Date d'un enregistrement au format input `yyyy-mm-dd`. */
function _isoInputDate(s) {
  const d = new Date(String(s || '').replace(' ', 'T'));
  if (isNaN(d)) return String(s || '').slice(0, 10);
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}

/**
 * W92 — Ouvre le formulaire en mode édition, pré-rempli avec `record`.
 * Appelée depuis main.js sur l'événement `plein-edit-request`.
 */
export function beginEditPlein(record) {
  if (!record) return;
  _editRecord = record;

  // Véhicule (source unique de vérité — met aussi à jour state.currentVehiculeNom
  // lu par submitForm), AVANT le type/station qui en dépendent.
  const veh = record['Véhicule'] || record['Vehicule'] || '';
  if (veh) setCurrentVehicule(veh);

  // Type de carburant (via le toggle global window.setType)
  const typeKey = Object.keys(FUEL_CONFIG).find(k => FUEL_CONFIG[k].label === record.Type);
  if (typeKey && typeof window.setType === 'function') window.setType(typeKey);

  // Station (sélecteur, avec repli « __autre » + champ libre)
  const station = record['Station essence'] || '';
  const sel = document.getElementById('stationSel');
  if (sel) {
    if (Array.from(sel.options).some(o => o.value === station)) {
      sel.value = station;
    } else if (station) {
      sel.value = '__autre';
      const fa = document.getElementById('fAutre');
      if (fa) fa.value = station;
    }
    sel.dispatchEvent(new Event('change'));
  }

  // Valeurs numériques EN DERNIER (le changement de type/station peut auto-remplir le prix).
  const setVal = (id, v) => { const el = document.getElementById(id); if (el) el.value = (v === '' || v == null) ? '' : v; };
  setVal('fDate',   _isoInputDate(record.Date || record.Horodatage));
  setVal('fKm',     Number(record['Km compteur'] || 0) || '');
  setVal('fLitres', Number(record['Nb. Litres']  || 0) || '');
  const fp = document.getElementById('fPrix');
  if (fp) { fp.value = Number(record['Prix €/L'] || 0) || ''; fp.classList.remove('autofilled'); }
  setVal('fCout',   record['Coût €'] ? Number(record['Coût €']) : '');

  _setEditUI(true);
  const form = document.getElementById('view-saisie');
  if (form) form.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

/** W92 — Annule la modification en cours et remet le formulaire à zéro. */
export function cancelEditPlein() {
  if (!_editRecord) return;
  resetForm();   // resetForm() sort aussi du mode édition (via _endEdit)
  showFeedback('info', 'Modification annulée', 'Le plein n\'a pas été modifié.');
}

export async function submitForm() {
  // U7 — l'enregistrement d'un plein est réservé aux comptes connectés (si l'auth est active).
  if (authEnabled() && !isAuthed()) {
    showFeedback('info', '🔒 Connexion requise', 'Connectez-vous avec Google pour enregistrer vos pleins.');
    promptLogin();
    return;
  }
  const date    = document.getElementById('fDate').value;
  const km      = document.getElementById('fKm').value.trim();
  const litres  = document.getElementById('fLitres').value.trim();
  const prix    = document.getElementById('fPrix').value.trim();
  const cout    = document.getElementById('fCout').value.trim();
  const vehicule = state.currentVehiculeNom || '';
  let station = document.getElementById('stationSel').value;
  if (station === '__autre') station = document.getElementById('fAutre').value.trim();
  if (!date || !km || !litres || !prix) { showFeedback('error', 'Champs manquants', 'Date, km, litres et prix sont obligatoires.'); return; }
  if (!station) { showFeedback('error', 'Station manquante', 'Sélectionnez ou saisissez le nom de la station.'); return; }

  // W92 — plein en cours d'édition (capturé avant tout reset)
  const editRec = _editRecord;

  // Détection doublon (date + km + litres identiques) — en édition, on s'ignore soi-même.
  const kmN2  = Number(km);
  const litN2 = Math.round(Number(litres) * 100);
  const dupeFound = getAllRecords().find(r => {
    if (editRec && r === editRec) return false;
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

  // Validation km rétrograde — ignorée en édition (la ligne existe déjà légitimement).
  const lastKm = editRec ? null : getMaxKmForVehicule(vehicule);
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

  // Prix station pour tous les carburants disponibles lors du plein.
  // Cause racine du bug d'import (#VALEUR! dernière ligne du dashboard) : si la
  // liste multi-carburants n'a pas eu le temps de se charger pour la station,
  // `state._stationPrices` est vide et seul l'E85 de repli partait → les 5 autres
  // prix station manquaient côté Sheet/Excel. Correctif : recharger silencieusement
  // les 6 prix station à la soumission (sans effet de bord UI) avant de bâtir le payload.
  let sp = state._stationPrices;
  if (Object.keys(sp).length === 0) {
    const lat = state._selectedLat || state.userLat;
    const lon = state._selectedLon || state.userLon;
    if (lat && lon) sp = await fetchStationPricesSilent(lat, lon);
  }
  const stationPrices = Object.keys(sp).length > 0
    ? Object.fromEntries(FUEL_KEYS.map(k => [k, sp[k] || '']))
    : {};

  // Garantir le prix E85 même pour les pleins non-E85 (ou station sans coords)
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
    km, litres, prix, cout: cout ? Number(cout) : '', station, vehicule, stationPrices,
    cid: _getClientId(),   // S7 — rate limiting côté GAS
    token: APP_TOKEN,      // S6 — token secret (souple)
    idToken: getIdToken(), // U7 — identité du compte (JWT vérifié côté GAS)
  };

  // W9 — joindre la photo du ticket si disponible
  if (state._ticketPhoto) payload.ticketPhoto = state._ticketPhoto;

  // ── W92 — MODE ÉDITION : met à jour un plein existant (pas de nouvelle ligne) ──
  if (editRec) {
    const syncId = String(editRec.sync_id || editRec['sync_id'] || '');
    // Champs reflétés dans le cache local après succès (mêmes clés que l'export GAS).
    const patch = {
      'Date': date, 'Type': payload.type, 'Km compteur': Number(km),
      'Nb. Litres': Number(litres), 'Prix €/L': Number(prix),
      'Station essence': station, 'Véhicule': vehicule,
      'Coût €': cout ? Number(cout) : '',
    };
    // Plein SANS sync_id : ligne purement locale (jamais synchronisée / doublon
    // fantôme) → le serveur ne la connaît pas, on met à jour le cache uniquement.
    if (!syncId) {
      updateLocalRecord(editRec, patch);
      resetForm();
      window.dispatchEvent(new window.CustomEvent('plein-added'));
      showFeedback('success', 'Plein modifié ✓', 'Doublon local mis à jour sur cet appareil.');
      setSubmitState(false);
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }
    try {
      const json = await fetch(GAS_URL, {
        method: 'POST', redirect: 'follow',
        body: JSON.stringify({ ...payload, action: 'updatePlein', sync_id: syncId }),
      }).then(r => r.json());
      if (json.success) {
        updateLocalRecord(editRec, patch);
        await syncStationSiNouvelle(station);
        resetForm();
        window.dispatchEvent(new window.CustomEvent('plein-added'));   // W64 — MAJ globale
        showFeedback('success', 'Plein mis à jour ✓', litres + ' L à ' + prix + ' €/L — ' + station);
        window.scrollTo({ top: 0, behavior: 'smooth' });
      } else {
        showFeedback('error', 'Modification refusée', json.error || 'Veuillez réessayer.');
      }
    } catch (e) {
      // Une modification ne peut pas être mise en file hors-ligne (updatePlein cible
      // une ligne serveur) → on garde le mode édition pour un nouvel essai.
      showFeedback('error', 'Modification impossible',
        (!navigator.onLine || e instanceof TypeError)
          ? 'Connexion requise pour modifier un plein.'
          : (e.message || 'erreur réseau'));
    } finally {
      setSubmitState(false);
    }
    return;
  }

  // Envoi idempotent : sync_id fixé côté client avant l'envoi (cf. _newSyncId).
  payload.sync_id = _newSyncId();

  /* ── Envoi réseau ────────────────────────────────────────────────────
   * Hors-ligne (NetworkError / TypeError) → file d'attente localStorage
   * (même payload, donc même sync_id, rejoué à l'identique)
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
      // W64 — MAJ globale après un plein : le hub refreshAfterPlein (main.js)
      // recharge l'historique ET rafraîchit KPIs / sparkline prix / CO2 / budget /
      // prédiction / Wrapped / badges / accueil + invalide le cache agrégats serveur.
      window.dispatchEvent(new window.CustomEvent('plein-added'));
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

/** Convertit une chaîne parlée en entier (gère chiffres + mots français courants).
 *  Exporté (préfixe `_`) pour les tests unitaires — usage interne uniquement. */
export function _parseSpeechToNumber(text) {
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
  _endEdit();   // W92 — quitter le mode édition (remet le libellé du bouton + masque le bandeau)
  clearDraft(); // W15 — effacer le brouillon après submit ou reset
  const n = new Date();
  document.getElementById('fDate').value = n.getFullYear() + '-' + String(n.getMonth()+1).padStart(2,'0') + '-' + String(n.getDate()).padStart(2,'0');
  ['fKm', 'fLitres', 'fCout', 'fAutre'].forEach(id => { const el = document.getElementById(id); if (el) el.value = ''; });
  const fp = document.getElementById('fPrix'); fp.value = ''; fp.placeholder = FUEL_CONFIG[state.currentType].ph; fp.classList.remove('autofilled');
  document.getElementById('stationSel').value = '';
  document.getElementById('nearbyList').style.display = 'none';
  document.getElementById('autreField').classList.add('hidden');
  document.getElementById('s98Status').className = 's98-status';
  document.getElementById('s98Status').textContent = '';
  setAutreStatus('', ''); hideCpSearch();
  state._stationPrices = {}; _buildTypeToggle({}); _updateHeaderBadges();
  evalRentabiliteE85();
  updateRentabilite();

  // W9 — effacer la photo du ticket
  state._ticketPhoto = null;
  const photoIndicator = document.getElementById('ticketPhotoIndicator');
  if (photoIndicator) photoIndicator.hidden = true;
}
