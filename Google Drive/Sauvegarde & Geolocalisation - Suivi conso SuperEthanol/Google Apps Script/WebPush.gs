// ============================================================
//  SUIVI CONSO CARBURANTS — Web Push VAPID (sans payload)   v3.4.0.0
//  Roadmap S8
//
//  Envoi de notifications Web Push SANS payload (RFC 8030) depuis
//  Google Apps Script. Pas de chiffrement applicatif (RFC 8291) :
//  le Service Worker récupère le détail du prix via ?action=lowprice.
//  Seule l'authentification VAPID (JWT ES256, P-256) est nécessaire —
//  implémentée ici en pur JS (BigInt), aucune librairie externe.
//
//  ── MISE EN PLACE (une seule fois) ─────────────────────────
//    1. Executer  generateVapidKeys()  → loggue la clé PUBLIQUE.
//       (la clé PRIVÉE est stockée dans les Propriétés du script).
//    2. Coller la clé PUBLIQUE loggée dans  js/config.js :
//         export const VAPID_PUBLIC_KEY = '<...>';
//    3. (Optionnel) Définir la propriété de script  VAPID_SUBJECT
//       = 'mailto:votre@email' (défaut : compte du script).
//    4. (Optionnel) Propriété  SEUIL_PUSH_E85  = 0.70  (€/L).
//    5. Tester :  testEnvoyerPush()  (après s'être abonné dans l'app).
//
//  Dépend des globales de Code.gs / RefreshPrix.gs :
//    SPREADSHEET_ID, PUSHSUBS_SHEET, jsonResponse()
// ============================================================

// ── Paramètres de la courbe NIST P-256 (secp256r1) ───────────
var _P256 = (function () {
  var p  = 0xffffffff00000001000000000000000000000000ffffffffffffffffffffffffn;
  var a  = p - 3n;
  var Gx = 0x6b17d1f2e12c4247f8bce6e563a440f277037d812deb33a0f4a13945d898c296n;
  var Gy = 0x4fe342e2fe1a7f9b8ee7eb4a7c0f9e162bce33576b315ececbb6406837bf51f5n;
  var n  = 0xffffffff00000000ffffffffffffffffbce6faada7179e84f3b9cac2fc632551n;

  function mod(x, m) { var r = x % m; return r >= 0n ? r : r + m; }

  // Inverse modulaire (Euclide étendu)
  function inv(x, m) {
    var lm = 1n, hm = 0n, low = mod(x, m), high = m;
    while (low > 1n) {
      var r = high / low;
      var nm = hm - lm * r, nl = high - low * r;
      hm = lm; lm = nm; high = low; low = nl;
    }
    return mod(lm, m);
  }

  // Addition de points affines (null = point à l'infini)
  function add(P, Q) {
    if (!P) return Q;
    if (!Q) return P;
    var x1 = P[0], y1 = P[1], x2 = Q[0], y2 = Q[1], m;
    if (x1 === x2 && mod(y1 + y2, p) === 0n) return null;
    if (x1 === x2 && y1 === y2) m = mod((3n * x1 * x1 + a) * inv(2n * y1, p), p);
    else                       m = mod((y2 - y1) * inv(mod(x2 - x1, p), p), p);
    var x3 = mod(m * m - x1 - x2, p);
    var y3 = mod(m * (x1 - x3) - y1, p);
    return [x3, y3];
  }

  // Multiplication scalaire k·P (double-and-add)
  function mul(k, P) {
    var R = null, N = P;
    k = mod(k, n);
    while (k > 0n) {
      if (k & 1n) R = add(R, N);
      N = add(N, N);
      k >>= 1n;
    }
    return R;
  }

  return { p: p, n: n, G: [Gx, Gy], mod: mod, inv: inv, mul: mul };
})();

