import { loadState, saveState, clearAllData } from './db.js';
import { defaultState, emptyDay, typeForDay, levelForXP } from './model.js';
import { computeAll, computeStreaks, currentDayNumber } from './logic.js';
import { todayISO } from './utils.js';

class Store {
  constructor() {
    this.state = null;
    this.listeners = new Set();
    this.saveTimer = null;
  }

  async init() {
    let state = await loadState();
    if (!state) {
      state = defaultState();
      state.startDate = todayISO();
      await saveState(state);
    }
    // migration safety: ensure shape
    if (!state.tests) state.tests = { day1: null, day30: null };
    if (!state.days) state.days = {};
    this.state = state;
    this.recompute();
  }

  recompute() {
    this.derived = {
      currentDay: currentDayNumber(this.state),
      computed: computeAll(this.state),
    };
    this.derived.streaks = computeStreaks(this.state, this.derived.currentDay);
    this.derived.level = levelForXP(this.derived.computed.totalXP);
  }

  subscribe(fn) {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  notify() {
    for (const fn of this.listeners) fn(this.state, this.derived);
  }

  persist() {
    clearTimeout(this.saveTimer);
    // Save immediately (debounced only to coalesce rapid successive calls in the same tick).
    this.saveTimer = setTimeout(() => {
      saveState(this.state).catch(err => console.error('Falha ao salvar dados', err));
    }, 0);
  }

  // Run a mutation against the raw state, then recompute + persist + notify.
  mutate(fn) {
    fn(this.state);
    this.recompute();
    this.persist();
    this.notify();
  }

  getDay(day) {
    return this.state.days[day] || null;
  }

  ensureDay(day) {
    if (!this.state.days[day]) {
      this.state.days[day] = emptyDay(day);
    }
    return this.state.days[day];
  }

  async resetAll() {
    await clearAllData();
    this.state = defaultState();
    this.state.startDate = todayISO();
    await saveState(this.state);
    this.recompute();
    this.notify();
  }
}

export const store = new Store();
export { typeForDay };
