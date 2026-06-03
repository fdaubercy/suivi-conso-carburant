/* ─── Configuration globale ─── */
export const APP_VERSION       = '4.17.0.0';
export const GAS_URL           = 'https://script.google.com/macros/s/AKfycbwIyCfZVTpDOGBANtFcHECcCdbg4J4t377pKQjIJ0NJYFT9FMjZm5_6XOsyQAas8jeTyA/exec';

// S6 — Token secret partagé avec les endpoints GAS et la macro VBA.
// Mode SOUPLE : le GAS ne rejette les requêtes QUE si la propriété de script
// APP_TOKEN est définie côté Apps Script. Tant qu'elle n'est pas posée, tout
// continue de fonctionner sans token (rétrocompatible). Pour activer :
//   Apps Script → Paramètres du projet → Propriétés du script → APP_TOKEN = (cette valeur)
//   + coller la même valeur dans vba/modSyncGS.bas (Const APP_TOKEN).
// ⚠️ Sécurité par obscurité : ce fichier étant servi publiquement (GitHub Pages),
// le token relève le niveau d'accès mais n'est pas un secret cryptographique.
export const APP_TOKEN         = 'e85_a7f3c9e21b8d4f60a5c3e8b7d12f6049';

// S8 — Web Push : clé publique VAPID (base64url, format "raw" 65 octets).
// Générer la paire avec generateVapidKeys() dans le projet Apps Script, puis
// coller ici la clé PUBLIQUE et stocker la PRIVÉE dans les Propriétés du script.
// Laisser '' désactive l'abonnement push (les alertes locales restent actives).
export const VAPID_PUBLIC_KEY  = 'BHhoGWV7022keNa8RfsgZcKTZaJ0f0lXrHlxJCRmYn5PWZ8O6EvvQFGdbZHqQTxh_mD9lZKbZTUZQWq7xdlbcYw';
export const GS_SHEET_ID       = '1uN170kt_n45sBRwqs2krTYfhapU3dMKjTguD-qSUqCE';
export const PRIX_API          = 'https://data.economie.gouv.fr/api/explore/v2.1/catalog/datasets/prix-des-carburants-en-france-flux-instantane-v2/records';
export const VEHICULES_KEY     = 'suivi_e85_vehicules';
export const LAST_VEHICULE_KEY = 'suivi_e85_last_vehicule';
export const HIST_CACHE_KEY    = 'suivi_e85_hist_cache';
export const HIST_SINCE_KEY    = 'suivi_e85_hist_since';
export const DRAFT_KEY         = 'suivi_e85_draft';
export const CLIENT_ID_KEY     = 'suivi_e85_client_id';
export const KIT_PRIX_KEY      = 'suivi_e85_kit_prix';
export const SECTOR_CACHE_KEY  = 'suivi_e85_sector_cache';  // W38 — prix secteur quotidien (cache)
export const STATS_CACHE_KEY   = 'suivi_e85_stats_cache';   // S12/W59 — agrégats serveur (cache TTL 1 h)
export const WRAPPED_SCOPE_KEY = 'suivi_e85_wrapped_scope'; // W37 — périmètre Wrapped (vehicule|all)
export const BUDGET_KEY        = 'suivi_e85_budget_mensuel'; // W39 — objectif budget carburant mensuel (€)
export const CO2_OBJECTIF_KEY  = 'suivi_e85_objectif_co2';   // W51 — objectif CO₂ annuel évité (kg)
export const STATION_SORT_KEY  = 'suivi_e85_station_sort';   // W36 — tri carte stations : 'prix' | 'freq'
export const PINNED_STATIONS_KEY = 'suivi_e85_pinned_stations'; // W53 — stations épinglées manuellement (📌, JSON tableau de noms)
export const CSV_SEP_KEY        = 'suivi_e85_csv_sep';       // W54 — séparateur d'export CSV : ';' (Excel FR) | ',' (anglo)
export const HIST_SEEN_KEY     = 'suivi_e85_hist_seen';      // W45 — nb de pleins déjà consultés (badge Historique)
export const CARTE_SEEN_KEY    = 'suivi_e85_carte_seen';     // W45 — jour de dernière ouverture de la Carte (badge secteur)
export const START_VIEW_KEY    = 'suivi_e85_start_view';     // U4 — vue d'ouverture : 'accueil' | 'saisie' | 'last'
export const LAST_VIEW_KEY     = 'suivi_e85_last_view';      // U4/U5 — dernière vue consultée (pour 'last' + tuile « reprendre »)
export const COLLAPSE_PREFIX   = 'suivi_e85_collapse_';      // U6 — état replié des blocs Réglages (préfixe + clé de bloc)
export const SURCONSO_KEY      = 'suivi_e85_surconso';      // P1 — surconso métier partagée (Excel J7) : défaut quand pas de données S98
export const PARAMS_META_KEY   = 'suivi_e85_params_meta';   // P1 — horodatages locaux par clé pour la synchro LWW des paramètres

