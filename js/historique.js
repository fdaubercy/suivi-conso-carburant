/* ─── Historique des 5 derniers pleins (via GET ?action=export) ─── */
import { GAS_URL, FUEL_CONFIG } from './config.js';
import { showFeedback } from './ui.js';
import { renderStats } from './stats.js';
import { renderStationsCard } from './stationsmap.js';

let _lastRecord  = null;   // memorise le plein le plus recent pour dupliquerDernier()
let _allRecords  = [];     // memorise TOUS les enregistrements pour validation km retrograde

/** Charge et affiche les 5 derniers pleins dans #historiqueList. */
export async function chargerHistorique() {
  const el = document.getElementById('historiqueList');
  if (!el) return;

  el.innerHTML = '<div class="hist-msg">Chargement…</div>';

  try {
    const resp = await fetch(GAS_URL + '?action=export', { redirect: 'follow' });
    if (!resp.ok) throw new Error('HTTP ' + resp.status);
    const data = await resp.json();

    if (!data.records?.length) {
      el.innerHTML = '<div class="hist-msg">Aucun plein enregistré.</div>';
      _lastRecord = null;
      _allRecords = [];
      return;
    }

    _allRecords = data.records;   // pour validation km retrograde

    // Tri descendant par Horodatage (les plus récents en premier), puis 5 premiers
    const recent = data.records
      .slice()
      .sort((a, b) => (b.Horodatage || '').localeCompare(a.Horodatage || ''))
      .slice(0, 5);

    _lastRecord = recent[0];   // pour dupliquerDernier()
    el.innerHTML = recent.map(renderItem).join('');
    renderStats();             // recalcule les stats avec les nouvelles donnees
    renderStationsCard();      // met à jour la carte statique des stations habituelles
  } catch (e) {
    el.innerHTML = '<div class="hist-msg err">Erreur — ' + (e.message || 'réseau') + '</div>';
    _lastRecord = null;
    _allRecords = [];
  }
}

/** Retourne tous les enregistrements GS (vide tant que chargerHistorique() n'a pas tourne). */
export function getAllRecords() {
  return _allRecords;
}

/** Retourne le km maximum enregistre pour un vehicule donne (ou tous si vehicule vide). */
export function getMaxKmForVehicule(vehiculeNom) {
  if (!_allRecords.length) return null;
  const filtered = vehiculeNom
    ? _allRecords.filter(r => (r['Véhicule'] || r['Vehicule'] || '') === vehiculeNom)
    : _allRecords;
  if (!filtered.length) return null;
  const kms = filtered
    .map(r => Number(r['Km compteur'] || 0))
    .filter(n => isFinite(n) && n > 0);
  return kms.length ? Math.max(...kms) : null;
}

/** Pré-remplit le formulaire avec le dernier plein. */
export function dupliquerDernier() {
  if (!_lastRecord) {
    showFeedback('error', 'Rien à dupliquer', 'Chargez l\'historique d\'abord (bouton ↻).');
    return;
  }

  const r = _lastRecord;

  // Reset des champs variables (date reste a aujourd'hui)
  ['fKm', 'fLitres', 'fPrix'].forEach(id => {
    const el = document.getElementById(id);
    if (el) { el.value = ''; el.classList.remove('autofilled'); }
  });

  // 1. Vehicule (si present dans le select)
  const veh = r['Véhicule'] || r['Vehicule'] || '';
  if (veh) setSelectValue('vehiculeSel', veh);

  // 2. Type carburant via window.setType (deja expose dans main.js)
  const label = r.Type;
  const typeKey = Object.keys(FUEL_CONFIG).find(k => FUEL_CONFIG[k].label === label);
  if (typeKey && typeof window.setType === 'function') window.setType(typeKey);

  // 3. Station (option du dropdown OU saisie manuelle si absente)
  const station = r['Station essence'];
  if (station) {
    const sel = document.getElementById('stationSel');
    if (sel) {
      const matches = Array.from(sel.options).some(o => o.value === station);
      if (matches) {
        sel.value = station;
      } else {
        sel.value = '__autre';
        const fa = document.getElementById('fAutre');
        if (fa) fa.value = station;
      }
      sel.dispatchEvent(new Event('change'));
    }
  }

  showFeedback('success', 'Plein pré-rempli ✓',
    'Vérifiez le véhicule, le type et la station — puis saisissez km / litres / prix.');
}

/* ─── Helpers ─── */
function setSelectValue(id, value) {
  const sel = document.getElementById(id);
  if (!sel) return;
  const matches = Array.from(sel.options).some(o => o.value === value);
  if (matches) {
    sel.value = value;
    sel.dispatchEvent(new Event('change'));
  }
}

/** HTML d'une ligne. */
function renderItem(r) {
  const icon    = iconForType(r.Type);
  const date    = fmtDate(r.Date || r.Horodatage);
  const km      = fmtKm(r['Km compteur']);
  const litres  = Number(r['Nb. Litres'] || 0).toFixed(2);
  const prix    = Number(r['Prix €/L']   || 0).toFixed(3);
  const total   = (litres * prix).toFixed(2);
  const station = String(r['Station essence'] || '—').slice(0, 40);

  return `
    <div class="hist-item">
      <div class="hist-row1">
        <span class="hist-icon">${icon}</span>
        <span class="hist-date">${date}</span>
        <span class="hist-total">${total} €</span>
      </div>
      <div class="hist-row2">
        <span>${litres} L · ${prix} €/L</span>
        <span class="hist-km">${km} km</span>
      </div>
      <div class="hist-row3">${escapeHtml(station)}</div>
    </div>
  `;
}

function iconForType(type) {
  if (!type) return '⛽';
  const t = String(type).toLowerCase();
  if (t.includes('e85') || t.includes('ethanol')) return '🌿';
  if (t.includes('98'))                            return '💧';
  if (t.includes('e10'))                           return '🟢';
  if (t.includes('95'))                            return '🔵';
  if (t.includes('gazole') || t.includes('diesel')) return '⚫';
  if (t.includes('gpl'))                            return '🟡';
  return '⛽';
}

function fmtDate(s) {
  if (!s) return '—';
  const d = new Date(String(s).replace(' ', 'T'));
  if (isNaN(d)) return String(s).slice(0, 10);
  return [
    String(d.getDate()).padStart(2, '0'),
    String(d.getMonth() + 1).padStart(2, '0'),
    d.getFullYear()
  ].join('/');
}

function fmtKm(km) {
  const n = Number(km);
  if (!isFinite(n)) return '—';
  return n.toLocaleString('fr-FR');
}

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}
