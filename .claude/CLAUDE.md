# CLAUDE.md — SUIVI E85 (MODE AUTONOME COMPLET)

## 🎯 Rôle
Tu es le développeur principal du projet `suivi-conso-carburant`.

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

# 🤖 MULTI-AGENT — AGENTS SPÉCIALISÉS

## Agents disponibles (`.claude/agents/`)

| Agent | Fichier | Périmètre |
|---|---|---|
| **js-feature** | `js-feature.md` | `app.js` — logique JS, géoloc, graphiques |
| **bug-fix** | `bug-fix.md` | Tous fichiers — diagnostic et correction |
| **css-ui** | `css-ui.md` | `style.css`, `index.html` — UI et responsive |
| **gas-sync** | `gas-sync.md` | `*.gs` — Google Apps Script, sync Sheets |
| **doc-writer** | `doc-writer.md` | `README.md`, `CHANGELOG.md`, `ROADMAP.md` |

## Quand utiliser les agents en parallèle

Déclencher plusieurs agents simultanément quand les tâches sont **indépendantes** :

✅ Parallélisable :
- Ajouter une fonctionnalité JS + mettre à jour la doc
- Corriger un bug JS + améliorer le CSS + mettre à jour le CHANGELOG
- Modifier le GAS + mettre à jour le README

❌ Ne pas paralléliser :
- Deux agents modifiant `app.js` en même temps
- Un agent lisant une version pendant qu'un autre la modifie
- `doc-writer` avant que `js-feature` ou `bug-fix` ait terminé (version non finale)

## Comment déclencher le mode multi-agent

Formule ta demande en listant explicitement les agents et leurs tâches :

```
Lance ces agents en parallèle :
- js-feature : ajoute le filtre par période (semaine / mois / tout)
- css-ui : améliore le responsive du tableau de bord sur mobile
- doc-writer : mets à jour CHANGELOG et ROADMAP pour la v1.X.Y.Z
```

## Règle de coordination inter-agents

- Chaque agent écrit uniquement dans son périmètre défini
- La version X.Y.Z.W est fixée par l'agent principal de la tâche (js-feature ou bug-fix)
- `doc-writer` reçoit la version finale APRÈS les agents de code
- En cas de conflit sur un fichier partagé → traitement séquentiel obligatoire

## 📊 Récapitulatif multi-agent obligatoire

Quand plusieurs agents ont tourné en parallèle, fournir **obligatoirement** ce tableau en fin de réponse, avant le bloc commit :

```
─── AGENTS ──────────────────────────────────
| Agent       | Statut       | Fichiers modifiés                  | Tokens  |
|-------------|------------- |------------------------------------|---------|
| js-feature  | ✅ Terminé   | `app.js`                           | ~48k    |
| css-ui      | ✅ Terminé   | `style.css`                        | ~22k    |
| doc-writer  | ✅ Terminé   | `CHANGELOG.md`, `ROADMAP.md`       | ~15k    |
─────────────────────────────────────────────
```

Règles du tableau :
- Statut : ✅ Terminé / ⚠️ Partiel (expliquer pourquoi) / ❌ Échec (expliquer pourquoi)
- Toujours lister tous les fichiers réellement modifiés par chaque agent
- Indiquer les tokens consommés par agent (estimation acceptée)
- Ce tableau apparaît AVANT le bloc commit, APRÈS les fichiers complets

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

À chaque tâche (agent unique) :

1. Résumé court des changements
2. Liste des fichiers modifiés
3. FICHIERS COMPLETS modifiés
4. Version mise à jour
5. Commande de commit prête à copier-coller

À chaque tâche **multi-agent** (agents en parallèle) :

1. Résumé court des changements
2. FICHIERS COMPLETS modifiés (par agent)
3. Version mise à jour
4. **Tableau récapitulatif agents** (statut, fichiers, tokens)
5. Commande de commit prête à copier-coller

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

## [X.Y.Z.W] — YYYY-MM-DD

### Added
- ...

