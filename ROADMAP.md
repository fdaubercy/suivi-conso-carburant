# 🗺️ Roadmap — Suivi E85

Propositions d'amélioration classées par axe (web / Excel / sync) et par effort.
À piocher dans l'ordre qui te convient.

---

## 🌐 Web app

### 🔥 Quick wins (< 2 h chacun)

| # | Idée | Pourquoi |
|---|---|---|
| W25 | **Export CSV de l'historique** : bouton "📥 Exporter" dans la carte historique → télécharge tous les enregistrements en `.csv` (via `?action=export` + `Blob` + `URL.createObjectURL`) | Justificatif remboursement employeur / fiscalité · zéro backend · effort 1 h |

---

## 📊 Excel

### 🔥 Quick wins

| # | Idée | Pourquoi |
|---|---|---|
| X1 | **Bouton "Synchroniser"** sur la feuille `GS_Pleins` qui appelle `SyncManuel` | Pas besoin d'Alt+F11 pour lancer le sync |
| X4 | **Mise en forme conditionnelle** sur colonne "Prix €/L" : vert si < moyenne 30 j, rouge si > | Visuel rentabilité immédiat |

### 🎯 Onglet "Tableau de bord"

| # | Idée | Pourquoi |
|---|---|---|
| X9 | **Économies cumulées E85 vs SP98** (calcul rétroactif depuis colonne J SP98 station) | Le ROI E85 chiffré |
| X15 | **Graphique scatter Prix E85/L vs L/100 km** : nuage de points pour voir si la conso augmente quand le prix baisse (comportemental) | Corrélation prix/comportement · effort ½ j · pure formule Excel |

### 🛠️ Robustesse

| # | Idée | Pourquoi |
|---|---|---|
| X11 | **Onglet `_SyncLog`** : chaque sync ajoute une ligne (date, ←N, →N, durée) | Debug, historique des syncs |
| X12 | **Backup auto** dans `Google Drive/Sauvegardes/Suivi conso E85_YYYYMMDD.xlsm` avant chaque sync majeure | Filet de sécurité |
| X14 | **Onglet "Suivi des pleins" reconstruit depuis `_ImportGS`** : la table de suivi devient une vue dérivée du tableau de données (Power Query ou formules dynamiques sur `Tableau2`) au lieu d'être saisie manuellement | Source unique de vérité ; plus de double saisie ni de désynchronisation entre l'app web et le tableau Excel |
| X16 | **Rapport mensuel automatique** : trigger GAS (1er du mois) → `MailApp.sendEmail()` avec résumé nb pleins, total €, conso moy, éco E85 vs SP98 | Bilan mensuel passif, zéro action requise · effort 1 j |

---

## 🔄 Synchronisation Excel ↔ Google Sheets

### 🎯 Améliorations significatives

| # | Idée | Pourquoi |
|---|---|---|
| S3 | **Suppression bidirectionnelle** : flag `_deleted` au lieu de hard delete, sync efface l'autre côté | Cohérence si on corrige une erreur |
| S4 | **Bouton "Force resync"** : vide `GS_Pleins`, ré-importe tout depuis GS | Reset si désalignement |
| S5 | **Conflict resolution avancée** : si même `sync_id` modifié des 2 côtés, garder le plus récent (timestamp) plutôt qu'Excel-wins systématique | Édition simultanée web/Excel sans perte |
| S8 | **Refresh quotidien des prix carburants** : trigger temporel GAS (`ScriptApp.newTrigger().timeBased().everyDays(1)`) qui parcourt l'onglet `Stations`, fetch le prix actuel via l'API gov, et logue chaque résultat dans un nouvel onglet `_PrixHistory` (station, date, type, prix) | Permet de tracer l'évolution prix par station dans le temps → graphiques Excel + détection des baisses |
| S10 | **Notification push depuis GAS** : couplé à S8, envoyer une Web Push (VAPID) quand un prix E85 très bas est détecté lors du refresh quotidien — sans que l'app soit ouverte | Alerte passive · complément naturel de S8 + W11 déjà implémenté · effort 2 j (VAPID complexe) |

### 🛡️ Sécurité

