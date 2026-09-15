import { store } from './store.js';
import { h } from './utils.js';
import { icon } from './icons.js';

import { renderHoje } from './views/hoje.js';
import { renderJornada } from './views/jornada.js';
import { renderEvolucao } from './views/evolucao.js';
import { renderFotos } from './views/fotos.js';
import { renderPerfil } from './views/perfil.js';
import { renderTreino } from './views/treino.js';
import { renderResultado } from './views/resultado.js';

const TABS = [
  { id: 'hoje', label: 'Hoje', icon: 'today', render: renderHoje },
  { id: 'jornada', label: 'Jornada', icon: 'journey', render: renderJornada },
  { id: 'evolucao', label: 'Evolução', icon: 'evolution', render: renderEvolucao },
  { id: 'fotos', label: 'Fotos', icon: 'photos', render: renderFotos },
  { id: 'perfil', label: 'Perfil', icon: 'profile', render: renderPerfil },
];

const FOCUS_SCREENS = {
  treino: renderTreino,
  resultado: renderResultado,
};

const viewEl = document.getElementById('view');
const navEl = document.getElementById('bottom-nav');
const appRoot = document.getElementById('app-root');

let cleanupFn = null;
let currentScreenId = 'hoje';

const nav = {
  navigateTo(screenId, params = {}) {
    if (cleanupFn) { try { cleanupFn(); } catch { /* ignore */ } cleanupFn = null; }
    currentScreenId = screenId;

    const tab = TABS.find(t => t.id === screenId);
    const focus = FOCUS_SCREENS[screenId];

    if (tab) {
      appRoot.classList.remove('view-focus');
      navEl.style.display = '';
      renderNav(screenId);
      cleanupFn = tab.render(viewEl, params, nav) || null;
    } else if (focus) {
      appRoot.classList.add('view-focus');
      navEl.style.display = 'none';
      cleanupFn = focus(viewEl, params, nav) || null;
    } else {
      appRoot.classList.remove('view-focus');
      navEl.style.display = '';
      renderNav('hoje');
      cleanupFn = renderHoje(viewEl, {}, nav) || null;
    }
    window.scrollTo(0, 0);
  },
};

function renderNav(activeId) {
  const items = TABS.map(t =>
    h('button', {
      className: `nav-item ${t.id === activeId ? 'active' : ''}`,
      onClick: () => nav.navigateTo(t.id),
      'aria-label': t.label,
      'aria-current': t.id === activeId ? 'page' : null,
    },
      icon(t.icon, { size: 24 }),
      h('span', {}, t.label)
    )
  );
  navEl.innerHTML = '';
  items.forEach(i => navEl.appendChild(i));
}

if ('serviceWorker' in navigator) {
  // Register immediately: waiting for the 'load' event is unreliable here, since the app's
  // own async boot (IndexedDB open) can outlast page load, causing the listener to attach
  // after 'load' already fired and silently never registering the worker.
  navigator.serviceWorker.register('./sw.js').catch(err => console.error('SW falhou', err));
}

async function boot() {
  await store.init();

  // Resume an in-progress workout session if the app was closed mid-training.
  if (store.state.activeSession && store.state.activeSession.day) {
    nav.navigateTo('treino', { day: store.state.activeSession.day, resume: true });
  } else {
    nav.navigateTo('hoje');
  }
}

boot();
