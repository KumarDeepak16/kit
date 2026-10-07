# Architecture

Kit is a Manifest V3 extension written as plain ES modules — no bundler, no framework, no build step. What you load in `chrome://extensions` is exactly what's in `extension/`.

```
extension/
  manifest.json          permissions, CSP, fixed extension ID (key)
  src/
    background.js        service worker: runs each tool's init(), routes messages
    popup/               the shell — header, tool switcher, toasts
    offscreen/           offscreen document (Boost's tab-capture audio graph)
    pages/import.html    full-page views (Vault import)
    lib/                 messaging, DOM builder, icons, QR, busy-icon, offscreen manager
    tools/
      index.js           popup tools, in switcher order
      background.js      worker-side tool modules
      volume/            Boost
      vault/             Vault
      drop/              Drop (talks to the helper)
  icons/on, icons/off    the awake / sleeping buddy
  fonts/, vendor/        Nunito, Geist Mono, uqr (QR encoder)
helper/
  kit-host.mjs           native-messaging host + LAN HTTP server for Drop
  public/                web app served to devices
  install.*              registers the host with Chromium browsers
```

## Messages

Every message is `{ target, type: '<tool>:<action>', data }`; every reply is `{ ok, result }` or `{ ok: false, error }`. `serve(target, handlers)` and `request(target, type, data)` in [`lib/messaging.js`](../extension/src/lib/messaging.js) wrap that, so callers just `await`.

| Target | Lives in | Example |
| --- | --- | --- |
| `background` | service worker | `volume:set`, `drop:start` |
| `offscreen` | offscreen document | `volume:capture`, `core:idle` |
| `popup` | the open popup | (state pushes, when a tool needs them) |

## A tool

A tool is a folder in `src/tools/<id>/` with up to three modules:

| Module | Shape | Registered in |
| --- | --- | --- |
| `<id>.js` (UI) | `{ id, label, icon, mount(view, ctx) → cleanup? }` | `tools/index.js` |
| `<id>.bg.js` (worker) | `{ id, init?(), handlers?: { action(data, sender) } }` | `tools/background.js` |
| `<id>.offscreen.js` | `{ id, idle(), handlers }` | `offscreen/offscreen.js` |

`mount` receives:

```js
ctx = {
  tab,     // Promise<chrome.tabs.Tab> — the tab the popup was opened on
  send,    // (action, data) => Promise — calls this tool's worker handlers
  toast,   // (text, 'ok' | 'error') => void
}
```

Return a cleanup function if you start timers, listeners or streams — the shell calls it when the user switches tools.

### Adding one

1. `src/tools/notes/notes.js` exporting `{ id: 'notes', label: 'Notes', icon: 'file', mount }`.
2. Add it to `src/tools/index.js`. It appears in the header switcher.
3. Need the worker? Add `notes.bg.js` and list it in `src/tools/background.js`; call it with `ctx.send('save', …)`.
4. Running something in the background? Call `setBusy('notes', true/false)` from [`lib/busy.js`](../extension/src/lib/busy.js) so the buddy wakes up.
5. Style it in `popup.css` using the existing tokens (`--accent` follows `body[data-tool]`).

## Lifetimes

| Thing | Starts | Ends |
| --- | --- | --- |
| In-page Boost | first boost on a tab | tab reload / close, or ⏻ (gain back to 1) |
| Offscreen document | first tab capture | last capture stops (`settle()` closes it) |
| Vault key in memory | unlock | lock button, 15-min alarm, screen lock, browser exit |
| Kit helper process | Drop → Turn on | Drop → off, Chrome closes, or the worker's native port disconnects |
| Drop files | upload | delete, Drop off, or helper exit (temp folder removed) |

## Security notes

- Extension pages run under `script-src 'self'; object-src 'none'; connect-src http://127.0.0.1:*` — nothing can be fetched from the internet.
- No content scripts and no host permissions: page access comes only from `activeTab` after you open Kit on that tab.
- User text is always inserted as text nodes (`h()` never parses user data as HTML).
- The helper accepts state-changing requests only from its own page or the extension origin, uses constant-time token comparison, rate-limits join codes, and confines static files to `helper/public/`.

## Releases

Pushing a tag `vX.Y.Z` runs [`.github/workflows/release.yml`](../.github/workflows/release.yml). It checks the tag matches `extension/manifest.json`, zips `extension/`, `helper/`, `README.md` and `LICENSE` as `kit.zip`, and attaches it to a GitHub Release. The website's download links point to `releases/latest/download/kit.zip`.
