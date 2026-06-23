# Mini-export de reprise — 2026-06-23 (« fuel »)

Analyse de `session-export-fuel.zip` (session `99c4607c`, opus / xhigh / ultracode), **interrompue par
limite de session** (`You've hit your session limit`, ~21:50 Paris) **en pleine phase de diagnostic**.

**Bilan : 0/5 demande finalisée.** Preuves : working tree **propre**, dernier commit `f0ea248` du
22/06 **07:35** (sans rapport, session = 21:52→22:14), transcript = **uniquement des outils lecture seule**
(Read/Glob/Grep/PowerShell + 1 sous-agent `Explore`). **Aucun `Edit`/`Write`/`vba_agent`** → 0 livrable.

## Demande utilisateur (unique, lignes 3/25 de l'export)

> « Dépôt `suivi-conso-carburant`. (App) Onglet *Historique* : plein au 01/01/1970, erreur ou à supprimer ?
> (Excel, onglet *Tableau de bord*) : ‹ ÉCONOMIES E85 vs SP98 › → économies brutes **et** nettes (inclus
> achat kit), changer le titre ; les chiffres du bandeau doivent dépendre du **véhicule sélectionné** (pas
> tous), en reprenant les indicateurs de l'onglet *Suivi carburant* ; adapter *Suivi carburant* pour que ses
> zones d'indicateurs changent selon le véhicule (ex. comme `slcVehicule`). Proposer des améliorations à noter
> dans `ROADMAP.md`. »

## Statut détaillé

| # | Demande | Statut | Preuve | Action restante |
|---|---------|--------|--------|-----------------|
| 1 | App/Historique — plein 01/01/1970 (erreur ou suppr ?) | 🔶 Partielle | Diagnostic **complet** du sous-agent `Explore` (récupéré, voir ci-dessous), jamais remonté ni corrigé | Remonter le diagnostic + garde-fou JS + purge ligne fantôme Sheet |
| 2 | Excel/Tableau de bord — éco. **brute ET nette** (inclus kit) + titre | ❌ À faire | `modDashboardKPI.bas` : `ds.eco` = brut. 0 modif | Ajouter valeur nette (brute − coût kit `B5`) + renommer titre |
| 3 | Excel/Tableau de bord — bandeau selon **véhicule sélectionné** | ❌ À faire | `ComputeDashboardStats(veh,…)` sait filtrer, mais rendu bandeau = « tous véhicules ». Lié à **X47** | Câbler le bandeau sur le véhicule (slicer `slcVehicule`/`B5`) |
| 4 | Excel/Suivi carburant — indicateurs réactifs au véhicule | ❌ À faire | Feuille **non versionnée** (.cls absent) = formules Excel, jamais inspectées | Inspecter formules (Excel ouvert) puis les rendre réactives |
| 5 | Proposer améliorations dans `ROADMAP.md` | ❌ À faire | `ROADMAP.md` non modifié depuis 22/06 07:33 | Rédiger les propositions |

## Diagnostic récupéré — bug 01/01/1970 (sous-agent `Explore`)

**Cause** : ligne d'en-tête **fantôme** dans le GS `_ImportGS` (Type="Type", Date="Date" → `new Date("Date")`
NaN → stockée à `0` → `new Date(0)` = 01/01/1970). Le filtre GAS `Code.gs:262` ne couvre que
`sync_id === "sync_id"` ; si le sync_id est vide/différent, ou si la ligne est déjà dans le cache
`localStorage` (`HIST_CACHE_KEY`), elle **survit côté client**. Aucun garde-fou epoch côté JS
(`js/historique.js` : `fmtDate` l.693-702, `isoDate` l.642-651, `_saveCache` l.106).

**Correctif suggéré** (non appliqué) — dans `chargerHistorique` (`js/historique.js` ~l.116, avant `_saveCache`) :
```js
allRecords = allRecords.filter(r => {
  const d = new Date(String(r.Date || r.Horodatage || '').replace(' ', 'T'));
  return !isNaN(d) && d.getFullYear() > 1970;
});
```
+ Côté Sheet : vérifier/supprimer toute ligne `_ImportGS` avec `Type="Type"` ou `sync_id="sync_id"`
(cf. leçons #52/#53 : Sheets API `batchUpdate deleteDimension`, API Sheets à activer dans le projet Cloud).

## Reprise

Demande utilisateur initiale du `/reprise-session` = **analyse seule** (« déterminer quelles demandes n'ont
pas été traitées ») → livrée. Exécution des items 🔶/❌ **en attente de validation** (ordre proposé : #1 app/JS
committable seul, puis #2→#4 VBA nécessitant **Excel ouvert** sur le classeur, puis #5 ROADMAP).
