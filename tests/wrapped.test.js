// @vitest-environment jsdom
/**
 * Tests — js/wrapped.js (W57)
 * Partage image du bilan : Web Share API si l'appareil sait partager des
 * fichiers, sinon repli téléchargement PNG. Le canvas est stubbé (jsdom n'a
 * pas de moteur de rendu 2D) ; on vérifie le branchement, pas le dessin.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

const RECORDS = [
  { Date: '2025-03-10', Type: 'E85', 'Nb. Litres': 40, 'Prix €/L': 0.85, 'Km compteur': 10000, 'Station essence': 'Carrefour Flers', 'SP98 station (€/L)': 1.80, 'Véhicule': 'Moto' },
  { Date: '2025-04-12', Type: 'E85', 'Nb. Litres': 38, 'Prix €/L': 0.84, 'Km compteur': 10500, 'Station essence': 'Carrefour Flers', 'SP98 station (€/L)': 1.82, 'Véhicule': 'Moto' },
];

vi.mock('../js/historique.js', () => ({ getAllRecords: () => RECORDS }));

import { shareWrapped, buildWrapped } from '../js/wrapped.js';

/* Canvas factice : ctx no-op (measureText/createLinearGradient renvoient des
   stubs), toBlob rend un Blob PNG synthétique. */
function stubCanvas() {
  const ctx = new Proxy({}, {
    get: (_t, p) => {
      if (p === 'measureText') return () => ({ width: 10 });
      if (p === 'createLinearGradient') return () => ({ addColorStop() {} });
      return () => {};
    },
    set: () => true,
  });
  return {
    width: 0, height: 0,
    getContext: () => ctx,
    toBlob: (cb) => cb(new Blob(['png'], { type: 'image/png' })),
  };
}

let realCreate, anchor;
beforeEach(() => {
  localStorage.setItem('suivi_e85_wrapped_scope', 'all');   // périmètre tous → pas de filtrage véhicule
  global.URL.createObjectURL = vi.fn(() => 'blob:stub');
  global.URL.revokeObjectURL = vi.fn();

  realCreate = document.createElement.bind(document);
  anchor = null;
  vi.spyOn(document, 'createElement').mockImplementation((tag) => {
    if (tag === 'canvas') return stubCanvas();
    if (tag === 'a') { anchor = realCreate('a'); anchor.click = vi.fn(); return anchor; }
    return realCreate(tag);
  });
});
afterEach(() => {
  vi.restoreAllMocks();
  delete navigator.canShare; delete navigator.share;
});

describe('buildWrapped — sanity (données de test)', () => {
  it('agrège 2 pleins E85 sur 2025', () => {
    const w = buildWrapped(2025, 'all');
    expect(w.nbPleins).toBe(2);
    expect(w.totalLitres).toBe(78);
  });
});

describe('shareWrapped (W57)', () => {
  it('partage un fichier PNG quand navigator.canShare l’accepte (pas de téléchargement)', async () => {
    navigator.canShare = vi.fn(() => true);
    navigator.share    = vi.fn(() => Promise.resolve());
    await shareWrapped();
    expect(navigator.share).toHaveBeenCalledTimes(1);
    const arg = navigator.share.mock.calls[0][0];
    expect(arg.files).toHaveLength(1);
    expect(arg.files[0].name).toBe('bilan-carburant-2025.png');
    expect(anchor).toBeNull();                       // aucun téléchargement déclenché
  });

  it('télécharge un PNG en repli quand le partage de fichiers est indisponible', async () => {
    // navigator.canShare absent → repli téléchargement
    await shareWrapped();
    expect(anchor).not.toBeNull();
    expect(anchor.download).toBe('bilan-carburant-2025.png');
    expect(anchor.click).toHaveBeenCalledTimes(1);
  });

  it('télécharge aussi en repli si navigator.share rejette (hors annulation)', async () => {
    navigator.canShare = vi.fn(() => true);
    navigator.share    = vi.fn(() => Promise.reject(new Error('boom')));
    await shareWrapped();
    expect(anchor).not.toBeNull();
    expect(anchor.click).toHaveBeenCalledTimes(1);
  });

  it('n’agit pas (ni partage ni téléchargement) si l’utilisateur annule (AbortError)', async () => {
    const abort = Object.assign(new Error('abort'), { name: 'AbortError' });
    navigator.canShare = vi.fn(() => true);
    navigator.share    = vi.fn(() => Promise.reject(abort));
    await shareWrapped();
    expect(navigator.share).toHaveBeenCalledTimes(1);
    expect(anchor).toBeNull();                       // pas de repli après annulation
  });
});
