// @vitest-environment jsdom
/**
 * Tests — js/geo.js (W72)
 * Rendu de la liste des stations proches + comparateur E85 + sélection.
 * ui/stationsmap/osm/carte/carburant/prix sont mockés ; config/state/utils réels.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('../js/ui.js',         () => ({ setGeoStatus: vi.fn() }));
vi.mock('../js/stationsmap.js', () => ({ cacheStationCoords: vi.fn() }));
vi.mock('../js/osm.js',        () => ({ enrichStationsBulk: vi.fn(() => Promise.resolve(false)), cancelOsmEnrich: vi.fn() }));
vi.mock('../js/carte.js',      () => ({ showMap: vi.fn() }));
vi.mock('../js/carburant.js',  () => ({ _buildTypeToggle: vi.fn(), _updateHeaderBadges: vi.fn() }));
vi.mock('../js/prix.js',       () => ({ fetchPricesAtCoords: vi.fn() }));

import {
  renderNearby, renderComparateur, updateNearbyName, highlightNearbyItem, pickStation,
} from '../js/geo.js';
import { state } from '../js/state.js';
import { fetchPricesAtCoords } from '../js/prix.js';

beforeEach(() => {
  vi.clearAllMocks();
  state.currentType = 'E85';
  document.body.innerHTML = `
    <div id="nearbyList"></div>
    <div id="comparateurCard" hidden></div>
    <select id="stationSel"><option value=""></option><optgroup id="knownGroup"></optgroup></select>
    <div id="autreField"></div>`;
});

describe('renderNearby', () => {
  const stations = [
    { name: 'Total <X>', sub: 'rue A', dist: 500,  lat: 1, lon: 2, prices: { E85: 0.799 }, known: true },
    { name: 'BP',        sub: 'rue B', dist: 1500, lat: 3, lon: 4, prices: {},             known: false },
  ];

  it('rend les items, échappe le nom, formate les distances et le prix', () => {
    renderNearby(stations);
    const list = document.getElementById('nearbyList');
    expect(list.style.display).toBe('block');
    expect(list.innerHTML).toContain('Total &lt;X&gt;');     // échappement HTML
    expect(list.innerHTML).toContain('500 m');               // < 1 km → mètres
    expect(list.innerHTML).toContain('1.5 km');              // ≥ 1 km → km
    expect(list.innerHTML).toContain('E85 0.799 €/L');       // prix carburant courant
    expect(list.querySelectorAll('.nearby-badge')).toHaveLength(1); // une seule « connue »
  });

  it('masque la liste si elle est vide', () => {
    renderNearby([]);
    expect(document.getElementById('nearbyList').style.display).toBe('none');
  });
});

describe('renderComparateur', () => {
  it('trie par prix E85 croissant et marque la meilleure offre', () => {
    renderComparateur([
      { name: 'Chère',    dist: 100, prices: { E85: 0.81 } },
      { name: 'Pas chère', dist: 800, prices: { E85: 0.79 } },
    ]);
    const card = document.getElementById('comparateurCard');
    expect(card.hidden).toBe(false);
    expect(card.innerHTML).toContain('Comparateur E85 (2 stations)');
    const firstRow = card.querySelector('tbody tr');
    expect(firstRow.className).toBe('comp-best');
    expect(firstRow.innerHTML).toContain('Pas chère');       // moins chère en tête
  });

  it('reste masqué si aucune station n’a de prix E85', () => {
    renderComparateur([{ name: 'X', dist: 10, prices: {} }]);
    expect(document.getElementById('comparateurCard').hidden).toBe(true);
  });
});

describe('updateNearbyName & highlightNearbyItem', () => {
  it('met à jour le nom affiché d’un item sans tout re-rendre', () => {
    renderNearby([{ name: 'Ancien', sub: '', dist: 0, lat: 1, lon: 2, prices: {}, known: false }]);
    updateNearbyName(0, 'Nouveau');
    expect(document.querySelector('#nearbyItem0 .nearby-name strong').textContent).toBe('Nouveau');
  });

  it('applique la classe « selected » au seul item ciblé', () => {
    renderNearby([
      { name: 'A', sub: '', dist: 0, lat: 1, lon: 2, prices: {}, known: false },
      { name: 'B', sub: '', dist: 0, lat: 3, lon: 4, prices: {}, known: false },
    ]);
    highlightNearbyItem(1);
    const items = document.querySelectorAll('.nearby-item');
    expect(items[0].classList.contains('selected')).toBe(false);
    expect(items[1].classList.contains('selected')).toBe(true);
  });
});

describe('pickStation', () => {
  it('ajoute l’option, la sélectionne, mémorise les coords et déclenche les prix', () => {
    pickStation('Esso - Lyon', 45.75, 4.85);
    const sel = document.getElementById('stationSel');
    expect(Array.from(sel.options).some(o => o.value === 'Esso - Lyon')).toBe(true);
    expect(sel.value).toBe('Esso - Lyon');
    expect(state._selectedLat).toBe(45.75);
    expect(state._selectedLon).toBe(4.85);
    expect(fetchPricesAtCoords).toHaveBeenCalledWith(45.75, 4.85, true);
  });
});
