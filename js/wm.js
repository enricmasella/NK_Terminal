// wm.js - Window manager for NK_Desktop
import { el, uid, clamp, storageGet, storageSet } from './core.js';

const LAYOUT_KEY = '_winLayout';
const LAYOUTS_KEY = '_layouts';
const MIN_W = 320, MIN_H = 220;
const focusCbs = [];
let zTop = 10;
let hostEl = null;
let layoutCache = null;

function getHost() {
  if (!hostEl || !hostEl.isConnected) hostEl = document.getElementById('windows');
  return hostEl;
}

export function onFocus(cb) { focusCbs.push(cb); }

export function focus(win) {
  if (!win) return;
  if (win.classList.contains('minimized')) return;
  zTop = (zTop + 1) % 900000;
  win.style.zIndex = 10 + zTop;
  for (const w of document.querySelectorAll('.window')) w.classList.toggle('focused', w === win);
  focusCbs.forEach(cb => cb(win));
}

function persistLayout(id, rect, maximized) {
  if (!id) return;
  if (!layoutCache) layoutCache = {};
  layoutCache[id] = { x: rect.left, y: rect.top, w: rect.width, h: rect.height, max: !!maximized };
  chrome.storage.local.set({ [LAYOUT_KEY]: layoutCache }).catch(() => {});
}

async function readLayouts() {
  if (layoutCache) return layoutCache;
  const r = await storageGet([LAYOUT_KEY]);
  layoutCache = (r && r[LAYOUT_KEY]) || {};
  return layoutCache;
}

function pointerTrack(win, onMove, onUp) {
  const move = ev => { ev.preventDefault(); onMove(ev); };
  const up = ev => {
    removeEventListener('pointermove', move);
    removeEventListener('pointerup', up);
    if (onUp) onUp(ev);
  };
  addEventListener('pointermove', move);
  addEventListener('pointerup', up, { once: true });
}

function bindDrag(win, bar, id) {
  bar.addEventListener('pointerdown', e => {
    if (e.target.closest('.wb')) return;
    if (win.classList.contains('maximized')) return;
    e.preventDefault();
    focus(win);
    const r = win.getBoundingClientRect();
    const ox = e.clientX - r.left, oy = e.clientY - r.top;
    const raw = win.getBoundingClientRect();
    pointerTrack(win, ev => {
      win.style.left = clamp(ev.clientX - ox, -(raw.width - 90), innerWidth - 90) + 'px';
      win.style.top = clamp(ev.clientY - oy, 0, innerHeight - 90) + 'px';
    }, () => {
      const rr = win.getBoundingClientRect();
      persistLayout(id, rr, false);
    });
  });
}

function bindResize(win, handle, id) {
  handle.addEventListener('pointerdown', e => {
    if (win.classList.contains('maximized')) return;
    e.preventDefault();
    e.stopPropagation();
    focus(win);
    const r = win.getBoundingClientRect();
    pointerTrack(win, ev => {
      win.style.width = clamp(ev.clientX - r.left, MIN_W, innerWidth - 8) + 'px';
      win.style.height = clamp(ev.clientY - r.top, MIN_H, innerHeight - 60) + 'px';
    }, () => {
      const rr = win.getBoundingClientRect();
      persistLayout(id, rr, false);
    });
  });
}

export function setWindowGeo(win, g) {
  if (!win || !g) return;
  win.classList.remove('maximized');
  if (g.max) { win.classList.add('maximized'); return; }
  win.style.left = g.x + 'px';
  win.style.top = g.y + 'px';
  win.style.width = g.w + 'px';
  win.style.height = g.h + 'px';
}

export function captureLayout() {
  const apps = {};
  const order = [];
  for (const w of document.querySelectorAll('.window')) {
    const id = w.dataset.app;
    if (!id) continue;
    const r = w.getBoundingClientRect();
    const hidden = r.width < 2 && r.height < 2;
    apps[id] = {
      x: hidden ? parseInt(w.style.left, 10) || 0 : Math.round(r.left),
      y: hidden ? parseInt(w.style.top, 10) || 0 : Math.round(r.top),
      w: hidden ? parseInt(w.style.width, 10) || 320 : Math.round(r.width),
      h: hidden ? parseInt(w.style.height, 10) || 220 : Math.round(r.height),
      max: w.classList.contains('maximized')
    };
    order.push(id);
  }
  return { apps, order };
}

