# 🗺️ Roadmap — Suivi E85

Propositions d'amélioration classées par axe (web / Excel / sync) et par effort.
À piocher dans l'ordre qui te convient.

---

## 🌐 Web app

### 🔥 Quick wins (1-3 h chacun)

| # | Idée | Pourquoi |
|---|---|---|

### 🎯 Features visibles (½-1 jour chacun)

| # | Idée | Pourquoi |
|---|---|---|
| W8 | **Mode hors ligne** : Service Worker + queue des pleins, sync au retour réseau | Stations en zone blanche · effort 3-4 h (sw.js + manifest + IndexedDB) |
| W9 | **Photo du ticket** uploadée avec le plein (Drive ou base64 dans GS) | Justificatif · effort 2-3 h + breaking schema (col supplémentaire dans GS) |
| W11 | **Notification prix** : alerte quand E85 < seuil dans une station habituelle | Optimise les pleins · effort 3-4 h + dépend de W8 (Push API) |
| W15 | **Auto-save brouillon** : à chaque frappe, sauve le formulaire dans localStorage. Restauré au prochain chargement si la page est fermée sans enregistrer | UX : pas de perte si on quitte par erreur |

### 🛠️ Tech debt

| # | Idée | Pourquoi |
|---|---|---|

---

## 📊 Excel

### 🔥 Quick wins

| # | Idée | Pourquoi |
|---|---|---|
| X1 | **Bouton "Synchroniser"** sur la feuille `GS_Pleins` qui appelle `SyncManuel` | Pas besoin d'Alt+F11 pour debug |
| X2 | **Génération auto du `sync_id`** dans le formulaire Excel à la saisie (pas seulement au sync) | Cohérence immédiate des UUID |
| X3 | **Validation kilométrage** dans le formulaire VBA (warning si < dernier km) | Saisie propre |
| X4 | **Mise en forme conditionnelle** sur colonne "Prix €/L" : vert si < moyenne 30 j, rouge si > | Visuel rentabilité |

### 🎯 Onglet "Tableau de bord"

| # | Idée | Pourquoi |
|---|---|---|
| X9 | **Économies cumulées E85 vs SP98** (calcul rétroactif depuis colonne J SP98 station) | Le ROI E85 |
| X10 | **Carte stations** (image statique) avec moyenne prix | Visualisation géographique |

### 🛠️ Robustesse

| # | Idée | Pourquoi |
|---|---|---|
| X11 | **Onglet `_SyncLog`** : chaque sync ajoute une ligne (date, ←N, →N, durée) | Debug, historique |
| X12 | **Backup auto** dans `Google Drive/Sauvegardes/Suivi conso E85_YYYYMMDD.xlsm` avant chaque sync majeure | Filet de sécurité |
| X13 | **Détection doublons** : warning si date + km + litres identiques | Saisie en double |
| X14 | **Onglet "Suivi des pleins" reconstruit depuis `_ImportGS`** : la table de suivi devient une vue dérivée du tableau de données (Power Query ou formules dynamiques sur `Tableau2`) au lieu d'être saisie manuellement | Source unique de vérité ; plus de double saisie ni de désynchronisation entre l'app web et le tableau Excel |

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
| S8 | **Refresh quotidien des prix carburants** : trigger temporel GAS (`ScriptApp.newTrigger().timeBased().everyDays(1)`) qui parcourt l'onglet `Stations`, fetch le prix actuel via l'API gov, et logue chaque résultat dans un nouvel onglet `_PrixHistory` (station, date, type, prix) | Permet de tracer l'évolution prix par station dans le temps → graphiques Excel + détection des baisses |

---

## 🏆 Top 3 recommandés en priorité

| Rang | Item | Effort | Bénéfice |
|---|---|---|---|
| 1 | **X1** — Bouton "Synchroniser" sur la feuille Excel | 15 min | Ergonomie immédiate |
| 2 | **S6** — Token secret sur les endpoints GAS | 30 min | Sécurité minimale, données aujourd'hui publiques |
| 3 | **W15** — Auto-save brouillon localStorage | 1 h | UX : zéro perte de saisie |

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
| v2.3.2.0 | Dark mode **(W6)** — toggle header 🌙/☀️ + localStorage + auto `prefers-color-scheme` |
| v2.3.3.0 | Historique 5 derniers pleins **(W1)** — card en bas du formulaire, refresh auto après plein |
| v2.4.0.0 | **Tableau de bord Excel (X6)** — 10 KPIs + **format date français forcé (X5)** à l'ouverture |
| v2.4.0.3 | Fix `CreerTableauDeBord` — détection dynamique nom table + colonnes par position |
| v2.4.1.0 | **Dupliquer dernier plein (W2)** — bouton 📋 dans la carte historique, pré-remplit véhicule/type/station |
| v2.4.2.0 | **Validation km rétrograde (W3)** — warning live + confirm au submit, filtré par véhicule |
| v2.4.3.0 | **Badge rentabilité E85 (W5)** — vert/orange sous le toggle, seuil 66% du SP98 |
| v2.4.4.0 | **Stats live (W7)** — carte 4 KPIs (conso, €/100km, total 6 mois, éco E85) filtrée par véhicule |
| v2.4.5.0 | **Stats par carburant + station "Nom - Ville"** — conso/€/100km filtrés sur type courant + format station avec ville en proper case |
| v2.5.0.0 | **GitHub Actions CI (W13)** — lint ESLint sur `js/` + vérification cohérence `APP_VERSION` vs dernier tag Git |
| v2.5.0.0 | **Scan ticket de caisse (W17)** — bouton 🧾 dans le formulaire → photo → Gemini Vision API (GAS) → JSON → pré-remplissage automatique date / km / litres / prix / type / station |
| v2.5.0.0 | **Graphique prix E85 (X7)** — feuille "Graphiques" : ligne Date → Prix E85 filtrée depuis `GS_Pleins` |
| v2.5.0.0 | **Graphique conso L/100 km (X8)** — feuille "Graphiques" : ligne Date → L/100km calculée entre pleins consécutifs par véhicule |
| v2.6.0.0 | **PWA install prompt (W4)** — `manifest.json` + icône SVG ⛽ + bannière "Installer" Android/Chrome + bannière instruction iOS Safari + `theme-color` |
| v2.7.0.0 | **Vite bundler (W12)** — `vite.config.js`, `public/icons/`, workflow `deploy.yml` GitHub Actions → GitHub Pages, scripts `dev`/`build`/`preview` |
| v2.7.0.0 | **Tests unitaires Vitest (W14)** — `tests/utils.test.js` (30 cas) + `tests/prix.test.js` (8 cas, fetch mocké) ; job `test` ajouté dans `ci.yml` |

---

> ✏️ Les améliorations réalisées sont retirées de leur tableau d'origine et ajoutées au tableau ci-dessus.
