// @vitest-environment jsdom
/**
 * Tests — js/integrite.js : rendu du contrôle d'intégrité (action GAS audit),
 * appel réseau (même schéma que l'export) et suppression d'une copie.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('../js/auth.js', () => ({ getIdToken: () => 'ID.TOK', isAuthed: () => true, authEnabled: () => false }));
vi.mock('../js/ui.js', () => ({ showFeedback: vi.fn() }));

import { renderAuditHtml, renderDepensesAuditHtml, fetchAudit, deleteCopie, initIntegriteUI, AUDIT_TYPE_LABELS } from '../js/integrite.js';
import { DEPENSES_KEY } from '../js/config.js';
import { showFeedback } from '../js/ui.js';

const issue = (o = {}) => ({
  type: 'dup_contenu', severity: 'error', sync_id: 'sid-copie', row: 42,
  date: '2026-09-25', km: 19253, litres: 35.12, prix: 0.819, vehicule: 'Clio',
  message: 'Doublon du plein de la ligne 41.', related: ['sid-orig'], relatedRows: [41], ...o,
});

describe('renderAuditHtml', () => {
  it('retourne une chaîne vide sans audit', () => {
    expect(renderAuditHtml(null)).toBe('');
  });

  it('affiche « Aucune anomalie » quand la liste est vide', () => {
    const html = renderAuditHtml({ success: true, total: 12, active: 10, issues: [] });
    expect(html).toContain('✓ Aucune anomalie');
    expect(html).toContain('10 pleins actifs analysés');
    expect(html).not.toContain('integ-list');
  });

  it('résume et liste les anomalies avec libellé français, date, km et message', () => {
    const html = renderAuditHtml({
      active: 3,
      issues: [issue(), issue({ type: 'km_non_croissant', severity: 'warn', sync_id: 'x', row: 7, message: 'Km bas.' })],
    });
    const div = document.createElement('div');
    div.innerHTML = html;
    expect(div.querySelector('.integ-summary').textContent).toBe('2 anomalies — 1 erreur, 1 avertissement');
    const items = div.querySelectorAll('.integ-item');
    expect(items).toHaveLength(2);
    expect(items[0].classList.contains('integ-error')).toBe(true);
    expect(items[0].textContent).toContain(AUDIT_TYPE_LABELS.dup_contenu);
    expect(items[0].textContent).toContain('25/09/2026');
    expect(items[0].querySelector('.integ-meta').textContent).toMatch(/19\s?253 km/);
    expect(items[0].textContent).toContain('ligne 42');
    expect(items[1].classList.contains('integ-warn')).toBe(true);
    expect(items[1].textContent).toContain('Kilométrage incohérent');
  });

  it('propose « Supprimer cette copie » uniquement pour les doublons avec sync_id', () => {
    const div = document.createElement('div');
    div.innerHTML = renderAuditHtml({ active: 5, issues: [
      issue(),
      issue({ type: 'dup_sync_id', sync_id: 'D', row: 9 }),
      issue({ type: 'dup_contenu', sync_id: '', row: 10 }),
      issue({ type: 'champ_manquant', row: 11 }),
      issue({ type: 'entete_fantome', sync_id: 'sync_id', row: 12 }),
    ] });
    const btns = div.querySelectorAll('.integ-fix');
    expect(btns).toHaveLength(2);
    expect(btns[0].dataset.syncId).toBe('sid-copie');
    expect(btns[0].dataset.row).toBe('42');
    expect(btns[1].dataset.syncId).toBe('D');
    expect(btns[0].textContent).toBe('Supprimer cette copie');
  });

  it('échappe toute valeur issue du Sheet (HTML et attributs)', () => {
    const html = renderAuditHtml({ active: 1, issues: [
      issue({
        sync_id: '"><img src=x onerror=alert(1)>', vehicule: '<b>Clio</b>',
        message: '<script>alert(1)</script>',
      }),
      issue({ type: '<i>inconnu</i>', severity: 'warn' }),
    ] });
    expect(html).not.toContain('<script>');
    expect(html).not.toContain('<img');
    expect(html).not.toContain('<b>Clio</b>');
    expect(html).not.toContain('<i>inconnu</i>');
    expect(html).toContain('&lt;script&gt;');
    const div = document.createElement('div');
    div.innerHTML = html;
    expect(div.querySelector('img')).toBeNull();
    expect(div.querySelector('.integ-fix').dataset.syncId).toBe('"><img src=x onerror=alert(1)>');
  });
});

describe('fetchAudit / deleteCopie', () => {
  it('appelle ?action=audit avec token et idToken (schéma de l’export)', async () => {
    global.fetch = vi.fn(() => Promise.resolve({ ok: true, json: () => Promise.resolve({ success: true, issues: [] }) }));
    const data = await fetchAudit();
    expect(data.issues).toEqual([]);
    const url = global.fetch.mock.calls[0][0];
    expect(url).toContain('?action=audit');
    expect(url).toContain('&token=');
    expect(url).toContain('&idToken=ID.TOK');
  });

  it('lève une erreur lisible si le serveur refuse', async () => {
    global.fetch = vi.fn(() => Promise.resolve({ ok: true, json: () => Promise.resolve({ success: false, error: 'unauthorized' }) }));
    await expect(fetchAudit()).rejects.toThrow('connexion requise');
  });

  it('deleteCopie envoie deletePlein avec sync_id, n° de ligne, token et idToken', async () => {
    global.fetch = vi.fn(() => Promise.resolve({ ok: true, json: () => Promise.resolve({ success: true }) }));
    await deleteCopie('sid-copie', 42);
    const body = JSON.parse(global.fetch.mock.calls[0][1].body);
    expect(body).toMatchObject({ action: 'deletePlein', sync_id: 'sid-copie', row: 42, idToken: 'ID.TOK' });
    expect(body).toHaveProperty('token');
  });
});

describe('initIntegriteUI', () => {
  beforeEach(() => {
    document.body.innerHTML = '<button id="integriteBtn">Vérifier</button><div id="integriteResult"></div>';
    vi.clearAllMocks();
  });

  it('lance l’audit au clic, puis supprime une copie après confirmation et relance l’audit', async () => {
    const audit1 = { success: true, active: 2, issues: [issue()] };
    const audit2 = { success: true, active: 1, issues: [] };
    const responses = [audit1, { success: true }, audit2];
    global.fetch = vi.fn(() => Promise.resolve({ ok: true, json: () => Promise.resolve(responses.shift()) }));
    window.confirm = vi.fn(() => true);
    initIntegriteUI();

    document.getElementById('integriteBtn').click();
    await vi.waitFor(() => expect(document.querySelector('.integ-fix')).not.toBeNull());

    document.querySelector('.integ-fix').click();
    await vi.waitFor(() => expect(document.getElementById('integriteResult').textContent).toContain('Aucune anomalie'));
    expect(window.confirm).toHaveBeenCalledTimes(1);
    expect(global.fetch).toHaveBeenCalledTimes(3);
    expect(showFeedback).toHaveBeenCalledWith('success', expect.any(String), expect.any(String));
  });

  it('ne supprime rien si l’utilisateur annule', async () => {
    global.fetch = vi.fn(() => Promise.resolve({ ok: true, json: () => Promise.resolve({ success: true, active: 2, issues: [issue()] }) }));
    window.confirm = vi.fn(() => false);
    initIntegriteUI();
    document.getElementById('integriteBtn').click();
    await vi.waitFor(() => expect(document.querySelector('.integ-fix')).not.toBeNull());
    document.querySelector('.integ-fix').click();
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });
});

/* ─── Section « Dépenses d'entretien » (audit.depenses) ─── */
const depIssue = (o = {}) => ({
  type: 'dep_suppression_recente', severity: 'warn', id: 'dep1', vehicule: 'Clio',
  date: '2026-09-05', intitule: 'Vidange', montant: 80,
  message: 'Supprimée le 28/09/2026, restaurable', ...o,
});

