#!/usr/bin/env node
// Kit helper — the Chrome native-messaging host behind Drop.
// Chrome starts it when you turn Drop on; it serves a small web app on your Wi-Fi
// (http://<this-computer>:7777) that phones and other computers open to swap text and files.
// It exits when Drop is turned off or Chrome closes, and deletes every received file.
//
// stdout belongs to Chrome's native-messaging protocol — never print to it.
import crypto from 'node:crypto';
import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const VERSION = '1.0.0';
const EXTENSION_ORIGIN = 'chrome-extension://nbmfafaoglnmgabfcmkhcdhfbahgaffl';
const PUBLIC = path.join(path.dirname(fileURLToPath(import.meta.url)), 'public');
const PORTS = [7777, 7778, 7779, 0];
const CODE_CHARS = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
const HOST_NAME = os.hostname().replace(/^(DESKTOP|LAPTOP)-\w+$/i, 'Computer');
const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml', '.png': 'image/png', '.woff2': 'font/woff2', '.webmanifest': 'application/manifest+json',
};
const PAGE_CSP = "default-src 'self'; img-src 'self' blob: data:; style-src 'self'; script-src 'self'; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'none'";

const rid = (bytes = 8) => crypto.randomBytes(bytes).toString('hex');
const log = (...a) => process.stderr.write(`[kit-host] ${a.join(' ')}\n`);

// ---------------------------------------------------------------- native messaging

function reply(msg) {
  const body = Buffer.from(JSON.stringify(msg));
  const head = Buffer.alloc(4);
  head.writeUInt32LE(body.length);
  process.stdout.write(Buffer.concat([head, body]));
}

let inbox = Buffer.alloc(0);
process.stdin.on('data', (chunk) => {
  inbox = Buffer.concat([inbox, chunk]);
  while (inbox.length >= 4) {
    const size = inbox.readUInt32LE(0);
    if (inbox.length < 4 + size) break;
    const msg = JSON.parse(inbox.subarray(4, 4 + size).toString('utf8'));
    inbox = inbox.subarray(4 + size);
    command(msg).then(reply, (err) => reply({ type: 'error', message: err.message }));
  }
});
process.stdin.on('end', () => {
  stop();
  process.exit(0);
});
process.on('uncaughtException', (err) => log('uncaught', err.stack));

async function command(msg) {
  if (msg.cmd === 'start') return { type: 'started', ...(await start()) };
  if (msg.cmd === 'stop') return stop(), { type: 'stopped' };
  if (msg.cmd === 'ping') return { type: 'pong', version: VERSION };
  throw new Error(`Unknown command: ${msg.cmd}`);
}

// ---------------------------------------------------------------- session state

let server = null;
let session = null; // { port, dir, code, token }
let items = []; // { id, kind: 'text'|'file', body?, name?, size?, type?, from: { id, name }, ts }
const people = new Map(); // cookie sid -> { id, name, online, admin }
const clients = new Set(); // open SSE streams: { res, person }
let failedJoins = 0;
let lockedUntil = 0;

function lanAddresses() {
  const virtual = /vethernet|virtual|vmware|vbox|wsl|docker|hyper-v|loopback|bluetooth|tailscale|zerotier|utun|bridge|veth|npcap/i;
  const scored = [];
  for (const [name, addrs] of Object.entries(os.networkInterfaces())) {
    for (const a of addrs ?? []) {
      if (a.internal || !(a.family === 'IPv4' || a.family === 4)) continue;
      const ip = a.address;
      const privateRank = /^192\.168\./.test(ip) ? 3 : /^10\./.test(ip) ? 2 : /^172\.(1[6-9]|2\d|3[01])\./.test(ip) ? 1 : -5;
      scored.push({ ip, score: privateRank + (virtual.test(name) ? -10 : 0) + (/wi-?fi|wlan|wireless|^en0$/i.test(name) ? 2 : 0) });
    }
  }
  return scored.sort((a, b) => b.score - a.score).map((s) => s.ip);
}

const info = () => ({ port: session.port, ips: lanAddresses(), code: session.code, token: session.token, host: HOST_NAME, version: VERSION });

async function start() {
  if (session) return info();
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'kit-drop-'));
  server = http.createServer((req, res) => route(req, res).catch((err) => (log(err.stack), send(res, 500, { error: 'Server error' }))));
  server.requestTimeout = 0; // large uploads over slow Wi-Fi
  let port;
  for (const p of PORTS) {
    try {
      port = await new Promise((resolve, reject) => {
        server.once('error', reject);
        server.listen(p, '0.0.0.0', () => (server.off('error', reject), resolve(server.address().port)));
      });
      break;
    } catch (err) {
      if (err.code !== 'EADDRINUSE') throw err;
    }
  }
  const code = Array.from(crypto.randomBytes(6), (b) => CODE_CHARS[b % CODE_CHARS.length]).join('');
  session = { port, dir, code, token: rid(24) };
  heartbeat = setInterval(() => clients.forEach((c) => c.res.write(': ping\n\n')), 25000);
  return info();
}

