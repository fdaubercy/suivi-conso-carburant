/* ─── W17 — Scan ticket de caisse → auto-complétion du formulaire ─── */
import { GAS_URL, FUEL_CONFIG } from './config.js';
import { showFeedback } from './ui.js';

/**
 * Mapping libellés OCR → clés FUEL_CONFIG.
 * L'IA retourne normalement : "E85", "SP98", "SP95", "E10", "Gazole", "GPLc".
 */
const FUEL_LABEL_MAP = {
  'e85': 'E85', 'superethanol': 'E85', 'superéthanol': 'E85', 'ethanol': 'E85',
  'sp98': 'SP98', 'super 98': 'SP98', 'super98': 'SP98', 'super98 v-power': 'SP98',
  'sp95': 'SP95', 'sans plomb 95': 'SP95', 'sans-plomb 95': 'SP95',
  'e10': 'E10', 'sans plomb e10': 'E10', 'sans-plomb e10': 'E10',
  'gazole': 'GAZOLE', 'diesel': 'GAZOLE', 'b7': 'GAZOLE',
  'gplc': 'GPLC', 'gpl': 'GPLC', 'gaz de pétrole liquéfié': 'GPLC',
};

/**
 * Réduit l'image via canvas (max 1 200 px, JPEG ≤ 800 Ko) avant envoi GAS.
 * @param {File} file
 * @returns {Promise<string|null>} dataURL compressée ou null en cas d'erreur
 */
async function compressImage(file) {
  return new Promise((resolve) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      const canvas = document.createElement('canvas');
      const MAX_PX = 1200;
      let { width, height } = img;
      if (width > MAX_PX || height > MAX_PX) {
        const r = Math.min(MAX_PX / width, MAX_PX / height);
        width  = Math.round(width  * r);
        height = Math.round(height * r);
      }
      canvas.width  = width;
      canvas.height = height;
      canvas.getContext('2d').drawImage(img, 0, 0, width, height);
      // Tente q=0.85 → 0.70 → 0.55 → 0.40 jusqu'à ≤ 800 Ko
      const tryQ = (q) => {
        const dataURL = canvas.toDataURL('image/jpeg', q);
        if (dataURL.length * 0.75 / 1024 <= 800 || q <= 0.40) return resolve(dataURL);
        tryQ(q - 0.15);
      };
      tryQ(0.85);
    };
    img.onerror = () => { URL.revokeObjectURL(url); resolve(null); };
    img.src = url;
  });
}

/**
 * Pré-remplit les champs du formulaire avec les données extraites du ticket.
 * @param {Object} data - Résultat parsé retourné par GAS/Gemini
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

  // Type de carburant
  if (data.type_carburant) {
    const norm    = data.type_carburant.toLowerCase().trim();
    const fuelKey = FUEL_LABEL_MAP[norm]
      || Object.keys(FUEL_CONFIG).find(k => norm.includes(k.toLowerCase()));
    if (fuelKey && typeof window.setType === 'function') {
      window.setType(fuelKey);
      filled++;
    }
  }

  // Station — correspondance partielle dans le dropdown
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

/**
 * Initialise le bouton "Scanner le ticket" et l'input file caché.
 * À appeler depuis main.js après le chargement du DOM.
 */
export function initScanner() {
  const btn = document.getElementById('scanTicketBtn');
  if (!btn) return;

  // Input file caché (accepte galerie + caméra sur mobile)
  const input   = document.createElement('input');
  input.type    = 'file';
  input.accept  = 'image/*';
  input.style.display = 'none';
  document.body.appendChild(input);

  btn.addEventListener('click', () => input.click());

  input.addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    e.target.value = ''; // permet de re-sélectionner le même fichier

    const origHTML = btn.innerHTML;
    btn.innerHTML  = '⏳ Analyse…';
    btn.disabled   = true;

    try {
      const compressed = await compressImage(file);
      if (!compressed) throw new Error('Impossible de lire l\'image');

      const [, pureBase64] = compressed.split(',');

      const resp = await fetch(GAS_URL, {
        method: 'POST',
        redirect: 'follow',
        body: JSON.stringify({
          action: 'scanTicket',
          imageBase64: pureBase64,
          mimeType: 'image/jpeg',
        }),
      }).then(r => r.json());

      if (resp.success && resp.data) {
        fillFormFromTicket(resp.data);
      } else {
        showFeedback('error', 'Scan échoué', resp.error || 'Réessayez avec une photo plus nette.');
      }
    } catch (err) {
      showFeedback('error', 'Erreur réseau', err.message || 'Connexion impossible.');
    } finally {
      btn.innerHTML = origHTML;
      btn.disabled  = false;
    }
  });
}
