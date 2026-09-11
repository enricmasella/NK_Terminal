/* ── ai.js ── multi-provider AI chat: Gemini, OpenAI, Anthropic, custom ── */
import { $, $block, el, bgFetch, storageGet, storageSet, scroll, settings, saveSettings } from './core.js';
import { registerCommand } from './commands.js';
import { registerApp } from './apps.js';

const KEYS_STORE = '_aik';
const HISTORY_LIMIT = 12;
let convo = [];

export const PROVIDERS = {
  gemini: { label: 'Gemini (Google)', defaultModel: 'gemini-3.6-flash', needsKey: true },
  openai: { label: 'OpenAI', defaultModel: 'gpt-5-mini', needsKey: true },
  anthropic: { label: 'Claude (Anthropic)', defaultModel: 'claude-sonnet-5', needsKey: true },
  custom: { label: 'Custom (OpenAI-compatible)', defaultModel: '', needsKey: false }
};

// model IDs already shut down by their providers (2026). Stored settings still
// pointing at them get bumped to a live default before any request is sent.
const RETIRED = new Set(['gemini-2.0-flash', 'gemini-2.0-flash-lite', 'gpt-4o-mini', 'claude-3-5-haiku-latest']);

export function resolveModel(model) {
  const name = (model || '').trim();
  if (!name || RETIRED.has(name)) return '';
  return name;
}

export async function getAiKeys() { const d = await storageGet([KEYS_STORE]); return d[KEYS_STORE] || {}; }
export async function setAiKey(provider, key) {
  const keys = await getAiKeys();
  keys[provider] = key;
  await storageSet({ [KEYS_STORE]: keys });
}

/* Custom endpoints aren't in host_permissions, so request the origin at runtime (optional_host_permissions). */
export async function ensureHostPermission(url) {
  try {
    const origin = new URL(url).origin + '/*';
    const has = await chrome.permissions.contains({ origins: [origin] });
    if (has) return true;
    return await chrome.permissions.request({ origins: [origin] });
  } catch { return false; }
}

function toGeminiBody(messages) {
  const sys = messages.find(m => m.role === 'system');
  const contents = messages.filter(m => m.role !== 'system').map(m => {
    const parts = [];
    if (m.image) parts.push({ inline_data: { mime_type: m.image.mime, data: m.image.dataUrl.split(',')[1] } });
    if (m.content) parts.push({ text: m.content });
    return { role: m.role === 'assistant' ? 'model' : 'user', parts };
  });
  const body = { contents };
  if (sys) body.systemInstruction = { parts: [{ text: sys.content }] };
  return body;
}

function chatContent(m) {
  if (!m.image) return m.content;
  const parts = [];
  if (m.content) parts.push({ type: 'text', text: m.content });
  parts.push({ type: 'image_url', image_url: { url: m.image.dataUrl } });
  return parts;
}

