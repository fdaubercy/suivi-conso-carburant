# W97 — Scanner « intelligent » : pompe, compteur, ticket

> Conception validée par sections le 2026-10-11. Statut : **spécification à relire** avant le plan d'implémentation.

## 1. Objectif

Permettre de pré-remplir le formulaire de saisie d'un plein à partir d'une photo de **l'affichage de la pompe** et d'une photo du **compteur kilométrique**, sans ticket de caisse. Le scan de ticket existant (W17) reste disponible et se combine avec ces photos.

- **Dit par l'utilisateur** : compteur + pompe doivent suffire ; la date et la localisation (station) restent saisies par l'utilisateur.
- **Hypothèses retenues** : rien n'est enregistré sans relecture (le formulaire sert d'écran de confirmation) ; le but est une saisie plus rapide et plus fiable à la pompe, ticket souvent absent ou illisible.
- **Succès** : km, litres, prix/L, coût et type de carburant pré-remplis et cohérents ; toute valeur douteuse est signalée sous son champ.

### Hors périmètre (cette version)

- Lecture de la date ou de la position GPS stockées dans la photo (EXIF).
- Conservation des photos de pompe et de compteur (seul le ticket est conservé, W9).
- Lecture hors ligne des photos de pompe et de compteur (Tesseract lit mal les afficheurs à segments).

## 2. Interface et parcours

- Le bouton « 🧾 Scanner le ticket » devient **« 📸 Scanner (pompe, compteur, ticket) »**, avec l'indication « 1 à 3 photos, dans n'importe quel ordre ». Même emplacement, aucun bouton supplémentaire.
- Le sélecteur de fichiers accepte **plusieurs images** (`multiple`). Au-delà de 3, seules les 3 premières sont gardées, avec un message.
- Déroulé :
  1. Redimensionnement des photos sur l'appareil (`resizeImage` existant) ; le bouton affiche « ⏳ Analyse IA (n photos)… ».
  2. Appel unique `action=scanPhotos` au script Google (section 3).
  3. Contrôle et fusion par `js/scanControle.js` (section 4).
  4. Remplissage du formulaire dans l'**ordre existant** de `fillFormFromTicket` : type, date, km, litres, station, puis prix en dernier. Les champs remplis prennent la classe `autofilled`.
  5. Alertes affichées **sous chaque champ douteux** (texte ⚠ ambre).
  6. Bilan : « 3 photos analysées : pompe ✓, compteur ✓, ticket ✓ — 6 champs pré-remplis, 1 à vérifier ».
- Date, station et véhicule restent saisis ou sélectionnés par l'utilisateur ; un ticket peut toujours proposer date et station comme aujourd'hui.

## 3. Contrat du script Google : `action=scanPhotos`

- **Fichier** : nouveau `Scan.gs` (ne pas alourdir `Code.gs`). `doPost` dirige `scanPhotos` **avant toute logique d'enregistrement de plein**, à côté de `scanTicket`, qui est conservé pour les clients en cache.
- **Requête** :
  ```json
  { "action": "scanPhotos", "images": [{ "data": "<base64>", "mimeType": "image/jpeg" }], "token": "…", "cid": "…" }
  ```
  - 1 à 3 images non vides, sinon refus explicite (`success:false`, message).
  - Authentification identique à `scanTicket` (jeton applicatif, S6) + limite de fréquence par appareil (`rateLimit(cid)`).
- **Appel Gemini** : un seul appel avec toutes les images ; `gemini-2.5-flash` ; `temperature: 0.1` ; `thinkingConfig.thinkingBudget: 0` ; **`responseMimeType: "application/json"`**.
- **Consigne** :
  - classer chaque image : `pompe`, `compteur`, `ticket` ou `inconnu` ;
  - **pompe** : « Litres / Volume », « Prix au litre », « Montant / À payer » ; afficheurs à segments ; `type_carburant` seulement s'il est lisible (étiquette du pistolet, voyant du produit) ;
  - **compteur** : le **total ODO**, jamais TRIP A ou B, en km ;
  - **ticket** : règles actuelles de `handleScanTicket` ;
  - valeur illisible = `null`, jamais devinée.
- **Réponse** :
  ```json
  { "success": true,
    "photos": [
      { "index": 0, "kind": "pompe",    "lisible": true,  "valeurs": { "litres": 16.14, "prix_litre": 0.869, "montant_total": 14.03, "type_carburant": null } },
      { "index": 1, "kind": "compteur", "lisible": true,  "valeurs": { "km": 19719 } },
      { "index": 2, "kind": "inconnu",  "lisible": false, "remarque": "photo floue" } ],
    "fusion": { "date": null, "km": 19719, "litres": 16.14, "prix_litre": 0.869, "montant_total": 14.03,
                "type_carburant": null, "enseigne": null, "ville": null, "station": null } }
  ```
  - Le serveur normalise : `kind` hors liste → `inconnu` ; nombres en chaîne → nombres.
  - `fusion` n'est qu'une proposition ; l'app repart des valeurs par photo.

## 4. Module de contrôle `js/scanControle.js`

Module **pur** (aucun accès DOM ni `localStorage`), testable isolément.

```
analyserScan(reponse, contexte) → { valeurs, sources, alertes, resume }
contexte = { stationPrices, historiqueVehicule, dernierKm, consoMoy, typeCourant }
```

