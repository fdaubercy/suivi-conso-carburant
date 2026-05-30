---
name: google-apps-script
description: >
  Expert Google Apps Script : création/modification de scripts (.gs, appsscript.json),
  configuration (déclencheurs, scopes OAuth, services avancés), publication et mise à jour
  de déploiements (Web App, API Executable), débogage et logs, synchronisation locale via
  clasp CLI et gestion GitHub.

  Déclencher dès que la réflexion ou les actions impliquent :
  - un fichier .gs, .html ou appsscript.json
  - un déploiement ou mise à jour sur script.google.com
  - l'utilisation de clasp (push, pull, deploy, clone, login)
  - des déclencheurs (triggers), scopes OAuth, ou services Google liés
  - la lecture de logs ou le débogage Apps Script
  - la synchro d'un projet Apps Script avec un dépôt GitHub local
  - une interface web ou automatisation via Google Sheets, Drive, Forms, Gmail
---

# Google Apps Script — Expert Skill

## Vue d'ensemble

Cette skill couvre deux axes complémentaires :

1. **Interface web** `script.google.com` — navigation dans l'éditeur en ligne, paramètres, déploiements
2. **Outillage local** `clasp` CLI + synchronisation GitHub — flux de travail professionnel avec versioning

Lire la section appropriée selon le contexte. Si une action n'est pas automatisable (ex. : authentification OAuth initiale, confirmation de déploiement), guider l'utilisateur étape par étape.

---

## 1. Structure d'un projet Apps Script

```
MonProjet/
├── appsscript.json        ← Manifeste : scopes, services avancés, webapp config
├── Code.gs                ← Script principal
├── utils.gs               ← Modules secondaires (optionnel)
├── index.html             ← Interface HTML si Web App (optionnel)
└── .clasp.json            ← Config clasp locale (scriptId, rootDir)
```

### appsscript.json minimal (Web App)
```json
{
  "timeZone": "Europe/Paris",
  "dependencies": {},
  "exceptionLogging": "STACKDRIVER",
  "runtimeVersion": "V8",
  "webapp": {
    "executeAs": "USER_ACCESSING",
    "access": "ANYONE_ANONYMOUS"
  },
  "oauthScopes": [
    "https://www.googleapis.com/auth/spreadsheets",
    "https://www.googleapis.com/auth/script.external_request"
  ]
}
```

---

## 2. Éditeur web — script.google.com

### 2.1 Créer ou modifier un script

**Création liée à un Google Sheet :**
1. Ouvrir le Google Sheet → menu **Extensions** → **Apps Script**
2. L'éditeur s'ouvre avec `Code.gs` vide