| # | Idée | Pourquoi |
|---|---|---|
| S6 | **Token secret** sur les endpoints GAS (`?token=XXX`) partagé avec VBA et web app | L'URL GAS étant publique, tout le monde peut lire l'historique aujourd'hui |

---

## 🏆 Top 5 recommandés en priorité

| Rang | Item | Effort | Bénéfice |
|---|---|---|---|
| 1 | **X1** — Bouton "Synchroniser" sur la feuille GS_Pleins | 15 min | Ergonomie immédiate, plus besoin d'ouvrir l'IDE |
| 2 | **S6** — Token secret sur les endpoints GAS | 30 min | Sécurité minimale, données aujourd'hui publiques |
| 3 | **W25** — Export CSV de l'historique | 1 h | Justificatif employeur/fiscalité · zéro backend |
| 4 | **X9** — Économies cumulées E85 vs SP98 | ½ j | ROI E85 chiffré depuis les données existantes |
| 5 | **S8** — Refresh quotidien prix par trigger GAS | 1 j | Historique prix par station + alerte passive |

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
| v2.4.2.0 | **Validation km rétrograde (W3)** — warning live + confirm au submit, filtré par véhicule (web app) |
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
| v2.8.0.0 | **Carte statique stations habituelles + prix moyens (X10)** — card `#stationsMapCard` + mini-carte OSM non-interactive + liste triée par prix E85 moyen (`stationsmap.js`) ; coordonnées persistées en localStorage au fur et à mesure des sélections |
| v2.8.0.0 | **Détection doublons formulaire web** — warning inline `#dupeWarn` si date + km + litres identiques à un plein existant ; confirm supplémentaire à la soumission |
| v2.9.0.0 | **Auto sync_id à la saisie (X2)** — `Worksheet_Change` [F1] : UUID généré en col O dès la saisie, sans attendre le prochain `SyncManuel()` |
| v2.9.0.0 | **Validation kilométrage VBA (X3)** — `Worksheet_Change` [F3] : warning si km saisi < max km enregistré pour le même véhicule |
| v2.9.0.0 | **Détection doublons VBA (X13)** — `Worksheet_Change` [F4] : warning si Date + Km + Litres (au centilitre) correspondent à une ligne existante |
| v2.9.0.0 | **Édition bidirectionnelle complète (S2)** — col P dirty flag posé à la saisie + `ExportModificationsToGS` (bulkUpdate Excel→GS) + `UpdateRowFromGS` (GS→Excel si non dirty) ; résolution de conflit : Excel gagne si col P renseignée |
| v2.10.0.0 | **Scan ticket OCR client-side (W17 refonte)** — Tesseract.js remplace Gemini Vision ; multi-candidats prix/L + `Math.max()` ; détection SP95-E10 ; km séparateur espace ; ordre `setType` avant `fPrix` |
| v2.11.0.0 | **Mode hors-ligne (W8)** — Service Worker (Cache-First shell + Network-First dynamique) + file d'attente localStorage + badge `📵` + Background Sync + sync automatique au retour réseau |
| v2.11.0.0 | **Alertes prix E85 (W11)** — toggle + seuil configurable (défaut 0,850 €/L) + `new Notification()` avec `tag` anti-spam + carte Paramètres dans l'UI |
| v2.12.0.0 | **Scroll-to-top après submit (W24)** — `window.scrollTo({ top:0, behavior:'smooth' })` après enregistrement réussi et après mise en file hors-ligne ; le formulaire repasse en vue sans geste manuel |
| v2.12.0.0 | **Mini-graphique prix E85 inline (W28)** — `buildE85Sparkline()` dans `stats.js` : courbe SVG des 10 derniers prix E85, couleur selon tendance (↘ vert / ↗ rouge / → bleu), min/max + dernier prix affichés ; aucune lib externe |
| v2.12.0.0 | **Bannière "Mise à jour disponible" SW (W23)** — `_showUpdateBanner(reg)` dans `pwa.js` + handler `SKIP_WAITING` dans `sw.js` ; bouton "Actualiser" → `reg.waiting.postMessage` → `skipWaiting()` → `controllerchange` → reload automatique |
| v2.12.1.0 | **Tests E2E Playwright (T1)** — `tests/e2e.spec.js` : 5 scénarios (TC-01→TC-05) en mode mock GAS via `page.route()` ; `playwright.config.js` + `@playwright/test` ; scripts `test:e2e / test:e2e:ui / test:e2e:headed / test:e2e:report` |
| v2.13.0.0 | **Photo ticket Drive (W9)** — scan → base64 → transmis avec le plein → GAS upload Drive "Suivi E85 - Tickets" → URL en col P ; badge 📷 dans formulaire ; migration automatique col P sur sheets existants |
| v2.13.0.0 | **Comparateur multi-stations (W30)** — jusqu'à 40 stations retournées par l'API triées par prix E85 dans `#comparateurCard` ; station la moins chère mise en évidence (fond vert) ; `state._geoStations` |
| v2.13.0.0 | **Géoloc mémorisée localStorage (W31)** — `suivi_e85_last_geo` (TTL 1 h) ; stations précédentes affichées immédiatement pendant la mise à jour GPS |
| v2.13.0.0 | **Refactoring onclick → addEventListener (T2)** — suppression des ~20 handlers inline dans `index.html` ; `initStaticHandlers()`, `initTypeToggle()`, `initNearbyList()`, `initMapInteractions()` ; attributs `data-fuel-key`, `data-nearby-idx`, `data-map-pin-idx` |
| v2.13.0.0 | **Versioning dynamique cache SW (T3)** — plugin `swVersionPlugin` dans `vite.config.js` : token `__SW_VERSION__` → `APP_VERSION` en dev (middleware) et en build (remplacement dans `dist/sw.js`) |
| v2.14.0.0 | **Historique complet + filtres (W27→W32)** — bouton 📜 → carte `#histoireFullCard` ; filtres véhicule et carburant peuplés dynamiquement ; compteur ; scroll interne ; auto-refresh |
| v2.14.0.0 | **Prédiction prochain plein (W29→W33)** — `buildPrediction()` dans `stats.js` ; intervalle moyen km/jours entre pleins consécutifs (aberrations filtrées) ; "Prochain plein dans ~X km · ~Y j / vers Z km" |
| v2.15.0.0 | **Cache mémoire API ODS (T4)** — `Map _odsCache` clé `(lat,lon,rayon)` TTL 5 min dans `prix.js` ; zéro appel réseau redondant lors du changement de type de carburant |
| v2.15.0.0 | **Content Security Policy (T5)** — `<meta http-equiv="Content-Security-Policy">` dans `index.html` + fichier `_headers` Netlify ; origines autorisées : ODS, GAS, Google Sheets, Overpass, jsDelivr/unpkg, OSM tiles ; en-têtes complémentaires : `X-Frame-Options`, `Referrer-Policy`, `Permissions-Policy` |
| v2.15.0.0 | **Sync différentielle (S1)** — `?action=export&since=ISO` dans GAS `handleExport` filtre par `Horodatage >= since` ; cache localStorage `suivi_e85_hist_cache` + `suivi_e85_hist_since` dans `historique.js` ; fusion différentielle par `sync_id` ; fallback cache hors-ligne |
| v2.16.0.0 | **Web Share API (W26)** — bouton 📤 sur chaque entrée historique ; partage natif iOS/Android ; masqué via `body.no-share` si `navigator.share` non disponible ; délégation sur `#historiqueList` + `#histoireFullList` |
| v2.16.0.0 | **Auto-save brouillon (W15)** — `saveDraft()` sur chaque input formulaire ; `restoreDraft()` au démarrage avec délai 800 ms ; toast "📝 Brouillon restauré" ; `clearDraft()` après soumission/reset |
| v2.16.0.0 | **Rate limiting côté GAS (S7)** — `rateLimit(cid)` via `CacheService`, max 10 req/min par client UUID ; `_getClientId()` `crypto.randomUUID()` côté app, transmis dans chaque payload |
| v2.16.0.0 | **Audit dépendances npm + Dependabot (S9)** — job `audit` dans `ci.yml` (`npm audit --audit-level=moderate`, non-bloquant) ; `.github/dependabot.yml` npm hebdo + github-actions mensuel |

---

> ✏️ Les améliorations réalisées sont retirées de leur tableau d'origine et ajoutées au tableau ci-dessus.
