# Charte & Workflow UI (design → code)

> Extrait de `CLAUDE.md` (découpe du 2026-06-21). **À lire avant tout travail d'UI.**
> Fusion de `CLAUDE_3.md` (2026-06-11) — directives propres à la charte visuelle et au flux maquette → code.

- **Charte (projet personnel)** : appliquer la skill **`brand-perso`** (palette, typo, conventions). **Ne jamais** utiliser le branding santé/maternité (`brand-sante`) sur ce projet.
- **Workflow UI en deux temps** :
  1. **`ui-designer`** produit une **maquette statique** dans `design/maquette-<nom>.html` (aucune logique).
  2. **`ui-coder`** reprend la maquette, câble les fonctions, l'intègre, et incrémente **au minimum le BUILD (W)**.
- **Stack & conventions (rappel)** : Vanilla HTML/CSS/JS, **ES modules**, pas de framework ni bundler sauf demande explicite ; **chemins relatifs** (GitHub Pages) ; séparer **structure / style / comportement** ; **accessibilité AA**.
- **Pas d'emojis dans le code ni dans les messages de commit.** (Les emojis restent tolérés dans les docs Markdown — CLAUDE.md, CHANGELOG, ROADMAP.)
