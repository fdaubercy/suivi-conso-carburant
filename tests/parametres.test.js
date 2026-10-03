// @vitest-environment jsdom
/**
 * Tests — js/parametres.js (périmètre de synchro)
 * W91d : la map des coûts de conversion par véhicule (conversion_veh) fait
 * partie des clés métier synchronisées.
 */
import { describe, it, expect, vi } from 'vitest';

vi.mock('../js/auth.js', () => ({
  getIdToken: () => '', isAuthed: () => true, authEnabled: () => false,
  getUser: () => null, signOut: () => {},
}));

import { PARAM_CLES, LOCAL_TO_CLE, syncParametres } from '../js/parametres.js';

describe('périmètre de synchro des paramètres', () => {
  it('inclut conversion_veh (W91d)', () => {
    expect(PARAM_CLES).toContain('conversion_veh');
  });
  it('mappe la clé localStorage suivi_e85_conversion_veh → conversion_veh', () => {
    expect(LOCAL_TO_CLE['suivi_e85_conversion_veh']).toBe('conversion_veh');
  });
});

describe('clé « vehicules » (liste commune à tous les appareils)', () => {
  it('fait partie du périmètre et mappe le tampon local suivi_e85_vehicules_sync', () => {
    expect(PARAM_CLES).toContain('vehicules');
    expect(LOCAL_TO_CLE['suivi_e85_vehicules_sync']).toBe('vehicules');
  });

  it('parametres-synced expose les valeurs brutes du serveur (detail.serveur)', async () => {
    const blob = JSON.stringify({ v: 1, actifs: ['Clio'] });
    globalThis.fetch = vi.fn(async () => ({ ok: true, json: async () => ({ params: [{ cle: 'vehicules', valeur: blob, modifie_le: 5 }] }) }));
    const seen = vi.fn();
    window.addEventListener('parametres-synced', e => seen(e.detail));
    const changed = await syncParametres();
    expect(changed).toContain('vehicules');
    expect(seen).toHaveBeenCalledWith(expect.objectContaining({ serveur: expect.objectContaining({ vehicules: blob }) }));
    expect(localStorage.getItem('suivi_e85_vehicules_sync')).toBe(blob);
  });
});