let heartbeat = 0;
function stop() {
  if (!session) return;
  clearInterval(heartbeat);
  for (const c of clients) c.res.end();
  clients.clear();
  server.close();
  server.closeAllConnections?.();
  fs.rmSync(session.dir, { recursive: true, force: true });
  server = session = null;
  items = [];
  people.clear();
  failedJoins = lockedUntil = 0;
}

// ---------------------------------------------------------------- live updates

function snapshot() {
  const online = [...people.values()].filter((p) => p.online > 0 && p.name && !p.admin).map(({ id, name }) => ({ id, name }));
  return { host: HOST_NAME, devices: online, items };
}

function broadcast() {
  const base = snapshot();
  for (const { res, person } of clients) res.write(`data: ${JSON.stringify({ ...base, you: person.id })}\n\n`);
}

// ---------------------------------------------------------------- http

const send = (res, status, body, headers = {}) => {
  if (res.headersSent) return res.end();
  res.writeHead(status, { 'content-type': 'application/json', 'cache-control': 'no-store', ...headers });
  res.end(body === undefined ? '' : JSON.stringify(body));
};

const readJson = (req) =>
  new Promise((resolve, reject) => {
    let raw = '';
    req.on('data', (c) => {
      raw += c;
      if (raw.length > 1e6) req.destroy();
    });
    req.on('end', () => {
      try {
        resolve(JSON.parse(raw || '{}'));
      } catch {
        reject(new Error('Bad JSON'));
      }
    });
    req.on('error', reject);
  });

const sameToken = (a, b) => typeof a === 'string' && a.length === b.length && crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b));

function cookieSid(req) {
  return /(?:^|;\s*)kit=([a-f0-9]{32})/.exec(req.headers.cookie ?? '')?.[1];
}

// The extension authenticates with the session token; browsers with the join cookie.
function whoIs(req, url) {
  if (sameToken(url.searchParams.get('t'), session.token)) return { id: 'host', name: HOST_NAME, admin: true, online: 0 };
  return people.get(cookieSid(req)) ?? null;
}

function admit(res, admin = false) {
  const sid = rid(16);
  people.set(sid, admin ? { id: 'host', name: HOST_NAME, admin: true, online: 0 } : { id: rid(6), name: '', online: 0 });
  res.setHeader('set-cookie', `kit=${sid}; HttpOnly; SameSite=Lax; Path=/; Max-Age=43200`);
}

function checkCode(code) {
  if (Date.now() < lockedUntil) return false;
  const ok = String(code ?? '').toUpperCase().replace(/[^A-Z0-9]/g, '') === session.code;
  if (!ok && ++failedJoins >= 8) (lockedUntil = Date.now() + 60_000), (failedJoins = 0);
  return ok;
}

function serveStatic(req, res, pathname) {
  const rel = pathname === '/' ? 'index.html' : decodeURIComponent(pathname).replace(/^\/+/, '');
  const file = path.resolve(PUBLIC, rel);
  if (!file.startsWith(PUBLIC + path.sep) || !fs.existsSync(file) || !fs.statSync(file).isFile()) return send(res, 404, { error: 'Not found' });
  const type = MIME[path.extname(file)] ?? 'application/octet-stream';
  if (type.startsWith('text/html')) {
    // Stamp asset URLs with the build so an updated app can never load from a stale cache.
    res.writeHead(200, { 'content-type': type, 'cache-control': 'no-store', 'x-content-type-options': 'nosniff', 'referrer-policy': 'no-referrer', 'content-security-policy': PAGE_CSP, 'x-frame-options': 'DENY' });
    return res.end(fs.readFileSync(file, 'utf8').replace(/(href|src)="\/(app\.(?:css|js))"/g, `$1="/$2?v=${build()}"`));
  }
  // Everything else revalidates (304 when unchanged).
  const { size, mtimeMs } = fs.statSync(file);
  const etag = `"${size.toString(36)}-${Math.floor(mtimeMs).toString(36)}"`;
  if (req.headers['if-none-match'] === etag) return res.writeHead(304, { etag, 'cache-control': 'no-cache' }).end();
  res.writeHead(200, {
    'content-type': type,
    'cache-control': 'no-cache',
    etag,
    'x-content-type-options': 'nosniff',
    'referrer-policy': 'no-referrer',
  });
  fs.createReadStream(file).pipe(res);
}

// Build id = newest change in public/. Open pages compare it and reload themselves after an update.
function build() {
  let newest = 0;
  for (const name of fs.readdirSync(PUBLIC, { recursive: true })) {
    const stat = fs.statSync(path.join(PUBLIC, name));
    if (stat.isFile()) newest = Math.max(newest, stat.mtimeMs);
  }
  return `${VERSION}-${Math.floor(newest).toString(36)}`;
}

