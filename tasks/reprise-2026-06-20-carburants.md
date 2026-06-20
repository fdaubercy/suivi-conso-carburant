# Mini-export de reprise — 2026-06-20 (« essencee85 » / carburants)

Reprise de `session-export-carburants (2).zip` (session `1cdbb0f8`), interrompue par limite de session
juste après « Utilise la voie A ». Toutes les demandes utilisateur ont été traitées.

## Demandes traitées cette session

| # | Demande | Statut | Preuve |
|---|---------|--------|--------|
| 1 | Voie A — supprimer la ligne fantôme GS + déployer `Code.gs` | ✅ | GAS v56 déployé ; ligne `_ImportGS` r18 (`sync_id="sync_id"`) supprimée via Sheets API (0 restante) |
| 2 | Débloquer macros / erreur `Attribute VB_Name="modCleanGhost"` | ✅ | Parasite `Attribute` retiré de `modSyncGS` ; `CreerSuiviAuto` s'exécute (`ok:true`) = projet compile |
| 3 | Rebuild `Suivi (auto)` + refresh prix | ✅ | `Suivi (auto)` MAX 16/06 (était 28/05) ; `RafraichirPrixHistory` + `RecreerDashboardComplet` OK |
| 4 | Où sont stockés les relevés quotidiens ? | ✅ | GS onglet `_PrixHistory` (Station/Date/Type/Prix), écrit par `RefreshPrix.gs` (déclencheur ~7h) |
| 5 | Prix bloqués au 16/06 — vérifier/corriger | ✅ | PQ `PrixHistory` était une copie de `GS_Pleins` → re-synchronisée (4 col, 3922 lignes, dates jusqu'au 19/06) ; `gPrice` GAZOLE/SP98/E85 continus |
| 6 | `Tableau2` col K « Prix S98 jour » vide (l. 31-32) | ✅ | Formule = `GS_Pleins[SP98 station]` sinon moyenne marché ; l.31=2.035, l.32=1.975 |
| 7 | Carte alentour : zoom adapté aux stations/rayon | ✅ | Option `fitStationsOnly` (`gmaprender.js`/`carte.js`/`cartealentour.js`) ; lint+build+254 tests OK |
| 8 | Noter « parler français » dans CLAUDE.md | ✅ | Section « 🗣️ Langue de travail — OBLIGATOIRE » ajoutée |

Commit local : **`07322ad`** `fix(prix): ... [v5.21.1.0]` (11 fichiers). GAS déjà déployé en prod (v56).

## Actions restantes

- ⏳ **Push GitHub** (en attente d'accord — déclenche le déploiement GitHub Pages de la PWA). Commits non poussés : `07322ad` + le commit `docs(lessons)` de clôture.
- 👁️ **Vérifications visuelles utilisateur** (non testables ici) :
  - Excel : `gPrice` montre bien les courbes marché quotidiennes (E85/SP98/GAZOLE) jusqu'à aujourd'hui ; col K remplie sur les lignes récentes.
  - App (mobile, GPS) : carte « E85 les moins chers autour de moi » → le zoom cadre sur les stations trouvées selon le rayon.

## Notes / pièges (voir tasks/lessons.md #50-#53)

- PQ live peut ≠ `.m` disque (PrixHistory/GS_Pleins étaient des copies erronées) → vérifier le schéma réel.
- `vba_agent set-module` n'enlève pas `Attribute VB_Name` → casse la compilation (`-2146827284`).
- Scope OAuth `spreadsheets` accordé ≠ API Sheets activée dans le projet Cloud.
- `/graphify --update` sauté au commit (leçons #37/#44 : amputation du graphe sans clé LLM).
