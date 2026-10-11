// ═════════════════════════════════════════════════════════════
//  W97 — Scanner « intelligent » : pompe, compteur, ticket
//  action=scanPhotos : 1 à 3 photos → UN appel Gemini 2.5 Flash →
//  { success, photos:[{index, kind, lisible, remarque, valeurs}], fusion }.
//  Le contrôle et la fusion définitifs sont faits par l'app (js/scanControle.js).
//  Spéc : docs/superpowers/specs/2026-10-11-scan-pompe-compteur-design.md §3
// ═════════════════════════════════════════════════════════════

const SCAN_MAX_PHOTOS = 3;
const SCAN_MAX_CHARS  = 8500000;   // ≈ 6,4 Mo d'images une fois décodées
const SCAN_KINDS      = ['pompe', 'compteur', 'ticket', 'inconnu'];
const SCAN_NUM_KEYS   = ['litres', 'prix_litre', 'montant_total', 'km'];
const SCAN_TXT_KEYS   = ['date', 'type_carburant', 'enseigne', 'ville', 'station'];

/** Message d'erreur si la liste d'images est invalide, sinon null. */
function validerImagesScan_(images) {
  if (!Array.isArray(images) || !images.length) return 'Aucune photo reçue.';
  if (images.length > SCAN_MAX_PHOTOS) return SCAN_MAX_PHOTOS + ' photos maximum.';
  let total = 0;
  for (let i = 0; i < images.length; i++) {
    const d = images[i] && images[i].data;
    if (typeof d !== 'string' || !d) return 'Photo vide (n° ' + (i + 1) + ').';
    total += d.length;
  }
  if (total > SCAN_MAX_CHARS) return 'Photos trop lourdes.';
  return null;
}

/** "16,14 L" → 16.14 ; "19 719" / "19.719" (km) → 19719 ; "1.234,56 €" → 1234.56 ;
 *  sans chiffre ou non numérique → null. `entier` (km) : point/virgule = milliers. */
function scanNum_(v, entier) {
  if (v === null || v === undefined || v === '') return null;
  if (typeof v === 'number') {
    if (!isFinite(v)) return null;
    // km renvoyé en nombre avec un point de milliers : 19.719 → 19719
    if (entier && !Number.isInteger(v) && /^\d{1,3}\.\d{3}$/.test(String(v))) return Math.round(v * 1000);
    return v;
  }
  let s = String(v).replace(/[^\d.,-]/g, '');
  if (entier && /^\d{1,3}([.,]\d{3})+$/.test(s)) s = s.replace(/[.,]/g, '');
  if (s.indexOf('.') >= 0 && s.indexOf(',') >= 0) {
    // le dernier séparateur est la décimale, l'autre les milliers
    s = s.lastIndexOf(',') > s.lastIndexOf('.') ? s.replace(/\./g, '') : s.replace(/,/g, '');
  }
  s = s.replace(',', '.');
  if (!/\d/.test(s)) return null;
  const n = Number(s);
  return isFinite(n) ? n : null;
}

function scanValeurs_(source) {
  const s = source || {};
  const o = {};
  SCAN_NUM_KEYS.forEach(k => { o[k] = scanNum_(s[k], k === 'km'); });
  if (o.km !== null) o.km = Math.round(o.km);
  SCAN_TXT_KEYS.forEach(k => { o[k] = (s[k] === null || s[k] === undefined || s[k] === '') ? null : String(s[k]).trim(); });
  return o;
}

/** Normalise la réponse Gemini : kind hors liste → inconnu, nombres en chaîne → nombres. */
function normaliserScan_(data, n) {
  const d = data || {};
  const brutes = Array.isArray(d.photos) ? d.photos : [];
  const photos = [];
  brutes.forEach((p, i) => {
    const q = p || {};
    const ix = Number(q.index);
    const index = (q.index !== null && q.index !== undefined && q.index !== '' && Number.isInteger(ix)) ? ix : i;
    if (index < 0 || index >= n) return;
    const kind = String(q.kind || '').toLowerCase().trim();
    photos.push({
      index:    index,
      kind:     SCAN_KINDS.indexOf(kind) >= 0 ? kind : 'inconnu',
      lisible:  q.lisible === true || q.lisible === 'true',
      remarque: q.remarque ? String(q.remarque) : null,
      valeurs:  scanValeurs_(q.valeurs),
    });
  });
  return { photos: photos, fusion: scanValeurs_(d.fusion) };
}