export async function callAI({ provider, apiKey, model, baseUrl, messages }) {
  const useModel = resolveModel(model) || PROVIDERS[provider]?.defaultModel;
  if (provider === 'gemini') {
    const url = 'https://generativelanguage.googleapis.com/v1beta/models/' + encodeURIComponent(useModel) + ':generateContent?key=' + encodeURIComponent(apiKey);
    const res = await bgFetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(toGeminiBody(messages)) });
    const data = JSON.parse(res);
    if (data.error) throw new Error(data.error.message || 'Gemini API error');
    return (data.candidates?.[0]?.content?.parts || []).map(p => p.text).join('') || '(empty response)';
  }
  if (provider === 'openai') {
    const res = await bgFetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + apiKey },
      body: JSON.stringify({ model: useModel, messages: messages.map(chatContent) })
    });
    const data = JSON.parse(res);
    if (data.error) throw new Error(data.error.message || 'OpenAI API error');
    return data.choices?.[0]?.message?.content || '(empty response)';
  }
  if (provider === 'anthropic') {
    const sys = messages.find(m => m.role === 'system');
    const rest = messages.filter(m => m.role !== 'system').map(m => {
      if (!m.image) return { role: m.role, content: m.content };
      const parts = [];
      if (m.content) parts.push({ type: 'text', text: m.content });
      parts.push({ type: 'image', source: { type: 'base64', media_type: m.image.mime, data: m.image.dataUrl.split(',')[1] } });
      return { role: m.role, content: parts };
    });
    const res = await bgFetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json', 'x-api-key': apiKey,
        'anthropic-version': '2023-06-01', 'anthropic-dangerous-direct-browser-access': 'true'
      },
      body: JSON.stringify({ model: useModel, max_tokens: 1024, system: sys?.content, messages: rest })
    });
    const data = JSON.parse(res);
    if (data.error) throw new Error(data.error.message || 'Anthropic API error');
    return (data.content || []).map(c => c.text).join('') || '(empty response)';
  }
  if (provider === 'custom') {
    if (!baseUrl) throw new Error('no custom endpoint configured (AI tab \u2192 Base URL)');
    await ensureHostPermission(baseUrl);
    const resolved = resolveEndpoint(baseUrl);
    const headers = { 'Content-Type': 'application/json' };
    if (apiKey) headers['Authorization'] = 'Bearer ' + apiKey;
    const res = await bgFetch(resolved, { method: 'POST', headers, body: JSON.stringify({ model: useModel, messages: messages.map(chatContent) }) });
    const data = JSON.parse(res);
    if (data.error) throw new Error((data.error.message || data.error) + '');
    return data.choices?.[0]?.message?.content || '(empty response)';
  }
  throw new Error('unknown provider: ' + provider);
}

/* Accept baseUrl in any of these shapes and normalize to the chat completions path:
   https://host/v1            -> https://host/v1/chat/completions
   https://host/v1/           -> https://host/v1/chat/completions
   https://host               -> https://host/v1/chat/completions
   https://host/anything/x    -> https://host/anything/x/v1/chat/completions
   (a URL already ending in /chat/completions is used as-is)
   404s in the AI tab came from calling /chat/completions directly on a root. */
export function resolveEndpoint(baseUrl) {
  let u = String(baseUrl || '').trim().replace(/\/+$/, '');
  if (u.endsWith('/chat/completions')) return u;
  if (/\/(v\d+|openai|v1beta1)(\/|$)/i.test(u) || /\/chat\/completions$/i.test(u)) return u + '/chat/completions';
  return u + '/v1/chat/completions';
}

async function askAI(args, raw) {
  if ((args[0] || '').toLowerCase() === 'reset') { convo = []; $('  conversation cleared', 'd'); scroll(); return; }
  const prompt = raw.replace(/^\w+\s*/, '');
  if (!prompt.trim()) { $('  usage: ai <message>  (or "ai reset" to clear context)', 'd'); scroll(); return; }
  if (!settings.aiProvider) { $('  no AI provider configured \u2014 open the gear icon \u2192 AI tab', 'd'); scroll(); return; }
  const provider = PROVIDERS[settings.aiProvider];
  const keys = await getAiKeys();
  const apiKey = keys[settings.aiProvider] || '';
  if (provider?.needsKey && !apiKey) { $('  missing API key for ' + settings.aiProvider + ' \u2014 set it in the AI tab', 'd'); scroll(); return; }
  const model = resolveModel(settings.aiModel);
  convo.push({ role: 'user', content: prompt });
  if (convo.length > HISTORY_LIMIT) convo = convo.slice(-HISTORY_LIMIT);
  const thinking = $('  thinking...', 'd fetching');
  scroll();
  try {
    const reply = await callAI({ provider: settings.aiProvider, apiKey, model, baseUrl: settings.aiBaseUrl, messages: convo });
    thinking.remove();
    $block(reply, 'ai-reply');
    convo.push({ role: 'assistant', content: reply });
  } catch (e) {
    thinking.remove();
    $('  AI error: ' + e.message, 'd');
  }
  scroll();
}
registerCommand('ai', 'chat with your configured AI: ai <message> | ai reset', askAI);
registerCommand('chat', 'alias for ai', askAI);

