import { h, mount, uid, todayISO } from '../utils.js';
import { icon } from '../icons.js';
import { store } from '../store.js';
import { confirmDialog, toast } from '../ui.js';
import { DEFAULT_CHECKLIST_ITEMS, dateKey } from '../habits.js';

function completionKey(taskId, day) {
  return `${taskId}:${day}`;
}

export function renderChecklist(viewEl, params, nav) {
  function draw() {
    const state = store.state;
    const today = dateKey();
    const tasks = state.dailyTasks.filter(t => !t.archived).sort((a, b) => a.order - b.order);
    const archived = state.dailyTasks.filter(t => t.archived);

    function taskRow(task, index) {
      const done = !!state.dailyTaskCompletions[completionKey(task.id, today)];
      return h('div', { className: 'card card-tight row task-row' },
        h('button', {
          className: `check-toggle ${done ? 'checked' : ''}`,
          'aria-label': done ? 'Desmarcar' : 'Marcar',
          onClick: () => store.mutate(s => {
            const key = completionKey(task.id, today);
            if (s.dailyTaskCompletions[key]) delete s.dailyTaskCompletions[key];
            else s.dailyTaskCompletions[key] = todayISO();
          }),
        }, done ? icon('check', { size: 18 }) : null),
        h('span', { className: `grow ${done ? 'task-done' : ''}` }, task.title),
        h('button', { className: 'icon-btn icon-btn-sm', 'aria-label': 'Mover para cima', disabled: index === 0, onClick: () => reorder(task, -1) }, icon('chevronLeft', { size: 14, className: 'rotate-90' })),
        h('button', { className: 'icon-btn icon-btn-sm', 'aria-label': 'Mover para baixo', disabled: index === tasks.length - 1, onClick: () => reorder(task, 1) }, icon('chevronRight', { size: 14, className: 'rotate-90' })),
        h('button', { className: 'icon-btn icon-btn-sm', 'aria-label': 'Arquivar', onClick: async () => {
          const ok = await confirmDialog({ title: 'Arquivar tarefa', message: `Arquivar "${task.title}"?`, confirmLabel: 'Arquivar' });
          if (ok) store.mutate(s => { s.dailyTasks.find(t => t.id === task.id).archived = true; });
        } }, icon('trash', { size: 14 }))
      );
    }

    function reorder(task, dir) {
      store.mutate(s => {
        const list = s.dailyTasks.filter(t => !t.archived).sort((a, b) => a.order - b.order);
        const idx = list.findIndex(t => t.id === task.id);
        const swapIdx = idx + dir;
        if (swapIdx < 0 || swapIdx >= list.length) return;
        const a = s.dailyTasks.find(t => t.id === list[idx].id);
        const b = s.dailyTasks.find(t => t.id === list[swapIdx].id);
        const tmp = a.order; a.order = b.order; b.order = tmp;
      });
    }

    const addInput = h('input', { type: 'text', placeholder: 'Nova tarefa' });

    mount(viewEl, h('div', { className: 'stack fade-up' },
      h('div', { className: 'row-between' },
        h('button', { className: 'icon-btn', 'aria-label': 'Voltar', onClick: () => nav.navigateTo('evoluir') }, icon('chevronLeft', { size: 20 })),
        h('h1', {}, 'Checklist diário'),
        h('span', { style: { width: '44px' } })
      ),
      !state.dailyTasks.length ? h('button', {
        className: 'btn btn-outline btn-block',
        onClick: () => store.mutate(s => {
          DEFAULT_CHECKLIST_ITEMS.forEach((title, i) => s.dailyTasks.push({ id: uid(), title, order: i, archived: false, createdAt: todayISO() }));
        }),
      }, 'Usar lista padrão') : null,
      h('div', { className: 'row' },
        addInput,
        h('button', { className: 'btn btn-primary', onClick: () => {
          if (!addInput.value.trim()) return;
          store.mutate(s => { s.dailyTasks.push({ id: uid(), title: addInput.value.trim(), order: s.dailyTasks.length, archived: false, createdAt: todayISO() }); });
          addInput.value = '';
        } }, icon('plus', { size: 18 }))
      ),
      tasks.length ? h('div', { className: 'stack' }, tasks.map((t, i) => taskRow(t, i)))
        : h('div', { className: 'empty-state' }, 'Nenhuma tarefa hoje. Adicione uma acima.'),
      archived.length ? h('p', { className: 'text-faint', style: { fontSize: '12px' } }, `${archived.length} tarefa(s) arquivada(s)`) : null
    ));
  }

  draw();
  const unsub = store.subscribe(draw);
  return () => unsub();
}
