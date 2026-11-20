// @vitest-environment jsdom
/**
 * Tests — js/scanPhotos.js (W97) : un seul appel scanPhotos pour 1 à 3 photos,
 * replis hors ligne / échec IA, photo jointe = image classée « ticket », bilan.
 * ticket.js est simulé (jsdom ne décode pas les images).
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('tesseract.js', () => ({ default: {} }));
vi.mock('../js/ticket.js', () => ({
  resizeImage:        vi.fn(async f => f),
  blobToBase64:       vi.fn(async f => f.name + '-b64'),
  fillFormFromTicket: vi.fn(async () => 4),
  lireTicketOCR:      vi.fn(async () => {}),
}));

// W102 — geo.js simulé : searchNearby renvoie une station à `distStation` m.
let distStation = 120;
vi.mock('../js/geo.js', async () => {
  const { state } = await import('../js/state.js');
  return {
    searchNearby: vi.fn(async () => {
      state._nearbyStations = [{ name: 'Carrefour - Fiers', lat: 50.1, lon: 2.6, dist: distStation }];
    }),
    pickStation: vi.fn(),
    highlightNearbyItem: vi.fn(),
  };
});
const geo = await import('../js/geo.js');
const { jpeg } = await import('./fixtures/jpegExif.js');

const ticket = await import('../js/ticket.js');
const { lancerScan } = await import('../js/scanPhotos.js');
const { state } = await import('../js/state.js');

const fichier = nom => new File(['x'], nom, { type: 'image/jpeg' });
const repondre = json => vi.stubGlobal('fetch', vi.fn(async () => ({ json: async () => json })));
const POMPE = { index: 0, kind: 'pompe', lisible: true, valeurs: { litres: 16.14, prix_litre: 0.869, montant_total: 14.03 } };
const COMPTEUR = { index: 1, kind: 'compteur', lisible: true, valeurs: { km: 19719 } };
const TICKET = index => ({ index, kind: 'ticket', lisible: true, valeurs: { date: '2026-10-10' } });
const feedback = () => document.getElementById('feedback').textContent;

let enLigne = true;
Object.defineProperty(navigator, 'onLine', { configurable: true, get: () => enLigne });

let btn;
beforeEach(() => {
  document.body.innerHTML = `
    <button id="scanTicketBtn">📸 Scanner</button><div id="feedback"></div>
    <span id="ticketPhotoIndicator" hidden></span><div id="typeToggle"></div>
    <input id="fDate"><input id="fKm"><input id="fLitres"><input id="fPrix"><input id="fCout">
    <button id="geoBtn"></button><div id="geoStatus"></div><div id="nearbyList"></div>`;
  distStation = 120;
  Element.prototype.scrollIntoView = vi.fn();
  btn = document.getElementById('scanTicketBtn');
  state._ticketPhoto = null;
  state._stationPrices = {};
  enLigne = true;
  vi.clearAllMocks();
});

describe('lancerScan — en ligne', () => {
  it('2 photos → un seul appel scanPhotos, formulaire rempli, alertes et bilan', async () => {
    repondre({ success: true, photos: [POMPE, COMPTEUR], fusion: {} });
    await lancerScan([fichier('a.jpg'), fichier('b.jpg')], btn);
    expect(fetch).toHaveBeenCalledTimes(1);
    const corps = JSON.parse(fetch.mock.calls[0][1].body);
    expect(corps.action).toBe('scanPhotos');
    expect(corps.images.map(i => i.data)).toEqual(['a.jpg-b64', 'b.jpg-b64']);
    expect(ticket.fillFormFromTicket).toHaveBeenCalledWith(
      expect.objectContaining({ litres: 16.14, km: 19719 }), { silencieux: true });
    expect(document.querySelector('.field-warn[data-warn-for="typeToggle"]').textContent).toContain('type à vérifier');
    expect(feedback()).toContain('2 photos analysées : pompe ✓, compteur ✓ — 5 champs pré-remplis, 1 à vérifier');
    expect(document.getElementById('fCout').value).toBe('14.03');
    expect(btn.disabled).toBe(false);
    expect(btn.innerHTML).toBe('📸 Scanner');
  });
  it('4 photos → seules les 3 premières sont envoyées, avec un message', async () => {
    repondre({ success: true, photos: [POMPE], fusion: {} });
    await lancerScan(['a', 'b', 'c', 'd'].map(n => fichier(n + '.jpg')), btn);
    expect(JSON.parse(fetch.mock.calls[0][1].body).images).toHaveLength(3);
    expect(feedback()).toContain('3 photos max');
  });
  it('la photo jointe est l\'image classée « ticket » (par son index)', async () => {
    repondre({ success: true, photos: [TICKET(1), POMPE], fusion: {} });
    await lancerScan([fichier('a.jpg'), fichier('b.jpg')], btn);
    expect(state._ticketPhoto).toBe('b.jpg-b64');
    expect(document.getElementById('ticketPhotoIndicator').hidden).toBe(false);
  });
  it('sans ticket reconnu, aucune photo n\'est jointe', async () => {
    repondre({ success: true, photos: [POMPE, COMPTEUR], fusion: {} });
    await lancerScan([fichier('a.jpg'), fichier('b.jpg')], btn);
    expect(state._ticketPhoto).toBeNull();
    expect(document.getElementById('ticketPhotoIndicator').hidden).toBe(true);
  });
  it('photos trop lourdes : message, aucun envoi', async () => {
    repondre({ success: true, photos: [], fusion: {} });
    ticket.blobToBase64.mockImplementationOnce(async () => 'x'.repeat(9000000));
    await lancerScan([fichier('a.jpg')], btn);
    expect(fetch).not.toHaveBeenCalled();
    expect(feedback()).toContain('trop lourdes');
  });
  it("W98 — un scan sans ticket conserve la photo de ticket déjà jointe", async () => {
    state._ticketPhoto = 'ticket-precedent';
    document.getElementById('ticketPhotoIndicator').hidden = false;
    repondre({ success: true, photos: [POMPE, COMPTEUR], fusion: {} });
    await lancerScan([fichier('a.jpg'), fichier('b.jpg')], btn);
    expect(state._ticketPhoto).toBe('ticket-precedent');
    expect(document.getElementById('ticketPhotoIndicator').hidden).toBe(false);
  });
  it("W98 — photo HEIC non décodée : message « réglez l'appareil sur JPEG », aucun envoi", async () => {
    repondre({ success: true, photos: [], fusion: {} });
    await lancerScan([fichier('a.jpg'), new File(['x'], 'IMG_0001.HEIC', { type: 'image/heic' })], btn);
    expect(fetch).not.toHaveBeenCalled();
    expect(feedback()).toContain('HEIC');
    expect(feedback()).toContain('JPEG');
    expect(feedback()).not.toContain('trop lourdes');
  });
  it("W98 — HEIC reconnu à son extension quand le navigateur ne donne pas de type", async () => {
    repondre({ success: true, photos: [], fusion: {} });
    await lancerScan([new File(['x'], 'photo.heif', { type: '' })], btn);
    expect(fetch).not.toHaveBeenCalled();
    expect(feedback()).toContain('HEIC');
  });
  it("W98 — HEIC converti par le navigateur (Safari) : envoyé normalement", async () => {
    repondre({ success: true, photos: [POMPE], fusion: {} });
    ticket.resizeImage.mockImplementationOnce(async () => new Blob(['y'], { type: 'image/jpeg' }));
    ticket.blobToBase64.mockImplementationOnce(async () => 'converti-b64');
    await lancerScan([new File(['x'], 'IMG.HEIC', { type: 'image/heic' })], btn);
    expect(fetch).toHaveBeenCalledTimes(1);
  });
});

describe('lancerScan — date et position des photos (W102)', () => {
  const photo = (o) => new File([jpeg(o)], 'IMG_0272.jpg', { type: 'image/jpeg' });
  const remplirDate = d => ticket.fillFormFromTicket.mockImplementationOnce(async v => {
    document.getElementById('fDate').value = d ?? v.date ?? ''; return 1;
  });

  it('la date de prise de vue l\'emporte sur la date lue, avec une alerte', async () => {
    repondre({ success: true, photos: [TICKET(0)], fusion: {} });
    remplirDate();
    await lancerScan([photo({ gps: false })], btn);
    expect(document.getElementById('fDate').value).toBe('2026-11-16');
    expect(document.querySelector('.field-warn[data-warn-for="fDate"]').textContent)
      .toContain('lue sur le ticket : 10/10/2026');
  });
  it('sans date lue par l\'IA : date de la photo, sans alerte', async () => {
    repondre({ success: true, photos: [POMPE], fusion: {} });
    await lancerScan([photo({ gps: false })], btn);
    expect(document.getElementById('fDate').value).toBe('2026-11-16');
    expect(document.querySelector('.field-warn[data-warn-for="fDate"]')).toBeNull();
  });
  it('la date de la photo est posée même si l\'analyse IA échoue', async () => {
    repondre({ success: false, error: 'quota' });
    await lancerScan([photo({ gps: false }), fichier('b.jpg')], btn);
    expect(document.getElementById('fDate').value).toBe('2026-11-16');
  });
  it('position GPS : recherche autour de la photo et choix de la station à moins de 300 m', async () => {
    repondre({ success: true, photos: [POMPE], fusion: {} });
    await lancerScan([photo()], btn);
    expect(geo.searchNearby.mock.calls[0][0]).toBeCloseTo(50 + 31 / 60 + 30 / 3600, 6);
    expect(geo.pickStation).toHaveBeenCalledWith('Carrefour - Fiers', 50.1, 2.6);
    expect(document.getElementById('geoStatus').textContent).toContain('Station de la photo');
  });
  it('station la plus proche au-delà de 300 m : liste seule, rien n\'est choisi', async () => {
    distStation = 900;
    repondre({ success: true, photos: [POMPE], fusion: {} });
    await lancerScan([photo()], btn);
    expect(geo.pickStation).not.toHaveBeenCalled();
    expect(document.getElementById('geoStatus').textContent).toContain('Aucune station à moins de 300 m');
  });
  it('photo sans EXIF : ni date ni recherche de station', async () => {
    repondre({ success: true, photos: [POMPE], fusion: {} });
    document.getElementById('fDate').value = '2026-11-20';
    await lancerScan([fichier('a.jpg')], btn);
    expect(document.getElementById('fDate').value).toBe('2026-11-20');
    expect(geo.searchNearby).not.toHaveBeenCalled();
  });
});

describe('lancerScan — erreurs et replis', () => {
  it('revue I4 — un nouveau scan efface les alertes du scan précédent, même par le chemin OCR', async () => {
    enLigne = false;
    repondre({});
    const ui = await import('../js/ui.js');
    ui.setFieldWarning('typeToggle', 'type déduit du prix (0,869 €/L → E85)');
    await lancerScan([fichier('a.jpg')], btn);
    expect(document.querySelector('.field-warn')).toBeNull();
  });
  it('revue I1 — le montant lu est écrit tel quel dans le coût et verrouillé', async () => {
    repondre({ success: true, photos: [{ index: 0, kind: 'pompe', lisible: true,
      valeurs: { litres: 40, montant_total: 75.43 } }], fusion: {} });
    await lancerScan([fichier('a.jpg'), fichier('b.jpg')], btn);
    const ui = await import('../js/ui.js');
    document.getElementById('fLitres').value = '40.00';
    document.getElementById('fPrix').value = '1.886';
    ui.computeTriplet('prix');
    expect(document.getElementById('fCout').value).toBe('75.43');
    ui.deverrouillerScan();
  });
  it('hors ligne, 2 photos : message, aucun envoi', async () => {
    enLigne = false;
    repondre({});
    await lancerScan([fichier('a.jpg'), fichier('b.jpg')], btn);
    expect(fetch).not.toHaveBeenCalled();
    expect(feedback()).toContain('hors connexion');
  });
  it("W98 — hors ligne, 1 photo HEIC : message, pas de lecture OCR", async () => {
    enLigne = false;
    repondre({});
    await lancerScan([new File(['x'], 'IMG.HEIC', { type: 'image/heic' })], btn);
    expect(ticket.lireTicketOCR).not.toHaveBeenCalled();
    expect(feedback()).toContain('HEIC');
  });
  it('hors ligne, 1 photo : lecture OCR du ticket', async () => {
    enLigne = false;
    repondre({});
    const f = fichier('a.jpg');
    await lancerScan([f], btn);
    expect(fetch).not.toHaveBeenCalled();
    expect(ticket.lireTicketOCR).toHaveBeenCalledWith(f, btn);
  });
  it('échec IA avec 1 photo : repli OCR', async () => {
    repondre({ success: false, error: 'quota' });
    await lancerScan([fichier('a.jpg')], btn);
    expect(ticket.lireTicketOCR).toHaveBeenCalledTimes(1);
  });
  it('échec IA avec 2 photos : message, rien n\'est rempli', async () => {
    repondre({ success: false, error: 'quota' });
    await lancerScan([fichier('a.jpg'), fichier('b.jpg')], btn);
    expect(feedback()).toContain('Analyse impossible : quota');
    expect(ticket.lireTicketOCR).not.toHaveBeenCalled();
    expect(ticket.fillFormFromTicket).not.toHaveBeenCalled();
  });
  it('limite de fréquence : message dédié', async () => {
    repondre({ success: false, code: 'RATE_LIMIT', error: 'Trop d\'analyses, réessayez dans une minute.' });
    await lancerScan([fichier('a.jpg'), fichier('b.jpg')], btn);
    expect(feedback()).toContain('Trop d\'analyses');
    expect(feedback()).not.toContain('Analyse impossible');
  });
  it('réponse sans tableau photos (ancien script) : erreur, rien n\'est rempli', async () => {
    repondre({ success: true, data: {} });
    await lancerScan([fichier('a.jpg'), fichier('b.jpg')], btn);
    expect(feedback()).toContain('Analyse impossible');
    expect(ticket.fillFormFromTicket).not.toHaveBeenCalled();
  });
  it('erreur inattendue : message et bouton réactivé', async () => {
    repondre({});
    ticket.resizeImage.mockRejectedValueOnce(new Error('boum'));
    await lancerScan([fichier('a.jpg'), fichier('b.jpg')], btn);
    expect(feedback()).toContain('boum');
    expect(btn.disabled).toBe(false);
  });
});
