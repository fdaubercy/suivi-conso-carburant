/* ═══════════════════════════════════════════════════════════════════════
   depenses.js — W91 · Dépenses d'entretien & coûts de conversion PAR VÉHICULE

   Deux données, toutes deux rattachées au véhicule courant :

   1. Coûts de conversion FIXES (boîtier, pose, carte grise, assurance, aide).
      Historiquement des scalaires GLOBAUX (clés COUT_*_KEY, synchro Excel).
      Désormais surchargeables par véhicule via CONV_BY_VEH_KEY, avec REPLI
      sur la valeur globale legacy tant qu'un véhicule n'a pas sa propre valeur
      (non destructif : les valeurs déjà saisies/synchronisées restent le défaut).

   2. Dépenses d'entretien : liste éditable (intitulé + montant + date +
      catégorie), ajoutable au fil de l'eau. Total automatique par véhicule,
      intégré au coût total de conversion (calcul de rentabilité).

   Stockage local + synchro Sheet (LWW par `id`, tombstone `supprime`).
   Protections : la suppression garde le MONTANT sur la tombstone (restauration
   sans perte, cf. restoreDepense) ; toute date reçue en ISO UTC (« …T22:00:00.000Z »,
   cellule Date du Sheet) est ramenée à une date LOCALE yyyy-mm-dd.
   Rendu UI : js/depensesUI.js.
   ═══════════════════════════════════════════════════════════════════════ */

import { DEPENSES_KEY, CONV_BY_VEH_KEY, DEPENSE_CATEGORIES,
         KIT_PRIX_KEY, COUT_POSE_KEY, COUT_CARTEGRISE_KEY,
         SURCOUT_ASSURANCE_KEY, AIDE_DEDUITE_KEY, DEFAULT_KIT_PRIX,
         GAS_URL, APP_TOKEN } from './config.js';
import { state } from './state.js';
import { getIdToken, isAuthed, authEnabled } from './auth.js';

/* ─── Postes de coût de conversion FIXES (par véhicule, repli global) ─── */
export const CONV_FIELDS = [
  { field: 'kit_prix',          legacy: KIT_PRIX_KEY,          def: DEFAULT_KIT_PRIX },
  { field: 'cout_pose',         legacy: COUT_POSE_KEY,         def: 0 },
  { field: 'cout_carte_grise',  legacy: COUT_CARTEGRISE_KEY,   def: 0 },
  { field: 'surcout_assurance', legacy: SURCOUT_ASSURANCE_KEY, def: 0 },
  { field: 'aide_deduite',      legacy: AIDE_DEDUITE_KEY,      def: 0 },
];
const CONV_BY_FIELD = Object.fromEntries(CONV_FIELDS.map(d => [d.field, d]));

function _convMap() {
  try { return JSON.parse(localStorage.getItem(CONV_BY_VEH_KEY) || '{}') || {}; }
  catch { return {}; }
}
function _saveConvMap(m) {
  try { localStorage.setItem(CONV_BY_VEH_KEY, JSON.stringify(m)); } catch { /* quota */ }
}
function _vehKey(veh) { return veh || '__global__'; }
function _isValidNum(v) { const n = Number(v); return v !== '' && v != null && isFinite(n) && n >= 0; }

/** Override par véhicule d'un poste, ou null si absent. */
function _override(field, veh) {
  const per = _convMap()[_vehKey(veh)];
  return per && _isValidNum(per[field]) ? Number(per[field]) : null;
}

/**
 * Valeur d'un poste de conversion pour un véhicule :
 *   override véhicule → valeur globale legacy → défaut du poste.
 */
export function getConvField(field, veh = state.currentVehiculeNom) {
  const d = CONV_BY_FIELD[field];
  if (!d) return 0;
  const ov = _override(field, veh);
  if (ov != null) return ov;
  const raw = localStorage.getItem(d.legacy);
  if (_isValidNum(raw)) return Number(raw);
  return d.def;
}

/**
 * Valeur à AFFICHER dans le champ de saisie : vide si aucune valeur explicite
 * (ni override véhicule ni legacy global) — sauf kit_prix qui montre son défaut.
 */
export function convInputValue(field, veh = state.currentVehiculeNom) {
  const d = CONV_BY_FIELD[field];
  if (!d) return '';
  if (_override(field, veh) != null) return getConvField(field, veh);
  if (_isValidNum(localStorage.getItem(d.legacy))) return getConvField(field, veh);
  return field === 'kit_prix' ? d.def : '';
}

