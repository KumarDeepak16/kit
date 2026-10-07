// In-page Boost engine, injected with chrome.scripting into the page (isolated world).
// Routes the page's own <video>/<audio> through Web Audio — no tab capture, so Chrome
// shows no "sharing this tab" indicator. Must be self-contained (it's serialized).
//
//   pageBoost(gain)        set the level (hooks media as it appears)
//   pageBoost(null)        report { active, gain }
//   pageBoost(1, true)     back to normal
//
// Media we must not touch: DRM (EME) and cross-origin files without CORS — Web Audio
// would turn them silent. Those are skipped and counted as `protected` so Kit can offer
// tab capture instead.
export async function pageBoost(gain, off = false) {
  const k = (globalThis.__kitBoost ??= { gain: 1, hooked: new WeakSet(), skipped: new WeakSet() });

  if (gain == null) return { ok: true, active: Boolean(k.ctx) && k.gain !== 1, gain: k.gain };

  if (off) {
    if (k.ctx) k.amp.gain.setTargetAtTime(1, k.ctx.currentTime, 0.03);
    k.gain = 1;
    return { ok: true, gain: 1 };
  }

  const safe = (el) => {
    if (el.mediaKeys) return false; // DRM
    const src = el.currentSrc || el.src;
    if (!src || /^(blob|data|mediastream):/.test(src)) return true;
    try {
      return new URL(src, location.href).origin === location.origin || el.crossOrigin != null;
    } catch {
      return false;
    }
  };

  if (!k.ctx) {
    const ctx = new AudioContext({ latencyHint: 'playback' });
    await ctx.resume().catch(() => {});
    if (ctx.state !== 'running') {
      // Hooking media into a suspended context would mute it — bail out untouched.
      ctx.close();
      return { ok: false, reason: 'suspended' };
    }
    k.ctx = ctx;
    k.amp = ctx.createGain();
    const limiter = ctx.createDynamicsCompressor();
    limiter.threshold.value = -1;
    limiter.knee.value = 0;
    limiter.ratio.value = 20;
    limiter.attack.value = 0.002;
    limiter.release.value = 0.1;
    k.amp.connect(limiter).connect(ctx.destination);

    k.hook = (el) => {
      if (k.hooked.has(el)) return;
      if (!safe(el)) return k.skipped.add(el);
      try {
        ctx.createMediaElementSource(el).connect(k.amp);
        k.hooked.add(el);
        k.skipped.delete(el);
      } catch {
        k.skipped.add(el);
      }
    };
    k.scan = () => document.querySelectorAll('video, audio').forEach(k.hook);
    // New players: catch them when they start, plus a light periodic sweep for SPA pages.
    document.addEventListener('play', (e) => e.target instanceof HTMLMediaElement && k.hook(e.target), true);
    let pending = 0;
    new MutationObserver(() => {
      if (!pending) pending = setTimeout(() => ((pending = 0), k.scan()), 800);
    }).observe(document.documentElement, { childList: true, subtree: true });
  }

  k.scan();
  k.gain = gain;
  k.amp.gain.setTargetAtTime(gain, k.ctx.currentTime, 0.03);
  const media = [...document.querySelectorAll('video, audio')];
  return {
    ok: true,
    gain,
    hooked: media.filter((el) => k.hooked.has(el)).length,
    protected: media.filter((el) => k.skipped.has(el)).length,
  };
}
