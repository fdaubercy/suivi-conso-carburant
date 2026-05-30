import { defineConfig } from 'vite';
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { resolve } from 'path';

/* ─── T3 — Plugin : injecte APP_VERSION dans le cache SW ─── */
function swVersionPlugin() {
  function getVersion() {
    try {
      const src = readFileSync(resolve(process.cwd(), 'js/config.js'), 'utf-8');
      const m = src.match(/APP_VERSION\s*=\s*['"]([^'"]+)['"]/);
      return m ? m[1] : '0.0.0.0';
    } catch { return '0.0.0.0'; }
  }

  return {
    name: 'sw-version',
    /* Dev : intercepte /sw.js et remplace __SW_VERSION__ à la volée */
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const url = (req.url || '').split('?')[0];
        if (url !== '/sw.js') { next(); return; }
        try {
          const src = readFileSync(resolve(process.cwd(), 'public/sw.js'), 'utf-8');
          const out = src.replace(/__SW_VERSION__/g, getVersion());
          res.setHeader('Content-Type', 'application/javascript; charset=utf-8');
          res.setHeader('Service-Worker-Allowed', '/');
          res.end(out);
        } catch(e) { next(e); }
      });
    },
    /* Build : remplace __SW_VERSION__ dans dist/sw.js */
    closeBundle() {
      const p = resolve(process.cwd(), 'dist/sw.js');
      if (!existsSync(p)) return;
      const src = readFileSync(p, 'utf-8');
      writeFileSync(p, src.replace(/__SW_VERSION__/g, getVersion()));
    },
  };
}

export default defineConfig(({ command }) => ({
  // En dev (vite) : base '/' → http://localhost:5173/
  // En build (vite build) : base '/suivi-conso-carburant/' → GitHub Pages
  base: command === 'build' ? '/suivi-conso-carburant/' : '/',

  plugins: [swVersionPlugin()],

  build: {
    outDir: 'dist',
    assetsDir: 'assets',
    sourcemap: false,
    // Minification via OXC (défaut Vite 8.x/rolldown — esbuild déprécié)
    minify: true,
  },

  // ─── Vitest (W14) ───────────────────────────────────────────
  test: {
    globals: true,
    environment: 'node',   // node suffit : les fonctions testées n'accèdent pas au DOM
    include: ['tests/**/*.test.js'],
    reporters: ['verbose'],
  },
}));
