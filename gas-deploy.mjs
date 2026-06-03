#!/usr/bin/env node
/**
 * gas-deploy.mjs — Déploiement automatisé du projet Google Apps Script via l'API REST.
 *
 * Pousse les fichiers .gs / .html locaux du dossier GAS vers le projet Apps Script,
 * crée une version (snapshot) et met à jour le déploiement EXISTANT (même URL /exec).
 *
 * ⚠️ STRATÉGIE FUSION — « jamais de suppression » :
 *   l'API updateContent REMPLACE l'intégralité du projet. Le script charge donc
 *   d'abord TOUS les fichiers en ligne (GET content), n'écrase/ajoute QUE les
 *   fichiers présents en local (par nom), et CONSERVE les fichiers en ligne
 *   absents du repo (ex. `appsscript` manifest, `iphone.html`). Aucun fichier
 *   distant n'est supprimé.
 *
 * Auth : OAuth 2.0 refresh_token (renseigné dans .claude/gas-config.json, gitignoré).
 *
 * Usage :
 *   node gas-deploy.mjs --check                 # vérifie l'auth + l'accès au projet
 *   node gas-deploy.mjs --pull                  # liste les fichiers en ligne (diagnostic)
 *   node gas-deploy.mjs --no-deploy "desc"      # push code + version, SANS redéployer
 *   node gas-deploy.mjs "description"            # push code + version + redéploiement
 *   (sans description → horodatage auto)
 */

import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, extname, basename } from 'node:path';

const ROOT = dirname(fileURLToPath(import.meta.url));
const CONFIG_PATH = join(ROOT, '.claude', 'gas-config.json');
const DEFAULT_GAS_DIR = join(
  ROOT, 'Google Drive', 'Sauvegarde & Geolocalisation - Suivi conso SuperEthanol', 'Google Apps Script'
);
const API = 'https://script.googleapis.com/v1';

const C = { gray: '\x1b[90m', green: '\x1b[32m', red: '\x1b[31m', yellow: '\x1b[33m', bold: '\x1b[1m', off: '\x1b[0m' };
const log  = (m) => console.log(m);
const ok   = (m) => console.log(`   ${C.green}✅${C.off} ${m}`);
const info = (m) => console.log(`   ${C.gray}ℹ️  ${m}${C.off}`);
const die  = (m) => { console.error(`\n${C.red}❌ ${m}${C.off}`); process.exit(1); };

/* ─── Config ──────────────────────────────────────────────────────────── */
function loadConfig() {
  let cfg;
  try { cfg = JSON.parse(readFileSync(CONFIG_PATH, 'utf8')); }
  catch { die(`Config introuvable ou invalide : ${CONFIG_PATH}`); }

  const oauth = cfg.oauth || {};
  const missing = ['client_id', 'client_secret', 'refresh_token']
    .filter(k => !oauth[k] || String(oauth[k]).includes('⚠️'));
  if (missing.length) {
    die(`OAuth incomplet dans .claude/gas-config.json → renseigne : ${missing.join(', ')}\n` +
        `   (voir la procédure : OAuth Playground avec tes propres identifiants).`);
  }
  if (!cfg.scriptId || String(cfg.scriptId).includes('⚠️')) die('scriptId manquant dans gas-config.json.');
  return cfg;
}

/* ─── OAuth : refresh_token → access_token ────────────────────────────── */
async function getAccessToken(cfg) {
  const o = cfg.oauth;
  const body = new URLSearchParams({
    client_id: o.client_id, client_secret: o.client_secret,
    refresh_token: o.refresh_token, grant_type: 'refresh_token',
  });
  const resp = await fetch(o.token_endpoint || 'https://oauth2.googleapis.com/token', {
    method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body,
  });
  const data = await resp.json().catch(() => ({}));
  if (!resp.ok || !data.access_token) {
    die(`Échec du rafraîchissement OAuth (${resp.status}) : ${data.error || ''} ${data.error_description || ''}\n` +
        `   → refresh_token invalide/expiré, ou scopes manquants. Régénère-le via OAuth Playground.`);
  }
  return data.access_token;
}

/* ─── Helpers API ─────────────────────────────────────────────────────── */
function authHeaders(token) { return { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }; }

async function apiJson(method, url, token, body) {
  const resp = await fetch(url, {
    method, headers: authHeaders(token), body: body ? JSON.stringify(body) : undefined,
  });
  const data = await resp.json().catch(() => ({}));
  if (!resp.ok) {
    const msg = data.error?.message || JSON.stringify(data).slice(0, 300);
    die(`${method} ${url.replace(API, '')} → HTTP ${resp.status} : ${msg}`);
  }
  return data;
}

/* ─── Fichiers locaux → format API ────────────────────────────────────── */
function localFiles(gasDir) {
  const out = [];
  for (const fn of readdirSync(gasDir)) {
    const ext = extname(fn).toLowerCase();
    let type = null, name = basename(fn, ext);
    if (ext === '.gs')   type = 'SERVER_JS';
    else if (ext === '.html') type = 'HTML';
    else if (fn === 'appsscript.json') { type = 'JSON'; name = 'appsscript'; }
    else continue;   // .md et autres ignorés
    // Normalise CRLF→LF (Windows) pour ne pas injecter de \r dans le projet GAS.
    out.push({ name, type, source: readFileSync(join(gasDir, fn), 'utf8').replace(/\r\n/g, '\n') });
  }
  return out;
}

