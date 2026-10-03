// @vitest-environment jsdom
/**
 * Tests — W93 : rendu du badge « économie vs SP98 » dans l'historique
 * (chargerHistorique réel + fetch GAS simulé + provider injecté comme main.js).
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { chargerHistorique, setEcoProvider } from '../js/historique.js';
import { computeEcoByFill } from '../js/statsParams.js';

const E85 = 'SuperEthanol E85';
const recs = [
  { Horodatage: '2026-09-25 20:59:19', Date: '2026-09-25', 'Véhicule': 'Z900', Type: E85,
    'Km compteur': 19253, 'Nb. Litres': 16.08, 'Prix €/L': 0.846, 'SP98 station (€/L)': 2.211, sync_id: 'a' },
  { Horodatage: '2026-09-10 10:37:17', Date: '2026-09-10', 'Véhicule': 'Z900', Type: 'Super 98',
    'Km compteur': 18157, 'Nb. Litres': 5.03, 'Prix €/L': 1.99, 'SP98 station (€/L)': 1.99, sync_id: 'b' },
  { Horodatage: '2026-10-02 08:00:00', Date: '2026-10-02', 'Véhicule': 'Autre', Type: E85,
    'Km compteur': 500, 'Nb. Litres': 40, 'Prix €/L': 1.7, 'SP98 station (€/L)': 1.75, sync_id: 'c' },
];

beforeEach(() => {
  localStorage.clear();
  localStorage.setItem('suivi_e85_surconso', '0.25');
  document.body.innerHTML = '<div id="historiqueList"></div>';
  vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, json: async () => ({ records: recs, deleted: [] }) })));
  setEcoProvider(computeEcoByFill);
});
afterEach(() => { vi.unstubAllGlobals(); setEcoProvider(null); });

const badgeOf = sid =>
  document.querySelector(`#historiqueList .hist-item[data-sync-id="${sid}"] .hist-eco`);

describe('historique — badge économie par plein (W93)', () => {
  it('affiche l\'économie positive d\'un plein E85, en vert', async () => {
    await chargerHistorique();
    const b = badgeOf('a');
    expect(b).not.toBeNull();
    expect(b.classList.contains('pos')).toBe(true);
    // 16,08 / 1,25 × 2,211 − 16,08 × 0,846 = 14,84 €
    expect(b.textContent).toContain('+14,84 € vs SP98');
  });

  it('n\'affiche rien sur un plein SP98', async () => {
    await chargerHistorique();
    expect(badgeOf('b')).toBeNull();
  });

  it('affiche un surcoût en rouge quand l\'E85 ne rapporte pas', async () => {
    await chargerHistorique();
    const b = badgeOf('c');
    expect(b.classList.contains('neg')).toBe(true);
    expect(b.textContent).toContain('−12,00 € vs SP98');   // 40/1,25×1,75 − 68
  });

  it('sans provider injecté, aucun badge (pas de régression)', async () => {
    setEcoProvider(null);
    await chargerHistorique();
    expect(document.querySelectorAll('.hist-eco').length).toBe(0);
  });
});
