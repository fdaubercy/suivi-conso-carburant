/* ═══════════════════════════════════════════════════════════════════════
   vehiculesSync.js — Liste des véhicules COMMUNE à tous les appareils

   Problème résolu : la liste était stockée par appareil (localStorage) ; un
   appareil neuf n'avait aucun véhicule → aucune dépense / stat affichée.

   Synchro via l'onglet « Parametres » du Sheet, clé « vehicules », valeur JSON :
     { "v": 1,
       "actifs":    ["Clio", "Kangoo"],          // ordre d'affichage
       "ajoutes":   { "Clio": 1759400000000 },   // nom → epoch ms du dernier AJOUT volontaire
       "supprimes": { "Twingo": 1759300000000 }  // nom → epoch ms de la dernière SUPPRESSION volontaire
     }

   Fusion = ensemble « LWW par élément » (commutative, idempotente) :
     candidats = local ∪ distant ∪ déduits (pleins + dépenses) ∪ clés d'ajoutes
     ajoutes / supprimes = MAX des horodatages par nom, toutes sources confondues
     un nom est actif SAUF si supprimes[nom] > ajoutes[nom] (0 si absent)
   → aucun véhicule n'est jamais perdu par la fusion ; seule une suppression
     volontaire (horodatée) retire un nom, et un ré-ajout plus récent l'annule.
   Un véhicule déduit des données (horodatage implicite 0) ne ressuscite donc
   PAS un véhicule supprimé volontairement.

   Pas de dépendance à historique.js (évite un cycle) : les pleins et dépenses
   sont INJECTÉS par l'appelant (main.js).
   ═══════════════════════════════════════════════════════════════════════ */

import { VEHICULES_SYNC_KEY } from './config.js';
import { state } from './state.js';
import { getVehicules, sauvegarderVehicules, getVehiculesMeta, saveVehiculesMeta,
         _populateVehiculeSelect, _populateGlobalVehiculeSelect,
         setCurrentVehicule, syncVehiculeControls } from './vehicules.js';
import { pushParam } from './parametres.js';

export const VEHICULES_BLOB_VERSION = 1;

const _nom = v => String(v == null ? '' : v).trim();
const _isMap = v => !!v && typeof v === 'object' && !Array.isArray(v);

function _tsMap(m) {
  const out = {};
  if (!_isMap(m)) return out;
  Object.keys(m).forEach(k => {
    const n = _nom(k), t = Number(m[k]);
    if (n && isFinite(t) && t > 0) out[n] = t;
  });
  return out;
}

/** Blob distant (chaîne JSON, objet ou ancien tableau de noms) → { actifs, ajoutes, supprimes }. */
export function parseVehiculesBlob(raw) {
  let b = raw;
  if (typeof b === 'string') {
    try { b = b.trim() ? JSON.parse(b) : null; } catch { b = null; }
  }
  if (Array.isArray(b)) b = { actifs: b };
  if (!_isMap(b)) return { actifs: [], ajoutes: {}, supprimes: {} };
  return {
    actifs:    (Array.isArray(b.actifs) ? b.actifs : []).map(_nom).filter(Boolean),
    ajoutes:   _tsMap(b.ajoutes),
    supprimes: _tsMap(b.supprimes),
  };
}

const _vehOf = r => _nom(r && (r['Véhicule'] ?? r.Vehicule ?? r.vehicule));

/** Noms de véhicules présents dans les pleins et les dépenses (tombstones inclus). */
export function vehiculesDeduits(pleins = [], depenses = []) {
  const set = new Set();
  (pleins || []).forEach(r => { const n = _vehOf(r); if (n) set.add(n); });
  (depenses || []).forEach(d => { const n = _vehOf(d); if (n) set.add(n); });
  return [...set];
}

/** Véhicule du plein le plus récent (Horodatage), sinon de la dépense la plus récente. */
export function dernierVehiculeUtilise(pleins = [], depenses = []) {
  let best = '', bestKey = '';
  (pleins || []).forEach(r => {
    const n = _vehOf(r); const k = String(r?.Horodatage || r?.Date || '');
    if (n && k > bestKey) { best = n; bestKey = k; }
  });
  if (best) return best;
  let bestTs = -1;
  (depenses || []).forEach(d => {
    const n = _vehOf(d); const t = Number(d?.modifie_le) || 0;
    if (n && t > bestTs) { best = n; bestTs = t; }
  });
  return best;
}

