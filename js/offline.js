/* ═══════════════════════════════════════════════════════════════════════
   offline.js — File d'attente hors-ligne + synchronisation

   Flux :
     submitForm() échoue réseau
       → queuePlein(payload)         : sauve dans localStorage
       → updateOfflineBadge()        : badge "N en attente" dans le header
     window 'online'  / SW message
       → syncQueue()                 : envoie chaque entrée → GAS
       → clearFromQueue(id)          : retire les succès
       → chargerHistorique()         : rafraîchit la liste
═══════════════════════════════════════════════════════════════════════ */

import { GAS_URL, APP_TOKEN } from './config.js';
import { showFeedback } from './ui.js';
import { getIdToken, isAuthed, authEnabled, promptLogin } from './auth.js';

const QUEUE_KEY = 'suivi_e85_offline_queue';

/* ─── File d'attente (localStorage) ─────────────────────────────────── */

export function getQueue() {
  try { return JSON.parse(localStorage.getItem(QUEUE_KEY) || '[]'); }
  catch { return []; }
}

export function getPendingCount() { return getQueue().length; }

export function queuePlein(payload) {
  const queue = getQueue();
  queue.push({ id: Date.now(), ts: new Date().toISOString(), payload });
  localStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
  updateOfflineBadge();
}

function clearFromQueue(id) {
  const queue = getQueue().filter(e => e.id !== id);
  localStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
}

/* ─── Synchronisation ────────────────────────────────────────────────── */

export async function syncQueue({ manual = false } = {}) {
  const queue = getQueue();
  if (!queue.length) {
    if (manual) showFeedback('info', 'Rien à synchroniser', 'Aucun plein en attente.');
    return;
  }

  // U7 — si l'auth est active mais l'utilisateur déconnecté, on diffère le flush
  // jusqu'à la reconnexion (sinon le GAS rejetterait les pleins en mode strict).
  if (authEnabled() && !isAuthed()) {
    if (manual) {
      const s = queue.length > 1;
      showFeedback(
        'info',
        '🔐 Reconnexion requise',
        `Reconnecte-toi pour envoyer ${queue.length} plein${s ? 's' : ''} en attente.`,
      );
      promptLogin();   // relance l'invite Google ; auth-changed relancera la sync
    }
    return;
  }

  let synced = 0;
  let failed = 0;
  let offline = false;

  for (const entry of queue) {
    try {
      const idToken = getIdToken();   // U7 — token FRAIS (celui mis en file peut avoir expiré)
      const json = await fetch(GAS_URL, {
        method: 'POST', redirect: 'follow',
        body: JSON.stringify({ ...entry.payload, token: APP_TOKEN, idToken }), // S6 + U7
      }).then(r => r.json());

      if (json.success) {
        clearFromQueue(entry.id);
        synced++;
      } else {
        failed++;
      }
    } catch {
      /* Toujours hors-ligne — on arrête pour ne pas flood */
      offline = true;
      break;
    }
  }

  updateOfflineBadge();

  if (synced > 0) {
    const s = synced > 1;
    showFeedback(
      'success',
      `${synced} plein${s ? 's' : ''} synchronisé${s ? 's' : ''} ✓`,
      `Les pleins enregistrés hors-ligne ont été envoyés à Google Sheets.`,
    );
    /* Rafraîchit l'historique sans recharger la page */
    if (typeof window.chargerHistorique === 'function') window.chargerHistorique();
  }

  if (failed > 0) {
    showFeedback('error', 'Sync partielle', `${failed} plein${failed > 1 ? 's' : ''} non synchronisé${failed > 1 ? 's' : ''} — vérifiez votre accès à Google Sheets.`);
  }

  if (manual && offline && synced === 0 && failed === 0) {
    showFeedback('error', '📵 Toujours hors-ligne', 'Connexion indisponible — vos pleins restent en file d\'attente.');
  }
}

/* ─── Badge header ───────────────────────────────────────────────────── */

export function updateOfflineBadge() {
  const n     = getPendingCount();
  const badge = document.getElementById('offlineBadge');
  if (!badge) return;
  if (n > 0) {
    badge.textContent = `📵 ${n} hors-ligne`;
    badge.hidden = false;
  } else {
    badge.hidden = true;
  }
}

/* ─── Encart « Mode hors-ligne » (visible seulement hors-ligne) ──────── */

export function updateOfflineRow() {
  const row = document.getElementById('offlineRow');
  if (!row) return;
  row.hidden = navigator.onLine;
}

/* ─── Init ───────────────────────────────────────────────────────────── */

export function initOffline() {
  /* Affichage initial du badge + encart hors-ligne */
  updateOfflineBadge();
  updateOfflineRow();

  /* Badge cliquable → sync manuelle (visible en ligne comme hors-ligne dès
     qu'un plein est en file). Sur session expirée, syncQueue relance la
     connexion ; sinon il envoie la file. */
  const badge = document.getElementById('offlineBadge');
  if (badge) {
    badge.setAttribute('role', 'button');
    badge.setAttribute('tabindex', '0');
    badge.setAttribute('aria-label', 'Synchroniser les pleins en attente');
    badge.addEventListener('click', () => syncQueue({ manual: true }));
    badge.addEventListener('keydown', e => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); syncQueue({ manual: true }); }
    });
  }

  /* Sync automatique dès le retour réseau */
  window.addEventListener('online', () => {
    updateOfflineRow();
    showFeedback('info', '🌐 Connexion rétablie', 'Synchronisation des pleins en attente…');
    syncQueue();
  });

  /* Passage hors-ligne : afficher l'encart d'information */
  window.addEventListener('offline', () => {
    updateOfflineRow();
    showFeedback('info', '📵 Hors-ligne', 'Vos pleins seront mis en file d\'attente et envoyés au retour du réseau.');
  });

  /* Retour au premier plan : retenter la sync (l'événement « online » n'est pas
     fiable sur PWA mobile / iOS — c'est ce déclencheur qui débloque la file). */
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden && navigator.onLine) syncQueue();
  });

  /* Message reçu du Service Worker (Background Sync) */
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.addEventListener('message', e => {
      if (e.data?.type === 'SYNC_PLEINS') syncQueue();
    });
  }

  /* Enregistrer un Background Sync si le navigateur le supporte */
  if ('serviceWorker' in navigator && 'SyncManager' in window) {
    navigator.serviceWorker.ready
      .then(reg => reg.sync.register('sync-pleins'))
      .catch(() => { /* silencieux si non supporté */ });
  }
}
