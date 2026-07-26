// @vitest-environment jsdom
/**
 * Tests — js/rentabilite.js (X67)
 * Seuil de rentabilité temps réel dynamique selon la surconso.
 */
import { describe, it, expect } from 'vitest';
import { seuilRentable } from '../js/rentabilite.js';

describe('seuilRentable (X67)', () => {
  it('= 1 / (1 + surconso)', () => {
    expect(seuilRentable(0.25)).toBeCloseTo(0.8, 5);   // +25 % → 0,80
    expect(seuilRentable(0)).toBeCloseTo(1, 5);
    expect(seuilRentable(0.4)).toBeCloseTo(0.714, 3);
  });
});
