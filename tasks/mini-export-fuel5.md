# Mini-export — reprise session « fuel5 » (2026-07-03)

Export analysé : `session-export-fuel5.zip` (session `e6942a1e`, 2026-07-02 20:47 → 07-03 00:26, opus/medium/auto).
Demande unique de l'export : **W44+C1+G4+G5** + propositions ROADMAP. `W44` désambiguïsé en séance = **X44** (modularisation VBA).

## Statut par demande (preuves vérifiées)

| Demande | Statut | Preuve |
|---|---|---|
| **C1** — libellés « Super 95/98 » | ✅ finalisée | commit `401a234` (poussé, HEAD=origin/main) ; vérifié live `FuelKeyP('Super 95')='SP95'` |
| **G4** — dashboard Sheets enrichi (filtrage email, 3 graphes, refresh) | ✅ finalisée | commit `401a234` + `gas-deploy` **v61 poussé** (déploiement autorisé après blocage classifier) |
| **G5** — auto-maintenance listes de saisie | ✅ finalisée | commit `401a234` ; `modValidation`/`ModuleImportGS` injectés COM + vérifiés live |
| **X44 (=W44)** — modularisation VBA Phase 4 | 🔶 **partielle, NON COMMITÉE** | voir ci-dessous |

## Action restante — X44 Phase 4 (« reste optionnel » au ROADMAP)

Découpe fine des modules VBA > 500 lignes, **1 module à la fois par injection COM à haut risque** (leçons #98–#103 : fantômes, portée compile-on-demand, hangs). Exige Excel ouvert **normalement** (macros actives) + présence utilisateur.

- **Module 1 — `modGraphData` → `modGraphBlocks`** : ✅ **codé sur disque + injecté COM + vérifié live** (`CreerGraphiquesWeb` OK), **mais NON COMMITÉ**.
  - Working tree : `M vba/modGraphData.bas` (702 → 359 l.), `?? vba/modGraphBlocks.bas` (372 l.).
  - Contenu extrait : `BuildPriceBlockMerged`, `BuildConsoBlock`, `BuildVehiculesBlock` (Public) + `InCsvSel`/`FindListObject`/`AddToSum` (Private). Split propre (1 seul `Attribute VB_` en L1 sur chaque fichier).
  - **Décision utilisateur 2026-07-03 : NE RIEN COMMITTER pour l'instant.** Le split reste sur disque, à finaliser plus tard.
  - Si reprise pour committer : bump `APP_VERSION` (js/config.js L2, **à la main** — leçon #86/#87 récurrente) + package.json + CHANGELOG + ROADMAP (passer module-1 en « implémenté ») + `graphify --update` (garde anti-amputation) → `commit.sh`.

- **Modules 2-4 — NON COMMENCÉS** (session coupée en lisant `modGraphRender`) :
  - `modGraphRender` 549 → extraire chrome (`EnsureParamBlock`/`EnsureButtons`/`EnsurePictureButton`/`EnsureHeaderBand`) → **`modGraphChrome`** (`StyleShape` à passer Public, vérifier anti-collision `BuildKPICards`).
  - `modSyncEngine` 678 → extraire l'export Excel→GS → **`modSyncExport`**.
  - `modSyncGS` 763 → extraire diag (`TestConnexion`/`SyncDiagnose`/`RafraichirPrixHistory`) → **`modSyncDiag`**.

## Notes
- Aucune nouvelle leçon consignée : la reprise n'a révélé aucune erreur/correction (analyse propre).
- Recette d'injection fiable (leçons #102/#112) : `remove` (proc 1, sortir) → vérifier absence (proc 2) → `import` depuis chemin temp court (proc 3) → inspect (fantômes/L1) → run public read-only (compile-proof) → save. Interpréteur : `C:/Users/fdaub/AppData/Local/Programs/Python/Python313/python.exe`.
