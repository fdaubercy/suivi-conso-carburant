# CLAUDE.md — Suivi Conso Carburants

> **Noyau d'instructions** pour Claude Code (claude.ai/code). Découpé le **2026-06-21** : le détail de référence (architecture, UI, VBA, outils) vit désormais dans `docs/` et n'est lu **qu'à la demande** (pointeurs en texte, **pas** d'`@import`, pour alléger le démarrage).
> Ce fichier est prioritaire sur tout comportement implicite. **Les instructions explicites de l'utilisateur priment** sur ce fichier.

> 📎 **Documentation de référence (lire quand le travail le requiert)** :
> - `docs/ARCHITECTURE.md` — **AVANT toute modif de module** (modules JS, GAS, sync Excel↔GAS, identité U7, versioning, tests).
> - `docs/UI-WORKFLOW.md` — **AVANT tout travail d'UI** (charte `brand-perso`, flux maquette → code).
> - `docs/VBA.md` — **AVANT tout travail VBA / COM** sur le classeur Excel.
> - `docs/OUTILS.md` — délégation sous-agents, rapport d'avancée par étape, Ruflo, pouvoirs navigateur, pouvoirs API Google.

---

## 🗣️ Langue de travail — OBLIGATOIRE

- **Toujours communiquer en français** avec l'utilisateur : réponses, explications, points d'avancement, questions, diagnostics. **Ne jamais répondre en anglais**, même pour un point technique.
- Les identifiants de code et la syntaxe restent en anglais selon les conventions ; le **message de commit** suit le format du projet. Mais **tout échange en langage naturel avec l'utilisateur se fait en français.**

---

## 🖥️ Portée des règles strictes — session LOCALE uniquement

Les règles marquées **OBLIGATOIRE** ci-dessous — *Démarrage de chaque session*, *Graphify*, *Déclenchement des skills*, et le *gate pré-commit `/graphify --update`* — s'appliquent **uniquement en session LOCALE** (Claude Code local sous Windows, avec Excel + skills `graphify`/`superpowers` disponibles).

**En session remote/web** (claude.ai/code, environnement cloud) : ces règles deviennent **OPTIONNELLES**. Si une skill (`graphify`, `superpowers:*`) ou un outil (Excel/COM) n'est pas disponible, **continuer sans bloquer** — ne pas exiger `/graphify`, `brainstorming`, etc., et **ne pas bloquer le commit** sur `/graphify --update`.

> Heuristique : si les skills `graphify`/`superpowers` ne sont pas disponibles dans l'environnement, considérer la session comme **remote/web** → mode optionnel. La section **« 🗣️ Langue de travail » s'applique TOUJOURS** (local ET remote/web).

---

## 🚀 Démarrage de chaque session *(session locale — voir § Portée)*

> En remote/web : optionnel — ne pas bloquer si une skill/outil manque.

À faire **dans cet ordre**, avant tout autre travail :

1. **Lire `tasks/lessons.md`** (self-learning) et **résumer les règles actives** avant de commencer. S'il n'existe pas, le créer avec un en-tête vide.
2. **Charger la carte des connaissances** si elle existe :
   - `graphify-out/graph.json` → graphe principal (entités, relations, hyperedges)
   - `graphify-out/GRAPH_REPORT.md` → rapport (god nodes, communautés, questions)
   - `graphify-out/graph.html` → visualisation interactive
   - **Avant de lire un fichier source, interroger le graphe** pour cibler les nœuds pertinents et ne lire que le strict nécessaire.
   - Si la carte **n'existe pas**, la créer via la skill `graphify` dès que le projet est suffisamment exploré.
3. **Appliquer chaque règle de `tasks/lessons.md`** avant de toucher au code.

> ℹ️ Le bon chemin des artefacts Graphify est **`graphify-out/`** (et non `graphify/README.md`).

---

## 🔎 Graphify — carte des connaissances *(obligatoire en local ; optionnel en remote/web — voir § Portée)*