function scanPromptPhotos_(n) {
  return 'Tu reçois ' + n + ' photo(s) prise(s) lors d\'un plein de carburant en France, numérotées à partir de 0 ' +
    '(chaque image est précédée de son numéro).\n' +
    'Pour CHAQUE photo, détermine son type :\n' +
    '- "pompe" : afficheur d\'une pompe à carburant (segments lumineux ou écran LCD) ;\n' +
    '- "compteur" : tableau de bord / compteur kilométrique d\'un véhicule ;\n' +
    '- "ticket" : ticket de caisse de station-service ;\n' +
    '- "inconnu" : autre chose, ou photo inexploitable.\n\n' +
    'Règles par type :\n' +
    '- pompe : "Litres" / "Volume" → litres ; "Prix au litre" / "Prix/L" / "€/L" → prix_litre ; ' +
    '"Montant" / "À payer" / "Prix" en euros → montant_total. Afficheurs à segments : distingue bien 1/7, 5/6, 8/0. ' +
    'type_carburant UNIQUEMENT s\'il est lisible (étiquette du pistolet, voyant ou bouton du produit choisi), sinon null.\n' +
    '- compteur : km = le TOTAL kilométrique (ODO), JAMAIS un compteur journalier (TRIP, TRIP A, TRIP B) ni l\'autonomie ; entier en km, SANS séparateur de milliers (ex. 19719).\n' +
    '- ticket : "Quantité" / "Volume" → litres ; "Prix unitaire" / "P.U." / "Prix/L" → prix_litre (jamais la TVA) ; ' +
    '"Montant" / "Total" / "Net à payer" → montant_total ; date au format YYYY-MM-DD ("26" = 2026) ; ' +
    'enseigne = nom commercial seul ; ville = commune seule ; station = enseigne + ville.\n' +
    '- Carburants possibles : E85, SP98, SP95, E10, Gazole, GPLc.\n' +
    '- Nombres : chiffres seuls, sans unité (pas de "L", "€" ni "km").\n' +
    '- Une valeur illisible vaut null : ne JAMAIS deviner ni recalculer une valeur.\n' +
    '- lisible = false si la photo ne permet de lire aucune valeur utile ; remarque = courte explication (ex. "photo floue") ou null.\n\n' +
    'Réponds UNIQUEMENT avec ce JSON :\n' +
    '{"photos":[{"index":0,"kind":"pompe|compteur|ticket|inconnu","lisible":true,"remarque":null,' +
    '"valeurs":{"litres":null,"prix_litre":null,"montant_total":null,"type_carburant":null,"km":null,' +
    '"date":null,"enseigne":null,"ville":null,"station":null}}],' +
    '"fusion":{"date":null,"km":null,"litres":null,"prix_litre":null,"montant_total":null,' +
    '"type_carburant":null,"enseigne":null,"ville":null,"station":null}}\n' +
    '"fusion" = ta meilleure lecture globale (pompe prioritaire sur le ticket pour litres, prix et montant ; compteur prioritaire pour km).';
}

/** action=scanPhotos — un seul appel Gemini pour 1 à 3 photos. */
function handleScanPhotos(payload) {
  const p = payload || {};
  const invalide = validerImagesScan_(p.images);
  if (invalide) return jsonResponse({ success: false, error: invalide });

  if (rateLimit(p.cid)) {
    return jsonResponse({ success: false, code: 'RATE_LIMIT', error: 'Trop d\'analyses, réessayez dans une minute.' });
  }

  const apiKey = PropertiesService.getScriptProperties().getProperty('GEMINI_API_KEY');
  if (!apiKey) {
    return jsonResponse({ success: false, error: 'Clé GEMINI_API_KEY non configurée dans les propriétés du script.' });
  }

  const parts = [{ text: scanPromptPhotos_(p.images.length) }];
  p.images.forEach((img, i) => {
    parts.push({ text: 'Image ' + i + ' :' });
    parts.push({ inlineData: { mimeType: img.mimeType || 'image/jpeg', data: img.data } });
  });

  const url = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=' + apiKey;
  try {
    const resp = UrlFetchApp.fetch(url, {
      method:             'post',
      contentType:        'application/json',
      muteHttpExceptions: true,
      payload: JSON.stringify({
        contents: [{ parts: parts }],
        generationConfig: {
          temperature:      0.1,
          maxOutputTokens:  2048,
          responseMimeType: 'application/json',
          thinkingConfig:   { thinkingBudget: 0 },   // sinon la réflexion épuise maxOutputTokens
        },
      }),
    });
    const result = JSON.parse(resp.getContentText());
    if (result.error) return jsonResponse({ success: false, error: result.error.message || 'Erreur API Gemini.' });

    const texte = (result.candidates?.[0]?.content?.parts?.[0]?.text || '')
      .trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim();
    const m = texte.match(/\{[\s\S]*\}/);
    if (!m) return jsonResponse({ success: false, error: 'Réponse IA illisible.' });

    const norm = normaliserScan_(JSON.parse(m[0]), p.images.length);
    return jsonResponse({ success: true, photos: norm.photos, fusion: norm.fusion });
  } catch (err) {
    return jsonResponse({ success: false, error: err.message });
  }
}