describe('renderDepensesAuditHtml', () => {
  it('absente du rendu si la réponse n’a pas de section depenses (contrat historique)', () => {
    expect(renderDepensesAuditHtml(undefined)).toBe('');
    expect(renderAuditHtml({ active: 1, issues: [] })).not.toContain('Dépenses');
  });

  it('section sans anomalie : compte actives / supprimées', () => {
    const div = document.createElement('div');
    div.innerHTML = renderAuditHtml({ active: 1, issues: [], depenses: { total: 3, actives: 2, supprimees: 1, issues: [] } });
    expect(div.querySelector('.integ-section').textContent).toContain('Dépenses');
    expect(div.textContent).toContain('2 dépenses actives, 1 supprimée');
  });

  it('liste les anomalies ; « Restaurer » uniquement pour dep_suppression_recente ; valeurs échappées', () => {
    const div = document.createElement('div');
    div.innerHTML = renderDepensesAuditHtml({ total: 4, actives: 3, supprimees: 1, issues: [
      depIssue({ intitule: '<b>Vidange</b>' }),
      depIssue({ type: 'dep_doublon', severity: 'error', id: 'dep2', message: 'Doublon.' }),
      depIssue({ type: 'dep_montant_invalide', severity: 'error', id: 'dep3', montant: 0 }),
    ] });
    const items = div.querySelectorAll('.integ-item');
    expect(items).toHaveLength(3);
    expect(div.textContent).toContain(AUDIT_TYPE_LABELS.dep_doublon);
    expect(div.querySelectorAll('.integ-restore')).toHaveLength(1);
    expect(div.querySelector('.integ-restore').dataset.depId).toBe('dep1');
    expect(div.querySelector('b')).toBeNull();
    expect(items[0].textContent).toContain('05/09/2026');
  });
});

