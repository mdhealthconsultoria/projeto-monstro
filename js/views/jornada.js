import { h, mount } from '../utils.js';
import { icon } from '../icons.js';
import { store } from '../store.js';
import { TOTAL_DAYS, typeForDay, isDayCompleted } from '../model.js';
import { toast } from '../ui.js';
import { openDayDetail } from './dayDetail.js';

export function renderJornada(viewEl, params, nav) {
  function draw() {
    const state = store.state;
    const { currentDay, computed } = store.derived;

    const backHeader = h('div', { className: 'row-between' },
      h('button', { className: 'icon-btn', 'aria-label': 'Voltar', onClick: () => nav.navigateTo('evoluir') }, icon('chevronLeft', { size: 20 })),
      h('h1', {}, 'Treino de 30 dias'),
      h('span', { style: { width: '44px' } })
    );

    if (!currentDay) {
      mount(viewEl, h('div', { className: 'stack fade-up' },
        backHeader,
        h('div', { className: 'empty-state' }, icon('today', { size: 32 }), h('div', {}, 'Você ainda não iniciou o desafio. Volte para Hoje para começar.'),
          h('button', { className: 'btn btn-primary', style: { marginTop: '12px' }, onClick: () => nav.navigateTo('hoje') }, 'Ir para Hoje'))
      ));
      return;
    }

    const cells = [];
    for (let day = 1; day <= TOTAL_DAYS; day++) {
      const dayRec = state.days[day];
      const type = typeForDay(day);
      const completed = isDayCompleted(dayRec);
      let statusClass = 'future';
      if (completed) statusClass = 'completed';
      else if (day === currentDay) statusClass = 'today';
      else if (day < currentDay) statusClass = 'pending';

      const perDay = computed.perDay[day];
      const hasRecord = perDay && perDay.records.length > 0;

      cells.push(h('button', {
        className: `day-cell ${statusClass}`,
        onClick: () => {
          if (completed) { openDayDetail(day, { onClose: draw }); return; }
          if (day > currentDay) { toast('Este dia ainda não chegou.', { iconName: 'info' }); return; }
          nav.navigateTo('treino', { day });
        },
      },
        hasRecord ? h('span', { className: 'dot' }) : null,
        h('span', { className: 'd-num' }, String(day).padStart(2, '0')),
        h('span', { className: 'd-type' }, type)
      ));
    }

    const legend = h('div', { className: 'legend' },
      h('span', {}, h('span', { className: 'sw', style: { background: 'var(--green)' } }), 'Concluído'),
      h('span', {}, h('span', { className: 'sw', style: { background: 'var(--orange)' } }), 'Hoje'),
      h('span', {}, h('span', { className: 'sw', style: { background: 'var(--card-2)', border: '1px solid var(--border)' } }), 'Pendente'),
      h('span', {}, h('span', { className: 'sw', style: { background: 'var(--bg-elevated)', opacity: '0.6' } }), 'Futuro')
    );

    mount(viewEl, h('div', { className: 'stack fade-up' },
      backHeader,
      h('p', { className: 'text-dim' }, `${computed.workoutsCompleted} de ${TOTAL_DAYS} treinos concluídos.`),
      h('div', { className: 'card' }, h('div', { className: 'days-grid' }, cells)),
      legend
    ));
  }

  draw();
  const unsub = store.subscribe(draw);
  return () => unsub();
}
