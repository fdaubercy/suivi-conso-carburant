// @vitest-environment jsdom
/**
 * Tests — js/stationsmap.js (T6)
 * Logique pure : moyennes de prix par station/carburant + cache de coordonnées.
 * getAllRecords (historique.js) est mocké ; localStorage fourni par jsdom.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';

// État mutable partagé avec le mock (vi.hoisted → dispo avant l'usine de mock).
const h = vi.hoisted(() => ({ records: [] }));
vi.mock('../js/historique.js', () => ({
  getAllRecords: () => h.records,
}));

import { computeStationAverages, cacheStationCoords } from '../js/stationsmap.js';

const COORD_KEY = 'suivi_e85_station_coords';

beforeEach(() => {
  localStorage.clear();
  h.records = [];
});

// Helper de fabrication d'un plein.
const plein = (station, type, prix) => ({
  'Station essence': station, Type: type, 'Prix €/L': prix,
});

describe('computeStationAverages', () => {
  it('retourne un tableau vide sans données', () => {
    expect(computeStationAverages('E85')).toEqual([]);
  });

  it('moyenne les prix E85 par station et trie par prix croissant', () => {
    h.records = [
      plein('Leclerc - Lille',   'SuperEthanol E85', 0.80),
      plein('Leclerc - Lille',   'SuperEthanol E85', 0.82),   // moyenne 0.81
      plein('Carrefour - Douai', 'SuperEthanol E85', 0.75),
    ];
    const res = computeStationAverages('E85');
    expect(res.map(r => r.name)).toEqual(['Carrefour - Douai', 'Leclerc - Lille']);
    expect(res[0].avg).toBeCloseTo(0.75, 3);
    expect(res[1].avg).toBeCloseTo(0.81, 3);
    expect(res[1].count).toBe(2);
  });

  it('filtre par carburant demandé', () => {
    h.records = [
      plein('Station A', 'SuperEthanol E85', 0.80),
      plein('Station A', 'Gazole',           1.70),
      plein('Station B', 'Gazole',           1.65),
    ];
    const e85 = computeStationAverages('E85');
    expect(e85.map(r => r.name)).toEqual(['Station A']);

    const gazole = computeStationAverages('GAZOLE');
    expect(gazole.map(r => r.name).sort()).toEqual(['Station A', 'Station B']);
  });

  it('reconnaît le SP98 via « Super 98 » ou « 98 »', () => {
    h.records = [
      plein('Station A', 'Super 98', 1.90),
      plein('Station B', 'SP98',     1.85),
    ];
    const res = computeStationAverages('SP98');
    expect(res.length).toBe(2);
    expect(res[0].name).toBe('Station B');   // 1.85 < 1.90
  });

  it('ignore les prix invalides, nuls ou négatifs et les stations sans nom', () => {
    h.records = [
      plein('Station A', 'SuperEthanol E85', 0),
      plein('Station A', 'SuperEthanol E85', -1),
      plein('Station A', 'SuperEthanol E85', NaN),
      plein('',          'SuperEthanol E85', 0.80),
      plein('Station A', 'SuperEthanol E85', 0.79),
    ];
    const res = computeStationAverages('E85');
    expect(res.length).toBe(1);
    expect(res[0].avg).toBeCloseTo(0.79, 3);
    expect(res[0].count).toBe(1);
  });

  it('défaut sur E85 si aucun carburant n\'est précisé', () => {
    h.records = [plein('Station A', 'SuperEthanol E85', 0.80)];
    expect(computeStationAverages().map(r => r.name)).toEqual(['Station A']);
  });
});

describe('cacheStationCoords', () => {
  it('persiste lat/lon/src dans localStorage', () => {
    cacheStationCoords('Carrefour - Douai', 50.37, 3.08, 'pick');
    const cache = JSON.parse(localStorage.getItem(COORD_KEY));
    expect(cache['Carrefour - Douai']).toEqual({ lat: 50.37, lon: 3.08, src: 'pick' });
  });

  it('src défaut = pick quand non précisé', () => {
    cacheStationCoords('Station X', 48.85, 2.35);
    const cache = JSON.parse(localStorage.getItem(COORD_KEY));
    expect(cache['Station X'].src).toBe('pick');
  });

  it('ignore les appels incomplets (nom ou coords manquants)', () => {
    cacheStationCoords('', 50, 3, 'pick');
    cacheStationCoords('Station Y', 0, 3, 'pick');
    cacheStationCoords('Station Z', 50, 0, 'pick');
    expect(localStorage.getItem(COORD_KEY)).toBeNull();
  });

  it('met à jour une station déjà en cache', () => {
    cacheStationCoords('Station A', 50, 3, 'geo');
    cacheStationCoords('Station A', 51, 4, 'pick');
    const cache = JSON.parse(localStorage.getItem(COORD_KEY));
    expect(cache['Station A']).toEqual({ lat: 51, lon: 4, src: 'pick' });
  });
});