/* ── GUI panel (AI tab) ── */
export async function renderAiPanel() {
  const sel = document.getElementById('panel-ai-provider');
  if (!sel) return;
  const modelInput = document.getElementById('panel-ai-model');
  const baseUrlRow = document.getElementById('panel-ai-baseurl-row');
  const baseUrlInput = document.getElementById('panel-ai-baseurl');
  const keyInput = document.getElementById('panel-ai-key');
  sel.value = settings.aiProvider || '';
  modelInput.placeholder = PROVIDERS[settings.aiProvider]?.defaultModel || 'model name';
  modelInput.value = settings.aiModel || '';
  baseUrlInput.value = settings.aiBaseUrl || '';
  baseUrlRow.style.display = settings.aiProvider === 'custom' ? 'flex' : 'none';
  const keys = await getAiKeys();
  keyInput.value = settings.aiProvider ? (keys[settings.aiProvider] || '') : '';
  keyInput.disabled = !settings.aiProvider;
}

export function setupAiPanel() {
  const sel = document.getElementById('panel-ai-provider');
  if (!sel) return;
  const modelInput = document.getElementById('panel-ai-model');
  const baseUrlInput = document.getElementById('panel-ai-baseurl');
  const baseUrlRow = document.getElementById('panel-ai-baseurl-row');
  const keyInput = document.getElementById('panel-ai-key');
  const status = document.getElementById('panel-ai-status');

  for (const [id, def] of Object.entries(PROVIDERS)) {
    const opt = document.createElement('option');
    opt.value = id; opt.textContent = def.label;
    sel.appendChild(opt);
  }

  sel.addEventListener('change', async () => {
    settings.aiProvider = sel.value;
    await saveSettings();
    await renderAiPanel();
  });
  modelInput.addEventListener('change', async () => { settings.aiModel = modelInput.value.trim(); await saveSettings(); });
  baseUrlInput.addEventListener('change', async () => { settings.aiBaseUrl = baseUrlInput.value.trim(); await saveSettings(); });
  keyInput.addEventListener('change', async () => { if (settings.aiProvider) await setAiKey(settings.aiProvider, keyInput.value.trim()); });

  const testBtn = document.getElementById('panel-ai-test');
  if (testBtn) testBtn.addEventListener('click', async () => {
    status.textContent = 'testing...';
    try {
      const keys = await getAiKeys();
      const apiKey = keys[settings.aiProvider] || '';
      const model = resolveModel(settings.aiModel);
      const reply = await callAI({ provider: settings.aiProvider, apiKey, model, baseUrl: settings.aiBaseUrl, messages: [{ role: 'user', content: 'Reply with exactly: ok' }] });
      status.textContent = 'connected \u2713 (' + reply.slice(0, 40) + ')';
    } catch (e) { status.textContent = 'failed: ' + e.message; }
  });
}

