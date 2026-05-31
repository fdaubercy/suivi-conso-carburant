---
name: gas-api
description: >
  Expert des appels API REST Google Apps Script et Google Sheets.
  Déclencher dès que la réflexion ou les actions impliquent :
  - des appels HTTP directs à l'Apps Script API (v1/projects, v1/projects/.../content, versions, deployments)
  - des appels à la Sheets API (spreadsheets/.../values)
  - la gestion d'un token OAuth (génération, renouvellement, scopes)
  - le pilotage GAS sans passer par l'éditeur web ni clasp
  - l'artifact GAS Manager (interface interactive Claude)
  - la lecture/écriture de .claude/gas-config.json
  NE PAS confondre avec gas-sync.md qui couvre l'éditeur web script.google.com et clasp CLI.
---

# Google Apps Script — API REST Expert

## Vue d'ensemble

Cette skill couvre le pilotage **programmatique** de Google Apps Script et Google Sheets
via leurs APIs REST, sans interface graphique ni outil CLI.

Complémentaire de `gas-sync.md` (éditeur web + clasp) — les deux approches sont indépendantes.

---

## 1. Authentification OAuth

### Token temporaire (1h) — OAuth Playground

1. Aller sur https://developers.google.com/oauthplayground
2. Sélectionner les scopes :
   - `https://www.googleapis.com/auth/script.projects`
   - `https://www.googleapis.com/auth/spreadsheets`
   - `https://www.googleapis.com/auth/drive`
3. Cliquer **Authorize APIs** puis se connecter avec le compte Google propriétaire du script
4. Cliquer **Exchange authorization code for tokens**
5. Copier le champ **Access token** (commence par `ya29.`)

> ⚠️ Valable **1 heure**. Erreur 401 = token expiré → renouveler.

### Headers obligatoires pour chaque requête

```
Authorization: Bearer {accessToken}
Content-Type: application/json
```

---

## 2. Apps Script API — Endpoints

### Lire le projet et ses fichiers

```
GET https://script.googleapis.com/v1/projects/{scriptId}
→ Retourne titre, updateTime, scriptId

GET https://script.googleapis.com/v1/projects/{scriptId}/content
→ Retourne { files: [ { name, type, source } ] }
  type : "SERVER_JS" (.gs) ou "HTML" (.html)
```

### Mettre à jour le code

```
PUT https://script.googleapis.com/v1/projects/{scriptId}/content
Body: {
  "files": [
    { "name": "Code", "type": "SERVER_JS", "source": "function doGet() {...}" },
    { "name": "appsscript", "type": "JSON", "source": "{...}" }
  ]
}
⚠️ Stratégie obligatoire : charger TOUS les fichiers existants, modifier le fichier
   cible, renvoyer le tableau complet. Envoyer un tableau partiel écrase les autres fichiers.
```

### Créer une version (snapshot)

```
POST https://script.googleapis.com/v1/projects/{scriptId}/versions
Body: { "description": "Description de la version" }
→ Retourne { versionNumber, description, createTime }
```

### Lister les déploiements

```
GET https://script.googleapis.com/v1/projects/{scriptId}/deployments
→ Retourne { deployments: [ { deploymentId, deploymentConfig: { versionNumber, description } } ] }
```

### Mettre à jour un déploiement (redéployer)

```
PUT https://script.googleapis.com/v1/projects/{scriptId}/deployments/{deployId}
Body: {
  "deploymentConfig": {
    "versionNumber": 5,
    "manifestFileName": "appsscript",
    "description": "Description mise à jour"
  }
}
→ Toujours créer une version AVANT de redéployer
```

---

## 3. Sheets API — Endpoints

### Lire des cellules

```
GET https://sheets.googleapis.com/v4/spreadsheets/{sheetId}/values/{range}
Exemples de range : Sheet1!A1:D10   Feuille1!B2:B50   A:A
→ Retourne { values: [ ["val1","val2"], ["val3","val4"] ] }
→ Si plage vide : { } sans champ values — toujours vérifier avant d'itérer
```

### Écrire dans des cellules

```
PUT https://sheets.googleapis.com/v4/spreadsheets/{sheetId}/values/{range}?valueInputOption=USER_ENTERED
Body: {
  "range": "Sheet1!A1:C1",
  "majorDimension": "ROWS",
  "values": [ ["valeur1", "valeur2", "valeur3"] ]
}
→ USER_ENTERED : Google interprète les formules (=SUM...), dates, nombres
→ RAW : stocke le texte brut sans interprétation
→ Retourne { updatedRange, updatedRows, updatedColumns, updatedCells }
```

### Écrire plusieurs plages en une seule requête

```
POST https://sheets.googleapis.com/v4/spreadsheets/{sheetId}/values:batchUpdate
Body: {
  "valueInputOption": "USER_ENTERED",
  "data": [
    { "range": "Sheet1!A1", "values": [["val"]] },
    { "range": "Sheet1!B5", "values": [["val2"]] }
  ]
}
```

---

## 4. Paramètres du projet — gas-config.json

Fichier de référence : `.claude/gas-config.json`

| Clé | Description |
|-----|-------------|
| `scriptId` | ID du projet GAS (⚙️ Paramètres → ID du script) |
| `sheetId` | ID du Google Sheet (dans l'URL `/spreadsheets/d/{ID}/`) |
| `deployId` | ID du déploiement actif (Déployer → Gérer les déploiements) |
| `accessToken` | Placeholder — ne jamais stocker un token actif |

> ⚠️ Ce fichier est dans `.gitignore` — ne jamais le commiter avec un token actif.

---

## 5. Erreurs fréquentes

| Code | Cause | Solution |
|------|-------|----------|
| 401 | Token expiré ou invalide | Renouveler sur OAuth Playground |
| 403 | Scopes insuffisants | Vérifier les 3 scopes requis |
| 404 | scriptId ou deployId incorrect | Vérifier gas-config.json |
| 400 | Body malformé | Pour PUT /content : vérifier que TOUS les fichiers sont inclus |

---

## 6. Pattern complet — modifier et redéployer

```javascript
const BASE = 'https://script.googleapis.com/v1';
const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };

// 1. Charger les fichiers existants
const { files } = await fetch(`${BASE}/projects/${scriptId}/content`, { headers }).then(r => r.json());

// 2. Modifier le fichier cible
const idx = files.findIndex(f => f.name === 'Code');
files[idx].source = nouveauCode;

// 3. Sauvegarder
await fetch(`${BASE}/projects/${scriptId}/content`, {
  method: 'PUT', headers, body: JSON.stringify({ files })
});

// 4. Créer une version
const { versionNumber } = await fetch(`${BASE}/projects/${scriptId}/versions`, {
  method: 'POST', headers, body: JSON.stringify({ description: 'Mise à jour auto' })
}).then(r => r.json());

// 5. Redéployer
await fetch(`${BASE}/projects/${scriptId}/deployments/${deployId}`, {
  method: 'PUT', headers,
  body: JSON.stringify({
    deploymentConfig: { versionNumber, manifestFileName: 'appsscript', description: 'Mise à jour auto' }
  })
});
```

---

## 7. Artifact GAS Manager

L'artifact interactif **GAS Manager** est la façon recommandée d'utiliser cette skill
sans écrire de code. Pour le lancer : utiliser la commande `/gasManager`.

Fonctionnalités :
- Charger et éditer le code GAS dans un éditeur en ligne
- Sauvegarder, créer une version, redéployer en 1 clic
- Lire et écrire des cellules Google Sheets
- Journal des appels API avec statut et erreurs
