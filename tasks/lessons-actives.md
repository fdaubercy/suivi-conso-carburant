<!-- lessons-actives source_lignes=136 date=2026-11-07 -->
# Leçons actives (détail dans lessons.md, par date)

## Version publiée, commit, déploiement
- Avant chaque `./commit.sh "... [vX.Y.Z.W]"`, éditer à la main `APP_VERSION` dans `js/config.js` (il pilote l'affichage ET le nom du cache du service worker) ; ensuite `grep Divergence` du log doit être vide (2026-10-11)
- Ne jamais rediriger ni tronquer (`| tail`) la sortie de `commit.sh` : relire ses avertissements, vérifier `git log -1` et `git status` (exit 0 trompeur) (2026-10-11)
- « commit » ne veut pas dire « push » : ne pousser que sur accord explicite (2026-06-15)
- Si `npm test` échoue sur des timeouts de workers forks avec 0 test en échec, c'est environnemental : committer via `git add` + `git commit` (hook lint-staged) sans boucler (2026-06-27)
- Une modif de `.gs` se redéploie automatiquement : `node gas-deploy.mjs --check`, `--diff`, puis déploiement, et bump de version dans `Code.gs` (2026-09-19)
- Un déploiement en production autre que ce redéploiement GAS demande une autorisation explicite par déploiement ; ne jamais contourner un refus du classifieur (2026-07-02)
- Ajout d'une API Google côté GAS : ajouter son scope dans `appsscript.json`, pousser en `--no-deploy`, faire autoriser dans l'éditeur, puis redéployer (2026-10-11)
- Remonter au client les échecs « non bloquants » du GAS au lieu de `Logger.log` seul (2026-10-11)
- Après rotation OAuth, un 403 « Accès refusé » en HTML = déploiement à ré-autoriser dans l'éditeur (`curl -sL` de l'URL pour diagnostiquer) (2026-06-30)
- Erreurs OAuth : `redirect_uri_mismatch` = URI à ajouter ; `invalid_client` = mauvaise paire id/secret ; `unauthorized_client` = refresh_token d'un autre client. Valider par `--check` sans afficher les valeurs (2026-06-28)
- Dépôt public : ne jamais mettre clé ou secret dans `js/config.js` ni dans l'historique ; avant de crier à la fuite, chercher les vraies valeurs (préfixe réel) avec `git grep` sur `git rev-list --all` (2026-06-28)
- Script de réparation de données : sauvegarde horodatée écrite uniquement par le run `--write`, jamais réécrite (2026-10-03)

## Graphify
- Avant `--update` : sauvegarder `graph.json` et noter le nombre de nœuds ; après, si le total chute, `git checkout HEAD -- graphify-out/` et ne pas committer le graphe amputé (2026-09-19)
- Les `.bas` et `.gs` ne sont pas détectés : documenter dans CHANGELOG/ROADMAP suffit pour un commit VBA/GAS seul (2026-07-03)

## Données et synchronisation
- Une donnée « disparue » : vérifier Sheet, Excel et localStorage de chaque appareil, ainsi que les filtres (véhicule courant), avant de restaurer (2026-10-03)
- Dates « jour » : côté GAS jamais `new Date('yyyy-mm-dd')` ; utiliser `Utilities.parseDate` avec le fuseau du classeur, colonne au format texte `@` ; côté client, `new Date(y, m-1, d)` (2026-10-03)
- Ne jamais re-parser un `CStr(date)` en VBA ; utiliser `CDate(cell.Value)` ; arrondir les bornes de chronologie au jour entier (2026-06-11)
- Une vue dérivée par formules positionnelles n'a qu'un seul écrivain ; exclure les cellules « graines » avant de recopier une formule de colonne (2026-10-03)
- Une sync différentielle ne se fie pas à une date de création fournie par le client : estampille serveur, ou liste des identifiants actifs (2026-10-11)
- Un calcul métier n'a qu'une implémentation (`statsParams.js`), importée par chaque vue, avec un test de parité ; écart app/Excel : comparer plein par plein (2026-10-11)
- KPI à 0 alors que les données existent : vérifier d'abord les en-têtes de colonnes et `ColIdx`, puis la ligne fantôme à la source ; restaurer les noms de colonnes et rafraîchir (2026-06-20)
- Vérifier le schéma réel (live) d'une requête Power Query, jamais supposer qu'il égale le `.m` du disque (2026-06-20)

## Excel et VBA : injection de code
- Écritures COM VBProject : une seule à la fois, bornées par un timeout large, jamais en parallèle ; ne jamais tuer Excel (2026-07-02)
- Après toute écriture : vérifier que le module n'est pas vide, la longueur, l'absence de doublons ; avoir un backup (2026-06-29)
- `set-module` / `AddFromString` : retirer toute ligne `Attribute VB_*` du code, vider le module avant d'écrire (sinon `Option Explicit` en double) ; écrire le fichier en binaire avec `\r\n` exacts (2026-06-30)
- `Import` : `.bas` canonique avec `Attribute VB_Name` en L1, converti en CP1252 (UTF-8 donne du mojibake) ; nouveaux modules en ASCII pur + `ChrW()` (2026-10-03)
- `set-module` qui hang ou `gen_py` : passer à `import`, ou à un script win32com en late-binding, jamais en boucle (2026-07-26)
- Remplacer un module : `Remove`, quitter le process, vérifier l'absence, puis `Import` dans un autre process (2026-07-02)
- Vérifier la compilation complète (`VBE.CommandBars.FindControl(Id:=578).Execute`) puis un `Application.Run` réel ; `ok:true` ne prouve rien (2026-10-11)
- Erreur -2146827284 sur toutes les macros : chercher d'abord une ligne `Attribute` parasite, un doublon, une erreur de portée ou de type ByRef (2026-06-28)
- Ne jamais nommer une variable comme un mot-clé, quelle que soit la casse (`dO`) (2026-10-11)
- Avant d'extraire des fonctions : lister toutes les déclarations de niveau module et contrôler les homonymes `Public` (2026-07-02)
- Un script COM qui touche `EnableEvents`, `ScreenUpdating` ou `Calculation` doit les restaurer ; s'il est tué, les remettre explicitement (2026-07-02)
- Les macros ne se testent que dans une instance ouverte normalement (macros actives) (2026-06-30)
- `wb.Save()` par COM est refusé en mode auto : demander Ctrl+S à l'utilisateur (2026-10-03)
- Python 3.13 par chemin complet pour tout appel COM ; le CLI est `~/.claude/skills/vba-agent/vba_agent.py` ; `--code-file` dans un chemin court ; `PYTHONIOENCODING=utf-8` pour `inspect` et vérifier `ok` (2026-07-02)

## Méthode de diagnostic
- Exiger d'abord le texte exact du dialogue d'erreur (2026-06-14)
- Lire le code réel et reproduire en conditions contrôlées (events OFF) avant d'inscrire un bug ; un item ROADMAP peut viser du code mort : vérifier ses consommateurs (2026-07-01)
- Reprise : `git status` et `git diff` d'abord, finaliser le travail déjà codé ; ne pas se fier au nom du zip ni au statut d'un sous-agent coupé (2026-07-02)
- Vérifier un rendu avec le vrai Chrome (`channel:'chrome'`), mesurer, confirmer le sens d'un symptôme ambigu (« zoomé »), comparer plusieurs tailles avant de déployer (2026-06-27)
- Aucun caractère de redirection (`>`, `<`, `|`) dans un message de commit (2026-06-11)
