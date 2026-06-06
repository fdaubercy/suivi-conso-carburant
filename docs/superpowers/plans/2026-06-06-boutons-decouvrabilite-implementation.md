# Découvrabilité des boutons-icônes — Plan d'implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rendre lisible au doigt (sans survol) le rôle des 10 boutons-icônes ciblés, en ajoutant un libellé texte visible + un `aria-label` complet, sans toucher au comportement des actions.

**Architecture:** Extension du pattern déjà validé `hmenu-item` (icône + libellé). Chaque bouton conserve son icône et reçoit un libellé via des `<span>` enfants. On n'altère **jamais** la classe de base `.hist-btn` (réutilisée par les boutons plein écran injectés) : on ajoute des **classes modificatrices** (`--lbl`). Trois traitements selon l'emplacement : (A) clusters d'en-tête → icône au-dessus du libellé + en-tête sur 2 lignes ; (B) boutons de champ → libellé adjacent (le 📍 sort de sa superposition absolue) ; (C) superposition carte → pilule horizontale.

**Tech Stack:** PWA vanilla ES Modules, CSS custom-properties thème-conscientes (`[data-theme="dark"]`), build Vite, tests Vitest (+ jsdom) / Playwright. Référence spec : `docs/superpowers/specs/2026-06-06-boutons-decouvrabilite-design.md`.

**Source de vérité des libellés** : §4 de la spec. **Contrainte non-régression** : §5 (base `.hist-btn` intacte) + §7.5 (boutons `.card-fs-btn` injectés inchangés).

---

## Structure des fichiers

| Fichier | Responsabilité | Nature du changement |
|---|---|---|
| `index.html` | Markup statique des boutons 1, 2, 4–10 + carte station (bouton 3, instance 1) | Ajout spans icône/libellé + `aria-label` ; restructuration `.station-wrap` (bouton 2) ; classe `hist-header--stack` |
| `css/style.css` | Styles | Nouvelles classes modificatrices `.hist-btn--lbl`, `.hist-header--stack`, `.voice-btn--lbl`, `.geo-btn--lbl`, `.map-fs-btn--lbl` ; refonte `.station-wrap` |
| `js/wrapped.js` | Bouton 4 — swap d'icône au changement de périmètre | Cibler le span `.hb-ico` au lieu de `textContent` global |
| `js/mapfullscreen.js` | Bouton 3 — toggle ⛶/✕ plein écran | Helper `setFsButtonState` ciblant le span `.mfs-ico`/`.mfs-lbl` ; injectés inchangés |
| `js/stationsmap.js` | Bouton 3, instance 2 (carte stations habituelles statique) | Markup string : spans icône/libellé |
| `tests/buttons-a11y.test.js` | **Nouveau** — garde a11y/markup | Asserte aria-label + span libellé sur les boutons statiques |
| `tests/mapfullscreen-fsstate.test.js` | **Nouveau** — logique toggle | Asserte préservation du libellé + repli `textContent` |
| `CHANGELOG.md` / `ROADMAP.md` / `js/config.js` | Docs + version | Entrée + bump MINOR (tâche finale) |

> **Décision de périmètre à confirmer (bouton 3)** : la spec liste le bouton 3 une fois (`.map-fs-btn` carte station). Il existe **deux** instances *déclarées en dur* (donc dans le scope, distinctes des `.card-fs-btn` injectés exclus) : `index.html:253` (carte Google `#stationMapWrap`) et `js/stationsmap.js:289` (carte statique stations habituelles). Ce plan **relabellise les deux** pour cohérence. Si l'utilisateur ne veut que la première, retirer la Step 3.3.

---

## Convention de commit (intermédiaire)

Pendant l'implémentation, chaque tâche se termine par un commit **git simple** (le hook husky lance `eslint + vitest related` sur les `js/` mis en scène — il doit passer). Le **bump de version + CHANGELOG/ROADMAP + push** se fait en **Tâche 4** via `./commit.sh` (gate complet). Ne pas bumper `APP_VERSION` aux tâches 1–3.

---

## Tâche 1 : Groupe A — clusters d'en-tête (boutons 4, 5, 6, 7, 8, 9, 10)