// U4 — vue d'ouverture par défaut quand aucune préférence n'est enregistrée.
export const DEFAULT_START_VIEW = 'accueil';

// W36 — Station favorite : une station habituelle devient « favorite » (badge ⭐)
// à partir de ce nombre de pleins. Distinct du ★ « meilleur prix ». Configurable.
export const FAVORITE_MIN_PLEINS = 4;

// W40 — Empreinte CO₂ E85 vs essence (combustion, tank-to-wheel).
// Référence essence : SP95-E10 ≈ 2,21 kg CO₂/L. L'E85 émet ≈ −50 % à la
// combustion → CO2_E85 ≈ 1,105 kg CO₂/L. Le CO₂ évité est calculé à distance
// égale : litres essence équivalents = litres E85 / (1 + surconsommation).
export const CO2_ESSENCE_PER_L = 2.21;                       // kg CO₂/L (SP95-E10)
export const CO2_E85_RATIO     = 0.50;                       // E85 ≈ −50 % à la combustion
export const CO2_E85_PER_L     = CO2_ESSENCE_PER_L * CO2_E85_RATIO; // ≈ 1,105 kg CO₂/L

// W51 — Objectif CO₂ / éco-score annuel.
// Objectif par défaut (kg CO₂ évités sur l'année), modifiable dans ⚙️.
// Équivalents « parlants » : 1 km en voiture thermique ≈ 0,12 kg CO₂ (≈ 120 g/km,
// moyenne parc WLTP) ; 1 arbre absorbe ≈ 25 kg CO₂/an.
export const DEFAULT_CO2_OBJECTIF   = 200;  // kg CO₂/an
export const CO2_THERMIQUE_PER_KM   = 0.12; // kg CO₂/km (voiture thermique moyenne)
export const CO2_ARBRE_PAR_AN       = 25;   // kg CO₂ absorbés par un arbre/an

// Économie E85 vs SP98 — aligné sur le dashboard Excel (feuille « Suivi Carburant »).
// Surconsommation calculée dynamiquement (conso E85 / conso S98 − 1, cellule J7) ;
// la valeur ci-dessous sert de défaut quand il n'y a pas de données S98.
export const DEFAULT_SURCONSO  = 0.20;   // +20% par défaut (Excel J7)
export const DEFAULT_KIT_PRIX  = 514.54; // prix du kit de conversion (cellule B5 Excel)

export const FUEL_CONFIG = {
  E85:    { apiField: 'e85_prix',    label: 'SuperEthanol E85', short: 'E85',    icon: '🌿', ph: '0.798' },
  SP98:   { apiField: 'sp98_prix',   label: 'Super 98',         short: 'SP98',   icon: '💧', ph: '2.091' },
  SP95:   { apiField: 'sp95_prix',   label: 'Sans Plomb 95',    short: 'SP95',   icon: '🔵', ph: '1.890' },
  E10:    { apiField: 'e10_prix',    label: 'Sans Plomb E10',   short: 'E10',    icon: '🟢', ph: '1.850' },
  GAZOLE: { apiField: 'gazole_prix', label: 'Gazole',           short: 'Gazole', icon: '⚫', ph: '1.750' },
  GPLC:   { apiField: 'gplc_prix',   label: 'GPLc',             short: 'GPLc',   icon: '🟡', ph: '0.850' },
};
// Seuil de rentabilite E85 vs SP98 : E85 consomme ~30% de plus
// → pour etre rentable, prix_E85 doit etre < 66% du prix SP98
export const E85_RENTABLE_RATIO = 0.66;

export const FUEL_KEYS   = Object.keys(FUEL_CONFIG);
export const FUEL_SELECT = 'adresse,ville,cp,geom,services,' + FUEL_KEYS.map(k => FUEL_CONFIG[k].apiField).join(',');
export const FUEL_ANY    = '(' + FUEL_KEYS.map(k => `${FUEL_CONFIG[k].apiField} is not null`).join(' OR ') + ')';
