/* ═══════════════════════════════════════════════════════════════════════
   auth.js — U7 Comptes Google (Google Identity Services / « Sign in with Google »)

   Rôle : identifier l'utilisateur par son compte Google afin que chaque
   personne ne voie QUE ses propres pleins (données séparées par email côté
   Sheet). Le navigateur ne peut pas lire l'email du téléphone sans action :
   GIS fournit un JWT (idToken) SIGNÉ par Google, vérifié côté GAS (tokeninfo).
   Le client ne fait QUE décoder le payload pour l'affichage — il ne fait
   jamais confiance à ces données pour l'autorisation (c'est le rôle du GAS).

   Bascule souple : tant que GOOGLE_CLIENT_ID vaut le placeholder, authEnabled()
   est faux → AUCUN mur, AUCUN idToken envoyé → l'app fonctionne comme avant
   (mode propriétaire, GAS souple). Dès que le vrai Client ID est posé, l'auth
   s'active (bouton + mur sur les vues perso).

   API publique :
     authEnabled()  → l'auth est-elle configurée (vrai Client ID) ?
     isAuthed()     → un profil valide (non expiré) est-il en session ?
     getUser()      → { email, name, given_name, picture, sub, exp } | null
     getIdToken()   → JWT courant si non expiré, sinon null
     initAuth()     → charge GIS, reconnexion auto (One-Tap), rend le bouton
     mountGsiButton(el, opts) → rend un bouton « Se connecter » officiel dans el
     promptLogin()  → déclenche l'invite One-Tap
     signOut()      → purge la session + coupe la reconnexion auto
     renderAuthSlot() → met à jour le bloc identité du header (#authSlot)

   Émet l'événement window 'auth-changed' { detail:{ authed, user } } à chaque
   connexion / déconnexion (écouté par main.js et router.js).
═══════════════════════════════════════════════════════════════════════ */

import { GOOGLE_CLIENT_ID, AUTH_TOKEN_KEY, AUTH_PROFILE_KEY } from './config.js';

const PLACEHOLDER = 'REMPLACER_PAR_VOTRE_CLIENT_ID.apps.googleusercontent.com';
const GSI_SRC     = 'https://accounts.google.com/gsi/client';

/** L'auth est active uniquement si un vrai Client ID OAuth est configuré. */
export function authEnabled() {
  return typeof GOOGLE_CLIENT_ID === 'string'
      && GOOGLE_CLIENT_ID !== PLACEHOLDER
      && /\.apps\.googleusercontent\.com$/.test(GOOGLE_CLIENT_ID);
}

/* ─── Session locale (localStorage) ──────────────────────────────────── */

function _saveSession(idToken, profile) {
  try {
    localStorage.setItem(AUTH_TOKEN_KEY, idToken);
    localStorage.setItem(AUTH_PROFILE_KEY, JSON.stringify(profile));
  } catch { /* quota / navigation privée — la session vit en mémoire ce tour-ci */ }
}

function _clearSession() {
  try {
    localStorage.removeItem(AUTH_TOKEN_KEY);
    localStorage.removeItem(AUTH_PROFILE_KEY);
  } catch { /* ignore */ }
}

/** Profil connecté (ou null). Lit le localStorage, valide l'expiration. */
export function getUser() {
  try {
    const raw = localStorage.getItem(AUTH_PROFILE_KEY);
    if (!raw) return null;
    const p = JSON.parse(raw);
    if (!p || !p.email) return null;
    if (p.exp && (Number(p.exp) * 1000) <= Date.now()) return null;   // expiré
    return p;
  } catch { return null; }
}

/** Vrai si une session valide (non expirée) est présente. */
export function isAuthed() {
  return !!getUser();
}

/** idToken courant si la session est valide, sinon null (ne JAMAIS deviner). */
export function getIdToken() {
  if (!isAuthed()) return null;
  try { return localStorage.getItem(AUTH_TOKEN_KEY) || null; }
  catch { return null; }
}

/* ─── Décodage du JWT (payload uniquement, sans vérif — affichage) ───── */

function _b64urlToJson(seg) {
  let s = String(seg).replace(/-/g, '+').replace(/_/g, '/');
  const pad = s.length % 4;
  if (pad) s += '='.repeat(4 - pad);
  const bin   = atob(s);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return JSON.parse(new window.TextDecoder('utf-8').decode(bytes));   // UTF-8 (accents)
}

/** Extrait le profil affichable d'un idToken Google. Null si malformé. */
function _profileFromJwt(jwt) {
  try {
    const parts = String(jwt).split('.');
    if (parts.length !== 3) return null;
    const c = _b64urlToJson(parts[1]);
    if (!c || !c.email) return null;
    return {
      email:      String(c.email),
      name:       c.name || c.email,
      given_name: c.given_name || String(c.name || c.email).split(' ')[0],
      picture:    c.picture || '',
      sub:        c.sub || '',
      exp:        Number(c.exp) || 0,
    };
  } catch { return null; }
}

/* ─── Chargement du SDK GIS ───────────────────────────────────────────── */

let _gisPromise = null;

