/* ─── API prix carburants ─── */
import { FUEL_CONFIG, FUEL_KEYS, FUEL_SELECT, FUEL_ANY } from './config.js';
import { state } from './state.js';
import { haversine, odsUrl } from './utils.js';
import { setS98Status, showCpSearch, hideCpSearch, setFieldPrice, updateCout } from './ui.js';
import { _buildTypeToggle, _updateHeaderBadges } from './carburant.js';

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

  const cfg = FUEL_CONFIG[state.currentType];
  setFieldPrice('fPrix', state._stationPrices[state.currentType] || null, cfg.ph);
  setFieldPrice('fPrixS98', state._stationPrices['SP98'] || null, '2.091');
  state.s98Autofilled = !!state._stationPrices['SP98'];
  updateCout();

  const label = [r.adresse, r.ville].filter(Boolean).join(' · ');
  const found = FUEL_KEYS
    .filter(k => state._stationPrices[k])
    .map(k => FUEL_CONFIG[k].short + ' : ' + parseFloat(state._stationPrices[k]).toFixed(3) + ' €/L');

  found.length
    ? setS98Status('ok', found.join(' · ') + (label ? ' — ' + label : ''))
    : (setS98Status('info', 'Aucun prix trouvé — code postal :'), showCpSearch());
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
    setFieldPrice('fPrixS98', null, '2.091');
    updateCout();
    setS98Status('info', 'Prix non trouvés — entrez le code postal :'); showCpSearch();
  }
}

/** Cherche les prix à la position GPS courante. */
export async function fetchPricesNearUser() {
  if (state.userLat && state.userLon) {
    await fetchPricesAtCoords(state.userLat, state.userLon, false);
  } else {
    setS98Status('info', 'Position inconnue — entrez le code postal :');
    showCpSearch();
  }
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
