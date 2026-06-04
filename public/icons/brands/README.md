# Icônes d'enseignes (stations-service)

Une icône par enseigne : `…/icons/brands/<slug>.svg` (servi à la racine du site).
Chaque fichier est soit le **logo officiel** de l'enseigne (fourni par le
propriétaire du dépôt), soit un **badge monogramme de repli** (couleur + initiales)
quand aucun logo n'est fourni. `generic.svg` est le repli pour une **enseigne
inconnue**.

> ⚠️ L'usage des logos de marques (marques déposées) relève du **propriétaire du
> dépôt**. Les badges monogrammes, eux, sont des créations originales.

## Ajouter une nouvelle enseigne

Quand l'app rencontre une enseigne non reconnue, elle la **journalise** :
- dans la console : `[brand] enseigne inconnue (ajouter public/icons/brands/<slug>.svg) : <nom>` ;
- dans `localStorage` sous la clé `brand_unknown_v1` (récupérable via
  `getUnknownBrands()` de `js/brand.js`).

Pour ajouter son icône :

1. Déposer `public/icons/brands/<slug>.svg` : le logo officiel de l'enseigne,
   **ou** un badge monogramme de repli (s'inspirer d'un fichier monogramme
   existant : `colruyt.svg`, `dyneff.svg`…).
2. Ajouter une entrée dans `BRANDS` de [`js/brand.js`](../../../js/brand.js) :
   ```js
   { re: /motif/i, label: 'Nom', color: '#RRGGBB', slug: '<slug>' },
   ```
   (placer les motifs les plus spécifiques en premier).

C'est tout : l'icône apparaît partout où l'enseigne est détectée (historique…).
L'affichage est en `object-fit:contain` sur fond blanc → n'importe quel ratio
(carré, large, vertical) tient proprement dans le carré, pas besoin d'uniformiser.

## Convention (badge monogramme de repli)

- Format SVG, viewBox `0 0 100 100`, coins arrondis `rx=24`.
- 1 lettre → `font-size:50`, 2 lettres → `40`, 3 → `30`.
- Un **logo officiel** peut remplacer le monogramme (tout ratio accepté).
