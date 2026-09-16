import { h, mount, todayISO, prefersReducedMotion } from '../utils.js';
import { icon } from '../icons.js';
import { store } from '../store.js';
import { toast } from '../ui.js';

const BREATHS_PER_ROUND = 20;
const TOTAL_ROUNDS = 3;
const PHASE_SECONDS = 3;

function localDay(iso) {
  if (!iso) return null;
  return new Date(iso).toLocaleDateString('pt-BR');
}

export function renderRespirar(viewEl, _params, nav) {
  let timerId = null;
  let phase = 'ready';
  let breath = 0;
  let round = 1;
  let paused = false;
  let acknowledged = false;
  let remaining = PHASE_SECONDS;

  function breathing() {
    return store.state.breathing || { reminderTime: null, lastCompletedAt: null, sessions: [] };
  }

  function clearTimer() {
    if (timerId) window.clearInterval(timerId);
    timerId = null;
  }

  function complete() {
    clearTimer();
    phase = 'complete';
    store.mutate(s => {
      s.breathing = s.breathing || { reminderTime: null, lastCompletedAt: null, sessions: [] };
      s.breathing.lastCompletedAt = todayISO();
      s.breathing.sessions = [...(s.breathing.sessions || []), { completedAt: s.breathing.lastCompletedAt, rounds: TOTAL_ROUNDS }].slice(-60);
    });
    toast('Sua prática foi registrada', { iconName: 'checkCircle' });
    draw();
  }

  function nextPhase() {
    remaining = PHASE_SECONDS;
    if (phase === 'in') phase = 'out';
    else {
      phase = 'in';
      breath += 1;
      if (breath > BREATHS_PER_ROUND) {
        if (round >= TOTAL_ROUNDS) { complete(); return; }
        round += 1;
        breath = 1;
      }
    }
    draw();
  }

  function start() {
    if (!acknowledged) return;
    phase = 'in';
    breath = 1;
    round = 1;
    remaining = PHASE_SECONDS;
    paused = false;
    clearTimer();
    timerId = window.setInterval(() => {
      if (paused) return;
      remaining -= 1;
      if (remaining <= 0) nextPhase();
      else draw();
    }, 1000);
    draw();
  }

  function saveReminder(value) {
    store.mutate(s => {
      s.breathing = s.breathing || { reminderTime: null, lastCompletedAt: null, sessions: [] };
      s.breathing.reminderTime = value || null;
    });
    toast(value ? `Lembrete dentro do app salvo para ${value}` : 'Lembrete removido', { iconName: 'clock' });
  }

  function draw() {
    const rec = breathing();
    const doneToday = localDay(rec.lastCompletedAt) === localDay(todayISO());
    const active = phase === 'in' || phase === 'out';
    const cue = phase === 'in' ? 'INSPIRAR COM CONFORTO' : phase === 'out' ? 'SOLTAR SEM FORÇAR' : '';
    const phaseText = phase === 'in' ? 'Puxe o ar suavemente. Pare se sentir tontura ou desconforto.' : phase === 'out' ? 'Deixe o ar sair, sem pressão.' : '';
    const circleClass = `breath-orb ${active ? `is-${phase}` : ''} ${prefersReducedMotion() ? 'reduced' : ''}`;
    const reminderInput = h('input', { type: 'time', value: rec.reminderTime || '', 'aria-label': 'Horário do lembrete de respiração' });

    const practice = active ? h('div', { className: 'breathing-practice card' },
      h('div', { className: 'breath-round' }, `Rodada ${round} de ${TOTAL_ROUNDS} · respiração ${Math.min(breath, BREATHS_PER_ROUND)} de ${BREATHS_PER_ROUND}`),
      h('div', { className: circleClass }, h('div', { className: 'breath-count' }, String(Math.max(remaining, 0)))),
      h('h2', { className: 'breath-cue' }, cue),
      h('p', { className: 'text-dim text-center' }, phaseText),
      h('div', { className: 'row' },
        h('button', { className: 'btn btn-outline grow', onClick: () => { paused = !paused; draw(); } }, paused ? icon('play', { size: 18 }) : icon('clock', { size: 18 }), paused ? 'Continuar' : 'Pausar'),
        h('button', { className: 'btn btn-ghost grow', onClick: () => { clearTimer(); phase = 'ready'; draw(); } }, 'Encerrar')
      )
    ) : phase === 'complete' ? h('div', { className: 'breathing-complete card stack text-center' },
      icon('checkCircle', { size: 42 }),
      h('h2', {}, 'Prática concluída'),
      h('p', { className: 'text-dim' }, 'Você separou alguns minutos para voltar para a sua base. Continue respirando normalmente.'),
      h('button', { className: 'btn btn-primary btn-block', onClick: () => nav.navigateTo('hoje') }, 'Voltar para Hoje')
    ) : h('div', { className: 'card stack' },
      h('div', { className: 'row' }, icon('wind', { size: 23 }), h('h2', {}, 'Respire e Comece')),
      h('p', { className: 'text-dim' }, 'Uma prática curta inspirada na respiração cíclica popularizada pelo método Wim Hof. Esta versão guia respirações confortáveis e não inclui retenção de ar cronometrada.'),
      h('div', { className: 'breathing-safety' }, icon('alert', { size: 20 }), h('p', {}, 'Faça sentado ou deitado em local seguro. Nunca faça na água, no banho, dirigindo, em pé ou em qualquer situação em que uma tontura possa causar risco. Pare se sentir desconforto.')),
      h('label', { className: 'breathing-consent' },
        h('input', { type: 'checkbox', checked: acknowledged, onChange: e => { acknowledged = e.target.checked; draw(); } }),
        h('span', {}, 'Estou em local seguro e entendo que esta é uma prática de bem-estar, não orientação médica.')
      ),
      h('button', { className: 'btn btn-primary btn-huge btn-block', disabled: !acknowledged, onClick: start }, icon('play', { size: 20 }), 'COMEÇAR PRÁTICA')
    );

    mount(viewEl, h('div', { className: 'stack fade-up breathing-screen' },
      h('button', { className: 'btn btn-ghost breathing-back', onClick: () => nav.navigateTo('evoluir') }, icon('chevronLeft', { size: 18 }), 'Evoluir'),
      h('div', {}, h('h1', {}, 'Respire e Comece'), h('p', { className: 'text-dim' }, doneToday ? 'Prática de hoje concluída. Se quiser, você pode fazer outra com calma.' : 'Um pequeno ritual antes de treinar, focar ou recomeçar.')),
      practice,
      !active && phase !== 'complete' ? h('div', { className: 'card stack' },
        h('div', { className: 'row' }, icon('clock', { size: 20 }), h('h2', {}, 'Lembrete de respiração')),
        h('p', { className: 'text-dim' }, 'Escolha um horário. O Skeelo mostrará este lembrete na tela Hoje quando você abrir o app. Notificações do sistema ainda não foram ativadas.'),
        h('div', { className: 'row' }, reminderInput, h('button', { className: 'btn btn-outline grow', onClick: () => saveReminder(reminderInput.value) }, 'Salvar horário')),
        rec.reminderTime ? h('button', { className: 'btn btn-ghost btn-block', onClick: () => saveReminder('') }, 'Remover lembrete') : null
      ) : null,
      h('p', { className: 'breathing-source' }, 'Segurança baseada nas orientações públicas do método Wim Hof: praticar sentado ou deitado e nunca dirigir ou ficar perto da água durante a prática.')
    ));
  }

  draw();
  return () => clearTimer();
}