**Files:**
- Modify: `css/style.css` (après la règle `.hist-refresh:active`, ~ligne 1048)
- Modify: `index.html` (en-têtes lignes ~304, ~330, ~343 ; boutons ~308, ~333–335, ~348–350)
- Modify: `js/wrapped.js:166-169`
- Test: `tests/buttons-a11y.test.js` (créé ici, complété en T2/T3)

- [ ] **Step 1 : Écrire le test a11y (échec attendu)**

Créer `tests/buttons-a11y.test.js` :

```js
// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { JSDOM } from 'jsdom';

const html = readFileSync(fileURLToPath(new URL('../index.html', import.meta.url)), 'utf-8');
const doc = new JSDOM(html).window.document;

/** [sélecteur, libellé visible attendu, aria-label attendu] — §4 de la spec */
const GROUP_A = [
  ['#wrappedScopeBtn', 'Véhicule / tous', 'Basculer entre le véhicule courant et tous les véhicules'],
  ['[data-action="voirTout"]', 'Tout voir', "Voir tout l'historique avec filtres"],
  ['[data-action="dupliquerDernier"]', 'Dupliquer', 'Dupliquer le dernier plein dans le formulaire'],
  ['[data-action="chargerHistorique"]', 'Actualiser', 'Actualiser'],
  ['#histExportBtn', 'Export filtré', 'Exporter la vue filtrée en CSV'],
  ['#histExportAllBtn', 'Export tout', "Exporter tout l'historique en CSV"],
  ['#histFullCloseBtn', 'Fermer', 'Fermer'],
];

describe('Groupe A — boutons d’en-tête relabellisés', () => {
  it.each(GROUP_A)('%s porte icône + libellé + aria-label', (sel, label, aria) => {
    const btn = doc.querySelector(sel);
    expect(btn, `bouton ${sel} introuvable`).toBeTruthy();
    expect(btn.classList.contains('hist-btn--lbl')).toBe(true);
    expect(btn.querySelector('.hb-ico'), 'span icône').toBeTruthy();
    expect(btn.querySelector('.hb-lbl')?.textContent.trim()).toBe(label);
    expect(btn.getAttribute('aria-label')).toBe(aria);
  });
});
```

- [ ] **Step 2 : Lancer le test, vérifier l'échec**

