/**
 * E2E Playwright — W60 : rendu du prix historique à la saisie (date passée).
 *
 * NB : le déclenchement par le listener #fDate dépend de l'init complète de
 * l'app, qui n'aboutit pas en headless (limitation préexistante : la suite
 * e2e.spec.js échoue au même stade). On exerce donc la VRAIE fonction du
 * module (applyHistPriceToForm) sur la VRAIE page + CSS, ce qui valide le
 * rendu (champ prix + note) et produit la capture. La logique pure est par
 * ailleurs couverte de façon déterministe par tests/prix-historique.test.js.
 */
import { test, expect } from '@playwright/test';

function iso(d) {
  return d.getFullYear() + '-' +
    String(d.getMonth() + 1).padStart(2, '0') + '-' +
    String(d.getDate()).padStart(2, '0');
}
function frShort(s) { const [, m, j] = s.split('-'); return j + '/' + m; }
const TODAY    = new Date();
const dMinus   = n => { const d = new Date(TODAY); d.setDate(d.getDate() - n); return iso(d); };
const D_OLD    = dMinus(18);
const D_RECENT = dMinus(14);

const SECTOR_CACHE = JSON.stringify({
  byDate: { [D_OLD]: 0.712, [D_RECENT]: 0.709 },
  byStationDate: { 'Leclerc Douai': { [D_OLD]: 0.699, [D_RECENT]: 0.689 } },
  today: { station: 'Leclerc Douai', prix: 0.695, date: iso(TODAY) },
  ts: Date.now(),
});

async function gotoSaisie(page) {
  // Pré-injecte le cache _PrixHistory AVANT le chargement (lu par secteur.js).
  await page.addInitScript(([k, v]) => localStorage.setItem(k, v), ['suivi_e85_sector_cache', SECTOR_CACHE]);
  await page.route('https://script.google.com/**', r => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ records: [] }) }));
  await page.route('https://data.economie.gouv.fr/**', r => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ results: [] }) }));
  await page.route('https://docs.google.com/**', r => r.abort());
  await page.route('https://overpass-api.de/**', r => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ elements: [] }) }));

  await page.goto('/');
  await page.waitForLoadState('networkidle');
  // L'init du routeur peut être encore en cours : on (re)pose le hash jusqu'à
  // ce que la vue Saisie soit réellement affichée (robuste à la course d'init).
  await expect.poll(async () => {
    await page.evaluate(() => { window.location.hash = '#/saisie'; });
    return page.locator('#fDate').isVisible();
  }, { timeout: 15_000, intervals: [200, 300, 500] }).toBe(true);
}

/** Renseigne le formulaire pour une date passée + station, puis applique le prix historique. */
async function applyPast(page, { date, station, km = '', litres = '' }) {
  return page.evaluate(async (o) => {
    document.getElementById('fKm').value = o.km;
    document.getElementById('fLitres').value = o.litres;
    document.getElementById('fDate').value = o.date;
    if (o.station) {
      document.getElementById('stationSel').value = '__autre';
      document.getElementById('autreField')?.classList.remove('hidden');
      document.getElementById('fAutre').value = o.station;
    }
    const mod = await import('/js/secteur.js');
    await mod.applyHistPriceToForm();
  }, { date, station, km, litres });
}

test.describe('W60 — Prix historique à la saisie (date passée)', () => {

  test('date passée + station connue → prix de la station ce jour-là + note', async ({ page }) => {
    await gotoSaisie(page);
    await applyPast(page, { date: D_RECENT, station: 'Leclerc Douai', km: '12500', litres: '40' });

    await expect(page.locator('#fPrix')).toHaveValue('0.689');     // prix station, pas le mini secteur (0.709)
    const note = page.locator('#histNote');
    await expect(note).toBeVisible();
    await expect(note).toHaveClass(/ok/);
    await expect(note).toContainText('Leclerc Douai');
    await expect(note).toContainText(frShort(D_RECENT));

    // Masque la barre d'action fixe (sinon elle recouvre la note) avant la capture.
    await page.evaluate(() => {
      document.querySelector('.submit-wrap')?.style.setProperty('display', 'none');
      document.getElementById('histNote')?.scrollIntoView({ block: 'center' });
    });
    await page.locator('.card', { has: page.locator('#fPrix') }).screenshot({ path: 'playwright-report/w60-prix-historique.png' });
  });

  test('date sans relevé station → relevé le plus proche avant (repli secteur)', async ({ page }) => {
    await gotoSaisie(page);
    await applyPast(page, { date: dMinus(15), station: 'Station Inconnue' });

    await expect(page.locator('#fPrix')).toHaveValue('0.712');     // mini secteur du D_OLD (nearest-prior)
    await expect(page.locator('#histNote')).toContainText('secteur');
    await expect(page.locator('#histNote')).toContainText(frShort(D_OLD));
  });

});
