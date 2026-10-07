import { ensureOffscreen, exclusive, hasOffscreen, settle, toOffscreen } from '../../lib/offscreen.js';
import { setBusy } from '../../lib/busy.js';
import { MAX_GAIN } from './config.js';
import { pageBoost } from './page.js';

// Two engines:
//   page    — default. Web Audio inside the page; no "sharing this tab" indicator.
//   capture — tab capture through the offscreen document. Works on DRM sites, but Chrome
//             always shows its sharing indicator, so it's only used when the user asks.
const PAGE = 'boost.page'; // { [tabId]: { gain, title } }

async function pageMap() {
  return (await chrome.storage.session.get(PAGE))[PAGE] ?? {};
}

async function savePageMap(map) {
  await chrome.storage.session.set({ [PAGE]: map });
  await setBusy('page', Object.keys(map).length > 0);
}

async function forgetPage(tabId) {
  const map = await pageMap();
  if (!(tabId in map)) return;
  delete map[tabId];
  await savePageMap(map);
}

const captured = async () => ((await hasOffscreen()) ? toOffscreen('volume:list') : []);

async function sessions() {
  const page = Object.entries(await pageMap()).map(([id, s]) => ({ tabId: Number(id), ...s, engine: 'page' }));
  return [...page, ...(await captured()).map((s) => ({ ...s, engine: 'capture' }))];
}

const inject = async (tabId, args) => (await chrome.scripting.executeScript({ target: { tabId }, func: pageBoost, args }))[0]?.result;

async function capture(tabId, gain, title) {
  if ((await captured()).some((s) => s.tabId === tabId)) return toOffscreen('volume:gain', { tabId, gain });
  // Allowed because opening the popup on this tab counts as invoking the extension.
  const streamId = await chrome.tabCapture.getMediaStreamId({ targetTabId: tabId });
  await ensureOffscreen();
  try {
    await toOffscreen('volume:capture', { tabId, streamId, gain, title });
  } finally {
    await settle();
  }
}

export default {
  id: 'volume',

  init() {
    chrome.tabs.onRemoved.addListener((tabId) => forgetPage(tabId));
    // A reload wipes the in-page engine; the popup re-checks the page itself, so SPA
    // navigations that keep it alive are picked up again on the next open.
    chrome.tabs.onUpdated.addListener((tabId, info) => info.status === 'loading' && forgetPage(tabId));
  },

  handlers: {
    list: () => sessions(),

    async get({ tabId }) {
      const known = (await sessions()).find((s) => s.tabId === tabId);
      if (known?.engine === 'capture') return known;
      const live = await inject(tabId, [null]).catch(() => null);
      if (!live?.active) return forgetPage(tabId).then(() => null);
      const map = await pageMap();
      map[tabId] = { gain: live.gain, title: known?.title ?? '' };
      await savePageMap(map);
      return { tabId, gain: live.gain, title: map[tabId].title, engine: 'page' };
    },

    set: exclusive(async ({ tabId, gain, title, engine }) => {
      if (!Number.isInteger(tabId) || !Number.isFinite(gain)) throw new Error('Invalid request');
      gain = Math.min(MAX_GAIN, Math.max(0, gain));
      title = String(title ?? '');
      const current = (await sessions()).find((s) => s.tabId === tabId);
      if ((current?.engine ?? engine) === 'capture') {
        await capture(tabId, gain, title);
        return { engine: 'capture' };
      }
      const result = await inject(tabId, [gain]);
      if (!result?.ok) throw new Error(result?.reason ?? 'blocked');
      const map = await pageMap();
      map[tabId] = { gain, title };
      await savePageMap(map);
      return { engine: 'page', hooked: result.hooked, protected: result.protected };
    }),

    stop: exclusive(async ({ tabId }) => {
      const map = await pageMap();
      if (tabId in map) {
        await inject(tabId, [1, true]).catch(() => {});
        await forgetPage(tabId);
      }
      if ((await captured()).some((s) => s.tabId === tabId)) await toOffscreen('volume:stop', { tabId });
    }),

    // Sent by the offscreen document whenever a capture ends (stopped, tab closed, navigation).
    released: exclusive(() => settle()),
  },
};
