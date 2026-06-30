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
    /* Build : remplace __SW_VERSION__ dans dist/sw.js.
       Robuste à rolldown-vite (Vite 8) : selon le timing de copie du dossier
       public/, dist/sw.js peut ne pas encore exister au déclenchement du hook.
       On lit alors la source depuis public/sw.js et on (ré)écrit toujours
       dist/sw.js substitué — sinon le cache resterait nommé __SW_VERSION__,
       le SW ne changerait jamais et l'invite de mise à jour ne se déclencherait
       jamais (PWA figée sur l'ancien code après déploiement). */
    closeBundle() {
      const dest = resolve(process.cwd(), 'dist/sw.js');
      const srcPath = existsSync(dest)
        ? dest
        : resolve(process.cwd(), 'public/sw.js');
      if (!existsSync(srcPath)) return;
      const src = readFileSync(srcPath, 'utf-8');
      writeFileSync(dest, src.replace(/__SW_VERSION__/g, getVersion()));
    },
  };
}

export default defineConfig(({ command }) => ({
  // En dev (vite) : base '/' → http://localhost:5173/
  // En build (vite build) : base '/suivi-conso-carburant/' → GitHub Pages
  base: command === 'build' ? '/suivi-conso-carburant/' : '/',

  // T3 — substitue __SW_VERSION__ dans sw.js (cache versionné par APP_VERSION).
  // Sans cet enregistrement le plugin ne tournait pas : le SW gardait un cache
  // au nom constant → aucune mise à jour détectée → PWA figée après déploiement.
  plugins: [swVersionPlugin()],

  // Serveur de dev : port fixe (PORT injecté par le harness de prévisualisation,
  // sinon 5173). strictPort = pas de glissement silencieux en 5174 (qui casserait
  // le proxy du harness). host = écoute 0.0.0.0 pour être joignable par le proxy.
  server: {
    port: Number(process.env.PORT) || 5173,
    strictPort: true,
    host: true,
  },

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
    // Environnement 'node' par défaut ; les suites qui touchent le DOM
    // basculent en jsdom via le commentaire `// @vitest-environment jsdom`
    // en tête de fichier (cf. ui/carburant/formulaire/geo/carte/offline…).
    environment: 'node',
    include: ['tests/**/*.test.js'],
    reporters: ['verbose'],

    // ─── Couverture (W72) — informatif, NON bloquant ───────────
    // Rapport de couverture sur les modules js/ : aucun seuil défini,
    // donc la CI ne casse jamais à cause de la couverture (job dédié
    // `continue-on-error` côté GitHub Actions).
    coverage: {
      provider:         'v8',
      // 'text' = détail par fichier dans les logs CI ; 'text-summary' = bloc
      // synthétique repris dans le résumé du job ; 'html'/'lcov' = artefact.
      reporter:         ['text', 'text-summary', 'html', 'lcov'],
      reportsDirectory: 'coverage',
      include:          ['js/**/*.js'],
      // main.js = câblage/point d'entrée, config.js = constantes :
      // aucune logique testable utile, exclus pour ne pas fausser le %.
      exclude:          ['js/main.js', 'js/config.js'],
    },
  },
}));