- Skill `graphify` (`~/.claude/skills/graphify/SKILL.md`) : transforme n'importe quelle entrée (code, docs, images, vidéos) en knowledge graph. Déclencheur : `/graphify` → invoquer la skill **avant toute autre action**.
- **Mise à jour de la carte** : `/graphify --update`
  - **en fin de chaque session de travail**, et
  - après **chaque feature / fix significatif** touchant l'architecture (nouvelles entités, relations, décisions).
  - **OBLIGATOIREMENT avant tout commit** (voir section Git ci-dessous).
- **Visualisation** : `graph.html` (navigateur), `GRAPH_REPORT.md` (lecture rapide sans navigateur), options `--obsidian`, `--svg`, `--graphml`, `--neo4j`.
- ⚠️ **Garde anti-amputation** (leçons #37/#44) : avant tout `--update` pré-commit, sauvegarder `graph.json` + noter le nombre de nœuds ; après, vérifier qu'il n'a pas chuté (un `--update`/`--force` **sans clé LLM** ampute les nœuds sémantiques). Si chute → `git checkout HEAD -- graphify-out/`. Ne pas committer un graphe amputé.

---

## 🎯 Déclenchement des skills (obligatoire en session locale ; optionnel en remote/web — voir § Portée)

- **Travail créatif / non trivial** (nouvelle fonctionnalité, changement d'UI, modification de comportement, refonte) → invoquer **`superpowers:brainstorming` AVANT d'écrire du code**.
- **Bug / test qui échoue / comportement inattendu** → **`superpowers:systematic-debugging`** d'abord.
- **Avant d'implémenter un plan validé** → **`superpowers:writing-plans`**.
- `/graphify` → skill `graphify` avant toute autre action.

> « Complexe » est un jugement : ces déclenchements sont des **règles de comportement** (ce fichier), pas des hooks `settings.json` (qui ne peuvent être que déterministes).

---

## 🧰 Commandes

```bash
npm run dev              # Serveur Vite local → http://localhost:5173/
npm run build            # Build Vite → dist/ (base /suivi-conso-carburant/)
npm run preview          # Prévisualise le build
npm test                 # Vitest (run once)
npm run test:coverage    # Vitest + couverture v8 → coverage/
npm run test:e2e         # Playwright E2E (Chromium headless)
npm run lint             # ESLint sur js/ — strict --max-warnings=0

./commit.sh "type(scope): description [vX.Y.Z.W]"
# Gate complet : version → lint → tests → git add -A → commit → pull --rebase → push
```
Le hook pre-commit (husky + lint-staged) passe `eslint + vitest related` sur les fichiers `js/` mis en scène.

---

## 🧠 Mode de travail

Avant toute modification :
1. Analyser le projet (s'appuyer sur le graphe Graphify ; consulter `docs/ARCHITECTURE.md`).
2. Identifier les fichiers impactés et leurs dépendances.
3. **Minimiser les changements** ; garantir la cohérence globale.

**Livraison du code :**
- Fournir **uniquement le code nécessaire**. Privilégier des **éditions ciblées** (outil Edit).
- Réécrire un fichier entier **uniquement** si la modification est massive/structurelle.
- **Jamais** de `...`, de troncature ou d'omission dans un fichier **réellement livré** (un fichier livré doit être complet et fonctionnel).

> Délégation aux sous-agents & rapport d'avancée par étape : voir `docs/OUTILS.md`. Ne jamais paralléliser deux écritures sur le même fichier.

---

## 📚 Documentation obligatoire

À chaque modification de code :
- **CHANGELOG.md** — obligatoire. Format :
  ```
  ## [X.Y.Z.W] — YYYY-MM-DD
  ### Added / Changed / Fixed / Removed
  ```
- **README.md** — mettre à jour si l'architecture, la config ou l'utilisation changent.
- **ROADMAP.md** — à chaque feature/fix : ajouter une ligne dans « ✅ Idées déjà implémentées » (`| vX.Y.Z.W | **Titre (Wxx)** — description |`) et retirer l'item des tableaux « à faire ». Le ROADMAP est la mémoire du projet.

---

## ⚙️ Git — commit en fin de réponse

### Pré-commit — OBLIGATOIRE (session locale uniquement — voir § Portée)
**En session locale** : INTERDICTION de commiter sans avoir exécuté `/graphify --update` au préalable (avec la garde anti-amputation ci-dessus).
**En session remote/web** : `/graphify --update` est optionnel — si la skill est indisponible, **sauter sans bloquer** le commit.
Ordre d'exécution avant tout commit :
1. `/graphify --update` *(local : obligatoire ; remote/web : si disponible, sinon sauter)*
2. MAJ README / CHANGELOG / ROADMAP
3. `./commit.sh "type(scope): description [vX.Y.Z.W]"`

À la fin de **chaque réponse ayant modifié du code**, fournir un bloc commit prêt :
```
─── COMMIT ──────────────────────────────────
./commit.sh "<type>(<scope>): <description> [vX.Y.Z.W]"
─────────────────────────────────────────────
```
- Format Conventional Commits ; **version entre crochets** à la fin.
- Types : `feat`, `fix`, `docs`, `refactor`, `perf`, `chore`. Scope = module principal (`app`, `style`, `config`, `osm`, `carte`…).
- Un seul commit par réponse (grouper tous les fichiers).
- **Commit + push automatiques validés** par l'utilisateur après MAJ README/CHANGELOG/ROADMAP — ne plus redemander confirmation.

---

## ⚡ Optimisation des réponses

- Aller à l'essentiel, densité d'information, pas de longues introductions, pas de répétitions.
- Code : pas de commentaires inutiles, ne pas expliquer l'évident.
- Ordre de réponse type : (1) résumé court → (2) fichiers modifiés → (3) code → (4) bloc commit.

---

## ❓ Questions & 💡 propositions

- **Avant de coder une fonctionnalité non triviale** : poser les questions nécessaires (choix technique, source de données, comportement, périmètre) **regroupées en une interaction**. Ne pas supposer. *(Pour le travail créatif, passer par `superpowers:brainstorming`.)*
- **Améliorations repérées en passant** : les **proposer** (sans implémenter d'office) et les **ajouter à `ROADMAP.md`** avec justification (`| Xnn | **Titre** : description | Bénéfice |`).

---

## 🔁 Self-learning (apprentissage des erreurs)

1. **Après chaque correction de l'utilisateur**, ajouter immédiatement une entrée dans `tasks/lessons.md` :
   ```
   [YYYY-MM-DD] | ce qui s'est mal passé | règle à suivre la prochaine fois
   ```
2. **En début de session**, lire `tasks/lessons.md` et résumer les règles actives.
3. **Append uniquement** — ne jamais supprimer d'entrées. Entrées concises, factuelles, actionnables.

---

## 🤝 Commandes déjà validées

| Action | Comportement |
|---|---|
| Commit + push Git | Automatique après MAJ README/CHANGELOG/ROADMAP, sans confirmation |
| MAJ CHANGELOG / README / ROADMAP | Obligatoire avant chaque commit, selon les changements |
| Incrémentation version X.Y.Z.W | Automatique selon les règles ci-dessus |

---

## ⚠️ Secrets — ne jamais committer

`SYNC_SECRET`, tokens OAuth Google, clés API privées. `GOOGLE_CLIENT_ID`, `APP_TOKEN` et clés Maps JS sont publics par nature (la protection est la restriction par domaine côté Google).

---

## 🔁 Reprise de session

Commande dédiée : `/reprise-session [chemin-export]`

- TOUJOURS utiliser cette commande pour reprendre le travail à partir de l'export d'une session précédente.
- Pour chaque demande utilisateur de l'export, déterminer le statut (✅ finalisée / 🔶 partielle / ❌ à faire) et le justifier par une PREUVE vérifiable (commit, fichier, sortie). INTERDICTION de classer "finalisée" sans preuve.
- TOUJOURS reprendre les actions interrompues en milieu d'exécution.
- TOUJOURS présenter le plan de reprise (tableau récapitulatif) et attendre validation avant d'exécuter les actions 🔶/❌, sauf en mode Auto.
- En fin de reprise : consigner les leçons dans `tasks/lessons.md` et générer un mini-export de fin de session.
