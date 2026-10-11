/**
 * Tests — js/scanControle.js (W97) : fusion et contrôle des lectures du scanner.
 * Spéc : docs/superpowers/specs/2026-10-11-scan-pompe-compteur-design.md §4 (R1 à R5).
 */
import { describe, it, expect } from 'vitest';
import { analyserScan, formaterBilan, cleTypeLu } from '../js/scanControle.js';

const AUJ = new Date('2026-10-11T12:00:00');
const plein = (date, type, prix, km = 1000) => ({
  Date: date + ' 00:00:00', Type: type, 'Prix €/L': prix, 'Km compteur': km, 'Nb. Litres': 15,
});
const pompe = (valeurs, index = 0) => ({ index, kind: 'pompe', lisible: true, valeurs });
const compteur = (km, index = 1) => ({ index, kind: 'compteur', lisible: true, valeurs: { km } });
const ticket = (valeurs, index = 2) => ({ index, kind: 'ticket', lisible: true, valeurs });
const ctx = (o = {}) => ({
  stationPrices: {}, historiqueVehicule: [], dernierKm: null, consoParType: {},
  typeCourant: 'E85', aujourdHui: AUJ, ...o,
});
const HIST_E85 = [plein('2026-09-22', 'SuperEthanol E85', 0.869, 19473)];

describe('analyserScan — jeu réel (Z900, 16,14 L × 0,869 €)', () => {
  it('remplit tout, déduit E85 et ne signale que le type déduit', () => {
    const r = analyserScan(
      { photos: [pompe({ litres: 16.14, prix_litre: 0.869, montant_total: 14.03 }), compteur(19719)] },
      ctx({ stationPrices: { E85: 0.869, SP98: 1.95 }, historiqueVehicule: HIST_E85,
            dernierKm: 19473, consoParType: { E85: 6.6 } }));
    expect(r.valeurs).toEqual({ litres: 16.14, prix_litre: 0.869, montant_total: 14.03, km: 19719, type_carburant: 'E85' });
    expect(r.sources).toEqual({ litres: 'pompe', prix_litre: 'pompe', montant_total: 'pompe', km: 'compteur', type_carburant: 'deduit' });
    expect(r.alertes).toEqual({ type_carburant: 'type déduit du prix (0,869 €/L → E85)' });
    expect(r.resume).toEqual([
      { index: 0, kind: 'pompe', lisible: true, remarque: null },
      { index: 1, kind: 'compteur', lisible: true, remarque: null },
    ]);
  });
});

describe('R1 — priorité des sources', () => {
  it('pompe et ticket en désaccord (> 2 %) : pompe gardée + alerte', () => {
    const r = analyserScan({ photos: [pompe({ litres: 16.14 }), ticket({ litres: 16.6, date: '2026-10-10' })] }, ctx());
    expect(r.valeurs.litres).toBe(16.14);
    expect(r.alertes.litres).toBe('pompe et ticket diffèrent (16,14 / 16,60)');
    expect(r.valeurs.date).toBe('2026-10-10');
    expect(r.sources.date).toBe('ticket');
  });
  it('écart ≤ 2 % : pas d\'alerte', () => {
    const r = analyserScan({ photos: [pompe({ litres: 16.14 }), ticket({ litres: 16.2 })] }, ctx());
    expect(r.alertes.litres).toBeUndefined();
  });
  it('ticket seul : ses valeurs sont reprises', () => {
    const r = analyserScan({ photos: [ticket({ litres: 20, prix_litre: 1.9, montant_total: 38 }, 0)] }, ctx());
    expect(r.sources.litres).toBe('ticket');
    expect(r.valeurs.montant_total).toBe(38);
  });
  it('compteur prioritaire sur le km du ticket', () => {
    const r = analyserScan({ photos: [compteur(19719, 0), ticket({ km: 19000 }, 1)] }, ctx());
    expect(r.valeurs.km).toBe(19719);
    expect(r.sources.km).toBe('compteur');
  });
  it('photos absentes ou vides : repli sur fusion', () => {
    const r = analyserScan({ photos: [], fusion: { litres: 16.14, prix_litre: 0.869, km: 19719, date: null } }, ctx());
    expect(r.valeurs).toMatchObject({ litres: 16.14, prix_litre: 0.869, km: 19719 });
    expect(r.valeurs.date).toBeUndefined();
    expect(r.resume).toEqual([]);
  });
});

