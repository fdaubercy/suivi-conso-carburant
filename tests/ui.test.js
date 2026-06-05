// @vitest-environment jsdom
/**
 * Tests — js/ui.js (W72)
 * Helpers DOM : statuts, feedback, calcul DOM du triplet, prix auto-rempli.
 * (calcTriplet — fonction pure — est déjà couvert par tests/cout.test.js.)
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  computeTriplet, setFieldPrice, showFeedback,
  setGeoStatus, setS98Status, setAutreStatus, setVehiculeStatus,
  showCpSearch, hideCpSearch, setSubmitState,
} from '../js/ui.js';

beforeEach(() => {
  document.body.innerHTML = `
    <input id="fLitres"><input id="fCout"><input id="fPrix">
    <div id="geoStatus"></div><div id="s98Status"></div>
    <div id="autreStatus"></div><div id="vehiculeStatus"></div>
    <div id="cpSearch" class="hidden"></div><input id="fCp">
    <button id="submitBtn"></button><span id="submitIcon"></span><span id="submitText"></span>
    <div id="feedback"></div>`;
  // scrollIntoView n'est pas implémenté par jsdom
  Element.prototype.scrollIntoView = vi.fn();
});

describe('computeTriplet — wiring DOM autour de calcTriplet', () => {
  it('calcule le coût depuis litres + prix (source=litres)', () => {
    document.getElementById('fLitres').value = '20';
    document.getElementById('fPrix').value   = '0.85';
    computeTriplet('litres');
    expect(document.getElementById('fCout').value).toBe('17.00');
  });

  it('calcule les litres depuis coût + prix (source=cout)', () => {
    document.getElementById('fCout').value = '17';
    document.getElementById('fPrix').value = '0.85';
    computeTriplet('cout');
    expect(document.getElementById('fLitres').value).toBe('20.00');
  });

  it('n’écrase jamais le champ source', () => {
    document.getElementById('fLitres').value = '20';
    document.getElementById('fPrix').value   = '0.85';
    computeTriplet('litres');
    expect(document.getElementById('fLitres').value).toBe('20');
  });

  it('ne fait rien (sans throw) si un input manque', () => {
    document.body.innerHTML = '<input id="fLitres">';
    expect(() => computeTriplet('litres')).not.toThrow();
  });
});

describe('setFieldPrice', () => {
  afterEach(() => vi.useRealTimers());

  it('remplit la valeur à 3 décimales + classe autofilled, retirée après 6 s', () => {
    vi.useFakeTimers();
    setFieldPrice('fPrix', 0.798, '0.798');
    const el = document.getElementById('fPrix');
    expect(el.value).toBe('0.798');
    expect(el.classList.contains('autofilled')).toBe(true);
    vi.advanceTimersByTime(6000);
    expect(el.classList.contains('autofilled')).toBe(false);
  });

  it('vide le champ et met le placeholder « -- » si la valeur est nulle', () => {
    setFieldPrice('fPrix', null, '0.798');
    const el = document.getElementById('fPrix');
    expect(el.value).toBe('');
    expect(el.placeholder).toBe('--');
  });
});

describe('status setters', () => {
  it('setGeoStatus applique « geo-status <cls> » + texte', () => {
    setGeoStatus('ok', 'Trouvé');
    const el = document.getElementById('geoStatus');
    expect(el.className).toBe('geo-status ok');
    expect(el.textContent).toBe('Trouvé');
  });

  it('setAutreStatus applique la classe brute + texte', () => {
    setAutreStatus('err', 'Erreur');
    const el = document.getElementById('autreStatus');
    expect(el.className).toBe('err');
    expect(el.textContent).toBe('Erreur');
  });

  it('setS98Status et setVehiculeStatus écrivent message + classe', () => {
    setS98Status('spin', 'Recherche');
    setVehiculeStatus('ok', 'Véhicule');
    expect(document.getElementById('s98Status').className).toBe('s98-status spin');
    expect(document.getElementById('s98Status').textContent).toBe('Recherche');
    expect(document.getElementById('vehiculeStatus').className).toBe('geo-status ok');
  });
});

describe('showCpSearch / hideCpSearch', () => {
  it('affiche puis masque le bloc recherche CP et vide le champ', () => {
    showCpSearch();
    expect(document.getElementById('cpSearch').classList.contains('hidden')).toBe(false);
    document.getElementById('fCp').value = '59000';
    hideCpSearch();
    expect(document.getElementById('cpSearch').classList.contains('hidden')).toBe(true);
    expect(document.getElementById('fCp').value).toBe('');
  });
});

describe('setSubmitState', () => {
  it('bascule disabled + icône + libellé selon l’état de chargement', () => {
    setSubmitState(true);
    expect(document.getElementById('submitBtn').disabled).toBe(true);
    expect(document.getElementById('submitIcon').textContent).toBe('⏳');
    expect(document.getElementById('submitText').textContent).toBe('Enregistrement…');
    setSubmitState(false);
    expect(document.getElementById('submitBtn').disabled).toBe(false);
    expect(document.getElementById('submitIcon').textContent).toBe('✓');
    expect(document.getElementById('submitText').textContent).toBe('Enregistrer le plein');
  });
});

describe('showFeedback', () => {
  afterEach(() => vi.useRealTimers());

  it('affiche le message et masque un succès après 5 s', () => {
    vi.useFakeTimers();
    showFeedback('success', 'OK', ' détail');
    const el = document.getElementById('feedback');
    expect(el.className).toBe('feedback success');
    expect(el.innerHTML).toContain('<strong>OK</strong>');
    expect(el.style.display).toBe('block');
    vi.advanceTimersByTime(5000);
    expect(el.style.display).toBe('none');
  });

  it('n’auto-masque pas une erreur', () => {
    vi.useFakeTimers();
    showFeedback('error', 'KO', ' souci');
    const el = document.getElementById('feedback');
    vi.advanceTimersByTime(10000);
    expect(el.style.display).toBe('block');
  });
});
