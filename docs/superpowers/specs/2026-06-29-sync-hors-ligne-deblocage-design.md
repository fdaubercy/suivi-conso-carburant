# Déblocage & fiabilisation de la synchronisation hors‑ligne

**Date :** 2026-06-29
**Module principal :** `js/offline.js`
**Type :** fix (correction d'un bug + fiabilisation)

## Problème

Les pleins saisis hors‑ligne sont mis en file d'attente dans `localStorage`
(clé `suivi_e85_offline_queue`) et doivent être envoyés à Google Sheets dès le
retour réseau. En pratique, sur PWA mobile / iOS, ils restent bloqués
indéfiniment **sans aucun feedback** :

1. **Session expirée silencieuse.** `syncQueue()` refuse d'envoyer tant que la
   session n'est pas valide (`js/offline.js:49` :
   `if (authEnabled() && !isAuthed()) return;`). L'`id_token` Google expire
   en ~1 h (`js/auth.js:66`). Sur Safari/iOS, la reconnexion silencieuse GIS
   échoue souvent (ITP, cookies tiers bloqués) : l'utilisateur voit encore son
   profil mais le token est mort → `syncQueue()` sort en silence.
2. **Déclencheur fragile.** `syncQueue()` n'est lancée que par l'événement
   `online` (`js/offline.js:122`), le Background Sync (`SyncManager`, non
   supporté sur Safari) et le démarrage (`js/main.js:136`, gardé par
   `persoAllowed()`). Sur mobile, l'événement `online` ne se redéclenche pas de
   façon fiable au retour au premier plan → plus rien ne flushe la file.

Symptôme observé : badge « 📵 N hors‑ligne » qui ne disparaît jamais, aucun
message, alors que l'utilisateur se croit connecté et en ligne.

## Objectif

- Rendre l'échec de synchronisation **visible et actionnable**.
- **Fiabiliser** le déclenchement de la sync sur mobile sans dépendre de
  l'événement `online`.
- Offrir un geste « un clic, ça part » sans nouveau composant d'UI.

## Périmètre

Tous les changements sont concentrés dans `js/offline.js` (le markup du badge
est piloté en JavaScript, donc `index.html` n'est pas modifié), plus un petit
ajout CSS et des tests.

### 1. `syncQueue()` explicite — `syncQueue({ manual = false } = {})`

La fonction prend une option `manual` qui distingue un appel automatique
(démarrage, `visibilitychange`, `online`, `auth-changed`) d'un appel
utilisateur (clic sur le badge). Les sorties jusque‑là muettes deviennent des
retours explicites **uniquement en mode manuel** (pour ne pas spammer en auto) :

| Situation | Auto | Manuel |
|---|---|---|
| File vide | silencieux | `info` « Rien à synchroniser — aucun plein en attente » |
| Session expirée (`authEnabled() && !isAuthed()`) | silencieux | `info` « 🔐 Reconnexion requise — reconnecte‑toi pour envoyer N plein(s) » **+ `promptLogin()`** |
| Toujours hors‑ligne (premier `fetch` échoue, aucun envoi) | silencieux | `error` « 📵 Toujours hors‑ligne » |
| Au moins un plein synchronisé | `success` « N pleins synchronisés ✓ » (existant) | idem |
| Sync partielle (`failed > 0`) | `error` « Sync partielle » (existant) | idem |

Détection « toujours hors‑ligne » : si la boucle se termine avec
`synced === 0 && failed === 0` (cas où le premier `fetch` part en `catch` →
`break`) et `manual === true`, afficher le message hors‑ligne.

`promptLogin` est importé depuis `js/auth.js` (fonction existante, déclenche
l'invite One‑Tap, best‑effort avec cooldown intégré). Après reconnexion réussie,
l'écouteur `auth-changed` existant (`js/main.js:157`) relance `syncQueue()` et
les pleins partent. Le clic sur le badge = « relance la connexion si nécessaire,
la sync suit ».

### 2. Badge `offlineBadge` cliquable

Dans `initOffline()`, une seule fois (pas à chaque `updateOfflineBadge`), on
rend le badge interactif :

- attributs accessibilité : `role="button"`, `tabindex="0"`,
  `aria-label="Synchroniser les pleins en attente"`, curseur pointeur ;
- handler `click` → `syncQueue({ manual: true })` ;
- handler `keydown` (Enter / Espace) → même action.

Le badge est déjà affiché dès que `getPendingCount() > 0`, en ligne **comme**
hors‑ligne (`updateOfflineBadge` ne regarde que le compte). C'est donc le point
d'entrée naturel pour une sync manuelle ; aucun nouvel élément n'est ajouté.

### 3. Retry sur retour au premier plan (`visibilitychange`)

Dans `initOffline()`, ajouter :

```js
document.addEventListener('visibilitychange', () => {
  if (!document.hidden && navigator.onLine) syncQueue();
});
```

Appel **automatique** (silencieux sauf succès). C'est ce déclencheur qui
supprime la dépendance à l'événement `online` peu fiable sur mobile : à chaque
fois que l'utilisateur rouvre l'app, la file est retentée.

### CSS

Petit ajout dans `css/style.css` sur `.offline-badge` : `cursor: pointer` et un
style `:focus`/`:focus-visible` (contour visible) pour l'accessibilité clavier.

## Tests (`tests/offline.test.js`)

- Clic badge avec session expirée (`authEnabled` vrai, `isAuthed` faux) →
  `promptLogin` appelé + `showFeedback('info', …)`, file inchangée.
- Clic badge avec file vide → `showFeedback('info', 'Rien à synchroniser', …)`.
- `visibilitychange` (document visible + `navigator.onLine` vrai) → `syncQueue`
  tentée (au moins un `fetch`).
- Sync réussie → entrées retirées de la file + `success` + badge masqué.

## Hors périmètre (YAGNI)

- Pas de retry programmé ni backoff exponentiel.
- Pas de nouveau bouton dédié (le badge suffit).
- Pas de refonte du flux d'authentification ni du rafraîchissement de token.

## Fichiers impactés

- `js/offline.js` — signature `syncQueue`, feedback explicite, import
  `promptLogin`, badge cliquable, écouteur `visibilitychange`.
- `css/style.css` — `.offline-badge` : curseur + `:focus`.
- `tests/offline.test.js` — nouveaux cas.
- `CHANGELOG.md`, `README.md` (si pertinent), `ROADMAP.md` — documentation.
