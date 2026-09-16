import { h, mount, formatDateShort } from '../utils.js';
import { icon } from '../icons.js';
import { confirmDialog, toast } from '../ui.js';
import { overviewStats, insights, searchUsers, setUserSuspended } from '../services/admin.js';

const OVERVIEW_LABELS = [
  ['total_users', 'Usuários totais'],
  ['new_users_7d', 'Novos (7 dias)'],
  ['new_users_30d', 'Novos (30 dias)'],
  ['onboarding_complete_count', 'Onboarding concluído'],
  ['challenge_started_count', 'Iniciaram o desafio 30d'],
  ['total_communities', 'Comunidades'],
  ['public_communities', 'Comunidades públicas'],
  ['private_communities', 'Comunidades privadas'],
  ['active_memberships', 'Membros ativos'],
  ['pending_join_requests', 'Pedidos pendentes'],
  ['total_challenges', 'Desafios criados'],
  ['active_challenges', 'Desafios ativos agora'],
  ['scores_last_7d', 'Registros de progresso (7 dias)'],
  ['suspended_users', 'Contas suspensas'],
];

const GOAL_LABELS = {
  forca: 'Força', disciplina: 'Disciplina', saude: 'Saúde', emagrecimento: 'Emagrecimento',
  desenvolvimento: 'Desenvolvimento pessoal', completa: 'Evolução completa',
};

const CATEGORY_LABELS = {
  academia: 'Academia', calistenia: 'Calistenia', core: 'Core', ingles: 'Inglês',
  produtividade: 'Produtividade', fe: 'Fé', leitura: 'Leitura', disciplina: 'Disciplina', outro: 'Outro',
};

function loadingCard(text) {
  return h('div', { className: 'empty-state' }, icon('crown', { size: 32 }), h('div', {}, text));
}

function errorCard(msg, retry) {
  return h('div', { className: 'empty-state' },
    icon('alert', { size: 32 }), h('div', {}, msg),
    h('button', { className: 'btn btn-outline btn-sm', style: { marginTop: '10px' }, onClick: retry }, 'Tentar de novo')
  );
}

