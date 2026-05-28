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
 *    6. W9 : base64 de l'image stockée dans state._ticketPhoto           *
 * ─────────────────────────────────────────────────────────────────────  */

import Tesseract from 'tesseract.js';
import { FUEL_CONFIG } from './config.js';
import { state } from './state.js';
import { showFeedback } from './ui.js';

/* ─── Table de correspondance libellés OCR → clés FUEL_CONFIG ───────────
 *
 *  ⚠️  ORDRE CRITIQUE : les patterns composés (sp95-e10, sp 95-e10…) DOIVENT
 *  précéder leurs composants simples (sp95, e10) car la recherche s'arrête
 *  au premier match (includes).
 *
 * ─────────────────────────────────────────────────────────────────────── */
const FUEL_LABEL_MAP = {
  /* ── E85 ── */
  'e85':              'E85',  'superethanol':  'E85',
  'superéthanol':     'E85',  'ethanol':       'E85',

  /* ── SP98 (E5) ── */
  'sp98-e5':          'SP98', 'sp 98-e5':      'SP98',
  'sans plomb 98-e5': 'SP98', '98-e5':         'SP98',
  'sp98':             'SP98', 'super 98':      'SP98',
  'super98':          'SP98', 'sans plomb 98': 'SP98',
  'sans-plomb 98':    'SP98',

  /* ── SP95-E10 (E10) — AVANT sp95 et e10 ── */
  'sp95-e10':          'E10', 'sp 95-e10':      'E10',
  'sp 95-e10':         'E10', 'sp95 e10':       'E10',
  'sp 95 e10':         'E10', 'sans plomb 95-e10': 'E10',
  'sans plomb 95 e10': 'E10', '95-e10':         'E10',
  '95 e10':            'E10',

  /* ── SP95 simple ── */
  'sp95':             'SP95', 'sans plomb 95': 'SP95',
  'sans-plomb 95':    'SP95',

  /* ── E10 simple ── */
  'e10':              'E10',  'sans plomb e10': 'E10',
  'sans-plomb e10':   'E10',

  /* ── Gazole ── */
  'gazole':           'GAZOLE', 'diesel':  'GAZOLE',
  'b7':               'GAZOLE', 'gasoil':  'GAZOLE',

  /* ── GPLc ── */
  'gplc':             'GPLC', 'gpl':      'GPLC',
};

/* ─── Helpers ─── */

function toFloat(str) {
  return parseFloat(String(str).replace(',', '.'));
}

