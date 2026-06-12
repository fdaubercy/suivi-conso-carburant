/* ═══════════════════════════════════════════════════════════════════════
   wrapped.js — W37 : Bilan annuel « Wrapped »

   Carte récap de fin d'année construite depuis l'historique des pleins :
     • litres totaux        • € dépensés
     • km parcourus         • économie E85 cumulée (vs SP98)
     • station préférée     • mois le plus cher
   Périmètre basculable : véhicule courant ↔ tous véhicules (W37).
═══════════════════════════════════════════════════════════════════════ */

import { state } from './state.js';
import { FUEL_CONFIG, DEFAULT_SURCONSO, WRAPPED_SCOPE_KEY } from './config.js';
import { getAllRecords } from './historique.js';

const MOIS_FR = ['Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
                 'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'];

/* ─── Helpers ─── */
function matchType(rType, fuelKey) {
  if (!rType || !fuelKey) return false;
  const t = String(rType).toLowerCase();
  const cfg = FUEL_CONFIG[fuelKey];
  if (!cfg) return false;
  return t === cfg.label.toLowerCase()
      || t.includes(cfg.short.toLowerCase())
      || (fuelKey === 'E85' && t.includes('ethanol'));
}

function recDate(r) {
  const d = new Date(String(r.Date || r.Horodatage || '').replace(' ', 'T'));
  return isNaN(d) ? null : d;
}
function vehOf(r) { return r['Véhicule'] || r['Vehicule'] || ''; }

/* ─── Périmètre (localStorage) ─── */
export function getScope() {
  const v = localStorage.getItem(WRAPPED_SCOPE_KEY);
  return v === 'all' ? 'all' : 'vehicule';
}
function setScope(v) {
  try { localStorage.setItem(WRAPPED_SCOPE_KEY, v === 'all' ? 'all' : 'vehicule'); } catch { /* quota */ }
}

/* ─── Sélection des enregistrements selon le périmètre ─── */
function scopedRecords(scope) {
  const all = getAllRecords();
  if (scope === 'all') return all;
  const veh = state.currentVehiculeNom;
  return veh ? all.filter(r => vehOf(r) === veh) : all;
}

/* ─── Années présentes dans l'historique (périmètre courant), décroissant ─── */
export function getAvailableYears(scope) {
  const set = new Set();
  scopedRecords(scope).forEach(r => { const d = recDate(r); if (d) set.add(d.getFullYear()); });
  return [...set].sort((a, b) => b - a);
}

/* ─── Surconsommation E85 dynamique (conso E85 / conso SP98 − 1) ─── */
function computeSurconso(records) {
  const sorted = records
    .filter(r => Number(r['Km compteur'] || 0) > 0)
    .sort((a, b) => (recDate(a) || 0) - (recDate(b) || 0));
  const e85 = [], s98 = [];
  for (let i = 1; i < sorted.length; i++) {
    const dk = Number(sorted[i]['Km compteur'] || 0) - Number(sorted[i - 1]['Km compteur'] || 0);
    const lit = Number(sorted[i]['Nb. Litres'] || 0);
    if (dk <= 0 || lit <= 0) continue;
    const conso = (lit / dk) * 100;
    if (matchType(sorted[i].Type, 'E85')) e85.push(conso);
    else if (matchType(sorted[i].Type, 'SP98')) s98.push(conso);
  }
  if (!e85.length || !s98.length) return DEFAULT_SURCONSO;
  const avg = a => a.reduce((s, v) => s + v, 0) / a.length;
  const s = avg(e85) / avg(s98) - 1;
  return isFinite(s) && s > 0 ? s : DEFAULT_SURCONSO;
}

