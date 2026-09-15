import { TOTAL_DAYS, typeForDay, isDayCompleted, EXERCISES_BY_TYPE } from './model.js';

// ---- Aggregation of a single exercise's sets ----
export function aggregateExercise(exerciseKey, exerciseData) {
  if (!exerciseData) return null;
  const sets = exerciseData.sets || [];
  if (exerciseKey === 'bulgarian') {
    const perSetTotals = sets.map(s => (s && s.left != null && s.right != null) ? (Number(s.left) + Number(s.right)) : null);
    const valid = perSetTotals.filter(v => v != null);
    if (!valid.length) return null;
    return {
      total: valid.reduce((a, b) => a + b, 0),
      bestSet: Math.max(...valid),
      setsCompleted: valid.length,
    };
  }
  const valid = sets.filter(v => v != null).map(Number);
  if (!valid.length) return null;
  return {
    total: valid.reduce((a, b) => a + b, 0),
    bestSet: Math.max(...valid),
    setsCompleted: valid.length,
  };
}

export function aggregateDay(dayRec) {
  if (!dayRec) return null;
  const defs = EXERCISES_BY_TYPE[dayRec.type];
  const out = {};
  for (const def of defs) {
    out[def.key] = aggregateExercise(def.key, dayRec.exercises[def.key]);
  }
  return out;
}

export function isExerciseFullyLogged(exerciseKey, exerciseData, setsCount) {
  if (!exerciseData) return false;
  const sets = exerciseData.sets || [];
  if (sets.length < setsCount) return false;
  if (exerciseKey === 'bulgarian') {
    return sets.every(s => s && s.left != null && s.right != null);
  }
  return sets.every(v => v != null);
}

export function isDayFullyLogged(dayRec) {
  if (!dayRec) return false;
  const defs = EXERCISES_BY_TYPE[dayRec.type];
  return defs.every(def => isExerciseFullyLogged(def.key, dayRec.exercises[def.key], def.setsCount));
}

// ---- Record categories tracked chronologically, per workout type ----
const RECORD_CATEGORIES = {
  A: [
    { id: 'pushupSet', label: 'Flexões — melhor série', exerciseKey: 'pushups', field: 'bestSet', unit: 'reps' },
    { id: 'pushupTotal', label: 'Flexões — total no treino', exerciseKey: 'pushups', field: 'total', unit: 'reps' },
    { id: 'pushupIsoBest', label: 'Isometria — melhor tempo', exerciseKey: 'pushupIso', field: 'bestSet', unit: 's' },
    { id: 'pushupIsoTotal', label: 'Isometria — tempo total', exerciseKey: 'pushupIso', field: 'total', unit: 's' },
  ],
  B: [
    { id: 'pullupSet', label: 'Barra — melhor série', exerciseKey: 'pullups', field: 'bestSet', unit: 'reps' },
    { id: 'pullupTotal', label: 'Barra — total no treino', exerciseKey: 'pullups', field: 'total', unit: 'reps' },
    { id: 'deadHangBest', label: 'Dead Hang — melhor tempo', exerciseKey: 'deadHang', field: 'bestSet', unit: 's' },
    { id: 'deadHangTotal', label: 'Dead Hang — tempo total', exerciseKey: 'deadHang', field: 'total', unit: 's' },
  ],
  C: [
    { id: 'bulgarianSet', label: 'Búlgaro — melhor série', exerciseKey: 'bulgarian', field: 'bestSet', unit: 'reps' },
    { id: 'bulgarianTotal', label: 'Búlgaro — total no treino', exerciseKey: 'bulgarian', field: 'total', unit: 'reps' },
    { id: 'wallSitBest', label: 'Wall Sit — melhor tempo', exerciseKey: 'wallSit', field: 'bestSet', unit: 's' },
    { id: 'wallSitTotal', label: 'Wall Sit — tempo total', exerciseKey: 'wallSit', field: 'total', unit: 's' },
  ],
};

