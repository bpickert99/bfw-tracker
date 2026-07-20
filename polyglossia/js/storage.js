// Progress persistence — all local, no accounts.
const KEY = "polyglossia.v1";

function today() {
  return new Date().toISOString().slice(0, 10);
}

function load() {
  try {
    return JSON.parse(localStorage.getItem(KEY)) || {};
  } catch {
    return {};
  }
}

let state = load();
state.xp = state.xp || 0;
state.completed = state.completed || {};
state.streak = state.streak || { count: 0, lastDate: null };

function save() {
  localStorage.setItem(KEY, JSON.stringify(state));
}

export function getXP() {
  return state.xp;
}

export function addXP(amount) {
  state.xp += amount;
  bumpStreak();
  save();
}

function bumpStreak() {
  const t = today();
  const last = state.streak.lastDate;
  if (last === t) return;
  const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
  state.streak.count = last === yesterday ? state.streak.count + 1 : 1;
  state.streak.lastDate = t;
}

export function getStreak() {
  const last = state.streak.lastDate;
  if (!last) return 0;
  const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
  // Streak shows as broken if the last activity was before yesterday
  return last === today() || last === yesterday ? state.streak.count : 0;
}

export function markLessonComplete(lang, unitId, lessonId) {
  const key = `${lang}/${unitId}/${lessonId}`;
  const rec = state.completed[key] || { times: 0 };
  rec.times += 1;
  rec.lastAt = Date.now();
  state.completed[key] = rec;
  save();
}

export function isLessonComplete(lang, unitId, lessonId) {
  return !!state.completed[`${lang}/${unitId}/${lessonId}`];
}

export function unitProgress(lang, unitId, lessonIds) {
  if (!lessonIds.length) return 0;
  const done = lessonIds.filter((id) => isLessonComplete(lang, unitId, id)).length;
  return done / lessonIds.length;
}

export function getLang() {
  return state.lang || null;
}

export function setLang(code) {
  state.lang = code;
  save();
}
