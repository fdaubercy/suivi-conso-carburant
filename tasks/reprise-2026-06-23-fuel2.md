# Mini-export de reprise — 2026-06-23 (« fuel2 »)

Reprise de `session-export-fuel2.zip` (session `94960b7e`, opus / xhigh, mode auto).
**fuel2 était elle-même la reprise de « fuel »** : elle avait analysé les 5 demandes, codé le **fix #1**
(+ bump version + CHANGELOG/ROADMAP/tests) puis est **morte en plein `/graphify --update`** → tout le
travail restait **non commité** dans le working tree (scénario leçon #56). En prime, fuel2 avait
**fusionné par erreur** deux sections du CHANGELOG (5.21.2.0 renommée 5.21.3.0).

Cette session a **finalisé les 5 demandes** + corrigé l'anomalie CHANGELOG.

## Bilan : 5/5 traitées et poussées sur `origin/main`

| # | Demande | Statut | Preuve |
|---|---------|--------|--------|
| 1 | App / Historique — plein au 01/01/1970 : erreur ou à supprimer ? | ✅ | `estPleinValide()` (écarte echos d'en-tête + dates epoch) appliqué à `_loadCache` + `chargerHistorique` ; **7 tests**, lint 0, **vitest 96/96**. Commit `a39a303` [v5.21.3.0]. **Réponse : c'est une ligne technique (erreur), supprimée automatiquement.** |
| 2 | Excel / Tableau de bord — éco **brute et nette** (kit) + nouveau titre | ✅ | Carte « ÉCONOMIES E85 vs SP98 » → **« RENTABILITÉ KIT E85 »** (`176 € / 515 €` + barre « amorti 34 % »), reprend `Suivi Carburant` B11/B6/J13. **Fix surconso J7→J8** (CO2 du bandeau corrigé : −aberrant → +138 kg). Commit `75d0788` [v5.21.4.0] (X49). Vérifié à l'image. |
| 3 | Excel / Tableau de bord — bandeau selon **véhicule sélectionné** | ✅ | Chaîne **source unique** : `slcVehicule` → `'Tableau de bord'!B5` → `Suivi Carburant!B3` → `B11` → carte. Intégré au commit `9c67fb7`. |
| 4 | Excel / Suivi Carburant — indicateurs réactifs au véhicule | ✅ | Colonne `Véhicule` dans Tableau2 + sélecteur `B3` (suit B5) + indicateurs conso/éco filtrés (`.Formula2`, B11 en SUMPRODUCT). **Non-régression vérifiée** (1 véhicule : `(tous)`=`Z900`). Commit `9c67fb7` [v5.21.5.0] (X50). Vérifié à l'image. |
| 5 | Proposer des améliorations dans `ROADMAP.md` | ✅ | **X51–X54** ajoutés (§ Excel/Robustesse) + correction de la collision de numéros X47/X48. Commit `2aca949`. |

## Commits (origin/main)
- `a39a303` — fix(app) garde-fou plein fantôme 01/01/1970 [v5.21.3.0]
- `75d0788` — feat(excel) carte Rentabilité kit E85 + fix surconso J7→J8 [v5.21.4.0]
- `9c67fb7` — feat(excel) Suivi Carburant réactif au véhicule [v5.21.5.0]
- `2aca949` — docs(roadmap) propositions X51–X54 + corrige numéros
- (`071ec50` — lanceur `scripts/Claude-suivi-conso.cmd`, committé par un hook auto)

## Propositions repérées (ROADMAP, non bloquant)
- **X51** — projection rentabilité (J11/J12) filtrée par véhicule (encore globale).
- **X52** — purge fiable des formes dashboard (`For Each … Delete` saute des éléments → doublons ; boucle à rebours).
- **X53** — lire le coût du kit sur `Suivi Carburant!B6` (réel) et non `B5` (vide ; repli fragile).
- **X54** — sélecteur véhicule local optionnel sur Suivi Carburant (B3 suit le dashboard aujourd'hui).

## À vérifier côté utilisateur
- **App** : ouvrir l'onglet *Historique* → la ligne 01/01/1970 doit disparaître au chargement (cache purgé).
- **Excel** : sur *Tableau de bord*, la carte « Rentabilité kit E85 » et le CO2 évité (138 kg) ; sur *Suivi Carburant*, le sélecteur « Véhicule analysé ». Tester un futur **2ᵉ véhicule** (filtrage réel) — limite connue : J11/J12 restent globaux (X51).
