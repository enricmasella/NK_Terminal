/* ── panel.js ── the GUI settings/dashboard panel (gear icon) ──
   Tabs: Display, Quick Links, Widgets, AI, Layouts. Terminal commands
   remain the primary interface; this panel is the point-and-click
   equivalent for the same data, per NK's request.
   ──────────────────────────────────────────────────────── */
import { settings, saveSettings, applySettings, THEMES, el } from './core.js';
import { renderLinksPanel, setupLinksPanelAdd } from './links.js';
import { renderDesktopLinks } from './desktop.js';
import { renderWidgetsPanel, setupWidgetsPanelForms } from './widgets.js';
import { renderHorarioPanel, setupHorarioPanelForms } from './horario.js';
import { renderAiPanel, setupAiPanel } from './ai.js';
import { getLayoutsData, saveLayoutSnapshot, deleteLayout, setDefaultLayout } from './wm.js';
import { loadLayout } from './apps.js';

const THEME_COLORS = {
  dark: '#000', green: '#001a00', amber: '#1a0f00', light: '#f5f5f5', matrix: '#000',
  nord: '#2e3440', dracula: '#282a36', solarized: '#002b36', synthwave: '#241b2f'
};
const THEME_LABELS = {
  dark: 'Dark', green: 'Green', amber: 'Amber', light: 'Light', matrix: 'Matrix',
  nord: 'Nord', dracula: 'Dracula', solarized: 'Solarized', synthwave: 'Synthwave'
};

const WALLPAPER_PRESETS = [
  { label: 'Aurora', css: '' },
  { label: 'Neón', css: 'linear-gradient(160deg,#0f0c29,#302b63,#24243e)' },
  { label: 'Océano', css: 'linear-gradient(160deg,#000428,#004e92)' },
  { label: 'Atardecer', css: 'linear-gradient(160deg,#2c0e37,#8e2de2,#ff6b6b)' },
  { label: 'Bosque', css: 'linear-gradient(160deg,#134e5e,#71b280)' },
  { label: 'Noche', css: 'linear-gradient(160deg,#0b0c10,#1f2833,#45a29e)' }
];

const WALLPAPER_KEY = 'wallpaper';
const DIM_KEY = 'wallpaperDim';
const BLUR_KEY = 'wallpaperBlur';
const CC_KEY = 'customColors';

function bp(presets) {
  return presets.map((p, i) => `
    <div class="wp-preset${p.css === settings.wallpaper ? ' active' : ''}" data-pi="${i}"
         style="background:${p.css || 'radial-gradient(circle at 30% 30%,rgba(124,58,237,.55),rgba(16,185,129,.35))'}"></div>
  `).join('');
}

function buildWallpaperGrid() {
  const grid = document.getElementById('wp-grid');
  if (!grid) return;
  grid.innerHTML = bp(WALLPAPER_PRESETS);
  grid.querySelectorAll('.wp-preset').forEach(btn => {
    btn.title = WALLPAPER_PRESETS[+btn.dataset.pi].label;
    btn.addEventListener('click', () => {
      settings[WALLPAPER_KEY] = WALLPAPER_PRESETS[+btn.dataset.pi].css;
      applySettings();
      saveSettings();
      grid.querySelectorAll('.wp-preset').forEach(el => el.classList.toggle('active', el.dataset.pi === btn.dataset.pi));
    });
  });
}

function syncWallpaperInputs() {
  document.getElementById('set-wallpaper-url').value = /^https?:|^data:|^file:/i.test(settings.wallpaper || '') ? settings.wallpaper : '';
  const dim = document.getElementById('set-wallpaper-dim');
  dim.value = Math.round((+settings.wallpaperDim || 0) * 100);
  document.getElementById('wallpaper-dim-val').textContent = dim.value + '%';
  const blur = document.getElementById('set-wallpaper-blur');
  blur.value = +settings.wallpaperBlur || 0;
  document.getElementById('wallpaper-blur-val').textContent = blur.value + 'px';
  buildWallpaperGrid();
}

function syncColorInputs() {
  const cc = settings.customColors || {};
  const d = b => b || '#ffffff';
  document.getElementById('set-color-accent').value = d(cc.accent);
  document.getElementById('set-color-text').value = d(cc.text);
  document.getElementById('set-color-bg').value = d(cc.bg);
}

