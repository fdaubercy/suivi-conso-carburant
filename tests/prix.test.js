/**
 * Tests unitaires — fetchNearestE85Price (js/prix.js)
 * Les modules DOM-dépendants sont mockés pour isoler la logique réseau.
 */
import { vi, describe, it, expect, beforeEach } from 'vitest';

// ─── Mocks des modules DOM-dépendants ────────────────────────
// vi.mock() est hoissté avant les imports — prix.js voit ces mocks
vi.mock('../js/ui.js', () => ({
  setS98Status:  vi.fn(),
  showCpSearch:  vi.fn(),
  hideCpSearch:  vi.fn(),
  setFieldPrice: vi.fn(),
  updateCout:    vi.fn(),
}));

vi.mock('../js/carburant.js', () => ({
  _buildTypeToggle:    vi.fn(),
  _updateHeaderBadges: vi.fn(),
}));

vi.mock('../js/rentabilite.js', () => ({
  updateRentabilite: vi.fn(),
}));

// ─── Import après mocks ───────────────────────────────────────
import { fetchNearestE85Price } from '../js/prix.js';

// ─── Helpers ─────────────────────────────────────────────────
/** Construit une fausse réponse fetch. */
const makeResp = (data, ok = true) => ({
  ok,
  json: () => Promise.resolve(data),
});

/** Réponse vide (0 résultats). */
const emptyResp = () => makeResp({ results: [] });

/** Réponse avec un prix E85. */
const priceResp = (prix) => makeResp({ results: [{ e85_prix: prix }] });

// ─── Tests ───────────────────────────────────────────────────
describe('fetchNearestE85Price', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    global.fetch = vi.fn();
  });

  it('retourne le prix si trouvé au 1er rayon (1 km)', async () => {
    global.fetch.mockResolvedValue(priceResp(0.798));

    const result = await fetchNearestE85Price(48.8566, 2.3522);

    expect(result).toBe(0.798);
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  it('essaie le rayon suivant si le 1er retourne 0 résultat', async () => {
    global.fetch
      .mockResolvedValueOnce(emptyResp())          // 1 km : vide
      .mockResolvedValueOnce(priceResp(0.812));    // 5 km : trouvé

    const result = await fetchNearestE85Price(48.8566, 2.3522);

    expect(result).toBe(0.812);
    expect(global.fetch).toHaveBeenCalledTimes(2);
  });

  it('essaie les 3 rayons (1/5/15 km) avant de rendre null', async () => {
    global.fetch.mockResolvedValue(emptyResp());

    const result = await fetchNearestE85Price(48.8566, 2.3522);

    expect(result).toBeNull();
    expect(global.fetch).toHaveBeenCalledTimes(3);
  });

  it('inclut les bons rayons dans les URLs des 3 appels', async () => {
    global.fetch.mockResolvedValue(emptyResp());

    await fetchNearestE85Price(48.0, 2.0);

    const urls = global.fetch.mock.calls.map(([url]) => url);
    expect(urls[0]).toContain('1000m');
    expect(urls[1]).toContain('5000m');
    expect(urls[2]).toContain('15000m');
  });

  it('inclut lat/lon dans l\'URL de requête', async () => {
    global.fetch.mockResolvedValue(priceResp(0.799));

    await fetchNearestE85Price(43.2965, 5.3698);

    const url = global.fetch.mock.calls[0][0];
    expect(url).toContain('5.3698');
    expect(url).toContain('43.2965');
  });

  it('retourne null immédiatement si fetch échoue (catch → return null)', async () => {
    global.fetch.mockRejectedValue(new Error('Network error'));

    const result = await fetchNearestE85Price(48.8566, 2.3522);

    expect(result).toBeNull();
    // Le catch retourne null immédiatement sans essayer les autres rayons
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  it('retourne null immédiatement si HTTP !ok (throw dans catch)', async () => {
    global.fetch.mockResolvedValue({ ok: false, json: () => Promise.resolve({}) });

    const result = await fetchNearestE85Price(48.8566, 2.3522);

    expect(result).toBeNull();
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  it('ignore un résultat où e85_prix est null et continue', async () => {
    global.fetch
      .mockResolvedValueOnce(makeResp({ results: [{ e85_prix: null }] }))   // 1 km : null
      .mockResolvedValueOnce(makeResp({ results: [{ e85_prix: null }] }))   // 5 km : null
      .mockResolvedValueOnce(priceResp(0.805));                             // 15 km : trouvé

    const result = await fetchNearestE85Price(48.8566, 2.3522);

    expect(result).toBe(0.805);
    expect(global.fetch).toHaveBeenCalledTimes(3);
  });
});