describe('R2 — litres × prix = montant', () => {
  it('3 valeurs incohérentes : pas de correction, alerte sur litres et montant', () => {
    const r = analyserScan({ photos: [pompe({ litres: 16.14, prix_litre: 0.869, montant_total: 15.03 })] }, ctx());
    expect(r.valeurs.montant_total).toBe(15.03);
    expect(r.alertes.litres).toBe('16,14 × 0,869 = 14,03 € ≠ 15,03 € lus');
    expect(r.alertes.montant_total).toBe('16,14 × 0,869 = 14,03 € ≠ 15,03 € lus');
  });
  it('litres + prix → montant calculé', () => {
    const r = analyserScan({ photos: [pompe({ litres: 16.14, prix_litre: 0.869 })] }, ctx());
    expect(r.valeurs.montant_total).toBe(14.03);
    expect(r.sources.montant_total).toBe('calcul');
  });
  it('litres + montant → prix calculé', () => {
    const r = analyserScan({ photos: [pompe({ litres: 15, montant_total: 30 })] }, ctx());
    expect(r.valeurs.prix_litre).toBe(2);
    expect(r.sources.prix_litre).toBe('calcul');
  });
  it('prix + montant → litres calculés', () => {
    const r = analyserScan({ photos: [pompe({ prix_litre: 2, montant_total: 30 })] }, ctx());
    expect(r.valeurs.litres).toBe(15);
    expect(r.sources.litres).toBe('calcul');
  });
  it('une seule valeur lue : rien n\'est calculé, aucune alerte', () => {
    const r = analyserScan({ photos: [pompe({ litres: 16.14 })] }, ctx());
    expect(r.valeurs).toEqual({ litres: 16.14 });
    expect(r.alertes).toEqual({});
  });
});

describe('R3 — type de carburant', () => {
  it('ambigu (deux prix station proches) : type courant gardé + « type à vérifier »', () => {
    const r = analyserScan({ photos: [pompe({ prix_litre: 1.78 })] },
      ctx({ stationPrices: { SP95: 1.80, E10: 1.76 } }));
    expect(r.valeurs.type_carburant).toBeUndefined();
    expect(r.alertes.type_carburant).toBe('type à vérifier');
  });
  it('type lu compatible : conservé, sans alerte', () => {
    const r = analyserScan({ photos: [pompe({ prix_litre: 1.95, type_carburant: 'SP98' })] },
      ctx({ stationPrices: { SP98: 1.949 } }));
    expect(r.valeurs.type_carburant).toBe('SP98');
    expect(r.sources.type_carburant).toBe('pompe');
    expect(r.alertes.type_carburant).toBeUndefined();
  });
  it('type lu incompatible : alerte, et type déduit du prix retenu', () => {
    const r = analyserScan({ photos: [pompe({ prix_litre: 0.869, type_carburant: 'SP98' })] },
      ctx({ stationPrices: { E85: 0.869, SP98: 1.95 } }));
    expect(r.alertes.type_carburant).toBe('type lu (SP98) incompatible avec 0,869 €/L');
    expect(r.valeurs.type_carburant).toBe('E85');
    expect(r.sources.type_carburant).toBe('deduit');
  });
  it('sans prix station : médiane des prix du véhicule sur 90 jours', () => {
    const hist = [
      plein('2026-09-01', 'SuperEthanol E85', 0.85), plein('2026-09-20', 'SuperEthanol E85', 0.87),
      plein('2026-10-01', 'SuperEthanol E85', 0.89), plein('2026-01-05', 'Super 98', 2.0),
    ];
    const r = analyserScan({ photos: [pompe({ prix_litre: 0.87 })] }, ctx({ historiqueVehicule: hist }));
    expect(r.valeurs.type_carburant).toBe('E85');
  });
  it('restreint aux carburants déjà utilisés par le véhicule', () => {
    const r = analyserScan({ photos: [pompe({ prix_litre: 1.80 })] },
      ctx({ stationPrices: { SP95: 1.80, E10: 1.79 }, historiqueVehicule: [plein('2026-10-01', 'Sans Plomb 95', 1.81)] }));
    expect(r.valeurs.type_carburant).toBe('SP95');
  });
  it('aucun prix lu ni type lu : aucune alerte de type', () => {
    const r = analyserScan({ photos: [compteur(19719, 0)] }, ctx());
    expect(r.alertes.type_carburant).toBeUndefined();
  });
});

