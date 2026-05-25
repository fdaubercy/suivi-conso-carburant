/* ─── Historique des 5 derniers pleins (via GET ?action=export) ─── */
import { GAS_URL } from './config.js';

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
      return;
    }

    // Tri descendant par Horodatage (les plus récents en premier), puis 5 premiers
    const recent = data.records
      .slice()
      .sort((a, b) => (b.Horodatage || '').localeCompare(a.Horodatage || ''))
      .slice(0, 5);

    el.innerHTML = recent.map(renderItem).join('');
  } catch (e) {
    el.innerHTML = '<div class="hist-msg err">Erreur — ' + (e.message || 'réseau') + '</div>';
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

/* ─── Helpers ─── */
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
  // Format attendu : "2026-05-22 06:01:55" ou ISO
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