**Création autonome (projet standalone) :**
1. Aller sur [script.google.com](https://script.google.com) → **Nouveau projet**
2. Renommer le projet (coin supérieur gauche)

**Ajouter un fichier .gs ou .html :**
- Clic **+** dans le panneau gauche → choisir *Script* ou *HTML*

**Modifier appsscript.json :**
- Menu ⚙️ **Paramètres du projet** → cocher **Afficher le fichier manifeste « appsscript.json »**
- Le fichier apparaît dans le panneau de navigation

### 2.2 Configurer les scopes OAuth

Deux méthodes :
- **Automatique** : Apps Script détecte les services utilisés dans le code
- **Manuel (recommandé)** : déclarer explicitement dans `appsscript.json` → champ `oauthScopes`

Scopes fréquents :
| Service | Scope |
|---------|-------|
| Sheets (lecture/écriture) | `https://www.googleapis.com/auth/spreadsheets` |
| Drive | `https://www.googleapis.com/auth/drive` |
| Requêtes externes (UrlFetch) | `https://www.googleapis.com/auth/script.external_request` |
| Gmail | `https://www.googleapis.com/auth/gmail.send` |
| Exécution de scripts via API | `https://www.googleapis.com/auth/script.external_request` |

### 2.3 Activer les services avancés

1. Panneau gauche → **Services** (icône +)
2. Sélectionner le service (ex. : *Sheets API*, *Drive API*)
3. Cliquer **Ajouter**
4. Le service apparaît dans `appsscript.json` sous `dependencies.enabledAdvancedServices`

> ⚠️ Certains services nécessitent aussi d'être activés dans **Google Cloud Console** (même projet Cloud).

### 2.4 Configurer les déclencheurs (Triggers)

1. Menu gauche → icône ⏰ **Déclencheurs**
2. **+ Ajouter un déclencheur** (coin inférieur droit)
3. Configurer :
   - Fonction à exécuter
   - Type d'événement : temporel (`minutely`, `hourly`, `daily`, `weekly`) ou événement (`onOpen`, `onEdit`, `onChange`, `onFormSubmit`)
   - Notification d'échec (email recommandé)

### 2.5 Associer un projet Cloud

1. ⚙️ **Paramètres du projet** → section *Projet Google Cloud Platform*
2. Renseigner le **numéro de projet** GCP
3. Cliquer **Définir le projet** → autoriser

---

## 3. Déploiements

### 3.1 Créer un déploiement (Web App ou API Executable)

1. Bouton **Déployer** (coin supérieur droit) → **Nouveau déploiement**
2. Cliquer ⚙️ à côté de *Sélectionner le type* → choisir :
   - **Application Web** : expose `doGet(e)` / `doPost(e)` via URL publique
   - **API Exécutable** : permet l'appel depuis une app externe via OAuth
3. Remplir :
   - Description (ex. : `v1.0 - initial`)
   - **Exécuter en tant que** : `Moi` (compte propriétaire) ou `Utilisateur accédant à l'application`
   - **Accès** : `Moi seul`, `Tous les utilisateurs Google`, `Tout le monde` (anonyme)
4. **Déployer** → copier l'**URL de déploiement** (Web App) ou l'**ID de déploiement** (API)

### 3.2 Mettre à jour un déploiement existant

> ⚠️ **Important** : chaque déploiement est immutable (snapshot du code). Pour mettre à jour sans changer l'URL :

1. **Déployer** → **Gérer les déploiements**
2. Sur le déploiement actif → icône ✏️ (modifier)
3. Dans **Version** : sélectionner **Nouvelle version**
4. Ajouter une description de la mise à jour
5. **Déployer** → l'URL reste identique, le code est mis à jour

### 3.3 Tester sans déployer

- Utiliser **Déploiement de test** : le script tourne avec la version sauvegardée en cours (HEAD), sans créer de version officielle
- URL de test : toujours accessible, toujours à jour avec les dernières sauvegardes

---

## 4. Débogage et logs

### 4.1 Logs en temps réel (console)

Dans le code :
```javascript
console.log("Valeur :", maVariable);
Logger.log("Ancien style (aussi valide)");
```

Lire les logs :
- **Menu Exécution** → **Journaux** (après exécution manuelle)
- Ou : panneau gauche → **Exécutions** → cliquer une exécution → voir les logs

### 4.2 Stackdriver / Cloud Logging

Activé automatiquement si `"exceptionLogging": "STACKDRIVER"` dans `appsscript.json`.

Accès :
- ⚙️ Paramètres du projet → lien **Journaux Cloud** (ouvre Google Cloud Console)
- Ou : [console.cloud.google.com](https://console.cloud.google.com) → **Logging** → filtrer par projet

### 4.3 Déboguer une fonction

1. Placer le curseur dans la fonction cible
2. Icône 🐛 **Déboguer** (ou Ctrl+Shift+I)
3. Utiliser les points d'arrêt dans la marge gauche de l'éditeur
4. Inspecter les variables dans le panneau de débogage

### 4.4 Erreurs fréquentes

| Erreur | Cause probable | Solution |
|--------|---------------|----------|
| `Exception: You do not have permission` | Scope manquant | Ajouter scope dans `appsscript.json` |
| `Exceeded maximum execution time` | Script > 6 min | Découper en lots, utiliser ContinuationToken |
| `Service invoked too many times` | Quota dépassé | Ajouter `Utilities.sleep()`, réduire la fréquence |
| `TypeError: Cannot read property` | Valeur null/undefined | Ajouter vérification `if (val != null)` |

---

## 5. Clasp CLI — flux local

### 5.1 Installation et authentification

```bash
npm install -g @google/clasp
clasp login                    # Ouvre le navigateur pour OAuth Google
clasp login --creds creds.json # Avec fichier de credentials GCP (service account)
```

### 5.2 Lier un projet existant

```bash
# Depuis un répertoire local vide
clasp clone <scriptId>
# Le scriptId se trouve dans : ⚙️ Paramètres du projet → ID du script
```

Génère `.clasp.json` :
```json
{
  "scriptId": "1BxA...xyz",
  "rootDir": "./src"
}
```

### 5.3 Créer un nouveau projet

```bash
clasp create --title "MonProjet" --type standalone
# Types : standalone | sheets | docs | forms | slides | webapp | api
```

### 5.4 Synchronisation

```bash
clasp pull          # Télécharger la version distante → local
clasp push          # Envoyer les fichiers locaux → Apps Script
clasp push --watch  # Mode watch : push automatique à chaque modification
```

> ⚠️ `clasp push` écrase le contenu distant. Toujours `pull` avant de modifier si des changements ont été faits en ligne.

### 5.5 Versions et déploiements via clasp

```bash
clasp version "Description de la version"           # Créer une version
clasp versions                                        # Lister les versions

clasp deploy --versionNumber 3 --description "v2.0" # Déployer une version
clasp deployments                                     # Lister les déploiements
clasp undeploy <deploymentId>                         # Retirer un déploiement
```

### 5.6 Logs via clasp

```bash
clasp logs              # Afficher les logs Stackdriver en temps réel
clasp logs --open       # Ouvrir dans le navigateur (Cloud Console)
```

---

## 6. Intégration GitHub

### 6.1 Structure recommandée du dépôt

```
mon-projet-gas/
├── src/
│   ├── Code.gs
│   ├── appsscript.json
│   └── index.html
├── .clasp.json          ← NE PAS committer si scriptId est sensible
├── .gitignore
└── README.md
```

### .gitignore recommandé
```
.clasp.json
node_modules/
*.log
```

### 6.2 Flux de travail Git + clasp

```bash
# 1. Récupérer les modifications distantes (Apps Script)
clasp pull

# 2. Committer les changements
git add src/
git commit -m "feat: mise à jour du handler doPost"
git push origin main

# 3. Déployer une nouvelle version
clasp version "feat: mise à jour doPost"
clasp deploy --versionNumber <N> --description "Mise à jour production"
```

### 6.3 Synchronisation depuis une copie GitHub (clone)

```bash
git clone https://github.com/user/mon-projet-gas.git
cd mon-projet-gas
# Restaurer .clasp.json avec le bon scriptId
echo '{"scriptId":"1BxA...xyz","rootDir":"./src"}' > .clasp.json
clasp push
```

---

## 7. Bonnes pratiques

- **Toujours versionner** avant un déploiement de production (`clasp version` ou via l'éditeur)
- **Tester avec le déploiement de test** avant de mettre à jour le déploiement officiel
- **Expliciter les scopes** dans `appsscript.json` plutôt que de les laisser en détection automatique
- **Limiter le scope** au minimum nécessaire (principe du moindre privilège)
- **Séparer les environnements** : utiliser deux scriptId distincts pour dev et prod
- **Nommer les déploiements** avec une description claire (date + feature)
- **Logger systématiquement** avec `console.log` en dev, désactiver ou alléger en prod

---

## 8. Référence rapide — IDs importants

| Élément | Où le trouver |
|---------|--------------|
| Script ID | ⚙️ Paramètres du projet → *ID du script* |
| Deployment ID | Déployer → Gérer les déploiements → colonne ID |
| Web App URL | Déployer → Gérer les déploiements → lien URL |
| Projet GCP | ⚙️ Paramètres du projet → *Numéro de projet GCP* |
