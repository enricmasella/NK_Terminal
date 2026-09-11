// desktop.js - NK_Desktop chrome: clock widget (hover to resize/recolor), quick-link icon column
import { el, openLink, settings, saveSettings, applySettings, clamp } from './core.js';
import { getLinks, onLinksChange, setLinks, setupLinkModal } from './links.js';

// ---------- quick links column ----------

function avatarStyle(l, idx) {
  const label = l.display || l.label || '?';
  const theme = settings.iconTheme;
  if (theme === 'mono') {
    const g = 18 + ((idx * 37) % 62);
    return `linear-gradient(135deg, hsl(0 0% ${g + 30}%), hsl(0 0% ${g}%))`;
  }
  if (theme === 'rainbow') {
    const hue = (idx * 47) % 360;
    return `linear-gradient(135deg, hsl(${hue} 70% 55%), hsl(${(hue + 40) % 360} 70% 40%))`;
  }
  if (theme === 'transparent') return 'transparent';
  if (l.color) {
    return `linear-gradient(135deg, ${l.color}, color-mix(in srgb, ${l.color}, #000 38%))`;
  }
  const hue = (label.length * 47) % 360;
  return `linear-gradient(135deg, hsl(${hue} 70% 55%), hsl(${(hue + 40) % 360} 70% 40%))`;
}

function makeChip(l, idx) {
  const row = el('button', 'dl-chip');
  row.title = l.url;
  row.dataset.idx = idx;
  const label = l.display || l.label || '?';
  const letter = el('span', 'dl-avatar', label.trim().charAt(0).toUpperCase() || '?');
  letter.style.background = avatarStyle(l, idx);
  const shape = settings.iconShape || 'circle';
  if (shape === 'rounded') letter.style.borderRadius = '12px';
  else if (shape === 'square') letter.style.borderRadius = '4px';
  if (settings.iconTheme === 'transparent') {
    letter.style.border = '1px dashed var(--text-muted)';
    letter.style.boxShadow = 'none';
  }
  const lbl = el('span', 'dl-label', label);
  row.append(letter, lbl);
  row.addEventListener('click', () => openLink(l.url, label));
  return row;
}

let draggedIdx = null;

function renderDesktopList(list, links) {
  const chipDrag = i => {
    const chip = list.querySelector('.dl-chip[data-idx="' + i + '"]');
    if (!chip) return;
    chip.addEventListener('dragenter', e => { e.preventDefault(); if (i !== draggedIdx) chip.classList.add('dl-drag-over'); });
    chip.addEventListener('dragover', e => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; });
    chip.addEventListener('dragleave', () => chip.classList.remove('dl-drag-over'));
    chip.addEventListener('drop', async e => {
      e.preventDefault();
      chip.classList.remove('dl-drag-over');
      const from = draggedIdx;
      if (from === null || from === i) return;
      const items = await getLinks();
      const [it] = items.splice(from, 1);
      items.splice(i, 0, it);
      await setLinks(items);
      draggedIdx = null;
    });
  };
  list.querySelectorAll('.dl-chip').forEach(chip => {
    const i = +chip.dataset.idx;
    if (!Number.isInteger(i)) return;
    chip.draggable = true;
    chip.addEventListener('dragstart', e => {
      draggedIdx = i;
      chip.classList.add('dl-dragging');
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('text/plain', String(i));
    });
    chip.addEventListener('dragend', () => {
      chip.classList.remove('dl-dragging', 'dl-drag-over');
      draggedIdx = null;
    });
    chipDrag(i);
  });
}

export async function renderDesktopLinks() {
  const wrap = document.getElementById('desktop-links');
  if (!wrap) return;
  wrap.replaceChildren();
  const links = await getLinks();
  const list = el('div', 'dl-list');
  for (let i = 0; i < links.length; i++) list.appendChild(makeChip(links[i], i));
  renderDesktopList(list, links);
  wrap.appendChild(list);
}

// ---------- clock widget ----------

function setupClockControls() {
  const minus = document.getElementById('clock-minus');
  const plus = document.getElementById('clock-plus');
  const color = document.getElementById('clock-color');
  if (color) color.value = settings.clockColor || '#ffffff';
  const persist = async () => { applySettings(); await saveSettings(); };
  if (minus) minus.addEventListener('click', () => { settings.clockSize = clamp((settings.clockSize || 44) - 4, 16, 160); persist(); });
  if (plus) plus.addEventListener('click', () => { settings.clockSize = clamp((settings.clockSize || 44) + 4, 16, 160); persist(); });
  if (color) color.addEventListener('input', () => { settings.clockColor = color.value; persist(); });
}

function renderClock() {
  const now = new Date();
  const t = document.getElementById('desktop-time');
  if (t) t.textContent = now.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
  const d = document.getElementById('desktop-date');
  if (d) d.textContent = now.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' });
  const dc = document.getElementById('dock-clock');
  if (dc) dc.textContent = now.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
}

export function initDesktop() {
  setupClockControls();
  renderClock();
  setupLinkModal();
  renderDesktopLinks();
  onLinksChange(renderDesktopLinks);
  setInterval(renderClock, 1000);
}