/* ── widgets.js ── notes, tasks, agenda: commands + GUI panel + window apps ── */
import { $, $block, el, storageGet, storageSet, scroll } from './core.js';
import { registerCommand } from './commands.js';
import { registerApp } from './apps.js';

const NOTES_KEY = '_notes', TASKS_KEY = '_tasks', EVENTS_KEY = '_events';
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);

async function getList(key) { const d = await storageGet([key]); return d[key] || []; }
async function setList(key, items) { await storageSet({ [key]: items }); }

/* ── Notes ── */
registerCommand('note', 'notes: note add <text> | list | rm <idx>', async args => {
  const [subRaw, ...rest] = args;
  const sub = (subRaw || '').toLowerCase();
  const notes = await getList(NOTES_KEY);
  if (!sub || sub === 'list') {
    if (!notes.length) $('  no notes \u2014 try "note add <text>"', 'd');
    else { $('  notes (' + notes.length + '):', 'h'); notes.forEach((n, i) => $('  [' + (i + 1) + '] ' + n.text, 'r')); }
  } else if (sub === 'add') {
    const text = rest.join(' ');
    if (!text) { $('  usage: note add <text>', 'd'); scroll(); return; }
    notes.push({ id: uid(), text, ts: Date.now() });
    await setList(NOTES_KEY, notes);
    $('  note saved [' + notes.length + ']', 'r');
    await renderWidgetsPanel();
  } else if (sub === 'rm') {
    const idx = parseInt(rest[0]) - 1;
    if (isNaN(idx) || idx < 0 || idx >= notes.length) { $('  invalid index', 'd'); scroll(); return; }
    notes.splice(idx, 1);
    await setList(NOTES_KEY, notes);
    $('  note removed', 'r');
    await renderWidgetsPanel();
  } else $('  usage: note add <text> | list | rm <idx>', 'd');
  scroll();
});

/* ── Tasks ── */
registerCommand('task', 'tasks: task add <text> | list | done <idx> | rm <idx>', async args => {
  const [subRaw, ...rest] = args;
  const sub = (subRaw || '').toLowerCase();
  const tasks = await getList(TASKS_KEY);
  if (!sub || sub === 'list') {
    if (!tasks.length) $('  no tasks \u2014 try "task add <text>"', 'd');
    else { $('  tasks (' + tasks.length + '):', 'h'); tasks.forEach((t, i) => $('  [' + (i + 1) + '] ' + (t.done ? '[x] ' : '[ ] ') + t.text, t.done ? 'd' : 'r')); }
  } else if (sub === 'add') {
    const text = rest.join(' ');
    if (!text) { $('  usage: task add <text>', 'd'); scroll(); return; }
    tasks.push({ id: uid(), text, done: false, ts: Date.now() });
    await setList(TASKS_KEY, tasks);
    $('  task added [' + tasks.length + ']', 'r');
    await renderWidgetsPanel();
  } else if (sub === 'done') {
    const idx = parseInt(rest[0]) - 1;
    if (isNaN(idx) || idx < 0 || idx >= tasks.length) { $('  invalid index', 'd'); scroll(); return; }
    tasks[idx].done = !tasks[idx].done;
    await setList(TASKS_KEY, tasks);
    $('  task ' + (tasks[idx].done ? 'completed' : 'reopened') + ': ' + tasks[idx].text, 'r');
    await renderWidgetsPanel();
  } else if (sub === 'rm') {
    const idx = parseInt(rest[0]) - 1;
    if (isNaN(idx) || idx < 0 || idx >= tasks.length) { $('  invalid index', 'd'); scroll(); return; }
    tasks.splice(idx, 1);
    await setList(TASKS_KEY, tasks);
    $('  task removed', 'r');
    await renderWidgetsPanel();
  } else $('  usage: task add <text> | list | done <idx> | rm <idx>', 'd');
  scroll();
});

