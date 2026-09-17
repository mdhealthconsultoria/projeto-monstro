import { TOTAL_DAYS, typeForDay, isDayCompleted, EXERCISES_BY_TYPE, LIFE_AREAS, JOURNEY_TOTAL_DAYS, KNOWLEDGE_STAGES, knowledgeStageIndex } from './model.js';
import { habitStats, habitCheckinsFor, dateKey } from './habits.js';
import { BUSINESS_CONCEPTS } from './businessLibrary.js';

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
  if (!currentDay) return { current: 0, best: longest };
  let cur = 0;
  let d = completed(currentDay) ? currentDay : currentDay - 1;
  while (d >= 1 && completed(d)) { cur++; d--; }
  return { current: cur, best: longest };
}

// null means the 30-day challenge hasn't been started yet (startDate unset —
// the user deferred it during onboarding). Callers must handle that state
// explicitly rather than assuming day 1.
export function currentDayNumber(state, now = new Date()) {
  if (!state.startDate) return null;
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

// ---- Life-areas scoring (MONTRO EVOLUTION) ----
//
// Pesos originais pedidos: 40% execução da meta, 25% consistência, 20%
// frequência, 10% streak, 5% reflexão/autoavaliação. Não existe tela de
// reflexão por hábito hoje, então os 5% foram redistribuídos
// proporcionalmente entre os outros quatro — deliberado, não esquecido.
const HABIT_SCORE_WEIGHTS = { goal: 0.42, consistency: 0.26, frequency: 0.21, streak: 0.11 };
const STREAK_SCORE_CAP_DAYS = 14;
const CONSISTENCY_WINDOW_DAYS = 30;

// Fração de dias AGENDADOS (respeitando daysOfWeek) nos últimos N dias em que
// houve check-in — janela recente, distinta de "frequência" (histórico todo).
function habitConsistency(state, habit, windowDays = CONSISTENCY_WINDOW_DAYS) {
  const created = habit.createdAt ? new Date(habit.createdAt) : null;
  const checkins = habitCheckinsFor(state, habit.id);
  const daySet = new Set(checkins.map(c => c.date));
  let scheduled = 0, done = 0;
  const cursor = new Date();
  for (let i = 0; i < windowDays; i++) {
    if (created && cursor < created) break;
    const isScheduled = (habit.frequency === 'custom' || habit.frequency === 'weekly')
      ? (habit.daysOfWeek || []).includes(cursor.getDay())
      : true;
    if (isScheduled) {
      scheduled++;
      if (daySet.has(dateKey(cursor))) done++;
    }
    cursor.setDate(cursor.getDate() - 1);
  }
  return scheduled ? done / scheduled : 0;
}

// Taxa de check-ins sobre o tempo de vida inteiro do hábito (desde criado) —
// mais lenta pra reagir que a consistência, mostra o padrão de longo prazo.
function habitFrequencyRate(state, habit) {
  const checkins = habitCheckinsFor(state, habit.id);
  if (!habit.createdAt) return 0;
  const daysSince = Math.max(1, Math.round((new Date() - new Date(habit.createdAt)) / 86400000) + 1);
  return Math.min(1, checkins.length / daysSince);
}

// 0-100. Recalculado do zero a cada chamada — mesmo princípio de computeAll.
export function computeHabitScore(state, habit) {
  const stats = habitStats(state, habit);
  const goal = stats.progress;
  const consistency = habitConsistency(state, habit);
  const frequency = habitFrequencyRate(state, habit);
  const streak = Math.min(1, stats.streak / STREAK_SCORE_CAP_DAYS);
  const score01 =
    goal * HABIT_SCORE_WEIGHTS.goal +
    consistency * HABIT_SCORE_WEIGHTS.consistency +
    frequency * HABIT_SCORE_WEIGHTS.frequency +
    streak * HABIT_SCORE_WEIGHTS.streak;
  return Math.round(score01 * 100);
}

// O desafio de 30 dias soma como um contribuinte extra da área Físico, além
// dos hábitos de exercício — reaproveita computeAll(), não duplica lógica.
function physicalWorkoutBonus(state) {
  const { workoutsCompleted } = computeAll(state);
  if (!workoutsCompleted) return null;
  return Math.round(Math.min(1, workoutsCompleted / TOTAL_DAYS) * 100);
}

// Contribuição extra da área Conhecimento a partir do sistema de domínio
// (estudar→testar→aplicar→revisar→ensinar→dominar) — mesma ideia do bônus
// de treino em Físico: soma como mais um contribuinte, não substitui hábitos.
function knowledgeProgressBonus(state) {
  const items = Object.values(state.knowledgeItems || {}).filter(i => !i.archived);
  if (!items.length) return null;
  const scores = items.map(i => Math.round(((knowledgeStageIndex(i.stage) + 1) / KNOWLEDGE_STAGES.length) * 100));
  return Math.round(scores.reduce((a, b) => a + b, 0) / scores.length);
}

// null = área sem nenhum hábito ativo ainda (não é 0 — 0 seria "começou e
// está indo mal"; null é "ainda não começou"). A UI decide como mostrar isso.
export function computeAreaScore(state, areaKey) {
  const habitsInArea = Object.values(state.habits).filter(h => h.active && h.area === areaKey);
  const scores = habitsInArea.map(h => computeHabitScore(state, h));
  if (areaKey === 'fisico') {
    const bonus = physicalWorkoutBonus(state);
    if (bonus != null) scores.push(bonus);
  }
  if (areaKey === 'conhecimento') {
    const bonus = knowledgeProgressBonus(state);
    if (bonus != null) scores.push(bonus);
  }
  if (!scores.length) return null;
  return Math.round(scores.reduce((a, b) => a + b, 0) / scores.length);
}

// Média só sobre as áreas que o usuário ativou — uma área nunca escolhida
// nunca derruba a pontuação geral. Se ele não escolheu nenhuma ainda, usa
// todas as áreas como fallback (evita "score sempre zero" antes de configurar).
export function computeMontroScore(state) {
  const active = (state.activeAreas && state.activeAreas.length) ? state.activeAreas : LIFE_AREAS.map(a => a.key);
  const scored = active.map(key => computeAreaScore(state, key)).filter(s => s != null);
  if (!scored.length) return 0;
  return Math.round(scored.reduce((a, b) => a + b, 0) / scored.length);
}

// ---- Health Score (comportamental) ----
//
// Isto NÃO é uma calculadora de risco clínico (tipo PREVENT/ASCVD) — não usa
// fórmula validada nenhuma e não deve ser lida como avaliação médica. É uma
// leitura comportamental simples a partir de dados que o próprio usuário já
// informou (sono, atividade, alimentação, tabagismo, álcool). Cada fator
// ausente é simplesmente ignorado (nunca vira 0 nem é inventado); se nenhum
// fator tiver dado, o score inteiro é null e a tela mostra "dados insuficientes".
function categoryHabitsScore(state, categories) {
  const habits = Object.values(state.habits).filter(h => h.active && categories.includes(h.category));
  if (!habits.length) return null;
  const scores = habits.map(h => computeHabitScore(state, h));
  return Math.round(scores.reduce((a, b) => a + b, 0) / scores.length);
}

const ALCOHOL_SCORE = { none: 100, moderate: 70, high: 30 };

export function computeHealthScore(state) {
  const profile = state.healthProfile || {};
  const factors = [];

  const sleep = categoryHabitsScore(state, ['sono']);
  if (sleep != null) factors.push(sleep);

  const activity = computeAreaScore(state, 'fisico');
  if (activity != null) factors.push(activity);

  const nutrition = categoryHabitsScore(state, ['alimentacao', 'hidratacao']);
  if (nutrition != null) factors.push(nutrition);

  if (profile.smoker === false) factors.push(100);
  else if (profile.smoker === true) factors.push(20);

  if (profile.alcoholLevel && ALCOHOL_SCORE[profile.alcoholLevel] != null) {
    factors.push(ALCOHOL_SCORE[profile.alcoholLevel]);
  }

  if (!factors.length) return null;
  return Math.round(factors.reduce((a, b) => a + b, 0) / factors.length);
}

// ---- Jornada de 90 dias ----
//
// Não é o desafio de calistenia (esse é separado, TOTAL_DAYS=30) — é uma
// jornada de consolidação sobre o app inteiro. "Dia ativo" aqui significa
// pelo menos um check-in de hábito naquela data; é um proxy simples e
// transparente, não uma métrica que tenta capturar tudo que o usuário fez.
export function currentJourneyDay(state, now = new Date()) {
  if (!state.journey90 || !state.journey90.startDate) return null;
  const start = new Date(state.journey90.startDate);
  const startMidnight = new Date(start.getFullYear(), start.getMonth(), start.getDate());
  const nowMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const diffDays = Math.round((nowMidnight - startMidnight) / 86400000);
  return Math.min(JOURNEY_TOTAL_DAYS, Math.max(1, diffDays + 1));
}

export function computeJourneyAdherence(state) {
  const day = currentJourneyDay(state);
  if (!day) return null;
  const checkinDates = new Set(Object.values(state.habitCheckins).map(c => c.date));
  const start = new Date(state.journey90.startDate);
  let active = 0;
  for (let i = 0; i < day; i++) {
    const d = new Date(start.getFullYear(), start.getMonth(), start.getDate() + i);
    if (checkinDates.has(dateKey(d))) active++;
  }
  return { day, active, rate: Math.round((active / day) * 100) };
}

// ---- Value Score (trilha profissional / Business Master) ----
//
// Não é previsão de salário nem avaliação externa — é uma leitura de quanto
// valor profissional/intelectual o usuário está desenvolvendo, combinando as
// áreas Profissional e Conhecimento (já existentes) com a autoaplicação de
// conceitos do Business Master. Mesmo princípio de fatores ausentes ignorados
// usado no Health Score.
export function computeValueScore(state) {
  const factors = [];

  const prof = computeAreaScore(state, 'profissional');
  if (prof != null) factors.push(prof);

  const know = computeAreaScore(state, 'conhecimento');
  if (know != null) factors.push(know);

  const applied = (state.businessConcepts && state.businessConcepts.appliedIds) ? state.businessConcepts.appliedIds.length : 0;
  if (applied > 0) factors.push(Math.round(Math.min(1, applied / BUSINESS_CONCEPTS.length) * 100));

  if (!factors.length) return null;
  return Math.round(factors.reduce((a, b) => a + b, 0) / factors.length);
}
