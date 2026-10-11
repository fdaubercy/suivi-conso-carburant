/* ─── W97 — Contrôle et fusion des lectures du scanner (pompe, compteur, ticket) ───
 *  Module PUR (aucun accès DOM ni localStorage) : reçoit la réponse de l'action
 *  GAS scanPhotos et le contexte du formulaire, renvoie les valeurs à remplir,
 *  leur source et les alertes à afficher sous les champs.
 *  Spéc : docs/superpowers/specs/2026-10-11-scan-pompe-compteur-design.md §4
 * ──────────────────────────────────────────────────────────────────────────── */

import { FUEL_CONFIG } from './config.js';
import { matchType } from './refmodel.js';

export const ECART_SOURCES    = 0.02;   // R1 — pompe vs ticket
export const TOL_TRIPLET_EUR  = 0.05;   // R2 — tolérance absolue (€)
export const TOL_TRIPLET_REL  = 0.01;   // R2 — tolérance relative
export const TYPE_ECART_MAX   = 0.08;   // R3 — écart max du candidat retenu
export const TYPE_RATIO_2E    = 2;      // R3 — le 2ᵉ candidat doit être 2× plus éloigné
export const TYPE_LU_TOL      = 0.15;   // R3 — type lu compatible avec le prix
export const PRIX_STATION_TOL = 0.10;   // R5 — prix lu vs prix station
export const KM_TRIP_RATIO    = 0.10;   // R4 — km < 10 % du dernier → TRIP
export const DIST_MIN_RATIO   = 0.5;    // R4 — distance mini / attendue
export const DIST_MAX_RATIO   = 1.6;    // R4 — distance maxi / attendue
export const MEDIANE_JOURS    = 90;     // R3 — fenêtre de la médiane des prix payés

/* [champ, décimales d'affichage] — lus sur la pompe (prioritaire) ou le ticket */
const CHAMPS_POMPE = [['litres', 2], ['prix_litre', 3], ['montant_total', 2]];
const CHAMPS_NUM   = ['km', 'litres', 'prix_litre', 'montant_total'];
const CHAMPS_FUSION = ['date', 'km', 'litres', 'prix_litre', 'montant_total', 'type_carburant', 'enseigne', 'ville', 'station'];

const num      = v => (typeof v === 'number' && isFinite(v) && v > 0) ? v : null;
const virgule  = (n, d) => n.toFixed(d).replace('.', ',');
const milliers = n => String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
const vide     = v => v === null || v === undefined || v === '';

function ajouterAlerte(alertes, champ, msg) {
  alertes[champ] = alertes[champ] ? alertes[champ] + ' · ' + msg : msg;
}

/** Libellé de carburant lu par l'IA → clé FUEL_CONFIG (null si inconnu). */
export function cleTypeLu(texte) {
  if (!texte) return null;
  const t = String(texte).toUpperCase().replace(/\s+/g, '');
  if (t.includes('E85') || t.includes('ETHANOL')) return 'E85';
  if (t.includes('E10')) return 'E10';
  if (t.includes('98')) return 'SP98';
  if (t.includes('95')) return 'SP95';
  if (t.includes('GAZOLE') || t.includes('DIESEL') || t.includes('GASOIL') || t.includes('B7')) return 'GAZOLE';
  if (t.includes('GPL')) return 'GPLC';
  return null;
}

/** Première valeur non vide du champ parmi les photos du type demandé. */
function premiere(photos, kind, champ) {
  for (const p of photos) {
    if (!p || p.kind !== kind || !p.valeurs) continue;
    if (!vide(p.valeurs[champ])) return p.valeurs[champ];
  }
  return null;
}

