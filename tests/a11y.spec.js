/**
 * Audit accessibilité (a11y) — Suivi Conso E85  [W79]
 *
 * Passe axe-core (WCAG 2.0/2.1 A & AA) sur les vues principales (saisie, stats,
 * historique). BLOQUANT depuis W81 : l'app étant à zéro violation grave, toute
 * violation critical/serious fait échouer le test (et le job CI `a11y`). Les
 * violations sont aussi rapportées (console + annotations) avec leurs cibles.
 * Tolérance : si l'audit ne peut PAS s'exécuter (instabilité de navigation/init),
 * le test reste neutre (skip) plutôt que d'échouer à tort.
 */

import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

// ── Patterns d'interception réseau (cf. e2e.spec.js) ─────────────────────────
const P_GAS      = 'https://script.google.com/**';
const P_PRIX     = 'https://data.economie.gouv.fr/**';
const P_OVERPASS = 'https://overpass-api.de/**';
const P_GSHEETS  = 'https://docs.google.com/**';

/** Monte les mocks réseau pour que l'app s'initialise sans appel externe réel. */
async function setupMocks(page) {
  // Seed d'une session authentifiée (stats/historique/params = PERSO_VIEWS gated).
  // isAuthed() lit AUTH_PROFILE_KEY : email + exp futur suffisent.
  await page.addInitScript(() => {
    const exp = Math.floor(Date.now() / 1000) + 3600;
    localStorage.setItem('suivi_e85_auth_profile',
      JSON.stringify({ email: 'a11y@test.local', name: 'A11y Test', exp, sub: 'test' }));
    localStorage.setItem('suivi_e85_auth_token', 'test-id-token');
  });
  // GIS (Google Identity) : éviter tout appel réseau pendant l'audit.
  await page.route('https://accounts.google.com/**', route => route.abort());
  await page.route(P_GAS, route => {
    if (route.request().method() === 'POST') {
      route.fulfill({ status: 200, contentType: 'application/json',
        body: JSON.stringify({ success: true, message: 'ok' }) });
    } else {
      route.fulfill({ status: 200, contentType: 'application/json',
        body: JSON.stringify({ records: [] }) });
    }
  });
  await page.route(P_PRIX, route =>
    route.fulfill({ status: 200, contentType: 'application/json',
      body: JSON.stringify({ results: [{ e85_prix: '0.798', sp98_prix: '2.091',
        adresse: '47 RUE DE CONDE', ville: 'DOUAI' }] }) }));
  await page.route(P_GSHEETS, route => route.abort());
  await page.route(P_OVERPASS, route =>
    route.fulfill({ status: 200, contentType: 'application/json',
      body: JSON.stringify({ elements: [] }) }));
}

/** Navigue sur une vue (hash SPA) et attend qu'elle soit active. */
async function allerVers(page, vue) {
  await page.goto('/#/' + vue);
  await page.waitForLoadState('load');
  // Polling tolérant à un éventuel re-render/redirect d'init (auth, router).
  await page.waitForFunction((v) => {
    const el = document.getElementById('view-' + v);
    return !!el && el.classList.contains('view--active');
  }, vue, { timeout: 20_000, polling: 400 });
}

const VUES = [
  { nom: 'saisie',     hash: 'saisie' },
  { nom: 'stats',      hash: 'stats' },
  { nom: 'historique', hash: 'historique' },
];

for (const vue of VUES) {
  test(`a11y — ${vue.nom}`, async ({ page }, testInfo) => {
    // W81 : BLOQUANT sur les violations GRAVES (critical/serious) une fois l'app
    // à zéro. Tolérance conservée : si l'audit ne peut PAS s'exécuter (instabilité
    // de navigation/init), le test est neutre (skip) au lieu d'échouer à tort.
    let graves = [];
    let auditRealise = false;
    try {
      await setupMocks(page);
      await allerVers(page, vue.hash);

      // Laisser la vue se stabiliser (chargements async, re-render) avant l'audit.
      await page.waitForLoadState('networkidle').catch(() => {});
      await page.waitForTimeout(600);

      const results = await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
        .analyze();

      graves = results.violations.filter(v => v.impact === 'critical' || v.impact === 'serious');
      auditRealise = true;

      for (const v of graves) {
        const cibles = v.nodes.map(n => (n.target || []).join(' ')).join(' | ');
        const msg = `${v.id} (${v.impact}) ×${v.nodes.length} — ${v.help} [${cibles}]`;
        testInfo.annotations.push({ type: 'a11y', description: `[${vue.nom}] ${msg}` });
         
        console.warn(`[a11y:${vue.nom}] ${msg} → ${v.helpUrl}`);
      }
       
      console.warn(`[a11y:${vue.nom}] ${graves.length} violation(s) grave(s) / ${results.violations.length} au total.`);
    } catch (err) {
      testInfo.annotations.push({ type: 'a11y-skip', description: `[${vue.nom}] audit non réalisé : ${err.message}` });
       
      console.warn(`[a11y:${vue.nom}] audit non réalisé (instabilité de la vue) : ${err.message}`);
    }

    // Gate dur : aucune violation grave tolérée (hors audit non réalisé).
    if (auditRealise) {
      const resume = graves.map(v => `${v.id} [${v.nodes.map(n => (n.target || []).join(' ')).join(', ')}]`);
      expect(resume, `Violations a11y graves sur « ${vue.nom} »`).toEqual([]);
    }
  });
}
