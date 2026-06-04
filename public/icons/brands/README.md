# Icônes d'enseignes (stations-service)

Pictos **originaux** (badge couleur de l'enseigne + monogramme), pas des logos
déposés — donc **libres de droits** et sûrs pour un dépôt public, tout en restant
reconnaissables. Servis à la racine du site : `…/icons/brands/<slug>.svg`.

`generic.svg` est le repli affiché pour une **enseigne inconnue**.

## Ajouter une nouvelle enseigne

Quand l'app rencontre une enseigne non reconnue, elle la **journalise** :
- dans la console : `[brand] enseigne inconnue (ajouter public/icons/brands/<slug>.svg) : <nom>` ;
- dans `localStorage` sous la clé `brand_unknown_v1` (récupérable via
  `getUnknownBrands()` de `js/brand.js`).

Pour ajouter son icône :

1. Créer `public/icons/brands/<slug>.svg` (badge 100×100, `rx=24`, couleur de
   l'enseigne + monogramme blanc) — s'inspirer d'un fichier existant.
2. Ajouter une entrée dans `BRANDS` de [`js/brand.js`](../../../js/brand.js) :
   ```js
   { re: /motif/i, label: 'Nom', color: '#RRGGBB', slug: '<slug>' },
   ```
   (placer les motifs les plus spécifiques en premier).

C'est tout : l'icône apparaît partout où l'enseigne est détectée (historique…).

## Convention

- Format SVG, viewBox `0 0 100 100`, coins arrondis `rx=24`.
- 1 lettre → `font-size:50`, 2 lettres → `40`, 3 → `30`.
- Pas de logo officiel / marque déposée.
