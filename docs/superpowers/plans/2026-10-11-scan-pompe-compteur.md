# W97 — Scanner « intelligent » (pompe, compteur, ticket) — Plan d'implémentation

> **Pour les agents d'exécution :** SOUS-SKILL REQUISE : `superpowers:subagent-driven-development` (recommandé) ou `superpowers:executing-plans` pour exécuter ce plan tâche par tâche. Les étapes utilisent des cases à cocher (`- [ ]`).

**Objectif :** pré-remplir le formulaire d'un plein à partir de 1 à 3 photos (afficheur de pompe, compteur kilométrique, ticket) analysées en un seul appel IA, avec contrôles croisés et alertes sous les champs douteux.

**Architecture :** l'app redimensionne les photos et les envoie en un appel `action=scanPhotos` au script Google (nouveau `Scan.gs`), qui interroge Gemini 2.5 Flash et renvoie une lecture **par photo**, normalisée. L'app recoupe ces lectures dans un module pur (`js/scanControle.js`, règles R1 à R5), remplit le formulaire via le `fillFormFromTicket` existant, puis pose les alertes avec un nouvel assistant `setFieldWarning` (`js/ui.js`). L'orchestration (envoi, replis, photo jointe) vit dans un nouveau `js/scanPhotos.js` pour ne pas alourdir `js/ticket.js` (déjà 759 lignes).

