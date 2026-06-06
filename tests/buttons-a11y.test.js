// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { JSDOM } from 'jsdom';

const html = readFileSync(fileURLToPath(new URL('../index.html', import.meta.url)), 'utf-8');
const doc = new JSDOM(html).window.document;

/** [sélecteur, libellé visible attendu, aria-label attendu] — §4 de la spec */
const GROUP_A = [
  ['#wrappedScopeBtn', 'Véhicule / tous', 'Basculer entre le véhicule courant et tous les véhicules'],
  ['[data-action="voirTout"]', 'Tout voir', "Voir tout l'historique avec filtres"],
  ['[data-action="dupliquerDernier"]', 'Dupliquer', 'Dupliquer le dernier plein dans le formulaire'],
  ['[data-action="chargerHistorique"]', 'Actualiser', 'Actualiser'],
  ['#histExportBtn', 'Export filtré', 'Exporter la vue filtrée en CSV'],
  ['#histExportAllBtn', 'Export tout', "Exporter tout l'historique en CSV"],
  ['#histFullCloseBtn', 'Fermer', 'Fermer'],
];

describe('Groupe A — boutons d’en-tête relabellisés', () => {
  it.each(GROUP_A)('%s porte icône + libellé + aria-label', (sel, label, aria) => {
    const btn = doc.querySelector(sel);
    expect(btn, `bouton ${sel} introuvable`).toBeTruthy();
    expect(btn.classList.contains('hist-btn--lbl')).toBe(true);
    expect(btn.querySelector('.hb-ico'), 'span icône').toBeTruthy();
    expect(btn.querySelector('.hb-lbl')?.textContent.trim()).toBe(label);
    expect(btn.getAttribute('aria-label')).toBe(aria);
  });
});
