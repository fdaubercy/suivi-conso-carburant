// @vitest-environment jsdom
/**
 * Tests — js/vehiculesSync.js : liste des véhicules commune à tous les appareils.
 * Fusion par UNION (local ∪ Sheet ∪ déduits des pleins/dépenses), suppressions
 * volontaires horodatées (LWW par nom), sélection automatique sur appareil neuf.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('../js/auth.js', () => ({ authEnabled: () => false, isAuthed: () => true, getIdToken: () => '' }));
vi.mock('../js/parametres.js', () => ({ pushParam: vi.fn() }));

import { state } from '../js/state.js';
import { VEHICULES_KEY, VEHICULES_SYNC_KEY, VEHICULES_META_KEY, LAST_VEHICULE_KEY } from '../js/config.js';
import { pushParam } from '../js/parametres.js';
import { getVehicules } from '../js/vehicules.js';
import {
  fusionnerVehicules, parseVehiculesBlob, vehiculesDeduits, dernierVehiculeUtilise,
  reconcilierVehicules, canonVehicules,
} from '../js/vehiculesSync.js';

const plein = (veh, horo) => ({ 'Véhicule': veh, Horodatage: horo });

beforeEach(() => {
  localStorage.clear();
  state.currentVehiculeNom = '';
  pushParam.mockClear();
  document.body.innerHTML = `
    <select id="vehiculeSel"><optgroup id="vehiculeGroup"><option value="">—</option>
      <option value="__ajouter">+ Ajouter</option></optgroup></select>
    <select id="vehiculeSelGlobal"></select>
    <select id="histVehFilter"></select>`;
});

describe('fusionnerVehicules — union sans perte', () => {
  it('local ∪ distant ∪ déduits, ordre stable (local d’abord), sans doublon', () => {
    const r = fusionnerVehicules([
      { actifs: ['Clio'] },
      { actifs: ['Kangoo', 'Clio'] },
      { actifs: ['Zoé', ' Kangoo '] },
    ]);
    expect(r.actifs).toEqual(['Clio', 'Kangoo', 'Zoé']);
    expect(r.v).toBe(1);
  });

  it('ne perd JAMAIS un véhicule local, distant ou déduit (sans suppression volontaire)', () => {
    const sources = [{ actifs: ['A', 'B'] }, { actifs: ['C'] }, { actifs: ['D', 'A'] }];
    const r = fusionnerVehicules(sources);
    ['A', 'B', 'C', 'D'].forEach(n => expect(r.actifs).toContain(n));
    // commutativité : l'ensemble ne dépend pas de l'ordre des sources
    expect(new Set(fusionnerVehicules([...sources].reverse()).actifs)).toEqual(new Set(r.actifs));
  });

  it('suppression volontaire respectée, même si le véhicule est déduit des pleins', () => {
    const r = fusionnerVehicules([
      { actifs: ['Clio'], supprimes: { Twingo: 2000 } },
      { actifs: ['Clio', 'Twingo'], ajoutes: { Twingo: 1000 } },
      { actifs: ['Twingo'] },                      // déduit (horodatage implicite 0)
    ]);
    expect(r.actifs).toEqual(['Clio']);
    expect(r.supprimes).toEqual({ Twingo: 2000 });
  });

  it('un ré-ajout plus récent annule une suppression plus ancienne (autre appareil)', () => {
    const r = fusionnerVehicules([
      { actifs: [], supprimes: { Twingo: 2000 } },
      { actifs: ['Twingo'], ajoutes: { Twingo: 3000 } },
    ]);
    expect(r.actifs).toEqual(['Twingo']);
  });

  it('parseVehiculesBlob accepte JSON, ancien tableau, et ignore les valeurs invalides', () => {
    expect(parseVehiculesBlob('["Clio"]').actifs).toEqual(['Clio']);
    expect(parseVehiculesBlob('{"actifs":["A"],"supprimes":{"B":5,"C":"x"}}'))
      .toEqual({ actifs: ['A'], ajoutes: {}, supprimes: { B: 5 } });
    expect(parseVehiculesBlob('pas du json')).toEqual({ actifs: [], ajoutes: {}, supprimes: {} });
    expect(parseVehiculesBlob(null).actifs).toEqual([]);
  });

  it('déduction depuis pleins (Véhicule/Vehicule) et dépenses ; dernier véhicule utilisé', () => {
    const pleins = [plein('Clio', '2026-09-01 10:00'), { Vehicule: 'Kangoo', Horodatage: '2026-09-20 08:00' }];
    const deps = [{ vehicule: 'Zoé', modifie_le: 5 }, { vehicule: '' }];
    expect(vehiculesDeduits(pleins, deps).sort()).toEqual(['Clio', 'Kangoo', 'Zoé']);
    expect(dernierVehiculeUtilise(pleins, deps)).toBe('Kangoo');
    expect(dernierVehiculeUtilise([], deps)).toBe('Zoé');
  });
});

describe('reconcilierVehicules — appareil, Sheet et sélection', () => {
  it('appareil NEUF : liste vide + blob serveur → liste, sélecteurs peuplés, véhicule unique sélectionné', () => {
    const onChange = vi.fn();
    window.addEventListener('vehicule-changed', onChange);
    const r = reconcilierVehicules({ serveur: JSON.stringify({ v: 1, actifs: ['Clio'] }) });
    window.removeEventListener('vehicule-changed', onChange);
    expect(r).toMatchObject({ actifs: ['Clio'], changed: true, selected: 'Clio' });
    expect(getVehicules()).toEqual(['Clio']);
    expect(state.currentVehiculeNom).toBe('Clio');
    expect(localStorage.getItem(LAST_VEHICULE_KEY)).toBe('Clio');
    expect([...document.getElementById('vehiculeSelGlobal').options].map(o => o.value)).toEqual(['', 'Clio']);
    expect(onChange).toHaveBeenCalledTimes(1);
  });

  it('appareil neuf, plusieurs véhicules → celui du plein le plus récent', () => {
    const r = reconcilierVehicules({
      pleins: [plein('Clio', '2026-08-01 10:00'), plein('Kangoo', '2026-09-30 10:00')],
      serveur: '{"actifs":["Clio","Kangoo"]}',
    });
    expect(r.selected).toBe('Kangoo');
    expect(state.currentVehiculeNom).toBe('Kangoo');
  });

  it('véhicules déduits des pleins/dépenses ajoutés même sans blob serveur, puis poussés', () => {
    localStorage.setItem(VEHICULES_KEY, JSON.stringify(['Clio']));
    const r = reconcilierVehicules({ pleins: [plein('Kangoo', '2026-09-01')], depenses: [{ vehicule: 'Zoé' }] });
    expect(r.actifs).toEqual(['Clio', 'Kangoo', 'Zoé']);
    expect(pushParam).toHaveBeenCalledWith('vehicules');
    expect(parseVehiculesBlob(localStorage.getItem(VEHICULES_SYNC_KEY)).actifs).toEqual(['Clio', 'Kangoo', 'Zoé']);
  });

  it('serveur déjà à jour → aucun push ; plusieurs véhicules sur appareil déjà équipé → pas de sélection forcée', () => {
    localStorage.setItem(VEHICULES_KEY, JSON.stringify(['Clio', 'Kangoo']));
    const blob = JSON.stringify({ v: 1, actifs: ['Clio', 'Kangoo'], ajoutes: {}, supprimes: {} });
    localStorage.setItem(VEHICULES_SYNC_KEY, blob);
    const r = reconcilierVehicules({ serveur: blob });
    expect(r.pushed).toBe(false);
    expect(pushParam).not.toHaveBeenCalled();
    expect(r.selected).toBe('');
    expect(state.currentVehiculeNom).toBe('');
  });

  it('le local n’est jamais réduit par un blob serveur plus pauvre', () => {
    localStorage.setItem(VEHICULES_KEY, JSON.stringify(['Clio', 'Kangoo']));
    const r = reconcilierVehicules({ serveur: '{"actifs":["Zoé"]}' });
    expect(r.actifs).toEqual(['Clio', 'Kangoo', 'Zoé']);
    expect(pushParam).toHaveBeenCalledWith('vehicules');
  });

  it('suppression volontaire sur un autre appareil : retirée ici et désélectionnée', () => {
    localStorage.setItem(VEHICULES_KEY, JSON.stringify(['Clio', 'Twingo']));
    state.currentVehiculeNom = 'Twingo';
    const r = reconcilierVehicules({
      pleins: [plein('Twingo', '2026-01-01')],
      serveur: JSON.stringify({ actifs: ['Clio'], supprimes: { Twingo: Date.now() } }),
    });
    expect(r.actifs).toEqual(['Clio']);
    expect(state.currentVehiculeNom).toBe('Clio');   // désélection, puis seul véhicule restant
    expect(JSON.parse(localStorage.getItem(VEHICULES_META_KEY)).supprimes.Twingo).toBeGreaterThan(0);
  });

  it('canonVehicules ignore l’ordre', () => {
    expect(canonVehicules({ actifs: ['B', 'A'] })).toBe(canonVehicules('["A","B"]'));
  });
});
