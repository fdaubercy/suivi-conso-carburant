/* ═══════════════════════════════════════════════════════════════════════
   secteur.js — W38 : prix E85 le moins cher du secteur (relevé quotidien)

   Le backend GAS (RefreshPrix.gs, ~7h) relève chaque jour le prix E85 des
   stations curées + des stations dans 15 km autour de la dernière position
   connue, et expose via ?action=sectorPrices :
     • byDate : { 'yyyy-mm-dd' : prix E85 mini ce jour-là }
     • today  : { station, prix, date } — meilleur prix du jour

   Ce module :
     • charge ces données (cache localStorage, rafraîchi au démarrage) ;
     • fournit getSectorMinForDate() à l'historique (W38 écart par plein) ;
     • rend la carte « Moins cher du secteur aujourd'hui » (#secteurCard).
═══════════════════════════════════════════════════════════════════════ */

import { GAS_URL, APP_TOKEN, SECTOR_CACHE_KEY } from './config.js';

const CACHE_TTL = 2 * 60 * 60 * 1000;   // 2 h

let _byDate = {};     // { 'yyyy-mm-dd' : prixMini }
let _today  = null;   // { station, prix, date }

/* ─── Initialisation synchrone depuis le cache (dispo avant le fetch) ─── */
(function _initFromCache() {
  try {
    const raw = localStorage.getItem(SECTOR_CACHE_KEY);
    if (!raw) return;
    const d = JSON.parse(raw);
    if (d && d.byDate) _byDate = d.byDate;
    if (d && d.today)  _today  = d.today;
  } catch { /* cache illisible — ignoré */ }
})();

function _todayIso() {
  const t = new Date();
  return [
    t.getFullYear(),
    String(t.getMonth() + 1).padStart(2, '0'),
    String(t.getDate()).padStart(2, '0')
  ].join('-');
}

/** Prix E85 mini du secteur pour une date 'yyyy-mm-dd' (ou null si inconnu). */
export function getSectorMinForDate(dateStr) {
  if (!dateStr) return null;
  const v = _byDate[dateStr];
  return (v != null && isFinite(Number(v))) ? Number(v) : null;
}

/** Charge (réseau) les prix secteur et met à jour le cache + le module.
 *  Best-effort : en cas d'échec on garde le cache existant. */
export async function loadSectorPrices() {
  // Cache encore frais → pas de requête réseau
  try {
    const raw = localStorage.getItem(SECTOR_CACHE_KEY);
    if (raw) {
      const d = JSON.parse(raw);
      if (d && d.ts && (Date.now() - d.ts) < CACHE_TTL) return d;
    }
  } catch { /* ignore */ }

  try {
    const url = GAS_URL + '?action=sectorPrices&token=' + encodeURIComponent(APP_TOKEN);
    const resp = await fetch(url, { redirect: 'follow' });
    if (!resp.ok) throw new Error('HTTP ' + resp.status);
    const data = await resp.json();
    if (data && data.error) throw new Error(data.error);

    _byDate = data.byDate || {};
    _today  = data.today  || null;
    try {
      localStorage.setItem(SECTOR_CACHE_KEY,
        JSON.stringify({ byDate: _byDate, today: _today, ts: Date.now() }));
    } catch { /* quota */ }
    return data;
  } catch (e) {
    console.warn('[secteur] chargement échoué :', e.message || e);
    return null;
  }
}

/** Rend la carte « Moins cher du secteur aujourd'hui » (#secteurCard). */
export function renderSectorBestCard() {
  const card = document.getElementById('secteurCard');
  if (!card) return;

  if (!_today || !_today.prix) { card.hidden = true; return; }

  const prix    = Number(_today.prix);
  const station = String(_today.station || '').replace(/^Secteur - /, '').trim() || 'station du secteur';
  const isToday = _today.date === _todayIso();
  const dateTxt = isToday
    ? "aujourd'hui"
    : ('le ' + (_today.date || '').split('-').reverse().join('/'));

  card.innerHTML = `
    <p class="section-title">🏆 Moins cher du secteur</p>
    <div class="secteur-best">
      <span class="secteur-prix">${prix.toFixed(3)} €/L</span>
      <span class="secteur-meta">${escapeHtml(station)} · relevé ${dateTxt}</span>
    </div>
    <p class="secteur-sub">Relevé E85 dans 15 km autour de votre dernière position + vos stations habituelles (mise à jour ~7h).</p>`;
  card.hidden = false;
}

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}
