/* ═══════════════════════════════════════
   Suivi Conso E85 — Point d'entrée v2.16.0.0
   ES Module : chargé en defer automatique
═══════════════════════════════════════ */
import { APP_VERSION } from './config.js';
import { state }       from './state.js';
import { updateCout, showFeedback }  from './ui.js';

import { chargerVehicules, onVehiculeChange, confirmerAjoutVehicule } from './vehicules.js';
import { showPinLabel, hideMap, initMapInteractions } from './carte.js';
import { _buildTypeToggle, setType, registerPriceCallback, initTypeToggle } from './carburant.js';
import { fetchPricesNearUser, fetchPricesByCP } from './prix.js';
import { geolocate, pickStation, highlightNearbyItem, initNearbyList } from './geo.js';
import { onAutreInput, setRadius } from './recherche.js';
import { onStationChange, onKmInput, submitForm, resetForm, checkDuplicate, saveDraft, restoreDraft, initVoiceKm } from './formulaire.js';
import { chargerStations, mergeHistoryStations } from './stations.js';
import { initTheme, toggleTheme } from './theme.js';
import { chargerHistorique, dupliquerDernier, voirTout, initHistoireFilters, initHistoireShare, initHistoireDelete, getMaxKmForVehicule, getAllRecords } from './historique.js';
import { renderStats, initSparkToggles, getNextKmPrediction } from './stats.js';
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

/* ─── W15 — Restaurer le brouillon après init async des véhicules/stations ─── */
setTimeout(() => {
  const d = restoreDraft();
  if (d) {
    if (d.type && typeof window.setType === 'function') window.setType(d.type);
    showFeedback('info', '📝 Brouillon restauré', 'Vos données précédentes ont été récupérées.');
  }
}, 800);

/* ─── W35 — Pré-remplir km dès que l'historique est chargé (données disponibles) ─── */
chargerHistorique().then(() => {
  // Fusionne les stations vues dans l'historique avec la liste curée (GS)
  mergeHistoryStations(getAllRecords().map(r => r['Station essence']));

  const fKm = document.getElementById('fKm');
  if (!fKm) return;
  const lastKm = getMaxKmForVehicule(state.currentVehiculeNom);
  if (lastKm) fKm.placeholder = '≥ ' + lastKm.toLocaleString('fr-FR') + ' km';
  if (!fKm.value) {
    const predicted = getNextKmPrediction();
    if (predicted) { fKm.value = predicted; onKmInput(); }
  }
});

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

  // Formulaire — W15 : saveDraft sur chaque modification
  document.getElementById('fDate')?.addEventListener('change', () => { checkDuplicate(); saveDraft(); });
  document.getElementById('fKm')?.addEventListener('input', () => { onKmInput(); checkDuplicate(); saveDraft(); });
  document.getElementById('fLitres')?.addEventListener('input', () => { updateCout(); checkDuplicate(); saveDraft(); });
  document.getElementById('fPrix')?.addEventListener('input', () => { updateCout(); saveDraft(); });
  document.getElementById('fCp')?.addEventListener('keydown', e => { if (e.key === 'Enter') fetchPricesByCP(); });
  document.getElementById('cpSearchBtn')?.addEventListener('click', fetchPricesByCP);

  // Station — W15 : saveDraft sur changement station/saisie manuelle
  document.getElementById('stationSel')?.addEventListener('change', () => { onStationChange(); saveDraft(); });
  document.getElementById('geoBtn')?.addEventListener('click', geolocate);
  document.getElementById('fAutre')?.addEventListener('input', () => { onAutreInput(); saveDraft(); });

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
  document.querySelector('[data-action="voirTout"]')?.addEventListener('click', voirTout);

  // Submit
  document.getElementById('submitBtn')?.addEventListener('click', submitForm);
}

initStaticHandlers();
initTypeToggle();      // carburant.js — délégation sur #typeToggle
initNearbyList();      // geo.js — délégation sur #nearbyList
initMapInteractions(); // carte.js — délégation sur #stationMap
initHistoireFilters(); // historique.js — filtres historique complet (W32)
initHistoireShare();   // historique.js — W26 Web Share API
initHistoireDelete();  // historique.js — suppression d'un plein (UI + GoogleSheet)
initSparkToggles();    // stats.js — W34 filtres sparkline multi-carburant
initVoiceKm();         // formulaire.js — W35 dictée vocale km

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
