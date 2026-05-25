# 🗺️ Roadmap — Suivi E85

Propositions d'amélioration classées par axe (web / Excel / sync) et par effort.
À piocher dans l'ordre qui te convient.

---

## 🌐 Web app

### 🔥 Quick wins (1-3 h chacun)

| # | Idée | Pourquoi |
|---|---|---|
| ~~W1~~ | ~~**Historique 5 derniers pleins** affiché dans l'app (via `GET ?action=export`)~~ | ✅ v2.3.3.0 |
| ~~W2~~ | ~~**"Dupliquer dernier plein"** (bouton)~~ | ✅ v2.4.1.0 |
| ~~W3~~ | ~~**Validation km rétrograde** : warning si `km < dernier_km`~~ | ✅ v2.4.2.0 |
| W4 | **PWA install prompt** + manifest enrichi (icônes, theme color, splash) | Vraie expérience appli sur iPhone/Android |
| ~~W5~~ | ~~**Indicateur rentabilité E85 temps réel** : badge vert "rentable" si `prix_E85 < prix_SP98 × 0.66`~~ | ✅ v2.4.3.0 |
| ~~W6~~ | ~~**Dark mode** (toggle ou auto via `prefers-color-scheme`)~~ | ✅ v2.3.2.0 |

### 🎯 Features visibles (½-1 jour chacun)

| # | Idée | Pourquoi |
|---|---|---|
| ~~W7~~ | ~~**Stats live** : conso L/100 km, €/100 km, économies E85 vs SP98 sur 6 mois~~ | ✅ v2.4.4.0 |
| W8 | **Mode hors ligne** : Service Worker + queue des pleins, sync au retour réseau | Stations en zone blanche · effort 3-4 h (sw.js + manifest + IndexedDB) |
| W9 | **Photo du ticket** uploadée avec le plein (Drive ou base64 dans GS) | Justificatif · effort 2-3 h + breaking schema (col supplémentaire dans GS) |
| W10 | ~~**Auto-complétion station par km**~~ | ❌ Redondant avec W2 (📋 Dupliquer dernier) — concept à redéfinir |
| W11 | **Notification prix** : alerte quand E85 < seuil dans une station habituelle | Optimise les pleins · effort 3-4 h + dépend de W8 (Push API) |
| W15 | **Auto-save brouillon** : à chaque frappe, sauve le formulaire dans localStorage. Restauré au prochain chargement si la page est fermée sans enregistrer | UX : pas de perte si on quitte par erreur |
| W16 | **Photo ticket + OCR/AI** : capture caméra → OCR (Tesseract.js côté client OU API Vision Claude/Gemini côté GAS) → parse date / litres / prix / station → pré-remplit le formulaire. Évolution naturelle de W9 (qui n'est que stockage photo) | UX premium : 1 photo → formulaire complet sans saisie manuelle. Effort : 4-6 h (OCR/AI integration + parsing robuste + UI capture) |
| W16 | **📸 Photo ticket → auto-fill du formulaire** : bouton "Scanner le ticket" qui ouvre la caméra (`<input type="file" accept="image/*" capture>`), puis extrait automatiquement km, litres, prix, type carburant, station via OCR ou API IA vision. Trois approches possibles : (a) **Tesseract.js** côté client (gratuit, ~2 Mo, lent ~5 s) ; (b) **API Claude Vision / GPT-4 Vision / Gemini Vision** côté GAS (rapide, payant à l'usage, plus précis sur tickets manuscrits ou photos floues) ; (c) **Hybride** Tesseract local + fallback IA si confiance faible | Saisie quasi-instantanée — divise le temps de saisie par 5-10. Plus de pertes/oublis car le ticket photographié sert aussi de justificatif. Absorbe W9 si on stocke l'image. |
| W17 | **🧾 Scan ticket de caisse → auto-complétion du formulaire** : reconnaissance du ticket de caisse imprimé par la pompe (photo ou scan) — OCR / API vision (Claude Vision, Gemini Vision, GPT-4 Vision) — extrait les caractéristiques du plein directement depuis le ticket (date, heure, type carburant, litres, prix/L, montant total, nom de station) et pré-remplit automatiquement tous les champs du formulaire en ligne. Avantage vs W16 : le ticket papier est imprimé, structuré et sans reflets ; les données sont plus fiables que la lecture d'un afficheur de pompe. Approches : (a) `<input type="file" accept="image/*">` (galerie ou caméra) → envoi base64 à GAS → API Vision → JSON parsé ; (b) traitement local Tesseract.js si ticket standard bien contrasté | UX : zéro ressaisie après le plein — 1 photo du ticket → formulaire complet. Élimine les erreurs de frappe sur les chiffres (litres, prix). Le ticket stocké (W9) sert de justificatif et de source de vérité. Effort estimé : 3-5 h (UI + intégration API vision + parsing JSON + mapping champs formulaire). |

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
| ~~X5~~ | ~~**Format date français forcé** à l'ouverture du classeur (au cas où Power Query refresh écrase)~~ | ✅ v2.4.0.0 |

### 🎯 Onglet "Tableau de bord"

| # | Idée | Pourquoi |
|---|---|---|
| ~~X6~~ | ~~**KPIs en haut** : conso moyenne, €/km, total dépensé YTD, % E85 vs autres~~ | ✅ v2.4.0.0 (10 KPIs) |
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
| 3 | **W4** — PWA install prompt + manifest enrichi (icônes, theme color, splash) | 1-2 h | Vraie expérience appli sur iPhone/Android |

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
| v2.3.3.0 | Historique 5 derniers pleins (W1) — card en bas du formulaire, refresh auto après plein |
| v2.4.0.0 | **Tableau de bord Excel** (X6) — 10 KPIs + **format date français forcé** (X5) à l'ouverture |
| v2.4.0.3 | Fix `CreerTableauDeBord` — détection dynamique nom table + colonnes par position |
| v2.4.1.0 | **Dupliquer dernier plein** (W2) — bouton 📋 dans la carte historique, pré-remplit véhicule/type/station |
| v2.4.2.0 | **Validation km rétrograde** (W3) — warning live + confirm au submit, filtré par véhicule |
| v2.4.3.0 | **Badge rentabilité E85** (W5) — vert/orange sous le toggle, seuil 66% du SP98 |
| v2.4.4.0 | **Stats live** (W7) — carte 4 KPIs (conso, €/100km, total 6 mois, éco E85) filtrée par véhicule |
| v2.4.5.0 | **Stats par carburant + station "Nom - Ville"** — conso/€/100km filtrés sur type courant + format station avec ville en proper case |

---

> ✏️ Mettre à jour cette roadmap chaque fois qu'une idée est terminée (déplacer vers "Idées déjà implémentées") ou abandonnée.
