# Déblocage & fiabilisation de la sync hors‑ligne — Plan d'implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rendre la synchronisation des pleins hors‑ligne visible/actionnable quand la session Google est expirée, et fiabiliser son déclenchement sur mobile.

**Architecture:** Tout est concentré dans `js/offline.js`. `syncQueue()` gagne une option `manual` qui transforme ses sorties muettes en feedback explicite (et relance la connexion via `promptLogin()` si la session est expirée). Le badge header `#offlineBadge` devient cliquable (sync manuelle), et un écouteur `visibilitychange` retente la sync à chaque retour au premier plan — supprimant la dépendance à l'événement `online` peu fiable sur Safari/iOS.

**Tech Stack:** JavaScript ES modules (Vite), Vitest + jsdom pour les tests, ESLint strict (`--max-warnings=0`).

## Global Constraints

- **Langue :** tout texte utilisateur en français ; messages de commit en français.
- **Périmètre fichiers :** `js/offline.js`, `css/style.css`, `tests/offline.test.js` uniquement (le markup du badge est piloté en JS — ne pas modifier `index.html`).
- **Lint :** `npm run lint` doit passer à 0 warning.
- **Tests :** `npm test` (Vitest) doit passer ; fichier de test en `// @vitest-environment jsdom`.
- **Commit :** le projet impose un **commit final unique** passant le gate `/graphify --update` AVANT `./commit.sh`. Les « Step Commit » ci‑dessous sont donc des **points de validation** (lint + tests verts) ; le commit Git réel est groupé en fin de plan via la section « Livraison ». Ne pas faire de `git commit` intermédiaire.
- **Version :** incrément `W` (fix). Base actuelle `package.json` = `5.29.0.0` → cible `[v5.29.0.1]`.
- **`syncQueue` signature finale :** `export async function syncQueue({ manual = false } = {})` — les appels existants `syncQueue()` (dans `js/main.js`) restent valides (auto).

---

### Task 1 : `syncQueue({ manual })` — feedback explicite + relance de connexion

**Files:**
- Modify: `js/offline.js` (fonction `syncQueue`, lignes 43‑90 ; import auth ligne 16)
- Test: `tests/offline.test.js`

**Interfaces:**
- Consumes : `showFeedback` (`js/ui.js`), `authEnabled`/`isAuthed`/`getIdToken` (`js/auth.js`, déjà importés), `promptLogin` (`js/auth.js`, **nouvel import**).
- Produces : `syncQueue({ manual = false } = {})` — comportement auto inchangé (silencieux), mode manuel verbeux. Consommé par Task 2 (badge + visibilitychange) et par `js/main.js` (appels auto existants).

