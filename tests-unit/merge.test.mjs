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
