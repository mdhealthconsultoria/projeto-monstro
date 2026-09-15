import { h } from '../utils.js';
import { openModal, toast } from '../ui.js';
import { store } from '../store.js';
import { todayISO } from '../utils.js';

function numField(label, unit, value, onChange) {
  const err = h('div', { className: 'field-error' });
  const input = h('input', {
    type: 'number', inputMode: 'decimal', min: '0', step: unit === 'kg' ? '0.1' : '1',
    value: value == null ? '' : value,
    onInput: e => {
      const raw = e.target.value;
      if (raw === '') { onChange(null); err.textContent = ''; input.classList.remove('invalid'); return; }
      const n = Number(raw);
      if (!Number.isFinite(n) || n < 0) {
        err.textContent = 'Valor inválido';
        input.classList.add('invalid');
        return;
      }
      input.classList.remove('invalid');
      err.textContent = '';
      onChange(n);
    },
  });
  return h('div', { className: 'field' }, h('label', {}, `${label} (${unit})`), input, err);
}

export function openTestModal(which, { onSaved } = {}) {
  const label = which === 'day1' ? 'Teste inicial — Dia 1' : 'Teste final — Dia 30';
  const existing = store.state.tests[which];
  const data = {
    pushups: existing ? existing.pushups : null,
    pullups: existing ? existing.pullups : null,
    wallSit: existing ? existing.wallSit : null,
    bodyWeight: existing ? existing.bodyWeight : null,
  };

  const content = h('div', { className: 'stack' },
    h('p', { className: 'text-dim' }, 'Registre seu desempenho máximo. Esses números viram a base da comparação final.'),
    numField('Máximo de flexões seguidas', 'reps', data.pushups, v => data.pushups = v),
    numField('Máximo de barras seguidas', 'reps', data.pullups, v => data.pullups = v),
    numField('Máximo de Wall Sit', 's', data.wallSit, v => data.wallSit = v),
    numField('Peso corporal', 'kg', data.bodyWeight, v => data.bodyWeight = v),
    h('button', {
      className: 'btn btn-primary btn-block',
      onClick: () => {
        if (content.querySelector('.invalid')) { toast('Corrija os campos inválidos.', { iconName: 'alert' }); return; }
        store.mutate(s => { s.tests[which] = { ...data, recordedAt: todayISO() }; });
        toast('Teste registrado', { iconName: 'check' });
        close();
        if (onSaved) onSaved();
      },
    }, 'Salvar teste')
  );

  const close = openModal(content, { title: label });
}
