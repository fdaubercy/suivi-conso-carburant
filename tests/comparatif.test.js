// @vitest-environment jsdom
/**
 * Tests — js/comparatif.js (W41 + W52)
 * Logique pure : agrégation conso/coût par véhicule + génération du CSV d'export.
 * getAllRecords (historique.js) et showFeedback (ui.js) sont mockés.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';

const h = vi.hoisted(() => ({ records: [] }));
vi.mock('../js/historique.js', () => ({ getAllRecords: () => h.records }));
vi.mock('../js/ui.js', () => ({ showFeedback: () => {} }));

import { computeVehicleComparison, buildComparatifCSV } from '../js/comparatif.js';

beforeEach(() => { h.records = []; });

// Plein minimal exploitable (km croissants pour kmDelta > 0).
const plein = (veh, km, litres, prix) => ({
  'Véhicule': veh, 'Km compteur': km, 'Nb. Litres': litres, 'Prix €/L': prix,
});

describe('computeVehicleComparison', () => {
  it('agrège conso/coût par véhicule et trie par coût/100 km croissant', () => {
    h.records = [
      plein('Moto', 1000, 10, 0.80),
      plein('Moto', 1500, 10, 0.80),   // 500 km, 20 L (selon delta) -> conso élevée
      plein('Auto', 2000, 30, 1.70),
      plein('Auto', 3000, 30, 1.70),   // 1000 km
    ];
    const res = computeVehicleComparison();
    expect(res.length).toBe(2);
    // kmDelta Moto = 500, litres 20 -> conso 4 L/100 ; Auto kmDelta 1000, litres 60 -> 6 L/100
    const moto = res.find(r => r.veh === 'Moto');
    const auto = res.find(r => r.veh === 'Auto');
    expect(moto.conso).toBeCloseTo(4, 3);
    expect(auto.conso).toBeCloseTo(6, 3);
    expect(moto.nb).toBe(2);
  });

  it('exclut les véhicules sans delta km exploitable', () => {
    h.records = [plein('Solo', 1000, 10, 0.80)];   // un seul point -> kmDelta 0
    expect(computeVehicleComparison()).toEqual([]);
  });
});

describe('buildComparatifCSV', () => {
  const rows = [
    { veh: 'Moto', nb: 3, conso: 4.123, coutPer100: 3.5, totalCout: 42, totalLitres: 30, kmDelta: 728 },
  ];

  it('génère un en-tête avec séparateur point-virgule', () => {
    const header = buildComparatifCSV([]).split('\r\n')[0];
    expect(header).toBe('Véhicule;Pleins;Conso (L/100 km);Coût (€/100 km);Total dépensé (€);Litres cumulés;Km parcourus');
  });

  it('exporte une ligne avec virgule décimale et km arrondi', () => {
    const row = buildComparatifCSV(rows).split('\r\n')[1];
    expect(row).toContain('Moto');
    expect(row).toContain('4,12');     // conso 2 décimales virgule
    expect(row).toContain('3,50');     // coût/100
    expect(row).toContain('728');      // km arrondi, sans décimale
  });

  it('échappe les noms de véhicule contenant le séparateur', () => {
    const csv = buildComparatifCSV([{ ...rows[0], veh: 'Moto; bis' }]);
    expect(csv).toContain('"Moto; bis"');
  });
});
