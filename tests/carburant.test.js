// @vitest-environment jsdom
/**
 * Tests — js/carburant.js (W72)
 * Toggle type de carburant (HTML), badges header, setType, délégation de clic.
 * ui.js et secteur.js sont mockés (dépendances DOM / chaînées).
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('../js/ui.js', () => ({ setFieldPrice: vi.fn(), computeTriplet: vi.fn() }));
vi.mock('../js/secteur.js', () => ({ applyHistPriceToForm: vi.fn() }));

import {
  _buildTypeToggle, _updateHeaderBadges, setType, initTypeToggle, registerPriceCallback,
} from '../js/carburant.js';
import { state } from '../js/state.js';

beforeEach(() => {
  state.currentType   = 'E85';
  state._stationPrices = {};
  document.body.innerHTML = `
    <div id="typeToggle"></div>
    <div id="headerOtherFuels">x</div>
    <span id="headerBadge"></span>
    <label id="prixLabel"></label>
    <input id="fPrix">
    <select id="stationSel"><option value=""></option></select>`;
});

describe('_buildTypeToggle', () => {
  it('rend 2 boutons primaires (E85/SP98) + 4 secondaires = 6 data-fuel-key', () => {
    _buildTypeToggle({});
    const wrap = document.getElementById('typeToggle');
    expect(wrap.querySelectorAll('.type-btn').length).toBe(2);
    expect(wrap.querySelectorAll('.type-btn-sm').length).toBe(4);
    expect(wrap.querySelectorAll('[data-fuel-key]').length).toBe(6);
  });

  it('marque le carburant courant comme actif', () => {
    state.currentType = 'SP98';
    _buildTypeToggle({});
    expect(document.querySelector('.type-btn.active').dataset.fuelKey).toBe('SP98');
  });

  it('affiche le prix à 3 décimales quand il est fourni', () => {
    _buildTypeToggle({ E85: 0.798 });
    expect(document.getElementById('typeToggle').innerHTML).toContain('0.798 €/L');
  });

  it('grise (dimmed) les carburants sans prix quand d’autres en ont', () => {
    _buildTypeToggle({ E85: 0.798 });
    expect(document.querySelector('[data-fuel-key="SP98"]').classList.contains('dimmed')).toBe(true);
    expect(document.querySelector('[data-fuel-key="E85"]').classList.contains('dimmed')).toBe(false);
  });

  it('ne grise rien quand aucun prix n’est connu', () => {
    _buildTypeToggle({});
    expect(document.querySelector('.dimmed')).toBeNull();
  });

  it('ne plante pas si #typeToggle est absent', () => {
    document.getElementById('typeToggle').remove();
    expect(() => _buildTypeToggle({ E85: 0.798 })).not.toThrow();
  });
});

describe('_updateHeaderBadges', () => {
  it('vide #headerOtherFuels', () => {
    _updateHeaderBadges();
    expect(document.getElementById('headerOtherFuels').innerHTML).toBe('');
  });
});

describe('setType', () => {
  it('met à jour le type courant, le badge header et le label prix', () => {
    setType('GAZOLE');
    expect(state.currentType).toBe('GAZOLE');
    expect(document.getElementById('headerBadge').textContent).toContain('Gazole');
    expect(document.getElementById('prixLabel').textContent).toContain('Gazole');
  });

  it('ignore un type de carburant inconnu', () => {
    setType('INVALID');
    expect(state.currentType).toBe('E85');
  });
});

describe('initTypeToggle — délégation de clic', () => {
  it('un clic sur un bouton sélectionne le carburant correspondant', () => {
    _buildTypeToggle({});
    initTypeToggle();
    document.querySelector('[data-fuel-key="SP98"]').click();
    expect(state.currentType).toBe('SP98');
  });
});

describe('registerPriceCallback', () => {
  it('le callback est appelé quand une station est choisie sans prix en cache', () => {
    const cb = vi.fn();
    registerPriceCallback(cb);
    const sel = document.getElementById('stationSel');
    sel.innerHTML = '<option value="Total - Lyon">Total</option>';
    sel.value = 'Total - Lyon';
    setType('E10');
    expect(cb).toHaveBeenCalledTimes(1);
  });
});