/**
 * Écrit/efface l'override d'un poste pour un véhicule.
 * value '' / null / négatif = efface l'override (repli sur global/défaut).
 * value 0 = zéro EXPLICITE conservé.
 */
export function setConvField(field, veh, value) {
  if (!CONV_BY_FIELD[field]) return;
  const m = _convMap();
  const k = _vehKey(veh);
  const bucket = m[k] || {};
  if (value === '' || value == null || !isFinite(Number(value)) || Number(value) < 0) {
    delete bucket[field];
  } else {
    bucket[field] = Number(value);
  }
  if (Object.keys(bucket).length) m[k] = bucket; else delete m[k];
  _saveConvMap(m);
}

/* ─── Dates : normalisation en date LOCALE yyyy-mm-dd ─── */
const _p2 = n => String(n).padStart(2, '0');
const _localDay = d => d.getFullYear() + '-' + _p2(d.getMonth() + 1) + '-' + _p2(d.getDate());

/**
 * Ramène une date de dépense à 'yyyy-mm-dd' (jour LOCAL).
 *   '2026-09-05'               → inchangée
 *   '2026-09-04T22:00:00.000Z' → '2026-09-05' (en Europe/Paris : composants locaux)
 *   '05/09/2026'               → '2026-09-05'
 *   Date                       → composants locaux
 * Valeur vide → '' ; valeur illisible → renvoyée telle quelle (jamais perdue).
 */
export function normaliserDateDepense(v) {
  if (v == null || v === '') return '';
  if (v instanceof Date) return isNaN(v.getTime()) ? '' : _localDay(v);
  const s = String(v).trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  const fr = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (fr) return fr[3] + '-' + _p2(fr[2]) + '-' + _p2(fr[1]);
  if (/^\d{4}-\d{2}-\d{2}[T ]/.test(s)) {
    const d = new Date(s);
    if (!isNaN(d.getTime())) return _localDay(d);
  }
  return s;
}

/* ─── Dépenses d'entretien (liste) ─── */
/** Lit la liste locale ; répare au passage les dates ISO héritées (persisté une fois). */
function _list() {
  let a;
  try { a = JSON.parse(localStorage.getItem(DEPENSES_KEY) || '[]'); }
  catch { return []; }
  if (!Array.isArray(a)) return [];
  let repaired = false;
  a.forEach(d => {
    if (!d || d.date == null || d.date === '') return;
    const n = normaliserDateDepense(d.date);
    if (n !== d.date) { d.date = n; repaired = true; }
  });
  if (repaired) _saveList(a);
  return a;
}
function _saveList(a) {
  try { localStorage.setItem(DEPENSES_KEY, JSON.stringify(a)); } catch { /* quota */ }
}
function _newId() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 8); }

/** Date du jour au format ISO court (YYYY-MM-DD). */
export function todayISO() {
  const t = new Date();
  return t.getFullYear() + '-' + String(t.getMonth() + 1).padStart(2, '0')
       + '-' + String(t.getDate()).padStart(2, '0');
}

/** Toutes les dépenses brutes (tombstones inclus) — usage sync interne. */
export function getAllDepenses() { return _list(); }

/** Dépenses actives d'un véhicule, triées par date décroissante. */
export function getDepenses(veh = state.currentVehiculeNom) {
  return _list()
    .filter(d => !d.supprime && (d.vehicule || '') === (veh || ''))
    .sort((a, b) => String(b.date || '').localeCompare(String(a.date || '')));
}

/** Total € des dépenses actives d'un véhicule. */
export function getDepensesTotal(veh = state.currentVehiculeNom) {
  return getDepenses(veh).reduce((s, d) => s + (Number(d.montant) || 0), 0);
}

/** Ajoute une dépense (renvoie l'objet créé). */
export function addDepense({ vehicule, date, categorie, intitule, montant }) {
  const item = {
    id: _newId(),
    vehicule: vehicule || '',
    date: date || todayISO(),
    categorie: DEPENSE_CATEGORIES.includes(categorie) ? categorie : DEPENSE_CATEGORIES[0],
    intitule: String(intitule || '').trim(),
    montant: Math.max(0, Number(montant) || 0),
    modifie_le: Date.now(),
    supprime: 0,
  };
  const a = _list();
  a.push(item);
  _saveList(a);
  return item;
}

/** Horodatage strictement postérieur au précédent (LWW : la nouvelle action doit gagner). */
const _nextTs = it => Math.max(Date.now(), (Number(it.modifie_le) || 0) + 1);

/** Suppression logique (tombstone) — propagation sync par `id`. Renvoie l'item.
 *  Le MONTANT est conservé (les totaux filtrent `!supprime`) → restauration sans perte. */
