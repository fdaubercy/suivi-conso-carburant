// @vitest-environment jsdom
/**
 * Tests — W60 : prix historique (_PrixHistory) à la saisie d'un plein passé.
 *   • resolveHistPrice() : prix station ce jour-là → relevé le plus proche avant
 *     → repli secteur ;
 *   • applyHistPriceToForm() : effets sur le formulaire (champ prix + note),
 *     retour à la date du jour, carburant non suivi.
 * Déterministe : fetch mocké, dates relatives à aujourd'hui.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { state } from '../js/state.js';
import { loadSectorPrices, resolveHistPrice, applyHistPriceToForm } from '../js/secteur.js';

function iso(d) {
  return d.getFullYear() + '-' +
    String(d.getMonth() + 1).padStart(2, '0') + '-' +
    String(d.getDate()).padStart(2, '0');
}
const TODAY    = new Date();
const dMinus   = n => { const d = new Date(TODAY); d.setDate(d.getDate() - n); return iso(d); };
const D_OLD    = dMinus(18);   // relevé le plus ancien
const D_MID    = dMinus(15);   // sans relevé (→ nearest-prior = D_OLD)
const D_RECENT = dMinus(14);   // relevé station exact

const SECTOR_E85 = {
  fuel: 'E85',
  byDate: { [D_OLD]: 0.712, [D_RECENT]: 0.709 },
  byStationDate: { 'Leclerc Douai': { [D_OLD]: 0.699, [D_RECENT]: 0.689 } },
  today: { station: 'Leclerc Douai', prix: 0.695, date: iso(TODAY) },
};

beforeEach(() => {
  localStorage.clear();
  state.currentType = 'E85';
  state._stationPrices = {};
  state._histPriceApplied = false;
  globalThis.fetch = vi.fn(async () => ({ ok: true, json: async () => SECTOR_E85 }));
});

describe('resolveHistPrice (W60)', () => {
  it('prix exact de la station à la date choisie', async () => {
    await loadSectorPrices('E85');
    expect(resolveHistPrice('Leclerc Douai', D_RECENT, 'E85'))
      .toMatchObject({ prix: 0.689, date: D_RECENT, exact: true, scope: 'station' });
  });

  it('relevé station le plus proche AVANT si pas de relevé ce jour-là', async () => {
    await loadSectorPrices('E85');
    expect(resolveHistPrice('Leclerc Douai', D_MID, 'E85'))
      .toMatchObject({ prix: 0.699, date: D_OLD, exact: false, scope: 'station' });
  });

  it('repli sur le mini secteur si la station est inconnue', async () => {
    await loadSectorPrices('E85');
    expect(resolveHistPrice('Stat Inconnue', D_MID, 'E85'))
      .toMatchObject({ prix: 0.712, date: D_OLD, exact: false, scope: 'secteur' });
  });

  it('null si la date précède tout relevé', async () => {
    await loadSectorPrices('E85');
    expect(resolveHistPrice('Leclerc Douai', dMinus(999), 'E85')).toBeNull();
  });
});

describe('applyHistPriceToForm (W60)', () => {
  function setupDom() {
    document.body.innerHTML = `
      <input id="fDate"><input id="fPrix"><input id="fLitres">
      <select id="stationSel">
        <option value="">—</option><option value="__autre">manuel</option>
      </select>
      <input id="fAutre">
      <div id="coutBox"><span id="coutVal"></span></div>
      <div class="hist-note" id="histNote" hidden></div>`;
  }

  it('date passée + station connue → prix station + note verte', async () => {
    setupDom();
    document.getElementById('stationSel').value = '__autre';
    document.getElementById('fAutre').value = 'Leclerc Douai';
    document.getElementById('fDate').value = D_RECENT;

    await applyHistPriceToForm();

    expect(document.getElementById('fPrix').value).toBe('0.689');
    const note = document.getElementById('histNote');
    expect(note.hidden).toBe(false);
    expect(note.className).toContain('ok');
    expect(note.textContent).toContain('Leclerc Douai');
    expect(state._histPriceApplied).toBe(true);
  });

  it('date passée sans station connue → repli secteur (note)', async () => {
    setupDom();
    document.getElementById('fDate').value = D_MID;     // aucune station sélectionnée

    await applyHistPriceToForm();

    expect(document.getElementById('fPrix').value).toBe('0.712');
    expect(document.getElementById('histNote').textContent).toContain('secteur');
  });

  it('retour à la date du jour → note effacée + prix live restauré', async () => {
    setupDom();
    state._histPriceApplied = true;
    state._stationPrices = { E85: 0.799 };
    document.getElementById('fDate').value = iso(TODAY);

    await applyHistPriceToForm();

    expect(document.getElementById('histNote').hidden).toBe(true);
    expect(document.getElementById('fPrix').value).toBe('0.799');
    expect(state._histPriceApplied).toBe(false);
  });

  it('carburant non suivi (SP95) en date passée → note info, prix du jour conservé', async () => {
    setupDom();
    state.currentType = 'SP95';
    document.getElementById('fPrix').value = '1.880';
    document.getElementById('fDate').value = D_RECENT;

    await applyHistPriceToForm();

    expect(document.getElementById('histNote').className).toContain('info');
    expect(document.getElementById('fPrix').value).toBe('1.880');   // inchangé
  });
});
