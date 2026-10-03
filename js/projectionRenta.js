/* ─── W94 — Projection de la date de rentabilité (alignée sur l'Excel J11/L11/J12) ───
   Même calcul que modRentabilite.EnsureProjection (« Suivi Carburant ») :
     • taux moyen  (€/km) = économie brute ÷ (km du dernier plein E85 − km du plein
       précédant le 1er plein E85)                                        (= B13 / R4)
     • taux récent (€/km) = (économie brute − économie cumulée au (N+1)ᵉ plein E85
       depuis la fin) ÷ (km E85 max − km de ce plein) ; repli sur le taux moyen (= R8)
     • rythme (km/j) = (km max − km min) ÷ (date max − date min), tous pleins   (= R9)
     • date A / B = dernière date + (reste ÷ taux) ÷ rythme                (= R12 / S12)
     • affichage = médiane (A+B)/2 ± |A−B|/2 jours ; km cible = médiane des deux (J12).
   N = réglage « Nb pleins récents » (clé P1 `proj_nb_recents`, partagée avec Excel N14).
   Module pur (aucun DOM) → testable et sans cycle d'import. */
import { PROJ_NB_RECENTS_KEY, DEFAULT_PROJ_NB_RECENTS } from './config.js';

const DAY_MS = 86400000;

/** N pleins récents (entier ≥ 0) ; défaut 6 comme Excel. */
export function getProjNbRecents() {
  try {
    const raw = localStorage.getItem(PROJ_NB_RECENTS_KEY);
    const n = Number(raw);
    if (raw != null && raw !== '' && isFinite(n) && n >= 0) return Math.floor(n);
  } catch { /* stockage indisponible */ }
  return DEFAULT_PROJ_NB_RECENTS;
}

function dayOf(r) {
  const s = String(r.Date || r.Horodatage || '').trim().slice(0, 10);
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  return m ? Date.UTC(+m[1], +m[2] - 1, +m[3]) : NaN;
}

const kmOf = r => Number(r['Km compteur']) || 0;
const isE85 = r => /e85|ethanol/i.test(String(r.Type || ''));

/**
 * @param {object[]} records  pleins du périmètre (véhicule courant ou tous)
 * @param {{econBrute:number, cout:number, n:number, ecoOf:(r:object)=>number|undefined}} p
 * @returns {null | {atteint:boolean, date:Date, margeJours:number, kmCible:number,
 *                   tauxMoyen:number, tauxRecent:number, rythmeKmJ:number, n:number}}
 */
export function computeProjectionRenta(records, { econBrute, cout, n, ecoOf }) {
  const rows = (records || [])
    .map(r => ({ r, km: kmOf(r), day: dayOf(r) }))
    .filter(x => x.km > 0 && !isNaN(x.day))
    .sort((a, b) => a.day - b.day || a.km - b.km);
  const e85 = rows.filter(x => isE85(x.r));
  if (!e85.length || !(cout > 0)) return null;

  const kmE85Max = Math.max(...e85.map(x => x.km));
  const kmMax    = Math.max(...rows.map(x => x.km));
  const kmMin    = Math.min(...rows.map(x => x.km));
  const dayMax   = Math.max(...rows.map(x => x.day));
  const dayMin   = Math.min(...rows.map(x => x.day));
  const reste    = Math.max(0, cout - econBrute);

  if (reste === 0) {
    return { atteint: true, date: new Date(dayMax), margeJours: 0, kmCible: kmMax,
             tauxMoyen: 0, tauxRecent: 0, rythmeKmJ: 0, n };
  }

  // Taux moyen : depuis le plein qui précède le 1er plein E85 (pose du kit).
  const iFirst  = rows.indexOf(e85[0]);
  const kmStart = iFirst > 0 ? rows[iFirst - 1].km : e85[0].km;
  const tauxMoyen = kmE85Max - kmStart > 0 ? econBrute / (kmE85Max - kmStart) : 0;
  if (!(tauxMoyen > 0)) return null;

  // Économie cumulée au fil des pleins E85 (ordre chronologique).
  let cum = 0;
  const cumAt = new Map();
  e85.forEach(x => {
    const e = Number(ecoOf ? ecoOf(x.r) : 0);
    if (isFinite(e)) cum += e;
    cumAt.set(x, cum);
  });

  // (N+1)ᵉ plus grand km E85 ; repli = plus petit km E85 (Excel : LARGE / MINIFS).
  const parKm = [...e85].sort((a, b) => b.km - a.km);
  const ref = parKm[n] || parKm[parKm.length - 1];
  const dKm = kmE85Max - ref.km;
  const tR  = dKm > 0 ? (econBrute - cumAt.get(ref)) / dKm : 0;
  const tauxRecent = tR > 0 ? tR : tauxMoyen;

  const rythmeKmJ = dayMax > dayMin ? (kmMax - kmMin) / ((dayMax - dayMin) / DAY_MS) : 0;
  if (!(rythmeKmJ > 0)) return null;

  const dA = dayMax + (reste / tauxMoyen / rythmeKmJ) * DAY_MS;
  const dB = dayMax + (reste / tauxRecent / rythmeKmJ) * DAY_MS;
  return {
    atteint: false,
    date: new Date(Math.floor((dA + dB) / 2 / DAY_MS) * DAY_MS),   // jour entamé (= affichage Excel J11)
    margeJours: Math.round(Math.abs(dA - dB) / 2 / DAY_MS),
    kmCible: kmMax + ((reste / tauxMoyen) + (reste / tauxRecent)) / 2,
    tauxMoyen, tauxRecent, rythmeKmJ, n,
  };
}