// ── Helpers octets / base64url ───────────────────────────────
function _toSigned(arr)  { return arr.map(function (v) { v &= 0xff; return v > 127 ? v - 256 : v; }); }
function _bytesToBig(b)  { var x = 0n; for (var i = 0; i < b.length; i++) x = (x << 8n) | BigInt(b[i] & 0xff); return x; }
function _bigTo32(x)     { var o = new Array(32).fill(0); for (var i = 31; i >= 0; i--) { o[i] = Number(x & 0xffn); x >>= 8n; } return o; }
function _b64url(arr)    { return Utilities.base64EncodeWebSafe(_toSigned(arr)).replace(/=+$/, ''); }
function _b64urlStr(s)   { return Utilities.base64EncodeWebSafe(s, Utilities.Charset.UTF_8).replace(/=+$/, ''); }
function _b64urlToBytes(b64) {
  var s = String(b64).replace(/-/g, '+').replace(/_/g, '/');
  while (s.length % 4) s += '=';
  return Utilities.base64Decode(s);
}
function _uuidBytes() {
  var h = Utilities.getUuid().replace(/-/g, ''), o = [];
  for (var i = 0; i < h.length; i += 2) o.push(parseInt(h.substr(i, 2), 16));
  return o;
}
function _sha256(bytesOrStr) {
  return (typeof bytesOrStr === 'string')
    ? Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, bytesOrStr, Utilities.Charset.UTF_8)
    : Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, _toSigned(bytesOrStr));
}

// ── Scalaire aléatoire dans [1, n-1] ─────────────────────────
function _randScalar() {
  var k = 0n;
  do {
    var seed = _uuidBytes().concat(_uuidBytes()).concat(_bigTo32(BigInt(Date.now())));
    k = _P256.mod(_bytesToBig(_sha256(seed)), _P256.n);
  } while (k === 0n);
  return k;
}

// ── Nonce k unique et imprévisible par signature ─────────────
function _deriveK(privBig, hashBytes, counter) {
  var seed = _bigTo32(privBig)
    .concat(Array.prototype.slice.call(hashBytes).map(function (v) { return v & 0xff; }))
    .concat([counter & 0xff])
    .concat(_uuidBytes());
  return _P256.mod(_bytesToBig(_sha256(seed)), _P256.n);
}

// ── Signature ECDSA P-256 → 64 octets (r||s) ─────────────────
function _ecdsaSignP256(hashBytes, privBig) {
  var N = _P256.n, z = _bytesToBig(hashBytes), r = 0n, s = 0n, c = 0;
  while (true) {
    var k = _deriveK(privBig, hashBytes, c++);
    if (k <= 0n || k >= N) continue;
    var R = _P256.mul(k, _P256.G);
    r = _P256.mod(R[0], N);
    if (r === 0n) continue;
    s = _P256.mod(_P256.inv(k, N) * (z + r * privBig), N);
    if (s === 0n) continue;
    return _bigTo32(r).concat(_bigTo32(s));
  }
}

// ── JWT VAPID (header.payload.signature) ─────────────────────
function _vapidJwt(audience, subject, privBig) {
  var header  = _b64urlStr(JSON.stringify({ typ: 'JWT', alg: 'ES256' }));
  var exp     = Math.floor(Date.now() / 1000) + 12 * 3600;   // < 24h (limite RFC)
  var payload = _b64urlStr(JSON.stringify({ aud: audience, exp: exp, sub: subject }));
  var input   = header + '.' + payload;
  var sig     = _ecdsaSignP256(_sha256(input), privBig);
  return input + '.' + _b64url(sig);
}

// ─────────────────────────────────────────────────────────────
//  Génère la paire de clés VAPID. Stocke la privée dans les
//  Propriétés du script et loggue la publique (à coller dans config.js).
// ─────────────────────────────────────────────────────────────
function generateVapidKeys() {
  var priv = _randScalar();
  var pub  = _P256.mul(priv, _P256.G);
  var pubRaw = [4].concat(_bigTo32(pub[0])).concat(_bigTo32(pub[1])); // 0x04||X||Y (65 o)
  var pubB64  = _b64url(pubRaw);
  var privB64 = _b64url(_bigTo32(priv));

  var props = PropertiesService.getScriptProperties();
  props.setProperty('VAPID_PRIVATE', privB64);
  props.setProperty('VAPID_PUBLIC',  pubB64);

  Logger.log('✅ VAPID généré.');
  Logger.log('VAPID_PUBLIC_KEY (à coller dans js/config.js) :\n' + pubB64);
  return { publicKey: pubB64 };
}

// ─────────────────────────────────────────────────────────────
//  Envoi d'une push SANS payload à un abonnement.
//  Retourne le code HTTP (201 = OK, 404/410 = abonnement expiré).
// ─────────────────────────────────────────────────────────────
function sendWebPushNoPayload(sub, vapidPublicB64, privBig, subject) {
  var endpoint = sub.endpoint;
  var m = String(endpoint).match(/^(https?:\/\/[^\/]+)/);
  var audience = m ? m[1] : endpoint;
  var jwt = _vapidJwt(audience, subject, privBig);

  var resp = UrlFetchApp.fetch(endpoint, {
    method: 'post',
    muteHttpExceptions: true,
    contentLength: 0,
    headers: {
      'Authorization': 'vapid t=' + jwt + ', k=' + vapidPublicB64,
      'TTL': '86400',
      'Urgency': 'normal'
    }
  });
  return resp.getResponseCode();
}

