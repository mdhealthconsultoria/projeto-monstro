import { h, mount, formatDateShort } from '../utils.js';
import { store } from '../store.js';
import { TOTAL_DAYS, isDayCompleted } from '../model.js';
import { aggregateDay, allRecordCategories } from '../logic.js';
import { lineChart } from '../charts.js';

function seriesFor(state, typeFilter, exerciseKey, field) {
  const points = [];
  for (let day = 1; day <= TOTAL_DAYS; day++) {
    const dayRec = state.days[day];
    if (!isDayCompleted(dayRec) || dayRec.type !== typeFilter) continue;
    const agg = aggregateDay(dayRec);
    const ex = agg[exerciseKey];
    if (!ex || ex[field] == null) continue;
    points.push({ day, value: ex[field] });
  }
  return points;
}

const CHART_DEFS = [
  { title: 'Total de flexões (PUSH)', type: 'A', exerciseKey: 'pushups', field: 'total', unit: '' },
  { title: 'Máximo de flexões em 1 série', type: 'A', exerciseKey: 'pushups', field: 'bestSet', unit: '' },
  { title: 'Total de barras (PULL)', type: 'B', exerciseKey: 'pullups', field: 'total', unit: '' },
  { title: 'Máximo de barras em 1 série', type: 'B', exerciseKey: 'pullups', field: 'bestSet', unit: '' },
  { title: 'Melhor Dead Hang', type: 'B', exerciseKey: 'deadHang', field: 'bestSet', unit: 's' },
  { title: 'Repetições — Agachamento Búlgaro', type: 'C', exerciseKey: 'bulgarian', field: 'total', unit: '' },
  { title: 'Melhor Wall Sit', type: 'C', exerciseKey: 'wallSit', field: 'bestSet', unit: 's' },
];

export function renderEvolucao(viewEl, params, nav) {
  function draw() {
    const state = store.state;
    const { computed } = store.derived;

    const chartCards = CHART_DEFS.map(def => {
      const points = seriesFor(state, def.type, def.exerciseKey, def.field);
      return h('div', { className: 'card stack' },
        h('h3', { style: { fontSize: '14px' } }, def.title),
        lineChart(points, { unit: def.unit, title: def.title })
      );
    });

    const recordCards = allRecordCategories().map(cat => {
      const rec = computed.bestByCategory[cat.id];
      if (!rec || rec.value <= 0) return null;
      const completedAt = state.days[rec.day] && state.days[rec.day].completedAt;
      return h('div', { className: 'pr-card' },
        h('div', { className: 'pr-val' }, `${rec.value}${cat.unit === 's' ? 's' : ''}`),
        h('div', { className: 'pr-lbl' }, cat.label),
        h('div', { className: 'pr-day' }, `Dia ${rec.day}${completedAt ? ' · ' + formatDateShort(completedAt) : ''}`)
      );
    }).filter(Boolean);

    mount(viewEl, h('div', { className: 'stack fade-up' },
      h('h1', {}, 'Evolução'),
      h('p', { className: 'text-dim' }, 'Baseado apenas nos treinos que você registrou.'),
      h('div', { className: 'card stack' },
        h('div', { className: 'section-title' }, 'RECORDES PESSOAIS'),
        recordCards.length ? h('div', { className: 'records-grid' }, recordCards)
          : h('div', { className: 'empty-state' }, 'Complete um treino para começar a registrar recordes.')
      ),
      ...chartCards
    ));
  }

  draw();
  const unsub = store.subscribe(draw);
  return () => unsub();
}
