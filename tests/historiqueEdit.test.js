// @vitest-environment jsdom
/**
 * Tests — js/historique.js (W92) : déclencheur d'édition d'un plein.
 * Vérifie le câblage `initHistoireEdit` : bouton ✏️, tap/clic sur la ligne,
 * neutralisation du clic « fantôme » post-swipe, et fermeture du tiroir ouvert.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { initHistoireEdit } from '../js/historique.js';

function itemHTML(rowKey, syncId) {
  return `
    <div class="hist-item" data-sync-id="${syncId}" data-row-key="${rowKey}">
      <div class="hist-drawer">
        <button class="hist-edit" type="button">✏️</button>
        <button class="hist-share" type="button">📤</button>
        <button class="hist-delete" type="button">🗑️</button>
      </div>
      <div class="hist-swipe-content" role="button" tabindex="0">
        <div class="hist-row1"><span class="hist-date">30/05/2026</span></div>
      </div>
    </div>`;
}

function setup() {
  document.body.innerHTML = `
    <div id="historiqueList">${itemHTML('k1', 's1')}</div>
    <div id="histoireFullList">${itemHTML('k2', 's2')}</div>`;
  const events = [];
  window.addEventListener('plein-edit-request', e => events.push(e.detail));
  initHistoireEdit();
  return events;
}

function click(el) { el.dispatchEvent(new window.MouseEvent('click', { bubbles: true })); }

describe('initHistoireEdit — déclencheur d\'édition (W92)', () => {
  beforeEach(() => { document.body.innerHTML = ''; });

  it('un tap/clic sur le corps de la ligne émet plein-edit-request avec le rowKey', () => {
    const events = setup();
    click(document.querySelector('#historiqueList .hist-swipe-content'));
    expect(events).toEqual([{ rowKey: 'k1' }]);
  });

  it('le bouton ✏️ Modifier émet aussi la demande d\'édition', () => {
    const events = setup();
    click(document.querySelector('#historiqueList .hist-edit'));
    expect(events).toEqual([{ rowKey: 'k1' }]);
  });

  it('fonctionne aussi sur la liste de l\'historique complet', () => {
    const events = setup();
    click(document.querySelector('#histoireFullList .hist-swipe-content'));
    expect(events).toEqual([{ rowKey: 'k2' }]);
  });

  it('ignore le clic « fantôme » qui suit un swipe (data-swiped=1) et remet le drapeau à zéro', () => {
    const events = setup();
    const item = document.querySelector('#historiqueList .hist-item');
    item.dataset.swiped = '1';
    click(item.querySelector('.hist-swipe-content'));
    expect(events).toHaveLength(0);
    expect(item.dataset.swiped).toBe('');   // drapeau consommé
  });

  it('quand le tiroir est ouvert, le tap le referme au lieu d\'éditer', () => {
    const events = setup();
    const item = document.querySelector('#historiqueList .hist-item');
    item.classList.add('open');
    click(item.querySelector('.hist-swipe-content'));
    expect(events).toHaveLength(0);
    expect(item.classList.contains('open')).toBe(false);
  });

  it('la touche Entrée sur la ligne émet la demande d\'édition (accès clavier)', () => {
    const events = setup();
    const content = document.querySelector('#historiqueList .hist-swipe-content');
    content.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    expect(events).toEqual([{ rowKey: 'k1' }]);
  });
});