/* ─── Fusion : live (base) + local (écrase/ajoute par nom), jamais de suppression ── */
function mergeFiles(live, local) {
  const map = new Map(live.map(f => [f.name, f]));
  const updated = [], added = [];
  for (const lf of local) {
    (map.has(lf.name) ? updated : added).push(lf.name);
    map.set(lf.name, lf);
  }
  const kept = live.map(f => f.name).filter(n => !local.some(l => l.name === n));
  return { files: [...map.values()], updated, added, kept };
}

/* ─── Programme principal ─────────────────────────────────────────────── */
const args = process.argv.slice(2);
const flag = (f) => args.includes(f);
const desc = args.find(a => !a.startsWith('--')) ||
  `Déploiement auto ${new Date().toISOString().replace('T', ' ').slice(0, 19)}`;

const cfg = loadConfig();
const gasDir = cfg.localGasDir ? join(ROOT, cfg.localGasDir) : DEFAULT_GAS_DIR;

log(`\n${C.bold}🚀 gas-deploy${C.off}  scriptId=${cfg.scriptId.slice(0, 12)}…`);
const token = await getAccessToken(cfg);
ok('Access token obtenu (refresh_token OK).');

/* --check : on s'arrête après une lecture des métadonnées du projet. */
if (flag('--check')) {
  const meta = await apiJson('GET', `${API}/projects/${cfg.scriptId}`, token);
  ok(`Projet accessible : « ${meta.title} » (maj ${meta.updateTime || '?'}).`);
  info('Auth + scopes OK. Prêt pour le déploiement.');
  process.exit(0);
}

/* GET content (toujours — base de la fusion) */
const liveContent = await apiJson('GET', `${API}/projects/${cfg.scriptId}/content`, token);
const live = liveContent.files || [];
ok(`Contenu en ligne chargé : ${live.length} fichier(s).`);

if (flag('--pull')) {
  for (const f of live) info(`${f.name}.${f.type === 'SERVER_JS' ? 'gs' : f.type === 'HTML' ? 'html' : 'json'}`);
  process.exit(0);
}

/* --diff : compare local vs en ligne, fichier par fichier (sans rien écrire). */
if (flag('--diff')) {
  const local = localFiles(gasDir);
  const liveByName = new Map(live.map(f => [f.name, f]));
  let diffs = 0;
  for (const lf of local) {
    const lv = liveByName.get(lf.name);
    if (!lv) { console.log(`   ${C.yellow}+  ${lf.name} : ABSENT en ligne → sera AJOUTÉ${C.off}`); diffs++; continue; }
    if ((lv.source || '').replace(/\r\n/g, '\n') === lf.source) { ok(`${lf.name} : identique`); }
    else {
      const a = (lv.source || '').split('\n').length, b = lf.source.split('\n').length;
      console.log(`   ${C.yellow}≠  ${lf.name} : DIFFÉRENT (en ligne ${a} lignes / local ${b} lignes)${C.off}`);
      diffs++;
    }
  }
  const liveOnly = live.filter(f => !local.some(l => l.name === f.name)).map(f => f.name);
  info(`Conservés tel quel (en ligne, non locaux) : ${liveOnly.join(', ') || '—'}`);
  info(diffs === 0 ? 'Aucune divergence : push = identique (sûr).' : `${diffs} fichier(s) seront écrasés par la version locale.`);
  process.exit(0);
}

const local = localFiles(gasDir);
if (!local.length) die(`Aucun fichier .gs/.html trouvé dans : ${gasDir}`);
const { files, updated, added, kept } = mergeFiles(live, local);
ok(`Fusion : ${updated.length} mis à jour, ${added.length} ajouté(s), ${kept.length} conservé(s) tel quel.`);
info(`Mis à jour : ${updated.join(', ') || '—'}`);
if (added.length) info(`Ajoutés    : ${added.join(', ')}`);
info(`Conservés  : ${kept.join(', ') || '—'}`);

/* PUT content */
await apiJson('PUT', `${API}/projects/${cfg.scriptId}/content`, token, { files });
ok('Code poussé (projects.updateContent).');

/* POST version */
const version = await apiJson('POST', `${API}/projects/${cfg.scriptId}/versions`, token, { description: desc });
ok(`Version créée : v${version.versionNumber} — « ${desc} ».`);

if (flag('--no-deploy')) { info('--no-deploy : déploiement NON mis à jour (HEAD seulement).'); process.exit(0); }

/* PUT deployment (même deployId → même URL /exec) */
if (!cfg.deployId || String(cfg.deployId).includes('⚠️')) die('deployId manquant dans gas-config.json.');
await apiJson('PUT', `${API}/projects/${cfg.scriptId}/deployments/${cfg.deployId}`, token, {
  deploymentConfig: { versionNumber: version.versionNumber, manifestFileName: 'appsscript', description: desc },
});
ok(`Déploiement mis à jour → v${version.versionNumber} (URL /exec inchangée).`);

/* Historique dans gas-config.json (gitignoré) — best-effort */
try {
  cfg.deployHistory = (cfg.deployHistory || []).filter(e => e.versionNumber);   // purge l'exemple
  cfg.deployHistory.unshift({
    date: new Date().toISOString().slice(0, 10),
    versionNumber: version.versionNumber, description: desc,
  });
  writeFileSync(CONFIG_PATH, JSON.stringify(cfg, null, 2) + '\n');
  info('deployHistory mis à jour dans gas-config.json.');
} catch { /* non bloquant */ }

log(`\n${C.green}${C.bold}✅ Terminé.${C.off} Teste : ?action=sectorPrices&fuel=E85&token=…\n`);
