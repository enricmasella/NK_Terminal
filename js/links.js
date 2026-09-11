/* ── links.js ── quick links: storage + command + GUI panel + desktop icons ── */
import { $, el, linksEl, storageGet, storageSet, openLink, scroll } from './core.js';
import { registerCommand, registerFallback } from './commands.js';

const changeCbs = new Set();
export function onLinksChange(cb) { changeCbs.add(cb); return () => changeCbs.delete(cb); }
async function emitLinksChange() { await Promise.all([...changeCbs].map(cb => cb())); }

const BUILTIN_VERSION = 1;
const DEFAULT_LINKS = [
  { label: 'yt', display: 'youtube', url: 'https://youtube.com' },
  { label: 'gh', display: 'github', url: 'https://github.com' },
  { label: 'gm', display: 'gmail', url: 'https://mail.google.com' },
  { label: 'cl', display: 'claude', url: 'https://claude.ai' },
  { label: 'ge', display: 'gemini', url: 'https://gemini.google.com' },
  { label: 'gpt', display: 'chatgpt', url: 'https://chatgpt.com' },
  { label: 'dr', display: 'drive', url: 'https://drive.google.com' },
  { label: 'doc', display: 'google docs', url: 'https://docs.google.com' },
];

export async function seedQuickLinks() {
  const data = await storageGet(['quickLinks', '_builtinVersion']);
  if (data._builtinVersion >= BUILTIN_VERSION) return;
  const existing = data.quickLinks || [];
  const seen = new Set(existing.map(l => l.label.toLowerCase()));
  for (const dl of DEFAULT_LINKS) {
    if (!seen.has(dl.label.toLowerCase())) existing.push({ ...dl, builtin: true });
  }
  await storageSet({ quickLinks: existing, _builtinVersion: BUILTIN_VERSION });
  await emitLinksChange();
}

export async function getLinks() {
  const data = await storageGet(['quickLinks']);
  return data.quickLinks || [];
}
export async function setLinks(links) {
  await storageSet({ quickLinks: links });
  await emitLinksChange();
}

export async function addLink(label, url, color) {
  const links = await getLinks();
  links.push({ label, url, color: color || '' });
  await setLinks(links);
}

export async function updateLink(idx, patch) {
  const links = await getLinks();
  if (idx < 0 || idx >= links.length) return;
  links[idx] = { ...links[idx], ...patch };
  await setLinks(links);
}

export async function removeLinkByLabel(label) {
  const links = await getLinks();
  const next = links.filter(l => l.label !== label);
  if (next.length !== links.length) await setLinks(next);
}

onLinksChange(renderLinks);
onLinksChange(renderLinksPanel);

export async function renderLinks() {
  const links = await getLinks();
  linksEl.innerHTML = '';
  if (!links.length) return;
  let draggedIdx = null;
  for (let i = 0; i < links.length; i++) {
    const lk = links[i];
    const a = document.createElement('a');
    a.className = 'lk';
    a.textContent = lk.label;
    a.title = lk.url;
    a.href = '#';
    a.draggable = true;
    a.dataset.idx = i;
    a.addEventListener('click', e => { e.preventDefault(); openLink(lk.url, lk.label); });
    a.addEventListener('dragstart', e => {
      draggedIdx = i; a.classList.add('dragging');
      e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/plain', i);
    });
    a.addEventListener('dragenter', e => { e.preventDefault(); if (i !== draggedIdx) a.classList.add('drag-over'); });
    a.addEventListener('dragover', e => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; if (i !== draggedIdx) a.classList.add('drag-over'); });
    a.addEventListener('dragleave', () => a.classList.remove('drag-over'));
    a.addEventListener('drop', async e => {
      e.preventDefault(); a.classList.remove('drag-over');
      const from = draggedIdx;
      if (from === null || from === i) return;
      const items = await getLinks();
      const [item] = items.splice(from, 1);
      items.splice(i, 0, item);
      await setLinks(items);
    });
    a.addEventListener('dragend', () => {
      document.querySelectorAll('.lk').forEach(el => el.classList.remove('dragging', 'drag-over'));
      draggedIdx = null;
    });
    linksEl.appendChild(a);
  }
}