- [ ] **Step 1 : Étendre le mock auth et écrire les tests manuels (échouent d'abord)**

Dans `tests/offline.test.js`, ajouter `promptLogin` au mock auth et un compteur d'appel. Remplacer le bloc mock (lignes 9‑15) par :

```js
const A = vi.hoisted(() => ({ enabled: false, authed: true, promptLogin: null }));
vi.mock('../js/ui.js', () => ({ showFeedback: vi.fn() }));
vi.mock('../js/auth.js', () => ({
  authEnabled: () => A.enabled,
  isAuthed:    () => A.authed,
  getIdToken:  () => 'tok',
  promptLogin: (...args) => A.promptLogin(...args),
}));
```

Dans `beforeEach` (après `A.enabled = false; A.authed = true;`), ajouter :

```js
  A.promptLogin = vi.fn();
```

Puis ajouter, à la fin du `describe('syncQueue', …)` :

```js
  it('mode manuel : file vide → info « Rien à synchroniser »', async () => {
    global.fetch = vi.fn();
    await syncQueue({ manual: true });
    expect(global.fetch).not.toHaveBeenCalled();
    expect(showFeedback).toHaveBeenCalledWith('info', 'Rien à synchroniser', expect.any(String));
  });

  it('mode manuel : session expirée → info + promptLogin, file intacte', async () => {
    A.enabled = true; A.authed = false;
    queuePlein({ a: 1 });
    global.fetch = vi.fn();
    await syncQueue({ manual: true });
    expect(global.fetch).not.toHaveBeenCalled();
    expect(getPendingCount()).toBe(1);
    expect(A.promptLogin).toHaveBeenCalledTimes(1);
    expect(showFeedback).toHaveBeenCalledWith('info', expect.stringContaining('Reconnexion'), expect.any(String));
  });

  it('mode manuel : toujours hors-ligne (fetch rejette) → error « hors-ligne »', async () => {
    queuePlein({ a: 1 });
    global.fetch = vi.fn(() => Promise.reject(new TypeError('offline')));
    await syncQueue({ manual: true });
    expect(getPendingCount()).toBe(1);
    expect(showFeedback).toHaveBeenCalledWith('error', expect.stringContaining('hors-ligne'), expect.any(String));
  });

  it('mode auto : session expirée reste silencieux (pas de feedback)', async () => {
    A.enabled = true; A.authed = false;
    queuePlein({ a: 1 });
    global.fetch = vi.fn();
    await syncQueue();           // manual = false
    expect(showFeedback).not.toHaveBeenCalled();
    expect(A.promptLogin).not.toHaveBeenCalled();
  });
```

- [ ] **Step 2 : Lancer les tests pour les voir échouer**

Run : `npm test -- offline`
Expected : FAIL — les nouveaux cas échouent (mode manuel encore muet, `promptLogin` non importé / non appelé).

- [ ] **Step 3 : Importer `promptLogin` et réécrire `syncQueue`**

Dans `js/offline.js`, ligne 16, ajouter `promptLogin` à l'import auth :

```js
import { getIdToken, isAuthed, authEnabled, promptLogin } from './auth.js';
```

Remplacer la fonction `syncQueue` (lignes 43‑90) par :

```js
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
```

- [ ] **Step 4 : Lancer les tests pour vérifier qu'ils passent**

Run : `npm test -- offline`
Expected : PASS (anciens + nouveaux cas). Les tests existants `syncQueue()` (sans argument) restent verts car `manual` vaut `false` par défaut.

- [ ] **Step 5 : Lint**

Run : `npm run lint`
Expected : 0 warning. (Point de validation — pas de `git commit` ici, voir Global Constraints.)

---

### Task 2 : Badge cliquable + retry `visibilitychange` + CSS

**Files:**
- Modify: `js/offline.js` (fonction `initOffline`, lignes 116‑147)
- Modify: `css/style.css` (`.offline-badge`, ligne 1216)
- Test: `tests/offline.test.js`

**Interfaces:**
- Consumes : `syncQueue` (Task 1, signature `{ manual }`), `getPendingCount`, `updateOfflineBadge` (existants).
- Produces : `initOffline()` câble le badge (`role="button"`, `tabindex`, handlers click + clavier → `syncQueue({ manual: true })`) et un écouteur `visibilitychange` (retry auto). Aucune nouvelle export.

- [ ] **Step 1 : Écrire les tests de câblage (échouent d'abord)**

Dans `tests/offline.test.js`, ajouter `initOffline` à l'import depuis `../js/offline.js` (ligne 17‑19) :

```js
import {
  getQueue, getPendingCount, queuePlein, syncQueue, updateOfflineBadge, updateOfflineRow, initOffline,
} from '../js/offline.js';
```

Puis ajouter un nouveau `describe` à la fin du fichier :

```js
describe('initOffline — badge cliquable & visibilitychange', () => {
  it('rend le badge interactif (role=button, tabindex, aria-label)', () => {
    initOffline();
    const b = document.getElementById('offlineBadge');
    expect(b.getAttribute('role')).toBe('button');
    expect(b.getAttribute('tabindex')).toBe('0');
    expect(b.getAttribute('aria-label')).toBeTruthy();
  });

  it('clic sur le badge déclenche une sync manuelle (file vide → info)', () => {
    initOffline();
    global.fetch = vi.fn();
    document.getElementById('offlineBadge').click();
    expect(showFeedback).toHaveBeenCalledWith('info', 'Rien à synchroniser', expect.any(String));
  });

  it('visibilitychange (visible + online) retente la sync et purge', async () => {
    queuePlein({ a: 1 });
    Object.defineProperty(document, 'hidden', { value: false, configurable: true });
    Object.defineProperty(navigator, 'onLine', { value: true, configurable: true });
    global.fetch = vi.fn(() => Promise.resolve({ json: () => Promise.resolve({ success: true }) }));
    initOffline();
    document.dispatchEvent(new Event('visibilitychange'));
    await Promise.resolve(); await Promise.resolve();   // laisse la promesse fetch se résoudre
    expect(global.fetch).toHaveBeenCalled();
  });
});
```

- [ ] **Step 2 : Lancer les tests pour les voir échouer**

Run : `npm test -- offline`
Expected : FAIL — `role`/`tabindex` absents, clic sans effet, `visibilitychange` non écouté.

- [ ] **Step 3 : Câbler le badge et l'écouteur dans `initOffline`**

Dans `js/offline.js`, remplacer la fonction `initOffline` (lignes 116‑147) par :

```js
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
```

- [ ] **Step 4 : Ajouter le style du badge cliquable**

Dans `css/style.css`, remplacer le bloc `.offline-badge` (lignes 1216‑1225) par :

```css
.offline-badge {
  font-size: 11px;
  font-weight: 600;
  background: var(--amber);
  color: #000;
  border-radius: 20px;
  padding: 2px 8px;
  white-space: nowrap;
  cursor: pointer;
  animation: pulse-badge 2s ease-in-out infinite;
}
.offline-badge:focus-visible {
  outline: 2px solid var(--amber);
  outline-offset: 2px;
}
```

- [ ] **Step 5 : Lancer les tests + lint**

Run : `npm test -- offline`
Expected : PASS (câblage badge + visibilitychange).
Run : `npm run lint`
Expected : 0 warning.

---

### Livraison (commit final groupé — gate projet)

- [ ] **Step 1 : Suite complète**

Run : `npm test`
Expected : PASS (toute la suite, pas seulement `offline`).

- [ ] **Step 2 : Documentation**

- `CHANGELOG.md` : entrée `## [v5.29.0.1] — 2026-06-29` → `### Fixed` (sync hors‑ligne débloquée : feedback explicite + relance connexion + retry au premier plan) et `### Added` (badge header cliquable pour sync manuelle).
- `ROADMAP.md` : ligne dans « ✅ Idées déjà implémentées ».
- `README.md` : MAJ uniquement si la section hors‑ligne/PWA décrit le comportement de sync.

- [ ] **Step 3 : Gate Graphify + commit**

```bash
# 1. /graphify --update  (garde anti-amputation : noter le nb de nœuds avant/après)
# 2. git add -A
# 3. ./commit.sh "fix(offline): debloque la sync hors-ligne (feedback + relance auth + retry premier plan) [v5.29.0.1]"
```

- [ ] **Step 4 : Vérification post‑déploiement (sur le portable)**

Après push + déploiement GitHub Pages : recharger l'app sur le portable, taper sur le badge « 📵 N hors‑ligne ». Attendu : soit « N pleins synchronisés ✓ » et badge à 0, soit « 🔐 Reconnexion requise » suivi de l'invite Google puis sync automatique.
