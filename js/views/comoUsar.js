import { h, mount } from '../utils.js';
import { icon, pyramidMark } from '../icons.js';

const STEPS = [
  { iconName: 'target', title: '1. Escolha sua base', text: 'No onboarding, você escolhe um objetivo e cria a sua primeira meta. Depois pode ajustar tudo no Perfil e em Minha Base.' },
  { iconName: 'today', title: '2. Abra o Hoje', text: 'A tela Hoje mostra sua próxima ação importante: treino, hábito, checklist ou respiração. Você não precisa decidir tudo de uma vez.' },
  { iconName: 'checkCircle', title: '3. Registre o que fez', text: 'Conclua uma série, marque um hábito ou finalize uma tarefa. O progresso, XP e sequência são calculados somente a partir do que você registrou.' },
  { iconName: 'evolution', title: '4. Veja sua evolução', text: 'Use Progresso para acompanhar recordes, consistência e histórico. Entre em Comunidades quando quiser evoluir junto com outras pessoas.' },
];

export function renderComoUsar(viewEl, params, nav) {
  const backTo = params && params.backTo ? params.backTo : 'landing';
  mount(viewEl, h('div', { className: 'stack fade-up how-to-screen' },
    h('button', { className: 'btn btn-ghost how-to-back', onClick: () => nav.navigateTo(backTo) }, icon('chevronLeft', { size: 18 }), 'Voltar'),
    h('div', { className: 'how-to-hero' },
      pyramidMark({ size: 58 }),
      h('div', {}, h('h1', {}, 'Como usar o Skeelo'), h('p', { className: 'text-dim' }, 'Um caminho simples para começar sem se perder.'))
    ),
    h('div', { className: 'how-to-steps' }, STEPS.map(step => h('div', { className: 'how-to-step card-tight' },
      h('div', { className: 'how-to-step-icon' }, icon(step.iconName, { size: 22 })),
      h('div', {}, h('h2', {}, step.title), h('p', {}, step.text))
    ))),
    h('div', { className: 'card stack' },
      h('div', { className: 'row' }, icon('wind', { size: 20 }), h('h2', {}, 'Precisa de um começo leve?')),
      h('p', { className: 'text-dim' }, 'Use Respire e Comece para criar um pequeno ritual de atenção antes do treino, do foco ou do dia.'),
      h('button', { className: 'btn btn-primary btn-block', onClick: () => nav.navigateTo('respirar') }, 'Abrir Respire e Comece')
    ),
    h('button', { className: 'btn btn-outline btn-block', onClick: () => nav.navigateTo('signup') }, 'Criar minha conta')
  ));
}
