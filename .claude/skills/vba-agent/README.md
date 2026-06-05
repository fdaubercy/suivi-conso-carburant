# vba-agent

Agent Claude Code qui modifie le **code VBA directement dans un fichier Excel
ouvert** (modules, classes, ThisWorkbook/feuilles, UserForms), sans import ni
copier-coller manuel. Il s'attache à l'instance Excel en cours via COM (pywin32)
et pilote le VBE.

## Installation

1. Copier ce dossier dans les skills Claude Code :
   - projet : `<repo>/.claude/skills/vba-agent/`
   - ou global : `~/.claude/skills/vba-agent/`
2. `pip install pywin32`
3. Excel : cocher « Faire confiance à l'accès au modèle d'objet du projet VBA »
   (voir `references/setup.md`).

## Test rapide (classeur .xlsm ouvert)

```powershell
# 1. voir les classeurs ouverts
python scripts/vba_agent.py list

# 2. inspecter le projet VBA
python scripts/vba_agent.py inspect --file MonClasseur.xlsm --names-only

# 3. sauvegarder avant toute modif
python scripts/vba_agent.py backup --file MonClasseur.xlsm --out .\backup_vba

# 4. créer/remplacer un module depuis un fichier code
python scripts/vba_agent.py set-module --file MonClasseur.xlsm --name modTest --type std --code-file code.bas --create

# 5. créer un UserForm depuis un JSON
python scripts/vba_agent.py build-form --file MonClasseur.xlsm --spec references/exemple-form.json

# 6. enregistrer
python scripts/vba_agent.py save --file MonClasseur.xlsm
```

Voir `SKILL.md` pour le workflow complet et `references/` pour le détail.
