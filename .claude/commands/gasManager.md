Génère l'artifact interactif **GAS Manager** pour piloter le projet Google Apps Script et Google Sheets via API REST.

Instructions :
1. Lis `.claude/gas-config.json` pour récupérer `scriptId`, `sheetId` et `deployId`
2. Génère un artifact HTML interactif avec 4 onglets :
   - **Script** : charger le code GAS existant (tous les fichiers .gs), éditer, enregistrer via `PUT /v1/projects/{scriptId}/content`
   - **Déploiement** : lister les déploiements, créer une nouvelle version (`POST .../versions`), redéployer (`PUT .../deployments/{deployId}`)
   - **Sheets** : lire une plage (`GET .../values/{range}`) et écrire dans des cellules (`PUT .../values/{range}?valueInputOption=USER_ENTERED`)
   - **Config** : afficher/modifier le token OAuth, les IDs, tester la connexion
3. Pré-remplir les champs scriptId, sheetId et deployId depuis gas-config.json
4. Rappeler à l'utilisateur que le token OAuth doit être généré sur https://developers.google.com/oauthplayground avec les scopes : `script.projects`, `spreadsheets`, `drive` (valide 1h)

Règles :
- Toutes les erreurs API (401, 403, 404…) doivent apparaître dans le journal de l'artifact
- Le token ne doit jamais être commité — l'artifact le garde uniquement en mémoire (état JS)
- Afficher un badge de statut (connecté / erreur / en attente) mis à jour après chaque appel API
