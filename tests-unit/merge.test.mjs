// Teste do algoritmo de merge (js/merge.js) usado quando dois aparelhos
// colidem em revisão (ver js/store.js#pushWithRetry, Fase 0.3). Isso é pura
// lógica, sem rede/Supabase — por isso dá pra testar de verdade mesmo antes
// da migration 0010 (coluna revision) ser aplicada em produção, diferente do
// teste end-to-end (tests/sync-conflict.spec.js), que depende da migration
// estar aplicada pra exercitar esse caminho via rede de verdade.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mergeStates } from '../js/merge.js';

function baseState(overrides) {
  return { lastModifiedAt: '2026-01-01T10:00:00.000Z', habits: {}, activeAreas: [], dailyTasks: [], ...overrides };
}

test('hábitos com ids diferentes nos dois lados: nenhum se perde', () => {
  const local = baseState({
    lastModifiedAt: '2026-01-01T10:05:00.000Z',
    habits: { b: { id: 'b', title: 'Device2', createdAt: '2026-01-01T10:04:00.000Z' } },
  });
  const remote = baseState({
    lastModifiedAt: '2026-01-01T10:03:00.000Z',
    habits: { a: { id: 'a', title: 'Device1', createdAt: '2026-01-01T10:02:00.000Z' } },
  });
  const merged = mergeStates(local, remote);
  assert.deepEqual(Object.keys(merged.habits).sort(), ['a', 'b']);
  assert.equal(merged.habits.a.title, 'Device1');
  assert.equal(merged.habits.b.title, 'Device2');
});

test('mesmo hábito editado nos dois lados: vence o snapshot com lastModifiedAt mais recente', () => {
  const local = baseState({
    lastModifiedAt: '2026-01-01T10:00:00.000Z',
    habits: { a: { id: 'a', title: 'Título antigo (local)' } },
  });
  const remote = baseState({
    lastModifiedAt: '2026-01-01T11:00:00.000Z',
    habits: { a: { id: 'a', title: 'Título novo (remoto)' } },
  });
  const merged = mergeStates(local, remote);
  assert.equal(merged.habits.a.title, 'Título novo (remoto)');
});

test('listas com id são mescladas por união, não sobrescritas', () => {
  const local = baseState({
    lastModifiedAt: '2026-01-01T10:00:00.000Z',
    dailyTasks: [{ id: 't2', title: 'Tarefa local' }],
  });
  const remote = baseState({
    lastModifiedAt: '2026-01-01T09:00:00.000Z',
    dailyTasks: [{ id: 't1', title: 'Tarefa remota' }],
  });
  const merged = mergeStates(local, remote);
  const ids = merged.dailyTasks.map(t => t.id).sort();
  assert.deepEqual(ids, ['t1', 't2']);
});

// Revisão 2: appliedIds continua conjunto de verdade (não dá pra
// "desaplicar" um conceito do Business Master, só pode crescer).
test('businessConcepts.appliedIds é conjunto de verdade: união sem duplicata', () => {
  const local = baseState({
    lastModifiedAt: '2026-01-01T10:00:00.000Z',
    businessConcepts: { appliedIds: ['negociacao', 'networking'] },
  });
  const remote = baseState({
    lastModifiedAt: '2026-01-01T09:00:00.000Z',
    businessConcepts: { appliedIds: ['networking', 'vendas'] },
  });
  const merged = mergeStates(local, remote);
  assert.deepEqual([...merged.businessConcepts.appliedIds].sort(), ['negociacao', 'networking', 'vendas']);
});

// Revisão 2 (ponto 2): daysOfWeek NÃO é conjunto — a instrução original
// (revisão 1) estava errada. O usuário pode legitimamente trocar os dias
// ativos de um hábito; uma união nunca deixaria ele RETIRAR um dia.
test('daysOfWeek é valor atômico: vence o lado mais recente, não união', () => {
  const local = baseState({
    lastModifiedAt: '2026-01-01T11:00:00.000Z',
    habits: { h1: { id: 'h1', daysOfWeek: [2, 4] } },
  });
  const remote = baseState({
    lastModifiedAt: '2026-01-01T10:00:00.000Z',
    habits: { h1: { id: 'h1', daysOfWeek: [1, 3, 5] } },
  });
  const merged = mergeStates(local, remote);
  assert.deepEqual(merged.habits.h1.daysOfWeek, [2, 4]);
});

// Revisão 2 (ponto 3): activeAreas também é atômico, não união — desativar
// um pilar precisa sobreviver ao merge (uma união resgataria o pilar
// desativado se o outro lado ainda estivesse com ele ativo).
test('activeAreas é valor atômico: desativar uma área sobrevive ao merge', () => {
  const local = baseState({
    lastModifiedAt: '2026-01-01T11:00:00.000Z',
    activeAreas: ['fisico'], // desativou "saude" aqui, depois do remoto
  });
  const remote = baseState({
    lastModifiedAt: '2026-01-01T10:00:00.000Z',
    activeAreas: ['fisico', 'saude'],
  });
  const merged = mergeStates(local, remote);
  assert.deepEqual(merged.activeAreas, ['fisico']);
});

