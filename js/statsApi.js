/* ─── W59 / S12 — Client des agrégats serveur (endpoint GAS action=stats) ───
   Récupère des stats pré-calculées côté Apps Script (mensuel, KPIs annuels,
   comparatif véhicules) et les met en cache localStorage (TTL 1 h) pour un
   démarrage plus rapide sur mobile, sans télécharger tout l'historique.
   Tolérant aux pannes : retourne null si l'endpoint est absent / hors-ligne
   (le client garde alors son calcul local comme source de vérité). */
import { GAS_URL, APP_TOKEN, STATS_CACHE_KEY } from './config.js';
import { getIdToken } from './auth.js';

export const STATS_TTL_MS = 60 * 60 * 1000;   // 1 h

/** Clé logique d'un jeu de stats (véhicule + année). */
export function statsKey(veh = '', year = 0) {
  return (veh || '') + '|' + (year || 0);
}

/** Construit l'URL de l'endpoint stats (testable, sans I/O). */
export function buildStatsUrl(base, token, { veh = '', year = 0, idToken = '' } = {}) {
  let url = base + '?action=stats';
  if (veh)  url += '&veh='  + encodeURIComponent(veh);
  if (year) url += '&year=' + encodeURIComponent(year);
  if (token) url += '&token=' + encodeURIComponent(token);
  if (idToken) url += '&idToken=' + encodeURIComponent(idToken);   // U7 — identité du compte
  return url;
}

/** Une entrée de cache est-elle encore fraîche ? (testable) */
export function isFresh(entry, ttlMs = STATS_TTL_MS, now = Date.now()) {
  return !!entry && typeof entry.ts === 'number' && (now - entry.ts) < ttlMs;
}

/** Lit l'entrée de cache (JSON brut → objet) pour une clé donnée. */
export function readStatsCache(raw, key) {
  if (!raw) return null;
  try {
    const map = JSON.parse(raw);
    return (map && map[key]) || null;
  } catch { return null; }
}

/** Écrit/replace une entrée de cache et renvoie le JSON sérialisé. */
export function writeStatsCache(raw, key, data, now = Date.now()) {
  let map = {};
  if (raw) { try { map = JSON.parse(raw) || {}; } catch { map = {}; } }
  map[key] = { ts: now, data };
  return JSON.stringify(map);
}

/** Retourne les stats en cache (sync, même périmées) ou null — rendu instantané. */
export function getCachedServerStats(veh = '', year = 0) {
  const entry = readStatsCache(localStorage.getItem(STATS_CACHE_KEY), statsKey(veh, year));
  return entry ? entry.data : null;
}

/**
 * Récupère les stats serveur (cache frais sinon fetch). Retourne null en cas
 * d'échec réseau / endpoint absent. `force` ignore le cache.
 */
export async function getServerStats(veh = '', year = 0, { force = false } = {}) {
  const key = statsKey(veh, year);
  const raw = localStorage.getItem(STATS_CACHE_KEY);
  if (!force) {
    const entry = readStatsCache(raw, key);
    if (isFresh(entry)) return entry.data;
  }
  try {
    const url  = buildStatsUrl(GAS_URL, APP_TOKEN, { veh, year, idToken: getIdToken() || '' });
    const resp = await fetch(url, { redirect: 'follow' });
    if (!resp.ok) return getCachedServerStats(veh, year);
    const data = await resp.json();
    if (!data || data.kpis === undefined) return getCachedServerStats(veh, year);
    try { localStorage.setItem(STATS_CACHE_KEY, writeStatsCache(raw, key, data)); } catch { /* quota */ }
    return data;
  } catch {
    return getCachedServerStats(veh, year);   // hors-ligne : repli sur le cache
  }
}

/** Pré-chauffe le cache en tâche de fond (fire-and-forget). */
export function prewarmServerStats(veh = '', year = 0) {
  getServerStats(veh, year).catch(() => { /* silencieux */ });
}