function setupWallpaperControls() {
  const applyUrl = async () => {
    const url = document.getElementById('set-wallpaper-url').value.trim();
    settings[WALLPAPER_KEY] = url;
    applySettings();
    await saveSettings();
    buildWallpaperGrid();
  };
  const btn = document.getElementById('wp-apply-url');
  if (btn) btn.addEventListener('click', applyUrl);
  const u = document.getElementById('set-wallpaper-url');
  if (u) u.addEventListener('keydown', async e => { if (e.key === 'Enter') applyUrl(); });

  const file = document.getElementById('set-wallpaper-file');
  if (file) file.addEventListener('change', () => {
    const f = file.files && file.files[0];
    if (!f) return;
    const rd = new FileReader();
    rd.onload = async () => {
      settings[WALLPAPER_KEY] = rd.result;
      applySettings();
      await saveSettings();
      buildWallpaperGrid();
    };
    rd.readAsDataURL(f);
    file.value = '';
  });

  const dim = document.getElementById('set-wallpaper-dim');
  if (dim) dim.addEventListener('input', () => { document.getElementById('wallpaper-dim-val').textContent = dim.value + '%'; });
  if (dim) dim.addEventListener('change', async () => {
    settings[DIM_KEY] = dim.value / 100;
    applySettings();
    await saveSettings();
  });
  const blur = document.getElementById('set-wallpaper-blur');
  if (blur) blur.addEventListener('input', () => { document.getElementById('wallpaper-blur-val').textContent = blur.value + 'px'; });
  if (blur) blur.addEventListener('change', async () => {
    settings[BLUR_KEY] = +blur.value;
    applySettings();
    await saveSettings();
  });

  const reset = document.getElementById('wp-reset');
  if (reset) reset.addEventListener('click', async () => {
    settings[WALLPAPER_KEY] = '';
    settings[DIM_KEY] = 0;
    settings[BLUR_KEY] = 0;
    applySettings();
    await saveSettings();
    syncWallpaperInputs();
  });
}

function setupColorControls() {
  const bind = (id, key) => {
    const input = document.getElementById(id);
    if (!input) return;
    input.addEventListener('input', () => {
      if (!settings.customColors) settings.customColors = {};
      settings.customColors[key] = input.value;
      applySettings();
      saveSettings();
    });
  };
  bind('set-color-accent', 'accent');
  bind('set-color-text', 'text');
  bind('set-color-bg', 'bg');
  const reset = document.getElementById('colors-reset');
  if (reset) reset.addEventListener('click', async () => {
    settings[CC_KEY] = {};
    applySettings();
    await saveSettings();
    syncColorInputs();
  });
}

function buildThemeGrid() {
  const grid = document.getElementById('theme-grid');
  if (!grid) return;
  grid.innerHTML = '';
  for (const th of THEMES) {
    const btn = document.createElement('div');
    btn.className = 'theme-btn' + (settings.theme === th ? ' active' : '');
    btn.dataset.theme = th;
    btn.innerHTML = `<span class="swatch" style="background:${THEME_COLORS[th]}"></span>${THEME_LABELS[th]}`;
    btn.addEventListener('click', async () => {
      settings.theme = th;
      applySettings();
      await saveSettings();
      grid.querySelectorAll('.theme-btn').forEach(el => el.classList.toggle('active', el.dataset.theme === th));
    });
    grid.appendChild(btn);
  }
}

function syncDisplayInputs() {
  document.getElementById('set-font').value = settings.font;
  document.getElementById('set-size').value = settings.fontSize;
  document.getElementById('set-greeting').value = settings.greeting;
  document.getElementById('set-weather').checked = settings.showWeather;
  document.getElementById('set-system').checked = settings.showSystem;
  document.getElementById('set-hour12').checked = settings.hour12;
  document.getElementById('set-scanlines').checked = settings.scanlines;
  document.getElementById('set-bootanim').checked = settings.bootAnim;
  syncWallpaperInputs();
  syncColorInputs();
}

function setupTabs() {
  const tabs = document.querySelectorAll('.panel-tab');
  const pages = document.querySelectorAll('.panel-page');
  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      tabs.forEach(t => t.classList.toggle('active', t === tab));
      pages.forEach(p => p.classList.toggle('active', p.id === 'page-' + tab.dataset.tab));
    });
  });
}

