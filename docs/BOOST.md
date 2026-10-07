# Boost

Turn a single tab up to **600%** — or below 100% to quiet it — without touching the rest of your browser.

## Using it

1. Open Kit on the tab that's too quiet. Boost is the first tool.
2. Change the level:
   - **drag** around the dial (it snaps gently to 100%),
   - **scroll** over it,
   - focus it and use the **arrow keys** (see the [keyboard table](README.md#keyboard)),
   - or tap a preset: **100 · 200 · 300 · 600**.
3. **⏻** stops boosting and gives the tab its normal audio back.

The number in the middle is the level; the small `dB` badge under it is the same thing in decibels. Colours follow the level: blue at or under 100%, orange when boosted, red above 300%.

## Several tabs at once

Every boosted tab shows up as a chip along the top, with its level. The first chip is always the tab you're on.

- **Tap a chip** and the dial, presets and ⏻ now control *that* tab — no need to switch to it.
- **Go to this tab** under the dial jumps there.
- Closing or reloading a tab ends its boost.

## Two engines

| | In-page (default) | Tab capture (opt-in) |
| --- | --- | --- |
| How | Routes the page's own `<video>`/`<audio>` through Web Audio | Captures the whole tab's sound and plays it back louder |
| Chrome's "sharing this tab" icon | **No** | Yes — Chrome always shows it for capture |
| Works on DRM players (Netflix, Prime, some Hotstar shows) | No | Yes |
| Survives a page reload | No (reopen Kit and boost again) | Yes |

Kit always starts with the in-page engine. If the page's player is protected (DRM) or its media comes from another site without permission, Kit **doesn't touch it** — hooking it would make it silent — and shows **Protected player · Use tab capture**. Choosing that switches only this tab to capture.

If you see **Click the video once, then boost**, the page hasn't been interacted with yet, so Chrome won't let audio processing start. Click the video (or anywhere on the page) and try again.

## Limits

- Chrome's own pages (`chrome://…`, the Web Store, the new tab page) can't be boosted — Chrome blocks every extension there.
- A built-in limiter keeps peaks below 0 dBFS so loud settings don't crackle. It's not magic: 600% on an already-loud track will sound squashed.
- Be kind to your ears and your speakers.

## Under the hood

- In-page: [`extension/src/tools/volume/page.js`](../extension/src/tools/volume/page.js) is injected with `chrome.scripting` (thanks to `activeTab`, only on tabs where you opened Kit). It adds one `GainNode` → limiter → speakers. Stopping sets the gain back to exactly 1.
- Capture: `chrome.tabCapture` stream → an offscreen document's Web Audio graph. The offscreen document closes as soon as no tab is captured.
