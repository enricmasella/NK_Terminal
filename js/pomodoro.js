// pomodoro.js - Temporizador pomodoro con anillo de progreso
import { el } from './core.js';
import { registerApp } from './apps.js';

const FOCUS = 25 * 60, BREAK = 5 * 60;
const R = 80, CIRC = 2 * Math.PI * R;

const mmss = sec => {
  const m = Math.floor(sec / 60), s = sec % 60;
  return String(m).padStart(2, '0') + ':' + String(s).padStart(2, '0');
};

const ringSvg = `<svg viewBox="0 0 180 180" width="180" height="180">
  <circle class="pm-bg" cx="90" cy="90" r="${R}"/>
  <circle class="pm-fg" cx="90" cy="90" r="${R}" stroke-dasharray="${CIRC.toFixed(1)}" stroke-dashoffset="0"/>
</svg>`;

let pomoTimer = null;

function notify(title, body) {
  try {
    if (Notification.permission === 'granted') new Notification(title, { body });
    else if (Notification.permission === 'default') Notification.requestPermission();
  } catch (e) { }
}

export function mountPomodoroApp(body) {
  const sec = el('div', 'pm');
  const mode = el('div', 'pm-mode', 'Foco');
  const ring = el('div', 'pm-ring');
  ring.innerHTML = ringSvg;
  const fg = ring.querySelector('.pm-fg');
  const time = el('div', 'pm-time', mmss(FOCUS));
  ring.appendChild(time);
  const controls = el('div', 'pm-controls');
  const start = el('button', 'pm-btn pm-go', 'Iniciar');
  const reset = el('button', 'pm-btn', 'Reiniciar');
  controls.append(start, reset);
  const ticks = el('div', 'pm-ticks');
  sec.append(mode, ring, controls, ticks);
  body.appendChild(sec);

  let total = FOCUS, left = FOCUS, running = false, done = 0;

  const paint = () => {
    time.textContent = mmss(left);
    fg.style.strokeDashoffset = (CIRC * (1 - left / total)).toFixed(1);
  };

  const stop = () => { running = false; clearInterval(pomoTimer); pomoTimer = null; start.textContent = 'Iniciar'; start.classList.remove('pm-go'); start.classList.add('pm-btn'); };
  const go = () => { running = true; start.textContent = 'Pausar'; start.classList.add('pm-go'); };

  const tick = () => {
    left--;
    if (left > 0) { paint(); return; }
    stop();
    if (total === FOCUS) {
      done++;
      ticks.replaceChildren();
      for (let i = 0; i < done; i++) ticks.appendChild(el('span', 'pm-tick on', '\u25c9'));
      total = BREAK; left = BREAK; mode.textContent = 'Descanso';
      notify('Pomodoro completado', 'Descansa 5 minutos.');
    } else {
      total = FOCUS; left = FOCUS; mode.textContent = 'Foco';
      notify('Descanso terminado', '¡A por el siguiente pomodoro!');
    }
    paint();
  };

  start.addEventListener('click', () => {
    if (running) { stop(); return; }
    go();
    pomoTimer = setInterval(tick, 1000);
  });
  reset.addEventListener('click', () => {
    stop();
    total = FOCUS; left = FOCUS; mode.textContent = 'Foco';
    paint();
  });
  paint();
}

registerApp({
  id: 'pomodoro',
  name: 'Pomodoro',
  icon: '\u25d4',
  w: 340,
  h: 420,
  mount: mountPomodoroApp,
  onClose: () => { clearInterval(pomoTimer); pomoTimer = null; }
});