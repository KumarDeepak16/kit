import { h } from '../../lib/dom.js';
import { icon, iconButton } from '../../lib/icons.js';
import * as store from './store.js';
import { generatePassword, randomChars, strength } from './crypto.js';
import { fillLogin } from './autofill.js';

const MIN_MASTER = 8;

function hostOf(value) {
  try {
    const u = new URL(value.includes('://') ? value : `https://${value}`);
    return /^https?:$/.test(u.protocol) ? u.hostname.replace(/^www\./, '') : '';
  } catch {
    return '';
  }
}

function hue(text) {
  let x = 7;
  for (const c of text.toLowerCase()) x = (x * 31 + c.codePointAt(0)) % 360;
  return x;
}

function busy(button, on) {
  button.disabled = on;
  button.classList.toggle('busy', on);
}

function shake(node) {
  node.classList.remove('shake');
  void node.offsetWidth; // restart the animation
  node.classList.add('shake');
}

function meter() {
  return h('div', { class: 'meter', 'data-score': 0, 'aria-hidden': 'true' }, h('i'), h('i'), h('i'), h('i'));
}

// Decoding effect: characters settle left to right into the final value.
function scramble(input, final) {
  let frame = 0;
  const frames = 14;
  const tick = () => {
    const fixed = Math.floor((frame / frames) * final.length);
    input.value = final.slice(0, fixed) + randomChars(final.length - fixed);
    if (frame++ < frames) requestAnimationFrame(tick);
    else {
      input.value = final;
      input.dispatchEvent(new Event('input'));
    }
  };
  tick();
}

function secret(input, { generate = false } = {}) {
  const reveal = (show) => {
    input.type = show ? 'text' : 'password';
    eye.replaceChildren(icon(show ? 'eyeOff' : 'eye'));
    eye.setAttribute('aria-label', show ? 'Hide password' : 'Show password');
  };
  const eye = iconButton('eye', 'Show password', () => reveal(input.type === 'password'), 'bare');
  const gen =
    generate &&
    iconButton('spark', 'Generate password', () => {
      reveal(true);
      scramble(input, generatePassword());
    }, 'bare');
  return h('div', { class: `secret${generate ? ' wide' : ''}` }, input, h('div', { class: 'secret-tools' }, gen, eye));
}

const field = (label, ...control) => h('label', { class: 'field' }, h('span', {}, label), ...control);

