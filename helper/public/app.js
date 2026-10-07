// Kit Drop web app — served by the Kit helper on your local network.
import { qrSvg } from './qr.js';

const $ = (id) => document.getElementById(id);
const screens = { code: $('screen-code'), name: $('screen-name'), off: $('screen-off'), chat: $('screen-chat') };
const thread = $('thread');
const composer = $('composer');
const text = $('text');
const send = $('send');
const statusEl = $('status');
const toastEl = $('toast');

// The async clipboard API (paste button, copy image) only exists on HTTPS or localhost.
// Over plain HTTP on the LAN we fall back to the browser's own long-press menu.
const secure = window.isSecureContext && Boolean(navigator.clipboard);

const nodes = new Map(); // item id -> li
let me = { id: '', name: '', host: '' };
let events = null;
let toastTimer = 0;
let last = null; // last rendered item, for grouping

const ICONS = {
  copy: '<rect x="9" y="9" width="11" height="11" rx="2.5"/><path d="M5 15V6.5A2.5 2.5 0 0 1 7.5 4H15"/>',
  trash: '<path d="M4 7h16M10 11v6M14 11v6M6 7l1 12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-12M9 7V4h6v3"/>',
  download: '<path d="M12 4v11M7 10l5 5 5-5M5 20h14"/>',
  file: '<path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5"/>',
};

function el(tag, props = {}, ...children) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(props)) {
    if (v == null || v === false) continue;
    if (k.startsWith('on')) node.addEventListener(k.slice(2), v);
    else node.setAttribute(k, v === true ? '' : v);
  }
  node.append(...children.filter((c) => c != null && c !== false));
  return node;
}
function svg(name) {
  const s = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  s.setAttribute('viewBox', '0 0 24 24');
  s.innerHTML = ICONS[name];
  return s;
}

function toast(message, kind = 'ok') {
  toastEl.textContent = message;
  toastEl.className = `toast show ${kind}`;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toastEl.classList.remove('show'), 1800);
}

function show(name) {
  for (const [key, node] of Object.entries(screens)) node.hidden = key !== name;
  composer.hidden = name !== 'chat';
  if (name !== 'chat') events?.close();
}

function setStatus(kind, label) {
  statusEl.className = `pill ${kind}`;
  statusEl.lastElementChild.textContent = label;
}

function formatSize(n) {
  if (n < 1024) return `${n} B`;
  const units = ['KB', 'MB', 'GB'];
  let i = -1;
  do n /= 1024, i++;
  while (n >= 1024 && i < units.length - 1);
  return `${n < 10 ? n.toFixed(1) : Math.round(n)} ${units[i]}`;
}

const time = (ts) => new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

function guessName() {
  const ua = navigator.userAgent;
  if (/iPhone/.test(ua)) return 'iPhone';
  if (/iPad/.test(ua)) return 'iPad';
  if (/Android/.test(ua)) return 'Android phone';
  if (/Mac/.test(ua)) return 'Mac';
  if (/Windows/.test(ua)) return 'Windows PC';
  return 'My device';
}

async function api(path, options = {}) {
  const res = await fetch(path, { credentials: 'same-origin', ...options });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw Object.assign(new Error(body.error || res.statusText), { status: res.status });
  return body;
}

// ---------------------------------------------------------------- flow

async function boot() {
  let info;
  try {
    info = await api('/api/me');
  } catch {
    setStatus('bad', 'Offline');
    return show('off');
  }
  me = { id: info.id, name: info.name, host: info.host };
  if (info.admin) hostPanel(info.join);
  if (!info.joined) {
    setStatus('wait', 'Not joined');
    show('code');
    return $('code').focus();
  }
  if (!info.name) {
    const saved = localStorage.getItem('kit.name');
    if (saved) await api('/api/name', { method: 'POST', body: JSON.stringify({ name: saved }) });
    else return askName();
  }
  me.name = info.name || localStorage.getItem('kit.name');
  chat();
}

function askName(current = '') {
  setStatus('wait', 'Almost there');
  show('name');
  $('name').value = current || localStorage.getItem('kit.name') || guessName();
  $('name').select();
}