**Stack :** Vite (PWA, modules ES `js/`), Vitest (node par défaut, jsdom via commentaire d'en-tête), ESLint strict (`--max-warnings=0`), Google Apps Script V8 (`gas-deploy.mjs`), Gemini 2.5 Flash.

**Spéc :** `docs/superpowers/specs/2026-10-11-scan-pompe-compteur-design.md` — l'exécutant lit la spéc ET ce plan.

## Contraintes globales

- Langue : textes visibles, commentaires et messages en **français** ; identifiants de code en anglais ou français selon le fichier voisin.
- Modèle Gemini : `gemini-2.5-flash` ; `temperature: 0.1` ; `thinkingConfig.thinkingBudget: 0` ; `responseMimeType: "application/json"`.
- 1 à 3 images par analyse ; au-delà, seules les 3 premières sont gardées, avec un message.
- Seuils (constantes nommées en tête de `js/scanControle.js`) : écart pompe/ticket 2 % ; triplet `max(0,05 €, 1 %)` ; type déduit ≤ 8 % et 2ᵉ candidat ≥ 2× plus éloigné ; type lu compatible ≤ 15 % ; prix station 10 % ; TRIP < 10 % du dernier km ; distance hors [0,5 ; 1,6] × attendue ; médiane des prix sur 90 jours.
- Délai max de l'appel IA : 45 s (`AbortController`). Poids max envoyé : 6 Mo (côté app).
- Hors ligne : 1 photo → OCR Tesseract (ticket) ; 2 ou 3 → « Analyse IA indisponible hors connexion — seul un ticket peut être lu hors ligne. »
- Seule l'image classée `ticket` devient `state._ticketPhoto` (W9) ; sinon aucune photo jointe.
- **Ordre de mise en service : script Google (avec `Scan.gs`) déployé AVANT l'app** — un ancien `doPost` traiterait `scanPhotos` comme un enregistrement de plein.
- Rien n'est enregistré sans relecture : le scan ne fait que remplir le formulaire.
- Fichiers < 500 lignes pour les nouveaux modules. Ne jamais committer de secret (`SYNC_SECRET`, jetons OAuth, clés privées).
- **Pas de commit intermédiaire** : la règle du projet impose `/graphify --update` (avec garde anti-amputation) avant chaque commit et un commit par livraison → commit unique en tâche 6. Chaque tâche se termine par un point de contrôle `npm test` + `npm run lint`.
- Version livrée : **5.38.0.0** (nouvelle fonctionnalité).
- `<scratchpad>` = dossier temporaire de la session (hors dépôt) pour les scripts jetables ; ne rien écrire à la racine du dépôt.

## Points d'attention (revue)

1. **Ancien script Google ou mauvais aiguillage** : `scanPhotos` doit être traité par `doPost` avant toute logique d'enregistrement de plein → test d'aiguillage `doPost` (tâche 2).
2. **Nombres « à la française » renvoyés par l'IA** (`"16,14"`, `"19 719"`) : doivent devenir des nombres, pas `null` → test de `normaliserScan_` (tâche 2).
3. **Correspondance photo ↔ image** : la photo jointe doit être celle dont l'`index` est classé `ticket`, même si l'IA renvoie les photos dans le désordre → test `lancerScan` (tâche 4).
4. **Nouveau scan sur un formulaire déjà annoté** : pas d'alertes en double ni d'alertes périmées → tests `setFieldWarning` (tâche 3) + `clearFieldWarnings` appelé au début de `remplirDepuisScan` (tâche 4).
5. **Photos lourdes** (HEIC non décodable : `resizeImage` renvoie le fichier d'origine) : message clair, aucun envoi → test « trop lourdes » (tâche 4).

---

## Structure des fichiers

| Fichier | Responsabilité |
|---|---|
| `js/scanControle.js` (**nouveau**) | Module pur : `analyserScan` (R1–R5), `formaterBilan`, `cleTypeLu` |
| `js/refmodel.js` | `matchType` devient exporté (réutilisé par R3) |
| `Google Apps Script/Scan.gs` (**nouveau**) | `validerImagesScan_`, `normaliserScan_`, `scanPromptPhotos_`, `handleScanPhotos` |
| `Google Apps Script/Code.gs` | `doPost` : aiguillage `scanPhotos` à côté de `scanTicket` |
| `js/ui.js` | `setFieldWarning(id, msg)`, `clearFieldWarnings()` |
| `css/style.css` | style `.field-warn` |
| `js/formulaire.js` | `resetForm` efface les alertes |
| `js/ticket.js` | exporte `resizeImage`, `blobToBase64`, `fillFormFromTicket(data, opts)` ; `lireTicketOCR` remplace `initScanner` ; suppression de `scanWithGemini` (devenu inutile) |
| `js/scanPhotos.js` (**nouveau**) | Orchestration : `envoyerScanPhotos`, `construireContexte`, `remplirDepuisScan`, `lancerScan`, `initScanner` |
| `js/main.js` | `initScanner` importé depuis `scanPhotos.js` |
| `index.html` | libellé du bouton + indication |
| `tests/scanControle.test.js`, `tests/scanGas.test.js`, `tests/scanPhotos.test.js` (**nouveaux**), `tests/ui.test.js` | tests |

> Écart assumé avec le tableau §7 de la spéc : les tests d'orchestration vont dans `tests/scanPhotos.test.js` (le code testé vit dans `js/scanPhotos.js`), pas dans `tests/ticket.test.js`.

Chemin du dossier GAS (abrégé `GAS/` ci-dessous) : `Google Drive/Sauvegarde & Geolocalisation - Suivi conso SuperEthanol/Google Apps Script/`.

---

### Tâche 1 : module de contrôle `js/scanControle.js` (R1 à R5)

**Fichiers :**
- Créer : `js/scanControle.js`
- Modifier : `js/refmodel.js:22` (`function matchType` → `export function matchType`)
- Test : `tests/scanControle.test.js`

**Interfaces :**
- Consomme : `FUEL_CONFIG` (`js/config.js`, clés `E85 SP98 SP95 E10 GAZOLE GPLC`, champs `label`, `short`) ; `matchType(rType, fuelKey) → boolean` (`js/refmodel.js`).
- Produit :
  - `analyserScan(reponse, contexte) → { valeurs, sources, alertes, resume }`
    - `reponse` = `{ photos?: [{ index, kind, lisible, remarque, valeurs }], fusion?: {...} }`
    - `contexte` = `{ stationPrices: {E85: 0.869, …}, historiqueVehicule: Record[], dernierKm: number|null, consoParType: {E85: 6.6, …}, typeCourant: 'E85', aujourdHui: Date }`
    - `valeurs` = `{ date?, km?, litres?, prix_litre?, montant_total?, type_carburant?: clé FUEL_CONFIG, enseigne?, ville?, station? }` (champ absent = non lu ; `type_carburant` absent = garder le type courant)
    - `sources[champ]` ∈ `'pompe' | 'compteur' | 'ticket' | 'calcul' | 'deduit'` ; `alertes[champ]` = message (mêmes noms de champ que `valeurs`)
    - `resume` = `[{ index, kind, lisible, remarque }]`
  - `formaterBilan(resume, remplis, nbAlertes) → string`
  - `cleTypeLu(texte) → clé FUEL_CONFIG | null`

- [ ] **Étape 1 : écrire les tests qui échouent**

Créer `tests/scanControle.test.js` :

```js
/**
 * Tests — js/scanControle.js (W97) : fusion et contrôle des lectures du scanner.
 * Spéc : docs/superpowers/specs/2026-10-11-scan-pompe-compteur-design.md §4 (R1 à R5).
 */
import { describe, it, expect } from 'vitest';
import { analyserScan, formaterBilan, cleTypeLu } from '../js/scanControle.js';

const AUJ = new Date('2026-10-11T12:00:00');
const plein = (date, type, prix, km = 1000) => ({
  Date: date + ' 00:00:00', Type: type, 'Prix €/L': prix, 'Km compteur': km, 'Nb. Litres': 15,
});
const pompe = (valeurs, index = 0) => ({ index, kind: 'pompe', lisible: true, valeurs });
const compteur = (km, index = 1) => ({ index, kind: 'compteur', lisible: true, valeurs: { km } });
const ticket = (valeurs, index = 2) => ({ index, kind: 'ticket', lisible: true, valeurs });
const ctx = (o = {}) => ({
  stationPrices: {}, historiqueVehicule: [], dernierKm: null, consoParType: {},
  typeCourant: 'E85', aujourdHui: AUJ, ...o,
});
const HIST_E85 = [plein('2026-09-22', 'SuperEthanol E85', 0.869, 19473)];

describe('analyserScan — jeu réel (Z900, 16,14 L × 0,869 €)', () => {
  it('remplit tout, déduit E85 et ne signale que le type déduit', () => {
    const r = analyserScan(
      { photos: [pompe({ litres: 16.14, prix_litre: 0.869, montant_total: 14.03 }), compteur(19719)] },
      ctx({ stationPrices: { E85: 0.869, SP98: 1.95 }, historiqueVehicule: HIST_E85,
            dernierKm: 19473, consoParType: { E85: 6.6 } }));
    expect(r.valeurs).toEqual({ litres: 16.14, prix_litre: 0.869, montant_total: 14.03, km: 19719, type_carburant: 'E85' });
    expect(r.sources).toEqual({ litres: 'pompe', prix_litre: 'pompe', montant_total: 'pompe', km: 'compteur', type_carburant: 'deduit' });
    expect(r.alertes).toEqual({ type_carburant: 'type déduit du prix (0,869 €/L → E85)' });
    expect(r.resume).toEqual([
      { index: 0, kind: 'pompe', lisible: true, remarque: null },
      { index: 1, kind: 'compteur', lisible: true, remarque: null },
    ]);
  });
});

describe('R1 — priorité des sources', () => {
  it('pompe et ticket en désaccord (> 2 %) : pompe gardée + alerte', () => {
    const r = analyserScan({ photos: [pompe({ litres: 16.14 }), ticket({ litres: 16.6, date: '2026-10-10' })] }, ctx());
    expect(r.valeurs.litres).toBe(16.14);
    expect(r.alertes.litres).toBe('pompe et ticket diffèrent (16,14 / 16,60)');
    expect(r.valeurs.date).toBe('2026-10-10');
    expect(r.sources.date).toBe('ticket');
  });
  it('écart ≤ 2 % : pas d\'alerte', () => {
    const r = analyserScan({ photos: [pompe({ litres: 16.14 }), ticket({ litres: 16.2 })] }, ctx());
    expect(r.alertes.litres).toBeUndefined();
  });
  it('ticket seul : ses valeurs sont reprises', () => {
    const r = analyserScan({ photos: [ticket({ litres: 20, prix_litre: 1.9, montant_total: 38 }, 0)] }, ctx());
    expect(r.sources.litres).toBe('ticket');
    expect(r.valeurs.montant_total).toBe(38);
  });
  it('compteur prioritaire sur le km du ticket', () => {
    const r = analyserScan({ photos: [compteur(19719, 0), ticket({ km: 19000 }, 1)] }, ctx());
    expect(r.valeurs.km).toBe(19719);
    expect(r.sources.km).toBe('compteur');
  });
  it('photos absentes ou vides : repli sur fusion', () => {
    const r = analyserScan({ photos: [], fusion: { litres: 16.14, prix_litre: 0.869, km: 19719, date: null } }, ctx());
    expect(r.valeurs).toMatchObject({ litres: 16.14, prix_litre: 0.869, km: 19719 });
    expect(r.valeurs.date).toBeUndefined();
    expect(r.resume).toEqual([]);
  });
});

describe('R2 — litres × prix = montant', () => {
  it('3 valeurs incohérentes : pas de correction, alerte sur litres et montant', () => {
    const r = analyserScan({ photos: [pompe({ litres: 16.14, prix_litre: 0.869, montant_total: 15.03 })] }, ctx());
    expect(r.valeurs.montant_total).toBe(15.03);
    expect(r.alertes.litres).toBe('16,14 × 0,869 = 14,03 € ≠ 15,03 € lus');
    expect(r.alertes.montant_total).toBe('16,14 × 0,869 = 14,03 € ≠ 15,03 € lus');
  });
  it('litres + prix → montant calculé', () => {
    const r = analyserScan({ photos: [pompe({ litres: 16.14, prix_litre: 0.869 })] }, ctx());
    expect(r.valeurs.montant_total).toBe(14.03);
    expect(r.sources.montant_total).toBe('calcul');
  });
  it('litres + montant → prix calculé', () => {
    const r = analyserScan({ photos: [pompe({ litres: 15, montant_total: 30 })] }, ctx());
    expect(r.valeurs.prix_litre).toBe(2);
    expect(r.sources.prix_litre).toBe('calcul');
  });
  it('prix + montant → litres calculés', () => {
    const r = analyserScan({ photos: [pompe({ prix_litre: 2, montant_total: 30 })] }, ctx());
    expect(r.valeurs.litres).toBe(15);
    expect(r.sources.litres).toBe('calcul');
  });
  it('une seule valeur lue : rien n\'est calculé, aucune alerte', () => {
    const r = analyserScan({ photos: [pompe({ litres: 16.14 })] }, ctx());
    expect(r.valeurs).toEqual({ litres: 16.14 });
    expect(r.alertes).toEqual({});
  });
});

describe('R3 — type de carburant', () => {
  it('ambigu (deux prix station proches) : type courant gardé + « type à vérifier »', () => {
    const r = analyserScan({ photos: [pompe({ prix_litre: 1.78 })] },
      ctx({ stationPrices: { SP95: 1.80, E10: 1.76 } }));
    expect(r.valeurs.type_carburant).toBeUndefined();
    expect(r.alertes.type_carburant).toBe('type à vérifier');
  });
  it('type lu compatible : conservé, sans alerte', () => {
    const r = analyserScan({ photos: [pompe({ prix_litre: 1.95, type_carburant: 'SP98' })] },
      ctx({ stationPrices: { SP98: 1.949 } }));
    expect(r.valeurs.type_carburant).toBe('SP98');
    expect(r.sources.type_carburant).toBe('pompe');
    expect(r.alertes.type_carburant).toBeUndefined();
  });
  it('type lu incompatible : alerte, et type déduit du prix retenu', () => {
    const r = analyserScan({ photos: [pompe({ prix_litre: 0.869, type_carburant: 'SP98' })] },
      ctx({ stationPrices: { E85: 0.869, SP98: 1.95 } }));
    expect(r.alertes.type_carburant).toBe('type lu (SP98) incompatible avec 0,869 €/L');
    expect(r.valeurs.type_carburant).toBe('E85');
    expect(r.sources.type_carburant).toBe('deduit');
  });
  it('sans prix station : médiane des prix du véhicule sur 90 jours', () => {
    const hist = [
      plein('2026-09-01', 'SuperEthanol E85', 0.85), plein('2026-09-20', 'SuperEthanol E85', 0.87),
      plein('2026-10-01', 'SuperEthanol E85', 0.89), plein('2026-01-05', 'Super 98', 2.0),
    ];
    const r = analyserScan({ photos: [pompe({ prix_litre: 0.87 })] }, ctx({ historiqueVehicule: hist }));
    expect(r.valeurs.type_carburant).toBe('E85');
  });
  it('restreint aux carburants déjà utilisés par le véhicule', () => {
    const r = analyserScan({ photos: [pompe({ prix_litre: 1.80 })] },
      ctx({ stationPrices: { SP95: 1.80, E10: 1.79 }, historiqueVehicule: [plein('2026-10-01', 'Sans Plomb 95', 1.81)] }));
    expect(r.valeurs.type_carburant).toBe('SP95');
  });
  it('aucun prix lu ni type lu : aucune alerte de type', () => {
    const r = analyserScan({ photos: [compteur(19719, 0)] }, ctx());
    expect(r.alertes.type_carburant).toBeUndefined();
  });
});

describe('R4 — kilométrage', () => {
  it('km ≤ dernier plein', () => {
    const r = analyserScan({ photos: [compteur(19400, 0)] }, ctx({ dernierKm: 19473 }));
    expect(r.alertes.km).toBe('inférieur ou égal au dernier plein (19 473 km)');
  });
  it('compteur partiel (TRIP) lu', () => {
    const r = analyserScan({ photos: [compteur(245, 0)] }, ctx({ dernierKm: 19473 }));
    expect(r.alertes.km).toBe('compteur partiel (TRIP) lu ?');
  });
  it('distance improbable pour les litres servis', () => {
    const r = analyserScan({ photos: [pompe({ litres: 16.14, prix_litre: 0.869 }), compteur(20085)] },
      ctx({ dernierKm: 19473, consoParType: { E85: 6.6 }, stationPrices: { E85: 0.869 } }));
    expect(r.alertes.km).toBe('612 km pour 16,1 L : improbable (≈ 240 km attendus)');
  });
  it('sans conso moyenne : pas de contrôle de distance', () => {
    const r = analyserScan({ photos: [pompe({ litres: 16.14 }), compteur(20085)] }, ctx({ dernierKm: 19473 }));
    expect(r.alertes.km).toBeUndefined();
  });
});

describe('R5 — prix plausible', () => {
  it('écart ≤ 10 % avec le prix station : pas d\'alerte prix', () => {
    const r = analyserScan({ photos: [pompe({ prix_litre: 0.95 })] }, ctx({ stationPrices: { E85: 0.869 } }));
    expect(r.alertes.prix_litre).toBeUndefined();
  });
  it('écart > 10 % : alerte (type courant utilisé faute de déduction)', () => {
    const r = analyserScan({ photos: [pompe({ prix_litre: 0.99 })] }, ctx({ stationPrices: { E85: 0.869 } }));
    expect(r.alertes.prix_litre).toBe('différent du prix affiché par la station (0,869 €)');
    expect(r.alertes.type_carburant).toBe('type à vérifier');
  });
});

describe('formaterBilan', () => {
  const res = [{ kind: 'pompe', lisible: true }, { kind: 'compteur', lisible: true }, { kind: 'inconnu', lisible: false }];
  it('pluriel, photos reconnues et champs à vérifier', () => {
    expect(formaterBilan(res, 6, 1)).toBe('3 photos analysées : pompe ✓, compteur ✓, photo ? ✗ — 6 champs pré-remplis, 1 à vérifier');
  });
  it('singulier, sans alerte', () => {
    expect(formaterBilan([{ kind: 'ticket', lisible: true }], 1, 0)).toBe('1 photo analysée : ticket ✓ — 1 champ pré-rempli');
  });
});

describe('cleTypeLu', () => {
  it.each([
    ['E85', 'E85'], ['SuperEthanol', 'E85'], ['SP98', 'SP98'], ['SP95', 'SP95'],
    ['SP95-E10', 'E10'], ['Gazole', 'GAZOLE'], ['Diesel B7', 'GAZOLE'], ['GPLc', 'GPLC'],
    [null, null], ['AdBlue', null],
  ])('%s → %s', (lu, cle) => expect(cleTypeLu(lu)).toBe(cle));
});
```

- [ ] **Étape 2 : vérifier l'échec**

Lancer : `npx vitest run tests/scanControle.test.js`
Attendu : ÉCHEC (« Failed to load url ../js/scanControle.js » ou équivalent).

- [ ] **Étape 3 : exporter `matchType`**

Dans `js/refmodel.js`, ligne 22, remplacer `function matchType(rType, fuelKey) {` par `export function matchType(rType, fuelKey) {`.

- [ ] **Étape 4 : écrire `js/scanControle.js`**

```js
/* ─── W97 — Contrôle et fusion des lectures du scanner (pompe, compteur, ticket) ───
 *  Module PUR (aucun accès DOM ni localStorage) : reçoit la réponse de l'action
 *  GAS scanPhotos et le contexte du formulaire, renvoie les valeurs à remplir,
 *  leur source et les alertes à afficher sous les champs.
 *  Spéc : docs/superpowers/specs/2026-10-11-scan-pompe-compteur-design.md §4
 * ──────────────────────────────────────────────────────────────────────────── */

import { FUEL_CONFIG } from './config.js';
import { matchType } from './refmodel.js';

export const ECART_SOURCES    = 0.02;   // R1 — pompe vs ticket
export const TOL_TRIPLET_EUR  = 0.05;   // R2 — tolérance absolue (€)
export const TOL_TRIPLET_REL  = 0.01;   // R2 — tolérance relative
export const TYPE_ECART_MAX   = 0.08;   // R3 — écart max du candidat retenu
export const TYPE_RATIO_2E    = 2;      // R3 — le 2ᵉ candidat doit être 2× plus éloigné
export const TYPE_LU_TOL      = 0.15;   // R3 — type lu compatible avec le prix
export const PRIX_STATION_TOL = 0.10;   // R5 — prix lu vs prix station
export const KM_TRIP_RATIO    = 0.10;   // R4 — km < 10 % du dernier → TRIP
export const DIST_MIN_RATIO   = 0.5;    // R4 — distance mini / attendue
export const DIST_MAX_RATIO   = 1.6;    // R4 — distance maxi / attendue
export const MEDIANE_JOURS    = 90;     // R3 — fenêtre de la médiane des prix payés

/* [champ, décimales d'affichage] — lus sur la pompe (prioritaire) ou le ticket */
const CHAMPS_POMPE = [['litres', 2], ['prix_litre', 3], ['montant_total', 2]];
const CHAMPS_NUM   = ['km', 'litres', 'prix_litre', 'montant_total'];
const CHAMPS_FUSION = ['date', 'km', 'litres', 'prix_litre', 'montant_total', 'type_carburant', 'enseigne', 'ville', 'station'];

const num      = v => (typeof v === 'number' && isFinite(v) && v > 0) ? v : null;
const virgule  = (n, d) => n.toFixed(d).replace('.', ',');
const milliers = n => String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
const vide     = v => v === null || v === undefined || v === '';

function ajouterAlerte(alertes, champ, msg) {
  alertes[champ] = alertes[champ] ? alertes[champ] + ' · ' + msg : msg;
}

/** Libellé de carburant lu par l'IA → clé FUEL_CONFIG (null si inconnu). */
export function cleTypeLu(texte) {
  if (!texte) return null;
  const t = String(texte).toUpperCase().replace(/\s+/g, '');
  if (t.includes('E85') || t.includes('ETHANOL')) return 'E85';
  if (t.includes('E10')) return 'E10';
  if (t.includes('98')) return 'SP98';
  if (t.includes('95')) return 'SP95';
  if (t.includes('GAZOLE') || t.includes('DIESEL') || t.includes('GASOIL') || t.includes('B7')) return 'GAZOLE';
  if (t.includes('GPL')) return 'GPLC';
  return null;
}

/** Première valeur non vide du champ parmi les photos du type demandé. */
function premiere(photos, kind, champ) {
  for (const p of photos) {
    if (!p || p.kind !== kind || !p.valeurs) continue;
    if (!vide(p.valeurs[champ])) return p.valeurs[champ];
  }
  return null;
}

/* ── R1 — priorité des sources ─────────────────────────────────────── */
function fusionner(reponse, alertes) {
  const photos = Array.isArray(reponse?.photos) ? reponse.photos : [];
  const v = {};
  const s = {};

  if (!photos.length) {
    const f = reponse?.fusion || {};
    CHAMPS_FUSION.forEach(k => {
      const val = CHAMPS_NUM.includes(k) ? num(f[k]) : (vide(f[k]) ? null : f[k]);
      if (val !== null) { v[k] = k === 'km' ? Math.round(val) : val; s[k] = 'ticket'; }
    });
    return { v, s };
  }

  CHAMPS_POMPE.forEach(([k, d]) => {
    const p = num(premiere(photos, 'pompe', k));
    const t = num(premiere(photos, 'ticket', k));
    if (p !== null) {
      v[k] = p; s[k] = 'pompe';
      if (t !== null && Math.abs(p - t) / t > ECART_SOURCES) {
        ajouterAlerte(alertes, k, `pompe et ticket diffèrent (${virgule(p, d)} / ${virgule(t, d)})`);
      }
    } else if (t !== null) {
      v[k] = t; s[k] = 'ticket';
    }
  });

  const kmC = num(premiere(photos, 'compteur', 'km'));
  const kmT = num(premiere(photos, 'ticket', 'km'));
  if (kmC !== null)      { v.km = Math.round(kmC); s.km = 'compteur'; }
  else if (kmT !== null) { v.km = Math.round(kmT); s.km = 'ticket'; }

  ['date', 'enseigne', 'ville', 'station'].forEach(k => {
    const t = premiere(photos, 'ticket', k);
    if (t !== null) { v[k] = t; s[k] = 'ticket'; }
  });

  const typeP = premiere(photos, 'pompe', 'type_carburant');
  const typeT = premiere(photos, 'ticket', 'type_carburant');
  if (typeP !== null)      { v.type_carburant = typeP; s.type_carburant = 'pompe'; }
  else if (typeT !== null) { v.type_carburant = typeT; s.type_carburant = 'ticket'; }

  return { v, s };
}

/* ── R2 — litres × prix = montant ──────────────────────────────────── */
function controlerTriplet(v, s, alertes) {
  const L = num(v.litres);
  const P = num(v.prix_litre);
  const M = num(v.montant_total);
  if (L && P && M) {
    const calc = L * P;
    if (Math.abs(calc - M) > Math.max(TOL_TRIPLET_EUR, TOL_TRIPLET_REL * M)) {
      const msg = `${virgule(L, 2)} × ${virgule(P, 3)} = ${virgule(calc, 2)} € ≠ ${virgule(M, 2)} € lus`;
      ajouterAlerte(alertes, 'litres', msg);
      ajouterAlerte(alertes, 'montant_total', msg);
    }
  } else if (L && P) {
    v.montant_total = Math.round(L * P * 100) / 100;   s.montant_total = 'calcul';
  } else if (L && M) {
    v.prix_litre = Math.round(M / L * 1000) / 1000;    s.prix_litre = 'calcul';
  } else if (P && M) {
    v.litres = Math.round(M / P * 100) / 100;          s.litres = 'calcul';
  }
}

/* ── R3 — type de carburant ────────────────────────────────────────── */
function mediane(xs) {
  const a = [...xs].sort((x, y) => x - y);
  const m = Math.floor(a.length / 2);
  return a.length % 2 ? a[m] : (a[m - 1] + a[m]) / 2;
}

function dateDe(r) {
  return new Date(String(r.Date || r.Horodatage || '').replace(' ', 'T'));
}

/** Référence de prix d'un carburant : prix station, sinon médiane 90 j du véhicule. */
function refDe(cle, ctx) {
  const st = num(Number((ctx.stationPrices || {})[cle]));
  if (st) return st;
  const limite = (ctx.aujourdHui || new Date()).getTime() - MEDIANE_JOURS * 86400000;
  const prix = (ctx.historiqueVehicule || [])
    .filter(r => matchType(r.Type, cle) && dateDe(r).getTime() >= limite)
    .map(r => num(Number(r['Prix €/L'])))
    .filter(Boolean);
  return prix.length ? mediane(prix) : null;
}

/** Candidats : carburants affichés par la station (sinon tous), restreints à ceux du véhicule. */
function candidats(ctx) {
  const station = ctx.stationPrices || {};
  const hist = ctx.historiqueVehicule || [];
  const cles = Object.keys(FUEL_CONFIG);
  let base = cles.filter(k => num(Number(station[k])));
  if (!base.length) base = cles;
  const utilises = cles.filter(k => hist.some(r => matchType(r.Type, k)));
  if (utilises.length) {
    const inter = base.filter(k => utilises.includes(k));
    if (inter.length) base = inter;
  }
  return base;
}

function choisirType(v, s, alertes, ctx) {
  const P = num(v.prix_litre);
  const lu = cleTypeLu(v.type_carburant);
  const srcLu = s.type_carburant;
  delete v.type_carburant;
  delete s.type_carburant;

  let deduit = null;
  if (P) {
    const classes = candidats(ctx)
      .map(k => ({ k, ref: refDe(k, ctx) }))
      .filter(c => c.ref)
      .map(c => ({ k: c.k, ecart: Math.abs(P - c.ref) / c.ref }))
      .sort((a, b) => a.ecart - b.ecart);
    const [b1, b2] = classes;
    if (b1 && b1.ecart <= TYPE_ECART_MAX
        && (!b2 || (b2.ecart >= TYPE_RATIO_2E * b1.ecart && b2.ecart > b1.ecart))) {
      deduit = b1.k;
    }
  }

  if (lu) {
    const ref = P ? refDe(lu, ctx) : null;
    if (!ref || Math.abs(P - ref) / ref <= TYPE_LU_TOL) {
      v.type_carburant = lu;
      s.type_carburant = srcLu;
      return;
    }
    ajouterAlerte(alertes, 'type_carburant', `type lu (${FUEL_CONFIG[lu].short}) incompatible avec ${virgule(P, 3)} €/L`);
  }

  if (deduit) {
    v.type_carburant = deduit;
    s.type_carburant = 'deduit';
    if (!lu) ajouterAlerte(alertes, 'type_carburant', `type déduit du prix (${virgule(P, 3)} €/L → ${FUEL_CONFIG[deduit].short})`);
    return;
  }
  if (P || lu) ajouterAlerte(alertes, 'type_carburant', 'type à vérifier');
}

/* ── R4 — kilométrage ──────────────────────────────────────────────── */
function controlerKm(v, alertes, ctx, typeFinal) {
  const km = num(v.km);
  const dernier = num(ctx.dernierKm);
  if (!km || !dernier) return;
  if (km < KM_TRIP_RATIO * dernier) { ajouterAlerte(alertes, 'km', 'compteur partiel (TRIP) lu ?'); return; }
  if (km <= dernier) { ajouterAlerte(alertes, 'km', `inférieur ou égal au dernier plein (${milliers(dernier)} km)`); return; }
  const L = num(v.litres);
  const conso = num((ctx.consoParType || {})[typeFinal]);
  if (!L || !conso) return;
  const attendu = L / conso * 100;
  const dist = km - dernier;
  if (dist < DIST_MIN_RATIO * attendu || dist > DIST_MAX_RATIO * attendu) {
    ajouterAlerte(alertes, 'km',
      `${milliers(dist)} km pour ${virgule(L, 1)} L : improbable (≈ ${milliers(Math.round(attendu / 10) * 10)} km attendus)`);
  }
}

/* ── R5 — prix plausible ───────────────────────────────────────────── */
function controlerPrixStation(v, alertes, ctx, typeFinal) {
  const P = num(v.prix_litre);
  const ref = num(Number((ctx.stationPrices || {})[typeFinal]));
  if (P && ref && Math.abs(P - ref) / ref > PRIX_STATION_TOL) {
    ajouterAlerte(alertes, 'prix_litre', `différent du prix affiché par la station (${virgule(ref, 3)} €)`);
  }
}

/** Fusionne et contrôle les lectures du scanner (R1 à R5). */
export function analyserScan(reponse, contexte = {}) {
  const alertes = {};
  const { v, s } = fusionner(reponse, alertes);
  controlerTriplet(v, s, alertes);
  choisirType(v, s, alertes, contexte);
  const typeFinal = v.type_carburant || contexte.typeCourant;
  controlerKm(v, alertes, contexte, typeFinal);
  controlerPrixStation(v, alertes, contexte, typeFinal);
  const photos = Array.isArray(reponse?.photos) ? reponse.photos : [];
  const resume = photos.map(p => ({ index: p.index, kind: p.kind, lisible: !!p.lisible, remarque: p.remarque || null }));
  return { valeurs: v, sources: s, alertes, resume };
}

const NOM_KIND = { pompe: 'pompe', compteur: 'compteur', ticket: 'ticket' };

/** « 3 photos analysées : pompe ✓, compteur ✓, ticket ✓ — 6 champs pré-remplis, 1 à vérifier » */
export function formaterBilan(resume, remplis, nbAlertes) {
  const n = resume.length;
  const pl = (k, mot) => mot + (k > 1 ? 's' : '');
  const photos = resume.map(p => `${NOM_KIND[p.kind] || 'photo ?'} ${p.lisible ? '✓' : '✗'}`).join(', ');
  const tete = n ? `${n} ${pl(n, 'photo')} ${pl(n, 'analysée')} : ${photos}` : 'Analyse terminée';
  const champs = `${remplis} ${pl(remplis, 'champ')} ${pl(remplis, 'pré-rempli')}`;
  return nbAlertes ? `${tete} — ${champs}, ${nbAlertes} à vérifier` : `${tete} — ${champs}`;
}
```

- [ ] **Étape 5 : vérifier le succès**

Lancer : `npx vitest run tests/scanControle.test.js tests/refmodel.test.js`
Attendu : tous les tests PASSENT. Si un message diffère d'un caractère, corriger le code (pas le test), sauf faute de frappe évidente dans le test.

- [ ] **Étape 6 : point de contrôle**

Lancer : `npm run lint` → 0 erreur, 0 avertissement.

---

### Tâche 2 : action GAS `scanPhotos` (`Scan.gs`) + aiguillage + déploiement

**Fichiers :**
- Créer : `GAS/Scan.gs`
- Modifier : `GAS/Code.gs` (bloc `scanTicket` dans `doPost`, ~ligne 503)
- Test : `tests/scanGas.test.js`

**Interfaces :**
- Consomme (définis dans `Code.gs`) : `jsonResponse(obj)`, `rateLimit(cid) → boolean` (true = limite atteinte, 10/min).
- Produit : `handleScanPhotos(payload)` → réponse JSON `{ success: true, photos: [{ index, kind, lisible, remarque, valeurs }], fusion }` ou `{ success: false, error, code? }` (`code: 'RATE_LIMIT'` pour la limite de fréquence). `valeurs` et `fusion` ont toujours les clés `litres, prix_litre, montant_total, km, date, type_carburant, enseigne, ville, station` (nombre, texte ou `null`).

- [ ] **Étape 1 : écrire les tests qui échouent**

Créer `tests/scanGas.test.js` :

```js
// @vitest-environment node
/**
 * Tests — Scan.gs (W97) exécuté dans un bac à sable `vm` avec faux UrlFetchApp :
 * validation des images, normalisation du JSON Gemini, limite de fréquence,
 * aiguillage de doPost (avant toute logique d'enregistrement de plein).
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import vm from 'node:vm';

const GAS_DIR = fileURLToPath(new URL(
  '../Google Drive/Sauvegarde & Geolocalisation - Suivi conso SuperEthanol/Google Apps Script/', import.meta.url));
const src = f => readFileSync(join(GAS_DIR, f), 'utf-8');

function makeGas({ texte = '{"photos":[],"fusion":{}}', erreurGemini = null, cle = 'cle-test', limite = false } = {}) {
  const appels = [];
  const ctx = {
    console,
    Logger: { log: () => {} },
    SpreadsheetApp: { openById: () => ({ getSheetByName: () => null }) },
    PropertiesService: { getScriptProperties: () => ({ getProperty: k => (k === 'GEMINI_API_KEY' ? cle : null) }) },
    CacheService: { getScriptCache: () => ({ get: () => (limite ? '10' : '0'), put: () => {} }) },
    UrlFetchApp: {
      fetch: (url, opts) => {
        appels.push({ url, corps: JSON.parse(opts.payload) });
        const rep = erreurGemini
          ? { error: { message: erreurGemini } }
          : { candidates: [{ content: { parts: [{ text: texte }] } }] };
        return { getContentText: () => JSON.stringify(rep) };
      },
    },
    ContentService: {
      MimeType: { JSON: 'json' },
      createTextOutput: s => ({ setMimeType: () => ({ body: s }), body: s }),
    },
  };
  vm.createContext(ctx);
  vm.runInContext(['Auth.gs', 'Code.gs', 'Scan.gs'].map(src).join('\n;\n'), ctx);
  const json = out => JSON.parse(out.body);
  return { ctx, appels, json };
}

const IMG = { data: 'QUJD', mimeType: 'image/jpeg' };

describe('validerImagesScan_', () => {
  const { ctx } = makeGas();
  it('refuse 0 image ou un champ absent', () => {
    expect(ctx.validerImagesScan_([])).toBe('Aucune photo reçue.');
    expect(ctx.validerImagesScan_(undefined)).toBe('Aucune photo reçue.');
  });
  it('refuse 4 images', () => {
    expect(ctx.validerImagesScan_([IMG, IMG, IMG, IMG])).toBe('3 photos maximum.');
  });
  it('refuse une image vide', () => {
    expect(ctx.validerImagesScan_([IMG, { data: '' }])).toBe('Photo vide (n° 2).');
  });
  it('refuse un total trop lourd', () => {
    expect(ctx.validerImagesScan_([{ data: 'A'.repeat(8600000) }])).toBe('Photos trop lourdes.');
  });
  it('accepte 1 à 3 images', () => {
    expect(ctx.validerImagesScan_([IMG, IMG, IMG])).toBeNull();
  });
});

describe('normaliserScan_', () => {
  const { ctx } = makeGas();
  it('kind hors liste → inconnu ; nombres « à la française » → nombres', () => {
    const r = ctx.normaliserScan_({
      photos: [
        { index: 0, kind: 'Pompe', lisible: true, valeurs: { litres: '16,14', prix_litre: '0.869', montant_total: 14.03 } },
        { index: 1, kind: 'selfie', lisible: false, remarque: 'photo floue' },
        { index: 2, kind: 'compteur', lisible: 'true', valeurs: { km: '19 719' } },
      ],
      fusion: { km: '19719', litres: 'abc', date: '' },
    }, 3);
    expect(r.photos[0]).toMatchObject({ index: 0, kind: 'pompe', lisible: true });
    expect(r.photos[0].valeurs).toMatchObject({ litres: 16.14, prix_litre: 0.869, montant_total: 14.03, km: null, type_carburant: null });
    expect(r.photos[1]).toMatchObject({ kind: 'inconnu', lisible: false, remarque: 'photo floue' });
    expect(r.photos[2].valeurs.km).toBe(19719);
    expect(r.photos[2].lisible).toBe(true);
    expect(r.fusion).toMatchObject({ km: 19719, litres: null, date: null });
  });
  it('index absent → position ; index hors bornes → ignoré ; photos absent → []', () => {
    expect(ctx.normaliserScan_({ photos: [{ kind: 'ticket' }, { index: 5, kind: 'pompe' }] }, 2).photos
      .map(p => [p.index, p.kind])).toEqual([[0, 'ticket']]);
    expect(ctx.normaliserScan_({}, 1).photos).toEqual([]);
  });
});

describe('handleScanPhotos', () => {
  it('un seul appel Gemini avec toutes les images et la configuration JSON', () => {
    const texte = '```json\n{"photos":[{"index":0,"kind":"pompe","lisible":true,"valeurs":{"litres":16.14}},'
      + '{"index":1,"kind":"compteur","lisible":true,"valeurs":{"km":19719}}],"fusion":{"km":19719}}\n```';
    const g = makeGas({ texte });
    const r = g.json(g.ctx.handleScanPhotos({ images: [IMG, IMG], cid: 'c1' }));
    expect(g.appels).toHaveLength(1);
    expect(g.appels[0].url).toContain('models/gemini-2.5-flash:generateContent');
    const cfg = g.appels[0].corps.generationConfig;
    expect(cfg).toMatchObject({ temperature: 0.1, responseMimeType: 'application/json', thinkingConfig: { thinkingBudget: 0 } });
    expect(g.appels[0].corps.contents[0].parts.filter(p => p.inlineData)).toHaveLength(2);
    expect(r.success).toBe(true);
    expect(r.photos.map(p => p.kind)).toEqual(['pompe', 'compteur']);
    expect(r.photos[1].valeurs.km).toBe(19719);
    expect(r.fusion.km).toBe(19719);
  });
  it('limite de fréquence : refus explicite, aucun appel Gemini', () => {
    const g = makeGas({ limite: true });
    const r = g.json(g.ctx.handleScanPhotos({ images: [IMG], cid: 'c1' }));
    expect(r).toMatchObject({ success: false, code: 'RATE_LIMIT', error: 'Trop d\'analyses, réessayez dans une minute.' });
    expect(g.appels).toHaveLength(0);
  });
  it('clé Gemini absente', () => {
    const g = makeGas({ cle: null });
    const r = g.json(g.ctx.handleScanPhotos({ images: [IMG] }));
    expect(r.success).toBe(false);
    expect(r.error).toContain('GEMINI_API_KEY');
    expect(g.appels).toHaveLength(0);
  });
  it('erreur de l\'API Gemini relayée', () => {
    const g = makeGas({ erreurGemini: 'quota dépassé' });
    expect(g.json(g.ctx.handleScanPhotos({ images: [IMG] }))).toMatchObject({ success: false, error: 'quota dépassé' });
  });
  it('réponse IA illisible', () => {
    const g = makeGas({ texte: 'désolé' });
    expect(g.json(g.ctx.handleScanPhotos({ images: [IMG] }))).toMatchObject({ success: false, error: 'Réponse IA illisible.' });
  });
  it('0 image : refus avant tout appel', () => {
    const g = makeGas();
    expect(g.json(g.ctx.handleScanPhotos({ images: [] }))).toMatchObject({ success: false, error: 'Aucune photo reçue.' });
    expect(g.appels).toHaveLength(0);
  });
});

