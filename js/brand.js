/* ═══════════════════════════════════════════════════════════════════════
   brand.js — Détection de l'enseigne d'une station depuis son nom (W63 / W65)

   Renvoie un libellé court + une couleur d'identité + un slug d'ICÔNE. Les
   icônes (public/icons/brands/<slug>.svg) sont des pictos ORIGINAUX (badge
   couleur de l'enseigne + monogramme) — PAS des logos déposés : on reste sur
   du libre de droits, sûr pour un dépôt public, tout en restant reconnaissable.

   Quand une enseigne n'est pas reconnue, son nom est JOURNALISÉ (console +
   localStorage « brand_unknown_v1 ») afin d'ajouter facilement son icône plus
   tard : il suffit de créer public/icons/brands/<slug>.svg et d'ajouter une
   entrée ci-dessous (voir public/icons/brands/README.md).
═══════════════════════════════════════════════════════════════════════ */

// Base d'URL (./ en dev, /suivi-conso-carburant/ en prod GitHub Pages).
const BASE = (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.BASE_URL) || '/';

// Ordre important : les motifs les plus spécifiques d'abord.
const BRANDS = [
  { re: /total\s*acc|totalenergies|\btotal\b/i,                         label: 'Total',        color: '#E2001A', slug: 'total' },
  { re: /e[.\s]*leclerc|leclerc/i,                                      label: 'Leclerc',      color: '#0066B3', slug: 'leclerc' },
  { re: /intermarch|\bnetto\b|\broady\b/i,                              label: 'Intermarché',  color: '#D81E20', slug: 'intermarche' },
  { re: /carrefour/i,                                                   label: 'Carrefour',    color: '#0E4C96', slug: 'carrefour' },
  { re: /super\s*u|hyper\s*u|\bu\s*express|système\s*u|magasins?\s*u/i, label: 'Système U',    color: '#E2001A', slug: 'systeme-u' },
  { re: /auchan/i,                                                      label: 'Auchan',       color: '#E2001A', slug: 'auchan' },
  { re: /\besso\b/i,                                                    label: 'Esso',         color: '#0033A0', slug: 'esso' },
  { re: /\bavia\b/i,                                                    label: 'Avia',         color: '#E2001A', slug: 'avia' },
  { re: /\bbp\b/i,                                                      label: 'BP',           color: '#0A9A00', slug: 'bp' },
  { re: /\bshell\b/i,                                                   label: 'Shell',        color: '#D52B1E', slug: 'shell' },
  { re: /\bagip\b|\beni\b/i,                                            label: 'Eni',          color: '#C8A21A', slug: 'eni' },
  { re: /dyneff/i,                                                      label: 'Dyneff',       color: '#E2001A', slug: 'dyneff' },
  { re: /\bcora\b/i,                                                    label: 'Cora',         color: '#E2001A', slug: 'cora' },
  { re: /casino|géant|geant/i,                                          label: 'Casino',       color: '#C8102E', slug: 'casino' },
  { re: /\bélan\b|\belan\b/i,                                           label: 'Élan',         color: '#0066B3', slug: 'elan' },
  { re: /\bcolruyt\b/i,                                                 label: 'Colruyt',      color: '#E2001A', slug: 'colruyt' },
];

/** Couleur par défaut (enseigne inconnue / nom = simple adresse). */
export const DEFAULT_BRAND_COLOR = '#2E75B6';

/** URL de l'icône d'une enseigne par son slug (repli « generic »). */
export function brandIconUrl(slug) {
  return `${BASE}icons/brands/${slug || 'generic'}.svg`;
}

/** URL de l'icône générique (station d'enseigne inconnue). */
export const GENERIC_BRAND_ICON = brandIconUrl('generic');

/**
 * Détecte l'enseigne d'une station d'après son nom.
 * @returns {{label:string,color:string,slug:string}|null} null si non reconnue.
 */
export function detectBrand(name) {
  const s = String(name || '');
  for (const b of BRANDS) if (b.re.test(s)) return { label: b.label, color: b.color, slug: b.slug };
  return null;
}

/* ─── Journalisation des enseignes inconnues (pour ajouter leurs icônes) ─── */
const UNKNOWN_KEY = 'brand_unknown_v1';
const _unknownSeen = new Set();

function _logUnknownBrand(name) {
  const raw = String(name || '').trim();
  if (!raw) return;
  const k = raw.toLowerCase();
  if (_unknownSeen.has(k)) return;     // déjà signalé cette session
  _unknownSeen.add(k);
  try {
    const list = JSON.parse(localStorage.getItem(UNKNOWN_KEY) || '[]');
    if (!list.some(x => String(x).toLowerCase() === k)) {
      list.push(raw);
      localStorage.setItem(UNKNOWN_KEY, JSON.stringify(list));
    }
  } catch { /* navigation privée / quota */ }
  console.info('[brand] enseigne inconnue (ajouter public/icons/brands/<slug>.svg) :', raw);
}

/**
 * Infos complètes d'enseigne pour l'affichage : libellé, couleur, slug, URL
 * d'icône, et « known ». Si l'enseigne est inconnue, son nom est journalisé
 * (une fois par session) et l'icône générique est renvoyée.
 * @returns {{label:string,color:string,slug:string,icon:string,known:boolean}}
 */
export function brandInfo(name) {
  const b = detectBrand(name);
  if (b) return { ...b, icon: brandIconUrl(b.slug), known: true };
  _logUnknownBrand(name);
  return { label: '', color: DEFAULT_BRAND_COLOR, slug: 'generic', icon: GENERIC_BRAND_ICON, known: false };
}

/** Liste des enseignes inconnues rencontrées (pour créer leurs icônes). */
export function getUnknownBrands() {
  try { return JSON.parse(localStorage.getItem(UNKNOWN_KEY) || '[]'); } catch { return []; }
}
