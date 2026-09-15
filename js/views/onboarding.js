import { h, mount } from '../utils.js';
import { icon } from '../icons.js';
import { store } from '../store.js';
import * as auth from '../services/auth.js';
import { newHabit } from '../habits.js';
import { HABIT_CATEGORIES } from '../habits.js';

const GOALS = [
  { key: 'forca', label: 'Força' },
  { key: 'disciplina', label: 'Disciplina' },
  { key: 'saude', label: 'Saúde' },
  { key: 'emagrecimento', label: 'Emagrecimento' },
  { key: 'desenvolvimento', label: 'Desenvolvimento pessoal' },
  { key: 'completa', label: 'Evolução completa' },
];

export function renderOnboarding(viewEl, params, nav) {
  const answers = {
    claimLegacy: null,
    goal: null,
    startToday: null,
    reminderTime: '',
    inspiration: 'both',
    firstGoalTitle: '',
    firstGoalCategory: 'personalizado',
  };

  let stepIndex = 0;
  let steps = ['goal', 'start', 'reminder', 'inspiration', 'firstGoal'];

  function progressBar() {
    const pct = Math.round(((stepIndex + 1) / steps.length) * 100);
    return h('div', { className: 'progress-track' }, h('div', { className: 'progress-fill', style: { width: pct + '%' } }));
  }

  function optionList(options, selectedKey, onSelect) {
    return h('div', { className: 'stack' }, options.map(opt =>
      h('button', {
        className: `option-row ${selectedKey === opt.key ? 'selected' : ''}`,
        onClick: () => { onSelect(opt.key); draw(); },
      },
        h('span', {}, opt.label),
        selectedKey === opt.key ? icon('check', { size: 18 }) : null
      )
    ));
  }

  function stepLegacy() {
    return h('div', { className: 'stack' },
      h('h2', {}, 'Achamos dados neste aparelho'),
      h('p', { className: 'text-dim' }, 'Encontramos um treino salvo neste dispositivo de antes da sua conta existir. Quer vincular esses dados à sua conta?'),
      h('div', { className: 'row' },
        h('button', { className: `btn grow ${answers.claimLegacy === false ? 'btn-primary' : 'btn-outline'}`, onClick: () => { answers.claimLegacy = false; next(); } }, 'Não, começar do zero'),
        h('button', { className: `btn grow ${answers.claimLegacy === true ? 'btn-primary' : 'btn-outline'}`, onClick: () => { answers.claimLegacy = true; next(); } }, 'Sim, vincular')
      )
    );
  }

  function stepGoal() {
    return h('div', { className: 'stack' },
      h('h2', {}, 'Qual é o seu objetivo principal?'),
      optionList(GOALS, answers.goal, k => { answers.goal = k; }),
    );
  }

  function stepStart() {
    return h('div', { className: 'stack' },
      h('h2', {}, 'Começar o desafio de 30 dias hoje?'),
      h('p', { className: 'text-dim' }, 'Você pode começar quando quiser — mas se começar hoje, o Dia 1 já é hoje.'),
      h('div', { className: 'row' },
        h('button', { className: `btn grow ${answers.startToday === true ? 'btn-primary' : 'btn-outline'}`, onClick: () => { answers.startToday = true; draw(); } }, 'Sim, começar hoje'),
        h('button', { className: `btn grow ${answers.startToday === false ? 'btn-primary' : 'btn-outline'}`, onClick: () => { answers.startToday = false; draw(); } }, 'Ainda não')
      )
    );
  }

  function stepReminder() {
    return h('div', { className: 'stack' },
      h('h2', {}, 'Horário preferido para lembretes'),
      h('p', { className: 'text-dim' }, 'Opcional — usamos isso quando as notificações estiverem disponíveis.'),
      h('div', { className: 'field' }, h('label', {}, 'Horário'),
        h('input', { type: 'time', value: answers.reminderTime, onInput: e => answers.reminderTime = e.target.value }))
    );
  }

  function stepInspiration() {
    const opts = [
      { key: 'phrase', label: 'Só frase motivacional' },
      { key: 'verse', label: 'Só versículo bíblico' },
      { key: 'both', label: 'Ambos' },
      { key: 'off', label: 'Desativado' },
    ];
    return h('div', { className: 'stack' },
      h('h2', {}, 'Mensagem diária'),
      optionList(opts, answers.inspiration, k => { answers.inspiration = k; }),
    );
  }

  function stepFirstGoal() {
    return h('div', { className: 'stack' },
      h('h2', {}, 'Crie sua primeira meta'),
      h('p', { className: 'text-dim' }, 'Vai para "Minha Base" — pode editar ou apagar depois.'),
      h('div', { className: 'field' }, h('label', {}, 'Título'),
        h('input', { type: 'text', placeholder: 'Ex: Ler 10 páginas por dia', value: answers.firstGoalTitle, onInput: e => answers.firstGoalTitle = e.target.value })),
      h('div', { className: 'field' }, h('label', {}, 'Categoria'),
        h('select', { onChange: e => answers.firstGoalCategory = e.target.value },
          HABIT_CATEGORIES.map(c => h('option', { value: c.key, selected: c.key === answers.firstGoalCategory }, c.label))
        ))
    );
  }

  const stepRenderers = { legacy: stepLegacy, goal: stepGoal, start: stepStart, reminder: stepReminder, inspiration: stepInspiration, firstGoal: stepFirstGoal };

  function canAdvance() {
    const s = steps[stepIndex];
    if (s === 'legacy') return answers.claimLegacy !== null;
    if (s === 'goal') return !!answers.goal;
    if (s === 'start') return answers.startToday !== null;
    return true;
  }

  function next() {
    if (stepIndex < steps.length - 1) { stepIndex++; draw(); }
    else finish();
  }
  function back() {
    if (stepIndex > 0) { stepIndex--; draw(); }
  }

  async function finish() {
    if (answers.claimLegacy) {
      await auth.claimLegacyData(store.userId);
      await store.loadForUser(store.userId);
    }
    if (answers.startToday) {
      store.startChallengeToday();
    }
    if (answers.firstGoalTitle.trim()) {
      store.mutate(s => {
        const habit = newHabit({ title: answers.firstGoalTitle, category: answers.firstGoalCategory });
        s.habits[habit.id] = habit;
      });
    }
    await auth.updateProfile({
      onboardingComplete: true,
      preferences: { goal: answers.goal, inspiration: answers.inspiration, reminderTime: answers.reminderTime || null },
    });
    nav.navigateTo('boot');
  }

  function draw() {
    const stepName = steps[stepIndex];
    const screen = h('div', { className: 'focus-screen stack onboarding-screen' },
      progressBar(),
      stepRenderers[stepName](),
      h('div', { className: 'row', style: { marginTop: '12px' } },
        stepIndex > 0 ? h('button', { className: 'btn btn-outline', onClick: back }, icon('chevronLeft', { size: 18 }), 'Voltar') : h('span'),
        h('button', { className: 'btn btn-primary grow', disabled: !canAdvance(), onClick: next }, stepIndex === steps.length - 1 ? 'Concluir' : 'Continuar', icon('chevronRight', { size: 18 }))
      )
    );
    mount(viewEl, screen);
  }

  auth.hasLegacyData().then(has => {
    if (has) steps = ['legacy', ...steps];
    draw();
  });
}
