// Notificações locais: permissão do navegador (Notification API) + um
// agendador que compara, a cada 30s, os horários já configurados no app
// (lembrete diário, respiração, hábitos) contra o relógio atual.
//
// Limitação honesta, documentada aqui e na tela: isso só funciona com o app
// aberto (aba ativa ou em segundo plano) — não é push de verdade (app
// totalmente fechado). Push real exigiria um servidor com chaves VAPID que
// este projeto não tem hoje (ver Central de Ajuda / decisões do projeto).

const DEDUPE_KEY = 'skeelo-notif-last-fired';

export function notificationsSupported() {
  return typeof Notification !== 'undefined';
}

export function permissionStatus() {
  return notificationsSupported() ? Notification.permission : 'unsupported';
}

export async function requestPermission() {
  if (!notificationsSupported()) return 'unsupported';
  try {
    return await Notification.requestPermission();
  } catch {
    return Notification.permission;
  }
}

// Cache local das preferências de conta (não busca de novo a cada tick do
// agendador — evita ficar consultando o Supabase em loop). As telas que
// editam essas preferências (Perfil, Central de Notificações, Onboarding)
// devem chamar setPreferencesCache() depois de salvar.
let prefsCache = null;
export function setPreferencesCache(prefs) { prefsCache = prefs; }
export function getPreferencesCache() { return prefsCache; }

function loadDedupe() {
  try { return JSON.parse(localStorage.getItem(DEDUPE_KEY) || '{}'); } catch { return {}; }
}
function saveDedupe(map) {
  try { localStorage.setItem(DEDUPE_KEY, JSON.stringify(map)); } catch { /* ignore */ }
}

function todayKey() {
  return new Intl.DateTimeFormat('en-CA', { year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
}

function nowHHMM() {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

function fire(title, body) {
  if (permissionStatus() !== 'granted') return;
  // Com a aba em primeiro plano o próprio app já mostra o aviso (pill/nudge)
  // — a notificação do sistema é reservada pro app estar em segundo plano.
  if (!document.hidden) return;
  try { new Notification(title, { body, icon: './icons/icon-192.png' }); } catch { /* ignore */ }
}

// Retorna uma função de parada. `getState` deve devolver o state atual do
// store (habits, breathing) e `getPreferences` as preferências de conta
// (reminderTime) — ambos podem retornar null enquanto ainda não carregaram.
export function startScheduler(getState, getPreferences) {
  function check() {
    const state = getState();
    const prefs = getPreferences();
    if (!state) return;

    const hhmm = nowHHMM();
    const today = todayKey();
    const dedupe = loadDedupe();
    let changed = false;
    const notifPrefs = state.notificationPrefs || {};

    if (notifPrefs.dailyReminder !== false && prefs && prefs.reminderTime && prefs.reminderTime === hhmm && dedupe.daily !== today) {
      fire('Skeelo Evolution', 'Hora de continuar sua evolução de hoje.');
      dedupe.daily = today; changed = true;
    }

    if (notifPrefs.breathingReminder !== false && state.breathing && state.breathing.reminderTime === hhmm && dedupe.breathing !== today) {
      fire('Respire e Comece', 'Seu momento de respiração está te esperando.');
      dedupe.breathing = today; changed = true;
    }

    if (notifPrefs.habitReminders !== false) {
      for (const habit of Object.values(state.habits)) {
        if (!habit.active || !habit.reminder || !habit.reminder.enabled || habit.reminder.time !== hhmm) continue;
        const key = `habit:${habit.id}`;
        if (dedupe[key] === today) continue;
        fire(habit.title, 'Não esqueça de marcar hoje.');
        dedupe[key] = today; changed = true;
      }
    }

    if (changed) saveDedupe(dedupe);
  }

  check();
  const intervalId = setInterval(check, 30000);
  return () => clearInterval(intervalId);
}
