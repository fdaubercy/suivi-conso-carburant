// @vitest-environment jsdom
/**
 * Tests — W94 : projection de la date de rentabilité alignée sur l'Excel (J11/L11/J12),
 * N derniers pleins E85 (`proj_nb_recents`) + rendu dans la jauge de rentabilité.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { computeProjectionRenta, getProjNbRecents } from '../js/projectionRenta.js';
import { buildRentaBar } from '../js/statsCharts.js';
import { PROJ_NB_RECENTS_KEY } from '../js/config.js';

const E85 = 'SuperEthanol E85';
const S98 = 'Super 98';
// 1 plein SP98 (pose du kit) puis 4 pleins E85 tous les 10 jours / 500 km.
// Économie par plein : 10, 10, 20, 20 € (le rythme récent est meilleur).
const recs = [
  { Date: '2026-01-01', Type: S98, 'Km compteur': 1000 },
  { Date: '2026-01-11', Type: E85, 'Km compteur': 1500, eco: 10 },
  { Date: '2026-01-21', Type: E85, 'Km compteur': 2000, eco: 10 },
  { Date: '2026-01-31', Type: E85, 'Km compteur': 2500, eco: 20 },
  { Date: '2026-02-10', Type: E85, 'Km compteur': 3000, eco: 20 },
];
const base = { econBrute: 60, cout: 160, ecoOf: r => r.eco };

beforeEach(() => localStorage.clear());

describe('getProjNbRecents', () => {
  it('vaut 6 par défaut (comme Excel N14)', () => {
    expect(getProjNbRecents()).toBe(6);
  });
  it('lit le réglage synchronisé, 0 accepté, valeur invalide ignorée', () => {
    localStorage.setItem(PROJ_NB_RECENTS_KEY, '2');
    expect(getProjNbRecents()).toBe(2);
    localStorage.setItem(PROJ_NB_RECENTS_KEY, '0');
    expect(getProjNbRecents()).toBe(0);
    localStorage.setItem(PROJ_NB_RECENTS_KEY, 'abc');
    expect(getProjNbRecents()).toBe(6);
  });
});

describe('computeProjectionRenta (formules Excel R4…S12, J11, J12)', () => {
  it('taux moyen depuis le plein précédant le 1er E85, taux récent sur N pleins', () => {
    const p = computeProjectionRenta(recs, { ...base, n: 2 });
    expect(p.tauxMoyen).toBeCloseTo(60 / 2000, 10);          // 60 € / (3000 − 1000) km
    // (N+1)=3ᵉ plus grand km E85 = 2000 ; cumul à ce plein = 20 → (60−20)/(3000−2000)
    expect(p.tauxRecent).toBeCloseTo(0.04, 10);
    expect(p.rythmeKmJ).toBeCloseTo(2000 / 40, 10);          // 50 km/j
    // reste 100 € → A = 100/0,03/50 = 66,67 j ; B = 100/0,04/50 = 50 j → médiane 58,33 j
    expect(p.date.toISOString().slice(0, 10)).toBe('2026-04-09');   // 10/02 + 58 j
    expect(p.margeJours).toBe(8);
    expect(Math.round(p.kmCible)).toBe(3000 + Math.round((3333.33 + 2500) / 2));
  });

  it('N = 0 → taux récent = taux moyen (marge nulle), comme Excel', () => {
    const p = computeProjectionRenta(recs, { ...base, n: 0 });
    expect(p.tauxRecent).toBeCloseTo(p.tauxMoyen, 10);
    expect(p.margeJours).toBe(0);
  });

  it('N supérieur au nombre de pleins E85 → repli sur le 1er plein E85 (MINIFS)', () => {
    const p = computeProjectionRenta(recs, { ...base, n: 10 });
    // ref = km 1500, cumul 10 → (60−10)/(3000−1500)
    expect(p.tauxRecent).toBeCloseTo(50 / 1500, 10);
  });

  it('rentabilité déjà atteinte → atteint = true', () => {
    expect(computeProjectionRenta(recs, { ...base, cout: 50, n: 2 }).atteint).toBe(true);
  });

  it('données insuffisantes → null (aucun plein E85, coût nul, économie nulle)', () => {
    expect(computeProjectionRenta(recs.slice(0, 1), { ...base, n: 2 })).toBeNull();
    expect(computeProjectionRenta(recs, { ...base, cout: 0, n: 2 })).toBeNull();
    expect(computeProjectionRenta(recs, { ...base, econBrute: 0, n: 2 })).toBeNull();
  });

  it('ignore les pleins sans km ni date exploitable', () => {
    const p = computeProjectionRenta(
      [...recs, { Date: '', Type: E85, 'Km compteur': 9999, eco: 5 }, { Date: '2026-03-01', Type: E85, 'Km compteur': 0 }],
      { ...base, n: 2 });
    expect(p.tauxMoyen).toBeCloseTo(0.03, 10);
  });
});

describe('buildRentaBar — affichage de la projection W94', () => {
  const s = { coutTotalConversion: 160, econBrute: 60, econNette: -100, e85SpanMonths: 1 };

  it('affiche la date médiane ± marge, le N utilisé et le km cible', () => {
    const projection = computeProjectionRenta(recs, { ...base, n: 2 });
    const html = buildRentaBar({ ...s, projection });
    expect(html).toContain('rentable vers <strong>9 avril 2026</strong>');
    expect(html).toContain('± 8 j');
    expect(html).toContain('médiane rythme moyen / 2 derniers pleins E85');
  });

  it('sans projection calculable → repli sur le rythme mensuel W89', () => {
    const html = buildRentaBar({ ...s, e85SpanMonths: 4, projection: null });
    expect(html).toContain('au rythme observé (4 mois d\'E85)');
  });
});
