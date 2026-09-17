import { h, mount, todayISO } from '../utils.js';
import { icon } from '../icons.js';
import { store } from '../store.js';
import { toast } from '../ui.js';
import { JOURNEY_PHASES, JOURNEY_TOTAL_DAYS, journeyPhaseForDay } from '../model.js';

function introCard() {
  return h('div', { className: 'stack' },
    h('p', { className: 'text-dim' },
      'Uma jornada estruturada de 90 dias em 3 fases, sobre o app inteiro — não é o desafio de calistenia (esse continua separado). Não é uma garantia automática de hábito formado, é um período de treinamento e consolidação.'),
    h('div', { className: 'stack' }, JOURNEY_PHASES.map(p => h('div', { className: 'card card-tight' },
      h('div', { style: { fontWeight: 700, fontSize: '13.5px' } }, `${p.label} · dias ${p.range[0]}–${p.range[1]}`),
      h('div', { className: 'text-dim', style: { fontSize: '12.5px', marginTop: '3px' } }, p.description)
    ))),
    h('button', { className: 'btn btn-primary btn-lg', onClick: () => {
      store.mutate(s => { s.journey90.startDate = todayISO(); });
      toast('Jornada de 90 dias iniciada', { iconName: 'check' });
    } }, 'Começar jornada de 90 dias')
  );
}

function activeCard(state, day, adherence) {
  const phase = journeyPhaseForDay(day);
  const pct = Math.round((day / JOURNEY_TOTAL_DAYS) * 100);
  const completed = day >= JOURNEY_TOTAL_DAYS;

  const track = h('div', { className: 'phase-track' }, JOURNEY_PHASES.map(p => {
    const isActive = p.key === phase.key;
    const isDone = day > p.range[1];
    return h('div', { className: `phase-step ${isActive ? 'active' : ''} ${isDone ? 'done' : ''}` },
      h('span', { className: 'phase-step-label' }, p.label),
      h('span', { className: 'phase-step-range' }, `${p.range[0]}–${p.range[1]}`)
    );
  }));

  return h('div', { className: 'stack' },
    h('div', { className: 'card stack' },
      h('div', { className: 'row-between' },
        h('div', {},
          h('div', { className: 'section-title' }, `FASE: ${phase.label.toUpperCase()}`),
          h('div', { style: { fontFamily: 'var(--font-display)', fontSize: '30px', color: 'var(--orange-2)' } }, `Dia ${day}/${JOURNEY_TOTAL_DAYS}`)
        )
      ),
      h('div', { className: 'progress-track' }, h('div', { className: 'progress-fill', style: { width: `${pct}%` } })),
      h('p', { className: 'text-dim', style: { fontSize: '13px' } }, phase.description),
      track
    ),
    adherence ? h('div', { className: 'row-between card card-tight' },
      h('div', {},
        h('span', {}, 'Dias com pelo menos um hábito marcado'),
        h('div', { className: 'text-faint', style: { fontSize: '11px' } }, `${adherence.active} de ${adherence.day} dias desde o início`)
      ),
      h('span', { style: { fontFamily: 'var(--font-display)', fontSize: '22px', color: 'var(--orange-2)' } }, `${adherence.rate}%`)
    ) : null,
    completed ? h('div', { className: 'card', style: { borderColor: 'rgba(79,174,106,0.4)', textAlign: 'center' } },
      h('div', { style: { color: 'var(--green)' } }, icon('trophy', { size: 28 })),
      h('h2', { style: { marginTop: '8px' } }, 'AUTONOMIA DESBLOQUEADA'),
      h('p', { className: 'text-dim', style: { fontSize: '13px' } },
        'Você chegou ao dia 90. Isso marca o fim da jornada estruturada — não uma garantia automática de que o hábito está formado para sempre, mas um sinal real de consistência sustentada. Seus hábitos continuam ativos normalmente.')
    ) : null
  );
}

export function renderJornada90(viewEl, params, nav) {
  function draw() {
    const state = store.state;
    const { journeyDay, journeyAdherence } = store.derived;

    mount(viewEl, h('div', { className: 'stack fade-up' },
      h('div', { className: 'row-between' },
        h('button', { className: 'icon-btn', 'aria-label': 'Voltar', onClick: () => nav.navigateTo('evoluir') }, icon('chevronLeft', { size: 20 })),
        h('h1', {}, 'Jornada de 90 dias'),
        h('span', { style: { width: '44px' } })
      ),
      journeyDay ? activeCard(state, journeyDay, journeyAdherence) : introCard()
    ));
  }

  draw();
  const unsub = store.subscribe(draw);
  return () => unsub();
}
