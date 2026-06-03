/* ═══════════════════════════════════════
   Suivi Conso E85 — Point d'entrée v3.11.0.1
   ES Module : chargé en defer automatique
═══════════════════════════════════════ */
import { APP_VERSION, FUEL_CONFIG } from './config.js';
import { state }       from './state.js';
import { updateCout, showFeedback }  from './ui.js';
import { showStationPopup } from './itineraire.js';

import { chargerVehicules, onVehiculeChange, confirmerAjoutVehicule } from './vehicules.js';
import { showPinLabel, hideMap, initMapInteractions } from './carte.js';
import { initStationsMapInteractions, renderStationsCard } from './stationsmap.js';
import { _buildTypeToggle, setType, registerPriceCallback, initTypeToggle } from './carburant.js';
import { fetchPricesNearUser, fetchPricesByCP } from './prix.js';
import { geolocate, pickStation, highlightNearbyItem, initNearbyList } from './geo.js';
import { onAutreInput, setRadius } from './recherche.js';
import { onStationChange, onKmInput, submitForm, checkDuplicate, saveDraft, restoreDraft, initVoiceKm } from './formulaire.js';
import { chargerStations, mergeHistoryStations } from './stations.js';
import { initTheme, toggleTheme } from './theme.js';
import { chargerHistorique, dupliquerDernier, voirTout, exportHistoriqueCSV, exportHistoriqueAllCSV, initCsvSepSetting, initHistoireFilters, initHistoireShare, initHistoireDelete, getMaxKmForVehicule, getAllRecords, rerenderHistorique } from './historique.js';
import { renderStats, initSparkToggles, getNextKmPrediction, initKitSetting, initBudgetSetting, initCo2ObjectifSetting, initRapport } from './stats.js';
import { initComparatifExport } from './comparatif.js';
import { prewarmServerStats } from './statsApi.js';
import { loadSectorPrices, renderSectorBestCard, applyHistPriceToForm } from './secteur.js';
import { initWrapped, renderWrapped } from './wrapped.js';
import { initScanner }       from './ticket.js';
import { initPWA }           from './pwa.js';
import { initOffline, syncQueue } from './offline.js';
import { initNotifications, updateNotifUI, registerPushSubscription } from './notifications.js';
import { syncParametres } from './parametres.js';
import { initRouter, navigate } from './router.js';
import { initPullRefresh } from './pullrefresh.js';
import { initSwipe } from './swipe.js';
import { initBadges, refreshBadges } from './badges.js';
import { initPreferences, renderHomeResume } from './preferences.js';

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

/* ─── W59/S12 — pré-chauffe le cache des agrégats serveur (démarrage rapide) ─── */
prewarmServerStats(state.currentVehiculeNom || '');

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

  // W37 — bilan annuel (les enregistrements sont disponibles)
  initWrapped();

  // W45 — badges onglets (compteur Historique dès l'historique chargé)
  refreshBadges();

  // U5 — met à jour la tuile « reprendre » avec le dernier plein fraîchement chargé
  renderHomeResume();

  // W38 — prix secteur : charge le snapshot quotidien puis enrichit l'historique
  loadSectorPrices().then(() => {
    renderSectorBestCard();
    rerenderHistorique();   // affiche l'écart « payé X €/L de plus que le secteur »
    refreshBadges();        // W45 — pastille Carte (meilleur prix secteur du jour)
  });

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

/* ─── P1 — Synchronisation des paramètres métier (app ⇆ Sheet ⇆ Excel) ───
   Pull serveur + réconciliation LWW au démarrage ; sur changement appliqué
   localement, on rafraîchit les stats et l'UI des alertes. */