/* ─── Construit le bilan d'une année pour un périmètre ─── */
export function buildWrapped(year, scope) {
  const recs = scopedRecords(scope).filter(r => {
    const d = recDate(r);
    return d && d.getFullYear() === year;
  });
  if (!recs.length) return { year, scope, nbPleins: 0 };

  let nbPleins = 0, totalLitres = 0, totalCout = 0;
  const stationCount = {};
  const moisCout = {};

  recs.forEach(r => {
    const lit  = Number(r['Nb. Litres'] || 0);
    const prix = Number(r['Prix €/L'] || 0);
    const d    = recDate(r);
    if (lit > 0 && prix > 0) {
      nbPleins++; totalLitres += lit; totalCout += lit * prix;
      const st = String(r['Station essence'] || '').trim();
      if (st) stationCount[st] = (stationCount[st] || 0) + 1;
      if (d) moisCout[d.getMonth()] = (moisCout[d.getMonth()] || 0) + lit * prix;
    }
  });

  // Km parcourus : delta max-min par véhicule (somme si « tous »)
  let kmParcourus = 0;
  const vehs = scope === 'all'
    ? [...new Set(recs.map(vehOf))]
    : [state.currentVehiculeNom || ''];
  vehs.forEach(v => {
    const kms = recs
      .filter(r => scope === 'all' ? vehOf(r) === v : true)
      .map(r => Number(r['Km compteur'] || 0))
      .filter(n => isFinite(n) && n > 0);
    if (kms.length > 1) kmParcourus += Math.max(...kms) - Math.min(...kms);
  });

  // Économie E85 cumulée vs SP98 (méthode du dashboard : surconso dynamique)
  const surconso = computeSurconso(scopedRecords(scope));
  const sp98Refs = [];
  scopedRecords(scope).forEach(r => {
    if (matchType(r.Type, 'E85')) {
      const s = Number(r['SP98 station (€/L)']) || 0;
      if (s > 0) sp98Refs.push(s);
    } else if (matchType(r.Type, 'SP98')) {
      const p = Number(r['Prix €/L']) || 0;
      if (p > 0) sp98Refs.push(p);
    }
  });
  const sp98Moyen = sp98Refs.length ? sp98Refs.reduce((s, p) => s + p, 0) / sp98Refs.length : 0;

  let nbE85 = 0, econE85 = 0;
  recs.forEach(r => {
    if (!matchType(r.Type, 'E85')) return;
    const lit  = Number(r['Nb. Litres'] || 0);
    const prix = Number(r['Prix €/L'] || 0);
    if (lit <= 0 || prix <= 0) return;
    nbE85++;
    const sp98 = (Number(r['SP98 station (€/L)']) || 0) || sp98Moyen;
    if (sp98 > 0) econE85 += (lit / (1 + surconso)) * sp98 - lit * prix;
  });

  // Station préférée (plus fréquente)
  let stationPref = '', stationPrefN = 0;
  Object.keys(stationCount).forEach(st => {
    if (stationCount[st] > stationPrefN) { stationPrefN = stationCount[st]; stationPref = st; }
  });

  // Mois le plus cher
  let moisCher = null, moisCherCout = 0;
  Object.keys(moisCout).forEach(m => {
    if (moisCout[m] > moisCherCout) { moisCherCout = moisCout[m]; moisCher = Number(m); }
  });

  return {
    year, scope, nbPleins, nbE85, totalLitres, totalCout, kmParcourus,
    econE85, surconso, stationPref, stationPrefN,
    moisCher, moisCherCout,
  };
}

