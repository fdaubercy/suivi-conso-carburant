# 🛠️ Installation & mise à jour — Suivi E85

Récapitulatif pour (ré)installer les modules VBA Excel et le rapport mensuel Google Apps Script.
Version de référence : **v4.14.0.0**.

> 💡 Astuce : après import, lance la macro **`VerifierInstallation`** (Alt+F8) — elle contrôle feuilles + tableaux requis et affiche le bilan dans la barre d'état + la fenêtre Exécution (Ctrl+G).

---

## 0. 🚀 GO ! — Installation en un clic

Une fois les modules importés et les snippets collés (détails §1), **tout se monte d'une seule macro** :

1. **Alt + F11** → importer tous les `vba/*.bas` (clic droit sur l'ancien module → **Supprimer**, puis **Fichier → Importer un fichier**).
2. Coller les snippets de feuille : `ThisWorkbook_snippet.bas` → **ThisWorkbook**, `Reglages_snippet.bas` → feuille **Reglages**, `Carte_snippet.bas` → feuille **Carte**, `GS_Pleins_snippet.bas` → feuille **GS_Pleins**.
3. **Debug → Compiler VBAProject** (détecte d'un coup les erreurs de tous les modules).
4. **Alt + F8 → `Installer`** → exécuter. Résumé en barre d'état + **détail dans Exécution (Ctrl+G)**.

`Installer` enchaîne, **de façon tolérante** (une étape en échec n'interrompt pas les suivantes) :

| Étape | Macro | Effet |
|---|---|---|
| 1 | `InstallerDashboard` | Feuilles miroir : Reglages + Historique + Carte + **Stats (Tableau de bord)** + Accueil. La feuille **Stats** est montée via `modGraphiques.CreerGraphiquesWeb`. |
| 2 | `RafraichirFeatures` | MFC « Prix €/L » + onglet « Suivi (auto) » + synchro `Tableau2` |
| 3 | `VerifierInstallation` | Contrôle final : feuilles + tableaux requis |

> 💡 `InstallerDashboard` peut aussi se lancer **seul** pour ne (re)monter que les feuilles miroir du dashboard (dont la feuille **Stats**). Prérequis : `modReglages`, `modHistorique`, `modCarte`, `modGraphiques` importés.

---

## 1. Excel — modules VBA (`Suivi Conso Carburants.xlsm`)

Ouvre l'éditeur VBA : **Alt + F11**.

### 1.1 Prérequis (une seule fois)
- **Fichier → Options → Centre de gestion de la confidentialité → Paramètres… → Paramètres des macros**
  → cocher ☑️ **« Accès approuvé au modèle objet du projet VBA »** (requis pour générer `frmPleinE85` par code).

### 1.2 Modules standards à (ré)importer
Pour chacun : clic droit sur l'ancien module → **Supprimer** (sans exporter) → **Fichier → Importer un fichier** → choisir le `.bas`.

| Fichier | Rôle |
|---|---|
| `vba/ModuleImportGS.bas` | Import GS → Excel **+ helper public `SetStatus`/`ResetStatus`** (les autres modules en dépendent — importer en premier) |
| `vba/modSyncGS.bas` | Synchronisation bidirectionnelle Excel ↔ Google Sheets |
| `vba/modDashboard.bas` | Tableau de bord (KPIs + graphiques) |
| `vba/modFeatures.bas` | MFC « Prix €/L », onglet « Suivi (auto) », **vue Tableau2**, `VerifierInstallation` |
| `vba/modSaisie.bas` | Moteur de saisie (`EnregistrerPlein`…) + `frmPleinE85` |

### 1.3 Module de feuille
- `vba/GS_Pleins_snippet.bas` : **ne pas importer comme module standard** → ouvrir l'objet feuille **`GS_Pleins`** dans l'explorateur de projet et **coller** le contenu dans sa fenêtre de code.
- `vba/ThisWorkbook_snippet.bas` : coller dans **`ThisWorkbook`** (lance la sync à l'ouverture).

### 1.4 Formulaire personnalisé `frmNouveauPlein`
Tu modifies ce form **à la main** (mise en page custom) → **ne pas réimporter le `.frm`** par-dessus.
- Ajouter dans le designer une **ComboBox nommée `cmbVehicule`** (+ un label « Véhicule : »).
- Coller les 2 procédures à jour (`UserForm_Initialize` et `btnEnregistrer_Click`) — voir `vba/frmNouveauPlein.frm` du repo comme référence.

### 1.5 Activer / rafraîchir
Alt + F8 puis exécuter :

| Macro | Effet |
|---|---|
| `Installer` | **GO !** Installation complète en un clic (dashboard + analyse + graphiques + vérification), tolérante, bilan Ctrl+G |
| `InstallerDashboard` | Monte toutes les feuilles miroir : Reglages + Historique + Carte + **Stats** + Accueil |
| `VerifierInstallation` | Contrôle que tout est en place |
| `RafraichirFeatures` | MFC « Prix €/L » + onglet « Suivi (auto) » + synchro `Tableau2` |
| `SyncTableau2DepuisGS` | (Re)remplit les colonnes brutes de `Tableau2` depuis `GS_Pleins` (calculs préservés) |
| `NouveauPlein` | Affiche le formulaire `frmPleinE85` |
| `AjouterBoutonSaisie` | Pose un bouton « + Nouveau plein » sur `GS_Pleins` |

### 1.6 Feuilles / tableaux attendus
| Élément | Utilisé par |
|---|---|
| Feuille `GS_Pleins` + son tableau | Source unique des pleins (↔ Google Sheets) |
| Feuille `Suivi Carburant` + `Tableau2` | Vue dérivée + calculs (conso, coûts, économie E85) |
| Feuille `Notes` + `tbl_stationEssence` | Liste des stations (`frmNouveauPlein`) |
| Feuille `Vehicules` (col A) | *Optionnelle* — curer la liste des véhicules |
| Feuille `Suivi (auto)` | Générée par `CreerSuiviAuto` |

---

## 2. Architecture des données (qui alimente quoi)

```
        frmNouveauPlein / frmPleinE85
                    │  EnregistrerPlein
                    ▼
            ┌──────────────┐   sync bidirectionnelle   ┌──────────────┐
            │  GS_Pleins   │ ◄───────────────────────► │ Google Sheets│
            │ (source)     │                           │  / app web   │
            └──────┬───────┘                           └──────────────┘
                   │ vues dérivées (formules INDEX, lecture seule)
         ┌─────────┴───────────┐
         ▼                     ▼
   Onglet « Suivi (auto) »   Tableau2 (Suivi Carburant)
   (toutes colonnes)         colonnes brutes ← GS_Pleins
                             colonnes de calcul = formules conservées
```

`GS_Pleins` est la **source unique de vérité**. `Tableau2` ne se saisit plus à la main : ses colonnes
brutes (Date, Type, Km, Litres, Prix, Station) sont tirées de `GS_Pleins` par formules ; ses colonnes
de calcul (Nb. km, Coût, Conso, Économie…) sont **inchangées**.

---

## 3. Google Apps Script — rapport mensuel

1. Google Sheet → **Extensions → Apps Script**.
2. Créer un fichier `RapportMensuel` et y coller `Google Drive/…/Google Apps Script/RapportMensuel.gs`.
3. **⚙️ Paramètres du projet → afficher `appsscript.json`** → compléter `oauthScopes` :
   ```json
   "oauthScopes": [
     "https://www.googleapis.com/auth/spreadsheets",
     "https://www.googleapis.com/auth/script.external_request",
     "https://www.googleapis.com/auth/script.scriptapp",
     "https://www.googleapis.com/auth/script.send_mail",
     "https://www.googleapis.com/auth/userinfo.email"
   ]
   ```
4. Exécuter **`installerTriggerRapportMensuel`** une fois → autoriser l'accès (écran « non vérifiée » → *Paramètres avancés → Accéder à…*).
5. Tester avec **`testRapportMensuel`** → réception immédiate du bilan du mois précédent.

| Fonction | Usage |
|---|---|
| `installerTriggerRapportMensuel` | Crée le déclencheur (1er du mois, ~8 h) |
| `testRapportMensuel` | Envoie le rapport tout de suite |
| `supprimerTriggerRapportMensuel` | Désactive le rapport |

---

## 4. Vérification finale

- [ ] `VerifierInstallation` → « Tout est en place »
- [ ] `RafraichirFeatures` → colonne Prix colorée (vert/rouge) + onglet « Suivi (auto) » + `Tableau2` à jour
- [ ] Saisie via `frmNouveauPlein` → nouvelle ligne dans `GS_Pleins` (Horodatage + sync_id + véhicule), et `Tableau2` se met à jour automatiquement
- [ ] `testRapportMensuel` (GAS) → mail reçu
