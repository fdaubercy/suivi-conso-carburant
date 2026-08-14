/* ═══════════════════════════════════════════════════════════════════════
   refmodel.js — Modèle de référence unifié « E85 vs carburant au choix »

   Compare l'E85 à un carburant de référence sélectionnable : essence que le
   moteur flex-fuel peut brûler (SP98 / SP95 / E10) OU gazole (diesel), qui est
   le moteur d'un AUTRE véhicule.

   Cœur : pour un plein E85 de `lit` litres, les litres de référence à distance
   égale valent `lit × ratioConso`, où ratioConso = consoRef / consoE85.
     • Essence : consoRef = consoE85 / (1 + surconso)  ⇒  ratioConso = 1/(1+surconso)
     • Diesel  : consoRef = conso L/100 mesurée sur le véhicule diesel choisi
                 (sinon saisie manuelle, sinon défaut berline) ⇒ ratioConso = consoDiesel/consoE85

   Module PUR (aucun accès DOM/localStorage) : toutes les entrées sont passées
   en paramètres pour rester testable. Les wrappers de stats.js/rentabilite.js
   lisent les réglages localStorage puis appellent ces fonctions.
   ═══════════════════════════════════════════════════════════════════════ */
import { FUEL_CONFIG, CO2_ESSENCE_PER_L, CO2_GAZOLE_PER_L, DEFAULT_CONSO_DIESEL } from './config.js';

/** Matche un Type GS (label complet « SuperEthanol E85 ») avec une clé FUEL_CONFIG (E85).
 *  Réplique de stats.js#matchType (gardé local pour préserver la pureté du module). */
function matchType(rType, fuelKey) {
  if (!rType || !fuelKey) return false;
  const t = String(rType).toLowerCase();
  const cfg = FUEL_CONFIG[fuelKey];
  if (!cfg) return false;
  return t === cfg.label.toLowerCase()
      || t.includes(cfg.short.toLowerCase())
      || (fuelKey === 'E85' && t.includes('ethanol'));
}

/**
 * Conso moyenne (L/100 km) d'un carburant, calculée sur les deltas km entre
 * pleins successifs (même méthode que la surconso : les litres du plein i
 * couvrent la distance parcourue depuis le plein i-1).
 * @returns {number} conso moyenne, ou 0 si indéterminable.
 */
export function computeConsoMoy(records, fuelKey) {
  const sorted = (records || [])
    .filter(r => Number(r['Km compteur'] || 0) > 0)
    .sort((a, b) => {
      const da = new Date(String(a.Date || a.Horodatage || '').replace(' ', 'T'));
      const db = new Date(String(b.Date || b.Horodatage || '').replace(' ', 'T'));
      return da - db;
    });
  const consos = [];
  for (let i = 1; i < sorted.length; i++) {
    const km0 = Number(sorted[i - 1]['Km compteur'] || 0);
    const km1 = Number(sorted[i]['Km compteur'] || 0);
    const lit = Number(sorted[i]['Nb. Litres'] || 0);
    const dk  = km1 - km0;
    if (dk <= 0 || lit <= 0) continue;
    if (!matchType(sorted[i].Type, fuelKey)) continue;
    consos.push((lit / dk) * 100);
  }
  if (!consos.length) return 0;
  return consos.reduce((s, v) => s + v, 0) / consos.length;
}

/**
 * Conso diesel de référence : mesurée sur les pleins gazole du véhicule diesel
 * choisi ; sinon la saisie manuelle (> 0) ; sinon le défaut berline.
 * @param {Array}  allRecords          tous les pleins
 * @param {string} vehiculeDieselRef   nom du véhicule diesel de référence ('' = aucun)
 * @param {number} consoDieselManuelle L/100 saisie de repli (0/NaN = ignorée)
 * @returns {number} conso diesel L/100 (> 0)
 */
export function resolveConsoDiesel(allRecords, vehiculeDieselRef, consoDieselManuelle) {
  if (vehiculeDieselRef) {
    const duVeh = (allRecords || []).filter(
      r => (r['Véhicule'] || r['Vehicule'] || '') === vehiculeDieselRef
    );
    const mesuree = computeConsoMoy(duVeh, 'GAZOLE');
    if (mesuree > 0) return mesuree;
  }
  const m = Number(consoDieselManuelle);
  if (isFinite(m) && m > 0) return m;
  return DEFAULT_CONSO_DIESEL;
}

/**
 * Construit le modèle de référence pour la comparaison.
 * @param {object} opts
 * @param {string} opts.refKey     'SP98' | 'SP95' | 'E10' | 'GAZOLE'
 * @param {number} opts.consoE85   conso moyenne E85 (L/100 km)
 * @param {number} opts.surconso   surconso E85 vs essence (fraction, ex. 0.25)
 * @param {number} opts.ecartRef   écart €/L retranché au SP98 (essence uniquement)
 * @param {Array}  opts.allRecords tous les pleins (pour mesurer la conso diesel)
 * @param {string} [opts.vehiculeDieselRef]   véhicule diesel de référence
 * @param {number} [opts.consoDieselManuelle] conso diesel de repli (L/100)
 * @returns {{ refKey, isDiesel, ratioConso, co2RefPerL, refPriceFromFill }}
 *   ratioConso        : consoRef / consoE85 (litres réf. pour la distance d'1 L E85)
 *   co2RefPerL        : facteur CO₂/L du carburant de référence
 *   refPriceFromFill  : (fill, avgRefPrice) → prix €/L de référence pour ce plein
 */
export function buildRefModel(opts) {
  const { refKey, consoE85, surconso, ecartRef, allRecords,
          vehiculeDieselRef = '', consoDieselManuelle = 0 } = opts;
  const isDiesel = refKey === 'GAZOLE';

  if (isDiesel) {
    const consoDiesel = resolveConsoDiesel(allRecords, vehiculeDieselRef, consoDieselManuelle);
    const ratioConso  = consoE85 > 0 ? consoDiesel / consoE85 : 0;
    return {
      refKey, isDiesel: true, ratioConso,
      co2RefPerL: CO2_GAZOLE_PER_L,
      refPriceFromFill: (fill, avgRefPrice) =>
        (Number(fill['Gazole station (€/L)']) || 0) || avgRefPrice,
    };
  }

  // Essence (SP98/SP95/E10) — comportement X67 strictement préservé.
  const ratioConso = 1 / (1 + (Number(surconso) || 0));
  const ec = Number(ecartRef) || 0;
  return {
    refKey, isDiesel: false, ratioConso,
    co2RefPerL: CO2_ESSENCE_PER_L,
    refPriceFromFill: (fill, avgRefPrice) => {
      const sp98 = (Number(fill['SP98 station (€/L)']) || 0) || avgRefPrice;
      return Math.max(0, sp98 - ec);
    },
  };
}
