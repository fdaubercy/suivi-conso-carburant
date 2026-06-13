# Spec — Sidebar Excel : colonne d'icônes + aperçu titre par icône (v5.15.0.0)

> Statut : **design validé** par l'utilisateur le 2026-06-13.
> Module cible : `vba/modSidebar.bas` (déployé dans `excel/Suivi Conso Carburants.xlsm`).
> Skills : `superpowers:brainstorming` (fait) → `writing-plans` → implémentation via `vba-agent`.

## 1. Contexte et état actuel (inspection COM du classeur ouvert)

- Sidebar « Variante C » : shapes fixes par onglet, préfixe `sb_` (`sb_bg`, `sb_ham`,
  `sb_hdr`, `sb_ico_0..5`, `sb_lbl_0..5`, `sb_sep_h`, `sb_sep_0..5`).
- **Icônes `sb_ico_*` actuellement visibles** sur tous les onglets (à masquer par défaut).
- **`btnNavMenu` (ancien module `modNavMenu`) : posé sur aucun onglet.** Module VBA mort.
- Dimensions stockées en **points document = pt_écran ÷ zoom** (taille écran constante).
  Les largeurs d'icône diffèrent légitimement entre onglets (zoom propre à chaque feuille :
  Accueil 31,7 / Tableau de bord 39,6 / Carte 43,4 / Suivi Carburant 55,9…).

## 2. Bug à corriger (cause racine)

`CollapseIcon` remet `ico.Width = 44 ÷ ZoomFactor()` (zoom **live** de la fenêtre), alors que
l'icône a été créée avec `44 ÷ ZoomForSheet()` (zoom **calculé par onglet**). Si les deux
diffèrent, l'icône repliée ne matche plus ses voisines. Confirmé : recherche Microsoft Learn —
les shapes sont en **points absolus indépendants du zoom**, donc recalculer depuis le zoom est
fragile. **Solution : snapshot/restauration de la géométrie exacte.**

## 3. Exigences

1. **Uniquement `sb_ham` visible par défaut** sur chaque onglet (icônes, séparateurs, fond, libellés masqués).
2. **Clic `sb_ham`** → dépli progressif révélant la **colonne d'icônes** (`sb_ico_*` + `sb_sep_*` + `sb_bg` étroit). Re-clic ou changement d'onglet → repli.
3. **Clic `sb_ico_k`** → la shape s'étend vers la droite ; **icône + titre alignés à gauche**, l'icône ne bouge pas ; titre révélé. Repli **progressif** automatique après ~2,5 s, **restaurant la taille exacte** d'origine.
4. **Retirer le module mort `modNavMenu`** (et `btnNavMenu` si jamais présent).

## 4. Comportement retenu (choix utilisateur)

| Décision | Choix |
|---|---|
| Dépli hamburger | Colonne d'icônes (pas de libellés) |
| Titre par icône | Shape unique qui s'étend, icône+texte alignés gauche, snapshot/restauration |
| Disparition | Repli progressif (la shape rétrécit) |
| Ancien menu | Retrait du module `modNavMenu` |

## 5. Conception technique (modSidebar.bas)

**États :** Replié (seul `sb_ham`) → Colonne d'icônes (clic ham) → Aperçu titre (clic icône, transitoire).

**Procédures impactées :**
- `PoserSidebarSurFeuille` : créer `sb_ico_*`, `sb_sep_*`, `sb_bg`, `sb_hdr`, `sb_lbl_*` en `Visible=False` ; émoji des icônes **aligné à gauche** (`HorizontalAnchor=msoAnchorNone`/`Alignment=msoAlignLeft` + petite marge) au lieu de centré ; conserver `Placement=xlFreeFloating`. Seul `sb_ham` reste `Visible=True`.
- `ExpandSidebar` (clic ham) : afficher progressivement la **colonne d'icônes** (`sb_bg` étroit + `sb_ico_*` + `sb_sep_*`), **sans** libellés ni header. Timer auto-repli conservé.
- `CollapseSidebar` : re-masquer la colonne (icônes/séparateurs/fond).
- `RepositionSidebar` (Workbook_SheetActivate) : reset à l'état replié (seul `sb_ham`).
- `ExpandIcon(idx)` : **snapshot** `Left/Top/Width/Height` de `sb_ico_idx` (+ géométrie `sb_lbl_idx`) en variables module ; étendre la largeur vers la droite (boucle animée) ; placer le libellé `sb_lbl_idx` aligné à gauche sur la partie droite ; afficher le titre. L'émoji gauche-ancré ne bouge pas.
- `CollapseIcon(idx)` : masquer le libellé ; **repli progressif** de la largeur ; **restaurer la géométrie snapshotée exacte** (pas de `44 ÷ zoom`). Filet : forcer `Width` = largeur d'une icône voisine non étendue (toujours à l'état replié — un seul aperçu à la fois).

**État module ajouté :** `g_SnapW/g_SnapH/g_SnapL/g_SnapT As Single` (+ flag `g_SnapSet`) pour l'icône en aperçu.

**Suppression module mort :** retirer `modNavMenu` du projet VBA (`vba-agent remove`) + supprimer `vba/modNavMenu.bas` du miroir disque. Vérifier qu'aucun `OnAction`/`Call`/`Run` ne le référence (leçon : un `Call` orphelin = erreur de compilation).

## 6. Contraintes / leçons applicables

- Shapes absolues → `Placement=xlFreeFloating` (déjà en place).
- Géométrie en points (invariante au zoom) ; **snapshot/restauration**, jamais recalcul depuis le zoom.
- Déploiement : `vba-agent set-module` depuis le `.bas` **UTF-8**, en retirant `Attribute VB_Name` (géré par le skill). Pas de conversion CP1252.
- Après déploiement : `run PoserSidebarSurTousLesOnglets` pour reposer les shapes propres, puis `save`. Si un volet de code VBE est ouvert, prévoir un rafraîchissement (leçon buffer périmé).
- **Clic/survol réel non testable en COM** → faire valider l'interaction par l'utilisateur.

## 7. Hors-périmètre

- Pas de refonte du calcul de zoom (`ZoomForSheet`) ni des couleurs/charte.
- Pas de modification des autres modules.

## 8. Versioning & livraison

- Version : **5.15.0.0** (comportement UI visible nouveau) — `APP_VERSION` (config.js) + package.json + CHANGELOG + ROADMAP.
- Pré-commit : `/graphify --update` → docs → `commit.sh`.

## 9. Critères d'acceptation

1. À l'ouverture d'un onglet : **seul `sb_ham`** est visible.
2. Clic `sb_ham` : la colonne d'icônes apparaît progressivement ; re-clic / changement d'onglet : repli.
3. Clic d'une icône : titre révélé à droite, **icône immobile** ; après ~2,5 s, repli progressif et **icône revenue exactement à la taille de ses voisines** (vérifié sur un onglet où le zoom live ≠ zoom de création).
4. `modNavMenu` supprimé, projet VBA compile sans erreur, aucun appel orphelin.