function chat() {
  show('chat');
  setStatus('ok', `Connected to ${me.host}`);
  events?.close();
  events = new EventSource('/api/events');
  events.onmessage = (e) => render(JSON.parse(e.data));
  events.onerror = async () => {
    setStatus('wait', 'Reconnecting');
    try {
      const info = await api('/api/me');
      if (!info.joined) boot(); // Drop restarted with a new code
    } catch {
      events.close();
      setStatus('bad', 'Offline');
      show('off');
    }
  };
}

// ---------------------------------------------------------------- host view (opened full-screen from Kit)

function hostPanel(join) {
  document.body.classList.add('host');
  $('side').hidden = false;
  let i = 0;
  const paint = () => {
    const ip = join.ips[i] ?? location.hostname;
    const link = `http://${ip}:${join.port}/k/${join.code}`;
    $('side-qr').innerHTML = qrSvg(link);
    $('side-addr').textContent = `${ip}:${join.port}`;
    $('side-addr').onclick = () => copyText(link, 'Link copied');
    $('side-code').replaceChildren(...join.code.split('').map((c) => el('b', {}, c)));
    $('side-net').hidden = join.ips.length < 2;
    $('side-net').textContent = `Wrong network? Try ${join.ips[(i + 1) % join.ips.length]}`;
  };
  $('side-net').onclick = () => ((i = (i + 1) % join.ips.length), paint());
  paint();
}

// ---------------------------------------------------------------- thread

function render({ items, devices, you }) {
  me.id = you;
  const others = devices.filter((d) => d.id !== you).length;
  setStatus('ok', document.body.classList.contains('host') ? `${others} connected` : `${me.host}${others ? ` + ${others}` : ''}`);
  $('side-people').replaceChildren(...(devices.length ? devices.map((d) => el('li', {}, el('i'), d.name)) : [el('li', { class: 'none' }, 'Nobody yet')]));

  const ids = new Set(items.map((i) => i.id));
  for (const [id, node] of nodes) {
    if (ids.has(id)) continue;
    node.classList.add('leaving');
    setTimeout(() => node.remove(), 220);
    nodes.delete(id);
  }
  let added = false;
  for (const item of items) {
    if (nodes.has(item.id)) continue;
    const node = itemNode(item);
    nodes.set(item.id, node);
    thread.append(node);
    added = true;
  }
  thread.append(...thread.querySelectorAll('.pending'));
  const empty = thread.querySelector('.empty');
  if (!items.length && !thread.querySelector('.pending')) {
    last = null;
    if (!empty) thread.append(emptyState());
  } else empty?.remove();
  if (added) scrollDown();
}

function emptyState() {
  return el(
    'li',
    { class: 'empty' },
    el('div', { class: 'bubbles', 'aria-hidden': 'true' }, el('i'), el('i'), el('i')),
    el('b', {}, `You're connected to ${me.host}`),
    el('span', {}, 'Send text, links, photos or files. They show up on every connected device instantly.'),
  );
}