/** Résout window.google.accounts.id (charge le script si absent). */
function ensureGis() {
  if (window.google && window.google.accounts && window.google.accounts.id) {
    return Promise.resolve(window.google.accounts.id);
  }
  if (_gisPromise) return _gisPromise;

  _gisPromise = new Promise((resolve, reject) => {
    const done = () => {
      if (window.google && window.google.accounts && window.google.accounts.id) {
        resolve(window.google.accounts.id);
        return true;
      }
      return false;
    };
    // Script déjà présent dans index.html : attendre son chargement.
    let script = document.querySelector('script[data-gsi]');
    if (!script) {
      script = document.createElement('script');
      script.src   = GSI_SRC;
      script.async = true;
      script.defer = true;
      script.setAttribute('data-gsi', '1');
      document.head.appendChild(script);
    }
    if (done()) return;
    script.addEventListener('load', () => { if (!done()) reject(new Error('GIS chargé mais API absente')); });
    script.addEventListener('error', () => reject(new Error('Échec de chargement du SDK GIS')));
    // Filet de sécurité : poll court si l'event load a déjà eu lieu.
    let tries = 0;
    const iv = setInterval(() => {
      if (done() || ++tries > 100) clearInterval(iv);   // ~10 s max
    }, 100);
  });
  return _gisPromise;
}

/* ─── Callback de connexion ──────────────────────────────────────────── */

function _dispatch() {
  try {
    window.dispatchEvent(new window.CustomEvent('auth-changed', {
      detail: { authed: isAuthed(), user: getUser() },
    }));
  } catch { /* non bloquant */ }
}

/** Reçoit le credential GIS (JWT), enregistre la session et notifie l'app. */
function _onCredential(resp) {
  const jwt = resp && resp.credential;
  const profile = jwt ? _profileFromJwt(jwt) : null;
  if (!profile) { console.warn('[auth] credential invalide'); return; }
  _saveSession(jwt, profile);
  renderAuthSlot();
  _dispatch();
}

/* ─── Rendu du bouton officiel « Se connecter avec Google » ──────────── */

/**
 * Rend un bouton GIS dans l'élément donné. opts surcharge le style (cf. doc GIS).
 * Sans effet si l'auth n'est pas configurée.
 */
export function mountGsiButton(el, opts) {
  if (!el || !authEnabled()) return;
  ensureGis().then((id) => {
    el.innerHTML = '';
    id.renderButton(el, Object.assign({
      type:           'standard',
      theme:          'filled_blue',
      size:           'large',
      shape:          'pill',
      text:           'signin_with',
      logo_alignment: 'left',
      locale:         'fr',
    }, opts || {}));
  }).catch((e) => console.warn('[auth] renderButton impossible :', e.message));
}

/** Déclenche l'invite One-Tap (best-effort ; silencieux si en cooldown). */
export function promptLogin() {
  if (!authEnabled()) return;
  ensureGis().then((id) => id.prompt()).catch(() => { /* silencieux */ });
}

/** Déconnexion : purge la session, coupe la reconnexion auto, notifie l'app. */
export function signOut() {
  _clearSession();
  try {
    if (window.google && window.google.accounts && window.google.accounts.id) {
      window.google.accounts.id.disableAutoSelect();
    }
  } catch { /* ignore */ }
  renderAuthSlot();
  _dispatch();
}

/* ─── Bloc identité du header (#authSlot) ─────────────────────────────── */

/** Avatar : photo Google si dispo, sinon pastille avec l'initiale. */
function _avatarHtml(u) {
  if (u.picture) {
    return `<img class="auth-avatar" src="${u.picture}" alt="" referrerpolicy="no-referrer" width="26" height="26">`;
  }
  const initial = (u.given_name || u.email || '?').trim().charAt(0).toUpperCase();
  return `<span class="auth-avatar auth-avatar--initial" aria-hidden="true">${initial}</span>`;
}

/** (Re)construit le bloc identité du header selon l'état de connexion. */
export function renderAuthSlot() {
  // Éléments réservés aux comptes connectés (ex. « Supprimer mon compte »).
  const showAuthOnly = authEnabled() && isAuthed();
  document.querySelectorAll('[data-auth-only]').forEach((el) => { el.hidden = !showAuthOnly; });

  const slot = document.getElementById('authSlot');
  if (!slot) return;

  // Auth non configurée → bloc masqué (comportement legacy, aucune UI compte).
  if (!authEnabled()) { slot.hidden = true; slot.innerHTML = ''; return; }
  slot.hidden = false;

  if (isAuthed()) {
    const u = getUser();
    slot.innerHTML =
      `<div class="auth-user" title="${u.email}">
         ${_avatarHtml(u)}
         <span class="auth-name">${u.given_name || u.email}</span>
         <button class="auth-signout" type="button" title="Se déconnecter" aria-label="Se déconnecter">⎋</button>
       </div>`;
    slot.querySelector('.auth-signout')?.addEventListener('click', signOut);
  } else {
    slot.innerHTML = `<div class="gsi-host" id="gsiBtnHeader"></div>`;
    mountGsiButton(document.getElementById('gsiBtnHeader'), { size: 'medium', text: 'signin' });
  }
}

/* ─── Initialisation ──────────────────────────────────────────────────── */

/**
 * À appeler au démarrage (main.js). Affiche immédiatement l'état (session en
 * cache), puis — si l'auth est configurée — initialise GIS, tente une
 * reconnexion silencieuse (One-Tap) et rend le bouton si déconnecté.
 */
export async function initAuth() {
  renderAuthSlot();                       // état immédiat depuis le cache
  if (!authEnabled()) return;             // legacy : rien d'autre

  try {
    const id = await ensureGis();
    id.initialize({
      client_id:             GOOGLE_CLIENT_ID,
      callback:              _onCredential,
      auto_select:           true,        // reconnexion silencieuse si déjà consenti
      cancel_on_tap_outside: false,
      itp_support:           true,
    });
    renderAuthSlot();                     // monte le bouton GIS si déconnecté
    if (!isAuthed()) id.prompt();         // One-Tap (compte du téléphone sur Android)
  } catch (e) {
    console.warn('[auth] GIS indisponible — mode dégradé :', e.message);
  }
}
