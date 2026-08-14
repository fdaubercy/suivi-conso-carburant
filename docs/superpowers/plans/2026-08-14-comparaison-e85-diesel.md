# Comparaison E85 vs carburant au choix (dont diesel) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Permettre à l'utilisateur de choisir le carburant auquel l'E85 est comparé — y compris le **gazole (diesel)**, moteur d'un *autre* véhicule — et répercuter ce choix sur toute la rentabilité, la bannière temps réel, le CO₂ évité et les graphiques.

**Architecture :** On généralise le calcul « E85 vs SP98 » en un **modèle de référence unifié**. Pour un plein E85 de `lit` litres, les litres du carburant de référence à distance égale valent `lit × ratioConso`, où `ratioConso = consoRef / consoE85`. Cas essence : `consoRef = consoE85/(1+surconso)` ⇒ `ratioConso = 1/(1+surconso)` (comportement actuel, inchangé). Cas diesel : `consoRef =` conso L/100 mesurée sur les pleins d'un **véhicule diesel de référence choisi par l'utilisateur**, sinon un défaut « berline » ⇒ `ratioConso = consoDiesel / consoE85`. Le prix de référence et le facteur CO₂/L dépendent aussi du carburant choisi.

**Tech Stack :** PWA JS (ES modules, Vite), Vitest (jsdom) ; Excel VBA (injection COM via `vba-agent`) ; Google Apps Script (onglet `Parametres`).

## Global Constraints

