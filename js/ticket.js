/* ─── W17 — Scan ticket de caisse → Gemini Vision + fallback OCR ─────── *
 *                                                                        *
 *  Moteur principal : Gemini 2.0 Flash (vision) via GAS (action=         *
 *  scanTicket) — lit même les tickets froissés/flous, comprend le        *
 *  contexte, renvoie directement un JSON structuré.                      *
 *                                                                        *
 *  Fallback : Tesseract.js 100 % navigateur — utilisé hors-ligne ou      *
 *  si Gemini échoue (clé absente, quota, réseau).                        *
 *                                                                        *
 *  Flux :                                                                *
 *    1. L'utilisateur sélectionne une photo du ticket                    *
 *    2. Redimensionnement couleur → Drive (W9) + envoi Gemini            *
 *    3a. En ligne  → scanWithGemini() → JSON                            *
 *    3b. Échec/hors-ligne → preprocessImage() + Tesseract +              *
 *        parseOCRText() → JSON                                           *
 *    4. fillFormFromTicket() → champs du formulaire pré-remplis           *
 *    5. W9 : base64 de l'image (couleur) stockée dans state._ticketPhoto *
 * ─────────────────────────────────────────────────────────────────────  */

import Tesseract from 'tesseract.js';
import { FUEL_CONFIG, FUEL_SELECT, GAS_URL, APP_TOKEN, PRIX_API } from './config.js';
import { state } from './state.js';
import { showFeedback } from './ui.js';
import { composeStationName, formatVille, getCoords, stationLabel } from './utils.js';
import { fetchPricesAtCoords, fetchPricesNearUser } from './prix.js';
import { cacheStationCoords } from './stationsmap.js';

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
  'superéthanol':     'E85',  'super ethanol': 'E85',
  'se-b5':            'E85',  'ethanol':       'E85',

  /* ── SP98 (E5) ── */
  'sp98-e5':          'SP98', 'sp 98-e5':      'SP98',
  'sans plomb 98-e5': 'SP98', '98-e5':         'SP98',
  'sp98':             'SP98', 'super 98':      'SP98',
  'super98':          'SP98', 'sans plomb 98': 'SP98',
  'sans-plomb 98':    'SP98',

  /* ── SP95-E10 (E10) — AVANT sp95 et e10 ── */
  'sp95-e10':          'E10', 'sp 95-e10':      'E10',
  'sp95 e10':          'E10',
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
  'b10':              'GAZOLE', 'hvo':     'GAZOLE',

  /* ── GPLc ── */
  'gplc':             'GPLC', 'gpl':      'GPLC',
};

/* ─── Mois français → numéro MM (pour dates textuelles) ──────────────── */
const FRENCH_MONTHS = {
  'jan': '01', 'janv': '01', 'janvier': '01',
  'fev': '02', 'fevr': '02', 'fevrier': '02',
  'fév': '02', 'févr': '02', 'février': '02',
  'mar': '03', 'mars': '03',
  'avr': '04', 'avril': '04',
  'mai': '05',
  'juin': '06',
  'jul': '07', 'juil': '07', 'juillet': '07',
  'aou': '08', 'aout': '08', 'août': '08',
  'sep': '09', 'sept': '09', 'septembre': '09',
  'oct': '10', 'octobre': '10',
  'nov': '11', 'novembre': '11',
  'dec': '12', 'déc': '12', 'decembre': '12', 'décembre': '12',
};

/* ─── Helpers ─── */

function toFloat(str) {
  return parseFloat(String(str).replace(',', '.'));
}

/** Corrige les substitutions OCR les plus fréquentes dans les séquences numériques.
 *  N'affecte que les chiffres encadrés par d'autres chiffres → sans risque sur le texte. */
function normalizeNumericText(text) {
  return text
    .replace(/(\d)[Oo](\d)/g, (_, a, b) => `${a}0${b}`)   /* O entre chiffres → 0 */
    .replace(/(\d)[Ss](\d)/g, (_, a, b) => `${a}5${b}`);   /* S entre chiffres → 5 */
}

/** Redimensionne l'image sans traitement chromatique — pour le stockage Drive (couleur conservée). */
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

