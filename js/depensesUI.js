/* ═══════════════════════════════════════════════════════════════════════
   depensesUI.js — Rendu & interactions des dépenses d'entretien (W91)

   Protections contre la suppression accidentelle :
     • clic poubelle → confirm() « Supprimer « intitulé » (montant) ? »
     • bandeau « Dépense supprimée — Annuler » pendant ~10 s (restauration)
     • corbeille repliable « Dépenses supprimées (N) » avec « Restaurer »
   Données / synchro : js/depenses.js.
   ═══════════════════════════════════════════════════════════════════════ */

import { DEPENSE_CATEGORIES } from './config.js';
import { state } from './state.js';
import { getDepenses, getDepensesTotal, getDepensesSupprimees, addDepense,
         removeDepense, restoreDepense, pushDepenses, todayISO,
         normaliserDateDepense } from './depenses.js';

export const UNDO_DELAY_MS = 10000;

const _fmtEur = n => (Math.round(n * 100) / 100).toLocaleString('fr-FR', {
  minimumFractionDigits: 0, maximumFractionDigits: 2,
}) + ' €';

/** 'yyyy-mm-dd' (ou ISO UTC hérité) → 'jj/mm/aaaa'. */
export function fmtDateDepense(v) {
  const n = normaliserDateDepense(v);
  const m = n.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : n;
}

function _fmtTs(ts) {
  const d = new Date(Number(ts) || 0);
  return Number(ts) > 0 && !isNaN(d.getTime()) ? fmtDateDepense(d) : '';
}

/** Montant affiché d'une tombstone : 0 = ancienne suppression qui l'avait effacé. */
const _montantSuppr = dep => (Number(dep.montant) > 0 ? _fmtEur(Number(dep.montant)) : 'montant inconnu');

function _span(cls, text) {
  const s = document.createElement('span');
  s.className = cls;
  s.textContent = text;
  return s;
}

function _row(dep) {
  const li = document.createElement('li');
  li.className = 'depense-item';
  const main = document.createElement('div');
  main.className = 'depense-main';
  main.append(_span('depense-titre', dep.intitule || '(sans intitulé)'),
              _span('depense-date', fmtDateDepense(dep.date)));

  const del = document.createElement('button');
  del.type = 'button';
  del.className = 'depense-del';
  del.dataset.delId = dep.id;
  del.setAttribute('aria-label', 'Supprimer la dépense « ' + (dep.intitule || 'sans intitulé') + ' »');
  del.textContent = '🗑';

  li.append(_span('depense-cat depense-cat-' + (dep.categorie || 'Autre').toLowerCase(), dep.categorie || 'Autre'),
            main, _span('depense-montant', _fmtEur(Number(dep.montant) || 0)), del);
  return li;
}

function _rowSupprimee(dep) {
  const li = document.createElement('li');
  li.className = 'depense-item depense-item--suppr';
  const main = document.createElement('div');
  main.className = 'depense-main';
  const quand = _fmtTs(dep.modifie_le);
  main.append(_span('depense-titre', dep.intitule || '(sans intitulé)'),
              _span('depense-date', fmtDateDepense(dep.date) + (quand ? ' · supprimée le ' + quand : '')));

  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'depense-restore';
  btn.dataset.restoreId = dep.id;
  btn.setAttribute('aria-label', 'Restaurer la dépense « ' + (dep.intitule || 'sans intitulé') + ' »');
  btn.textContent = 'Restaurer';

  li.append(main, _span('depense-montant', _montantSuppr(dep)), btn);
  return li;
}

function _renderCorbeille(veh) {
  const box   = document.getElementById('depensesCorbeille');
  const list  = document.getElementById('depensesCorbeilleList');
  const count = document.getElementById('depensesCorbeilleCount');
  if (!box || !list) return;
  const items = veh ? getDepensesSupprimees(veh) : [];
  box.hidden = !items.length;
  if (count) count.textContent = String(items.length);
  list.innerHTML = '';
  items.forEach(d => list.appendChild(_rowSupprimee(d)));
}

/** (Re)dessine la liste des dépenses + le total + la corbeille pour un véhicule. */
export function renderDepenses(veh = state.currentVehiculeNom) {
  const list    = document.getElementById('depensesList');
  const totalEl = document.getElementById('depensesTotal');
  const vehLbl  = document.getElementById('depensesVehLabel');
  const addBox  = document.getElementById('depenseAdd');

  if (vehLbl) vehLbl.textContent = veh ? '— ' + veh : '— aucun véhicule sélectionné';
  if (addBox) addBox.classList.toggle('hidden', !veh);

  if (list) {
    list.innerHTML = '';
    const items = getDepenses(veh);
    if (!items.length) {
      const li = document.createElement('li');
      li.className = 'depense-empty';
      li.textContent = veh
        ? 'Aucune dépense enregistrée pour ce véhicule.'
        : 'Sélectionnez un véhicule pour saisir ses dépenses.';
      list.appendChild(li);
    } else {
      items.forEach(d => list.appendChild(_row(d)));
    }
  }
  if (totalEl) totalEl.textContent = _fmtEur(getDepensesTotal(veh));
  _renderCorbeille(veh);
}

