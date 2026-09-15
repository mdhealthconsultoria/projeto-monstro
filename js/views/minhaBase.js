import { h, mount } from '../utils.js';
import { icon } from '../icons.js';
import { store } from '../store.js';
import { openModal, confirmDialog, toast } from '../ui.js';
import {
  HABIT_CATEGORIES, categoryFor, WEEKDAYS, newHabit, createEnglish90Habit,
  habitStats, isHabitCheckedToday, checkinId, dateKey,
} from '../habits.js';

function habitFormModal(existing, onSave) {
  const data = existing ? { ...existing, daysOfWeek: [...existing.daysOfWeek] } : {
    title: '', category: 'personalizado', frequency: 'daily', daysOfWeek: [0, 1, 2, 3, 4, 5, 6], goalDays: 30, description: '', reminderTime: '',
  };

  const titleInput = h('input', { type: 'text', value: data.title, placeholder: 'Ex: Beber 2L de água' });
  const descInput = h('textarea', { placeholder: 'Descrição opcional', value: data.description || '' });
  const goalInput = h('input', { type: 'number', inputMode: 'numeric', min: '1', value: data.goalDays });
  const reminderInput = h('input', { type: 'time', value: data.reminderTime || '' });

  let category = data.category;
  let frequency = data.frequency;
  const daysOfWeek = new Set(data.daysOfWeek);

  const catRow = h('div', { className: 'chip-row' });
  function drawCats() {
    catRow.innerHTML = '';
    HABIT_CATEGORIES.forEach(c => catRow.appendChild(h('button', {
      className: `chip ${category === c.key ? 'selected' : ''}`,
      onClick: () => { category = c.key; drawCats(); },
    }, icon(c.icon, { size: 14 }), c.label)));
  }
  drawCats();

  const freqRow = h('div', { className: 'row' });
  function drawFreq() {
    freqRow.innerHTML = '';
    [['daily', 'Todo dia'], ['custom', 'Dias específicos']].forEach(([key, label]) => {
      freqRow.appendChild(h('button', {
        className: `btn btn-sm grow ${frequency === key ? 'btn-primary' : 'btn-outline'}`,
        onClick: () => { frequency = key; drawFreq(); drawDays(); },
      }, label));
    });
  }
  const daysRow = h('div', { className: 'chip-row' });
  function drawDays() {
    daysRow.innerHTML = '';
    if (frequency !== 'custom') { daysRow.hidden = true; return; }
    daysRow.hidden = false;
    WEEKDAYS.forEach(d => daysRow.appendChild(h('button', {
      className: `chip chip-day ${daysOfWeek.has(d.key) ? 'selected' : ''}`,
      onClick: () => { daysOfWeek.has(d.key) ? daysOfWeek.delete(d.key) : daysOfWeek.add(d.key); drawDays(); },
    }, d.label)));
  }
  drawFreq();
  drawDays();

  const content = h('div', { className: 'stack' },
    h('div', { className: 'field' }, h('label', {}, 'Título'), titleInput),
    h('div', { className: 'field' }, h('label', {}, 'Categoria'), catRow),
    h('div', { className: 'field' }, h('label', {}, 'Frequência'), freqRow, daysRow),
    h('div', { className: 'field' }, h('label', {}, 'Meta em dias'), goalInput),
    h('div', { className: 'field' }, h('label', {}, 'Lembrete opcional'), reminderInput),
    h('div', { className: 'field' }, h('label', {}, 'Descrição'), descInput),
    h('button', {
      className: 'btn btn-primary btn-block',
      onClick: () => {
        if (!titleInput.value.trim()) { toast('Dê um título ao hábito.', { iconName: 'alert' }); return; }
        const cat = categoryFor(category);
        const habit = {
          id: existing ? existing.id : undefined,
          title: titleInput.value,
          category,
          icon: cat.icon,
          color: cat.color,
          frequency,
          daysOfWeek: [...daysOfWeek],
          goalDays: Math.max(1, Number(goalInput.value || 30)),
          reminder: reminderInput.value ? { enabled: true, time: reminderInput.value } : null,
          description: descInput.value,
          templateId: existing ? existing.templateId : null,
        };
        onSave(existing ? { ...existing, ...habit } : newHabit(habit));
        close();
      },
    }, existing ? 'Salvar alterações' : 'Criar hábito')
  );
  const close = openModal(content, { title: existing ? 'Editar hábito' : 'Novo hábito' });
}

function checkinModal(habit, onSave) {
  const isEnglish = habit.templateId === 'english-90';
  const noteInput = h('textarea', { placeholder: isEnglish ? 'O que você aprendeu hoje?' : 'Observação opcional' });
  const content = h('div', { className: 'stack' },
    h('div', { className: 'field' }, h('label', {}, isEnglish ? 'O que aprendeu hoje?' : 'Observação'), noteInput),
    h('button', { className: 'btn btn-primary btn-block', onClick: () => { onSave(noteInput.value); close(); } }, 'Concluir check-in')
  );
  const close = openModal(content, { title: habit.title });
}