export async function renderLayoutsPanel() {
  const list = document.getElementById('panel-layouts-list');
  if (!list) return;
  const data = await getLayoutsData();
  list.replaceChildren();
  const names = Object.keys(data.layouts || {});
  if (!names.length) {
    const hint = el('div', 'empty-hint', 'No hay layouts guardados. Mueve tus ventanas y pulsa "Guardar actual".');
    list.appendChild(hint);
    return;
  }
  for (const name of names) {
    const row = el('div', 'row-item lay-row');
    const label = el('span', 'ri-label', name + (data.default === name ? '  ★' : ''));
    if (data.default === name) label.style.color = 'var(--accent)';
    const loadBtn = el('button', 'ri-act', 'Cargar');
    loadBtn.addEventListener('click', async () => {
      await loadLayout(name);
      const overlay = document.getElementById('settings-overlay');
      if (overlay) overlay.classList.remove('open');
    });
    const defBtn = el('button', 'ri-act', 'Default');
    defBtn.addEventListener('click', async () => {
      await setDefaultLayout(name);
      await renderLayoutsPanel();
    });
    const delBtn = el('button', 'ri-act', 'Borrar');
    delBtn.addEventListener('click', async () => {
      await deleteLayout(name);
      await renderLayoutsPanel();
    });
    row.append(label, loadBtn, defBtn, delBtn);
    list.appendChild(row);
  }
}

function setupLayoutsPanelForm() {
  const form = document.getElementById('panel-layout-form');
  if (!form) return;
  form.addEventListener('submit', async e => {
    e.preventDefault();
    const input = document.getElementById('panel-layout-name');
    let name = (input ? input.value : '').trim();
    if (!name) {
      const d = await getLayoutsData();
      name = 'Layout ' + (Object.keys(d.layouts || {}).length + 1);
    }
    await saveLayoutSnapshot(name);
    if (input) input.value = '';
    await renderLayoutsPanel();
  });
}

export async function setupPanel() {
  const gear = document.getElementById('gear');
  const overlay = document.getElementById('settings-overlay');
  const closeBtn = document.getElementById('settings-close');
  if (!gear || !overlay) return;

  buildThemeGrid();
  syncDisplayInputs();
  setupTabs();
  setupWallpaperControls();
  setupColorControls();

  gear.addEventListener('click', async () => {
    overlay.classList.toggle('open');
    if (overlay.classList.contains('open')) {
      await renderLinksPanel();
      await renderWidgetsPanel();
      await renderHorarioPanel();
      await renderAiPanel();
      await renderLayoutsPanel();
    }
  });
  overlay.addEventListener('click', e => { if (e.target === overlay) overlay.classList.remove('open'); });
  if (closeBtn) closeBtn.addEventListener('click', () => overlay.classList.remove('open'));
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && overlay.classList.contains('open')) overlay.classList.remove('open'); });

  const on = (id, fn) => { const el = document.getElementById(id); if (el) el.addEventListener('change', fn); };
  on('set-font', async () => { settings.font = document.getElementById('set-font').value; applySettings(); await saveSettings(); });
  on('set-size', async () => { settings.fontSize = +document.getElementById('set-size').value; applySettings(); await saveSettings(); });
  on('set-weather', async () => { settings.showWeather = document.getElementById('set-weather').checked; await saveSettings(); });
  on('set-system', async () => { settings.showSystem = document.getElementById('set-system').checked; await saveSettings(); });
  on('set-hour12', async () => { settings.hour12 = document.getElementById('set-hour12').checked; applySettings(); await saveSettings(); });
  on('set-scanlines', async () => { settings.scanlines = document.getElementById('set-scanlines').checked; applySettings(); await saveSettings(); });
  on('set-bootanim', async () => { settings.bootAnim = document.getElementById('set-bootanim').checked; await saveSettings(); });
  on('set-icon-theme', async () => { settings.iconTheme = document.getElementById('set-icon-theme').value; await saveSettings(); await renderLinksPanel(); await renderDesktopLinks(); });
  on('set-icon-shape', async () => { settings.iconShape = document.getElementById('set-icon-shape').value; await saveSettings(); await renderDesktopLinks(); });
  const syncIconInputs = () => {
    const t = document.getElementById('set-icon-theme');
    if (t) t.value = settings.iconTheme || '';
    const s = document.getElementById('set-icon-shape');
    if (s) s.value = settings.iconShape || 'circle';
  };
  syncIconInputs();

  const gr = document.getElementById('set-greeting');
  if (gr) {
    gr.addEventListener('change', async () => { settings.greeting = gr.value.trim(); await saveSettings(); });
    gr.addEventListener('keydown', async e => { if (e.key === 'Enter') { settings.greeting = gr.value.trim(); await saveSettings(); overlay.classList.remove('open'); } });
  }

  setupLinksPanelAdd();
  setupWidgetsPanelForms();
  setupHorarioPanelForms();
  setupAiPanel();
  setupLayoutsPanelForm();
}
