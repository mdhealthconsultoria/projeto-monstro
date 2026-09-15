import { h, mount } from '../utils.js';
import { icon } from '../icons.js';
import { store } from '../store.js';
import { TOTAL_DAYS, isDayStarted } from '../model.js';
import { formatSignedPercent } from '../logic.js';

function pctChange(start, end) {
  if (start == null || end == null) return null;
  if (start === 0) return end > 0 ? 100 : 0;
  return ((end - start) / start) * 100;
}

function metricCard(label, start, end, unit) {
  if (start == null || end == null) {
    return h('div', { className: 'card card-tight' },
      h('div', { className: 'section-title' }, label),
      h('div', { className: 'text-faint' }, 'Não registrado')
    );
  }
  const pct = pctChange(start, end);
  return h('div', { className: 'card card-tight stack' },
    h('div', { className: 'section-title' }, label),
    h('div', { className: 'row-between' },
      h('span', {}, `${start}${unit} → `, h('strong', { style: { color: 'var(--orange-2)', fontSize: '20px' } }, `${end}${unit}`)),
      pct != null ? h('span', { className: pct >= 0 ? 'delta-pos' : 'delta-neg', style: { fontWeight: '700' } }, formatSignedPercent(pct)) : null
    )
  );
}

export function renderResultado(viewEl, params, nav) {
  function draw() {
    const state = store.state;
    const { computed, level } = store.derived;
    const t1 = state.tests.day1;
    const t30 = state.tests.day30;

    let daysStarted = 0;
    for (let d = 1; d <= TOTAL_DAYS; d++) if (isDayStarted(state.days[d])) daysStarted++;

    const adherence = Math.round((computed.workoutsCompleted / TOTAL_DAYS) * 100);

    const body = (!t1 || !t30)
      ? h('div', { className: 'empty-state' }, icon('scale', { size: 32 }), h('div', {}, 'Registre o teste do Dia 1 e do Dia 30 no seu Perfil para gerar o resultado completo.'))
      : h('div', { className: 'stack' },
          metricCard('Flexões seguidas', t1.pushups, t30.pushups, ''),
          metricCard('Barras seguidas', t1.pullups, t30.pullups, ''),
          metricCard('Wall Sit', t1.wallSit, t30.wallSit, 's'),
          metricCard('Peso corporal', t1.bodyWeight, t30.bodyWeight, 'kg')
        );

    const screen = h('div', { className: 'focus-screen stack' },
      h('div', { className: 'focus-top' },
        h('button', { className: 'icon-btn', 'aria-label': 'Fechar', onClick: () => nav.navigateTo('perfil') }, icon('close', { size: 20 })),
        h('span', { className: 'workout-tag' }, '30 DIAS'),
        h('span', { style: { width: '44px' } })
      ),
      h('div', { className: 'celebration' },
        icon('trophy', { className: 'trophy' }),
        h('h1', {}, 'RESULTADO DOS 30 DIAS'),
        h('p', { className: 'sub' }, 'Baseado exclusivamente nos dados que você registrou.')
      ),
      body,
      h('div', { className: 'card stack' },
        h('div', { className: 'section-title' }, 'RESUMO DO DESAFIO'),
        h('div', { className: 'stat-grid' },
          h('div', { className: 'stat-box' }, h('div', { className: 'val' }, daysStarted), h('div', { className: 'lbl' }, 'Dias iniciados')),
          h('div', { className: 'stat-box' }, h('div', { className: 'val' }, computed.workoutsCompleted), h('div', { className: 'lbl' }, 'Treinos realizados')),
          h('div', { className: 'stat-box' }, h('div', { className: 'val' }, `${adherence}%`), h('div', { className: 'lbl' }, 'Adesão'))
        ),
        h('div', { className: 'stat-grid' },
          h('div', { className: 'stat-box' }, h('div', { className: 'val' }, computed.recordsBrokenTotal), h('div', { className: 'lbl' }, 'Recordes')),
          h('div', { className: 'stat-box' }, h('div', { className: 'val' }, computed.totalXP), h('div', { className: 'lbl' }, 'XP total')),
          h('div', { className: 'stat-box' }, h('div', { className: 'val' }, `LVL ${level.level}`), h('div', { className: 'lbl' }, level.name))
        )
      ),
      navigator.share ? h('button', {
        className: 'btn btn-outline btn-block',
        onClick: () => navigator.share({
          title: '30 DAYS — Projeto Monstro',
          text: `Completei o Projeto Monstro: ${computed.workoutsCompleted}/${TOTAL_DAYS} treinos, ${computed.recordsBrokenTotal} recordes, LVL ${level.level} ${level.name}.`,
        }).catch(() => {}),
      }, icon('share', { size: 18 }), 'Compartilhar resultado') : null
    );
    mount(viewEl, screen);
  }

  draw();
  const unsub = store.subscribe(draw);
  return () => unsub();
}
