# 🗺️ Roadmap — Suivi E85

Propositions d'amélioration classées par axe (web / Excel / sync) et par effort.
À piocher dans l'ordre qui te convient.

---

## 🌐 Web app

### 🔥 Quick wins (1-3 h chacun)

| # | Idée | Pourquoi |
|---|---|---|
| W1 | **Historique 5 derniers pleins** affiché dans l'app (via `GET ?action=export`) | Évite d'ouvrir le sheet pour vérifier le dernier km |
| W2 | **"Dupliquer dernier plein"** (bouton) | Saisie 1-clic si rien n'a changé sauf litres/prix |
| W3 | **Validation km rétrograde** : warning si `km < dernier_km` | Empêche les fautes de frappe |
| W4 | **PWA install prompt** + manifest enrichi (icônes, theme color, splash) | Vraie expérience appli sur iPhone/Android |
| W5 | **Indicateur rentabilité E85 temps réel** : badge vert "rentable" si `prix_E85 < prix_SP98 × 0.66` | Aide à la décision sur la station |
| ~~W6~~ | ~~**Dark mode** (toggle ou auto via `prefers-color-scheme`)~~ | ✅ v2.3.2.0 |

### 🎯 Features visibles (½-1 jour chacun)

| # | Idée | Pourquoi |
|---|---|---|
| W7 | **Stats live** : conso L/100 km, €/100 km, économies E85 vs SP98 sur 6 mois | Le pourquoi du projet |
| W8 | **Mode hors ligne** : Service Worker + queue des pleins, sync au retour réseau | Stations en zone blanche |
| W9 | **Photo du ticket** uploadée avec le plein (Drive ou base64 dans GS) | Justificatif en cas de doute |
| W10 | **Auto-complétion station par km** : si km proche d'une station déjà visitée, pré-sélectionner | UX intelligente |
| W11 | **Notification prix** : alerte quand E85 < seuil dans une station habituelle | Optimise les pleins |

### 🛠️ Tech debt

| # | Idée | Pourquoi |
|---|---|---|
| W12 | Bundler **Vite** + tree-shaking | Réduit le poids du JS, charge plus vite sur mobile |
| W13 | **GitHub Actions** : lint + check `APP_VERSION` cohérente avec dernier commit | Évite l'oubli de bump |
| W14 | Tests unitaires **Vitest** sur `utils.js`, `prix.js` (mock fetch) | Régressions sur les helpers |

---

## 📊 Excel

### 🔥 Quick wins

| # | Idée | Pourquoi |
|---|---|---|
| X1 | **Bouton "Synchroniser"** sur la feuille `GS_Pleins` qui appelle `SyncManuel` | Pas besoin d'Alt+F11 pour debug |
| X2 | **Génération auto du `sync_id`** dans le formulaire Excel à la saisie (pas seulement au sync) | Cohérence immédiate des UUID |
| X3 | **Validation kilométrage** dans le formulaire VBA (warning si < dernier km) | Saisie propre |
| X4 | **Mise en forme conditionnelle** sur colonne "Prix €/L" : vert si < moyenne 30 j, rouge si > | Visuel rentabilité |
| X5 | **Format date français forcé** à l'ouverture du classeur (au cas où Power Query refresh écrase) | Cohérence |

### 🎯 Onglet "Tableau de bord"

| # | Idée | Pourquoi |
|---|---|---|
| X6 | **KPIs en haut** : conso moyenne, €/km, total dépensé YTD, % E85 vs autres | Vue d'ensemble immédiate |
| X7 | **Graphique évolution prix E85** par station fréquentée | Choisir la moins chère |
| X8 | **Graphique conso L/100 km dans le temps** | Détecter un problème mécanique |
| X9 | **Économies cumulées E85 vs SP98** (calcul rétroactif depuis colonne J SP98 station) | Le ROI E85 |
| X10 | **Carte stations** (image statique) avec moyenne prix | Visualisation géographique |

### 🛠️ Robustesse

| # | Idée | Pourquoi |
|---|---|---|
| X11 | **Onglet `_SyncLog`** : chaque sync ajoute une ligne (date, ←N, →N, durée) | Debug, historique |
| X12 | **Backup auto** dans `Google Drive/Sauvegardes/Suivi conso E85_YYYYMMDD.xlsm` avant chaque sync majeure | Filet de sécurité |
| X13 | **Détection doublons** : warning si date + km + litres identiques | Saisie en double |

---

## 🔄 Synchronisation Excel ↔ Google Sheets

### 🎯 Améliorations significatives

| # | Idée | Pourquoi |
|---|---|---|
| S1 | **Sync différentielle** : `?since=lastSyncTimestamp` côté GAS pour ne renvoyer que les nouveaux/modifiés | Plus rapide quand l'historique grandit |
| S2 | **Édition bidirectionnelle** (pas que création) : si une ligne est modifiée d'un côté, la propager | Aujourd'hui on ne fait que ADD |
| S3 | **Suppression bidirectionnelle** : flag `_deleted` au lieu de hard delete, sync efface l'autre côté | Cohérence si on corrige une erreur |
| S4 | **Bouton "Force resync"** : vide `GS_Pleins`, ré-importe tout depuis GS | Reset si désalignement |
| S5 | **Conflict resolution** : si même `sync_id` modifié des 2 côtés, garder le plus récent (timestamp) | Édition simultanée web/Excel |

### 🛡️ Sécurité

| # | Idée | Pourquoi |
|---|---|---|
| S6 | **Token secret** sur les endpoints GAS (`?token=XXX`) partagé avec VBA et web app | L'URL GAS étant publique, tout le monde peut lire l'historique aujourd'hui |
| S7 | **Rate limiting** côté GAS (max 10 requêtes/min par client) | Évite abus accidentels |

---

## 🏆 Top 3 recommandés en priorité

| Rang | Item | Effort | Bénéfice |
|---|---|---|---|
| 1 | **X1** — Bouton "Synchroniser" sur la feuille Excel | 15 min | Ergonomie immédiate |
| 2 | **W1** — Historique 5 derniers pleins dans l'app web | 1-2 h | Utile à chaque saisie, valide la sync GS → app |
| 3 | **S6** — Token secret sur les endpoints GAS | 30 min | Sécurité minimale, données aujourd'hui publiques |

---

## ✅ Idées déjà implémentées

| Version | Idée |
|---|---|
| v2.2.4.x | Module VBA sync bidirectionnel `GS_Pleins` ↔ `_ImportGS` |
| v2.2.4.5 | Format date français + heure locale Paris pour Horodatage |
| v2.3.0.0 | Suppression colonne G "Prix S98 jour" (doublon avec K) |
| v2.3.0.1 | Logs sync via `SetStatus` (barre de statut + Immediate Window) au lieu de `MsgBox` |
| v2.3.1.x | Uniformisation visuelle des 6 boutons carburant + prix dans chaque bouton |
| v2.3.1.2 | Suppression du résumé prix verbeux sous le formulaire (redondant) |
| v2.3.1.3 | Fix overflow marqueurs carte sur bouton submit (z-index + fond opaque) |
| v2.3.2.0 | Dark mode (W6) — toggle header 🌙/☀️ + localStorage + auto `prefers-color-scheme` |

---

> ✏️ Mettre à jour cette roadmap chaque fois qu'une idée est terminée (déplacer vers "Idées déjà implémentées") ou abandonnée.
