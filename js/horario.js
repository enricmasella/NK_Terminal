// horario.js - user-configurable schedule app + `horari` command.
// The schedule (course dates, weekly classes, holidays) is user data
// kept in chrome.storage.local; see horario-data.js.
import { el, $, fd } from './core.js';
import { registerCommand } from './commands.js';
import { registerApp } from './apps.js';
import { getSchedule, saveSchedule, EMPTY_SCHEDULE } from './horario-data.js';

export const DAYS = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes'];
export const MONTHS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

const SHORT = [
  ['servidor', 'DWES'],
  ['client', 'DWEC'],
  ['interfícies', 'DIW'],
  ['Digitalització', 'DIG'],
  ['Desplegament', 'DPL'],
  ['Projecte', 'PRJ'],
  ['Sostenibilitat', 'SOS']
];

export function shortFor(subject) {
  for (const [k, s] of SHORT) if (subject.includes(k)) return s;
  return subject.slice(0, 4).toUpperCase();
}

export function subjectColor(short) {
  let h = 0;
  for (const c of short) h = (h * 31 + c.charCodeAt(0)) % 360;
  return `hsl(${h} 70% 62%)`;
}

const pad2 = n => String(n).padStart(2, '0');
export function dateKey(d) { return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`; }

// JS Sunday=0..Saturday=6 -> Monday=0..Friday=4 (dow 0..4 as in weekly slots)
export function dowMon(d) { return (d.getDay() + 6) % 7; }

// ---------- schedule state ----------
let sched = EMPTY_SCHEDULE;
export async function loadSchedule() { sched = await getSchedule(); return sched; }
export function currentSchedule() { return sched; }

export function isHoliday(key) {
  for (const h of sched.holidays) if (key >= h.from && key <= h.to) return h;
  return null;
}

export function classesOn(d) {
  const key = dateKey(d);
  const classes = sched.weekly.filter(s => s.dow === dowMon(d));
  if (classes.length === 0) return [];
  if (isHoliday(key)) return [];
  if (sched.courseStart && key < sched.courseStart) return [];
  if (sched.courseEnd && key > sched.courseEnd) return [];
  return [...classes].sort((a, b) => a.start.localeCompare(b.start));
}

function slotTimes(d, start, end) {
  const [sh, sm] = start.split(':').map(Number);
  const [eh, em] = end.split(':').map(Number);
  return {
    startT: new Date(d.getFullYear(), d.getMonth(), d.getDate(), sh, sm),
    endT: new Date(d.getFullYear(), d.getMonth(), d.getDate(), eh, em)
  };
}

export function nextClass(now) {
  for (let i = 0; i < 31; i++) {
    const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() + i);
    const key = dateKey(d);
    if (sched.courseEnd && key > sched.courseEnd) break;
    if (sched.courseStart && key < sched.courseStart) continue;
    if (isHoliday(key)) continue;
    const slots = classesOn(d);
    for (const slot of slots) {
      const { startT, endT } = slotTimes(d, slot.start, slot.end);
      if (i === 0 && endT <= now) continue;
      return { date: d, key, slot, startT, endT, ongoing: startT <= now, inDays: i };
    }
  }
  return null;
}

export function weekDates(anchor) {
  const d = new Date(anchor.getFullYear(), anchor.getMonth(), anchor.getDate());
  const off = (d.getDay() + 6) % 7; // Monday=0
  d.setDate(d.getDate() - off);
  const out = [];
  for (let i = 0; i < 5; i++) {
    out.push(new Date(d.getFullYear(), d.getMonth(), d.getDate() + i));
  }
  return out;
}

function fmtDate(d) {
  return `${d.getDate()} ${MONTHS[d.getMonth()]}`;
}

function relDay(d, today) {
  const diff = dateKey(d) === dateKey(today) ? 0 : Math.round((d - new Date(today.getFullYear(), today.getMonth(), today.getDate())) / 864e5);
  if (diff === 0) return 'Hoy';
  if (diff === 1) return 'Mañana';
  return `${DAYS[(d.getDay() + 6) % 7]} ${fmtDate(d)}`;
}

// ---------- GUI app ----------

function makeRow(slot, color, ongoing) {
  const row = el('div', 'hc-row' + (ongoing ? ' hc-now' : ''));
  const chip = el('span', 'hc-chip', shortFor(slot.subject));
  chip.style.setProperty('--hc', color);
  chip.title = slot.subject;
  row.append(chip, el('span', 'hc-time', `${slot.start} \u2013 ${slot.end}`), el('span', 'hc-subject', slot.subject), el('span', 'hc-room', slot.room));
  return row;
}

function makeNextCard(nc) {
  const card = el('div', 'hc-next');
  const tag = el('div', 'hc-next-tag', nc.ongoing ? 'EN CURSO' : 'PRÓXIMA CLASE');
  if (nc.ongoing) tag.classList.add('live');
  const color = subjectColor(shortFor(nc.slot.subject));
  const big = el('div', 'hc-next-main');
  const chip = el('span', 'hc-chip hc-chip-xl', shortFor(nc.slot.subject));
  chip.style.setProperty('--hc', color);
  chip.title = nc.slot.subject;
  big.append(chip, el('span', 'hc-next-subj', nc.slot.subject));
  const meta = el('div', 'hc-next-meta');
  const when = relDay(nc.date, new Date());
  const mins = Math.round((nc.startT - new Date()) / 6e4);
  const count = nc.ongoing
    ? 'en curso ahora'
    : mins <= 0
      ? 'arranca en breve'
      : mins < 60
        ? `en ${mins} min`
        : `en ${Math.floor(mins / 60)}h ${mins % 60}m`;
  meta.append(el('span', 'hc-next-when', `${when} \u00b7 ${nc.slot.start}`), el('span', 'hc-next-count', count), el('span', `hc-next-room`, nc.slot.room));
  card.append(tag, big, meta);
  return card;
}

function makeDayList(d) {
  const today = new Date();
  const key = dateKey(d);
  const wrap = el('div', 'hc-day');
  const head = el('div', 'hc-day-head', dateKey(d) === dateKey(today) ? 'Hoy' : relDay(d, today));
  wrap.appendChild(head);
  const hol = isHoliday(key);
  if (hol) {
    const chip = el('div', 'hc-holiday', `Festivo \u00b7 ${hol.reason}`);
    wrap.appendChild(chip);
    return wrap;
  }
  const slots = classesOn(d);
  if (slots.length === 0) {
    wrap.appendChild(el('div', 'hc-empty', 'Sin clases'));
    return wrap;
  }
  const now = new Date();
  for (const slot of slots) {
    const { startT, endT } = slotTimes(d, slot.start, slot.end);
    const isNow = dateKey(d) === dateKey(now) && startT <= now && endT > now;
    wrap.appendChild(makeRow(slot, subjectColor(shortFor(slot.subject)), isNow));
  }
  return wrap;
}

function makeWeekGrid(host) {
  const nav = el('div', 'hc-nav');
  const prev = el('button', 'hc-nav-btn', '\u2039');
  const next = el('button', 'hc-nav-btn', '\u203A');
  const label = el('span', 'hc-nav-label', '');
  const today = el('button', 'hc-nav-btn hc-nav-today', 'Hoy');
  nav.append(prev, label, next, today);

  const grid = el('div', 'hc-grid');

  let anchor = new Date();
  const renderWeek = () => {
    grid.replaceChildren();
    const days = weekDates(anchor);
    const first = days[0], last = days[4];
    label.textContent = `${fmtDate(first)} \u2013 ${fmtDate(last)}`;
    for (const d of days) {
      const col = el('div', 'hc-col' + (dateKey(d) === dateKey(new Date()) ? ' hc-today' : ''));
      col.appendChild(el('div', 'hc-col-head', DAYS[dowMon(d)]));
      col.appendChild(makeDayList(d));
      grid.appendChild(col);
    }
  };

  prev.addEventListener('click', () => { anchor.setDate(anchor.getDate() - 7); renderWeek(); });
  next.addEventListener('click', () => { anchor.setDate(anchor.getDate() + 7); renderWeek(); });
  today.addEventListener('click', () => { anchor = new Date(); renderWeek(); });
  renderWeek();
  host.append(nav, grid);
}

export async function mountHorarioApp(body) {
  await loadSchedule();
  const nc = nextClass(new Date());
  if (nc) body.appendChild(makeNextCard(nc));

  const todayWrap = el('div', 'hc-section', '');
  todayWrap.appendChild(el('h3', 'hc-title', 'Hoy'));
  todayWrap.appendChild(makeDayList(new Date()));
  body.append(todayWrap);

  const wk = el('div', 'hc-section', '');
  wk.appendChild(el('h3', 'hc-title', 'Semana'));
  makeWeekGrid(wk);
  body.appendChild(wk);
}

// ---------- GUI panel (Widgets ▸ Horario) ----------

function panelDelBtn(onClick) {
  const b = el('button', 'ri-del', '\u2715');
  b.title = 'Eliminar';
  b.addEventListener('click', onClick);
  return b;
}

export async function renderHorarioPanel() {
  const startIn = document.getElementById('panel-hc-start');
  const endIn = document.getElementById('panel-hc-end');
  const weekly = document.getElementById('panel-hc-weekly');
  const holidays = document.getElementById('panel-hc-holidays');
  if (!startIn && !endIn && !weekly && !holidays) return;
  const s = await getSchedule();
  if (startIn) startIn.value = s.courseStart;
  if (endIn) endIn.value = s.courseEnd;
  if (weekly) {
    weekly.replaceChildren();
    const rows = [...s.weekly].sort((a, b) => a.dow - b.dow || a.start.localeCompare(b.start));
    if (!rows.length) weekly.appendChild(el('div', 'empty-hint', 'No hay clases configuradas.'));
    rows.forEach(slot => {
      const row = el('div', 'row-item');
      row.appendChild(el('span', 'ri-date', `${slot.start} \u2013 ${slot.end}`));
      row.appendChild(el('span', 'ri-label', `${DAYS[slot.dow]} \u00b7 ${slot.subject}${slot.room ? ' \u00b7 ' + slot.room : ''}`));
      row.appendChild(panelDelBtn(async () => {
        const cur = await getSchedule();
        const match = cur.weekly.findIndex(x => x.dow === slot.dow && x.start === slot.start && x.end === slot.end && x.subject === slot.subject && x.room === slot.room);
        if (match >= 0) cur.weekly.splice(match, 1);
        await saveSchedule({ weekly: cur.weekly });
        await renderHorarioPanel();
      }));
      weekly.appendChild(row);
    });
  }
  if (holidays) {
    holidays.replaceChildren();
    const hs = [...s.holidays].sort((a, b) => a.from.localeCompare(b.from));
    if (!hs.length) holidays.appendChild(el('div', 'empty-hint', 'No hay festivos.'));
    hs.forEach(h => {
      const row = el('div', 'row-item');
      row.appendChild(el('span', 'ri-date', h.from + (h.to !== h.from ? ' \u2192 ' + h.to : '')));
      row.appendChild(el('span', 'ri-label', h.reason));
      row.appendChild(panelDelBtn(async () => {
        const cur = await getSchedule();
        const match = cur.holidays.findIndex(x => x.from === h.from && x.to === h.to && x.reason === h.reason);
        if (match >= 0) cur.holidays.splice(match, 1);
        await saveSchedule({ holidays: cur.holidays });
        await renderHorarioPanel();
      }));
      holidays.appendChild(row);
    });
  }
}

export function setupHorarioPanelForms() {
  const saveDates = document.getElementById('panel-hc-save-dates');
  if (saveDates) saveDates.addEventListener('click', async () => {
    await saveSchedule({
      courseStart: document.getElementById('panel-hc-start').value,
      courseEnd: document.getElementById('panel-hc-end').value
    });
  });

  const form = document.getElementById('panel-hc-form');
  if (form) form.addEventListener('submit', async e => {
    e.preventDefault();
    const dow = +document.getElementById('panel-hc-dow').value;
    const st = document.getElementById('panel-hc-start-time').value;
    const en = document.getElementById('panel-hc-end-time').value;
    const subject = document.getElementById('panel-hc-subject').value.trim();
    const room = document.getElementById('panel-hc-room').value.trim();
    if (!st || !en || !subject) return;
    const cur = await getSchedule();
    cur.weekly.push({ dow, start: st, end: en, subject, room });
    await saveSchedule({ weekly: cur.weekly });
    form.reset();
    await renderHorarioPanel();
  });

  const hform = document.getElementById('panel-hc-hform');
  if (hform) hform.addEventListener('submit', async e => {
    e.preventDefault();
    const from = document.getElementById('panel-hc-hfrom').value;
    const to = document.getElementById('panel-hc-hto').value || from;
    const reason = document.getElementById('panel-hc-hreason').value.trim();
    if (!from || !reason) return;
    const cur = await getSchedule();
    cur.holidays.push({ from, to, reason });
    await saveSchedule({ holidays: cur.holidays });
    hform.reset();
    await renderHorarioPanel();
  });
}

// ---------- terminal command ----------

function printToday() {
  const d = new Date();
  const hol = isHoliday(dateKey(d));
  $('.hol', ' \u2014 schedule \u2014 ' + fd(d));
  if (hol) {
    $(' No class today \u2014 ' + hol.reason, 'ok');
    return;
  }
  const slots = classesOn(d);
  if (slots.length === 0) {
    $(' No classes today!', 'ok');
    return;
  }
  for (const s of slots) {
    $(' ' + s.start + ' \u2013 ' + s.end + '  ' + shortFor(s.subject) + '  \u00b7 ' + s.room, 's');
    $('    ' + s.subject, '');
  }
}

function printWeek() {
  const days = weekDates(new Date());
  for (const d of days) {
    $(' ' + DAYS[dowMon(d)] + ' ' + fmtDate(d), 'hol');
    const hol = isHoliday(dateKey(d));
    if (hol) { $('   \u2014 ' + hol.reason, 'ok'); continue; }
    const slots = classesOn(d);
    if (slots.length === 0) { $('   \u2014 free day', 'ok'); continue; }
    for (const s of slots) $('   ' + s.start + ' \u2013 ' + s.end + '  ' + shortFor(s.subject) + '  \u00b7 ' + s.room, 's');
  }
}

function printNext() {
  const nc = nextClass(new Date());
  if (!nc) { $(' No more classes in the course!', 'warn'); return; }
  $(' Next class: ' + shortFor(nc.slot.subject) + ' \u2014 ' + nc.slot.subject, 'hol');
  $('   ' + relDay(nc.date, new Date()) + ' ' + nc.slot.start + ' \u2013 ' + nc.slot.end + ' \u00b7 ' + nc.slot.room, 's');
  if (nc.ongoing) $('   (in progress right now)', 'ok');
}

export function setupHorarioCommand() {
  registerCommand('horari', 'Show today\'s schedule (horari setmana / horari propera)', async args => {
    await loadSchedule();
    const sub = (args[0] || '').toLowerCase();
    if (sub === 'setmana') { $('.hol', ' \u2014 week \u2014 '); printWeek(); }
    else if (sub === 'propera') printNext();
    else if (sub === 'avui') { $('.hol', ' \u2014 today \u2014 '); printToday(); }
    else printToday();
  });
}

registerApp({
  id: 'horario',
  name: 'Horario',
  icon: '\u25A3',
  w: 860,
  h: 620,
  mount: mountHorarioApp
});