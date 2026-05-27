/* ═══════════════════════════════════════════════════════════════════════
   Service Worker — Suivi E85
   Stratégie : network-first → cache fallback (offline shell)
   Cache dynamique : toutes les ressources same-origin sont mises en cache
   lors du premier chargement réseau réussi.
═══════════════════════════════════════════════════════════════════════ */

const CACHE = 'suivi-e85-shell-v1';

/* ── Install : prendre la main immédiatement ─────────────────────────── */
self.addEventListener('install', event => {
  self.skipWaiting();   // pas d'attente : nouvelle version active dès install
});

/* ── Activate : supprimer les vieux caches ───────────────────────────── */
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys.filter(k => k !== CACHE).map(k => caches.delete(k))
      ))
      .then(() => self.clients.claim())  // contrôle des onglets existants
  );
});

/* ── Fetch : network-first + cache fallback (GET only, same-origin) ──── */
self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;

  const url = new URL(event.request.url);

  /* Laisser passer les appels externes :
   * – GAS (script.google.com) : POST des pleins
   * – ODS (data.economie.gouv.fr) : API prix carburants
   * – CDN (unpkg, jsDelivr…) : Tesseract.js et traineddata
   * – Google Sheets (docs.google.com) : liste stations CSV */
  if (url.hostname !== self.location.hostname) return;

  /* Ressources same-origin : network-first → cache fallback */
  event.respondWith(
    caches.open(CACHE).then(cache =>
      fetch(event.request)
        .then(response => {
          if (response.ok) cache.put(event.request, response.clone());
          return response;
        })
        .catch(async () => {
          const cached = await cache.match(event.request);
          if (cached) return cached;

          /* Fallback navigation : renvoyer la page principale en cache */
          if (event.request.mode === 'navigate') {
            const root = self.registration.scope;
            return (
              (await cache.match(root)) ||
              (await cache.match(root + 'index.html')) ||
              new Response('<h1>Hors-ligne</h1><p>Chargez l\'app au moins une fois en ligne.</p>',
                { headers: { 'Content-Type': 'text/html; charset=utf-8' }, status: 503 })
            );
          }

          return new Response('', { status: 503 });
        })
    )
  );
});

/* ── Background Sync : demande à l'onglet actif de synchroniser ──────── *
 *  L'onglet gère la file et l'envoi → le SW se contente de déclencher.  */
self.addEventListener('sync', event => {
  if (event.tag === 'sync-pleins') {
    event.waitUntil(
      self.clients
        .matchAll({ type: 'window', includeUncontrolled: true })
        .then(clients => clients.forEach(c => c.postMessage({ type: 'SYNC_PLEINS' })))
    );
  }
});

/* ── Message : SKIP_WAITING (W23 — mise à jour disponible) ────────────── *
 *  Reçu depuis pwa.js quand l'utilisateur clique "Actualiser".           *
 *  Déclenche la prise de contrôle immédiate → controllerchange → reload. */
self.addEventListener('message', event => {
  if (event.data?.type === 'SKIP_WAITING') self.skipWaiting();
});
