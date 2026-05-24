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
  el.className = 'feedback ' + type;
  el.innerHTML = '<strong>' + title + '</strong>' + msg;
  el.style.display = 'block';
  el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  if (type === 'success') setTimeout(() => el.style.display = 'none', 5000);
}

export function updateCout() {
  const l = parseFloat(document.getElementById('fLitres').value);
  const p = parseFloat(document.getElementById('fPrix').value);
  const box = document.getElementById('coutBox');
  if (!isNaN(l) && !isNaN(p) && l > 0 && p > 0) {
    box.style.display = 'flex';
    document.getElementById('coutVal').textContent = (l * p).toFixed(2) + ' €';
  } else {
    box.style.display = 'none';
  }
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
