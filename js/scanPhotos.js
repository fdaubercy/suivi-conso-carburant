/* ─── W97 — Scanner « intelligent » : pompe, compteur, ticket ─────────── *
 *  1 à 3 photos → redimensionnement → UN appel GAS action=scanPhotos →   *
 *  contrôle et fusion (scanControle.js) → formulaire + alertes ⚠.        *
 *  Replis : hors ligne ou échec IA avec 1 photo → OCR du ticket          *
 *  (lireTicketOCR) ; avec plusieurs photos → message, rien n'est rempli. *
 *  Spéc : docs/superpowers/specs/2026-10-11-scan-pompe-compteur-design.md *
 * ─────────────────────────────────────────────────────────────────────  */

import { FUEL_CONFIG, GAS_URL, APP_TOKEN, CLIENT_ID_KEY } from './config.js';
import { state } from './state.js';
import { showFeedback, setFieldWarning, clearFieldWarnings, verrouillerScan, deverrouillerScan } from './ui.js';
import { resizeImage, blobToBase64, fillFormFromTicket, lireTicketOCR } from './ticket.js';
import { analyserScan, formaterBilan } from './scanControle.js';
import { getAllRecords, getMaxKmForVehicule } from './historique.js';
import { computeConsoMoy } from './refmodel.js';

export const MAX_PHOTOS = 3;
export const MAX_OCTETS = 6 * 1024 * 1024;
export const DELAI_MS   = 45000;

/* Champ de l'analyse → élément du formulaire qui porte l'alerte */
const CHAMP_ID = {
  date: 'fDate', km: 'fKm', litres: 'fLitres', prix_litre: 'fPrix',
  montant_total: 'fCout', type_carburant: 'typeToggle',
};

function clientId() {
  try { return localStorage.getItem(CLIENT_ID_KEY) || ''; } catch { return ''; }
}

