import { h, mount } from '../utils.js';
import { icon, pyramidMark } from '../icons.js';
import { store } from '../store.js';
import { toast } from '../ui.js';
import { LIFE_AREAS, areaFor } from '../model.js';
import { libraryItemsForArea, evidenceInfo } from '../habitLibrary.js';
import { createLibraryHabit, habitStats, isHabitCheckedToday, checkinId, dateKey } from '../habits.js';

function activateArea(areaKey) {
  store.mutate(s => {
    if (!s.activeAreas.includes(areaKey)) s.activeAreas.push(areaKey);
  });
}

function toggleAreaActive(areaKey) {
  store.mutate(s => {
    const i = s.activeAreas.indexOf(areaKey);
    if (i === -1) s.activeAreas.push(areaKey); else s.activeAreas.splice(i, 1);
  });
}

function renderOverview(viewEl, nav) {
  function draw() {
    const state = store.state;
    const { montroScore, areaScores } = store.derived;

    const cards = LIFE_AREAS.map(area => {
      const score = areaScores[area.key];
      const isActive = state.activeAreas.includes(area.key);
      return h('button', {
        className: `area-card ${isActive ? '' : 'is-inactive'}`,
        onClick: () => { if (!isActive) activateArea(area.key); nav.navigateTo('areas', { area: area.key }); },
      },
        h('div', { style: { color: area.color } }, pyramidMark({ size: 46, fillPercent: score ?? 0 })),
        h('div', { className: 'area-card-score', style: { color: area.color } }, score != null ? score : '—'),
        h('div', { className: 'area-card-label' }, area.label),
        h('div', { className: 'area-card-sub' }, isActive ? (score != null ? 'ativa' : 'sem hábitos ainda') : 'toque para ativar')
      );
    });

    mount(viewEl, h('div', { className: 'stack fade-up' },
      h('div', { className: 'row-between' },
        h('button', { className: 'icon-btn', 'aria-label': 'Voltar', onClick: () => nav.navigateTo('evoluir') }, icon('chevronLeft', { size: 20 })),
        h('h1', {}, 'Minha Evolução'),
        h('span', { style: { width: '44px' } })
      ),
      h('p', { className: 'text-dim' }, 'Escolha as áreas da vida que você quer evoluir. Uma área que você não escolher nunca derruba sua pontuação geral.'),
      h('div', { className: 'montro-hero' },
        h('div', { style: { color: 'var(--orange-2)' } }, pyramidMark({ size: 64, fillPercent: montroScore })),
        h('div', {},
          h('div', { className: 'montro-hero-label' }, 'MONTRO SCORE'),
          h('div', { className: 'montro-hero-num' }, montroScore),
          h('div', { className: 'montro-hero-sub' }, state.activeAreas.length
            ? `Média das ${state.activeAreas.length} área${state.activeAreas.length === 1 ? '' : 's'} ativa${state.activeAreas.length === 1 ? '' : 's'}.`
            : 'Ative pelo menos uma área abaixo para começar.')
        )
      ),
      h('div', { className: 'area-grid' }, cards)
    ));
  }
  draw();
  return store.subscribe(draw);
}

function habitRow(state, habit) {
  const stats = habitStats(state, habit);
  const checkedToday = isHabitCheckedToday(state, habit.id);
  return h('div', { className: 'card card-tight habit-row' },
    h('div', { className: 'habit-icon', style: { color: habit.color } }, icon(habit.icon, { size: 20 })),
    h('div', { className: 'grow' },
      h('div', { className: 'habit-title' }, habit.title),
      h('div', { className: 'habit-meta text-dim' }, `${stats.streak} seguidos · ${stats.total}/${habit.goalDays} dias`)
    ),
    h('button', {
      className: `check-toggle ${checkedToday ? 'checked' : ''}`,
      'aria-label': checkedToday ? 'Desmarcar hoje' : 'Marcar hoje',
      onClick: () => {
        store.mutate(s => {
          const key = checkinId(habit.id, dateKey());
          if (checkedToday) delete s.habitCheckins[key];
          else s.habitCheckins[key] = { habitId: habit.id, date: dateKey(), note: '', createdAt: new Date().toISOString() };
        });
        if (!checkedToday) toast('Check-in registrado', { iconName: 'check' });
      },
    }, checkedToday ? icon('check', { size: 18 }) : null)
  );
}

function libraryRow(area, item, alreadyAdded) {
  const ev = evidenceInfo(item.evidenceLevel);
  return h('div', { className: 'library-item' },
    h('div', { className: 'library-item-head' },
      h('div', { className: 'library-item-title' }, item.title),
      h('span', { className: 'evidence-badge' }, ev.dot, ' ', ev.label)
    ),
    h('p', { className: 'library-item-desc' }, item.description),
    item.mechanism ? h('p', { className: 'library-item-desc' }, item.mechanism) : null,
    h('p', { className: 'library-item-source' }, `Fonte: ${item.source}`),
    item.contraindications ? h('p', { className: 'library-item-source' }, `⚠️ ${item.contraindications}`) : null,
    alreadyAdded
      ? h('span', { className: 'pill pill-green' }, icon('check', { size: 12 }), 'Já nos seus hábitos')
      : h('button', {
          className: 'btn btn-outline btn-sm',
          onClick: () => {
            const habit = createLibraryHabit(item);
            store.mutate(s => { s.habits[habit.id] = habit; if (!s.activeAreas.includes(area.key)) s.activeAreas.push(area.key); });
            toast(`Adicionado: ${item.title}`, { iconName: 'check' });
          },
        }, icon('plus', { size: 14 }), 'Adicionar aos meus hábitos')
  );
}

