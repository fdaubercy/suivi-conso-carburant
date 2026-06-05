---
name: vba-agent
description: >
  Modifie le code VBA DIRECTEMENT dans un fichier Excel ouvert par l'utilisateur,
  sans lui demander d'importer ou de copier/coller quoi que ce soit. S'attache à
  l'instance Excel en cours via COM (pywin32) et pilote le VBE pour lire, créer,
  remplacer ou supprimer modules, classes, modules de document (ThisWorkbook,
  feuilles) et UserForms — y compris créer/paramétrer des formulaires et leurs
  contrôles par code, puis enregistrer le classeur. Utilise ce skill dès que
  l'utilisateur veut « injecter », « pousser », « mettre à jour », « appliquer »
  ou « écrire » du VBA dans un .xlsm/.xlsb existant, paramétrer un UserForm dans
  un fichier réel, ou automatiser l'édition du projet VBA sans manipulation
  manuelle dans l'éditeur. Pour l'ÉCRITURE du code VBA lui-même (qualité, forms,
  dashboards), s'appuyer sur le skill excel-vba-expert ; ce skill-ci est la
  couche d'injection/orchestration. Environnement requis : Claude Code local
  sous Windows avec Excel installé.
---

# VBA Agent — injection directe de code VBA dans Excel

Ce skill applique des modifications VBA **dans le classeur réel** (idéalement
celui que l'utilisateur a déjà ouvert), via le modèle d'objet du VBE piloté en
COM. Le code VBA à écrire est produit selon les standards du skill
`excel-vba-expert` ; ce skill se charge de **l'appliquer** proprement.

## Environnement et prérequis

- **Claude Code local, sous Windows, Excel installé.** L'attache à l'instance
  ouverte ne fonctionne pas depuis un environnement sandbox/Linux.
- `pip install pywin32` (une fois).
- Activer **une seule fois** : Excel > Options > Centre de gestion de la
  confidentialité > Paramètres des macros > cocher « Faire confiance à l'accès
  au modèle d'objet du projet VBA ». Sans ça, l'accès au projet VBA échoue.
- Le classeur doit être **macro-enabled** (`.xlsm` ou `.xlsb`) pour conserver
  le VBA à l'enregistrement.

Détails et dépannage : voir `references/setup.md`.

## Outil

Tout passe par un seul script CLI à sortie JSON :

```
python scripts/vba_agent.py <sous-commande> [options]
```

Toujours lire la sortie JSON (`"ok": true/false`) avant l'étape suivante.
En cas d'échec, le champ `"hint"` indique la correction.

| Sous-commande | Rôle |
|---|---|
| `list` | Liste les classeurs ouverts (pour cibler le bon `--file`) |
| `inspect --file F [--component N] [--names-only]` | Dump des composants et de leur source |
| `backup --file F --out DIR` | Exporte tous les composants (sauvegarde avant édition) |
| `set-module --file F --name N --type std\|class --code-file C [--create]` | Remplace (ou crée) un module/classe |
| `set-doc --file F --name N --code-file C` | Remplace le code d'un module de document (ThisWorkbook, Feuil1…) |
| `import --file F --path COMP` | Importe un `.bas/.cls/.frm` |
| `remove --file F --name N` | Supprime un composant |
| `build-form --file F --spec FORM.json` | Crée/remplace un UserForm + contrôles depuis un JSON |
| `run --file F --macro NAME` | Exécute une macro |
| `save --file F` | Enregistre le classeur |

`--file` accepte le nom (basename) ou le chemin complet ; ajouter `--open` pour
ouvrir le fichier s'il n'est pas déjà ouvert.

## Workflow standard (à suivre)

1. **Cibler** : `list` pour confirmer le nom exact du classeur ouvert.
2. **Comprendre l'existant** : `inspect` (au besoin `--component` ou
   `--names-only`) pour voir la structure VBA réelle avant toute modif.
3. **Sauvegarder** : `backup` vers un dossier horodaté avant la première
   écriture d'une session. Ne pas sauter cette étape.
4. **Préparer le code** : générer le VBA (standards `excel-vba-expert`) et
   l'écrire dans un fichier temporaire UTF-8 (`--code-file`). Pour un formulaire,
   préparer un `FORM.json` (voir `references/form-spec.md`).
5. **Confirmer en une ligne** : avant chaque écriture, annoncer en une seule
   ligne ce qui va être appliqué et attendre le feu vert. Ex. :
   `→ Remplacer le module modImport (42 lignes) dans Suivi.xlsm ? [o/n]`
6. **Appliquer** : `set-module` / `set-doc` / `build-form` / `import` / `remove`.
7. **Enregistrer** : `save` (seulement après confirmation, ou la grouper avec
   la confirmation de l'étape 5 si l'utilisateur le demande).
8. **Vérifier** : `inspect --names-only` pour confirmer l'état final.

## Règles de sécurité

- **Toujours `backup` avant d'écrire.** Les modifs VBE ne sont pas annulables
  par Ctrl+Z.
- Ne jamais supprimer/remplacer un composant en cours d'exécution. Si une macro
  tourne, attendre.
- Les modules de document (`ThisWorkbook`, feuilles, type `document`) ne se
  suppriment pas : utiliser `set-doc` pour réécrire leur code.
- Si `inspect`/`save` renvoie une erreur de confiance VBA, renvoyer l'utilisateur
  au réglage du Centre de confidentialité (voir `references/setup.md`).
- Confirmation **brève, une seule ligne** avant chaque écriture (préférence
  utilisateur). Une seule question à la fois.

## Quand combiner avec excel-vba-expert

- `excel-vba-expert` = **écrire** du bon VBA (logique, UserForms, dashboards,
  gestion d'erreurs, perf).
- `vba-agent` = **injecter** ce VBA dans le fichier ouvert et le persister.

Pour une demande type « ajoute un formulaire de saisie au classeur ouvert » :
concevoir le formulaire et son code avec `excel-vba-expert`, puis l'appliquer
avec `build-form` + `set-module` + `save` de ce skill.

## Références

- `references/setup.md` — installation, réglage de confiance, dépannage,
  instances multiples.
- `references/form-spec.md` — schéma JSON complet d'un UserForm + exemple.
