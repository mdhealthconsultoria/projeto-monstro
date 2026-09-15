import { h, mount, formatMMSS, vibrate, todayISO } from '../utils.js';
import { icon } from '../icons.js';
import { store } from '../store.js';
import { EXERCISES_BY_TYPE, WORKOUT_TYPES, typeForDay, REST_SECONDS_DEFAULT, emptyDay } from '../model.js';
import { aggregateDay, previousSimilarDay, compareAggregates, formatSignedNumber, formatSignedPercent } from '../logic.js';
import { RestTimer } from '../timer.js';
import { toast, queueToasts } from '../ui.js';
import { openCheckinModal } from './checkin.js';

function buildSequence(type) {
  const defs = EXERCISES_BY_TYPE[type];
  const seq = [];
  defs.forEach((def, exerciseIndex) => {
    for (let s = 0; s < def.setsCount; s++) seq.push({ exerciseIndex, setIndex: s, def });
  });
  return seq;
}

function computeResumeFlowIndex(dayRec, seq) {
  for (let i = 0; i < seq.length; i++) {
    const { def, setIndex } = seq[i];
    const setVal = dayRec.exercises[def.key].sets[setIndex];
    const isEmpty = def.mode === 'legs' ? !(setVal && setVal.left != null && setVal.right != null) : setVal == null;
    if (isEmpty) return i;
  }
  return seq.length;
}

