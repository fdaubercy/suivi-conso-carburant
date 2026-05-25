import { defineConfig } from 'vite';

export default defineConfig(({ command }) => ({
  // En dev (vite) : base '/' → http://localhost:5173/
  // En build (vite build) : base '/suivi-e85/' → GitHub Pages
  base: command === 'build' ? '/suivi-e85/' : '/',

  build: {
    outDir: 'dist',
    assetsDir: 'assets',
    sourcemap: false,
    // Pas de minification agressive pour garder la lisibilité en debug
    minify: 'esbuild',
  },

  // ─── Vitest (W14) ───────────────────────────────────────────
  test: {
    globals: true,
    environment: 'node',   // node suffit : les fonctions testées n'accèdent pas au DOM
    include: ['tests/**/*.test.js'],
    reporters: ['verbose'],
  },
}));