- `stationPrices` : `state._stationPrices` (prix de la station sélectionnée) ; `historiqueVehicule` : pleins du véhicule courant ; `dernierKm` : `getMaxKmForVehicule` ; `consoMoy` : conso moyenne du véhicule (L/100) ; `typeCourant` : `state.currentType`.
- `sources[champ]` ∈ `pompe | compteur | ticket | calcul | deduit` ; `alertes[champ]` = message ; `resume` = photos reconnues et illisibles.
- Seuils en constantes nommées en tête du module.

### R1. Priorité des sources

- Litres, prix/L, montant : **pompe > ticket**. Écart > 2 % entre les deux → on garde la pompe, alerte « pompe et ticket diffèrent (a / b) ».
- Km : **compteur > ticket**.
- Date, enseigne, ville, station : ticket uniquement.
- Repli sur `fusion` si `photos` est absent ou vide.

### R2. Cohérence litres × prix = montant

- 3 valeurs : tolérance `max(0,05 €, 1 %)`. Hors tolérance → **pas d'auto-correction**, alerte sur Litres et Coût (« 16,14 × 0,869 = 14,03 € ≠ 15,03 € lus »).
- 2 valeurs : la troisième est calculée (source `calcul`).

### R3. Type de carburant

1. Candidats = carburants ayant un prix à la station ; restreints aux carburants déjà utilisés par le véhicule s'il a un historique.
2. Référence de chaque candidat : prix station, sinon médiane des prix payés par le véhicule pour ce carburant sur 90 jours.
3. Choix = candidat le plus proche du prix lu, si écart ≤ 8 % **et** 2ᵉ candidat au moins 2× plus éloigné → source `deduit`, alerte informative « type déduit du prix (0,869 €/L → E85) ».
4. Type lu par l'IA : conservé si compatible (écart ≤ 15 % avec sa référence), sinon alerte « type lu (SP98) incompatible avec 0,869 €/L ».
5. Ambigu ou sans référence → type courant conservé, alerte « type à vérifier ».

### R4. Kilométrage (si `dernierKm` connu)

- km ≤ `dernierKm` → « inférieur ou égal au dernier plein (19 719 km) ».
- km < 10 % de `dernierKm` → « compteur partiel (TRIP) lu ? ».
- Distance attendue = litres ÷ `consoMoy` × 100 ; écart réel hors [0,5 ; 1,6] × attendu → « 612 km pour 16,1 L : improbable (≈ 240 km attendus) ». Pas de contrôle sans `consoMoy`.

### R5. Prix plausible

- Écart > 10 % entre prix lu et prix station du type retenu → « différent du prix affiché par la station (0,899 €) ».

### Affichage

- `ticket.js` remplit le formulaire (ordre existant) et pose les alertes via un nouvel assistant `setFieldWarning(id, msg)` (`ui.js`) ; l'alerte s'efface à la modification du champ et au `resetForm`.

## 5. Erreurs, hors ligne, compatibilité

- **Hors ligne** : 1 photo → chemin Tesseract actuel (ticket) ; 2 ou 3 photos → rien n'est rempli, message « Analyse IA indisponible hors connexion — seul un ticket peut être lu hors ligne ».
- **Échec IA en ligne** : 1 photo → repli Tesseract ; plusieurs → « Analyse impossible : <cause>. Réessayez ou saisissez à la main. » Délai max 45 s (`AbortController`).
- **Limite de fréquence** : « Trop d'analyses, réessayez dans une minute. »
- **Réponse sans tableau `photos`** : erreur, rien n'est rempli.
- **Ordre de mise en service** : script Google (avec `Scan.gs`) **avant** l'app.
- **Photo jointe au plein (W9)** : seule l'image classée `ticket` devient `state._ticketPhoto` ; sans ticket reconnu, aucune photo n'est jointe.
- **Poids** : envoi refusé côté app au-delà d'environ 6 Mo au total.

## 6. Tests et vérification

- `tests/scanControle.test.js` : R1 à R5, cas nominaux et limites ; jeu réel (16,14 L × 0,869 = 14,03 € ; km 19 719 après 19 473) ; TRIP lu ; type ambigu ; pompe et ticket en désaccord ; une seule valeur lue.
- `tests/scanGas.test.js` : `Scan.gs` dans un bac à sable `vm` avec faux `UrlFetchApp` — refus de 0 et 4 images, analyse et normalisation du JSON Gemini, limite de fréquence.
- `tests/ticket.test.js` (complété) : plusieurs fichiers → un seul appel `scanPhotos` ; hors ligne avec 2 photos → message ; 1 photo → repli Tesseract (simulé) ; seule l'image `ticket` est jointe.
- **Vérification réelle** : appel du script déployé avec de vraies photos (pompe, compteur Z900) fournies par l'utilisateur avant livraison.
- Documentation : W97 dans CHANGELOG, README, ROADMAP.

## 7. Fichiers concernés

| Fichier | Changement |
|---|---|
| `Google Apps Script/Scan.gs` | **nouveau** — `handleScanPhotos_`, consigne, normalisation |
| `Google Apps Script/Code.gs` | `doPost` : aiguillage `scanPhotos` |
| `js/scanControle.js` | **nouveau** — `analyserScan` (R1 à R5) |
| `js/ticket.js` | sélection multiple, appel `scanPhotos`, remplissage + alertes, replis |
| `js/ui.js` | `setFieldWarning` / effacement |
| `index.html`, `css/style.css` | libellé du bouton, style `.field-warn` |
| `tests/scanControle.test.js`, `tests/scanGas.test.js`, `tests/ticket.test.js` | tests |
