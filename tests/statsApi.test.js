/**
 * Tests — js/statsApi.js (W59 / S12)
 * Logique pure du client d'agrégats serveur : construction d'URL, fraîcheur
 * du cache, lecture/écriture de l'entrée de cache. Pas d'I/O réseau.
 */
import { describe, it, expect } from 'vitest';
import {
  statsKey, buildStatsUrl, isFresh, readStatsCache, writeStatsCache, STATS_TTL_MS,
} from '../js/statsApi.js';

describe('statsKey', () => {
  it('combine véhicule et année', () => {
    expect(statsKey('Moto', 2026)).toBe('Moto|2026');
  });
  it('valeurs par défaut → "|0"', () => {
    expect(statsKey()).toBe('|0');
  });
});

describe('buildStatsUrl', () => {
  it('inclut action, veh, year et token encodés', () => {
    const url = buildStatsUrl('https://gas/exec', 'tok en', { veh: 'Ma Moto', year: 2026 });
    expect(url).toBe('https://gas/exec?action=stats&veh=Ma%20Moto&year=2026&token=tok%20en');
  });
  it('omet veh/year quand absents', () => {
    expect(buildStatsUrl('https://gas/exec', 't')).toBe('https://gas/exec?action=stats&token=t');
  });
  it('omet le token si vide', () => {
    expect(buildStatsUrl('https://gas/exec', '')).toBe('https://gas/exec?action=stats');
  });
});

describe('isFresh', () => {
  const now = 1_000_000_000;
  it('vrai dans la TTL', () => {
    expect(isFresh({ ts: now - 1000 }, STATS_TTL_MS, now)).toBe(true);
  });
  it('faux au-delà de la TTL', () => {
    expect(isFresh({ ts: now - STATS_TTL_MS - 1 }, STATS_TTL_MS, now)).toBe(false);
  });
  it('faux si entrée nulle ou sans ts', () => {
    expect(isFresh(null, STATS_TTL_MS, now)).toBe(false);
    expect(isFresh({}, STATS_TTL_MS, now)).toBe(false);
  });
});

describe('readStatsCache', () => {
  it('retourne l\'entrée de la clé demandée', () => {
    const raw = JSON.stringify({ 'A|0': { ts: 1, data: { kpis: { pleins: 3 } } } });
    expect(readStatsCache(raw, 'A|0').data.kpis.pleins).toBe(3);
  });
  it('null si clé absente, brut vide ou JSON invalide', () => {
    expect(readStatsCache('', 'A|0')).toBeNull();
    expect(readStatsCache('{bad json', 'A|0')).toBeNull();
    expect(readStatsCache(JSON.stringify({ 'B|0': {} }), 'A|0')).toBeNull();
  });
});

describe('writeStatsCache', () => {
  it('ajoute une entrée horodatée et préserve les autres clés', () => {
    const raw = JSON.stringify({ 'A|0': { ts: 1, data: { x: 1 } } });
    const out = JSON.parse(writeStatsCache(raw, 'B|2026', { y: 2 }, 555));
    expect(out['A|0'].data.x).toBe(1);
    expect(out['B|2026']).toEqual({ ts: 555, data: { y: 2 } });
  });
  it('part d\'un objet vide si le brut est invalide', () => {
    const out = JSON.parse(writeStatsCache('{bad', 'K|0', { z: 9 }, 1));
    expect(out).toEqual({ 'K|0': { ts: 1, data: { z: 9 } } });
  });
});
