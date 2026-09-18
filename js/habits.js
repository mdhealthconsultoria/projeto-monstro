// Habit / "Minha Base" domain logic — pure functions over state.habits and
// state.habitCheckins, same recompute-from-scratch principle as the workout
// module (streaks/totals are always derived from real check-ins).
import { uid, todayISO } from './utils.js';

export const HABIT_CATEGORIES = [
  { key: 'ingles', label: 'Inglês', icon: 'book', color: '#4aa8d8', area: 'conhecimento' },
  { key: 'leitura', label: 'Leitura', icon: 'book', color: '#4aa8d8', area: 'conhecimento' },
  { key: 'estudos', label: 'Estudos', icon: 'edit', color: '#4aa8d8', area: 'conhecimento' },
  { key: 'exercicio', label: 'Exercício', icon: 'bolt', color: '#2b8c80', area: 'fisico' },
  { key: 'oracao', label: 'Oração', icon: 'heart', color: '#7c9cff', area: 'mente' },
  { key: 'sono', label: 'Sono', icon: 'moon', color: '#4fd1c5', area: 'saude' },
  { key: 'alimentacao', label: 'Alimentação', icon: 'target', color: '#4fd1c5', area: 'saude' },
  { key: 'trabalho', label: 'Trabalho', icon: 'briefcase', color: '#6e90a8', area: 'profissional' },
  { key: 'hidratacao', label: 'Hidratação', icon: 'droplet', color: '#4fd1c5', area: 'saude' },
  { key: 'personalizado', label: 'Personalizado', icon: 'target', color: '#7c9cff', area: 'mente' },
];

export function categoryFor(key) {
  return HABIT_CATEGORIES.find(c => c.key === key) || HABIT_CATEGORIES[HABIT_CATEGORIES.length - 1];
}

// Default area a habit belongs to, from its category — callers (e.g. the
// habit library) may still set an explicit `area` on newHabit() to override.
export function areaForCategory(key) {
  return categoryFor(key).area;
}

export const WEEKDAYS = [
  { key: 0, label: 'D' }, { key: 1, label: 'S' }, { key: 2, label: 'T' },
  { key: 3, label: 'Q' }, { key: 4, label: 'Q' }, { key: 5, label: 'S' }, { key: 6, label: 'S' },
];

export function dateKey(date = new Date()) {
  return new Intl.DateTimeFormat('en-CA', { year: 'numeric', month: '2-digit', day: '2-digit' }).format(date);
}

export function checkinId(habitId, day) {
  return `${habitId}:${day}`;
}

export function newHabit({ title, category = 'personalizado', area = null, icon, frequency = 'daily', daysOfWeek = [0, 1, 2, 3, 4, 5, 6], goalDays = 30, reminder = null, color, description = '', templateId = null, mechanism = null, evidenceLevel = null, source = null }) {
  const cat = categoryFor(category);
  return {
    id: uid(),
    title: title.trim(),
    category,
    area: area || cat.area,
    icon: icon || cat.icon,
    frequency,
    daysOfWeek,
    goalDays,
    reminder,
    color: color || cat.color,
    description,
    // Preenchidos quando o hábito vem da biblioteca com evidência (habitLibrary.js);
    // null para hábitos personalizados — a tela de hábito só mostra o selo quando existe.
    mechanism,
    evidenceLevel,
    source,
    active: true,
    createdAt: todayISO(),
    templateId,
  };
}

export const ENGLISH_90_TEMPLATE = {
  templateId: 'english-90',
  title: 'Inglês — Desafio 90 dias',
  category: 'ingles',
  frequency: 'daily',
  goalDays: 90,
  description: 'Um check-in por dia, com o que você aprendeu. 90 dias seguidos de inglês.',
};

export function createEnglish90Habit() {
  return newHabit({ ...ENGLISH_90_TEMPLATE });
}

// Builds a real habit from a habitLibrary.js entry — same construction path
// as createEnglish90Habit(), just parameterized over the library item.
export function createLibraryHabit(libItem) {
  return newHabit({
    title: libItem.title,
    category: libItem.category,
    area: libItem.area,
    frequency: libItem.frequency,
    daysOfWeek: libItem.daysOfWeek,
    description: libItem.description,
    mechanism: libItem.mechanism,
    evidenceLevel: libItem.evidenceLevel,
    source: libItem.source,
    templateId: libItem.templateId || `lib:${libItem.id}`,
  });
}

export const DEFAULT_CHECKLIST_ITEMS = [
  'Treinar', 'Estudar inglês', 'Beber água', 'Ler', 'Dormir cedo', 'Orar',
];

// ---- Habit check-in aggregates ----
export function habitCheckinsFor(state, habitId) {
  return Object.values(state.habitCheckins).filter(c => c.habitId === habitId);
}

export function isHabitCheckedToday(state, habitId, today = new Date()) {
  const key = dateKey(today);
  return !!state.habitCheckins[checkinId(habitId, key)];
}

export function habitStats(state, habit, today = new Date()) {
  const checkins = habitCheckinsFor(state, habit.id);
  const total = checkins.length;
  const daySet = new Set(checkins.map(c => c.date));

  // Streak: consecutive calendar days (respecting the habit's active days of
  // the week — an inactive day doesn't break the streak) ending today or yesterday.
  function isScheduled(date) {
    if (habit.frequency !== 'custom' && habit.frequency !== 'weekly') return true;
    return (habit.daysOfWeek || []).includes(date.getDay());
  }

  let cur = 0;
  let cursor = new Date(today);
  const todayKey = dateKey(cursor);
  if (!daySet.has(todayKey) && isScheduled(cursor)) {
    cursor.setDate(cursor.getDate() - 1);
  }
  for (let i = 0; i < 400; i++) {
    const k = dateKey(cursor);
    if (daySet.has(k)) {
      cur++;
      cursor.setDate(cursor.getDate() - 1);
      continue;
    }
    if (!isScheduled(cursor)) {
      cursor.setDate(cursor.getDate() - 1);
      continue;
    }
    break;
  }

  return { total, streak: cur, goalDays: habit.goalDays, progress: habit.goalDays ? Math.min(1, total / habit.goalDays) : 0 };
}

// Maior sequência já alcançada NA HISTÓRIA do hábito (diferente de
// habitStats().streak, que é só a sequência atual e pode zerar). Usado
// pra conquistas — uma vez alcançada, o recorde não desaparece se a
// sequência atual quebrar depois.
export function habitBestStreak(state, habit) {
  const checkins = habitCheckinsFor(state, habit.id);
  if (!checkins.length) return 0;
  const daySet = new Set(checkins.map(c => c.date));
  function isScheduled(date) {
    if (habit.frequency !== 'custom' && habit.frequency !== 'weekly') return true;
    return (habit.daysOfWeek || []).includes(date.getDay());
  }
  const dates = [...daySet].map(k => new Date(k)).sort((a, b) => a - b);
  const cursor = new Date(dates[0]);
  const last = dates[dates.length - 1];
  let best = 0, current = 0;
  while (cursor <= last) {
    const k = dateKey(cursor);
    if (daySet.has(k)) {
      current++;
      best = Math.max(best, current);
    } else if (isScheduled(cursor)) {
      current = 0;
    }
    cursor.setDate(cursor.getDate() + 1);
  }
  return best;
}
