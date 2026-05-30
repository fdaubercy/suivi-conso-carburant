#!/usr/bin/env bash
#
# commit.sh — sync version + add + lint + tests + commit + pull --rebase + push
#
# Usage :
#   ./commit.sh "feat(scope): description [vX.Y.Z.W]"
#
# Étapes :
#   1. Vérifie qu'un message de commit est fourni
#   2. Vérifie qu'il y a des changements à committer
#   3. Synchronise la version (T9) : si le message contient [vX.Y.Z.W],
#      avertit si APP_VERSION (js/config.js) diverge et aligne package.json
#   4. Lance ESLint  (npm run lint)       — abandonne si erreurs/warnings
#   5. Lance les tests (npm test, vitest) — abandonne si échec
#   6. git add -A
#   7. git commit -m "<message>"          (déclenche le hook pre-commit husky)
#   8. git pull --rebase origin <branche>
#   9. git push origin <branche>
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

# --- 3. Synchronisation de version (si [vX.Y.Z.W] présent dans le message) ---
VER="$(printf '%s' "$MSG" | grep -oE 'v[0-9]+\.[0-9]+\.[0-9]+\.[0-9]+' | head -1 | sed 's/^v//' || true)"
if [ -n "$VER" ]; then
  echo "🔢 Version détectée : $VER"

  # APP_VERSION de js/config.js = source de vérité (éditée à la main)
  CFG_VER="$(grep -oE "APP_VERSION[^']*'[0-9]+\.[0-9]+\.[0-9]+\.[0-9]+'" js/config.js \
             | grep -oE '[0-9]+\.[0-9]+\.[0-9]+\.[0-9]+' | head -1 || true)"
  if [ -n "$CFG_VER" ] && [ "$CFG_VER" != "$VER" ]; then
    echo "⚠️  Divergence : APP_VERSION ($CFG_VER) ≠ message ($VER)"
    echo "   → mets à jour js/config.js (APP_VERSION) si la version du message est la bonne."
  fi

  # package.json : alignement automatique de la métadonnée "version"
  if command -v node >/dev/null 2>&1; then
    node -e "const fs=require('fs');const p='package.json';const j=JSON.parse(fs.readFileSync(p,'utf8'));if(j.version!=='$VER'){const o=j.version;j.version='$VER';fs.writeFileSync(p,JSON.stringify(j,null,2)+'\n');console.log('   package.json '+o+' → $VER')}else{console.log('   package.json déjà à $VER')}"
  fi
fi

# --- 4. Lint ---
echo "🔍 ESLint…"
npm run lint

# --- 5. Tests unitaires ---
echo "🧪 Tests (vitest)…"
npm test

# --- 6. Add ---
echo "➕ git add -A…"
git add -A

# --- 7. Commit ---
echo "📝 git commit…"
git commit -m "$MSG"

# --- 8. & 9. Synchro origin puis push ---
BRANCH="$(git rev-parse --abbrev-ref HEAD)"
echo "⬇️  git pull --rebase origin $BRANCH…"
git pull --rebase origin "$BRANCH"
echo "⬆️  git push origin $BRANCH…"
git push origin "$BRANCH"

echo "✅ Terminé : $MSG"
