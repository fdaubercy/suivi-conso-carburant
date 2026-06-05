// @vitest-environment jsdom
/**
 * Tests — js/carte.js (W72)
 * Math de tuiles Web-Mercator (tileXY), rendu OSM maison (_renderMap),
 * point d'entrée showMap/hideMap et libellé de pin.
 * gmaprender est mocké (repli OSM forcé) ; state/utils/config/brand réels.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

vi.mock('../js/gmaprender.js', () => ({
  googleMapsActive:       vi.fn(() => false),
  renderGoogleStationMap: vi.fn(),
}));

import { tileXY, _renderMap, showMap, hideMap, showPinLabel } from '../js/carte.js';
import { state } from '../js/state.js';

beforeEach(() => {
  vi.clearAllMocks();
  state.currentType  = 'E85';
  state._mapStations = [];
  document.body.innerHTML = '<div id="stationMapWrap" class="hidden"><div id="stationMap"></div></div>';
});

describe('tileXY — conversion lat/lon → tuile', () => {
  it('place l’origine (0,0) sur la tuile centrale au zoom 1', () => {
    expect(tileXY(0, 0, 1)).toEqual({ x: 1, y: 1 });
  });
  it('double les indices quand le zoom augmente', () => {
    expect(tileXY(0, 0, 2)).toEqual({ x: 2, y: 2 });
  });
  it('une latitude nord donne un y plus petit (vers le haut de la carte)', () => {
    expect(tileXY(45, 0, 2).y).toBeLessThan(tileXY(0, 0, 2).y);
  });
});

describe('_renderMap — repli OpenStreetMap maison', () => {
  it('génère les tuiles OSM, un pin par station (nom échappé) et l’attribution', () => {
    state._mapStations = [
      { name: 'Shell <a>', lat: 50.37, lon: 3.08, prices: { E85: 0.799 } },
      { name: 'BP',        lat: 50.40, lon: 3.10, prices: {} },
    ];
    _renderMap(50.38, 3.09);
    const html = document.getElementById('stationMap').innerHTML;
    expect(html).toContain('tile.openstreetmap.org');
    expect(html).toContain('id="mapPin0"');
    expect(html).toContain('id="mapPin1"');
    expect(html).toContain('Shell &lt;a&gt;');   // nom échappé
    expect(html).toContain('© OSM');
  });
});

describe('showMap / hideMap', () => {
  afterEach(() => vi.useRealTimers());

  it('filtre les sans-coords, dé-masque le conteneur puis rend (repli OSM différé)', () => {
    vi.useFakeTimers();
    showMap(50.38, 3.09, [
      { name: 'X',         lat: 50.37, lon: 3.08, prices: {} },
      { name: 'SansCoord', lat: null,  lon: null, prices: {} },
    ]);
    const wrap = document.getElementById('stationMapWrap');
    expect(wrap.classList.contains('hidden')).toBe(false);
    expect(state._mapStations).toHaveLength(1);
    vi.runAllTimers();
    expect(document.getElementById('stationMap').innerHTML).not.toBe('');
  });

  it('ne fait rien si aucune station n’a de coordonnées', () => {
    expect(() => showMap(0, 0, [{ name: 'X', lat: null, lon: null }])).not.toThrow();
    expect(state._mapStations).toHaveLength(0);
  });

  it('hideMap re-masque le conteneur', () => {
    document.getElementById('stationMapWrap').classList.remove('hidden');
    hideMap();
    expect(document.getElementById('stationMapWrap').classList.contains('hidden')).toBe(true);
  });
});

describe('showPinLabel', () => {
  afterEach(() => vi.useRealTimers());
  it('rend le libellé visible puis le masque après 2 s', () => {
    vi.useFakeTimers();
    document.body.innerHTML = '<div id="mapPinLbl3"></div>';
    showPinLabel(3);
    const lbl = document.getElementById('mapPinLbl3');
    expect(lbl.style.opacity).toBe('1');
    vi.advanceTimersByTime(2000);
    expect(lbl.style.opacity).toBe('');
  });
});
