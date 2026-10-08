import { h } from '../../lib/dom.js';
import { icon, iconButton } from '../../lib/icons.js';
import { qrSvg } from '../../lib/qr.js';

export function formatSize(n) {
  if (n < 1024) return `${n} B`;
  const units = ['KB', 'MB', 'GB'];
  let i = -1;
  do n /= 1024, i++;
  while (n >= 1024 && i < units.length - 1);
  return `${n < 10 ? n.toFixed(1) : Math.round(n)} ${units[i]}`;
}

export default {
  id: 'drop',
  label: 'Drop',
  icon: 'drop',

  async mount(root, { send, toast }) {
    // { port, ips, code, token, host } while the helper runs; anything else counts as off.
    const running = (s) => (s?.port && s?.token ? s : null);
    let info = running(await send('state'));
    let snap = null; // live { items, devices } from the helper
    let events = null;
    let ipIndex = 0;
    let showQr = false;
    let needsSetup = false;
    let mode = '';
    let live = null; // { list, nodes }

    const base = () => `http://127.0.0.1:${info.port}`;
    const authed = (path) => `${base()}${path}${path.includes('?') ? '&' : '?'}t=${info.token}`;
    const joinUrl = () => `http://${info.ips[ipIndex] ?? '127.0.0.1'}:${info.port}/k/${info.code}`;
    async function api(path, options) {
      const res = await fetch(authed(path), options);
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? 'Request failed');
      return res.json();
    }

    function connect() {
      events?.close();
      events = snap = null;
      if (!info) return;
      events = new EventSource(authed('/api/events'));
      events.onmessage = (e) => {
        snap = JSON.parse(e.data);
        render();
      };
    }

    const onStorage = (changes, area) => {
      if (area !== 'session' || !('drop.server' in changes)) return;
      info = running(changes['drop.server'].newValue);
      connect();
      render();
    };
    chrome.storage.onChanged.addListener(onStorage);

    async function turnOn(button) {
      button.disabled = true;
      button.classList.add('busy');
      try {
        info = running(await send('start'));
        if (!info) throw new Error('The Kit helper did not start');
        needsSetup = false;
        connect();
      } catch (err) {
        if (err.message === 'helper-missing') needsSetup = true;
        else toast(err.message, 'error');
      }
      render();
    }

    const turnOff = () => send('stop');
    const openTab = () => chrome.tabs.create({ url: `${base()}/a/${info.token}` });

    // ---------- views ----------

    function offView() {
      const on = h('button', { class: 'btn primary blue wide', type: 'button', onclick: () => turnOn(on) }, 'Turn on');
      return h(
        'div',
        { class: 'pane gate drop-off' },
        h('div', { class: 'devices', 'aria-hidden': 'true' }, h('span', { class: 'dev laptop' }, icon('laptop')), h('i'), h('i'), h('i'), h('span', { class: 'dev phone' }, icon('phone'))),
        h('h2', {}, 'Drop between devices'),
        h('p', { class: 'hint' }, 'Phones and laptops on your Wi-Fi. No app, no chat, no cloud.'),
        on,
      );
    }

    function setupView() {
      const retry = h('button', { class: 'btn primary blue wide', type: 'button', onclick: () => turnOn(retry) }, "Done — turn on");
      return h(
        'div',
        { class: 'pane gate setup' },
        h('h2', {}, 'One-time setup'),
        h('p', { class: 'hint' }, 'Drop runs a tiny server on this computer. Your browser needs a helper for that.'),
        h(
          'ol',
          { class: 'steps' },
          h('li', {}, 'Open the Kit folder → ', h('b', {}, 'helper')),
          h('li', {}, 'Double-click ', h('code', {}, 'install.cmd'), h('small', {}, 'Mac / Linux: sh install.sh')),
          h('li', {}, 'Come back and turn Drop on'),
        ),
        h('p', { class: 'fine' }, 'Needs Node.js 18+ (nodejs.org)'),
        retry,
      );
    }

    function head() {
      const names = snap?.devices.map((d) => d.name) ?? [];
      return h(
        'div',
        { class: 'drop-head' },
        h('span', { class: `pill ${names.length ? 'ok' : 'wait'}`, title: names.join(', ') }, h('i'), names.length ? names.join(', ') : 'Waiting for devices'),
        mode === 'live' && iconButton('qr', 'Show QR code', () => ((showQr = true), render()), 'sm'),
        mode === 'qr' && Boolean(snap?.items.length || names.length) && iconButton('close', 'Hide QR code', () => ((showQr = false), render()), 'sm'),
        iconButton('expand', 'Full screen (opens a tab)', openTab, 'sm'),
        iconButton('power', 'Turn off Drop', turnOff, 'sm danger'),
      );
    }

    function qrView() {
      const address = info.ips.length ? `${info.ips[ipIndex]}:${info.port}` : null;
      return h(
        'div',
        { class: 'pane drop-qr' },
        head(),
        address ? h('div', { class: 'qr-card', html: qrSvg(joinUrl()) }) : h('div', { class: 'qr-card empty-net' }, icon('close'), h('b', {}, 'No Wi-Fi network found')),
        h('p', { class: 'qr-hint' }, 'Scan with your phone camera'),
        address &&
          h(
            'div',
            { class: 'join' },
            h('button', { class: 'join-addr', type: 'button', title: 'Copy link', onclick: () => copy(joinUrl(), 'Link copied') }, h('span', {}, address)),
            h('span', { class: 'join-code', title: 'Join code' }, ...info.code.split('').map((c) => h('b', {}, c))),
          ),
        info.ips.length > 1 &&
          h('button', { class: 'net-switch', type: 'button', onclick: () => ((ipIndex = (ipIndex + 1) % info.ips.length), render()) }, `Wrong network? Try ${info.ips[(ipIndex + 1) % info.ips.length]}`),
      );
    }

    async function copy(value, message = 'Copied') {
      await navigator.clipboard.writeText(value);
      toast(message);
    }

    function itemNode(item) {
      const mine = item.from.id === 'host';
      const del = iconButton('trash', 'Delete', () => api(`/api/items/${item.id}`, { method: 'DELETE' }).catch((e) => toast(e.message, 'error')), 'sm ghost');
      const who = !mine && h('span', { class: 'who' }, item.from.name);
      if (item.kind === 'text') {
        const body = h('p', { class: 'clamp' }, item.body);
        const node = h(
          'li',
          { class: `msg ${mine ? 'me' : 'them'}` },
          who,
          body,
          h('div', { class: 'msg-tools' }, iconButton('copy', 'Copy', () => copy(item.body), 'sm ghost'), del),
        );
        // Fold long pastes; measured once the node is in the list.
        requestAnimationFrame(() => {
          if (body.scrollHeight <= body.clientHeight + 4) return body.classList.remove('clamp');
          const more = h('button', { class: 'more', type: 'button' }, 'Show more');
          more.onclick = () => (more.textContent = body.classList.toggle('clamp') ? 'Show more' : 'Show less');
          body.after(more);
        });
        return node;
      }
      const href = authed(`/api/files/${item.id}`);
      const image = /^image\/(png|jpe?g|gif|webp|avif)$/.test(item.type);
      return h(
        'li',
        { class: `msg file ${mine ? 'me' : 'them'}` },
        who,
        image && h('img', { class: 'thumb', src: authed(`/api/files/${item.id}?inline`), alt: item.name, loading: 'lazy', title: 'Open', onclick: () => viewImage(item) }),
        h('div', { class: 'file-row' }, h('span', { class: 'file-ico' }, icon('file')), h('div', { class: 'file-text' }, h('b', {}, item.name), h('small', {}, formatSize(item.size)))),
        h('div', { class: 'msg-tools' }, h('a', { class: 'icon-btn sm ghost', href, download: item.name, title: 'Download', 'aria-label': 'Download' }, icon('download')), del),
      );
    }

    // Full-size image with Copy (clipboards reliably take PNG, so convert) and Save.
    function viewImage(item) {
      const src = authed(`/api/files/${item.id}?inline`);
      const close = () => {
        overlay.classList.remove('open');
        setTimeout(() => overlay.remove(), 200);
      };
      const copyImage = async () => {
        try {
          let blob = await (await fetch(src)).blob();
          if (blob.type !== 'image/png') {
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
      };
      const overlay = h(
        'div',
        { class: 'viewer', onclick: (e) => e.target === overlay && close() },
        h('img', { src, alt: item.name }),
        h(
          'div',
          { class: 'viewer-bar' },
          h('button', { class: 'btn primary blue', type: 'button', onclick: copyImage }, icon('copy'), 'Copy'),
          h('a', { class: 'btn', href: authed(`/api/files/${item.id}`), download: item.name }, icon('download'), 'Save'),
          iconButton('close', 'Close', close),
        ),
      );
      document.body.append(overlay);
      requestAnimationFrame(() => overlay.classList.add('open'));
    }

    async function upload(files) {
      for (const file of files) {
        toast(`Sending ${file.name}…`);
        try {
          await api('/api/files', { method: 'POST', headers: { 'x-kit-name': encodeURIComponent(file.name), 'x-kit-type': file.type }, body: file });
        } catch (err) {
          toast(err.message, 'error');
        }
      }
    }

    function liveView() {
      const list = h('ul', { class: 'thread' });
      const input = h('textarea', { rows: 1, placeholder: 'Type or paste…', 'aria-label': 'Message' });
      const submit = () => {
        const body = input.value.trim();
        if (!body) return;
        api('/api/text', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ body }) }).catch((e) => toast(e.message, 'error'));
        input.value = '';
        input.style.height = '';
      };
      input.addEventListener('input', () => {
        input.style.height = '';
        input.style.height = `${Math.min(input.scrollHeight, 96)}px`;
      });
      input.addEventListener('keydown', (e) => {
        if (e.key !== 'Enter' || e.shiftKey) return;
        e.preventDefault();
        submit();
      });
      input.addEventListener('paste', (e) => {
        const files = [...e.clipboardData.files];
        if (files.length) e.preventDefault(), upload(files);
      });
      const pane = h(
        'div',
        { class: 'pane drop-live' },
        head(),
        list,
        h(
          'div',
          { class: 'composer' },
          // File pickers close extension popups — the full view in a tab handles files.
          iconButton('attach', 'Send files (opens a tab — or drag files here)', openTab),
          input,
          h('button', { class: 'btn primary blue square', type: 'button', 'aria-label': 'Send', onclick: submit }, icon('send')),
        ),
      );
      pane.addEventListener('dragover', (e) => (e.preventDefault(), pane.classList.add('dragging')));
      pane.addEventListener('dragleave', (e) => e.target === pane && pane.classList.remove('dragging'));
      pane.addEventListener('drop', (e) => {
        e.preventDefault();
        pane.classList.remove('dragging');
        upload([...e.dataTransfer.files]);
      });
      live = { list, nodes: new Map(), input, pane };
      return pane;
    }

    // Keyed update keeps hover, selection and scroll while messages stream in.
    function syncThread() {
      const { list, nodes, pane } = live;
      pane.querySelector('.drop-head').replaceWith(head());
      const ids = new Set(snap.items.map((i) => i.id));
      for (const [id, node] of nodes) if (!ids.has(id)) node.remove(), nodes.delete(id);
      let added = false;
      for (const item of snap.items) {
        if (nodes.has(item.id)) continue;
        const node = itemNode(item);
        nodes.set(item.id, node);
        list.append(node);
        added = true;
      }
      if (!snap.items.length && !list.querySelector('.empty')) list.append(h('li', { class: 'empty' }, h('p', {}, 'Send something — it shows up on every connected device.')));
      else if (snap.items.length) list.querySelector('.empty')?.remove();
      if (added) list.scrollTop = list.scrollHeight;
    }

    function render() {
      const next = !info ? (needsSetup ? 'setup' : 'off') : !snap ? 'qr' : showQr || (!snap.items.length && !snap.devices.length) ? 'qr' : 'live';
      if (next === 'live' && mode === 'live') return syncThread();
      mode = next;
      root.replaceChildren(next === 'off' ? offView() : next === 'setup' ? setupView() : next === 'qr' ? qrView() : liveView());
      if (next === 'live') {
        syncThread();
        live.input.focus();
      }
    }

    connect();
    render();
    return () => {
      document.querySelector('.viewer')?.remove();
      events?.close();
      chrome.storage.onChanged.removeListener(onStorage);
    };
  },
};
