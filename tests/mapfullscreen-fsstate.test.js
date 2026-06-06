// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { setFsButtonState } from '../js/mapfullscreen.js';

describe('setFsButtonState — préserve le libellé des boutons relabellisés', () => {
  it('bouton avec spans : met à jour icône + libellé, conserve la structure', () => {
    const b = document.createElement('button');
    b.innerHTML = '<span class="mfs-ico">⛶</span><span class="mfs-lbl">Plein écran</span>';
    setFsButtonState(b, '✕', 'Quitter', 'Quitter le plein écran');
    expect(b.querySelector('.mfs-ico').textContent).toBe('✕');
    expect(b.querySelector('.mfs-lbl').textContent).toBe('Quitter');
    expect(b.getAttribute('aria-label')).toBe('Quitter le plein écran');
    expect(b.title).toBe('Quitter le plein écran');
  });

  it('bouton icône-seule (injecté .card-fs-btn) : repli sur textContent, pas de libellé', () => {
    const b = document.createElement('button'); // pas de spans
    setFsButtonState(b, '✕', 'Quitter', 'Quitter le plein écran');
    expect(b.textContent).toBe('✕');
    expect(b.getAttribute('aria-label')).toBe('Quitter le plein écran');
  });
});
