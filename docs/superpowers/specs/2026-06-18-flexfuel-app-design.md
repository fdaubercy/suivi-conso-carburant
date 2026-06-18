# Design — 3 fonctionnalités app (reprise session flexfuel)

> Date : 2026-06-18 — Reprise de la session `f26eff05` (17/06, coupée par limite d'usage en plein brainstorming).
> Décisions de design validées par l'utilisateur (AskUserQuestion, 18/06).

## Contexte
PWA suivi conso carburant (JS ES modules) + backend GAS + Excel VBA. Les 3 demandes portent sur l'app PWA.
Exploration déjà faite (session flexfuel) : le relevé quotidien marché existe déjà côté backend (`RefreshPrix.gs` ~7h → onglet `_PrixHistory`, exposé via `?action=sectorPrices`, consommé par `secteur.js`).

## D1 — Mise à jour globale après un nouveau plein
**Demande** : après saisie d'un plein, l'ensemble des graphiques et parties dédiées doivent se mettre à jour.
**État** : après soumission, seul `chargerHistorique()` est appelé (formulaire.js) → 5 derniers pleins + carte habituelles. KPIs, sparkline prix, CO2/budget, prédiction, Wrapped, badges, accueil restent figés ; cache agrégats serveur (statsApi) non invalidé (périmé <= 1h).
**Décision** : tout mettre à jour.
**Approche** : créer un hub `refreshAfterPlein()` (point central) appelé dans le chemin succès de la soumission. Il enchaîne : invalidation cache `statsApi`, `chargerHistorique()`, `renderStats()`, refresh accueil/badges/Wrapped si présents. Idempotent, sans rechargement de page.

## D2 — Graphique « Prix carburants » (onglet Stats)
**Question utilisateur** : d'où viennent les prix ? **Réponse** : de TES pleins (`buildPrixSparkline()` lit `getAllRecords()`), pas d'un relevé marché.
**Demande** : utiliser les prix relevés chaque jour par tâche régulière.
**Décision** : **Marché + mes pleins** — superposer 2 courbes par carburant.
**Approche** : étendre `buildPrixSparkline()` (stats.js) pour tracer, par carburant : (a) la série marché quotidienne issue de `_PrixHistory`/`sectorPrices` (déjà chargée par `secteur.js`) + (b) la série de mes pleins (existante). Légende distinguant marché vs payé. 0 changement backend.

## D3 — Carte stations essence les moins chères autour de moi
**Demande** : dans l'onglet Carte, voir une carte des stations essence autour de moi (10-15 km) avec les moins chères.
**État** : onglet Carte = stations HABITUELLES uniquement (`stationsmap.js`). `searchNearby()` (geo.js, live data.economie.gouv.fr) + `showMap()` (carte.js) existent mais câblés seulement sur la vue Saisie.
**Décisions** :
- Placement : **Alentour + habituelles** — nouvelle carte EN HAUT de l'onglet, habituelles en dessous (les deux visibles).
- Rayon : **sélecteur 10/15/20 km**, défaut **15 km**.
- Mise en avant : **Top 3 mises en valeur** — les 3 moins chères avec pin/badge spécial, autres en marqueur normal, + liste triée du - cher au + cher sous la carte.
**Approche** : section « Autour de moi » en tête de l'onglet Carte → géoloc → `searchNearby(rayon)` → tri par prix du carburant courant → `showMap()` avec top‑3 marqués + liste triée. Sélecteur de rayon recharge la recherche.

## Versioning
3 features visibles → MINOR. Cible `5.20.0.0` (puis BUILD W pour itérations correctives). CHANGELOG + ROADMAP + README si besoin.

## Tests
- D1 : Vitest — `refreshAfterPlein` appelle bien les fonctions de refresh (mocks).
- D2 : Vitest — `buildPrixSparkline` produit 2 séries/carburant quand `sectorPrices` dispo.
- D3 : Vitest — tri/top‑3 ; e2e Playwright si pertinent (mock geo + dataset).

## Ordre de build
D1 (hub, fondation) → D2 (sparkline) → D3 (carte alentour). Commit unique en fin (gate graphify --update si JS structurel).
