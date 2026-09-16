// Domain model: workout cycle, day records, defaults. Pure data helpers, no I/O.

export const TOTAL_DAYS = 30;
export const REST_SECONDS_DEFAULT = 90;

export const WORKOUT_TYPES = {
  A: { key: 'A', name: 'PUSH', label: 'Treino A · PUSH' },
  B: { key: 'B', name: 'PULL', label: 'Treino B · PULL' },
  C: { key: 'C', name: 'LEGS', label: 'Treino C · LEGS' },
};

export function typeForDay(day) {
  const idx = (day - 1) % 3;
  return idx === 0 ? 'A' : idx === 1 ? 'B' : 'C';
}

// Exercise definitions per workout type, in execution order.
export const EXERCISES_BY_TYPE = {
  A: [
    { key: 'pushups', name: 'Flexões', mode: 'reps', setsCount: 5, unit: 'reps' },
    { key: 'pushupIso', name: 'Isometria de Flexão', mode: 'time', setsCount: 3, unit: 's' },
  ],
  B: [
    { key: 'pullups', name: 'Barra Fixa', mode: 'reps', setsCount: 5, unit: 'reps' },
    { key: 'deadHang', name: 'Dead Hang', mode: 'time', setsCount: 3, unit: 's' },
  ],
  C: [
    { key: 'bulgarian', name: 'Agachamento Búlgaro', mode: 'legs', setsCount: 5, unit: 'reps' },
    { key: 'wallSit', name: 'Wall Sit', mode: 'time', setsCount: 3, unit: 's' },
  ],
};

export function emptyExercisesForType(type) {
  const ex = {};
  for (const def of EXERCISES_BY_TYPE[type]) {
    if (def.mode === 'legs') {
      ex[def.key] = { sets: Array.from({ length: def.setsCount }, () => ({ left: null, right: null, weightKg: null })) };
    } else {
      ex[def.key] = { sets: Array.from({ length: def.setsCount }, () => null) };
    }
  }
  return ex;
}

export function emptyDay(day) {
  const type = typeForDay(day);
  return {
    day,
    type,
    exercises: emptyExercisesForType(type),
    checkin: null,
    startedAt: null,
    completedAt: null,
  };
}

export function isDayCompleted(dayRec) {
  return !!(dayRec && dayRec.completedAt);
}

export function isDayStarted(dayRec) {
  return !!(dayRec && dayRec.startedAt);
}

export function defaultState() {
  return {
    version: 2,
    startDate: null,
    days: {},
    tests: { day1: null, day30: null },
    activeSession: null,
    habits: {},
    habitCheckins: {},
    dailyTasks: [],
    dailyTaskCompletions: {},
    bodyMetrics: { heightCm: null, weights: [] },
    breathing: { reminderTime: null, lastCompletedAt: null, sessions: [] },
    bodyDiaryConsent: false,
    lastModifiedAt: null,
  };
}

export const LEVELS = [
  { level: 1, name: 'INÍCIO', min: 0 },
  { level: 2, name: 'DISCIPLINA', min: 300 },
  { level: 3, name: 'CONSISTÊNCIA', min: 800 },
  { level: 4, name: 'FORÇA', min: 1500 },
  { level: 5, name: 'MONSTRO', min: 2500 },
];

export function levelForXP(xp) {
  let current = LEVELS[0];
  for (const l of LEVELS) {
    if (xp >= l.min) current = l;
  }
  const idx = LEVELS.indexOf(current);
  const next = LEVELS[idx + 1] || null;
  return {
    ...current,
    next,
    xpIntoLevel: xp - current.min,
    xpForNext: next ? next.min - current.min : null,
    progress: next ? (xp - current.min) / (next.min - current.min) : 1,
  };
}
