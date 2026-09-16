import { h, mount } from '../utils.js';
import { icon } from '../icons.js';
import { openModal, confirmDialog, toast } from '../ui.js';
import {
  getCommunity, myMembership, joinCommunity, leaveCommunity,
  listPendingRequests, listMembers, approveMember, rejectMember, removeMember, setMemberRole,
  listPosts, createPost, deletePost,
  listChallenges, createChallenge,
  deleteCommunity,
} from '../services/communities.js';

const ACTION_TYPES = [
  { key: 'treino', label: 'Treino diário' },
  { key: 'habito', label: 'Hábito diário' },
  { key: 'ingles', label: 'Inglês diário' },
  { key: 'checklist', label: 'Checklist diário' },
  { key: 'personalizado', label: 'Personalizado' },
];

function actionLabel(key) {
  return (ACTION_TYPES.find(a => a.key === key) || { label: 'Personalizado' }).label;
}

function initials(name) {
  return (name || '?').trim().slice(0, 2).toUpperCase();
}

function daysLeft(endsAt) {
  const diff = Math.ceil((new Date(endsAt) - new Date()) / 86400000);
  if (diff < 0) return 'Encerrado';
  if (diff === 0) return 'Último dia';
  return `${diff} dia${diff === 1 ? '' : 's'} restantes`;
}

function createChallengeModal(communityId, onCreated) {
  const titleInput = h('input', { type: 'text', placeholder: 'Ex: Semana da constância' });
  const descInput = h('textarea', { placeholder: 'Regras e objetivo do desafio' });
  const startInput = h('input', { type: 'date', value: new Date().toISOString().slice(0, 10) });
  const endInput = h('input', { type: 'date' });
  const pointsInput = h('input', { type: 'number', inputMode: 'numeric', min: '1', value: '10' });
  let actionType = 'treino';

  const typeRow = h('div', { className: 'chip-row' });
  function drawTypes() {
    typeRow.innerHTML = '';
    ACTION_TYPES.forEach(t => typeRow.appendChild(h('button', {
      className: `chip ${actionType === t.key ? 'selected' : ''}`,
      onClick: () => { actionType = t.key; drawTypes(); },
    }, t.label)));
  }
  drawTypes();

  const saveBtn = h('button', {
    className: 'btn btn-primary btn-block',
    onClick: async () => {
      if (!endInput.value) { toast('Defina a data de término.', { iconName: 'alert' }); return; }
      saveBtn.disabled = true;
      try {
        const challenge = await createChallenge(communityId, {
          title: titleInput.value,
          description: descInput.value,
          actionType,
          startsAt: `${startInput.value}T00:00:00`,
          endsAt: `${endInput.value}T23:59:59`,
          pointsPerAction: pointsInput.value,
        });
        close();
        onCreated(challenge);
      } catch (err) {
        toast(err.message, { iconName: 'alert' });
        saveBtn.disabled = false;
      }
    },
  }, 'Criar desafio');

  const content = h('div', { className: 'stack' },
    h('div', { className: 'field' }, h('label', {}, 'Título'), titleInput),
    h('div', { className: 'field' }, h('label', {}, 'Tipo de desafio'), typeRow),
    h('div', { className: 'row' },
      h('div', { className: 'field' }, h('label', {}, 'Início'), startInput),
      h('div', { className: 'field' }, h('label', {}, 'Término'), endInput)
    ),
    h('div', { className: 'field' }, h('label', {}, 'Pontos por dia concluído'), pointsInput),
    h('div', { className: 'field' }, h('label', {}, 'Descrição / regras'), descInput),
    h('p', { className: 'text-faint', style: { fontSize: '12px' } }, 'Pagamentos e prêmios: em breve.'),
    saveBtn
  );
  const close = openModal(content, { title: 'Novo desafio' });
}

