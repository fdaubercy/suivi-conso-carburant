/* ─── Fonctions utilitaires pures ─── */
import { PRIX_API } from './config.js';
import { detectBrand } from './brand.js';

export function haversine(lat1, lon1, lat2, lon2) {
  const R = 6371000, dLat = (lat2-lat1)*Math.PI/180, dLon = (lon2-lon1)*Math.PI/180;
  const a = Math.sin(dLat/2)**2 + Math.cos(lat1*Math.PI/180)*Math.cos(lat2*Math.PI/180)*Math.sin(dLon/2)**2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
}

export function escHtml(str) {
  return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

/** Extrait {lat, lon} d'un enregistrement ODS v2 (distance() ou Point GeoJSON). */
export function getCoords(r) {
  if (!r.geom) return null;
  if (r.geom.lat != null && r.geom.lon != null) return { lat: +r.geom.lat, lon: +r.geom.lon };
  if (r.geom.type === 'Point' && Array.isArray(r.geom.coordinates) && r.geom.coordinates.length >= 2)
    return { lat: +r.geom.coordinates[1], lon: +r.geom.coordinates[0] };
  return null;
}

/** Nom court de la station à partir des données API (fallback adresse → ville). */
export function stationLabel(r) {
  if (r.adresse) return r.adresse.trim().toLowerCase().replace(/\b(\w)/g, c => c.toUpperCase());
  return r.ville ? r.ville.trim().toUpperCase() : 'Station service';
}

/** Sous-titre de la station : Adresse · CP · VILLE */
export function stationSubLabel(r) {
  const cap = s => s ? s.charAt(0).toUpperCase() + s.slice(1).toLowerCase() : '';
  return [cap(r.adresse||''), r.cp||'', r.ville ? r.ville.trim().toUpperCase() : ''].filter(Boolean).join(' · ');
}

/** Convertit une ville en "nom propre" : premier segment avant - ou espace, en proper case.
 *  Ex : "FLERS-EN-ESCREBIEUX" → "Flers" / "DOUAI" → "Douai" */
export function formatVille(city) {
  if (!city) return '';
  const first = String(city).trim().split(/[\s-]/)[0];
  if (!first) return '';
  return first.charAt(0).toUpperCase() + first.slice(1).toLowerCase();
}

/** Compose le label final d'une station : "Nom - Ville" (ville en proper case). */
export function composeStationName(name, ville) {
  const v = formatVille(ville);
  return v && name ? name + ' - ' + v : (name || v);
}

/** Détecte une enseigne dans un texte d'adresse, en neutralisant les odonymes
 *  courants (« av. du Général Leclerc » n'est PAS l'enseigne Leclerc). '' sinon. */
function brandFromAddress(adresse) {
  let s = String(adresse || '');
  // « Leclerc » comme nom de voie (Général Leclerc, av./rue/bd… Leclerc) → pas l'enseigne.
  if (/(?:g[ée]n[ée]ral|av(?:enue)?\.?|rue|bd|boulevard|place|pl\.?|chemin|route|rte|imp(?:asse)?)\s+(?:du\s+|de\s+|d['’]\s*)?(?:g[ée]n[ée]ral\s+)?leclerc/i.test(s)) {
    s = s.replace(/leclerc/ig, ' ');
  }
  const b = detectBrand(s);
  return b ? b.label : '';
}

/**
 * Résout l'enseigne d'une station « à tout prix », sans JAMAIS renvoyer
 * l'adresse comme identifiant (le dataset gouv. ne fournit pas la marque) :
 *   1. nom OSM (brand/name/operator) → enseigne canonique si reconnue, sinon le
 *      nom OSM brut ;
 *   2. enseigne détectée dans l'adresse (gardes anti-odonymes) ;
 *   3. repli générique « Station ».
 * @param {?string} osmName  nom renvoyé par Overpass (null avant enrichissement)
 * @param {?string} adresse  adresse gouv. (jamais utilisée telle quelle comme nom)
 * @returns {string} l'enseigne (à composer ensuite avec la ville)
 */
export function resolveEnseigne(osmName, adresse) {
  if (osmName) {
    const b = detectBrand(osmName);
    return b ? b.label : String(osmName).trim();
  }
  const fromAddr = brandFromAddress(adresse);
  if (fromAddr) return fromAddr;
  return 'Station';
}

/** Construit l'URL de l'API ODS avec les paramètres donnés. */
export function odsUrl(params) {
  return PRIX_API + '?' + new URLSearchParams(params).toString();
}
