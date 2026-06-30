/* ─── Helpers DOM / statuts / feedback ─── */

export function setGeoStatus(cls, msg) {
  const el = document.getElementById('geoStatus'); el.className = 'geo-status ' + cls; el.textContent = msg;
}
export function setS98Status(cls, msg) {
  const el = document.getElementById('s98Status'); el.className = 's98-status ' + cls; el.textContent = msg;
}
export function setAutreStatus(cls, msg) {
  const el = document.getElementById('autreStatus'); el.className = cls; el.textContent = msg;
}
export function setVehiculeStatus(cls, msg) {
  const el = document.getElementById('vehiculeStatus'); el.className = 'geo-status ' + cls; el.textContent = msg;
}

export function showCpSearch() {
  document.getElementById('cpSearch').classList.remove('hidden');
  document.getElementById('fCp').focus();
}
export function hideCpSearch() {
  document.getElementById('cpSearch').classList.add('hidden');
  document.getElementById('fCp').value = '';
}

export function setSubmitState(loading) {
  document.getElementById('submitBtn').disabled = loading;
  document.getElementById('submitIcon').textContent = loading ? '⏳' : '✓';
  document.getElementById('submitText').textContent = loading ? 'Enregistrement…' : 'Enregistrer le plein';
}

export function showFeedback(type, title, msg) {
  const el = document.getElementById('feedback');
  if (!el) return;   // garde : ne jamais lever (un throw ici tuerait le handler appelant en silence)
  el.className = 'feedback ' + type;
  el.innerHTML = '<strong>' + title + '</strong>' + msg;
  el.style.display = 'block';
  el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  if (type === 'success') setTimeout(() => el.style.display = 'none', 5000);
}

/** Pure tri-directional calculation (testable without DOM).
 *  source: 'litres' | 'cout' | 'prix'
 *  Returns {L, C, P} with the computed field updated.
 */
export function calcTriplet(L, C, P, source) {
  const lOk = isFinite(L) && L > 0;
  const cOk = isFinite(C) && C > 0;
  const pOk = isFinite(P) && P > 0;
  const out = { L, C, P };
  if (source === 'litres') {
    if (lOk && pOk)      out.C = parseFloat((L * P).toFixed(2));
    else if (lOk && cOk) out.P = parseFloat((C / L).toFixed(3));
  } else if (source === 'cout') {
    if (cOk && pOk)      out.L = parseFloat((C / P).toFixed(2));
    else if (lOk && cOk) out.P = parseFloat((C / L).toFixed(3));
  } else if (source === 'prix') {
    if (lOk && pOk)      out.C = parseFloat((L * P).toFixed(2));
    else if (cOk && pOk) out.L = parseFloat((C / P).toFixed(2));
  }
  return out;
}

/** Reads fLitres/fCout/fPrix, computes the missing field, updates the DOM. */
export function computeTriplet(source) {
  const elL = document.getElementById('fLitres');
  const elC = document.getElementById('fCout');
  const elP = document.getElementById('fPrix');
  if (!elL || !elC || !elP) return;
  const res = calcTriplet(parseFloat(elL.value), parseFloat(elC.value), parseFloat(elP.value), source);
  if (source !== 'litres' && isFinite(res.L) && res.L > 0) elL.value = res.L.toFixed(2);
  if (source !== 'cout'   && isFinite(res.C) && res.C > 0) elC.value = res.C.toFixed(2);
  if (source !== 'prix'   && isFinite(res.P) && res.P > 0) elP.value = res.P.toFixed(3);
}

/**
 * Remplit un champ prix et applique la classe autofilled (verte) pendant 6 s.
 * value=null → champ vide, placeholder '--'.
 */
export function setFieldPrice(id, value, defaultPh) {
  const el = document.getElementById(id), v = value ? parseFloat(value) : 0;
  if (v > 0) {
    el.value = v.toFixed(3); el.placeholder = defaultPh;
    el.classList.add('autofilled');
    setTimeout(() => el.classList.remove('autofilled'), 6000);
  } else {
    el.value = ''; el.placeholder = '--';
  }
}
