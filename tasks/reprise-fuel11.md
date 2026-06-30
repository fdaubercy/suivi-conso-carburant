# Mini-export — reprise session fuel11 (2026-06-30)

## Contexte
Reprise de l'export `session-export-fuel11.zip`. Session précédente coupée (limite) en pleine
investigation du bug « clic sur le badge hors-ligne = rien, badge clignote » sur le portable.

## Demandes de l'export — statut final
| # | Demande | Statut | Preuve |
|---|---------|--------|--------|
| 1 | Synchroniser 3 pleins hors-ligne | ✅ | Feature W80 (badge cliquable + relance auth + retry visibilitychange), commit 13af697 |
| 2 | « le badge reste » | ✅ | Intégré au design |
| 3 | Version config.js pas bonne | ✅ | APP_VERSION=5.29.0.1, commit 862578e |
| 4 | Retenir l'erreur de versionnage | ✅ | Mémoire native + lessons.md |
| 5 | Clic badge = rien / clignote | ✅ | **Résolu cette reprise** : cause = plugin `swVersionPlugin` jamais enregistré dans `plugins:[]` (vite.config.js) → SW au cache constant → PWA figée sur l'ancien code après déploiement. Fix W82, commit 6ebe561 (v5.29.0.2). |

## Reste à faire (côté utilisateur, pas de code)
- [ ] Attendre la fin du déploiement GitHub Pages de v5.29.0.2 (~quelques min après le push).
- [ ] Sur le portable : fermer **complètement** la PWA puis la rouvrir en ligne (ou recharger avec
      vidage de cache). Cette fois, comme le cache SW change enfin de nom (`...shell-v5.29.0.2`),
      l'invite « Actualiser » (W23) devrait apparaître. Le badge 📵 3 hors-ligne deviendra cliquable.
- [ ] Taper le badge → les 3 pleins partent vers Google Sheets (badge tombe à 0).

## Leçon consignée
`tasks/lessons.md` (2026-06-30) : diagnostic d'un plugin de build « qui ne fait rien » → vérifier
D'ABORD qu'il est enregistré dans `plugins:[]` avant d'échafauder des hypothèses sur le timing des hooks.
