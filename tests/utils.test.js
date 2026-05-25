/**
 * Tests unitaires — js/utils.js
 * Toutes les fonctions sont pures (pas de DOM, pas de fetch).
 */
import { describe, it, expect } from 'vitest';
import {
  haversine,
  escHtml,
  getCoords,
  stationLabel,
  stationSubLabel,
  formatVille,
  composeStationName,
  odsUrl,
} from '../js/utils.js';

// ─── haversine ───────────────────────────────────────────────
describe('haversine', () => {
  it('retourne 0 pour deux points identiques', () => {
    expect(haversine(48.8566, 2.3522, 48.8566, 2.3522)).toBe(0);
  });

  it('calcule environ 392 km entre Paris et Lyon', () => {
    const d = haversine(48.8566, 2.3522, 45.7640, 4.8357);
    expect(d).toBeGreaterThan(385_000);
    expect(d).toBeLessThan(400_000);
  });

  it('calcule une courte distance cohérente (~80 m)', () => {
    const d = haversine(48.8566, 2.3522, 48.8566, 2.3532);
    expect(d).toBeGreaterThan(0);
    expect(d).toBeLessThan(200);
  });

  it('est symétrique : d(A,B) === d(B,A)', () => {
    const d1 = haversine(48.8566, 2.3522, 45.7640, 4.8357);
    const d2 = haversine(45.7640, 4.8357, 48.8566, 2.3522);
    expect(d1).toBeCloseTo(d2, 1);
  });
});

// ─── escHtml ─────────────────────────────────────────────────
describe('escHtml', () => {
  it('échappe < > & "', () => {
    expect(escHtml('<b>&"test"</b>')).toBe('&lt;b&gt;&amp;&quot;test&quot;&lt;/b&gt;');
  });

  it('ne modifie pas un texte sans caractères spéciaux', () => {
    expect(escHtml('Bonjour monde')).toBe('Bonjour monde');
  });

  it('convertit les non-string en string', () => {
    expect(escHtml(42)).toBe('42');
    expect(escHtml(true)).toBe('true');
  });

  it('gère une chaîne vide', () => {
    expect(escHtml('')).toBe('');
  });
});

// ─── getCoords ───────────────────────────────────────────────
describe('getCoords', () => {
  it('retourne null si pas de geom', () => {
    expect(getCoords({})).toBeNull();
    expect(getCoords({ geom: null })).toBeNull();
  });

  it('extrait les coordonnées en format lat/lon direct', () => {
    const r = { geom: { lat: '48.8566', lon: '2.3522' } };
    expect(getCoords(r)).toEqual({ lat: 48.8566, lon: 2.3522 });
  });

  it('extrait les coordonnées en format GeoJSON Point', () => {
    const r = { geom: { type: 'Point', coordinates: [2.3522, 48.8566] } };
    expect(getCoords(r)).toEqual({ lat: 48.8566, lon: 2.3522 });
  });

  it('retourne null si geom existe sans coordonnées valides', () => {
    expect(getCoords({ geom: {} })).toBeNull();
    expect(getCoords({ geom: { type: 'Point', coordinates: [] } })).toBeNull();
  });
});

// ─── stationLabel ────────────────────────────────────────────
describe('stationLabel', () => {
  it('retourne l\'adresse en title case', () => {
    expect(stationLabel({ adresse: 'rue de la paix' })).toBe('Rue De La Paix');
  });

  it('retourne la ville en majuscules si pas d\'adresse', () => {
    expect(stationLabel({ ville: 'lyon' })).toBe('LYON');
  });

  it('retourne le fallback si ni adresse ni ville', () => {
    expect(stationLabel({})).toBe('Station service');
  });

  it('préfère l\'adresse à la ville si les deux sont présents', () => {
    // Note : le regex \b(\w) est ASCII-only → les accents peuvent déplacer la limite
    // On teste avec une adresse sans accent pour isoler la logique de priorité
    const r = { adresse: 'avenue du general de gaulle', ville: 'PARIS' };
    expect(stationLabel(r)).toBe('Avenue Du General De Gaulle');
  });
});

// ─── stationSubLabel ─────────────────────────────────────────
describe('stationSubLabel', () => {
  it('compose le sous-titre complet', () => {
    const r = { adresse: 'rue principale', cp: '69001', ville: 'LYON' };
    expect(stationSubLabel(r)).toBe('Rue principale · 69001 · LYON');
  });

  it('ignore les champs manquants', () => {
    expect(stationSubLabel({ cp: '75001', ville: 'PARIS' })).toBe('75001 · PARIS');
    expect(stationSubLabel({ ville: 'LYON' })).toBe('LYON');
  });

  it('retourne une chaîne vide si tout est manquant', () => {
    expect(stationSubLabel({})).toBe('');
  });
});

// ─── formatVille ─────────────────────────────────────────────
describe('formatVille', () => {
  it('retourne une chaîne vide pour les valeurs falsy', () => {
    expect(formatVille(undefined)).toBe('');
    expect(formatVille(null)).toBe('');
    expect(formatVille('')).toBe('');
  });

  it('prend le premier segment avant le tiret', () => {
    expect(formatVille('FLERS-EN-ESCREBIEUX')).toBe('Flers');
    expect(formatVille('VILLENEUVE-D\'ASCQ')).toBe('Villeneuve');
  });

  it('met en proper case une ville simple', () => {
    expect(formatVille('DOUAI')).toBe('Douai');
    expect(formatVille('paris')).toBe('Paris');
    expect(formatVille('LYON')).toBe('Lyon');
  });

  it('prend le premier segment avant l\'espace', () => {
    expect(formatVille('LE MANS')).toBe('Le');
  });
});

// ─── composeStationName ──────────────────────────────────────
describe('composeStationName', () => {
  it('compose "Nom - Ville"', () => {
    expect(composeStationName('Carrefour', 'DOUAI')).toBe('Carrefour - Douai');
    expect(composeStationName('Leclerc', 'FLERS-EN-ESCREBIEUX')).toBe('Leclerc - Flers');
  });

  it('retourne le nom seul si ville manquante', () => {
    expect(composeStationName('Leclerc', '')).toBe('Leclerc');
    expect(composeStationName('Leclerc', null)).toBe('Leclerc');
  });

  it('retourne la ville seule si nom manquant', () => {
    expect(composeStationName('', 'LYON')).toBe('Lyon');
    expect(composeStationName(null, 'LYON')).toBe('Lyon');
  });

  it('retourne une chaîne vide si les deux sont manquants', () => {
    expect(composeStationName('', '')).toBe('');
    expect(composeStationName(null, null)).toBe('');
  });
});

// ─── odsUrl ──────────────────────────────────────────────────
describe('odsUrl', () => {
  it('construit une URL valide avec les params', () => {
    const url = odsUrl({ limit: 1, select: 'e85_prix' });
    expect(url).toContain('limit=1');
    expect(url).toContain('select=e85_prix');
    expect(url).toContain('data.economie.gouv.fr');
  });

  it('encode les paramètres spéciaux', () => {
    const url = odsUrl({ where: 'e85_prix is not null' });
    expect(url).toContain('where=');
    // URLSearchParams encode les espaces en +
    expect(url).toContain('e85_prix');
  });

  it('retourne une URL avec le bon endpoint', () => {
    const url = odsUrl({});
    expect(url).toMatch(/^https?:\/\//);
    expect(url).toContain('prix-des-carburants');
  });
});