/* ─── Rendu de la carte ─── */
export function renderWrapped() {
  const box = document.getElementById('wrappedBox');
  if (!box) return;

  const scope = getScope();
  const shareBtn = document.getElementById('wrappedShareBtn');
  if (shareBtn) shareBtn.hidden = true;          // réaffiché seulement si une carte est rendue (W57)
  const scopeBtn = document.getElementById('wrappedScopeBtn');
  if (scopeBtn) {
    // Ne mettre à jour que l'icône — le libellé « Véhicule / tous » reste visible.
    const ico = scopeBtn.querySelector('.hb-ico') || scopeBtn;
    ico.textContent = scope === 'all' ? '🚗🏍️' : '🏍️';
    scopeBtn.title = scope === 'all'
      ? 'Périmètre : tous les véhicules (cliquer pour le véhicule courant)'
      : 'Périmètre : véhicule courant (cliquer pour tous les véhicules)';
  }

  const years = getAvailableYears(scope);
  const sel = document.getElementById('wrappedYear');
  if (!years.length) {
    if (sel) sel.innerHTML = '';
    box.innerHTML = '<div class="stats-msg">Aucun plein enregistré.</div>';
    return;
  }
  if (sel) {
    const prev = Number(sel.value);
    sel.innerHTML = years.map(y => `<option value="${y}">${y}</option>`).join('');
    sel.value = years.includes(prev) ? prev : years[0];
  }
  const year = (sel && Number(sel.value)) || years[0];

  const w = buildWrapped(year, scope);
  if (!w.nbPleins) {
    box.innerHTML = `<div class="stats-msg">Aucun plein en ${year}.</div>`;
    return;
  }

  const scopeLabel = scope === 'all'
    ? 'tous véhicules'
    : (state.currentVehiculeNom || 'tous véhicules');

  const econClass = w.econE85 > 0 ? 'pos' : (w.econE85 < 0 ? 'neg' : '');
  const econSign  = w.econE85 > 0 ? '+' : '';
  const econCell  = w.nbE85
    ? `<div class="stat-val">${econSign}${w.econE85.toFixed(0)} €</div>
       <div class="stat-unit">éco. E85 vs SP98</div>`
    : `<div class="stat-val">—</div>
       <div class="stat-unit">aucun plein E85</div>`;

  const stationCell = w.stationPref
    ? `<div class="stat-val stat-text">${escapeHtml(truncate(w.stationPref, 22))}</div>
       <div class="stat-unit">station préférée · ${w.stationPrefN}×</div>`
    : `<div class="stat-val">—</div><div class="stat-unit">station préférée</div>`;

  const moisCell = (w.moisCher != null)
    ? `<div class="stat-val stat-text">${MOIS_FR[w.moisCher]}</div>
       <div class="stat-unit">mois le + cher · ${w.moisCherCout.toFixed(0)} €</div>`
    : `<div class="stat-val">—</div><div class="stat-unit">mois le + cher</div>`;

  box.innerHTML = `
    <div class="wrapped-hero">🎉 ${year} en carburant — ${escapeHtml(scopeLabel)}</div>
    <div class="stats-grid">
      <div class="stat">
        <div class="stat-val">${w.totalLitres.toFixed(0)}</div>
        <div class="stat-unit">litres · ${w.nbPleins} plein(s)</div>
      </div>
      <div class="stat">
        <div class="stat-val">${w.totalCout.toFixed(0)} €</div>
        <div class="stat-unit">dépensés</div>
      </div>
      <div class="stat">
        <div class="stat-val">${w.kmParcourus.toLocaleString('fr-FR')}</div>
        <div class="stat-unit">km parcourus</div>
      </div>
      <div class="stat ${econClass}">${econCell}</div>
      <div class="stat">${stationCell}</div>
      <div class="stat">${moisCell}</div>
    </div>
    <div class="stats-sub">Bilan ${year} · ${escapeHtml(scopeLabel)}${w.nbE85 ? ' · surconso +' + Math.round(w.surconso * 100) + '%' : ''}</div>`;

  if (shareBtn) shareBtn.hidden = false;         // carte rendue → partage disponible (W57)
}

/** Câble le sélecteur d'année, la bascule de périmètre et le partage image (W57). */
export function initWrapped() {
  document.getElementById('wrappedYear')?.addEventListener('change', () => renderWrapped());
  document.getElementById('wrappedScopeBtn')?.addEventListener('click', () => {
    setScope(getScope() === 'all' ? 'vehicule' : 'all');
    renderWrapped();
  });
  document.getElementById('wrappedShareBtn')?.addEventListener('click', () => shareWrapped());
  renderWrapped();
}

/* ═══════════════════════════════════════════════════════════════════════
   W57 — Partage image du bilan « Wrapped »
   Carte rendue sur un <canvas> (sans dépendance) → toBlob() → Web Share API
   (navigator.share avec fichiers) ; repli téléchargement PNG si indisponible.
═══════════════════════════════════════════════════════════════════════ */

/** Génère l'image du bilan affiché et la partage (ou la télécharge en repli). */
export async function shareWrapped() {
  const scope = getScope();
  const sel   = document.getElementById('wrappedYear');
  const years = getAvailableYears(scope);
  const year  = (sel && Number(sel.value)) || years[0];
  if (!year) return;

  const w = buildWrapped(year, scope);
  if (!w.nbPleins) return;

  const scopeLabel = scope === 'all'
    ? 'tous véhicules'
    : (state.currentVehiculeNom || 'tous véhicules');

  const canvas = drawWrappedCard(w, scopeLabel);
  const blob = await new Promise(res => { try { canvas.toBlob(res, 'image/png'); } catch { res(null); } });
  if (!blob) return;

  const fileName = `bilan-carburant-${year}.png`;
  const file = new File([blob], fileName, { type: 'image/png' });

  // Partage natif si l'appareil sait partager des fichiers ; sinon téléchargement.
  if (navigator.canShare && navigator.canShare({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: `Bilan carburant ${year}`, text: `Mon bilan carburant ${year} — ${scopeLabel}` });
      return;
    } catch (err) {
      if (err && err.name === 'AbortError') return;       // annulé par l'utilisateur
      /* échec du partage → repli téléchargement ci-dessous */
    }
  }
  _downloadBlob(blob, fileName);
}

