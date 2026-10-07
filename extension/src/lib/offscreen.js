// Service-worker side of the offscreen document that hosts Boost's audio graph.
// Chrome allows one offscreen document per extension; offscreen modules register in offscreen.js.
import { request } from './messaging.js';
import { setBusy } from './busy.js';

const URL = 'src/offscreen/offscreen.html';

// One queue for every create/close/capture step so they can never interleave.
let queue = Promise.resolve();
export const exclusive = (fn) => (data) => {
  const run = queue.then(() => fn(data));
  queue = run.catch(() => {});
  return run;
};

export async function hasOffscreen() {
  const contexts = await chrome.runtime.getContexts({ contextTypes: ['OFFSCREEN_DOCUMENT'] });
  return contexts.length > 0;
}

export async function ensureOffscreen() {
  if (await hasOffscreen()) return;
  await chrome.offscreen.createDocument({
    url: URL,
    reasons: ['USER_MEDIA'],
    justification: 'Boosts captured tab audio after the popup closes.',
  });
}

export const toOffscreen = (type, data) => request('offscreen', type, data);

// Closes the document once nothing needs it, and updates the toolbar icon.
export async function settle() {
  const open = await hasOffscreen();
  const busy = open && !(await toOffscreen('core:idle'));
  if (open && !busy) await chrome.offscreen.closeDocument();
  await setBusy('boost', busy);
}