window.addEventListener('parametres-synced', e => {
  const changed = e.detail?.changed || [];
  if (!changed.length) return;
  if (changed.some(c => c.startsWith('seuil_'))) {
    updateNotifUI();
    refreshBadges();
    registerPushSubscription();   // re-propage les seuils au cache / serveur push
  }
  renderStats();                  // kit / budget / objectif CO₂ / surconso
});
if (navigator.onLine) syncParametres();

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
  document.getElementById('fDate')?.addEventListener('change', () => { applyHistPriceToForm(); checkDuplicate(); saveDraft(); });
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
  document.querySelector('[data-action="dupliquerDernier"]')?.addEventListener('click', () => {
    dupliquerDernier();
    navigate('saisie');   // le formulaire pré-rempli est dans la vue Saisie
  });
  document.querySelector('[data-action="chargerHistorique"]')?.addEventListener('click', chargerHistorique);
  document.querySelector('[data-action="voirTout"]')?.addEventListener('click', voirTout);
  document.querySelector('[data-action="exportHistoriqueCSV"]')?.addEventListener('click', exportHistoriqueCSV);
  document.querySelector('[data-action="exportHistoriqueAllCSV"]')?.addEventListener('click', exportHistoriqueAllCSV);

  // Submit
  document.getElementById('submitBtn')?.addEventListener('click', submitForm);

  // W43 — accueil à tuiles : bouton 🏠 + tuiles + raccourcis
  document.getElementById('homeBtn')?.addEventListener('click', () => navigate('accueil'));
  document.getElementById('view-accueil')?.addEventListener('click', e => {
    const tile = e.target.closest('[data-view]');
    if (tile) { navigate(tile.dataset.view); return; }
    const sc = e.target.closest('[data-shortcut]');
    if (!sc) return;
    if (sc.dataset.shortcut === 'dernier') dupliquerDernier();
    navigate('saisie');
  });

  // W45 — réévalue la pastille ⚙️ après (dés)activation d'une alerte
  document.getElementById('notifFuelRows')?.addEventListener('change', () => setTimeout(refreshBadges, 300));

  // W39 — lien « définir un budget » (état vide de la carte Stats) : navigue vers
  // Réglages, déplie le bloc repliable si besoin, scrolle et focalise le champ.
  document.getElementById('statsBox')?.addEventListener('click', e => {
    const link = e.target.closest('[data-focus]');
    if (!link) return;
    const id = link.dataset.focus;
    setTimeout(() => {
      const inp = document.getElementById(id);
      if (!inp) return;
      const card = inp.closest('.card.collapsible');
      if (card?.classList.contains('collapsed')) card.querySelector('.section-title')?.click();
      inp.scrollIntoView({ behavior: 'smooth', block: 'center' });
      inp.focus();
    }, 80);
  });
}

initStaticHandlers();
initTypeToggle();      // carburant.js — délégation sur #typeToggle
initNearbyList();      // geo.js — délégation sur #nearbyList
initMapInteractions(); // carte.js — délégation sur #stationMap
initStationsMapInteractions(); // stationsmap.js — clic marqueur favori → popup itinéraire (S11)
initHistoireFilters(); // historique.js — filtres historique complet (W32)
initCsvSepSetting();   // historique.js — W54 choix du séparateur CSV (persisté)
initHistoireShare();   // historique.js — W26 Web Share API
initHistoireDelete();  // historique.js — suppression d'un plein (UI + GoogleSheet)
initComparatifExport(); // comparatif.js — W52 export CSV du comparatif véhicules
initSparkToggles();    // stats.js — W34 filtres sparkline multi-carburant
initKitSetting();      // stats.js — prix du kit pour l'economie nette
initBudgetSetting();   // stats.js — W39 objectif budget carburant mensuel
initCo2ObjectifSetting(); // stats.js — W51 objectif CO₂ annuel évité
initRapport();         // stats.js — rapport mensuel consultable (sélecteur de mois)
initVoiceKm();         // formulaire.js — W35 dictée vocale km
initRouter();          // router.js — W42 navigation par vues (onglets + hash)
initPullRefresh();     // pullrefresh.js — W46 tirer vers le bas → recharge l'app
initSwipe();           // swipe.js — W44 balayage gauche/droite entre onglets
initBadges();          // badges.js — W45 pastilles de notification sur les onglets
initPreferences();     // preferences.js — U4 vue de départ · U5 tuile reprendre · U6 blocs repliables

/* W42 — la carte statique est rendue hors écran (offsetWidth=0) : on la re-cadre
   à l'affichage de l'onglet Carte pour un dimensionnement correct. */
window.addEventListener('viewchange', e => {
  if (e.detail?.view === 'carte') renderStationsCard();
});

/* ─── Exposition globale minimale (requise par modules non-importants) ─── */
Object.assign(window, {
  renderStats,    // carburant.js/setType() → typeof window.renderStats === 'function'
  renderWrapped,  // vehicules.js/onVehiculeChange() → W37 bilan annuel suit le véhicule
  renderStationsCard, // vehicules.js/onVehiculeChange() → W47 carte re-défaut carburant
  setType,        // ticket.js/fillFormFromTicket() → window.setType
  updateCout,     // ticket.js/fillFormFromTicket() → window.updateCout
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

  /* S11 — popup infos + itinéraire (Waze / Google Maps) */
  const cfg   = FUEL_CONFIG[state.currentType];
  const prix  = s.prices ? s.prices[state.currentType] : null;
  showStationPopup({
    name: s.name,
    lat:  s.lat,
    lon:  s.lon,
    dist: s.dist,
    sub:  s.sub,
    priceLabel: prix != null ? `${cfg.short} ${parseFloat(prix).toFixed(3)} €/L` : null,
  });
};
