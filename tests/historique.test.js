// @vitest-environment jsdom
/**
 * Tests — js/historique.js (W25)
 * Logique pure : génération du CSV d'export de l'historique.
 */
import { describe, it, expect } from 'vitest';
import { buildHistoriqueCSV, estPleinValide } from '../js/historique.js';

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

describe('buildHistoriqueCSV — séparateur configurable (W54)', () => {
  it('utilise la virgule comme séparateur et le point décimal en mode anglo', () => {
    const csv = buildHistoriqueCSV([plein()], ',');
    const header = csv.split('\r\n')[0];
    expect(header).toBe('Date,Horodatage,Véhicule,Type,Km compteur,Litres,Prix €/L,Total €,Station');
    const row = csv.split('\r\n')[1];
    expect(row).toContain('0.789');     // point décimal (pas de virgule en mode ,)
    expect(row).toContain('31.56');     // total avec point
    expect(row).not.toContain('0,789');
  });

  it('garde le point-virgule + virgule décimale par défaut (Excel FR)', () => {
    const csv = buildHistoriqueCSV([plein()], ';');
    expect(csv.split('\r\n')[1]).toContain('0,789');
  });

  it('échappe une valeur contenant la virgule quand le séparateur est la virgule', () => {
    const csv = buildHistoriqueCSV([plein({ 'Station essence': 'Leclerc, Bron' })], ',');
    expect(csv).toContain('"Leclerc, Bron"');
  });
});

describe('estPleinValide — anti-fantôme « plein au 01/01/1970 »', () => {
  it('accepte un plein normal', () => {
    expect(estPleinValide(plein())).toBe(true);
  });

  it('accepte un plein daté par le seul Horodatage (Date absente)', () => {
    expect(estPleinValide(plein({ Date: '' }))).toBe(true);
  });

  it('rejette une date epoch Unix (01/01/1970)', () => {
    expect(estPleinValide(plein({ Date: '1970-01-01', Horodatage: '1970-01-01 00:00:00' }))).toBe(false);
  });

  it('rejette une ligne d’en-tête fantôme (sync_id = "sync_id")', () => {
    expect(estPleinValide(plein({ sync_id: 'sync_id' }))).toBe(false);
  });

  it('rejette une ligne d’en-tête fantôme (Type = "Type")', () => {
    expect(estPleinValide(plein({ Type: 'Type', Date: 'Date', Horodatage: '' }))).toBe(false);
  });

  it('rejette un enregistrement sans aucune date', () => {
    expect(estPleinValide(plein({ Date: '', Horodatage: '' }))).toBe(false);
  });

  it('rejette null / undefined', () => {
    expect(estPleinValide(null)).toBe(false);
    expect(estPleinValide(undefined)).toBe(false);
  });
});