function _refreshStats() {
  if (typeof window.renderStats === 'function') window.renderStats();
}

/* ─── Bandeau « Dépense supprimée — Annuler » ─── */
let _undoTimer = null;
let _undoId = null;

export function hideUndo() {
  clearTimeout(_undoTimer);
  _undoTimer = null;
  _undoId = null;
  const box = document.getElementById('depenseUndo');
  if (box) box.hidden = true;
}

function _showUndo(dep) {
  const box = document.getElementById('depenseUndo');
  const msg = document.getElementById('depenseUndoMsg');
  if (!box) return;
  clearTimeout(_undoTimer);
  _undoId = dep.id;
  if (msg) msg.textContent = 'Dépense « ' + (dep.intitule || 'sans intitulé') + ' » supprimée';
  box.hidden = false;
  document.getElementById('depenseUndoBtn')?.focus({ preventScroll: true });
  _undoTimer = setTimeout(hideUndo, UNDO_DELAY_MS);
}

/** Restaure localement, pousse vers le Sheet et rafraîchit l'affichage. */
export function restaurerDepense(id) {
  const it = restoreDepense(id);
  if (!it) return null;
  pushDepenses([it]);
  renderDepenses(state.currentVehiculeNom);
  _refreshStats();
  return it;
}

/** Demande confirmation, supprime (tombstone), pousse et propose l'annulation. */
export function supprimerDepenseAvecConfirmation(dep) {
  if (!dep) return null;
  const libelle = dep.intitule || 'sans intitulé';
  if (!window.confirm('Supprimer « ' + libelle + ' » (' + _fmtEur(Number(dep.montant) || 0) + ') ?')) return null;
  const removed = removeDepense(dep.id);
  if (!removed) return null;
  pushDepenses([removed]);
  renderDepenses(state.currentVehiculeNom);
  _refreshStats();
  _showUndo(removed);
  return removed;
}

/** Câble le mini-formulaire d'ajout, la suppression, l'annulation et la corbeille. À appeler une fois. */
export function initDepensesUI() {
  const cat = document.getElementById('depCategorie');
  if (cat && !cat.options.length) {
    DEPENSE_CATEGORIES.forEach(c => cat.add(new Option(c, c)));
  }
  const dateEl = document.getElementById('depDate');
  if (dateEl && !dateEl.value) dateEl.value = todayISO();

  const addBtn = document.getElementById('depAddBtn');
  if (addBtn && addBtn.dataset.wired !== '1') {
    addBtn.dataset.wired = '1';
    addBtn.addEventListener('click', () => {
      const veh = state.currentVehiculeNom;
      if (!veh) return;
      const intituleEl = document.getElementById('depIntitule');
      const montantEl  = document.getElementById('depMontant');
      const montant = Number(montantEl?.value);
      if (!intituleEl?.value.trim() || !isFinite(montant) || montant <= 0) {
        montantEl?.focus();
        return;
      }
      const created = addDepense({
        vehicule:  veh,
        date:      dateEl?.value || todayISO(),
        categorie: cat?.value,
        intitule:  intituleEl.value,
        montant,
      });
      pushDepenses([created]);   // W91b — propage vers le Sheet
      intituleEl.value = '';
      if (montantEl) montantEl.value = '';
      if (dateEl) dateEl.value = todayISO();
      renderDepenses(veh);
      _refreshStats();   // met à jour l'économie nette / rentabilité
    });
  }

  const list = document.getElementById('depensesList');
  if (list && list.dataset.wired !== '1') {
    list.dataset.wired = '1';
    list.addEventListener('click', e => {
      const btn = e.target.closest('[data-del-id]');
      if (!btn) return;
      const dep = getDepenses(state.currentVehiculeNom).find(d => d.id === btn.dataset.delId);
      supprimerDepenseAvecConfirmation(dep);
    });
  }

  const undoBtn = document.getElementById('depenseUndoBtn');
  if (undoBtn && undoBtn.dataset.wired !== '1') {
    undoBtn.dataset.wired = '1';
    undoBtn.addEventListener('click', () => {
      const id = _undoId;
      hideUndo();
      if (id) restaurerDepense(id);
    });
  }

  const corbeille = document.getElementById('depensesCorbeilleList');
  if (corbeille && corbeille.dataset.wired !== '1') {
    corbeille.dataset.wired = '1';
    corbeille.addEventListener('click', e => {
      const btn = e.target.closest('[data-restore-id]');
      if (!btn) return;
      if (_undoId === btn.dataset.restoreId) hideUndo();
      restaurerDepense(btn.dataset.restoreId);
    });
  }

  renderDepenses(state.currentVehiculeNom);
}