Run: `npm test -- buttons-a11y`
Expected: FAIL (les boutons n'ont pas encore `.hist-btn--lbl`, ni spans, ni aria-label).

- [ ] **Step 3 : Ajouter les classes CSS modificatrices**

Dans `css/style.css`, juste après la ligne `.hist-refresh:active { transform: rotate(180deg); }` (~1048), insérer :

```css

/* ─── Boutons d'action relabellisés (icône + libellé) — §A spec.
   MODIFICATEUR : la base .hist-btn (réutilisée par .card-fs-btn injectés) reste intacte. ─── */
.hist-btn--lbl {
  flex-direction: column;
  width: auto;
  height: auto;
  min-width: 46px;
  gap: 2px;
  padding: 4px 6px;
}
.hist-btn--lbl .hb-ico { font-size: 16px; line-height: 1; }
.hist-btn--lbl .hb-lbl {
  font-size: 10px; line-height: 1.1; font-weight: 600;
  color: var(--text-muted); white-space: nowrap;
}
/* La rotation « actualiser » ne fait tourner que l'icône (pas le libellé). */
.hist-btn--lbl.hist-refresh:active { transform: none; }
.hist-btn--lbl.hist-refresh:active .hb-ico { transform: rotate(180deg); transition: transform .3s; }

/* En-tête de carte passant sur 2 lignes quand sa rangée d'actions porte des libellés. */
.hist-header--stack { flex-direction: column; align-items: stretch; gap: 8px; }
.hist-header--stack .hist-actions { justify-content: flex-start; flex-wrap: wrap; }
```

- [ ] **Step 4 : Relabelliser les 7 boutons + en-têtes dans `index.html`**

4a. Carte « Bilan annuel » — en-tête (~304) :
```html
  <div class="hist-header hist-header--stack">
```
Bouton 4 (~308) :
```html
      <button class="hist-btn hist-btn--lbl" id="wrappedScopeBtn" title="Basculer véhicule / tous" aria-label="Basculer entre le véhicule courant et tous les véhicules"><span class="hb-ico">🏍️</span><span class="hb-lbl">Véhicule / tous</span></button>
```

4b. Carte « 5 derniers pleins » — en-tête (~330) :
```html
  <div class="hist-header hist-header--stack">
```
Boutons 5, 6, 7 (~333–335) :
```html
      <button class="hist-btn hist-btn--lbl" data-action="voirTout" title="Voir tout l'historique avec filtres" aria-label="Voir tout l'historique avec filtres"><span class="hb-ico">📜</span><span class="hb-lbl">Tout voir</span></button>
      <button class="hist-btn hist-btn--lbl" data-action="dupliquerDernier" title="Dupliquer le dernier plein dans le formulaire" aria-label="Dupliquer le dernier plein dans le formulaire"><span class="hb-ico">📋</span><span class="hb-lbl">Dupliquer</span></button>
      <button class="hist-btn hist-btn--lbl hist-refresh" data-action="chargerHistorique" title="Actualiser" aria-label="Actualiser"><span class="hb-ico">↻</span><span class="hb-lbl">Actualiser</span></button>
```

4c. Carte « Tous les pleins » — en-tête (~343) :
```html
  <div class="hist-full-header hist-header--stack">
```
Boutons 8, 9, 10 (~348–350) :
```html
      <button class="hist-btn hist-btn--lbl" id="histExportBtn" data-action="exportHistoriqueCSV" title="Exporter la vue filtrée en CSV" aria-label="Exporter la vue filtrée en CSV"><span class="hb-ico">📥</span><span class="hb-lbl">Export filtré</span></button>
      <button class="hist-btn hist-btn--lbl" id="histExportAllBtn" data-action="exportHistoriqueAllCSV" title="Exporter tout l'historique en CSV" aria-label="Exporter tout l'historique en CSV"><span class="hb-ico">📦</span><span class="hb-lbl">Export tout</span></button>
      <button class="hist-btn hist-btn--lbl" id="histFullCloseBtn" title="Fermer" aria-label="Fermer"><span class="hb-ico">✕</span><span class="hb-lbl">Fermer</span></button>
```

- [ ] **Step 5 : Corriger le swap d'icône du bouton 4 dans `js/wrapped.js`**

Le code actuel (`:166-169`) écrase tout le bouton via `textContent`, ce qui détruirait le libellé. Remplacer :
```js
  const scope = getScope();
  const scopeBtn = document.getElementById('wrappedScopeBtn');
  if (scopeBtn) {
    scopeBtn.textContent = scope === 'all' ? '🚗🏍️' : '🏍️';
  }
```
par :
```js
  const scope = getScope();
  const scopeBtn = document.getElementById('wrappedScopeBtn');
  if (scopeBtn) {
    // Ne mettre à jour que l'icône — le libellé « Véhicule / tous » reste visible.
    const ico = scopeBtn.querySelector('.hb-ico') || scopeBtn;
    ico.textContent = scope === 'all' ? '🚗🏍️' : '🏍️';
  }
```

- [ ] **Step 6 : Lancer le test a11y, vérifier le succès**

Run: `npm test -- buttons-a11y`
Expected: PASS (7 cas Groupe A verts).

- [ ] **Step 7 : Vérif visuelle rapide (preview)**

`npm run dev` → ouvrir `http://localhost:5173/`, largeur 375px. Confirmer : les 3 en-têtes affichent titre (ligne 1) + boutons icône-au-dessus-du-libellé (ligne 2), sans débordement. Basculer `[data-theme="dark"]` → libellés lisibles. *(Détail via outils preview en Tâche 4.)*

- [ ] **Step 8 : Lint + commit**

Run: `npm run lint`
Expected: 0 erreur.
```bash
git add css/style.css index.html js/wrapped.js tests/buttons-a11y.test.js
git commit -m "feat(ui): libellés visibles boutons d'en-tête (groupe A, 4-10)"
```

---

## Tâche 2 : Groupe B — boutons de champ (1 🎤 Dicter, 2 📍 Ma position)

**Files:**
- Modify: `css/style.css` (`.voice-btn` ~442 ; `.station-wrap`/`.geo-btn` ~496–507)
- Modify: `index.html` (bouton 1 ~168 ; bloc station ~217–225)
- Test: `tests/buttons-a11y.test.js` (ajout d'un bloc Groupe B)

- [ ] **Step 1 : Étendre le test a11y (échec attendu)**

Ajouter à la fin de `tests/buttons-a11y.test.js` :
```js
describe('Groupe B — boutons de champ', () => {
  it('🎤 #voiceKmBtn : libellé « Dicter » + aria-label', () => {
    const b = doc.querySelector('#voiceKmBtn');
    expect(b.classList.contains('voice-btn--lbl')).toBe(true);
    expect(b.querySelector('svg'), 'icône SVG conservée').toBeTruthy();
    expect(b.querySelector('.vb-lbl')?.textContent.trim()).toBe('Dicter');
    expect(b.getAttribute('aria-label')).toBe('Dicter le kilométrage');
  });

  it('📍 #geoBtn : sorti de la superposition, libellé « Ma position » + aria-label', () => {
    const b = doc.querySelector('#geoBtn');
    expect(b.classList.contains('geo-btn--lbl')).toBe(true);
    expect(b.querySelector('.gb-lbl')?.textContent.trim()).toBe('Ma position');
    expect(b.getAttribute('aria-label')).toBe('Utiliser ma position actuelle');
    // Le bouton est désormais frère direct du <select> dans .station-wrap (flux normal).
    expect(b.parentElement.classList.contains('station-wrap')).toBe(true);
    expect(b.previousElementSibling?.id).toBe('stationSel');
  });
});
```

Run: `npm test -- buttons-a11y` → Expected: FAIL (Groupe B).

- [ ] **Step 2 : Bouton 1 — markup `index.html:168-175`**

Remplacer la balise ouvrante du bouton et ajouter le libellé après le `</svg>` :
```html
        <button type="button" id="voiceKmBtn" class="voice-btn voice-btn--lbl" title="Dicter le kilométrage" aria-label="Dicter le kilométrage">
          <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
            <rect x="9" y="2" width="6" height="12" rx="3" fill="currentColor"/>
            <path d="M5 11a7 7 0 0 0 14 0" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
            <line x1="12" y1="18" x2="12" y2="22" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
            <line x1="8" y1="22" x2="16" y2="22" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
          </svg>
          <span class="vb-lbl">Dicter</span>
        </button>
```

- [ ] **Step 3 : Bouton 1 — CSS (après `.voice-btn:active`, ~457)**

```css
.voice-btn--lbl { width: auto; gap: 6px; padding: 0 10px; }
.voice-btn--lbl .vb-lbl { font-size: 12px; font-weight: 600; color: var(--text-muted); white-space: nowrap; }
```
*(La base `.voice-btn` reste 40px carré ; le modificateur l'élargit. `.km-input-wrap` est déjà un flex `input:flex:1 + bouton`.)*

- [ ] **Step 4 : Bouton 2 — markup `index.html:217-225` (sortie de superposition)**

Remplacer le bloc `.station-wrap` :
```html
    <div class="station-wrap">
      <select id="stationSel">
        <option value="">— Choisir —</option>
        <optgroup label="Stations habituelles" id="knownGroup">
          <option value="__autre">+ Saisie manuelle</option>
        </optgroup>
      </select>
      <button class="geo-btn geo-btn--lbl" id="geoBtn" aria-label="Utiliser ma position actuelle"><span class="gb-ico">📍</span><span class="gb-lbl">Ma position</span></button>
    </div>
```

- [ ] **Step 5 : Bouton 2 — CSS `index.html` overlay → flux (remplacer ~496-507)**

Remplacer les règles existantes `.station-wrap`, `.station-wrap select`, `.geo-btn`, `.geo-btn:active`, `.geo-btn.loading` :
```css
/* ─── Station + géo ─── (bouton 📍 sorti de la superposition → bouton libellé adjacent) */
.station-wrap { display: flex; gap: 8px; align-items: stretch; }
.station-wrap select { flex: 1; min-width: 0; }
.geo-btn {
  flex-shrink: 0; width: 46px;
  border: 1.5px solid var(--border); background: transparent; border-radius: var(--radius);
  cursor: pointer; font-size: 20px;
  display: flex; align-items: center; justify-content: center; gap: 6px;
  -webkit-tap-highlight-color: transparent;
}
.geo-btn--lbl { width: auto; padding: 0 12px; font-size: 16px; }
.geo-btn--lbl .gb-lbl { font-size: 12px; font-weight: 600; color: var(--text-muted); white-space: nowrap; }
.geo-btn:active { background: var(--blue-light); }
.geo-btn.loading .gb-ico { animation: spin .9s linear infinite; }
```
> ⚠️ `js/geo.js` ajoute/retire la classe `loading` sur `#geoBtn` pour faire tourner l'icône. Avec la nouvelle structure, l'animation porte sur `.gb-ico` (règle ci-dessus). Vérifier en Step 7 qu'aucun code ne dépend de `.geo-btn` en `position:absolute`.

- [ ] **Step 6 : Lancer le test a11y → succès**

Run: `npm test -- buttons-a11y` → Expected: PASS (Groupes A + B).

- [ ] **Step 7 : Vérif preview + non-régression géoloc**

`npm run dev`, 375px : le champ Station affiche `[select ………] [📍 Ma position]` aligné, sans débordement. Cliquer 📍 → l'icône tourne pendant la géoloc (classe `loading`), le statut s'affiche. Le champ Km affiche `[…… ] [🎤 Dicter]`. Mode sombre OK.

- [ ] **Step 8 : Lint + commit**

```bash
npm run lint
git add css/style.css index.html tests/buttons-a11y.test.js
git commit -m "feat(ui): libellés boutons de champ — Dicter + Ma position hors superposition (groupe B, 1-2)"
```

---

## Tâche 3 : Groupe C — superposition carte (bouton 3 ⛶ Plein écran)

**Files:**
- Modify: `js/mapfullscreen.js` (helper + `_clearFullscreen` ~18-22 + entrée plein écran ~91-93)
- Modify: `index.html:253` (instance carte Google)
- Modify: `js/stationsmap.js:289` (instance carte statique)
- Modify: `css/style.css` (après `.map-fs-wrap .map-fs-btn` ~1565)
- Test: `tests/mapfullscreen-fsstate.test.js` (nouveau)

- [ ] **Step 1 : Exporter un helper d'état testable + écrire le test (échec attendu)**

Créer `tests/mapfullscreen-fsstate.test.js` :
```js
// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { setFsButtonState } from '../js/mapfullscreen.js';

describe('setFsButtonState — préserve le libellé des boutons relabellisés', () => {
  it('bouton avec spans : met à jour icône + libellé, conserve la structure', () => {
    const b = document.createElement('button');
    b.innerHTML = '<span class="mfs-ico">⛶</span><span class="mfs-lbl">Plein écran</span>';
    setFsButtonState(b, '✕', 'Quitter', 'Quitter le plein écran');
    expect(b.querySelector('.mfs-ico').textContent).toBe('✕');
    expect(b.querySelector('.mfs-lbl').textContent).toBe('Quitter');
    expect(b.getAttribute('aria-label')).toBe('Quitter le plein écran');
    expect(b.title).toBe('Quitter le plein écran');
  });

  it('bouton icône-seule (injecté) : repli sur textContent, pas de libellé', () => {
    const b = document.createElement('button'); // pas de spans → comme .card-fs-btn
    setFsButtonState(b, '✕', 'Quitter', 'Quitter le plein écran');
    expect(b.textContent).toBe('✕');
    expect(b.getAttribute('aria-label')).toBe('Quitter le plein écran');
  });
});
```

Run: `npm test -- mapfullscreen-fsstate` → Expected: FAIL (`setFsButtonState` non exporté).

- [ ] **Step 2 : Ajouter le helper exporté dans `js/mapfullscreen.js`**

Après le bandeau de commentaire d'en-tête (avant `_clearFullscreen`), ajouter :
```js
/** Met un bouton plein écran dans l'état (icône, libellé, titre).
 *  Boutons relabellisés → met à jour les spans `.mfs-ico`/`.mfs-lbl` (le mot reste visible).
 *  Boutons icône-seule (injectés `.card-fs-btn`) → repli sur `textContent` (comportement inchangé). */
export function setFsButtonState(b, icon, label, title) {
  const ico = b.querySelector('.mfs-ico');
  if (ico) ico.textContent = icon; else b.textContent = icon;
  const lbl = b.querySelector('.mfs-lbl');
  if (lbl && label != null) lbl.textContent = label;
  b.title = title;
  b.setAttribute('aria-label', title);
}
```

- [ ] **Step 3 : Câbler le helper dans les deux transitions**

3a. Sortie plein écran — remplacer la boucle `_clearFullscreen` (~18-22) :
```js
  document.querySelectorAll('.map-fs-btn').forEach(b => {
    setFsButtonState(b, '⛶', 'Plein écran', 'Plein écran');
  });
```
3b. Entrée plein écran — remplacer (~91-93) :
```js
        setFsButtonState(fsBtn, '✕', 'Quitter', 'Quitter le plein écran');
```
> ⚠️ Ne **pas** modifier `_makeFsButton` (~27-35) : les boutons injectés restent en `textContent='⛶'` (icône seule, hors scope §8). Le helper les gère via le repli.

- [ ] **Step 4 : Markup instance 1 — `index.html:253`**
```html
        <button class="map-fs-btn map-fs-btn--lbl" type="button" data-fs-target="#stationMapWrap" title="Plein écran" aria-label="Plein écran"><span class="mfs-ico">⛶</span><span class="mfs-lbl">Plein écran</span></button>
```

- [ ] **Step 5 : Markup instance 2 — `js/stationsmap.js:289`**
```js
                   +   '<button class="map-fs-btn map-fs-btn--lbl" type="button" data-fs-target="#staticMapFsWrap" title="Plein écran" aria-label="Plein écran"><span class="mfs-ico">⛶</span><span class="mfs-lbl">Plein écran</span></button>'
```

- [ ] **Step 6 : CSS pilule — `css/style.css` après `.map-fs-wrap .map-fs-btn { … }` (~1565)**
```css
/* Bouton ⛶ relabellisé (pilule horizontale icône + mot) — §C spec. */
.map-fs-btn--lbl { width: auto; gap: 5px; padding: 0 10px; }
.map-fs-btn--lbl .mfs-lbl { font-size: 12px; font-weight: 600; white-space: nowrap; }
```
*(La couleur du texte suit `color` du bouton : blanc sur en-tête carte, `#1B3A5C` sur superposition claire — déjà thème-conscient.)*

- [ ] **Step 7 : Tests → succès**

Run: `npm test -- mapfullscreen-fsstate` → Expected: PASS (2 cas).

- [ ] **Step 8 : Vérif preview — toggle plein écran**

`npm run dev` → onglet Carte / carte station : la pilule « ⛶ Plein écran » s'affiche. Cliquer → plein écran, le bouton devient « ✕ Quitter ». Re-cliquer → revient « ⛶ Plein écran ». Vérifier qu'une **autre** carte (ex. carte avec bouton injecté) garde un ⛶ **icône seule** (non-régression §7.5).

- [ ] **Step 9 : Lint + commit**

```bash
npm run lint
git add js/mapfullscreen.js index.html js/stationsmap.js css/style.css tests/mapfullscreen-fsstate.test.js
git commit -m "feat(ui): libellé bouton plein écran carte station, libellé préservé au toggle (groupe C, 3)"
```

---

## Tâche 4 : Vérification complète + docs + version + push

**Files:**
- Modify: `js/config.js` (`APP_VERSION`), `CHANGELOG.md`, `ROADMAP.md`
- (option) `tasks/lessons.md`

- [ ] **Step 1 : Suite de tests complète + lint**

Run: `npm test` puis `npm run lint`
Expected: tous verts, 0 warning lint.

- [ ] **Step 2 : Vérification visuelle §7 de la spec (preview, outils preview_*)**

Avec le serveur dev, contrôler et capturer une preuve :
1. **375px (iPhone SE)** : 3 cartes d'en-tête + 2 champs + superposition carte → libellés **sans débordement ni coupure**. Cas particulier : `[select année] + [🏍️ Véhicule / tous]` tient sur la carte Bilan annuel.
2. **Mode sombre** (`[data-theme="dark"]`) : contraste des libellés OK.
3. **Survol desktop** : l'info-bulle `title` complète apparaît toujours.
4. **A11y** : chaque bouton expose son `aria-label` (couvert par `buttons-a11y.test.js`).
5. **Non-régression** : boutons `.card-fs-btn` injectés **non** affectés (icône seule).

Si un débordement apparaît à 375px, ajuster `min-width`/`font-size`/`gap` des modificateurs (itération CSS uniquement, pas de changement de structure).

- [ ] **Step 3 : Documentation obligatoire**

- `CHANGELOG.md` : nouvelle entrée `## [X.Y.Z.W] — 2026-06-06` / `### Changed` décrivant les libellés visibles sur 10 boutons (icône + mot, `aria-label` renforcé, 📍 sorti de la superposition).
- `ROADMAP.md` : ajouter une ligne dans « ✅ Idées déjà implémentées » (`| vX.Y.Z.W | **Découvrabilité boutons-icônes (Wnn)** — libellés visibles + aria-label sur 10 boutons |`) et retirer l'item correspondant des tableaux « à faire » s'il y figure.
- `js/config.js` : lire `APP_VERSION` actuelle, **bump MINOR** (fonctionnalité utilisateur visible) → `vX.(Y+1).0.0` (remettre PATCH et BUILD à 0 selon les règles).

- [ ] **Step 4 : Commit final via le gate projet**

```bash
./commit.sh "feat(ui): découvrabilité — libellés visibles sur 10 boutons-icônes [vX.(Y+1).0.0]"
```
Le gate enchaîne version → lint → tests → add -A → commit → pull --rebase → push. Vérifier la sortie : push OK, CI verte.

- [ ] **Step 5 : Mettre à jour la carte de connaissances (fin de session)**

```bash
graphify --update
```
*(Conforme au CLAUDE.md : MAJ du graphe en fin de session de travail.)*

---

## Auto-revue (writing-plans)

**1. Couverture spec :**
- §4 (10 libellés) → boutons 4–10 = T1, 1–2 = T2, 3 = T3. ✅
- §5 Groupe A (icône au-dessus, en-tête 2 lignes, modificateur, base `.hist-btn` intacte) → T1 Steps 3–4. ✅
- §5 Groupe A cas wrappedYear → T1 4a + T4 Step 2.1. ✅
- §5 Groupe B (🎤 libellé ; 📍 sortie superposition) → T2. ✅
- §5 Groupe C (pilule horizontale) → T3 Step 6. ✅
- §6 thème/aria/zone tactile → tokens `var(--text-muted)` ; `aria-label` partout (test) ; les modificateurs n'agrandissent que la surface. ✅
- §7 vérif → T4 Step 2. ✅
- §8 scope strict, `.card-fs-btn` injectés exclus → non modifiés (T3 Step 3 ⚠, vérif T3 Step 8 + T4 Step 2.5). ✅

**2. Placeholders :** aucun « TBD/TODO » ; tout le code des éditions est explicite. La seule valeur dynamique est `APP_VERSION` (instruction déterministe : lire puis bump MINOR). ✅

**3. Cohérence des noms :** spans `.hb-ico/.hb-lbl` (groupe A), `.vb-lbl` (b.1), `.gb-ico/.gb-lbl` (b.2), `.mfs-ico/.mfs-lbl` (b.3) ; helper `setFsButtonState` identique entre `mapfullscreen.js` et son test ; classes `--lbl` cohérentes. ✅

**Point ouvert signalé** : périmètre bouton 3 (1 ou 2 instances) — défaut = 2, ajustable (retirer T3 Step 5).