/* ── R1 — priorité des sources ─────────────────────────────────────── */
function fusionner(reponse, alertes) {
  const photos = Array.isArray(reponse?.photos) ? reponse.photos : [];
  const v = {};
  const s = {};

  if (!photos.length) {
    const f = reponse?.fusion || {};
    CHAMPS_FUSION.forEach(k => {
      const val = CHAMPS_NUM.includes(k) ? num(f[k]) : (vide(f[k]) ? null : f[k]);
      if (val !== null) { v[k] = k === 'km' ? Math.round(val) : val; s[k] = 'ticket'; }
    });
    return { v, s };
  }

  CHAMPS_POMPE.forEach(([k, d]) => {
    const p = num(premiere(photos, 'pompe', k));
    const t = num(premiere(photos, 'ticket', k));
    if (p !== null) {
      v[k] = p; s[k] = 'pompe';
      if (t !== null && Math.abs(p - t) / t > ECART_SOURCES) {
        ajouterAlerte(alertes, k, `pompe et ticket diffèrent (${virgule(p, d)} / ${virgule(t, d)})`);
      }
    } else if (t !== null) {
      v[k] = t; s[k] = 'ticket';
    }
  });

  const kmC = num(premiere(photos, 'compteur', 'km'));
  const kmT = num(premiere(photos, 'ticket', 'km'));
  if (kmC !== null)      { v.km = Math.round(kmC); s.km = 'compteur'; }
  else if (kmT !== null) { v.km = Math.round(kmT); s.km = 'ticket'; }

  ['date', 'enseigne', 'ville', 'station'].forEach(k => {
    const t = premiere(photos, 'ticket', k);
    if (t !== null) { v[k] = t; s[k] = 'ticket'; }
  });

  const typeP = premiere(photos, 'pompe', 'type_carburant');
  const typeT = premiere(photos, 'ticket', 'type_carburant');
  if (typeP !== null)      { v.type_carburant = typeP; s.type_carburant = 'pompe'; }
  else if (typeT !== null) { v.type_carburant = typeT; s.type_carburant = 'ticket'; }

  return { v, s };
}

/* ── R2 — litres × prix = montant ──────────────────────────────────── */
function controlerTriplet(v, s, alertes) {
  const L = num(v.litres);
  const P = num(v.prix_litre);
  const M = num(v.montant_total);
  if (L && P && M) {
    const calc = L * P;
    if (Math.abs(calc - M) > Math.max(TOL_TRIPLET_EUR, TOL_TRIPLET_REL * M)) {
      const msg = `${virgule(L, 2)} × ${virgule(P, 3)} = ${virgule(calc, 2)} € ≠ ${virgule(M, 2)} € lus`;
      ajouterAlerte(alertes, 'litres', msg);
      ajouterAlerte(alertes, 'montant_total', msg);
    }
  } else if (L && P) {
    v.montant_total = Math.round(L * P * 100) / 100;   s.montant_total = 'calcul';
  } else if (L && M) {
    v.prix_litre = Math.round(M / L * 1000) / 1000;    s.prix_litre = 'calcul';
  } else if (P && M) {
    v.litres = Math.round(M / P * 100) / 100;          s.litres = 'calcul';
  }
}

/* ── R3 — type de carburant ────────────────────────────────────────── */
function mediane(xs) {
  const a = [...xs].sort((x, y) => x - y);
  const m = Math.floor(a.length / 2);
  return a.length % 2 ? a[m] : (a[m - 1] + a[m]) / 2;
}

function dateDe(r) {
  return new Date(String(r.Date || r.Horodatage || '').replace(' ', 'T'));
}

/** Référence de prix d'un carburant : prix station, sinon médiane 90 j du véhicule. */
function refDe(cle, ctx) {
  const st = num(Number((ctx.stationPrices || {})[cle]));
  if (st) return st;
  const limite = (ctx.aujourdHui || new Date()).getTime() - MEDIANE_JOURS * 86400000;
  const prix = (ctx.historiqueVehicule || [])
    .filter(r => matchType(r.Type, cle) && dateDe(r).getTime() >= limite)
    .map(r => num(Number(r['Prix €/L'])))
    .filter(Boolean);
  return prix.length ? mediane(prix) : null;
}

/** Candidats : carburants affichés par la station (sinon tous), restreints à ceux du véhicule. */
function candidats(ctx) {
  const station = ctx.stationPrices || {};
  const hist = ctx.historiqueVehicule || [];
  const cles = Object.keys(FUEL_CONFIG);
  let base = cles.filter(k => num(Number(station[k])));
  if (!base.length) base = cles;
  const utilises = cles.filter(k => hist.some(r => matchType(r.Type, k)));
  if (utilises.length) {
    const inter = base.filter(k => utilises.includes(k));
    if (inter.length) base = inter;
  }
  return base;
}

