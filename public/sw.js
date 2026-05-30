/* ═══════════════════════════════════════════════════════════════════════
   Service Worker — Suivi Conso. Carburants
   Stratégie : network-first → cache fallback (offline shell)
   Cache dynamique : toutes les ressources same-origin sont mises en cache
   lors du premier chargement réseau réussi.
   S8 — Web Push : réception des alertes prix E85 bas (payload-less → fetch GAS).
═══════════════════════════════════════════════════════════════════════ */

const CACHE = 'suivi-conso-carburant-shell-v__SW_VERSION__';

/* GAS — meilleurs prix du jour par carburant (push sans payload).
   W49 : ?action=lowprices → { E85:{station,prix,date}, GAZOLE:{...}, SP98:{...} } */
const GAS_LOWPRICES_URL =
  'https://script.google.com/macros/s/AKfycbwIyCfZVTpDOGBANtFcHECcCdbg4J4t377pKQjIJ0NJYFT9FMjZm5_6XOsyQAas8jeTyA/exec?action=lowprices';

/* Carburants pris en charge par les alertes (libellés pour la notification). */
const PUSH_FUELS = {
  E85:    { label: 'E85',    icon: '🌿' },
  GAZOLE: { label: 'Gazole', icon: '⚫' },
  SP98:   { label: 'SP98',   icon: '💧' },
};
/* Seuils mis en cache par l'app (notifications.js) : caches['suivi-prefs']['/_push_thresholds']
   → { E85:{enabled,seuil}, GAZOLE:{...}, SP98:{...} } */
const PREFS_CACHE = 'suivi-prefs';
const THRESHOLDS_URL = '/_push_thresholds';

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

/* ── W49 — Push : alerte prix bas PAR CARBURANT (refresh quotidien GAS) ── *
 *  Push sans payload (VAPID). GAS « réveille » l'appareil ; on récupère    *
 *  les meilleurs prix du jour (?action=lowprices) et les seuils mis en     *
 *  cache par l'app, et on affiche une notification par carburant sous son  *
 *  seuil. L'appareil filtre lui-même avec SES seuils locaux.               */
async function _readCachedThresholds() {
  try {
    const c = await caches.open(PREFS_CACHE);
    const r = await c.match(THRESHOLDS_URL);
    if (r) return await r.json();
  } catch (_) { /* pas de cache — repli */ }
  return null;
}

self.addEventListener('push', event => {
  event.waitUntil((async () => {
    /* Meilleurs prix du jour par carburant */
    let low = null;
    try { low = event.data ? event.data.json() : null; } catch (_) { low = null; }
    if (!low) {
      try {
        const resp = await fetch(GAS_LOWPRICES_URL, { cache: 'no-store' });
        if (resp.ok) low = await resp.json();
      } catch (_) { /* hors-ligne */ }
    }
    const thr = await _readCachedThresholds();

    /* Carburants à notifier : prix connu ET (seuil local activé & atteint).
       Sans seuils en cache, repli E85 si un prix E85 est disponible. */
    const toShow = [];
    Object.keys(PUSH_FUELS).forEach(k => {
      const rec = low && low[k];
      if (!rec || rec.prix == null) return;
      if (thr) {
        const t = thr[k];
        if (t && t.enabled && Number(rec.prix) <= Number(t.seuil)) toShow.push({ k, rec });
      } else if (k === 'E85') {
        toShow.push({ k, rec });
      }
    });

    if (!toShow.length) {
      /* Réveil sans cible identifiable (seuils inconnus) → notification générique */
      await self.registration.showNotification('⛽ Prix bas détecté', {
        body:  'Un carburant suivi est passé sous votre seuil près de vos stations.',
        icon:  'icons/icon.svg', badge: 'icons/icon.svg',
        tag:   'price-push', renotify: true, data: { url: './#/carte' },
      });
      return;
    }

    await Promise.all(toShow.map(({ k, rec }) => {
      const f = PUSH_FUELS[k];
      return self.registration.showNotification(`${f.icon} ${f.label} avantageux !`, {
        body:  `${f.icon} ${f.label} à ${Number(rec.prix).toFixed(3)} €/L`
             + (rec.station ? `\n📍 ${String(rec.station).replace(/^Secteur - /, '')}` : ''),
        icon:  'icons/icon.svg', badge: 'icons/icon.svg',
        tag:   'price-push-' + k, renotify: true, data: { url: './#/carte' },
      });
    }));
  })());
});

/* ── Clic sur la notification : focus l'app (vue Carte) ou l'ouvre ─────── */
self.addEventListener('notificationclick', event => {
  event.notification.close();
  const target = event.notification.data?.url || './#/carte';
  event.waitUntil((async () => {
    const all = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    for (const c of all) {
      if ('focus' in c) { c.navigate?.(target); return c.focus(); }
    }
    if (self.clients.openWindow) return self.clients.openWindow(target);
  })());
});
