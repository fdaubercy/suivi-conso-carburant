// @vitest-environment jsdom
/**
 * Tests — js/historique.js (W25)
 * Logique pure : génération du CSV d'export de l'historique.
 */
import { describe, it, expect } from 'vitest';
import { buildHistoriqueCSV } from '../js/historique.js';

const plein = (o = {}) => ({
  Date: '2026-05-30 08:15:00',
  Horodatage: '2026-05-30 08:15:00',
  'Véhicule': 'Clio',
  Type: 'SuperEthanol E85',
  'Km compteur': 123456,
  'Nb. Litres': 40,
  'Prix €/L': 0.789,
  'Station essence': 'Total Lyon',
  ...o,
});

describe('buildHistoriqueCSV', () => {
  it('génère un en-tête avec séparateur point-virgule', () => {
    const csv = buildHistoriqueCSV([]);
    const header = csv.split('\r\n')[0];
    expect(header).toBe('Date;Horodatage;Véhicule;Type;Km compteur;Litres;Prix €/L;Total €;Station');
  });

  it('exporte une ligne avec virgule décimale et total calculé', () => {
    const csv = buildHistoriqueCSV([plein()]);
    const row = csv.split('\r\n')[1];
    expect(row).toContain('Clio');
    expect(row).toContain('SuperEthanol E85');
    expect(row).toContain('0,789');          // virgule décimale (Excel FR)
    expect(row).toContain('31,56');           // 40 × 0,789
    expect(row).toContain('Total Lyon');
  });

  it('échappe les valeurs contenant le séparateur', () => {
    const csv = buildHistoriqueCSV([plein({ 'Station essence': 'Leclerc; Bron' })]);
    expect(csv).toContain('"Leclerc; Bron"');
  });

  it('produit une ligne par enregistrement (+ en-tête)', () => {
    const csv = buildHistoriqueCSV([plein(), plein(), plein()]);
    expect(csv.split('\r\n')).toHaveLength(4);
  });
});
