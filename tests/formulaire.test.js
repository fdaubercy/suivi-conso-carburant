// @vitest-environment jsdom
/**
 * Tests — js/formulaire.js (W72) — cœur des saisies.
 * Brouillon (saveDraft/restoreDraft/clearDraft), détection doublon + km,
 * parsing vocal du km, et soumission (gate auth, validation, succès, hors-ligne).
 * Toutes les dépendances (ui, prix, historique, offline, auth…) sont mockées ;
 * config et state restent réels.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';

const H = vi.hoisted(() => ({ records: [], maxKm: 0 }));
const A = vi.hoisted(() => ({ enabled: false, authed: true }));

vi.mock('../js/ui.js', () => ({
  setAutreStatus: vi.fn(), hideCpSearch: vi.fn(), setSubmitState: vi.fn(),
  showFeedback: vi.fn(), computeTriplet: vi.fn(),
}));
vi.mock('../js/carburant.js', () => ({ _buildTypeToggle: vi.fn(), _updateHeaderBadges: vi.fn() }));
vi.mock('../js/prix.js', () => ({
  fetchPricesNearUser: vi.fn(), fetchPricesAtCoords: vi.fn(),
  fetchNearestE85Price: vi.fn(() => Promise.resolve(null)),
  fetchStationPricesSilent: vi.fn(() => Promise.resolve({})), evalRentabiliteE85: vi.fn(),
}));
vi.mock('../js/osm.js', () => ({ cancelOsmEnrich: vi.fn() }));
vi.mock('../js/stationsmap.js', () => ({ getStationCoords: vi.fn(() => null) }));
vi.mock('../js/stations.js', () => ({ syncStationSiNouvelle: vi.fn(() => Promise.resolve()) }));
vi.mock('../js/historique.js', () => ({
  getAllRecords: () => H.records, getMaxKmForVehicule: () => H.maxKm, chargerHistorique: vi.fn(),
}));
vi.mock('../js/rentabilite.js', () => ({ updateRentabilite: vi.fn() }));
vi.mock('../js/offline.js', () => ({ queuePlein: vi.fn(), updateOfflineBadge: vi.fn() }));
vi.mock('../js/auth.js', () => ({
  authEnabled: () => A.enabled, isAuthed: () => A.authed,
  getIdToken: () => 'tok', promptLogin: vi.fn(),
}));

import {
  saveDraft, restoreDraft, clearDraft, checkDuplicate, onKmInput,
  _parseSpeechToNumber, submitForm,
} from '../js/formulaire.js';
import { state } from '../js/state.js';
import { DRAFT_KEY } from '../js/config.js';
import { showFeedback, setSubmitState } from '../js/ui.js';
import { fetchStationPricesSilent } from '../js/prix.js';
import { queuePlein, updateOfflineBadge } from '../js/offline.js';
import { syncStationSiNouvelle } from '../js/stations.js';
import { promptLogin } from '../js/auth.js';

function buildForm() {
  document.body.innerHTML = `
    <input id="fDate"><input id="fKm"><input id="fLitres"><input id="fPrix"><input id="fCout"><input id="fAutre">
    <select id="stationSel"><option value=""></option><option value="Total - Lyon">Total</option></select>
    <div id="autreField" class="hidden"></div>
    <div id="nearbyList"></div>
    <div id="kmWarn"></div>
    <div id="dupeWarn" hidden></div>
    <div id="s98Status"></div>
    <div id="ticketPhotoIndicator" hidden></div>`;
}

const fill = (id, v) => { document.getElementById(id).value = v; };
const fillValidPlein = () => {
  fill('fDate', '2026-06-01'); fill('fKm', '12000'); fill('fLitres', '30'); fill('fPrix', '0.799');
  document.getElementById('stationSel').value = 'Total - Lyon';
};

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
  H.records = []; H.maxKm = 0;
  A.enabled = false; A.authed = true;
  Object.assign(state, {
    currentType: 'E85', _stationPrices: {}, userLat: null, userLon: null,
    currentVehiculeNom: '', _selectedLat: null, _selectedLon: null, _ticketPhoto: null,
  });
  window.scrollTo = vi.fn();
  global.confirm = vi.fn(() => true);
  buildForm();
});

describe('saveDraft / restoreDraft / clearDraft', () => {
  it('sauvegarde le brouillon dès qu’un champ utile est rempli', () => {
    fill('fKm', '12000'); fill('fLitres', '30');
    saveDraft();
    const d = JSON.parse(localStorage.getItem(DRAFT_KEY));
    expect(d.km).toBe('12000');
    expect(d.litres).toBe('30');
    expect(d.type).toBe('E85');
  });

  it('ne sauvegarde rien si tous les champs clés sont vides', () => {
    saveDraft();
    expect(localStorage.getItem(DRAFT_KEY)).toBeNull();
  });

  it('restaure le brouillon dans le formulaire et retourne l’objet', () => {
    localStorage.setItem(DRAFT_KEY, JSON.stringify({
      date: '2026-06-01', km: '12000', litres: '30', prix: '0.799', cout: '', autre: '', station: '', type: 'E85',
    }));
    const d = restoreDraft();
    expect(d).not.toBeNull();
    expect(document.getElementById('fKm').value).toBe('12000');
    expect(document.getElementById('fLitres').value).toBe('30');
    expect(document.getElementById('fPrix').value).toBe('0.799');
  });

  it('retourne null sans brouillon ou si le brouillon est vide', () => {
    expect(restoreDraft()).toBeNull();
    localStorage.setItem(DRAFT_KEY, JSON.stringify({ km: '', litres: '', prix: '', autre: '' }));
    expect(restoreDraft()).toBeNull();
  });

  it('clearDraft efface la clé', () => {
    localStorage.setItem(DRAFT_KEY, 'x');
    clearDraft();
    expect(localStorage.getItem(DRAFT_KEY)).toBeNull();
  });
});

describe('checkDuplicate', () => {
  it('avertit si un plein identique (date + km + litres) existe déjà', () => {
    H.records = [{ Date: '2026-06-01', 'Km compteur': 12000, 'Nb. Litres': 30 }];
    fill('fDate', '2026-06-01'); fill('fKm', '12000'); fill('fLitres', '30');
    checkDuplicate();
    const warn = document.getElementById('dupeWarn');
    expect(warn.hidden).toBe(false);
    expect(warn.textContent).toContain('Doublon');
  });

  it('reste masqué quand aucun doublon ne correspond', () => {
    H.records = [];
    fill('fDate', '2026-06-01'); fill('fKm', '12000'); fill('fLitres', '30');
    checkDuplicate();
    expect(document.getElementById('dupeWarn').hidden).toBe(true);
  });
});

describe('onKmInput — validation kilométrage', () => {
  it('signale un km inférieur au dernier plein (err)', () => {
    H.maxKm = 12000; fill('fKm', '11000');
    onKmInput();
    expect(document.getElementById('kmWarn').className).toBe('km-warn err');
  });
  it('signale un km identique (info)', () => {
    H.maxKm = 12000; fill('fKm', '12000');
    onKmInput();
    expect(document.getElementById('kmWarn').className).toBe('km-warn info');
  });
  it('confirme une progression normale (ok)', () => {
    H.maxKm = 12000; fill('fKm', '12500');
    onKmInput();
    expect(document.getElementById('kmWarn').className).toBe('km-warn ok');
  });
});

describe('_parseSpeechToNumber — dictée du km', () => {
  it('lit les nombres chiffrés (avec espaces/ponctuation)', () => {
    expect(_parseSpeechToNumber('12 430')).toBe(12430);
    expect(_parseSpeechToNumber('12430')).toBe(12430);
  });
  it('lit les nombres en toutes lettres (français)', () => {
    expect(_parseSpeechToNumber('vingt')).toBe(20);
    expect(_parseSpeechToNumber('cent vingt')).toBe(120);
    expect(_parseSpeechToNumber('deux mille trente')).toBe(2030);
  });
  it('retourne NaN pour une chaîne non numérique', () => {
    expect(Number.isNaN(_parseSpeechToNumber('bonjour'))).toBe(true);
  });
});

describe('submitForm', () => {
  it('exige la connexion quand l’auth est active et l’utilisateur déconnecté', async () => {
    A.enabled = true; A.authed = false;
    global.fetch = vi.fn();
    fillValidPlein();
    await submitForm();
    expect(showFeedback).toHaveBeenCalledWith('info', expect.stringContaining('Connexion'), expect.any(String));
    expect(promptLogin).toHaveBeenCalled();
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('refuse l’envoi si des champs obligatoires manquent', async () => {
    global.fetch = vi.fn();
    await submitForm();   // formulaire vide
    expect(showFeedback).toHaveBeenCalledWith('error', 'Champs manquants', expect.any(String));
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('envoie le plein et confirme en cas de succès serveur', async () => {
    global.fetch = vi.fn(() => Promise.resolve({ json: () => Promise.resolve({ success: true, message: 'ok' }) }));
    fillValidPlein();
    const onAdded = vi.fn();
    window.addEventListener('plein-added', onAdded);
    await submitForm();
    window.removeEventListener('plein-added', onAdded);
    expect(global.fetch).toHaveBeenCalledTimes(1);
    expect(setSubmitState).toHaveBeenCalledWith(true);
    expect(setSubmitState).toHaveBeenCalledWith(false);
    expect(showFeedback).toHaveBeenCalledWith('success', expect.stringContaining('enregistré'), expect.any(String));
    expect(syncStationSiNouvelle).toHaveBeenCalledWith('Total - Lyon');
    // W64 — la MAJ globale est déléguée au hub (main.js) via l'événement 'plein-added'.
    expect(onAdded).toHaveBeenCalled();
  });

  it('met le plein en file d’attente hors-ligne si le réseau échoue (TypeError)', async () => {
    global.fetch = vi.fn(() => Promise.reject(new TypeError('Failed to fetch')));
    fillValidPlein();
    await submitForm();
    expect(queuePlein).toHaveBeenCalledTimes(1);
    expect(showFeedback).toHaveBeenCalledWith('info', expect.stringContaining('hors-ligne'), expect.any(String));
    expect(updateOfflineBadge).toHaveBeenCalled();
  });

  it('recharge les 6 prix station à la soumission si la liste n’était pas chargée (fix import dernière ligne)', async () => {
    // Cause racine du bug E85 : prix station non chargés au moment du submit.
    state._stationPrices = {};
    state._selectedLat = 50.52; state._selectedLon = 2.65;
    fetchStationPricesSilent.mockResolvedValueOnce({ E85: '0.799', SP98: '1.979', GAZOLE: '1.759' });
    let sentBody = null;
    global.fetch = vi.fn((_url, opts) => {
      sentBody = JSON.parse(opts.body);
      return Promise.resolve({ json: () => Promise.resolve({ success: true }) });
    });
    fillValidPlein();
    await submitForm();
    expect(fetchStationPricesSilent).toHaveBeenCalledWith(50.52, 2.65);
    expect(sentBody.stationPrices.E85).toBe('0.799');
    expect(sentBody.stationPrices.SP98).toBe('1.979');
    expect(sentBody.stationPrices.GAZOLE).toBe('1.759');
  });

  it('n’appelle pas le rechargement silencieux quand les prix sont déjà chargés', async () => {
    state._stationPrices = { E85: '0.789', SP98: '1.969' };
    state._selectedLat = 50.52; state._selectedLon = 2.65;
    global.fetch = vi.fn(() => Promise.resolve({ json: () => Promise.resolve({ success: true }) }));
    fillValidPlein();
    await submitForm();
    expect(fetchStationPricesSilent).not.toHaveBeenCalled();
  });
});
