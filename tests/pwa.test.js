// @vitest-environment jsdom
/**
 * Tests — js/pwa.js (W72)
 * Bannières install/iOS (dismiss), prompt d'installation et smoke d'initPWA.
 * Couverture volontairement ciblée : initPWA pilote des APIs navigateur
 * (Service Worker, beforeinstallprompt, matchMedia) non simulables intégralement.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { dismiss, triggerInstall, initPWA } from '../js/pwa.js';

beforeEach(() => {
  sessionStorage.clear();
  document.body.innerHTML = '<button id="pwaInstallBtn"></button><div id="iosBanner"></div>';
});

describe('dismiss', () => {
  it('masque la bannière iOS et mémorise le rejet en sessionStorage', () => {
    dismiss('iosBanner');
    expect(document.getElementById('iosBanner').hidden).toBe(true);
    expect(sessionStorage.getItem('pwa_ios_dismissed')).toBe('1');
  });
  it('masque un autre élément sans poser le flag iOS', () => {
    dismiss('pwaInstallBtn');
    expect(document.getElementById('pwaInstallBtn').hidden).toBe(true);
    expect(sessionStorage.getItem('pwa_ios_dismissed')).toBeNull();
  });
});

describe('triggerInstall', () => {
  it('ne fait rien (sans throw) tant qu’aucun prompt n’a été différé', () => {
    expect(() => triggerInstall()).not.toThrow();
  });
});

describe('initPWA — smoke', () => {
  let originalMatchMedia;
  beforeEach(() => {
    originalMatchMedia = window.matchMedia;
    window.matchMedia = vi.fn(() => ({ matches: false, addListener: vi.fn(), removeListener: vi.fn() }));
  });
  afterEach(() => { window.matchMedia = originalMatchMedia; });

  it('s’exécute sans Service Worker et expose les hooks window (mode non installé)', () => {
    expect(() => initPWA()).not.toThrow();
    expect(typeof window._pwaInstall).toBe('function');
    expect(typeof window._pwaDismiss).toBe('function');
  });
});
