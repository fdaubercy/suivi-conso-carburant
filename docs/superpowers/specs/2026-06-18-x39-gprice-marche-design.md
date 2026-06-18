# Design — X39 : prix marché quotidien dans le graphe gPrice (Excel)

> Date : 2026-06-18. Demande : « réaliser X39 » (ROADMAP).

## Constat — le spec ROADMAP X39 est périmé
X39 décrivait : « `RefreshPrix` écrase `Prix par Station` (Tableau12) à chaque relevé → créer `_PrixHistoriqueJournalier` ». **Déjà résolu** par des travaux ultérieurs :
- `RefreshPrix.gs` **accumule** par append quotidien dans l'onglet `_PrixHistory` (Station/Date/Type/Prix, 6 carburants : E85/GAZOLE/SP98/SP95/E10/GPLc) — relevé ~7h, stations curées + scan 15 km.
- `powerquery/PrixHistory.m` miroite cet historique long dans la table Excel `PrixHistory`.

## Le vrai bug (cause du symptôme « SP95/GAZOLE quasi vides »)
Dans `vba/modGraphiques.bas`, `BuildPriceBlockMerged` **SOURCE 2** lit la table `PrixHistory` en cherchant des colonnes **larges** `"E85 station"`, `"SP98 station"`, … (l. 1404‑1409) — **qui n'existent pas** : la table est en **format LONG** `Station | Date | Type | Prix`. Donc `phFuelCols` sont tous nuls → SOURCE 2 n'écrit rien → `gPrice` ne trace QUE SOURCE 1 (pleins). D'où SP95/GAZOLE limités aux jours de plein.

## Correctif
Réécrire **uniquement** la boucle de lecture SOURCE 2 de `BuildPriceBlockMerged` pour lire le format long :
- colonnes `Date`, `Type`, `Prix` (`LCIdx`) ;
- par ligne : `dk = Format(Date)`, `fk = FuelKey(Type)`, `p = Prix` ;
- respect du filtre carburant existant (`filtF`/`wantSet`) et du set par défaut (`fuelSet` = E85/SP98/SP95/GAZOLE) ;
- agrégation **moyenne** par jour+carburant via `AddToSum` (décision utilisateur — cohérent avec SOURCE 1) ;
- enregistrement de la date dans `ordDates`.
Toute la machinerie aval (tri dates, ordre carburants, en‑tête `G1`, écriture `prixSum/prixCnt`, rendu `gPrice`) **reste inchangée**.

### Hors-scope (volontaire)
- Pas d'ajout dynamique de E10/GPLc au `fuelSet` par défaut : ils n'apparaissent que si l'utilisateur les coche (filtre) — le graphe par défaut garde ses 4 courbes principales, désormais **continues**.
- Aucune modif GAS ni Power Query (déjà corrects).

## Déploiement
Miroir disque `vba/modGraphiques.bas` **puis** push COM dans le classeur ouvert via skill `vba-agent` (`set-module`) + **recompiler VBAProject** (règle CLAUDE.md). Garde-fous leçons COM : timeout, vérifier module non vide après écriture, préférer `set-module`.

## Vérification
- Compilation VBAProject OK (Débogage → Compiler).
- Reconstruire les graphiques → le bloc de données `G:*` de la feuille de calcul du graphe contient des lignes marché **tous les jours** (pas seulement aux jours de plein) et des colonnes SP95/GAZOLE renseignées en continu.

## Versioning / commit
`fix(excel)` — version PATCH (cible `5.20.1.0`). CHANGELOG + ROADMAP (X39 → implémenté). Commit **VBA+docs uniquement → graphify sauté** (leçons #44/#779 : graphify n'indexe pas le VBA, et `--update` ampute). Push sur accord explicite.
