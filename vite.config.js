import { defineConfig } from 'vite';

export default defineConfig(({ command }) => ({
  // En dev (vite) : base '/' → http://localhost:5173/
  // En build (vite build) : base '/suivi-e85/' → GitHub Pages
  base: command === 'build' ? '/suivi-e85/' : '/',

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
