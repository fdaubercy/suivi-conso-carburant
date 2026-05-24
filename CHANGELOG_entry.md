## [2.1.0.0] — 2026-05-24

### Added
- **Sélecteur de véhicules** (localStorage) : nouvelle section en tête de formulaire. Liste déroulante avec les véhicules enregistrés + deux actions intégrées : `＋ Ajouter un véhicule` (champ inline avec confirmation) et `✕ Supprimer ce véhicule` (confirme la suppression du véhicule actuellement sélectionné). Les véhicules sont persistés dans `localStorage` sous la clé `suivi_e85_vehicules`. Le nom du véhicule est inclus dans le payload envoyé à Google Sheets (champ `vehicule`).
- **`chargerVehicules()`** : charge la liste depuis localStorage, restaure la sélection courante.
- **`sauvegarderVehicules(liste)`** : persiste le tableau en localStorage.
- **`onVehiculeChange()`** : gère les trois cas — sélection d'un véhicule, ajout, suppression.
- **`confirmerAjoutVehicule()`** : validation du nom, ajout à la liste, sélection automatique.
- **`setVehiculeStatus(cls, msg)`** : statut inline sous le sélecteur (même pattern que `setGeoStatus`).
- **`buildStations(results)`** : helper extrait pour factoriser la construction du tableau de stations (évite la duplication entre recherche avec et sans proximité).
- **`buildSearchClause(q)`** : détecte automatiquement si la saisie est un code postal (2-5 chiffres → `cp like 'q%'`) ou une ville (`search(ville, 'q')`).

### Changed
- **Recherche manuelle — champ ciblé** : remplacement du paramètre `q` (full-text tous champs) par `search(ville, 'q')` en ODSQL. La recherche est désormais accent-insensible et porte uniquement sur le champ `ville` — élimine les faux positifs (stations dont l'adresse contient le terme recherché dans une autre ville). Fallback automatique sans proximité si aucun résultat local.
- **`searchStationSuggestions`** : refactorisé pour utiliser `buildSearchClause` et `buildStations`.
- **`searchStationSuggestionsGlobal` renommée `searchStationSuggestionsNoProx`** : cohérence de nommage.
- **`resetForm`** : le véhicule sélectionné est intentionnellement conservé entre deux pleins consécutifs.
- **`submitForm`** : inclut `vehicule: currentVehiculeNom` dans le payload JSON envoyé au GAS.
- **`index.html`** : section "Véhicule" ajoutée en tête du formulaire ; placeholder du champ `fAutre` mis à jour ("Ville de la station", exemples de villes).

### Note GAS (optionnel)
Pour enregistrer le véhicule dans Google Sheets, ajouter la colonne `Véhicule` dans l'onglet `_ImportGS` et mettre à jour `doPost` :
```javascript
sheet.appendRow([
  new Date(), new Date(payload.date), payload.type,
  Number(payload.km), Number(payload.litres), Number(payload.prix),
  payload.prixS98 ? Number(payload.prixS98) : '',
  payload.station, payload.vehicule || ''   // ← nouvelle colonne
]);
```

