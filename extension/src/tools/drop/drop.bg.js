import { setBusy } from '../../lib/busy.js';

// Drop's server runs in the Kit helper (helper/kit-host.mjs), a native-messaging host:
// extensions can't open network ports themselves. An open native port also keeps this
// service worker alive, so the server lives exactly as long as Drop is on.
const HOST = 'in.1619.kit';
const KEY = 'drop.server';

let port = null;
let pending = null;

function settle(info) {
  return Promise.all([info ? chrome.storage.session.set({ [KEY]: info }) : chrome.storage.session.remove(KEY), setBusy('drop', Boolean(info))]);
}

function call(msg) {
  if (!port) {
    port = chrome.runtime.connectNative(HOST);
    port.onMessage.addListener((reply) => {
      if (reply.type === 'error') pending?.reject(new Error(reply.message));
      else pending?.resolve(reply);
      pending = null;
    });
    port.onDisconnect.addListener(() => {
      const reason = chrome.runtime.lastError?.message ?? '';
      port = null;
      settle(null);
      pending?.reject(new Error(/not found|forbidden/i.test(reason) ? 'helper-missing' : reason || 'The Kit helper stopped'));
      pending = null;
    });
  }
  return new Promise((resolve, reject) => {
    pending = { resolve, reject };
    port.postMessage(msg);
  });
}

export default {
  id: 'drop',

  init() {
    // A fresh worker means no native port, so any remembered server is gone.
    if (!port) settle(null);
  },

  handlers: {
    async start() {
      const { type, ...info } = await call({ cmd: 'start' });
      await settle(info);
      return info;
    },

    async stop() {
      if (port) {
        await call({ cmd: 'stop' }).catch(() => {});
        port?.disconnect();
        port = null;
      }
      await settle(null);
    },

    state: async () => (await chrome.storage.session.get(KEY))[KEY] ?? null,
  },
};
