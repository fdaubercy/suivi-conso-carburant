// ============================================================
//  SUIVI CONSO CARBURANTS — Web Push VAPID (sans payload)   v3.4.0.1
//  Roadmap S10
//
//  Envoi de notifications Web Push SANS payload (RFC 8030) depuis
//  Google Apps Script. Pas de chiffrement applicatif (RFC 8291) :
//  le Service Worker récupère le détail du prix via ?action=lowprice.
//  Seule l'authentification VAPID (JWT ES256, courbe P-256) est requise.
//
//  ⚠️ Apps Script (V8) ne supporte PAS BigInt → la signature ECDSA
//  est déléguée à la librairie jsrsasign, chargée à la volée depuis un
//  CDN (eval) — pattern standard et fiable pour le VAPID en GAS.
//
//  ── MISE EN PLACE (une seule fois) ─────────────────────────
//    1. Executer  generateVapidKeys()  → loggue la clé PUBLIQUE.
//       (la clé PRIVÉE est stockée dans les Propriétés du script).
//    2. Coller la clé PUBLIQUE loggée dans  js/config.js :
//         export const VAPID_PUBLIC_KEY = '<...>';
//    3. (Optionnel) Propriété de script  VAPID_SUBJECT  = 'mailto:vous@email'.
//    4. (Optionnel) Propriété  SEUIL_PUSH_E85  = 0.70  (€/L).
//    5. Tester :  testEnvoyerPush()  (après s'être abonné dans l'app).
//
//  Dépend des globales de Code.gs / RefreshPrix.gs :
//    SPREADSHEET_ID, PUSHSUBS_SHEET, jsonResponse()
// ============================================================

// Source jsrsasign (signature ES256/P-256). CDN réputé, chargé via eval.
var JSRSASIGN_URL =
  'https://cdnjs.cloudflare.com/ajax/libs/jsrsasign/11.1.0/jsrsasign-all-min.js';

// ── Récupère le code de jsrsasign (cache best-effort) ────────
function _getJsrsasignSrc() {
  var cache = CacheService.getScriptCache();
  var src = null;
  try { src = cache.get('jsrsasign_src'); } catch (e) { src = null; }
  if (!src) {
    src = UrlFetchApp.fetch(JSRSASIGN_URL, { muteHttpExceptions: true }).getContentText();
    try { cache.put('jsrsasign_src', src, 21600); } catch (e) { /* > 100 Ko → non caché */ }
  }
  return src;
}

// ── Helpers octets / hex / base64url ─────────────────────────
function _hexToBytes(hex) {
  var a = [];
  for (var i = 0; i < hex.length; i += 2) a.push(parseInt(hex.substr(i, 2), 16));
  return a;
}
function _toSigned(arr) { return arr.map(function (v) { v &= 0xff; return v > 127 ? v - 256 : v; }); }
function _b64url(arr)   { return Utilities.base64EncodeWebSafe(_toSigned(arr)).replace(/=+$/, ''); }

// ─────────────────────────────────────────────────────────────
//  Génère la paire de clés VAPID (jsrsasign). Stocke la privée
//  (hex) dans les Propriétés, loggue la publique (base64url, 65 o).
// ─────────────────────────────────────────────────────────────
function generateVapidKeys() {
  // jsrsasign référence navigator/window au chargement → shims (scope partagé par eval)
  var navigator = { appName: 'Netscape', userAgent: 'GAS', appVersion: '5.0' };
  var window = {};
  var src = _getJsrsasignSrc();
  eval(src);                                   // expose KJUR / KEYUTIL dans ce scope
  if (typeof KEYUTIL === 'undefined') throw new Error('jsrsasign non chargé.');

  var kp      = KEYUTIL.generateKeypair('EC', 'secp256r1');
  var prvHex  = kp.prvKeyObj.prvKeyHex;        // scalaire privé (hex)
  var pubHex  = kp.pubKeyObj.pubKeyHex;        // "04" + X + Y (non compressé)
  if (prvHex.length < 64) prvHex = ('0'.repeat(64) + prvHex).slice(-64); // pad 32 o

  var pubB64 = _b64url(_hexToBytes(pubHex));

  var props = PropertiesService.getScriptProperties();
  props.setProperty('VAPID_PRIVATE', prvHex);
  props.setProperty('VAPID_PUBLIC',  pubB64);

  Logger.log('✅ VAPID généré.');
  Logger.log('VAPID_PUBLIC_KEY (à coller dans js/config.js) :\n' + pubB64);
  return { publicKey: pubB64 };
}