test('campo escalar em conflito: vence o snapshot mais recente como um todo', () => {
  const local = baseState({ lastModifiedAt: '2026-01-01T12:00:00.000Z', startDate: '2026-01-01T12:00:00.000Z' });
  const remote = baseState({ lastModifiedAt: '2026-01-01T08:00:00.000Z', startDate: null });
  const merged = mergeStates(local, remote);
  assert.equal(merged.startDate, '2026-01-01T12:00:00.000Z');
});

// Regressão do bug real encontrado na revisão do PR: um array POSICIONAL
// (a posição é o número da série, não um conjunto) estava sendo mesclado
// por união/deduplicação — um dia de treino completo com séries repetidas
// (ex. 10,10,10,8,8 reps) virava só os valores distintos (10,8). Testa os
// 3 tipos de treino (A/B/C), incluindo o tipo C, cujos "sets" são objetos
// {left, right, weightKg} SEM id — o caso que mais se parece com uma
// "lista de registros" à primeira vista, mas não é.
test('dia de treino completo (tipos A, B, C): séries positionais nunca são deduplicadas', () => {
  const diaA = {
    day: 1, type: 'A',
    exercises: {
      pushups: { sets: [10, 10, 10, 8, 8] },
      pushupIso: { sets: [30, 30, 25] },
    },
  };
  const diaB = {
    day: 2, type: 'B',
    exercises: {
      pullups: { sets: [6, 6, 5, 5, 4] },
      deadHang: { sets: [40, 35, 30] },
    },
  };
  const diaC = {
    day: 3, type: 'C',
    exercises: {
      bulgarian: {
        sets: [
          { left: 12, right: 12, weightKg: 0 },
          { left: 12, right: 12, weightKg: 0 },
          { left: 10, right: 10, weightKg: 5 },
          { left: 10, right: 10, weightKg: 5 },
          { left: 8, right: 8, weightKg: 5 },
        ],
      },
      wallSit: { sets: [60, 50, 45] },
    },
  };

  const local = baseState({
    lastModifiedAt: '2026-01-01T10:00:00.000Z',
    days: { 1: diaA, 2: diaB },
  });
  const remote = baseState({
    lastModifiedAt: '2026-01-01T09:00:00.000Z',
    days: { 3: diaC },
  });

  const merged = mergeStates(local, remote);

  assert.deepEqual(merged.days[1].exercises.pushups.sets, [10, 10, 10, 8, 8]);
  assert.deepEqual(merged.days[1].exercises.pushupIso.sets, [30, 30, 25]);
  assert.deepEqual(merged.days[2].exercises.pullups.sets, [6, 6, 5, 5, 4]);
  assert.deepEqual(merged.days[3].exercises.bulgarian.sets, diaC.exercises.bulgarian.sets);
  assert.deepEqual(merged.days[3].exercises.wallSit.sets, [60, 50, 45]);
});

test('check-in desmarcado (tombstone) não ressuscita vindo do outro lado', () => {
  const local = baseState({
    lastModifiedAt: '2026-01-01T10:00:00.000Z',
    habitCheckins: {},
    tombstones: { habitCheckins: { 'h1:2026-01-01': '2026-01-01T10:00:00.000Z' } },
  });
  const remote = baseState({
    lastModifiedAt: '2026-01-01T09:00:00.000Z',
    habitCheckins: {
      'h1:2026-01-01': { habitId: 'h1', date: '2026-01-01', createdAt: '2026-01-01T08:00:00.000Z' },
    },
  });

  const merged = mergeStates(local, remote);
  assert.equal(merged.habitCheckins['h1:2026-01-01'], undefined);
});

test('tombstone antigo não apaga um check-in recriado DEPOIS da remoção', () => {
  const local = baseState({
    lastModifiedAt: '2026-01-01T08:00:00.000Z',
    habitCheckins: {},
    tombstones: { habitCheckins: { 'h1:2026-01-01': '2026-01-01T08:00:00.000Z' } },
  });
  const remote = baseState({
    lastModifiedAt: '2026-01-01T12:00:00.000Z',
    habitCheckins: {
      // Marcado de novo às 12h, depois do tombstone das 8h — a recriação vence.
      'h1:2026-01-01': { habitId: 'h1', date: '2026-01-01', createdAt: '2026-01-01T12:00:00.000Z' },
    },
  });

  const merged = mergeStates(local, remote);
  assert.ok(merged.habitCheckins['h1:2026-01-01']);
});

test('medição apagada (tombstone em array por id) não ressuscita', () => {
  const local = baseState({
    lastModifiedAt: '2026-01-01T10:00:00.000Z',
    healthProfile: { measurements: [] },
    tombstones: { measurements: { m1: '2026-01-01T10:00:00.000Z' } },
  });
  const remote = baseState({
    lastModifiedAt: '2026-01-01T09:00:00.000Z',
    healthProfile: { measurements: [{ id: 'm1', type: 'bpSys', value: 120, date: '2026-01-01T08:00:00.000Z' }] },
  });

  const merged = mergeStates(local, remote);
  assert.deepEqual(merged.healthProfile.measurements, []);
});

