// @vitest-environment node
/**
 * Tests — js/refmodel.js
 * Modèle de référence unifié pour comparer l'E85 à un carburant au choix
 * (essence SP98/SP95/E10 ou gazole/diesel). Logique pure, sans DOM.
 */
import { describe, it, expect } from 'vitest';
import { computeConsoMoy, buildRefModel, resolveConsoDiesel } from '../js/refmodel.js';

const E85 = 'SuperEthanol E85', GAZ = 'Gazole';
// Pleins E85 : 0→500 km (35 L), 500→1000 km (36 L) ⇒ ~7,1 L/100
const recE85 = [
  { Date: '2026-01-01', Type: E85, 'Km compteur': 0,    'Nb. Litres': 30 },
  { Date: '2026-01-10', Type: E85, 'Km compteur': 500,  'Nb. Litres': 35 },
  { Date: '2026-01-20', Type: E85, 'Km compteur': 1000, 'Nb. Litres': 36 },
];

describe('computeConsoMoy', () => {
  it('calcule la conso L/100 sur les deltas km du carburant', () => {
    const c = computeConsoMoy(recE85, 'E85');
    expect(c).toBeGreaterThan(6.5);
    expect(c).toBeLessThan(7.5);
  });
  it('rend 0 sans données exploitables', () => {
    expect(computeConsoMoy([], 'E85')).toBe(0);
  });
  it('ignore un autre carburant', () => {
    expect(computeConsoMoy(recE85, 'GAZOLE')).toBe(0);
  });
});

describe('resolveConsoDiesel', () => {
  const recDiesel = [
    { Date: '2026-02-01', Type: GAZ, Véhicule: 'Berline', 'Km compteur': 1000, 'Nb. Litres': 28 },
    { Date: '2026-02-10', Type: GAZ, Véhicule: 'Berline', 'Km compteur': 1500, 'Nb. Litres': 27 },
  ];
  it('mesure la conso sur les pleins gazole du véhicule choisi', () => {
    // segment 1000→1500 km, 27 L ⇒ 5,4 L/100
    expect(resolveConsoDiesel(recDiesel, 'Berline', 0)).toBeCloseTo(5.4, 3);
  });
  it('repli sur la saisie manuelle si aucun plein diesel mesurable', () => {
    expect(resolveConsoDiesel([], '', 6.2)).toBeCloseTo(6.2, 6);
  });
  it('repli final 5,5 L/100 sans données ni saisie', () => {
    expect(resolveConsoDiesel([], '', 0)).toBeCloseTo(5.5, 6);
  });
});

describe('buildRefModel — essence (non-régression)', () => {
  it('ratioConso = 1/(1+surconso) et CO2 essence', () => {
    const m = buildRefModel({ refKey: 'SP98', consoE85: 9, surconso: 0.25, ecartRef: 0, allRecords: [] });
    expect(m.isDiesel).toBe(false);
    expect(m.ratioConso).toBeCloseTo(1 / 1.25, 6);
    expect(m.co2RefPerL).toBeCloseTo(2.21, 6);
  });
  it('refPrice = SP98 station − écart', () => {
    const m = buildRefModel({ refKey: 'SP98', consoE85: 9, surconso: 0.25, ecartRef: 0.05, allRecords: [] });
    expect(m.refPriceFromFill({ 'SP98 station (€/L)': 2.00 }, 2.00)).toBeCloseTo(1.95, 6);
  });
  it('refPrice repli sur la moyenne quand le plein n a pas de prix SP98', () => {
    const m = buildRefModel({ refKey: 'SP95', consoE85: 9, surconso: 0.2, ecartRef: 0.10, allRecords: [] });
    expect(m.refPriceFromFill({}, 1.90)).toBeCloseTo(1.80, 6);
  });
});

describe('buildRefModel — diesel', () => {
  const recDiesel = [
    { Date: '2026-02-01', Type: GAZ, Véhicule: 'Berline', 'Km compteur': 1000, 'Nb. Litres': 28 },
    { Date: '2026-02-10', Type: GAZ, Véhicule: 'Berline', 'Km compteur': 1500, 'Nb. Litres': 27 },
  ];
  it('ratioConso = consoDiesel/consoE85 avec véhicule diesel loggé', () => {
    // consoDiesel = 5,4 ; consoE85 = 9 ⇒ ratio = 0,6
    const m = buildRefModel({
      refKey: 'GAZOLE', consoE85: 9, surconso: 0.25, ecartRef: 0,
      allRecords: recDiesel, vehiculeDieselRef: 'Berline',
    });
    expect(m.isDiesel).toBe(true);
    expect(m.ratioConso).toBeCloseTo(0.6, 3);
    expect(m.co2RefPerL).toBeCloseTo(2.68, 6);
  });
  it('repli défaut 5,5 L/100 sans véhicule diesel', () => {
    const m = buildRefModel({
      refKey: 'GAZOLE', consoE85: 11, surconso: 0.25, ecartRef: 0,
      allRecords: [], consoDieselManuelle: 0,
    });
    expect(m.ratioConso).toBeCloseTo(5.5 / 11, 6);
  });
  it('ratioConso = 0 si consoE85 indéterminée', () => {
    const m = buildRefModel({ refKey: 'GAZOLE', consoE85: 0, surconso: 0.25, ecartRef: 0, allRecords: [] });
    expect(m.ratioConso).toBe(0);
  });
  it('refPrice diesel = prix gazole station (sans écart)', () => {
    const m = buildRefModel({ refKey: 'GAZOLE', consoE85: 9, surconso: 0.25, ecartRef: 0.05, allRecords: [] });
    expect(m.refPriceFromFill({ 'Gazole station (€/L)': 1.75 }, 1.75)).toBeCloseTo(1.75, 6);
  });
});