export function renderAdmin(viewEl, params, nav) {
  let tab = 'overview'; // 'overview' | 'insights' | 'users'

  // Per-tab state, loaded lazily the first time each tab is opened.
  const state = {
    overview: { status: 'idle', data: null, error: '' },
    insights: { status: 'idle', data: null, error: '' },
    users: { status: 'idle', data: [], error: '', query: '' },
  };

  async function loadOverview() {
    state.overview.status = 'loading'; draw();
    try { state.overview.data = await overviewStats(); state.overview.status = 'ready'; }
    catch (err) { state.overview.error = err.message; state.overview.status = 'error'; }
    draw();
  }

  async function loadInsights() {
    state.insights.status = 'loading'; draw();
    try { state.insights.data = await insights(); state.insights.status = 'ready'; }
    catch (err) { state.insights.error = err.message; state.insights.status = 'error'; }
    draw();
  }

  async function loadUsers() {
    state.users.status = 'loading'; draw();
    try { state.users.data = await searchUsers(state.users.query); state.users.status = 'ready'; }
    catch (err) { state.users.error = err.message; state.users.status = 'error'; }
    draw();
  }

  function ensureLoaded() {
    if (tab === 'overview' && state.overview.status === 'idle') loadOverview();
    if (tab === 'insights' && state.insights.status === 'idle') loadInsights();
    if (tab === 'users' && state.users.status === 'idle') loadUsers();
  }

  function overviewBody() {
    const s = state.overview;
    if (s.status === 'loading' || s.status === 'idle') return loadingCard('Carregando visão geral...');
    if (s.status === 'error') return errorCard(s.error, loadOverview);
    return h('div', { className: 'stat-grid' }, OVERVIEW_LABELS.map(([key, label]) =>
      h('div', { className: 'stat-box' }, h('div', { className: 'val' }, s.data[key] ?? 0), h('div', { className: 'lbl' }, label))
    ));
  }

  function insightsBody() {
    const s = state.insights;
    if (s.status === 'loading' || s.status === 'idle') return loadingCard('Carregando insights...');
    if (s.status === 'error') return errorCard(s.error, loadInsights);
    const d = s.data;
    function distributionCard(title, rows, labelFn) {
      return h('div', { className: 'card stack' },
        h('div', { className: 'section-title' }, title),
        rows.length ? rows.map(r => h('div', { className: 'row-between' },
          h('span', { className: 'text-dim' }, labelFn(r)),
          h('span', { className: 'pill pill-orange' }, r.total)
        )) : h('p', { className: 'text-faint' }, 'Sem dados ainda.')
      );
    }
    return h('div', { className: 'stack' },
      distributionCard('OBJETIVO ESCOLHIDO', d.goal_distribution, r => GOAL_LABELS[r.goal] || r.goal),
      distributionCard('PREFERÊNCIA DE CONTEÚDO DIÁRIO', d.inspiration_distribution, r =>
        ({ phrase: 'Só frase', verse: 'Só versículo', both: 'Ambos', off: 'Desativado' }[r.inspiration] || r.inspiration)),
      h('div', { className: 'card stack' },
        h('div', { className: 'section-title' }, 'COMUNIDADES MAIS ATIVAS'),
        d.top_communities.length ? d.top_communities.map(c => h('div', { className: 'row-between' },
          h('span', {}, `${c.name} · ${CATEGORY_LABELS[c.category] || c.category}`),
          h('span', { className: 'pill pill-green' }, `${c.member_count} membros`)
        )) : h('p', { className: 'text-faint' }, 'Nenhuma comunidade ainda.')
      ),
      h('div', { className: 'card stack' },
        h('div', { className: 'section-title' }, 'DESAFIOS COM MAIS PARTICIPANTES'),
        d.top_challenges.length ? d.top_challenges.map(c => h('div', { className: 'row-between' },
          h('span', {}, c.title),
          h('span', { className: 'pill pill-orange' }, `${c.participants} participantes`)
        )) : h('p', { className: 'text-faint' }, 'Nenhum desafio ainda.')
      )
    );
  }

  function usersBody() {
    const s = state.users;
    const searchInput = h('input', {
      type: 'text', placeholder: 'Buscar por nome, apelido ou e-mail', value: s.query,
      onInput: e => { s.query = e.target.value; },
      onKeydown: e => { if (e.key === 'Enter') loadUsers(); },
    });

    let list;
    if (s.status === 'loading' || s.status === 'idle') list = loadingCard('Carregando usuários...');
    else if (s.status === 'error') list = errorCard(s.error, loadUsers);
    else if (!s.data.length) list = h('div', { className: 'empty-state' }, icon('users', { size: 32 }), h('div', {}, 'Nenhum usuário encontrado.'));
    else list = h('div', { className: 'stack' }, s.data.map(u => h('div', { className: 'card card-tight member-row' },
      h('div', { className: 'avatar-circle sm' }, (u.nickname || u.name || '?').trim().slice(0, 2).toUpperCase()),
      h('div', { className: 'grow' },
        h('div', { className: 'member-name' }, u.nickname || u.name || '(sem nome)'),
        h('div', { className: 'member-role' }, `${u.email} · desde ${formatDateShort(u.created_at)}${u.onboarding_complete ? '' : ' · onboarding incompleto'}`)
      ),
      u.suspended ? h('span', { className: 'pill pill-red' }, 'Suspenso') : null,
      h('button', {
        className: `btn btn-sm ${u.suspended ? 'btn-outline' : 'btn-danger'}`,
        onClick: async () => {
          const ok = await confirmDialog({
            title: u.suspended ? 'Reativar conta' : 'Suspender conta',
            message: u.suspended
              ? `Reativar o acesso de "${u.nickname || u.name}"?`
              : `Suspender "${u.nickname || u.name}"? A pessoa não vai conseguir entrar no app até você reativar.`,
            confirmLabel: u.suspended ? 'Reativar' : 'Suspender',
            danger: !u.suspended,
          });
          if (!ok) return;
          try { await setUserSuspended(u.id, !u.suspended); toast(u.suspended ? 'Conta reativada' : 'Conta suspensa', { iconName: 'check' }); loadUsers(); }
          catch (err) { toast(err.message, { iconName: 'alert' }); }
        },
      }, u.suspended ? 'Reativar' : 'Suspender')
    )));

    return h('div', { className: 'stack' }, h('div', { className: 'field' }, searchInput), list);
  }

  function draw() {
    const tabs = [['overview', 'Visão geral'], ['insights', 'Insights'], ['users', 'Usuários']];
    const tabRow = h('div', { className: 'chip-row' }, tabs.map(([key, label]) => h('button', {
      className: `chip ${tab === key ? 'selected' : ''}`,
      onClick: () => { tab = key; ensureLoaded(); draw(); },
    }, label)));

    let body;
    if (tab === 'overview') body = overviewBody();
    else if (tab === 'insights') body = insightsBody();
    else body = usersBody();

    mount(viewEl, h('div', { className: 'focus-screen stack fade-up' },
      h('div', { className: 'row-between' },
        h('button', { className: 'icon-btn', 'aria-label': 'Voltar', onClick: () => nav.navigateTo('perfil') }, icon('chevronLeft', { size: 20 })),
        h('div', { className: 'row' }, icon('crown', { size: 20 }), h('h1', { style: { fontSize: '18px' } }, 'Painel administrativo')),
        h('span', { style: { width: '44px' } })
      ),
      tabRow,
      body
    ));
  }

  ensureLoaded();
  draw();
  return () => {};
}
