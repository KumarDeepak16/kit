// Toolbar icon: the awake buddy while any tool is doing something, the sleeping one otherwise.
// Flags live in session storage so a restarted service worker still knows.
const KEY = 'busy';
const paths = (state) => Object.fromEntries([16, 32, 48, 128].map((s) => [s, `/icons/${state}/${s}.png`]));

let queue = Promise.resolve();
export function setBusy(tool, on) {
  queue = queue.then(async () => {
    const { [KEY]: flags = {} } = await chrome.storage.session.get(KEY);
    flags[tool] = on;
    await chrome.storage.session.set({ [KEY]: flags });
    await chrome.action.setIcon({ path: paths(Object.values(flags).some(Boolean) ? 'on' : 'off') });
  });
  return queue;
}
