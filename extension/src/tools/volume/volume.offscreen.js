import { request } from '../../lib/messaging.js';

let ctx;
const sessions = new Map(); // tabId -> { stream, nodes, gain, title }

async function capture({ tabId, streamId, gain, title }) {
  const stream = await navigator.mediaDevices.getUserMedia({
    audio: { mandatory: { chromeMediaSource: 'tab', chromeMediaSourceId: streamId } },
  });
  ctx ??= new AudioContext({ latencyHint: 'interactive' });
  if (ctx.state === 'suspended') ctx.resume();

  const source = ctx.createMediaStreamSource(stream);
  const amp = ctx.createGain();
  amp.gain.value = gain;
  // Brick-wall-ish limiter: only engages near 0 dBFS, keeps heavy boosts from hard clipping.
  const limiter = ctx.createDynamicsCompressor();
  limiter.threshold.value = -1;
  limiter.knee.value = 0;
  limiter.ratio.value = 20;
  limiter.attack.value = 0.002;
  limiter.release.value = 0.1;
  source.connect(amp).connect(limiter).connect(ctx.destination);

  stream.getAudioTracks()[0].addEventListener('ended', () => release({ tabId }));
  sessions.set(tabId, { stream, nodes: [source, amp, limiter], amp, gain, title });
}

function release({ tabId }) {
  const s = sessions.get(tabId);
  if (!s) return;
  sessions.delete(tabId);
  s.stream.getTracks().forEach((t) => t.stop());
  s.nodes.forEach((n) => n.disconnect());
  // Fire-and-forget: the worker may be awaiting our reply to 'stop' right now.
  request('background', 'volume:released', { tabId }).catch(() => {});
}

export default {
  id: 'volume',
  idle: () => sessions.size === 0,
  handlers: {
    capture,
    stop: release,
    gain({ tabId, gain }) {
      const s = sessions.get(tabId);
      if (!s) throw new Error('Tab is not boosted');
      s.gain = gain;
      s.amp.gain.setTargetAtTime(gain, ctx.currentTime, 0.02);
    },
    list: () => [...sessions].map(([tabId, s]) => ({ tabId, gain: s.gain, title: s.title })),
  },
};
