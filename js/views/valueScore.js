import { h, mount } from '../utils.js';
import { icon, pyramidMark } from '../icons.js';
import { store } from '../store.js';
import { toast } from '../ui.js';
import { areaFor } from '../model.js';
import { BUSINESS_CONCEPTS, businessCategoryInfo } from '../businessLibrary.js';

const VALUE_COLOR = (areaFor('profissional') || {}).color || '#a89f92';

function conceptCard(concept, applied) {
  const cat = businessCategoryInfo(concept.category);
  return h('div', { className: `concept-item ${applied ? 'is-applied' : ''}` },
    h('div', { className: 'concept-item-head' },
      h('div', { className: 'concept-item-title' }, concept.title),
      cat ? h('span', { className: 'evidence-badge' }, cat.label) : null
    ),
    h('p', { className: 'concept-item-desc' }, concept.summary),
    h('p', { className: 'concept-item-exercise' }, `Exercício: ${concept.exercise}`),
    applied
      ? h('span', { className: 'pill pill-green' }, icon('check', { size: 12 }), 'Já apliquei')
      : h('button', {
          className: 'btn btn-outline btn-sm',
          onClick: () => {
            store.mutate(s => { s.businessConcepts.appliedIds.push(concept.id); });
            toast('Marcado como aplicado', { iconName: 'check' });
          },
        }, 'Marcar como aplicado')
  );
}

export function renderValueScore(viewEl, params, nav) {
  function draw() {
    const state = store.state;
    const { valueScore } = store.derived;
    const appliedIds = new Set(state.businessConcepts.appliedIds);

    mount(viewEl, h('div', { className: 'stack fade-up' },
      h('div', { className: 'row-between' },
        h('button', { className: 'icon-btn', 'aria-label': 'Voltar', onClick: () => nav.navigateTo('areas', { area: 'profissional' }) }, icon('chevronLeft', { size: 20 })),
        h('h1', {}, 'Value Score'),
        h('span', { style: { width: '44px' } })
      ),
      h('div', { className: 'montro-hero' },
        h('div', { style: { color: VALUE_COLOR } }, pyramidMark({ size: 56, fillPercent: valueScore ?? 0 })),
        h('div', {},
          h('div', { className: 'montro-hero-label' }, 'VALUE SCORE'),
          h('div', { className: 'montro-hero-num', style: { color: VALUE_COLOR } }, valueScore != null ? valueScore : '—'),
          h('div', { className: 'montro-hero-sub' }, 'Combina as áreas Profissional e Conhecimento com os conceitos do Business Master aplicados. Não é previsão de salário — a evolução profissional é potencialmente infinita.')
        )
      ),
      h('div', { className: 'section-title' }, 'BUSINESS MASTER'),
      h('p', { className: 'text-faint', style: { fontSize: '11px', marginTop: '-8px' } },
        'Conceitos práticos de negócios. Marcar como aplicado é autoavaliação — sem nota, sem prova.'),
      h('div', { className: 'stack' }, BUSINESS_CONCEPTS.map(c => conceptCard(c, appliedIds.has(c.id))))
    ));
  }

  draw();
  const unsub = store.subscribe(draw);
  return () => unsub();
}
