#!/usr/bin/env bash
# scripts/sync-gas.sh — Déploie le code GAS puis le versionne dans git.
#
# Usage :
#   ./scripts/sync-gas.sh                  # déploie + commit
#   ./scripts/sync-gas.sh --no-deploy      # commit uniquement (sans déployer)
#   ./scripts/sync-gas.sh --diff           # affiche les différences GAS (sans commit)
#
# Prérequis : .claude/gas-config.json configuré (voir gas-deploy.mjs).
set -euo pipefail

REPO="$(git -C "$(dirname "$0")" rev-parse --show-toplevel)"
GAS_REL="Google Drive/Sauvegarde & Geolocalisation - Suivi conso SuperEthanol/Google Apps Script"
FLAG="${1:-}"

cd "$REPO"

if [[ "$FLAG" == "--diff" ]]; then
  node gas-deploy.mjs --diff
  exit 0
fi

if [[ "$FLAG" != "--no-deploy" ]]; then
  echo "→ Déploiement GAS en cours..."
  node gas-deploy.mjs
fi

# Ajouter les fichiers .gs, .html et .md du répertoire GAS (ignore les absents)
git add "$GAS_REL"/*.gs "$GAS_REL"/*.html "$GAS_REL"/*.md 2>/dev/null || true

MSG="chore(gas): sync GAS $(date +%Y-%m-%d)"
if ! git diff --cached --quiet; then
  git commit -m "$MSG"
  echo "✅ GAS versionné : $MSG"
else
  echo "ℹ️  Aucun changement GAS à versionner."
fi
