import { store } from './store.js';
import { h } from './utils.js';
import { icon } from './icons.js';
import * as auth from './services/auth.js';

import { renderHoje } from './views/hoje.js';
import { renderEvoluir } from './views/evoluir.js';
import { renderComunidades } from './views/comunidades.js';
import { renderComunidadeDetalhe } from './views/comunidadeDetalhe.js';
import { renderDesafioDetalhe } from './views/desafioDetalhe.js';
import { renderAdmin } from './views/admin.js';
import { renderProgresso } from './views/progresso.js';
import { renderPerfil } from './views/perfil.js';
import { renderTreino } from './views/treino.js';
import { renderResultado } from './views/resultado.js';
import { renderLogin, renderSignup } from './views/auth.js';
import { renderOnboarding } from './views/onboarding.js';
import { renderJornada } from './views/jornada.js';
import { renderMinhaBase } from './views/minhaBase.js';
import { renderChecklist } from './views/checklist.js';

const TABS = [
  { id: 'hoje', label: 'Hoje', icon: 'today', render: renderHoje },
  { id: 'evoluir', label: 'Evoluir', icon: 'bolt', render: renderEvoluir },
  { id: 'comunidades', label: 'Comunidades', icon: 'users', render: renderComunidades },
  { id: 'progresso', label: 'Progresso', icon: 'evolution', render: renderProgresso },
  { id: 'perfil', label: 'Perfil', icon: 'profile', render: renderPerfil },
];

// Screens with no bottom nav: workout focus, results, and everything before
// the user is inside the authenticated app shell.
const FOCUS_SCREENS = {
  treino: renderTreino,
  resultado: renderResultado,
  login: renderLogin,
  signup: renderSignup,
  onboarding: renderOnboarding,
  admin: renderAdmin,
};

// Screens reached one level deeper than a tab (e.g. from "Evoluir"), but
// that still keep the bottom nav visible — they just aren't a tab themselves.
const SUB_SCREENS = {
  jornada: { render: renderJornada, activeTab: 'evoluir' },
  minhaBase: { render: renderMinhaBase, activeTab: 'evoluir' },
  checklist: { render: renderChecklist, activeTab: 'evoluir' },
  comunidadeDetalhe: { render: renderComunidadeDetalhe, activeTab: 'comunidades' },
  desafioDetalhe: { render: renderDesafioDetalhe, activeTab: 'comunidades' },
};

const viewEl = document.getElementById('view');
const navEl = document.getElementById('bottom-nav');
const appRoot = document.getElementById('app-root');

let cleanupFn = null;

const nav = {
  navigateTo(screenId, params = {}) {
    if (screenId === 'boot') { routeFromAuthState(); return; }

    if (cleanupFn) { try { cleanupFn(); } catch { /* ignore */ } cleanupFn = null; }

    const tab = TABS.find(t => t.id === screenId);
    const focus = FOCUS_SCREENS[screenId];
    const sub = SUB_SCREENS[screenId];

    if (tab) {
      appRoot.classList.remove('view-focus');
      navEl.style.display = '';
      renderNav(screenId);
      cleanupFn = tab.render(viewEl, params, nav) || null;
    } else if (sub) {
      appRoot.classList.remove('view-focus');
      navEl.style.display = '';
      renderNav(sub.activeTab);
      cleanupFn = sub.render(viewEl, params, nav) || null;
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

// Central routing decision: not logged in -> auth; logged in but onboarding
// incomplete -> onboarding; otherwise -> the app shell (resuming an
// in-progress workout session if one was left open).
async function routeFromAuthState() {
  try {
    const session = await auth.getSession();
    if (!session) {
      store.clearActive();
      nav.navigateTo('login');
      return;
    }

    await store.loadForUser(session.user.id);

    if (!session.user.onboardingComplete) {
      nav.navigateTo('onboarding');
      return;
    }

    if (store.state.activeSession && store.state.activeSession.day) {
      nav.navigateTo('treino', { day: store.state.activeSession.day, resume: true });
    } else {
      nav.navigateTo('hoje');
    }
  } catch (err) {
    console.error('Falha ao iniciar o app', err);
    showBootError(err);
  }
}

function showBootError(err) {
  appRoot.classList.add('view-focus');
  navEl.style.display = 'none';
  viewEl.innerHTML = '';
  const box = h('div', { className: 'focus-screen', style: { justifyContent: 'center', alignItems: 'center', textAlign: 'center', gap: '14px' } },
    h('h2', {}, 'Não foi possível carregar'),
    h('p', { className: 'text-dim' }, (err && err.message) || 'Verifique sua internet e tente novamente.'),
    h('button', { className: 'btn btn-primary', onClick: () => window.location.reload() }, 'Tentar de novo')
  );
  viewEl.appendChild(box);
}

if ('serviceWorker' in navigator) {
  // Register immediately: waiting for the 'load' event is unreliable here, since the app's
  // own async boot (IndexedDB open) can outlast page load, causing the listener to attach
  // after 'load' already fired and silently never registering the worker.
  navigator.serviceWorker.register('./sw.js').catch(err => console.error('SW falhou', err));

  // A page already open (especially an installed PWA reopened from the home
  // screen icon) keeps running the JS it already loaded even after a newer
  // service worker takes over in the background. Without this, a device can
  // get stuck showing a broken/outdated build indefinitely. Reload once,
  // automatically, the moment the new worker takes control.
  let reloadedForUpdate = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (reloadedForUpdate) return;
    reloadedForUpdate = true;
    window.location.reload();
  });
}

routeFromAuthState();
