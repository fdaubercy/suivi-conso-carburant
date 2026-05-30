#!/usr/bin/env bash
#
# commit.sh — sync version + add + lint + tests + commit + pull --rebase + push
#
# Usage :
#   ./commit.sh "feat(scope): description [vX.Y.Z.W]"
#
# Étapes (verbeuses, annoncées une à une) :
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

# ─── Helpers d'affichage (étapes verbeuses) ───────────────────
TOTAL_STEPS=9
SECONDS=0   # chrono bash : nombre de secondes écoulées depuis le début

hr()   { printf '─%.0s' $(seq 1 56); printf '\n'; }
step() { # step <num> <emoji> <titre>
  hr
  printf '▶  Étape %s/%s  %s  %s   (+%ss)\n' "$1" "$TOTAL_STEPS" "$2" "$3" "$SECONDS"
  hr
}
ok()   { printf '   ✅ %s\n' "$1"; }
info() { printf '   ℹ️  %s\n' "$1"; }
warn() { printf '   ⚠️  %s\n' "$1"; }
die()  { printf '\n❌ %s\n' "$1" >&2; exit 1; }

printf '\n🚀 commit.sh — démarrage\n'

# --- 1. Message de commit obligatoire ---
step 1 "📨" "Vérification du message de commit"
MSG="${1:-}"
if [ -z "$MSG" ]; then
  printf '   Usage : ./commit.sh "feat(scope): description [vX.Y.Z.W]"\n'
  die "Message de commit manquant."
fi
ok "Message : $MSG"

# --- 2. Y a-t-il quelque chose à committer ? ---
step 2 "🔎" "Détection des changements"
CHANGES="$(git status --porcelain || true)"
if [ -z "$CHANGES" ]; then
  info "Aucun changement à committer. Abandon."
  exit 0
fi
NB_FILES="$(printf '%s\n' "$CHANGES" | grep -c . || true)"
ok "$NB_FILES fichier(s) modifié(s) :"
printf '%s\n' "$CHANGES" | sed 's/^/      /'

# --- 3. Synchronisation de version (si [vX.Y.Z.W] présent dans le message) ---
step 3 "🔢" "Synchronisation de la version"
VER="$(printf '%s' "$MSG" | grep -oE 'v[0-9]+\.[0-9]+\.[0-9]+\.[0-9]+' | head -1 | sed 's/^v//' || true)"
if [ -n "$VER" ]; then
  info "Version détectée dans le message : $VER"

  # APP_VERSION de js/config.js = source de vérité (éditée à la main)
  CFG_VER="$(grep -oE "APP_VERSION[^']*'[0-9]+\.[0-9]+\.[0-9]+\.[0-9]+'" js/config.js \
             | grep -oE '[0-9]+\.[0-9]+\.[0-9]+\.[0-9]+' | head -1 || true)"
  if [ -n "$CFG_VER" ] && [ "$CFG_VER" != "$VER" ]; then
    warn "Divergence : APP_VERSION ($CFG_VER) ≠ message ($VER)"
    warn "→ mets à jour js/config.js (APP_VERSION) si la version du message est la bonne."
  else
    ok "APP_VERSION (js/config.js) = $CFG_VER — cohérente"
  fi

  # package.json : alignement automatique de la métadonnée "version"
  if command -v node >/dev/null 2>&1; then
    node -e "const fs=require('fs');const p='package.json';const j=JSON.parse(fs.readFileSync(p,'utf8'));if(j.version!=='$VER'){const o=j.version;j.version='$VER';fs.writeFileSync(p,JSON.stringify(j,null,2)+'\n');console.log('   ✅ package.json '+o+' → $VER')}else{console.log('   ✅ package.json déjà à $VER')}"
  else
    warn "node introuvable — package.json non aligné."
  fi
else
  info "Aucune balise [vX.Y.Z.W] dans le message — étape ignorée."
fi

# --- 4. Lint ---
step 4 "🔍" "ESLint (npm run lint)"
npm run lint || die "ESLint a échoué (erreurs ou warnings). Commit annulé."
ok "Lint propre — 0 erreur, 0 warning."

# --- 5. Tests unitaires ---
step 5 "🧪" "Tests unitaires (vitest)"
npm test || die "Les tests ont échoué. Commit annulé."
ok "Tous les tests passent."

# --- 6. Add ---
step 6 "➕" "git add -A"
git add -A
ok "Index mis à jour."

# --- 7. Commit ---
step 7 "📝" "git commit (hook pre-commit husky)"
git commit -m "$MSG"
ok "Commit créé."

# --- 8. Pull --rebase ---
BRANCH="$(git rev-parse --abbrev-ref HEAD)"
step 8 "⬇️ " "git pull --rebase origin $BRANCH"
git pull --rebase origin "$BRANCH" || die "Rebase impossible (conflits ?). Résous, puis relance."
ok "Branche synchronisée avec origin/$BRANCH."

# --- 9. Push ---
step 9 "⬆️ " "git push origin $BRANCH"
git push origin "$BRANCH" || die "Push refusé. Vérifie l'accès distant."
ok "Push effectué."

# --- Bilan final ---
hr
printf '✅ Terminé en %ss — %s\n' "$SECONDS" "$MSG"
printf '   Branche : %s · commit %s\n' "$BRANCH" "$(git rev-parse --short HEAD)"
hr
