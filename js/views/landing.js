import { h, mount } from '../utils.js';
import { icon, pyramidMark } from '../icons.js';

const PILLARS = [
  { iconName: 'bolt', title: 'Corpo', text: 'Treine, acompanhe força e transforme pequenos registros em evolução visível.' },
  { iconName: 'compass', title: 'Mente', text: 'Organize hábitos, foco, inglês e a rotina que sustenta seus próximos passos.' },
  { iconName: 'users', title: 'Comunidade', text: 'Entre em grupos e desafios que deixam sua evolução menos solitária.' },
];

export function renderLanding(viewEl, _params, nav) {
  const pillarCards = PILLARS.map(p => h('div', { className: 'landing-pillar card-tight' },
    h('div', { className: 'landing-pillar-icon' }, icon(p.iconName, { size: 22 })),
    h('div', {}, h('h3', {}, p.title), h('p', {}, p.text))
  ));

  mount(viewEl, h('div', { className: 'landing-screen fade-up' },
    h('div', { className: 'landing-hero' },
      h('div', { className: 'landing-mark', 'aria-label': 'Pirâmide Skeelo Evolution' }, pyramidMark({ size: 108 })),
      h('div', { className: 'pill pill-orange' }, icon('sparkle', { size: 14 }), ' SUA BASE COMEÇA AQUI'),
      h('h1', {}, 'Sua evolução começa', h('span', { className: 'accent-block' }, 'pela base.')),
      h('p', { className: 'landing-lead' }, 'Não é sobre mudar a sua vida em uma noite. É sobre honrar pequenas ações hoje — e deixar que elas construam algo maior.'),
      h('div', { className: 'landing-actions' },
        h('button', { className: 'btn btn-primary btn-huge btn-block', onClick: () => nav.navigateTo('signup') }, icon('play', { size: 20 }), 'COMEÇAR MINHA EVOLUÇÃO'),
        h('button', { className: 'btn btn-outline btn-block', onClick: () => nav.navigateTo('login') }, 'Já tenho uma conta')
      ),
      h('button', { className: 'landing-how-link', onClick: () => nav.navigateTo('comoUsar', { backTo: 'landing' }) }, icon('compass', { size: 18 }), 'Ver como o Skeelo funciona')
    ),
    h('section', { className: 'landing-section' },
      h('div', { className: 'section-title' }, 'O QUE VOCÊ CONSTRÓI AQUI'),
      h('div', { className: 'landing-pillars' }, pillarCards)
    ),
    h('section', { className: 'landing-proof card' },
      h('div', { className: 'landing-quote-mark' }, '“'),
      h('p', {}, 'A evolução não acontece em um dia. Ela acontece todos os dias.'),
      h('p', { className: 'text-dim' }, 'Você terá clareza sobre sua rotina, sua consistência e a sua evolução — um registro verdadeiro de cada passo.')
    ),
    h('p', { className: 'landing-footnote' }, 'Skeelo é uma ferramenta de evolução pessoal. Não substitui orientação médica, psicológica ou profissional.')
  ));
}
