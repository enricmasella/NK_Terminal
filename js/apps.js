// apps.js - App registry, dock renderer and openApp dispatcher for NK_Desktop
import { el } from './core.js';
import { createWindow, reopen, focus, onFocus, getLayoutsData, setWindowGeo } from './wm.js';

const apps = new Map();

export function registerApp(def) {
  if (!def || !def.id) return;
  apps.set(def.id, def);
}

export function getApps() { return [...apps.values()]; }

export function getApp(id) { return apps.get(id); }

export function openApp(id, geo) {
  const def = apps.get(id);
  if (!def) return null;
  const existing = document.getElementById('win-' + id);
  if (existing) {
    if (geo) { existing.classList.remove('minimized'); setWindowGeo(existing, geo); focus(existing); return existing; }
    return reopen(id);
  }
  return createWindow({
    id: def.id,
    title: def.name,
    icon: def.icon,
    w: def.w,
    h: def.h,
    mount: def.mount,
    onClose: def.onClose,
    cls: def.cls || '',
    persist: !!def.persist,
    geo: geo || null
  });
}

export async function loadLayout(name) {
  const data = await getLayoutsData();
  const lay = data.layouts[name];
  if (!lay) return false;
  const ids = new Set(lay.order || Object.keys(lay.apps || {}));
  for (const w of [...document.querySelectorAll('.window')]) {
    const id = w.dataset.app;
    if (id && !ids.has(id)) {
      const closeB = w.querySelector('.wb-close');
      if (closeB) closeB.click();
    }
  }
  for (const id of lay.order || Object.keys(lay.apps || {})) {
    const g = lay.apps[id];
    if (!g) continue;
    const existing = document.getElementById('win-' + id);
    if (existing) {
      existing.classList.remove('minimized');
      setWindowGeo(existing, g);
      focus(existing);
    } else {
      openApp(id, g);
    }
  }
  return true;
}

export function dockActiveId(win) { return win ? win.dataset.app : null; }

export function setupDock() {
  const dock = document.getElementById('dock');
  if (!dock) return;
  const items = dock.querySelector('.dock-items');
  if (!items) return;
  apps.forEach(def => {
    const btn = el('button', 'dock-app', def.icon);
    btn.title = def.name;
    btn.dataset.id = def.id;
    btn.addEventListener('click', () => openApp(def.id));
    items.appendChild(btn);
  });
  onFocus(win => {
    for (const b of dock.querySelectorAll('.dock-app')) {
      b.classList.toggle('active', b.dataset.id === (win ? win.dataset.app : null));
    }
  });
}