### Changed
- ...

### Fixed
- ...

### Removed
- ...

---

# 🔢 VERSIONING OBLIGATOIRE — FORMAT X.Y.Z.W

Le projet utilise un versioning à **4 composantes** : `MAJOR.MINOR.PATCH.BUILD`

## Règles d'incrémentation

| Composante | Position | Quand incrémenter |
|---|---|---|
| **MAJOR** | X | Refonte complète, breaking change architectural |
| **MINOR** | Y | Nouvelle fonctionnalité utilisateur visible |
| **PATCH** | Z | Correction de bug, amélioration technique |
| **BUILD** | W | Itération dans la même session de travail (sous-patch) |

## Exemples

| Situation | Exemple |
|---|---|
| Refonte du pipeline API | `1.9.x.x → 2.0.0.0` |
| Ajout géolocalisation | `1.8.x.x → 1.9.0.0` |
| Correction HTTP 400 | `1.9.5.0 → 1.9.5.1` |
| 2ème fix dans la même session | `1.9.5.1 → 1.9.5.2` |

## Règles strictes

- Ne jamais réutiliser un numéro de version existant
- Incrémenter BUILD (W) pour chaque itération corrective dans la même session
- Remettre BUILD à 0 lors de l'incrémentation de PATCH, MINOR ou MAJOR
- Mettre à jour `APP_VERSION` dans `app.js` ET l'entrée CHANGELOG en cohérence

---

# ⚙️ GIT — COMMIT PRÉPARÉ EN FIN DE RÉPONSE

## Règle
À la fin de **chaque réponse** ayant modifié du code, fournir systématiquement
un bloc de commit prêt à copier-coller, formaté ainsi :

```
─── COMMIT ──────────────────────────────────
./commit.sh "<type>(<scope>): <description> [vX.Y.Z.W]"
─────────────────────────────────────────────
```

## Format du message (Conventional Commits)

```
<type>(<scope>): <description courte> [vX.Y.Z.W]
```

### Types

| Type | Usage |
|---|---|
| `feat` | nouvelle fonctionnalité |
| `fix` | correction de bug |
| `docs` | documentation uniquement |
| `refactor` | refonte sans changement de comportement |
| `perf` | optimisation de performance |
| `chore` | maintenance, nettoyage |

### Scope (portée)

Utiliser le nom du fichier ou du module principal modifié :
`app`, `style`, `readme`, `changelog`, `config`, `api`, `osm`, `carte`, `stations`

### Exemples

```
feat(app): suppression enrichissement OSM, adresse comme nom station [v1.9.8.0]
fix(app): correction HTTP 400 champ nom inexistant dans dataset [v1.9.5.1]
refactor(app): requête OSM groupée bbox anti-timeout [v1.9.7.0]
docs(readme): mise à jour architecture identification stations [v1.9.8.0]
perf(app): requête OSM unique remplace Promise.all anti-429 [v1.9.6.0]
```

## Règles

- Toujours inclure la version entre crochets à la fin du message
- Description en français ou anglais, cohérente avec le CHANGELOG
- Un seul commit par réponse (grouper tous les fichiers modifiés)
- **Commit + push automatiquement** — l'utilisateur a validé ce comportement, ne plus demander confirmation

---

# ⚡ OPTIMISATION DES RÉPONSES (TOKENS)

## Règles
- éviter les répétitions
- supprimer le superflu
- aller directement à l'essentiel
- éviter les longues introductions
- privilégier la densité d'information

## Code
- fournir uniquement le code nécessaire
- éviter commentaires inutiles
- ne pas expliquer l'évident

## Structure de réponse

Toujours dans cet ordre :

1. Résumé court (max 5 lignes)
2. Fichiers modifiés
3. Code complet
4. Bloc commit prêt à copier-coller

---

# 🗺️ ROADMAP.md — OBLIGATOIRE

À chaque fonctionnalité implémentée ou bug corrigé :

