/* ─── W17 — Scan ticket de caisse → OCR client-side (Tesseract.js) ─── *
 *                                                                        *
 *  Remplace l'appel GAS/Gemini par Tesseract.js — 100 % navigateur,     *
 *  aucune clé API, fonctionne hors-ligne après premier chargement.       *
 *                                                                        *
 *  Flux :                                                                *
 *    1. L'utilisateur sélectionne une photo du ticket                    *
 *    2. Redimensionnement canvas → max 1 200 px                          *
 *    3. Tesseract.js (langue "fra") → texte brut                         *
 *    4. parseOCRText() → objet structuré {date, km, litres, …}           *
 *    5. fillFormFromTicket() → champs du formulaire pré-remplis           *
 * ─────────────────────────────────────────────────────────────────────  */

import Tesseract from 'tesseract.js';
import { FUEL_CONFIG } from './config.js';
import { showFeedback } from './ui.js';

/* ─── Table de correspondance libellés OCR → clés FUEL_CONFIG ─── */
const FUEL_LABEL_MAP = {
  'e85':              'E85',    'superethanol': 'E85',
  'superéthanol':     'E85',    'ethanol':      'E85',
  'sp98':             'SP98',   'super 98':     'SP98',
  'super98':          'SP98',   'sans plomb 98':'SP98',
  'sans-plomb 98':    'SP98',
  'sp95':             'SP95',   'sans plomb 95':'SP95',
  'sans-plomb 95':    'SP95',
  'e10':              'E10',    'sans plomb e10':'E10',
  'sans-plomb e10':   'E10',
  'gazole':           'GAZOLE', 'diesel':       'GAZOLE',
  'b7':               'GAZOLE', 'gasoil':       'GAZOLE',
  'gplc':             'GPLC',   'gpl':          'GPLC',
};

/* ─── Helpers ─── */

/** Convertit une chaîne décimale (virgule ou point) en nombre. */
function toFloat(str) {
  return parseFloat(String(str).replace(',', '.'));
}

/**
 * Redimensionne l'image via canvas pour limiter la taille (max MAX_PX).
 * Renvoie un Blob JPEG ≤ MAX_BYTES, ou le File original si déjà petit.
 *
 * @param {File} file
 * @returns {Promise<Blob>}
 */
async function resizeImage(file) {
  return new Promise((resolve) => {
    const MAX_PX    = 1200;
    const img       = new Image();
    const objectUrl = URL.createObjectURL(file);

    img.onload = () => {
      URL.revokeObjectURL(objectUrl);

      let { width, height } = img;

      /* Pas de redimensionnement si déjà petite */
      if (width <= MAX_PX && height <= MAX_PX) { resolve(file); return; }

      const ratio = Math.min(MAX_PX / width, MAX_PX / height);
      width  = Math.round(width  * ratio);
      height = Math.round(height * ratio);

      const canvas = document.createElement('canvas');
      canvas.width  = width;
      canvas.height = height;
      canvas.getContext('2d').drawImage(img, 0, 0, width, height);

      canvas.toBlob(blob => resolve(blob ?? file), 'image/jpeg', 0.85);
    };

    img.onerror = () => { URL.revokeObjectURL(objectUrl); resolve(file); };
    img.src     = objectUrl;
  });
}

/* ═══════════════════════════════════════════════════════════════════════
   parseOCRText — Extraire les données métier depuis le texte OCR brut

   Champs cherchés :
     date          YYYY-MM-DD
     km            entier (km compteur)
     litres        décimal
     prix_litre    décimal (€/L)
     montant_total décimal (€)
     type_carburant clé FUEL_CONFIG (E85, SP98, …)
     station       chaîne (nom station)
═══════════════════════════════════════════════════════════════════════ */

/**
 * @param {string} rawText  Texte brut retourné par Tesseract.
 * @returns {Object}        Données structurées (null si non trouvé).
 */
