import { h, mount } from '../utils.js';
import { icon } from '../icons.js';

const SUPPORT_EMAIL = 'matheusdavid13723@gmail.com';

const FAQ = [
  {
    q: 'O que é o Montro Score?',
    a: 'É a média das áreas da vida que você ativou em Minha Evolução. Uma área que você nunca ativou não entra na conta — ela não derruba sua pontuação geral.',
  },
  {
    q: 'Por que uma pontuação aparece como "—" em vez de um número?',
    a: '"—" significa que ainda não há dados suficientes ali (nenhum hábito ativo na área, ou nenhuma informação de saúde/profissional preenchida ainda). Isso é diferente de 0 — 0 seria "você começou e está indo mal"; "—" é "você ainda não começou".',
  },
  {
    q: 'Meus dados são privados?',
    a: 'Sim. Saúde, fotos de evolução e reflexões pessoais nunca aparecem para outras pessoas. Em comunidades, só é visível o que você escolher em Perfil → Privacidade (nome, avatar, sequência, nível, XP, treinos).',
  },
  {
    q: 'Meus dados sincronizam entre aparelhos?',
    a: 'Sim — contas reais sincronizam automaticamente com a nuvem, então você pode entrar de outro aparelho e continuar de onde parou. A única exceção são as fotos de evolução, que por enquanto ficam salvas só no aparelho onde foram tiradas.',
  },
  {
    q: 'O Health Score é um diagnóstico médico?',
    a: 'Não. É uma leitura comportamental simples (sono, atividade, alimentação, tabagismo, álcool) a partir dos seus próprios hábitos e do que você informar. Não é calculadora de risco clínico nem substitui avaliação médica.',
  },
  {
    q: 'O que acontece se eu perder um dia de um hábito?',
    a: 'Sua sequência atual para, mas o histórico e o progresso total continuam contando normalmente. Um dia perdido não apaga o que você já construiu — é só um dia sem check-in.',
  },
  {
    q: 'Como funciona a Jornada de 90 dias?',
    a: 'Ela tem 3 fases fixas — Construção (dias 1–30), Fortalecimento (31–60) e Autonomia (61–90) — e é separada do desafio de calistenia de 30 dias. Não é uma garantia automática de hábito formado: é um período estruturado de treino e consolidação.',
  },
  {
    q: 'Como excluo minha conta?',
    a: 'Em Perfil → Zona de risco → Excluir conta. A ação é permanente e remove todos os seus dados — não pode ser desfeita.',
  },
];

function faqItem(item, isOpen, onToggle) {
  return h('div', { className: 'card card-tight' },
    h('button', {
      className: 'row-between', style: { width: '100%', textAlign: 'left', color: 'var(--text)' },
      onClick: onToggle,
    },
      h('span', { style: { fontWeight: 700, fontSize: '13.5px' } }, item.q),
      icon('chevronRight', { size: 16, className: isOpen ? 'rotate-90' : '' })
    ),
    isOpen ? h('p', { className: 'text-dim', style: { fontSize: '13px', marginTop: '8px' } }, item.a) : null
  );
}

export function renderAjuda(viewEl, params, nav) {
  let openIndex = null;
  const descriptionInput = h('textarea', { placeholder: 'Descreva o que aconteceu — o que você esperava e o que aconteceu de diferente.', rows: 5 });

  function draw() {
    mount(viewEl, h('div', { className: 'stack fade-up' },
      h('div', { className: 'row-between' },
        h('button', { className: 'icon-btn', 'aria-label': 'Voltar', onClick: () => nav.navigateTo('perfil') }, icon('chevronLeft', { size: 20 })),
        h('h1', {}, 'Central de Ajuda'),
        h('span', { style: { width: '44px' } })
      ),

      h('div', { className: 'section-title' }, 'PERGUNTAS FREQUENTES'),
      h('div', { className: 'stack' }, FAQ.map((item, i) =>
        faqItem(item, openIndex === i, () => { openIndex = openIndex === i ? null : i; draw(); })
      )),

      h('div', { className: 'card stack' },
        h('div', { className: 'section-title' }, 'REPORTAR UM PROBLEMA'),
        h('p', { className: 'text-faint', style: { fontSize: '11.5px', marginTop: '-6px' } },
          'Isso abre seu aplicativo de e-mail com uma mensagem pronta, direto para quem cuida do Skeelo Evolution. Não é um chat ao vivo — a resposta chega por e-mail.'),
        h('div', { className: 'field' }, h('label', {}, 'O que aconteceu?'), descriptionInput),
        h('button', { className: 'btn btn-primary btn-block', onClick: () => {
          const info = [
            `Descrição: ${descriptionInput.value.trim() || '(não preenchido)'}`,
            `Data: ${new Date().toLocaleString('pt-BR')}`,
            `Dispositivo: ${navigator.userAgent}`,
            `Tela: ${window.innerWidth}x${window.innerHeight}`,
            `App instalado: ${(window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone) ? 'sim' : 'não'}`,
          ].join('\n');
          const subject = encodeURIComponent('Skeelo Evolution — reportar um problema');
          const body = encodeURIComponent(info);
          window.location.href = `mailto:${SUPPORT_EMAIL}?subject=${subject}&body=${body}`;
        } }, icon('send', { size: 16 }), 'Enviar por e-mail')
      )
    ));
  }

  draw();
  return () => {};
}
