import { h, mount, formatDateShort } from '../utils.js';
import { icon, pyramidMark } from '../icons.js';
import { store } from '../store.js';
import { TOTAL_DAYS, LEVELS } from '../model.js';
import { confirmDialog, toast, openModal } from '../ui.js';
import { openTestModal } from './tests.js';
import * as auth from '../services/auth.js';
import { amIAdmin } from '../services/admin.js';

const SYNC_LABELS = {
  idle: { label: 'Aguardando', tone: 'pill-orange' },
  saving: { label: 'Salvando…', tone: 'pill-orange' },
  saved: { label: 'Salvo na nuvem', tone: 'pill-green' },
  offline: { label: 'Offline — vai sincronizar depois', tone: 'pill-orange' },
  error: { label: 'Erro ao sincronizar', tone: 'pill-red' },
};

function syncBadge() {
  const info = SYNC_LABELS[store.syncStatus] || SYNC_LABELS.idle;
  return h('span', { className: `pill ${info.tone}` }, info.label);
}

function testRow(label, which, existing) {
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

const GOAL_LABELS = {
  forca: 'Força', disciplina: 'Disciplina', saude: 'Saúde', emagrecimento: 'Emagrecimento',
  desenvolvimento: 'Desenvolvimento pessoal', completa: 'Evolução completa',
};

const PRIVACY_FIELDS = [
  { key: 'nickname', label: 'Apelido' },
  { key: 'avatar', label: 'Avatar' },
  { key: 'streak', label: 'Sequência' },
  { key: 'level', label: 'Nível' },
  { key: 'xp', label: 'XP' },
  { key: 'workoutsCompleted', label: 'Treinos concluídos' },
];

function editProfileModal(user, onSaved) {
  const nameInput = h('input', { type: 'text', value: user.name });
  const nickInput = h('input', { type: 'text', value: user.nickname });
  const content = h('div', { className: 'stack' },
    h('div', { className: 'field' }, h('label', {}, 'Nome'), nameInput),
    h('div', { className: 'field' }, h('label', {}, 'Apelido'), nickInput),
    h('div', { className: 'field' }, h('label', {}, 'E-mail'), h('input', { type: 'email', value: user.email, disabled: true })),
    h('p', { className: 'text-faint', style: { fontSize: '12px' } }, `Fuso horário: ${user.timezone}`),
    h('button', {
      className: 'btn btn-primary btn-block',
      onClick: async () => {
        await auth.updateProfile({ name: nameInput.value, nickname: nickInput.value });
        toast('Perfil atualizado', { iconName: 'check' });
        close();
        onSaved();
      },
    }, 'Salvar')
  );
  const close = openModal(content, { title: 'Editar perfil' });
}

function changePasswordModal() {
  const curInput = h('input', { type: 'password', autocomplete: 'current-password' });
  const newInput = h('input', { type: 'password', autocomplete: 'new-password' });
  const err = h('div', { className: 'field-error' });
  const content = h('div', { className: 'stack' },
    h('div', { className: 'field' }, h('label', {}, 'Senha atual'), curInput),
    h('div', { className: 'field' }, h('label', {}, 'Nova senha'), newInput),
    err,
    h('button', {
      className: 'btn btn-primary btn-block',
      onClick: async () => {
        try {
          await auth.changePassword({ currentPassword: curInput.value, newPassword: newInput.value });
          toast('Senha alterada', { iconName: 'check' });
          close();
        } catch (e) { err.textContent = e.message; }
      },
    }, 'Alterar senha')
  );
  const close = openModal(content, { title: 'Alterar senha' });
}

function goalModal(user, onSaved) {
  const options = Object.entries(GOAL_LABELS);
  let selected = user.preferences.goal;
  const list = h('div', { className: 'stack' });
  function redraw() {
    list.innerHTML = '';
    options.forEach(([key, label]) => list.appendChild(h('button', {
      className: `option-row ${selected === key ? 'selected' : ''}`,
      onClick: () => { selected = key; redraw(); },
    }, h('span', {}, label), selected === key ? icon('check', { size: 18 }) : null)));
  }
  redraw();
  const content = h('div', { className: 'stack' },
    list,
    h('button', {
      className: 'btn btn-primary btn-block',
      onClick: async () => { await auth.updateProfile({ preferences: { goal: selected } }); close(); onSaved(); },
    }, 'Salvar')
  );
  const close = openModal(content, { title: 'Objetivo principal' });
}

function inspirationModal(user, onSaved) {
  const options = [['phrase', 'Só frase'], ['verse', 'Só versículo'], ['both', 'Ambos'], ['off', 'Desativado']];
  let selected = user.preferences.inspiration;
  const list = h('div', { className: 'stack' });
  function redraw() {
    list.innerHTML = '';
    options.forEach(([key, label]) => list.appendChild(h('button', {
      className: `option-row ${selected === key ? 'selected' : ''}`,
      onClick: () => { selected = key; redraw(); },
    }, h('span', {}, label), selected === key ? icon('check', { size: 18 }) : null)));
  }
  redraw();
  const content = h('div', { className: 'stack' },
    list,
    h('button', {
      className: 'btn btn-primary btn-block',
      onClick: async () => { await auth.updateProfile({ preferences: { inspiration: selected } }); close(); onSaved(); },
    }, 'Salvar')
  );
  const close = openModal(content, { title: 'Mensagem diária' });
}

async function exportData() {
  const data = await auth.exportUserData();
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `skeelo-evolution-dados-${new Date().toISOString().slice(0, 10)}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
  toast('Dados exportados', { iconName: 'check' });
}

export function renderPerfil(viewEl, params, nav) {
  let deferredInstallPrompt = null;
  let user = null;
  let isAdmin = false;
  const onBeforeInstall = e => { e.preventDefault(); deferredInstallPrompt = e; draw(); };
  window.addEventListener('beforeinstallprompt', onBeforeInstall);

  async function refreshUser() {
    const session = await auth.getSession();
    user = session ? session.user : null;
    draw();
    isAdmin = user ? await amIAdmin() : false;
    draw();
  }

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

    const accountCard = user ? h('div', { className: 'card stack' },
      h('div', { className: 'row' },
        pyramidMark({ size: 48 }),
        h('div', { className: 'grow' },
          h('div', { style: { fontWeight: '700', fontSize: '16px' } }, user.nickname || user.name),
          h('div', { className: 'text-dim', style: { fontSize: '13px' } }, user.email)
        ),
        h('button', { className: 'icon-btn', 'aria-label': 'Editar perfil', onClick: () => editProfileModal(user, refreshUser) }, icon('edit', { size: 18 }))
      ),
      h('hr', { className: 'divider' }),
      h('div', { className: 'row-between' },
        h('span', { className: 'text-dim' }, 'Objetivo'),
        h('button', { className: 'btn btn-ghost btn-sm', onClick: () => goalModal(user, refreshUser) }, GOAL_LABELS[user.preferences.goal] || 'Definir')
      ),
      h('div', { className: 'row-between' },
        h('span', { className: 'text-dim' }, 'Mensagem diária'),
        h('button', { className: 'btn btn-ghost btn-sm', onClick: () => inspirationModal(user, refreshUser) },
          { phrase: 'Só frase', verse: 'Só versículo', both: 'Ambos', off: 'Desativado' }[user.preferences.inspiration])
      ),
      h('button', { className: 'btn btn-outline btn-block', onClick: () => changePasswordModal() }, icon('lock', { size: 16 }), 'Alterar senha')
    ) : null;

    const privacyCard = user ? h('div', { className: 'card stack' },
      h('div', { className: 'section-title' }, 'PRIVACIDADE'),
      h('p', { className: 'text-dim', style: { fontSize: '12px' } }, 'O que poderá aparecer publicamente quando comunidades estiverem ativas. Peso, IMC, fotos e reflexões pessoais nunca são públicos.'),
      h('div', { className: 'chip-row' }, PRIVACY_FIELDS.map(f => h('button', {
        className: `chip ${user.preferences.privacy[f.key] ? 'selected' : ''}`,
        onClick: async () => {
          const next = { ...user.preferences.privacy, [f.key]: !user.preferences.privacy[f.key] };
          await auth.updateProfile({ preferences: { privacy: next } });
          refreshUser();
        },
      }, f.label)))
    ) : null;

    mount(viewEl, h('div', { className: 'stack fade-up' },
      h('h1', {}, 'Perfil'),

      accountCard,

      isAdmin ? h('div', { className: 'card stack' },
        h('div', { className: 'row' }, icon('crown', { size: 20 }), h('h3', {}, 'Painel administrativo')),
        h('p', { className: 'text-dim', style: { fontSize: '13px' } }, 'Visão geral do produto, insights e gestão de contas — visível só pra você.'),
        h('button', { className: 'btn btn-primary btn-block', onClick: () => nav.navigateTo('admin') }, 'Abrir painel')
      ) : null,

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

      privacyCard,

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
        h('div', { className: 'row-between' },
          h('div', { className: 'section-title' }, 'SEUS DADOS'),
          syncBadge()
        ),
        h('p', { className: 'text-dim', style: { fontSize: '13px' } }, state.startDate
          ? `Desafio iniciado em ${formatDateShort(state.startDate)}. Sincronizado com a nuvem — dá pra entrar de outro aparelho.`
          : 'Sincronizado com a nuvem — dá pra entrar de outro aparelho.'),
        h('button', { className: 'btn btn-outline btn-block', onClick: exportData }, icon('download', { size: 18 }), 'Exportar meus dados (JSON)')
      ),

      h('div', { className: 'card stack' },
        h('button', { className: 'btn btn-outline btn-block', onClick: () => nav.navigateTo('ajuda') }, icon('info', { size: 18 }), 'Central de Ajuda')
      ),

      h('div', { className: 'card stack' },
        h('button', { className: 'btn btn-outline btn-block', onClick: async () => { await auth.signOut(); nav.navigateTo('boot'); } }, icon('logout', { size: 18 }), 'Sair')
      ),

      h('div', { className: 'card stack' },
        h('div', { className: 'section-title' }, 'ZONA DE RISCO'),
        h('button', {
          className: 'btn btn-danger btn-block',
          onClick: async () => {
            const ok = await confirmDialog({
              title: 'Apagar todos os dados',
              message: 'Isso vai apagar permanentemente todos os treinos, hábitos, fotos, testes e XP desta conta. Esta ação não pode ser desfeita.',
              confirmLabel: 'Apagar tudo',
              danger: true,
            });
            if (!ok) return;
            await store.resetAll();
            toast('Todos os dados foram apagados', { iconName: 'trash' });
            nav.navigateTo('hoje');
          },
        }, icon('trash', { size: 18 }), 'Apagar todos os dados'),
        h('button', {
          className: 'btn btn-danger btn-block',
          onClick: async () => {
            const ok = await confirmDialog({
              title: 'Excluir conta',
              message: 'Isso remove sua conta e todos os seus dados permanentemente deste dispositivo. Esta ação não pode ser desfeita.',
              confirmLabel: 'Excluir conta',
              danger: true,
            });
            if (!ok) return;
            await auth.deleteAccount();
            toast('Conta excluída', { iconName: 'trash' });
            nav.navigateTo('boot');
          },
        }, icon('alert', { size: 18 }), 'Excluir conta')
      )
    ));
  }

  refreshUser();
  draw();
  const unsub = store.subscribe(draw);
  return () => { unsub(); window.removeEventListener('beforeinstallprompt', onBeforeInstall); };
}