function renderDetail(viewEl, nav, areaKey) {
  const area = areaFor(areaKey);
  if (!area) { nav.navigateTo('areas'); return () => {}; }

  function draw() {
    const state = store.state;
    const score = store.derived.areaScores[areaKey];
    const isActive = state.activeAreas.includes(areaKey);
    const habitsInArea = Object.values(state.habits).filter(h => h.active && h.area === areaKey);
    const libraryItems = libraryItemsForArea(areaKey);
    const addedTemplateIds = new Set(habitsInArea.map(h => h.templateId).filter(Boolean));

    mount(viewEl, h('div', { className: 'stack fade-up' },
      h('div', { className: 'row-between' },
        h('button', { className: 'icon-btn', 'aria-label': 'Voltar', onClick: () => nav.navigateTo('areas') }, icon('chevronLeft', { size: 20 })),
        h('h1', {}, area.label),
        h('span', { style: { width: '44px' } })
      ),
      h('div', { className: 'montro-hero' },
        h('div', { style: { color: area.color } }, pyramidMark({ size: 56, fillPercent: score ?? 0 })),
        h('div', {},
          h('div', { className: 'montro-hero-label' }, 'PONTUAÇÃO DA ÁREA'),
          h('div', { className: 'montro-hero-num', style: { color: area.color } }, score != null ? score : '—'),
          h('div', { className: 'montro-hero-sub' }, area.description)
        )
      ),
      h('div', { className: 'row-between card card-tight' },
        h('span', {}, 'Área ativa (conta pro Montro Score)'),
        h('button', {
          className: `btn btn-sm ${isActive ? 'btn-primary' : 'btn-outline'}`,
          onClick: () => toggleAreaActive(areaKey),
        }, isActive ? 'Ativa' : 'Ativar')
      ),

      areaKey === 'saude' ? h('button', {
        className: 'row-between card card-tight', style: { width: '100%', textAlign: 'left', color: 'var(--text)' },
        onClick: () => nav.navigateTo('saude'),
      },
        h('div', {},
          h('div', { style: { fontWeight: 700, fontSize: '13.5px' } }, 'Perfil de saúde e Health Score'),
          h('div', { className: 'text-faint', style: { fontSize: '11.5px' } }, 'Sono, atividade, tabagismo, álcool, medições')
        ),
        icon('chevronRight', { size: 18, className: 'text-faint' })
      ) : null,

      areaKey === 'profissional' ? h('button', {
        className: 'row-between card card-tight', style: { width: '100%', textAlign: 'left', color: 'var(--text)' },
        onClick: () => nav.navigateTo('valueScore'),
      },
        h('div', {},
          h('div', { style: { fontWeight: 700, fontSize: '13.5px' } }, 'Value Score e Business Master'),
          h('div', { className: 'text-faint', style: { fontSize: '11.5px' } }, 'Conceitos de vendas, liderança, negociação e mais')
        ),
        icon('chevronRight', { size: 18, className: 'text-faint' })
      ) : null,

      areaKey === 'conhecimento' ? h('button', {
        className: 'row-between card card-tight', style: { width: '100%', textAlign: 'left', color: 'var(--text)' },
        onClick: () => nav.navigateTo('conhecimento'),
      },
        h('div', {},
          h('div', { style: { fontWeight: 700, fontSize: '13.5px' } }, 'Sistema de domínio'),
          h('div', { className: 'text-faint', style: { fontSize: '11.5px' } }, 'Matérias, livros e cursos — de estudar até dominar')
        ),
        icon('chevronRight', { size: 18, className: 'text-faint' })
      ) : null,

      h('div', { className: 'section-title' }, 'SEUS HÁBITOS NESTA ÁREA'),
      habitsInArea.length
        ? h('div', { className: 'stack' }, habitsInArea.map(hb => habitRow(state, hb)))
        : h('div', { className: 'empty-state' }, 'Nenhum hábito ainda — adicione um da biblioteca abaixo.'),

      h('div', { className: 'section-title' }, 'BIBLIOTECA DE HÁBITOS COM EVIDÊNCIA'),
      h('p', { className: 'text-faint', style: { fontSize: '11px', marginTop: '-8px' } },
        'Orientações gerais de saúde pública, não é conselho médico individual.'),
      h('div', { className: 'stack' }, libraryItems.map(item =>
        libraryRow(area, item, addedTemplateIds.has(item.templateId || `lib:${item.id}`))
      ))
    ));
  }
  draw();
  return store.subscribe(draw);
}

export function renderAreas(viewEl, params, nav) {
  return params && params.area
    ? renderDetail(viewEl, nav, params.area)
    : renderOverview(viewEl, nav);
}