describe('initIntegriteUI — restauration d’une dépense supprimée', () => {
  beforeEach(() => {
    document.body.innerHTML = '<button id="integriteBtn">Vérifier</button><div id="integriteResult"></div>';
    vi.clearAllMocks();
    localStorage.clear();
  });

  it('confirm() puis restoreDepense + POST setDepenses (source app) puis nouvel audit', async () => {
    localStorage.setItem(DEPENSES_KEY, JSON.stringify([{ id: 'dep1', vehicule: 'Clio', date: '2026-09-05',
      categorie: 'Entretien', intitule: 'Vidange', montant: 80, modifie_le: 1000, supprime: 1 }]));
    const audit1 = { success: true, active: 1, issues: [], depenses: { total: 1, actives: 0, supprimees: 1, issues: [depIssue()] } };
    const audit2 = { success: true, active: 1, issues: [], depenses: { total: 1, actives: 1, supprimees: 0, issues: [] } };
    const responses = [audit1, { success: true }, audit2];
    globalThis.fetch = vi.fn(() => Promise.resolve({ ok: true, json: () => Promise.resolve(responses.shift()) }));
    window.confirm = vi.fn(() => true);
    const synced = vi.fn();
    window.addEventListener('depenses-synced', synced);
    initIntegriteUI();

    document.getElementById('integriteBtn').click();
    await vi.waitFor(() => expect(document.querySelector('.integ-restore')).not.toBeNull());
    document.querySelector('.integ-restore').click();
    await vi.waitFor(() => expect(document.getElementById('integriteResult').textContent).toContain('1 dépense active'));
    window.removeEventListener('depenses-synced', synced);

    expect(window.confirm).toHaveBeenCalledWith(expect.stringContaining('Restaurer la dépense'));
    const post = JSON.parse(globalThis.fetch.mock.calls[1][1].body);
    expect(post).toMatchObject({ action: 'setDepenses', source: 'app' });
    expect(post.depenses[0]).toMatchObject({ id: 'dep1', supprime: 0, montant: 80 });
    expect(JSON.parse(localStorage.getItem(DEPENSES_KEY))[0].supprime).toBe(0);
    expect(synced).toHaveBeenCalled();
  });

  it('ne restaure rien si l’utilisateur annule', async () => {
    globalThis.fetch = vi.fn(() => Promise.resolve({ ok: true, json: () => Promise.resolve(
      { success: true, active: 0, issues: [], depenses: { total: 1, actives: 0, supprimees: 1, issues: [depIssue()] } }) }));
    window.confirm = vi.fn(() => false);
    initIntegriteUI();
    document.getElementById('integriteBtn').click();
    await vi.waitFor(() => expect(document.querySelector('.integ-restore')).not.toBeNull());
    document.querySelector('.integ-restore').click();
    expect(globalThis.fetch).toHaveBeenCalledTimes(1);
  });
});
