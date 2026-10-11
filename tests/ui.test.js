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
  setFieldWarning, clearFieldWarnings, verrouillerScan, deverrouillerScan,
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
describe('setFieldWarning / clearFieldWarnings (W97)', () => {
  it('affiche le message juste sous le champ, une seule fois par champ', () => {
    setFieldWarning('fLitres', 'à vérifier');
    setFieldWarning('fLitres', 'pompe et ticket diffèrent');
    const w = document.querySelectorAll('.field-warn[data-warn-for="fLitres"]');
    expect(w).toHaveLength(1);
    expect(w[0].textContent).toBe('⚠ pompe et ticket diffèrent');
    expect(document.getElementById('fLitres').nextElementSibling).toBe(w[0]);
  });
  it('s\'efface dès que l\'utilisateur modifie le champ', () => {
    setFieldWarning('fLitres', 'x');
    document.getElementById('fLitres').dispatchEvent(new Event('input'));
    expect(document.querySelector('.field-warn')).toBeNull();
  });
  it('sur un bloc non saisissable (choix du carburant), s\'efface au clic', () => {
    document.body.insertAdjacentHTML('beforeend', '<div id="typeToggle"></div>');
    setFieldWarning('typeToggle', 'type à vérifier');
    const tt = document.getElementById('typeToggle');
    tt.dispatchEvent(new Event('input'));
    expect(document.querySelector('.field-warn')).not.toBeNull();
    tt.dispatchEvent(new Event('click'));
    expect(document.querySelector('.field-warn')).toBeNull();
  });
  it('clearFieldWarnings retire toutes les alertes', () => {
    setFieldWarning('fLitres', 'a');
    setFieldWarning('fPrix', 'b');
    clearFieldWarnings();
    expect(document.querySelectorAll('.field-warn')).toHaveLength(0);
  });
  it('id inconnu : ne lève pas', () => {
    expect(() => setFieldWarning('absent', 'x')).not.toThrow();
  });
});

describe('setFieldWarning — champ km dans son bloc flex (W97, revue I3)', () => {
  it("l'alerte se place après le bloc .km-input-wrap, pas entre le champ et le micro", () => {
    document.body.insertAdjacentHTML('beforeend',
      '<div class="field"><div class="km-input-wrap"><input id="fKm"><button id="micKm"></button></div></div>');
    setFieldWarning('fKm', 'compteur partiel (TRIP) lu ?');
    const w = document.querySelector('.field-warn[data-warn-for="fKm"]');
    expect(w.previousElementSibling.classList.contains('km-input-wrap')).toBe(true);
    expect(document.querySelector('.km-input-wrap .field-warn')).toBeNull();
  });
});

describe('verrou du scan — prix payé et montant lus prioritaires (W97, revue I1/I2/I5)', () => {
  afterEach(() => deverrouillerScan());
  const val = id => document.getElementById(id).value;

  it('un prix station posé après le scan ne remplace pas le prix payé', () => {
    document.getElementById('fPrix').value = '0.869';
    verrouillerScan('0.869', null);
    setFieldPrice('fPrix', 0.899, '0.798');
    expect(val('fPrix')).toBe('0.869');
    setFieldPrice('fPrix', null, '0.798');
    expect(val('fPrix')).toBe('0.869');
  });
  it('le recalcul du triplet conserve le montant lu et le prix payé', () => {
    document.getElementById('fLitres').value = '16.14';
    document.getElementById('fPrix').value = '';
    document.getElementById('fCout').value = '15.03';
    verrouillerScan('0.869', '15.03');
    computeTriplet('prix');
    expect(val('fPrix')).toBe('0.869');
    expect(val('fCout')).toBe('15.03');
  });
  it("la première saisie de l'utilisateur dans le triplet lève le verrou", () => {
    document.getElementById('fPrix').value = '0.869';
    verrouillerScan('0.869', null);
    document.getElementById('fLitres').dispatchEvent(new Event('input', { bubbles: true }));
    setFieldPrice('fPrix', 0.899, '0.798');
    expect(val('fPrix')).toBe('0.899');
  });
  it('deverrouillerScan rétablit le comportement normal', () => {
    verrouillerScan('0.869', null);
    deverrouillerScan();
    setFieldPrice('fPrix', 0.899, '0.798');
    expect(val('fPrix')).toBe('0.899');
  });
});