/* ── Agenda / calendar (date-tagged events, no month grid — a terminal is a list, not a grid) ── */
registerCommand('agenda', 'agenda: agenda add <YYYY-MM-DD> <text> | list | rm <idx>', async args => {
  const [subRaw, ...rest] = args;
  const sub = (subRaw || '').toLowerCase();
  const events = await getList(EVENTS_KEY);
  events.sort((a, b) => a.date.localeCompare(b.date));
  if (!sub || sub === 'list') {
    if (!events.length) $('  no upcoming events \u2014 try "agenda add <YYYY-MM-DD> <text>"', 'd');
    else { $('  agenda (' + events.length + '):', 'h'); events.forEach((ev, i) => $('  [' + (i + 1) + '] ' + ev.date + '  ' + ev.text, 'r')); }
  } else if (sub === 'add') {
    const date = rest[0];
    const text = rest.slice(1).join(' ');
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date || '') || !text) { $('  usage: agenda add <YYYY-MM-DD> <text>', 'd'); scroll(); return; }
    events.push({ id: uid(), date, text });
    await setList(EVENTS_KEY, events);
    $('  event added on ' + date, 'r');
    await renderWidgetsPanel();
  } else if (sub === 'rm') {
    const idx = parseInt(rest[0]) - 1;
    if (isNaN(idx) || idx < 0 || idx >= events.length) { $('  invalid index', 'd'); scroll(); return; }
    events.splice(idx, 1);
    await setList(EVENTS_KEY, events);
    $('  event removed', 'r');
    await renderWidgetsPanel();
  } else $('  usage: agenda add <YYYY-MM-DD> <text> | list | rm <idx>', 'd');
  scroll();
});

/* ── GUI panel (Widgets tab) ── */
export async function renderWidgetsPanel() {
  const notesHost = document.getElementById('panel-notes-list');
  const tasksHost = document.getElementById('panel-tasks-list');
  const agendaHost = document.getElementById('panel-agenda-list');
  if (!notesHost && !tasksHost && !agendaHost) return;

  if (notesHost) {
    const notes = await getList(NOTES_KEY);
    notesHost.innerHTML = notes.length ? '' : '<div class="empty-hint">No notes yet.</div>';
    notes.forEach((n, i) => {
      const row = document.createElement('div');
      row.className = 'row-item';
      row.innerHTML = `<span class="ri-label">${escapeHtml(n.text)}</span>`;
      row.appendChild(delBtn(async () => { const cur = await getList(NOTES_KEY); cur.splice(i, 1); await setList(NOTES_KEY, cur); await renderWidgetsPanel(); }));
      notesHost.appendChild(row);
    });
  }
  if (tasksHost) {
    const tasks = await getList(TASKS_KEY);
    tasksHost.innerHTML = tasks.length ? '' : '<div class="empty-hint">No tasks yet.</div>';
    tasks.forEach((t, i) => {
      const row = document.createElement('div');
      row.className = 'row-item';
      const chk = document.createElement('input');
      chk.type = 'checkbox'; chk.checked = !!t.done;
      chk.addEventListener('change', async () => { const cur = await getList(TASKS_KEY); cur[i].done = chk.checked; await setList(TASKS_KEY, cur); await renderWidgetsPanel(); });
      const lbl = document.createElement('span');
      lbl.className = 'ri-label'; lbl.textContent = t.text;
      if (t.done) lbl.style.textDecoration = 'line-through';
      row.appendChild(chk); row.appendChild(lbl);
      row.appendChild(delBtn(async () => { const cur = await getList(TASKS_KEY); cur.splice(i, 1); await setList(TASKS_KEY, cur); await renderWidgetsPanel(); }));
      tasksHost.appendChild(row);
    });
  }
  if (agendaHost) {
    const events = await getList(EVENTS_KEY);
    events.sort((a, b) => a.date.localeCompare(b.date));
    agendaHost.innerHTML = events.length ? '' : '<div class="empty-hint">No events yet.</div>';
    events.forEach((ev, i) => {
      const row = document.createElement('div');
      row.className = 'row-item';
      row.innerHTML = `<span class="ri-date">${ev.date}</span><span class="ri-label">${escapeHtml(ev.text)}</span>`;
      row.appendChild(delBtn(async () => { const cur = await getList(EVENTS_KEY); cur.splice(i, 1); await setList(EVENTS_KEY, cur); await renderWidgetsPanel(); }));
      agendaHost.appendChild(row);
    });
  }
}

