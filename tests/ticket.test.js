// @vitest-environment jsdom
/**
 * T10 — Tests du parsing OCR des tickets de caisse (js/ticket.js).
 *
 * Couvre `parseOCRText` : extraction de la date (4 formats), du volume,
 * du prix €/L (y compris artefacts OCR), du montant total + fallbacks,
 * du kilométrage, de la station et du mapping carburant
 * (dont la zone de l'ancienne clé dupliquée « sp 95-e10 »).
 *
 * Ce sont des tests de caractérisation : ils verrouillent le comportement
 * actuel des regex pour éviter toute régression silencieuse.
 */
import { describe, it, expect, vi } from 'vitest';

// Tesseract n'est jamais exécuté ici (on teste le parseur pur) ; on évite
// d'embarquer la lib lourde dans le bundle de test.
vi.mock('tesseract.js', () => ({ default: {} }));

const { parseOCRText } = await import('../js/ticket.js');

describe('parseOCRText — date', () => {
  it('DD/MM/YYYY → ISO', () => {
    expect(parseOCRText('15/03/2024').date).toBe('2024-03-15');
  });
  it('DD-MM-YYYY → ISO', () => {
    expect(parseOCRText('15-03-2024').date).toBe('2024-03-15');
  });
  it('YYYY-MM-DD → ISO (priorité 2)', () => {
    expect(parseOCRText('2024-03-15').date).toBe('2024-03-15');
  });
  it('DD/MM/YY → préfixe 20xx (priorité 3)', () => {
    expect(parseOCRText('05/01/24').date).toBe('2024-01-05');
  });
  it('date textuelle « 15 janvier 2024 » (priorité 4)', () => {
    expect(parseOCRText('15 janvier 2024').date).toBe('2024-01-15');
  });
  it('texte sans date → null', () => {
    expect(parseOCRText('Aucune date ici').date).toBeNull();
  });
});

describe('parseOCRText — volume (litres)', () => {
  it('« 42,580 L » → 42.58', () => {
    expect(parseOCRText('Volume 42,580 L').litres).toBeCloseTo(42.58, 3);
  });
  it('libellé « Volume 30,00 » → 30', () => {
    expect(parseOCRText('Volume 30,00').litres).toBeCloseTo(30, 3);
  });
  it('volume hors bornes (< 0,5 L) → null', () => {
    expect(parseOCRText('0,20 L').litres).toBeNull();
  });
});

describe('parseOCRText — prix unitaire €/L', () => {
  it('« 1,799 €/L » → 1.799', () => {
    expect(parseOCRText('1,799 €/L').prix_litre).toBeCloseTo(1.799, 3);
  });
  it('artefact OCR « 1,799 e/l » (€ lu « e », / conservé) → 1.799', () => {
    expect(parseOCRText('1,799 e/l').prix_litre).toBeCloseTo(1.799, 3);
  });
  it('libellé « Prix unitaire 0,849 » → 0.849', () => {
    expect(parseOCRText('Prix unitaire 0,849').prix_litre).toBeCloseTo(0.849, 3);
  });
});

describe('parseOCRText — montant total & fallbacks', () => {
  it('« TOTAL TTC 76,61 € » → 76.61', () => {
    expect(parseOCRText('TOTAL TTC 76,61 €').montant_total).toBeCloseTo(76.61, 2);
  });
  it('montant calculé litres × prix quand aucun total libellé', () => {
    const r = parseOCRText('SuperEthanol E85\n30,00 L\n1,500 €/L');
    expect(r.montant_total).toBeCloseTo(45, 2);
  });
  it('prix calculé total ÷ litres quand aucun prix/L lisible', () => {
    const r = parseOCRText('Gazole B7\n22,15 L\nNet à payer 38,30 €');
    expect(r.litres).toBeCloseTo(22.15, 2);
    expect(r.montant_total).toBeCloseTo(38.30, 2);
    expect(r.prix_litre).toBeCloseTo(1.729, 3);
  });
});

describe('parseOCRText — kilométrage', () => {
  it('chiffres contigus « 87450 km » → 87450', () => {
    expect(parseOCRText('Compteur 87450 km').km).toBe(87450);
  });
  it('séparateur milliers espace « 87 450 km » → 87450', () => {
    expect(parseOCRText('87 450 km').km).toBe(87450);
  });
});

describe('parseOCRText — mapping carburant (FUEL_LABEL_MAP)', () => {
  it('« SuperEthanol E85 » → E85', () => {
    expect(parseOCRText('SuperEthanol E85').type_carburant).toBe('E85');
  });
  it('« Gazole B7 » → GAZOLE', () => {
    expect(parseOCRText('Gazole B7').type_carburant).toBe('GAZOLE');
  });
  it('« SP98 » → SP98', () => {
    expect(parseOCRText('SP98').type_carburant).toBe('SP98');
  });
  // Zone de l'ancienne clé dupliquée : doit toujours mapper vers E10.
  it('« SP 95-E10 » → E10 (clé dé-dupliquée)', () => {
    expect(parseOCRText('SP 95-E10').type_carburant).toBe('E10');
  });
});

describe('parseOCRText — station', () => {
  it('reconnaît une enseigne et ne capture pas une ligne de prix', () => {
    const r = parseOCRText('TOTALENERGIES ACCESS\nSuperEthanol E85\n42,58 L\n1,799 €/L\nTOTAL TTC 76,61 €');
    expect(r.station).toMatch(/TOTALENERGIES/i);
    expect(r.type_carburant).toBe('E85');
    expect(r.litres).toBeCloseTo(42.58, 2);
    expect(r.prix_litre).toBeCloseTo(1.799, 3);
    expect(r.montant_total).toBeCloseTo(76.61, 2);
  });
});
