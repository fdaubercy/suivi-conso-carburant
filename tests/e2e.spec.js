/**
 * Tests E2E Playwright — Suivi Conso E85  [v2.12.1.0]
 *
 * Mode mock GAS : toutes les requêtes réseau extérieures sont interceptées
 * via page.route() avant qu'elles ne quittent le navigateur.
 *
 * Scénarios :
 *   TC-01  Formulaire E85 complet → feedback succès + formulaire réinitialisé
 *          + historique rechargé (chargerHistorique appelé à nouveau)
 *   TC-02  Formulaire SP98 complet → feedback succès + formulaire réinitialisé
 *   TC-03  Champs obligatoires manquants → erreur de validation
 *   TC-04  Station non sélectionnée → erreur de validation
 *   TC-05  Erreur renvoyée par GAS → feedback erreur serveur
 */

import { test, expect } from '@playwright/test';

// ── Patterns d'interception réseau ────────────────────────────────────────────
const P_GAS      = 'https://script.google.com/**';
const P_PRIX     = 'https://data.economie.gouv.fr/**';
const P_OVERPASS = 'https://overpass-api.de/**';
const P_GSHEETS  = 'https://docs.google.com/**';   // stations CSV → abort → fallback

// ── Réponses mock ─────────────────────────────────────────────────────────────
const GAS_SUCCESS = {
  success: true,
  message: '14.90 L à 0.798 €/L — Leclerc Douai',
};

const GAS_ERROR = {
  success: false,
  error: 'Quota dépassé',
};

const PRIX_MOCK = {
  results: [{
    e85_prix:  '0.798',
    sp98_prix: '2.091',
    adresse:   '47 RUE DE CONDE',
    ville:     'DOUAI',
  }],
};

/**
 * Enregistrement inséré dans la réponse mock de l'historique
 * lors du 2ème appel (post-soumission) pour vérifier le rechargement.
 */
const HIST_RECORD = {
  Horodatage:        '2026-05-27T12:00:00',
  Date:              '2026-05-27',
  Type:              'SuperEthanol E85',
  'Km compteur':     11596,
  'Nb. Litres':      14.90,
  'Prix €/L':        0.798,
  'Station essence': 'Leclerc Douai',
};

// ── Helper : navigation + mocks réseau ───────────────────────────────────────
/**
 * Monte les mocks réseau, navigue sur la page, et attend que l'init JS
 * soit terminée (toggle type actif + stations du fallback chargées).
 *
 * @param {import('@playwright/test').Page} page
 * @param {{ gasReponse?: object }} opts
 */
async function gotoWithMocks(page, { gasReponse = GAS_SUCCESS } = {}) {
  /**
   * Flag positionné à true dès qu'un POST vers GAS a reçu une réponse succès.
   * Les GET suivants (chargerHistorique post-soumission) renvoient alors HIST_RECORD.
   * On évite ainsi les faux positifs liés à un compteur (plusieurs GETs pendant l'init).
   */
  let submissionDone = false;

  // ── Mock GAS (historique GET + soumission POST) ──────────────────────────
  await page.route(P_GAS, route => {
    if (route.request().method() === 'POST') {
      // Soumission formulaire (ou syncStationSiNouvelle — réponse commune)
      if (gasReponse.success) submissionDone = true;
      route.fulfill({
        status:      200,
        contentType: 'application/json',
        body:        JSON.stringify(gasReponse),
      });
    } else {
      // chargerHistorique() — GET ?action=export
      const records = submissionDone ? [HIST_RECORD] : [];
      route.fulfill({
        status:      200,
        contentType: 'application/json',
        body:        JSON.stringify({ records }),
      });
    }
  });

  // ── Mock API prix carburants (data.economie.gouv.fr) ─────────────────────
  await page.route(P_PRIX, route =>
    route.fulfill({
      status:      200,
      contentType: 'application/json',
      body:        JSON.stringify(PRIX_MOCK),
    })
  );

  // ── Google Sheets stations : abort → catch → fallback hardcodé ───────────
  // Le fallback inclut : Leclerc Douai, Total Waziers, Carrefour Flers, etc.
  await page.route(P_GSHEETS, route => route.abort());

  // ── Overpass API (géolocalisation) : liste vide ───────────────────────────
  await page.route(P_OVERPASS, route =>
    route.fulfill({
      status:      200,
      contentType: 'application/json',
      body:        JSON.stringify({ elements: [] }),
    })
  );

  await page.goto('/');

  // ── Attendre la fin de l'initialisation JS ────────────────────────────────
  // 1. Toggle type construit synchronement dans _buildTypeToggle({})
  await page.waitForSelector('#typeToggle .type-btn.active', { timeout: 10_000 });
  // 2. Stations du fallback insérées dans le dropdown après échec Google Sheets
  // state:'attached' car <option> n'est jamais "visible" (dropdown fermé = hidden pour Playwright)
  await page.waitForSelector('#stationSel option[value="Leclerc Douai"]', {
    state: 'attached',
    timeout: 10_000,
  });
  // 3. Premier chargerHistorique() terminé (plus de "Chargement…")
  await page.waitForFunction(
    () => !document.getElementById('historiqueList')?.textContent?.includes('Chargement'),
    { timeout: 10_000 }
  );
}