/** Prétraite l'image pour l'OCR : niveaux de gris + rehaussement contraste + max 1 600 px.
 *  Résolution plus élevée et contraste renforcé améliorent significativement
 *  la lecture du texte sur papier thermique par Tesseract. */
async function preprocessImage(file) {
  return new Promise((resolve) => {
    const MAX_PX    = 1600;
    const img       = new Image();
    const objectUrl = URL.createObjectURL(file);

    img.onload = () => {
      URL.revokeObjectURL(objectUrl);
      let { width, height } = img;

      /* Réduction uniquement — upscaler dégraderait la qualité OCR */
      const ratio = Math.min(MAX_PX / width, MAX_PX / height);
      if (ratio < 1) {
        width  = Math.round(width  * ratio);
        height = Math.round(height * ratio);
      }

      const canvas = document.createElement('canvas');
      canvas.width  = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, width, height);

      /* Conversion niveaux de gris + courbe S de contraste centrée sur 128.
       * Facteur 1,4 : renforce le contraste texte sombre / fond clair (papier thermique). */
      const imageData = ctx.getImageData(0, 0, width, height);
      const d = imageData.data;
      for (let i = 0; i < d.length; i += 4) {
        const gray = Math.round(0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2]);
        const c    = Math.min(255, Math.max(0, (gray - 128) * 1.4 + 128));
        d[i] = d[i + 1] = d[i + 2] = c;
        /* canal alpha inchangé */
      }
      ctx.putImageData(imageData, 0, 0);
      canvas.toBlob(blob => resolve(blob ?? file), 'image/jpeg', 0.92);
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
   scanWithGemini — Moteur principal : Gemini 2.0 Flash via GAS
   Envoie l'image base64 à action=scanTicket, normalise le JSON renvoyé
   pour qu'il ait la même forme que parseOCRText().
═══════════════════════════════════════════════════════════════════════ */

async function scanWithGemini(imageBase64, mimeType) {
  const resp = await fetch(GAS_URL, {
    method:   'POST',
    redirect: 'follow',
    body: JSON.stringify({
      action:      'scanTicket',
      imageBase64,
      mimeType:    mimeType || 'image/jpeg',
      token:       APP_TOKEN,   // S6
    }),
  });

  const json = await resp.json();
  if (!json || !json.success) {
    throw new Error((json && json.error) || 'Réponse Gemini invalide');
  }

  /* Gemini peut renvoyer des nombres sous forme de chaînes → normalisation */
  const d   = json.data || {};
  const num = v => (v === null || v === undefined || v === '') ? null : Number(String(v).replace(',', '.'));

  return {
    date:           d.date || null,
    km:             num(d.km),
    litres:         num(d.litres),
    prix_litre:     num(d.prix_litre),
    montant_total:  num(d.montant_total),
    type_carburant: d.type_carburant || null,
    enseigne:       d.enseigne || null,
    ville:          d.ville || null,
    station:        d.station || null,
  };
}

/* ═══════════════════════════════════════════════════════════════════════
   parseOCRText — Extraire les données métier depuis le texte OCR brut
═══════════════════════════════════════════════════════════════════════ */

export function parseOCRText(rawText) {
  /* Nettoyage minimal */
  const text     = rawText.replace(/\r/g, '').replace(/[ \t]{2,}/g, ' ');
  /* Copie avec corrections de chiffres — utilisée pour les extractions numériques */
  const normText = normalizeNumericText(text);
  const lower    = text.toLowerCase();
  const lines    = text.split('\n').map(l => l.trim()).filter(l => l.length > 1);

  const result = {
    date: null, km: null, litres: null,
    prix_litre: null, montant_total: null,
    type_carburant: null, station: null,
  };

  /* ── Date ─────────────────────────────────────────────────────────── */
  /* Priorité 1 : DD/MM/YYYY ou DD-MM-YYYY */
  const mDate = normText.match(/\b(\d{2})[/-](\d{2})[/-](20\d{2})\b/);
  if (mDate) {
    result.date = `${mDate[3]}-${mDate[2]}-${mDate[1]}`;
  } else {
    /* Priorité 2 : YYYY-MM-DD ou YYYY/MM/DD */
    const mDate2 = normText.match(/\b(20\d{2})[/-](\d{2})[/-](\d{2})\b/);
    if (mDate2) {
      result.date = `${mDate2[1]}-${mDate2[2]}-${mDate2[3]}`;
    } else {
      /* Priorité 3 : DD/MM/YY (année à 2 chiffres → préfixe 20xx) */
      const mDate3 = normText.match(/\b(\d{2})[/-](\d{2})[/-](\d{2})\b/);
      if (mDate3) {
        result.date = `20${mDate3[3]}-${mDate3[2]}-${mDate3[1]}`;
      } else {
        /* Priorité 4 : "15 janvier 2024" / "15 jan 2024" / "15 janv. 2024" */
        const monthAlts = Object.keys(FRENCH_MONTHS)
          .sort((a, b) => b.length - a.length)   /* plus long d'abord */
          .join('|');
        const mDate4 = lower.match(
          new RegExp(`\\b(\\d{1,2})\\s+(${monthAlts})\\.?\\s+(20\\d{2})\\b`)
        );
        if (mDate4) {
          const mm = FRENCH_MONTHS[mDate4[2].replace(/\.$/, '')];
          if (mm) {
            result.date = `${mDate4[3]}-${mm}-${String(parseInt(mDate4[1], 10)).padStart(2, '0')}`;
          }
        }
      }
    }
  }

  /* ── Volume (litres) ──────────────────────────────────────────────── */
  const litresPatterns = [
    /* "42,580 L", "42,58 L", "42,58L" — avec ou sans espace, 2-3 décimales */
    /(\d{1,3}[,.]\d{2,3})\s*(?:litres?|liters?|l\b)/i,
    /* "LITRES 42,580" — libellé avant le nombre */
    /(?:litres?|liters?)\s+(\d{1,3}[,.]\d{2,3})/i,
    /* "Qté : 42,58" / "Quantité 42,58" / "Quantite 42,58" (sans accent OCR) / "Volume 42,58" */
    /(?:qté|quantité|quantite|volume|vol|qt(?:y|é|e)?)[^\d]*(\d{1,3}[,.]\d{2,3})/i,
    /* "42,58 × 1,799" (litres × prix) */
    /(\d{1,3}[,.]\d{2,3})\s*(?:x|×)\s*[01][,.]\d{3}/i,
    /* Ligne débutant par un nombre suivi d'un opérateur × (tickets 2 colonnes) */
    /^(\d{1,3}[,.]\d{2,3})\s*(?:x|×)/m,
  ];
  for (const pat of litresPatterns) {
    const m = normText.match(pat);
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
   *   ⑥  Libellé carburant + X,XXX sur même ligne
   *   ⑦  total ÷ litres
   *
   * ─────────────────────────────────────────────────────────────────── */

  /* Collecte TOUS les candidats prix/L puis prend le max (élimine TICPE etc.) */
  const prixCandidates = [];

  const prixPatterns = [
    /* ① Séparateur X,XXX puis unité — "€" peut être "e","E","£","é" ou absent */
    /([0-3][,.]\d{3})\s*[€e£é]?\s*[/\\|Il]\s*l\b/i,

    /* ② "1,799 euros/L", "euro/L", "eur/L" */
    /([0-3][,.]\d{3})\s*eur(?:os?)?\s*[/\\|Il]\s*l\b/i,

    /* ③ Libellé explicite :
     *   "Prix unitaire TTC : 1,799"  "Prix unit. = 0,849"  "P.U. : 0,798"  "Tarif 1,799" */
    /(?:prix\s*(?:au\s*)?(?:litres?|\/\s*litres?|\/\s*l\b|l\b)|prix\s+unit(?:aire)?\.?|p\.?\s*u\.?|pu\b|tarif)[^\d]*([0-3][,.]\d{3})/i,

    /* ④ "1,799 × 42,58" ou "1,799 x 42,58" (prix × litres) */
    /([0-3][,.]\d{3})\s*(?:x|×)\s*\d{1,3}[,.]\d{2,3}/i,

    /* ⑤ 2 décimales "1,80 €/L" */
    /([0-3][,.]\d{2})\s*[€e£é]?\s*[/\\|Il]\s*l\b/i,

    /* ⑥ Libellé carburant suivi du prix sur la même ligne
     *   Ex : "SuperEthanol E85 0,798"  "Gazole B7 1,749" */
    /(?:e85|superethanol|superéthanol|sp98|sp95|e10|gazole|diesel|gplc)[^\d]{0,20}([0-3][,.]\d{3})/i,
  ];

  for (const pat of prixPatterns) {
    /* .matchAll() pour trouver tous les candidats, pas seulement le premier */
    for (const m of normText.matchAll(new RegExp(pat.source, pat.flags + 'g'))) {
      const v = toFloat(m[1] ?? m[m.length - 1]);
      if (v >= 0.3 && v <= 3.5) prixCandidates.push(v);
    }
  }

  /* Fallback inverse "litres × prix" */
  if (result.litres !== null) {
    const litStr = String(result.litres).replace('.', '[,.]');
    const mCalc  = normText.match(new RegExp(litStr + '\\s*(?:x|×)\\s*([0-3][,\\.][0-9]{2,3})'));
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
    /(?:total(?:\s*ttc)?|montant(?:\s*ttc)?|à payer|payé|net\s*à\s*payer)[^\d]*(\d{1,3}[,.]\d{2,3})\s*€?/i,
    /* "76,61 €" seul (sans label), optionnellement suivi de "TTC" ou "net" */
    /(\d{1,3}[,.]\d{2,3})\s*€\s*(?:ttc|net)?(?:\s|$)/i,
    /* "RÈGLEMENT 76,61" / "SOLDE 76,61" / "TICKET 76,61" (certains TPE) */
    /(?:règlement|reglement|solde)[^\d]*(\d{1,3}[,.]\d{2,3})\s*€?/i,
  ];
  for (const pat of totalPatterns) {
    const m = normText.match(pat);
    if (m) { result.montant_total = toFloat(m[1]); break; }
  }
  if (result.montant_total === null && result.litres && result.prix_litre) {
    result.montant_total = Math.round(result.litres * result.prix_litre * 100) / 100;
  }

  /* Fallback ⑦ — total ÷ litres */
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
    /* Marques longues d'abord pour éviter le court-circuit par "total" */
    'totalenergies', 'total energies', 'total access',
    'leclerc', 'e.leclerc', 'e. leclerc',
    'carrefour', 'intermarché', 'intermarch',
    'auchan', 'géant casino', 'geant casino',
    'super u', 'systeme u', 'système u',
    'casino', 'shell', 'esso',
    'bp ',                      /* espace intentionnel → évite "cbp", "mbp", etc. */
    'avia', 'netto', 'agip', 'gulf',
    'nf e-store', 'cora', 'lidl', 'franprix',
    'total',                    /* en dernier : court-circuiterait les noms ci-dessus */
  ];

  /* Rejette les lignes qui ressemblent à une ligne de prix/montant
   * pour éviter que "TOTAL TTC 76,61" soit capturé comme nom de station. */
  const isPriceLine = /\d{1,3}[,.]\d{2}\s*[€e]?\s*(?:ttc|ht|net)?$/i;

  for (const kw of stationKw) {
    if (lower.includes(kw)) {
      const line = lines.find(l => l.toLowerCase().includes(kw));
      if (line && !isPriceLine.test(line)) {
        result.station = line;
        break;
      }
    }
  }

  /* ── Km compteur ──────────────────────────────────────────────────────
   *
   *  Tickets français : séparateur milliers = espace → "87 450 km"
   *  Certains terminaux utilisent le point    → "87.450 km"
   *  Libellés reconnus : km, kilométrage, compteur, odom, index compteur
   *
   * ─────────────────────────────────────────────────────────────────── */

  /* Tentative 1 : chiffres contigus + "km" */
  const mKm1 = normText.match(/\b(\d{4,6})\s*km\b/i);
  if (mKm1) {
    result.km = parseInt(mKm1[1], 10);
  } else {
    /* Tentative 2 : "87 450 km" — séparateur milliers espace */
    const mKm2 = normText.match(/\b(\d{2,3})\s(\d{3})\s*km\b/i);
    if (mKm2) {
      result.km = parseInt(mKm2[1] + mKm2[2], 10);
    } else {
      /* Tentative 3 : "87.450 km" — séparateur milliers point */
      const mKm3 = normText.match(/\b(\d{2,3})\.(\d{3})\s*km\b/i);
      if (mKm3) {
        result.km = parseInt(mKm3[1] + mKm3[2], 10);
      } else {
        /* Tentative 4 : libellé + chiffres contigus */
        const mKm4 = normText.match(/(?:kilom(?:étrage|ètres?)?|compteur|odom|index)[^\d]*(\d{4,6})/i);
        if (mKm4) {
          result.km = parseInt(mKm4[1], 10);
        } else {
          /* Tentative 5 : libellé + "87 450" (séparateur milliers espace) */
          const mKm5 = normText.match(/(?:kilom(?:étrage|ètres?)?|compteur|odom|index)[^\d]*(\d{2,3})\s(\d{3})/i);
          if (mKm5) result.km = parseInt(mKm5[1] + mKm5[2], 10);
        }
      }
    }
  }

  /* ── Log de diagnostic (console DevTools) ─────────────────────────── */
   
  console.group('[OCR] Résultat parsing ticket');
  console.log('Texte brut :\n' + text);
  console.log('Résultat :', result);
  console.log('Candidats prix/L :', prixCandidates);
  console.groupEnd();
   

  return result;
}

/* ═══════════════════════════════════════════════════════════════════════
   Station reconnue → sélection + recherche des prix carburant
═══════════════════════════════════════════════════════════════════════ */

/** Interroge l'API ODS pour trouver la station de la commune correspondant
 *  à l'enseigne. Retourne ses coordonnées, ou null si aucune station. */
async function _findStationInCommune(enseigne, ville) {
  const cfg = FUEL_CONFIG[state.currentType] || FUEL_CONFIG.E85;
  const q   = String(ville).replace(/['\\]/g, ' ').trim();
  if (!q) return null;

  const resp = await fetch(PRIX_API + '?' + new URLSearchParams({
    where:  `search(ville, '${q}') and ${cfg.apiField} is not null`,
    select: FUEL_SELECT,
    limit:  15,
  }));
  if (!resp.ok) return null;

  const data    = await resp.json();
  const results = (data.results || []).filter(r => getCoords(r));
  if (!results.length) return null;

  const eNeedle = (enseigne || '').toLowerCase();
  const pick = (eNeedle && results.find(r => stationLabel(r).toLowerCase().includes(eNeedle))) || results[0];
  const c = getCoords(pick);
  return { lat: c.lat, lon: c.lon };
}

/** Reporte la station lue dans le formulaire et déclenche les prix carburant.
 *  Ordre de résolution :
 *    1. station déjà présente dans la liste déroulante → sélection + prix GPS
 *    2. enseigne + ville → recherche ODS de la commune → prix de la station
 *    3. sinon → saisie manuelle avec le nom composé "Enseigne - Ville"
 *  Retourne true si un nom de station a été renseigné. */
async function applyTicketStation(data) {
  const sel = document.getElementById('stationSel');
  if (!sel) return false;

  const enseigne = data.enseigne || null;
  const ville    = data.ville || null;
  const station  = data.station || null;

  const display = (enseigne && ville)
    ? composeStationName(enseigne, ville)
    : (station || enseigne || ville || '').trim();
  if (!display) return false;

  const autreField = document.getElementById('autreField');
  const nearbyList = document.getElementById('nearbyList');
  const autre      = document.getElementById('fAutre');

  const dNeedle = display.toLowerCase();
  const eNeedle = (enseigne || station || '').toLowerCase();
  const vNeedle = (formatVille(ville) || '').toLowerCase();

  /* 1. Station déjà connue dans la liste déroulante */
  const match = Array.from(sel.options).find(o => {
    if (!o.value || o.value === '__autre') return false;
    const ov = o.value.toLowerCase();
    return ov.includes(dNeedle) || (eNeedle && ov.includes(eNeedle)) || (vNeedle && ov.includes(vNeedle));
  });
  if (match) {
    sel.value = match.value;
    if (autreField) autreField.classList.add('hidden');
    if (nearbyList) nearbyList.style.display = 'none';
    await fetchPricesNearUser();          /* prix sur les boutons (position GPS) */
    return true;
  }

  /* 2. Recherche ODS de la commune → prix de la station reconnue */
  if (ville) {
    try {
      const hit = await _findStationInCommune(enseigne, ville);
      if (hit) {
        if (!Array.from(sel.options).some(o => o.value === display))
          document.getElementById('knownGroup').appendChild(new Option(display, display));
        sel.value = display;
        if (autreField) autreField.classList.add('hidden');
        if (nearbyList) nearbyList.style.display = 'none';
        cacheStationCoords(display, hit.lat, hit.lon);
        state._selectedLat = hit.lat;
        state._selectedLon = hit.lon;
        await fetchPricesAtCoords(hit.lat, hit.lon, true);   /* prix sur les boutons */
        return true;
      }
    } catch { /* tombe en saisie manuelle */ }
  }

  /* 3. Saisie manuelle avec le nom composé (sans recherche commune sur le nom complet) */
  sel.value = '__autre';
  if (autreField) autreField.classList.remove('hidden');
  if (nearbyList) nearbyList.style.display = 'none';
  if (autre) { autre.value = display; autre.classList.add('autofilled'); }
  return true;
}

/* ═══════════════════════════════════════════════════════════════════════
   fillFormFromTicket — Injecter les données dans le formulaire
═══════════════════════════════════════════════════════════════════════ */

async function fillFormFromTicket(data) {
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

  /* ── 5. Station — AVANT le prix : la recherche de prix station écrase
   *  fPrix (applyPricesResult), donc on résout la station d'abord puis on
   *  réinjecte le prix payé du ticket juste après pour qu'il l'emporte. ── */
  if (await applyTicketStation(data)) filled++;

  /* ── 6. Prix/L EN DERNIER — après setType() ET après la station, pour
   *  ne pas être effacé par l'un ni l'autre. C'est le prix réellement payé. */
  if (data.prix_litre && Number(data.prix_litre) > 0) {
    const el = document.getElementById('fPrix');
    if (el) {
      el.value = Number(data.prix_litre).toFixed(3);
      el.classList.add('autofilled');
      el.dispatchEvent(new Event('input'));
      filled++;
    }
  }

  if (typeof window.computeTriplet === 'function') window.computeTriplet('prix');

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
      /* Photo couleur redimensionnée pour Drive (W9) + envoi Gemini */
      const blob = await resizeImage(file);
      let   b64  = null;

      /* W9 — stocker la photo couleur pour l'envoi avec le plein */
      try {
        b64 = await blobToBase64(blob);
        if (b64) {
          state._ticketPhoto = b64;
          const indicator = document.getElementById('ticketPhotoIndicator');
          if (indicator) indicator.hidden = false;
        }
      } catch { /* non bloquant */ }

      let parsed = null;

      /* ── Moteur principal : Gemini Vision (si en ligne) ── */
      if (navigator.onLine && b64) {
        try {
          btn.innerHTML = '⏳ Analyse IA…';
          parsed = await scanWithGemini(b64, blob.type);
        } catch (gemErr) {
          console.warn('[Gemini] Échec → fallback Tesseract :', gemErr.message);
          parsed = null;
        }
      }

      /* ── Fallback : Tesseract.js local (hors-ligne ou échec Gemini) ── */
      if (!parsed) {
        btn.innerHTML = '⏳ Prétraitement…';
        const ocrBlob = await preprocessImage(file);

        const { data: { text } } = await Tesseract.recognize(ocrBlob, 'fra', {
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

        parsed = parseOCRText(text);
      }

      await fillFormFromTicket(parsed);

    } catch (err) {
      showFeedback('error', 'Erreur scan',
        err.message || 'Impossible de lire l\'image — réessayez.');
    } finally {
      btn.innerHTML = origHTML;
      btn.disabled  = false;
    }
  });
}
