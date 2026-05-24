/* ─── Gestion de la liste des stations (Google Sheets) ─── */
import { GS_SHEET_ID, GAS_URL } from './config.js';

export async function chargerStations() {
  const url = 'https://docs.google.com/spreadsheets/d/' + GS_SHEET_ID + '/gviz/tq?tqx=out:csv&sheet=Stations';
  try {
    const resp = await fetch(url); if (!resp.ok) throw new Error('HTTP ' + resp.status);
    const csv = await resp.text(), group = document.getElementById('knownGroup');
    Array.from(group.querySelectorAll('option:not([value="__autre"])')).forEach(o => o.remove());
    const autreOpt = group.querySelector('[value="__autre"]');
    csv.split('\n').map(l => l.trim().replace(/^"|"$/g, '')).slice(1).filter(s => s && s !== '__autre')
      .forEach(nom => group.insertBefore(new Option(nom, nom), autreOpt));
  } catch(e) {
    console.warn('Chargement stations échoué :', e.message);
    ['Carrefour Flers', 'Intermarché', 'Leclerc Douai', 'Total Access', 'Total Waziers',
     'ZONE DU MOULIN RUE ARTHUR LAMENDIN — Beuvry'].forEach(nom => {
      const g = document.getElementById('knownGroup');
      g.insertBefore(new Option(nom, nom), g.querySelector('[value="__autre"]'));
    });
  }
}

/** Ajoute une nouvelle station dans GS et dans le select si elle est inconnue. */
export async function syncStationSiNouvelle(nom) {
  if (!nom) return;
  const group = document.getElementById('knownGroup');
  const options = Array.from(group.querySelectorAll('option')).map(o => o.value.toLowerCase()).filter(v => v !== '__autre');
  if (options.includes(nom.toLowerCase())) return;
  try {
    await fetch(GAS_URL, { method: 'POST', redirect: 'follow', body: JSON.stringify({ action: 'addStation', station: nom }) });
    group.insertBefore(new Option(nom, nom), group.querySelector('[value="__autre"]'));
  } catch(e) { console.warn('[Stations] Sync échouée :', e.message); }
}
