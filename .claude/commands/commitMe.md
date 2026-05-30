Prépare et exécute le commit Git pour le projet suivi-conso-carburant, puis pousse vers le dépôt distant.

Étapes à suivre :

1. Lance `git -C "C:/Users/fdaub/Documents/Github/suivi-conso-carburant" status --porcelain` pour lister les fichiers modifiés
2. Lance `git -C "C:/Users/fdaub/Documents/Github/suivi-conso-carburant" diff HEAD` pour lire le contenu des changements
3. Lis la constante `APP_VERSION` dans `js/config.js` pour obtenir la version courante
4. Détermine le message de commit au format Conventional Commits :
   - type : feat / fix / style / docs / refactor / perf / chore
   - scope : nom du fichier principal modifié (app, style, readme, changelog, config…)
   - description : courte phrase en français résumant les changements
   - version entre crochets : [vX.Y.Z.W]
   - Exemple : `fix(app): correction enrichissement OSM recherche manuelle [v2.1.4.2]`
   - Si plusieurs fichiers de natures différentes : scope = fichier principal, ou `app,style` si les deux sont modifiés
5. Stage tous les fichiers modifiés : `git -C "C:/Users/fdaub/Documents/Github/suivi-conso-carburant" add -A`
6. Exécute le commit avec le message préparé
7. Affiche le résultat du commit (hash + message)
8. Pousse vers le dépôt distant : `git -C "C:/Users/fdaub/Documents/Github/suivi-conso-carburant" push`
9. Affiche le résultat du push

Règles :
- Toujours pusher automatiquement après le commit, sans demander confirmation
- Si aucun fichier modifié, l'indiquer et ne rien commiter
- Respecter le format CLAUDE.md : un seul commit groupant tous les fichiers
