// Serveur dédié : sert le client et gère le multijoueur en WebSocket.
// Aucun compte n'est stocké : l'accès est contrôlé par un mot de passe (GAME_KEY)
// et/ou par un compte Microsoft (jeton vérifié à la volée, liste d'e-mails autorisés).
'use strict';

const http = require('http');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const express = require('express');
const { WebSocketServer } = require('ws');

global.window = { MC: {} };
require('./public/js/host.js');
const MC = global.window.MC;

const PORT = parseInt(process.env.PORT || '3000', 10);
const WORLD_FILE = process.env.WORLD_FILE || path.join(__dirname, 'world.json');
const MS_CLIENT_ID = process.env.MS_CLIENT_ID || '';
const MS_TENANT = process.env.MS_TENANT || 'consumers';
const ALLOWED_EMAILS = (process.env.ALLOWED_EMAILS || '').split(',').map((s) => s.trim().toLowerCase()).filter(Boolean);
let GAME_KEY = process.env.GAME_KEY || '';
if (!GAME_KEY && !MS_CLIENT_ID) {
  GAME_KEY = crypto.randomBytes(4).toString('hex');
  console.log('Aucune variable GAME_KEY : mot de passe généré pour cette session -> ' + GAME_KEY);
}

// ---------- Monde persistant (uniquement les blocs modifiés, jamais de comptes) ----------
let saved = { seed: null, edits: [] };
try {
  if (fs.existsSync(WORLD_FILE)) saved = JSON.parse(fs.readFileSync(WORLD_FILE, 'utf8'));
} catch (e) { console.warn('world.json illisible, nouveau monde'); }
const seed = process.env.SEED ? (parseInt(process.env.SEED, 10) | 0) : (saved.seed !== null && saved.seed !== undefined ? saved.seed : (Math.random() * 2147483647) | 0);
if (saved.seed !== seed) saved.edits = [];

let saveTimer = null;
function scheduleSave() {
  if (saveTimer) return;
  saveTimer = setTimeout(saveNow, 2000);
}
function saveNow() {
  saveTimer = null;
  try {
    fs.writeFileSync(WORLD_FILE, JSON.stringify({ seed, edits: host.editsToArray(), savedAt: Date.now() }));
  } catch (e) { console.warn('Sauvegarde impossible :', e.message); }
}

// ---------- Vérification d'un jeton Microsoft ----------
let jwks = null, jose = null;
async function verifyMicrosoftToken(token) {
  if (!jose) jose = await import('jose');
  if (!jwks) jwks = jose.createRemoteJWKSet(new URL('https://login.microsoftonline.com/' + MS_TENANT + '/discovery/v2.0/keys'));
  const { payload } = await jose.jwtVerify(token, jwks, { audience: MS_CLIENT_ID });
  const iss = String(payload.iss || '');
  if (!/^https:\/\/login\.microsoftonline\.com\/[0-9a-f-]+\/v2\.0$/i.test(iss)) throw new Error('émetteur inattendu');
  const email = String(payload.preferred_username || payload.email || '').toLowerCase();
  return { email, name: payload.name || email.split('@')[0] };
}

async function authorize(msg) {
  if (MS_CLIENT_ID && msg.token) {
    try {
      const info = await verifyMicrosoftToken(msg.token);
      if (ALLOWED_EMAILS.length && !ALLOWED_EMAILS.includes(info.email)) return { ok: false, reason: 'Ce compte Microsoft n\'est pas autorisé sur ce serveur' };
      return { ok: true, name: msg.name || info.name };
    } catch (e) {
      console.warn('Jeton Microsoft refusé :', e.message);
      return { ok: false, reason: 'Jeton Microsoft invalide' };
    }
  }
  if (GAME_KEY) {
    if (msg.key === GAME_KEY) return { ok: true, name: msg.name };
    return { ok: false, reason: MS_CLIENT_ID ? 'Connecte-toi avec ton compte Microsoft ou le mot de passe' : 'Mot de passe incorrect' };
  }
  return { ok: false, reason: 'Connexion Microsoft requise' };
}

const host = new MC.GameHost({
  seed,
  edits: saved.edits,
  authorize,
  onEdit: scheduleSave,
  log: (s) => console.log('[jeu] ' + s),
  maxPlayers: parseInt(process.env.MAX_PLAYERS || '16', 10)
});

// ---------- HTTP ----------
const app = express();
app.disable('x-powered-by');
app.get('/api/config', (req, res) => {
  res.set('Cache-Control', 'no-store');
  res.json({ msClientId: MS_CLIENT_ID, msTenant: MS_TENANT, allowedEmails: ALLOWED_EMAILS, wsUrl: '', requireLogin: process.env.REQUIRE_LOGIN === '1', dedicated: true });
});
app.get('/api/health', (req, res) => {
  let players = 0;
  for (const c of host.clients.values()) if (c.ready) players++;
  res.json({ ok: true, players, edits: host.edits.size, seed });
});
app.use(express.static(path.join(__dirname, 'public'), { etag: false, maxAge: 0 }));

const server = http.createServer(app);

// ---------- WebSocket ----------
const wss = new WebSocketServer({ server, path: '/ws', maxPayload: 512 * 1024 });
wss.on('connection', (ws, req) => {
  ws.isAlive = true;
  ws.on('pong', () => { ws.isAlive = true; });
  const id = host.addClient((s) => { if (ws.readyState === ws.OPEN) ws.send(s); });
  ws.on('message', (data) => {
    host.handle(id, data.toString()).then(() => {
      const c = host.clients.get(id);
      // un refus d'authentification ferme la connexion
    }).catch(() => {});
  });
  ws.on('close', () => host.removeClient(id));
  ws.on('error', () => host.removeClient(id));
});

const interval = setInterval(() => {
  wss.clients.forEach((ws) => {
    if (ws.isAlive === false) return ws.terminate();
    ws.isAlive = false;
    ws.ping();
  });
}, 30000);

function shutdown() {
  clearInterval(interval);
  saveNow();
  console.log('Monde sauvegardé, arrêt.');
  process.exit(0);
}
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

server.listen(PORT, () => {
  console.log('CubeCraft Web : http://localhost:' + PORT + '  (graine ' + seed + ', ' + host.edits.size + ' blocs modifiés)');
  if (MS_CLIENT_ID) console.log('Connexion Microsoft active' + (ALLOWED_EMAILS.length ? ' pour : ' + ALLOWED_EMAILS.join(', ') : ' (tous les comptes)'));
  if (GAME_KEY) console.log('Mot de passe de la partie : ' + GAME_KEY);
});
