// @vitest-environment jsdom
/**
 * Tests — js/offline.js (W72)
 * File d'attente hors-ligne (localStorage), synchronisation et badge header.
 * ui.showFeedback et auth.* sont mockés.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

const A = vi.hoisted(() => ({ enabled: false, authed: true }));
vi.mock('../js/ui.js', () => ({ showFeedback: vi.fn() }));
vi.mock('../js/auth.js', () => ({
  authEnabled: () => A.enabled,
  isAuthed:    () => A.authed,
  getIdToken:  () => 'tok',
}));

import {
  getQueue, getPendingCount, queuePlein, syncQueue, updateOfflineBadge, updateOfflineRow,
} from '../js/offline.js';
import { showFeedback } from '../js/ui.js';

const QUEUE_KEY = 'suivi_e85_offline_queue';

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
  A.enabled = false; A.authed = true;
  document.body.innerHTML = '<span id="offlineBadge" hidden></span><div id="offlineRow"></div>';
});
afterEach(() => { delete global.fetch; });

describe('file d’attente (localStorage)', () => {
  it('getQueue retourne [] quand vide et tolère un JSON corrompu', () => {
    expect(getQueue()).toEqual([]);
    localStorage.setItem(QUEUE_KEY, '{pas du json');
    expect(getQueue()).toEqual([]);
  });

  it('queuePlein empile une entrée { id, ts, payload }', () => {
    queuePlein({ litres: '30' });
    const q = getQueue();
    expect(q).toHaveLength(1);
    expect(getPendingCount()).toBe(1);
    expect(q[0].payload).toEqual({ litres: '30' });
    expect(q[0].id).toBeTypeOf('number');
    expect(typeof q[0].ts).toBe('string');
  });
});

describe('updateOfflineBadge', () => {
  it('affiche « 📵 N hors-ligne » quand la file n’est pas vide', () => {
    queuePlein({ a: 1 }); queuePlein({ a: 2 });
    updateOfflineBadge();
    const b = document.getElementById('offlineBadge');
    expect(b.hidden).toBe(false);
    expect(b.textContent).toBe('📵 2 hors-ligne');
  });
  it('masque le badge quand la file est vide', () => {
    updateOfflineBadge();
    expect(document.getElementById('offlineBadge').hidden).toBe(true);
  });
});

describe('updateOfflineRow', () => {
  it('masque l’encart quand on est en ligne, l’affiche sinon', () => {
    Object.defineProperty(navigator, 'onLine', { value: true, configurable: true });
    updateOfflineRow();
    expect(document.getElementById('offlineRow').hidden).toBe(true);
    Object.defineProperty(navigator, 'onLine', { value: false, configurable: true });
    updateOfflineRow();
    expect(document.getElementById('offlineRow').hidden).toBe(false);
    Object.defineProperty(navigator, 'onLine', { value: true, configurable: true });
  });
});

describe('syncQueue', () => {
  it('ne fait rien si la file est vide', async () => {
    global.fetch = vi.fn();
    await syncQueue();
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('diffère le flush si l’auth est active mais l’utilisateur déconnecté', async () => {
    A.enabled = true; A.authed = false;
    queuePlein({ a: 1 });
    global.fetch = vi.fn();
    await syncQueue();
    expect(global.fetch).not.toHaveBeenCalled();
    expect(getPendingCount()).toBe(1);   // file intacte
  });

  it('envoie et purge les entrées synchronisées avec succès', async () => {
    queuePlein({ a: 1 });
    global.fetch = vi.fn(() => Promise.resolve({ json: () => Promise.resolve({ success: true }) }));
    await syncQueue();
    expect(global.fetch).toHaveBeenCalledTimes(1);
    expect(getPendingCount()).toBe(0);
    expect(showFeedback).toHaveBeenCalledWith('success', expect.stringContaining('synchronisé'), expect.any(String));
  });

  it('conserve l’entrée et signale une sync partielle si le serveur refuse', async () => {
    queuePlein({ a: 1 });
    global.fetch = vi.fn(() => Promise.resolve({ json: () => Promise.resolve({ success: false }) }));
    await syncQueue();
    expect(getPendingCount()).toBe(1);
    expect(showFeedback).toHaveBeenCalledWith('error', 'Sync partielle', expect.any(String));
  });

  it('s’arrête sans crash si le réseau coupe (fetch rejette)', async () => {
    queuePlein({ a: 1 });
    global.fetch = vi.fn(() => Promise.reject(new TypeError('offline')));
    await syncQueue();
    expect(getPendingCount()).toBe(1);   // rien purgé
  });
});
