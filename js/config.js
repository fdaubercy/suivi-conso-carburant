/* ─── Configuration globale ─── */
export const APP_VERSION       = '2.2.1.0';
export const GAS_URL           = 'https://script.google.com/macros/s/AKfycbzljFbh6Qcg9IadJ2yUePR56hpkSzrLsyuJLaxwB1qk7aoLcWzoHzH2btSbwV7tDeJGA/exec';
export const GS_SHEET_ID       = '1uN170kt_n45sBRwqs2krTYfhapU3dMKjTguD-qSUqCE';
export const PRIX_API          = 'https://data.economie.gouv.fr/api/explore/v2.1/catalog/datasets/prix-des-carburants-en-france-flux-instantane-v2/records';
export const VEHICULES_KEY     = 'suivi_e85_vehicules';
export const LAST_VEHICULE_KEY = 'suivi_e85_last_vehicule';

export const FUEL_CONFIG = {
  E85:    { apiField: 'e85_prix',    label: 'SuperEthanol E85', short: 'E85',    icon: '🌿', ph: '0.798' },
  SP98:   { apiField: 'sp98_prix',   label: 'Super 98',         short: 'SP98',   icon: '💧', ph: '2.091' },
  SP95:   { apiField: 'sp95_prix',   label: 'Sans Plomb 95',    short: 'SP95',   icon: '🔵', ph: '1.890' },
  E10:    { apiField: 'e10_prix',    label: 'Sans Plomb E10',   short: 'E10',    icon: '🟢', ph: '1.850' },
  GAZOLE: { apiField: 'gazole_prix', label: 'Gazole',           short: 'Gazole', icon: '⚫', ph: '1.750' },
  GPLC:   { apiField: 'gplc_prix',   label: 'GPLc',             short: 'GPLc',   icon: '🟡', ph: '0.850' },
};
export const FUEL_KEYS   = Object.keys(FUEL_CONFIG);
export const FUEL_SELECT = 'adresse,ville,cp,geom,services,' + FUEL_KEYS.map(k => FUEL_CONFIG[k].apiField).join(',');
export const FUEL_ANY    = '(' + FUEL_KEYS.map(k => `${FUEL_CONFIG[k].apiField} is not null`).join(' OR ') + ')';
