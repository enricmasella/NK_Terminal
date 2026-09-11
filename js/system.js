/* ── system.js ── clock + hardware/system info ── */
import { term, p, os, browserName, coresInfo, connInfo, ft, fd, el, scroll, settings } from './core.js';
import { registerCommand } from './commands.js';
import { registerApp } from './apps.js';
import { getLocation } from './weather.js';

let clockInterval = null, clockEl = null;

export function startClock() {
  if (clockInterval) return;
  function tick() {
    clockEl = document.getElementById('tc');
    if (clockEl) clockEl.textContent = '  time        ' + ft(new Date()) + ' \u25cf';
  }
  tick();
  clockInterval = setInterval(tick, 1000);
}
export function resetClock() { if (clockInterval) { clearInterval(clockInterval); clockInterval = null; } clockEl = null; }

export async function updateSysRows() {
  try {
    const m = await p(chrome.system.memory.getInfo);
    const t = m.capacity / 1073741824, a = m.availableCapacity / 1073741824, u = t - a;
    const e = document.querySelector('.mem');
    if (e) e.textContent = '  memory      ' + u.toFixed(1) + '/' + t.toFixed(1) + ' GB (' + ((u / t) * 100).toFixed(0) + '%)';
  } catch (e) { }
  try {
    const c = await p(chrome.system.cpu.getInfo);
    const avg = c.processors.reduce((s, pr) => s + (1 - pr.usage.idle / pr.usage.total), 0) / c.processors.length;
    const e = document.querySelector('.cpu');
    if (e) e.textContent = '  cpu         ' + (avg * 100).toFixed(1) + '%';
  } catch (e) { }
}
export function startSysMonitor() {
  clearInterval(window._sysInt);
  updateSysRows();
  window._sysInt = setInterval(updateSysRows, 2000);
}

registerCommand('sysinfo', 'system/hardware information', async () => {
  startSysMonitor();
  try {
    const c = await p(chrome.system.cpu.getInfo);
    const e = document.querySelector('.cores');
    if (e) e.textContent = '  Cores       ' + c.numOfProcessors + ' (' + c.modelName.replace(/\s+/g, ' ').trim() + ')';
  } catch (e) { }
  try {
    const d = await p(chrome.system.storage.getInfo);
    if (d.length) {
      const s = d[0], t = s.capacity / 1073741824, a = s.availableCapacity / 1073741824;
      let e = document.querySelector('.stor');
      if (!e) { e = document.createElement('div'); e.className = 'l r stor'; document.querySelector('.net').after(e); }
      e.textContent = '  storage     ' + t.toFixed(1) + ' GB (' + (t - a).toFixed(1) + ' GB used, ' + a.toFixed(1) + ' GB free)';
    }
  } catch (e) { }
  const ne = document.querySelector('.net');
  if (ne) ne.textContent = '  network     ' + connInfo() + ' (' + (navigator.connection?.downlink || '?') + ' Mbps)';
  const le = document.querySelector('.lang');
  if (le) le.textContent = '  language    ' + navigator.language + (navigator.languages ? ', ' + navigator.languages.join(', ') : '');
  const { lat, lon } = getLocation();
  if (lat !== null && lon !== null) {
    let e = document.querySelector('.crd');
    if (!e) { e = document.createElement('div'); e.className = 'l d crd'; term.appendChild(e); }
    e.textContent = '  coords      ' + lat.toFixed(4) + ', ' + lon.toFixed(4);
  }
  scroll();
});

/* ── window app ── */
let sysTimer = null;

export function mountSysApp(body) {
  const sec = el('div', 'sys');
  const row = label => {
    const r = el('div', 'sys-row');
    r.appendChild(el('span', 'sys-k', label));
    const v = el('b', 'sys-v', '...');
    r.appendChild(v);
    sec.appendChild(r);
    return v;
  };
  const vTime = row('Hora'), vDate = row('Fecha'), vPlat = row('Plataforma'), vBrw = row('Navegador');
  const vMem = row('Memoria'), vCpu = row('CPU'), vRed = row('Red'), vLang = row('Idioma'), vCrd = row('Coordenadas');
  body.appendChild(sec);

  const refresh = async () => {
    const now = new Date();
    vTime.textContent = ft(now);
    vDate.textContent = fd(now);
    vPlat.textContent = os();
    vBrw.textContent = browserName();
    vRed.textContent = connInfo() + ' (' + (navigator.connection?.downlink || '?') + ' Mbps)';
    vLang.textContent = navigator.language;
    const { lat, lon } = getLocation();
    vCrd.textContent = lat != null ? lat.toFixed(4) + ', ' + lon.toFixed(4) : '--';
    try {
      const m = await p(chrome.system.memory.getInfo);
      const t = m.capacity / 1073741824, a = m.availableCapacity / 1073741824, u = t - a;
      vMem.textContent = u.toFixed(1) + ' / ' + t.toFixed(1) + ' GB (' + ((u / t) * 100).toFixed(0) + '%)';
    } catch (e) { vMem.textContent = 'no disponible'; }
    try {
      const c = await p(chrome.system.cpu.getInfo);
      const avg = c.processors.reduce((s, pr) => s + (1 - pr.usage.idle / pr.usage.total), 0) / c.processors.length;
      vCpu.textContent = (avg * 100).toFixed(1) + '%';
    } catch (e) { vCpu.textContent = 'no disponible'; }
  };

  clearInterval(sysTimer);
  sysTimer = setInterval(refresh, 2000);
  refresh();
}

registerApp({
  id: 'sistema',
  name: 'Sistema',
  icon: '\u25CE',
  w: 440,
  h: 460,
  mount: mountSysApp,
  onClose: () => { clearInterval(sysTimer); sysTimer = null; }
});

export { os, browserName, coresInfo, connInfo };