function delBtn(onClick) {
  const b = document.createElement('button');
  b.className = 'ri-del'; b.textContent = '\u2715'; b.title = 'Remove';
  b.addEventListener('click', onClick);
  return b;
}
function escapeHtml(s) { const d = document.createElement('div'); d.textContent = s; return d.innerHTML; }

export function setupWidgetsPanelForms() {
  const noteForm = document.getElementById('panel-note-form');
  if (noteForm) noteForm.addEventListener('submit', async e => {
    e.preventDefault();
    const input = document.getElementById('panel-note-input');
    const text = input.value.trim();
    if (!text) return;
    const notes = await getList(NOTES_KEY);
    notes.push({ id: uid(), text, ts: Date.now() });
    await setList(NOTES_KEY, notes);
    input.value = '';
    await renderWidgetsPanel();
  });
  const taskForm = document.getElementById('panel-task-form');
  if (taskForm) taskForm.addEventListener('submit', async e => {
    e.preventDefault();
    const input = document.getElementById('panel-task-input');
    const text = input.value.trim();
    if (!text) return;
    const tasks = await getList(TASKS_KEY);
    tasks.push({ id: uid(), text, done: false, ts: Date.now() });
    await setList(TASKS_KEY, tasks);
    input.value = '';
    await renderWidgetsPanel();
  });
  const agendaForm = document.getElementById('panel-agenda-form');
  if (agendaForm) agendaForm.addEventListener('submit', async e => {
    e.preventDefault();
    const dateInput = document.getElementById('panel-agenda-date');
    const textInput = document.getElementById('panel-agenda-input');
    const date = dateInput.value, text = textInput.value.trim();
    if (!date || !text) return;
    const events = await getList(EVENTS_KEY);
    events.push({ id: uid(), date, text });
    await setList(EVENTS_KEY, events);
    dateInput.value = ''; textInput.value = '';
    await renderWidgetsPanel();
  });
}

/* ── window apps ── */
function appShell(title) {
  const sec = el('div', 'wapp');
  sec.appendChild(el('h4', 'wapp-title', title));
  const list = el('div', 'list-scroll');
  list.id = uid();
  sec.appendChild(list);
  return { sec, list };
}

function delRowBtn(onClick) {
  const b = el('button', 'ri-del', '\u2715');
  b.title = 'Eliminar';
  b.addEventListener('click', onClick);
  return b;
}

export function mountNotesApp(body) {
  const { sec, list } = appShell('Notas');
  const form = el('form', 'mini-form');
  const input = el('input', '');
  input.placeholder = 'nueva nota...';
  const btn = el('button', '', 'A\u00f1adir');
  btn.type = 'submit';
  form.append(input, btn);
  sec.appendChild(form);
  body.appendChild(sec);

  const refresh = async () => {
    const notes = await getList(NOTES_KEY);
    list.replaceChildren();
    if (!notes.length) list.appendChild(el('div', 'empty-hint', 'Sin notas.'));
    notes.forEach((n, i) => {
      const row = el('div', 'row-item');
      row.appendChild(el('span', 'ri-label', n.text));
      row.appendChild(delRowBtn(async () => {
        const cur = await getList(NOTES_KEY);
        cur.splice(i, 1);
        await setList(NOTES_KEY, cur);
        await renderWidgetsPanel();
        refresh();
      }));
      list.appendChild(row);
    });
  };

  form.addEventListener('submit', async e => {
    e.preventDefault();
    const text = input.value.trim();
    if (!text) return;
    const notes = await getList(NOTES_KEY);
    notes.push({ id: uid(), text, ts: Date.now() });
    await setList(NOTES_KEY, notes);
    input.value = '';
    await renderWidgetsPanel();
    refresh();
  });
  refresh();
}