// ─────────────────────────────────────────────────────────────
//  Envoie la push « prix E85 bas » à tous les abonnés.
//  Appelé par refreshPrixCarburants() (RefreshPrix.gs).
// ─────────────────────────────────────────────────────────────
function envoyerPushPrixBas(station, prix) {
  var props   = PropertiesService.getScriptProperties();
  var privB64 = props.getProperty('VAPID_PRIVATE');
  var pubB64  = props.getProperty('VAPID_PUBLIC');
  var subject = props.getProperty('VAPID_SUBJECT')
             || ('mailto:' + (Session.getEffectiveUser().getEmail() || 'no-reply@example.com'));

  if (!privB64 || !pubB64) { Logger.log('VAPID non configuré — exécuter generateVapidKeys().'); return; }

  var privBig = _bytesToBig(_b64urlToBytes(privB64));
  var subs = _readPushSubs();
  if (!subs.length) { Logger.log('Aucun abonné push.'); return; }

  var ok = 0, gone = 0, err = 0;
  subs.forEach(function (s) {
    try {
      var code = sendWebPushNoPayload(s, pubB64, privBig, subject);
      if (code === 404 || code === 410) { _removePushSub(s.endpoint); gone++; }
      else if (code >= 200 && code < 300) ok++;
      else { err++; Logger.log('push code ' + code + ' pour ' + s.endpoint.slice(0, 60)); }
    } catch (e) { err++; Logger.log('push err : ' + e.message); }
  });
  Logger.log('Push prix bas (' + station + ' ' + Number(prix).toFixed(3) + ' €/L) : '
    + ok + ' ok, ' + gone + ' expirés, ' + err + ' erreurs.');
}

// Test manuel : envoie une push aux abonnés avec un prix fictif.
function testEnvoyerPush() {
  envoyerPushPrixBas('Test station', 0.689);
}

// ─────────────────────────────────────────────────────────────
//  Stockage des abonnements (_PushSubs) — appelé depuis doPost.
// ─────────────────────────────────────────────────────────────
function handleSavePushSub(ss, payload) {
  var sub = payload.subscription;
  if (!sub || !sub.endpoint) return jsonResponse({ success: false, error: 'subscription manquante' });

  var sh   = _getPushSubsSheet(ss);
  var data = sh.getDataRange().getValues();
  var keys = sub.keys || {};
  var row  = [sub.endpoint, keys.p256dh || '', keys.auth || '', payload.seuil || '', new Date()];

  for (var i = 1; i < data.length; i++) {
    if (String(data[i][0]) === sub.endpoint) {
      sh.getRange(i + 1, 1, 1, 5).setValues([row]);
      return jsonResponse({ success: true, updated: true });
    }
  }
  sh.appendRow(row);
  return jsonResponse({ success: true });
}

function _getPushSubsSheet(ss) {
  var sh = ss.getSheetByName(PUSHSUBS_SHEET);
  if (!sh) {
    sh = ss.insertSheet(PUSHSUBS_SHEET);
    sh.appendRow(['Endpoint', 'p256dh', 'auth', 'Seuil', 'Date']);
    sh.getRange(1, 1, 1, 5)
      .setFontWeight('bold').setBackground('#1B3A5C').setFontColor('#FFFFFF');
    sh.setFrozenRows(1);
  }
  return sh;
}

function _readPushSubs() {
  var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  var sh = ss.getSheetByName(PUSHSUBS_SHEET);
  if (!sh) return [];
  return sh.getDataRange().getValues().slice(1)
    .filter(function (r) { return r[0]; })
    .map(function (r) {
      return { endpoint: String(r[0]), keys: { p256dh: String(r[1] || ''), auth: String(r[2] || '') }, seuil: r[3] };
    });
}

function _removePushSub(endpoint) {
  var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  var sh = ss.getSheetByName(PUSHSUBS_SHEET);
  if (!sh) return;
  var data = sh.getDataRange().getValues();
  for (var i = data.length - 1; i >= 1; i--) {
    if (String(data[i][0]) === endpoint) { sh.deleteRow(i + 1); break; }
  }
}
