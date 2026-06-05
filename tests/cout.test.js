import { calcTriplet } from '../js/ui.js';

describe('calcTriplet — calcul tri-directionnel du coût du plein', () => {

  // ── Source : litres ────────────────────────────────────────────────────────
  describe("source='litres'", () => {
    it('calcule C = L × P quand Litres + Prix connus', () => {
      const r = calcTriplet(20, NaN, 0.85, 'litres');
      expect(r.C).toBeCloseTo(17.00, 2);
      expect(r.L).toBe(20);
      expect(r.P).toBe(0.85);
    });
    it('déduit P = C ÷ L quand Litres + Coût connus sans Prix', () => {
      const r = calcTriplet(20, 17, NaN, 'litres');
      expect(r.P).toBeCloseTo(0.85, 3);
    });
    it('ne change rien si Litres seul (autres vides)', () => {
      const r = calcTriplet(20, NaN, NaN, 'litres');
      expect(r.C).toBeNaN();
      expect(r.P).toBeNaN();
    });
  });

  // ── Source : cout ──────────────────────────────────────────────────────────
  describe("source='cout'", () => {
    it('calcule L = C ÷ P quand Coût + Prix connus', () => {
      const r = calcTriplet(NaN, 17, 0.85, 'cout');
      expect(r.L).toBeCloseTo(20.00, 2);
      expect(r.C).toBe(17);
      expect(r.P).toBe(0.85);
    });
    it('déduit P = C ÷ L quand Litres + Coût connus sans Prix', () => {
      const r = calcTriplet(20, 17, NaN, 'cout');
      expect(r.P).toBeCloseTo(0.85, 3);
    });
    it('ne change rien si Coût seul', () => {
      const r = calcTriplet(NaN, 17, NaN, 'cout');
      expect(r.L).toBeNaN();
      expect(r.P).toBeNaN();
    });
  });

  // ── Source : prix ──────────────────────────────────────────────────────────
  describe("source='prix'", () => {
    it('calcule C = L × P quand Litres connus', () => {
      const r = calcTriplet(20, NaN, 0.85, 'prix');
      expect(r.C).toBeCloseTo(17.00, 2);
    });
    it('calcule L = C ÷ P quand Coût connu sans Litres', () => {
      const r = calcTriplet(NaN, 17, 0.85, 'prix');
      expect(r.L).toBeCloseTo(20.00, 2);
    });
    it('Litres a la priorité sur Coût quand les deux sont présents', () => {
      // Litres présent → toujours C = L × P (source='prix')
      const r = calcTriplet(20, 99, 0.85, 'prix');
      expect(r.C).toBeCloseTo(17.00, 2);
    });
  });

  // ── Cas limites ────────────────────────────────────────────────────────────
  describe('cas limites', () => {
    it('ignore les valeurs zéro', () => {
      const r = calcTriplet(0, 0, 0, 'litres');
      expect(r.C).toBe(0);
    });
    it('ignore les valeurs négatives', () => {
      const r = calcTriplet(-5, NaN, 0.85, 'litres');
      expect(r.C).toBeNaN();
    });
    it('préserve la précision (3 décimales pour Prix)', () => {
      const r = calcTriplet(33.33, 28.57, NaN, 'litres');
      const p = r.P;
      // P = 28.57 / 33.33 ≈ 0.857
      expect(String(p).split('.')[1]?.length ?? 0).toBeLessThanOrEqual(3);
    });
    it('préserve la précision (2 décimales pour Coût et Litres)', () => {
      const r = calcTriplet(NaN, 28.57, 0.853, 'cout');
      const l = r.L;
      expect(String(l).split('.')[1]?.length ?? 0).toBeLessThanOrEqual(2);
    });
  });
});