export function renderTreino(viewEl, params, nav) {
  const day = params.day;
  const type = typeForDay(day);
  const defs = EXERCISES_BY_TYPE[type];
  const seq = buildSequence(type);
  const workoutName = WORKOUT_TYPES[type];

  store.mutate(s => {
    if (!s.days[day]) s.days[day] = emptyDay(day);
    const dayRec = s.days[day];
    if (!dayRec.startedAt) dayRec.startedAt = todayISO();

    if (!s.activeSession || s.activeSession.day !== day) {
      s.activeSession = {
        day,
        flowIndex: computeResumeFlowIndex(dayRec, seq),
        resting: false,
        restEndAt: null,
        restTotal: REST_SECONDS_DEFAULT,
      };
    }
  });

  const timer = new RestTimer({
    getEndAt: () => (store.state.activeSession ? store.state.activeSession.restEndAt : null),
    setEndAt: endAt => store.mutate(s => { if (s.activeSession) s.activeSession.restEndAt = endAt; }),
    onTick: remaining => updateRestUI(remaining),
    onDone: () => advanceAfterRest(),
  });

  let restRingEls = null;

  function updateRestUI(remaining) {
    if (!restRingEls) return;
    const total = (store.state.activeSession && store.state.activeSession.restTotal) || REST_SECONDS_DEFAULT;
    const frac = Math.max(0, Math.min(1, remaining / total));
    const c = restRingEls.circumference;
    restRingEls.fg.setAttribute('stroke-dashoffset', String(c * (1 - frac)));
    restRingEls.label.textContent = formatMMSS(remaining);
  }

  function finishSet(value) {
    const { def, setIndex } = seq[store.state.activeSession.flowIndex];
    store.mutate(s => {
      s.days[day].exercises[def.key].sets[setIndex] = value;
    });
    vibrate(20);
    const isLastOfAll = store.state.activeSession.flowIndex >= seq.length - 1;
    if (isLastOfAll) {
      completeWorkout();
      return;
    }
    store.mutate(s => {
      s.activeSession.resting = true;
      s.activeSession.restTotal = REST_SECONDS_DEFAULT;
    });
    timer.start(REST_SECONDS_DEFAULT);
    render();
  }

  function advanceAfterRest() {
    store.mutate(s => {
      if (!s.activeSession) return;
      s.activeSession.resting = false;
      s.activeSession.flowIndex += 1;
    });
    if (store.state.activeSession.flowIndex >= seq.length) {
      completeWorkout();
    } else {
      render();
    }
  }

  function skipRest() {
    timer.skip();
  }

  function addRest(seconds) {
    store.mutate(s => { s.activeSession.restTotal += seconds; });
    timer.addSeconds(seconds);
  }

  let celebrationData = null;

  function completeWorkout() {
    const beforeXP = store.derived.computed.totalXP;
    const beforeLevel = store.derived.level.level;

    const prevDay = previousSimilarDay(store.state, day);
    const prevAgg = prevDay ? aggregateDay(prevDay) : null;

    store.mutate(s => {
      s.days[day].completedAt = todayISO();
      s.activeSession = null;
    });

    const afterComputed = store.derived.computed;
    const afterLevel = store.derived.level;
    const perDay = afterComputed.perDay[day];
    const currAgg = aggregateDay(store.state.days[day]);

    const comparisons = defs.map(def => {
      const cmp = prevAgg ? compareAggregates(prevAgg, currAgg, def.key) : null;
      return cmp ? { name: def.name, cmp } : null;
    }).filter(Boolean);

    celebrationData = {
      xpGained: afterComputed.totalXP - beforeXP,
      records: perDay ? perDay.records : [],
      leveledUp: afterLevel.level > beforeLevel,
      newLevelName: afterLevel.name,
      comparisons,
    };

    const toasts = [];
    if (celebrationData.records.length) toasts.push({ text: `NOVO PR ×${celebrationData.records.length}`, icon: 'trophy' });
    if (celebrationData.leveledUp) toasts.push({ text: `SUBIU DE NÍVEL — ${afterLevel.name}`, icon: 'bolt' });
    queueToasts(toasts);

    render();
  }

  function renderEntryScreen() {
    const { def, setIndex } = seq[store.state.activeSession.flowIndex];
    const totalInDef = def.setsCount;

    const dots = h('div', { className: 'set-progress-dots' }, Array.from({ length: totalInDef }, (_, i) =>
      h('span', { className: `dot ${i < setIndex ? 'done' : i === setIndex ? 'current' : ''}` })
    ));

    let control;
    let readValue;

    if (def.mode === 'legs') {
      const leftInput = h('input', { className: 'reps-number', style: { fontSize: '48px', width: '110px' }, type: 'number', inputMode: 'numeric', min: '0', value: '0' });
      const rightInput = h('input', { className: 'reps-number', style: { fontSize: '48px', width: '110px' }, type: 'number', inputMode: 'numeric', min: '0', value: '0' });
      const weightInput = h('input', { type: 'number', inputMode: 'decimal', min: '0', step: '0.5', placeholder: '0' });

      function stepperFor(input) {
        return h('div', { className: 'reps-stepper' },
          h('button', { className: 'stepper-btn', 'aria-label': 'Diminuir', onClick: () => { input.value = Math.max(0, Number(input.value || 0) - 1); } }, icon('minus', { size: 22 })),
          input,
          h('button', { className: 'stepper-btn', 'aria-label': 'Aumentar', onClick: () => { input.value = Number(input.value || 0) + 1; } }, icon('plus', { size: 22 }))
        );
      }

      control = h('div', { className: 'reps-control' },
        h('div', { className: 'legs-fields' },
          h('div', { className: 'leg-field' }, h('label', {}, 'Esquerda'), stepperFor(leftInput)),
        ),
        h('div', { className: 'legs-fields' },
          h('div', { className: 'leg-field' }, h('label', {}, 'Direita'), stepperFor(rightInput)),
        ),
        h('div', { className: 'weight-field' }, h('label', {}, 'Carga extra opcional (kg)'), weightInput)
      );
      readValue = () => ({
        left: Number(leftInput.value || 0),
        right: Number(rightInput.value || 0),
        weightKg: weightInput.value === '' ? null : Number(weightInput.value),
      });
    } else {
      const numberInput = h('input', { className: 'reps-number', type: 'number', inputMode: 'numeric', min: '0', value: '0' });
      control = h('div', { className: 'reps-control' },
        h('div', { className: 'reps-stepper' },
          h('button', { className: 'stepper-btn', 'aria-label': 'Diminuir', onClick: () => { numberInput.value = Math.max(0, Number(numberInput.value || 0) - 1); } }, icon('minus', { size: 26 })),
          numberInput,
          h('button', { className: 'stepper-btn', 'aria-label': 'Aumentar', onClick: () => { numberInput.value = Number(numberInput.value || 0) + 1; } }, icon('plus', { size: 26 }))
        ),
        h('div', { className: 'reps-unit' }, def.mode === 'time' ? 'segundos' : 'repetições')
      );
      readValue = () => Number(numberInput.value || 0);
    }

    const screen = h('div', { className: 'focus-screen' },
      h('div', { className: 'focus-top' },
        h('button', { className: 'icon-btn', 'aria-label': 'Voltar para Hoje', onClick: () => nav.navigateTo('hoje') }, icon('close', { size: 20 })),
        h('span', { className: 'workout-tag' }, workoutName.label),
        h('span', { style: { width: '44px' } })
      ),
      h('h1', { className: 'exercise-name' }, def.name),
      h('div', { className: 'set-indicator' }, `Série ${setIndex + 1} de ${totalInDef}`),
      dots,
      control,
      h('div', { className: 'focus-actions' },
        h('button', {
          className: 'btn btn-primary btn-huge btn-block',
          onClick: () => finishSet(readValue()),
        }, icon('check', { size: 20 }), 'CONCLUIR SÉRIE')
      )
    );
    mount(viewEl, screen);
  }

  function renderRestScreen() {
    const nextItem = seq[store.state.activeSession.flowIndex + 1];
    const r = 96;
    const c = 2 * Math.PI * r;
    const fg = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    fg.setAttribute('class', 'rest-ring-fg');
    fg.setAttribute('cx', '110'); fg.setAttribute('cy', '110'); fg.setAttribute('r', String(r));
    fg.setAttribute('stroke-dasharray', String(c));
    fg.setAttribute('stroke-dashoffset', '0');
    const bg = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    bg.setAttribute('class', 'rest-ring-bg');
    bg.setAttribute('cx', '110'); bg.setAttribute('cy', '110'); bg.setAttribute('r', String(r));
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('viewBox', '0 0 220 220');
    svg.appendChild(bg); svg.appendChild(fg);

    const label = h('span', { className: 'rest-timer' }, '00:00');
    restRingEls = { fg, circumference: c, label };

    const screen = h('div', { className: 'focus-screen' },
      h('div', { className: 'focus-top' },
        h('span', {}),
        h('span', { className: 'workout-tag' }, workoutName.label),
        h('span', {})
      ),
      h('div', { className: 'rest-screen' },
        h('div', { className: 'rest-label' }, 'DESCANSO'),
        h('div', { className: 'rest-ring-wrap' }, svg, h('div', { className: 'rest-ring-content' }, label)),
        nextItem ? h('div', { className: 'next-up' }, `Próximo: ${nextItem.def.name} · Série ${nextItem.setIndex + 1}`) : null,
        h('div', { className: 'rest-actions' },
          h('button', { className: 'btn btn-outline grow', onClick: () => addRest(30) }, '+30 SEGUNDOS'),
          h('button', { className: 'btn btn-primary grow', onClick: () => skipRest() }, 'PULAR DESCANSO')
        )
      )
    );
    mount(viewEl, screen);
    timer.resumeIfActive();
    updateRestUI(timer.remainingSeconds());
  }

  function renderCelebration() {
    const d = celebrationData || { xpGained: 100, records: [], leveledUp: false, comparisons: [] };
    const streaks = store.derived.streaks;

    const screen = h('div', { className: 'focus-screen' },
      h('div', { className: 'celebration' },
        icon('trophy', { className: 'trophy' }),
        h('h1', {}, 'TREINO CONCLUÍDO'),
        h('p', { className: 'sub' }, workoutName.label + ` · Dia ${day}`),
        h('div', { className: 'xp-gain' }, `+${d.xpGained} XP`),
        d.records.length ? h('div', { className: 'records-list' },
          d.records.map(() => h('div', { className: 'record-pill' }, icon('trophy', { size: 16 }), 'NOVO RECORDE PESSOAL'))
        ) : null,
        d.leveledUp ? h('div', { className: 'record-pill' }, icon('bolt', { size: 16 }), `SUBIU PARA ${d.newLevelName}`) : null,
        d.comparisons.length ? h('div', { className: 'card card-tight stack', style: { width: '100%', textAlign: 'left' } },
          d.comparisons.map(c => h('div', { className: 'compare-line' },
            h('span', { className: 'text-dim' }, c.name),
            h('span', { className: c.cmp.diff >= 0 ? 'delta-pos' : 'delta-neg' }, `${formatSignedNumber(c.cmp.diff)} (${formatSignedPercent(c.cmp.pct)})`)
          ))
        ) : null,
        h('div', { className: 'row' }, icon('flame', { size: 18 }), h('span', {}, `Sequência atual: ${streaks.current} ${streaks.current === 1 ? 'dia' : 'dias'}`)),
        h('button', {
          className: 'btn btn-primary btn-huge btn-block',
          onClick: () => {
            openCheckinModal(day, {
              onSaved: () => nav.navigateTo('hoje'),
              onSkip: () => nav.navigateTo('hoje'),
            });
          },
        }, 'FINALIZAR DIA')
      )
    );
    mount(viewEl, screen);
  }

  function render() {
    const session = store.state.activeSession;
    if (!session || session.day !== day) { renderCelebration(); return; }
    if (session.flowIndex >= seq.length) { renderCelebration(); return; }
    if (session.resting) { renderRestScreen(); } else { restRingEls = null; renderEntryScreen(); }
  }

  render();

  return () => { timer.destroy(); };
}
