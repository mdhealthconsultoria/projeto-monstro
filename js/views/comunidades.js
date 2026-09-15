import { h, mount } from '../utils.js';
import { icon } from '../icons.js';

export function renderComunidades(viewEl, params, nav) {
  mount(viewEl, h('div', { className: 'stack fade-up' },
    h('h1', {}, 'Comunidades'),
    h('p', { className: 'text-dim' }, 'Amigos, grupos e desafios coletivos.'),
    h('div', { className: 'card empty-state' },
      icon('users', { size: 36 }),
      h('h3', { style: { marginTop: '10px' } }, 'Comunidades chegam em breve'),
      h('p', { className: 'text-dim', style: { marginTop: '6px' } },
        'Estamos preparando a base de contas e segurança primeiro. Quando estiver pronto, aqui você vai poder buscar comunidades, pedir para entrar, participar de desafios em grupo e acompanhar um ranking — tudo com seus dados privados protegidos.'),
      h('div', { className: 'stack', style: { marginTop: '14px', textAlign: 'left' } },
        h('div', { className: 'row' }, icon('checkCircle', { size: 16, className: 'text-dim' }), h('span', { className: 'text-dim', style: { fontSize: '13px' } }, 'Buscar comunidades por tema')),
        h('div', { className: 'row' }, icon('checkCircle', { size: 16, className: 'text-dim' }), h('span', { className: 'text-dim', style: { fontSize: '13px' } }, 'Desafios em grupo com ranking próprio')),
        h('div', { className: 'row' }, icon('checkCircle', { size: 16, className: 'text-dim' }), h('span', { className: 'text-dim', style: { fontSize: '13px' } }, 'Pagamentos: em breve, nunca sem o seu consentimento'))
      )
    )
  ));
}
