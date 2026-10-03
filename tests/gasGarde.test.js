// @vitest-environment node
/**
 * Tests — backend Google Apps Script (fichiers .gs) : garde-fous anti-perte.
 *
 *  1. GARDE STATIQUE : toute suppression physique (deleteRow / deleteRows /
 *     clearContent(s) / clear()) hors de la liste blanche explicite fait échouer
 *     la suite. handleSetDepenses et le journal n'en utilisent aucune.
 *  2. Dépenses (Depenses.gs) exécutées dans un bac à sable `vm` avec un faux
 *     Spreadsheet en mémoire : dates normalisées en texte, LWW, journal
 *     append-only (création, MAJ, suppression, restauration, ignore_ancien).
 *  3. auditDepenses_ (Audit.gs), fonction pure.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import vm from 'node:vm';

const GAS_DIR = fileURLToPath(new URL(
  '../Google Drive/Sauvegarde & Geolocalisation - Suivi conso SuperEthanol/Google Apps Script/', import.meta.url));
const GS_FILES = readdirSync(GAS_DIR).filter(f => f.endsWith('.gs')).sort();
const src = f => readFileSync(join(GAS_DIR, f), 'utf-8');

/* ─── 1. Garde statique ───────────────────────────────────────────────── */

const DELETE_RE = /\.(deleteRows?|clearContents?|clear)\s*\(/g;

/** Occurrences { 'Fichier.gs › fonction › méthode': n } (fonction = dernière
 *  déclaration `function nom(` en début de ligne qui précède l'appel). */
function scanSuppressions() {
  const found = {};
  GS_FILES.forEach(file => {
    let fn = '(top-level)';
    src(file).split(/\r?\n/).forEach(line => {
      const decl = line.match(/^function\s+([A-Za-z0-9_$]+)\s*\(/);
      if (decl) fn = decl[1];
      const code = line.replace(/\/\/.*$/, '');   // ignore les commentaires de fin de ligne
      let m;
      DELETE_RE.lastIndex = 0;
      while ((m = DELETE_RE.exec(code))) {
        const k = file + ' › ' + fn + ' › ' + m[1];
        found[k] = (found[k] || 0) + 1;
      }
    });
  });
  return found;
}

/** LISTE BLANCHE — seules suppressions physiques autorisées (nombre exact d'appels). */
const WHITELIST = {
  // syncStations : la liste curée des stations (onglet Stations) est réécrite en entier
  // depuis l'app ; aucune donnée personnelle (pleins/dépenses) n'y vit.
  'Code.gs › doPost › clearContents': 1,
  // removeVehicule : onglet legacy « Vehicules » (mode sans auth), une ligne = un nom.
  'Code.gs › doPost › deleteRow': 1,
  // Suppression de compte RGPD (action explicite + confirm + idToken vérifié) :
  // pleins, paramètres, abonnements push et dépenses du compte.
  'Code.gs › handleDeleteAccount › deleteRow': 4,
  // Tableau de bord natif Sheets : onglet DÉRIVÉ, entièrement recalculé.
  'Dashboard.gs › construireDashboard › clear': 1,
  // Abonnement Web Push expiré/révoqué (410/404) : purge technique de l'endpoint.
  'WebPush.gs › _removePushSub › deleteRow': 1,
};

describe('garde statique — aucune suppression physique hors liste blanche', () => {
  it('les .gs sont trouvés (dont Depenses.gs et Audit.gs)', () => {
    expect(GS_FILES).toEqual(expect.arrayContaining(['Code.gs', 'Depenses.gs', 'Audit.gs']));
  });

  it('les suppressions présentes correspondent EXACTEMENT à la liste blanche', () => {
    expect(scanSuppressions()).toEqual(WHITELIST);
  });

  it('Depenses.gs (handleSetDepenses + journal) et Audit.gs n’en contiennent aucune', () => {
    ['Depenses.gs', 'Audit.gs'].forEach(f => {
      expect(src(f).replace(/\/\/.*$/gm, '')).not.toMatch(DELETE_RE);
    });
  });

  it('handleSetDepenses n’appelle ni deleteRow ni clear, et le journal est en ajout seul', () => {
    const body = src('Depenses.gs').split(/^function handleSetDepenses\(/m)[1].split(/^}\s*$/m)[0];
    expect(body).not.toMatch(/delete|clear/i);
    expect(body).toMatch(/getOrCreateDepensesJournal_\(ss\)/);
    // le journal n'est écrit qu'APRÈS sa dernière ligne (getLastRow() + 1)
    expect(body).toMatch(/js\.getRange\(js\.getLastRow\(\) \+ 1,/);
  });
});

/* ─── Bac à sable GAS (faux Spreadsheet en mémoire) ───────────────────── */

function fakeSheet(name) {
  const sh = {
    name, data: [], formats: {},
    getLastRow: () => sh.data.length,
    appendRow: row => { sh.data.push(row.slice()); },
    getDataRange: () => ({ getValues: () => sh.data.map(r => r.slice()) }),
    getRange: (r, c, nr = 1, nc = 1) => {
      const rg = {
        setValues: vals => {
          vals.forEach((row, i) => {
            while (sh.data.length < r + i) sh.data.push([]);
            row.forEach((v, j) => { sh.data[r - 1 + i][c - 1 + j] = v; });
          });
          return rg;
        },
        setValue: v => rg.setValues([[v]]),
        setNumberFormat: f => { sh.formats[r + ':' + c] = f; return rg; },
        setFontWeight: () => rg, setBackground: () => rg, setFontColor: () => rg,
        getValue: () => (sh.data[r - 1] || [])[c - 1],
      };
      void nr; void nc;
      return rg;
    },
    setFrozenRows: () => {},
    deleteRow: () => { throw new Error('deleteRow interdit'); },
    clear: () => { throw new Error('clear interdit'); },
  };
  return sh;
}

function makeGas() {
  const sheets = {};
  const ss = {
    getSheetByName: n => sheets[n] || null,
    insertSheet: n => (sheets[n] = fakeSheet(n)),
    getSpreadsheetTimeZone: () => 'Europe/Paris',
  };
  const fmtDay = (d, tz) => new Intl.DateTimeFormat('en-CA', {
    timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' }).format(d);
  const ctx = {
    console,
    SpreadsheetApp: { openById: () => ss, flush: () => {} },
    LockService: { getScriptLock: () => ({ waitLock: () => {}, releaseLock: () => {} }) },
    Utilities: { formatDate: (d, tz, fmt) => { if (fmt !== 'yyyy-MM-dd') throw new Error(fmt); return fmtDay(d, tz); } },
    Session: { getScriptTimeZone: () => 'Europe/Paris' },
    Logger: { log: () => {} },
    ContentService: {
      MimeType: { JSON: 'json' },
      createTextOutput: s => ({ setMimeType: () => ({ body: s }), body: s }),
    },
  };
  vm.createContext(ctx);
  vm.runInContext(['Auth.gs', 'Code.gs', 'Depenses.gs', 'Audit.gs'].map(src).join('\n;\n'), ctx);
  const json = out => JSON.parse(out.body || '{}');
  // Les Date doivent venir du royaume du bac à sable (sinon `instanceof Date` y est faux).
  const date = iso => vm.runInContext('new Date(' + JSON.stringify(iso) + ')', ctx);
  return { ctx, ss, sheets, json, date };
}

const EMAIL = 'fdaubercy@gmail.com';
const dep = (id, ts, o = {}) => ({
  id, vehicule: 'Clio', date: '2026-09-05', categorie: 'Entretien',
  intitule: 'Vidange', montant: 80, modifie_le: ts, supprime: 0, ...o,
});

describe('Depenses.gs — dates normalisées, LWW et journal append-only', () => {
  let g;
  beforeEach(() => { g = makeGas(); });

  it('depDateIso_ : Date et ISO UTC → jour Europe/Paris ; texte et jj/mm/aaaa conservés', () => {
    const f = g.ctx.depDateIso_;
    expect(f(g.date('2026-09-04T22:00:00.000Z'), 'Europe/Paris')).toBe('2026-09-05');
    expect(f('2026-09-04T22:00:00.000Z', 'Europe/Paris')).toBe('2026-09-05');
    expect(f('2026-09-05', 'Europe/Paris')).toBe('2026-09-05');
    expect(f('5/9/2026', 'Europe/Paris')).toBe('2026-09-05');
    expect(f('', 'Europe/Paris')).toBe('');
    expect(f('n’importe quoi', 'Europe/Paris')).toBe('n’importe quoi');
  });

  it('handleSetDepenses écrit la date en TEXTE et journalise la création (source)', () => {
    const r = g.json(g.ctx.handleSetDepenses(g.ss, [dep('a', 100, { date: '2026-09-04T22:00:00.000Z' })], EMAIL, 'app'));
    expect(r.success).toBe(true);
    const sh = g.sheets.Depenses;
    expect(sh.data[1][2]).toBe('2026-09-05');
    expect(sh.formats['2:3']).toBe('@');
    const j = g.sheets.Depenses_journal.data;
    expect(j[0]).toEqual(['horodatage', 'email', 'id', 'action', 'source', 'avant', 'apres']);
    expect(j[1].slice(1, 5)).toEqual([EMAIL, 'a', 'creation', 'app']);
    expect(j[1][5]).toBe('');
    expect(JSON.parse(j[1][6])).toMatchObject({ id: 'a', montant: 80, supprime: 0 });
  });

  it('suppression, restauration, mise à jour et entrée ancienne ignorée sont journalisées sans jamais retirer de ligne', () => {
    const set = (items, source) => g.json(g.ctx.handleSetDepenses(g.ss, items, EMAIL, source));
    set([dep('a', 100)], 'app');
    set([dep('a', 200, { supprime: 1 })], 'app');
    set([dep('a', 300)], 'app');
    set([dep('a', 400, { montant: 95 })]);                  // source absente → 'inconnu'
    const r = set([dep('a', 150, { supprime: 1 })], 'excel'); // plus ancien → ignoré
    expect(r.depenses).toHaveLength(1);
    expect(r.depenses[0]).toMatchObject({ montant: 95, supprime: 0, modifie_le: 400 });
    expect(g.sheets.Depenses.data).toHaveLength(2);            // en-tête + 1 ligne
    const actions = g.sheets.Depenses_journal.data.slice(1).map(l => [l[3], l[4]]);
    expect(actions).toEqual([
      ['creation', 'app'], ['suppression', 'app'], ['restauration', 'app'],
      ['mise_a_jour', 'inconnu'], ['ignore_ancien', 'excel'],
    ]);
    const supp = g.sheets.Depenses_journal.data[2];
    expect(JSON.parse(supp[5]).supprime).toBe(0);
    expect(JSON.parse(supp[6])).toMatchObject({ supprime: 1, montant: 80 });   // montant conservé
  });

  it('un rejeu identique n’ajoute rien au journal', () => {
    g.ctx.handleSetDepenses(g.ss, [dep('a', 100)], EMAIL, 'app');
    g.ctx.handleSetDepenses(g.ss, [dep('a', 100)], EMAIL, 'app');
    expect(g.sheets.Depenses_journal.data).toHaveLength(2);
  });

  it('getDepenses répare une ancienne cellule Date (réécrite en texte) et renvoie yyyy-MM-dd', () => {
    const sh = g.ctx.getOrCreateDepensesSheet_(g.ss);
    sh.appendRow(['old', 'Clio', g.date('2026-09-04T22:00:00.000Z'), 'Entretien', 'Pneus', 300, 50, 0, EMAIL]);
    const r = g.json(g.ctx.handleGetDepenses(EMAIL));
    expect(r.depenses[0].date).toBe('2026-09-05');
    expect(sh.data[1][2]).toBe('2026-09-05');
    expect(sh.formats['2:3']).toBe('@');
  });
});

/* ─── 3. auditDepenses_ ───────────────────────────────────────────────── */

describe('Audit.gs — auditDepenses_ (fonction pure)', () => {
  const g = makeGas();
  const NOW = g.date('2026-10-03T12:00:00Z');
  const DAY = 86400000;
  const row = (id, o = {}) => {
    const d = { vehicule: 'Clio', date: '2026-09-05', cat: 'Entretien', intitule: 'Vidange', montant: 80,
      modif: NOW.getTime() - 60 * DAY, supprime: 0, ...o };
    return [id, d.vehicule, d.date, d.cat, d.intitule, d.montant, d.modif, d.supprime, EMAIL];
  };

  it('compte actives / supprimées et ne signale rien sur des données saines', () => {
    const r = g.ctx.auditDepenses_([row('a'), row('b', { intitule: 'Pneus' }), row('c', { supprime: 1 })], NOW);
    expect(r).toMatchObject({ total: 3, actives: 2, supprimees: 1 });
    expect(r.issues).toEqual([]);
  });

  it('dep_doublon (ids différents, actives), dep_date_invalide, dep_montant_invalide', () => {
    const r = g.ctx.auditDepenses_([
      row('a'), row('b'),                        // doublon
      row('c', { supprime: 1 }),                 // tombstone identique : ignorée
      row('d', { date: 'pas une date', intitule: 'X' }),
      row('e', { montant: 0, intitule: 'Y' }),
    ], NOW);
    const types = r.issues.map(i => i.type + ':' + i.id).sort();
    expect(types).toEqual(['dep_date_invalide:d', 'dep_doublon:b', 'dep_montant_invalide:e']);
    const dup = r.issues.find(i => i.type === 'dep_doublon');
    expect(dup).toMatchObject({ severity: 'error', vehicule: 'Clio', date: '2026-09-05', intitule: 'Vidange', montant: 80 });
    expect(Object.keys(dup).sort()).toEqual(['date', 'id', 'intitule', 'message', 'montant', 'severity', 'type', 'vehicule']);
  });

  it('dep_suppression_recente : tombstone < 30 jours, warn, « Supprimée le jj/mm/aaaa, restaurable »', () => {
    const r = g.ctx.auditDepenses_([
      row('r', { supprime: 1, modif: new Date('2026-09-28T10:00:00Z').getTime() }),
      row('v', { supprime: 1, modif: NOW.getTime() - 45 * DAY }),
    ], NOW);
    expect(r.issues).toHaveLength(1);
    expect(r.issues[0]).toMatchObject({ type: 'dep_suppression_recente', severity: 'warn', id: 'r' });
    expect(r.issues[0].message).toMatch(/^Supprimée le 28\/09\/2026, restaurable$/);
  });
});

// v5.37.1 — `new Date('yyyy-mm-dd')` = minuit UTC = 02:00 à Paris : toutes les dates
// de pleins écrites par le GAS étaient stockées à 02:00. Interdit hors de dateJour_.
describe('garde statique — dates « jour » écrites à minuit local', () => {
  it('aucun `new Date(payload.date)` dans les .gs (utiliser dateJour_)', () => {
    GS_FILES.forEach(f => {
      expect(src(f), f).not.toMatch(/new Date\(\s*payload\.date\s*\)/);
    });
  });
  it('dateJour_ existe et utilise le fuseau du classeur', () => {
    const code = src('Code.gs');
    expect(code).toMatch(/function dateJour_\(/);
    expect(code).toMatch(/getSpreadsheetTimeZone\(\)[\s\S]{0,200}Utilities\.parseDate/);
  });
});
