# Mini-export — reprise « fuel3 » (2026-06-27)

Reprise de `session-export-fuel3.zip` (chaîne fuel → fuel2 → fuel3). Sujet : carte interactive de l'onglet Excel (`vba/modCarte.bas`). La session fuel3 est morte sur la limite de session en plein milieu de la conversion Leaflet → Google Maps.

## Demandes traitées cette reprise

| # | Demande | Statut | Preuve |
|---|---------|--------|--------|
| 15 | Carte « Stations à proximité » : marqueurs sans icône/nommage | ✅ **livré** | commit `b67ee59` poussé sur `origin/main` [v5.22.4.0] — `EnrichEnseignesOSM` (Overpass) vérifié 16/19 stations |
| 18 | Cartes en Google Maps au lieu de Leaflet | 🔶 **en attente clé** | approche validée (Maps JS API + repli OSM) ; **bloqué** : clé actuelle refusée en `file://` (testé, `gm_authFailure`) |

## Action restante #18 — à reprendre

**Décisions validées par l'utilisateur :**
- Rendu = **Maps JavaScript API** (fidèle à `js/gmap.js`, conserve les marqueurs logos+prix).
- Clé = **clé dédiée créée par l'utilisateur**, restreinte par API (Maps JavaScript) **sans restriction référent**, **hors dépôt** (stockée dans le classeur, pattern `SYNC_SECRET`).
- Repli **OSM/Leaflet automatique** si clé absente ou `gm_authFailure` (pas de régression).

**Bloquant :** attendre que l'utilisateur fournisse la clé dédiée.

**À faire dès réception de la clé :**
1. Helper VBA `PoserMapsKey` (écrit la clé en propriété de script du classeur) + lecteur `MapsApiKey()`.
2. Rendu Google Maps JS dans les 3 générateurs HTML de `modCarte.bas` : `GenererHtmlCarte`, `GenererHtmlProximite`, `GenererHtmlItineraire`. Réutiliser le CSS marqueurs existant (`.b-pin`/`.b-badge`) via `AdvancedMarkerElement` (contenu HTML), réutiliser `LOGOS`/slug/couleur.
3. Repli OSM si clé absente (décision côté VBA) + `window.gm_authFailure` côté JS.
4. Déployer via `vba-agent` (strip `Attribute VB_Name`, leçons #11/#50/#67), tester en ouvrant le HTML réel (Edge/navigateur, leçon #68), vérifier la carte Google + marqueurs.
5. CHANGELOG/ROADMAP (X60) + version v5.23.0.0 + commit (VBA-only → pas de graphify, leçon #44 ; committer via `git` direct, pas `commit.sh`, à cause des timeouts forks vitest, leçon #54/#70).

## Notes
- Page de test clé : `scratchpad/test_gmap.html` (réutilisable pour valider une nouvelle clé en `file://`).
- Ne pas committer la clé (dépôt public).
