// @vitest-environment jsdom
/**
 * Tests — js/itineraire.js (T6)
 * Popup « renseignements station » + liens d'itinéraire Waze / Google Maps.
 * Environnement jsdom : document, body, événements clavier.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { showStationPopup } from '../js/itineraire.js';
import { state } from '../js/state.js';

const BASE = { name: 'Carrefour - Douai', lat: 50.37, lon: 3.08 };

beforeEach(() => {
  document.body.innerHTML = '';
  state.userLat = null;
  state.userLon = null;
});

afterEach(() => {
  // Ferme toute popup résiduelle (Escape) pour ne pas fuiter entre tests.
  document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
});

describe('showStationPopup', () => {
  it('crée une overlay avec le nom de la station', () => {
    showStationPopup(BASE);
    const overlay = document.querySelector('.stpop-overlay');
    expect(overlay).not.toBeNull();
    expect(overlay.querySelector('.stpop-title').textContent).toBe('Carrefour - Douai');
  });

  it('génère les liens Waze et Google Maps avec lat/lon', () => {
    showStationPopup(BASE);
    const waze  = document.querySelector('.stpop-waze');
    const gmaps = document.querySelector('.stpop-gmaps');
    expect(waze.getAttribute('href')).toBe('https://waze.com/ul?ll=50.37,3.08&navigate=yes');
    expect(gmaps.getAttribute('href')).toBe('https://www.google.com/maps/dir/?api=1&destination=50.37,3.08');
  });

  it('affiche le libellé prix quand fourni', () => {
    showStationPopup({ ...BASE, priceLabel: 'E85 moy. 0.799 €/L' });
    expect(document.querySelector('.stpop-info').textContent).toContain('0.799 €/L');
  });

  it('échappe le HTML du nom de station (anti-injection)', () => {
    showStationPopup({ ...BASE, name: '<img src=x onerror=alert(1)>' });
    const title = document.querySelector('.stpop-title');
    expect(title.querySelector('img')).toBeNull();
    expect(title.textContent).toContain('<img');
  });

  it('calcule la distance depuis la position utilisateur si non fournie', () => {
    state.userLat = 50.36; state.userLon = 3.07;   // ~tout proche de la station
    showStationPopup(BASE);
    const info = document.querySelector('.stpop-info').textContent;
    expect(info).toMatch(/\d+(\.\d+)?\s?(m|km)/);   // une distance est rendue
  });

  it('ne fait rien si les coordonnées sont absentes', () => {
    showStationPopup({ name: 'Sans coords' });
    expect(document.querySelector('.stpop-overlay')).toBeNull();
    showStationPopup({ name: 'lat seule', lat: 50 });
    expect(document.querySelector('.stpop-overlay')).toBeNull();
  });

  it('ferme la popup sur la touche Échap', () => {
    showStationPopup(BASE);
    expect(document.querySelector('.stpop-overlay')).not.toBeNull();
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    expect(document.querySelector('.stpop-overlay')).toBeNull();
  });

  it('ferme la popup au clic sur le fond (overlay)', () => {
    showStationPopup(BASE);
    const overlay = document.querySelector('.stpop-overlay');
    overlay.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(document.querySelector('.stpop-overlay')).toBeNull();
  });

  it('ferme la popup au clic sur le bouton de fermeture ×', () => {
    showStationPopup(BASE);
    document.querySelector('.stpop-x').dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(document.querySelector('.stpop-overlay')).toBeNull();
  });

  it('remplace une popup existante au lieu d\'en empiler plusieurs', () => {
    showStationPopup(BASE);
    showStationPopup({ ...BASE, name: 'Autre station' });
    const overlays = document.querySelectorAll('.stpop-overlay');
    expect(overlays.length).toBe(1);
    expect(overlays[0].querySelector('.stpop-title').textContent).toBe('Autre station');
  });
});
