/* ═══════════════════════════════════════════════════════════════════════
   Service Worker — Suivi Conso. Carburants
   Stratégie : network-first → cache fallback (offline shell)
   Cache dynamique : toutes les ressources same-origin sont mises en cache
   lors du premier chargement réseau réussi.
   S8 — Web Push : réception des alertes prix E85 bas (payload-less → fetch GAS).
═══════════════════════════════════════════════════════════════════════ */

const CACHE = 'suivi-e85-shell-v__SW_VERSION__';

/* GAS — endpoint du dernier prix E85 bas détecté (push sans payload) */
const GAS_LOWPRICE_URL =
  'https://script.google.com/macros/s/AKfycbwIyCfZVTpDOGBANtFcHECcCdbg4J4t377pKQjIJ0NJYFT9FMjZm5_6XOsyQAas8jeTyA/exec?action=lowprice';

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

/* ── S8 — Push : alerte prix E85 bas envoyée par GAS (refresh quotidien) ─ *
 *  Push sans payload (VAPID) : on récupère le détail du prix bas auprès    *
 *  de GAS (?action=lowprice) pour enrichir la notification.               */
self.addEventListener('push', event => {
  event.waitUntil((async () => {
    const title = '🌿 Prix E85 avantageux !';
    let   body  = 'Un prix E85 bas a été détecté près de vos stations habituelles.';

    /* Payload éventuel (si le push en contient un) sinon fetch GAS */
    let info = null;
    try { info = event.data ? event.data.json() : null; } catch (_) { info = null; }
    if (!info || info.prix == null) {
      try {
        const resp = await fetch(GAS_LOWPRICE_URL, { cache: 'no-store' });
        if (resp.ok) info = await resp.json();
      } catch (_) { /* hors-ligne — notification générique */ }
    }
    if (info && info.prix != null) {
      body = `⛽ E85 à ${Number(info.prix).toFixed(3)} €/L`
           + (info.station ? `\n📍 ${info.station}` : '');
    }

    await self.registration.showNotification(title, {
      body,
      icon:  'icons/icon.svg',
      badge: 'icons/icon.svg',
      tag:   'e85-price-push',
      renotify: true,
      data:  { url: './' }
    });
  })());
});

/* ── S8 — Clic sur la notification : focus l'app ou l'ouvre ───────────── */
self.addEventListener('notificationclick', event => {
  event.notification.close();
  const target = event.notification.data?.url || './';
  event.waitUntil((async () => {
    const all = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    for (const c of all) {
      if ('focus' in c) { c.navigate?.(target); return c.focus(); }
    }
    if (self.clients.openWindow) return self.clients.openWindow(target);
  })());
});
