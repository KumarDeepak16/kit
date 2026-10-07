import { h } from '../lib/dom.js';
import { icon } from '../lib/icons.js';
import * as store from '../tools/vault/store.js';
import { merge, parseCsv, toEntries } from '../tools/vault/importer.js';

const card = document.getElementById('card');
const show = (...children) => card.replaceChildren(...children);
const SOURCES = ['Chrome', 'Edge', 'Firefox', 'Bitwarden', '1Password', 'LastPass'];

function locked() {
  const pw = h('input', { type: 'password', placeholder: 'Master password', autocomplete: 'current-password', 'aria-label': 'Master password' });
  const go = h('button', { class: 'btn primary', type: 'submit' }, 'Unlock');
  const form = h(
    'form',
    {
      class: 'stack',
      onsubmit: async (e) => {
        e.preventDefault();
        go.disabled = true;
        go.classList.add('busy');
        try {
          await store.unlock(pw.value);
          pick();
        } catch {
          form.classList.remove('shake');
          void form.offsetWidth;
          form.classList.add('shake');
          pw.select();
        } finally {
          go.disabled = false;
          go.classList.remove('busy');
        }
      },
    },
    pw,
    go,
  );
  show(h('div', { class: 'glyph' }, icon('lock')), h('h1', {}, 'Unlock your vault first'), form);
  pw.focus();
}

function pick() {
  const input = h('input', { type: 'file', accept: '.csv,text/csv', hidden: true, onchange: () => input.files[0] && read(input.files[0]) });
  const zone = h(
    'button',
    { class: 'dropzone', type: 'button', onclick: () => input.click() },
    h('span', { class: 'glyph sm' }, icon('upload')),
    h('b', {}, 'Drop a CSV file here'),
    h('small', {}, 'or click to choose one'),
  );
  zone.addEventListener('dragover', (e) => (e.preventDefault(), zone.classList.add('over')));
  zone.addEventListener('dragleave', () => zone.classList.remove('over'));
  zone.addEventListener('drop', (e) => {
    e.preventDefault();
    zone.classList.remove('over');
    const file = e.dataTransfer.files[0];
    if (file) read(file);
  });
  show(
    h('h1', {}, 'Import passwords'),
    h('p', { class: 'hint' }, 'Export a CSV from your old password manager, then drop it here.'),
    h('div', { class: 'chips' }, ...SOURCES.map((s) => h('span', {}, s))),
    zone,
    input,
    h(
      'details',
      { class: 'how' },
      h('summary', {}, 'How do I export from Chrome?'),
      h('p', {}, 'Open ', h('code', {}, 'chrome://password-manager/settings'), ', choose ', h('b', {}, 'Export passwords'), ', and save the file.'),
    ),
  );
}

async function read(file) {
  let entries;
  try {
    entries = toEntries(parseCsv(await file.text()));
  } catch (err) {
    return failed(err.message);
  }
  if (!entries.length) return failed('No logins found in that file.');
  const current = await store.entries();
  const { list, added, skipped } = merge(current, entries);
  const go = h(
    'button',
    {
      class: 'btn primary wide',
      type: 'button',
      disabled: !added,
      onclick: async () => {
        go.disabled = true;
        go.classList.add('busy');
        await store.save(list);
        done(added);
      },
    },
    added ? `Import ${added} login${added === 1 ? '' : 's'}` : 'Nothing new to import',
  );
  show(
    h('h1', {}, file.name),
    h(
      'div',
      { class: 'stats' },
      h('div', {}, h('b', {}, String(entries.length)), h('span', {}, 'found')),
      h('div', { class: 'new' }, h('b', {}, String(added)), h('span', {}, 'new')),
      h('div', {}, h('b', {}, String(skipped)), h('span', {}, 'already saved')),
    ),
    h(
      'ul',
      { class: 'preview' },
      ...entries.slice(0, 5).map((e) => h('li', {}, h('b', {}, e.site), h('small', {}, e.username || '—'))),
      entries.length > 5 && h('li', { class: 'more' }, `+ ${entries.length - 5} more`),
    ),
    go,
    h('button', { class: 'btn wide', type: 'button', onclick: pick }, 'Choose another file'),
  );
}

function done(added) {
  show(
    h('div', { class: 'glyph' }, icon('check')),
    h('h1', {}, `${added} login${added === 1 ? '' : 's'} imported`),
    h('div', { class: 'callout' }, h('b', {}, 'Delete the CSV file now.'), ' It holds your passwords in plain text — Kit has its own encrypted copy.'),
    h('button', { class: 'btn primary wide', type: 'button', onclick: () => window.close() }, 'Done'),
  );
}

function failed(message) {
  show(
    h('div', { class: 'glyph danger' }, icon('close')),
    h('h1', {}, "That didn't work"),
    h('p', { class: 'hint' }, message),
    h('button', { class: 'btn primary wide', type: 'button', onclick: pick }, 'Try another file'),
  );
}

const state = await store.status();
if (state === 'new') {
  show(h('h1', {}, 'Create your vault first'), h('p', { class: 'hint' }, 'Open Kit → Vault, set a master password, then come back here.'));
} else if (state === 'locked') locked();
else pick();