export async function getLayoutsData() {
  const r = await storageGet([LAYOUTS_KEY]);
  const d = (r && r[LAYOUTS_KEY]) || {};
  if (!d || typeof d !== 'object') return { layouts: {}, default: '' };
  if (!d.layouts) d.layouts = {};
  if (!d.default) d.default = '';
  return d;
}

async function writeLayoutsData(d) {
  await storageSet({ [LAYOUTS_KEY]: { layouts: d.layouts || {}, default: d.default || '' } });
}

export async function saveLayoutSnapshot(name) {
  const d = await getLayoutsData();
  d.layouts[name] = { ...captureLayout(), ts: Date.now() };
  await writeLayoutsData(d);
  return d;
}

export async function deleteLayout(name) {
  const d = await getLayoutsData();
  delete d.layouts[name];
  if (d.default === name) d.default = '';
  await writeLayoutsData(d);
  return d;
}

export async function setDefaultLayout(name) {
  const d = await getLayoutsData();
  if (d.layouts[name]) d.default = name;
  await writeLayoutsData(d);
  return d;
}

export async function getDefaultLayoutName() {
  const d = await getLayoutsData();
  return d.default && d.layouts[d.default] ? d.default : '';
}

async function applySaved(win, id, defW, defH, geo) {
  if (geo) { setWindowGeo(win, geo); return; }
  const saved = await readLayouts();
  const s = saved[id];
  const max = !!(s && s.max);
  if (max) {
    win.classList.add('maximized');
    return;
  }
  const w = (s && s.w) || defW, h = (s && s.h) || defH;
  const x = s ? s.x : clamp((innerWidth - w) / 2 - 24 + Math.random() * 48, 8, innerWidth - w - 8);
  const y = s ? s.y : clamp((innerHeight - h) / 2 - 24 + Math.random() * 48, 8, innerHeight - h - 8);
  win.style.width = w + 'px';
  win.style.height = h + 'px';
  win.style.left = x + 'px';
  win.style.top = y + 'px';
}

export function createWindow({ id = uid(), title = '', icon = '', w = 560, h = 420, mount = null, onClose = null, cls = '', persist = false, geo = null } = {}) {
  const win = el('div', 'window' + (cls ? ' ' + cls : ''));
  win.id = 'win-' + id;
  win.dataset.app = id;

  const bar = el('div', 'win-titlebar');
  if (icon) bar.appendChild(el('span', 'win-ic', icon));
  bar.appendChild(el('span', 'win-title', title));
  const btns = el('div', 'win-btns');
  const minB = el('button', 'wb', '\u2013'); minB.title = 'Minimizar';
  const maxB = el('button', 'wb', '\u25A1'); maxB.title = 'Maximizar';
  const closeB = el('button', 'wb wb-close', '\u2715'); closeB.title = 'Cerrar';
  btns.append(minB, maxB, closeB);
  bar.appendChild(btns);

  const body = el('div', 'win-body');
  const resize = el('div', 'win-resize'); resize.title = 'Redimensionar';
  win.append(bar, body, resize);

  getHost().appendChild(win);

  if (mount) mount(body, win);
  if (geo) applySaved(win, id, w, h, geo).then(() => focus(win));
  else applySaved(win, id, w, h).then(() => focus(win));

  bindDrag(win, bar, id);
  bindResize(win, resize, id);

  minB.addEventListener('click', () => { win.classList.add('minimized'); });
  maxB.addEventListener('click', () => {
    const isMax = win.classList.toggle('maximized');
    if (!isMax) applySaved(win, id, w, h).then(() => focus(win));
    else focus(win);
  });
  closeB.addEventListener('click', () => {
    if (persist) { win.classList.add('minimized'); return; }
    const r = win.getBoundingClientRect();
    persistLayout(id, r, win.classList.contains('maximized'));
    win.remove();
    if (onClose) onClose(win);
  });

  win.addEventListener('pointerdown', () => focus(win));
  return win;
}

export function reopen(id) {
  const win = document.getElementById('win-' + id);
  if (!win) return null;
  win.classList.remove('minimized');
  focus(win);
  return win;
}

export function winApi(id) {
  return {
    el: () => document.getElementById('win-' + id),
    isOpen() { const w = this.el(); return !!w && !w.classList.contains('minimized'); },
    isMinimized() { const w = this.el(); return !!w && w.classList.contains('minimized'); },
    close() { const w = this.el(); if (w) w.remove(); },
    focus() { const w = this.el(); if (w) focus(w); },
    body() {
      const w = this.el();
      return w ? w.querySelector('.win-body') : null;
    }
  };
}