/* ── window app ── */
export function mountAiApp(body) {
  const sec = el('div', 'aid');

  const providerDef = PROVIDERS[settings.aiProvider];
  const head = el('div', 'aid-head');
  const info = el('div', 'aid-head-info');
  const prov = el('span', 'aid-head-prov', providerDef ? providerDef.label : 'Sin proveedor');
  const model = el('span', 'aid-head-model', providerDef ? (settings.aiModel || providerDef.defaultModel) : 'Configura en Ajustes \u2192 IA');
  const reset = el('button', 'aid-reset', 'Limpiar');
  reset.title = 'Borrar la conversación';
  reset.type = 'button';
  info.append(prov, model);
  head.append(info, reset);

  const list = el('div', 'aid-list');
  const previewRow = el('div', 'aid-attach-row');
  const previewImg = el('img', '');
  const previewName = el('span', 'aid-attach-name');
  const previewX = el('button', 'aid-attach-x', '\u2715');
  previewX.title = 'Quitar imagen';
  previewX.type = 'button';
  previewRow.append(previewImg, previewName, previewX);
  previewRow.hidden = true;

  const form = el('form', 'aid-form');
  const fileInput = el('input', '');
  fileInput.type = 'file';
  fileInput.accept = 'image/*';
  fileInput.style.display = 'none';
  const attachBtn = el('button', 'aid-attach', '\uD83D\uDCCE');
  attachBtn.title = 'Adjuntar imagen';
  attachBtn.type = 'button';
  const input = el('input', '');
  input.placeholder = 'Mensaje para la IA...';
  input.autocomplete = 'off';
  const send = el('button', '', 'Enviar');
  send.type = 'submit';
  form.append(fileInput, attachBtn, input, send);
  sec.append(head, list, previewRow, form);
  body.appendChild(sec);

  let pendingImage = null;

  const bubble = (text, cls, image) => {
    const b = el('div', 'aid-msg ' + cls);
    if (image) {
      const img = el('img', 'aid-img');
      img.src = image.dataUrl;
      b.appendChild(img);
    }
    if (text) {
      const t = el('div', '', text);
      b.appendChild(t);
    }
    list.appendChild(b);
    list.scrollTop = list.scrollHeight;
    return b;
  };

  if (!settings.aiProvider) bubble('Sin proveedor configurado. Abre Ajustes \u2192 IA para configurarlo.', 'aid-hint');
  else if (!convo.length) bubble('Escribe un mensaje para empezar. Puedes adjuntar una imagen.', 'aid-hint');
  else for (const m of convo) bubble(m.content, m.role === 'user' ? 'aid-user' : 'aid-bot', m.image);

  reset.addEventListener('click', () => {
    convo = [];
    list.replaceChildren();
    bubble('Conversación borrada. Escribe un mensaje para empezar.', 'aid-hint');
  });

  attachBtn.addEventListener('click', () => fileInput.click());
  previewX.addEventListener('click', () => {
    fileInput.value = '';
    pendingImage = null;
    previewRow.hidden = true;
  });
  fileInput.addEventListener('change', () => {
    const file = fileInput.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      pendingImage = { dataUrl: reader.result, mime: file.type || 'image/png', name: file.name || 'imagen' };
      previewImg.src = pendingImage.dataUrl;
      previewName.textContent = pendingImage.name;
      previewRow.hidden = false;
    };
    reader.readAsDataURL(file);
  });

  form.addEventListener('submit', async e => {
    e.preventDefault();
    const text = input.value.trim();
    if (!text && !pendingImage) return;
    if (!settings.aiProvider) { bubble('Configura un proveedor en Ajustes \u2192 IA.', 'aid-hint'); return; }
    const msg = { role: 'user', content: text, image: pendingImage || undefined };
    input.value = '';
    pendingImage = null;
    previewRow.hidden = true;
    fileInput.value = '';
    convo.push(msg);
    if (convo.length > HISTORY_LIMIT) convo = convo.slice(-HISTORY_LIMIT);
    bubble(msg.content, 'aid-user', msg.image);
    const think = bubble('pensando...', 'aid-thinking');
    try {
      const provider = PROVIDERS[settings.aiProvider];
      const keys = await getAiKeys();
      const apiKey = keys[settings.aiProvider] || '';
      if (provider?.needsKey && !apiKey) throw new Error('falta API key (Ajustes \u2192 IA)');
      const model = resolveModel(settings.aiModel);
      const reply = await callAI({ provider: settings.aiProvider, apiKey, model, baseUrl: settings.aiBaseUrl, messages: convo });
      think.remove();
      convo.push({ role: 'assistant', content: reply });
      bubble(reply, 'aid-bot');
    } catch (err) {
      think.remove();
      const keepMsg = err.message === 'falta API key (Ajustes \u2192 IA)';
      if (keepMsg) convo.pop();
      bubble('Error: ' + err.message, 'aid-hint');
      if (keepMsg) convo.push(msg);
    }
    list.scrollTop = list.scrollHeight;
  });
}

registerApp({ id: 'ia', name: 'IA', icon: '\u2726', w: 480, h: 520, mount: mountAiApp });
