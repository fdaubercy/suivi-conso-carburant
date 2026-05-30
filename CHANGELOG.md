# Changelog

Toutes les modifications notables de ce projet sont documentées ici.

Format : [Keep a Changelog](https://keepachangelog.com/fr/1.0.0/)

## [3.7.0.0] — 2026-05-30

### Added
- **Navigation par vues — onglets + pages (W42)** — fin du long scroll unique : l'application est désormais découpée en **5 vues** présentées comme des pages, accessibles via une **barre d'onglets fixe en bas** (style appli native) :
  - ⛽ **Saisie** (vue par défaut au démarrage) : formulaire, véhicule, carburant, scan ticket, station, comparateur (W30), secteur (W38), bouton « Enregistrer ».
  - 📊 **Statistiques** : stats live (W7), rapport mensuel (X16), bilan annuel « Wrapped » (W37).
  - 🗺️ **Carte** : carte des stations habituelles + prix moyens (X10).
  - 📜 **Historique** : 5 derniers pleins + historique complet filtrable (W32).
  - ⚙️ **Réglages** : notifications, mode hors-ligne, prix du kit.
  - `js/router.js` (nouveau) : routeur léger par **hash** (`#/saisie`, `#/stats`, `#/carte`, `#/historique`, `#/params`). Le **bouton retour** du navigateur et de l'OS fonctionne nativement (chaque vue a son URL) ; aucun fallback serveur nécessaire (compatible GitHub Pages). Onglet actif surligné (`aria-current="page"`), titre du header mis à jour par vue, remontée en haut à chaque changement de page.
  - Le bouton 📋 « Dupliquer le dernier plein » (vue Historique) bascule automatiquement vers la vue Saisie pour montrer le formulaire pré-rempli.
  - La carte statique des stations, rendue hors écran, est **re-cadrée** au premier affichage de l'onglet Carte (événement `viewchange`) pour un dimensionnement correct.

### Changed
- **`index.html`** — cartes regroupées dans `<main>` sous 5 `<section class="view" data-view="…">` ; ajout de la `<nav class="bottom-nav">` (5 onglets) ; `#feedback` et le bouton submit déplacés dans la vue Saisie.
- **`css/style.css`** — styles `.view` / `.view--active` (transition d'entrée, respect de `prefers-reduced-motion`), `.bottom-nav` + `.nav-tab` (fixe, safe-area iPhone), variable `--nav-h` ; le bouton submit colle désormais **au-dessus** de la barre d'onglets ; `padding-bottom` du body ajusté.
- **`js/config.js`** — `APP_VERSION` → `3.7.0.0`.

## [3.6.0.0] — 2026-05-30

### Added
- **Token secret sur les endpoints GAS (S6)** — sécurise les appels au backend (l'URL GAS étant publique, tout le monde pouvait lire/écrire l'historique).
  - `Code.gs` : helper `tokenOk_(e, payload)` + `unauthorizedResponse_()`. **Mode souple** : le contrôle ne s'active que si la **propriété de script** `APP_TOKEN` est définie côté Apps Script — tant qu'elle n'est pas posée, tout fonctionne sans token (rétrocompatible, aucun déploiement bloquant). Une fois posée, chaque requête de données doit fournir le même token (`?token=` en GET, champ `token` du JSON en POST). La **page HTML** reste servie sans token.
  - `js/config.js` : nouvelle constante `APP_TOKEN`, injectée dans tous les appels GAS (`formulaire.js`, `offline.js`, `ticket.js`, `notifications.js`, `stations.js`, `historique.js`, `geo.js`).
  - `vba/modSyncGS.bas` : constante `APP_TOKEN` ajoutée au GET `?action=export` et aux POST `bulkAdd` / `bulkUpdate` / `syncStations`.
  - ⚠️ Sécurité par obscurité : le token, présent dans le bundle public (GitHub Pages), relève le niveau d'accès mais n'est pas un secret cryptographique. **Activation** : coller la valeur d'`APP_TOKEN` dans les Propriétés du script GAS (clé `APP_TOKEN`) — la même que `js/config.js` et `vba/modSyncGS.bas`.
- **Bilan annuel « Wrapped » (W37)** — nouvelle carte `#wrappedCard` + module `js/wrapped.js` : récap d'une année (litres totaux, € dépensés, km parcourus, économie E85 cumulée vs SP98, station préférée, mois le plus cher). **Sélecteur d'année** (années présentes dans l'historique) + **bascule de périmètre** 🏍️/🚗🏍️ (véhicule courant ↔ tous véhicules, persistée). Le périmètre « véhicule » suit le véhicule sélectionné en haut de page. Km parcourus = somme des deltas max−min par véhicule ; économie alignée sur la méthode du dashboard (surconsommation E85 dynamique).
- **Prix payé vs moins cher du secteur (W38)** — pour chaque plein E85, l'historique affiche « 💸 +X €/L vs le moins cher du secteur (Y €/L) » ou « ✅ Au meilleur prix du secteur ».
  - `RefreshPrix.gs` : le relevé quotidien (~7h) complète les stations curées par un **scan des stations E85 les moins chères dans 15 km autour de la dernière position connue** (`fetchCheapestE85AroundGeo_`), logue le tout dans `_PrixHistory` et mémorise le meilleur prix du jour (`SECTOR_BEST_TODAY`).
  - `Code.gs` : action `saveLastGeo` (mémorise la dernière position connue, propriété `LAST_GEO`) + action `sectorPrices` (renvoie le prix E85 mini du secteur **par jour** depuis `_PrixHistory`, et le meilleur prix du jour).
  - `js/geo.js` : la géolocalisation pousse la position au serveur (fire-and-forget) pour alimenter le scan.
  - `js/secteur.js` (nouveau) : charge le snapshot (cache localStorage 2 h), fournit `getSectorMinForDate()` à l'historique et rend la carte « 🏆 Moins cher du secteur » (`#secteurCard`).
  - Comportement **prospectif** : l'écart n'apparaît que pour les pleins dont le jour a un relevé secteur (à partir du 1er refresh ~7h après déploiement) ; les pleins antérieurs restent neutres.

### Changed
- **`js/config.js`** — `APP_VERSION` → `3.6.0.0` ; nouvelles clés `SECTOR_CACHE_KEY`, `WRAPPED_SCOPE_KEY`, `APP_TOKEN`.

## [3.5.0.1] — 2026-05-30

### Fixed
- **Clic sans effet sur les marqueurs de la carte « stations habituelles »** (Windows + iPhone) (`css/style.css`) : la règle de base `.smap-marker { pointer-events: none; }` (héritée de l'époque où ces marqueurs n'étaient pas interactifs) laissait les clics traverser vers les tuiles OSM, donc la popup d'itinéraire S11 ne s'ouvrait jamais. Ajout de `pointer-events: auto` sur `.smap-marker`. La carte recherche/géoloc n'était pas concernée.

### Changed
- **`js/config.js`** — `APP_VERSION` → `3.5.0.1`.

## [3.5.0.0] — 2026-05-30

### Added
- **Itinéraire vers une station au clic sur un marqueur (S11)** — nouveau module `js/itineraire.js` (`showStationPopup`). Au clic sur un marqueur — **carte des stations habituelles** (`js/stationsmap.js`) **ou** carte des recherches par **géolocalisation / saisie manuelle** (`js/carte.js` → `selectStationFromMap`) — une **popup** affiche les renseignements de la station (nom, prix, distance depuis la position connue, adresse si disponible) puis **demande** l'itinéraire (« Obtenir l'itinéraire vers cette station ? »). Deux boutons : **🚗 Itinéraire Waze** (`https://waze.com/ul?ll=<lat>,<lon>&navigate=yes`, trajet depuis la position GPS de l'utilisateur) et **🗺️ Google Maps** en repli (`maps/dir/?api=1&destination=…`) si Waze n'est pas installé. Le clic sur le bouton sert de **confirmation explicite** avant de lancer l'app de navigation.
  - `js/stationsmap.js` : marqueurs `.smap-marker` rendus cliquables (`data-smap-idx`) + `initStationsMapInteractions()` (délégation sur la card `#stationsMapCard`).
  - `js/main.js` : `selectStationFromMap()` ouvre désormais la popup en plus de la sélection ; init de `initStationsMapInteractions()`.
  - `css/style.css` : styles `.stpop-*` (overlay modal, boutons Waze/Maps, dark mode).

### Changed
- **`js/config.js`** — `APP_VERSION` → `3.5.0.0`.

## [3.4.0.5] — 2026-05-30

### Fixed
- **Carte habituelles — marqueur d'une station placé sur une ville homonyme** (`js/stationsmap.js`) : le géocodage prenait le **1er résultat** de l'API pour la ville extraite du nom (ex. « Carrefour - Flers » → plusieurs « Flers » en France : Orne, Escrebieux…), plaçant parfois le marqueur à des centaines de km (hors carte, ex. constaté sur iPhone). Désormais le candidat retenu est le **plus proche d'un point de référence** (position de l'utilisateur, sinon barycentre des stations choisies à la main). Les coordonnées auto-géocodées **aberrantes** déjà en cache (> 80 km de la référence) sont **re-géocodées automatiquement** ; les coordonnées choisies manuellement (`src:'pick'`) restent intactes. `cacheStationCoords()` gagne un paramètre `src` (`'pick'`/`'geo'`).

### Changed
- **`js/config.js`** — `APP_VERSION` → `3.4.0.5`.

## [3.4.0.4] — 2026-05-30

### Added
- **Carte « Stations habituelles » — marqueur de la position de l'utilisateur** (`js/stationsmap.js` + `css/style.css`) : pastille bleue avec **icône du véhicule courant** (🏍️ moto / 🚗 voiture, déduite du nom du véhicule via `_vehicleIcon`). Position récupérée depuis `state.userLat/userLon` (bouton 📍) ou demandée une fois en arrière-plan (`_ensureUserPos`). Le cadrage de la carte inclut désormais la position pour qu'elle reste visible avec les stations.

### Changed
- **Push prix E85 — seuil propre à chaque appareil (S10)** (`RefreshPrix.gs` + `WebPush.gs`) : `envoyerPushPrixBas()` n'envoie à un abonné que si le prix ≤ **son** seuil (colonne `Seuil` de `_PushSubs`, alimentée par le réglage du toggle dans l'app), avec repli sur la propriété `SEUIL_PUSH_E85` puis `SEUIL_PUSH_E85_DEFAULT`. Un seul réglage (toggle de l'app) pilote alertes locales **et** push. `testEnvoyerPush()` force l'envoi (ignore le seuil).
- **`js/config.js`** — `APP_VERSION` → `3.4.0.4`.

## [3.4.0.3] — 2026-05-30

### Changed
- **Carte « Stations E85 habituelles » — marqueurs ⛽ distinctifs + cadrage fiable** (`js/stationsmap.js` + `css/style.css`) : nouveau marqueur en **goutte verte E85 avec icône ⛽** (classes `.smap-marker` / `.smap-marker-pin`) à la place de l'ancien point. Moteur de rendu réécrit pour **centrer sur l'empreinte des marqueurs** (et non plus sur la grille de tuiles) et choisir le zoom qui les fait **tous tenir** dans la carte — corrige le cas où un marqueur tombait sous la zone visible (`top` > hauteur de la carte) et restait invisible.

### Changed
- **`js/config.js`** — `APP_VERSION` → `3.4.0.3`.

## [3.4.0.2] — 2026-05-30

### Fixed
- **`WebPush.gs` — `ReferenceError: navigator is not defined`** au chargement de jsrsasign (`generateVapidKeys()` / `envoyerPushPrixBas()`) : la librairie référence `navigator`/`window` (globals navigateur) absents en GAS. Ajout de **shims** `var navigator = {…}; var window = {};` juste avant `eval(src)` (scope partagé par l'`eval` direct).

### Changed
- **`js/config.js`** — `APP_VERSION` → `3.4.0.2`.

## [3.4.0.1] — 2026-05-30

### Fixed
- **`WebPush.gs` — « parse error : unexpected token illegal » à l'enregistrement** : Apps Script (V8) **ne supporte pas `BigInt`** ; les littéraux `…n` de l'implémentation P-256 maison cassaient le script. Signature ECDSA **ES256/P-256 déléguée à la librairie [jsrsasign](https://github.com/kjur/jsrsasign)** chargée à la volée depuis cdnjs (`eval`) — `KEYUTIL.generateKeypair` pour `generateVapidKeys()`, `KJUR.jws.JWS.sign('ES256', …)` pour le JWT VAPID. Plus aucun `BigInt`.

### Changed
- **`js/config.js`** — `APP_VERSION` → `3.4.0.1`.

## [3.4.0.0] — 2026-05-30

### Added
- **Refresh quotidien des prix (S8)** — nouveau `Google Apps Script/RefreshPrix.gs` : trigger temporel `ScriptApp.newTrigger('refreshPrixCarburants').timeBased().everyDays(1).atHour(7)` qui parcourt l'onglet `Stations`, extrait la ville de chaque nom (`Enseigne - Ville`), fetch le prix **E85 le plus bas** de la ville via l'API gouv (`order_by=e85_prix asc`), et logue chaque résultat dans un nouvel onglet **`_PrixHistory`** (Station, Date, Type, Prix €/L). `installerTriggerRefreshPrix()` (une fois) + `testRefreshPrix()`.
- **Notification push depuis GAS (S10)** — nouveau `Google Apps Script/WebPush.gs` : **Web Push VAPID sans payload** (RFC 8030). JWT **ES256 / courbe P-256** signé via la librairie **jsrsasign** (cf. correctif 3.4.0.1). Quand `refreshPrixCarburants()` détecte un prix E85 ≤ seuil (`SEUIL_PUSH_E85`, défaut 0,700 €/L), il mémorise le meilleur prix (`LAST_LOW_PRICE`) et appelle `envoyerPushPrixBas()` → push à tous les abonnés, **app fermée**. `generateVapidKeys()` (une fois) génère la paire et stocke la privée dans les Propriétés du script.
  - Côté client (`js/notifications.js`) : `registerPushSubscription()` s'abonne au `PushManager` (clé `VAPID_PUBLIC_KEY`) et envoie l'abonnement à GAS (`action=savePushSub`, stocké dans l'onglet `_PushSubs`) à l'activation des alertes, au démarrage et au changement de seuil ; `unregisterPushSubscription()` au désabonnement.
  - Service Worker (`public/sw.js`) : handlers `push` (push sans payload → `fetch ?action=lowprice` pour enrichir la notification avec station + prix) et `notificationclick` (focus/ouverture de l'app).
  - `Code.gs` : routes `doPost action=savePushSub` (→ `handleSavePushSub`) et `doGet ?action=lowprice`.

### Changed
- **Renommage « Suivi E85 » → « Suivi Conso. Carburants »** :
  - Rapport mensuel envoyé (`RapportMensuel.gs`) — sujet de l'e-mail, nom de l'expéditeur (`name`) et en-têtes HTML (`<h2>`).
  - App / page web — `<title>`, `apple-mobile-web-app-title`, `footer` (`index.html` + miroir GAS), `name`/`short_name`/`description` du `manifest.json`, `setTitle()` de `Code.gs`.
- **`js/config.js`** — `APP_VERSION` → `3.4.0.0` ; nouvelle constante `VAPID_PUBLIC_KEY` (vide par défaut → push désactivé, alertes locales conservées).

### Fixed
- **Carte « Stations E85 habituelles » — marqueurs invisibles** (`js/stationsmap.js`) : seules les stations dont les coordonnées étaient en cache (sélectionnées via géoloc) apparaissaient ; les stations saisies autrement n'avaient aucun marqueur. Ajout d'un **géocodage de secours** (`_geocodeMissing`) — la ville est extraite du nom de station, résolue via l'API gouv, mise en cache, puis la carte est re-rendue avec tous les marqueurs.

### Note
- Le **rapport mensuel est consultable dans l'app** depuis la v3.3.0.x (carte « 📅 Rapport mensuel » avec sélecteur de mois, `js/stats.js` `renderRapportMensuel`) ; le mois y est déjà au format « nom propre » (ex. « Avril 2026 »).

## [3.3.0.11] — 2026-05-30

### Fixed
- **Rapport mensuel — « Économie E85 vs SP98 » à 0 €** (`RapportMensuel.gs`) : le prix SP98 de repli n'était calculé que sur les pleins E85 **du mois** ; un mois sans prix SP98 renseigné donnait une économie nulle. Désormais calculé sur **tout l'historique**, avec deux sources (prix SP98 relevé des pleins E85 + prix payé des pleins Super 98, dont le prix est un prix SP98) — aligné sur l'app web / le `Tableau2` Excel.
- **Rapport mensuel — mois en anglais** : `Utilities.formatDate(..., 'MMMM yyyy')` suivait la locale (anglaise) du script → « April 2026 ». Nouvelle fonction `moisEnFrancais()` (libellé FR en dur, ex. « avril 2026 »), indépendante de la locale.

### Changed
- **`js/config.js`** — `APP_VERSION` → `3.3.0.11`.

## [3.3.0.10] — 2026-05-30

### Fixed
- **`SyncTableau2DepuisGS` : position de ligne robuste** (`vba/modFeatures.bas`) — le `ROW()-15` codé en dur (en-tête supposé ligne 15) cassait si la table `Tableau2` était décalée. Remplacé par `ROW()-ROW(Tableau2[#Headers])` (position calculée dynamiquement, sans numéro de ligne en dur). La formule est posée via `.Formula` (séparateurs US auto-traduits par Excel selon la locale) — ne pas la taper à la main en Excel français (séparateurs `;` + noms `SIERREUR`/`LIGNE`/`[#En-têtes]` requis).

### Changed
- **`js/config.js`** — `APP_VERSION` → `3.3.0.10`.

## [3.3.0.9] — 2026-05-30

### Added
- **`Tableau2` (Suivi Carburant) = vue dérivée de `GS_Pleins`** (`vba/modFeatures.bas` `SyncTableau2DepuisGS`) : les 6 colonnes **brutes** (Date, Type, Km compteur, Nb. Litres, Prix €/L, Station essence) sont tirées de `GS_Pleins` par formules `INDEX` ; les 9 colonnes de **calcul** (N°, Nb. km, Coût c€/km, Coût Plein, Conso L/100km, Prix S98 jour, Coût équiv. S98, Économie plein, Économie cumulée) sont **conservées intactes**. Le nombre de lignes de `Tableau2` est aligné sur `GS_Pleins`. L'onglet « Suivi Carburant » est conservé. Appelé par `RafraichirFeatures` **et** automatiquement après chaque `EnregistrerPlein` (les deux formulaires).
- **`VerifierInstallation`** (`vba/modFeatures.bas`) : contrôle la présence des feuilles/tableaux requis (`GS_Pleins`, `Suivi Carburant`/`Tableau2`, `Notes`/`tbl_stationEssence`, `Vehicules`, `Suivi (auto)`) et affiche le bilan dans la barre d'état + l'Immediate Window.
- **`INSTALL.md`** : récapitulatif complet d'installation/mise à jour (modules VBA, formulaires, GAS, vérification, schéma d'architecture des données).

### Changed
- **`modSaisie.EnregistrerPlein`** déclenche `modFeatures.SyncTableau2DepuisGS` en fin d'enregistrement (vue `Tableau2` toujours à jour, zéro double saisie).
- **`js/config.js`** — `APP_VERSION` → `3.3.0.9`.

## [3.3.0.8] — 2026-05-30

### Added
- **`frmNouveauPlein` — sélecteur de véhicule multi-véhicules** (`cmbVehicule`) : peuplé par `modSaisie.RemplirCombo` (feuille `Vehicules` ∪ valeurs distinctes de `GS_Pleins` col H), pré-sélection du dernier véhicule utilisé (`DernierVehicule`). Le véhicule choisi est enregistré en col H de `GS_Pleins` ; validation « Choisissez un véhicule » ajoutée.

### Changed
- **`js/config.js`** — `APP_VERSION` → `3.3.0.8`.

## [3.3.0.7] — 2026-05-30

### Added
- **`vba/frmNouveauPlein.frm` + `.frx`** versionnés dans le repo (formulaire de saisie personnalisé de l'utilisateur, présentation conservée).
- **`modSaisie.EnregistrerPlein` — paramètre optionnel `prixS98Str`** → écrit le prix SP98 du jour dans la colonne **J « SP98 station (€/L) »** de `GS_Pleins` (rétro-compatible : `frmPleinE85` ne le fournit pas).
- **`modSaisie.DernierVehicule()`** — renvoie le véhicule du dernier plein de `GS_Pleins` ; sert de valeur par défaut aux formulaires sans sélecteur de véhicule.

### Changed
- **`frmNouveauPlein` enregistre désormais au même endroit que `frmPleinE85`** : le bouton « Enregistrer » écrit dans **`GS_Pleins`** (via `modSaisie.EnregistrerPlein`, avec `Horodatage` + `sync_id` UUID + détection de doublon) **au lieu de** `Suivi Carburant`/`Tableau2`. Le prix S98 du jour va en col J, le véhicule = dernier connu. Présentation, formatage de date, coût live et chargement des stations (`Notes`/`tbl_stationEssence`) **inchangés**.
- **`js/config.js`** — `APP_VERSION` → `3.3.0.7`.

## [3.3.0.6] — 2026-05-30

### Fixed
- **Formulaire de saisie : « Erreur de compilation : Instruction d'option dupliquée »** (`vba/modSaisie.bas`) — quand le VBE a « Déclaration des variables obligatoire » activé, le module de code du UserForm `frmPleinE85` nouvellement créé contient déjà un `Option Explicit`, et `InjecterCode` en ajoutait un second. Correctif : le module de code est vidé (`DeleteLines`) avant `AddFromString`, garantissant un seul `Option Explicit`.

### Changed
- **`js/config.js`** — `APP_VERSION` → `3.3.0.6`.

## [3.3.0.5] — 2026-05-30

### Fixed
- **MFC « Prix €/L » : « Colonnes introuvables sur GS_Pleins »** (`vba/modFeatures.bas`) — `DetecterColonnes` exigeait des en-têtes exacts (`date`, `type`) et un prix contenant `/l`. Détection assouplie : Date = `date` ou contient « date » (hors « horodatage ») ; Type = contient « type » ou « carburant » ; Prix = contient « prix » (hors station/S98/SP98), priorité aux en-têtes avec « /l » et repli sinon. Plage de scan élargie (25 lignes × 40 colonnes).
- **Diagnostic d'échec amélioré** — en cas de non-détection, l'Immediate Window (Ctrl+G) liste désormais les index trouvés (Date/Type/Prix) **et** le contenu réel de la ligne d'en-tête (helper `ListerEntetes`).

### Changed
- **`js/config.js`** — `APP_VERSION` → `3.3.0.5`.

## [3.3.0.4] — 2026-05-30

### Changed
- **Barre d'état généralisée + réutilisation du helper existant** : tous les `MsgBox` non bloquants des modules VBA convertis en `Application.StatusBar` via le helper **public `SetStatus`** déjà présent dans `ModuleImportGS.bas` (suppression du doublon `Statut` créé en v3.3.0.3 dans `modFeatures.bas`).
  - `modFeatures.bas` : appelle désormais `SetStatus` (plus de helper local).
  - `modSaisie.bas` : erreur + message « Plein enregistré » → barre d'état.
  - `modDashboard.bas` : 7 messages (feuille/tableau absent, bilan KPIs, données absentes, « Graphiques mis à jour ») → barre d'état.
  - `ModuleImportGS.bas` : messages d'import, nettoyage doublons, réseau/HTTP et diagnostic → barre d'état ; `Fin:` ne réinitialise plus la barre pour laisser le message final/erreur visible.
  - `GS_Pleins_snippet.bas` : alertes inline km rétrograde [F3] et doublon [F4] → barre d'état (condensées sur une ligne).
- **`MsgBox` conservés uniquement pour les décisions/gates bloquants** : confirmation doublon (Oui/Non), confirmation « Réinitialiser l'import ? » (Oui/Non), et instructions d'activation de l'« Accès au modèle objet VBA ».
- **`js/config.js`** — `APP_VERSION` → `3.3.0.4`.

## [3.3.0.3] — 2026-05-30

### Changed
- **Messages en barre d'état plutôt que MsgBox** (`vba/modFeatures.bas`) : tous les `MsgBox` (succès, erreurs non bloquantes) remplacés par un helper `Statut` qui écrit dans `Application.StatusBar` (retour discret, non bloquant, sans clic). `RafraichirFeatures`, `AppliquerMFCPrix` et `CreerSuiviAuto` n'interrompent plus le flux.
- **`js/config.js`** — `APP_VERSION` → `3.3.0.3`.

## [3.3.0.2] — 2026-05-30

### Fixed
- **MFC « Prix €/L » — Erreur 5 « Argument ou appel de procédure incorrect » en Excel français** (`vba/modFeatures.bas`) : `FormatConditions.Add` interprète `Formula1` selon les paramètres régionaux ; la formule `AVERAGEIFS`/`AND` construite avec des virgules (séparateur US) était rejetée. Ajout des helpers `AjouterRegleMFC` (essaie la formule anglaise puis sa version localisée en repli) et `TraduireFormuleLocale` (traduction via `FormulaLocal` d'une cellule tampon). MFC désormais robuste FR/US, sans crash.

### Changed
- **`js/config.js`** — `APP_VERSION` → `3.3.0.2`.

## [3.3.0.1] — 2026-05-30

### Changed
- **`README.md`** — bloc `oauthScopes` du manifeste `appsscript.json` complété pour le rapport mensuel (X16) : ajout de `script.scriptapp` (déclencheurs), `script.send_mail` (`MailApp.sendEmail`) et `userinfo.email` (`Session.getEffectiveUser`), + tableau récapitulatif scope → usage.
- **`js/config.js`** — `APP_VERSION` → `3.3.0.1`.

### Fixed
- **Doc dépannage** — nouvelle entrée pour l'erreur `Specified permissions are not sufficient to call ScriptApp.getProjectTriggers` rencontrée à l'exécution de `installerTriggerRapportMensuel()` : cause (scopes figés non autorisés) + correction en 4 étapes (manifeste → ré-autorisation, sans redéploiement).

## [3.3.0.0] — 2026-05-30

### Added
- **Mise en forme conditionnelle « Prix €/L » (X4)** — `vba/modFeatures.bas` : `AppliquerMFCPrix` colore la colonne Prix en **vert** si le prix de la ligne est inférieur à la moyenne des 30 jours précédents pour le **même carburant**, en **rouge** s'il est supérieur. Appliquée sur `GS_Pleins` **et** `Suivi Carburant` (détection des colonnes Date/Type/Prix par en-tête, formule `AVERAGEIFS` glissante).
- **Onglet « Suivi (auto) » — vue dérivée (X14)** — `vba/modFeatures.bas` : `CreerSuiviAuto` reconstruit une table en **lecture seule** (formules `INDEX` sur le tableau de `GS_Pleins`) : Date, Type, Véhicule, Km, Nb km, Litres, Prix, Coût plein, L/100 km, Station. Source unique de vérité, plus de double saisie. Bouton « ↻ Rafraîchir » intégré ; `RafraichirFeatures` lance MFC + vue d'un coup.
- **Formulaire de saisie d'un plein** — `vba/modSaisie.bas` : `NouveauPlein` construit par code le UserForm `frmPleinE85` (Véhicule/Carburant/Date/Km/Litres/Prix/Station) avec listes déroulantes auto (feuilles `Vehicules`/`Stations` ∪ valeurs distinctes de `GS_Pleins`), coût live, **validation km rétrograde** + **détection de doublon** (date+km+litres), puis ajoute la ligne dans `GS_Pleins` avec `Horodatage` + `sync_id` UUID. `AjouterBoutonSaisie` place un bouton « + Nouveau plein ». Nécessite « Accès approuvé au modèle objet du projet VBA ».
- **Rapport mensuel automatique (X16)** — `Google Apps Script/RapportMensuel.gs` : trigger temporel le **1er du mois** → `MailApp.sendEmail()` avec le bilan du mois écoulé (nb pleins, total €, litres, distance, conso moyenne, économie E85 vs SP98 surconsommation +20 % incluse). `installerTriggerRapportMensuel()` à exécuter une fois ; `testRapportMensuel()` pour tester ; destinataire = compte du script (ou `RAPPORT_EMAIL`).

### Changed
- **`js/config.js`** — `APP_VERSION` → `3.3.0.0`.

## [3.2.0.1] — 2026-05-29

### Added
- **Champ « Prix du kit E85 » visible dans la carte ⚙️ Paramètres** (`#kitPrix`, style `seuil-row`, sous le seuil d'alerte) — permet d'ajuster le prix du kit qui sert au calcul de l'économie nette. La v3.2.0.0 avait livré la logique mais le champ HTML n'avait pas été inséré (ancre introuvable).

### Fixed
- **`js/config.js`** — `APP_VERSION` → `3.2.0.1`.

## [3.2.0.0] — 2026-05-29

### Added
- **Économie nette E85 (kit déduit)** — ligne « 💰 Économie nette » : économie brute − prix du kit (réplique J31 Excel).
- **Champ « Prix du kit E85 (€) »** dans Paramètres (#kitPrix), localStorage suivi_e85_kit_prix, défaut **514,54 €** (cellule B5).
- **getKitPrix(), computeSurconso(), initKitSetting()** (js/stats.js) ; DEFAULT_SURCONSO, KIT_PRIX_KEY, DEFAULT_KIT_PRIX (js/config.js).

### Changed
- **Calcul économie fidèle au dashboard Excel** (feuille « Suivi Carburant ») : surconsommation E85 dynamique (conso E85 / conso S98 − 1, cellule J7, défaut 20 %), litres SP98 équiv. = litres / (1 + surconso) (corrige ~124 € → ~106 €) ; brute = Σ coût équiv. S98 − Σ coût E85 (J29 − B35 = J30) ; 4e tuile « éco. brute E85 ».

### Fixed
- **js/config.js** — APP_VERSION → 3.2.0.0.

## [3.1.0.13] — 2026-05-29

### Added
- **Sparkline multi-carburant : bouton 🔄 rechargement forcé** — un bouton "🔄" apparaît dans l'en-tête du graphique Prix carburants. Un clic vide le cache localStorage (`suivi_e85_hist_cache` + `suivi_e85_hist_since`) et force un rechargement complet depuis le GAS, garantissant que toutes les colonnes de prix (SP95, E10, Gazole, GPLc) sont à jour.
- **`forceRefreshHistorique()`** (`js/historique.js`) — nouvelle fonction exportée qui purge le cache différentiel et relance `chargerHistorique()`.

### Changed
- **Seuil d'affichage du sparkline abaissé à 1 point** — un carburant (SP95, E10, Gazole, GPLc…) apparaît désormais comme toggle dès qu'il possède **au moins 1 point de donnée** dans l'historique (au lieu de 2), évitant que les données récentes soient invisibles.

### Fixed
- **`js/config.js`** — `APP_VERSION` → `3.1.0.13`.

## [3.1.0.12] — 2026-05-29

### Changed
- **Excel — déduplication immunisée contre les dates** : la clé `PleinKey` ne dépend plus de la date (qui pouvait être mal parsée par l'ancien module et créer des doublons), mais de **`km | litres | prix`**. Le compteur kilométrique étant strictement croissant, il identifie un plein de façon fiable indépendamment du format de date.

### Added
- **`NettoyerDoublons()`** (`vba/ModuleImportGS.bas`) : macro qui supprime les doublons déjà présents dans le tableau *Suivi Carburant* (clé `km|litres|prix`), en conservant la **première occurrence** (la ligne d'origine, bien datée) et en supprimant les copies plus bas (ex. lignes réimportées avec une mauvaise date par l'ancien module). À lancer une fois via `Alt+F8`.

### Fixed
- **`js/config.js`** — `APP_VERSION` → `3.1.0.12`.

## [3.1.0.11] — 2026-05-29

### Fixed
- **Excel — doublons à l'import** : la déduplication reposait sur un repère d'horodatage (`Z1`), or la colonne *Horodatage* du Google Sheet est incohérente (la plupart des lignes n'ont pas d'heure) → repère inexploitable, l'import re-ajoutait des pleins déjà présents. Remplacé par une **déduplication par contenu** (`PleinKey` = `date|km|litres`) : un index des pleins déjà présents dans la table *Suivi Carburant* est construit avant la boucle, et chaque ligne entrante déjà connue est ignorée (y compris les doublons au sein d'un même lot). L'import devient idempotent quel que soit l'état de `Z1`.
- À **réimporter** dans le classeur (`vba/ModuleImportGS.bas`).

### Changed
- **`js/config.js`** — `APP_VERSION` → `3.1.0.11`.

## [3.1.0.10] — 2026-05-29

### Fixed
- **Excel — dates des pleins importés à `02/01/1900`** : le CSV gviz renvoie la colonne *Date* au format US **avec l'heure** (`5/22/2026 2:00:00`). `ParseGoogleDate` (dans `ModuleImportGS`) ne retirait pas l'heure pour le format à slashes → `CLng("2026 2:00:00")` échouait → date de repli `1900`. De plus la branche « ambiguë » supposait J/M/A alors que gviz renvoie **M/J/A**. Corrigé : suppression de la partie heure (séparateur espace, comme pour `T`) + interprétation M/J/A (mois en premier). Vérifié sur les 10 pleins (dont le cas ambigu `5/4/2026` → 04/05/2026).
- À **réimporter** dans le classeur (`vba/ModuleImportGS.bas`).

### Changed
- **`js/config.js`** — `APP_VERSION` → `3.1.0.10`.

## [3.1.0.9] — 2026-05-29

### Changed
- **Encart « 📵 Mode hors-ligne » affiché uniquement hors-ligne** : auparavant toujours visible dans les Paramètres, il n'apparaît désormais que lorsque l'appareil est réellement hors-ligne (`navigator.onLine === false`), et disparaît au retour du réseau.

### Added
- Feedback « 📵 Hors-ligne » au passage hors-ligne (événement `offline`), en complément du « 🌐 Connexion rétablie » existant.

### Fixed
- **`index.html`** — la ligne `#offlineRow` est `hidden` par défaut.
- **`js/offline.js`** — nouvelle `updateOfflineRow()` (bascule selon `navigator.onLine`) appelée à l'init et sur les événements `online`/`offline`.
- **`js/config.js`** — `APP_VERSION` → `3.1.0.9`.

## [3.1.0.8] — 2026-05-29

### Fixed
- **Excel — « Import échoué : Erreur 13 Incompatibilité de type »** : `ModuleImportGS.ImporterNouveauxPleins` lisait le prix SP98 dans la **colonne 7** (mapping hérité de l'ancienne colonne G « Prix S98 jour » supprimée en v2.3). Or la colonne 7 de l'export est désormais **« Station essence »** (texte) → `ToDouble("E.Leclerc - Beuvry")` levait l'erreur 13 et l'import entier échouait. Conséquence cachée : l'import plantant **avant** l'appel final `SyncStationsVersGoogleSheets`, la liste curée des stations n'était jamais repoussée vers le Google Sheet (d'où sa « disparition »).
- Correctifs (`vba/ModuleImportGS.bas`, à **réimporter** dans le classeur) : (1) le prix SP98 est lu depuis la colonne **détectée par en-tête** (« SP98 station (€/L) »), jamais la colonne 7 ; (2) `ToDouble()` est blindé (`On Error` → 0) et ne peut plus jamais lever d'erreur 13 sur du texte.

### Changed
- **`js/config.js`** — `APP_VERSION` → `3.1.0.8`.
- **`vba/ModuleImportGS.bas`** — module exporté du classeur dans le dépôt (était auparavant uniquement interne au `.xlsm`).

## [3.1.0.7] — 2026-05-29

### Added
- **Liste des stations à jour automatiquement (GS ∪ historique + push Excel)** : le menu déroulant « Stations habituelles » se construit désormais à partir de **l'union** des stations curées (feuille « Stations » du Google Sheet) **et** des stations réellement vues dans l'historique des pleins — la liste ne peut donc plus « disparaître ». En parallèle, la synchro Excel (VBA `modSyncGS`) pousse à chaque exécution le tableau `tbl_stationEssence` (onglet *Notes*) vers la feuille « Stations » du GS (action `syncStations`).

### Changed
- **`js/stations.js`** — réécrit : `chargerStations()` mémorise la liste curée (`_gsStations`) ; nouvelle `mergeHistoryStations()` (stations de l'historique) ; `_renderStationOptions()` fusionne, déduplique (insensible à la casse) et trie ; `syncStationSiNouvelle()` met à jour l'état interne.
- **`js/main.js`** — après `chargerHistorique()`, appel de `mergeHistoryStations(getAllRecords()…)`.
- **`vba/modSyncGS.bas`** — nouvelle `PushStationsToGS()` (lit `tbl_stationEssence`, pousse via `syncStations` avec en-tête en ligne 1) + helper `JEsc()` ; appelée dans `SyncCore` (Direction 3) ; bilan enrichi.
- **`js/config.js`** — `APP_VERSION` → `3.1.0.7`.

### Fixed
- Restauration de la liste des 6 stations curées (perdue côté Google Sheet) : `Carrefour - Flers`, `E.Leclerc - Beuvry`, `Intermarché`, `Leclerc - Douai`, `Total Access`, `Total Waziers`.

## [3.1.0.6] — 2026-05-29

### Fixed
- **Suppression d'un plein : « Plein introuvable (sync_id inconnu) »** — `handleDeletePlein()` retrouvait le `sync_id` via un index de colonne codé en dur (14). Or `handleExport()` (qui alimente le `sync_id` côté client) lit la colonne **par son en-tête**. Si la colonne `sync_id` n'est pas exactement en position O, la correspondance échouait. La suppression recherche désormais la colonne `sync_id` par en-tête (repli sur l'index 14) et compare les valeurs après `trim()`. Version backend → `v3.1.0.6`. ⚠️ Nécessite un **redéploiement** de l'application web.
- **`js/config.js`** — `APP_VERSION` → `3.1.0.6`.

## [3.1.0.5] — 2026-05-29

### Added
- **Suppression d'un plein (UI + Google Sheet)** : chaque entrée de l'historique (liste des 5 derniers pleins et historique complet) affiche désormais un bouton 🗑️. Au clic, une confirmation est demandée, puis la ligne correspondante est supprimée dans le Google Sheet `_ImportGS` (action `deletePlein`, recherche par `sync_id` colonne O) ainsi que du cache local et de l'affichage. Les statistiques et la carte des stations sont rafraîchies.

### Changed
- **`js/historique.js`** — bouton 🗑️ (`data-sync-id`) ajouté à `renderItem()` ; nouvelles fonctions `initHistoireDelete()` (délégation sur `#historiqueList` et `#histoireFullList`) et `_renderLists()` (réaffichage après suppression).
- **`js/main.js`** — import et appel de `initHistoireDelete()`.
- **`Code.gs`** — nouvelle action `deletePlein` + fonction `handleDeletePlein(ss, syncId)` (suppression de la ligne par `sync_id`, col O index 14). Version backend → `v3.1.0.5`. ⚠️ Nécessite un **redéploiement** de l'application web.
- **`css/style.css`** — style `.hist-delete` (calqué sur `.hist-share`).
- **`js/config.js`** — `APP_VERSION` → `3.1.0.5`.

## [3.1.0.4] — 2026-05-29

### Added
- **Station reconnue → recherche automatique des prix carburant + format "Enseigne - Ville"** : Gemini renvoie désormais `enseigne` et `ville` séparément. `fillFormFromTicket()` résout la station en 3 temps : (1) si elle existe dans la liste déroulante → sélection + prix GPS ; (2) sinon recherche ODS de la commune (`_findStationInCommune`) → coordonnées de la station → `fetchPricesAtCoords()` peuple les prix sur les boutons carburant ; (3) sinon saisie manuelle avec le nom composé via `composeStationName()` (ex. « Carrefour - Flers »). Fini le message « Aucune commune trouvée » déclenché par l'envoi du nom complet dans le champ de recherche.
- Le prix payé lu sur le ticket est désormais réinjecté **après** la recherche des prix station, pour qu'il ne soit pas écrasé par le prix ODS courant (qui sert, lui, à alimenter les boutons).

### Changed
- **`Code.gs`** — prompt Gemini : ajout des champs `enseigne` (enseigne seule) et `ville` (commune seule) dans le JSON, en plus de `station`. Version backend → `v3.1.0.4`.
- **`js/ticket.js`** — `fillFormFromTicket()` devient asynchrone ; nouvelles fonctions `applyTicketStation()` et `_findStationInCommune()` ; ordre des champs réagencé (station avant prix).
- **`js/config.js`** — `APP_VERSION` → `3.1.0.4`.

## [3.1.0.3] — 2026-05-29

### Added
- **Station reconnue toujours reportée dans le formulaire** : Gemini lit déjà l'enseigne (ex. « Carrefour Flers-en-Escrebieux »), mais `fillFormFromTicket()` ne remplissait le champ Station que si elle existait déjà dans la liste déroulante. Désormais, si la station lue n'y figure pas, le formulaire bascule automatiquement en **saisie manuelle** (`__autre`) et reporte le nom détecté dans le champ `fAutre`. Le nom n'est plus perdu.

### Changed
- **`js/config.js`** — `APP_VERSION` → `3.1.0.3`.

## [3.1.0.2] — 2026-05-29

### Fixed
- **`Code.gs`** — scan Gemini renvoyait « Réponse non parseable » avec `gemini-2.5-flash` : ce modèle « thinking » consommait tout `maxOutputTokens: 512` en jetons de réflexion, laissant le texte de réponse vide. Correction : `thinkingConfig.thinkingBudget = 0` (désactive le thinking) + `maxOutputTokens` porté à `1024`. Version backend → `v3.1.0.2`.
- **`js/config.js`** — `APP_VERSION` → `3.1.0.2`.

## [3.1.0.1] — 2026-05-29

### Changed
- **`Code.gs`** — `handleScanTicket()` : modèle Gemini `gemini-2.0-flash` → **`gemini-2.5-flash`**. Le free tier de `gemini-2.0-flash` renvoyait `RESOURCE_EXHAUSTED` avec `limit: 0` sur certains projets ; bascule vers le modèle 2.5 dont le quota gratuit est attribué séparément. Version backend → `v3.1.0.1`.
- **`js/config.js`** — `APP_VERSION` → `3.1.0.1`.

## [3.1.0.0] — 2026-05-29

### Added
- **W17 — Gemini 2.0 Flash réactivé comme moteur principal de scan** : le scan de ticket utilise désormais l'IA vision **Gemini 2.0 Flash** (via GAS `action=scanTicket`) en priorité, avec **Tesseract.js en fallback** automatique (hors-ligne ou si Gemini échoue : clé absente, quota, réseau). Gemini comprend le contexte du ticket et lit les tickets froissés, flous ou mal cadrés bien mieux que l'OCR par regex. Clé API gratuite sur [aistudio.google.com](https://aistudio.google.com) (1 500 req/jour), stockée côté GAS (`GEMINI_API_KEY`), jamais exposée au client.
- **`scanWithGemini()`** dans `js/ticket.js` — POST vers `GAS_URL` (même pattern fetch que le reste de l'app, sans header pour éviter le preflight CORS) ; normalise le JSON renvoyé (nombres en chaînes → `Number`) pour qu'il ait la même forme que `parseOCRText()`.

### Changed
- **`js/ticket.js`** — `initScanner()` : nouvelle séquence Gemini → fallback Tesseract ; bouton affiche "⏳ Analyse IA…" pendant l'appel Gemini. La photo couleur (W9) est envoyée à la fois à Drive et à Gemini.
- **`Code.gs`** — `handleScanTicket()` : modèle `gemini-1.5-flash` (`/v1/`) → **`gemini-2.0-flash`** (`/v1beta/`) ; prompt enrichi (tickets abîmés, libellés français Quantite/Prix unit., années 2 chiffres, exclusion TVA, contrôle de cohérence litres × prix ≈ total) ; parsing JSON robuste (retrait des clôtures markdown ```json). Version backend → `v3.1.0.0`.
- **`js/config.js`** — `APP_VERSION` → `3.1.0.0`.

## [3.0.1.1] — 2026-05-28

### Fixed
- **Litres — "Quantite" sans accent** : ajout de `quantite` et `qte` (variantes non accentuées fréquentes après OCR) dans le pattern de label volume. Permet de lire `Quantite = 13.23 L` sur les tickets Carrefour/TPE.
- **Prix — "Prix unit." abrégé** : pattern ③ étendu à `prix\s+unit(?:aire)?\.?` pour capturer les formats `Prix unit. = 0,849 EUR` sans le mot "unitaire" complet.
- **`js/config.js`** — `APP_VERSION` → `3.0.1.1`.

## [3.0.1.0] — 2026-05-28

### Added
- **`FRENCH_MONTHS`** — table de correspondance noms de mois français → MM, utilisée pour détecter les dates textuelles (ex. "15 janvier 2024", "15 jan. 2024").
- **`preprocessImage()`** — nouvelle fonction de prétraitement OCR : conversion en niveaux de gris + courbe S de contraste (facteur 1,4) + résolution max portée à 1 600 px (vs 1 200 px auparavant). La photo couleur pour Drive passe toujours par `resizeImage()` (inchangée).
- **`normalizeNumericText()`** — corrige les substitutions Tesseract les plus fréquentes dans les séquences numériques : O → 0 et S → 5 (uniquement entre chiffres, sans risque de corrompre le texte).

### Changed
- **`js/ticket.js`** — `parseOCRText()` amélioré :
  - **Date** : 4 niveaux de fallback (DD/MM/YYYY → YYYY-MM-DD → DD/MM/YY 2 chiffres → mois français littéral).
  - **Litres** : 5 patterns (ajout "LITRES 42,58" label avant nombre + ligne débutant par quantité × prix).
  - **Prix/L** : ajout pattern ⑥ — libellé carburant suivi du prix sur la même ligne (ex. "SuperEthanol E85 0,798").
  - **Total** : ajout pattern "RÈGLEMENT / SOLDE" (certains TPE).
  - **Station** : ajout AVIA, Netto, Agip, Gulf, Total Access, E.Leclerc, Géant Casino ; filtre `isPriceLine` pour rejeter les lignes "TOTAL TTC 76,61" qui ne sont pas des noms de station.
  - **Km** : ajout tentative 3 — séparateur milliers point (ex. "87.450 km") ; libellé "index" reconnu.
  - Toutes les extractions numériques utilisent `normText` (texte après correction O/S).
- **`js/ticket.js`** — `initScanner()` : OCR sur `ocrBlob` (prétraité) ; photo Drive stockée séparément depuis `blob` couleur.
- **`js/config.js`** — `APP_VERSION` → `3.0.1.0`.

### Fixed
- **Station "TOTAL TTC"** : la ligne de total du ticket n'est plus confondue avec le nom de la station TotalEnergies grâce au filtre `isPriceLine`.
- **FUEL_LABEL_MAP** : ajout `'b10'`, `'hvo'` → GAZOLE ; `'super ethanol'`, `'se-b5'` → E85.

## [3.0.0.4] — 2026-05-28

### Fixed
- **CSP `script-src` — WebAssembly bloqué** : `WebAssembly.instantiate()` de Tesseract.js était rejeté par la CSP car `'wasm-unsafe-eval'` était absent de `script-src`. Ajouté dans `index.html` et `_headers`.

### Changed
- **`index.html`** + **`_headers`** — `script-src` : ajout de `'wasm-unsafe-eval'`.
- **`js/config.js`** — `APP_VERSION` → `3.0.0.4`.

## [3.0.0.3] — 2026-05-28

### Fixed
- **CSP `script-src` / `worker-src` — scan ticket bloqué** : `importScripts()` du worker Tesseract.js était bloqué par la CSP car `https://cdn.jsdelivr.net` était absent de `script-src` (et `worker-src`). Ajouté dans les deux directives dans `index.html` et `_headers`.

### Changed
- **`index.html`** + **`_headers`** — `script-src` et `worker-src` : ajout de `https://cdn.jsdelivr.net`.
- **`js/config.js`** — `APP_VERSION` → `3.0.0.3`.

## [3.0.0.2] — 2026-05-28

### Changed
- **W33 — Prédiction prochain plein dynamique** : la carte "Prochain plein" affiche désormais le **km et le nombre de jours restants calculés depuis aujourd'hui**, et non plus l'intervalle moyen figé depuis le dernier plein. Formules : `daysLeft = avgDay − (today − lastFillUpDate)` · `kmLeft = avgKm − daysElapsed × avgKm/avgDay`. Trois états possibles : "Prochain plein dans ~X km · ~Y j" / "... · aujourd'hui" / "Plein prévu il y a Y j" (si dépassé). Le km cible absolu reste toujours visible en sous-titre.
- **`js/stats.js`** — `_computePrediction()` retourne désormais `lastDate` (date du dernier plein) ; `buildPrediction()` recalcule le restant dynamiquement à l'ouverture de l'app.
- **`js/config.js`** — `APP_VERSION` → `3.0.0.2`.

## [3.0.0.1] — 2026-05-28

### Fixed
- **Placeholder km obsolète** : le placeholder statique `"11 596"` (valeur figée dans le HTML) était confondu avec une prédiction. Remplacé par `"km compteur"` (neutre) + injection dynamique `≥ X km` après chargement de l'historique, où X est le dernier km connu du véhicule courant.
- **Warning rétrograde absent à la restauration du brouillon** : `onKmInput()` n'était pas appelé dans `restoreDraft()`, donc si un brouillon contenait un km inférieur au dernier plein, aucun avertissement n'était affiché. Corrigé.

### Changed
- **`index.html`** — `placeholder="11 596"` → `placeholder="km compteur"`.
- **`js/main.js`** — Import `getMaxKmForVehicule` depuis `historique.js` ; placeholder `fKm` mis à jour dynamiquement à `≥ X km` dans le `setTimeout` 800 ms.
- **`js/formulaire.js`** — `restoreDraft()` appelle `onKmInput()` après restauration du km.
- **`js/config.js`** — `APP_VERSION` → `3.0.0.1`.

## [3.0.0.0] — 2026-05-28

### Added
- **W35 — Pré-remplissage km + dictée vocale** : le champ "Km compteur" est pré-rempli automatiquement au démarrage avec la valeur estimée par W33 (prochain kilométrage prédit), si aucun brouillon n'est en cours. Bouton **🎤** à côté du champ : un tap lance la reconnaissance vocale (`SpeechRecognition fr-FR`), l'utilisateur dicte le kilométrage (ex. "douze mille quatre cent trente"), le champ est rempli et validé automatiquement. Le bouton pulse en rouge pendant l'écoute. Masqué automatiquement sur les navigateurs sans `SpeechRecognition`. Conçu pour les utilisateurs portant des gants (moto).

### Changed
- **`js/stats.js`** — Refactoring `buildPrediction()` : extraction de `_computePrediction(veh)` (helper partagé retournant `{ avgKm, avgDay, lastKm, nextKm, count }` ou `null`) ; nouvelle export `getNextKmPrediction()` pour le pré-remplissage du champ km (W35).
- **`js/formulaire.js`** — Ajout `initVoiceKm()` (W35) : `SpeechRecognition fr-FR`, parser `_parseSpeechToNumber()` (chiffres directs + mots français courants), gestion état `mic-active`, appels `onKmInput()` / `checkDuplicate()` / `saveDraft()` après reconnaissance.
- **`js/main.js`** — Imports `initVoiceKm` + `getNextKmPrediction` ; pré-remplissage `fKm` dans le `setTimeout` 800 ms (W35) ; appel `initVoiceKm()` dans la séquence d'init.
- **`index.html`** — Champ `fKm` enveloppé dans `.km-input-wrap` avec bouton `#voiceKmBtn`.
- **`css/style.css`** — Styles `.km-input-wrap`, `.voice-btn`, `.voice-btn.mic-active`, animation `@keyframes mic-pulse` ; icône SVG mic style iOS (`currentColor`, rouge pendant l'écoute).
- **`js/config.js`** — `APP_VERSION` → `3.0.0.0`.

## [2.17.0.0] — 2026-05-28

### Added
- **W34 — Sparkline multi-carburant avec filtres** : le mini-graphique SVG des prix évolue d'une courbe E85 unique vers un graphique multi-séries affichant simultanément jusqu'à 6 carburants (E85, SP98, SP95, E10, Gazole, GPLc). Nouvelle fonction `buildPrixSparkline()` (remplace `buildE85Sparkline()`), `buildFuelSeries()` pour extraire et dédupliquer les séries par carburant, et `initSparkToggles()` (délégation sur `#statsBox`) pour activer/désactiver les carburants. Axe temporel partagé (`date.getTime()`) pour aligner toutes les courbes. Chaque carburant a sa couleur via la propriété CSS `--spark-color`. Les fuels actifs sont persistés en localStorage (`suivi_e85_spark_fuels`). Seuls les carburants avec ≥ 2 points de données affichent un toggle. La sélection vide est impossible (au moins un carburant reste actif).

### Changed
- **`js/stats.js`** — `buildE85Sparkline()` remplacée par `buildPrixSparkline()` + `buildFuelSeries()` ; ajout constantes `SPARK_KEY`, `SPARK_COLORS`, `FUEL_PRICE_COL` ; export `initSparkToggles()`.
- **`js/main.js`** — Import `initSparkToggles` depuis `stats.js` ; appel `initSparkToggles()` dans la séquence d'init.
- **`js/config.js`** — `APP_VERSION` → `2.17.0.0`.
- **`css/style.css`** — Ajout styles `.spark-toggles`, `.spark-toggle`, `.spark-toggle.active`, `.spark-footer`, `.spark-price-tag`, `.spark-empty`.

## [2.16.0.0] — 2026-05-28

### Added
- **W26 — Web Share API** : bouton 📤 sur chaque entrée historique → partage les détails d'un plein (type, litres, prix/L, station, date) via le menu natif iOS/Android. Détection de support : si `navigator.share` n'est pas disponible (desktop Chrome…), les boutons sont masqués via CSS (`body.no-share`). Délégation d'événements sur `#historiqueList` et `#histoireFullList` via `initHistoireShare()`.
- **W15 — Auto-save brouillon** : à chaque frappe dans le formulaire (km, litres, prix, station, date, saisie manuelle), le brouillon est sauvegardé en localStorage (`suivi_e85_draft`). Au prochain chargement, il est restauré automatiquement après 800 ms (délai permettant aux stations de se charger) avec toast "📝 Brouillon restauré". Effacé après soumission réussie ou réinitialisation du formulaire via `clearDraft()`.
- **S7 — Rate limiting côté GAS** : `rateLimit(cid)` dans `Code.gs` — max 10 requêtes/min par client via `CacheService.getScriptCache()`, clé `rl_<cid>_<minute>`, TTL 90 s. L'app génère et persiste un UUID client (`suivi_e85_client_id`) via `crypto.randomUUID()` et l'envoie dans chaque payload GAS (`cid`). GAS retourne `{ success: false, error: 'Trop de requêtes…' }` si le quota est dépassé.
- **S9 — Audit dépendances npm** : job `audit` ajouté dans `.github/workflows/ci.yml` (`npm audit --audit-level=moderate`, non-bloquant `continue-on-error: true`). Nouveau fichier `.github/dependabot.yml` : MAJ npm hebdomadaires (lundi 09h00 Europe/Paris) + github-actions mensuellement.

### Changed
- **`js/config.js`** — Ajout de `DRAFT_KEY = 'suivi_e85_draft'` et `CLIENT_ID_KEY = 'suivi_e85_client_id'` ; `APP_VERSION` → `2.16.0.0`.
- **`js/formulaire.js`** — Fonctions `saveDraft()`, `restoreDraft()`, `clearDraft()` exportées (W15) ; `_getClientId()` pour le rate limiting (S7) ; `submitForm()` inclut `cid` dans le payload ; `resetForm()` appelle `clearDraft()` et `updateRentabilite()`.
- **`js/historique.js`** — `renderItem()` : ajout bouton `.hist-share` avec attributs `data-share-*` ; `initHistoireShare()` exportée (W26) avec détection `navigator.share` et délégation sur `#historiqueList` + `#histoireFullList`.
- **`js/main.js`** — Imports `saveDraft`, `restoreDraft` depuis `formulaire.js` ; import `initHistoireShare` depuis `historique.js` ; import `showFeedback` depuis `ui.js` ; `setTimeout` 800 ms pour restauration du brouillon ; `saveDraft()` ajouté aux listeners `fDate`, `fKm`, `fLitres`, `fPrix`, `stationSel`, `fAutre` ; appel `initHistoireShare()`.
- **`css/style.css`** — Styles `.hist-share` et `.hist-share:active` dans `.hist-row1` ; règle `body.no-share .hist-share { display: none }`.
- **`Code.gs`** — Fonction `rateLimit(cid)` (S7) ; appel dans `doPost` avant l'enregistrement d'un plein ; version → `v2.16.0.0`.
- **`.github/workflows/ci.yml`** — Ajout job `audit` (S9).
- **`.github/dependabot.yml`** — Nouveau fichier Dependabot (S9).

## [2.15.0.1] — 2026-05-28

### Fixed
- **CSP `connect-src`** : ajout de `https://script.googleusercontent.com` dans la directive `connect-src` (index.html + `_headers`). Les appels GAS redirigent de `script.google.com` vers `script.googleusercontent.com` — l'absence de ce domaine bloquait silencieusement tous les fetch GAS (historique, soumission de pleins), provoquant "Failed to fetch" dans la carte "5 Derniers Pleins" et l'état "Chargement…" figé dans la carte Statistiques.
- **`js/config.js`** — `APP_VERSION` → `2.15.0.1`.

## [2.15.0.0] — 2026-05-28

### Added
- **Cache mémoire API ODS (TTL 5 min)** : les résultats de l'API prix carburants sont mis en cache dans une `Map` par clé `(lat, lon, rayon)` avec expiration 5 minutes. Élimine les appels réseau redondants quand l'utilisateur change de type de carburant sans changer de station ni de position — la réponse mise en cache est réutilisée immédiatement.
- **Content Security Policy** : en-têtes CSP ajoutés via `<meta http-equiv="Content-Security-Policy">` dans `index.html` ET via le fichier `_headers` (Netlify). Origines autorisées : `data.economie.gouv.fr`, `script.google.com`, `docs.google.com`, `overpass-api.de`, `cdn.jsdelivr.net`, `unpkg.com`, `tile.openstreetmap.org`. Règles complémentaires : `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy: strict-origin-when-cross-origin`, `Permissions-Policy: geolocation=(self), camera=(self)`.
- **Sync différentielle `?since=`** : le GAS accepte désormais `?action=export&since=ISO_TIMESTAMP` et ne retourne que les enregistrements dont l'`Horodatage` (col A) est postérieur à `since`. L'app web stocke le timestamp de la dernière sync en localStorage (`suivi_e85_hist_since`) et passe ce paramètre à chaque chargement d'historique, évitant de retélécharger l'intégralité des données à chaque session.
- **Cache localStorage historique** : `chargerHistorique()` conserve l'ensemble des enregistrements en localStorage (`suivi_e85_hist_cache`). En cas d'erreur réseau, l'historique en cache est affiché en fallback plutôt qu'un message d'erreur vide.

### Changed
- **`js/prix.js`** — Ajout de `_odsCache` (Map), `_ODS_TTL = 5 min`, fonctions `_ck / _cget / _cset`. `fetchPricesAtCoords()` vérifie le cache avant chaque appel fetch et l'alimente en cas de succès.
- **`js/historique.js`** — Import de `HIST_CACHE_KEY` / `HIST_SINCE_KEY` depuis `config.js` ; `chargerHistorique()` refactorisé avec helpers `_loadCache / _saveCache / _loadSince / _saveSince` ; fusion différentielle des enregistrements entrants avec le cache (déduplication par `sync_id`) ; fallback cache en cas d'erreur réseau.
- **`js/config.js`** — Ajout de `HIST_CACHE_KEY = 'suivi_e85_hist_cache'` et `HIST_SINCE_KEY = 'suivi_e85_hist_since'` ; `APP_VERSION` → `2.15.0.0`.
- **`index.html`** — Meta `Content-Security-Policy` ajoutée juste après `<meta charset>`.
- **`_headers`** — Nouveau fichier de configuration Netlify avec CSP, `X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy` et `Permissions-Policy`.
- **`Code.gs`** — `doGet` passe maintenant `e` à `handleExport(e)` ; `handleExport` filtre les lignes par `Horodatage >= since` quand le paramètre `?since=` est fourni ; retourne `{ records, since }` ; version → `v2.15.0.0`.

## [2.14.0.0] — 2026-05-28

### Added
- **W32 — Historique complet + filtres** : bouton 📜 dans la carte "Derniers pleins" ouvre une carte `#histoireFullCard` affichant tous les pleins triés du plus récent au plus ancien. Deux filtres dynamiques (véhicule et type de carburant) peuplés depuis les données réelles. Compteur "(N pleins)" affiché dans le titre. Bouton ✕ pour fermer. Auto-rafraîchi à chaque `chargerHistorique()`. Scroll interne (max 420 px).
- **W33 — Prédiction prochain plein** : bloc `prediction-box` affiché dans la carte Statistiques sous la sparkline. Calcule l'intervalle moyen en km et en jours entre les pleins consécutifs du véhicule courant (valeurs aberrantes filtrées : Δkm < 50 ou > 5 000, Δjours > 120). Affiche "Prochain plein dans ~X km · ~Y j" et l'estimation du prochain compteur. Nécessite ≥ 3 pleins avec kilométrage.

### Changed
- **`js/historique.js`** — Import `state` ajouté ; exports `voirTout`, `renderFullHistory`, `initHistoireFilters` ; `chargerHistorique()` rafraîchit `#histoireFullCard` si ouvert.
- **`js/stats.js`** — `buildPrediction()` ajouté ; appelé dans `renderStats()` après la sparkline.
- **`js/main.js`** — Import `voirTout`, `initHistoireFilters` ; handler `data-action="voirTout"` ; appel `initHistoireFilters()`.
- **`index.html`** — Bouton `data-action="voirTout"` dans `.hist-actions` ; carte `#histoireFullCard` avec filtres `#histVehFilter` / `#histTypeFilter`.
- **`css/style.css`** — Styles `.hist-full-card`, `.hist-filters`, `.hist-filter-sel`, `.hist-count`, `#histoireFullList` (W32) et `.prediction-box`, `.pred-*` (W33) avec variantes dark mode.
- **`js/config.js`** — `APP_VERSION` → `2.14.0.0`.

## [2.13.0.0] — 2026-05-27

### Added
- **W9 — Photo du ticket uploadée avec le plein** : lors du scan du ticket de caisse, l'image redimensionnée est encodée en base64 et transmise au GAS. Le GAS la sauvegarde dans un dossier Drive `Suivi E85 - Tickets`, rend le fichier public en lecture, et enregistre l'URL dans une nouvelle colonne P `Photo ticket` de la feuille `_ImportGS`. Indicateur `📷 Photo jointe` visible dans le formulaire après scan.
- **W30 — Comparateur multi-stations** : après une géolocalisation, toutes les stations ayant un prix E85 (jusqu'à 40) sont affichées dans une carte dédiée `#comparateurCard`, triées par prix E85 croissant. La station la moins chère est mise en évidence (fond vert). Les données sont conservées dans `state._geoStations`.
- **W31 — Géoloc mémorisée (localStorage)** : la dernière position et la liste des stations sont persistées en localStorage (`suivi_e85_last_geo`, TTL 1 h). Au prochain clic 📍, les stations précédentes s'affichent immédiatement pendant que la géolocalisation GPS se met à jour en arrière-plan.
- **T3 — Versioning dynamique du cache SW** : le nom du cache Service Worker (`suivi-e85-shell-v__SW_VERSION__`) est injecté avec `APP_VERSION` via un plugin Vite (`swVersionPlugin`) — en dev par middleware, en build par remplacement de chaîne dans `dist/sw.js`. Garantit l'invalidation automatique du cache à chaque version.

### Changed
- **T2 — Refactoring onclick HTML → addEventListener** : suppression de tous les `onclick=`, `oninput=`, `onchange=`, `onkeydown=` inline dans `index.html` (~20 handlers). Câblage déplacé dans les modules JS via `initStaticHandlers()`, `initTypeToggle()`, `initNearbyList()`, `initMapInteractions()`. Sélecteur CSS `[onclick]` → `[data-map-pin-idx]` dans `style.css`.
- **`js/geo.js`** — `renderNearby()` : attribut `data-nearby-idx` remplace `onclick` inline ; `renderComparateur()` génère la table `.comp-table` dans `#comparateurCard`.
- **`js/carburant.js`** — `_buildTypeToggle()` : attribut `data-fuel-key` remplace `onclick="setType(...)"` ; `initTypeToggle()` ajoute la délégation sur `#typeToggle`.
- **`js/carte.js`** — `showMap()` : `data-map-pin-idx` remplace les attributs `onclick`/`onmouseenter`/`ontouchstart` ; `initMapInteractions()` gère la délégation sur `#stationMap`.
- **`js/ticket.js`** — `blobToBase64()` helper ; après OCR, l'image base64 (sans préfixe `data:`) est stockée dans `state._ticketPhoto` et l'indicateur `#ticketPhotoIndicator` est affiché.
- **`js/formulaire.js`** — `submitForm()` : joint `payload.ticketPhoto` si disponible. `resetForm()` : efface `state._ticketPhoto` et masque `#ticketPhotoIndicator`.
- **`css/style.css`** — Ajout `.scan-info`, `.ticket-photo-badge` (W9) et styles `.comp-table` / `.comp-best` (W30) avec variantes dark mode.
- **`Code.gs`** — `HEADERS` étendu à 16 colonnes (col P `Photo ticket`) ; `getOrCreateTicketFolder()` ; upload photo base64 → Drive dans le handler plein par défaut ; `getOrCreateSheet()` migre les feuilles existantes à 15 colonnes vers 16.
- **`vite.config.js`** — Plugin `swVersionPlugin` (T3).
- **`js/config.js`** — `APP_VERSION` → `2.13.0.0`.

## [2.12.3.0] — 2026-05-27

### Fixed
- **`js/notifications.js`** — Toggle iOS browser : suppression du `disabled` sur le toggle. Le bouton répond désormais visuellement au tap (bref flash vert → retour à off) au lieu d'être silencieux. Le message d'installation `#notifIOS` s'anime en ambre pour attirer l'attention. `initNotifications()` câble toujours l'écouteur `change`, même sur iOS browser.
- **`css/style.css`** — Ajout de l'animation `.notif-flash` / `@keyframes notif-highlight` (fond ambre transitoire 1.4 s) pour mettre en évidence le message iOS quand l'utilisateur tape le toggle.

### Changed
- **`js/config.js`** — `APP_VERSION` → `2.12.3.0`

## [2.12.2.0] — 2026-05-27

### Fixed
- **`css/style.css`** — Règle globale `[hidden] { display: none !important; }` ajoutée en tête de fichier : les éléments utilisant `display: flex/grid` en CSS ne peuvent plus écraser l'attribut HTML `[hidden]`. Corrige l'affichage parasite des deux messages de notification (`#notifNoSupport`, `#notifDenied`) sur iOS Safari et le seuil d'alerte (`#notifSeuilRow`) toujours visible.
- **`js/notifications.js`** — Détection iOS en mode navigateur (`isIOSBrowser`) : sur iPhone/iPad non installé en PWA, l'API est considérée non disponible → toggle désactivé dès le chargement, aucun appel à `requestPermission()`. Supprime le comportement incohérent (toggle sans réaction, messages contradictoires). Ajout d'un `try/catch` autour de `requestPermission()` pour les navigateurs qui lèvent une exception. Ordre d'initialisation corrigé : `updateNotifUI()` appelé en premier dans `initNotifications()`.
- **`index.html`** — Nouveau `<div id="notifIOS">` : message spécifique iPhone "Sur iPhone, les alertes nécessitent l'app installée — Safari → Partager → Sur l'écran d'accueil (iOS ≥ 16.4)". Remplace les messages génériques "non supporté" / "bloqué" qui s'affichaient simultanément sur iOS.

### Changed
- **`js/config.js`** — `APP_VERSION` → `2.12.2.0`

## [2.12.1.0] — 2026-05-27

### Added
- **`tests/e2e.spec.js`** — Suite Playwright E2E (5 scénarios, mode mock GAS) :
  - **TC-01** E85 complet → feedback succès + formulaire réinitialisé + historique rechargé (2ème GET GAS renvoie `HIST_RECORD` via flag `submissionDone`)
  - **TC-02** SP98 complet → feedback succès + formulaire réinitialisé
  - **TC-03** Champs obligatoires manquants → feedback `error` "Champs manquants", formulaire conservé
  - **TC-04** Station non sélectionnée → feedback `error` "Station manquante"
  - **TC-05** Erreur GAS (`success: false`) → feedback `error` "Erreur serveur", champs conservés
  - Mocks réseau : GAS (`script.google.com/**`), API prix (`data.economie.gouv.fr/**`), Google Sheets stations (`docs.google.com/**` → abort → fallback), Overpass (`overpass-api.de/**`)
- **`playwright.config.js`** — Configuration Playwright : serveur Vite (`npm run dev`), 1 worker séquentiel, Chromium headless, `testMatch: '**/*.spec.js'` (séparé de Vitest)
- **`package.json`** — `@playwright/test ^1.44.0` en devDependency + scripts `test:e2e`, `test:e2e:ui`, `test:e2e:headed`, `test:e2e:report`
- **`.gitignore`** — Entrées `playwright-report/` et `test-results/`

### Changed
- **`js/config.js`** — `APP_VERSION` → `2.12.1.0`

## [2.12.0.0] — 2026-05-27

### Added
- **`index.html`** — `<div id="swUpdateBanner">` : bannière "🔄 Mise à jour disponible" (W23), masquée par défaut, avec bouton "Actualiser". Placée avant le header pour apparaître en premier plan sans JavaScript d'affichage.
- **`js/pwa.js`** — `_showUpdateBanner(reg)` : détecte `reg.installing` (via `statechange`) et `reg.waiting` (SW déjà en attente au chargement). Câble le bouton "Actualiser" → `reg.waiting.postMessage({ type: 'SKIP_WAITING' })`. Reload automatique via `controllerchange`.
- **`public/sw.js`** — handler `message` pour `SKIP_WAITING` : déclenche `self.skipWaiting()`, ce qui active le nouveau SW immédiatement → `controllerchange` → `window.location.reload()`.
- **`js/stats.js`** — `buildE85Sparkline()` : courbe SVG inline des 10 derniers prix E85 payés (`getAllRecords()`). Tri chronologique, `polyline` SVG, cercle sur le dernier point, couleur selon tendance (baisse=vert, hausse=rouge, stable=bleu). Affiché sous la grille 2×2 dans la carte Statistiques.

### Changed
- **`js/formulaire.js`** — `submitForm()` : `window.scrollTo({ top: 0, behavior: 'smooth' })` ajouté après enregistrement réussi **et** après mise en file hors-ligne (W24). Le formulaire repasse automatiquement en vue, sans geste manuel.
- **`js/stats.js`** — `renderStats()` : appel `buildE85Sparkline()` intégré à la fin du HTML généré.
- **`js/pwa.js`** — `initPWA()` : appel SW registration refactorisé pour intégrer la détection de mise à jour W23 + listener `controllerchange`.
- **`css/style.css`** — ajout des styles `.update-banner`, `.update-apply-btn` (W23) et `.e85-sparkline`, `.spark-*` (W28) avec variantes dark mode et couleur dynamique selon tendance.
- **`js/config.js`** — `APP_VERSION` → `2.12.0.0`.

## [2.11.0.0] — 2026-05-27

### Added
- **`public/sw.js`** — Service Worker (Cache-First shell + Network-First dynamique).
  - Cache statique de la coquille applicative (HTML/CSS/JS/icônes) pour démarrage hors-ligne.
  - Stratégie Network-First pour les requêtes GET du même domaine ; fallback vers le cache si hors réseau.
  - Skip des ressources externes (GAS, ODS API, CDN) pour ne pas interférer avec la logique métier.
  - Fallback navigation : sert `index.html` depuis le cache pour toutes les routes SPA.
  - Background Sync : sur tag `sync-pleins`, notifie les clients `window` via `postMessage` pour déclencher la synchronisation.
- **`js/offline.js`** — Gestion de la file d'attente hors-ligne.
  - `queuePlein(payload)` : sauvegarde un plein dans `localStorage` quand la soumission échoue (hors réseau).
  - `syncQueue()` : envoie chaque entrée à GAS au retour de la connexion ; retire les succès, arrête sur erreur réseau persistante.
  - `updateOfflineBadge()` : met à jour le badge `📵 N hors-ligne` dans le header.
  - `initOffline()` : écoute `window.online`, messages Service Worker (`SYNC_PLEINS`), et enregistre un Background Sync.
- **`js/notifications.js`** — Alertes prix E85 via Web Notifications API.
  - `toggleNotifications(enable)` : demande la permission, enregistre l'état et envoie une notification de confirmation.
  - `checkPrixE85Alert(prix, station)` : émet une notification `tag: 'e85-price-alert'` (anti-spam) si le prix E85 est sous le seuil configuré.
  - `getSeuil() / setSeuil()` : seuil persisté en localStorage (`notif_e85_seuil`), défaut 0,850 €/L.
  - `updateNotifUI()` : synchronise le toggle, la ligne seuil, et les messages permission denied / not supported.
  - `initNotifications()` : câble le toggle et l'input seuil au chargement.
- **`index.html`** — Éléments UI pour les nouvelles fonctionnalités.
  - Badge `#offlineBadge` dans le header (visible si des pleins sont en attente de sync).
  - Carte « Paramètres » avec section hors-ligne (informatif) et section alertes prix E85 (toggle + seuil + messages denied/no-support).
- **`js/pwa.js`** — Enregistrement du Service Worker dans `initPWA()` (portée `import.meta.env.BASE_URL`).
- **`css/style.css`** — Styles pour les nouvelles fonctionnalités.
  - `.offline-badge` : badge ambre pulsant (`@keyframes pulse-badge`) dans le header.
  - `.notif-card`, `.notif-row`, `.notif-label`, `.notif-sub` : carte paramètres et ses composants.
  - `.switch`, `.switch-track` : toggle iOS-style (checked/disabled variants).
  - `.seuil-row`, `.seuil-input`, `.seuil-unit` : ligne saisie du seuil d'alerte.
  - `.feedback.info` : variante bleue du feedback (manquait pour les messages hors-ligne).

### Changed
- **`js/formulaire.js`** — `submitForm()` : en cas d'erreur réseau (`NetworkError` / `!navigator.onLine`), appelle `queuePlein(payload)` au lieu d'afficher une simple erreur, puis `resetForm()` et `updateOfflineBadge()`.
- **`js/prix.js`** — `applyPricesResult()` : appelle `checkPrixE85Alert()` après chaque chargement de prix station.
- **`js/main.js`** — Appels `initOffline()`, `initNotifications()`, `syncQueue()` au démarrage.

## [2.10.0.5] — 2026-05-27

### Fixed
- **`js/ticket.js`** — Deux bugs critiques dans le remplissage du formulaire post-scan.
  - **Ordre `setType` → `fPrix`** : `setType()` efface `fPrix.value = ''` (ligne 66 de `carburant.js`). `fillFormFromTicket` appelait `setType` *après* avoir rempli `fPrix`, effaçant immédiatement le prix détecté. Correction : `setType` est désormais appelé **en premier**, avant tout remplissage de champ numérique.
  - **`montant_total` faux** : le pattern `ttc` (seul) dans `totalPatterns` capturait "Prix unitaire **TTC** 1,799" → `montant_total = 1.799` au lieu de 76,61. Correction : `ttc` retiré de l'alternance principale ; seul `total ttc` et `montant ttc` restent valides comme déclencheurs.

## [2.10.0.4] — 2026-05-27

### Fixed
- **`js/ticket.js`** — Extraction prix/L refondée pour robustesse maximale.
  - **Collecte multi-candidats** : au lieu de s'arrêter au premier match, tous les candidats prix/L valides ([0,3–3,5]) sont collectés puis le **maximum** est retenu — élimine automatiquement TICPE (0,691 €/L) et autres taxes inférieures au prix carburant réel.
  - **Pattern ① élargi** : `€?` → `[€e£é]?` — gère l'artefact OCR "€" → "e"/"E"/"£" (fréquent avec Tesseract sur texte imprimé).
  - **`.matchAll()`** remplace `.match()` — permet de trouver tous les candidats dans le texte, pas seulement le premier.
  - **Km — séparateur milliers espace** : "87 450 km" (format français) désormais reconnu → 87450. 4 niveaux de fallback km (contigu, espace, libellé+contigu, libellé+espace).
  - **Station** : "totalenergies" ajouté à la liste des mots-clés.
  - **Log diagnostic** : `console.group('[OCR]…')` affiche le texte brut et les candidats prix dans la console DevTools pour faciliter le débogage.

## [2.10.0.3] — 2026-05-27

### Fixed
- **`js/ticket.js`** — Extraction du prix/L robustifiée pour les formats tickets courants.
  - **Pattern ② (EUR/L)** : `eur?` → `eur(?:os?)?` — couvre désormais "eur", "euro" et "euros" (avec `s` final). Exemple : `1,799 Euros/L` désormais reconnu.
  - **Pattern ③ (libellé)** : ajout de `prix unitaire` et `prix/litre(s)` — corrige la non-détection du libellé le plus courant sur les tickets de station (Total, Leclerc, Carrefour…).
  - **Pattern ④ (multiplication)** : `\d{2}` → `\d{2,3}` — quantité avec 3 décimales (ex. `25,000 L`) désormais prise en charge.
  - **Totaux** : `\d{2}` → `\d{2,3}` dans les deux patterns — capture les montants à 3 décimales (ex. `44,975 €`), ce qui rend le fallback `total ÷ litres` fonctionnel même lorsque le prix/L n'est pas lisible directement.

## [2.10.0.2] — 2026-05-27

### Fixed
- **`js/ticket.js`** — Extraction du prix/L améliorée (5 niveaux de fallback).
  - **Plage étendue** : `[01]` → `[0-3]` — couvre désormais SP98 (~2,09 €/L), GPLc (~0,85 €/L) et tout carburant jusqu'à 3,5 €/L.
  - **Artefacts OCR** : le séparateur `/L` toléré sous ses formes déformées `|L`, `\L`, `Il`, `lL` (erreurs Tesseract courantes sur les petits caractères).
  - **Nouveaux libellés** : `Prix au litre`, `Prix/l`, `prixlitre` ajoutés au pattern libellé.
  - **Fallback ⑤ — `montant_total ÷ litres`** : si le prix/L n'a pas été trouvé directement mais que le montant et le volume sont connus, le prix est calculé par division (arrondi à 3 décimales). Les grands nombres (ex. `36,23 €`, `20,14 L`) sont bien mieux reconnus par l'OCR que `1,799 €/L` — ce fallback est donc très fiable.

## [2.10.0.1] — 2026-05-27

### Fixed
- **`js/ticket.js`** — Détection du carburant "SP 95-E10" (E10) corrigée.
  - **`FUEL_LABEL_MAP`** : patterns composés (`sp95-e10`, `sp 95-e10`, `95-e10`, `sp95 e10`, `sp 95 e10`, `sans plomb 95-e10`…) positionnés **avant** `sp95` et `e10` séparément — ordre critique car `"sp95-e10".includes("sp95")` est vrai et causait un match prématuré sur `SP95`.
  - **Regex fallback** (codes courts) : pattern dédié `\bSP\s?95[\s-]E10\b|\b95[\s-]E10\b` testé avant l'alternance simple `SP95|E10` pour éviter que "SP95-E10" soit capturé par `SP95`.

## [2.10.0.0] — 2026-05-27

### Changed
- **`js/ticket.js`** — Suppression complète de la dépendance Gemini/GAS pour le scan de ticket.
  - Remplacé par **Tesseract.js** (OCR 100 % côté client, aucune clé API, fonctionne hors-ligne après premier chargement).
  - Nouveau flux : photo → redimensionnement canvas (max 1 200 px) → `Tesseract.recognize()` langue `fra` → `parseOCRText()` → champs auto-remplis.
  - `parseOCRText()` : extraction par regex heuristiques (date, litres, prix/L, montant, type carburant, station, km).
  - Barre de progression : affichage du % pendant la reconnaissance (`recognizing text`).
  - Validations : litres 0,5–200 L, prix 0,3–3,5 €/L pour rejeter les faux positifs OCR.

### Added
- **`package.json`** : dépendance `tesseract.js` (OCR navigateur, multi-langues).

### Removed
- Appel `fetch(GAS_URL, { action: 'scanTicket', imageBase64, … })` dans `ticket.js`.
- Fonction `compressImage()` remplacée par `resizeImage()` (même logique, renvoie Blob pour Tesseract).
- Import `GAS_URL` dans `ticket.js` (plus nécessaire pour le scan).
- Fonction `handleScanTicket` dans `Code.gs` : inopérante (`gemini-1.5-flash` non supporté sur endpoint `/v1/`), conservée dans GAS mais plus jamais appelée par l'app web.

## [2.9.0.2] — 2026-05-27

### Fixed
- **`Google Drive/.../Code.gs`** : `gemini-2.0-flash` non disponible sur le plan gratuit (quota `limit: 0`) → retour à `gemini-1.5-flash`, endpoint `v1` conservé (le problème précédent était `v1beta`, pas le nom du modèle).

---

## [2.9.0.1] — 2026-05-26

### Fixed
- **`Google Drive/.../Code.gs`** : modèle Gemini mis à jour `gemini-1.5-flash` (déprécié en `v1beta`) → `gemini-2.0-flash` via endpoint `v1`. Corrige l'erreur *"models/gemini-1.5-flash is not found for API version v1beta"* lors du scan de ticket.

---

## [2.9.0.0] — 2026-05-26

### Added

#### 🔄 Sync bidirectionnel Excel ↔ Google Sheets — complet

**VBA — `vba/GS_Pleins_snippet.bas`** (nouveau module feuille) :
- **[F1] Auto sync_id à la saisie** : `Worksheet_Change` génère un UUID en col O dès qu'une cellule de données (A:N) est modifiée sur une ligne active (Date ou Km renseigné). Le sync_id n'attend plus le prochain `SyncManuel()`.
- **[F2] Marquage modification locale** : toute modification sur A:N inscrit `Now()` en col P (`last_modified`). Flag consommé par `ExportModificationsToGS`.
- **[F3] Validation kilométrage** : warning `vbExclamation` si le km saisi est inférieur au max km enregistré pour le même véhicule. Comparaison par véhicule si renseigné, global sinon.
- **[F4] Détection doublons** : warning si Date + Km + Litres (au centilitre) correspondent à une ligne existante. Déclenché sur modification de col B, D ou E.

**VBA — `vba/modSyncGS.bas`** — mise à jour v2.9.0.0 :
- **Col P `Modifie_local`** : nouvelle colonne 16 (`COL_MODIFIED`). Initialisée automatiquement par `EnsureModifiedColHeader` (appelée à chaque `SyncCore` et `ForceFormatDates`).
- **`ExportModificationsToGS`** : collecte les lignes avec sync_id déjà dans GS + col P renseignée → POST `action=bulkUpdate`. Efface col P après succès HTTP 200. Tolère l'absence du handler GAS (conserve col P si réponse vide ou erreur).
- **`ImportGSToExcel`** — MAJ bidirectionnelle : pour les lignes existantes (sync_id connu), si col P vide (pas de modif locale) et valeurs GS différentes (Date/Km/Litres) → `UpdateRowFromGS` met à jour les cols 2–14. Si col P renseignée → Excel gagne, skip GS.
- **`BuildLocalRowMap`** : dictionnaire `sync_id → numéro de ligne` pour les MAJ GS→Excel.
- **`RowMatchesGS`** : compare Date (yyyy-mm-dd), Km (±0.5), Litres (±0.01) local vs GS.
- **`UpdateRowFromGS`** : écrase cols 2–14 depuis le record GS (préserve col 1 horodatage, col 15 sync_id, col 16 modified).
- **`SyncDiagnose`** : affiche le nombre de lignes dirty (col P set) dans le rapport.
- **`SyncCore`** : statut détaillé — `<-N nouv. +M MAJ / ->N nouv. +M MAJ`.

**GAS — `Google Drive/.../Code.gs`** — mise à jour v2.9.0.0 :
- **`handleBulkUpdate(ss, rows)`** : upsert par `sync_id` — ligne trouvée → MAJ cols B–N (préserve col A Horodatage) ; ligne absente → `appendRow` (cas de désync). Retourne `{ status:'ok', updated:N, added:M }`.
- Dispatch `action === 'bulkUpdate'` dans `doPost`.

**GAS — `Google Drive/.../GAS_UPDATE.md`** :
- Réécrit entièrement (était v2.1.3.0). Documente désormais toutes les actions `doGet`/`doPost` (`export`, `addStation`, `syncStations`, `addVehicule`, `removeVehicule`, `bulkAdd`, `bulkUpdate`, `scanTicket`), le schéma complet A→O, les fonctions de migration et l'historique des versions GAS.

### Changed
- **`excel/Suivi conso E85.xlsm`** : modules VBA mis à jour — `modSyncGS` (v2.9.0.0, sync bidir. complet) + module feuille `GS_Pleins` (F1–F4 : auto sync_id, dirty flag, validation km, doublons).
- **`package.json`** : `version` → `2.9.0.0`.

---

## [2.8.0.1] — 2026-05-26

### Fixed
- **`css/style.css`** : marqueurs de carte passaient au premier plan lors du défilement derrière le header sticky. Cause : `z-index:10` des marqueurs et `z-index:10` du header étaient dans le même stacking context racine — ordre DOM décidait, marqueurs gagnaient. Fix : `isolation:isolate` ajouté sur `#stationMap` et `.static-map` → chaque carte forme désormais un stacking context fermé, les z-index internes ne s'échappent plus vers le contexte racine où le header règne.

---

## [2.8.0.0] — 2026-05-26

### Added

#### 🗺️ Carte statique Stations habituelles + prix moyens
- **`js/stationsmap.js`** (nouveau module) : calcule le prix moyen E85 par station depuis l'historique complet (`getAllRecords()`), trie par prix croissant, rend une card `#stationsMapCard` avec liste et mini-carte OSM statique (non-interactive, labels prix toujours visibles).
- **`js/geo.js`** : `pickStation()` appelle désormais `cacheStationCoords(name, lat, lon)` — les coordonnées de chaque station sélectionnée sont persistées en `localStorage` sous `suivi_e85_station_coords`. La carte statique se peuple automatiquement au fil des sessions.
- **`js/historique.js`** : appel `renderStationsCard()` après chaque chargement d'historique pour maintenir la card à jour.
- **`index.html`** : card `#stationsMapCard` insérée après le bloc Statistiques. Masquée (`hidden`) tant qu'aucun historique E85 n'est disponible.
- **`css/style.css`** : styles `.static-map`, `.smap-pin`, `.smap-pin-dot`, `.smap-list`, `.smap-item`, `.smap-name`, `.smap-prix`, `.smap-count`, `.smap-best` — adaptés dark mode.

#### ⚠️ Détection de doublons dans le formulaire
- **`js/formulaire.js`** : nouvelle fonction `checkDuplicate()` — compare date + km + litres (au centilitre près) avec tous les enregistrements existants via `getAllRecords()`. Warning inline `#dupeWarn` si correspondance trouvée. Confirmation `confirm()` supplémentaire lors de la soumission si doublon détecté.
- **`index.html`** : `<div id="dupeWarn">` ajouté sous les champs litres/prix ; `onchange="checkDuplicate()"` sur `fDate`, `oninput` enrichi sur `fKm` et `fLitres`.

---

## [2.7.0.4] — 2026-05-26

### Fixed
- **`js/carte.js`** : marqueurs de carte qui débordaient au-dessus du conteneur `#stationMap`. Cause : le `offY` (décalage vertical de la grille de tuiles) peut être très négatif quand la grille est plus haute que les 220 px de la carte ; les marqueurs nord avaient `top = offY + p.y - 30 < 0`, leur pin dépassait au-dessus de `.map-header`. Fix en deux points : ① `offY` est recalé à `max(offY, PIN_H - minPy)` pour garantir que le marqueur le plus haut reste dans l'espace visible ; ② `overflow:hidden` ajouté sur le conteneur `<div>` de tuiles comme filet de sécurité supplémentaire.

---

## [2.7.0.3] — 2026-05-26

### Changed
- **`js/pwa.js`** : bannière Android flottante (`#installBanner`) remplacée par un bouton 📲 discret dans le header (`#pwaInstallBtn`). Le bouton n'apparaît que lorsque `beforeinstallprompt` se déclenche et disparaît après installation — plus de sessionStorage nécessaire côté Android.
- **`index.html`** : suppression du `<div id="installBanner">` ; ajout `<button id="pwaInstallBtn">` dans le header entre le titre et le toggle thème. Le banner iOS (`#iosBanner`) est conservé (seule option sur Safari).
- **`css/style.css`** : suppression `.pwa-btn` (bouton flottant Android) ; ajout `.pwa-install-btn` (style identique au `.theme-toggle` — fond semi-transparent, arrondi, hover) ; nettoyage `.pwa-banner` (iOS uniquement).

---

## [2.7.0.2] — 2026-05-26

### Fixed
- **`vite.config.js`** : `minify: 'esbuild'` remplacé par `minify: true` — `esbuild` est déprécié dans Vite 8.x (qui utilise rolldown/OXC) et n'est plus embarqué ; le build CI échouait silencieusement depuis v2.7.0.0.
- **`manifest.json` → `public/manifest.json`** : déplacement dans `public/` pour éviter que Vite hash le fichier dans `assets/` (ex. `assets/manifest-CcE5tYcX.json`). Depuis ce sous-dossier, le chemin relatif `icons/icon.svg` se résolvait en `/suivi-e85/assets/icons/icon.svg` au lieu de `/suivi-e85/icons/icon.svg` → 404 sur l'icône PWA. Désormais le manifest est à `dist/manifest.json` et l'icône à `dist/icons/icon.svg` — chemins cohérents.

---

## [2.7.0.1] — 2026-05-25

### Fixed
- **`css/style.css`** : ajout `.pwa-banner[hidden] { display: none; }` — `display:flex` sur `.pwa-banner` écrasait l'attribut HTML `hidden`, rendant les 2 bannières PWA toujours visibles et les boutons ✕ inopérants. La règle `[hidden]` a une spécificité plus haute (0-2-0 vs 0-1-0) et corrige l'affichage.

---

## [2.7.0.0] — 2026-05-25

### Added — Vite bundler (W12) + Tests unitaires Vitest (W14)

#### ⚡ W12 — Vite bundler
- **`vite.config.js`** : config Vite — `base: '/suivi-e85/'` en build (GitHub Pages), `'/'` en dev (localhost) via `command === 'build'` ; `outDir: dist` ; config Vitest intégrée (`globals: true`, `environment: node`).
- **`public/icons/icon.svg`** : icône déplacée dans `public/` — Vite la copie sans hash dans `dist/icons/`, garantissant un chemin prévisible pour le manifest PWA.
- **`manifest.json`** : chemin icône mis à jour `images/icons/icon.svg` → `icons/icon.svg` (cohérent avec `public/icons/`).
- **`index.html`** : `<link rel="apple-touch-icon">` mis à jour `href="images/icons/icon.svg"` → `href="icons/icon.svg"`.
- **`.github/workflows/deploy.yml`** : nouveau workflow — `push main` → `npm ci` → `vite build` → `actions/upload-pages-artifact@v3` → `actions/deploy-pages@v4`. Prérequis : Settings → Pages → Source → **GitHub Actions**.
- **`.gitignore`** : ajout `dist/` et `.vite/`.

#### 🧪 W14 — Tests unitaires Vitest
- **`tests/utils.test.js`** : 30 assertions sur les 8 fonctions pures de `utils.js` — `haversine` (distance, symétrie), `escHtml` (XSS chars), `getCoords` (formats ODS lat/lon et GeoJSON), `stationLabel`, `stationSubLabel`, `formatVille`, `composeStationName`, `odsUrl`.
- **`tests/prix.test.js`** : 8 scénarios sur `fetchNearestE85Price` avec `global.fetch` mocké — prix trouvé au 1er rayon, fallback sur 2e/3e rayon, 3 rayons exhaustés, vérification des valeurs `1000m`/`5000m`/`15000m` dans les URLs, lat/lon dans la requête, erreur réseau, HTTP non-ok, `e85_prix: null` ignoré. Modules DOM (`ui.js`, `carburant.js`, `rentabilite.js`) mockés via `vi.mock()`.

### Changed
- **`package.json`** : scripts ajoutés `dev` (vite), `build` (vite build), `preview`, `test` (vitest run) ; `version` → `2.7.0.0`.
- **`.github/workflows/ci.yml`** : ajout job `test` (Vitest) en parallèle de `lint` et `version-check`.
- **`js/config.js`** : `APP_VERSION` → `2.7.0.0`.
- **`ROADMAP.md`** : W12 et W14 retirés de leurs tableaux, ajoutés à "✅ Idées déjà implémentées".

---

## [2.6.0.0] — 2026-05-25

### Added — PWA (W4)
- **`manifest.json`** : manifeste PWA — `name`, `short_name`, `display: standalone`, `theme_color: #1B3A5C`, `background_color`, icône SVG `any` + `maskable`, shortcut "Nouveau plein"
- **`images/icons/icon.svg`** : icône app 512×512 — fond bleu foncé, emoji ⛽, texte "E85" vert — compatible maskable (contenu dans la safe zone 80%)
- **`js/pwa.js`** : module `initPWA()` — détection `beforeinstallprompt` (Android/Chrome) → affiche bannière avec bouton "Installer" ; détection iOS Safari → bannière instruction manuelle après 4 s ; `sessionStorage` pour éviter la ré-affichage en session ; `triggerInstall()` + `dismiss()` exposés sur `window`
- **`index.html`** : `<meta name="theme-color">`, `<link rel="manifest">`, `<link rel="apple-touch-icon">`, bannières `#installBanner` (Android) et `#iosBanner` (iOS) en `hidden` par défaut
- **`css/style.css`** : classes `.pwa-banner`, `.pwa-btn`, `.pwa-close`, `.pwa-banner--ios` + dark mode

### Changed
- **`js/main.js`** : import + appel `initPWA()` après `initScanner()`
- **`js/config.js`** : `APP_VERSION` passée à `2.6.0.0`
- **`ROADMAP.md`** : W4 retiré du tableau "Quick wins", ajouté à "Idées déjà implémentées"

---

## [2.5.0.3] — 2026-05-25

### Fixed
- **`vba/modDashboard.bas`** : correction `ws.Activate` avant `ws.Range().Select` (erreur 1004)
- **`vba/modDashboard.bas`** : suppression `ChrW(128200)` hors BMP dans `BuildX7Chart` (erreur 5)
- **`vba/modDashboard.bas`** : remplacement de tous les tirets em `—` et flèches `→` par des équivalents ASCII pour compatibilité encodage ANSI à l'import VBA

### Changed
- **`README.md`** : ajout tuto complet `<details>` pour obtenir et configurer la clé API Gemini (AI Studio → GAS Script Properties → redéploiement)

---

## [2.5.0.0] — 2026-05-25

### Added

#### 🧾 W17 — Scan ticket de caisse → auto-complétion du formulaire
- **`js/ticket.js`** (nouveau module) : bouton "🧾 Scanner le ticket" → sélecteur de fichier (galerie ou caméra) → compression canvas (max 1 200 px, JPEG ≤ 800 Ko) → envoi base64 à GAS → Gemini Vision API → JSON parsé → pré-remplissage automatique des champs date / km / litres / prix / type carburant / station. Mapping robuste des libellés carburant (`FUEL_LABEL_MAP`) + correspondance partielle sur le dropdown station.
- **`Google Drive/.../Code.gs`** : nouvelle action `scanTicket` dans `doPost` → appelle `handleScanTicket(imageBase64, mimeType)` → API Gemini `gemini-1.5-flash` via `UrlFetchApp` avec clé `GEMINI_API_KEY` stockée dans les propriétés de script. Prompt structuré → JSON `{ date, km, litres, prix_litre, montant_total, type_carburant, station }`. Extraction robuste du JSON dans la réponse texte.
- **`index.html`** : bloc `.scan-row` avec `#scanTicketBtn` (🧾 Scanner le ticket) + texte d'aide, inséré entre le toggle carburant et les champs du plein.
- **`style.css`** : classes `.scan-row`, `.scan-btn`, `.scan-hint` — design cohérent avec les autres actions (border blue-mid, active inverted, dark mode).

#### 🔁 W13 — GitHub Actions CI
- **`.github/workflows/ci.yml`** : deux jobs parallèles —  `lint` (ESLint sur `js/`) et `version-check` (compare `APP_VERSION` dans `config.js` au dernier tag Git, avertissement seulement). Déclenchement sur `push` et `pull_request` toutes branches.
- **`package.json`** : configuration npm avec `"type": "module"`, script `lint`, dépendances dev `eslint` + `@eslint/js` v9.
- **`eslint.config.js`** : flat config ESLint 9 — `js.configs.recommended` + règles `no-unused-vars` (warn), `no-undef` (error), `no-var` (error), `prefer-const` (warn), `eqeqeq` (warn), `no-duplicate-imports` (error) + globals browser complets.
- **`.gitignore`** : ajout `node_modules/`.

#### 📈 X7 + X8 — Graphiques Excel (`modDashboard.bas`)
- **`vba/modDashboard.bas` — `CreerGraphiques()`** : nouvelle procédure publique créant / régénérant la feuille "Graphiques". Appelée automatiquement en fin de `CreerTableauDeBord()` ; exécutable seule si les KPIs sont déjà en place.
- **X7 — Prix E85 dans le temps** : helper data Date|Prix E85|Station (filtré sur Type contenant "E85") + graphique ligne bleu (`xlLineMarkers`) avec axe X dates (format `mmm yy`) et axe Y `€/L`.
- **X8 — Consommation L/100 km** : helper data Date|L/100km|Véhicule — conso calculée entre pleins consécutifs du même véhicule (bubble sort sur véhicule+km, filtre aberrations : delta 10–3 000 km, conso 3–25 L/100) + graphique ligne vert. Permet de détecter une dérive mécanique dans le temps.

### Changed
- **`js/main.js`** : import + appel de `initScanner()` après le chargement des données.
- **`js/config.js`** : `APP_VERSION` passée à `2.5.0.0`.
- **`ROADMAP.md`** : nettoyage complet — les items réalisés sont retirés de leurs tableaux d'origine (plus de strikethrough) et ajoutés uniquement dans "✅ Idées déjà implémentées". Suppression des 2 entrées W16 (absorbées par W17). W13, W17, X7, X8 ajoutés au tableau implemented.

---

## [2.4.5.1] — 2026-05-25

### Added
- **`ROADMAP.md` — nouvel item W17** : *"🧾 Scan ticket de caisse → auto-complétion du formulaire"* — reconnaissance OCR / API vision (Claude Vision, Gemini Vision, GPT-4 Vision) du ticket de caisse imprimé par la pompe ; extrait date, heure, type carburant, litres, prix/L, montant total et nom de station pour pré-remplir automatiquement tous les champs du formulaire en ligne. Avantage vs W16 : ticket papier imprimé, structuré, sans reflets — données plus fiables qu'un afficheur de pompe. Deux approches : (a) envoi base64 à GAS → API Vision → JSON parsé ; (b) Tesseract.js local pour tickets bien contrastés. Effort estimé : 3-5 h.

---

## [2.4.5.0] — 2026-05-25

### Added
- **`js/utils.js` — `formatVille(city)`** : premier segment d'une ville (avant `-` ou espace) converti en proper case. Ex : `FLERS-EN-ESCREBIEUX` → `Flers`, `DOUAI` → `Douai`.
- **`js/utils.js` — `composeStationName(name, ville)`** : compose le label final `"Nom - Ville"` (ex : `Carrefour - Flers`). Si l'un manque, retourne l'autre.
- **`ROADMAP.md` — nouvel item W16** : *"Photo ticket + OCR/AI"* — capture caméra → OCR (Tesseract.js côté client OU Vision API Claude/Gemini côté GAS) → parse date/litres/prix/station → pré-remplit le formulaire. Évolution naturelle de W9 (stockage photo seul).

### Changed
- **`js/geo.js` — `searchNearby`** : utilise `composeStationName(rawName, c.r.ville)` au lieu de `osmNames[i] || stationLabel(c.r)`. Les stations affichent désormais `Carrefour - Flers` au lieu de `Carrefour`. La détection "connue" reste basée sur le `rawName` brut pour ne pas casser le matching avec les stations habituelles.
- **`js/recherche.js`** :
  - `buildStations` stocke maintenant `ville` dans chaque station + compose le name via `composeStationName`.
  - Les deux callsites OSM (`searchStationSuggestions`, `searchStationsCityOnly`) recomposent le nom final avec ville après enrichissement OSM.
- **`js/stats.js`** :
  - Helper `matchType(rType, fuelKey)` qui mappe un Type GS (label complet "SuperEthanol E85") avec une clé `FUEL_CONFIG` (E85).
  - `computeStats` filtre désormais conso & coût/100km **par carburant courant** (`state.currentType`). Total dépensé et économies E85 vs SP98 restent globaux.
  - `renderStats` affiche un mini-tag `<span class="stat-tag">E85</span>` à côté des unités L/100km et €/100km. Affiche `—` si <2 pleins de ce type.
- **`style.css`** : nouvelle classe `.stat-tag` (badge bleu compact 9 px).
- **`js/carburant.js` — `setType`** : appelle `window.renderStats()` après chaque changement de carburant → les tuiles conso/€/100km se recalculent instantanément.
- **`js/config.js`** : `APP_VERSION` passée à `2.4.5.0`.

---

## [2.4.4.0] — 2026-05-25

### Added — 📈 Stats live (ROADMAP W7)
- **`js/stats.js`** : nouveau module exportant `renderStats()`. Calcule 4 KPIs filtrés sur le **véhicule courant** + fenêtre **6 derniers mois** :
  1. **Conso L/100 km** : `total_litres_véhicule × 100 / (km_max − km_min)`
  2. **Coût aux 100 km** : `conso × prix_moyen_récent`
  3. **Total dépensé** sur la fenêtre (Σ litres × prix)
  4. **Économies E85 vs SP98** : Σ (sp98_station − prix_payé) × litres pour chaque plein E85 récent
- **Carte HTML `<div class="card stats-card">`** insérée entre les cards du formulaire et la carte historique.
- **`style.css` — grille 2×2 `.stats-grid`** : 4 tuiles avec valeurs en tabular-nums, fond `var(--toggle-bg)`, dark mode supporté. Variante `.pos` (vert) / `.neg` (rouge) pour les économies.

### Changed
- **`js/historique.js`** :
  - Nouveau `export function getAllRecords()` qui retourne `_allRecords` (utilisé par stats.js).
  - `chargerHistorique` appelle `renderStats()` après le rendu de la liste — les stats se mettent à jour dès que les données arrivent.
- **`js/vehicules.js` — `onVehiculeChange`** : appelle aussi `window.renderStats()` car les KPIs sont filtrés par véhicule.
- **`js/main.js`** : import + exposition `renderStats` sur `window`.
- **`js/config.js`** : `APP_VERSION` passée à `2.4.4.0`.
- **`ROADMAP.md`** :
  - **W7 marqué ✅**
  - **W10** marqué ❌ "redondant avec W2 (📋 Dupliquer dernier)" — concept à redéfinir
  - **W8, W9, W11** annotés avec effort réaliste (3-4 h chacune)
  - **W15 nouveau** : Auto-save brouillon (formulaire → localStorage, restauré au reload)
  - **S8 nouveau** : Refresh quotidien des prix via GAS trigger temporel + onglet `_PrixHistory`

---

## [2.4.3.0] — 2026-05-25

### Added — 🌿 Badge rentabilité E85 (ROADMAP W5)
- **`js/config.js` — `E85_RENTABLE_RATIO = 0.66`** : nouvelle constante exportée. Seuil basé sur la surconsommation typique de l'E85 (~30 % de plus que SP98). Tant que `prix_E85 / prix_SP98 < 0.66`, le plein E85 est économiquement rentable malgré la surconsommation.
- **`js/prix.js` — `evalRentabiliteE85()`** : fonction exportée qui met à jour l'élément `#rentaBadge`. Affiche un badge vert (rentable) si le rapport prix est favorable, orange sinon. Masqué si l'un des deux prix est manquant.
- **`js/rentabilite.js`** : nouveau module léger qui expose `updateRentabilite()` — appelé depuis `formulaire.js` après chaque récupération de prix.
- **`style.css`** : `.renta-badge.ok` (vert + border) et `.renta-badge.warn` (amber + border) + surcharges dark mode.

### Changed
- **`js/formulaire.js`** : `onStationChange()` et `resetForm()` appellent `evalRentabiliteE85()` pour mettre à jour / effacer le badge.
- **`js/config.js`** : `APP_VERSION` passée à `2.4.3.0`.