function choisirType(v, s, alertes, ctx) {
  const P = num(v.prix_litre);
  const lu = cleTypeLu(v.type_carburant);
  const srcLu = s.type_carburant;
  delete v.type_carburant;
  delete s.type_carburant;

  let deduit = null;
  if (P) {
    const classes = candidats(ctx)
      .map(k => ({ k, ref: refDe(k, ctx) }))
      .filter(c => c.ref)
      .map(c => ({ k: c.k, ecart: Math.abs(P - c.ref) / c.ref }))
      .sort((a, b) => a.ecart - b.ecart);
    const [b1, b2] = classes;
    if (b1 && b1.ecart <= TYPE_ECART_MAX
        && (!b2 || (b2.ecart >= TYPE_RATIO_2E * b1.ecart && b2.ecart > b1.ecart))) {
      deduit = b1.k;
    }
  }

  if (lu) {
    const ref = P ? refDe(lu, ctx) : null;
    if (!ref || Math.abs(P - ref) / ref <= TYPE_LU_TOL) {
      v.type_carburant = lu;
      s.type_carburant = srcLu;
      return;
    }
    ajouterAlerte(alertes, 'type_carburant', `type lu (${FUEL_CONFIG[lu].short}) incompatible avec ${virgule(P, 3)} €/L`);
  }

  if (deduit) {
    v.type_carburant = deduit;
    s.type_carburant = 'deduit';
    if (!lu) ajouterAlerte(alertes, 'type_carburant', `type déduit du prix (${virgule(P, 3)} €/L → ${FUEL_CONFIG[deduit].short})`);
    return;
  }
  if (P || lu) ajouterAlerte(alertes, 'type_carburant', 'type à vérifier');
}

/* ── R4 — kilométrage ──────────────────────────────────────────────── */
function controlerKm(v, alertes, ctx, typeFinal) {
  const km = num(v.km);
  const dernier = num(ctx.dernierKm);
  if (!km || !dernier) return;
  if (km < KM_TRIP_RATIO * dernier) { ajouterAlerte(alertes, 'km', 'compteur partiel (TRIP) lu ?'); return; }
  if (km <= dernier) { ajouterAlerte(alertes, 'km', `inférieur ou égal au dernier plein (${milliers(dernier)} km)`); return; }
  const L = num(v.litres);
  const conso = num((ctx.consoParType || {})[typeFinal]);
  if (!L || !conso) return;
  const attendu = L / conso * 100;
  const dist = km - dernier;
  if (dist < DIST_MIN_RATIO * attendu || dist > DIST_MAX_RATIO * attendu) {
    ajouterAlerte(alertes, 'km',
      `${milliers(dist)} km pour ${virgule(L, 1)} L : improbable (≈ ${milliers(Math.round(attendu / 10) * 10)} km attendus)`);
  }
}

/* ── R5 — prix plausible ───────────────────────────────────────────── */
function controlerPrixStation(v, alertes, ctx, typeFinal) {
  const P = num(v.prix_litre);
  const ref = num(Number((ctx.stationPrices || {})[typeFinal]));
  if (P && ref && Math.abs(P - ref) / ref > PRIX_STATION_TOL) {
    ajouterAlerte(alertes, 'prix_litre', `différent du prix affiché par la station (${virgule(ref, 3)} €)`);
  }
}

/** Fusionne et contrôle les lectures du scanner (R1 à R5). */
export function analyserScan(reponse, contexte = {}) {
  const alertes = {};
  const { v, s } = fusionner(reponse, alertes);
  controlerTriplet(v, s, alertes);
  choisirType(v, s, alertes, contexte);
  const typeFinal = v.type_carburant || contexte.typeCourant;
  controlerKm(v, alertes, contexte, typeFinal);
  controlerPrixStation(v, alertes, contexte, typeFinal);
  const photos = Array.isArray(reponse?.photos) ? reponse.photos : [];
  const resume = photos.map(p => ({ index: p.index, kind: p.kind, lisible: !!p.lisible, remarque: p.remarque || null }));
  return { valeurs: v, sources: s, alertes, resume };
}

const NOM_KIND = { pompe: 'pompe', compteur: 'compteur', ticket: 'ticket' };

/** « 3 photos analysées : pompe ✓, compteur ✓, ticket ✓ — 6 champs pré-remplis, 1 à vérifier » */
export function formaterBilan(resume, remplis, nbAlertes) {
  const n = resume.length;
  const pl = (k, mot) => mot + (k > 1 ? 's' : '');
  const photos = resume.map(p => `${NOM_KIND[p.kind] || 'photo ?'} ${p.lisible ? '✓' : '✗'}`).join(', ');
  const tete = n ? `${n} ${pl(n, 'photo')} ${pl(n, 'analysée')} : ${photos}` : 'Analyse terminée';
  const champs = `${remplis} ${pl(remplis, 'champ')} ${pl(remplis, 'pré-rempli')}`;
  return nbAlertes ? `${tete} — ${champs}, ${nbAlertes} à vérifier` : `${tete} — ${champs}`;
}
