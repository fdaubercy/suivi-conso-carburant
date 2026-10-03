// @vitest-environment jsdom
/**
 * Tests — protections contre la perte de dépenses (js/depenses.js + js/depensesUI.js)
 *  • dates ISO UTC (cellule Date du Sheet) → date LOCALE yyyy-mm-dd ;
 *  • suppression = tombstone qui GARDE le montant ; restauration ;
 *  • non-régression syncDepenses : jamais de dépense locale retirée ;
 *  • UI : confirm, bandeau « Annuler », corbeille « Restaurer ».
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

vi.mock('../js/auth.js', () => ({
  authEnabled: () => false, isAuthed: () => true, getIdToken: () => 'tok',
}));

import { state } from '../js/state.js';
import { DEPENSES_KEY } from '../js/config.js';
import {
  normaliserDateDepense, addDepense, removeDepense, restoreDepense,
  getAllDepenses, getDepenses, getDepensesTotal, getDepensesSupprimees, syncDepenses,
} from '../js/depenses.js';
import { fmtDateDepense, initDepensesUI, renderDepenses, UNDO_DELAY_MS } from '../js/depensesUI.js';

const setLocal = arr => localStorage.setItem(DEPENSES_KEY, JSON.stringify(arr));
const dep = (id, ts, o = {}) => ({
  id, vehicule: 'Clio', date: '2026-09-01', categorie: 'Entretien',
  intitule: 'X', montant: 10, modifie_le: ts, supprime: 0, ...o,
});
/** Jour local attendu pour un instant ISO (indépendant du fuseau de la machine de test). */
const localDay = iso => {
  const d = new Date(iso);
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
};
const isParis = Intl.DateTimeFormat().resolvedOptions().timeZone === 'Europe/Paris';

function mockFetch(serverRows) {
  const posts = [];
  globalThis.fetch = vi.fn(async (url, opts) => {
    if (opts && opts.method === 'POST') {
      posts.push(JSON.parse(opts.body));
      return { ok: true, json: async () => ({ success: true }) };
    }
    return { ok: true, json: async () => ({ depenses: serverRows }) };
  });
  return posts;
}

beforeEach(() => {
  localStorage.clear();
  vi.restoreAllMocks();
  state.currentVehiculeNom = '';
});

describe('dates — normalisation ISO → date locale', () => {
  it('ISO UTC → composants LOCAUX (2026-09-04T22:00Z → 2026-09-05 à Paris)', () => {
    expect(normaliserDateDepense('2026-09-04T22:00:00.000Z')).toBe(localDay('2026-09-04T22:00:00.000Z'));
    if (isParis) expect(normaliserDateDepense('2026-09-04T22:00:00.000Z')).toBe('2026-09-05');
  });
  it('yyyy-mm-dd inchangé, jj/mm/aaaa converti, Date locale, vide → ""', () => {
    expect(normaliserDateDepense('2026-09-05')).toBe('2026-09-05');
    expect(normaliserDateDepense('5/9/2026')).toBe('2026-09-05');
    expect(normaliserDateDepense(new Date(2026, 8, 5, 23, 30))).toBe('2026-09-05');
    expect(normaliserDateDepense('')).toBe('');
    expect(normaliserDateDepense(null)).toBe('');
  });
  it('valeur illisible conservée telle quelle (jamais perdue)', () => {
    expect(normaliserDateDepense('bientôt')).toBe('bientôt');
  });
  it('affichage robuste : ISO accepté → jj/mm/aaaa (plus de « 05T22:00:00.000Z/09/2026 »)', () => {
    expect(fmtDateDepense('2026-09-05')).toBe('05/09/2026');
    const iso = '2026-09-04T22:00:00.000Z';
    const [y, m, d] = localDay(iso).split('-');
    expect(fmtDateDepense(iso)).toBe(`${d}/${m}/${y}`);
    expect(fmtDateDepense(iso)).not.toContain('T');
  });
  it('la liste locale est réparée (et persistée) au chargement', () => {
    setLocal([dep('a', 1, { date: '2026-09-04T22:00:00.000Z' })]);
    expect(getAllDepenses()[0].date).toBe(localDay('2026-09-04T22:00:00.000Z'));
    expect(JSON.parse(localStorage.getItem(DEPENSES_KEY))[0].date).not.toContain('T');
  });
  it('une date ISO venue du serveur est normalisée à la synchro', async () => {
    mockFetch([dep('s', 100, { date: '2026-09-04T22:00:00.000Z' })]);
    await syncDepenses();
    expect(getAllDepenses().find(x => x.id === 's').date).toBe(localDay('2026-09-04T22:00:00.000Z'));
  });
});

