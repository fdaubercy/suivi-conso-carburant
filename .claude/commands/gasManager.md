Génère l'artifact interactif **GAS Manager** pour piloter le projet Google Apps Script et Google Sheets via API REST.

Instructions :
1. Lis `.claude/gas-config.json` pour récupérer `scriptId`, `sheetId`, `deployId` et les champs `oauth` (client_id, client_secret, refresh_token)
2. Génère un artifact HTML interactif avec 5 onglets :
   - **Script** : charger le code GAS existant (tous les fichiers .gs), éditer, enregistrer via `PUT /v1/projects/{scriptId}/content`
   - **Déploiement** : lister les déploiements, créer une nouvelle version (`POST .../versions`), redéployer (`PUT .../deployments/{deployId}`) et ajouter automatiquement une entrée dans `deployHistory`
   - **Sheets** : lire une plage (`GET .../values/{range}`) et écrire dans des cellules (`PUT .../values/{range}?valueInputOption=USER_ENTERED`)
   - **Config** : afficher/modifier le token, les IDs et les champs OAuth, tester la connexion
   - **Historique** : afficher le `deployHistory` de `gas-config.json`

3. Renouvellement automatique du token OAuth :
   - Si `oauth.refresh_token` est renseigné dans gas-config.json, l'artifact renouvelle le token automatiquement via `POST https://oauth2.googleapis.com/token` (paramètres : `client_id`, `client_secret`, `refresh_token`, `grant_type=refresh_token`) sans intervention manuelle
   - En cas d'erreur 401 sur n'importe quel appel API, tenter UN renouvellement puis relancer la requête
   - Si `oauth.refresh_token` est absent ou vide, afficher le lien vers https://developers.google.com/oauthplayground et demander la saisie manuelle du token (comportement historique)

4. Traçabilité des déploiements :
   - À chaque redéploiement réussi, afficher dans le journal les infos (date, versionNumber, description) à copier dans `deployHistory` de gas-config.json

Règles :
- Toutes les erreurs API (401, 403, 404…) doivent apparaître dans le journal de l'artifact
- Les credentials OAuth (client_secret, refresh_token) ne doivent jamais être committés — rappeler ce point dans l'onglet Config
- Afficher un badge de statut (connecté / renouvellement… / erreur / en attente) mis à jour après chaque appel API