function scrollDown() {
  requestAnimationFrame(() => window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' }));
}

// Text with clickable http(s) links — built from text nodes, never HTML.
function linkify(body) {
  const p = el('p');
  for (const part of body.split(/(https?:\/\/[^\s<>"']+)/g)) {
    if (/^https?:\/\//.test(part)) p.append(el('a', { href: part, target: '_blank', rel: 'noopener noreferrer' }, part));
    else if (part) p.append(part);
  }
  return p;
}

const action = (name, label, onclick) => el('button', { class: 'act', type: 'button', 'aria-label': label, title: label, onclick }, svg(name), el('span', {}, label));

function itemNode(item) {
  const mine = item.from.id === me.id;
  const grouped = last && last.from.id === item.from.id && item.ts - last.ts < 5 * 60_000;
  last = item;
  const remove = () => api(`/api/items/${item.id}`, { method: 'DELETE' }).catch(() => toast("Couldn't delete", 'error'));
  const head = !grouped && el('div', { class: 'head' }, !mine && el('b', {}, item.from.name), el('time', {}, time(item.ts)));
  const cls = `msg ${mine ? 'me' : 'them'}${grouped ? ' cont' : ''}`;

  if (item.kind === 'text') {
    const body = linkify(item.body);
    const node = el('li', { class: cls }, head, el('div', { class: 'bubble' }, body), el('div', { class: 'acts' }, action('copy', 'Copy', () => copyText(item.body)), action('trash', 'Delete', remove)));
    collapsible(node, body);
    return node;
  }

  const href = `/api/files/${item.id}`;
  const image = /^image\/(png|jpe?g|gif|webp|avif)$/.test(item.type);
  const save = el('a', { class: 'act', href, download: item.name, title: 'Save' }, svg('download'), el('span', {}, 'Save'));
  const body = image
    ? el('button', { class: 'bubble photo', type: 'button', onclick: () => openViewer(item) }, el('img', { src: `${href}?inline`, alt: item.name, loading: 'lazy' }))
    : el('div', { class: 'bubble file' }, el('span', { class: 'file-ico' }, svg('file')), el('div', { class: 'file-text' }, el('b', {}, item.name), el('small', {}, formatSize(item.size))));
  return el('li', { class: cls }, head, body, el('div', { class: 'acts' }, save, action('trash', 'Delete', remove)));
}

// Long messages start folded so one paste doesn't take over the screen.
function collapsible(node, body) {
  body.classList.add('clamp');
  requestAnimationFrame(() => {
    if (body.scrollHeight <= body.clientHeight + 4) return body.classList.remove('clamp');
    const more = el('button', { class: 'more', type: 'button' }, 'Show more');
    more.onclick = () => (more.textContent = body.classList.toggle('clamp') ? 'Show more' : 'Show less');
    body.after(more);
  });
}

async function copyText(value, message = 'Copied') {
  try {
    await navigator.clipboard.writeText(value);
  } catch {
    const ta = el('textarea', { readonly: true, style: 'position:fixed;top:0;opacity:0' });
    ta.value = value;
    document.body.append(ta);
    ta.focus();
    ta.setSelectionRange(0, value.length);
    const ok = document.execCommand('copy');
    ta.remove();
    if (!ok) return toast("Couldn't copy", 'error');
  }
  toast(message);
}

// ---------------------------------------------------------------- image viewer

const viewer = $('viewer');
function openViewer(item) {
  const src = `/api/files/${item.id}?inline`;
  $('viewer-img').src = src;
  $('viewer-img').alt = item.name;
  $('viewer-save').href = `/api/files/${item.id}`;
  $('viewer-save').download = item.name;
  $('viewer-copy').hidden = !(secure && window.ClipboardItem);
  $('viewer-tip').hidden = !$('viewer-copy').hidden;
  $('viewer-copy').onclick = () => copyImage(src);
  viewer.hidden = false;
  requestAnimationFrame(() => viewer.classList.add('open'));
}
function closeViewer() {
  viewer.classList.remove('open');
  setTimeout(() => (viewer.hidden = true), 200);
}
async function copyImage(src) {
  try {
    let blob = await (await fetch(src)).blob();
    if (blob.type !== 'image/png') {
      // Clipboards reliably accept PNG only.
      const bitmap = await createImageBitmap(blob);
      const canvas = Object.assign(document.createElement('canvas'), { width: bitmap.width, height: bitmap.height });
      canvas.getContext('2d').drawImage(bitmap, 0, 0);
      blob = await new Promise((r) => canvas.toBlob(r, 'image/png'));
    }
    await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
    toast('Image copied');
  } catch {
    toast("Couldn't copy the image", 'error');
  }
}
viewer.addEventListener('click', (e) => e.target === viewer && closeViewer());
$('viewer-close').addEventListener('click', closeViewer);
addEventListener('keydown', (e) => e.key === 'Escape' && !viewer.hidden && closeViewer());

// ---------------------------------------------------------------- sending

async function sendText(body) {
  try {
    await api('/api/text', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ body }) });
  } catch {
    toast('Not sent — check the connection', 'error');
  }
}

function sendFile(file) {
  const bar = el('i');
  const meta = el('small', {}, `0 of ${formatSize(file.size)}`);
  const pending = el(
    'li',
    { class: 'msg me pending' },
    el('div', { class: 'bubble file' }, el('span', { class: 'file-ico' }, svg('file')), el('div', { class: 'file-text' }, el('b', {}, file.name || 'Pasted image'), meta), el('div', { class: 'progress' }, bar)),
  );
  thread.querySelector('.empty')?.remove();
  thread.append(pending);
  scrollDown();
  const xhr = new XMLHttpRequest();
  xhr.open('POST', '/api/files');
  xhr.setRequestHeader('x-kit-name', encodeURIComponent(file.name || `pasted-${Date.now()}.png`));
  xhr.setRequestHeader('x-kit-type', file.type);
  xhr.upload.onprogress = (e) => {
    bar.style.width = `${(e.loaded / e.total) * 100}%`;
    meta.textContent = `${formatSize(e.loaded)} of ${formatSize(file.size)}`;
  };
  xhr.onload = () => (xhr.status === 200 ? pending.remove() : fail());
  xhr.onerror = fail;
  function fail() {
    pending.classList.add('failed');
    meta.textContent = 'Failed — tap to dismiss';
    pending.onclick = () => pending.remove();
  }
  xhr.send(file);
}

function syncSend() {
  send.disabled = !text.value.trim();
}

composer.addEventListener('submit', (e) => {
  e.preventDefault();
  const body = text.value.trim();
  if (!body) return;
  sendText(body);
  text.value = '';
  text.style.height = '';
  syncSend();
  text.focus();
});
text.addEventListener('input', () => {
  text.style.height = '';
  text.style.height = `${Math.min(text.scrollHeight, innerHeight * 0.4)}px`;
  syncSend();
});
text.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && !e.shiftKey && matchMedia('(hover: hover)').matches) {
    e.preventDefault();
    composer.requestSubmit();
  }
});
// Pasting images/files (long-press → Paste on phones, Ctrl+V on computers) sends them.
document.addEventListener('paste', (e) => {
  if (screens.chat.hidden) return;
  const files = [...(e.clipboardData?.files ?? [])];
  if (!files.length) return;
  e.preventDefault();
  files.forEach(sendFile);
});
for (const id of ['photos', 'files']) {
  $(id).addEventListener('change', (e) => {
    [...e.target.files].forEach(sendFile);
    e.target.value = '';
  });
}
if (secure && navigator.clipboard.read) {
  $('paste').hidden = false;
  $('paste').addEventListener('click', async () => {
    try {
      for (const entry of await navigator.clipboard.read()) {
        const type = entry.types.find((t) => t.startsWith('image/'));
        if (type) return sendFile(new File([await entry.getType(type)], `pasted-${Date.now()}.png`, { type }));
      }
      const clip = await navigator.clipboard.readText();
      if (!clip) return toast('Clipboard is empty', 'error');
      text.value += clip;
      text.dispatchEvent(new Event('input'));
      text.focus();
    } catch {
      toast('Clipboard access was blocked', 'error');
    }
  });
}

