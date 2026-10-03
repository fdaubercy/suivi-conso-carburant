/* ═══════════════════════════════════════════════════════════════════════
   integrite.js — Contrôle d'intégrité des pleins (onglet _ImportGS)

   Flux :
     bouton « Vérifier l'intégrité des données » (⚙️ Réglages)
       → fetchAudit()        : GET ?action=audit (même schéma que l'export)
       → renderAuditHtml()   : résumé + liste des anomalies (fonction PURE)
     bouton « Supprimer cette copie » (dup_contenu / dup_sync_id uniquement)
       → confirm() → deletePlein (sync_id + n° de ligne) → nouvel audit
     section « Dépenses d'entretien » (audit.depenses, onglet Depenses) ;
     bouton « Restaurer » (dep_suppression_recente)
       → confirm() → restoreDepense + push setDepenses → nouvel audit
   Mode « signaler + proposer » : aucune correction automatique.
═══════════════════════════════════════════════════════════════════════ */

import { GAS_URL, APP_TOKEN } from './config.js';
import { getIdToken } from './auth.js';
import { showFeedback } from './ui.js';
import { restoreDepense, pushDepenses, syncDepenses } from './depenses.js';

/** Libellés français des types d'anomalie renvoyés par le GAS. */
export const AUDIT_TYPE_LABELS = {
  entete_fantome:   'Ligne fantôme (en-tête)',
  sync_id_manquant: 'Identifiant manquant',
  dup_sync_id:      'Identifiant en double',
  dup_contenu:      'Plein en double',
  km_non_croissant: 'Kilométrage incohérent',
  date_future:      'Date dans le futur',
  champ_manquant:   'Champ manquant',
  // Dépenses d'entretien (audit.depenses)
  dep_doublon:             'Dépense en double',
  dep_date_invalide:       'Date de dépense invalide',
  dep_montant_invalide:    'Montant de dépense invalide',
  dep_suppression_recente: 'Dépense supprimée récemment',
};

/** Types pour lesquels la suppression d'une copie est proposée. */
const FIXABLE = new Set(['dup_contenu', 'dup_sync_id']);

function esc(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function fmtDay(iso) {
  const m = String(iso || '').match(/^(\d{4})-(\d{2})-(\d{2})/);
  return m ? m[3] + '/' + m[2] + '/' + m[1] : '';
}

function fmtKm(km) {
  const n = Number(km);
  return km !== null && km !== '' && isFinite(n) ? n.toLocaleString('fr-FR') + ' km' : '';
}

function plural(n, word) {
  return n + ' ' + word + (n > 1 ? 's' : '');
}

/** Appelle l'action GAS `audit` (même authentification que l'export :
 *  token APP_TOKEN + idToken du compte). Lève une Error si la réponse
 *  n'est pas exploitable. */
export async function fetchAudit() {
  const idToken = getIdToken();
  const url = GAS_URL + '?action=audit'
    + '&token=' + encodeURIComponent(APP_TOKEN)
    + (idToken ? '&idToken=' + encodeURIComponent(idToken) : '');
  const resp = await fetch(url, { redirect: 'follow' });
  if (!resp.ok) throw new Error('HTTP ' + resp.status);
  const data = await resp.json();
  if (!data || data.success !== true || !Array.isArray(data.issues)) {
    const err = data && data.error;
    throw new Error(err === 'unauthorized' ? 'connexion requise' : (err || 'réponse inattendue du serveur'));
  }
  return data;
}

/** Supprime (soft-delete) UNE copie d'un plein via l'action existante
 *  `deletePlein` ; `row` cible la ligne précise quand le sync_id est dupliqué. */
export async function deleteCopie(syncId, row) {
  const body = { action: 'deletePlein', sync_id: syncId, token: APP_TOKEN, idToken: getIdToken() };
  if (Number(row) > 1) body.row = Number(row);
  const resp = await fetch(GAS_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify(body),
    redirect: 'follow',
  });
  if (!resp.ok) throw new Error('HTTP ' + resp.status);
  const result = await resp.json().catch(() => ({}));
  if (result && result.success === false) throw new Error(result.error || 'suppression refusée');
  return result;
}

function fmtEur(n) {
  const v = Number(n);
  return n !== null && n !== '' && isFinite(v)
    ? v.toLocaleString('fr-FR', { minimumFractionDigits: 0, maximumFractionDigits: 2 }) + ' €' : '';
}

