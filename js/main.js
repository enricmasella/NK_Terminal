/* ── main.js ── boot sequence + wiring everything together ── */
import { $, $$, sep, scroll, ft, fd, term, inp, settings, loadSettings, applySettings, os, browserName, coresInfo, connInfo } from './core.js';
import { registerCommand, handle, historyPrev, historyNext } from './commands.js';
import { renderLinks, seedQuickLinks, mountLinksApp } from './links.js';
import { initLocation, startWeatherRefresh, getLocation } from './weather.js';
import { startClock, resetClock, startSysMonitor } from './system.js';
import { setupPanel } from './panel.js';
import { registerApp, openApp, setupDock, loadLayout } from './apps.js';
import { initDesktop } from './desktop.js';
import { getDefaultLayoutName } from './wm.js';
import { setupHorarioCommand } from './horario.js';
import './widgets.js';
import './ai.js';
import './calc.js';
import './pomodoro.js';

registerApp({
  id: 'terminal',
  name: 'Terminal',
  icon: '>_',
  w: 780,
  h: 480,
  persist: true,
  mount(body) {
    body.classList.add('term-body');
    const tc = document.getElementById('term-content');
    if (tc) for (const c of [...tc.children]) body.appendChild(c);
  }
});
registerApp({ id: 'enlaces', name: 'Enlaces', icon: '\u2299', w: 520, h: 460, mount: mountLinksApp });

function greet() {
  if (settings.greeting) return settings.greeting;
  const h = new Date().getHours();
  if (h < 6) return 'it is late';
  if (h < 12) return 'good morning';
  if (h < 18) return 'good afternoon';
  if (h < 22) return 'good evening';
  return 'it is late';
}

async function render() {
  const now = new Date();
  const gr = greet();
  $('NK_Terminal', 'h');
  $('', '');
  if (settings.bootAnim) await $$('  loaded at ' + ft(now) + ' \u00b7 ' + fd(now), 'd', 8);
  else $('  loaded at ' + ft(now) + ' \u00b7 ' + fd(now), 'd');
  $('', '');
  if (settings.bootAnim) await $$('> ' + gr + '.', 'h', 15);
  else $('> ' + gr + '.', 'h');
  if (settings.showWeather) {
    sep();
    $('> weather', 'h');
    $('  locating by IP...', 'd loc');
    $('  ', 'r w');
  }
  if (settings.showSystem) {
    sep();
    $('> system', 'h');
    const tc = document.createElement('div');
    tc.className = 'l r'; tc.id = 'tc'; tc.textContent = '  time        ' + ft(now);
    term.appendChild(tc);
    $('  date        ' + fd(now), 'r');
    $('  platform    ' + os(), 'r plat');
    $('  browser     ' + browserName(), 'r brw');
    $('  memory      ...', 'r mem');
    $('  cpu         ...', 'r cpu');
    $('  Cores       ' + coresInfo(), 'r cores');
    $('  network     ' + connInfo(), 'r net');
    $('  language    ' + navigator.language, 'r lang');
  }
  sep();
  scroll();
}

async function doClear() {
  term.innerHTML = '';
  resetClock();
  clearInterval(window._sysInt);
  await render();
  startClock();
  startSysMonitor();
  const loc = getLocation();
  if (loc.lat !== null && loc.lon !== null) {
    const es = document.querySelectorAll('.loc');
    if (es.length) es[0].textContent = '  ' + loc.name;
  }
  scroll();
}
registerCommand('clear', 'clear the screen', doClear);
registerCommand('cls', 'alias for clear', doClear);

function terminalVisible() {
  const w = document.getElementById('win-terminal');
  return !!(w && !w.classList.contains('minimized'));
}
function isTypingEl(t) { return !!(t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable)); }

function focusInp() {
  if (!terminalVisible()) return;
  try { inp.focus({ preventScroll: true }); } catch (e) { }
}
function stealFocus() {
  let guard = 0;
  (function raf() {
    if (document.activeElement !== inp && guard++ < 120) {
      try { inp.focus({ preventScroll: true }); } catch (_) { }
      requestAnimationFrame(raf);
    }
  })();
}

