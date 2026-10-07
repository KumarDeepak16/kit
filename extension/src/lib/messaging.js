// Message bus shared by the service worker, popup and offscreen document.
// Every message is { target, type: '<tool>:<action>', data } and every reply is
// { ok, result } or { ok: false, error }, so callers can simply await request().

export function serve(target, handlers) {
  chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    if (msg?.target !== target) return false;
    const handler = handlers[msg.type];
    if (!handler) return false;
    Promise.resolve()
      .then(() => handler(msg.data ?? {}, sender))
      .then(
        (result) => sendResponse({ ok: true, result }),
        (err) => sendResponse({ ok: false, error: err?.message ?? String(err) }),
      );
    return true;
  });
}

export async function request(target, type, data) {
  const res = await chrome.runtime.sendMessage({ target, type, data });
  if (!res) throw new Error(`No handler for ${type}`);
  if (!res.ok) throw new Error(res.error);
  return res.result;
}

// Flattens [{ id, handlers: { action } }] into { 'id:action': handler }.
export function namespaced(modules) {
  return Object.fromEntries(
    modules.flatMap((m) => Object.entries(m.handlers ?? {}).map(([action, fn]) => [`${m.id}:${action}`, fn])),
  );
}
