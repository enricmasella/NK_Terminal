/* ── core.js ──────────────────────────────────────────────
   Shared primitives used by every module: DOM output helpers,
   storage/background messaging, settings, date & system info.
   ──────────────────────────────────────────────────────── */

export const term = document.getElementById('term');
export const inp = document.getElementById('inp');
export const linksEl = document.getElementById('links');

export async function bgFetch(url, opts) {
  const res = await chrome.runtime.sendMessage({ type: 'fetch', url, options: opts });
  if (!res) throw new Error('no response from background');
  if (!res.ok) {
    const snip = typeof res.body === 'string' ? res.body.slice(0, 160).replace(/\s+/g, ' ').trim() : '';
    throw new Error('HTTP-' + res.status + (snip ? ' — ' + snip : ''));
  }
  return res.body;
}

export async function storageGet(keys) {
  const r = await chrome.runtime.sendMessage({ type: 'storageGet', keys });
  return r || {};
}
export async function storageSet(data) {
  await chrome.runtime.sendMessage({ type: 'storageSet', data });
}

export function $(t, c) {
  const d = document.createElement('div');
  d.className = 'l' + (c ? ' ' + c : '');
  d.textContent = t;
  term.appendChild(d);
  return d;
}
export async function $$(t, c, dl) {
  const d = document.createElement('div');
  d.className = 'l' + (c ? ' ' + c : '');
  term.appendChild(d);
  for (let i = 0; i < t.length; i++) {
    d.textContent = t.substring(0, i + 1);
    await new Promise(r => setTimeout(r, dl || 12));
  }
  return d;
}
/* Render a block of text as its own element, preserving newlines (used by AI replies, notes, etc.) */
export function $block(t, c) {
  const d = document.createElement('div');
  d.className = 'l block' + (c ? ' ' + c : '');
  d.textContent = t;
  term.appendChild(d);
  return d;
}
export function sep() { $('\u2500'.repeat(50), 's'); }
export function scroll() { term.scrollTop = term.scrollHeight; }
export function p(fn) { return new Promise(r => fn(r)); }

export function fd(d) { return d.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }); }
export function ft(d) { return d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: settings.hour12 }); }
export function os() { const u = navigator.userAgent; if (u.includes('Windows')) return 'Windows'; if (u.includes('Mac')) return 'macOS'; if (u.includes('Linux')) return 'Linux'; return 'Unknown'; }
export function browserName() { const u = navigator.userAgent; if (u.includes('OPR') || u.includes('Opera')) return 'Opera'; if (u.includes('Edg')) return 'Edge'; if (u.includes('Chrome')) return 'Chrome'; if (u.includes('Firefox')) return 'Firefox'; if (u.includes('Safari')) return 'Safari'; return 'Unknown'; }
export function ramInfo() { const m = navigator.deviceMemory; return m ? m + ' GB' : '?'; }
export function coresInfo() { const c = navigator.hardwareConcurrency; return c ? c + ' cores' : '?'; }
export function connInfo() { const c = navigator.connection; return c ? c.effectiveType : '?'; }

export function openLink(url, name) {
  $('  opening ' + name + '...', 'd');
  scroll();
  try {
    chrome.tabs.create({ url, active: true });
    setTimeout(() => { $('  ' + name + ' opened successfully', 'r'); scroll(); }, 200);
  } catch (e) {
    const w = window.open(url, '_blank');
    setTimeout(() => {
      if (w) $('  ' + name + ' opened successfully', 'r');
      else $('  failed to open ' + name, 'd');
      scroll();
    }, 200);
  }
}

