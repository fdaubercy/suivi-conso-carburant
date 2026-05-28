/* ═══════════════════════════════════════
   Suivi Conso E85 — Point d'entrée v2.13.0.0
   ES Module : chargé en defer automatique
═══════════════════════════════════════ */
import { APP_VERSION } from './config.js';
import { state }       from './state.js';
import { updateCout }  from './ui.js';

import { chargerVehicules, onVehiculeChange, confirmerAjoutVehicule } from './vehicules.js';
import { showPinLabel, hideMap, initMapInteractions } from './carte.js';
import { _buildTypeToggle, setType, registerPriceCallback, initTypeToggle } from './carburant.js';
import { fetchPricesNearUser, fetchPricesByCP } from './prix.js';
import { geolocate, pickStation, highlightNearbyItem, initNearbyList } from './geo.js';
import { onAutreInput, setRadius } from './recherche.js';
import { onStationChange, onKmInput, submitForm, resetForm, checkDuplicate } from './formulaire.js';
import { chargerStations } from './stations.js';
import { initTheme, toggleTheme } from './theme.js';
import { chargerHistorique, dupliquerDernier } from './historique.js';
import { renderStats } from './stats.js';
import { initScanner }       from './ticket.js';
import { initPWA }           from './pwa.js';
import { initOffline, syncQueue } from './offline.js';
import { initNotifications } from './notifications.js';

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

/* ─── Scanner ticket de caisse (W17) ─── */
initScanner();

/* ─── PWA : Service Worker + install prompt ─── */
initPWA();

/* ─── Mode hors-ligne : queue + sync ─── */
initOffline();

/* ─── Notifications prix E85 ─── */
initNotifications();

/* Sync au démarrage si des pleins sont en attente et qu'on est en ligne */
if (navigator.onLine) syncQueue();

/* ─── T2 — Handlers statiques (addEventListener) ─── */
function initStaticHandlers() {
  // Header
  document.getElementById('themeToggle')?.addEventListener('click', toggleTheme);
  document.getElementById('pwaInstallBtn')?.addEventListener('click', () => window._pwaInstall?.());
  document.querySelector('#iosBanner .pwa-close')?.addEventListener('click', () => window._pwaDismiss?.('iosBanner'));

  // Véhicule
  document.getElementById('vehiculeSel')?.addEventListener('change', onVehiculeChange);
  document.getElementById('fNouveauVehicule')?.addEventListener('keydown', e => {
    if (e.key === 'Enter') confirmerAjoutVehicule();
  });
  document.getElementById('vehiculeAjouterBtn')?.addEventListener('click', confirmerAjoutVehicule);

  // Formulaire
  document.getElementById('fDate')?.addEventListener('change', checkDuplicate);
  document.getElementById('fKm')?.addEventListener('input', () => { onKmInput(); checkDuplicate(); });
  document.getElementById('fLitres')?.addEventListener('input', () => { updateCout(); checkDuplicate(); });
  document.getElementById('fPrix')?.addEventListener('input', updateCout);
  document.getElementById('fCp')?.addEventListener('keydown', e => { if (e.key === 'Enter') fetchPricesByCP(); });
  document.getElementById('cpSearchBtn')?.addEventListener('click', fetchPricesByCP);

  // Station
  document.getElementById('stationSel')?.addEventListener('change', onStationChange);
  document.getElementById('geoBtn')?.addEventListener('click', geolocate);
  document.getElementById('fAutre')?.addEventListener('input', onAutreInput);

  // Radius — délégation sur #autreField (les boutons ont déjà data-m)
  document.getElementById('autreField')?.addEventListener('click', e => {
    const btn = e.target.closest('.radius-btn');
    if (!btn) return;
    const m = btn.dataset.m === 'null' ? null : parseInt(btn.dataset.m, 10);
    setRadius(btn, m);
  });

  // Carte
  document.querySelector('#stationMapWrap .map-close-btn')?.addEventListener('click', hideMap);

  // Historique
  document.querySelector('[data-action="dupliquerDernier"]')?.addEventListener('click', dupliquerDernier);
  document.querySelector('[data-action="chargerHistorique"]')?.addEventListener('click', chargerHistorique);

  // Submit
  document.getElementById('submitBtn')?.addEventListener('click', submitForm);
}

initStaticHandlers();
initTypeToggle();      // carburant.js — délégation sur #typeToggle
initNearbyList();      // geo.js — délégation sur #nearbyList
initMapInteractions(); // carte.js — délégation sur #stationMap

/* ─── Exposition globale minimale (requise par modules non-importants) ─── */
Object.assign(window, {
  renderStats,  // carburant.js/setType() → typeof window.renderStats === 'function'
  setType,      // ticket.js/fillFormFromTicket() → window.setType
  updateCout,   // ticket.js/fillFormFromTicket() → window.updateCout
});

/**
 * selectStationFromMap — orchestre carte + geo.
 * Appelée depuis initMapInteractions() (délégation sur #stationMap).
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