export function parseOCRText(rawText) {
  /* Nettoyage minimal : retire CR, réduit les espaces multiples */
  const text  = rawText.replace(/\r/g, '').replace(/[ \t]{2,}/g, ' ');
  const lower = text.toLowerCase();
  const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 1);

  const result = {
    date: null, km: null, litres: null,
    prix_litre: null, montant_total: null,
    type_carburant: null, station: null,
  };

  /* ── Date ─────────────────────────────────────────────────────────── */
  /* DD/MM/YYYY ou DD-MM-YYYY */
  const mDate = text.match(/\b(\d{2})[\/\-](\d{2})[\/\-](20\d{2})\b/);
  if (mDate) {
    result.date = `${mDate[3]}-${mDate[2]}-${mDate[1]}`;
  } else {
    /* YYYY-MM-DD */
    const mDate2 = text.match(/\b(20\d{2})[\/\-](\d{2})[\/\-](\d{2})\b/);
    if (mDate2) result.date = `${mDate2[1]}-${mDate2[2]}-${mDate2[3]}`;
  }

  /* ── Volume (litres) ──────────────────────────────────────────────── */
  const litresPatterns = [
    /* "16,25 L", "16.25 l", "16,25 litre(s)" */
    /(\d{1,3}[,\.]\d{2,3})\s*(?:litres?|liters?|l\b)/i,
    /* "Qté : 16,25" / "Volume : 16.25" */
    /(?:qté|quantité|volume|vol)[^\d]*(\d{1,3}[,\.]\d{2,3})/i,
    /* "16,25 × 0,798" — volumexprix */
    /(\d{1,3}[,\.]\d{2,3})\s*(?:x|×)\s*[01][,\.]\d{3}/i,
  ];
  for (const pat of litresPatterns) {
    const m = text.match(pat);
    if (m) { result.litres = toFloat(m[1]); break; }
  }

  /* Validation : 0.5 L – 200 L */
  if (result.litres !== null && (result.litres < 0.5 || result.litres > 200)) {
    result.litres = null;
  }

  /* ── Prix unitaire (€/L) ──────────────────────────────────────────── */
  const prixPatterns = [
    /* "0,798 €/L", "0.798€/l", "1,789 / L" */
    /([01][,\.]\d{3})\s*€?\s*\/\s*l\b/i,
    /* "0,798 × 16,25" (prix×litres) */
    /([01][,\.]\d{3})\s*(?:x|×)\s*\d{1,3}[,\.]\d{2}/i,
    /* "Prix/L : 0.798" */
    /(?:prix|p\.u\.|pu|tarif)[^\d]*([01][,\.]\d{3})/i,
    /* "0,798 EUR/L" */
    /([01][,\.]\d{3})\s*eur?\s*\/\s*l\b/i,
  ];
  for (const pat of prixPatterns) {
    const m = text.match(pat);
    if (m) { result.prix_litre = toFloat(m[1]); break; }
  }

  /* Fallback : si litres trouvé sans prix, chercher   16,25 x 0,798 */
  if (result.litres !== null && result.prix_litre === null) {
    const litStr = String(result.litres).replace('.', '[,.]');
    const mCalc  = text.match(new RegExp(litStr + '\\s*(?:x|×)\\s*([01][,\\.][0-9]{3})'));
    if (mCalc) result.prix_litre = toFloat(mCalc[1]);
  }

  /* Validation : 0.3 €/L – 3.5 €/L */
  if (result.prix_litre !== null && (result.prix_litre < 0.3 || result.prix_litre > 3.5)) {
    result.prix_litre = null;
  }

  /* ── Montant total ────────────────────────────────────────────────── */
  const totalPatterns = [
    /(?:total|montant|à payer|payé|net\s*à\s*payer|ttc)[^\d]*(\d{1,3}[,\.]\d{2})\s*€?/i,
    /(\d{1,3}[,\.]\d{2})\s*€\s*(?:ttc|net)?(?:\s|$)/i,
  ];
  for (const pat of totalPatterns) {
    const m = text.match(pat);
    if (m) { result.montant_total = toFloat(m[1]); break; }
  }
  /* Calcul de secours */
  if (result.montant_total === null && result.litres && result.prix_litre) {
    result.montant_total = Math.round(result.litres * result.prix_litre * 100) / 100;
  }

  /* ── Type de carburant ────────────────────────────────────────────── */
  /* 1) Libellés longs */
  for (const [key, val] of Object.entries(FUEL_LABEL_MAP)) {
    if (lower.includes(key)) { result.type_carburant = val; break; }
  }
  /* 2) Codes courts (E85, SP98, …) si rien trouvé */
  if (!result.type_carburant) {
    const mFuel = text.match(/\b(E85|SP98|SP95|E10|Gazole|GPLc|B7)\b/i);
    if (mFuel) {
      const k = mFuel[1].toUpperCase();
      result.type_carburant = FUEL_LABEL_MAP[k.toLowerCase()]
        || Object.keys(FUEL_CONFIG).find(fk => fk === k)
        || null;
    }
  }

  /* ── Station ──────────────────────────────────────────────────────── */
  const stationKw = [
    'leclerc', 'carrefour', 'total energies', 'total', 'bp ',
    'intermarché', 'intermarch', 'auchan', 'super u', 'casino',
    'shell', 'esso', 'nf e-store', 'cora', 'lidl', 'franprix',
    'système u', 'systeme u',
  ];
  for (const kw of stationKw) {
    if (lower.includes(kw)) {
      const line = lines.find(l => l.toLowerCase().includes(kw));
      if (line) { result.station = line; break; }
    }
  }

  /* ── Km compteur ──────────────────────────────────────────────────── */
  const kmPatterns = [
    /\b(\d{4,6})\s*km\b/i,
    /(?:km|kilom(?:ètres?)?|compteur|odom)[^\d]*(\d{4,6})/i,
  ];
  for (const pat of kmPatterns) {
    const m = text.match(pat);
    if (m) { result.km = parseInt(m[1], 10); break; }
  }

  return result;
}

