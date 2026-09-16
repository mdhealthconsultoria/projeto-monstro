import { h, mount } from '../utils.js';
import { icon } from '../icons.js';
import { openModal, toast } from '../ui.js';
import { searchCommunities, myCommunities, createCommunity } from '../services/communities.js';

const CATEGORIES = [
  { key: 'academia', label: 'Academia' },
  { key: 'calistenia', label: 'Calistenia' },
  { key: 'core', label: 'Core' },
  { key: 'ingles', label: 'Inglês' },
  { key: 'produtividade', label: 'Produtividade' },
  { key: 'fe', label: 'Fé' },
  { key: 'leitura', label: 'Leitura' },
  { key: 'disciplina', label: 'Disciplina' },
  { key: 'outro', label: 'Outro' },
];

function categoryLabel(key) {
  return (CATEGORIES.find(c => c.key === key) || { label: 'Outro' }).label;
}

function createCommunityModal(onCreated) {
  const nameInput = h('input', { type: 'text', placeholder: 'Ex: Disciplina Diária' });
  const descInput = h('textarea', { placeholder: 'Sobre o que é essa comunidade?' });
  let category = 'outro';
  let visibility = 'public';

  const catRow = h('div', { className: 'chip-row' });
  function drawCats() {
    catRow.innerHTML = '';
    CATEGORIES.forEach(c => catRow.appendChild(h('button', {
      className: `chip ${category === c.key ? 'selected' : ''}`,
      onClick: () => { category = c.key; drawCats(); },
    }, c.label)));
  }
  drawCats();

  const visRow = h('div', { className: 'row' });
  function drawVis() {
    visRow.innerHTML = '';
    [['public', 'Pública', 'globe'], ['private', 'Privada', 'lock']].forEach(([key, label, iconName]) => {
      visRow.appendChild(h('button', {
        className: `btn btn-sm grow ${visibility === key ? 'btn-primary' : 'btn-outline'}`,
        onClick: () => { visibility = key; drawVis(); },
      }, icon(iconName, { size: 14 }), label));
    });
  }
  drawVis();

  const saveBtn = h('button', {
    className: 'btn btn-primary btn-block',
    onClick: async () => {
      if (!nameInput.value.trim()) { toast('Dê um nome à comunidade.', { iconName: 'alert' }); return; }
      saveBtn.disabled = true;
      try {
        const community = await createCommunity({ name: nameInput.value, description: descInput.value, category, visibility });
        close();
        onCreated(community);
      } catch (err) {
        toast(err.message, { iconName: 'alert' });
        saveBtn.disabled = false;
      }
    },
  }, 'Criar comunidade');

  const content = h('div', { className: 'stack' },
    h('div', { className: 'field' }, h('label', {}, 'Nome'), nameInput),
    h('div', { className: 'field' }, h('label', {}, 'Categoria'), catRow),
    h('div', { className: 'field' }, h('label', {}, 'Visibilidade'), visRow,
      h('p', { className: 'text-faint', style: { fontSize: '12px' } },
        visibility === 'private' ? 'Só quem for aprovado entra.' : 'Qualquer pessoa pode entrar direto.')),
    h('div', { className: 'field' }, h('label', {}, 'Descrição'), descInput),
    saveBtn
  );
  const close = openModal(content, { title: 'Nova comunidade' });
}

export function renderComunidades(viewEl, params, nav) {
  let status = 'loading'; // 'loading' | 'ready' | 'error'
  let mine = [];
  let discover = [];
  let query = '';
  let category = null;
  let errorMsg = '';

  async function load() {
    status = 'loading';
    draw();
    try {
      const [mineRes, discoverRes] = await Promise.all([myCommunities(), searchCommunities(query, category)]);
      mine = mineRes;
      const mineIds = new Set(mine.map(m => m.community.id));
      discover = discoverRes.filter(c => !mineIds.has(c.id));
      status = 'ready';
    } catch (err) {
      errorMsg = err.message || 'Não foi possível carregar as comunidades.';
      status = 'error';
    }
    draw();
  }

  function communityCard(community, { role } = {}) {
    return h('div', {
      className: 'card card-tight member-row',
      onClick: () => nav.navigateTo('comunidadeDetalhe', { communityId: community.id }),
    },
      h('div', { className: 'avatar-circle' }, icon(community.visibility === 'private' ? 'lock' : 'globe', { size: 18 })),
      h('div', { className: 'grow' },
        h('div', { className: 'member-name' }, community.name),
        h('div', { className: 'member-role' }, `${categoryLabel(community.category)} · ${community.member_count} membro${community.member_count === 1 ? '' : 's'}`)
      ),
      role ? h('span', { className: `pill ${role === 'owner' || role === 'admin' ? 'pill-orange' : 'pill-green'}` }, role === 'owner' ? 'Dona' : role === 'admin' ? 'Admin' : role === 'moderator' ? 'Mod' : 'Membro') : icon('chevronRight', { size: 18, className: 'text-faint' })
    );
  }

  function draw() {
    const catRow = h('div', { className: 'chip-row' });
    [{ key: null, label: 'Todas' }, ...CATEGORIES].forEach(c => catRow.appendChild(h('button', {
      className: `chip ${category === c.key ? 'selected' : ''}`,
      onClick: () => { category = c.key; load(); },
    }, c.label)));

    const searchInput = h('input', {
      type: 'text', placeholder: 'Buscar comunidades...', value: query,
      onInput: e => { query = e.target.value; },
      onKeydown: e => { if (e.key === 'Enter') load(); },
    });

    let body;
    if (status === 'loading') {
      body = h('div', { className: 'empty-state' }, icon('users', { size: 32 }), h('div', {}, 'Carregando comunidades...'));
    } else if (status === 'error') {
      body = h('div', { className: 'empty-state' },
        icon('alert', { size: 32 }),
        h('div', {}, errorMsg),
        h('button', { className: 'btn btn-outline btn-sm', style: { marginTop: '10px' }, onClick: load }, 'Tentar de novo')
      );
    } else {
      body = h('div', { className: 'stack' },
        mine.length ? h('div', { className: 'stack' },
          h('div', { className: 'section-title' }, 'MINHAS COMUNIDADES'),
          mine.map(m => communityCard(m.community, { role: m.role }))
        ) : null,
        h('div', { className: 'stack' },
          h('div', { className: 'section-title' }, 'DESCOBRIR'),
          discover.length ? discover.map(c => communityCard(c))
            : h('div', { className: 'empty-state' }, icon('users', { size: 32 }), h('div', {}, query || category ? 'Nenhuma comunidade encontrada.' : 'Nenhuma comunidade pública ainda. Seja a primeira a criar uma!'))
        )
      );
    }

    mount(viewEl, h('div', { className: 'stack fade-up' },
      h('h1', {}, 'Comunidades'),
      h('p', { className: 'text-dim' }, 'Encontre pessoas com objetivos parecidos e evolua junto.'),
      h('button', { className: 'btn btn-primary btn-block', onClick: () => createCommunityModal(c => nav.navigateTo('comunidadeDetalhe', { communityId: c.id })) }, icon('plus', { size: 18 }), 'Criar comunidade'),
      h('div', { className: 'field' }, searchInput),
      catRow,
      body
    ));
  }

  load();
  return () => {};
}
