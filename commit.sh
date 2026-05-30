#!/usr/bin/env bash
#
# commit.sh — add + lint + tests + commit + pull --rebase + push
#
# Usage :
#   ./commit.sh "feat(scope): description [vX.Y.Z.W]"
#
# Étapes :
#   1. Vérifie qu'un message de commit est fourni
#   2. Vérifie qu'il y a des changements à committer
#   3. Lance ESLint  (npm run lint)      — abandonne si erreurs
#   4. Lance les tests (npm test, vitest) — abandonne si échec
#   5. git add -A
#   6. git commit -m "<message>"
#   7. git pull --rebase origin <branche>
#   8. git push origin <branche>
#
set -euo pipefail

# --- Se placer à la racine du dépôt (emplacement du script) ---
cd "$(dirname "$0")"

# --- 1. Message de commit obligatoire ---
MSG="${1:-}"
if [ -z "$MSG" ]; then
  echo "❌ Message de commit manquant."
  echo "   Usage : ./commit.sh \"feat(scope): description [vX.Y.Z.W]\""
  exit 1
fi

# --- 2. Y a-t-il quelque chose à committer ? ---
if [ -z "$(git status --porcelain)" ]; then
  echo "ℹ️  Aucun changement à committer. Abandon."
  exit 0
fi

# --- 3. Lint ---
echo "🔍 ESLint…"
npm run lint

# --- 4. Tests unitaires ---
echo "🧪 Tests (vitest)…"
npm test

# --- 5. Add ---
echo "➕ git add -A…"
git add -A

# --- 6. Commit ---
echo "📝 git commit…"
git commit -m "$MSG"

# --- 7. & 8. Synchro origin puis push ---
BRANCH="$(git rev-parse --abbrev-ref HEAD)"
echo "⬇️  git pull --rebase origin $BRANCH…"
git pull --rebase origin "$BRANCH"
echo "⬆️  git push origin $BRANCH…"
git push origin "$BRANCH"

echo "✅ Terminé : $MSG"