export function renderMinhaBase(viewEl, params, nav) {
  let showArchived = false;

  function draw() {
    const state = store.state;
    const habits = Object.values(state.habits);
    const active = habits.filter(h => h.active).sort((a, b) => a.createdAt.localeCompare(b.createdAt));
    const archived = habits.filter(h => !h.active);
    const hasEnglish = habits.some(h => h.templateId === 'english-90');

    function habitRow(habit) {
      const stats = habitStats(state, habit);
      const checkedToday = isHabitCheckedToday(state, habit.id);
      const cat = categoryFor(habit.category);
      return h('div', { className: 'card card-tight habit-row' },
        h('div', { className: 'habit-icon', style: { color: habit.color || cat.color } }, icon(habit.icon || cat.icon, { size: 20 })),
        h('div', { className: 'grow', onClick: () => openDetail(habit) },
          h('div', { className: 'habit-title' }, habit.title),
          h('div', { className: 'habit-meta text-dim' }, `${stats.streak} seguidos · ${stats.total}/${habit.goalDays} dias`)
        ),
        h('button', {
          className: `check-toggle ${checkedToday ? 'checked' : ''}`,
          'aria-label': checkedToday ? 'Desmarcar hoje' : 'Marcar hoje',
          onClick: () => {
            if (checkedToday) {
              store.mutate(s => { delete s.habitCheckins[checkinId(habit.id, dateKey())]; });
              return;
            }
            checkinModal(habit, note => {
              store.mutate(s => {
                const key = dateKey();
                s.habitCheckins[checkinId(habit.id, key)] = { habitId: habit.id, date: key, note, createdAt: new Date().toISOString() };
              });
              toast('Check-in registrado', { iconName: 'check' });
            });
          },
        }, checkedToday ? icon('check', { size: 18 }) : null)
      );
    }

    function openDetail(habit) {
      const stats = habitStats(store.state, habit);
      const checkins = Object.values(store.state.habitCheckins)
        .filter(c => c.habitId === habit.id).sort((a, b) => b.date.localeCompare(a.date)).slice(0, 20);
      const content = h('div', { className: 'stack' },
        h('div', { className: 'stat-grid' },
          h('div', { className: 'stat-box' }, h('div', { className: 'val' }, stats.streak), h('div', { className: 'lbl' }, 'Sequência')),
          h('div', { className: 'stat-box' }, h('div', { className: 'val' }, stats.total), h('div', { className: 'lbl' }, 'Total')),
          h('div', { className: 'stat-box' }, h('div', { className: 'val' }, habit.goalDays), h('div', { className: 'lbl' }, 'Meta'))
        ),
        h('div', { className: 'progress-track' }, h('div', { className: 'progress-fill green', style: { width: `${Math.round(stats.progress * 100)}%` } })),
        habit.description ? h('p', { className: 'text-dim' }, habit.description) : null,
        checkins.length ? h('div', { className: 'stack' },
          h('div', { className: 'section-title' }, 'ÚLTIMOS CHECK-INS'),
          checkins.map(c => h('div', { className: 'card card-tight' },
            h('div', { className: 'row-between' }, h('strong', {}, c.date), null),
            c.note ? h('p', { className: 'text-dim', style: { marginTop: '4px' } }, c.note) : null
          ))
        ) : h('p', { className: 'text-faint' }, 'Nenhum check-in ainda.'),
        h('div', { className: 'row' },
          h('button', { className: 'btn btn-outline grow', onClick: () => { close(); habitFormModal(habit, saved => { store.mutate(s => { s.habits[saved.id] = saved; }); }); } }, icon('edit', { size: 16 }), 'Editar'),
          h('button', { className: `btn grow ${habit.active ? 'btn-danger' : 'btn-primary'}`, onClick: async () => {
            if (habit.active) {
              const ok = await confirmDialog({ title: 'Arquivar hábito', message: `Arquivar "${habit.title}"? O histórico continua salvo.`, confirmLabel: 'Arquivar', danger: true });
              if (!ok) return;
            }
            store.mutate(s => { s.habits[habit.id].active = !s.habits[habit.id].active; });
            close();
          } }, habit.active ? 'Arquivar' : 'Reativar')
        )
      );
      const close = openModal(content, { title: habit.title });
    }

    mount(viewEl, h('div', { className: 'stack fade-up' },
      h('div', { className: 'row-between' },
        h('button', { className: 'icon-btn', 'aria-label': 'Voltar', onClick: () => nav.navigateTo('evoluir') }, icon('chevronLeft', { size: 20 })),
        h('h1', {}, 'Minha Base'),
        h('span', { style: { width: '44px' } })
      ),
      !hasEnglish ? h('button', { className: 'btn btn-outline btn-block', onClick: () => {
        store.mutate(s => { const h2 = createEnglish90Habit(); s.habits[h2.id] = h2; });
        toast('Modelo adicionado: Inglês — 90 dias', { iconName: 'check' });
      } }, icon('book', { size: 18 }), 'Usar modelo: Inglês — Desafio 90 dias') : null,
      h('button', { className: 'btn btn-primary btn-block', onClick: () => habitFormModal(null, habit => { store.mutate(s => { s.habits[habit.id] = habit; }); }) }, icon('plus', { size: 18 }), 'Novo hábito'),
      active.length ? h('div', { className: 'stack' }, active.map(habitRow))
        : h('div', { className: 'empty-state' }, icon('pyramid', { size: 32 }), h('div', {}, 'Nenhum hábito ainda. Crie o primeiro acima.')),
      archived.length ? h('div', { className: 'stack' },
        h('button', { className: 'btn btn-ghost btn-sm', onClick: () => { showArchived = !showArchived; draw(); } }, `${showArchived ? 'Ocultar' : 'Ver'} arquivados (${archived.length})`),
        showArchived ? archived.map(habitRow) : null
      ) : null
    ));
  }

  draw();
  const unsub = store.subscribe(draw);
  return () => unsub();
}