describe('doPost — aiguillage scanPhotos', () => {
  it('scanPhotos est traité par Scan.gs, pas par l\'enregistrement d\'un plein', () => {
    const g = makeGas();
    const out = g.ctx.doPost({ postData: { contents: JSON.stringify({ action: 'scanPhotos', images: [] }) }, parameter: {} });
    expect(g.json(out)).toMatchObject({ success: false, error: 'Aucune photo reçue.' });
  });
});
```

- [ ] **Étape 2 : vérifier l'échec**

Lancer : `npx vitest run tests/scanGas.test.js`
Attendu : ÉCHEC (`ENOENT … Scan.gs`).

- [ ] **Étape 3 : écrire `GAS/Scan.gs`**

```js
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

/** "16,14" → 16.14 ; "19 719" → 19719 ; vide ou non numérique → null. */
function scanNum_(v) {
  if (v === null || v === undefined || v === '') return null;
  const n = typeof v === 'number' ? v : Number(String(v).replace(/[\s  ]/g, '').replace(',', '.'));
  return isFinite(n) ? n : null;
}

function scanValeurs_(source) {
  const s = source || {};
  const o = {};
  SCAN_NUM_KEYS.forEach(k => { o[k] = scanNum_(s[k]); });
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
    '- compteur : km = le TOTAL kilométrique (ODO), JAMAIS un compteur journalier (TRIP, TRIP A, TRIP B) ni l\'autonomie ; entier, en km.\n' +
    '- ticket : "Quantité" / "Volume" → litres ; "Prix unitaire" / "P.U." / "Prix/L" → prix_litre (jamais la TVA) ; ' +
    '"Montant" / "Total" / "Net à payer" → montant_total ; date au format YYYY-MM-DD ("26" = 2026) ; ' +
    'enseigne = nom commercial seul ; ville = commune seule ; station = enseigne + ville.\n' +
    '- Carburants possibles : E85, SP98, SP95, E10, Gazole, GPLc.\n' +
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
```

- [ ] **Étape 4 : aiguiller `scanPhotos` dans `doPost`**

Dans `GAS/Code.gs`, juste après le bloc existant :

```js
  // ── W17 — Scan ticket de caisse via Gemini Vision ──
  if (payload.action === 'scanTicket') {
    return handleScanTicket(payload.imageBase64, payload.mimeType);
  }
```

ajouter :

```js
  // ── W97 — Scanner pompe / compteur / ticket (Scan.gs) ──
  if (payload.action === 'scanPhotos') {
    return handleScanPhotos(payload);
  }
```

- [ ] **Étape 5 : vérifier le succès**

Lancer : `npx vitest run tests/scanGas.test.js tests/gasGarde.test.js`
Attendu : tous les tests PASSENT (`gasGarde` vérifie notamment qu'aucune suppression physique n'a été ajoutée).

- [ ] **Étape 6 : déployer le script Google (AVANT l'app)**

Lancer : `node gas-deploy.mjs "W97 — action scanPhotos (Scan.gs)"`
Attendu : `Scan.gs` listé en « ajouté », nouvelle version déployée sur le déploiement de production (numéro de version noté pour le CHANGELOG). Le redéploiement GAS est pré-autorisé (mémoire projet).

- [ ] **Étape 7 : contrôle en production sans image**

Créer `<scratchpad>/scan-smoke.mjs` (hors dépôt) :

```js
import { readFileSync } from 'node:fs';
const cfg = readFileSync('js/config.js', 'utf-8');
const GAS_URL = cfg.match(/GAS_URL\s*=\s*['"]([^'"]+)/)[1];
const APP_TOKEN = (cfg.match(/APP_TOKEN\s*=\s*['"]([^'"]*)/) || [])[1] || '';
const r = await fetch(GAS_URL, { method: 'POST', redirect: 'follow',
  body: JSON.stringify({ action: 'scanPhotos', images: [], token: APP_TOKEN }) });
console.log(await r.text());
```

Lancer depuis la racine du dépôt : `node <scratchpad>/scan-smoke.mjs`
Attendu : `{"success":false,"error":"Aucune photo reçue."}`. Toute autre réponse (en particulier un plein enregistré) → arrêter et diagnostiquer avant d'aller plus loin. Si `GAS_URL` ou `APP_TOKEN` ne sont pas des littéraux dans `js/config.js`, les lire à la main dans ce fichier.

---

### Tâche 3 : alertes sous les champs (`setFieldWarning`)

**Fichiers :**
- Modifier : `js/ui.js` (ajout en fin de fichier), `css/style.css` (après `.field input.autofilled`, ~ligne 424), `js/formulaire.js` (import ligne 4 + `resetForm`)
- Test : `tests/ui.test.js`

**Interfaces :**
- Produit : `setFieldWarning(id: string, msg: string) → void` (crée ou remplace `<div class="field-warn" data-warn-for="<id>">⚠ msg</div>` juste après l'élément ; effacée au premier `input` pour un champ de saisie, au premier `click` sinon) ; `clearFieldWarnings() → void`.

- [ ] **Étape 1 : écrire les tests qui échouent**

Dans `tests/ui.test.js`, ajouter `setFieldWarning, clearFieldWarnings,` à l'import depuis `'../js/ui.js'`, puis à la fin du fichier :

```js
describe('setFieldWarning / clearFieldWarnings (W97)', () => {
  it('affiche le message juste sous le champ, une seule fois par champ', () => {
    setFieldWarning('fLitres', 'à vérifier');
    setFieldWarning('fLitres', 'pompe et ticket diffèrent');
    const w = document.querySelectorAll('.field-warn[data-warn-for="fLitres"]');
    expect(w).toHaveLength(1);
    expect(w[0].textContent).toBe('⚠ pompe et ticket diffèrent');
    expect(document.getElementById('fLitres').nextElementSibling).toBe(w[0]);
  });
  it('s\'efface dès que l\'utilisateur modifie le champ', () => {
    setFieldWarning('fLitres', 'x');
    document.getElementById('fLitres').dispatchEvent(new Event('input'));
    expect(document.querySelector('.field-warn')).toBeNull();
  });
  it('sur un bloc non saisissable (choix du carburant), s\'efface au clic', () => {
    document.body.insertAdjacentHTML('beforeend', '<div id="typeToggle"></div>');
    setFieldWarning('typeToggle', 'type à vérifier');
    const tt = document.getElementById('typeToggle');
    tt.dispatchEvent(new Event('input'));
    expect(document.querySelector('.field-warn')).not.toBeNull();
    tt.dispatchEvent(new Event('click'));
    expect(document.querySelector('.field-warn')).toBeNull();
  });
  it('clearFieldWarnings retire toutes les alertes', () => {
    setFieldWarning('fLitres', 'a');
    setFieldWarning('fPrix', 'b');
    clearFieldWarnings();
    expect(document.querySelectorAll('.field-warn')).toHaveLength(0);
  });
  it('id inconnu : ne lève pas', () => {
    expect(() => setFieldWarning('absent', 'x')).not.toThrow();
  });
});
```

- [ ] **Étape 2 : vérifier l'échec**

Lancer : `npx vitest run tests/ui.test.js`
Attendu : ÉCHEC (`setFieldWarning is not a function`).

- [ ] **Étape 3 : implémenter dans `js/ui.js`** (fin de fichier)

```js
/** W97 — Alerte ⚠ sous un champ pré-rempli par le scanner. Remplace l'alerte
 *  existante du même champ ; s'efface dès que l'utilisateur modifie le champ
 *  (clic pour un bloc non saisissable comme le choix du carburant). */
export function setFieldWarning(id, msg) {
  const el = document.getElementById(id);
  if (!el) return;
  let w = document.querySelector(`.field-warn[data-warn-for="${id}"]`);
  if (!w) {
    w = document.createElement('div');
    w.className = 'field-warn';
    w.dataset.warnFor = id;
    w.setAttribute('role', 'status');
    el.insertAdjacentElement('afterend', w);
  }
  w.textContent = '⚠ ' + msg;
  const evt = el.matches('input, select, textarea') ? 'input' : 'click';
  el.addEventListener(evt, () => {
    document.querySelector(`.field-warn[data-warn-for="${id}"]`)?.remove();
  }, { once: true });
}

/** W97 — Retire toutes les alertes de champ (nouveau scan, remise à zéro du formulaire). */
export function clearFieldWarnings() {
  document.querySelectorAll('.field-warn').forEach(w => w.remove());
}
```

- [ ] **Étape 4 : style** — dans `css/style.css`, après le bloc `.field input.autofilled { … }` :

```css
/* W97 — alerte de vérification sous un champ pré-rempli par le scanner */
.field-warn {
  margin-top: 4px;
  font-size: 12px;
  font-weight: 600;
  line-height: 1.35;
  color: #8A5A00;
}
[data-theme="dark"] .field-warn { color: var(--amber); }
```

- [ ] **Étape 5 : effacer au `resetForm`** — dans `js/formulaire.js` :
  - ligne 4, ajouter `clearFieldWarnings` à l'import : `import { setAutreStatus, hideCpSearch, setSubmitState, showFeedback, computeTriplet, clearFieldWarnings } from './ui.js';`
  - dans `resetForm()`, après le bloc `// W9 — effacer la photo du ticket … photoIndicator.hidden = true;`, ajouter :

```js
  clearFieldWarnings();   // W97 — alertes du scanner
```

- [ ] **Étape 6 : vérifier le succès**

Lancer : `npx vitest run tests/ui.test.js tests/formulaire.test.js` puis `npm run lint`
Attendu : tout PASSE, lint propre.

---

### Tâche 4 : orchestration `js/scanPhotos.js` + adaptation de `js/ticket.js`

**Fichiers :**
- Créer : `js/scanPhotos.js`
- Modifier : `js/ticket.js` (en-tête, import ligne 21, `resizeImage` l.104, `blobToBase64` l.173, suppression de `scanWithGemini` l.185-227, `fillFormFromTicket` l.597-668, remplacement de `initScanner` l.670-759), `js/main.js:33`, `index.html:171-175`
- Test : `tests/scanPhotos.test.js`

**Interfaces :**
- Consomme : `analyserScan`, `formaterBilan` (tâche 1) ; `setFieldWarning`, `clearFieldWarnings`, `showFeedback` (tâche 3, `js/ui.js`) ; action GAS `scanPhotos` (tâche 2) ; `getAllRecords()`, `getMaxKmForVehicule(nom)` (`js/historique.js`) ; `computeConsoMoy(records, fuelKey) → number` (`js/refmodel.js`) ; `state.currentVehiculeNom`, `state.currentType`, `state._stationPrices`, `state._ticketPhoto` ; `GAS_URL`, `APP_TOKEN`, `CLIENT_ID_KEY`, `FUEL_CONFIG` (`js/config.js`).
- Produit (ticket.js) : `resizeImage(file) → Promise<Blob>`, `blobToBase64(blob) → Promise<string|null>`, `fillFormFromTicket(data, { silencieux = false } = {}) → Promise<number>` (nombre de champs remplis), `lireTicketOCR(file, btn) → Promise<void>` (OCR Tesseract d'un ticket, photo jointe).
- Produit (scanPhotos.js) : `envoyerScanPhotos(images) → Promise<reponse>` (lève une `Error` avec `.code` éventuel), `construireContexte() → contexte`, `remplirDepuisScan(resultat) → Promise<number>`, `lancerScan(files, btn) → Promise<void>`, `initScanner()`.

- [ ] **Étape 1 : écrire les tests qui échouent**

Créer `tests/scanPhotos.test.js` :

```js
// @vitest-environment jsdom
/**
 * Tests — js/scanPhotos.js (W97) : un seul appel scanPhotos pour 1 à 3 photos,
 * replis hors ligne / échec IA, photo jointe = image classée « ticket », bilan.
 * ticket.js est simulé (jsdom ne décode pas les images).
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('tesseract.js', () => ({ default: {} }));
vi.mock('../js/ticket.js', () => ({
  resizeImage:        vi.fn(async f => f),
  blobToBase64:       vi.fn(async f => f.name + '-b64'),
  fillFormFromTicket: vi.fn(async () => 4),
  lireTicketOCR:      vi.fn(async () => {}),
}));

const ticket = await import('../js/ticket.js');
const { lancerScan } = await import('../js/scanPhotos.js');
const { state } = await import('../js/state.js');

const fichier = nom => new File(['x'], nom, { type: 'image/jpeg' });
const repondre = json => vi.stubGlobal('fetch', vi.fn(async () => ({ json: async () => json })));
const POMPE = { index: 0, kind: 'pompe', lisible: true, valeurs: { litres: 16.14, prix_litre: 0.869, montant_total: 14.03 } };
const COMPTEUR = { index: 1, kind: 'compteur', lisible: true, valeurs: { km: 19719 } };
const TICKET = index => ({ index, kind: 'ticket', lisible: true, valeurs: { date: '2026-10-10' } });
const feedback = () => document.getElementById('feedback').textContent;

let enLigne = true;
Object.defineProperty(navigator, 'onLine', { configurable: true, get: () => enLigne });

let btn;
beforeEach(() => {
  document.body.innerHTML = `
    <button id="scanTicketBtn">📸 Scanner</button><div id="feedback"></div>
    <span id="ticketPhotoIndicator" hidden></span><div id="typeToggle"></div>
    <input id="fDate"><input id="fKm"><input id="fLitres"><input id="fPrix"><input id="fCout">`;
  Element.prototype.scrollIntoView = vi.fn();
  btn = document.getElementById('scanTicketBtn');
  state._ticketPhoto = null;
  state._stationPrices = {};
  enLigne = true;
  vi.clearAllMocks();
});

describe('lancerScan — en ligne', () => {
  it('2 photos → un seul appel scanPhotos, formulaire rempli, alertes et bilan', async () => {
    repondre({ success: true, photos: [POMPE, COMPTEUR], fusion: {} });
    await lancerScan([fichier('a.jpg'), fichier('b.jpg')], btn);
    expect(fetch).toHaveBeenCalledTimes(1);
    const corps = JSON.parse(fetch.mock.calls[0][1].body);
    expect(corps.action).toBe('scanPhotos');
    expect(corps.images.map(i => i.data)).toEqual(['a.jpg-b64', 'b.jpg-b64']);
    expect(ticket.fillFormFromTicket).toHaveBeenCalledWith(
      expect.objectContaining({ litres: 16.14, km: 19719 }), { silencieux: true });
    expect(document.querySelector('.field-warn[data-warn-for="typeToggle"]').textContent).toContain('type à vérifier');
    expect(feedback()).toContain('2 photos analysées : pompe ✓, compteur ✓ — 4 champs pré-remplis, 1 à vérifier');
    expect(btn.disabled).toBe(false);
    expect(btn.innerHTML).toBe('📸 Scanner');
  });
  it('4 photos → seules les 3 premières sont envoyées, avec un message', async () => {
    repondre({ success: true, photos: [POMPE], fusion: {} });
    await lancerScan(['a', 'b', 'c', 'd'].map(n => fichier(n + '.jpg')), btn);
    expect(JSON.parse(fetch.mock.calls[0][1].body).images).toHaveLength(3);
    expect(feedback()).toContain('3 photos max');
  });
  it('la photo jointe est l\'image classée « ticket » (par son index)', async () => {
    repondre({ success: true, photos: [TICKET(1), POMPE], fusion: {} });
    await lancerScan([fichier('a.jpg'), fichier('b.jpg')], btn);
    expect(state._ticketPhoto).toBe('b.jpg-b64');
    expect(document.getElementById('ticketPhotoIndicator').hidden).toBe(false);
  });
  it('sans ticket reconnu, aucune photo n\'est jointe', async () => {
    state._ticketPhoto = 'ancienne';
    repondre({ success: true, photos: [POMPE, COMPTEUR], fusion: {} });
    await lancerScan([fichier('a.jpg'), fichier('b.jpg')], btn);
    expect(state._ticketPhoto).toBeNull();
    expect(document.getElementById('ticketPhotoIndicator').hidden).toBe(true);
  });
  it('photos trop lourdes : message, aucun envoi', async () => {
    repondre({ success: true, photos: [], fusion: {} });
    ticket.blobToBase64.mockImplementationOnce(async () => 'x'.repeat(9000000));
    await lancerScan([fichier('a.jpg')], btn);
    expect(fetch).not.toHaveBeenCalled();
    expect(feedback()).toContain('trop lourdes');
  });
});

describe('lancerScan — erreurs et replis', () => {
  it('hors ligne, 2 photos : message, aucun envoi', async () => {
    enLigne = false;
    repondre({});
    await lancerScan([fichier('a.jpg'), fichier('b.jpg')], btn);
    expect(fetch).not.toHaveBeenCalled();
    expect(feedback()).toContain('hors connexion');
  });
  it('hors ligne, 1 photo : lecture OCR du ticket', async () => {
    enLigne = false;
    repondre({});
    const f = fichier('a.jpg');
    await lancerScan([f], btn);
    expect(fetch).not.toHaveBeenCalled();
    expect(ticket.lireTicketOCR).toHaveBeenCalledWith(f, btn);
  });
  it('échec IA avec 1 photo : repli OCR', async () => {
    repondre({ success: false, error: 'quota' });
    await lancerScan([fichier('a.jpg')], btn);
    expect(ticket.lireTicketOCR).toHaveBeenCalledTimes(1);
  });
  it('échec IA avec 2 photos : message, rien n\'est rempli', async () => {
    repondre({ success: false, error: 'quota' });
    await lancerScan([fichier('a.jpg'), fichier('b.jpg')], btn);
    expect(feedback()).toContain('Analyse impossible : quota');
    expect(ticket.lireTicketOCR).not.toHaveBeenCalled();
    expect(ticket.fillFormFromTicket).not.toHaveBeenCalled();
  });
  it('limite de fréquence : message dédié', async () => {
    repondre({ success: false, code: 'RATE_LIMIT', error: 'Trop d\'analyses, réessayez dans une minute.' });
    await lancerScan([fichier('a.jpg'), fichier('b.jpg')], btn);
    expect(feedback()).toContain('Trop d\'analyses');
    expect(feedback()).not.toContain('Analyse impossible');
  });
  it('réponse sans tableau photos (ancien script) : erreur, rien n\'est rempli', async () => {
    repondre({ success: true, data: {} });
    await lancerScan([fichier('a.jpg'), fichier('b.jpg')], btn);
    expect(feedback()).toContain('Analyse impossible');
    expect(ticket.fillFormFromTicket).not.toHaveBeenCalled();
  });
  it('erreur inattendue : message et bouton réactivé', async () => {
    repondre({});
    ticket.resizeImage.mockRejectedValueOnce(new Error('boum'));
    await lancerScan([fichier('a.jpg'), fichier('b.jpg')], btn);
    expect(feedback()).toContain('boum');
    expect(btn.disabled).toBe(false);
  });
});
```

- [ ] **Étape 2 : vérifier l'échec**

Lancer : `npx vitest run tests/scanPhotos.test.js`
Attendu : ÉCHEC (`../js/scanPhotos.js` introuvable).

- [ ] **Étape 3 : adapter `js/ticket.js`**

3a. Remplacer l'en-tête (lignes 1-18) par :

```js
/* ─── W17 — Lecture d'un ticket de caisse (OCR) + outils partagés du scanner ── *
 *                                                                        *
 *  Depuis W97, l'analyse IA (pompe, compteur, ticket) passe par           *
 *  js/scanPhotos.js (action GAS scanPhotos). Ce module garde :            *
 *    • resizeImage / blobToBase64 : préparation des photos ;              *
 *    • fillFormFromTicket : remplissage du formulaire (ordre critique) ;  *
 *    • lireTicketOCR : repli Tesseract.js 100 % navigateur (hors ligne    *
 *      ou échec de l'IA avec une seule photo) → parseOCRText → formulaire *
 *    • W9 : base64 de l'image (couleur) stockée dans state._ticketPhoto  *
 * ─────────────────────────────────────────────────────────────────────  */
```

3b. Ligne 21 : `import { FUEL_CONFIG, FUEL_SELECT, PRIX_API } from './config.js';` (`GAS_URL` et `APP_TOKEN` ne servaient qu'à `scanWithGemini`).

3c. Ligne 104 : `async function resizeImage(file) {` → `export async function resizeImage(file) {` ; ligne 173 : `async function blobToBase64(blob) {` → `export async function blobToBase64(blob) {`.

3d. Supprimer entièrement le bloc commentaire `scanWithGemini — …` et la fonction `async function scanWithGemini(imageBase64, mimeType) { … }` (lignes ~185-227) : l'appel IA passe désormais par `scanPhotos`. L'action GAS `scanTicket` reste côté serveur pour les clients en cache.

3e. `fillFormFromTicket` : remplacer la signature `async function fillFormFromTicket(data) {` par `export async function fillFormFromTicket(data, { silencieux = false } = {}) {` et remplacer les 4 dernières lignes de la fonction :

```js
  const label = filled > 0
    ? `${filled} champ${filled > 1 ? 's' : ''} pré-rempli${filled > 1 ? 's' : ''} — vérifiez avant d'enregistrer`
    : 'Aucun champ reconnu — essayez une photo plus nette et bien cadrée';
  showFeedback(filled > 0 ? 'success' : 'error', '🧾 Ticket analysé', label);
}
```

par :

```js
  if (!silencieux) {
    const label = filled > 0
      ? `${filled} champ${filled > 1 ? 's' : ''} pré-rempli${filled > 1 ? 's' : ''} — vérifiez avant d'enregistrer`
      : 'Aucun champ reconnu — essayez une photo plus nette et bien cadrée';
    showFeedback(filled > 0 ? 'success' : 'error', '🧾 Ticket analysé', label);
  }
  return filled;
}
```

3f. Remplacer tout le bloc `initScanner` (commentaire `initScanner — Câble le bouton …` jusqu'à la fin du fichier) par :

```js
/* ═══════════════════════════════════════════════════════════════════════
   lireTicketOCR — Repli Tesseract.js (hors ligne, ou échec de l'IA avec
   une seule photo). Le bouton est déjà désactivé par l'appelant, qui
   restaure aussi son libellé.
═══════════════════════════════════════════════════════════════════════ */

export async function lireTicketOCR(file, btn) {
  try {
    const blob = await resizeImage(file);

    /* W9 — stocker la photo couleur pour l'envoi avec le plein */
    try {
      const b64 = await blobToBase64(blob);
      if (b64) {
        state._ticketPhoto = b64;
        const indicator = document.getElementById('ticketPhotoIndicator');
        if (indicator) indicator.hidden = false;
      }
    } catch { /* non bloquant */ }

    btn.innerHTML = '⏳ Prétraitement…';
    const ocrBlob = await preprocessImage(file);

    const { data: { text } } = await Tesseract.recognize(ocrBlob, 'fra', {
      logger: ({ status, progress }) => {
        if (status === 'loading tesseract core') {
          btn.innerHTML = '⏳ Chargement moteur OCR…';
        } else if (status === 'loading language traineddata') {
          btn.innerHTML = '⏳ Chargement dictionnaire…';
        } else if (status === 'recognizing text') {
          btn.innerHTML = `⏳ Lecture ${Math.round(progress * 100)} %…`;
        }
      },
    });

    if (!text || text.trim().length < 8) {
      showFeedback('error', 'Scan échoué',
        'Image illisible — essayez une photo plus nette, bien éclairée et bien cadrée.');
      return;
    }

    await fillFormFromTicket(parseOCRText(text));
  } catch (err) {
    showFeedback('error', 'Erreur scan',
      err.message || 'Impossible de lire l\'image — réessayez.');
  }
}
```

- [ ] **Étape 4 : créer `js/scanPhotos.js`**

```js
/* ─── W97 — Scanner « intelligent » : pompe, compteur, ticket ─────────── *
 *  1 à 3 photos → redimensionnement → UN appel GAS action=scanPhotos →   *
 *  contrôle et fusion (scanControle.js) → formulaire + alertes ⚠.        *
 *  Replis : hors ligne ou échec IA avec 1 photo → OCR du ticket          *
 *  (lireTicketOCR) ; avec plusieurs photos → message, rien n'est rempli. *
 *  Spéc : docs/superpowers/specs/2026-10-11-scan-pompe-compteur-design.md *
 * ─────────────────────────────────────────────────────────────────────  */

import { FUEL_CONFIG, GAS_URL, APP_TOKEN, CLIENT_ID_KEY } from './config.js';
import { state } from './state.js';
import { showFeedback, setFieldWarning, clearFieldWarnings } from './ui.js';
import { resizeImage, blobToBase64, fillFormFromTicket, lireTicketOCR } from './ticket.js';
import { analyserScan, formaterBilan } from './scanControle.js';
import { getAllRecords, getMaxKmForVehicule } from './historique.js';
import { computeConsoMoy } from './refmodel.js';

export const MAX_PHOTOS = 3;
export const MAX_OCTETS = 6 * 1024 * 1024;
export const DELAI_MS   = 45000;

/* Champ de l'analyse → élément du formulaire qui porte l'alerte */
const CHAMP_ID = {
  date: 'fDate', km: 'fKm', litres: 'fLitres', prix_litre: 'fPrix',
  montant_total: 'fCout', type_carburant: 'typeToggle',
};

function clientId() {
  try { return localStorage.getItem(CLIENT_ID_KEY) || ''; } catch { return ''; }
}

/** Appel GAS action=scanPhotos (45 s max). Lève une Error (avec .code éventuel). */
export async function envoyerScanPhotos(images) {
  const ctrl  = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), DELAI_MS);
  try {
    const resp = await fetch(GAS_URL, {
      method: 'POST', redirect: 'follow', signal: ctrl.signal,
      body: JSON.stringify({ action: 'scanPhotos', images, token: APP_TOKEN, cid: clientId() }),
    });
    const json = await resp.json();
    if (!json || !json.success) {
      const err = new Error((json && json.error) || 'réponse invalide');
      err.code = json && json.code;
      throw err;
    }
    if (!Array.isArray(json.photos)) throw new Error('réponse sans photos (script Google à mettre à jour ?)');
    return json;
  } catch (err) {
    if (err.name === 'AbortError') throw new Error('délai de 45 s dépassé');
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

/** Contexte des contrôles : prix station, historique et conso du véhicule courant. */
export function construireContexte() {
  const veh  = state.currentVehiculeNom || '';
  const tous = getAllRecords();
  const hist = veh ? tous.filter(r => (r['Véhicule'] || r['Vehicule'] || '') === veh) : tous;
  const consoParType = {};
  Object.keys(FUEL_CONFIG).forEach(k => {
    const c = computeConsoMoy(hist, k);
    if (c > 0) consoParType[k] = c;
  });
  return {
    stationPrices:      { ...(state._stationPrices || {}) },
    historiqueVehicule: hist,
    dernierKm:          getMaxKmForVehicule(veh),
    consoParType,
    typeCourant:        state.currentType,
    aujourdHui:         new Date(),
  };
}

/** Remplit le formulaire puis pose les alertes (après le remplissage, qui émet des `input`). */
export async function remplirDepuisScan(resultat) {
  clearFieldWarnings();
  const remplis = await fillFormFromTicket(resultat.valeurs, { silencieux: true });
  Object.entries(resultat.alertes).forEach(([champ, msg]) => {
    if (CHAMP_ID[champ]) setFieldWarning(CHAMP_ID[champ], msg);
  });
  return remplis;
}

/** W9 — seule l'image classée « ticket » est jointe au plein. */
function joindreTicket(photos, images) {
  const p = photos.find(x => x && x.kind === 'ticket' && Number.isInteger(x.index) && images[x.index]);
  state._ticketPhoto = p ? images[p.index].data : null;
  const ind = document.getElementById('ticketPhotoIndicator');
  if (ind) ind.hidden = !p;
}

export async function lancerScan(fileList, btn) {
  const tous = Array.from(fileList || []);
  if (!tous.length) return;
  const files = tous.slice(0, MAX_PHOTOS);
  const note  = tous.length > MAX_PHOTOS ? ` (${MAX_PHOTOS} photos max : les suivantes ont été ignorées)` : '';

  const origHTML = btn.innerHTML;
  btn.disabled = true;
  try {
    if (!navigator.onLine) {
      if (files.length === 1) { await lireTicketOCR(files[0], btn); return; }
      showFeedback('error', 'Hors connexion',
        'Analyse IA indisponible hors connexion — seul un ticket peut être lu hors ligne.');
      return;
    }

    btn.innerHTML = '⏳ Préparation…';
    const images = [];
    for (const f of files) {
      const blob = await resizeImage(f);
      const data = await blobToBase64(blob);
      if (!data) throw new Error('photo illisible');
      images.push({ data, mimeType: blob.type || 'image/jpeg' });
    }
    const octets = images.reduce((s, i) => s + i.data.length * 0.75, 0);
    if (octets > MAX_OCTETS) {
      showFeedback('error', 'Photos trop lourdes',
        `${(octets / 1048576).toFixed(1).replace('.', ',')} Mo — envoyez moins de photos ou des photos plus petites.`);
      return;
    }

    btn.innerHTML = `⏳ Analyse IA (${images.length} photo${images.length > 1 ? 's' : ''})…`;
    let reponse;
    try {
      reponse = await envoyerScanPhotos(images);
    } catch (err) {
      console.warn('[scanPhotos] Échec :', err.message);
      if (files.length === 1) { await lireTicketOCR(files[0], btn); return; }
      if (err.code === 'RATE_LIMIT') showFeedback('error', '📸 Analyse IA', err.message);
      else showFeedback('error', '📸 Analyse IA',
        `Analyse impossible : ${err.message}. Réessayez ou saisissez à la main.`);
      return;
    }

    joindreTicket(reponse.photos, images);
    const resultat  = analyserScan(reponse, construireContexte());
    const remplis   = await remplirDepuisScan(resultat);
    const nbAlertes = Object.keys(resultat.alertes).length;
    const type = remplis === 0 ? 'error' : (nbAlertes ? 'info' : 'success');
    showFeedback(type, '📸 Scan analysé', formaterBilan(resultat.resume, remplis, nbAlertes) + note);
  } catch (err) {
    showFeedback('error', 'Erreur scan', err.message || 'Impossible de lire les photos — réessayez.');
  } finally {
    btn.innerHTML = origHTML;
    btn.disabled  = false;
  }
}

/** Câble le bouton « 📸 Scanner (pompe, compteur, ticket) » (sélection multiple). */
export function initScanner() {
  const btn = document.getElementById('scanTicketBtn');
  if (!btn) return;
  const input = document.createElement('input');
  input.type     = 'file';
  input.accept   = 'image/*';
  input.multiple = true;
  input.style.display = 'none';
  document.body.appendChild(input);

  btn.addEventListener('click', () => input.click());
  input.addEventListener('change', async (e) => {
    const files = Array.from(e.target.files || []);   // copier AVANT de vider l'input
    e.target.value = '';
    await lancerScan(files, btn);
  });
}
```

> Le message de feedback (`showFeedback`) insère `title` et `msg` via `innerHTML` ; les messages d'erreur viennent du script Google ou d'exceptions internes, jamais d'une saisie tierce — comportement identique à l'existant.

- [ ] **Étape 5 : brancher `main.js` et `index.html`**

- `js/main.js:33` : `import { initScanner }       from './ticket.js';` → `import { initScanner }       from './scanPhotos.js';`
- `index.html` lignes 171-175 : remplacer

```html
    <button id="scanTicketBtn" class="scan-btn" type="button" title="Scanner un ticket de caisse pour pré-remplir le formulaire">
      🧾 Scanner le ticket
    </button>
    <div class="scan-info">
      <span class="scan-hint">Photo du ticket → champs auto-remplis</span>
```

par

```html
    <button id="scanTicketBtn" class="scan-btn" type="button" title="Photos de la pompe, du compteur et/ou du ticket pour pré-remplir le formulaire">
      📸 Scanner (pompe, compteur, ticket)
    </button>
    <div class="scan-info">
      <span class="scan-hint">1 à 3 photos, dans n'importe quel ordre</span>
```

- [ ] **Étape 6 : vérifier le succès**

Lancer : `npx vitest run tests/scanPhotos.test.js tests/ticket.test.js` puis `npm test` puis `npm run lint`
Attendu : tout PASSE (dont `parseOCRText` inchangé), lint propre. `wc -l js/ticket.js js/scanPhotos.js js/scanControle.js` : les deux nouveaux modules < 500 lignes ; `ticket.js` diminue.

---

### Tâche 5 : vérification réelle (script déployé + app)

**Fichiers :** aucun fichier du dépôt ; scripts jetables dans le scratchpad.

- [ ] **Étape 1 : obtenir de vraies photos**

Demander à l'utilisateur 2 ou 3 photos réelles (afficheur de pompe, compteur de la Z900, et si possible un ticket) et le chemin où il les a déposées. Ne pas continuer sans elles (spéc §6 : vérification réelle avant livraison).

- [ ] **Étape 2 : appel du script déployé**

Créer `<scratchpad>/scan-reel.mjs` :

```js
import { readFileSync } from 'node:fs';
const cfg = readFileSync('js/config.js', 'utf-8');
const GAS_URL = cfg.match(/GAS_URL\s*=\s*['"]([^'"]+)/)[1];
const APP_TOKEN = (cfg.match(/APP_TOKEN\s*=\s*['"]([^'"]*)/) || [])[1] || '';
const images = process.argv.slice(2).map(p => ({ data: readFileSync(p).toString('base64'), mimeType: 'image/jpeg' }));
const t0 = Date.now();
const r = await fetch(GAS_URL, { method: 'POST', redirect: 'follow',
  body: JSON.stringify({ action: 'scanPhotos', images, token: APP_TOKEN }) });
console.log(((Date.now() - t0) / 1000).toFixed(1) + ' s');
console.log(JSON.stringify(await r.json(), null, 2));
```

Lancer depuis la racine : `node <scratchpad>/scan-reel.mjs "<photo1>" "<photo2>" ["<photo3>"]` (photos de plus de ~4 Mo : les réduire d'abord, l'app les ramène à 1 200 px).
Attendu : `success: true`, chaque photo bien classée, litres / prix / montant / km ODO conformes à ce que montrent les photos, temps < 45 s. Comparer avec l'utilisateur ; une erreur de lecture systématique → ajuster `scanPromptPhotos_` (tâche 2), redéployer, recommencer.

- [ ] **Étape 3 : contrôle dans l'app (aperçu)**

`preview_start` (configuration du serveur Vite `npm run dev`, http://localhost:5173/) → onglet Saisie : vérifier le libellé « 📸 Scanner (pompe, compteur, ticket) » et l'indication ; `read_console_messages` : aucune erreur au chargement. Faire un essai réel de scan avec les mêmes photos depuis le navigateur de l'utilisateur ou via `form_input` sur l'input fichier si possible ; sinon, le dire explicitement dans le compte rendu.

---

### Tâche 6 : documentation, version, graphe, commit

**Fichiers :** `CHANGELOG.md`, `README.md` (section « 🧾 Scan ticket de caisse (W17) », l.117-141), `ROADMAP.md` (l.23 → « ✅ Idées déjà implémentées », l.130+), `graphify-out/`.

- [ ] **Étape 1 : CHANGELOG** — en tête, au-dessus de `## [5.37.5.0]` :

```markdown
## [5.38.0.0] — 2026-10-11

### Added
- **Scanner « intelligent » : pompe, compteur, ticket (W97)** — le bouton « 📸 Scanner (pompe, compteur, ticket) » accepte 1 à 3 photos en un geste. Le script Google (nouveau `Scan.gs`, action `scanPhotos`, GAS v<N>) classe chaque image et lit litres, prix/L et montant sur l'afficheur de la pompe, le kilométrage total (ODO) sur le compteur, et le ticket comme avant. `js/scanControle.js` recoupe les lectures : pompe prioritaire sur le ticket, litres × prix = montant, type de carburant déduit du prix, kilométrage plausible, prix comparé à celui de la station ; toute valeur douteuse est signalée sous son champ (⚠). Hors ligne, une photo seule est lue par l'OCR du ticket. Seule la photo du ticket est jointe au plein (W9).

### Changed
- `js/ticket.js` : l'analyse IA passe par `js/scanPhotos.js` ; `scanWithGemini` (client) supprimé — l'action GAS `scanTicket` reste pour les clients en cache.
```

(Remplacer `<N>` par le numéro de version GAS obtenu à la tâche 2, étape 6.)

- [ ] **Étape 2 : README** — dans la section W17 : titre `### 📸 Scanner pompe, compteur, ticket (W97) + 🧾 OCR ticket (W17) + 📷 Photo jointe (W9)` ; remplacer le premier paragraphe par :

```markdown
Bouton **« 📸 Scanner (pompe, compteur, ticket) »** dans le formulaire : 1 à 3 photos (galerie ou caméra), dans
n'importe quel ordre → **un seul appel IA [Gemini 2.5 Flash](https://ai.google.dev/) via le backend GAS**
(action `scanPhotos`, `Scan.gs`) qui reconnaît l'afficheur de la pompe (litres, prix/L, montant), le compteur
(kilométrage total ODO) et le ticket (date, station…). L'app recoupe les lectures (`js/scanControle.js`) et
signale sous le champ toute valeur douteuse (⚠ : pompe et ticket en désaccord, litres × prix ≠ montant, type de
carburant déduit du prix, kilométrage improbable, prix différent de la station). Date et station restent à
vérifier par l'utilisateur. **Repli hors ligne** : une photo seule est lue comme un ticket par l'OCR
[Tesseract.js](https://tesseract.projectnaptha.com/) 100 % navigateur.
```

et, dans le paragraphe W9, préciser : « seule la photo reconnue comme **ticket** est jointe ».

- [ ] **Étape 3 : ROADMAP** — supprimer la ligne W97 du tableau « 💡 Propositions » (l.23) et ajouter en tête du tableau « ✅ Idées déjà implémentées » (au-dessus de `| v5.37.5.0 |`) :

```markdown
| v5.38.0.0 | **Scanner « intelligent » : pompe, compteur, ticket (W97)** — 1 à 3 photos, un seul appel IA (`Scan.gs`, action `scanPhotos`) ; contrôles croisés `js/scanControle.js` (pompe > ticket, litres × prix = montant, type déduit du prix, km plausible, prix station) et alertes ⚠ sous les champs ; repli OCR hors ligne pour une photo seule. |
```

- [ ] **Étape 4 : graphe — mise à jour gardée**

```bash
cp graphify-out/graph.json "<scratchpad>/graph.avant.json"
```

```bash
python -c "import json;print(len(json.load(open('graphify-out/graph.json',encoding='utf-8'))['nodes']))"
```

Noter le nombre de nœuds (2 998 au 2026-10-11), invoquer `/graphify --update`, puis relancer le comptage. S'il a baissé : `git checkout HEAD -- graphify-out/` et ne pas committer le graphe amputé (leçons #37/#44).

- [ ] **Étape 5 : commit unique**

```bash
./commit.sh "feat(scan): scanner intelligent pompe + compteur + ticket — un appel IA, contrôles croisés et alertes sous les champs (W97) [v5.38.0.0]"
```

Attendu : version synchronisée, lint + tests verts, push effectué. En cas d'échec Vitest « worker timeout » (Windows), relancer une fois avant de diagnostiquer.
