/* ─── API prix carburants ─── */
import { FUEL_CONFIG, FUEL_KEYS, FUEL_SELECT, FUEL_ANY, E85_RENTABLE_RATIO } from './config.js';
import { state } from './state.js';
import { haversine, odsUrl } from './utils.js';
import { setS98Status, showCpSearch, hideCpSearch, setFieldPrice, updateCout } from './ui.js';
import { _buildTypeToggle, _updateHeaderBadges } from './carburant.js';
import { checkPrixE85Alert } from './notifications.js';

/** Évalue la rentabilité E85 vs SP98 à partir des prix station chargés. */
export function evalRentabiliteE85() {
  const el = document.getElementById('rentaBadge');
  if (!el) return;

  const e85  = parseFloat(state._stationPrices?.E85);
  const sp98 = parseFloat(state._stationPrices?.SP98);

  if (!isFinite(e85) || !isFinite(sp98) || e85 <= 0 || sp98 <= 0) {
    el.className = 'renta-badge hidden';
    el.textContent = '';
    return;
  }

  const ratio  = e85 / sp98;
  const seuil  = E85_RENTABLE_RATIO;
  const pct    = Math.round(ratio * 100);
  const pctSeuil = Math.round(seuil * 100);

  if (ratio < seuil) {
    el.textContent = `✓ E85 rentable — ${pct}% du SP98 (seuil ${pctSeuil}%)`;
    el.className   = 'renta-badge ok';
  } else {
    el.textContent = `⚠ E85 peu rentable — ${pct}% du SP98 (seuil ${pctSeuil}%)`;
    el.className   = 'renta-badge warn';
  }
}
import { updateRentabilite } from './rentabilite.js';

/** Parse tous les prix d'un résultat API, met à jour l'état et l'UI. */
export function applyPricesResult(data) {
  const r = data.results[0];
  state._stationPrices = {};
  FUEL_KEYS.forEach(k => {
    const v = r[FUEL_CONFIG[k].apiField];
    if (v != null && parseFloat(v) > 0) state._stationPrices[k] = v;
  });

  _buildTypeToggle(state._stationPrices);
  _updateHeaderBadges();
  evalRentabiliteE85();

  const cfg = FUEL_CONFIG[state.currentType];
  setFieldPrice('fPrix', state._stationPrices[state.currentType] || null, cfg.ph);
  updateCout();

  // Prix maintenant affiches directement dans les boutons -> on efface le statut verbeux
  // Conserve uniquement le cas "aucun prix" (fallback vers la saisie manuelle)
  if (Object.keys(state._stationPrices).length > 0) {
    setS98Status('', '');
  } else {
    setS98Status('info', 'Aucun prix trouvé — code postal :');
    showCpSearch();
  }

  updateRentabilite();

  /* ── Alerte notification prix E85 ──────────────────────────────────
   * Vérifie si le prix E85 de la station est sous le seuil configuré.
   * La station sélectionnée est récupérée depuis le select.             */
  if (state._stationPrices.E85) {
    const stationEl = document.getElementById('stationSel');
    const station   = stationEl?.value && stationEl.value !== '__autre'
      ? stationEl.value
      : (document.getElementById('fAutre')?.value || '');
    checkPrixE85Alert(state._stationPrices.E85, station);
  }
}

/** Cherche les prix autour de (lat, lon) par cercles croissants (500 m → 2 km → 5 km). */
export async function fetchPricesAtCoords(lat, lon, fallbackToUser = false) {
  setS98Status('spin', 'Recherche des prix…'); hideCpSearch();
  for (const r of [500, 2000, 5000]) {
    try {
      const resp = await fetch(odsUrl({
        where:  `${FUEL_ANY} and distance(geom, geom'POINT(${lon} ${lat})', ${r}m)`,
        select: FUEL_SELECT,
        limit:  1
      }));
      if (!resp.ok) throw new Error('HTTP ' + resp.status);
      const data = await resp.json();
      if (data.results?.length) { applyPricesResult(data); return; }
    } catch(e) { setS98Status('err', 'Erreur API (' + e.message + ') — saisie manuelle.'); return; }
  }
  if (fallbackToUser && state.userLat && state.userLon && haversine(lat, lon, state.userLat, state.userLon) > 100) {
    await fetchPricesAtCoords(state.userLat, state.userLon, false);
  } else {
    state._stationPrices = {}; _buildTypeToggle({}); _updateHeaderBadges();
    setFieldPrice('fPrix', null, FUEL_CONFIG[state.currentType].ph);
    updateCout();
    updateRentabilite();
    setS98Status('info', 'Prix non trouvés — entrez le code postal :'); showCpSearch();
  }
}

/** Cherche les prix à la position GPS courante. */
export async function fetchPricesNearUser() {
  if (state.userLat && state.userLon) {
    await fetchPricesAtCoords(state.userLat, state.userLon, false);
  } else {
    // GPS indisponible : vider les prix stale avant d'afficher le CP search
    state._stationPrices = {}; _buildTypeToggle({}); _updateHeaderBadges();
    setFieldPrice('fPrix', null, FUEL_CONFIG[state.currentType].ph);
    updateCout();
    updateRentabilite();
    setS98Status('info', 'Position inconnue — entrez le code postal :');
    showCpSearch();
  }
}

/** Cherche le prix E85 le plus proche d'un point (fallback pour pleins non-E85). */
export async function fetchNearestE85Price(lat, lon) {
  for (const r of [1000, 5000, 15000]) {
    try {
      const resp = await fetch(odsUrl({
        where:  `e85_prix is not null and distance(geom, geom'POINT(${lon} ${lat})', ${r}m)`,
        select: 'e85_prix',
        limit:  1
      }));
      if (!resp.ok) throw new Error();
      const data = await resp.json();
      if (data.results?.length && data.results[0].e85_prix != null) return data.results[0].e85_prix;
    } catch(e) { return null; }
  }
  return null;
}

/** Cherche les prix via code postal saisi manuellement. */
export async function fetchPricesByCP() {
  const cp = document.getElementById('fCp').value.trim();
  if (cp.length !== 5) { setS98Status('err', 'Code postal invalide (5 chiffres requis).'); return; }
  setS98Status('spin', 'Recherche dans ' + cp + '…');
  try {
    const resp = await fetch(odsUrl({ where: `${FUEL_ANY} AND cp="${cp}"`, select: FUEL_SELECT, limit: 1 }));
    if (!resp.ok) throw new Error('HTTP ' + resp.status);
    const data = await resp.json();
    data.results?.length
      ? (hideCpSearch(), applyPricesResult(data))
      : setS98Status('info', 'Aucune station trouvée pour ' + cp + ' — saisie manuelle.');
  } catch(e) { setS98Status('err', 'Erreur (' + e.message + ') — saisie manuelle.'); }
}
