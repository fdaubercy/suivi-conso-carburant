// @vitest-environment jsdom
/**
 * Tests — W93 : économie par plein E85 vs carburant de référence
 * (statsParams.computeEcoByFill, affichée dans l'historique).
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('../js/historique.js', () => ({ getAllRecords: () => [] }));

import { computeEcoByFill } from '../js/statsParams.js';

const E85 = 'SuperEthanol E85';
const plein = (o = {}) => ({
  Date: '2026-09-01', Horodatage: '2026-09-01 08:00:00', 'Véhicule': 'Z900',
  Type: E85, 'Km compteur': 1000, 'Nb. Litres': 40, 'Prix €/L': 0.8,
  'SP98 station (€/L)': 1.9, ...o,
});

beforeEach(() => {
  localStorage.clear();
  localStorage.setItem('suivi_e85_surconso', '0.25');   // repli (aucun plein SP98 mesurable)
});

describe('computeEcoByFill', () => {
  it('calcule litres/(1+surconso) × prix SP98 − coût du plein E85', () => {
    const r = plein();
    const e = computeEcoByFill([r]).get(r);
    expect(e.ref).toBe('SP98');
    expect(e.eco).toBeCloseTo(40 / 1.25 * 1.9 - 40 * 0.8, 6);   // 28,80 €
  });

  it('rend une économie négative quand l\'E85 est trop cher', () => {
    const r = plein({ 'Prix €/L': 1.6, 'SP98 station (€/L)': 1.7 });
    expect(computeEcoByFill([r]).get(r).eco).toBeCloseTo(-9.6, 6);
  });

  it('utilise le prix SP98 moyen du véhicule quand la station n\'en a pas', () => {
    const a = plein({ 'SP98 station (€/L)': 1.8 });
    const b = plein({ 'SP98 station (€/L)': 2.0, 'Km compteur': 1300 });
    const c = plein({ 'SP98 station (€/L)': '', 'Km compteur': 1600 });
    expect(computeEcoByFill([a, b, c]).get(c).eco).toBeCloseTo(40 / 1.25 * 1.9 - 32, 6);
  });

  it('ignore les pleins non E85', () => {
    const sp = plein({ Type: 'Super 98', 'Prix €/L': 1.9 });
    const r = plein({ 'Km compteur': 1300 });
    const m = computeEcoByFill([sp, r]);
    expect(m.has(sp)).toBe(false);
    expect(m.has(r)).toBe(true);
  });

  it('applique l\'écart €/L retranché au SP98', () => {
    localStorage.setItem('suivi_e85_ecart_ref', '0.1');
    const r = plein();
    expect(computeEcoByFill([r]).get(r).eco).toBeCloseTo(40 / 1.25 * 1.8 - 32, 6);
  });

  it('ignore un plein sans aucun prix de référence exploitable', () => {
    const r = plein({ 'SP98 station (€/L)': '' });
    expect(computeEcoByFill([r]).has(r)).toBe(false);
  });

  it('rend une Map vide sans pleins', () => {
    expect(computeEcoByFill([]).size).toBe(0);
    expect(computeEcoByFill(undefined).size).toBe(0);
  });
});
