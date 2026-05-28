/* ─── Historique des 5 derniers pleins (via GET ?action=export) ─── */
import { GAS_URL, FUEL_CONFIG, HIST_CACHE_KEY, HIST_SINCE_KEY } from './config.js';
import { state } from './state.js';
import { showFeedback } from './ui.js';
import { renderStats } from './stats.js';
import { renderStationsCard } from './stationsmap.js';

let _lastRecord  = null;   // memorise le plein le plus recent pour dupliquerDernier()
let _allRecords  = [];     // memorise TOUS les enregistrements pour validation km retrograde

/* ─── Cache localStorage ─── */
function _loadCache() {
  try { return JSON.parse(localStorage.getItem(HIST_CACHE_KEY) || '[]'); } catch { return []; }
}
function _saveCache(records) {
  try { localStorage.setItem(HIST_CACHE_KEY, JSON.stringify(records)); } catch { /* quota / private */ }
}
function _loadSince() {
  try { return localStorage.getItem(HIST_SINCE_KEY) || null; } catch { return null; }
}
function _saveSince(ts) {
  try { localStorage.setItem(HIST_SINCE_KEY, ts); } catch { /* quota / private */ }
}

/** Charge et affiche les 5 derniers pleins dans #historiqueList.
 *  Utilise un cache localStorage + sync différentielle (?since=) pour
 *  limiter les données téléchargées sur les chargements successifs. */
export async function chargerHistorique() {
  const el = document.getElementById('historiqueList');
  if (!el) return;

  el.innerHTML = '<div class="hist-msg">Chargement…</div>';

  try {
    const cachedRecords = _loadCache();
    const since         = _loadSince();

    // Mode différentiel si on a déjà un cache : n'envoyer que les nouveaux
    const url = GAS_URL + '?action=export'
      + (since && cachedRecords.length ? '&since=' + encodeURIComponent(since) : '');

    const resp = await fetch(url, { redirect: 'follow' });
    if (!resp.ok) throw new Error('HTTP ' + resp.status);
    const data = await resp.json();

    const incoming = data.records || [];
    let allRecords;

    if (since && cachedRecords.length) {
      // Fusion différentielle : ajouter uniquement les sync_id absents du cache
      const existingIds = new Set(
        cachedRecords.map(r => String(r.sync_id || r['sync_id'] || '')).filter(Boolean)
      );
      const newRecords = incoming.filter(r => {
        const sid = String(r.sync_id || r['sync_id'] || '');
        return !sid || !existingIds.has(sid);
      });
      allRecords = newRecords.length ? [...cachedRecords, ...newRecords] : cachedRecords;
    } else {
      // Chargement complet (premier démarrage ou cache absent)
      allRecords = incoming;
    }

    // Mettre à jour le cache et le timestamp de dernière sync
    _saveCache(allRecords);
    _saveSince(new Date().toISOString());

    if (!allRecords.length) {
      el.innerHTML = '<div class="hist-msg">Aucun plein enregistré.</div>';
      _lastRecord = null;
      _allRecords = [];
      return;
    }

    _allRecords = allRecords;

    // Tri descendant par Horodatage, puis 5 premiers
    const recent = allRecords
      .slice()
      .sort((a, b) => (b.Horodatage || '').localeCompare(a.Horodatage || ''))
      .slice(0, 5);

    _lastRecord = recent[0];
    el.innerHTML = recent.map(renderItem).join('');
    renderStats();
    renderStationsCard();

    // W32 — Rafraîchir l'historique complet s'il est ouvert
    const fullCard = document.getElementById('histoireFullCard');
    if (fullCard && !fullCard.hidden) {
      renderFullHistory(
        document.getElementById('histVehFilter')?.value || '',
        document.getElementById('histTypeFilter')?.value || ''
      );
    }
  } catch (e) {
    // Fallback : afficher le cache local en cas d'erreur réseau
    const cached = _loadCache();
    if (cached.length) {
      _allRecords = cached;
      const recent = cached
        .slice()
        .sort((a, b) => (b.Horodatage || '').localeCompare(a.Horodatage || ''))
        .slice(0, 5);
      _lastRecord = recent[0];
      el.innerHTML = recent.map(renderItem).join('');
      renderStats();
      renderStationsCard();
    } else {
      el.innerHTML = '<div class="hist-msg err">Erreur — ' + (e.message || 'réseau') + '</div>';
      _lastRecord = null;
      _allRecords = [];
    }
  }
}

/** Retourne tous les enregistrements GS. */
export function getAllRecords() {
  return _allRecords;
}