/* ── Settings ── */
export const THEMES = ['dark', 'green', 'amber', 'light', 'matrix', 'nord', 'dracula', 'solarized', 'synthwave'];
export const DEFAULT_SETTINGS = {
  theme: 'dark', font: 'courier', fontSize: 16,
  greeting: '', showWeather: true, showSystem: true, hour12: true,
  scanlines: false, bootAnim: true,
  // AI provider config; aiModel empty = provider default model
  aiProvider: '', aiModel: '', aiBaseUrl: '',
  // custom desktop wallpaper: '' = aurora. Value = image URL / data URI / CSS gradient.
  wallpaper: '', wallpaperBlur: 0, wallpaperDim: 0,
  // per-part custom colors ('' = use theme value)
  customColors: { accent: '', text: '', bg: '' },
  // desktop clock widget
  clockSize: 44, clockColor: '',
  // quick-link icon theme/shape: '' | mono | rainbow | transparent / circle | rounded | square
  iconTheme: '', iconShape: 'circle'
};
export const SETTINGS_KEY = '_st';
export let settings = { ...DEFAULT_SETTINGS };

export async function loadSettings() {
  const d = await storageGet([SETTINGS_KEY]);
  if (d[SETTINGS_KEY]) Object.assign(settings, DEFAULT_SETTINGS, d[SETTINGS_KEY]);
}
export async function saveSettings() {
  await storageSet({ [SETTINGS_KEY]: settings });
}
export function applySettings() {
  const b = document.body;
  const keep = b.classList.contains('boot-done');
  b.className = 'theme-' + settings.theme;
  if (keep) b.classList.add('boot-done');
  b.classList.add('font-' + settings.font);
  b.classList.toggle('scanlines', !!settings.scanlines);
  b.style.fontSize = settings.fontSize + 'px';
  applyWallpaper(b);
  applyCustomColors(b);
  applyClock(b);
}

function applyClock(b) {
  const t = document.getElementById('desktop-time');
  if (!t) return;
  const sz = clamp(parseInt(settings.clockSize, 10) || 44, 16, 160);
  t.style.fontSize = sz + 'px';
  if (settings.clockColor) t.style.color = settings.clockColor;
  else t.style.removeProperty('color');
  const d = document.getElementById('desktop-date');
  if (d) {
    d.style.fontSize = Math.max(11, Math.round(sz * 13 / 44)) + 'px';
    if (settings.clockColor) d.style.color = settings.clockColor;
    else d.style.removeProperty('color');
  }
}

function applyWallpaper(b) {
  const wp = document.getElementById('wallpaper');
  if (!wp) return;
  const wall = (settings.wallpaper || '').trim();
  const isGrad = /^(linear|radial|conic)-gradient\(/i.test(wall);
  const isUlr = /^url\(/i.test(wall);
  b.classList.toggle('wallpaper-custom', !!wall);
  if (!wall) {
    wp.style.cssText = '';
    return;
  }
  const dim = isGrad ? 0 : Math.max(0, Math.min(0.9, +settings.wallpaperDim || 0));
  const blur = isGrad ? 0 : Math.max(0, Math.min(30, +settings.wallpaperBlur || 0));
  const src = isGrad || isUlr ? wall : 'url("' + wall.replace(/["\\]/g, '') + '")';
  wp.style.backgroundImage = dim > 0 ? 'linear-gradient(rgba(0,0,0,' + dim + '),rgba(0,0,0,' + dim + ')), ' + src : src;
  wp.style.backgroundSize = 'cover';
  wp.style.backgroundPosition = 'center';
  wp.style.filter = blur > 0 ? 'blur(' + blur + 'px)' : '';
}

function applyCustomColors(b) {
  const cc = settings.customColors || {};
  const map = [
    ['--accent', cc.accent],
    ['--text', cc.text],
    ['--bg', cc.bg]
  ];
  for (const [prop, v] of map) {
    if (v) b.style.setProperty(prop, v);
    else b.style.removeProperty(prop);
  }
}

export function el(tag, cls, text) {
  const d = document.createElement(tag);
  if (cls) d.className = cls;
  if (text != null) d.textContent = text;
  return d;
}
export function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 6); }
export function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
