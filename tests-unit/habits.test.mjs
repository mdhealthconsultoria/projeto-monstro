// Teste de regressão do bug de timezone em habitBestStreak (js/habits.js).
// Roda com `npm run test:unit` (node --test "tests-unit/**/*.test.mjs" — o
// Node não aceita bem um diretório puro como argumento nesta versão, por
// isso o glob). Extensão .mjs + js/package.json com "type":"module" fazem o
// Node tratar isso e o js/habits.js importado como ESM, mesmo com o
// package.json raiz em "type":"commonjs".
//
// Precisa rodar nos 3 fusos pra provar que o bug (new Date('YYYY-MM-DD') é
// meia-noite UTC, que no Brasil cai no dia anterior) está corrigido, ex. no
// PowerShell: $env:TZ='America/Bahia'; npm run test:unit
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { newHabit, dateKey, checkinId, habitBestStreak } from '../js/habits.js';

test(`habitBestStreak conta 7 dias seguidos como 7 (TZ=${process.env.TZ || '(sistema)'})`, () => {
  const habit = newHabit({ title: 'Teste', goalDays: 30 });
  const state = { habitCheckins: {} };

  const start = new Date(2026, 0, 1); // 1 de janeiro de 2026, meia-noite local
  for (let i = 0; i < 7; i++) {
    const day = new Date(start);
    day.setDate(start.getDate() + i);
    const key = dateKey(day);
    state.habitCheckins[checkinId(habit.id, key)] = { habitId: habit.id, date: key };
  }

  assert.equal(habitBestStreak(state, habit), 7);
});

test('habitBestStreak sem check-ins é 0', () => {
  const habit = newHabit({ title: 'Teste', goalDays: 30 });
  const state = { habitCheckins: {} };
  assert.equal(habitBestStreak(state, habit), 0);
});

test('habitBestStreak ignora um dia isolado longe da sequência', () => {
  const habit = newHabit({ title: 'Teste', goalDays: 30 });
  const state = { habitCheckins: {} };
  const start = new Date(2026, 0, 1);
  for (let i = 0; i < 3; i++) {
    const day = new Date(start);
    day.setDate(start.getDate() + i);
    const key = dateKey(day);
    state.habitCheckins[checkinId(habit.id, key)] = { habitId: habit.id, date: key };
  }
  const isolated = new Date(2026, 0, 20);
  const isolatedKey = dateKey(isolated);
  state.habitCheckins[checkinId(habit.id, isolatedKey)] = { habitId: habit.id, date: isolatedKey };

  assert.equal(habitBestStreak(state, habit), 3);
});