describe('R4 — kilométrage', () => {
  it('km ≤ dernier plein', () => {
    const r = analyserScan({ photos: [compteur(19400, 0)] }, ctx({ dernierKm: 19473 }));
    expect(r.alertes.km).toBe('inférieur ou égal au dernier plein (19 473 km)');
  });
  it('compteur partiel (TRIP) lu', () => {
    const r = analyserScan({ photos: [compteur(245, 0)] }, ctx({ dernierKm: 19473 }));
    expect(r.alertes.km).toBe('compteur partiel (TRIP) lu ?');
  });
  it('distance improbable pour les litres servis', () => {
    const r = analyserScan({ photos: [pompe({ litres: 16.14, prix_litre: 0.869 }), compteur(20085)] },
      ctx({ dernierKm: 19473, consoParType: { E85: 6.6 }, stationPrices: { E85: 0.869 } }));
    expect(r.alertes.km).toBe('612 km pour 16,1 L : improbable (≈ 240 km attendus)');
  });
  it('sans conso moyenne : pas de contrôle de distance', () => {
    const r = analyserScan({ photos: [pompe({ litres: 16.14 }), compteur(20085)] }, ctx({ dernierKm: 19473 }));
    expect(r.alertes.km).toBeUndefined();
  });
});

describe('R5 — prix plausible', () => {
  it('écart ≤ 10 % avec le prix station : pas d\'alerte prix', () => {
    const r = analyserScan({ photos: [pompe({ prix_litre: 0.95 })] }, ctx({ stationPrices: { E85: 0.869 } }));
    expect(r.alertes.prix_litre).toBeUndefined();
  });
  it('écart > 10 % : alerte (type courant utilisé faute de déduction)', () => {
    const r = analyserScan({ photos: [pompe({ prix_litre: 0.99 })] }, ctx({ stationPrices: { E85: 0.869 } }));
    expect(r.alertes.prix_litre).toBe('différent du prix affiché par la station (0,869 €)');
    expect(r.alertes.type_carburant).toBe('type à vérifier');
  });
});

describe('formaterBilan', () => {
  const res = [{ kind: 'pompe', lisible: true }, { kind: 'compteur', lisible: true }, { kind: 'inconnu', lisible: false }];
  it('pluriel, photos reconnues et champs à vérifier', () => {
    expect(formaterBilan(res, 6, 1)).toBe('3 photos analysées : pompe ✓, compteur ✓, photo ? ✗ — 6 champs pré-remplis, 1 à vérifier');
  });
  it('singulier, sans alerte', () => {
    expect(formaterBilan([{ kind: 'ticket', lisible: true }], 1, 0)).toBe('1 photo analysée : ticket ✓ — 1 champ pré-rempli');
  });
});

describe('cleTypeLu', () => {
  it.each([
    ['E85', 'E85'], ['SuperEthanol', 'E85'], ['SP98', 'SP98'], ['SP95', 'SP95'],
    ['SP95-E10', 'E10'], ['Gazole', 'GAZOLE'], ['Diesel B7', 'GAZOLE'], ['GPLc', 'GPLC'],
    [null, null], ['AdBlue', null],
  ])('%s → %s', (lu, cle) => expect(cleTypeLu(lu)).toBe(cle));
});