/** HTML de la section « Dépenses d'entretien » (audit.depenses) — fonction PURE. */
export function renderDepensesAuditHtml(dep) {
  if (!dep || typeof dep !== 'object') return '';
  const issues = Array.isArray(dep.issues) ? dep.issues : [];
  const nAct = Number(dep.actives) || 0;
  const nSup = Number(dep.supprimees) || 0;
  const analysed = plural(nAct, 'dépense') + ' active' + (nAct > 1 ? 's' : '')
    + ', ' + nSup + ' supprimée' + (nSup > 1 ? 's' : '');
  const html = '<p class="integ-section">Dépenses d’entretien</p>';
  if (!issues.length) {
    return html + '<p class="integ-summary integ-ok">✓ Aucune anomalie</p>'
      + '<p class="notif-sub">' + esc(analysed) + '.</p>';
  }
  const nErr = issues.filter(i => i.severity === 'error').length;
  const nWarn = issues.length - nErr;
  const detail = [];
  if (nErr)  detail.push(plural(nErr, 'erreur'));
  if (nWarn) detail.push(plural(nWarn, 'avertissement'));
  const items = issues.map(i => {
    const sev   = i.severity === 'error' ? 'error' : 'warn';
    const label = AUDIT_TYPE_LABELS[i.type] || i.type;
    const meta  = [fmtDay(i.date), i.vehicule, i.intitule, fmtEur(i.montant)]
      .filter(Boolean).map(esc).join(' · ');
    const fix = i.type === 'dep_suppression_recente' && i.id
      ? '<button type="button" class="integ-fix integ-restore" data-dep-id="' + esc(i.id) + '"'
        + ' data-desc="' + esc([i.intitule, fmtEur(i.montant)].filter(Boolean).join(' · ')) + '">Restaurer</button>'
      : '';
    return '<li class="integ-item integ-' + sev + '">'
      + '<div class="integ-main">'
      + '<span class="integ-type"><span class="integ-sev">' + (sev === 'error' ? 'Erreur' : 'Avert.') + '</span>' + esc(label) + '</span>'
      + (meta ? '<span class="integ-meta">' + meta + '</span>' : '')
      + '<span class="integ-msg">' + esc(i.message) + '</span>'
      + '</div>' + fix + '</li>';
  }).join('');
  return html + '<p class="integ-summary integ-ko">' + esc(plural(issues.length, 'anomalie')) + ' — ' + esc(detail.join(', ')) + '</p>'
    + '<p class="notif-sub">' + esc(analysed) + '.</p>'
    + '<ul class="integ-list">' + items + '</ul>';
}

/** Restaure une dépense supprimée (tombstone) depuis l'audit, puis la pousse.
 *  Si elle est absente de la liste locale, une synchro préalable la récupère. */
export async function restaurerDepenseAudit(id) {
  let it = restoreDepense(id);
  if (!it) { await syncDepenses(); it = restoreDepense(id); }
  if (!it) throw new Error('dépense introuvable sur cet appareil');
  await pushDepenses([it]);
  try { window.dispatchEvent(new window.CustomEvent('depenses-synced', { detail: { changed: true } })); }
  catch { /* non bloquant */ }
  return it;
}

/** HTML du résultat d'audit (fonction PURE, toute valeur issue du Sheet échappée). */
export function renderAuditHtml(audit) {
  if (!audit) return '';
  return renderPleinsAuditHtml(audit) + renderDepensesAuditHtml(audit.depenses);
}

