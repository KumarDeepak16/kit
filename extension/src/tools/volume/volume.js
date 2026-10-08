import { h } from '../../lib/dom.js';
import { icon } from '../../lib/icons.js';
import { MAX_GAIN } from './config.js';

const SIZE = 220;
const C = SIZE / 2;
const R = 84;
const START = 135; // degrees clockwise from 3 o'clock
const SWEEP = 270;
const TICKS = 55; // 9 ticks per 100%
const STEP = 0.05;
const PRESETS = [1, 2, 3, 6];

const clamp = (v) => Math.min(MAX_GAIN, Math.max(0, v));
const round = (v) => Math.round(v / STEP) * STEP;
const tone = (v) => (v > 3 ? 'hot' : v > 1 ? 'boost' : 'base');
const point = (deg, r) => {
  const a = (deg * Math.PI) / 180;
  return [+(C + r * Math.cos(a)).toFixed(2), +(C + r * Math.sin(a)).toFixed(2)];
};

function arcPath(f) {
  const [x0, y0] = point(START, R);
  const [x1, y1] = point(START + SWEEP * f, R);
  return `M${x0} ${y0}A${R} ${R} 0 ${SWEEP * f > 180 ? 1 : 0} 1 ${x1} ${y1}`;
}

function dialMarkup() {
  const ticks = Array.from({ length: TICKS }, (_, i) => {
    const f = i / (TICKS - 1);
    const major = i % 9 === 0;
    const [x0, y0] = point(START + SWEEP * f, R + 13);
    const [x1, y1] = point(START + SWEEP * f, R + (major ? 22 : 17));
    return `<line class="tick${major ? ' major' : ''}" x1="${x0}" y1="${y0}" x2="${x1}" y2="${y1}"/>`;
  }).join('');
  return `<svg viewBox="0 0 ${SIZE} ${SIZE}" aria-hidden="true">
    <circle class="face-lip" cx="${C}" cy="${C + 5}" r="${R - 16}"/>
    <circle class="face" cx="${C}" cy="${C}" r="${R - 16}"/>
    <circle class="orbit" cx="${C}" cy="${C}" r="${R - 24}"/>
    <path class="track" d="${arcPath(1)}"/>
    <path class="arc" d=""/>
    ${ticks}
    <circle class="knob" r="8"/>
  </svg>`;
}