export function renderComunidadeDetalhe(viewEl, params, nav) {
  const communityId = params.communityId;
  let status = 'loading';
  let errorMsg = '';
  let community = null;
  let membership = null;
  let pending = [];
  let members = [];
  let posts = [];
  let challenges = [];

  const isStaff = () => membership && membership.status === 'active' && (membership.role === 'owner' || membership.role === 'admin');
  const isActiveMember = () => membership && membership.status === 'active';

  async function load() {
    status = 'loading';
    draw();
    try {
      community = await getCommunity(communityId);
      if (!community) { status = 'notfound'; draw(); return; }
      membership = await myMembership(communityId);
      if (isActiveMember()) {
        const [postsRes, challengesRes, membersRes] = await Promise.all([listPosts(communityId), listChallenges(communityId), listMembers(communityId)]);
        posts = postsRes; challenges = challengesRes; members = membersRes;
        pending = isStaff() ? await listPendingRequests(communityId) : [];
      } else {
        posts = []; challenges = []; members = []; pending = [];
      }
      status = 'ready';
    } catch (err) {
      errorMsg = err.message || 'Não foi possível carregar a comunidade.';
      status = 'error';
    }
    draw();
  }

  async function handleJoin() {
    try {
      await joinCommunity(communityId);
      toast(community.visibility === 'private' ? 'Pedido enviado' : 'Você entrou na comunidade', { iconName: 'check' });
      await load();
    } catch (err) { toast(err.message, { iconName: 'alert' }); }
  }

  async function handleLeave() {
    if (membership.role === 'owner') {
      toast('Você é a dona/dono. Exclua a comunidade em vez de sair.', { iconName: 'alert' });
      return;
    }
    const ok = await confirmDialog({ title: 'Sair da comunidade', message: `Sair de "${community.name}"?`, confirmLabel: 'Sair', danger: true });
    if (!ok) return;
    try { await leaveCommunity(communityId); toast('Você saiu da comunidade', { iconName: 'check' }); await load(); }
    catch (err) { toast(err.message, { iconName: 'alert' }); }
  }

  function headerSection() {
    let actionBtn;
    if (!membership) {
      actionBtn = h('button', { className: 'btn btn-primary btn-block', onClick: handleJoin }, community.visibility === 'private' ? 'Pedir para entrar' : 'Entrar');
    } else if (membership.status === 'pending') {
      actionBtn = h('button', { className: 'btn btn-outline btn-block', disabled: true }, 'Pedido enviado — aguardando aprovação');
    } else {
      actionBtn = h('button', { className: 'btn btn-outline btn-block', onClick: handleLeave }, membership.role === 'owner' ? 'Você é a dona/dono' : 'Sair da comunidade');
    }
    return h('div', { className: 'stack' },
      h('div', { className: 'row-between' },
        h('div', { className: 'row' }, icon(community.visibility === 'private' ? 'lock' : 'globe', { size: 18, className: 'text-dim' }),
          h('span', { className: `pill ${community.visibility === 'private' ? 'pill-red' : 'pill-green'}` }, community.visibility === 'private' ? 'Privada' : 'Pública')),
        h('span', { className: 'text-dim', style: { fontSize: '13px' } }, `${community.member_count} membro${community.member_count === 1 ? '' : 's'}`)
      ),
      community.description ? h('p', { className: 'text-dim' }, community.description) : null,
      actionBtn
    );
  }

  function pendingSection() {
    if (!isStaff() || !pending.length) return null;
    return h('div', { className: 'stack' },
      h('div', { className: 'section-title' }, `PEDIDOS PENDENTES (${pending.length})`),
      pending.map(p => h('div', { className: 'card card-tight member-row' },
        h('div', { className: 'avatar-circle sm' }, initials((p.profile && (p.profile.nickname || p.profile.name)) || '?')),
        h('span', { className: 'grow member-name' }, (p.profile && (p.profile.nickname || p.profile.name)) || 'Alguém'),
        h('button', { className: 'icon-btn', 'aria-label': 'Aprovar', onClick: async () => { await approveMember(communityId, p.user_id); toast('Aprovado', { iconName: 'check' }); load(); } }, icon('checkCircle', { size: 20, className: 'text-dim' })),
        h('button', { className: 'icon-btn', 'aria-label': 'Recusar', onClick: async () => { await rejectMember(communityId, p.user_id); toast('Recusado', { iconName: 'check' }); load(); } }, icon('close', { size: 20, className: 'text-dim' }))
      ))
    );
  }

  function challengesSection() {
    if (!isActiveMember()) return null;
    return h('div', { className: 'stack' },
      h('div', { className: 'row-between' },
        h('div', { className: 'section-title' }, 'DESAFIOS'),
        isStaff() ? h('button', { className: 'btn btn-sm btn-outline', onClick: () => createChallengeModal(communityId, ch => nav.navigateTo('desafioDetalhe', { challengeId: ch.id })) }, icon('plus', { size: 14 }), 'Novo') : null
      ),
      challenges.length ? challenges.map(c => h('div', {
        className: 'card card-tight member-row', onClick: () => nav.navigateTo('desafioDetalhe', { challengeId: c.id }),
      },
        h('div', { className: 'avatar-circle' }, icon('trophy', { size: 18 })),
        h('div', { className: 'grow' },
          h('div', { className: 'member-name' }, c.title),
          h('div', { className: 'member-role' }, `${actionLabel(c.action_type)} · ${daysLeft(c.ends_at)}`)
        ),
        icon('chevronRight', { size: 18, className: 'text-faint' })
      )) : h('p', { className: 'text-faint' }, 'Nenhum desafio ainda.')
    );
  }

  function muralSection() {
    if (!isActiveMember()) return null;
    const postInput = h('textarea', { placeholder: 'Compartilhe algo com a comunidade...' });
    return h('div', { className: 'stack' },
      h('div', { className: 'section-title' }, 'MURAL'),
      h('div', { className: 'field' }, postInput,
        h('button', { className: 'btn btn-primary btn-sm', onClick: async () => {
          if (!postInput.value.trim()) return;
          try { await createPost(communityId, postInput.value); postInput.value = ''; await load(); }
          catch (err) { toast(err.message, { iconName: 'alert' }); }
        } }, 'Publicar')
      ),
      posts.length ? posts.map(p => h('div', { className: 'card card-tight post-row' },
        h('div', { className: 'post-meta' },
          h('strong', { style: { fontSize: '13px' } }, (p.profile && (p.profile.nickname || p.profile.name)) || 'Alguém'),
          (isStaff() || (membership && p.user_id === membership.user_id)) ? h('button', { className: 'icon-btn icon-btn-sm', 'aria-label': 'Apagar', onClick: async () => { await deletePost(p.id); await load(); } }, icon('trash', { size: 14 })) : null
        ),
        h('p', {}, p.body)
      )) : h('p', { className: 'text-faint' }, 'Nenhuma publicação ainda.')
    );
  }

  function membersSection() {
    if (!isActiveMember() || !members.length) return null;
    return h('div', { className: 'stack' },
      h('div', { className: 'section-title' }, `MEMBROS (${members.length})`),
      members.map(m => h('div', { className: 'card card-tight member-row' },
        h('div', { className: 'avatar-circle sm' }, initials((m.profile && (m.profile.nickname || m.profile.name)) || '?')),
        h('div', { className: 'grow' },
          h('div', { className: 'member-name' }, (m.profile && (m.profile.nickname || m.profile.name)) || 'Alguém'),
          h('div', { className: 'member-role' }, m.role === 'owner' ? 'Dona/dono' : m.role === 'admin' ? 'Admin' : m.role === 'moderator' ? 'Moderador' : 'Membro')
        ),
        m.role === 'owner' ? icon('crown', { size: 18, className: 'text-dim' }) : null,
        (isStaff() && m.role !== 'owner' && (!membership || m.user_id !== membership.user_id)) ? h('button', {
          className: 'icon-btn icon-btn-sm', 'aria-label': 'Remover',
          onClick: async () => {
            const ok = await confirmDialog({ title: 'Remover membro', message: 'Remover essa pessoa da comunidade?', confirmLabel: 'Remover', danger: true });
            if (!ok) return;
            await removeMember(communityId, m.user_id); toast('Removido', { iconName: 'check' }); load();
          },
        }, icon('trash', { size: 14 })) : null
      ))
    );
  }

  async function handleDeleteCommunity() {
    const ok = await confirmDialog({ title: 'Excluir comunidade', message: `Excluir "${community.name}" para sempre? Isso apaga o mural e os desafios.`, confirmLabel: 'Excluir', danger: true });
    if (!ok) return;
    try { await deleteCommunity(communityId); nav.navigateTo('comunidades'); }
    catch (err) { toast(err.message, { iconName: 'alert' }); }
  }

  function draw() {
    const back = h('button', { className: 'icon-btn', 'aria-label': 'Voltar', onClick: () => nav.navigateTo('comunidades') }, icon('chevronLeft', { size: 20 }));

    if (status === 'loading') {
      mount(viewEl, h('div', { className: 'stack fade-up' }, h('div', { className: 'row-between' }, back, h('h1', {}, 'Comunidade'), h('span', { style: { width: '44px' } })), h('div', { className: 'empty-state' }, icon('users', { size: 32 }), h('div', {}, 'Carregando...'))));
      return;
    }
    if (status === 'notfound') {
      mount(viewEl, h('div', { className: 'stack fade-up' }, h('div', { className: 'row-between' }, back, h('h1', {}, 'Comunidade'), h('span', { style: { width: '44px' } })), h('div', { className: 'empty-state' }, icon('alert', { size: 32 }), h('div', {}, 'Comunidade não encontrada.'))));
      return;
    }
    if (status === 'error') {
      mount(viewEl, h('div', { className: 'stack fade-up' }, h('div', { className: 'row-between' }, back, h('h1', {}, 'Comunidade'), h('span', { style: { width: '44px' } })),
        h('div', { className: 'empty-state' }, icon('alert', { size: 32 }), h('div', {}, errorMsg), h('button', { className: 'btn btn-outline btn-sm', style: { marginTop: '10px' }, onClick: load }, 'Tentar de novo'))));
      return;
    }

    mount(viewEl, h('div', { className: 'stack fade-up' },
      h('div', { className: 'row-between' }, back, h('h1', { style: { fontSize: '19px' } }, community.name), h('span', { style: { width: '44px' } })),
      headerSection(),
      pendingSection(),
      challengesSection(),
      muralSection(),
      membersSection(),
      (membership && membership.role === 'owner') ? h('button', { className: 'btn btn-danger btn-block', onClick: handleDeleteCommunity }, icon('trash', { size: 16 }), 'Excluir comunidade') : null
    ));
  }

  load();
  return () => {};
}
