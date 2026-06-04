/* ─── Theme clair / sombre ─── */
const KEY = 'suivi_e85_theme';

/** Init au chargement : localStorage > prefers-color-scheme > clair par défaut. */
export function initTheme() {
  const saved = localStorage.getItem(KEY);
  const prefersDark = window.matchMedia?.('(prefers-color-scheme: dark)').matches;
  applyTheme(saved || (prefersDark ? 'dark' : 'light'));
}

/** Toggle clair ↔ sombre + persist en localStorage. */
export function toggleTheme() {
  const current = document.documentElement.getAttribute('data-theme') || 'light';
  const next    = current === 'dark' ? 'light' : 'dark';
  applyTheme(next);
  localStorage.setItem(KEY, next);
}

function applyTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
  const dark = theme === 'dark';
  // Bandeau épuré : l'action thème est un item de menu (icône + libellé).
  const ico = document.getElementById('themeIco');
  const lbl = document.getElementById('themeLabel');
  if (ico) ico.textContent = dark ? '☀️' : '🌙';
  if (lbl) lbl.textContent = dark ? 'Thème clair' : 'Thème sombre';
  // Rétro-compatibilité : ancien bouton emoji seul (si présent sans sous-span).
  const btn = document.getElementById('themeToggle');
  if (btn && !ico) btn.textContent = dark ? '☀️' : '🌙';
}