export default {
  id: 'volume',
  label: 'Boost',
  icon: 'volume',

  async mount(view, { send, tab: tabReady }) {
    const tab = await tabReady;
    // Unknown URL -> just try; a real capture failure blocks below.
    const capturable = Boolean(tab) && (!tab.url || /^(https?|file):/.test(tab.url));
    let sessions = await send('list'); // [{ tabId, gain, title, engine }] for every boosted tab
    let selected = tab?.id; // the tab the dial controls: this one, or any boosted tab
    let blockedHere = !capturable;
    let hint = null; // 'protected' | 'suspended' — why the in-page engine can't help right now
    let forceCapture = false;
    const session = (id) => sessions.find((s) => s.tabId === id);
    if (capturable && !session(tab.id)) {
      // The in-page engine survives SPA navigations; ask the page itself.
      const live = await send('get', { tabId: tab.id }).catch(() => null);
      if (live) sessions.push(live);
    }
    const isHere = () => selected === tab?.id;
    const blocked = () => isHere() && blockedHere;
    let value = session(selected)?.gain ?? 1;
    let raf = 0;
    let dragging = false;

    const num = h('b');
    const db = h('small');
    const dial = h('div', { class: 'dial', role: 'slider', 'aria-label': 'Tab volume', 'aria-valuemin': 0, 'aria-valuemax': MAX_GAIN * 100 });
    dial.innerHTML = dialMarkup();
    dial.append(h('div', { class: 'readout' }, h('div', {}, num, h('span', {}, '%')), db));
    const arc = dial.querySelector('.arc');
    const knob = dial.querySelector('.knob');
    const ticks = [...dial.querySelectorAll('.tick')];

    const strip = h('div', { class: 'strip', role: 'tablist', 'aria-label': 'Tabs' });
    const note = h('p', { class: 'note' });
    const chips = PRESETS.map((p) => h('button', { class: 'chip', type: 'button', onclick: () => glide(p) }, `${p * 100}`));
    const power = h('button', { class: 'chip power', type: 'button', 'aria-label': 'Stop boosting', title: 'Stop boosting', onclick: stop }, icon('power'));
    const root = h('div', { class: 'vol' }, strip, dial, note, h('div', { class: 'presets' }, ...chips, power));
    view.append(root);

    // ---------- painting ----------

    function paintValue(v = value) {
      const f = v / MAX_GAIN;
      arc.setAttribute('d', arcPath(f));
      const [kx, ky] = point(START + SWEEP * f, R);
      knob.setAttribute('cx', kx);
      knob.setAttribute('cy', ky);
      ticks.forEach((t, i) => t.classList.toggle('on', i / (TICKS - 1) <= f + 1e-9));
      const pct = Math.round(v * 100);
      num.textContent = pct;
      db.textContent = v === 0 ? '−∞ dB' : `${v >= 1 ? '+' : ''}${(20 * Math.log10(v)).toFixed(1)} dB`;
      dial.setAttribute('aria-valuenow', pct);
      dial.setAttribute('aria-valuetext', `${pct}%`);
      root.dataset.tone = tone(v);
      chips.forEach((c, i) => c.classList.toggle('on', Math.abs(PRESETS[i] - v) < 1e-6));
    }

    function paintState() {
      const live = Boolean(session(selected));
      root.classList.toggle('live', live);
      root.classList.toggle('blocked', blocked());
      dial.tabIndex = blocked() ? -1 : 0;
      chips.forEach((c) => (c.disabled = blocked()));
      power.disabled = !live;
      note.className = `note${blocked() ? ' bad' : ''}`;
      if (blocked()) note.replaceChildren("This page can't be boosted");
      else if (!isHere()) note.replaceChildren(h('button', { type: 'button', onclick: () => focusTab(selected) }, 'Go to this tab', icon('arrow')));
      else if (hint === 'protected' && !chrome.tabCapture) note.replaceChildren("Protected player — this browser can't boost it");
      else if (hint === 'protected')
        note.replaceChildren(
          'Protected player. ',
          h('button', { type: 'button', title: 'Chrome shows a "sharing this tab" icon while this is on', onclick: useCapture }, 'Use tab capture', icon('arrow')),
        );
      else if (hint === 'suspended') note.replaceChildren('Click the video once, then boost');
      else note.replaceChildren();
      paintStrip();
    }

    // This tab first, then every other boosted tab. Tapping one points the dial at it.
    function paintStrip() {
      const here = tab && { tabId: tab.id, title: tab.title || 'This tab', here: true };
      const list = [here, ...sessions.filter((s) => s.tabId !== tab?.id)].filter(Boolean);
      strip.replaceChildren(
        ...list.map((s) => {
          const live = session(s.tabId);
          return h(
            'button',
            {
              class: `tchip${s.tabId === selected ? ' on' : ''}${live ? ' live' : ''}`,
              type: 'button',
              role: 'tab',
              'aria-selected': String(s.tabId === selected),
              title: s.title,
              onclick: () => select(s.tabId),
            },
            h('i'),
            h('span', {}, s.title || 'Tab'),
            live && h('em', {}, `${Math.round(live.gain * 100)}%`),
          );
        }),
      );
      strip.querySelector('.on')?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
    }

    function tween(from, to) {
      cancelAnimationFrame(raf);
      const t0 = performance.now();
      const frame = (now) => {
        const k = Math.min(1, (now - t0) / 420);
        paintValue(from + (to - from) * (1 - (1 - k) ** 3));
        if (k < 1) raf = requestAnimationFrame(frame);
      };
      raf = requestAnimationFrame(frame);
    }

    // ---------- talking to the worker ----------

    // At most one request in flight; the latest value always wins.
    let inflight = false;
    let dirty = false;
    async function push() {
      dirty = true;
      if (inflight || blocked()) return;
      inflight = true;
      while (dirty) {
        dirty = false;
        const target = selected;
        const title = target === tab?.id ? tab.title : session(target)?.title;
        try {
          const result = await send('set', { tabId: target, gain: value, title, engine: forceCapture ? 'capture' : undefined });
          const s = session(target);
          if (s) s.gain = value;
          else sessions.push({ tabId: target, gain: value, title: title ?? '', engine: result.engine });
          hint = result.engine === 'page' && result.protected && !result.hooked ? 'protected' : null;
        } catch (err) {
          cancelAnimationFrame(raf);
          if (err.message === 'suspended') hint = 'suspended';
          else if (target === tab?.id) blockedHere = true;
          value = 1;
          paintValue();
        }
      }
      inflight = false;
      paintState();
    }

    function set(v) {
      if (blocked()) return;
      cancelAnimationFrame(raf);
      value = clamp(round(v));
      paintValue();
      push();
    }

    function glide(target) {
      if (blocked()) return;
      const from = value;
      value = target;
      push(); // the audio side ramps on its own; this only animates the dial
      tween(from, target);
    }

    function select(tabId) {
      if (tabId === selected) return;
      const from = value;
      selected = tabId;
      value = session(tabId)?.gain ?? 1;
      tween(from, value);
      paintState();
    }

    async function stop() {
      const target = selected;
      await send('stop', { tabId: target });
      sessions = sessions.filter((s) => s.tabId !== target);
      if (tab) selected = tab.id;
      const from = value;
      value = session(selected)?.gain ?? 1;
      tween(from, value);
      paintState();
    }

    // Opt-in fallback for DRM players: switch this tab to tab capture.
    async function useCapture() {
      const level = value;
      await send('stop', { tabId: tab.id });
      sessions = sessions.filter((s) => s.tabId !== tab.id);
      forceCapture = true;
      hint = null;
      value = level;
      push();
    }

    async function focusTab(tabId) {
      const t = await chrome.tabs.update(tabId, { active: true });
      await chrome.windows.update(t.windowId, { focused: true });
    }

    // ---------- input ----------

    function fromPointer(e, continuous) {
      const r = dial.getBoundingClientRect();
      const x = e.clientX - r.left - r.width / 2;
      const y = e.clientY - r.top - r.height / 2;
      if (!continuous && Math.hypot(x, y) < (R - 30) * (r.width / SIZE)) return false; // pressed on the readout
      let rel = ((Math.atan2(y, x) * 180) / Math.PI - START + 720) % 360;
      if (rel > SWEEP) rel = rel > SWEEP + (360 - SWEEP) / 2 ? 0 : SWEEP;
      let v = (rel / SWEEP) * MAX_GAIN;
      if (Math.abs(v - 1) < 0.12) v = 1; // magnetic 100%
      if (continuous && Math.abs(v - value) > MAX_GAIN / 3) return true; // ignore wrap across the gap
      set(v);
      return true;
    }

    dial.addEventListener('pointerdown', (e) => {
      if (blocked() || !fromPointer(e, false)) return;
      dragging = true;
      dial.setPointerCapture(e.pointerId);
      root.classList.add('dragging');
    });
    dial.addEventListener('pointermove', (e) => dragging && fromPointer(e, true));
    for (const type of ['pointerup', 'pointercancel']) {
      dial.addEventListener(type, () => {
        dragging = false;
        root.classList.remove('dragging');
      });
    }
    dial.addEventListener(
      'wheel',
      (e) => {
        e.preventDefault();
        set(value + (e.deltaY < 0 ? STEP : -STEP));
      },
      { passive: false },
    );
    dial.addEventListener('keydown', (e) => {
      const delta = { ArrowUp: STEP, ArrowRight: STEP, ArrowDown: -STEP, ArrowLeft: -STEP, PageUp: 0.5, PageDown: -0.5 }[e.key];
      if (delta != null) set(value + delta);
      else if (e.key === 'Home') set(0);
      else if (e.key === 'End') set(MAX_GAIN);
      else return;
      e.preventDefault();
    });

    paintValue();
    paintState();

    return () => cancelAnimationFrame(raf);
  },
};
