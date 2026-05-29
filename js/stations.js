/* ─── Gestion de la liste des stations (Google Sheets + historique) ─── */
import { GS_SHEET_ID, GAS_URL } from './config.js';

let _gsStations      = [];   // stations curées (feuille « Stations » du GS, alimentée par Excel)
let _historyStations = [];   // stations distinctes vues dans l'historique des pleins

/** (Re)construit les <option> de #knownGroup à partir de l'union dédupliquée
 *  des stations curées (GS) et des stations vues dans l'historique. */
function _renderStationOptions() {
  const group = document.getElementById('knownGroup');
  if (!group) return;

  const autreOpt = group.querySelector('[value="__autre"]');
  const sel      = document.getElementById('stationSel');
  const selected = sel ? sel.value : '';

  // Retire toutes les options sauf « __autre »
  Array.from(group.querySelectorAll('option:not([value="__autre"])')).forEach(o => o.remove());

  // Union dédupliquée (insensible à la casse), GS d'abord puis historique
  const seen   = new Set();
  const merged = [];
  [..._gsStations, ..._historyStations].forEach(nom => {
    const v = String(nom || '').trim();
    if (!v || v === '__autre') return;
    const key = v.toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    merged.push(v);
  });
  merged.sort((a, b) => a.localeCompare(b, 'fr', { sensitivity: 'base' }));

  merged.forEach(nom => group.insertBefore(new Option(nom, nom), autreOpt));

  // Restaure la sélection courante si elle existe toujours
  if (sel && selected && Array.from(sel.options).some(o => o.value === selected)) {
    sel.value = selected;
  }
}

/** Charge la liste curée des stations depuis la feuille « Stations » du Google Sheet. */
export async function chargerStations() {
  const url = 'https://docs.google.com/spreadsheets/d/' + GS_SHEET_ID + '/gviz/tq?tqx=out:csv&sheet=Stations';
  try {
    const resp = await fetch(url);
    if (!resp.ok) throw new Error('HTTP ' + resp.status);
    const csv = await resp.text();
    _gsStations = csv.split('\n')
      .map(l => l.trim().replace(/^"|"$/g, ''))
      .slice(1)                                   // saute l'en-tête
      .filter(s => s && s !== '__autre');
  } catch (e) {
    console.warn('Chargement stations échoué :', e.message);
    _gsStations = ['Carrefour - Flers', 'E.Leclerc - Beuvry', 'Intermarché',
                   'Leclerc - Douai', 'Total Access', 'Total Waziers'];
  }
  _renderStationOptions();
}

/** Fusionne les stations distinctes de l'historique des pleins.
 *  Appelée après chargerHistorique() (les enregistrements sont alors disponibles). */
export function mergeHistoryStations(stationNames) {
  _historyStations = Array.isArray(stationNames)
    ? stationNames.map(s => String(s || '').trim()).filter(Boolean)
    : [];
  _renderStationOptions();
}

/** Ajoute une nouvelle station dans le GS et dans le menu si elle est inconnue. */
export async function syncStationSiNouvelle(nom) {
  if (!nom) return;
  const v = String(nom).trim();
  if (!v) return;
  const exists = [..._gsStations, ..._historyStations]
    .some(s => String(s).trim().toLowerCase() === v.toLowerCase());
  if (exists) return;
  try {
    await fetch(GAS_URL, {
      method:   'POST',
      redirect: 'follow',
      body:     JSON.stringify({ action: 'addStation', station: v }),
    });
    _gsStations.push(v);
    _renderStationOptions();
  } catch (e) {
    console.warn('[Stations] Sync échouée :', e.message);
  }
}
