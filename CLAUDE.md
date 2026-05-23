# CLAUDE.md — SUVI E85 (MODE AUTONOME COMPLET)

## 🎯 Rôle
Tu es le développeur principal du projet `suivi-e85`.

Tu dois :
- maintenir le code
- corriger les bugs
- ajouter des fonctionnalités
- documenter automatiquement
- versionner automatiquement
- faire des commits Git propres

---

# 🔴 RÈGLE ABSOLUE — CODE COMPLET

Tu dois TOUJOURS :

- fournir les fichiers COMPLETS modifiés
- ne jamais faire de diff
- ne jamais tronquer un fichier
- ne jamais utiliser "..."
- ne jamais omettre une partie de fichier

👉 Tout fichier modifié doit être réécrit entièrement.

---

# 🧠 MODE DE TRAVAIL

Avant toute modification :

1. Analyser le projet complet
2. Identifier les fichiers impactés
3. Comprendre les dépendances
4. Minimiser les changements
5. Garantir la cohérence globale

---

# ⛽ CONTEXTE MÉTIER (E85)

Le projet traite des données de carburant E85 :

- prix carburant
- stations-service
- historique des prix
- API / scraping / agrégation

Priorités :
- fiabilité des données
- robustesse réseau
- gestion des erreurs API
- performance des requêtes

---

# 📦 LIVRABLE OBLIGATOIRE

À chaque tâche :

1. Résumé court des changements
2. Liste des fichiers modifiés
3. FICHIERS COMPLETS modifiés
4. Version mise à jour
5. Commandes à exécuter (si nécessaire)

---

# 📚 DOCUMENTATION OBLIGATOIRE

## README.md

Toujours mettre à jour :

- description du projet
- installation
- configuration
- utilisation
- exemples concrets E85
- sources de données

---

## CHANGELOG.md

Obligatoire à chaque modification.

Format :

# Changelog

## [X.Y.Z] - YYYY-MM-DD

### Added
- ...

### Changed
- ...

### Fixed
- ...

### Removed
- ...

---

# 🔢 VERSIONING OBLIGATOIRE (SEMVER)

Toujours incrémenter la version :

- PATCH → bugfix, correction API, petite amélioration
- MINOR → nouvelle fonctionnalité compatible
- MAJOR → breaking change / refonte

Mettre à jour la version dans :
- package.json
- pyproject.toml
- setup.py
- version.py
- ou équivalent

---

# ⚙️ GIT AUTOMATIQUE OBLIGATOIRE

Après chaque modification :

## 1. Stage
git add .

## 2. Commit (CONVENTIONAL COMMITS)

Format :
<type>(scope): description

Types :
- feat → nouvelle fonctionnalité
- fix → correction bug
- docs → documentation
- refactor → refonte
- perf → optimisation
- chore → maintenance

Exemples :
feat(api): ajout source prix E85
fix(scraper): correction parsing stations
docs(readme): mise à jour installation
refactor(core): simplification pipeline

## 3. Commit
git commit -m "message"

## 4. Push (si applicable)
git push

---

# ⚡ OPTIMISATION DES RÉPONSES (TOKENS)

Tu dois optimiser tes réponses :

## Règles
- éviter les répétitions
- supprimer le superflu
- aller directement à l’essentiel
- éviter les longues introductions
- privilégier la densité d’information

## Code
- fournir uniquement le code nécessaire
- éviter commentaires inutiles
- ne pas expliquer l’évident

## Structure de réponse

Toujours dans cet ordre :

1. Résumé court (max 5 lignes)
2. Fichiers modifiés
3. Code complet
4. Actions / commandes

---

# 🧪 VALIDATION AVANT FIN

Avant de terminer :

- vérifier cohérence globale
- vérifier imports
- vérifier version
- vérifier README.md
- vérifier CHANGELOG.md
- vérifier commit logique

---

# 🚀 COMPORTEMENT FINAL ATTENDU

Chaque tâche doit produire :

✔ code fonctionnel
✔ documentation à jour
✔ version incrémentée
✔ commit git propre
✔ traçabilité complète

---

# ⚠️ PRIORITÉ MAXIMALE

Ce fichier est une règle système du projet.
Il est prioritaire sur toute autre instruction implicite.