# Lessons Learned

| Date       | Ce qui s'est mal passé | Règle à suivre |
|------------|------------------------|----------------|
| 2026-06-05 | Modules `.bas` importés avec caractères garbled dans l'éditeur VBA | Ne jamais utiliser de caractères accentués (é, è, ê, à, etc.) dans les commentaires ou strings des fichiers `.bas`. Utiliser `ChrW()` pour tous les caractères non-ASCII au runtime. Encoder les fichiers en Windows-1252 (ANSI) si des accents sont indispensables. |
| 2026-06-05 | Inkscape CLI : flag `--export-filename` échoue silencieusement sans créer de PNG | Toujours utiliser `-o output.png input.svg` (flag court) à la place de `--export-filename`. |
| 2026-06-05 | Commandes Python via PowerShell backgroundées sans output capturé | Écrire le script dans un fichier temp, puis appeler `python fichier.py` avec la Bash tool + timeout 60000ms pour une exécution synchrone. |
| 2026-06-05 | Import VBA via win32com : le `.Name` du composant importé peut différer du `Attribute VB_Name` déclaré | Toujours forcer `comp.Name = vba_name` après l'import pour garantir le nom réel. |
