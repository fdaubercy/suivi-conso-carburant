// @vitest-environment jsdom
/**
 * Tests — js/recherche.js (W72)
 * Recherche manuelle par ville / CP / adresse.
 * Logique pure (buildSearchClause), fabrique de stations (buildStations),
 * debounce des saisies + 1 orchestration heureuse de searchStationSuggestions.
 * carte/geo/osm/ui sont mockés ; config/state/utils restent réels.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('../js/carte.js', () => ({ showMap: vi.fn() }));
vi.mock('../js/geo.js',   () => ({ renderNearby: vi.fn(), updateNearbyName: vi.fn() }));
vi.mock('../js/osm.js',   () => ({ enrichStationsBulk: vi.fn(() => Promise.resolve(false)) }));
vi.mock('../js/ui.js',    () => ({ setAutreStatus: vi.fn() }));

import {
  buildSearchClause, buildStations, setRadius, onAutreInput, searchStationSuggestions,
} from '../js/recherche.js';
import { state } from '../js/state.js';
import { setAutreStatus } from '../js/ui.js';
import { showMap } from '../js/carte.js';
import { renderNearby } from '../js/geo.js';

beforeEach(() => {
  vi.clearAllMocks();
  state.currentType  = 'E85';
  state.searchRadiusM = 5000;
  state.userLat = null; state.userLon = null;
  state._nearbyStations = [];
  document.body.innerHTML = '<select id="knownGroup"></select><input id="fAutre"><div id="nearbyList"></div>';
});

describe('buildSearchClause', () => {
  it('produit une clause « cp like » pour un code postal (2 à 5 chiffres)', () => {
    expect(buildSearchClause('59500')).toBe("cp like '59500%'");
    expect(buildSearchClause('59')).toBe("cp like '59%'");
  });
  it('produit une clause « search(ville, …) » pour un nom de ville', () => {
    expect(buildSearchClause('Douai')).toBe("search(ville, 'Douai')");
  });
  it('échappe les apostrophes (doublées) dans le nom de ville', () => {
    expect(buildSearchClause("L'Île")).toBe("search(ville, 'L''Île')");
  });
});

describe('buildStations', () => {
  const rec = (lat, lon, adresse, ville, e85) => ({ geom: { lat, lon }, adresse, ville, e85_prix: e85 });

  it('filtre les sans-coordonnées, calcule la distance et trie par distance croissante', () => {
    const center = { lat: 50.37, lon: 3.08 };
    const results = [
      rec(50.40, 3.10, '2 rue Autre', 'Lille', 0.81),     // plus loin
      rec(50.37, 3.08, '1 rue Test',  'Douai', 0.79),     // au centre
      { adresse: 'sans geom', ville: 'X' },               // exclu (pas de coords)
    ];
    const out = buildStations(results, center);
    expect(out).toHaveLength(2);
    expect(out[0].lat).toBe(50.37);          // le plus proche d'abord
    expect(out[0].dist).toBeLessThan(out[1].dist);
    expect(out[0].prices.E85).toBe(0.79);
    expect(out[0].name).toContain('Douai');  // composeStationName → « … - Douai »
  });

  it('marque « known » une station dont la ville figure dans #knownGroup', () => {
    document.getElementById('knownGroup').innerHTML = '<option value="le coin douai">x</option>';
    const out = buildStations([rec(50.37, 3.08, '1 rue Test', 'Douai', 0.79)], { lat: 50.37, lon: 3.08 });
    expect(out[0].known).toBe(true);
  });
});

describe('setRadius', () => {
  it('mémorise le rayon, active le bouton et lance un spin si la requête fait ≥ 3 car.', () => {
    document.body.innerHTML += '<button class="radius-btn"></button><button class="radius-btn"></button>';
    document.getElementById('fAutre').value = 'Douai';
    const btn = document.querySelectorAll('.radius-btn')[1];
    setRadius(btn, 10000);
    expect(state.searchRadiusM).toBe(10000);
    expect(btn.classList.contains('active')).toBe(true);
    expect(setAutreStatus).toHaveBeenCalledWith('spin', 'Recherche…');
  });
});

describe('onAutreInput', () => {
  it('masque la liste et efface le statut si la saisie fait < 3 caractères', () => {
    document.getElementById('fAutre').value = 'ab';
    onAutreInput();
    expect(document.getElementById('nearbyList').style.display).toBe('none');
    expect(setAutreStatus).toHaveBeenCalledWith('', '');
  });
});

describe('searchStationSuggestions — orchestration heureuse', () => {
  it('géocode via BAN puis liste les stations (renderNearby + showMap + statut ok)', async () => {
    const ban = {
      ok: true,
      json: () => Promise.resolve({ features: [{
        geometry: { coordinates: [3.08, 50.37] },
        properties: { label: 'Douai', city: 'Douai', citycode: '59178', postcode: '59500', type: 'municipality' },
      }] }),
    };
    const prix = {
      ok: true,
      json: () => Promise.resolve({ results: [{ geom: { lat: 50.37, lon: 3.08 }, adresse: '1 rue Test', ville: 'Douai', e85_prix: 0.799 }] }),
    };
    global.fetch = vi.fn().mockResolvedValueOnce(ban).mockResolvedValueOnce(prix);

    await searchStationSuggestions('Douai');

    expect(global.fetch).toHaveBeenCalledTimes(2);
    expect(renderNearby).toHaveBeenCalled();
    expect(showMap).toHaveBeenCalled();
    expect(state._nearbyStations).toHaveLength(1);
    expect(setAutreStatus).toHaveBeenCalledWith('ok', expect.stringContaining('Douai'));
  });
});
