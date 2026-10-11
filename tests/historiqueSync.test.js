// @vitest-environment jsdom
/**
 * Tests — js/historique.js : réconciliation du cache lors de la sync différentielle.
 * Bug du 11/10/2026 : des pleins ajoutés au Sheet par Excel (bulkAdd) gardent leur
 * Horodatage d'origine → jamais renvoyés par `?since=` → absents de l'app.
 * Le serveur renvoie désormais `ids` (sync_id actifs du compte) : tout écart avec
 * le cache déclenche un rechargement complet.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { HIST_CACHE_KEY, HIST_SINCE_KEY } from '../js/config.js';
import { cacheDesynchronise, chargerHistorique, getAllRecords } from '../js/historique.js';

const rec = (sync_id, date) => ({
  sync_id, Date: date + ' 00:00:00', Horodatage: date + ' 12:00:00',
  Type: 'SuperEthanol E85', 'Km compteur': 1000, 'Nb. Litres': 15, 'Prix €/L': 0.85,
  'Station essence': 'E.Leclerc - Beuvry', 'Véhicule': 'Z900',
});

describe('cacheDesynchronise', () => {
  it('ignore un serveur qui ne renvoie pas `ids` (ancienne version)', () => {
    expect(cacheDesynchronise([rec('a', '2026-09-01')], undefined)).toBe(false);
  });
  it('cache conforme → pas de rechargement', () => {
    expect(cacheDesynchronise([rec('a', '2026-09-01'), rec('b', '2026-09-02')], ['a', 'b'])).toBe(false);
  });
  it('sync_id actif absent du cache → rechargement', () => {
    expect(cacheDesynchronise([rec('a', '2026-09-01')], ['a', 'b'])).toBe(true);
  });
  it('sync_id du cache absent du serveur → rechargement', () => {
    expect(cacheDesynchronise([rec('a', '2026-09-01'), rec('x', '2026-09-03')], ['a'])).toBe(true);
  });
  it('un plein local sans sync_id ne compte pas', () => {
    expect(cacheDesynchronise([rec('a', '2026-09-01'), rec('', '2026-09-03')], ['a'])).toBe(false);
  });
});

describe('chargerHistorique — sync différentielle', () => {
  beforeEach(() => {
    document.body.innerHTML = '<div id="historiqueList"></div>';
    localStorage.clear();
  });

  it('récupère un plein actif que le différentiel ne renvoie pas', async () => {
    localStorage.setItem(HIST_CACHE_KEY, JSON.stringify([rec('a', '2026-09-18')]));
    localStorage.setItem(HIST_SINCE_KEY, '2026-10-03T08:00:00.000Z');
    const full = [rec('a', '2026-09-18'), rec('b', '2026-09-22')];
    const fetchMock = vi.fn(async (url) => ({
      ok: true,
      json: async () => (String(url).includes('since=')
        ? { since: 'x', deleted: [], ids: ['a', 'b'], records: [] }
        : { since: null, deleted: [], records: full }),
    }));
    vi.stubGlobal('fetch', fetchMock);

    await chargerHistorique();

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(String(fetchMock.mock.calls[1][0])).not.toContain('since=');
    expect(getAllRecords().map(r => r.sync_id).sort()).toEqual(['a', 'b']);
    expect(JSON.parse(localStorage.getItem(HIST_CACHE_KEY)).length).toBe(2);
  });

  it('cache conforme → un seul appel réseau', async () => {
    localStorage.setItem(HIST_CACHE_KEY, JSON.stringify([rec('a', '2026-09-18')]));
    localStorage.setItem(HIST_SINCE_KEY, '2026-10-03T08:00:00.000Z');
    const fetchMock = vi.fn(async () => ({
      ok: true,
      json: async () => ({ since: 'x', deleted: [], ids: ['a'], records: [] }),
    }));
    vi.stubGlobal('fetch', fetchMock);

    await chargerHistorique();

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(getAllRecords().map(r => r.sync_id)).toEqual(['a']);
  });
});
