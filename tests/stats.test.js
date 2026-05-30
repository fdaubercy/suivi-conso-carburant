// @vitest-environment jsdom
/**
 * Tests — js/stats.js (W56)
 * Logique pure : projection de dépassement du budget au rythme du mois courant.
 * historique.js et comparatif.js sont mockés (dépendances lourdes non utilisées ici).
 */
import { describe, it, expect, vi } from 'vitest';

vi.mock('../js/historique.js', () => ({
  getAllRecords: () => [],
  forceRefreshHistorique: () => Promise.resolve(),
}));
vi.mock('../js/comparatif.js', () => ({ renderComparatif: () => {} }));

import { computeBudgetForecast } from '../js/stats.js';

describe('computeBudgetForecast (W56)', () => {
  it('prévoit la date de dépassement au rythme du mois en cours', () => {
    // 100 € dépensés en 10 j (10 €/j), budget 200 €, mois de 30 j
    // → projeté 300 € ; budget franchi à 200/10 = jour 20
    const fc = computeBudgetForecast(100, 10, 30, 200);
    expect(fc).not.toBeNull();
    expect(fc.crossDay).toBe(20);
    expect(fc.projected).toBeCloseTo(300, 5);
  });

  it('ne renvoie rien si le rythme tient le budget', () => {
    // 50 € en 15 j (3,33 €/j) → projeté ~100 € < budget 200 €
    expect(computeBudgetForecast(50, 15, 30, 200)).toBeNull();
  });

  it('ne renvoie rien si le budget est déjà dépassé', () => {
    expect(computeBudgetForecast(250, 20, 30, 200)).toBeNull();
  });

  it('ne renvoie rien avec moins de 2 jours écoulés (rythme non fiable)', () => {
    expect(computeBudgetForecast(80, 1, 30, 200)).toBeNull();
  });

  it('ne renvoie rien si la date de franchissement dépasse le mois', () => {
    // 10 € en 9 j (1,11 €/j), budget 200, mois 30 j → franchi au jour 180 > 30
    expect(computeBudgetForecast(10, 9, 30, 200)).toBeNull();
  });

  it('exige des arguments valides (budget et dépense > 0)', () => {
    expect(computeBudgetForecast(0, 10, 30, 200)).toBeNull();
    expect(computeBudgetForecast(100, 10, 30, 0)).toBeNull();
  });
});