async function resizeImage(file) {
  return new Promise((resolve) => {
    const MAX_PX    = 1200;
    const img       = new Image();
    const objectUrl = URL.createObjectURL(file);

    img.onload = () => {
      URL.revokeObjectURL(objectUrl);
      let { width, height } = img;
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

/** W9 — Convertit un Blob/File en chaîne base64 (sans le préfixe data:...) */
async function blobToBase64(blob) {
  return new Promise(resolve => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result;
      resolve(result.includes(',') ? result.split(',')[1] : result);
    };
    reader.onerror = () => resolve(null);
    reader.readAsDataURL(blob);
  });
}

/* ═══════════════════════════════════════════════════════════════════════
   parseOCRText — Extraire les données métier depuis le texte OCR brut
═══════════════════════════════════════════════════════════════════════ */

export function parseOCRText(rawText) {
  /* Nettoyage minimal */
  const text  = rawText.replace(/\r/g, '').replace(/[ \t]{2,}/g, ' ');
  const lower = text.toLowerCase();
  const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 1);

  const result = {
    date: null, km: null, litres: null,
    prix_litre: null, montant_total: null,
    type_carburant: null, station: null,
  };

  /* ── Date ─────────────────────────────────────────────────────────── */
  const mDate = text.match(/\b(\d{2})[\/\-](\d{2})[\/\-](20\d{2})\b/);
  if (mDate) {
    result.date = `${mDate[3]}-${mDate[2]}-${mDate[1]}`;
  } else {
    const mDate2 = text.match(/\b(20\d{2})[\/\-](\d{2})[\/\-](\d{2})\b/);
    if (mDate2) result.date = `${mDate2[1]}-${mDate2[2]}-${mDate2[3]}`;
  }

  /* ── Volume (litres) ──────────────────────────────────────────────── */
  const litresPatterns = [
    /(\d{1,3}[,\.]\d{2,3})\s*(?:litres?|liters?|l\b)/i,
    /(?:qté|quantité|volume|vol)[^\d]*(\d{1,3}[,\.]\d{2,3})/i,
    /(\d{1,3}[,\.]\d{2,3})\s*(?:x|×)\s*[01][,\.]\d{3}/i,
  ];
  for (const pat of litresPatterns) {
    const m = text.match(pat);
    if (m) { result.litres = toFloat(m[1]); break; }
  }
  if (result.litres !== null && (result.litres < 0.5 || result.litres > 200)) {
    result.litres = null;
  }

  /* ── Prix unitaire (€/L) ──────────────────────────────────────────────
   *
   *  Artefacts OCR fréquents sur "1,799 €/L" :
   *   • "€" lu comme "e", "E", "£", "é" ou supprimé
   *   • "/" lu comme "|", "\", "I", "l" (lettre)
   *   • "," lu comme "." (contexte anglais Tesseract)
   *   • Ticket 2 colonnes → valeur peut être séparée du libellé par \n\n
   *
   *  Stratégie : filtrer sur la plage réaliste [0,3 – 3,5] et
   *  éviter les TICPE/taxe (0,691 €/L) en prenant la VALEUR MAXIMALE
   *  parmi tous les candidats trouvés si plusieurs matches.
   *
   *  Fallbacks (par ordre de fiabilité) :
   *   ①  X,XXX [€e£]? /L
   *   ②  X,XXX euros?/L
   *   ③  Libellé (Prix unitaire, P.U., Prix/litre…) + X,XXX
   *   ④  X,XXX × litres  (multiplication)
   *   ⑤  X,XX [€e]? /L  (2 décimales)
   *   ⑥  total ÷ litres
   *
   * ─────────────────────────────────────────────────────────────────── */

  /* Collecte TOUS les candidats prix/L puis prend le max (élimine TICPE etc.) */
  const prixCandidates = [];

  const prixPatterns = [
    /* ① Séparateur X,XXX puis unité — "€" peut être "e","E","£","é" ou absent */
    /([0-3][,\.]\d{3})\s*[€e£é]?\s*[\/\\|Il]\s*l\b/i,

    /* ② "1,799 euros/L", "euro/L", "eur/L" */
    /([0-3][,\.]\d{3})\s*eur(?:os?)?\s*[\/\\|Il]\s*l\b/i,

    /* ③ Libellé explicite :
     *   "Prix unitaire TTC : 1,799"  "Prix/litre : 1,799"  "P.U. : 0,798"  "Tarif 1,799" */
    /(?:prix\s*(?:au\s*)?(?:litres?|\/\s*litres?|\/\s*l\b|l\b)|prix\s+unitaire|p\.?\s*u\.?|pu\b|tarif)[^\d]*([0-3][,\.]\d{3})/i,

    /* ④ "1,799 × 42,58" ou "1,799 x 42,58" (prix × litres) */
    /([0-3][,\.]\d{3})\s*(?:x|×)\s*\d{1,3}[,\.]\d{2,3}/i,

    /* ⑤ 2 décimales "1,80 €/L" */
    /([0-3][,\.]\d{2})\s*[€e£é]?\s*[\/\\|Il]\s*l\b/i,
  ];

  for (const pat of prixPatterns) {
    /* .matchAll() pour trouver tous les candidats, pas seulement le premier */
    for (const m of text.matchAll(new RegExp(pat.source, pat.flags + 'g'))) {
      const v = toFloat(m[1] ?? m[m.length - 1]);
      if (v >= 0.3 && v <= 3.5) prixCandidates.push(v);
    }
  }

  /* Fallback inverse "litres × prix" */
  if (result.litres !== null) {
    const litStr = String(result.litres).replace('.', '[,.]');
    const mCalc  = text.match(new RegExp(litStr + '\\s*(?:x|×)\\s*([0-3][,\\.][0-9]{2,3})'));
    if (mCalc) {
      const v = toFloat(mCalc[1]);
      if (v >= 0.3 && v <= 3.5) prixCandidates.push(v);
    }
  }

  /* Prend le prix MAXIMUM parmi les candidats valides
   * (élimine les taxes/TICPE qui sont toujours inférieures au prix carburant) */
  if (prixCandidates.length > 0) {
    result.prix_litre = Math.max(...prixCandidates);
  }

  /* ── Montant total ────────────────────────────────────────────────────
   *  \d{2,3} : montants à 2 ou 3 décimales (44,975 € = 3 décimales)
   *
   *  ⚠️  "ttc" seul NE DOIT PAS être trigger : "Prix unitaire TTC 1,799"
   *  contient "TTC" mais ce n'est pas un montant total → on l'exclut de
   *  la première alternance et on ne le garde que comme qualificatif après
   *  le mot "total" (ex. "TOTAL TTC 76,61").
   * ─────────────────────────────────────────────────────────────────── */
  const totalPatterns = [
    /* "TOTAL TTC 76,61", "TOTAL 76,61", "MONTANT 76,61", "À PAYER 76,61" */
    /(?:total(?:\s*ttc)?|montant(?:\s*ttc)?|à payer|payé|net\s*à\s*payer)[^\d]*(\d{1,3}[,\.]\d{2,3})\s*€?/i,
    /* "76,61 €" seul (sans label), optionnellement suivi de "TTC" ou "net" */
    /(\d{1,3}[,\.]\d{2,3})\s*€\s*(?:ttc|net)?(?:\s|$)/i,
  ];
  for (const pat of totalPatterns) {
    const m = text.match(pat);
    if (m) { result.montant_total = toFloat(m[1]); break; }
  }
  if (result.montant_total === null && result.litres && result.prix_litre) {
    result.montant_total = Math.round(result.litres * result.prix_litre * 100) / 100;
  }

  /* Fallback ⑥ — total ÷ litres */
  if (result.prix_litre === null && result.litres && result.montant_total) {
    const computed = result.montant_total / result.litres;
    if (computed >= 0.3 && computed <= 3.5) {
      result.prix_litre = Math.round(computed * 1000) / 1000;
    }
  }

  /* ── Type de carburant ────────────────────────────────────────────── */
  for (const [key, val] of Object.entries(FUEL_LABEL_MAP)) {
    if (lower.includes(key)) { result.type_carburant = val; break; }
  }
  if (!result.type_carburant) {
    const mCompo = text.match(/\bSP\s?95[\s-]E10\b|\b95[\s-]E10\b/i);
    if (mCompo) {
      result.type_carburant = 'E10';
    } else {
      const mFuel = text.match(/\b(E85|SP98|SP95|E10|Gazole|GPLc|B7)\b/i);
      if (mFuel) {
        const k = mFuel[1].toUpperCase();
        result.type_carburant = FUEL_LABEL_MAP[k.toLowerCase()]
          || Object.keys(FUEL_CONFIG).find(fk => fk === k)
          || null;
      }
    }
  }

  /* ── Station ──────────────────────────────────────────────────────── */
  const stationKw = [
    'totalenergies', 'total energies', 'leclerc', 'carrefour', 'total',
    'bp ', 'intermarché', 'intermarch', 'auchan', 'super u', 'casino',
    'shell', 'esso', 'nf e-store', 'cora', 'lidl', 'franprix',
    'système u', 'systeme u',
  ];
  for (const kw of stationKw) {
    if (lower.includes(kw)) {
      const line = lines.find(l => l.toLowerCase().includes(kw));
      if (line) { result.station = line; break; }
    }
  }

  /* ── Km compteur ──────────────────────────────────────────────────────
   *
   *  Tickets français : séparateur milliers = espace → "87 450 km"
   *  → les deux groupes sont concaténés : "87" + "450" = 87450
   *
   * ─────────────────────────────────────────────────────────────────── */

  /* Tentative 1 : chiffres contigus + "km" */
  const mKm1 = text.match(/\b(\d{4,6})\s*km\b/i);
  if (mKm1) {
    result.km = parseInt(mKm1[1], 10);
  } else {
    /* Tentative 2 : "87 450 km" — séparateur milliers espace */
    const mKm2 = text.match(/\b(\d{2,3})\s(\d{3})\s*km\b/i);
    if (mKm2) {
      result.km = parseInt(mKm2[1] + mKm2[2], 10);
    } else {
      /* Tentative 3 : libellé + chiffres contigus */
      const mKm3 = text.match(/(?:kilom(?:étrage|ètres?)?|compteur|odom)[^\d]*(\d{4,6})/i);
      if (mKm3) {
        result.km = parseInt(mKm3[1], 10);
      } else {
        /* Tentative 4 : libellé + "87 450" (séparateur espace) */
        const mKm4 = text.match(/(?:kilom(?:étrage|ètres?)?|compteur|odom)[^\d]*(\d{2,3})\s(\d{3})/i);
        if (mKm4) result.km = parseInt(mKm4[1] + mKm4[2], 10);
      }
    }
  }

  /* ── Log de diagnostic (console DevTools) ─────────────────────────── */
  /* eslint-disable no-console */
  console.group('[OCR] Résultat parsing ticket');
  console.log('Texte brut :\n' + text);
  console.log('Résultat :', result);
  console.log('Candidats prix/L :', prixCandidates);
  console.groupEnd();
  /* eslint-enable no-console */

  return result;
}

/* ═══════════════════════════════════════════════════════════════════════
   fillFormFromTicket — Injecter les données dans le formulaire
═══════════════════════════════════════════════════════════════════════ */

function fillFormFromTicket(data) {
  let filled = 0;

  /* ── 1. Type de carburant EN PREMIER ────────────────────────────────
   *
   *  ⚠️  setType() efface fPrix (fp.value = '') et retire 'autofilled'.
   *  Il DOIT être appelé avant de remplir les champs numériques,
   *  sinon le prix saisi depuis le ticket est immédiatement effacé.
   *
   * ─────────────────────────────────────────────────────────────────── */
  if (data.type_carburant) {
    const norm    = data.type_carburant.toLowerCase().trim();
    const fuelKey = FUEL_LABEL_MAP[norm]
      || Object.keys(FUEL_CONFIG).find(k => norm.includes(k.toLowerCase()));
    if (fuelKey && typeof window.setType === 'function') {
      window.setType(fuelKey);   /* réinitialise fPrix → on le remplit ensuite */
      filled++;
    }
  }

  /* ── 2. Date ─────────────────────────────────────────────────────── */
  if (data.date) {
    const el = document.getElementById('fDate');
    if (el) { el.value = data.date; el.classList.add('autofilled'); filled++; }
  }

  /* ── 3. Km ───────────────────────────────────────────────────────── */
  if (data.km && Number(data.km) > 0) {
    const el = document.getElementById('fKm');
    if (el) {
      el.value = Math.round(Number(data.km));
      el.classList.add('autofilled');
      el.dispatchEvent(new Event('input'));
      filled++;
    }
  }

  /* ── 4. Litres ───────────────────────────────────────────────────── */
  if (data.litres && Number(data.litres) > 0) {
    const el = document.getElementById('fLitres');
    if (el) {
      el.value = Number(data.litres).toFixed(2);
      el.classList.add('autofilled');
      el.dispatchEvent(new Event('input'));
      filled++;
    }
  }

  /* ── 5. Prix/L — après setType() pour ne pas être effacé ────────── */
  if (data.prix_litre && Number(data.prix_litre) > 0) {
    const el = document.getElementById('fPrix');
    if (el) {
      el.value = Number(data.prix_litre).toFixed(3);
      el.classList.add('autofilled');
      el.dispatchEvent(new Event('input'));
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

export function initScanner() {
  const btn = document.getElementById('scanTicketBtn');
  if (!btn) return;

  const input   = document.createElement('input');
  input.type    = 'file';
  input.accept  = 'image/*';
  input.style.display = 'none';
  document.body.appendChild(input);

  btn.addEventListener('click', () => input.click());

  input.addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    e.target.value = '';

    const origHTML = btn.innerHTML;
    btn.disabled   = true;
    btn.innerHTML  = '⏳ Préparation…';

    try {
      const blob = await resizeImage(file);

      /* W9 — stocker la photo redimensionnée pour l'envoi avec le plein */
      try {
        const b64 = await blobToBase64(blob);
        if (b64) {
          state._ticketPhoto = b64;
          const indicator = document.getElementById('ticketPhotoIndicator');
          if (indicator) indicator.hidden = false;
        }
      } catch { /* non bloquant */ }

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

      if (!text || text.trim().length < 8) {
        showFeedback('error', 'Scan échoué',
          'Image illisible — essayez une photo plus nette, bien éclairée et bien cadrée.');
        return;
      }

      const parsed = parseOCRText(text);
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