/** Appel GAS action=scanPhotos (45 s max). Lève une Error (avec .code éventuel). */
export async function envoyerScanPhotos(images) {
  const ctrl  = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), DELAI_MS);
  try {
    const resp = await fetch(GAS_URL, {
      method: 'POST', redirect: 'follow', signal: ctrl.signal,
      body: JSON.stringify({ action: 'scanPhotos', images, token: APP_TOKEN, cid: clientId() }),
    });
    const json = await resp.json();
    if (!json || !json.success) {
      const err = new Error((json && json.error) || 'réponse invalide');
      err.code = json && json.code;
      throw err;
    }
    if (!Array.isArray(json.photos)) throw new Error('réponse sans photos (script Google à mettre à jour ?)');
    return json;
  } catch (err) {
    if (err.name === 'AbortError') throw new Error('délai de 45 s dépassé');
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

/** Contexte des contrôles : prix station, historique et conso du véhicule courant. */
export function construireContexte() {
  const veh  = state.currentVehiculeNom || '';
  const tous = getAllRecords();
  const hist = veh ? tous.filter(r => (r['Véhicule'] || r['Vehicule'] || '') === veh) : tous;
  const consoParType = {};
  Object.keys(FUEL_CONFIG).forEach(k => {
    const c = computeConsoMoy(hist, k);
    if (c > 0) consoParType[k] = c;
  });
  return {
    stationPrices:      { ...(state._stationPrices || {}) },
    historiqueVehicule: hist,
    dernierKm:          getMaxKmForVehicule(veh),
    consoParType,
    typeCourant:        state.currentType,
    aujourdHui:         new Date(),
  };
}

/** Remplit le formulaire, écrit le montant lu, verrouille prix et montant, puis
 *  pose les alertes (après le remplissage, qui émet des `input`). */
export async function remplirDepuisScan(resultat) {
  clearFieldWarnings();
  deverrouillerScan();
  const { valeurs, sources } = resultat;
  let remplis = await fillFormFromTicket(valeurs, { silencieux: true });

  /* Montant réellement lu (pompe ou ticket) : écrit tel quel, jamais remplacé par litres × prix */
  let cout = null;
  const elC = document.getElementById('fCout');
  if (elC && valeurs.montant_total > 0 && sources.montant_total !== 'calcul') {
    cout = Number(valeurs.montant_total).toFixed(2);
    elC.value = cout;
    elC.classList.add('autofilled');
    remplis++;
  }
  const elP = document.getElementById('fPrix');
  if (elP && valeurs.prix_litre > 0) verrouillerScan(Number(valeurs.prix_litre).toFixed(3), cout);

  Object.entries(resultat.alertes).forEach(([champ, msg]) => {
    if (CHAMP_ID[champ]) setFieldWarning(CHAMP_ID[champ], msg);
  });
  return remplis;
}

/** W9 — seule l'image classée « ticket » est jointe au plein. */
function joindreTicket(photos, images) {
  const p = photos.find(x => x && x.kind === 'ticket' && Number.isInteger(x.index) && images[x.index]);
  state._ticketPhoto = p ? images[p.index].data : null;
  const ind = document.getElementById('ticketPhotoIndicator');
  if (ind) ind.hidden = !p;
}

export async function lancerScan(fileList, btn) {
  const tous = Array.from(fileList || []);
  if (!tous.length) return;
  const files = tous.slice(0, MAX_PHOTOS);
  const note  = tous.length > MAX_PHOTOS ? ` (${MAX_PHOTOS} photos max : les suivantes ont été ignorées)` : '';

  clearFieldWarnings();   // nouveau scan : alertes et verrou du précédent périmés, quel que soit le chemin
  deverrouillerScan();
  const origHTML = btn.innerHTML;
  btn.disabled = true;
  try {
    if (!navigator.onLine) {
      if (files.length === 1) { await lireTicketOCR(files[0], btn); return; }
      showFeedback('error', 'Hors connexion',
        'Analyse IA indisponible hors connexion — seul un ticket peut être lu hors ligne.');
      return;
    }

    btn.innerHTML = '⏳ Préparation…';
    const images = [];
    for (const f of files) {
      const blob = await resizeImage(f);
      const data = await blobToBase64(blob);
      if (!data) throw new Error('photo illisible');
      images.push({ data, mimeType: blob.type || 'image/jpeg' });
    }
    const octets = images.reduce((s, i) => s + i.data.length * 0.75, 0);
    if (octets > MAX_OCTETS) {
      showFeedback('error', 'Photos trop lourdes',
        `${(octets / 1048576).toFixed(1).replace('.', ',')} Mo — envoyez moins de photos ou des photos plus petites.`);
      return;
    }

    btn.innerHTML = `⏳ Analyse IA (${images.length} photo${images.length > 1 ? 's' : ''})…`;
    let reponse;
    try {
      reponse = await envoyerScanPhotos(images);
    } catch (err) {
      console.warn('[scanPhotos] Échec :', err.message);
      if (files.length === 1) { await lireTicketOCR(files[0], btn); return; }
      if (err.code === 'RATE_LIMIT') showFeedback('error', '📸 Analyse IA', err.message);
      else showFeedback('error', '📸 Analyse IA',
        `Analyse impossible : ${err.message}. Réessayez ou saisissez à la main.`);
      return;
    }

    joindreTicket(reponse.photos, images);
    const resultat  = analyserScan(reponse, construireContexte());
    const remplis   = await remplirDepuisScan(resultat);
    const nbAlertes = Object.keys(resultat.alertes).length;
    const type = remplis === 0 ? 'error' : (nbAlertes ? 'info' : 'success');
    showFeedback(type, '📸 Scan analysé', formaterBilan(resultat.resume, remplis, nbAlertes) + note);
  } catch (err) {
    showFeedback('error', 'Erreur scan', err.message || 'Impossible de lire les photos — réessayez.');
  } finally {
    btn.innerHTML = origHTML;
    btn.disabled  = false;
  }
}

/** Câble le bouton « 📸 Scanner (pompe, compteur, ticket) » (sélection multiple). */
export function initScanner() {
  const btn = document.getElementById('scanTicketBtn');
  if (!btn) return;
  const input = document.createElement('input');
  input.type     = 'file';
  input.accept   = 'image/*';
  input.multiple = true;
  input.style.display = 'none';
  document.body.appendChild(input);

  btn.addEventListener('click', () => input.click());
  input.addEventListener('change', async (e) => {
    const files = Array.from(e.target.files || []);   // copier AVANT de vider l'input
    e.target.value = '';
    await lancerScan(files, btn);
  });
}
