// @vitest-environment node
/**
 * Tests — Scan.gs (W97) exécuté dans un bac à sable `vm` avec faux UrlFetchApp :
 * validation des images, normalisation du JSON Gemini, limite de fréquence,
 * aiguillage de doPost (avant toute logique d'enregistrement de plein).
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import vm from 'node:vm';

const GAS_DIR = fileURLToPath(new URL(
  '../Google Drive/Sauvegarde & Geolocalisation - Suivi conso SuperEthanol/Google Apps Script/', import.meta.url));
const src = f => readFileSync(join(GAS_DIR, f), 'utf-8');

function makeGas({ texte = '{"photos":[],"fusion":{}}', erreurGemini = null, cle = 'cle-test', limite = false } = {}) {
  const appels = [];
  const ctx = {
    console,
    Logger: { log: () => {} },
    SpreadsheetApp: { openById: () => ({ getSheetByName: () => null }) },
    PropertiesService: { getScriptProperties: () => ({ getProperty: k => (k === 'GEMINI_API_KEY' ? cle : null) }) },
    CacheService: { getScriptCache: () => ({ get: () => (limite ? '10' : '0'), put: () => {} }) },
    UrlFetchApp: {
      fetch: (url, opts) => {
        appels.push({ url, corps: JSON.parse(opts.payload) });
        const rep = erreurGemini
          ? { error: { message: erreurGemini } }
          : { candidates: [{ content: { parts: [{ text: texte }] } }] };
        return { getContentText: () => JSON.stringify(rep) };
      },
    },
    ContentService: {
      MimeType: { JSON: 'json' },
      createTextOutput: s => ({ setMimeType: () => ({ body: s }), body: s }),
    },
  };
  vm.createContext(ctx);
  vm.runInContext(['Auth.gs', 'Code.gs', 'Scan.gs'].map(src).join('\n;\n'), ctx);
  const json = out => JSON.parse(out.body);
  return { ctx, appels, json };
}

const IMG = { data: 'QUJD', mimeType: 'image/jpeg' };

describe('validerImagesScan_', () => {
  const { ctx } = makeGas();
  it('refuse 0 image ou un champ absent', () => {
    expect(ctx.validerImagesScan_([])).toBe('Aucune photo reçue.');
    expect(ctx.validerImagesScan_(undefined)).toBe('Aucune photo reçue.');
  });
  it('refuse 4 images', () => {
    expect(ctx.validerImagesScan_([IMG, IMG, IMG, IMG])).toBe('3 photos maximum.');
  });
  it('refuse une image vide', () => {
    expect(ctx.validerImagesScan_([IMG, { data: '' }])).toBe('Photo vide (n° 2).');
  });
  it('refuse un total trop lourd', () => {
    expect(ctx.validerImagesScan_([{ data: 'A'.repeat(8600000) }])).toBe('Photos trop lourdes.');
  });
  it('accepte 1 à 3 images', () => {
    expect(ctx.validerImagesScan_([IMG, IMG, IMG])).toBeNull();
  });
});

describe('normaliserScan_', () => {
  const { ctx } = makeGas();
  it('kind hors liste → inconnu ; nombres « à la française » → nombres', () => {
    const r = ctx.normaliserScan_({
      photos: [
        { index: 0, kind: 'Pompe', lisible: true, valeurs: { litres: '16,14', prix_litre: '0.869', montant_total: 14.03 } },
        { index: 1, kind: 'selfie', lisible: false, remarque: 'photo floue' },
        { index: 2, kind: 'compteur', lisible: 'true', valeurs: { km: '19 719' } },
      ],
      fusion: { km: '19719', litres: 'abc', date: '' },
    }, 3);
    expect(r.photos[0]).toMatchObject({ index: 0, kind: 'pompe', lisible: true });
    expect(r.photos[0].valeurs).toMatchObject({ litres: 16.14, prix_litre: 0.869, montant_total: 14.03, km: null, type_carburant: null });
    expect(r.photos[1]).toMatchObject({ kind: 'inconnu', lisible: false, remarque: 'photo floue' });
    expect(r.photos[2].valeurs.km).toBe(19719);
    expect(r.photos[2].lisible).toBe(true);
    expect(r.fusion).toMatchObject({ km: 19719, litres: null, date: null });
  });
  it('index absent → position ; index hors bornes → ignoré ; photos absent → []', () => {
    expect(ctx.normaliserScan_({ photos: [{ kind: 'ticket' }, { index: 5, kind: 'pompe' }] }, 2).photos
      .map(p => [p.index, p.kind])).toEqual([[0, 'ticket']]);
    expect(ctx.normaliserScan_({}, 1).photos).toEqual([]);
  });
});

describe('handleScanPhotos', () => {
  it('un seul appel Gemini avec toutes les images et la configuration JSON', () => {
    const texte = '```json\n{"photos":[{"index":0,"kind":"pompe","lisible":true,"valeurs":{"litres":16.14}},'
      + '{"index":1,"kind":"compteur","lisible":true,"valeurs":{"km":19719}}],"fusion":{"km":19719}}\n```';
    const g = makeGas({ texte });
    const r = g.json(g.ctx.handleScanPhotos({ images: [IMG, IMG], cid: 'c1' }));
    expect(g.appels).toHaveLength(1);
    expect(g.appels[0].url).toContain('models/gemini-2.5-flash:generateContent');
    const cfg = g.appels[0].corps.generationConfig;
    expect(cfg).toMatchObject({ temperature: 0.1, responseMimeType: 'application/json', thinkingConfig: { thinkingBudget: 0 } });
    expect(g.appels[0].corps.contents[0].parts.filter(p => p.inlineData)).toHaveLength(2);
    expect(r.success).toBe(true);
    expect(r.photos.map(p => p.kind)).toEqual(['pompe', 'compteur']);
    expect(r.photos[1].valeurs.km).toBe(19719);
    expect(r.fusion.km).toBe(19719);
  });
  it('limite de fréquence : refus explicite, aucun appel Gemini', () => {
    const g = makeGas({ limite: true });
    const r = g.json(g.ctx.handleScanPhotos({ images: [IMG], cid: 'c1' }));
    expect(r).toMatchObject({ success: false, code: 'RATE_LIMIT', error: 'Trop d\'analyses, réessayez dans une minute.' });
    expect(g.appels).toHaveLength(0);
  });
  it('clé Gemini absente', () => {
    const g = makeGas({ cle: null });
    const r = g.json(g.ctx.handleScanPhotos({ images: [IMG] }));
    expect(r.success).toBe(false);
    expect(r.error).toContain('GEMINI_API_KEY');
    expect(g.appels).toHaveLength(0);
  });
  it('erreur de l\'API Gemini relayée', () => {
    const g = makeGas({ erreurGemini: 'quota dépassé' });
    expect(g.json(g.ctx.handleScanPhotos({ images: [IMG] }))).toMatchObject({ success: false, error: 'quota dépassé' });
  });
  it('réponse IA illisible', () => {
    const g = makeGas({ texte: 'désolé' });
    expect(g.json(g.ctx.handleScanPhotos({ images: [IMG] }))).toMatchObject({ success: false, error: 'Réponse IA illisible.' });
  });
  it('0 image : refus avant tout appel', () => {
    const g = makeGas();
    expect(g.json(g.ctx.handleScanPhotos({ images: [] }))).toMatchObject({ success: false, error: 'Aucune photo reçue.' });
    expect(g.appels).toHaveLength(0);
  });
});

describe('doPost — aiguillage scanPhotos', () => {
  it('scanPhotos est traité par Scan.gs, pas par l\'enregistrement d\'un plein', () => {
    const g = makeGas();
    const out = g.ctx.doPost({ postData: { contents: JSON.stringify({ action: 'scanPhotos', images: [] }) }, parameter: {} });
    expect(g.json(out)).toMatchObject({ success: false, error: 'Aucune photo reçue.' });
  });
});

describe('W98 — nombres avec unité ou séparateur de milliers', () => {
  const { ctx } = makeGas();
  const v = valeurs => ctx.normaliserScan_({ photos: [{ index: 0, kind: 'pompe', valeurs }] }, 1).photos[0].valeurs;
  it('unités retirées : « 16,14 L », « 14,03 € », « 0,869 €/L »', () => {
    expect(v({ litres: '16,14 L', montant_total: '14,03 €', prix_litre: '0,869 €/L' }))
      .toMatchObject({ litres: 16.14, montant_total: 14.03, prix_litre: 0.869 });
  });
  it('km : point ou virgule de milliers (texte ou nombre)', () => {
    expect(v({ km: '19.719' }).km).toBe(19719);
    expect(v({ km: '19,719 km' }).km).toBe(19719);
    expect(v({ km: 19.719 }).km).toBe(19719);
    expect(v({ km: '1.234.567' }).km).toBe(1234567);
  });
  it('montant avec milliers et décimales : « 1.234,56 € » et « 1,234.56 »', () => {
    expect(v({ montant_total: '1.234,56 €' }).montant_total).toBe(1234.56);
    expect(v({ montant_total: '1,234.56' }).montant_total).toBe(1234.56);
  });
  it('les litres gardent leurs décimales (pas de lecture « milliers »)', () => {
    expect(v({ litres: '16.140' }).litres).toBe(16.14);
  });
  it('texte sans chiffre → null', () => {
    expect(v({ litres: 'illisible', km: '—' })).toMatchObject({ litres: null, km: null });
  });
});

describe('W98 — doPost refuse les actions inconnues', () => {
  it("une action inconnue ne déclenche jamais l'enregistrement d'un plein", () => {
    const g = makeGas();
    const out = g.ctx.doPost({ postData: { contents: JSON.stringify({ action: 'scanFutur', litres: 10 }) }, parameter: {} });
    expect(g.json(out)).toMatchObject({ success: false, error: 'Action inconnue : scanFutur' });
  });
});
