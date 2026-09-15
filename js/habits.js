// Habit / "Minha Base" domain logic — pure functions over state.habits and
// state.habitCheckins, same recompute-from-scratch principle as the workout
// module (streaks/totals are always derived from real check-ins).
import { uid, todayISO } from './utils.js';

export const HABIT_CATEGORIES = [
  { key: 'ingles', label: 'Inglês', icon: 'book', color: '#ff7a1a' },
  { key: 'leitura', label: 'Leitura', icon: 'book', color: '#4fae6a' },
  { key: 'estudos', label: 'Estudos', icon: 'edit', color: '#ffb347' },
  { key: 'oracao', label: 'Oração', icon: 'heart', color: '#e5484d' },
  { key: 'sono', label: 'Sono', icon: 'moon', color: '#7c9cff' },
  { key: 'alimentacao', label: 'Alimentação', icon: 'target', color: '#4fae6a' },
  { key: 'trabalho', label: 'Trabalho', icon: 'briefcase', color: '#a89f92' },
  { key: 'hidratacao', label: 'Hidratação', icon: 'droplet', color: '#4fb8e0' },
  { key: 'personalizado', label: 'Personalizado', icon: 'target', color: '#ff7a1a' },
];

export function categoryFor(key) {
  return HABIT_CATEGORIES.find(c => c.key === key) || HABIT_CATEGORIES[HABIT_CATEGORIES.length - 1];
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

export function newHabit({ title, category = 'personalizado', icon, frequency = 'daily', daysOfWeek = [0, 1, 2, 3, 4, 5, 6], goalDays = 30, reminder = null, color, description = '', templateId = null }) {
  const cat = categoryFor(category);
  return {
    id: uid(),
    title: title.trim(),
    category,
    icon: icon || cat.icon,
    frequency,
    daysOfWeek,
    goalDays,
    reminder,
    color: color || cat.color,
    description,
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