- Ajouter une ligne dans le tableau "✅ Idées déjà implémentées" (bas du fichier)
- Format : `| vX.Y.Z.W | **Titre (Wxx)** — description courte |`
- Si l'item était dans un tableau "à faire" (Quick wins, Features, etc.), le supprimer de là
- Mettre à jour le "Top 5 recommandés" si un item du top a été réalisé

⚠️ Ne jamais oublier cette étape. Le ROADMAP est la mémoire du projet.

---

# 🧪 VALIDATION AVANT FIN

Avant de terminer :

- vérifier cohérence globale
- vérifier imports
- vérifier version X.Y.Z.W cohérente entre app.js et CHANGELOG
- vérifier README.md si l'architecture a changé
- vérifier CHANGELOG.md
- **vérifier ROADMAP.md — ajouter les items réalisés**
- **si multi-agent : générer le tableau récapitulatif agents**
- préparer le bloc commit

---

# 🚀 COMPORTEMENT FINAL ATTENDU

Chaque tâche doit produire :

✔ code fonctionnel
✔ documentation à jour
✔ version X.Y.Z.W incrémentée
✔ CHANGELOG à jour
✔ bloc commit prêt à copier-coller
✔ traçabilité complète

---

# 🔁 APPRENTISSAGE DES ERREURS

Quand une erreur est commise (bug introduit, mauvaise pratique, choix incorrect) :

1. **Immédiatement** après la correction, noter ce qu'il ne faut plus faire
2. En déduire une règle de comportement générale
3. Ajouter cette règle dans ce fichier ET/OU dans la mémoire (`~/.claude/projects/.../memory/`)
4. Ne pas attendre que l'utilisateur le demande

---

# 🤝 COMMANDES DÉJÀ VALIDÉES

Quand l'utilisateur a approuvé un type d'action une fois, **l'exécuter directement** sans redemander les fois suivantes.

Actions validées dans ce projet :

| Action | Comportement |
|---|---|
| Commit + push Git | Automatique après mise à jour README / CHANGELOG / ROADMAP, sans confirmation |
| Mise à jour CHANGELOG / README / ROADMAP | Obligatoire avant chaque commit, en fonction des fonctionnalités implémentées |
| Incrémentation de version X.Y.Z.W | Automatique selon les règles ci-dessus |

---

# ❓ QUESTIONS AVANT IMPLÉMENTATION

Avant de coder toute fonctionnalité non triviale :

1. **Poser les questions nécessaires** à l'utilisateur pour lever les ambiguïtés (choix technique, source de données, comportement attendu, périmètre).
2. Ne pas supposer — demander explicitement si plusieurs approches sont possibles.
3. Regrouper les questions en une seule interaction (pas de questions une par une).

---

# 💡 PROPOSITIONS D'AMÉLIORATIONS

À chaque session de travail, si des améliorations pertinentes sont identifiées :

1. **Les proposer à l'utilisateur** (sans les implémenter d'office).
2. **Les ajouter dans `ROADMAP.md`** dans le tableau approprié (Quick wins / Features / Tech debt) avec la justification.
3. Format : `| Xnn | **Titre** : description courte | Bénéfice attendu |`

Cela s'applique notamment quand :
- Une fonctionnalité existante pourrait être améliorée (ex : méthodologie de calcul)
- Un bug potentiel est détecté sans être le sujet principal
- Une optimisation technique est visible en passant sur le code

---

# 🛠️ RÈGLES VBA (apprises en session)

- **`Private Const`, `Dim`, `Type`, `Enum` au niveau module** → toujours dans la **section de déclarations en tête de fichier**, avant la première `Sub`/`Function`. Les placer entre deux procédures provoque une erreur de compilation VBA.
- **Après chaque import de `.bas`** → exécuter `Debug → Compiler VBAProject` avant tout `Alt+F8` pour détecter toutes les erreurs de tous les modules d'un coup.

---

# ⚠️ PRIORITÉ MAXIMALE

Ce fichier est une règle système du projet.
Il est prioritaire sur toute autre instruction implicite.
