// calc.js - Calculadora (máquina de estados, sin eval)
import { el } from './core.js';
import { registerApp } from './apps.js';

const KEYS = [
  ['C', 'fn'], ['\u00b1', 'fn'], ['%', 'fn'], ['\u00f7', 'op'],
  ['7', 'd'], ['8', 'd'], ['9', 'd'], ['\u00d7', 'op'],
  ['4', 'd'], ['5', 'd'], ['6', 'd'], ['\u2212', 'op'],
  ['1', 'd'], ['2', 'd'], ['3', 'd'], ['+', 'op'],
  ['0', 'd'], ['.', 'd'], ['\u232b', 'fn'], ['=', 'eq']
];

function compute(a, op, b) {
  switch (op) {
    case '+': return a + b;
    case '\u2212': return a - b;
    case '\u00d7': return a * b;
    case '\u00f7': return b === 0 ? null : a / b;
    default: return b;
  }
}

const fmt = n => {
  if (n == null || !isFinite(n)) return 'Err';
  const r = Math.round(n * 1e10) / 1e10;
  return String(r);
};

export function mountCalcApp(body) {
  const screen = el('div', 'calc-screen', '0');
  const grid = el('div', 'calc-grid');
  body.append(screen, grid);

  let acc = null, op = null, cur = '0', fresh = true;

  const paint = () => { screen.textContent = cur; };

  const digit = d => {
    if (fresh) { cur = d === '.' ? '0.' : d; fresh = false; }
    else if (cur === '0' && d !== '.') cur = d;
    else if (d === '.' && cur.includes('.')) return;
    else if (cur.length < 14) cur += d;
    paint();
  };

  const setOp = o => {
    const v = parseFloat(cur);
    if (acc !== null && !fresh) acc = compute(acc, op, v);
    else acc = v;
    op = o;
    fresh = true;
    paint();
  };

  const equals = () => {
    if (acc === null || op === null) return;
    cur = fmt(compute(acc, op, parseFloat(cur)));
    acc = null; op = null; fresh = true;
    paint();
  };

  const fn = k => {
    if (k === 'C') { acc = null; op = null; cur = '0'; fresh = true; }
    else if (k === '\u00b1') { if (!fresh) cur = cur.startsWith('-') ? cur.slice(1) : '-' + cur; }
    else if (k === '%') { cur = fmt(parseFloat(cur) / 100); fresh = true; }
    else if (k === '\u232b') { if (!fresh) cur = cur.slice(0, -1) || '0'; }
    paint();
  };

  for (const [label, type] of KEYS) {
    const btn = el('button', 'cc-btn' + (type === 'op' ? ' cc-op' : type === 'fn' ? ' cc-fn' : type === 'eq' ? ' cc-eq' : ''), label);
    btn.addEventListener('click', () => {
      if (type === 'd') digit(label);
      else if (type === 'op') setOp(label);
      else if (type === 'eq') equals();
      else fn(label);
    });
    grid.appendChild(btn);
  }
}

registerApp({ id: 'calculadora', name: 'Calculadora', icon: '\u00b1', w: 320, h: 400, mount: mountCalcApp });