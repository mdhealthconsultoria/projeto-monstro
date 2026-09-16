import { h, mount } from '../utils.js';
import { icon } from '../icons.js';
import { store } from '../store.js';
import { TOTAL_DAYS } from '../model.js';

function hubCard({ iconName, title, subtitle, meta, onClick }) {
  return h('button', { className: 'hub-card', onClick },
    h('div', { className: 'hub-card-icon' }, icon(iconName, { size: 26 })),
    h('div', { className: 'grow' },
      h('div', { className: 'hub-card-title' }, title),
      h('div', { className: 'hub-card-sub' }, subtitle)
    ),
    meta ? h('div', { className: 'hub-card-meta' }, meta) : null,
    icon('chevronRight', { size: 20, className: 'text-faint' })
  );
}

export function renderEvoluir(viewEl, params, nav) {
  function draw() {
    const state = store.state;
    const { computed } = store.derived;

    const habitCount = Object.values(state.habits).filter(h => h.active).length;
    const taskCount = state.dailyTasks.filter(t => !t.archived).length;

    mount(viewEl, h('div', { className: 'stack fade-up' },
      h('h1', {}, 'Evoluir'),
      h('p', { className: 'text-dim' }, 'Corpo, mente e rotina — tudo o que constrói a sua base.'),

      h('div', { className: 'stack' },
        hubCard({
          iconName: 'today',
          title: 'Treino de 30 dias',
          subtitle: 'PROJETO MONSTRO — ciclo PUSH / PULL / LEGS',
          meta: `${computed.workoutsCompleted}/${TOTAL_DAYS}`,
          onClick: () => nav.navigateTo('jornada'),
        }),
        hubCard({
          iconName: 'wind',
          title: 'Respire e Comece',
          subtitle: 'Prática guiada e lembrete dentro do app',
          meta: state.breathing && state.breathing.reminderTime ? state.breathing.reminderTime : null,
          onClick: () => nav.navigateTo('respirar'),
        }),
        hubCard({
          iconName: 'pyramid',
          title: 'Minha Base',
          subtitle: 'Hábitos, inglês, leitura, oração e mais',
          meta: habitCount ? `${habitCount} ativo${habitCount === 1 ? '' : 's'}` : null,
          onClick: () => nav.navigateTo('minhaBase'),
        }),
        hubCard({
          iconName: 'checkCircle',
          title: 'Checklist diário',
          subtitle: 'Tarefas simples do seu dia',
          meta: taskCount ? `${taskCount} tarefa${taskCount === 1 ? '' : 's'}` : null,
          onClick: () => nav.navigateTo('checklist'),
        })
      )
    ));
  }

  draw();
  const unsub = store.subscribe(draw);
  return () => unsub();
}
