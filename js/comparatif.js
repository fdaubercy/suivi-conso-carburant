/* ═══════════════════════════════════════════════════════════════════════
   comparatif.js — Comparaison entre véhicules (W41)

   Les stats principales sont mono-véhicule (filtrées par state.currentVehiculeNom
   depuis W7). Ce module agrège TOUS les véhicules présents dans l'historique et
   les confronte sur deux métriques :
     • consommation moyenne (L / 100 km)
     • coût kilométrique (€ / 100 km)

   Rendu : carte #comparatifCard (vue Stats) avec, par véhicule, deux barres
   horizontales normalisées (pas de librairie externe, SVG/CSS pur).
   Masquée tant que moins de 2 véhicules ont des données exploitables.
═══════════════════════════════════════════════════════════════════════ */
import { getAllRecords } from './historique.js';
import { state } from './state.js';
import { escHtml } from './utils.js';

/**
 * Agrège conso/coût par véhicule sur tout l'historique.
 * @returns {{veh:string, conso:number, coutPer100:number, totalCout:number,
 *            totalLitres:number, kmDelta:number, nb:number}[]} trié par coût/100 km
 */
export function computeVehicleComparison() {
  const groups = {};
  getAllRecords().forEach(r => {
    const veh = r['Véhicule'] || r['Vehicule'] || '';
    if (!veh) return;
    (groups[veh] = groups[veh] || []).push(r);
  });

  return Object.entries(groups)
    .map(([veh, recs]) => {
      const kms = recs
        .map(r => Number(r['Km compteur'] || 0))
        .filter(n => isFinite(n) && n > 0);
      const kmDelta     = kms.length > 1 ? Math.max(...kms) - Math.min(...kms) : 0;
      const totalLitres = recs.reduce((s, r) => s + (Number(r['Nb. Litres']) || 0), 0);
      const totalCout   = recs.reduce(
        (s, r) => s + (Number(r['Nb. Litres']) || 0) * (Number(r['Prix €/L']) || 0), 0);
      const conso       = kmDelta > 0 ? (totalLitres / kmDelta) * 100 : 0;
      const coutPer100  = kmDelta > 0 ? (totalCout / kmDelta) * 100 : 0;
      return { veh, conso, coutPer100, totalCout, totalLitres, kmDelta, nb: recs.length };
    })
    .filter(r => r.kmDelta > 0 && r.conso > 0)
    .sort((a, b) => a.coutPer100 - b.coutPer100);
}

/** Rend la carte #comparatifCard. Masquée si < 2 véhicules exploitables. */
export function renderComparatif() {
  const card = document.getElementById('comparatifCard');
  if (!card) return;

  const rows = computeVehicleComparison();
  if (rows.length < 2) { card.classList.add('hidden'); return; }
  card.classList.remove('hidden');

  const maxConso = Math.max(...rows.map(r => r.conso), 0.01);
  const maxCout  = Math.max(...rows.map(r => r.coutPer100), 0.01);
  const cur      = state.currentVehiculeNom || '';

  const rowsHtml = rows.map(r => {
    const isCur  = r.veh === cur;
    const wConso = Math.max(4, (r.conso / maxConso) * 100).toFixed(0);
    const wCout  = Math.max(4, (r.coutPer100 / maxCout) * 100).toFixed(0);
    return `
      <div class="cmp-veh${isCur ? ' current' : ''}">
        <div class="cmp-name">${isCur ? '▸ ' : ''}${escHtml(r.veh)}
          <span class="cmp-nb">${r.nb} plein${r.nb > 1 ? 's' : ''}</span></div>
        <div class="cmp-metric">
          <span class="cmp-mlabel">conso</span>
          <div class="cmp-track"><div class="cmp-fill conso" style="width:${wConso}%"></div></div>
          <span class="cmp-mval">${r.conso.toFixed(1)} L</span>
        </div>
        <div class="cmp-metric">
          <span class="cmp-mlabel">coût</span>
          <div class="cmp-track"><div class="cmp-fill cout" style="width:${wCout}%"></div></div>
          <span class="cmp-mval">${r.coutPer100.toFixed(1)} €</span>
        </div>
      </div>`;
  }).join('');

  const best = rows[0];   // coût/100 km le plus bas
  card.innerHTML = `
    <p class="section-title">🚗🏍️ Comparaison véhicules</p>
    <div class="cmp-list">${rowsHtml}</div>
    <p class="cmp-foot">Sur 100 km · barres normalisées au plus élevé.
       Plus économe : <strong>${escHtml(best.veh)}</strong> (${best.coutPer100.toFixed(1)} €/100 km).</p>`;
}
