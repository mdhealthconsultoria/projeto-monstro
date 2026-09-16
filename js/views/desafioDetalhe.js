import { h, mount } from '../utils.js';
import { icon } from '../icons.js';
import { toast } from '../ui.js';
import { store } from '../store.js';
import { currentDayNumber } from '../logic.js';
import { isDayCompleted } from '../model.js';
import { isHabitCheckedToday, dateKey } from '../habits.js';
import {
  getChallenge, myParticipation, joinChallenge, leaveChallenge,
  recordChallengeAction, getRanking, myTodayScore, currentUserId,
} from '../services/communities.js';

const ACTION_LABELS = {
  treino: { title: 'Treino diário', cta: 'Marcar treino de hoje' },
  habito: { title: 'Hábito diário', cta: 'Marcar hábito de hoje' },
  ingles: { title: 'Inglês diário', cta: 'Marcar inglês de hoje' },
  checklist: { title: 'Checklist diário', cta: 'Marcar checklist de hoje' },
  personalizado: { title: 'Personalizado', cta: 'Marcar hoje como concluído' },
};

// Best-effort read of the app's own local state to decide whether today's
// action is genuinely done — real integration, not just a self-report
// button. Falls back to true (self-declared) for freeform challenges.
function realProgressDoneToday(actionType) {
  const state = store.state;
  if (!state) return false;
  if (actionType === 'treino') {
    const day = currentDayNumber(state);
    return day ? isDayCompleted(state.days[day]) : false;
  }
  if (actionType === 'ingles') {
    const eng = Object.values(state.habits).find(h => h.templateId === 'english-90');
    return eng ? isHabitCheckedToday(state, eng.id) : false;
  }
  if (actionType === 'habito') {
    return Object.values(state.habits).some(h => h.active && isHabitCheckedToday(state, h.id));
  }
  if (actionType === 'checklist') {
    const tasks = state.dailyTasks.filter(t => !t.archived);
    if (!tasks.length) return false;
    const today = dateKey();
    return tasks.every(t => !!state.dailyTaskCompletions[`${t.id}:${today}`]);
  }
  return true; // 'personalizado' — honor system, same trust level as the rest of the app.
}

function daysLeftLabel(startsAt, endsAt) {
  const now = new Date();
  if (now < new Date(startsAt)) return 'Ainda não começou';
  const diff = Math.ceil((new Date(endsAt) - now) / 86400000);
  if (diff < 0) return 'Encerrado';
  if (diff === 0) return 'Último dia';
  return `${diff} dia${diff === 1 ? '' : 's'} restantes`;
}