/**
 * Fusion PURE de plusieurs sources { actifs?, ajoutes?, supprimes? }.
 * L'ordre des sources fixe l'ordre d'affichage (la 1re = locale).
 * @returns {{v:number, actifs:string[], ajoutes:Object, supprimes:Object}}
 */
export function fusionnerVehicules(sources = []) {
  const ajoutes = {}, supprimes = {}, ordre = [];
  const vu = new Set();
  const cand = n => { n = _nom(n); if (n && !vu.has(n)) { vu.add(n); ordre.push(n); } };
  const maxInto = (dst, src) => Object.keys(src).forEach(k => { if (!(dst[k] >= src[k])) dst[k] = src[k]; });

  (sources || []).forEach(s => {
    if (!s) return;
    (Array.isArray(s.actifs) ? s.actifs : []).forEach(cand);
    const a = _tsMap(s.ajoutes), d = _tsMap(s.supprimes);
    Object.keys(a).forEach(cand);
    maxInto(ajoutes, a);
    maxInto(supprimes, d);
  });

  const actifs = ordre.filter(n => !((supprimes[n] || 0) > (ajoutes[n] || 0)));
  return { v: VEHICULES_BLOB_VERSION, actifs, ajoutes, supprimes };
}

/** Forme canonique (comparaison d'égalité indépendante de l'ordre). */
export function canonVehicules(b) {
  const p = parseVehiculesBlob(b);
  const sortMap = m => Object.fromEntries(Object.keys(m).sort().map(k => [k, m[k]]));
  return JSON.stringify({ actifs: [...p.actifs].sort(), ajoutes: sortMap(p.ajoutes), supprimes: sortMap(p.supprimes) });
}

/**
 * Réconcilie la liste locale avec le Sheet et les données, puis :
 *  — sauvegarde la liste + les horodatages, repeuple les sélecteurs si besoin ;
 *  — pousse la clé « vehicules » si le résultat diffère du dernier blob distant ;
 *  — sélectionne un véhicule si aucun n'est courant (1 seul connu → lui ;
 *    plusieurs et appareil jusqu'ici vide → celui du plein le plus récent).
 * @param {{pleins?:Array, depenses?:Array, serveur?:string|Object}} opts
 *   serveur : valeur brute de la clé « vehicules » lue sur le serveur (source en plus du tampon local).
 */
export function reconcilierVehicules({ pleins = [], depenses = [], serveur } = {}) {
  const avant = getVehicules();
  const meta  = getVehiculesMeta();
  let tampon = null;
  try { tampon = localStorage.getItem(VEHICULES_SYNC_KEY); } catch { tampon = null; }
  const distant = parseVehiculesBlob(tampon);

  const res = fusionnerVehicules([
    { actifs: avant, ajoutes: meta.ajoutes, supprimes: meta.supprimes },
    distant,
    serveur != null ? parseVehiculesBlob(serveur) : null,
    { actifs: vehiculesDeduits(pleins, depenses) },
  ]);

  const listeChangee = JSON.stringify(avant) !== JSON.stringify(res.actifs);
  sauvegarderVehicules(res.actifs);
  saveVehiculesMeta({ ajoutes: res.ajoutes, supprimes: res.supprimes });
  if (listeChangee) {
    _populateVehiculeSelect(res.actifs);
    _populateGlobalVehiculeSelect(res.actifs);
    syncVehiculeControls(state.currentVehiculeNom || '');
  }

  const serveurDiff = serveur != null && canonVehicules(serveur) !== canonVehicules(res);
  let pushed = false;
  if (canonVehicules(distant) !== canonVehicules(res) || serveurDiff) {
    try { localStorage.setItem(VEHICULES_SYNC_KEY, JSON.stringify(res)); } catch { /* quota */ }
    pushParam('vehicules');
    pushed = true;
  }

  let selected = '';
  let cur = state.currentVehiculeNom || '';
  if (cur && !res.actifs.includes(cur) && (res.supprimes[cur] || 0) > (res.ajoutes[cur] || 0)) {
    cur = '';   // supprimé volontairement sur un autre appareil
    if (res.actifs.length !== 1) setCurrentVehicule('');
  }
  if (!cur && res.actifs.length) {
    if (res.actifs.length === 1) selected = res.actifs[0];
    else if (!avant.length) {
      const last = dernierVehiculeUtilise(pleins, depenses);
      if (res.actifs.includes(last)) selected = last;
    }
    if (selected) setCurrentVehicule(selected);
  }
  return { actifs: res.actifs, changed: listeChangee, pushed, selected };
}
