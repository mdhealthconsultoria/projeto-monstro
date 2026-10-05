import { loadState, saveState, clearStateForUser } from './db.js';
import { defaultState, emptyDay, typeForDay, levelForXP, LIFE_AREAS } from './model.js';
import { computeAll, computeStreaks, currentDayNumber, computeAreaScore, computeMontroScore, computeHealthScore, currentJourneyDay, computeJourneyAdherence, computeValueScore } from './logic.js';
import { todayISO } from './utils.js';
import { supabaseClient } from './services/supabaseClient.js';
import { deleteAllPhotosCloud } from './services/photosCloud.js';
import { computeEarnedBadgeIds } from './badges.js';
import { syncMyBenchmarkStats } from './services/benchmark.js';
import { mergeStates } from './merge.js';

// Distinguishes an untouched row (the signup trigger inserts a bare `{}`)
// from one the app has actually written to at least once — checking only
// `days` missed the very common case of "started the challenge, haven't
// logged a workout yet" (startDate set, days still empty), which made a
// second device see a brand new user instead of the one that just signed up.
// A coluna `revision` só existe depois que a migration 0010 for aplicada
// manualmente no Supabase (ver supabase/migrations/0010_user_app_state_revision.sql)
// — até lá, PostgREST recusa qualquer select/update que a mencione, mas com
// código DIFERENTE dependendo da operação: 42703 (erro nativo do Postgres,
// "undefined_column") num SELECT comum, e PGRST204 (erro sintético do
// PostgREST, cache de schema) num INSERT/UPDATE/UPSERT que inclua a coluna
// no payload. Precisa checar os dois. Mesmo padrão de degradação graciosa
// usado em moderation.js e benchmark.js (isMissingTable), só que pra coluna.
function isMissingRevisionColumn(error) {
  if (!error) return false;
  if (error.code === 'PGRST204' || error.code === '42703') return true;
  return /column .*revision.* does not exist|could not find the 'revision' column/i.test(error.message || '');
}

function hasRealData(state) {
  if (!state) return false;
  if (state.startDate) return true;
  if (state.days && Object.keys(state.days).length) return true;
  if (state.habits && Object.keys(state.habits).length) return true;
  if (state.dailyTasks && state.dailyTasks.length) return true;
  if (state.tests && (state.tests.day1 || state.tests.day30)) return true;
  if (state.bodyMetrics && (state.bodyMetrics.heightCm || (state.bodyMetrics.weights && state.bodyMetrics.weights.length))) return true;
  if (state.breathing && (state.breathing.reminderTime || state.breathing.lastCompletedAt || (state.breathing.sessions && state.breathing.sessions.length))) return true;
  if (state.activeAreas && state.activeAreas.length) return true;
  if (state.healthProfile && (state.healthProfile.smoker != null || state.healthProfile.alcoholLevel || state.healthProfile.birthYear || (state.healthProfile.conditions && state.healthProfile.conditions.length) || (state.healthProfile.measurements && state.healthProfile.measurements.length))) return true;
  if (state.focus && state.focus.sessions && state.focus.sessions.length) return true;
  if (state.journey90 && state.journey90.startDate) return true;
  if (state.businessConcepts && state.businessConcepts.appliedIds && state.businessConcepts.appliedIds.length) return true;
  if (state.knowledgeItems && Object.keys(state.knowledgeItems).length) return true;
  return false;
}

class Store {
  constructor() {
    this.state = null;
    this.userId = null;
    this.listeners = new Set();
    this.saveTimer = null;
    this.syncStatus = 'idle'; // 'idle' | 'saving' | 'saved' | 'offline' | 'error'
    this.remoteRevision = 0; // revisão de user_app_state lida da última vez — ver pushToCloud()
    this.syncQueue = Promise.resolve(); // serializa escritas — ver pushToCloud()
    window.addEventListener('online', () => this.pushToCloud());
  }

  async loadForUser(userId) {
    this.userId = userId;
    let local = await loadState(userId);

    let remote = null;
    try {
      const { data, error } = await supabaseClient
        .from('user_app_state')
        .select('state, updated_at, revision')
        .eq('user_id', userId)
        .maybeSingle();
      if (!error) {
        remote = data;
      } else if (isMissingRevisionColumn(error)) {
        const retry = await supabaseClient
          .from('user_app_state')
          .select('state, updated_at')
          .eq('user_id', userId)
          .maybeSingle();
        if (!retry.error) remote = retry.data;
      }
    } catch { /* offline or unreachable — local is the only option */ }

    this.remoteRevision = remote ? (remote.revision || 0) : 0;

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

    const areaScores = {};
    for (const area of LIFE_AREAS) areaScores[area.key] = computeAreaScore(this.state, area.key);
    this.derived.areaScores = areaScores;
    this.derived.montroScore = computeMontroScore(this.state);
    this.derived.healthScore = computeHealthScore(this.state);
    this.derived.journeyDay = currentJourneyDay(this.state);
    this.derived.journeyAdherence = computeJourneyAdherence(this.state);
    this.derived.valueScore = computeValueScore(this.state);
    this.derived.earnedBadgeIds = computeEarnedBadgeIds(this.state, this.derived);
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
    // Lê this.state só dentro do callback (não captura referência antes) —
    // ver comentário em pushToCloud sobre por que uma referência capturada
    // cedo demais pode ficar velha.
    this.saveTimer = setTimeout(() => {
      saveState(userId, this.state).catch(err => console.error('Falha ao salvar dados localmente', err));
      this.pushToCloud();
    }, 0);
  }

