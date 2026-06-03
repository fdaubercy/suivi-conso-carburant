/* ═══════════════════════════════════════════════════════════════════════
   secteur.js — Prix le moins cher du secteur (relevé quotidien)
   W38 (E85) → W48 (multi-carburant : E85 / Gazole / SP98).

   Le backend GAS (RefreshPrix.gs, ~7h) relève chaque jour le prix de chaque
   carburant des stations curées + des stations dans 15 km autour de la
   dernière position connue, et expose via ?action=sectorPrices&fuel=… :
     • byDate        : { 'yyyy-mm-dd' : prix mini ce jour-là pour ce carburant }
     • byStationDate : { 'Nom station' : { 'yyyy-mm-dd' : prix ce jour-là } }   (W60)
     • today         : { station, prix, date } — meilleur prix du jour
     • fuel          : carburant renvoyé

   Ce module :
     • charge ces données par carburant (cache localStorage, TTL 2 h) ;
     • fournit getSectorMinForDate(date, fuel) à l'historique (écart par plein) ;
     • W60 — fournit resolveHistPrice() + applyHistPriceToForm() : quand une date
       passée est saisie, remplit le prix avec celui de la station ce jour-là
       (relevé le plus proche avant à défaut), repli sur le mini secteur ;
     • rend la carte « Moins cher du secteur » E85 (#secteurCard, vue Saisie) ;
     • alimente la carte des stations (vue Carte) pour le carburant sélectionné.
═══════════════════════════════════════════════════════════════════════ */

import { GAS_URL, APP_TOKEN, SECTOR_CACHE_KEY, FUEL_CONFIG } from './config.js';
import { state } from './state.js';
import { setFieldPrice, updateCout } from './ui.js';

const CACHE_TTL = 2 * 60 * 60 * 1000;   // 2 h

// W60 — carburants réellement relevés dans _PrixHistory (RefreshPrix.gs).
// Les autres (SP95/E10/GPLc) n'ont pas d'historique → repli prix du jour.
const HIST_FUELS = ['E85', 'GAZOLE', 'SP98'];

// Données par carburant : { E85:{byDate,byStationDate,today}, GAZOLE:{…}, … }
const _store = {};

/** Clé de cache localStorage par carburant (E85 garde l'ancienne clé). */
function _cacheKey(fuel) {
  return fuel === 'E85' ? SECTOR_CACHE_KEY : SECTOR_CACHE_KEY + '_' + fuel;
}

function _slot(fuel) {
  if (!_store[fuel]) _store[fuel] = { byDate: {}, byStationDate: {}, today: null };
  return _store[fuel];
}

