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

test('listas de valores primitivos viram união sem duplicata', () => {
  const local = baseState({ lastModifiedAt: '2026-01-01T10:00:00.000Z', activeAreas: ['fisico', 'saude'] });
  const remote = baseState({ lastModifiedAt: '2026-01-01T09:00:00.000Z', activeAreas: ['saude', 'conhecimento'] });
  const merged = mergeStates(local, remote);
  assert.deepEqual([...merged.activeAreas].sort(), ['conhecimento', 'fisico', 'saude']);
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