document.addEventListener('keydown', e => {
  if (e.target === inp) return;
  if (e.ctrlKey || e.metaKey || e.altKey) return;
  if (!terminalVisible()) return;
  if (isTypingEl(e.target)) return;
  if (e.target.closest && e.target.closest('.window:not(#win-terminal), #settings-overlay, #dock')) return;
  e.preventDefault();
  e.stopImmediatePropagation();
  inp.focus({ preventScroll: true });
  if (e.key.length === 1) {
    const s = inp.selectionStart, v = inp.value;
    inp.value = v.slice(0, s) + e.key + v.slice(inp.selectionEnd);
    inp.setSelectionRange(s + 1, s + 1);
  } else if (e.key === 'Backspace') {
    const s = inp.selectionStart;
    if (s > 0) { inp.value = inp.value.slice(0, s - 1) + inp.value.slice(inp.selectionEnd || s); inp.setSelectionRange(s - 1, s - 1); }
  }
  requestAnimationFrame(() => { if (terminalVisible()) inp.focus({ preventScroll: true }); });
}, true);

window.addEventListener('focus', () => { focusInp(); setTimeout(focusInp, 150); setTimeout(focusInp, 500); });
document.addEventListener('visibilitychange', () => { if (!document.hidden) focusInp(); });
document.addEventListener('mousedown', e => {
  if (!terminalVisible()) return;
  if (e.target.closest('.window:not(#win-terminal), #settings-overlay, #dock')) return;
  if (isTypingEl(e.target)) return;
  focusInp();
});

// Startup desktop layout: terminal hugs the right of the quick-links column and
// floats above the dock sized to the boot text. Horario's top edge aligns with
// the terminal's top; the IA panel's bottom edge aligns with the terminal's
// bottom, sharing the vertical span with horario. Margins = 16px.
function fitDesktop() {
  const links = document.getElementById('desktop-links');
  const dock = document.getElementById('dock');
  const M = 16;
  const colRight = links ? links.getBoundingClientRect().right : 0;
  const dockTop = dock ? dock.getBoundingClientRect().top : innerHeight - 70;

  const term = document.getElementById('win-terminal');
  let termTop = M;
  let termBottom = dockTop - 12;
  if (term && !term.classList.contains('minimized') && !term.classList.contains('maximized')) {
    const termEl = term.querySelector('#term');
    const bar = term.querySelector('.win-titlebar');
    const barH = bar ? bar.getBoundingClientRect().height : 36;
    const contentH = termEl ? termEl.scrollHeight : 0;
    const h = barH + contentH;
    const x = Math.round(colRight + M);
    const y = Math.max(M, dockTop - h - 12);
    term.style.left = x + 'px';
    term.style.top = y + 'px';
    term.style.height = h + 'px';
    termTop = y;
    termBottom = y + h;
  }

  const termRight = term ? term.getBoundingClientRect().right : colRight + 780;
  const x2 = Math.round(termRight + M);
  const stackH = termBottom - termTop;

  const hor = document.getElementById('win-horario');
  const ia = document.getElementById('win-ia');
  if (hor && !hor.classList.contains('minimized') && !hor.classList.contains('maximized')) {
    const iaH = Math.min(520, Math.max(160, Math.round(stackH * 0.38)));
    const horH = Math.max(300, stackH - iaH - M);
    const w = Math.min(860, Math.max(320, innerWidth - x2 - M));
    const left = Math.min(x2, Math.max(M, innerWidth - w - M));
    hor.style.left = left + 'px';
    hor.style.top = termTop + 'px';
    hor.style.width = w + 'px';
    hor.style.height = horH + 'px';
    if (ia && !ia.classList.contains('minimized') && !ia.classList.contains('maximized')) {
      const wia = Math.min(480, Math.max(320, innerWidth - x2 - M));
      const leftIa = Math.min(x2, Math.max(M, innerWidth - wia - M));
      const iaTop = termTop + horH + M;
      ia.style.left = leftIa + 'px';
      ia.style.top = iaTop + 'px';
      ia.style.width = wia + 'px';
      ia.style.height = Math.max(120, termBottom - iaTop) + 'px';
    }
  }
}

async function init() {
  await loadSettings();
  applySettings();
  setupPanel();
  initDesktop();
  setupDock();
  setupHorarioCommand();
  const defaultLayout = await getDefaultLayoutName();
  if (defaultLayout) {
    await loadLayout(defaultLayout);
  } else {
    openApp('terminal');
    openApp('horario');
    openApp('ia');
  }
  await render();
  startClock();
  startSysMonitor();
  stealFocus();
  await seedQuickLinks();
  await renderLinks();
  if (!defaultLayout) fitDesktop();
  initLocation();
  startWeatherRefresh();

  document.body.classList.add('boot-done');

  inp.addEventListener('keydown', async e => {
    if (e.key === 'Enter') { const v = inp.value; inp.value = ''; await handle(v); focusInp(); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); const v = historyPrev(); if (v != null) inp.value = v; }
    else if (e.key === 'ArrowDown') { e.preventDefault(); inp.value = historyNext(); }
  });
}

init();