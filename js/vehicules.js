/* ─── Gestion des véhicules (localStorage) ─── */
import { GS_SHEET_ID, VEHICULES_KEY, LAST_VEHICULE_KEY } from './config.js';
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

export function _autoSelectLastVehicule() {
  const last = localStorage.getItem(LAST_VEHICULE_KEY);
  if (!last) return;
  const sel = document.getElementById('vehiculeSel');
  if (Array.from(sel.options).some(o => o.value === last)) {
    sel.value                 = last;
    state.currentVehiculeNom = last;
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
    _autoSelectLastVehicule();
    return;
  }
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
  _populateVehiculeSelect(getVehicules());
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
      if (localStorage.getItem(LAST_VEHICULE_KEY) === nom) localStorage.removeItem(LAST_VEHICULE_KEY);
      state.currentVehiculeNom = '';
      _populateVehiculeSelect(getVehicules());
      sel.value = '';
      setVehiculeStatus('', '');
    } else {
      sel.value = state.currentVehiculeNom;
    }
    return;
  }
  state.currentVehiculeNom = val;
  if (val) localStorage.setItem(LAST_VEHICULE_KEY, val);
  addField.classList.add('hidden');
  setVehiculeStatus('', '');

  // Le km de reference change avec le vehicule -> re-valide l'avertissement
  if (typeof window.onKmInput === 'function') window.onKmInput();
  // Les stats sont filtrees par vehicule -> re-render
  if (typeof window.renderStats === 'function') window.renderStats();
}

export async function confirmerAjoutVehicule() {
  const nom = document.getElementById('fNouveauVehicule').value.trim();
  if (!nom) { setVehiculeStatus('err', 'Nom requis.'); return; }
  const liste = getVehicules();
  if (!liste.includes(nom)) { liste.push(nom); sauvegarderVehicules(liste); }
  _populateVehiculeSelect(getVehicules());
  document.getElementById('vehiculeSel').value = nom;
  state.currentVehiculeNom = nom;
  localStorage.setItem(LAST_VEHICULE_KEY, nom);
  document.getElementById('fNouveauVehicule').value = '';
  document.getElementById('vehiculeAddField').classList.add('hidden');
  setVehiculeStatus('ok', '"' + nom + '" enregistré');
  setTimeout(() => setVehiculeStatus('', ''), 3000);
}
