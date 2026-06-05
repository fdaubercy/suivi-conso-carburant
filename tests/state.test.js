/**
 * Tests — js/state.js (W72)
 * État global partagé : valeurs par défaut + mutabilité par référence unique.
 */
import { describe, it, expect } from 'vitest';
import { state } from '../js/state.js';

describe('state — état global de l’app', () => {
  it('expose les valeurs scalaires par défaut attendues', () => {
    expect(state.currentType).toBe('E85');
    expect(state.userLat).toBeNull();
    expect(state.userLon).toBeNull();
    expect(state.currentVehiculeNom).toBe('');
    expect(state.searchRadiusM).toBe(5000);
    expect(state._selectedLat).toBeNull();
    expect(state._selectedLon).toBeNull();
    expect(state._ticketPhoto).toBeNull();
  });

  it('initialise les collections (tableaux vides + objet prix vide)', () => {
    expect(Array.isArray(state._nearbyStations)).toBe(true);
    expect(state._nearbyStations).toHaveLength(0);
    expect(Array.isArray(state._geoStations)).toBe(true);
    expect(Array.isArray(state._mapStations)).toBe(true);
    expect(state._stationPrices).toEqual({});
  });

  it('est mutable et partagé par référence', () => {
    const ref = state;
    state.currentType = 'SP98';
    state.searchRadiusM = 1000;
    expect(ref.currentType).toBe('SP98');
    expect(ref.searchRadiusM).toBe(1000);
    // restauration des valeurs par défaut pour l’isolation intra-fichier
    state.currentType = 'E85';
    state.searchRadiusM = 5000;
  });
});
