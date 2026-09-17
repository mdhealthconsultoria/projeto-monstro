import { h, mount } from '../utils.js';
import { icon } from '../icons.js';
import { store } from '../store.js';
import { toast, openModal } from '../ui.js';
import * as auth from '../services/auth.js';
import { notificationsSupported, permissionStatus, requestPermission, setPreferencesCache } from '../notifications.js';

// Editado em modal (não inline na árvore de draw()) de propósito: essa tela
// redesenha inteira a cada store.mutate() (toggles) e a cada refreshUser()
// assíncrono — um <input> dentro dessa árvore perde o que a pessoa digitou
// se um redraw acontecer no meio da edição. Modal fica fora dessa árvore.
function reminderTimeModal(currentValue, onSaved) {
  const input = h('input', { type: 'time', value: currentValue || '' });
  const content = h('div', { className: 'stack' },
    h('div', { className: 'field' }, h('label', {}, 'Horário'), input),
    h('button', {
      className: 'btn btn-primary btn-block',
      onClick: async () => {
        const updated = await auth.updateProfile({ preferences: { reminderTime: input.value || null } });
        setPreferencesCache(updated.preferences);
        toast('Horário salvo', { iconName: 'check' });
        close();
        onSaved(updated);
      },
    }, 'Salvar')
  );
  const close = openModal(content, { title: 'Lembrete diário' });
}

const PERMISSION_LABEL = {
  granted: { label: 'Permitidas', tone: 'pill-green' },
  denied: { label: 'Bloqueadas no navegador', tone: 'pill-red' },
  default: { label: 'Ainda não decidido', tone: 'pill-orange' },
  unsupported: { label: 'Não suportado neste navegador', tone: 'pill-red' },
};

function toggleRow(label, sub, checked, onToggle) {
  return h('div', { className: 'row-between card card-tight' },
    h('div', {},
      h('div', { style: { fontWeight: 700, fontSize: '13.5px' } }, label),
      h('div', { className: 'text-faint', style: { fontSize: '11.5px' } }, sub)
    ),
    h('button', {
      className: `btn btn-sm ${checked ? 'btn-primary' : 'btn-outline'}`,
      onClick: onToggle,
    }, checked ? 'Ativado' : 'Desativado')
  );
}

export function renderNotificacoes(viewEl, params, nav) {
  let user = null;

  async function refreshUser() {
    const session = await auth.getSession();
    user = session ? session.user : null;
    draw();
  }

  function draw() {
    const state = store.state;
    const prefs = state.notificationPrefs;
    const status = permissionStatus();
    const statusInfo = PERMISSION_LABEL[status] || PERMISSION_LABEL.default;

    mount(viewEl, h('div', { className: 'stack fade-up' },
      h('div', { className: 'row-between' },
        h('button', { className: 'icon-btn', 'aria-label': 'Voltar', onClick: () => nav.navigateTo('perfil') }, icon('chevronLeft', { size: 20 })),
        h('h1', {}, 'Notificações'),
        h('span', { style: { width: '44px' } })
      ),

      h('div', { className: 'card stack' },
        h('div', { className: 'row-between' },
          h('div', { className: 'section-title' }, 'PERMISSÃO DO NAVEGADOR'),
          h('span', { className: `pill ${statusInfo.tone}` }, statusInfo.label)
        ),
        h('p', { className: 'text-dim', style: { fontSize: '12.5px' } },
          'Funciona enquanto o app está aberto — aba ativa ou em segundo plano no navegador. Notificação com o app totalmente fechado (push) ainda não está disponível.'),
        (notificationsSupported() && status !== 'granted' && status !== 'denied') ? h('button', {
          className: 'btn btn-primary btn-block',
          onClick: async () => {
            const result = await requestPermission();
            if (result === 'granted') toast('Notificações ativadas', { iconName: 'check' });
            draw();
          },
        }, 'Permitir notificações') : null,
        status === 'denied' ? h('p', { className: 'text-faint', style: { fontSize: '11.5px' } },
          'Você bloqueou notificações pra este site. Pra reativar, ajuste isso nas configurações do navegador.') : null
      ),

      h('div', { className: 'section-title' }, 'O QUE VOCÊ QUER RECEBER'),
      toggleRow('Lembrete diário', user && user.preferences.reminderTime ? `Configurado para ${user.preferences.reminderTime}` : 'Defina um horário abaixo',
        prefs.dailyReminder, () => store.mutate(s => { s.notificationPrefs.dailyReminder = !s.notificationPrefs.dailyReminder; })),
      toggleRow('Respire e Comece', state.breathing && state.breathing.reminderTime ? `Configurado para ${state.breathing.reminderTime}` : 'Defina um horário em Respire e Comece',
        prefs.breathingReminder, () => store.mutate(s => { s.notificationPrefs.breathingReminder = !s.notificationPrefs.breathingReminder; })),
      toggleRow('Hábitos individuais', 'Usa o horário definido em cada hábito, em Minha Base',
        prefs.habitReminders, () => store.mutate(s => { s.notificationPrefs.habitReminders = !s.notificationPrefs.habitReminders; })),

      h('div', { className: 'row-between card card-tight' },
        h('div', {},
          h('div', { style: { fontWeight: 700, fontSize: '13.5px' } }, 'Horário do lembrete diário'),
          h('div', { className: 'text-faint', style: { fontSize: '11.5px' } },
            user && user.preferences.reminderTime ? user.preferences.reminderTime : 'Nenhum horário definido')
        ),
        h('button', {
          className: 'btn btn-outline btn-sm',
          onClick: () => reminderTimeModal(user && user.preferences.reminderTime, updated => { user = updated; draw(); }),
        }, 'Editar')
      ),

      h('button', { className: 'btn btn-outline btn-block', onClick: () => nav.navigateTo('respirar') }, 'Ajustar lembrete de respiração'),
      h('button', { className: 'btn btn-outline btn-block', onClick: () => nav.navigateTo('minhaBase') }, 'Ajustar lembretes de hábitos')
    ));
  }

  refreshUser();
  draw();
  const unsub = store.subscribe(draw);
  return () => unsub();
}