describe('suppression / restauration sans perte', () => {
  it('removeDepense garde le montant sur la tombstone, exclue des totaux', () => {
    const d = addDepense({ vehicule: 'Clio', intitule: 'Vidange', montant: 80 });
    const t = removeDepense(d.id);
    expect(t).toMatchObject({ supprime: 1, montant: 80 });
    expect(t.modifie_le).toBeGreaterThan(d.modifie_le - 1);
    expect(getDepensesTotal('Clio')).toBe(0);
    expect(getDepensesSupprimees('Clio').map(x => x.id)).toEqual([d.id]);
  });
  it('restoreDepense : supprime=0, horodatage strictement postérieur, montant retrouvé', () => {
    const d = addDepense({ vehicule: 'Clio', intitule: 'Vidange', montant: 80 });
    const t = removeDepense(d.id);
    const tsSuppr = t.modifie_le;
    const r = restoreDepense(d.id);
    expect(r).toMatchObject({ supprime: 0, montant: 80 });
    expect(r.modifie_le).toBeGreaterThan(tsSuppr);
    expect(getDepensesTotal('Clio')).toBe(80);
    expect(getDepensesSupprimees('Clio')).toEqual([]);
    expect(restoreDepense('inconnu')).toBeNull();
  });
});

describe('syncDepenses — non-régression (jamais de perte locale)', () => {
  it('une dépense locale absente du serveur n’est JAMAIS retirée : elle est poussée (source app)', async () => {
    setLocal([dep('loc', 300)]);
    const posts = mockFetch([]);
    await syncDepenses();
    expect(getAllDepenses().map(x => x.id)).toEqual(['loc']);
    const push = posts.find(p => p.action === 'setDepenses');
    expect(push.source).toBe('app');
    expect(push.depenses.map(x => x.id)).toEqual(['loc']);
  });
  it('une tombstone serveur plus ANCIENNE ne supprime pas la dépense locale modifiée après', async () => {
    setLocal([dep('a', 500, { montant: 42 })]);
    const posts = mockFetch([dep('a', 200, { supprime: 1 })]);
    await syncDepenses();
    const a = getAllDepenses().find(x => x.id === 'a');
    expect(a).toMatchObject({ supprime: 0, montant: 42 });
    expect(posts.find(p => p.action === 'setDepenses').depenses[0]).toMatchObject({ id: 'a', supprime: 0 });
  });
  it('une dépense serveur inconnue est ajoutée', async () => {
    setLocal([dep('loc', 1)]);
    mockFetch([dep('loc', 1), dep('srv', 2, { intitule: 'Pneus' })]);
    await syncDepenses();
    expect(getAllDepenses().map(x => x.id).sort()).toEqual(['loc', 'srv']);
  });
  it('ancienne tombstone serveur à montant 0 plus récente : le montant local est conservé', async () => {
    setLocal([dep('a', 100, { montant: 80 })]);
    mockFetch([dep('a', 200, { supprime: 1, montant: 0 })]);
    await syncDepenses();
    expect(getAllDepenses()[0]).toMatchObject({ supprime: 1, montant: 80 });
  });
  it('aucune combinaison local/serveur ne réduit le nombre d’ids locaux', async () => {
    const cas = [
      { l: [], s: [] },
      { l: [dep('a', 1)], s: [] },
      { l: [dep('a', 1), dep('b', 5)], s: [dep('a', 9, { supprime: 1 })] },
      { l: [dep('a', 9)], s: [dep('a', 1, { supprime: 1 }), dep('c', 3)] },
      { l: [dep('a', 1, { supprime: 1 })], s: [dep('b', 2)] },
      { l: [dep('a', 4), dep('b', 4)], s: [dep('a', 4), dep('b', 4)] },
    ];
    for (const c of cas) {
      localStorage.clear();
      setLocal(c.l);
      mockFetch(c.s);
      await syncDepenses();
      const ids = new Set(getAllDepenses().map(x => x.id));
      c.l.forEach(d => expect(ids.has(d.id)).toBe(true));
      expect(ids.size).toBeGreaterThanOrEqual(c.l.length);
    }
  });
});

