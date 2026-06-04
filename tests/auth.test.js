// @vitest-environment jsdom
/* U7 — Tests du module d'authentification (Google Identity Services).
   Couvre la bascule souple (placeholder = auth inactive) et la validité de
   session basée sur l'expiration du profil. */
import { describe, it, expect, beforeEach } from 'vitest';
import { authEnabled, isAuthed, getUser, getIdToken } from '../js/auth.js';
import { AUTH_TOKEN_KEY, AUTH_PROFILE_KEY, GOOGLE_CLIENT_ID } from '../js/config.js';

const future = () => Math.floor(Date.now() / 1000) + 3600;
const past   = () => Math.floor(Date.now() / 1000) - 10;

describe('auth — configuration & session', () => {
  beforeEach(() => localStorage.clear());

  it('authEnabled() reflète la présence d\'un vrai Client ID (≠ placeholder)', () => {
    const configured = /\.apps\.googleusercontent\.com$/.test(GOOGLE_CLIENT_ID)
      && GOOGLE_CLIENT_ID.indexOf('REMPLACER_PAR_VOTRE_CLIENT_ID') < 0;
    expect(authEnabled()).toBe(configured);
  });

  it('sans session : isAuthed/getUser/getIdToken sont vides', () => {
    expect(isAuthed()).toBe(false);
    expect(getUser()).toBeNull();
    expect(getIdToken()).toBeNull();
  });
});

describe('auth — validité de session (expiration du profil)', () => {
  beforeEach(() => localStorage.clear());

  it('ignore un profil expiré', () => {
    localStorage.setItem(AUTH_TOKEN_KEY, 'a.b.c');
    localStorage.setItem(AUTH_PROFILE_KEY, JSON.stringify({ email: 'x@y.z', exp: past() }));
    expect(getUser()).toBeNull();
    expect(isAuthed()).toBe(false);
    expect(getIdToken()).toBeNull();
  });

  it('accepte un profil valide non expiré', () => {
    localStorage.setItem(AUTH_TOKEN_KEY, 'a.b.c');
    localStorage.setItem(AUTH_PROFILE_KEY, JSON.stringify({ email: 'x@y.z', exp: future() }));
    const u = getUser();
    expect(u).not.toBeNull();
    expect(u.email).toBe('x@y.z');
    expect(isAuthed()).toBe(true);
    expect(getIdToken()).toBe('a.b.c');
  });

  it('ignore un profil sans email', () => {
    localStorage.setItem(AUTH_PROFILE_KEY, JSON.stringify({ exp: future() }));
    expect(getUser()).toBeNull();
  });
});
