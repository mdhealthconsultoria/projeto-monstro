import { loadState, saveState, clearStateForUser } from './db.js';
import { defaultState, emptyDay, typeForDay, levelForXP } from './model.js';
import { computeAll, computeStreaks, currentDayNumber } from './logic.js';
import { todayISO } from './utils.js';
import { supabaseClient } from './services/supabaseClient.js';

// Distinguishes an untouched row (the signup trigger inserts a bare `{}`)
// from one the app has actually written to at least once — checking only
// `days` missed the very common case of "started the challenge, haven't
// logged a workout yet" (startDate set, days still empty), which made a
// second device see a brand new user instead of the one that just signed up.
function hasRealData(state) {
  if (!state) return false;
  if (state.startDate) return true;
  if (state.days && Object.keys(state.days).length) return true;
  if (state.habits && Object.keys(state.habits).length) return true;
  if (state.dailyTasks && state.dailyTasks.length) return true;
  if (state.tests && (state.tests.day1 || state.tests.day30)) return true;
  if (state.bodyMetrics && (state.bodyMetrics.heightCm || (state.bodyMetrics.weights && state.bodyMetrics.weights.length))) return true;
  return false;
}

class Store {
  constructor() {
    this.state = null;
    this.userId = null;
    this.listeners = new Set();
    this.saveTimer = null;
    this.syncStatus = 'idle'; // 'idle' | 'saving' | 'saved' | 'offline' | 'error'
    window.addEventListener('online', () => this.pushToCloud());
  }

  async loadForUser(userId) {
    this.userId = userId;
    let local = await loadState(userId);

    let remote = null;
    try {
      const { data, error } = await supabaseClient
        .from('user_app_state')
        .select('state, updated_at')
        .eq('user_id', userId)
        .maybeSingle();
      if (!error) remote = data;
    } catch { /* offline or unreachable — local is the only option */ }

    let state;
    if (hasRealData(remote && remote.state)) {
      const localNewer = local && local.lastModifiedAt && new Date(local.lastModifiedAt) > new Date(remote.updated_at);
      state = localNewer ? local : remote.state;
    } else {
      state = local || defaultState();
    }

    // migration safety: ensure shape for installs created before a field existed
    const fresh = defaultState();
    for (const key of Object.keys(fresh)) {
      if (state[key] === undefined) state[key] = fresh[key];
    }

    this.state = state;
    this.recompute();
    await saveState(userId, this.state);
    this.pushToCloud();
  }

  clearActive() {
    this.userId = null;
    this.state = null;
    this.derived = null;
    this.syncStatus = 'idle';
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
    const snapshot = this.state;
    // Save immediately (debounced only to coalesce rapid successive calls in the same tick).
    this.saveTimer = setTimeout(() => {
      saveState(userId, snapshot).catch(err => console.error('Falha ao salvar dados localmente', err));
      this.pushToCloud(snapshot);
    }, 0);
  }

  async pushToCloud(snapshot = this.state) {
    if (!this.userId || !snapshot) return;
    this.syncStatus = 'saving';
    this.notify();
    try {
      const { error } = await supabaseClient
        .from('user_app_state')
        .upsert({ user_id: this.userId, state: snapshot }, { onConflict: 'user_id' });
      if (error) throw error;
      this.syncStatus = 'saved';
    } catch (err) {
      this.syncStatus = navigator.onLine ? 'error' : 'offline';
      console.error('Falha ao sincronizar com a nuvem', err);
    }
    this.notify();
  }

  // Run a mutation against the raw state, then recompute + persist + notify.
  mutate(fn) {
    fn(this.state);
    this.state.lastModifiedAt = todayISO();
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
    await this.pushToCloud();
  }
}

export const store = new Store();
export { typeForDay };
