# Mini-export fin de session — reprise « fuel2 » (2026-07-01)

## Contexte
Reprise de l'export `session-export-fuel2.zip` (lui-même reprise de fuel1).
Demande unique de la chaîne : `W78+W82+X40+X44+X47+X48+S13`.
fuel2 s'était arrêté (session limit) **en plein milieu de la conception de X44**
(vérif d'équivalence des copies `modSyncParametres` interrompue).

## Traité dans cette reprise
- **X44 Phase 1 livrée** → commit `3c65b26` [v5.30.2.0] :
  - Extraction de `modSyncGS.bas` (1663 → 1420 l.) vers **`modSyncJson.bas`** (helpers JSON purs, Public)
    et **`modSyncNet.bas`** (couche HTTP + `T_*`, Public).
  - Dédup **`modSyncParametres.bas`** (555 → 480 l., copies HTTP/JSON équivalentes retirées).
  - Corrections de design (audit pureté/collision) : `RowToJson` (dépend `COL_MODIFIED`) et
    `ToNum` (collision `modSaisie.ToNum` Public) **conservés** dans modSyncGS.
  - Injecté en live par COM (`Import` — repli après hang `AddFromString`), compilé,
    `GenerateUUID`+`TestConnexion` OK, classeur enregistré. Linter X40 propre.
  - Nettoyage ROADMAP : X47/X48 retirés de la table « à faire » (doublon stale, déjà en « implémentées »).

## Reste à faire (prochaine reprise)
| Item | Description | Effort |
|------|-------------|--------|
| **X44 Phase 2** | Découpe du moteur `SyncCore`/import-export de `modSyncGS` (encore **1420 l.** > 500). Plus risqué (chemin critique sync/données, état module `COL_*`/`GAS_URL`). Brainstorming recommandé. | ~1-2 h |
| **X44 Phase 3** | `modGraphiques.bas` (~1500 l.) → `modGraphData`/`modGraphRender`/`modGraphExport`. Point dur : ~30 `Private Const` + état `mPerDeb`/`mPerFin` transverses (agrégation ↔ rendu) → migration en module commun `Public Const`. | ~1 j |
| **X53** | Nettoyage code mort `ComputeDashboardStats.eco`/`ComputeKPIs.outEco` (suite X47). | ~30 min |

## À signaler (repéré en passant)
- **`TestConnexion` renvoie HTTP 404** depuis le classeur live (le round-trip réseau réussit,
  mais l'endpoint GAS répond 404). Indépendant du refactor X44 (couche HTTP byte-identique,
  `GAS_URL` inchangé). Piste : souci de déploiement/autorisation GAS (cf. mémoire `gas-403-rotation-oauth`).
  À diagnostiquer séparément si la synchro Excel↔GAS est en panne côté utilisateur.

## Pré-requis techniques (X44 suite)
- Excel **ouvert normalement** (macros actives) pour injection COM + test live.
- Injection : préférer `VBComponents.Import(vba/Mod.bas)` (canonique, robuste) plutôt que
  `set-module`/`AddFromString` (a hangé). Interpréteur COM par chemin complet Python313.