// ── Helper : remplissage standard formulaire E85 ─────────────────────────────
/**
 * Remplit les champs du formulaire en mode E85 (type déjà actif par défaut).
 * NB : la sélection de la station déclenche onStationChange() → fetchPricesNearUser()
 * mais comme userLat est null, aucun appel API n'est effectué.
 *
 * @param {import('@playwright/test').Page} page
 */
async function fillFormE85(page) {
  await page.fill('#fKm',     '11596');
  await page.fill('#fLitres', '14.90');
  // Station en avant-dernier : onStationChange() peut appeler applyPricesResult()
  // qui efface fPrix → on remplit fPrix EN DERNIER pour garantir la valeur.
  await page.selectOption('#stationSel', 'Leclerc Douai');
  await page.fill('#fPrix',   '0.798');
}

// ══════════════════════════════════════════════════════════════════════════════
test.describe('Suivi E85 — E2E (mode mock GAS)', () => {

  // ──────────────────────────────────────────────────────────────────────────
  test('TC-01 · E85 complet → feedback succès + formulaire réinitialisé + historique rechargé', async ({ page }) => {
    await gotoWithMocks(page);

    // ── 1. État initial ──────────────────────────────────────────────────────
    // Titre de la page
    await expect(page.locator('h1')).toContainText("Saisie d'un plein");
    // Toggle E85 actif par défaut
    await expect(page.locator('#typeToggle .type-row-primary .type-btn').first())
      .toHaveClass(/active/);
    // Version affichée dans le header
    await expect(page.locator('#appVersion')).toContainText('v2');
    // Historique initial vide (premier appel mock → records: [])
    await expect(page.locator('#historiqueList')).toContainText('Aucun plein enregistré');
    // Pas de feedback au chargement
    await expect(page.locator('#feedback')).not.toBeVisible();

    // ── 2. Remplissage du formulaire ─────────────────────────────────────────
    await fillFormE85(page);

    // ── 3. Coût calculé automatiquement (14.90 × 0.798 = 11.89 €) ────────────
    await expect(page.locator('#coutBox')).toBeVisible();
    await expect(page.locator('#coutVal')).toContainText('11.89');

    // ── 4. Soumission ────────────────────────────────────────────────────────
    await page.click('#submitBtn');

    // ── 5. Feedback succès ───────────────────────────────────────────────────
    const feedback = page.locator('#feedback');
    await expect(feedback).toBeVisible({ timeout: 5_000 });
    await expect(feedback).toHaveClass(/success/);
    await expect(feedback.locator('strong')).toContainText('Plein enregistré');

    // ── 6. Réinitialisation du formulaire ─────────────────────────────────────
    await expect(page.locator('#fKm')).toHaveValue('',     { timeout: 3_000 });
    await expect(page.locator('#fLitres')).toHaveValue('');
    await expect(page.locator('#fPrix')).toHaveValue('');
    await expect(page.locator('#stationSel')).toHaveValue('');
    await expect(page.locator('#coutBox')).not.toBeVisible();

    // ── 7. Historique rechargé ────────────────────────────────────────────────
    // Le 2ème appel mock renvoie HIST_RECORD → chargerHistorique() rend 1 .hist-item
    await expect(page.locator('#historiqueList .hist-item'))
      .toHaveCount(1, { timeout: 5_000 });
    await expect(page.locator('#historiqueList .hist-item')).toContainText('Leclerc Douai');
  });

  // ──────────────────────────────────────────────────────────────────────────
  test('TC-02 · SP98 complet → feedback succès + formulaire réinitialisé', async ({ page }) => {
    await gotoWithMocks(page);

    // ── Passage en mode SP98 ─────────────────────────────────────────────────
    await page.locator('#typeToggle .type-row-primary .type-btn').nth(1).click();

    // SP98 actif, E85 inactif
    await expect(page.locator('#typeToggle .type-row-primary .type-btn').nth(1))
      .toHaveClass(/active/);
    await expect(page.locator('#typeToggle .type-row-primary .type-btn').first())
      .not.toHaveClass(/active/);
    // Le libellé du champ prix doit mentionner SP98
    await expect(page.locator('#prixLabel')).toContainText('SP98');

    // ── Remplissage SP98 ─────────────────────────────────────────────────────
    // fPrix en dernier : onStationChange() peut appeler applyPricesResult()
    // et écraser la valeur si rempli avant selectOption.
    await page.fill('#fKm',     '12000');
    await page.fill('#fLitres', '30.00');
    await page.selectOption('#stationSel', 'Total Waziers');
    await page.fill('#fPrix',   '2.091');

    // ── Soumission ────────────────────────────────────────────────────────────
    await page.click('#submitBtn');

    // ── Feedback succès ───────────────────────────────────────────────────────
    const feedback = page.locator('#feedback');
    await expect(feedback).toBeVisible({ timeout: 5_000 });
    await expect(feedback).toHaveClass(/success/);

    // ── Réinitialisation ──────────────────────────────────────────────────────
    await expect(page.locator('#fKm')).toHaveValue('',     { timeout: 3_000 });
    await expect(page.locator('#fLitres')).toHaveValue('');
    await expect(page.locator('#fPrix')).toHaveValue('');
    await expect(page.locator('#stationSel')).toHaveValue('');
  });

  // ──────────────────────────────────────────────────────────────────────────
  test('TC-03 · Champs obligatoires manquants → erreur de validation', async ({ page }) => {
    await gotoWithMocks(page);

    // Saisir seulement les km — litres et prix restent vides
    await page.fill('#fKm', '11596');
    await page.click('#submitBtn');

    const feedback = page.locator('#feedback');
    await expect(feedback).toBeVisible();
    await expect(feedback).toHaveClass(/error/);
    await expect(feedback.locator('strong')).toContainText('Champs manquants');

    // Le formulaire NE DOIT PAS être réinitialisé après une erreur de validation
    await expect(page.locator('#fKm')).toHaveValue('11596');
  });

  // ──────────────────────────────────────────────────────────────────────────
  test('TC-04 · Station non sélectionnée → erreur de validation', async ({ page }) => {
    await gotoWithMocks(page);

    // Remplir tous les champs requis sauf la station
    await page.fill('#fKm',     '11596');
    await page.fill('#fLitres', '14.90');
    await page.fill('#fPrix',   '0.798');
    // Ne pas sélectionner de station

    await page.click('#submitBtn');

    const feedback = page.locator('#feedback');
    await expect(feedback).toBeVisible();
    await expect(feedback).toHaveClass(/error/);
    await expect(feedback.locator('strong')).toContainText('Station manquante');
  });

  // ──────────────────────────────────────────────────────────────────────────
  test('TC-05 · Erreur GAS → feedback erreur serveur + champs conservés', async ({ page }) => {
    await gotoWithMocks(page, { gasReponse: GAS_ERROR });

    await fillFormE85(page);
    await page.click('#submitBtn');

    const feedback = page.locator('#feedback');
    await expect(feedback).toBeVisible({ timeout: 5_000 });
    await expect(feedback).toHaveClass(/error/);
    await expect(feedback.locator('strong')).toContainText('Erreur serveur');
    await expect(feedback).toContainText('Quota dépassé');

    // Les champs DOIVENT être conservés après une erreur serveur
    await expect(page.locator('#fKm')).toHaveValue('11596');
    await expect(page.locator('#fLitres')).toHaveValue('14.90');
  });

});