/* ═══════════════════════════════════════════════════════════════════════
   fillFormFromTicket — Injecter les données dans le formulaire
═══════════════════════════════════════════════════════════════════════ */

/**
 * @param {Object} data  Résultat de parseOCRText().
 */
function fillFormFromTicket(data) {
  let filled = 0;

  if (data.date) {
    const el = document.getElementById('fDate');
    if (el) { el.value = data.date; el.classList.add('autofilled'); filled++; }
  }

  if (data.km && Number(data.km) > 0) {
    const el = document.getElementById('fKm');
    if (el) {
      el.value = Math.round(Number(data.km));
      el.classList.add('autofilled');
      el.dispatchEvent(new Event('input'));
      filled++;
    }
  }

  if (data.litres && Number(data.litres) > 0) {
    const el = document.getElementById('fLitres');
    if (el) {
      el.value = Number(data.litres).toFixed(2);
      el.classList.add('autofilled');
      el.dispatchEvent(new Event('input'));
      filled++;
    }
  }

  if (data.prix_litre && Number(data.prix_litre) > 0) {
    const el = document.getElementById('fPrix');
    if (el) {
      el.value = Number(data.prix_litre).toFixed(3);
      el.classList.add('autofilled');
      el.dispatchEvent(new Event('input'));
      filled++;
    }
  }

  /* Type de carburant */
  if (data.type_carburant) {
    const norm    = data.type_carburant.toLowerCase().trim();
    const fuelKey = FUEL_LABEL_MAP[norm]
      || Object.keys(FUEL_CONFIG).find(k => norm.includes(k.toLowerCase()));
    if (fuelKey && typeof window.setType === 'function') {
      window.setType(fuelKey);
      filled++;
    }
  }

  /* Station — correspondance partielle dans le dropdown */
  if (data.station) {
    const sel    = document.getElementById('stationSel');
    const needle = data.station.toLowerCase();
    if (sel) {
      const match = Array.from(sel.options).find(o =>
        o.value && o.value !== '__autre' &&
        (o.value.toLowerCase().includes(needle) || needle.includes(o.value.toLowerCase()))
      );
      if (match) {
        sel.value = match.value;
        sel.dispatchEvent(new Event('change'));
        filled++;
      }
    }
  }

  if (typeof window.updateCout === 'function') window.updateCout();

  const label = filled > 0
    ? `${filled} champ${filled > 1 ? 's' : ''} pré-rempli${filled > 1 ? 's' : ''} — vérifiez avant d'enregistrer`
    : 'Aucun champ reconnu — essayez une photo plus nette et bien cadrée';
  showFeedback(filled > 0 ? 'success' : 'error', '🧾 Ticket analysé', label);
}

/* ═══════════════════════════════════════════════════════════════════════
   initScanner — Câble le bouton "Scanner le ticket"
═══════════════════════════════════════════════════════════════════════ */

/**
 * À appeler depuis main.js après le chargement du DOM.
 * Crée un <input type="file"> caché et gère le cycle de vie OCR.
 */
export function initScanner() {
  const btn = document.getElementById('scanTicketBtn');
  if (!btn) return;

  /* Input file caché — galerie + caméra sur mobile */
  const input   = document.createElement('input');
  input.type    = 'file';
  input.accept  = 'image/*';
  input.style.display = 'none';
  document.body.appendChild(input);

  btn.addEventListener('click', () => input.click());

  input.addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    e.target.value = '';   /* permet de re-sélectionner le même fichier */

    const origHTML = btn.innerHTML;
    btn.disabled   = true;
    btn.innerHTML  = '⏳ Préparation…';

    try {
      /* 1. Redimensionnement client-side */
      const blob = await resizeImage(file);

      /* 2. OCR Tesseract.js (langue française) */
      const { data: { text } } = await Tesseract.recognize(blob, 'fra', {
        logger: ({ status, progress }) => {
          if (status === 'loading tesseract core') {
            btn.innerHTML = '⏳ Chargement moteur OCR…';
          } else if (status === 'loading language traineddata') {
            btn.innerHTML = '⏳ Chargement dictionnaire…';
          } else if (status === 'recognizing text') {
            btn.innerHTML = `⏳ Lecture ${Math.round(progress * 100)} %…`;
          }
        },
      });

      /* 3. Texte trop court → photo illisible */
      if (!text || text.trim().length < 8) {
        showFeedback('error', 'Scan échoué',
          'Image illisible — essayez une photo plus nette, bien éclairée et bien cadrée.');
        return;
      }

      /* 4. Parsing heuristique */
      const parsed = parseOCRText(text);

      /* 5. Remplissage du formulaire */
      fillFormFromTicket(parsed);

    } catch (err) {
      showFeedback('error', 'Erreur OCR',
        err.message || 'Impossible de lire l\'image — réessayez.');
    } finally {
      btn.innerHTML = origHTML;
      btn.disabled  = false;
    }
  });
}
