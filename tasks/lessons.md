# Lessons — Suivi Conso Carburant
> Append-only. Ne jamais supprimer d'entrées.

| Date | Ce qui s'est mal passé | Règle à suivre |
|------|------------------------|----------------|
| 2026-06-07 | `vba_agent.py` cherché dans `scripts/` alors qu'il est dans `.claude/skills/vba-agent/` | Toujours utiliser le chemin `.claude\skills\vba-agent\vba_agent.py` pour vba_agent |
| 2026-06-07 | Formula1 validation avec séparateur virgule échoue sur Excel FR (nécessite `;`) | Utiliser une plage de cellules comme source de validation (ex: `=$BB$1:$BB$2`) plutôt que des littéraux séparés |
| 2026-06-07 | `tasks/lessons.md` absent au démarrage de session (bloquait la règle CLAUDE.md) | Créer `tasks/lessons.md` dès la première session si absent |
