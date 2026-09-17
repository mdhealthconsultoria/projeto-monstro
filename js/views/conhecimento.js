import { h, mount, uid, todayISO, formatDateShort } from '../utils.js';
import { icon } from '../icons.js';
import { store } from '../store.js';
import { toast, confirmDialog } from '../ui.js';
import { KNOWLEDGE_TYPES, KNOWLEDGE_STAGES, knowledgeTypeInfo, knowledgeStageIndex, nextKnowledgeStage } from '../model.js';

function stageDots(stage) {
  const idx = knowledgeStageIndex(stage);
  return h('div', { className: 'knowledge-stage-dots' }, KNOWLEDGE_STAGES.map((s, i) =>
    h('span', { className: `knowledge-stage-dot ${i <= idx ? 'filled' : ''}`, title: s.label })
  ));
}

function itemCard(item) {
  const typeInfo = knowledgeTypeInfo(item.type);
  const stageIdx = knowledgeStageIndex(item.stage);
  const currentStage = KNOWLEDGE_STAGES[stageIdx];
  const isMastered = stageIdx === KNOWLEDGE_STAGES.length - 1;
  const totalMinutes = item.sessions.reduce((sum, s) => sum + s.minutes, 0);
  const minutesInput = h('input', { type: 'number', inputMode: 'numeric', min: '1', placeholder: 'min', style: { maxWidth: '80px' } });

  return h('div', { className: 'knowledge-item' },
    h('div', { className: 'knowledge-item-head' },
      h('div', {},
        h('div', { className: 'knowledge-item-title' }, item.title),
        h('div', { className: 'knowledge-item-meta' }, `${item.sessions.length} sessão${item.sessions.length === 1 ? '' : 'ões'} · ${totalMinutes} min registrados`)
      ),
      h('span', { className: 'evidence-badge' }, typeInfo.label)
    ),
    h('div', { className: 'row-between' },
      h('span', { className: 'pill pill-orange' }, currentStage.label),
      isMastered ? null : h('button', { className: 'btn btn-outline btn-sm', onClick: () => {
        store.mutate(s => { s.knowledgeItems[item.id].stage = nextKnowledgeStage(item.stage); });
        toast('Etapa avançada', { iconName: 'check' });
      } }, 'Avançar etapa')
    ),
    stageDots(item.stage),
    h('div', { className: 'row', style: { alignItems: 'center' } },
      minutesInput,
      h('button', { className: 'btn btn-outline btn-sm', onClick: () => {
        const minutes = Number(minutesInput.value);
        if (!minutes || minutes <= 0) { toast('Informe os minutos estudados.', { iconName: 'alert' }); return; }
        store.mutate(s => { s.knowledgeItems[item.id].sessions.push({ date: todayISO(), minutes }); });
        toast('Sessão registrada', { iconName: 'check' });
      } }, 'Registrar sessão'),
      h('span', { className: 'grow' }),
      h('button', { className: 'icon-btn-sm', 'aria-label': 'Excluir', onClick: async () => {
        const ok = await confirmDialog({ title: 'Excluir item', message: `Remover "${item.title}" e todo o histórico de sessões?`, confirmLabel: 'Excluir', danger: true });
        if (ok) store.mutate(s => { delete s.knowledgeItems[item.id]; });
      } }, icon('trash', { size: 14 }))
    ),
    item.sessions.length ? h('div', { className: 'knowledge-item-meta' },
      `Última sessão: ${formatDateShort(item.sessions[item.sessions.length - 1].date)}`) : null
  );
}

export function renderConhecimento(viewEl, params, nav) {
  function draw() {
    const state = store.state;
    const items = Object.values(state.knowledgeItems).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    const titleInput = h('input', { type: 'text', placeholder: 'Ex: Inglês avançado, Clean Code...' });
    const typeSelect = h('select', {}, KNOWLEDGE_TYPES.map(t => h('option', { value: t.key }, t.label)));

    mount(viewEl, h('div', { className: 'stack fade-up' },
      h('div', { className: 'row-between' },
        h('button', { className: 'icon-btn', 'aria-label': 'Voltar', onClick: () => nav.navigateTo('areas', { area: 'conhecimento' }) }, icon('chevronLeft', { size: 20 })),
        h('h1', {}, 'Conhecimento'),
        h('span', { style: { width: '44px' } })
      ),
      h('p', { className: 'text-dim' }, 'Cada item avança por um fluxo de domínio: Estudar → Testar → Aplicar → Revisar → Ensinar/Produzir → Dominar. Você mesmo avança a etapa — não é uma prova automática.'),
      h('div', { className: 'card stack' },
        h('div', { className: 'section-title' }, 'NOVO ITEM'),
        h('div', { className: 'row' },
          h('div', { className: 'field grow' }, h('label', {}, 'Título'), titleInput),
          h('div', { className: 'field' }, h('label', {}, 'Tipo'), typeSelect)
        ),
        h('button', { className: 'btn btn-primary btn-sm', onClick: () => {
          const title = titleInput.value.trim();
          if (!title) { toast('Dê um título ao item.', { iconName: 'alert' }); return; }
          const id = uid();
          store.mutate(s => {
            s.knowledgeItems[id] = { id, title, type: typeSelect.value, stage: 'estudar', sessions: [], createdAt: todayISO(), archived: false };
          });
          toast('Item adicionado', { iconName: 'check' });
        } }, icon('plus', { size: 14 }), 'Adicionar')
      ),
      h('div', { className: 'section-title' }, 'SEUS ITENS'),
      items.length
        ? h('div', { className: 'stack' }, items.map(itemCard))
        : h('div', { className: 'empty-state' }, 'Nenhum item ainda — adicione uma matéria, livro ou curso acima.')
    ));
  }

  draw();
  const unsub = store.subscribe(draw);
  return () => unsub();
}