export function removeDepense(id) {
  const a = _list();
  const it = a.find(d => d.id === id);
  if (!it) return null;
  it.supprime = 1;
  it.modifie_le = _nextTs(it);
  _saveList(a);
  return it;
}

/** Restaure une dépense supprimée (tombstone → active). Renvoie l'item, ou null. */
export function restoreDepense(id) {
  const a = _list();
  const it = a.find(d => d.id === id);
  if (!it) return null;
  it.supprime = 0;
  it.modifie_le = _nextTs(it);
  _saveList(a);
  return it;
}

/** Tombstones d'un véhicule (corbeille), suppression la plus récente en tête. */
export function getDepensesSupprimees(veh = state.currentVehiculeNom) {
  return _list()
    .filter(d => d.supprime && (d.vehicule || '') === (veh || ''))
    .sort((a, b) => (Number(b.modifie_le) || 0) - (Number(a.modifie_le) || 0));
}

/* ─── W91b — Synchronisation Sheet (LWW par `id`, tombstone) ─── */
async function _post(body) {
  if (authEnabled() && !isAuthed()) return null;   // pas de push sans compte connecté
  try {
    const resp = await fetch(GAS_URL, {
      method:  'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },   // évite le preflight CORS
      body:    JSON.stringify(body),
    });
    return await resp.json().catch(() => null);
  } catch (e) { console.warn('[Dépenses] push échoué :', e?.message || e); return null; }
}

/** Normalise une dépense venue du serveur (types cohérents). */
function _fromServer(s) {
  return {
    id: String(s.id), vehicule: String(s.vehicule || ''), date: normaliserDateDepense(s.date),
    categorie: DEPENSE_CATEGORIES.includes(s.categorie) ? s.categorie : DEPENSE_CATEGORIES[0],
    intitule: String(s.intitule || ''), montant: Math.max(0, Number(s.montant) || 0),
    modifie_le: Number(s.modifie_le) || 0, supprime: Number(s.supprime) ? 1 : 0,
  };
}

/** Pousse des dépenses (déjà écrites en local) vers le Sheet.
 *  `source: 'app'` est tracé par le journal GAS (onglet Depenses_journal). */
export function pushDepenses(items) {
  if (!items || !items.length) return null;
  return _post({ action: 'setDepenses', depenses: items, source: 'app', token: APP_TOKEN, idToken: getIdToken() });
}

/**
 * Réconciliation complète : pull serveur + LWW par `id`, applique en local les
 * lignes serveur plus récentes, pousse les lignes locales plus récentes/absentes.
 * Émet 'depenses-synced' (detail.changed = true si le local a changé).
 */
export async function syncDepenses() {
  if (!navigator.onLine) return false;
  if (authEnabled() && !isAuthed()) return false;
  let server;
  try {
    const idToken = getIdToken();
    const url = GAS_URL + '?action=getDepenses&token=' + encodeURIComponent(APP_TOKEN)
              + (idToken ? '&idToken=' + encodeURIComponent(idToken) : '');
    const resp = await fetch(url);
    if (!resp.ok) throw new Error('HTTP ' + resp.status);
    server = await resp.json();
  } catch (e) { console.warn('[Dépenses] sync (pull) échouée :', e?.message || e); return false; }

  const srv = {};
  (server?.depenses || []).forEach(d => { if (d && d.id != null) srv[String(d.id)] = d; });

  const local = _list();
  const byId  = {};
  local.forEach(d => { if (d && d.id != null) byId[String(d.id)] = d; });

  let changed = false;
  const toPush = [];

  Object.keys(srv).forEach(id => {
    const s = _fromServer(srv[id]);
    const l = byId[id];
    if (!l) { local.push(s); changed = true; }
    else if (s.modifie_le > (Number(l.modifie_le) || 0)) {
      // Ancienne tombstone serveur à montant 0 (avant la conservation du montant) :
      // on garde le montant local connu pour qu'une restauration ne le perde pas.
      if (s.supprime && !s.montant && Number(l.montant) > 0) s.montant = Number(l.montant);
      Object.assign(l, s); changed = true;
    }
    else if ((Number(l.modifie_le) || 0) > s.modifie_le) { toPush.push(l); }
  });
  local.forEach(l => { if (l && l.id != null && !srv[String(l.id)]) toPush.push(l); });

  if (changed) _saveList(local);
  if (toPush.length) pushDepenses(toPush);

  try { window.dispatchEvent(new window.CustomEvent('depenses-synced', { detail: { changed } })); }
  catch { /* non bloquant */ }
  return changed;
}
