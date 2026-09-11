/* ── horario-data.js ── user-configurable class schedule.
   Kept in chrome.storage.local ('_horario'), not in the codebase,
   so the extension ships with no personal schedule data.
   Configure it from the GUI panel: Widgets ▸ Horario. */
import { storageGet, storageSet } from './core.js';

export const SCHEDULE_KEY = '_horario';

export const EMPTY_SCHEDULE = {
  courseStart: '',
  courseEnd: '',
  weekly: [],    // { dow (0 Lunes..4 Viernes), start "HH:MM", end "HH:MM", subject, room }
  holidays: []   // { from "YYYY-MM-DD", to "YYYY-MM-DD", reason }
};

export async function getSchedule() {
  const d = await storageGet([SCHEDULE_KEY]);
  const raw = (d && d[SCHEDULE_KEY]) || EMPTY_SCHEDULE;
  return {
    courseStart: typeof raw.courseStart === 'string' ? raw.courseStart : '',
    courseEnd: typeof raw.courseEnd === 'string' ? raw.courseEnd : '',
    weekly: Array.isArray(raw.weekly) ? raw.weekly : [],
    holidays: Array.isArray(raw.holidays) ? raw.holidays : []
  };
}

export async function saveSchedule(patch) {
  const cur = await getSchedule();
  const next = { ...cur, ...patch };
  await storageSet({ [SCHEDULE_KEY]: next });
  return next;
}