// ─────────────────────────────────────────────────────────────
//  W49 — Envoie la push « prix bas » par carburant.
//  best = { E85:{station,prix}, GAZOLE:{...}, SP98:{...} } (clés
//  éventuellement absentes). Un abonné est « réveillé » (push sans
//  payload) dès qu'AU MOINS un carburant passe sous SON seuil pour ce
//  carburant (colonnes SeuilE85/SeuilGazole/SeuilSP98 de _PushSubs ;
//  un seuil absent / ≤ 0 = carburant désactivé pour cet abonné).
//  Le Service Worker lit ensuite ?action=lowprices + ses seuils locaux
//  pour afficher la (les) notification(s) du/des bon(s) carburant(s).
//  force=true ignore les seuils (test).
// ─────────────────────────────────────────────────────────────
function envoyerPushPrixBasMulti(best, force) {
  var props   = PropertiesService.getScriptProperties();
  var prvHex  = props.getProperty('VAPID_PRIVATE');
  var pubB64  = props.getProperty('VAPID_PUBLIC');
  var subject = props.getProperty('VAPID_SUBJECT')
             || ('mailto:' + (Session.getEffectiveUser().getEmail() || 'no-reply@example.com'));

  if (!prvHex || !pubB64) { Logger.log('VAPID non configuré — exécuter generateVapidKeys().'); return; }

  var subs = _readPushSubs();
  if (!subs.length) { Logger.log('Aucun abonné push.'); return; }

  var FUEL_KEYS = (typeof FUELS !== 'undefined')
    ? FUELS.map(function (f) { return f.key; })
    : ['E85', 'GAZOLE', 'SP98'];

  // jsrsasign référence navigator/window au chargement → shims (scope partagé par eval)
  var navigator = { appName: 'Netscape', userAgent: 'GAS', appVersion: '5.0' };
  var window = {};
  var src = _getJsrsasignSrc();
  eval(src);                                   // KJUR disponible dans ce scope
  if (typeof KJUR === 'undefined') { Logger.log('jsrsasign non chargé — push annulée.'); return; }

  var prvKey = new KJUR.crypto.ECDSA({ curve: 'secp256r1', prv: prvHex });

  function buildJwt(audience) {
    var header  = JSON.stringify({ typ: 'JWT', alg: 'ES256' });
    var exp     = Math.floor(Date.now() / 1000) + 12 * 3600;   // < 24 h (RFC 8292)
    var payload = JSON.stringify({ aud: audience, exp: exp, sub: subject });
    return KJUR.jws.JWS.sign('ES256', header, payload, prvKey);
  }

  var ok = 0, gone = 0, err = 0, skip = 0;
  subs.forEach(function (s) {
    // Carburants déclenchés pour CET abonné (prix du jour <= son seuil > 0).
    var hit = force || FUEL_KEYS.some(function (k) {
      var seuil = Number(s.seuils && s.seuils[k]);
      var rec   = best && best[k];
      return seuil > 0 && rec && Number(rec.prix) <= seuil;
    });
    if (!hit) { skip++; return; }
    try {
      var m = String(s.endpoint).match(/^(https?:\/\/[^\/]+)/);
      var audience = m ? m[1] : s.endpoint;
      var jwt = buildJwt(audience);

      var resp = UrlFetchApp.fetch(s.endpoint, {
        method: 'post',
        muteHttpExceptions: true,
        contentLength: 0,
        headers: {
          'Authorization': 'vapid t=' + jwt + ', k=' + pubB64,
          'TTL': '86400',
          'Urgency': 'normal'
        }
      });
      var code = resp.getResponseCode();
      if (code === 404 || code === 410) { _removePushSub(s.endpoint); gone++; }
      else if (code >= 200 && code < 300) ok++;
      else { err++; Logger.log('push code ' + code + ' : ' + resp.getContentText().slice(0, 120)); }
    } catch (e) { err++; Logger.log('push err : ' + e.message); }
  });

  var resume = FUEL_KEYS.filter(function (k) { return best && best[k]; })
    .map(function (k) { return k + ' ' + Number(best[k].prix).toFixed(3); }).join(', ');
  Logger.log('Push prix bas [' + resume + '] : '
    + ok + ' ok, ' + gone + ' expirés, ' + err + ' erreurs, ' + skip + ' ignorés (aucun seuil atteint).');
}