/** Déclenche le téléchargement d'un Blob sous le nom donné. */
function _downloadBlob(blob, fileName) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = fileName;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Dessine la carte de partage (1080×1350, charte) à partir du bilan `w`. */
function drawWrappedCard(w, scopeLabel) {
  const W = 1080, H = 1350;
  const cv = document.createElement('canvas');
  cv.width = W; cv.height = H;
  const ctx = cv.getContext('2d');

  // Fond dégradé charte : bleu nuit → vert E85.
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, '#15324c'); g.addColorStop(1, '#1d9e75');
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);

  const pad = 80;

  // En-tête : libellé, année en grand, périmètre.
  ctx.fillStyle = 'rgba(255,255,255,.78)';
  ctx.font = '600 34px Arial, Helvetica, sans-serif';
  ctx.fillText('BILAN CARBURANT', pad, 148);

  ctx.fillStyle = '#ffffff';
  ctx.font = '800 150px Arial, Helvetica, sans-serif';
  ctx.fillText(String(w.year), pad, 286);

  ctx.fillStyle = 'rgba(255,255,255,.9)';
  ctx.font = '500 40px Arial, Helvetica, sans-serif';
  ctx.fillText(truncate(scopeLabel, 30), pad, 348);

  // 6 tuiles (2 colonnes × 3 lignes).
  const econTxt = w.nbE85 ? (w.econE85 > 0 ? '+' : '') + w.econE85.toFixed(0) + ' €' : '—';
  const cells = [
    [w.totalLitres.toFixed(0) + ' L',                 w.nbPleins + ' plein(s)'],
    [w.totalCout.toFixed(0) + ' €',              'dépensés'],
    [w.kmParcourus.toLocaleString('fr-FR'),           'km parcourus'],
    [econTxt,                                          w.nbE85 ? 'éco. E85 vs SP98' : 'aucun plein E85'],
    [w.stationPref ? truncate(w.stationPref, 16) : '—', w.stationPref ? 'station préférée · ' + w.stationPrefN + '×' : 'station préférée'],
    [w.moisCher != null ? MOIS_FR[w.moisCher] : '—',    w.moisCher != null ? 'mois le + cher · ' + w.moisCherCout.toFixed(0) + ' €' : 'mois le + cher'],
  ];
  const gx = pad, gy = 430, gw = W - pad * 2, gap = 28;
  const cw = (gw - gap) / 2, ch = 232;
  cells.forEach((c, i) => {
    const x = gx + (i % 2) * (cw + gap);
    const y = gy + ((i / 2) | 0) * (ch + gap);
    _roundRect(ctx, x, y, cw, ch, 28);
    ctx.fillStyle = 'rgba(255,255,255,.12)'; ctx.fill();
    ctx.fillStyle = '#ffffff';
    _fitFont(ctx, c[0], cw - 56, 62, '800');
    ctx.fillText(c[0], x + 30, y + 122);
    ctx.fillStyle = 'rgba(255,255,255,.82)';
    ctx.font = '500 29px Arial, Helvetica, sans-serif';
    ctx.fillText(truncate(c[1], 28), x + 30, y + 178);
  });

  // Pied de carte : signature + surconso.
  ctx.fillStyle = 'rgba(255,255,255,.88)';
  ctx.font = '700 34px Arial, Helvetica, sans-serif';
  ctx.fillText('Suivi Conso Carburant', pad, H - 66);
  if (w.nbE85) {
    ctx.fillStyle = 'rgba(255,255,255,.62)';
    ctx.font = '500 28px Arial, Helvetica, sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText('surconso +' + Math.round(w.surconso * 100) + '%', W - pad, H - 66);
    ctx.textAlign = 'left';
  }
  return cv;
}

/** Réduit la taille de police jusqu'à ce que `text` tienne dans `maxW`. */
function _fitFont(ctx, text, maxW, basePx, weight) {
  let px = basePx;
  ctx.font = `${weight} ${px}px Arial, Helvetica, sans-serif`;
  while (px > 26 && ctx.measureText(text).width > maxW) {
    px -= 4;
    ctx.font = `${weight} ${px}px Arial, Helvetica, sans-serif`;
  }
}

/** Trace un rectangle à coins arrondis (chemin courant, sans remplir). */
function _roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function truncate(s, n) { s = String(s); return s.length > n ? s.slice(0, n - 1) + '…' : s; }
function escapeHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}