/** Retourne le km maximum enregistré pour un véhicule donné. */
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

  ['fKm', 'fLitres', 'fPrix'].forEach(id => {
    const el = document.getElementById(id);
    if (el) { el.value = ''; el.classList.remove('autofilled'); }
  });

  const veh = r['Véhicule'] || r['Vehicule'] || '';
  if (veh) setSelectValue('vehiculeSel', veh);

  const label = r.Type;
  const typeKey = Object.keys(FUEL_CONFIG).find(k => FUEL_CONFIG[k].label === label);
  if (typeKey && typeof window.setType === 'function') window.setType(typeKey);

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

// ═══════════════════════════════════════
//  W32 — Historique complet + filtres
// ═══════════════════════════════════════

/** Affiche ou masque la carte historique complet. */
export function voirTout() {
  const card = document.getElementById('histoireFullCard');
  if (!card) return;

  if (!card.hidden) {
    card.hidden = true;
    return;
  }

  // Peupler le filtre véhicules
  const vehSel = document.getElementById('histVehFilter');
  if (vehSel) {
    const vehs = [...new Set(_allRecords
      .map(r => r['Véhicule'] || r['Vehicule'] || '')
      .filter(Boolean)
    )].sort();
    vehSel.innerHTML = '<option value="">Tous les véhicules</option>'
      + vehs.map(v => `<option value="${escapeHtml(v)}">${escapeHtml(v)}</option>`).join('');
    if (state.currentVehiculeNom) vehSel.value = state.currentVehiculeNom;
  }

  // Peupler le filtre type carburant
  const typeSel = document.getElementById('histTypeFilter');
  if (typeSel) {
    const types = [...new Set(_allRecords.map(r => r.Type || '').filter(Boolean))].sort();
    typeSel.innerHTML = '<option value="">Tous les carburants</option>'
      + types.map(t => `<option value="${escapeHtml(t)}">${escapeHtml(t)}</option>`).join('');
  }

  renderFullHistory(vehSel?.value || '', typeSel?.value || '');

  card.hidden = false;
  card.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

/** Génère la liste filtrée dans #histoireFullList. */
export function renderFullHistory(vehFilter, typeFilter) {
  const listEl  = document.getElementById('histoireFullList');
  const countEl = document.getElementById('histFullCount');
  if (!listEl) return;

  if (!_allRecords.length) {
    listEl.innerHTML = '<div class="hist-msg">Aucun plein enregistré.</div>';
    if (countEl) countEl.textContent = '';
    return;
  }

  let filtered = _allRecords
    .slice()
    .sort((a, b) => (b.Horodatage || '').localeCompare(a.Horodatage || ''));

  if (vehFilter)
    filtered = filtered.filter(r => (r['Véhicule'] || r['Vehicule'] || '') === vehFilter);
  if (typeFilter)
    filtered = filtered.filter(r => (r.Type || '') === typeFilter);

  if (!filtered.length) {
    listEl.innerHTML = '<div class="hist-msg">Aucun plein correspondant au filtre.</div>';
    if (countEl) countEl.textContent = '';
    return;
  }

  if (countEl) countEl.textContent = filtered.length + ' plein' + (filtered.length > 1 ? 's' : '');
  listEl.innerHTML = filtered.map(renderItem).join('');
}

/**
 * W32 — Câble les filtres et le bouton fermer de l'historique complet.
 * Appelée une seule fois depuis main.js.
 */
export function initHistoireFilters() {
  document.getElementById('histVehFilter')?.addEventListener('change', () => {
    renderFullHistory(
      document.getElementById('histVehFilter').value,
      document.getElementById('histTypeFilter')?.value || ''
    );
  });
  document.getElementById('histTypeFilter')?.addEventListener('change', () => {
    renderFullHistory(
      document.getElementById('histVehFilter')?.value || '',
      document.getElementById('histTypeFilter').value
    );
  });
  document.getElementById('histFullCloseBtn')?.addEventListener('click', () => {
    const card = document.getElementById('histoireFullCard');
    if (card) card.hidden = true;
  });
}

/* ═══════════════════════════════════════
   W26 — Web Share API
   ═══════════════════════════════════════ */

/**
 * Câble le bouton "Partager" sur les entrées historique (délégation d'événements).
 * Si l'API navigator.share n'est pas disponible, masque tous les boutons via CSS.
 */
export function initHistoireShare() {
  if (!('share' in navigator)) {
    document.body.classList.add('no-share');
    return;
  }

  const handler = async (e) => {
    const btn = e.target.closest('.hist-share');
    if (!btn) return;
    const { shareLitres, sharePrix, shareStation, shareDate, shareType } = btn.dataset;
    try {
      await navigator.share({
        title: 'Plein carburant',
        text:  `${shareType} · ${shareLitres} L à ${sharePrix} €/L — ${shareStation} (${shareDate})`,
      });
    } catch (err) {
      if (err.name !== 'AbortError') console.warn('Share failed:', err);
    }
  };

  document.getElementById('historiqueList')?.addEventListener('click', handler);
  document.getElementById('histoireFullList')?.addEventListener('click', handler);
}

/* ═══════════════════════════════════════
   Suppression d'un plein (UI + GoogleSheet)
   ═══════════════════════════════════════ */

/** Réaffiche les 5 derniers pleins + l'historique complet ouvert. */
function _renderLists() {
  const el = document.getElementById('historiqueList');
  if (el) {
    if (!_allRecords.length) {
      el.innerHTML = '<div class="hist-msg">Aucun plein enregistré.</div>';
      _lastRecord = null;
    } else {
      const recent = _allRecords
        .slice()
        .sort((a, b) => (b.Horodatage || '').localeCompare(a.Horodatage || ''))
        .slice(0, 5);
      _lastRecord = recent[0];
      el.innerHTML = recent.map(renderItem).join('');
    }
  }
  renderStats();
  renderStationsCard();

  const fullCard = document.getElementById('histoireFullCard');
  if (fullCard && !fullCard.hidden) {
    renderFullHistory(
      document.getElementById('histVehFilter')?.value || '',
      document.getElementById('histTypeFilter')?.value || ''
    );
  }
}

/**
 * Câble le bouton "Supprimer" 🗑️ sur les entrées historique (délégation d'événements).
 * Confirme, supprime la ligne dans le GoogleSheet (action=deletePlein via sync_id),
 * puis retire l'enregistrement du cache et réaffiche les listes.
 */
export function initHistoireDelete() {
  const handler = async (e) => {
    const btn = e.target.closest('.hist-delete');
    if (!btn) return;

    const sid = String(btn.dataset.syncId || '');
    if (!sid) return;

    if (!window.confirm('Supprimer définitivement ce plein ?\nCette action est irréversible.')) return;

    btn.disabled = true;
    try {
      const resp = await fetch(GAS_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({ action: 'deletePlein', sync_id: sid }),
        redirect: 'follow',
      });
      if (!resp.ok) throw new Error('HTTP ' + resp.status);
      const result = await resp.json().catch(() => ({}));
      if (result && result.success === false) {
        throw new Error(result.error || 'suppression refusée');
      }

      _allRecords = _allRecords.filter(r => String(r.sync_id || '') !== sid);
      _saveCache(_allRecords);
      _renderLists();
      showFeedback('success', 'Plein supprimé ✓', 'L\'enregistrement a été retiré.');
    } catch (err) {
      btn.disabled = false;
      showFeedback('error', 'Suppression échouée', err.message || 'erreur réseau');
    }
  };

  document.getElementById('historiqueList')?.addEventListener('click', handler);
  document.getElementById('histoireFullList')?.addEventListener('click', handler);
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

function renderItem(r) {
  const icon    = iconForType(r.Type);
  const date    = fmtDate(r.Date || r.Horodatage);
  const km      = fmtKm(r['Km compteur']);
  const litres  = Number(r['Nb. Litres'] || 0).toFixed(2);
  const prix    = Number(r['Prix €/L']   || 0).toFixed(3);
  const total   = (Number(litres) * Number(prix)).toFixed(2);
  const station = String(r['Station essence'] || '—').slice(0, 40);
  const type    = escapeHtml(r.Type || '');
  const syncId  = String(r.sync_id || '');

  const deleteBtn = syncId
    ? `<button class="hist-delete" type="button"
          data-sync-id="${escapeHtml(syncId)}"
          aria-label="Supprimer ce plein">🗑️</button>`
    : '';

  return `
    <div class="hist-item">
      <div class="hist-row1">
        <span class="hist-icon">${icon}</span>
        <span class="hist-date">${date}</span>
        <span class="hist-total">${total} €</span>
        <button class="hist-share" type="button"
          data-share-litres="${litres}"
          data-share-prix="${prix}"
          data-share-station="${escapeHtml(station)}"
          data-share-date="${date}"
          data-share-type="${type}"
          aria-label="Partager ce plein">📤</button>
        ${deleteBtn}
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