function renderPleinsAuditHtml(audit) {
  const issues = Array.isArray(audit.issues) ? audit.issues : [];
  const nActive = Number(audit.active) || 0;
  const analysed = plural(nActive, 'plein') + ' actif' + (nActive > 1 ? 's' : '') + ' analysé' + (nActive > 1 ? 's' : '');

  if (!issues.length) {
    return '<p class="integ-summary integ-ok">✓ Aucune anomalie</p>'
      + '<p class="notif-sub">' + esc(analysed) + '.</p>';
  }

  const nErr  = issues.filter(i => i.severity === 'error').length;
  const nWarn = issues.length - nErr;
  const detail = [];
  if (nErr)  detail.push(plural(nErr, 'erreur'));
  if (nWarn) detail.push(plural(nWarn, 'avertissement'));

  const items = issues.map(i => {
    const sev   = i.severity === 'error' ? 'error' : 'warn';
    const label = AUDIT_TYPE_LABELS[i.type] || i.type;
    const meta  = [fmtDay(i.date), fmtKm(i.km), i.vehicule, i.row ? 'ligne ' + i.row : '']
      .filter(Boolean).map(esc).join(' · ');
    const fix = FIXABLE.has(i.type) && i.sync_id
      ? '<button type="button" class="integ-fix" data-sync-id="' + esc(i.sync_id) + '" data-row="' + esc(i.row) + '"'
        + ' data-desc="' + esc([fmtDay(i.date), fmtKm(i.km)].filter(Boolean).join(' · ')) + '">Supprimer cette copie</button>'
      : '';
    return '<li class="integ-item integ-' + sev + '">'
      + '<div class="integ-main">'
      + '<span class="integ-type"><span class="integ-sev">' + (sev === 'error' ? 'Erreur' : 'Avert.') + '</span>' + esc(label) + '</span>'
      + (meta ? '<span class="integ-meta">' + meta + '</span>' : '')
      + '<span class="integ-msg">' + esc(i.message) + '</span>'
      + '</div>' + fix + '</li>';
  }).join('');

  return '<p class="integ-summary integ-ko">' + esc(plural(issues.length, 'anomalie')) + ' — ' + esc(detail.join(', ')) + '</p>'
    + '<p class="notif-sub">' + esc(analysed) + '. Rien n\'est corrigé automatiquement.</p>'
    + '<ul class="integ-list">' + items + '</ul>';
}

/* ─── UI (⚙️ Réglages) ─────────────────────────────────────────────── */

async function runAudit(btn, out) {
  btn.disabled = true;
  const label = btn.textContent;
  btn.textContent = 'Analyse en cours…';
  out.innerHTML = '<p class="notif-sub">Analyse des données…</p>';
  try {
    out.innerHTML = renderAuditHtml(await fetchAudit());
  } catch (e) {
    out.innerHTML = '<p class="integ-summary integ-ko">Vérification impossible : ' + esc(e.message || 'erreur réseau') + '</p>';
  } finally {
    btn.disabled = false;
    btn.textContent = label;
  }
}

/** Câble le bouton d'audit et la suppression d'une copie (délégation). */
export function initIntegriteUI() {
  const btn = document.getElementById('integriteBtn');
  const out = document.getElementById('integriteResult');
  if (!btn || !out || btn.dataset.wired === '1') return;
  btn.dataset.wired = '1';

  btn.addEventListener('click', () => runAudit(btn, out));

  out.addEventListener('click', async (e) => {
    const rest = e.target.closest('.integ-restore');
    if (rest) {
      const id = String(rest.dataset.depId || '');
      const desc = rest.dataset.desc ? ' « ' + rest.dataset.desc + ' »' : '';
      if (!id || !window.confirm('Restaurer la dépense' + desc + ' ?')) return;
      rest.disabled = true;
      try {
        await restaurerDepenseAudit(id);
        showFeedback('success', 'Dépense restaurée ✓', 'Elle est de nouveau comptée dans les coûts du véhicule.');
        await runAudit(btn, out);
      } catch (err) {
        rest.disabled = false;
        showFeedback('error', 'Restauration échouée', err.message || 'erreur réseau');
      }
      return;
    }
    const fix = e.target.closest('.integ-fix');
    if (!fix) return;
    const sid  = String(fix.dataset.syncId || '');
    const row  = Number(fix.dataset.row) || 0;
    const desc = fix.dataset.desc ? ' (' + fix.dataset.desc + ')' : '';
    if (!sid) return;
    if (!window.confirm('Supprimer cette copie du plein' + desc + ', ligne ' + row + ' du Sheet ?\n'
      + 'Le plein d\'origine est conservé.')) return;
    fix.disabled = true;
    try {
      await deleteCopie(sid, row);
      showFeedback('success', 'Copie supprimée ✓', 'Le doublon a été retiré du Google Sheet.');
      window.dispatchEvent(new window.CustomEvent('plein-added'));   // W64 — MAJ globale (historique, stats…)
      await runAudit(btn, out);
    } catch (err) {
      fix.disabled = false;
      showFeedback('error', 'Suppression échouée', err.message || 'erreur réseau');
    }
  });
}
