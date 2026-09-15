import { h } from '../utils.js';
import { openModal, confirmDialog, toast } from '../ui.js';
import { icon } from '../icons.js';
import { store } from '../store.js';
import { EXERCISES_BY_TYPE, WORKOUT_TYPES, isDayCompleted } from '../model.js';
import { aggregateDay, previousSimilarDay, compareAggregates, formatSignedNumber, formatSignedPercent } from '../logic.js';
import { openCheckinModal } from './checkin.js';

function cloneExercises(exercises) {
  return JSON.parse(JSON.stringify(exercises));
}

function numberField(label, value, unit, onChange) {
  let error = '';
  const errEl = h('div', { className: 'field-error' });
  const input = h('input', {
    type: 'number', inputMode: 'numeric', min: '0', value: value == null ? '' : value,
    onInput: e => {
      const raw = e.target.value;
      if (raw === '') { error = ''; input.classList.remove('invalid'); errEl.textContent = ''; onChange(null); return; }
      const n = Number(raw);
      if (!Number.isFinite(n) || n < 0 || !Number.isInteger(n)) {
        error = 'Use um número inteiro ≥ 0';
        input.classList.add('invalid');
        errEl.textContent = error;
        return;
      }
      input.classList.remove('invalid');
      errEl.textContent = '';
      onChange(n);
    },
  });
  return h('div', { className: 'field' },
    h('label', {}, `${label}${unit ? ' (' + unit + ')' : ''}`),
    input,
    errEl
  );
}

function buildExerciseEditor(def, data, onChange) {
  const setsNodes = data.sets.map((set, i) => {
    if (def.mode === 'legs') {
      return h('div', { className: 'card card-tight' },
        h('div', { className: 'section-title' }, `Série ${i + 1}`),
        h('div', { className: 'row' },
          numberField('Esquerda', set ? set.left : null, 'reps', v => { data.sets[i] = { ...(data.sets[i] || {}), left: v }; onChange(); }),
          numberField('Direita', set ? set.right : null, 'reps', v => { data.sets[i] = { ...(data.sets[i] || {}), right: v }; onChange(); })
        ),
        numberField('Carga extra opcional', set ? set.weightKg : null, 'kg', v => { data.sets[i] = { ...(data.sets[i] || {}), weightKg: v }; onChange(); })
      );
    }
    return numberField(`Série ${i + 1}`, set, def.unit, v => { data.sets[i] = v; onChange(); });
  });
  return h('div', { className: 'stack' },
    h('h3', {}, def.name),
    ...setsNodes
  );
}

export function openDayDetail(day, { onClose } = {}) {
  const state = store.state;
  const dayRec = state.days[day];
  const type = dayRec ? dayRec.type : null;
  const completed = isDayCompleted(dayRec);

  if (!dayRec || !completed) {
    const content = h('div', { className: 'stack' },
      h('p', { className: 'text-dim' }, dayRec ? 'Este treino ainda não foi concluído.' : 'Nenhum registro para este dia ainda.'),
    );
    openModal(content, { title: `Dia ${day} · Treino ${type || ''}`, onClose });
    return;
  }

  const workingExercises = cloneExercises(dayRec.exercises);
  let dirty = false;
  const defs = EXERCISES_BY_TYPE[type];

  const prevDay = previousSimilarDay(state, day);
  const prevAgg = prevDay ? aggregateDay(prevDay) : null;

  const compareBlock = defs.map(def => {
    const currAgg = aggregateDay({ ...dayRec, exercises: workingExercises });
    const cmp = prevAgg ? compareAggregates(prevAgg, currAgg, def.key) : null;
    if (!cmp) return null;
    return h('div', { className: 'compare-line' },
      h('span', { className: 'text-dim' }, `${def.name} vs. anterior`),
      h('span', { className: cmp.diff >= 0 ? 'delta-pos' : 'delta-neg' }, `${formatSignedNumber(cmp.diff)} (${formatSignedPercent(cmp.pct)})`)
    );
  }).filter(Boolean);

  const editorsWrap = h('div', { className: 'stack' });
  function renderEditors() {
    editorsWrap.innerHTML = '';
    defs.forEach(def => editorsWrap.appendChild(buildExerciseEditor(def, workingExercises[def.key], () => { dirty = true; })));
  }
  renderEditors();

  const checkinSummary = h('div', { className: 'card card-tight' });
  function renderCheckin() {
    checkinSummary.innerHTML = '';
    const ci = dayRec.checkin;
    if (ci) {
      checkinSummary.appendChild(h('div', { className: 'stack' },
        h('div', { className: 'section-title' }, 'Check-in do dia'),
        h('div', { className: 'row wrap' },
          h('span', { className: 'pill pill-orange' }, `Energia ${ci.energy}/5`),
          h('span', { className: 'pill pill-orange' }, `Motivação ${ci.motivation}/5`),
          h('span', { className: 'pill pill-orange' }, `Sono ${ci.sleep}/5`),
          h('span', { className: 'pill pill-red' }, `Dor ${ci.soreness}/5`)
        ),
        ci.note ? h('p', { className: 'text-dim' }, `"${ci.note}"`) : null,
        h('button', { className: 'btn btn-outline btn-sm', onClick: () => openCheckinModal(day, { onSaved: renderCheckin }) }, icon('edit', { size: 16 }), 'Editar check-in')
      ));
    } else {
      checkinSummary.appendChild(h('div', { className: 'row-between' },
        h('span', { className: 'text-dim' }, 'Sem check-in registrado.'),
        h('button', { className: 'btn btn-outline btn-sm', onClick: () => openCheckinModal(day, { onSaved: renderCheckin }) }, 'Adicionar')
      ));
    }
  }
  renderCheckin();

  function save() {
    const hasInvalid = editorsWrap.querySelector('.invalid');
    if (hasInvalid) { toast('Corrija os campos inválidos antes de salvar.', { iconName: 'alert' }); return; }
    store.mutate(s => {
      s.days[day].exercises = workingExercises;
    });
    toast('Treino atualizado', { iconName: 'check' });
    close();
    if (onClose) onClose();
  }

  async function remove() {
    const ok = await confirmDialog({
      title: 'Excluir treino',
      message: `Tem certeza que deseja apagar o registro do dia ${day}? Recordes, XP e sequência serão recalculados.`,
      confirmLabel: 'Excluir',
      danger: true,
    });
    if (!ok) return;
    store.mutate(s => { delete s.days[day]; });
    toast('Registro apagado', { iconName: 'trash' });
    close();
    if (onClose) onClose();
  }

  const content = h('div', { className: 'stack' },
    h('div', { className: 'workout-tag' }, WORKOUT_TYPES[type].label),
    compareBlock.length ? h('div', { className: 'card card-tight stack' }, compareBlock) : null,
    editorsWrap,
    checkinSummary,
    h('div', { className: 'row', style: { marginTop: '6px' } },
      h('button', { className: 'btn btn-danger', onClick: remove }, icon('trash', { size: 18 }), 'Excluir'),
      h('button', { className: 'btn btn-primary grow', onClick: save }, icon('check', { size: 18 }), 'Salvar alterações')
    )
  );

  const close = openModal(content, { title: `Dia ${day}`, onClose });
}
