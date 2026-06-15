---
description: Reprend une session précédente à partir d'un export et finalise les actions en cours
argument-hint: [chemin-dossier-travail]
---

# Reprise de session

Tu reprends le travail dans le dossier de projet fourni : $ARGUMENTS

## Étape 1 — Chargement
- Se placer dans le dossier de travail `$ARGUMENTS` et le considérer comme racine du projet pour toute la session.
- Y chercher l'export de session le plus récent (dans `$ARGUMENTS/tasks/` ou `$ARGUMENTS/exports/`) et le lire intégralement avant toute action.
- Si aucun dossier n'est fourni, utiliser le dossier courant. Si aucun export n'est trouvé, demander le fichier.

## Étape 2 — Analyse des demandes utilisateur
Pour CHAQUE demande utilisateur présente dans l'export :
- Déterminer son statut : ✅ traitée et finalisée / 🔶 partielle / ❌ à faire.
- Justifier le statut par une preuve concrète (commit, fichier modifié, sortie). INTERDICTION de marquer "finalisée" sans preuve vérifiable.
- Si 🔶 ou ❌ → l'ajouter à la liste des actions à traiter.

## Étape 3 — Actions en cours
- Identifier toute action interrompue en milieu d'exécution et la reprendre là où elle s'est arrêtée.

## Étape 4 — Plan de reprise
Présenter un tableau récapitulatif AVANT d'exécuter quoi que ce soit :

| # | Demande | Statut | Preuve | Action à mener |
|---|---------|--------|--------|----------------|

- TOUJOURS attendre la validation de l'utilisateur avant d'exécuter les actions ❌/🔶, sauf en mode Auto.

## Étape 5 — Exécution
- Traiter les actions par ordre de priorité.
- Respecter les règles du projet (`CLAUDE.md`, `./commit.sh`, `/graphify --update` en pré-commit).
- Mettre à jour le statut après chaque action finalisée.

## Étape 6 — Clôture
- Consigner dans `tasks/lessons.md` toute leçon ou écueil rencontré.
- Générer un mini-export de fin de session (actions restantes) pour la prochaine reprise.
