# Lessons Learned

| Date       | Ce qui s'est mal passé | Règle à suivre |
|------------|------------------------|----------------|
| 2026-06-05 | Modules `.bas` importés avec caractères garbled dans l'éditeur VBA | Ne jamais utiliser de caractères accentués (é, è, ê, à, etc.) dans les commentaires ou strings des fichiers `.bas`. Utiliser `ChrW()` pour tous les caractères non-ASCII au runtime. Encoder les fichiers en Windows-1252 (ANSI) si des accents sont indispensables. |
| 2026-06-05 | Inkscape CLI : flag `--export-filename` échoue silencieusement sans créer de PNG | Toujours utiliser `-o output.png input.svg` (flag court) à la place de `--export-filename`. |
| 2026-06-05 | Commandes Python via PowerShell backgroundées sans output capturé | Écrire le script dans un fichier temp, puis appeler `python fichier.py` avec la Bash tool + timeout 60000ms pour une exécution synchrone. |
| 2026-06-05 | Import VBA via win32com : le `.Name` du composant importé peut différer du `Attribute VB_Name` déclaré | Toujours forcer `comp.Name = vba_name` après l'import pour garantir le nom réel. |
| 2026-06-06 | Présentation d'un design UI trop technique (noms de classes CSS, `aria-label`, numéros de ligne) → réponse de l'utilisateur : « je ne comprends pas » | Pour présenter un design à l'utilisateur : montrer une maquette visuelle + langage simple, jamais de jargon code (classes CSS, attributs, lignes). Les détails d'implémentation vont dans la spec écrite, pas dans la discussion de design. |
| 2026-06-06 | Tendance à vouloir faire trancher une décision par des explications/raisonnements textuels, alors que c'est plus lent et moins clair | Pour DÉCIDER (surtout UI/UX), privilégier la preuve en image (maquette dans le compagnon visuel) et le brainstorming guidé plutôt que du texte. Le visuel et l'échange interactif sont souvent bien meilleurs pour décider — y recourir tôt, sans attendre un blocage. |