// ---------------------------------------------------------------- code & name screens

$('screen-code').addEventListener('submit', async (e) => {
  e.preventDefault();
  try {
    await api('/api/join', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ code: $('code').value }) });
    $('code-err').textContent = '';
    boot();
  } catch (err) {
    $('code-err').textContent = err.message;
    screens.code.classList.remove('shake');
    void screens.code.offsetWidth;
    screens.code.classList.add('shake');
    $('code').select();
  }
});
$('code').addEventListener('input', (e) => (e.target.value = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '')));

$('screen-name').addEventListener('submit', async (e) => {
  e.preventDefault();
  const name = $('name').value.trim() || guessName();
  localStorage.setItem('kit.name', name);
  await api('/api/name', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ name }) });
  me.name = name;
  chat();
});
statusEl.addEventListener('click', () => !screens.chat.hidden && !document.body.classList.contains('host') && askName(me.name));
$('retry').addEventListener('click', boot);

// Desktop drag & drop anywhere on the page.
let dragDepth = 0;
addEventListener('dragenter', (e) => !screens.chat.hidden && e.dataTransfer.types.includes('Files') && (++dragDepth, ($('dropzone').hidden = false)));
addEventListener('dragleave', () => --dragDepth <= 0 && ((dragDepth = 0), ($('dropzone').hidden = true)));
addEventListener('dragover', (e) => e.preventDefault());
addEventListener('drop', (e) => {
  e.preventDefault();
  dragDepth = 0;
  $('dropzone').hidden = true;
  if (!screens.chat.hidden) [...e.dataTransfer.files].forEach(sendFile);
});

boot();