// Testa o mecanismo de mergeArray isoladamente (dailyTasks não passa por
// migrateState — nenhuma "ajuda" de migração pode mascarar o resultado
// aqui): um item sem id misturado com um item com id NUNCA pode ser
// descartado, só porque o array como um todo "tem algum id".
test('mergeArray (mecanismo genérico): item sem id misturado com item com id nunca é descartado', () => {
  const local = baseState({
    lastModifiedAt: '2026-01-01T10:00:00.000Z',
    dailyTasks: [{ id: 't1', title: 'Com id' }, { title: 'Sem id (legado)', order: 0 }],
  });
  const remote = baseState({
    lastModifiedAt: '2026-01-01T09:00:00.000Z',
    dailyTasks: [],
  });
  const merged = mergeStates(local, remote);
  assert.equal(merged.dailyTasks.length, 2);
});

// BLOQUEADOR da revisão 2: um usuário antigo tem N sessões sem `id` (de
// antes do id existir nesses registros). Ao registrar uma sessão nova (já
// com id) e sincronizar, o merge via união-por-id enxergava "algum item tem
// id" e pulava (descartava) todo item sem id — 20 sessões antigas + 1 nova
// virava só 1. mergeStates precisa migrar (dar id determinístico) os itens
// legados ANTES de decidir, e nunca descartar um item só por falta de id.
test('sessões legadas sem id sobrevivem ao merge quando uma sessão nova (com id) aparece', () => {
  const legacySessions = Array.from({ length: 20 }, (_, i) => ({
    date: `2026-01-${String(i + 1).padStart(2, '0')}T08:00:00.000Z`,
    minutes: 10 + i,
  }));

  const local = baseState({
    lastModifiedAt: '2026-01-21T08:00:00.000Z',
    knowledgeItems: {
      k1: { id: 'k1', title: 'Inglês', sessions: [...legacySessions, { id: 'novo-1', date: '2026-01-21T08:00:00.000Z', minutes: 30 }] },
    },
  });
  const remote = baseState({
    lastModifiedAt: '2026-01-20T08:00:00.000Z',
    knowledgeItems: {
      k1: { id: 'k1', title: 'Inglês', sessions: legacySessions },
    },
  });

  const merged = mergeStates(local, remote);
  assert.equal(merged.knowledgeItems.k1.sessions.length, 21);
});

// Mesmo cenário mas simulando os DOIS lados tendo migrado independentemente
// o mesmo registro legado (sem terem se comunicado ainda) — o id
// determinístico (baseado no conteúdo) garante que viram o MESMO item em
// vez de uma duplicata por aparelho.
test('migração de id determinística: o mesmo registro legado migrado nos dois lados não duplica', () => {
  const legacySession = { date: '2026-01-01T08:00:00.000Z', minutes: 15 };
  const local = baseState({
    lastModifiedAt: '2026-01-01T09:00:00.000Z',
    focus: { sessions: [{ ...legacySession }] },
  });
  const remote = baseState({
    lastModifiedAt: '2026-01-01T09:00:00.000Z',
    focus: { sessions: [{ ...legacySession }] },
  });
  const merged = mergeStates(local, remote);
  assert.equal(merged.focus.sessions.length, 1);
});

// Ponto 5 da revisão 2: resetAll grava resetAt. Um lado cuja última
// modificação é ANTERIOR ao resetAt do outro representa dado de antes do
// reset e tem que ser descartado por inteiro (não mesclado de volta).
test('reset explícito descarta por inteiro o lado com cache anterior ao reset', () => {
  const localComCacheAntigo = baseState({
    lastModifiedAt: '2026-01-01T08:00:00.000Z', // antes do reset do outro lado
    habits: { h1: { id: 'h1', title: 'Hábito de antes do reset' } },
    dailyTasks: [{ id: 't1', title: 'Tarefa de antes do reset' }],
  });
  const remoteResetado = baseState({
    lastModifiedAt: '2026-01-01T10:00:00.000Z',
    resetAt: '2026-01-01T10:00:00.000Z',
    habits: {},
    dailyTasks: [],
  });

  const merged = mergeStates(localComCacheAntigo, remoteResetado);
  assert.deepEqual(merged.habits, {});
  assert.deepEqual(merged.dailyTasks, []);
});

test('reset explícito não afeta um lado modificado DEPOIS do reset', () => {
  const localPosReset = baseState({
    lastModifiedAt: '2026-01-01T11:00:00.000Z', // depois do reset
    habits: { h2: { id: 'h2', title: 'Hábito novo, pós-reset' } },
  });
  const remoteResetado = baseState({
    lastModifiedAt: '2026-01-01T10:00:00.000Z',
    resetAt: '2026-01-01T10:00:00.000Z',
    habits: {},
  });

  const merged = mergeStates(localPosReset, remoteResetado);
  assert.ok(merged.habits.h2);
});
