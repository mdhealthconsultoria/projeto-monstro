import { loadState, saveState, clearStateForUser } from './db.js';
import { defaultState, emptyDay, typeForDay, levelForXP } from './model.js';
import { computeAll, computeStreaks, currentDayNumber } from './logic.js';
import { todayISO } from './utils.js';

class Store {
  constructor() {
    this.state = null;
    this.userId = null;
    this.listeners = new Set();
    this.saveTimer = null;
  }

  async loadForUser(userId) {
    this.userId = userId;
    let state = await loadState(userId);
    if (!state) {
      state = defaultState();
      await saveState(userId, state);
    }
    // migration safety: ensure shape for installs created before a field existed
    const fresh = defaultState();
    for (const key of Object.keys(fresh)) {
      if (state[key] === undefined) state[key] = fresh[key];
    }
    this.state = state;
    this.recompute();
  }

  clearActive() {
    this.userId = null;
    this.state = null;
    this.derived = null;
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
    const userId = this.userId;
    // Save immediately (debounced only to coalesce rapid successive calls in the same tick).
    this.saveTimer = setTimeout(() => {
      saveState(userId, this.state).catch(err => console.error('Falha ao salvar dados', err));
    }, 0);
  }

  // Run a mutation against the raw state, then recompute + persist + notify.
  mutate(fn) {
    fn(this.state);
    this.recompute();
    this.persist();
    this.notify();
  }

  // Begin the 30-day challenge today (called from onboarding or a deferred start).
  startChallengeToday() {
    this.mutate(s => { if (!s.startDate) s.startDate = todayISO(); });
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
    await clearStateForUser(this.userId);
    this.state = defaultState();
    await saveState(this.userId, this.state);
    this.recompute();
    this.notify();
  }
}

export const store = new Store();
export { typeForDay };