// Rétrocompat : ancienne signature E85. station/prix → best={E85:...}.
function envoyerPushPrixBas(station, prix, force) {
  envoyerPushPrixBasMulti({ E85: { station: station, prix: prix } }, force);
}

// Test manuel : force l'envoi aux abonnés (ignore les seuils) avec des prix fictifs.
function testEnvoyerPush() {
  envoyerPushPrixBasMulti({
    E85:    { station: 'Test E85',    prix: 0.689 },
    GAZOLE: { station: 'Test Gazole', prix: 1.559 },
    SP98:   { station: 'Test SP98',   prix: 1.799 },
  }, true);
}

// ─────────────────────────────────────────────────────────────
//  Stockage des abonnements (_PushSubs) — appelé depuis doPost.
// ─────────────────────────────────────────────────────────────
//  Colonnes _PushSubs : A Endpoint · B p256dh · C auth · D Seuil(E85 hérité) ·
//  E Date · F SeuilE85 · G SeuilGazole · H SeuilSP98.
//  La colonne D (héritée) reste écrite = SeuilE85 pour rétrocompat.
function handleSavePushSub(ss, payload) {
  var sub = payload.subscription;
  if (!sub || !sub.endpoint) return jsonResponse({ success: false, error: 'subscription manquante' });

  var sh   = _getPushSubsSheet(ss);
  var data = sh.getDataRange().getValues();
  var keys = sub.keys || {};

  // Seuils par carburant : payload.seuils {E85,GAZOLE,SP98}. Rétrocompat :
  // ancien payload.seuil → E85 uniquement. '' = carburant désactivé.
  var seuils = payload.seuils || {};
  var sE85   = (seuils.E85    != null) ? seuils.E85    : (payload.seuil != null ? payload.seuil : '');
  var sGAZ   = (seuils.GAZOLE != null) ? seuils.GAZOLE : '';
  var sSP98  = (seuils.SP98   != null) ? seuils.SP98   : '';

  var row = [sub.endpoint, keys.p256dh || '', keys.auth || '',
             sE85 || '', new Date(), sE85 || '', sGAZ || '', sSP98 || ''];

  for (var i = 1; i < data.length; i++) {
    if (String(data[i][0]) === sub.endpoint) {
      sh.getRange(i + 1, 1, 1, 8).setValues([row]);
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
    sh.appendRow(['Endpoint', 'p256dh', 'auth', 'Seuil', 'Date', 'SeuilE85', 'SeuilGazole', 'SeuilSP98']);
    sh.getRange(1, 1, 1, 8)
      .setFontWeight('bold').setBackground('#1B3A5C').setFontColor('#FFFFFF');
    sh.setFrozenRows(1);
    return sh;
  }
  // Migration douce : ajoute les colonnes seuil par carburant si absentes.
  if (sh.getLastColumn() < 8) {
    sh.getRange(1, 6, 1, 3).setValues([['SeuilE85', 'SeuilGazole', 'SeuilSP98']])
      .setFontWeight('bold').setBackground('#1B3A5C').setFontColor('#FFFFFF');
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
      // Seuils par carburant (F,G,H) ; repli E85 sur l'ancienne colonne D.
      var sE85 = (r[5] !== '' && r[5] != null) ? r[5] : r[3];
      return {
        endpoint: String(r[0]),
        keys: { p256dh: String(r[1] || ''), auth: String(r[2] || '') },
        seuil: r[3],                                   // rétrocompat
        seuils: { E85: sE85, GAZOLE: r[6], SP98: r[7] }
      };
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