export function renderDesafioDetalhe(viewEl, params, nav) {
  const challengeId = params.challengeId;
  let status = 'loading';
  let errorMsg = '';
  let challenge = null;
  let participation = null;
  let ranking = [];
  let myScoreToday = null;
  let myUserId = null;

  async function load() {
    status = 'loading';
    draw();
    try {
      challenge = await getChallenge(challengeId);
      if (!challenge) { status = 'notfound'; draw(); return; }
      myUserId = await currentUserId();
      participation = await myParticipation(challengeId);
      ranking = await getRanking(challengeId);
      myScoreToday = participation && participation.status === 'active' ? await myTodayScore(challengeId) : null;
      status = 'ready';
    } catch (err) {
      errorMsg = err.message || 'Não foi possível carregar o desafio.';
      status = 'error';
    }
    draw();
  }

  async function handleJoin() {
    try { await joinChallenge(challengeId); toast('Você entrou no desafio', { iconName: 'trophy' }); await load(); }
    catch (err) { toast(err.message, { iconName: 'alert' }); }
  }

  async function handleLeave() {
    try { await leaveChallenge(challengeId); toast('Você saiu do desafio', { iconName: 'check' }); await load(); }
    catch (err) { toast(err.message, { iconName: 'alert' }); }
  }

  async function handleMark() {
    try {
      await recordChallengeAction(challengeId, challenge.action_type);
      toast('Progresso registrado! +' + challenge.points_per_action + ' pontos', { iconName: 'trophy' });
      await load();
    } catch (err) {
      toast(err.message, { iconName: 'alert' });
      await load();
    }
  }

  function actionSection() {
    const isActive = participation && participation.status === 'active';
    const meta = ACTION_LABELS[challenge.action_type] || ACTION_LABELS.personalizado;

    if (!isActive) {
      return h('button', { className: 'btn btn-primary btn-block', onClick: handleJoin }, icon('trophy', { size: 18 }), 'Entrar no desafio');
    }
    if (myScoreToday) {
      return h('div', { className: 'card card-tight row', style: { justifyContent: 'center', color: 'var(--green)' } }, icon('checkCircle', { size: 20 }), h('span', {}, 'Concluído hoje'));
    }
    const realDone = realProgressDoneToday(challenge.action_type);
    const gated = challenge.action_type !== 'personalizado';
    return h('div', { className: 'stack' },
      gated && !realDone ? h('p', { className: 'text-faint', style: { fontSize: '12px' } }, `Complete "${meta.title.toLowerCase()}" no app para poder marcar aqui.`) : null,
      h('button', { className: 'btn btn-primary btn-block', disabled: gated && !realDone, onClick: handleMark }, icon('checkCircle', { size: 18 }), meta.cta),
      h('button', { className: 'btn btn-ghost btn-sm', onClick: handleLeave }, 'Sair do desafio')
    );
  }

  function rankingSection() {
    if (!ranking.length) return h('p', { className: 'text-faint' }, 'Ninguém pontuou ainda. Seja a primeira pessoa!');
    return h('div', { className: 'stack' },
      ranking.map((r, i) => h('div', { className: `card card-tight rank-row ${r.userId === myUserId ? 'me' : ''}` },
        h('div', { className: 'rank-pos' }, i + 1),
        h('span', { className: 'grow member-name' }, r.name + (r.userId === myUserId ? ' (você)' : '')),
        h('span', { className: 'rank-points' }, `${r.points} pts`)
      ))
    );
  }

  function draw() {
    const back = h('button', { className: 'icon-btn', 'aria-label': 'Voltar', onClick: () => nav.navigateTo('comunidades') }, icon('chevronLeft', { size: 20 }));
    const header = h('div', { className: 'row-between' }, back, h('h1', { style: { fontSize: '18px' } }, 'Desafio'), h('span', { style: { width: '44px' } }));

    if (status === 'loading') { mount(viewEl, h('div', { className: 'stack fade-up' }, header, h('div', { className: 'empty-state' }, icon('trophy', { size: 32 }), h('div', {}, 'Carregando...')))); return; }
    if (status === 'notfound') { mount(viewEl, h('div', { className: 'stack fade-up' }, header, h('div', { className: 'empty-state' }, icon('alert', { size: 32 }), h('div', {}, 'Desafio não encontrado.')))); return; }
    if (status === 'error') {
      mount(viewEl, h('div', { className: 'stack fade-up' }, header, h('div', { className: 'empty-state' }, icon('alert', { size: 32 }), h('div', {}, errorMsg), h('button', { className: 'btn btn-outline btn-sm', style: { marginTop: '10px' }, onClick: load }, 'Tentar de novo'))));
      return;
    }

    mount(viewEl, h('div', { className: 'stack fade-up' },
      header,
      h('div', { className: 'stack' },
        h('h2', { style: { fontSize: '20px' } }, challenge.title),
        h('div', { className: 'row' },
          h('span', { className: 'pill pill-orange' }, ACTION_LABELS[challenge.action_type] ? ACTION_LABELS[challenge.action_type].title : 'Personalizado'),
          h('span', { className: 'text-dim', style: { fontSize: '13px' } }, daysLeftLabel(challenge.starts_at, challenge.ends_at))
        ),
        challenge.description ? h('p', { className: 'text-dim' }, challenge.description) : null,
        h('p', { className: 'text-faint', style: { fontSize: '12px' } }, `${challenge.points_per_action} pontos por dia concluído.`),
        challenge.entry_fee_amount ? h('div', { className: 'card card-tight' }, icon('lock', { size: 16, className: 'text-dim' }), h('span', { className: 'text-dim' }, ' Pagamentos e prêmios: em breve.')) : null
      ),
      actionSection(),
      h('div', { className: 'stack' }, h('div', { className: 'section-title' }, 'RANKING'), rankingSection())
    ));
  }

  load();
  const unsub = store.subscribe(draw);
  return () => unsub();
}