export function mountTasksApp(body) {
  const { sec, list } = appShell('Tareas');
  const form = el('form', 'mini-form');
  const input = el('input', '');
  input.placeholder = 'nueva tarea...';
  const btn = el('button', '', 'A\u00f1adir');
  btn.type = 'submit';
  form.append(input, btn);
  sec.appendChild(form);
  body.appendChild(sec);

  const refresh = async () => {
    const tasks = await getList(TASKS_KEY);
    list.replaceChildren();
    if (!tasks.length) list.appendChild(el('div', 'empty-hint', 'Sin tareas.'));
    tasks.forEach((t, i) => {
      const row = el('div', 'row-item');
      const chk = document.createElement('input');
      chk.type = 'checkbox';
      chk.checked = !!t.done;
      chk.addEventListener('change', async () => {
        const cur = await getList(TASKS_KEY);
        cur[i].done = chk.checked;
        await setList(TASKS_KEY, cur);
        await renderWidgetsPanel();
        refresh();
      });
      const lbl = el('span', 'ri-label', t.text);
      if (t.done) lbl.style.textDecoration = 'line-through';
      row.append(chk, lbl);
      row.appendChild(delRowBtn(async () => {
        const cur = await getList(TASKS_KEY);
        cur.splice(i, 1);
        await setList(TASKS_KEY, cur);
        await renderWidgetsPanel();
        refresh();
      }));
      list.appendChild(row);
    });
  };

  form.addEventListener('submit', async e => {
    e.preventDefault();
    const text = input.value.trim();
    if (!text) return;
    const tasks = await getList(TASKS_KEY);
    tasks.push({ id: uid(), text, done: false, ts: Date.now() });
    await setList(TASKS_KEY, tasks);
    input.value = '';
    await renderWidgetsPanel();
    refresh();
  });
  refresh();
}

export function mountAgendaApp(body) {
  const { sec, list } = appShell('Agenda');
  const form = el('form', 'mini-form');
  const date = el('input', '');
  date.type = 'date';
  const text = el('input', '');
  text.placeholder = 'evento...';
  const btn = el('button', '', 'A\u00f1adir');
  btn.type = 'submit';
  form.append(date, text, btn);
  sec.appendChild(form);
  body.appendChild(sec);

  const refresh = async () => {
    const events = await getList(EVENTS_KEY);
    events.sort((a, b) => a.date.localeCompare(b.date));
    list.replaceChildren();
    if (!events.length) list.appendChild(el('div', 'empty-hint', 'Sin eventos.'));
    events.forEach((ev, i) => {
      const row = el('div', 'row-item');
      row.appendChild(el('span', 'ri-date', ev.date));
      row.appendChild(el('span', 'ri-label', ev.text));
      row.appendChild(delRowBtn(async () => {
        const cur = await getList(EVENTS_KEY);
        cur.splice(i, 1);
        await setList(EVENTS_KEY, cur);
        await renderWidgetsPanel();
        refresh();
      }));
      list.appendChild(row);
    });
  };

  form.addEventListener('submit', async e => {
    e.preventDefault();
    const d = date.value, t = text.value.trim();
    if (!d || !t) return;
    const events = await getList(EVENTS_KEY);
    events.push({ id: uid(), date: d, text: t });
    await setList(EVENTS_KEY, events);
    date.value = ''; text.value = '';
    await renderWidgetsPanel();
    refresh();
  });
  refresh();
}

registerApp({ id: 'notas', name: 'Notas', icon: '\u270E', w: 420, h: 460, mount: mountNotesApp });
registerApp({ id: 'tareas', name: 'Tareas', icon: '\u2611', w: 420, h: 460, mount: mountTasksApp });
registerApp({ id: 'agenda', name: 'Agenda', icon: '\u25A4', w: 460, h: 480, mount: mountAgendaApp });
