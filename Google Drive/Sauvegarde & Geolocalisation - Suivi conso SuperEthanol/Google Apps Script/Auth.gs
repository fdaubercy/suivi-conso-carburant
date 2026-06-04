// ============================================================
//  SUIVI CONSO CARBURANTS — Authentification compte Google    v5.0.0.0
//  Roadmap U7 — Système d'utilisateur (multi-utilisateur public)
//
//  La PWA envoie un idToken (JWT) « Sign in with Google » dans le corps POST
//  (payload.idToken) ou en query GET (?idToken=). Ce module le VÉRIFIE côté
//  serveur via l'endpoint public Google `tokeninfo`, contrôle l'audience
//  (= notre Client ID), l'émetteur, la vérification de l'email et l'expiration,
//  puis renvoie l'email de confiance. L'identité provient TOUJOURS du token
//  vérifié, jamais d'un champ « email » envoyé en clair par le client.
//
//  ── MISE EN PLACE ──────────────────────────────────────────
//   1. Remplacer GOOGLE_CLIENT_ID ci-dessous par le vrai ID client OAuth
//      (type « Application Web »), le MÊME que js/config.js (GOOGLE_CLIENT_ID).
//   2. Bascule souple : tant que la propriété de script REQUIRE_AUTH n'est pas
//      posée, les endpoints perso acceptent les requêtes sans idToken (mode
//      rétrocompatible « propriétaire »). Poser REQUIRE_AUTH = 1 (Paramètres du
//      projet → Propriétés du script) rend l'idToken OBLIGATOIRE pour le perso.
//
//  Dépend de : jsonResponse() (Code.gs).
// ============================================================

// ⚠️ MÊME valeur que GOOGLE_CLIENT_ID dans js/config.js.
var GOOGLE_CLIENT_ID = 'REMPLACER_PAR_VOTRE_CLIENT_ID.apps.googleusercontent.com';

// Propriétaire historique : email attribué aux pleins migrés (sans email).
var OWNER_EMAIL = 'fdaubercy@gmail.com';

// Placeholder = auth non configurée (l'app tourne en mode propriétaire).
function authConfigured_() {
  return GOOGLE_CLIENT_ID &&
         GOOGLE_CLIENT_ID.indexOf('REMPLACER_PAR_VOTRE_CLIENT_ID') < 0 &&
         /\.apps\.googleusercontent\.com$/.test(GOOGLE_CLIENT_ID);
}

// L'idToken est-il OBLIGATOIRE pour les endpoints perso ? (propriété REQUIRE_AUTH)
function authRequired_() {
  return !!PropertiesService.getScriptProperties().getProperty('REQUIRE_AUTH');
}

// SHA-1 hex d'une chaîne (clé de cache : un idToken dépasse la limite de 250 car.).
function _sha1Hex_(s) {
  var bytes = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_1, s, Utilities.Charset.UTF_8);
  var hex = '';
  for (var i = 0; i < bytes.length; i++) {
    var b = (bytes[i] + 256) % 256;
    hex += (b < 16 ? '0' : '') + b.toString(16);
  }
  return hex;
}

// ─────────────────────────────────────────────────────────────
//  verifyIdToken_ — vérifie un idToken Google et renvoie l'utilisateur.
//  Retourne { email, name, sub } (email en minuscules) ou null si invalide.
//  Résultat mis en cache (CacheService) jusqu'à expiration (≤ 5 min) pour
//  limiter les appels UrlFetch (quota) sur des requêtes rapprochées.
// ─────────────────────────────────────────────────────────────
function verifyIdToken_(idToken) {
  if (!idToken) return null;
  idToken = String(idToken);

  var cache = CacheService.getScriptCache();
  var ckey  = 'idtok_' + _sha1Hex_(idToken);
  try {
    var hit = cache.get(ckey);
    if (hit) return JSON.parse(hit);
  } catch (e) { /* cache indisponible — on revérifie */ }

  var resp;
  try {
    resp = UrlFetchApp.fetch(
      'https://oauth2.googleapis.com/tokeninfo?id_token=' + encodeURIComponent(idToken),
      { muteHttpExceptions: true }
    );
  } catch (e) {
    Logger.log('verifyIdToken_ fetch error: ' + e.message);
    return null;
  }
  if (resp.getResponseCode() !== 200) return null;

  var info;
  try { info = JSON.parse(resp.getContentText()); } catch (e) { return null; }

  // Contrôles de sécurité.
  if (!authConfigured_())                 return null;                 // pas d'ID client posé
  if (info.aud !== GOOGLE_CLIENT_ID)      return null;                 // jeton émis pour une AUTRE app
  if (info.iss !== 'accounts.google.com' &&
      info.iss !== 'https://accounts.google.com') return null;        // émetteur Google
  if (String(info.email_verified) !== 'true') return null;            // email non vérifié
  if (!info.email)                        return null;
  var exp = Number(info.exp) || 0;
  if (exp * 1000 <= Date.now())           return null;                 // expiré

  var user = { email: String(info.email).toLowerCase(), name: info.name || '', sub: info.sub || '' };

  var ttl = Math.min(300, exp - Math.floor(Date.now() / 1000));
  if (ttl > 0) { try { cache.put(ckey, JSON.stringify(user), ttl); } catch (e) { /* ignore */ } }
  return user;
}

// ─────────────────────────────────────────────────────────────
//  requireUser_ — extrait l'idToken (POST payload.idToken / GET ?idToken=),
//  le vérifie, et renvoie l'EMAIL de confiance, ou null si absent/invalide.
//  Les endpoints perso décident ensuite (selon authRequired_) de refuser ou
//  de retomber sur OWNER_EMAIL (transition souple).
// ─────────────────────────────────────────────────────────────
function requireUser_(e, payload) {
  var idToken = '';
  if (payload && payload.idToken != null)               idToken = String(payload.idToken);
  else if (e && e.parameter && e.parameter.idToken != null) idToken = String(e.parameter.idToken);
  if (!idToken) return null;
  var u = verifyIdToken_(idToken);
  return u ? u.email : null;
}

// ─────────────────────────────────────────────────────────────
//  resolveOwner_ — email à attribuer/filtrer pour une requête perso.
//   • email du token si présent et valide ;
//   • sinon, si l'auth n'est pas obligatoire (transition) → OWNER_EMAIL ;
//   • sinon (auth obligatoire, pas de token valide) → null (→ 401 par l'appelant).
// ─────────────────────────────────────────────────────────────
function resolveOwner_(e, payload) {
  var email = requireUser_(e, payload);
  if (email) return email;
  if (!authRequired_()) return OWNER_EMAIL;   // mode souple : propriétaire
  return null;                                 // auth obligatoire et absente
}

// ─────────────────────────────────────────────────────────────
//  handleWhoami — endpoint de debug (?action=whoami&idToken=…).
//  Confirme que la vérification serveur fonctionne (Lot 1).
// ─────────────────────────────────────────────────────────────
function handleWhoami(e) {
  var email = requireUser_(e, null);
  return jsonResponse({
    authConfigured: authConfigured_(),
    authRequired:   authRequired_(),
    email:          email || null,
    ok:             !!email
  });
}
