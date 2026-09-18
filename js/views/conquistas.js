import { h, mount } from '../utils.js';
import { icon } from '../icons.js';
import { store } from '../store.js';
import { BADGES, BADGE_CATEGORIES } from '../badges.js';

function badgeCard(badge, earned) {
  const cat = BADGE_CATEGORIES[badge.category];
  return h('div', { className: `card card-tight stack ${earned ? '' : 'is-inactive'}`, style: { alignItems: 'center', textAlign: 'center', gap: '6px' } },
    h('div', { style: { color: earned ? 'var(--orange-2)' : 'var(--text-faint)' } }, icon(cat ? cat.icon : 'trophy', { size: 26 })),
    h('div', { style: { fontWeight: 700, fontSize: '13px' } }, badge.label),
    h('div', { className: 'text-faint', style: { fontSize: '11px', lineHeight: 1.35 } }, badge.description),
    earned ? h('span', { className: 'pill pill-green', style: { marginTop: '2px' } }, icon('check', { size: 11 }), 'Conquistado') : null
  );
}

export function renderConquistas(viewEl, params, nav) {
  function draw() {
    const earnedIds = new Set(store.derived.earnedBadgeIds);
    const total = BADGES.length;
    const earnedCount = earnedIds.size;

    const groups = Object.keys(BADGE_CATEGORIES).map(catKey => {
      const items = BADGES.filter(b => b.category === catKey);
      if (!items.length) return null;
      return h('div', { className: 'stack' },
        h('div', { className: 'section-title' }, BADGE_CATEGORIES[catKey].label.toUpperCase()),
        h('div', { className: 'area-grid' }, items.map(b => badgeCard(b, earnedIds.has(b.id))))
      );
    }).filter(Boolean);

    mount(viewEl, h('div', { className: 'stack fade-up' },
      h('div', { className: 'row-between' },
        h('button', { className: 'icon-btn', 'aria-label': 'Voltar', onClick: () => nav.navigateTo('perfil') }, icon('chevronLeft', { size: 20 })),
        h('h1', {}, 'Conquistas'),
        h('span', { style: { width: '44px' } })
      ),
      h('div', { className: 'montro-hero' },
        h('div', { style: { color: 'var(--orange-2)' } }, icon('trophy', { size: 40 })),
        h('div', {},
          h('div', { className: 'montro-hero-label' }, 'DESBLOQUEADAS'),
          h('div', { className: 'montro-hero-num' }, `${earnedCount}/${total}`),
          h('div', { className: 'montro-hero-sub' }, 'Baseadas em recordes e marcos reais — uma vez alcançada, a conquista fica pra sempre.')
        )
      ),
      groups
    ));
  }

  draw();
  const unsub = store.subscribe(draw);
  return () => unsub();
}
