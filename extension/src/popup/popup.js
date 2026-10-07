import tools from '../tools/index.js';
import { request } from '../lib/messaging.js';
import { h } from '../lib/dom.js';
import { icon } from '../lib/icons.js';

const nav = document.getElementById('nav');
const stage = document.getElementById('stage');
const toastEl = document.getElementById('toast');
const tab = chrome.tabs.query({ active: true, currentWindow: true }).then(([t]) => t);

let toastTimer;
function toast(text, kind = 'ok') {
  toastEl.replaceChildren(icon(kind === 'error' ? 'close' : 'check'), text);
  toastEl.className = `toast show ${kind}`;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toastEl.classList.remove('show'), 1800);
}

let cleanup = null;
let seq = 0;
let current = null;

async function open(id) {
  const index = Math.max(0, tools.findIndex((t) => t.id === id));
  const tool = tools[index];
  if (tool === current) return;
  const from = tools.indexOf(current);
  current = tool;
  const token = ++seq;
  cleanup?.();
  cleanup = null;
  document.body.dataset.tool = tool.id;
  // The buddy glances toward the tool you picked.
  document.body.style.setProperty('--look', tools.length > 1 ? (index / (tools.length - 1)) * 2 - 1 : 0);
  [...nav.children].forEach((b, i) => b.setAttribute('aria-selected', String(i === index)));
  chrome.storage.local.set({ 'shell.tool': tool.id });

  const direction = from < 0 ? '' : index > from ? ' from-right' : ' from-left';
  const view = h('section', { class: `view${direction}`, role: 'tabpanel', 'aria-label': tool.label });
  stage.replaceChildren(view);
  const ctx = { tab, toast, send: (type, data) => request('background', `${tool.id}:${type}`, data) };
  const dispose = await tool.mount(view, ctx);
  if (token === seq) cleanup = dispose ?? null;
  else dispose?.();
}

nav.append(
  ...tools.map((tool) =>
    h(
      'button',
      { type: 'button', role: 'tab', 'aria-selected': 'false', 'aria-label': tool.label, title: tool.label, 'data-tool': tool.id, onclick: () => open(tool.id) },
      icon(tool.icon),
      h('span', { class: 'label' }, tool.label),
    ),
  ),
);

const { 'shell.tool': last } = await chrome.storage.local.get('shell.tool');
open(last);