/* ─── UI ─── */
const HTML = `
  <span id="depensesVehLabel"></span>
  <div id="depenseAdd"></div>
  <ul id="depensesList"></ul>
  <strong id="depensesTotal"></strong>
  <div id="depenseUndo" role="status" hidden><span id="depenseUndoMsg"></span>
    <button type="button" id="depenseUndoBtn">Annuler</button></div>
  <details id="depensesCorbeille" hidden><summary>Dépenses supprimées (<span id="depensesCorbeilleCount">0</span>)</summary>
    <ul id="depensesCorbeilleList"></ul></details>`;

describe('UI — confirmation, annulation et corbeille', () => {
  beforeEach(() => {
    document.body.innerHTML = HTML;
    state.currentVehiculeNom = 'Clio';
    mockFetch([]);
    vi.useFakeTimers();
  });
  afterEach(() => { vi.useRealTimers(); });

  it('annuler le confirm() ne supprime rien', () => {
    const d = addDepense({ vehicule: 'Clio', intitule: 'Vidange', montant: 80 });
    initDepensesUI();
    const conf = vi.spyOn(window, 'confirm').mockReturnValue(false);
    document.querySelector(`[data-del-id="${d.id}"]`).click();
    expect(conf).toHaveBeenCalledWith(expect.stringMatching(/^Supprimer « Vidange » \(80\s€\) \?$/));
    expect(getDepenses('Clio')).toHaveLength(1);
    expect(document.getElementById('depenseUndo').hidden).toBe(true);
  });

  it('confirmé : tombstone + bandeau « Annuler » (~10 s) qui restaure', () => {
    const d = addDepense({ vehicule: 'Clio', intitule: 'Vidange', montant: 80 });
    initDepensesUI();
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    document.querySelector(`[data-del-id="${d.id}"]`).click();
    expect(getDepenses('Clio')).toHaveLength(0);
    const undo = document.getElementById('depenseUndo');
    expect(undo.hidden).toBe(false);
    expect(document.getElementById('depenseUndoMsg').textContent).toContain('Vidange');
    expect(document.getElementById('depensesCorbeille').hidden).toBe(false);
    document.getElementById('depenseUndoBtn').click();
    expect(getDepenses('Clio').map(x => x.montant)).toEqual([80]);
    expect(undo.hidden).toBe(true);
  });

  it('le bandeau disparaît seul après le délai', () => {
    const d = addDepense({ vehicule: 'Clio', intitule: 'Vidange', montant: 80 });
    initDepensesUI();
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    document.querySelector(`[data-del-id="${d.id}"]`).click();
    vi.advanceTimersByTime(UNDO_DELAY_MS + 10);
    expect(document.getElementById('depenseUndo').hidden).toBe(true);
    expect(getDepenses('Clio')).toHaveLength(0);
  });

  it('corbeille : compte, « montant inconnu » pour une ancienne tombstone à 0, bouton Restaurer', () => {
    setLocal([dep('old', 100, { vehicule: 'Clio', intitule: 'Pneus', supprime: 1, montant: 0 }),
              dep('autre', 100, { vehicule: 'Kangoo', supprime: 1 })]);
    initDepensesUI();
    renderDepenses('Clio');
    expect(document.getElementById('depensesCorbeilleCount').textContent).toBe('1');
    const li = document.querySelector('#depensesCorbeilleList li');
    expect(li.textContent).toContain('montant inconnu');
    li.querySelector('[data-restore-id="old"]').click();
    expect(getDepenses('Clio').map(x => x.id)).toEqual(['old']);
    expect(document.getElementById('depensesCorbeille').hidden).toBe(true);
  });
});
