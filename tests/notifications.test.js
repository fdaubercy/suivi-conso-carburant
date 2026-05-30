// @vitest-environment jsdom
/**
 * Tests — js/notifications.js (T6)
 * Alertes prix par carburant : seuils, activation, déclenchement foreground.
 * Notification est mockée ; localStorage est fourni par jsdom.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';

// ─── Mock de l'API Notification (jsdom ne la fournit pas) ────────────────
class MockNotification {
  constructor(title, opts) { MockNotification.calls.push({ title, opts }); }
}
MockNotification.calls = [];
MockNotification.permission = 'granted';
MockNotification.requestPermission = vi.fn(async () => 'granted');

beforeEach(() => {
  localStorage.clear();
  MockNotification.calls = [];
  MockNotification.permission = 'granted';
  window.Notification = MockNotification;
  global.Notification = MockNotification;
});

// Import après installation du mock (le module lit `Notification` à l'exécution).
import {
  ALERT_FUELS, getSeuil, setSeuil, isEnabled, isAnyEnabled,
  isSupported, checkPrixAlert, checkPrixE85Alert,
} from '../js/notifications.js';

const KEY_EN = f => `notif_${f}_enabled`;

describe('ALERT_FUELS', () => {
  it('expose E85, Gazole et SP98 avec un seuil par défaut', () => {
    const keys = ALERT_FUELS.map(f => f.key);
    expect(keys).toEqual(['E85', 'GAZOLE', 'SP98']);
    ALERT_FUELS.forEach(f => expect(f.def).toBeGreaterThan(0));
  });
});

describe('getSeuil / setSeuil', () => {
  it('retourne le seuil par défaut quand rien n\'est stocké', () => {
    expect(getSeuil('E85')).toBe(0.850);
    expect(getSeuil('GAZOLE')).toBe(1.600);
  });

  it('stocke et relit une valeur valide (3 décimales)', () => {
    setSeuil('E85', '0.799');
    expect(getSeuil('E85')).toBeCloseTo(0.799, 3);
    expect(localStorage.getItem('notif_E85_seuil')).toBe('0.799');
  });

  it('rejette une valeur hors bornes (≤ 0 ou ≥ 3.5)', () => {
    setSeuil('E85', '0');
    expect(localStorage.getItem('notif_E85_seuil')).toBeNull();
    setSeuil('E85', '4');
    expect(localStorage.getItem('notif_E85_seuil')).toBeNull();
    setSeuil('E85', 'abc');
    expect(localStorage.getItem('notif_E85_seuil')).toBeNull();
  });
});

describe('isEnabled / isAnyEnabled', () => {
  it('est faux par défaut', () => {
    expect(isEnabled('E85')).toBe(false);
    expect(isAnyEnabled()).toBe(false);
  });

  it('reflète le flag localStorage', () => {
    localStorage.setItem(KEY_EN('GAZOLE'), '1');
    expect(isEnabled('GAZOLE')).toBe(true);
    expect(isEnabled('E85')).toBe(false);
    expect(isAnyEnabled()).toBe(true);
  });

  it('isSupported est vrai quand Notification existe et hors iOS browser', () => {
    expect(isSupported()).toBe(true);
  });
});

describe('checkPrixAlert (foreground)', () => {
  beforeEach(() => { localStorage.setItem(KEY_EN('E85'), '1'); });   // E85 activé

  it('déclenche une notification quand le prix est sous le seuil', () => {
    checkPrixAlert('E85', 0.799, 'Carrefour - Douai');
    expect(MockNotification.calls.length).toBe(1);
    expect(MockNotification.calls[0].title).toContain('E85');
    expect(MockNotification.calls[0].opts.tag).toBe('price-alert-E85');
  });

  it('ne déclenche rien quand le prix est au-dessus du seuil', () => {
    checkPrixAlert('E85', 0.999, 'Station');
    expect(MockNotification.calls.length).toBe(0);
  });

  it('ne déclenche rien pour un carburant désactivé', () => {
    checkPrixAlert('GAZOLE', 1.0, 'Station');   // Gazole non activé
    expect(MockNotification.calls.length).toBe(0);
  });

  it('ne déclenche rien si la permission n\'est pas accordée', () => {
    MockNotification.permission = 'denied';
    checkPrixAlert('E85', 0.5, 'Station');
    expect(MockNotification.calls.length).toBe(0);
  });

  it('ignore un prix invalide ou nul', () => {
    checkPrixAlert('E85', 0, 'Station');
    checkPrixAlert('E85', NaN, 'Station');
    expect(MockNotification.calls.length).toBe(0);
  });

  it('checkPrixE85Alert délègue sur le carburant E85', () => {
    checkPrixE85Alert(0.799, 'Station');
    expect(MockNotification.calls.length).toBe(1);
    expect(MockNotification.calls[0].opts.tag).toBe('price-alert-E85');
  });
});
