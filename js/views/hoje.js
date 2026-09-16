import { h, mount } from '../utils.js';
import { icon, pyramidMark } from '../icons.js';
import { store } from '../store.js';
import { TOTAL_DAYS, WORKOUT_TYPES, typeForDay, isDayCompleted } from '../model.js';
import { aggregateDay, previousSimilarDay, compareAggregates, formatSignedNumber, formatSignedPercent } from '../logic.js';
import { openDayDetail } from './dayDetail.js';
import { openTestModal } from './tests.js';
import { pickInspiration } from '../inspirations.js';
import * as auth from '../services/auth.js';

const PRIMARY_RECORD_BY_TYPE = {
  A: { id: 'pushupSet', label: 'Flexões (série)', unit: 'reps' },
  B: { id: 'pullupSet', label: 'Barra fixa (série)', unit: 'reps' },
  C: { id: 'bulgarianSet', label: 'Búlgaro (série)', unit: 'reps' },
};

export function renderHoje(viewEl, params, nav) {
  let user = null;

  function draw() {
    const state = store.state;
    const { currentDay, computed, streaks, level } = store.derived;

    const header = h('div', { className: 'app-header stack' },
      h('div', { className: 'row' },
        pyramidMark({ size: 40, levels: [computed.workoutsCompleted > 0, Object.keys(state.habits).length > 0, false] }),
        h('div', {},
          h('h1', { className: 'brand-title' }, 'SKEELO ', h('span', { className: 'accent' }, 'EVOLUTION')),
          h('p', { className: 'brand-sub' }, 'Construa sua base. Evolua todos os dias.')
        )
      ),
      user ? h('p', { className: 'text-dim', style: { fontSize: '14px' } }, `Olá, ${user.nickname || user.name}.`) : null
    );

    const inspiration = user ? pickInspiration({ preference: (user.preferences && user.preferences.inspiration) || 'both', timeZone: user.timezone }) : null;
    const inspirationCard = inspiration ? h('div', { className: 'card card-tight' },
      h('p', { className: 'phrase' }, inspiration.text),
      inspiration.reference ? h('p', { className: 'text-faint', style: { fontSize: '12px', marginTop: '4px' } }, inspiration.reference) : null
    ) : null;

    const breathing = state.breathing || {};
    const now = new Date();
    const currentTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
    const completedBreathingToday = breathing.lastCompletedAt && new Date(breathing.lastCompletedAt).toLocaleDateString('pt-BR') === now.toLocaleDateString('pt-BR');
    const breathingDue = breathing.reminderTime && currentTime >= breathing.reminderTime && !completedBreathingToday;
    const breathingCard = h('div', { className: `card stack breathing-today ${breathingDue ? 'is-due' : ''}` },
      h('div', { className: 'row-between' },
        h('div', { className: 'row' }, icon('wind', { size: 21 }), h('h3', {}, completedBreathingToday ? 'Respiração concluída' : 'Respire e Comece')),
        breathing.reminderTime ? h('span', { className: `pill ${breathingDue ? 'pill-orange' : 'pill-green'}` }, icon('clock', { size: 13 }), ` ${breathing.reminderTime}`) : null
      ),
      h('p', { className: 'text-dim' }, completedBreathingToday ? 'Você já separou um momento para sua base hoje.' : breathingDue ? 'Seu lembrete chegou. Reserve alguns minutos para se preparar com calma.' : 'Uma prática curta de atenção antes de treinar, focar ou recomeçar.'),
      h('button', { className: 'btn btn-outline btn-block', onClick: () => nav.navigateTo('respirar') }, icon('wind', { size: 18 }), completedBreathingToday ? 'Fazer novamente' : 'Respirar agora')
    );

    if (!currentDay) {
      mount(viewEl, h('div', { className: 'stack fade-up' },
        header,
        inspirationCard,
        h('div', { className: 'card stack' },
          h('div', { className: 'row' }, pyramidMark({ size: 28, levels: [false, false, false] }), h('h3', {}, 'Pronto para começar?')),
          h('p', { className: 'text-dim' }, 'Você ainda não iniciou o desafio de 30 dias. Quando começar, o Dia 1 passa a contar a partir de hoje.'),
          h('button', { className: 'btn btn-primary btn-huge btn-block', onClick: () => store.startChallengeToday() }, icon('play', { size: 20 }), 'INICIAR DESAFIO DE 30 DIAS')
        ),
        h('div', { className: 'card stack' },
          h('div', { className: 'section-title' }, 'ENQUANTO ISSO' ),
          h('button', { className: 'btn btn-outline btn-block', onClick: () => nav.navigateTo('minhaBase') }, icon('pyramid', { size: 18 }), 'Ver Minha Base'),
          h('button', { className: 'btn btn-outline btn-block', onClick: () => nav.navigateTo('checklist') }, icon('checkCircle', { size: 18 }), 'Checklist diário')
        ),
        breathingCard,
        h('button', { className: 'btn btn-ghost btn-block', onClick: () => nav.navigateTo('comoUsar', { backTo: 'hoje' }) }, icon('compass', { size: 18 }), 'Como usar o Skeelo')
      ));
      return;
    }

    const dayRec = state.days[currentDay];
    const completed = isDayCompleted(dayRec);
    const type = typeForDay(currentDay);
    const workoutType = WORKOUT_TYPES[type];
    const pct = Math.round((currentDay / TOTAL_DAYS) * 100);

    const prevSimilar = previousSimilarDay(state, currentDay);
    const prevAgg = prevSimilar ? aggregateDay(prevSimilar) : null;
    const currAgg = completed ? aggregateDay(dayRec) : null;

    const primaryKey = type === 'A' ? 'pushups' : type === 'B' ? 'pullups' : 'bulgarian';
    const cmp = (prevAgg && currAgg) ? compareAggregates(prevAgg, currAgg, primaryKey) : null;

    const recordInfo = PRIMARY_RECORD_BY_TYPE[type];
    const recordBest = computed.bestByCategory[recordInfo.id];

    const needsDay1Test = currentDay === 1 && !state.tests.day1;
    const needsDay30Test = currentDay >= TOTAL_DAYS && !state.tests.day30 && computed.workoutsCompleted >= 1;
    const canShowResult = !!state.tests.day1 && !!state.tests.day30;

    const heroCard = h('div', { className: 'card stack' },
      h('div', { className: 'row-between' },
        h('div', { className: 'hero-day' }, h('span', { className: 'num' }, String(currentDay).padStart(2, '0')), h('span', { className: 'of30' }, `/ ${TOTAL_DAYS}`)),
        h('div', { className: 'level-badge' }, `LVL ${level.level} · ${level.name}`)
      ),
      h('div', { className: 'progress-track step-track' }, h('div', { className: 'progress-fill', style: { width: pct + '%' } })),
      h('div', { className: 'stat-grid' },
        h('div', { className: 'stat-box' }, h('div', { className: 'val row', style: { justifyContent: 'center' } }, icon('flame', { size: 18 }), streaks.current), h('div', { className: 'lbl' }, 'Sequência')),
        h('div', { className: 'stat-box' }, h('div', { className: 'val' }, streaks.best), h('div', { className: 'lbl' }, 'Maior sequência')),
        h('div', { className: 'stat-box' }, h('div', { className: 'val' }, `${computed.workoutsCompleted}/${TOTAL_DAYS}`), h('div', { className: 'lbl' }, 'Concluídos'))
      ),
      streaks.current > 0 && !completed ? h('p', { className: 'streak-risk' }, icon('flame', { size: 14 }), ` Você já construiu ${streaks.current} dia${streaks.current === 1 ? '' : 's'}. Complete sua base de hoje.`) : null,
      h('div', { className: 'xp-row' },
        h('div', { className: 'grow progress-track' }, h('div', { className: 'progress-fill green', style: { width: `${Math.round(level.progress * 100)}%` } })),
        h('span', { className: 'text-dim', style: { fontSize: '12px', whiteSpace: 'nowrap' } }, level.next ? `${level.xpIntoLevel}/${level.xpForNext} XP` : `${computed.totalXP} XP · MAX`)
      )
    );

    const workoutCard = h('div', { className: 'card stack' },
      h('div', { className: 'row-between' },
        h('span', { className: 'workout-tag' }, workoutType.label),
        completed ? h('span', { className: 'pill pill-green' }, icon('checkCircle', { size: 14 }), ' Concluído') : h('span', { className: 'pill pill-orange' }, 'Pendente')
      ),
      cmp ? h('div', { className: 'stack' },
        h('div', { className: 'section-title' }, 'Comparação com o último treino semelhante'),
        h('div', { className: 'compare-line' },
          h('span', {}, `Última vez: ${cmp.prev}`),
          h('span', {}, `Hoje: ${cmp.curr}`)
        ),
        h('div', { className: 'compare-line' },
          h('span', { className: 'text-dim' }, 'Resultado'),
          h('span', { className: cmp.diff >= 0 ? 'delta-pos' : 'delta-neg' }, `${formatSignedNumber(cmp.diff)} reps (${formatSignedPercent(cmp.pct)})`)
        )
      ) : (prevSimilar ? null : h('p', { className: 'text-faint', style: { fontSize: '13px' } }, 'Ainda não há um treino anterior deste tipo para comparar.')),
      recordBest.value > 0 ? h('div', { className: 'row', style: { fontSize: '13px', color: 'var(--text-dim)' } }, icon('target', { size: 16 }), `Recorde a superar — ${recordInfo.label}: `, h('strong', { style: { color: 'var(--orange-2)' } }, ` ${recordBest.value} ${recordInfo.unit}`)) : null,
      completed
        ? h('div', { className: 'row' },
            h('button', { className: 'btn btn-outline grow', onClick: () => openDayDetail(currentDay, { onClose: draw }) }, icon('edit', { size: 18 }), 'Ver / Editar registro')
          )
        : h('button', { className: 'btn btn-primary btn-huge btn-block', onClick: () => nav.navigateTo('treino', { day: currentDay }) }, icon('play', { size: 20 }), 'COMEÇAR TREINO')
    );

    const testCard = (needsDay1Test || needsDay30Test) ? h('div', { className: 'card stack' },
      h('div', { className: 'row' }, icon('scale', { size: 20 }), h('h3', {}, needsDay1Test ? 'Teste inicial' : 'Teste final')),
      h('p', { className: 'text-dim' }, needsDay1Test
        ? 'Antes de começar, registre seus números de base para medir sua evolução em 30 dias.'
        : 'O desafio está terminando. Registre seu teste final para ver seu resultado completo.'),
      h('button', { className: 'btn btn-primary btn-block', onClick: () => openTestModal(needsDay1Test ? 'day1' : 'day30', { onSaved: draw }) }, 'Registrar teste')
    ) : null;

    const resultCard = canShowResult ? h('div', { className: 'card stack' },
      h('div', { className: 'row' }, icon('trophy', { size: 20 }), h('h3', {}, 'Resultado dos 30 dias')),
      h('p', { className: 'text-dim' }, 'Seus testes inicial e final já foram registrados.'),
      h('button', { className: 'btn btn-outline btn-block', onClick: () => nav.navigateTo('resultado') }, 'Ver resultado completo')
    ) : null;

    mount(viewEl, h('div', { className: 'stack fade-up' }, header, inspirationCard, heroCard, breathingCard, workoutCard, testCard, resultCard, h('button', { className: 'btn btn-ghost btn-block', onClick: () => nav.navigateTo('comoUsar', { backTo: 'hoje' }) }, icon('compass', { size: 18 }), 'Como usar o Skeelo')));
  }

  auth.getSession().then(session => { user = session ? session.user : null; draw(); });
  draw();
  const unsub = store.subscribe(draw);
  return () => unsub();
}
