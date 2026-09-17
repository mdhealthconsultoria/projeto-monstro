import { h, mount, formatMMSS, formatDateShort, todayISO } from '../utils.js';
import { icon } from '../icons.js';
import { store } from '../store.js';
import { RestTimer } from '../timer.js';
import { toast } from '../ui.js';

const MODE_LABEL = { work: 'Foco', break: 'Pausa', longBreak: 'Pausa longa' };

export function renderFocus(viewEl, params, nav) {
  const timer = new RestTimer({
    getEndAt: () => (store.state.focus ? store.state.focus.endAt : null),
    setEndAt: endAt => store.mutate(s => { s.focus.endAt = endAt; }),
    onTick: remaining => updateCountdown(remaining),
    onDone: () => handleDone(),
  });

  let countdownEl = null;

  function updateCountdown(remaining) {
    if (countdownEl) countdownEl.textContent = formatMMSS(remaining);
  }

  function handleDone() {
    const f = store.state.focus;
    const wasWork = f.mode === 'work';
    store.mutate(s => {
      s.focus.sessions.unshift({
        date: todayISO(), mode: s.focus.mode, durationMin: s.focus.currentDurationMin,
        objective: s.focus.mode === 'work' ? s.focus.objective : '', completedAt: todayISO(),
      });
      s.focus.endAt = null;
      s.focus.pausedRemaining = null;
      if (wasWork) {
        s.focus.totalCyclesCompleted += 1;
        s.focus.cyclesCompleted += 1;
        const isLong = s.focus.cyclesCompleted >= s.focus.settings.cyclesUntilLong;
        s.focus.mode = isLong ? 'longBreak' : 'break';
        s.focus.currentDurationMin = isLong ? s.focus.settings.longBreakMin : s.focus.settings.breakMin;
        if (isLong) s.focus.cyclesCompleted = 0;
      } else {
        s.focus.mode = 'work';
        s.focus.currentDurationMin = s.focus.settings.workMin;
        s.focus.objective = '';
      }
    });
    toast(wasWork ? 'Sessão de foco concluída!' : 'Pausa concluída — hora de focar de novo.', { iconName: wasWork ? 'trophy' : 'check' });
  }

  function draw() {
    const state = store.state;
    const f = state.focus;
    const running = !!f.endAt;
    const paused = !running && f.pausedRemaining != null;
    const idle = !running && !paused;
    const isBreakMode = f.mode !== 'work';

    countdownEl = h('div', { className: 'focus-countdown' },
      running ? formatMMSS(timer.remainingSeconds())
        : paused ? formatMMSS(f.pausedRemaining)
        : formatMMSS((f.currentDurationMin != null ? f.currentDurationMin : (isBreakMode ? f.settings.breakMin : f.settings.workMin)) * 60)
    );

    const objectiveInput = h('input', {
      type: 'text', placeholder: 'No que você vai focar?', value: f.objective || '',
      disabled: !idle || isBreakMode,
      onChange: e => store.mutate(s => { s.focus.objective = e.target.value; }),
    });

    let controls;
    if (idle && !isBreakMode) {
      controls = h('button', { className: 'btn btn-primary btn-lg', onClick: () => {
        store.mutate(s => { s.focus.currentDurationMin = s.focus.settings.workMin; });
        timer.start(store.state.focus.settings.workMin * 60);
      } }, icon('play', { size: 18 }), `Iniciar foco (${f.settings.workMin} min)`);
    } else if (idle && isBreakMode) {
      controls = h('div', { className: 'stack' },
        h('button', { className: 'btn btn-primary btn-lg', onClick: () => timer.start(f.currentDurationMin * 60) },
          icon('play', { size: 18 }), `Iniciar ${f.mode === 'longBreak' ? 'pausa longa' : 'pausa'} (${f.currentDurationMin} min)`),
        h('button', { className: 'btn btn-outline btn-sm', onClick: () => {
          timer.stop();
          store.mutate(s => { s.focus.mode = 'work'; s.focus.currentDurationMin = s.focus.settings.workMin; s.focus.pausedRemaining = null; });
        } }, 'Pular pausa')
      );
    } else if (running) {
      controls = h('div', { className: 'row' },
        h('button', { className: 'btn btn-outline grow', onClick: () => {
          const remaining = timer.remainingSeconds();
          timer.stop();
          store.mutate(s => { s.focus.pausedRemaining = remaining; });
        } }, 'Pausar'),
        h('button', { className: 'btn btn-outline grow', onClick: () => {
          timer.stop();
          store.mutate(s => { s.focus.pausedRemaining = null; s.focus.endAt = null; });
        } }, 'Reiniciar')
      );
    } else if (paused) {
      controls = h('div', { className: 'row' },
        h('button', { className: 'btn btn-primary grow', onClick: () => {
          const remaining = store.state.focus.pausedRemaining || 0;
          store.mutate(s => { s.focus.pausedRemaining = null; });
          timer.start(remaining);
        } }, 'Retomar'),
        h('button', { className: 'btn btn-outline grow', onClick: () => {
          store.mutate(s => { s.focus.pausedRemaining = null; s.focus.endAt = null; });
        } }, 'Reiniciar')
      );
    }

    const todayKey = formatDateShort(todayISO());
    const sessionsToday = f.sessions.filter(s => formatDateShort(s.date) === todayKey);
    const workSessionsToday = sessionsToday.filter(s => s.mode === 'work');

    mount(viewEl, h('div', { className: 'stack fade-up' },
      h('div', { className: 'row-between' },
        h('button', { className: 'icon-btn', 'aria-label': 'Voltar', onClick: () => nav.navigateTo('evoluir') }, icon('chevronLeft', { size: 20 })),
        h('h1', {}, 'Foco'),
        h('span', { style: { width: '44px' } })
      ),
      h('p', { className: 'text-dim' }, 'Ciclos de foco cronometrados — o timer continua contando mesmo se você trocar de aba.'),
      h('div', { className: 'card focus-card stack', style: { alignItems: 'center', textAlign: 'center' } },
        h('span', { className: `pill ${isBreakMode ? 'pill-green' : 'pill-orange'}` }, MODE_LABEL[f.mode]),
        countdownEl,
        !isBreakMode ? h('div', { className: 'field', style: { width: '100%' } }, h('label', {}, 'Objetivo desta sessão'), objectiveInput) : null,
        controls
      ),
      h('div', { className: 'row-between card card-tight' },
        h('span', { className: 'text-dim' }, 'Ciclos de foco hoje'),
        h('span', { style: { fontFamily: 'var(--font-display)', fontSize: '20px', color: 'var(--orange-2)' } }, workSessionsToday.length)
      ),
      h('div', { className: 'section-title' }, 'HISTÓRICO DE HOJE'),
      sessionsToday.length
        ? h('div', { className: 'stack' }, sessionsToday.map(s => h('div', { className: 'row-between card card-tight' },
            h('div', {},
              h('div', { style: { fontWeight: 700, fontSize: '13px' } }, MODE_LABEL[s.mode] || s.mode),
              s.objective ? h('div', { className: 'text-faint', style: { fontSize: '11px' } }, s.objective) : null
            ),
            h('span', { className: 'text-dim', style: { fontSize: '12px' } }, `${s.durationMin} min`)
          )))
        : h('div', { className: 'empty-state' }, 'Nenhum ciclo concluído hoje ainda.')
    ));
  }

  draw();
  const unsub = store.subscribe(draw);
  timer.resumeIfActive();
  return () => { unsub(); timer.destroy(); };
}
