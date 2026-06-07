/* ─── Gestion des véhicules (localStorage) ─── */
import { GS_SHEET_ID, VEHICULES_KEY, LAST_VEHICULE_KEY } from './config.js';
import { authEnabled } from './auth.js';
import { state } from './state.js';
import { setVehiculeStatus } from './ui.js';

export function getVehicules() {
  try { return JSON.parse(localStorage.getItem(VEHICULES_KEY) || '[]'); }
  catch { return []; }
}
export function sauvegarderVehicules(liste) {
  localStorage.setItem(VEHICULES_KEY, JSON.stringify(liste));
}

export function _populateVehiculeSelect(liste) {
  const group  = document.getElementById('vehiculeGroup');
  Array.from(group.querySelectorAll('option[data-v]')).forEach(o => o.remove());
  const addOpt = group.querySelector('[value="__ajouter"]');
  liste.forEach(nom => {
    const opt = new Option(nom, nom); opt.dataset.v = '1';
    group.insertBefore(opt, addOpt);
  });
}

/** U9 — Peuple le sélecteur véhicule GLOBAL (barre sous l'en-tête). new Option() = sûr (pas d'innerHTML). */
export function _populateGlobalVehiculeSelect(liste) {
  const sel = document.getElementById('vehiculeSelGlobal');
  if (!sel) return;
  const cur = sel.value || state.currentVehiculeNom || '';
  sel.innerHTML = '';
  sel.add(new Option('Tous les véhicules', ''));
  liste.forEach(nom => sel.add(new Option(nom, nom)));
  if (Array.from(sel.options).some(o => o.value === cur)) sel.value = cur;
}

/** U9 — Reflète le véhicule courant dans les 3 sélecteurs (saisie, barre globale,
 *  filtre historique) en posant juste .value, sans déclencher leurs handlers. */
export function syncVehiculeControls(nom) {
  const v = nom || '';
  ['vehiculeSel', 'vehiculeSelGlobal', 'histVehFilter'].forEach(id => {
    const sel = document.getElementById(id);
    if (sel && Array.from(sel.options).some(o => o.value === v)) sel.value = v;
  });
}

/** U9 — Source UNIQUE de vérité du véhicule courant : écrit l'état, persiste,
 *  synchronise les sélecteurs puis notifie toutes les vues via 'vehicule-changed'. */
export function setCurrentVehicule(nom) {
  const v = nom || '';
  state.currentVehiculeNom = v;
  if (v) localStorage.setItem(LAST_VEHICULE_KEY, v);
  else   localStorage.removeItem(LAST_VEHICULE_KEY);
  syncVehiculeControls(v);
  window.dispatchEvent(new window.CustomEvent('vehicule-changed', { detail: { vehicule: v } }));
}

export function _autoSelectLastVehicule() {
  const last = localStorage.getItem(LAST_VEHICULE_KEY);
  if (!last) return;
  const sel = document.getElementById('vehiculeSel');
  if (sel && Array.from(sel.options).some(o => o.value === last)) {
    state.currentVehiculeNom = last;
    syncVehiculeControls(last);   // U9 — reflète aussi dans la barre globale + filtre historique
  }
}

/**
 * Charge les véhicules :
 * — localStorage non vide → affichage immédiat
 * — localStorage vide     → import unique depuis l'onglet "vehicules" du GS
 */
export async function chargerVehicules() {
  const listeLocale = getVehicules();
  if (listeLocale.length > 0) {
    _populateVehiculeSelect(listeLocale);
    _populateGlobalVehiculeSelect(listeLocale);   // U9
    _autoSelectLastVehicule();
    return;
  }
  // U7 — En mode multi-utilisateur (auth configurée), on NE seede PAS la liste
  // depuis l'onglet global « vehicules » (= véhicules du propriétaire) : chaque
  // compte gère ses propres véhicules (localStorage par appareil). En mode legacy
  // (auth inactive), on conserve le seed historique.
  if (!authEnabled()) {
    try {
      const url = 'https://docs.google.com/spreadsheets/d/' + GS_SHEET_ID
                + '/gviz/tq?tqx=out:csv&sheet=vehicules';
      const resp = await fetch(url);
      if (!resp.ok) throw new Error('HTTP ' + resp.status);
      const csv  = await resp.text();
      const liste = csv.split('\n')
        .map(l => l.trim().split(',')[0].replace(/^"|"$/g, ''))
        .slice(1)
        .filter(s => s.length > 0);
      if (liste.length > 0) { sauvegarderVehicules(liste); console.log('[Véhicules] Import GS :', liste); }
    } catch(e) { console.warn('[Véhicules] Import GS échoué :', e.message); }
  }
  _populateVehiculeSelect(getVehicules());
  _populateGlobalVehiculeSelect(getVehicules());   // U9
  _autoSelectLastVehicule();
}

export function onVehiculeChange() {
  const sel      = document.getElementById('vehiculeSel');
  const addField = document.getElementById('vehiculeAddField');
  const val      = sel.value;

  if (val === '__ajouter') {
    sel.value = state.currentVehiculeNom || '';
    addField.classList.remove('hidden');
    document.getElementById('fNouveauVehicule').focus();
    return;
  }
  if (val === '__supprimer') {
    addField.classList.add('hidden');
    if (!state.currentVehiculeNom) {
      setVehiculeStatus('err', "Sélectionnez d'abord un véhicule à supprimer.");
      sel.value = ''; return;
    }
    if (confirm('Supprimer "' + state.currentVehiculeNom + '" ?')) {
      const nom = state.currentVehiculeNom;
      sauvegarderVehicules(getVehicules().filter(v => v !== nom));
      _populateVehiculeSelect(getVehicules());
      _populateGlobalVehiculeSelect(getVehicules());   // U9
      setVehiculeStatus('', '');
      setCurrentVehicule('');   // U9 — efface l'état, persiste, synchronise les selects, notifie les vues
    } else {
      sel.value = state.currentVehiculeNom;
    }
    return;
  }
  // Cas normal : véhicule choisi → source unique de vérité (U9).
  addField.classList.add('hidden');
  setVehiculeStatus('', '');
  // setCurrentVehicule écrit l'état + persiste + synchronise les 3 selects + dispatch
  // 'vehicule-changed' (les vues — km, stats, wrapped, carte, historique — sont
  // re-rendues par le listener de main.js, plus besoin des window.render*() ici).
  setCurrentVehicule(val);
}

export async function confirmerAjoutVehicule() {
  const nom = document.getElementById('fNouveauVehicule').value.trim();
  if (!nom) { setVehiculeStatus('err', 'Nom requis.'); return; }
  const liste = getVehicules();
  if (!liste.includes(nom)) { liste.push(nom); sauvegarderVehicules(liste); }
  _populateVehiculeSelect(getVehicules());
  _populateGlobalVehiculeSelect(getVehicules());   // U9
  setCurrentVehicule(nom);   // U9 — sélectionne le nouveau véhicule partout + notifie les vues
  document.getElementById('fNouveauVehicule').value = '';
  document.getElementById('vehiculeAddField').classList.add('hidden');
  setVehiculeStatus('ok', '"' + nom + '" enregistré');
  setTimeout(() => setVehiculeStatus('', ''), 3000);
}