export function allRecordCategories() {
  return [...RECORD_CATEGORIES.A, ...RECORD_CATEGORIES.B, ...RECORD_CATEGORIES.C];
}

// Full, deterministic recompute from scratch: XP, records, per-day PRs, streaks.
export function computeAll(state) {
  const bestByCategory = {};
  for (const cat of allRecordCategories()) bestByCategory[cat.id] = { value: 0, day: null };

  const perDay = {};
  let totalXP = 0;
  let recordsBrokenTotal = 0;
  let workoutsCompleted = 0;

  for (let day = 1; day <= TOTAL_DAYS; day++) {
    const dayRec = state.days[day];
    if (!isDayCompleted(dayRec)) continue;
    workoutsCompleted++;
    const type = dayRec.type;
    const agg = aggregateDay(dayRec);
    const cats = RECORD_CATEGORIES[type];
    const brokenHere = [];
    for (const cat of cats) {
      const exAgg = agg[cat.exerciseKey];
      if (!exAgg) continue;
      const value = exAgg[cat.field];
      if (value != null && value > bestByCategory[cat.id].value) {
        bestByCategory[cat.id] = { value, day };
        brokenHere.push(cat.id);
      }
    }
    let dayXP = 100 + brokenHere.length * 50;
    recordsBrokenTotal += brokenHere.length;
    totalXP += dayXP;
    perDay[day] = { aggregates: agg, records: brokenHere, xp: dayXP };
  }

  // Streak bonuses: consecutive completed-day runs across the whole timeline.
  let run = 0;
  for (let day = 1; day <= TOTAL_DAYS; day++) {
    if (isDayCompleted(state.days[day])) {
      run++;
      if (run === 3) totalXP += 100;
      if (run === 7) totalXP += 250;
    } else {
      run = 0;
    }
  }

  return { bestByCategory, perDay, totalXP, recordsBrokenTotal, workoutsCompleted };
}

export function computeStreaks(state, currentDay) {
  const completed = d => isDayCompleted(state.days[d]);
  let longest = 0, streak = 0;
  for (let d = 1; d <= TOTAL_DAYS; d++) {
    if (completed(d)) { streak++; longest = Math.max(longest, streak); }
    else streak = 0;
  }
  let cur = 0;
  let d = completed(currentDay) ? currentDay : currentDay - 1;
  while (d >= 1 && completed(d)) { cur++; d--; }
  return { current: cur, best: longest };
}

export function currentDayNumber(state, now = new Date()) {
  if (!state.startDate) return 1;
  const start = new Date(state.startDate);
  const startMidnight = new Date(start.getFullYear(), start.getMonth(), start.getDate());
  const nowMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const diffDays = Math.round((nowMidnight - startMidnight) / 86400000);
  return Math.min(TOTAL_DAYS, Math.max(1, diffDays + 1));
}

// Most recent previous completed day of the same type, for comparison.
export function previousSimilarDay(state, day) {
  const type = typeForDay(day);
  for (let d = day - 1; d >= 1; d--) {
    if (typeForDay(d) === type && isDayCompleted(state.days[d])) return state.days[d];
  }
  return null;
}

export function compareAggregates(prevAgg, currAgg, exerciseKey) {
  if (!prevAgg || !prevAgg[exerciseKey] || !currAgg || !currAgg[exerciseKey]) return null;
  const prev = prevAgg[exerciseKey].total;
  const curr = currAgg[exerciseKey].total;
  if (prev == null || curr == null) return null;
  const diff = curr - prev;
  const pct = prev !== 0 ? (diff / prev) * 100 : (curr > 0 ? 100 : 0);
  return { prev, curr, diff, pct };
}

export function formatSignedNumber(n) {
  return (n > 0 ? '+' : '') + n;
}

export function formatSignedPercent(n) {
  const rounded = Math.round(n * 10) / 10;
  return (rounded > 0 ? '+' : '') + rounded + '%';
}