  // Enfileira a escrita em vez de disparar na hora, e NUNCA fixa qual
  // snapshot vai gravar até o momento em que a escrita realmente roda — só
  // lê this.state ao vivo dentro de pushOnce(). As duas coisas resolvem
  // problemas diferentes:
  // 1) Duas chamadas disparadas em paralelo (ex. o listener de 'online' MAIS
  //    um persist() pendente de quando ainda estava offline) colidiriam uma
  //    na expectedRevision da outra e esgotariam as tentativas — a fila
  //    serializa isso.
  // 2) Se a primeira escrita da fila colidir em revisão com outro aparelho,
  //    pushWithRetry troca this.state por um merge (this.state = merged).
  //    Uma segunda escrita que já tivesse capturado o this.state ANTIGO
  //    (antes do merge) sobrescreveria o merge com dado velho quando
  //    finalmente rodasse — por isso cada chamada só decide o que gravar
  //    quando é a sua vez de executar, nunca antes.
  pushToCloud() {
    if (!this.userId) return Promise.resolve();
    const run = () => this.pushOnce();
    this.syncQueue = this.syncQueue.then(run, run);
    return this.syncQueue;
  }

  async pushOnce() {
    if (!this.state) return;
    this.syncStatus = 'saving';
    this.notify();
    try {
      await this.pushWithRetry(this.state);
      this.syncStatus = 'saved';
      // Melhor esforço, não bloqueia o fluxo principal de sincronização —
      // ver benchmark.js sobre por que o cliente envia o score já pronto.
      syncMyBenchmarkStats(
        this.userId,
        this.state.healthProfile && this.state.healthProfile.birthYear,
        this.derived.montroScore,
        (this.state.activeAreas || []).length > 0
      );
    } catch (err) {
      this.syncStatus = navigator.onLine ? 'error' : 'offline';
      console.error('Falha ao sincronizar com a nuvem', err);
    }
    this.notify();
  }

  // Escrita condicional à revisão lida (controle de concorrência otimista —
  // ver supabase/migrations/0010_user_app_state_revision.sql). Se 0 linhas
  // forem afetadas, outro aparelho escreveu primeiro: busca o remoto, faz
  // merge (js/merge.js) com o snapshot que a gente tentou gravar, e tenta de
  // novo — até 3 vezes, pra não entrar em loop infinito num caso patológico.
  async pushWithRetry(snapshot, attempt = 0) {
    const expectedRevision = this.remoteRevision || 0;
    const { data, error } = await supabaseClient
      .from('user_app_state')
      .update({ state: snapshot, revision: expectedRevision + 1 })
      .eq('user_id', this.userId)
      .eq('revision', expectedRevision)
      .select('revision')
      .maybeSingle();
    if (error) {
      if (isMissingRevisionColumn(error)) {
        // Migration 0010 ainda não aplicada — sem a coluna não dá pra fazer
        // concorrência otimista; grava do jeito antigo (upsert cego) até lá.
        const { error: upsertErr } = await supabaseClient
          .from('user_app_state')
          .upsert({ user_id: this.userId, state: snapshot }, { onConflict: 'user_id' });
        if (upsertErr) throw upsertErr;
        return;
      }
      throw error;
    }
    if (data) {
      this.remoteRevision = data.revision;
      return;
    }

    if (attempt >= 3) throw new Error('Não foi possível sincronizar: conflito de revisão persistente.');

    const { data: remoteRow, error: fetchErr } = await supabaseClient
      .from('user_app_state')
      .select('state, revision')
      .eq('user_id', this.userId)
      .maybeSingle();
    if (fetchErr) throw fetchErr;

    if (!remoteRow) {
      // Linha nunca existiu (não deveria acontecer — o trigger de cadastro
      // já cria uma vazia — mas não custa ser defensivo).
      const { data: inserted, error: insertErr } = await supabaseClient
        .from('user_app_state')
        .insert({ user_id: this.userId, state: snapshot, revision: 1 })
        .select('revision')
        .maybeSingle();
      if (insertErr) throw insertErr;
      this.remoteRevision = inserted.revision;
      return;
    }

    const merged = mergeStates(snapshot, remoteRow.state);
    this.remoteRevision = remoteRow.revision;
    this.state = merged;
    this.recompute();
    await saveState(this.userId, this.state);
    this.notify();
    return this.pushWithRetry(merged, attempt + 1);
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
    await deleteAllPhotosCloud(this.userId);
    this.state = defaultState();
    await saveState(this.userId, this.state);
    this.recompute();
    this.notify();
    // Ação explícita e destrutiva do usuário — sobrescreve direto, sem o
    // merge de conflito do pushToCloud normal (que existe pra preservar
    // dado de OUTRO aparelho; aqui o usuário já decidiu apagar tudo).
    try {
      const { data, error } = await supabaseClient
        .from('user_app_state')
        .upsert({ user_id: this.userId, state: this.state, revision: (this.remoteRevision || 0) + 1 }, { onConflict: 'user_id' })
        .select('revision')
        .maybeSingle();
      if (error) {
        if (isMissingRevisionColumn(error)) {
          await supabaseClient.from('user_app_state').upsert({ user_id: this.userId, state: this.state }, { onConflict: 'user_id' });
        } else {
          throw error;
        }
      } else if (data) {
        this.remoteRevision = data.revision;
      }
    } catch (err) {
      console.error('Falha ao sincronizar reset com a nuvem', err);
    }
    this.notify();
  }
}

export const store = new Store();
export { typeForDay };
