/* ═══════════════════════════════════════
   Suivi Conso E85 — Point d'entrée v2.2.1.0
   ES Module : chargé en defer automatique
═══════════════════════════════════════ */
import { APP_VERSION } from './config.js';
import { state }       from './state.js';
import { updateCout }  from './ui.js';

import { chargerVehicules, onVehiculeChange, confirmerAjoutVehicule } from './vehicules.js';
import { showPinLabel, hideMap } from './carte.js';
import { _buildTypeToggle, setType, registerPriceCallback } from './carburant.js';
import { fetchPricesNearUser, fetchPricesByCP } from './prix.js';
import { geolocate, pickStation, highlightNearbyItem } from './geo.js';
import { onAutreInput, setRadius } from './recherche.js';
import { onStationChange, onKmInput, submitForm, resetForm } from './formulaire.js';
import { chargerStations } from './stations.js';
import { initTheme, toggleTheme } from './theme.js';
import { chargerHistorique, dupliquerDernier } from './historique.js';
import { renderStats } from './stats.js';

/* ─── Init synchrone ─── */
initTheme();
const t = new Date();
document.getElementById('fDate').value =
  `${t.getFullYear()}-${String(t.getMonth()+1).padStart(2,'0')}-${String(t.getDate()).padStart(2,'0')}`;
_buildTypeToggle({});
document.querySelector('.radius-btn[data-m="20000"]')?.classList.add('active');
document.getElementById('appVersion').textContent = 'v' + APP_VERSION;

/* ─── Câblage callback (rompt la dépendance circulaire carburant ↔ prix) ─── */
registerPriceCallback(fetchPricesNearUser);

/* ─── Chargement asynchrone des données ─── */
chargerStations();
chargerVehicules();
chargerHistorique();

/* ─── Exposition globale pour les handlers HTML inline ─── */
Object.assign(window, {
  toggleTheme,
  chargerHistorique,
  dupliquerDernier,
  renderStats,
  setType,
  geolocate,
  onAutreInput,
  setRadius,
  onStationChange,
  onKmInput,
  onVehiculeChange,
  confirmerAjoutVehicule,
  fetchPricesByCP,
  submitForm,
  resetForm,
  hideMap,
  updateCout,
  pickStation,
  highlightNearbyItem,
  showPinLabel,
});

/**
 * selectStationFromMap — définie ici car elle orchestre carte + geo.
 * Appelée depuis les onclick des marqueurs générés par _renderMap.
 */
window.selectStationFromMap = function(idx) {
  const s = state._mapStations[idx]; if (!s) return;
  state._mapStations.forEach((_, i) => {
    const p = document.getElementById('mapPinDot' + i);
    if (p) p.style.background = i === idx ? '#1B3A5C' : '#2E75B6';
  });
  showPinLabel(idx);
  pickStation(s.name, s.lat, s.lon);
  if (s.src === 'nearby') {
    highlightNearbyItem(s.srcIdx);
    document.getElementById('nearbyItem' + s.srcIdx)?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }
};
