/* ═══════════════════════════════════════════════════════════════════════
   secteur.js — Prix le moins cher du secteur (relevé quotidien)
   W38 (E85) → W48 (multi-carburant : E85 / Gazole / SP98).

   Le backend GAS (RefreshPrix.gs, ~7h) relève chaque jour le prix de chaque
   carburant des stations curées + des stations dans 15 km autour de la
   dernière position connue, et expose via ?action=sectorPrices&fuel=… :
     • byDate : { 'yyyy-mm-dd' : prix mini ce jour-là pour ce carburant }
     • today  : { station, prix, date } — meilleur prix du jour
     • fuel   : carburant renvoyé

   Ce module :
     • charge ces données par carburant (cache localStorage, TTL 2 h) ;
     • fournit getSectorMinForDate(date, fuel) à l'historique (écart par plein) ;
     • rend la carte « Moins cher du secteur » E85 (#secteurCard, vue Saisie) ;
     • alimente la carte des stations (vue Carte) pour le carburant sélectionné.
═══════════════════════════════════════════════════════════════════════ */

import { GAS_URL, APP_TOKEN, SECTOR_CACHE_KEY } from './config.js';

const CACHE_TTL = 2 * 60 * 60 * 1000;   // 2 h

// Données par carburant : { E85:{byDate,today}, GAZOLE:{…}, SP98:{…} }
const _store = {};

/** Clé de cache localStorage par carburant (E85 garde l'ancienne clé). */
function _cacheKey(fuel) {
  return fuel === 'E85' ? SECTOR_CACHE_KEY : SECTOR_CACHE_KEY + '_' + fuel;
}

function _slot(fuel) {
  if (!_store[fuel]) _store[fuel] = { byDate: {}, today: null };
  return _store[fuel];
}

/* ─── Initialisation synchrone depuis le cache (dispo avant le fetch) ─── */
['E85', 'GAZOLE', 'SP98'].forEach(fuel => {
  try {
    const raw = localStorage.getItem(_cacheKey(fuel));
    if (!raw) return;
    const d = JSON.parse(raw);
    const s = _slot(fuel);
    if (d && d.byDate) s.byDate = d.byDate;
    if (d && d.today)  s.today  = d.today;
  } catch { /* cache illisible — ignoré */ }
});

function _todayIso() {
  const t = new Date();
  return [
    t.getFullYear(),
    String(t.getMonth() + 1).padStart(2, '0'),
    String(t.getDate()).padStart(2, '0')
  ].join('-');
}

/** Prix mini du secteur pour une date 'yyyy-mm-dd' et un carburant (ou null). */
export function getSectorMinForDate(dateStr, fuel = 'E85') {
  if (!dateStr) return null;
  const v = _slot(fuel).byDate[dateStr];
  return (v != null && isFinite(Number(v))) ? Number(v) : null;
}

/** Meilleur prix du jour { station, prix, date } pour un carburant (ou null). */
export function getSectorToday(fuel = 'E85') {
  return _slot(fuel).today;
}

/** Charge (réseau) les prix secteur d'un carburant et met à jour cache + module.
 *  Best-effort : en cas d'échec on garde le cache existant. */
export async function loadSectorPrices(fuel = 'E85') {
  const key = _cacheKey(fuel);
  // Cache encore frais → pas de requête réseau
  try {
    const raw = localStorage.getItem(key);
    if (raw) {
      const d = JSON.parse(raw);
      if (d && d.ts && (Date.now() - d.ts) < CACHE_TTL) return d;
    }
  } catch { /* ignore */ }

  try {
    const url = GAS_URL + '?action=sectorPrices&fuel=' + encodeURIComponent(fuel)
              + '&token=' + encodeURIComponent(APP_TOKEN);
    const resp = await fetch(url, { redirect: 'follow' });
    if (!resp.ok) throw new Error('HTTP ' + resp.status);
    const data = await resp.json();
    if (data && data.error) throw new Error(data.error);

    const s = _slot(fuel);
    s.byDate = data.byDate || {};
    s.today  = data.today  || null;
    try {
      localStorage.setItem(key,
        JSON.stringify({ byDate: s.byDate, today: s.today, ts: Date.now() }));
    } catch { /* quota */ }
    return data;
  } catch (e) {
    console.warn('[secteur] chargement échoué (' + fuel + ') :', e.message || e);
    return null;
  }
}

/** Rend la carte « Moins cher du secteur aujourd'hui » E85 (#secteurCard, vue Saisie). */
export function renderSectorBestCard() {
  const card = document.getElementById('secteurCard');
  if (!card) return;

  const today = getSectorToday('E85');
  if (!today || !today.prix) { card.hidden = true; return; }

  const prix    = Number(today.prix);
  const station = String(today.station || '').replace(/^Secteur - /, '').trim() || 'station du secteur';
  const isToday = today.date === _todayIso();
  const dateTxt = isToday
    ? "aujourd'hui"
    : ('le ' + (today.date || '').split('-').reverse().join('/'));

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
