# Installation & dépannage — vba-agent

## 1. Dépendances

```powershell
pip install pywin32
```

Excel doit être installé sur le poste (le skill pilote l'application Excel
réelle via COM, il ne lit pas le fichier « à froid »).

## 2. Autoriser l'accès au projet VBA (obligatoire, une seule fois)

Sans ce réglage, `wb.VBProject` lève une erreur et rien ne peut être modifié.

1. Excel > **Fichier** > **Options**
2. **Centre de gestion de la confidentialité** > **Paramètres du Centre de
   gestion de la confidentialité…**
3. **Paramètres des macros**
4. Cocher **« Faire confiance à l'accès au modèle d'objet du projet VBA »**
5. OK, puis rouvrir le classeur.

## 3. Format du classeur

Le VBA n'est conservé qu'avec une extension macro-enabled :
- `.xlsm` (classique) ou `.xlsb` (binaire).
- Un `.xlsx` ne peut **pas** stocker de VBA : `save` échouera ou perdra le code.

## 4. Modèle d'attache

Le script s'attache **en priorité à l'instance Excel en cours** et y cherche le
classeur par nom/chemin. C'est ce qui permet d'éditer le fichier que
l'utilisateur a déjà ouvert, en direct. Il n'ouvre lui-même le fichier que si
`--open` est passé et que le classeur n'est pas déjà ouvert.

### Instances multiples

`GetActiveObject("Excel.Application")` renvoie **une** instance (la première
enregistrée). Si plusieurs Excel distincts tournent, le classeur visé peut être
dans une autre instance. Dans ce cas :
- Lancer `list` pour voir ce que voit le script.
- Si le bon classeur n'apparaît pas, le plus simple est de regrouper les
  classeurs dans une même instance Excel, ou de fermer les instances parasites.

## 5. Erreurs fréquentes

| Symptôme | Cause / correction |
|---|---|
| `Accès au projet VBA refusé` | Réglage de confiance non coché (§2). |
| `Aucune instance Excel en cours` | Ouvrir le classeur dans Excel, ou `--open`. |
| `Classeur introuvable` | Vérifier le nom via `list` ; instance multiple (§4). |
| `Échec de l'enregistrement` | Classeur en `.xlsx` : enregistrer en `.xlsm`. |
| Caractères accentués cassés | Le script lit le `--code-file` en UTF-8 (BOM toléré). Écrire le fichier temporaire en UTF-8. |
| `pywintypes.com_error` au démarrage | `pip install pywin32` puis, si besoin, `python Scripts/pywin32_postinstall.py -install`. |

## 6. Bonnes pratiques d'intégration Claude Code

- Placer le dossier `vba-agent/` dans les skills du projet
  (`<repo>/.claude/skills/vba-agent/`) ou globalement
  (`~/.claude/skills/vba-agent/`).
- Toujours `backup` avant la première écriture d'une session.
- Écrire le VBA dans un fichier temporaire (`%TEMP%`) puis le passer en
  `--code-file`, plutôt que de le coller en ligne de commande (évite les
  problèmes d'échappement et d'accents).
