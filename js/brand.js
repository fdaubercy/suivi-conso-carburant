/* ═══════════════════════════════════════════════════════════════════════
   brand.js — Détection de l'enseigne d'une station depuis son nom (W63)

   Renvoie un libellé court + une couleur d'identité approximative, utilisés
   pour distinguer visuellement les marqueurs de la carte par enseigne
   (en plus du prix). On n'utilise PAS de logos déposés : seulement le nom
   (donnée factuelle) et une couleur indicative.
═══════════════════════════════════════════════════════════════════════ */

// Ordre important : les motifs les plus spécifiques d'abord.
const BRANDS = [
  { re: /total\s*acc|totalenergies|\btotal\b/i,                         label: 'Total',        color: '#E2001A' },
  { re: /e[.\s]*leclerc|leclerc/i,                                      label: 'Leclerc',      color: '#0066B3' },
  { re: /intermarch|\bnetto\b|\broady\b/i,                              label: 'Intermarché',  color: '#D81E20' },
  { re: /carrefour/i,                                                   label: 'Carrefour',    color: '#0E4C96' },
  { re: /super\s*u|hyper\s*u|\bu\s*express|système\s*u|magasins?\s*u/i, label: 'Système U',    color: '#E2001A' },
  { re: /auchan/i,                                                      label: 'Auchan',       color: '#E2001A' },
  { re: /\besso\b/i,                                                    label: 'Esso',         color: '#0033A0' },
  { re: /\bavia\b/i,                                                    label: 'Avia',         color: '#E2001A' },
  { re: /\bbp\b/i,                                                      label: 'BP',           color: '#0A9A00' },
  { re: /\bshell\b/i,                                                   label: 'Shell',        color: '#D52B1E' },
  { re: /\bagip\b|\beni\b/i,                                            label: 'Eni',          color: '#C8A21A' },
  { re: /dyneff/i,                                                      label: 'Dyneff',       color: '#E2001A' },
  { re: /\bcora\b/i,                                                    label: 'Cora',         color: '#E2001A' },
  { re: /casino|géant|geant/i,                                          label: 'Casino',       color: '#C8102E' },
  { re: /\bélan\b|\belan\b/i,                                           label: 'Élan',         color: '#0066B3' },
  { re: /\bcolruyt\b/i,                                                 label: 'Colruyt',      color: '#E2001A' },
];

/** Couleur par défaut (enseigne inconnue / nom = simple adresse). */
export const DEFAULT_BRAND_COLOR = '#2E75B6';

/**
 * Détecte l'enseigne d'une station d'après son nom.
 * @returns {{label:string,color:string}|null} null si aucune enseigne reconnue.
 */
export function detectBrand(name) {
  const s = String(name || '');
  for (const b of BRANDS) if (b.re.test(s)) return { label: b.label, color: b.color };
  return null;
}