export default {
  id: 'vault',
  label: 'Vault',
  icon: 'vault',

  async mount(root, { tab, toast }) {
    const activeTab = await tab;
    const here = hostOf(activeTab?.url ?? '');
    let entries = [];
    let mode = '';
    let renderRows = () => {};
    let closeSheet = null;

    const show = (node) => {
      closeSheet?.();
      root.replaceChildren(node);
    };

    const onStorage = (changes, area) => {
      if (area === 'session' && store.SESSION_KEY in changes && !changes[store.SESSION_KEY].newValue) locked();
    };
    chrome.storage.onChanged.addListener(onStorage);

    const isHere = (e) => {
      const site = hostOf(e.site);
      return Boolean(here && site && (here === site || here.endsWith(`.${site}`)));
    };

    // File pickers close extension popups, so import runs in its own tab.
    const openImport = () => chrome.tabs.create({ url: chrome.runtime.getURL('src/pages/import.html') });

    // Fill the login form on the current page, then get out of the way.
    async function fill(e) {
      try {
        const [{ result } = {}] = await chrome.scripting.executeScript({
          target: { tabId: activeTab.id },
          func: fillLogin,
          args: [e.username, e.password, hostOf(e.site)],
        });
        if (result === 'filled' || result === 'user') {
          store.touch();
          return window.close();
        }
        toast(result === 'mismatch' ? 'This page is a different site' : 'No login form on this page', 'error');
      } catch {
        toast("Can't fill on this page", 'error');
      }
    }

    async function copy(text, message) {
      await navigator.clipboard.writeText(text);
      toast(message);
      store.touch();
    }

    function setup() {
      mode = 'setup';
      const pw = h('input', { type: 'password', placeholder: `Master password · ${MIN_MASTER}+ chars`, autocomplete: 'new-password', 'aria-label': 'Master password' });
      const again = h('input', { type: 'password', placeholder: 'Confirm password', autocomplete: 'new-password', 'aria-label': 'Confirm master password' });
      const bar = meter();
      const go = h('button', { class: 'btn primary', type: 'submit', disabled: true }, 'Create vault');
      const validate = () => {
        bar.dataset.score = strength(pw.value);
        go.disabled = pw.value.length < MIN_MASTER || pw.value !== again.value;
      };
      pw.addEventListener('input', validate);
      again.addEventListener('input', validate);

      const form = h(
        'form',
        {
          class: 'pane gate',
          onsubmit: async (e) => {
            e.preventDefault();
            if (go.disabled) return;
            busy(go, true);
            try {
              await store.create(pw.value);
              entries = [];
              list();
            } finally {
              busy(go, false);
            }
          },
        },
        h('div', { class: 'glyph' }, icon('vault')),
        h('h2', {}, 'Your private vault'),
        h('p', { class: 'hint' }, "Encrypted on this device only. The master password can't be recovered."),
        h('div', { class: 'stack' }, secret(pw), bar, secret(again)),
        go,
      );
      show(form);
      pw.focus();
    }

    function locked() {
      if (mode === 'locked') return;
      mode = 'locked';
      const pw = h('input', { type: 'password', placeholder: 'Master password', autocomplete: 'current-password', 'aria-label': 'Master password' });
      const submit = h('button', { class: 'btn primary square', type: 'submit', 'aria-label': 'Unlock' }, icon('arrow'));
      const form = h(
        'form',
        {
          class: 'pane gate',
          onsubmit: async (e) => {
            e.preventDefault();
            if (!pw.value) return;
            busy(submit, true);
            try {
              entries = await store.unlock(pw.value);
              list();
            } catch {
              shake(form);
              pw.select();
            } finally {
              busy(submit, false);
            }
          },
        },
        h('div', { class: 'glyph' }, icon('lock')),
        h('h2', {}, 'Vault locked'),
        h('div', { class: 'unlock' }, secret(pw), submit),
      );
      show(form);
      pw.focus();
    }

    function list() {
      mode = 'list';
      let query = '';
      let first = true;
      const rows = h('ul', { class: 'entries' });
      const search = h('input', {
        type: 'search',
        placeholder: 'Search',
        'aria-label': 'Search vault',
        oninput: () => {
          query = search.value.trim().toLowerCase();
          renderRows();
        },
      });

      renderRows = () => {
        const visible = entries
          .filter((e) => !query || e.site.toLowerCase().includes(query) || e.username.toLowerCase().includes(query))
          .sort((a, b) => isHere(b) - isHere(a) || a.site.localeCompare(b.site));
        if (!entries.length) {
          rows.replaceChildren(
            h('li', { class: 'empty' }, h('div', { class: 'glyph sm' }, icon('plus')), h('p', {}, 'No logins yet'),
              h('button', { class: 'btn primary', type: 'button', onclick: () => sheet() }, 'Add your first'),
              h('button', { class: 'btn', type: 'button', onclick: openImport }, 'Import from Chrome…')),
          );
        } else if (!visible.length) {
          rows.replaceChildren(h('li', { class: 'empty' }, h('p', {}, 'No matches')));
        } else {
          rows.replaceChildren(...visible.map((e, i) => row(e, first ? i : -1)));
        }
        first = false;
      };

      const row = (e, i) => {
        const hu = hue(e.site || '?');
        return h(
          'li',
          { class: `entry${isHere(e) ? ' here' : ''}`, style: i >= 0 ? `--i:${i}` : null },
          h(
            'button',
            { class: 'entry-main', type: 'button', onclick: () => sheet(e) },
            h('span', { class: 'mono', style: `--h:${hu}` }, (e.site.trim()[0] || '?').toUpperCase()),
            h('span', { class: 'entry-text' }, h('b', {}, e.site || 'Untitled'), h('small', {}, e.username || '—')),
          ),
          h(
            'div',
            { class: 'entry-actions' },
            isHere(e) && h('button', { class: 'btn fill', type: 'button', onclick: () => fill(e) }, 'Fill'),
            e.username && iconButton('user', 'Copy username', () => copy(e.username, 'Username copied'), 'sm'),
            iconButton('copy', 'Copy password', () => copy(e.password, 'Password copied'), 'sm accent'),
          ),
        );
      };

      show(
        h(
          'div',
          { class: 'pane list' },
          h(
            'div',
            { class: 'vault-top' },
            h('label', { class: 'search' }, icon('search'), search),
            iconButton('plus', 'Add login', () => sheet(), 'accent'),
            iconButton('upload', 'Import passwords', openImport),
            iconButton('lock', 'Lock vault', async () => {
              await store.lock();
              locked();
            }),
          ),
          rows,
        ),
      );
      renderRows();
    }

    function sheet(entry) {
      closeSheet?.();
      const isNew = !entry;
      const site = h('input', { value: entry?.site ?? here, placeholder: 'example.com', autocomplete: 'off', spellcheck: 'false' });
      const user = h('input', { value: entry?.username ?? '', placeholder: 'Username or email', autocomplete: 'off', spellcheck: 'false' });
      const pass = h('input', {
        type: 'password',
        value: entry?.password ?? '',
        placeholder: 'Password',
        autocomplete: 'new-password',
        spellcheck: 'false',
        oninput: () => (bar.dataset.score = strength(pass.value)),
      });
      const bar = meter();
      bar.dataset.score = strength(pass.value);
      const save = h('button', { class: 'btn primary grow', type: 'submit' }, isNew ? 'Save login' : 'Save changes');

      let armTimer;
      const delLabel = h('span', {}, 'Delete');
      const del =
        !isNew &&
        h('button', {
          class: 'btn danger',
          type: 'button',
          onclick: async () => {
            if (!del.classList.contains('armed')) {
              del.classList.add('armed');
              delLabel.textContent = 'Confirm';
              armTimer = setTimeout(() => {
                del.classList.remove('armed');
                delLabel.textContent = 'Delete';
              }, 2500);
              return;
            }
            clearTimeout(armTimer);
            const next = entries.filter((x) => x.id !== entry.id);
            try {
              await store.save(next);
            } catch {
              return locked();
            }
            entries = next;
            closeSheet();
            renderRows();
            toast('Deleted');
          },
        }, icon('trash'), delLabel);

      const form = h(
        'form',
        {
          class: 'sheet',
          onsubmit: async (e) => {
            e.preventDefault();
            site.classList.toggle('invalid', !site.value.trim());
            pass.classList.toggle('invalid', !pass.value);
            if (!site.value.trim() || !pass.value) return shake(form);
            const next = {
              id: entry?.id ?? crypto.randomUUID(),
              site: site.value.trim(),
              username: user.value.trim(),
              password: pass.value,
              updated: Date.now(),
            };
            const updated = isNew ? [...entries, next] : entries.map((x) => (x.id === next.id ? next : x));
            busy(save, true);
            try {
              await store.save(updated);
              entries = updated;
              closeSheet();
              renderRows();
              toast(isNew ? 'Login saved' : 'Changes saved');
            } catch {
              busy(save, false);
              locked();
            }
          },
        },
        h('div', { class: 'sheet-grip' }),
        h('div', { class: 'sheet-head' }, h('h3', {}, isNew ? 'New login' : entry.site), iconButton('close', 'Close', () => closeSheet(), 'sm')),
        field('Website', site),
        field('Username', user),
        field('Password', secret(pass, { generate: true }), bar),
        h('div', { class: 'sheet-foot' }, del, save),
      );
      const scrim = h('div', { class: 'scrim', onclick: () => closeSheet() });
      const onKey = (e) => {
        if (e.key !== 'Escape') return;
        e.preventDefault();
        closeSheet();
      };
      document.addEventListener('keydown', onKey);
      root.append(scrim, form);
      requestAnimationFrame(() => {
        scrim.classList.add('open');
        form.classList.add('open');
      });
      (isNew && site.value ? user : site).focus({ preventScroll: true });

      closeSheet = () => {
        closeSheet = null;
        clearTimeout(armTimer);
        document.removeEventListener('keydown', onKey);
        scrim.classList.remove('open');
        form.classList.remove('open');
        setTimeout(() => {
          scrim.remove();
          form.remove();
        }, 320);
      };
    }

    const state = await store.status();
    if (state === 'new') setup();
    else if (state === 'locked') locked();
    else {
      try {
        entries = await store.entries();
        list();
      } catch {
        await store.lock();
        locked();
      }
    }

    return () => {
      closeSheet?.();
      chrome.storage.onChanged.removeListener(onStorage);
    };
  },
};