- Répondre/committer **en français** (CLAUDE.md).
- Fichiers **< 500 lignes** ; éditions ciblées, jamais de troncature.
- Lint bloquant : `npx eslint <fichiers>` (`--max-warnings=0`). Constructeurs DOM préfixés `window.` (leçon #47).
- Tests : `npx vitest related --run <fichiers> --no-file-parallelism` (éviter la tempête de forks, leçon #54).
- Sync P1 = **last-write-wins par clé** sur epoch ms. Toute nouvelle clé métier doit être ajoutée **aux 3 endroits** : `js/parametres.js` (DEFS), Excel `modSyncParametres`, GAS `PARAM_KEYS` (`Code.gs`, whitelist anti-pollution) — **sinon la clé est filtrée côté serveur**.
- Le calcul actuel essence (SP98/SP95/E10 + `ecart_ref`) doit rester **strictement identique** (non-régression).
- Défauts validés : **conso berline diesel = 5,5 L/100 km**, **CO₂ gazole = 2,68 kg CO₂/L**.
- Phase Excel : **prévenir l'utilisateur d'ouvrir le classeur** avant toute injection COM.

---

## File Structure

| Fichier | Responsabilité | Action |
|---|---|---|
| `js/config.js` | Constantes/clés localStorage | Modifier : `CONSO_DIESEL_REF_KEY`, `VEHICULE_DIESEL_REF_KEY`, `DEFAULT_CONSO_DIESEL`, `CO2_GAZOLE_PER_L`, `DEFAULT_CARBURANT_REF` inchangé |
| `js/refmodel.js` | **Nouveau** — logique pure du modèle de référence (conso diesel mesurée, ratioConso, prix réf, CO₂/L) | Créer |
| `js/stats.js` | Économie / CO₂ / stats : consommer `refmodel.js` au lieu du SP98 en dur | Modifier |
| `js/rentabilite.js` | Bannière temps réel : comparer au carburant choisi | Modifier |
| `js/parametres.js` | DEFS de sync P1 | Modifier : 2 clés |
| `index.html` | Sélecteur « Carburant de référence » + bloc diesel | Modifier |
| `tests/refmodel.test.js` | Tests unitaires purs du modèle de référence | Créer |
| `vba/modRentabilite.bas` | Branche diesel du calcul Excel + 2 params | Modifier (phase 2) |
| `vba/modSyncParametres.bas` | Transport des 2 nouvelles clés | Modifier (phase 2) |
| `Code.gs` (GAS) | `PARAM_KEYS` whitelist | Modifier + redéployer (phase 2) |

---

# PHASE 1 — Web app (PWA)

### Task 1 : Constantes de configuration

**Files:**
- Modify: `js/config.js` (après la zone rentabilité X67, ~ligne 88-92 et bloc CO₂ ~104-106)

**Interfaces:**
- Produces :
  - `CONSO_DIESEL_REF_KEY = 'suivi_e85_conso_diesel_ref'`
  - `VEHICULE_DIESEL_REF_KEY = 'suivi_e85_vehicule_diesel_ref'`
  - `DEFAULT_CONSO_DIESEL = 5.5` (L/100 km)
  - `CO2_GAZOLE_PER_L = 2.68` (kg CO₂/L)

- [ ] **Step 1 : Ajouter les clés et constantes**

Dans `js/config.js`, sous les clés `PROJ_NB_RECENTS_KEY` (~ligne 88) :

```js
// Comparaison E85 vs diesel — carburant de référence pouvant être le gazole
// (moteur d'un AUTRE véhicule → conso mesurée sur un véhicule diesel choisi,
// sinon défaut berline). Partagé P1 avec Excel/GS.
export const CONSO_DIESEL_REF_KEY   = 'suivi_e85_conso_diesel_ref';
export const VEHICULE_DIESEL_REF_KEY = 'suivi_e85_vehicule_diesel_ref';
export const DEFAULT_CONSO_DIESEL   = 5.5;   // L/100 km, berline diesel moyenne
```

Sous le bloc CO₂ (~ligne 106, après `CO2_E85_PER_L`) :

```js
// Diesel (gazole) : ~2,68 kg CO₂/L à la combustion (tank-to-wheel).
export const CO2_GAZOLE_PER_L = 2.68;
```

- [ ] **Step 2 : Lint**

Run: `npx eslint js/config.js`
Expected: 0 erreur.

- [ ] **Step 3 : Commit**

```bash
git add js/config.js
git commit -m "feat(config): clés conso diesel réf + CO2 gazole (comparaison E85 vs diesel)"
```

---

### Task 2 : Module pur `refmodel.js` (cœur testable)

**Files:**
- Create: `js/refmodel.js`
- Test: `tests/refmodel.test.js`

**Interfaces:**
- Consumes : `matchType` (dupliqué localement pour rester pur — pas d'import de stats.js), `FUEL_CONFIG`, `CO2_ESSENCE_PER_L`, `CO2_E85_PER_L`, `CO2_GAZOLE_PER_L`, `DEFAULT_CONSO_DIESEL` (config.js).
- Produces :
  - `computeConsoMoy(records, fuelKey)` → number (L/100 km moyenne pondérée par deltas km ; 0 si indéterminé). Réutilisable E85 comme diesel.
  - `getConsoDieselRef(allRecords)` → number : conso du **véhicule diesel de référence** (`VEHICULE_DIESEL_REF_KEY`) mesurée sur ses pleins gazole ; repli sur `CONSO_DIESEL_REF_KEY` (saisie manuelle) ; repli final `DEFAULT_CONSO_DIESEL`.
  - `buildRefModel({ refKey, consoE85, surconso, ecartRef, allRecords })` → `{ refKey, isDiesel, ratioConso, co2RefPerL, refPriceFromFill(fill, avgRefPrice) }`
    - `ratioConso` : essence = `1/(1+surconso)` ; diesel = `consoDiesel/consoE85` (0 si `consoE85<=0`).
    - `co2RefPerL` : essence = `CO2_ESSENCE_PER_L` ; diesel = `CO2_GAZOLE_PER_L`.
    - `refPriceFromFill(fill, avgRefPrice)` : essence = `max(0,(fill['SP98 station (€/L)']||avgRefPrice) - ecartRef)` ; diesel = `(fill['Gazole station (€/L)']||avgRefPrice)`.

- [ ] **Step 1 : Écrire les tests (échec attendu)**

`tests/refmodel.test.js` :

```js
// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { computeConsoMoy, buildRefModel } from '../js/refmodel.js';

const E85 = 'SuperEthanol E85', GAZ = 'Gazole';
// 3 pleins E85 : 0→500 km (35 L), 500→1000 km (36 L) ⇒ ~7,1 L/100
const recE85 = [
  { Date:'2026-01-01', Type:E85, 'Km compteur':0,    'Nb. Litres':30 },
  { Date:'2026-01-10', Type:E85, 'Km compteur':500,  'Nb. Litres':35 },
  { Date:'2026-01-20', Type:E85, 'Km compteur':1000, 'Nb. Litres':36 },
];

describe('computeConsoMoy', () => {
  it('calcule la conso L/100 sur les deltas km du carburant', () => {
    const c = computeConsoMoy(recE85, 'E85');
    expect(c).toBeGreaterThan(6.5);
    expect(c).toBeLessThan(7.5);
  });
  it('rend 0 sans données exploitables', () => {
    expect(computeConsoMoy([], 'E85')).toBe(0);
  });
});

describe('buildRefModel — essence (non-régression)', () => {
  it('ratioConso = 1/(1+surconso) et CO2 essence', () => {
    const m = buildRefModel({ refKey:'SP98', consoE85:9, surconso:0.25, ecartRef:0, allRecords:[] });
    expect(m.isDiesel).toBe(false);
    expect(m.ratioConso).toBeCloseTo(1/1.25, 6);
    expect(m.co2RefPerL).toBeCloseTo(2.21, 6);
  });
  it('refPrice = SP98 station − écart', () => {
    const m = buildRefModel({ refKey:'SP98', consoE85:9, surconso:0.25, ecartRef:0.05, allRecords:[] });
    expect(m.refPriceFromFill({ 'SP98 station (€/L)':2.00 }, 2.00)).toBeCloseTo(1.95, 6);
  });
});

describe('buildRefModel — diesel', () => {
  const recDiesel = [
    { Date:'2026-02-01', Type:GAZ, Véhicule:'Berline', 'Km compteur':0,    'Nb. Litres':28 },
    { Date:'2026-02-10', Type:GAZ, Véhicule:'Berline', 'Km compteur':500,  'Nb. Litres':27 },
  ];
  it('ratioConso = consoDiesel/consoE85 avec véhicule diesel loggé', () => {
    localStorage?.clear?.();
    // consoDiesel ~5,4 L/100 ; consoE85 = 9 ⇒ ratio ~0,6
    const m = buildRefModel({
      refKey:'GAZOLE', consoE85:9, surconso:0.25, ecartRef:0,
      allRecords:recDiesel, vehiculeDieselRef:'Berline',
    });
    expect(m.isDiesel).toBe(true);
    expect(m.ratioConso).toBeGreaterThan(0.55);
    expect(m.ratioConso).toBeLessThan(0.65);
    expect(m.co2RefPerL).toBeCloseTo(2.68, 6);
  });
  it('repli défaut 5,5 L/100 sans véhicule diesel', () => {
    const m = buildRefModel({
      refKey:'GAZOLE', consoE85:11, surconso:0.25, ecartRef:0,
      allRecords:[], consoDieselManuelle:0,
    });
    expect(m.ratioConso).toBeCloseTo(5.5/11, 6);
  });
  it('refPrice diesel = prix gazole station (sans écart)', () => {
    const m = buildRefModel({ refKey:'GAZOLE', consoE85:9, surconso:0.25, ecartRef:0.05, allRecords:[] });
    expect(m.refPriceFromFill({ 'Gazole station (€/L)':1.75 }, 1.75)).toBeCloseTo(1.75, 6);
  });
});
```

- [ ] **Step 2 : Lancer (échec attendu)**

Run: `npx vitest related --run tests/refmodel.test.js --no-file-parallelism`
Expected: FAIL (« computeConsoMoy is not a function »).

- [ ] **Step 3 : Implémenter `js/refmodel.js`**

Signature `buildRefModel` : accepte aussi `vehiculeDieselRef` et `consoDieselManuelle` en paramètres explicites (pour testabilité pure) ; les wrappers de `stats.js` les liront depuis localStorage. Formules exactement comme décrites dans **Interfaces** ci-dessus. `computeConsoMoy` reprend la logique de `computeSurconso` (tri chrono, deltas km positifs, moyenne des `(lit/dk)*100`) mais filtrée sur `fuelKey`.

- [ ] **Step 4 : Lancer (succès attendu)**

Run: `npx vitest related --run tests/refmodel.test.js --no-file-parallelism`
Expected: PASS (tous).

- [ ] **Step 5 : Lint + commit**

```bash
npx eslint js/refmodel.js tests/refmodel.test.js
git add js/refmodel.js tests/refmodel.test.js
git commit -m "feat(stats): modèle de référence unifié E85 vs essence/diesel (module pur + tests)"
```

---

### Task 3 : Brancher `stats.js` sur le modèle de référence

**Files:**
- Modify: `js/stats.js` — bloc économie (~360-432), `computeCo2Annuel` (~696-715), `computeCo2Monthly` (~758-780), 2ᵉ bloc éco (~1032-1058), imports (~1-14)

**Interfaces:**
- Consumes : `buildRefModel`, `computeConsoMoy`, `getConsoDieselRef` (refmodel.js) ; `CARBURANT_REF_KEY`, `CO2_GAZOLE_PER_L` (config.js).
- Produces : `DashStats` gagne `refKey`, `refShort`, `ratioConso` ; les libellés « vs SP98 » deviennent « vs <refShort> ».

- [ ] **Step 1** : importer le modèle et remplacer, dans le bloc économie principal, le calcul `sp98`/`ecartRef`/`(lit/(1+surconso))` par : `const rm = buildRefModel({refKey, consoE85, surconso, ecartRef, allRecords})` puis `totCoutRefEquiv += lit * rm.ratioConso * rm.refPriceFromFill(r, avgRefPrice)`. `avgRefPrice` = moyenne des prix réf connus (SP98 station pour essence, Gazole station pour diesel).
- [ ] **Step 2** : CO₂ — remplacer `essenceEquivL * CO2_ESSENCE_PER_L` par `litresEquiv * rm.co2RefPerL` (où `litresEquiv = totLitresE85 * rm.ratioConso`) dans `computeStats`, `computeCo2Annuel`, `computeCo2Monthly`, 2ᵉ bloc éco. Le terme `− totLitresE85 * CO2_E85_PER_L` reste inchangé.
- [ ] **Step 3** : Libellés dynamiques — remplacer les 3 occurrences en dur « SP98 » de l'UI stats (`éco. E85 vs SP98`, sous-texte surconso) par `s.refShort`. Pour diesel, le sous-texte affiche `surconso vs diesel = 1/ratioConso − 1` (« +X % vs diesel »).
- [ ] **Step 4** : Étendre `initRentabiliteSettings` (~1210) : accepter `GAZOLE` ; afficher/masquer le bloc diesel ; câbler le champ conso diesel manuelle (`CONSO_DIESEL_REF_KEY`, `pushParam('conso_diesel_ref')`) et le sélecteur véhicule diesel (`VEHICULE_DIESEL_REF_KEY`, `pushParam('vehicule_diesel_ref')`), tous deux `renderStats()` au change.
- [ ] **Step 5** : Tests de non-régression — `npx vitest related --run tests/stats.test.js tests/refmodel.test.js --no-file-parallelism` → PASS. (Les tests existants `getEcartRef`/`clampSurconso`/budget restent verts.)
- [ ] **Step 6** : Lint + commit

```bash
npx eslint js/stats.js
git add js/stats.js
git commit -m "feat(stats): économie/CO2/graphes pilotés par le carburant de référence choisi (dont diesel)"
```

---

### Task 4 : Bannière temps réel `rentabilite.js`

**Files:**
- Modify: `js/rentabilite.js` (tout le fichier, 55 l.)

**Interfaces:**
- Consumes : `state._stationPrices` (E85 + prix du carburant réf), `CARBURANT_REF_KEY`, `getConsoDieselRef`/conso E85 courante pour le ratio diesel.

- [ ] **Step 1** : Lire le carburant de référence courant. Prix réf station = `state._stationPrices[refKey]` (diesel → clé `GAZOLE`). Si absent, effacer la bannière (comme aujourd'hui quand SP98 manque).
- [ ] **Step 2** : Seuil — `seuilRentable(surconsoVsRef)` où pour essence `surconsoVsRef = surconso` (inchangé) et pour diesel `surconsoVsRef = consoE85/consoDiesel − 1`. Le ratio comparé reste `prixE85 / prixRef`.
- [ ] **Step 3** : Libellés — remplacer « SP98 » par le libellé du carburant choisi (« … moins cher que Gazole »).
- [ ] **Step 4** : Lint + commit

```bash
npx eslint js/rentabilite.js
git add js/rentabilite.js
git commit -m "feat(web): bannière temps réel E85 vs carburant de référence choisi (dont diesel)"
```

---

### Task 5 : Sync P1 côté web (`parametres.js`) + UI (`index.html`)

**Files:**
- Modify: `js/parametres.js` (DEFS ~31-51, imports ~20-24)
- Modify: `index.html` (~489-507 sélecteur réf + nouveau bloc diesel)

**Interfaces:**
- Produces : clés Sheet `conso_diesel_ref` (num), `vehicule_diesel_ref` (str) ajoutées au mapping P1.

- [ ] **Step 1** : `parametres.js` — importer `CONSO_DIESEL_REF_KEY`, `VEHICULE_DIESEL_REF_KEY` ; ajouter aux `DEFS` :
```js
{ cle: 'conso_diesel_ref',   local: CONSO_DIESEL_REF_KEY,   kind: 'num' },
{ cle: 'vehicule_diesel_ref', local: VEHICULE_DIESEL_REF_KEY, kind: 'str' },
```
- [ ] **Step 2** : `index.html` — ajouter `<option value="GAZOLE">Gazole (diesel)</option>` au `<select id="carburantRef">` ; ajouter sous le bloc écart un conteneur `#dieselRefBlock` (masqué par défaut) avec : `<select id="vehiculeDieselRef">` (peuplé depuis `getVehicules()`) + `<input id="consoDieselRef" type="number" step="0.1" min="0">` (L/100) + texte d'aide « auto d'après les pleins gazole du véhicule choisi, sinon 5,5 L/100 par défaut ». Le bloc écart `#ecartRef` se masque quand Gazole est choisi (câblé en Task 3 Step 4).
- [ ] **Step 3** : Lint + tests + commit

```bash
npx eslint js/parametres.js
npx vitest related --run tests/refmodel.test.js tests/stats.test.js --no-file-parallelism
git add js/parametres.js index.html
git commit -m "feat(web): sélecteur diesel + conso/véhicule diesel de référence + sync P1"
```

---

### Task 6 : Vérification navigateur + docs + version

**Files:**
- Modify: `CHANGELOG.md`, `README.md` (si usage change), `ROADMAP.md`, `js/config.js` (`APP_VERSION`)

- [ ] **Step 1** : `npm run dev`, ouvrir Réglages → Conversion E85 → choisir « Gazole (diesel) » → vérifier apparition du bloc diesel, disparition de l'écart, recalcul des stats/CO₂, bannière. Preuve : capture + `read_console_messages` (0 erreur).
- [ ] **Step 2** : Bump `APP_VERSION` (js/config.js) + entrée `CHANGELOG.md` `[X.Y.Z.W]` + ligne ROADMAP « ✅ implémentées » + retrait éventuel de l'item.
- [ ] **Step 3** : `npx eslint js/` + `npx vitest related --run tests/*.js --no-file-parallelism`.
- [ ] **Step 4** : Commit (fin phase 1)

```bash
git add -A
git commit -m "docs+chore: comparaison E85 vs diesel (phase web) [vX.Y.Z.W]"
```

---

# PHASE 2 — Parité Excel / Google Sheets

> ⚠️ **Prévenir l'utilisateur d'OUVRIR le classeur `excel/Suivi Conso Carburants.xlsm` AVANT toute injection COM.** Respecter les leçons VBA : stripper `Attribute VB_Name` avant `set-module` (#50), vérifier compile via `run` réel, `save` après vérif, ne pas conclure « environnemental » trop vite (#49).

### Task 7 : GAS — whitelist + redéploiement

**Files:**
- Modify: `Google Apps Script/Code.gs` (`PARAM_KEYS` ~71-75)

- [ ] **Step 1** : Ajouter `'conso_diesel_ref', 'vehicule_diesel_ref'` à `PARAM_KEYS`.
- [ ] **Step 2** : Redéployer le Web App (autorisation explicite de l'utilisateur requise — le déploiement prod est un accord par déploiement). Vérifier `getParametres` renvoie bien les nouvelles clés après un `setParametres` de test.
- [ ] **Step 3** : Commit `Code.gs`.

### Task 8 : Excel `modRentabilite` — branche diesel

**Files:**
- Modify: `vba/modRentabilite.bas`

- [ ] **Step 1** : Lire l'état live du module (miroir vs live, leçon #40/#51). Ajouter la lecture des 2 params (`conso_diesel_ref`, `vehicule_diesel_ref`) déjà transportés par `modSyncParametres`.
- [ ] **Step 2** : Quand `carburant_ref = GAZOLE` : colonne équiv. = `litres × (consoDiesel / consoE85)`, prix réf = prix gazole (colonne station gazole), CO₂ réf/L = 2,68. Garde-fou : `consoDiesel` mesurée sur les pleins gazole du véhicule choisi, sinon 5,5. Sinon (essence) : comportement X67 inchangé.
- [ ] **Step 3** : Injecter COM (`set-module` après strip `Attribute VB_Name`), `Debug→Compile`, `run` read-only de la macro de recalcul, `save`. Déléguer la vérif visuelle à l'utilisateur (« Activer le contenu » + bouton reconstruction).

### Task 9 : Excel `modSyncParametres` — transport des 2 clés

**Files:**
- Modify: `vba/modSyncParametres.bas`

- [ ] **Step 1** : Ajouter `conso_diesel_ref` et `vehicule_diesel_ref` au mapping cellules ↔ clés (aligné sur N6:N14 « Suivi Carburant » ; choisir 2 cellules libres N15/N16, documenter). Vérifier `< 500 lignes` (sinon reliquat X62-like).
- [ ] **Step 2** : Injecter COM, compiler, `run` sync réel, vérifier round-trip Web→GS→Excel d'un des 2 params.
- [ ] **Step 3** : Docs (CHANGELOG/ROADMAP) + bump version + commit final phase 2.

---

## Self-Review

1. **Couverture spec :** carburant sélectionnable ✅ (Task 5) ; diesel = véhicule réel choisi sinon défaut ✅ (Task 2/5) ; surconso E85 vs diesel ✅ (`ratioConso`, Task 2/4) ; impacte éco+bannière+CO₂+graphes ✅ (Task 3/4) ; parité Excel/GS ✅ (Task 7-9).
2. **Placeholders :** formules et signatures explicites ; le code complet est fourni pour le module pur risqué (`refmodel.js`) et ses tests ; les tâches de câblage pointent fichier+lignes exacts.
3. **Cohérence types :** `ratioConso`, `co2RefPerL`, `refPriceFromFill`, `computeConsoMoy`, `getConsoDieselRef`, `buildRefModel` nommés identiquement partout ; clés Sheet `conso_diesel_ref`/`vehicule_diesel_ref` identiques web+GAS+Excel.