async function cmdLinks(subcmd, args) {
  const links = await getLinks();
  if (!subcmd || subcmd === 'list') {
    if (!links.length) $('  no quick links', 'd');
    else {
      $('  quick links (' + links.length + '):', 'h');
      for (let i = 0; i < links.length; i++) $('  [' + (i + 1) + '] ' + links[i].label + ' \u2192 ' + links[i].url, 'r');
    }
    scroll(); return;
  }
  if (subcmd === 'add') {
    if (args.length < 2) { $('  usage: link add <label> <url>', 'd'); scroll(); return; }
    const label = args[0];
    let url = args[1];
    if (!url.startsWith('http://') && !url.startsWith('https://')) url = 'https://' + url;
    links.push({ label, url });
    await setLinks(links);
    $('  added quick link [' + label + '] \u2192 ' + url, 'r');
    scroll(); return;
  }
  if (subcmd === 'remove' || subcmd === 'rm') {
    const idx = parseInt(args[0]) - 1;
    if (isNaN(idx) || idx < 0 || idx >= links.length) { $('  invalid index. use link list to see indices.', 'd'); scroll(); return; }
    const removed = links.splice(idx, 1);
    await setLinks(links);
    $('  removed quick link [' + removed[0].label + ']', 'r');
    scroll(); return;
  }
  if (subcmd === 'open') {
    const idx = parseInt(args[0]) - 1;
    if (isNaN(idx) || idx < 0 || idx >= links.length) { $('  invalid index. use link list to see indices.', 'd'); scroll(); return; }
    openLink(links[idx].url, links[idx].label); return;
  }
  if (subcmd === 'move') {
    const from = parseInt(args[0]) - 1, to = parseInt(args[1]) - 1;
    if (isNaN(from) || isNaN(to) || from < 0 || from >= links.length || to < 0 || to >= links.length) { $('  usage: link move <fromIdx> <toIdx>', 'd'); scroll(); return; }
    const [item] = links.splice(from, 1);
    links.splice(to, 0, item);
    await setLinks(links);
    $('  moved [' + item.label + '] from [' + (from + 1) + '] to [' + (to + 1) + ']', 'r');
    scroll(); return;
  }
  $('  unknown subcommand: ' + subcmd, 'd');
  $('  usage: link list | add <label> <url> | remove <idx> | open <idx> | move <fromIdx> <toIdx>', 'd');
  scroll();
}

registerCommand('link', 'manage quick links (list|add|remove|open|move)', async args => cmdLinks((args[0] || '').toLowerCase(), args.slice(1)));
registerCommand('search', 'open a URL or search Google: search <query>', async args => {
  if (!args.length) { $('  usage: search <query or url>', 'd'); scroll(); return; }
  let q = args.join(' '), url;
  if (/^https?:\/\//i.test(q)) url = q;
  else if (/[\w-]+\.[\w-]+/.test(q) && !/[ ?]/.test(q)) url = 'https://' + q;
  else url = 'https://www.google.com/search?q=' + encodeURIComponent(q);
  openLink(url, 'search');
});

/* Typing a bare link label (e.g. "yt") opens it */
registerFallback(async (main) => {
  const links = await getLinks();
  for (const lk of links) {
    if (main === lk.label.toLowerCase()) { openLink(lk.url, lk.display || lk.label); return true; }
  }
  return false;
});

/* ── add/edit quick link modal ── */
const LM_COLORS = ['#7c3aed', '#e5484d', '#f5820f', '#30a46c', '#0091ff', '#e93d82', '#8e4ec6', '#ffd43b'];
let lmMode = 'add';
let lmIdx = -1;

function normUrl(raw) {
  let u = raw.trim();
  if (!/^https?:\/\//i.test(u)) u = 'https://' + u.replace(/^\/\//, '');
  return u;
}

function openLinkModal({ mode = 'add', idx = -1 } = {}) {
  const m = document.getElementById('link-modal');
  if (!m) return;
  lmMode = mode;
  lmIdx = idx;
  const title = document.getElementById('link-modal-title');
  const name = document.getElementById('lm-name');
  const url = document.getElementById('lm-url');
  const color = document.getElementById('lm-color');
  if (mode === 'edit') {
    title.textContent = 'Editar enlace';
    getLinks().then(links => {
      const l = links[idx];
      if (!l) { m.classList.remove('open'); return; }
      name.value = l.display || l.label || '';
      url.value = l.url || '';
      color.value = l.color || '#7c3aed';
      setLmAuto(!l.color);
    });
  } else {
    title.textContent = 'Nuevo enlace';
    name.value = '';
    url.value = '';
    color.value = '#7c3aed';
    setLmAuto(true);
  }
  m.classList.add('open');
  setTimeout(() => name.focus(), 30);
}

function setLmAuto(isAuto) {
  const autoBtn = document.getElementById('lm-color-auto');
  if (!autoBtn) return;
  autoBtn.classList.toggle('active', isAuto);
  autoBtn.dataset.auto = isAuto ? '1' : '0';
  document.querySelectorAll('#lm-swatches .lm-swatch').forEach(s => s.classList.remove('active'));
}

function closeLinkModal() {
  const m = document.getElementById('link-modal');
  if (m) m.classList.remove('open');
}

async function saveLinkModal() {
  const name = document.getElementById('lm-name').value.trim();
  const urlEl = document.getElementById('lm-url');
  const colorEl = document.getElementById('lm-color');
  const isAuto = document.getElementById('lm-color-auto').dataset.auto === '1';
  if (!name || !urlEl.value.trim()) return;
  const url = normUrl(urlEl.value);
  const color = isAuto ? '' : colorEl.value;
  const m = document.getElementById('link-modal');
  try {
    if (lmMode === 'edit') await updateLink(lmIdx, { label: name, display: name, url, color });
    else await addLink(name, url, color);
  } finally {
    m.classList.remove('open');
  }
}

export function setupLinkModal() {
  const m = document.getElementById('link-modal');
  if (!m) return;
  const closeBtn = document.getElementById('link-modal-close');
  const cancelBtn = document.getElementById('lm-cancel');
  const saveBtn = document.getElementById('lm-save');
  const colorEl = document.getElementById('lm-color');
  const autoBtn = document.getElementById('lm-color-auto');
  const swatches = document.getElementById('lm-swatches');
  if (swatches && colorEl) {
    for (const c of LM_COLORS) {
      const s = el('button', 'lm-swatch');
      s.type = 'button';
      s.style.background = c;
      s.title = c;
      s.addEventListener('click', () => {
        colorEl.value = c;
        setLmAuto(false);
        s.classList.add('active');
      });
      swatches.appendChild(s);
    }
  }
  if (cancelBtn) cancelBtn.addEventListener('click', closeLinkModal);
  if (closeBtn) closeBtn.addEventListener('click', closeLinkModal);
  if (saveBtn) saveBtn.addEventListener('click', saveLinkModal);
  if (colorEl) colorEl.addEventListener('input', () => setLmAuto(false));
  if (autoBtn) autoBtn.addEventListener('click', () => setLmAuto(true));
  m.addEventListener('click', e => { if (e.target === m) closeLinkModal(); });
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && m.classList.contains('open')) closeLinkModal();
    if (e.key === 'Enter' && m.classList.contains('open') && e.target.closest('#link-modal')) saveLinkModal();
  });
}

