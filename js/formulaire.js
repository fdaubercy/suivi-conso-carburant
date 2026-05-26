/* ─── Formulaire — soumission et réinitialisation ─── */
import { FUEL_CONFIG, FUEL_KEYS, GAS_URL } from './config.js';
import { state } from './state.js';
import { setAutreStatus, hideCpSearch, setSubmitState, showFeedback, updateCout } from './ui.js';
import { _buildTypeToggle, _updateHeaderBadges } from './carburant.js';
import { fetchPricesNearUser, fetchNearestE85Price, evalRentabiliteE85 } from './prix.js';
import { syncStationSiNouvelle } from './stations.js';
import { chargerHistorique, getMaxKmForVehicule, getAllRecords } from './historique.js';
import { updateRentabilite } from './rentabilite.js';

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
  const litN = Math.round(Number(litres) * 100); // compare en centilitres (évite les flottants)

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
    evalRentabiliteE85();   // reset le badge en attendant les nouveaux prix
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

  // Validation km rétrograde : confirme si km < dernier_km du véhicule courant
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

  // Garantir le prix E85 même pour les pleins non-E85 (référence de comparaison)
  if (!stationPrices.E85) {
    const lat = state._selectedLat || state.userLat;
    const lon = state._selectedLon || state.userLon;
    if (lat && lon) {
      const e85Price = await fetchNearestE85Price(lat, lon);
      if (e85Price) stationPrices.E85 = e85Price;
    }
  }

  try {
    const json = await fetch(GAS_URL, {
      method: 'POST', redirect: 'follow',
      body: JSON.stringify({ date, type: FUEL_CONFIG[state.currentType].label, km, litres, prix, station, vehicule, stationPrices })
    }).then(r => r.json());
    if (json.success) {
      showFeedback('success', 'Plein enregistré ✓', json.message || litres + ' L à ' + prix + ' €/L — ' + station);
      await syncStationSiNouvelle(station);
      resetForm();
      chargerHistorique();   // refresh la liste pour voir le plein qui vient d'etre ajoute
    } else {
      showFeedback('error', 'Erreur serveur', json.error || 'Veuillez réessayer.');
    }
  } catch(e) { showFeedback('error', 'Connexion impossible', 'Vérifiez votre accès internet.'); }
  finally { setSubmitState(false); }
}

export function resetForm() {
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
  evalRentabiliteE85();   // efface le badge
  updateCout();
}
