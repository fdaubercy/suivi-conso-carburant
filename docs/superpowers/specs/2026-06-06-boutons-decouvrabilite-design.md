# Découvrabilité des boutons-icônes — Design

> **Date** : 2026-06-06
> **Statut** : design validé (scope, forme et libellés approuvés par l'utilisateur)
> **Prochaine étape** : plan d'implémentation (`writing-plans`)

## 1. Problème

L'application est une PWA **mobile-first**. Plusieurs actions sont déclenchées par des boutons **icône seule** (📜, 📋, 📥, 📦, 🏍️…) dont le sens n'est porté que par l'attribut `title=`.

`title=` n'apparaît qu'au **survol souris** : il est donc **invisible au tactile**, c'est-à-dire dans le contexte d'usage principal de l'app. Conséquences :

- 6 pictogrammes ambigus se ressemblent deux à deux (📜 vs 📋, 📥 vs 📦) sans aucun mot pour les distinguer.
- Un bouton (📍) n'a même pas de `title` : son rôle est 100 % deviné.
- L'utilisateur iPhone qui découvre l'app ne peut pas savoir « à quoi sert ce bouton » sans tâtonner.

Ce besoin a été formulé ainsi : *« comment aider l'utilisateur utilisant l'app avec un iPhone et qui veut savoir l'utilité de chaque bouton ? »*

## 2. Objectif & non-objectifs

**Objectif** : rendre le rôle de chaque bouton-icône lisible **d'un coup d'œil, au doigt, sans survol**, sur les 10 boutons concernés de l'app.

**Critères de réussite** :
- Chaque bouton concerné affiche un libellé texte visible en permanence (pas seulement au survol).
- La découverte (1ʳᵉ rencontre) **et** la levée de doute récurrente sont couvertes (les deux comptent à parts égales).
- L'accessibilité lecteur d'écran est **renforcée**, jamais dégradée.

**Non-objectifs** (hors scope, volontairement) :
- Les croix de fermeture universelles de bandeaux/popups (`.pwa-close`, `.map-close-btn`) : la croix « ✕ » est une convention universelle ; un mot serait du bruit. *(Le ✕ de l'historique complet, lui, EST dans le scope car il ferme une vue entière, pas un bandeau.)*
- Le bouton 🧾 « Scanner le ticket » : il a déjà un libellé visible.
- Toute refonte fonctionnelle : on ne touche **qu'à la présentation** (icône + libellé), pas au comportement des actions.

## 3. Approche retenue

**« Labels partout » — icône + micro-libellé** (option A, choisie face à une option « hybride » qui repliait des actions dans un menu « ⋯ »).

L'option hybride a été écartée : sur ces clusters de 3 actions de poids égal, replier l'une d'elles déplaçait simplement le problème de découvrabilité vers le bouton « ⋯ » lui-même.

**Cette approche prolonge un pattern déjà présent et validé dans l'app** : le menu hamburger (`.hmenu-item` + `.hmi-ico`) associe déjà icône + libellé visible. On étend ce principe éprouvé plutôt que d'inventer un nouveau langage visuel.

### Principes de présentation

1. **Icône conservée + libellé court ajouté.** Aucune icône n'est retirée.
2. **`title=` complet conservé ET promu en `aria-label`.** Le libellé visible est court (« Tout voir ») ; la phrase complète (« Voir tout l'historique avec filtres ») reste disponible au survol et pour les lecteurs d'écran. → gain net d'accessibilité.
3. **La forme ne se discute plus** (icône + mot) ; seuls les mots restent ajustables dans le temps.

## 4. Les 10 boutons — libellés validés

| # | Icône | Sélecteur / repère | `title=` actuel (→ `aria-label`) | Libellé visible validé |
|---|-------|--------------------|-----------------------------------|------------------------|
| 1 | 🎤 | `#voiceKmBtn` `.voice-btn` | Dicter le kilométrage | **Dicter** |
| 2 | 📍 | `#geoBtn` `.geo-btn` | *(aucun — à créer)* Utiliser ma position actuelle | **Ma position** |
| 3 | ⛶ | `.map-fs-btn` (carte station) | Plein écran | **Plein écran** |
| 4 | 🏍️ | `#wrappedScopeBtn` `.hist-btn` | Basculer véhicule / tous | **Véhicule / tous** |
| 5 | 📜 | `[data-action="voirTout"]` `.hist-btn` | Voir tout l'historique avec filtres | **Tout voir** |
| 6 | 📋 | `[data-action="dupliquerDernier"]` `.hist-btn` | Dupliquer le dernier plein dans le formulaire | **Dupliquer** |
| 7 | ↻ | `[data-action="chargerHistorique"]` `.hist-btn.hist-refresh` | Actualiser | **Actualiser** |
| 8 | 📥 | `#histExportBtn` `.hist-btn` | Exporter la vue filtrée en CSV | **Export filtré** |
| 9 | 📦 | `#histExportAllBtn` `.hist-btn` | Exporter tout l'historique en CSV | **Export tout** |
| 10 | ✕ | `#histFullCloseBtn` `.hist-btn` | Fermer | **Fermer** |

## 5. Traitement par contexte de mise en page

Les 10 boutons ne vivent pas tous dans le même type d'emplacement. Trois traitements :

### Groupe A — clusters d'en-tête (boutons 4, 5, 6, 7, 8, 9, 10)
Boutons situés dans une rangée d'actions `.hist-actions` à l'intérieur d'un en-tête de carte (`.hist-header` / `.hist-full-header`).

- **Disposition** : icône **au-dessus** du libellé (empilés, style « tab-bar »). Plus compact en largeur que des pilules horizontales — essentiel dans ces en-têtes à 375px.
- **Layout** : la rangée d'actions passe **sous** le titre de section (l'en-tête devient 2 lignes) pour donner de l'air aux libellés. *(Changement de mise en page accepté : « clarté prioritaire ».)*
- **Contrainte technique** : ne **pas** modifier la classe de base `.hist-btn` globalement — elle est réutilisée par les boutons « plein écran » injectés dans les cartes (`.card.map-fs .hist-btn.card-fs-btn`). Utiliser une **classe modificatrice dédiée** appliquée uniquement aux boutons relabellisés ; `.hist-btn` de base reste intact.
- **Cas particulier carte « Bilan annuel »** (bouton 4) : le 🏍️ partage la rangée `.hist-actions` avec le menu déroulant de l'année (`#wrappedYear`). Vérifier l'alignement et la tenue à 375px du couple `[select année] + [🏍️ Véhicule / tous]`.

### Groupe B — boutons collés à un champ (boutons 1, 2)
- **🎤 Dicter** (bouton 1) : déjà placé à côté du champ kilométrage (`.voice-btn`, 40px). Ajout d'un libellé court en gardant la hauteur de la rangée du champ.
- **📍 Ma position** (bouton 2) : **changement de position**. Aujourd'hui superposé *à l'intérieur* du menu déroulant station (`position:absolute`, bord droit) — aucune place pour un libellé. Il devient un **bouton libellé adjacent au champ** (« 📍 Ma position »), sorti de la superposition. *(Seul bouton dont la position change, et non juste l'habillage ; validé en maquette.)*

### Groupe C — superposition sur carte (bouton 3)
- **⛶ Plein écran** : flotte sur un coin de carte. Ici la **pilule horizontale** (icône + mot côte à côte) se lit mieux qu'un empilement. Fond semi-opaque clair déjà en place. `aria-label` déjà présent — on ajoute seulement le mot visible.

## 6. Thème & accessibilité

- **Mode sombre** : l'app gère `[data-theme="dark"]`. Les libellés doivent rester lisibles dans les deux thèmes — utiliser des tokens de couleur thème-conscients (famille `--blue-mid` / texte atténué), pas une couleur figée. Contraste à vérifier en sombre.
- **`aria-label`** : chaque bouton porte la phrase complète (colonne `aria-label` du tableau §4). Le 📍 qui n'avait aucun `title` en gagne un.
- **Zone tactile** : la surface cliquable ne doit jamais rétrécir (≥ taille actuelle 30×30 ; le libellé tend à l'agrandir, ce qui est bénéfique).

## 7. Vérification (avant de déclarer terminé)

À contrôler dans l'aperçu de dev :

1. **Largeur 375px (iPhone SE)** : les 3 cartes d'en-tête, les 2 champs et la superposition carte affichent leurs libellés **sans débordement ni coupure de mot**.
2. **Mode sombre** : basculer `[data-theme="dark"]`, confirmer le contraste des libellés.
3. **Survol (desktop)** : l'info-bulle `title` complète apparaît toujours.
4. **Accessibilité** : chaque bouton expose son `aria-label` complet.
5. **Non-régression** : les boutons « plein écran » injectés (`.card-fs-btn`) ne sont **pas** affectés par le changement (classe de base `.hist-btn` intacte).

## 8. Décisions de cadrage (résolues)

- **Scope strict aux 10 boutons** (décision utilisateur, 2026-06-06). Les boutons ⛶ « plein écran » **injectés dynamiquement** (`.card-fs-btn`, ajoutés au coin d'autres cartes sans barre d'actions) ne sont **pas** modifiés, malgré une icône et une action identiques au bouton 3. Si le besoin se confirme à l'usage, leur relabellisation fera l'objet d'un lot séparé.