/* ── GUI panel (Quick Links tab) ── */
export async function renderLinksPanel() {
  const host = document.getElementById('panel-links-list');
  if (!host) return;
  const links = await getLinks();
  host.innerHTML = '';
  if (!links.length) {
    host.innerHTML = '<div class="empty-hint">No quick links yet.</div>';
  }
  links.forEach((lk, i) => {
    const row = document.createElement('div');
    row.className = 'row-item';
    row.innerHTML = `<span class="ri-label">${lk.display || lk.label}</span><span class="ri-url">${lk.url}</span>`;
    const edit = document.createElement('button');
    edit.className = 'ri-edit'; edit.textContent = '\u270E'; edit.title = 'Edit';
    edit.addEventListener('click', () => openLinkModal({ mode: 'edit', idx: i }));
    const del = document.createElement('button');
    del.className = 'ri-del'; del.textContent = '\u2715'; del.title = 'Remove';
    del.addEventListener('click', async () => {
      const cur = await getLinks();
      cur.splice(i, 1);
      await setLinks(cur);
    });
    row.append(edit, del);
    host.appendChild(row);
  });
}

export function setupLinksPanelAdd() {
  const btn = document.getElementById('panel-links-add');
  if (!btn) return;
  btn.addEventListener('click', () => openLinkModal({ mode: 'add' }));
}

export function mountLinksApp(body) {
  const form = el('form', 'la-form');
  const name = el('input', '', '');
  name.placeholder = 'Nombre';
  name.maxLength = 40;
  const url = el('input', '', '');
  url.placeholder = 'https://...';
  url.spellcheck = false;
  const save = el('button', 'dl-btn', 'A\u00f1adir');
  form.append(name, url, save);
  const list = el('div', 'la-list');

  form.addEventListener('submit', async e => {
    e.preventDefault();
    const n = name.value.trim(), u = url.value.trim();
    if (!n || !u) return;
    const key = /^https?:\/\//i.test(u) ? u : 'https://' + u.replace(/^\/\//, '');
    await addLink(n, key);
    name.value = url.value = '';
  });

  const refresh = async () => {
    const links = await getLinks();
    list.replaceChildren();
    if (!links.length) list.appendChild(el('div', 'hc-empty', 'Sin enlaces'));
    for (const l of links) {
      const row = el('div', 'la-row');
      const a = el('a', 'la-name', l.label);
      a.href = l.url;
      a.target = '_blank';
      a.rel = 'noopener';
      const u = el('span', 'la-url', l.url);
      const del = el('button', 'ri-del', '\u2715');
      del.title = 'Eliminar';
      del.addEventListener('click', () => removeLinkByLabel(l.label));
      row.append(a, u, del);
      list.appendChild(row);
    }
  };

  onLinksChange(refresh);
  refresh();
  body.append(form, list);
}
