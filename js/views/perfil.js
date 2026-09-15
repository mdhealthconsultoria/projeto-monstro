import { h, mount, formatDateShort } from '../utils.js';
import { icon } from '../icons.js';
import { store } from '../store.js';
import { TOTAL_DAYS, LEVELS } from '../model.js';
import { confirmDialog, toast } from '../ui.js';
import { openTestModal } from './tests.js';

function testRow(label, which, existing, unitMap) {
  return h('div', { className: 'row-between' },
    h('div', {},
      h('div', {}, label),
      existing
        ? h('div', { className: 'text-dim', style: { fontSize: '12px' } },
            `Flexões ${existing.pushups ?? '—'} · Barras ${existing.pullups ?? '—'} · Wall Sit ${existing.wallSit ?? '—'}s · ${existing.bodyWeight ?? '—'}kg`)
        : h('div', { className: 'text-faint', style: { fontSize: '12px' } }, 'Ainda não registrado')
    ),
    h('button', { className: 'btn btn-outline btn-sm', onClick: () => openTestModal(which) }, existing ? 'Editar' : 'Registrar')
  );
}

export function renderPerfil(viewEl, params, nav) {
  let deferredInstallPrompt = null;
  const onBeforeInstall = e => { e.preventDefault(); deferredInstallPrompt = e; draw(); };
  window.addEventListener('beforeinstallprompt', onBeforeInstall);

  function draw() {
    const state = store.state;
    const { computed, streaks, level } = store.derived;
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone;

    const levelsList = h('div', { className: 'stack' }, LEVELS.map(l =>
      h('div', { className: 'row-between' },
        h('span', { className: l.level === level.level ? 'text-dim' : 'text-faint', style: l.level === level.level ? { color: 'var(--orange-2)', fontWeight: '700' } : {} }, `LVL ${l.level} — ${l.name}`),
        h('span', { className: 'text-faint', style: { fontSize: '12px' } }, `${l.min} XP`)
      )
    ));

    const installCard = isStandalone ? null : h('div', { className: 'card stack' },
      h('div', { className: 'row' }, icon('share', { size: 20 }), h('h3', {}, 'Instalar aplicativo')),
      deferredInstallPrompt
        ? h('button', {
            className: 'btn btn-primary btn-block',
            onClick: async () => {
              deferredInstallPrompt.prompt();
              await deferredInstallPrompt.userChoice;
              deferredInstallPrompt = null;
              draw();
            },
          }, 'Adicionar à tela inicial')
        : h('p', { className: 'text-dim', style: { fontSize: '13px' } },
            'No iPhone: toque em Compartilhar (ícone com seta) na barra do Safari e escolha "Adicionar à Tela de Início". No Android/Chrome: use o menu ⋮ e escolha "Instalar app".')
    );

    mount(viewEl, h('div', { className: 'stack fade-up' },
      h('h1', {}, 'Perfil'),

      h('div', { className: 'card stack' },
        h('div', { className: 'row-between' },
          h('div', {},
            h('div', { className: 'level-badge' }, `LVL ${level.level} · ${level.name}`),
            h('div', { className: 'text-dim mt-8' }, `${computed.totalXP} XP totais`)
          ),
          h('div', { className: 'row' }, icon('flame', { size: 22 }), h('span', { style: { fontFamily: 'var(--font-display)', fontSize: '20px' } }, streaks.current))
        ),
        h('div', { className: 'stat-grid' },
          h('div', { className: 'stat-box' }, h('div', { className: 'val' }, `${computed.workoutsCompleted}/${TOTAL_DAYS}`), h('div', { className: 'lbl' }, 'Treinos')),
          h('div', { className: 'stat-box' }, h('div', { className: 'val' }, streaks.best), h('div', { className: 'lbl' }, 'Maior seq.')),
          h('div', { className: 'stat-box' }, h('div', { className: 'val' }, computed.recordsBrokenTotal), h('div', { className: 'lbl' }, 'Recordes'))
        )
      ),

      h('div', { className: 'card stack' },
        h('div', { className: 'section-title' }, 'NÍVEIS'),
        levelsList
      ),

      h('div', { className: 'card stack' },
        h('div', { className: 'section-title' }, 'TESTE INICIAL E FINAL'),
        testRow('Dia 1', 'day1', state.tests.day1),
        h('hr', { className: 'divider' }),
        testRow('Dia 30', 'day30', state.tests.day30),
        (state.tests.day1 && state.tests.day30) ? h('button', { className: 'btn btn-outline btn-block mt-8', onClick: () => nav.navigateTo('resultado') }, 'Ver resultado dos 30 dias') : null
      ),

      installCard,

      h('div', { className: 'card stack' },
        h('div', { className: 'section-title' }, 'CONTA E SINCRONIZAÇÃO' ),
        h('p', { className: 'text-dim', style: { fontSize: '13px' } }, `Dados salvos localmente neste dispositivo (${formatDateShort(state.startDate)} — início do desafio). Login e sincronização em nuvem chegam em uma próxima versão.`),
        h('button', { className: 'btn btn-outline btn-block', disabled: true }, icon('profile', { size: 18 }), 'Entrar (em breve)')
      ),

      h('div', { className: 'card stack' },
        h('div', { className: 'section-title' }, 'ZONA DE RISCO'),
        h('button', {
          className: 'btn btn-danger btn-block',
          onClick: async () => {
            const ok = await confirmDialog({
              title: 'Apagar todos os dados',
              message: 'Isso vai apagar permanentemente todos os treinos, fotos, testes e XP deste dispositivo. Esta ação não pode ser desfeita.',
              confirmLabel: 'Apagar tudo',
              danger: true,
            });
            if (!ok) return;
            await store.resetAll();
            toast('Todos os dados foram apagados', { iconName: 'trash' });
            nav.navigateTo('hoje');
          },
        }, icon('trash', { size: 18 }), 'Apagar todos os dados')
      )
    ));
  }

  draw();
  const unsub = store.subscribe(draw);
  return () => { unsub(); window.removeEventListener('beforeinstallprompt', onBeforeInstall); };
}