async function route(req, res) {
  if (!session) return send(res, 503, { error: 'Drop is off' });
  const url = new URL(req.url, 'http://local');
  const { pathname } = url;
  const origin = req.headers.origin;

  if (origin === EXTENSION_ORIGIN) {
    res.setHeader('access-control-allow-origin', origin);
    res.setHeader('access-control-allow-methods', 'GET, POST, DELETE');
    res.setHeader('access-control-allow-headers', 'content-type, x-kit-name, x-kit-type');
  }
  if (req.method === 'OPTIONS') return send(res, 204);
  // Only our own page (or the extension) may change anything.
  if (req.method !== 'GET' && origin && origin !== EXTENSION_ORIGIN && origin !== `http://${req.headers.host}`) return send(res, 403, { error: 'Forbidden' });

  // Joining: the QR opens /k/<code>; the extension's "open in tab" uses /a/<token>.
  let m;
  if ((m = /^\/k\/([A-Za-z0-9]{6})$/.exec(pathname))) {
    if (checkCode(m[1])) admit(res);
    return send(res, 302, undefined, { location: '/' });
  }
  if ((m = /^\/a\/([a-f0-9]{48})$/.exec(pathname))) {
    if (sameToken(m[1], session.token)) admit(res, true);
    return send(res, 302, undefined, { location: '/' });
  }
  if (pathname === '/api/join' && req.method === 'POST') {
    if (Date.now() < lockedUntil) return send(res, 429, { error: 'Too many tries. Wait a minute.' });
    const { code } = await readJson(req);
    if (!checkCode(code)) return send(res, 401, { error: "That code doesn't match" });
    admit(res);
    return send(res, 200, { ok: true });
  }

  if (!pathname.startsWith('/api/')) return serveStatic(req, res, pathname);

  const me = whoIs(req, url);
  if (pathname === '/api/me') {
    const join = me?.admin ? { ips: lanAddresses(), port: session.port, code: session.code } : undefined;
    return send(res, 200, { joined: Boolean(me), id: me?.id, name: me?.name ?? '', host: HOST_NAME, admin: Boolean(me?.admin), join, build: build() });
  }
  if (!me) return send(res, 401, { error: 'Join first' });

  if (pathname === '/api/name' && req.method === 'POST') {
    const { name } = await readJson(req);
    me.name = String(name ?? '').trim().slice(0, 40) || 'Device';
    broadcast();
    return send(res, 200, { ok: true });
  }

  if (pathname === '/api/events') {
    res.writeHead(200, { 'content-type': 'text/event-stream', 'cache-control': 'no-store', connection: 'keep-alive' });
    res.write('retry: 2000\n\n');
    const client = { res, person: me };
    clients.add(client);
    me.online++;
    broadcast();
    req.on('close', () => {
      clients.delete(client);
      me.online--;
      broadcast();
    });
    return;
  }

  const from = { id: me.id, name: me.name || 'Device' };

  if (pathname === '/api/text' && req.method === 'POST') {
    const { body } = await readJson(req);
    const text = String(body ?? '').slice(0, 100_000);
    if (!text.trim()) return send(res, 400, { error: 'Empty message' });
    items.push({ id: rid(), kind: 'text', body: text, from, ts: Date.now() });
    broadcast();
    return send(res, 200, { ok: true });
  }

  if (pathname === '/api/files' && req.method === 'POST') {
    const id = rid();
    const name = path.basename(decodeURIComponent(String(req.headers['x-kit-name'] ?? 'file'))).slice(0, 200) || 'file';
    const type = String(req.headers['x-kit-type'] ?? '').slice(0, 100);
    const file = path.join(session.dir, id);
    const out = fs.createWriteStream(file);
    let size = 0;
    req.on('data', (c) => (size += c.length));
    req.on('aborted', () => (out.destroy(), fs.rm(file, { force: true }, () => {})));
    out.on('finish', () => {
      if (req.aborted || !session) return;
      items.push({ id, kind: 'file', name, size, type, from, ts: Date.now() });
      broadcast();
      send(res, 200, { id });
    });
    req.pipe(out);
    return;
  }

  if ((m = /^\/api\/files\/([a-f0-9]{16})$/.exec(pathname)) && req.method === 'GET') {
    const item = items.find((i) => i.id === m[1] && i.kind === 'file');
    if (!item) return send(res, 404, { error: 'Gone' });
    const inline = url.searchParams.has('inline') && /^image\/(png|jpe?g|gif|webp|avif)$/.test(item.type);
    const ascii = item.name.replace(/[^\x20-\x7e]|["\\]/g, '_');
    res.writeHead(200, {
      'content-type': inline ? item.type : 'application/octet-stream',
      'content-length': item.size,
      'content-disposition': `${inline ? 'inline' : 'attachment'}; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(item.name)}`,
      'x-content-type-options': 'nosniff',
      'cache-control': 'private, max-age=3600',
    });
    fs.createReadStream(path.join(session.dir, item.id)).pipe(res);
    return;
  }

  if ((m = /^\/api\/items\/([a-f0-9]{16})$/.exec(pathname)) && req.method === 'DELETE') {
    const item = items.find((i) => i.id === m[1]);
    if (item) {
      items = items.filter((i) => i !== item);
      if (item.kind === 'file') fs.rm(path.join(session.dir, item.id), { force: true }, () => {});
      broadcast();
    }
    return send(res, 200, { ok: true });
  }

  send(res, 404, { error: 'Not found' });
}