/* ─── Initialisation synchrone depuis le cache (dispo avant le fetch) ─── */
['E85', 'GAZOLE', 'SP98'].forEach(fuel => {
  try {
    const raw = localStorage.getItem(_cacheKey(fuel));
    if (!raw) return;
    const d = JSON.parse(raw);
    const s = _slot(fuel);
    if (d && d.byDate)        s.byDate        = d.byDate;
    if (d && d.byStationDate) s.byStationDate = d.byStationDate;
    if (d && d.today)         s.today         = d.today;
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
  // Cache encore frais ET au nouveau format (byStationDate présent) → pas de réseau.
  // Un cache d'une version antérieure (sans byStationDate) est considéré périmé
  // pour récupérer le prix par station dès le prochain chargement.
  try {
    const raw = localStorage.getItem(key);
    if (raw) {
      const d = JSON.parse(raw);
      if (d && d.ts && (Date.now() - d.ts) < CACHE_TTL && d.byStationDate) return d;
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
    s.byDate        = data.byDate        || {};
    s.byStationDate = data.byStationDate || {};
    s.today         = data.today         || null;
    try {
      localStorage.setItem(key, JSON.stringify({
        byDate: s.byDate, byStationDate: s.byStationDate, today: s.today, ts: Date.now()
      }));
    } catch { /* quota */ }
    return data;
  } catch (e) {
    console.warn('[secteur] chargement échoué (' + fuel + ') :', e.message || e);
    return null;
  }
}

/* ═══════════════════════════════════════════════════════════════════════
   W60 — Prix historique à la saisie d'un plein pour une date passée
═══════════════════════════════════════════════════════════════════════ */

/** Nom de la station sélectionnée (liste déroulante ou saisie manuelle). */
function _selectedStationName() {
  const sel = document.getElementById('stationSel');
  if (!sel) return '';
  if (sel.value === '__autre') return (document.getElementById('fAutre')?.value || '').trim();
  return (sel.value || '').trim();
}

function _setHistNote(msg, cls) {
  const el = document.getElementById('histNote');
  if (!el) return;
  if (!msg) { el.hidden = true; el.textContent = ''; el.className = 'hist-note'; return; }
  el.hidden = false;
  el.textContent = msg;
  el.className = 'hist-note' + (cls ? ' ' + cls : '');
}

function _frDate(iso) { return (iso || '').split('-').reverse().join('/'); }

/** Dans une map { 'yyyy-mm-dd': prix }, renvoie le relevé À la date ou le plus
 *  proche AVANT (date <= dateStr, date max). Retourne { prix, date } ou null. */
function _nearestPrior(map, dateStr) {
  if (!map) return null;
  let bestDate = null;
  for (const d in map) {
    if (d <= dateStr && (bestDate === null || d > bestDate)) bestDate = d;
  }
  if (bestDate === null) return null;
  const prix = Number(map[bestDate]);
  return (isFinite(prix) && prix > 0) ? { prix, date: bestDate } : null;
}

/**
 * Résout le prix de _PrixHistory pour une station, une date et un carburant.
 *   1) prix de la station sélectionnée, à la date ou au relevé le plus proche avant ;
 *   2) repli secteur (prix mini du jour, relevé le plus proche avant).
 * Retourne { prix, date, exact, scope:'station'|'secteur', station } ou null.
 */
export function resolveHistPrice(station, dateStr, fuel = 'E85') {
  if (!dateStr) return null;
  const s = _slot(fuel);
  const stMap = (station && s.byStationDate) ? s.byStationDate[station] : null;
  const hitStation = _nearestPrior(stMap, dateStr);
  if (hitStation) {
    return { prix: hitStation.prix, date: hitStation.date,
             exact: hitStation.date === dateStr, scope: 'station', station };
  }
  const hitSector = _nearestPrior(s.byDate, dateStr);
  if (hitSector) {
    return { prix: hitSector.prix, date: hitSector.date,
             exact: hitSector.date === dateStr, scope: 'secteur', station: '' };
  }
  return null;
}

/**
 * Quand une date passée est sélectionnée dans la saisie, remplace le prix live
 * par le prix historique (_PrixHistory) du carburant courant. Date du jour /
 * future → restaure le prix live si on l'avait écrasé. Idempotent et best-effort.
 */
export async function applyHistPriceToForm() {
  const dateEl = document.getElementById('fDate');
  const fp     = document.getElementById('fPrix');
  if (!dateEl || !fp) return;

  const date  = dateEl.value;
  const today = _todayIso();
  const fuel  = state.currentType || 'E85';
  const cfg   = FUEL_CONFIG[fuel] || {};
  const ph    = cfg.ph || '';
  const short = cfg.short || fuel;

  // ── Date du jour (ou future) : prix live ; on nettoie la note ─────────────
  if (!date || date >= today) {
    if (state._histPriceApplied) {
      setFieldPrice('fPrix', state._stationPrices[fuel] || null, ph);
      updateCout();
      state._histPriceApplied = false;
    }
    _setHistNote('', '');
    return;
  }

  // ── Carburant non relevé dans _PrixHistory (SP95/E10/GPLc) ────────────────
  if (HIST_FUELS.indexOf(fuel) < 0) {
    state._histPriceApplied = false;
    _setHistNote(`ℹ️ ${short} non relevé dans l'historique — prix du jour affiché`, 'info');
    return;
  }

  // ── Date passée : prix historique de la station, repli secteur ────────────
  await loadSectorPrices(fuel);          // best-effort (cache 2 h)
  const station = _selectedStationName();
  const res = resolveHistPrice(station, date, fuel);

  if (res && res.prix > 0) {
    setFieldPrice('fPrix', res.prix, ph);
    updateCout();
    state._histPriceApplied = true;
    const lieu  = (res.scope === 'station' && station)
      ? station.replace(/^Secteur - /, '')
      : 'moins cher du secteur';
    const quand = res.exact ? `le ${_frDate(date)}` : `relevé du ${_frDate(res.date)}`;
    _setHistNote(`📅 Prix ${short} ${quand} · ${lieu}`, 'ok');
  } else {
    setFieldPrice('fPrix', null, ph);
    updateCout();
    state._histPriceApplied = true;
    _setHistNote(`📅 Aucun relevé ${short} avant le ${_frDate(date)} — saisie manuelle`, 'warn');
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
