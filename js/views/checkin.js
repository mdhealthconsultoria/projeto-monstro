import { h } from '../utils.js';
import { openModal, toast } from '../ui.js';
import { store } from '../store.js';

function scaleField(label, min, max, value, onChange) {
  const buttons = [];
  const row = h('div', { className: 'scale-row' });
  for (let i = min; i <= max; i++) {
    const btn = h('button', {
      type: 'button',
      className: `scale-btn ${value === i ? 'selected' : ''}`,
      onClick: () => {
        value = i;
        row.querySelectorAll('.scale-btn').forEach(b => b.classList.remove('selected'));
        btn.classList.add('selected');
        onChange(i);
      },
    }, String(i));
    buttons.push(btn);
  }
  buttons.forEach(b => row.appendChild(b));
  return h('div', { className: 'field' }, h('label', {}, label), row);
}

export function openCheckinModal(day, { onSaved, onSkip } = {}) {
  const existing = (store.state.days[day] && store.state.days[day].checkin) || null;
  const data = {
    energy: existing ? existing.energy : 3,
    motivation: existing ? existing.motivation : 3,
    sleep: existing ? existing.sleep : 3,
    soreness: existing ? existing.soreness : 0,
    note: existing ? existing.note : '',
  };

  const noteInput = h('textarea', {
    placeholder: 'Ex: Hoje consegui fazer minha primeira série com 30 flexões.',
    value: data.note,
    onInput: e => { data.note = e.target.value; },
  });

  const content = h('div', { className: 'stack' },
    h('p', { className: 'text-dim' }, 'Como você está hoje? (opcional)'),
    scaleField('Energia', 1, 5, data.energy, v => data.energy = v),
    scaleField('Motivação', 1, 5, data.motivation, v => data.motivation = v),
    scaleField('Qualidade do sono', 1, 5, data.sleep, v => data.sleep = v),
    scaleField('Dor muscular', 0, 5, data.soreness, v => data.soreness = v),
    h('div', { className: 'field' }, h('label', {}, 'Observação livre'), noteInput),
    h('div', { className: 'row', style: { marginTop: '4px' } },
      h('button', {
        className: 'btn btn-ghost grow', onClick: () => { close(); if (onSkip) onSkip(); },
      }, 'Pular'),
      h('button', {
        className: 'btn btn-primary grow',
        onClick: () => {
          store.mutate(s => {
            if (!s.days[day]) return;
            s.days[day].checkin = { ...data };
          });
          toast('Check-in salvo', { iconName: 'check' });
          close();
          if (onSaved) onSaved();
        },
      }, 'Salvar check-in')
    )
  );

  const close = openModal(content, { title: 'Check-in pós-treino' });
}
