/* ── commands.js ──────────────────────────────────────────
   Extensible command registry. Any module can register a new
   command with registerCommand(name, description, run). This
   is the "plugin" surface of NK_Terminal: adding a feature is
   adding a module that calls registerCommand — the dispatcher,
   help text and history all pick it up automatically.

   Note on real plugins: Manifest V3's CSP forbids loading and
   eval'ing remote/third-party code inside the extension, so
   this can't be a live marketplace of installable JS plugins.
   What it gives you instead is a single, clean seam — one
   function call — for adding first-party commands/widgets
   without touching the dispatcher itself.
   ──────────────────────────────────────────────────────── */
import { $, scroll, ft, fd } from './core.js';

export const registry = new Map();
const fallbacks = []; // (main, args, raw) => Promise<boolean> — handled?
const history = [];
let hIdx = -1;

export function registerCommand(name, desc, run) {
  registry.set(name.toLowerCase(), { desc, run });
}
export function registerFallback(fn) {
  fallbacks.push(fn);
}
export function historyPrev() {
  if (!history.length) return null;
  hIdx = Math.max(0, hIdx - 1);
  return history[hIdx];
}
export function historyNext() {
  if (hIdx < history.length - 1) { hIdx++; return history[hIdx]; }
  hIdx = history.length;
  return '';
}

export async function handle(raw) {
  const t = raw.trim();
  if (!t) return;
  $('$ ' + t, 'p');
  history.push(t);
  hIdx = history.length;
  const parts = t.split(/\s+/);
  const main = parts[0].toLowerCase();
  const args = parts.slice(1);

  const entry = registry.get(main);
  if (entry) {
    try { await entry.run(args, t); }
    catch (e) { $('  error: ' + e.message, 'd'); scroll(); }
    return;
  }
  for (const fb of fallbacks) {
    if (await fb(main, args, t)) return;
  }
  $('  unknown command: ' + main + ' (try "help")', 'd');
  scroll();
}

/* ── Generic built-ins ── */
registerCommand('help', 'show this help', async () => {
  $('  NK_Terminal \u2014 commands:', 'h');
  const names = [...registry.keys()].filter(n => n !== '?' && n !== 'cls').sort();
  for (const n of names) $('  ' + n.padEnd(13) + registry.get(n).desc, 'd');
  $('  tip: click the gear icon (top right) for the GUI panel', 'd');
  scroll();
});
registerCommand('?', 'alias for help', async (a, raw) => registry.get('help').run(a, raw));

registerCommand('time', 'show current time', async () => { $('  ' + ft(new Date()), 'r'); scroll(); });
registerCommand('date', 'show current date', async () => { $('  ' + fd(new Date()), 'r'); scroll(); });
