/* ─── Formulaire — soumission et réinitialisation ─── */
import { FUEL_CONFIG, FUEL_KEYS, GAS_URL } from './config.js';
import { state } from './state.js';
import { setAutreStatus, hideCpSearch, setSubmitState, showFeedback, updateCout } from './ui.js';
import { _buildTypeToggle, _updateHeaderBadges } from './carburant.js';
import { fetchPricesNearUser, fetchNearestE85Price } from './prix.js';
import { syncStationSiNouvelle } from './stations.js';
import { chargerHistorique } from './historique.js';

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
  updateCout();
}
