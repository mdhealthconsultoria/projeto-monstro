// Conquistas — calculadas do zero a cada chamada, mesmo princípio de
// computeAll() em logic.js: nunca um contador incremental separado que possa
// dessincronizar. Cada critério usa deliberadamente uma métrica HISTÓRICA
// (melhor sequência já alcançada, total acumulado) em vez de um valor
// instantâneo (como a pontuação atual de uma área) — assim, uma vez
// conquistada, a badge nunca "desaparece" só porque algo caiu depois.
import { LEVELS } from './model.js';
import { habitBestStreak } from './habits.js';

export const BADGE_CATEGORIES = {
  nivel: { label: 'Nível', icon: 'crown' },
  treino: { label: 'Treino de 30 dias', icon: 'flame' },
  jornada: { label: 'Jornada de 90 dias', icon: 'journey' },
  habitos: { label: 'Hábitos', icon: 'pyramid' },
  conhecimento: { label: 'Conhecimento', icon: 'book' },
  profissional: { label: 'Profissional', icon: 'briefcase' },
  foco: { label: 'Foco', icon: 'clock' },
};

export const BADGES = [
  // ---- Nível (XP) ----
  { id: 'level-disciplina', category: 'nivel', label: 'Disciplina', description: 'Alcançou o nível DISCIPLINA (300 XP)', check: (s, d) => d.computed.totalXP >= 300 },
  { id: 'level-consistencia', category: 'nivel', label: 'Consistência', description: 'Alcançou o nível CONSISTÊNCIA (800 XP)', check: (s, d) => d.computed.totalXP >= 800 },
  { id: 'level-forca', category: 'nivel', label: 'Força', description: 'Alcançou o nível FORÇA (1500 XP)', check: (s, d) => d.computed.totalXP >= 1500 },
  { id: 'level-monstro', category: 'nivel', label: 'Monstro', description: 'Alcançou o nível MONSTRO (2500 XP)', check: (s, d) => d.computed.totalXP >= 2500 },

  // ---- Treino de 30 dias ----
  { id: 'streak-3', category: 'treino', label: 'Primeiros passos', description: '3 dias seguidos de treino', check: (s, d) => d.streaks.best >= 3 },
  { id: 'streak-7', category: 'treino', label: 'Uma semana firme', description: '7 dias seguidos de treino', check: (s, d) => d.streaks.best >= 7 },
  { id: 'streak-14', category: 'treino', label: 'Duas semanas', description: '14 dias seguidos de treino', check: (s, d) => d.streaks.best >= 14 },
  { id: 'streak-30', category: 'treino', label: 'Sem falhar um dia', description: '30 dias seguidos de treino', check: (s, d) => d.streaks.best >= 30 },
  { id: 'workouts-10', category: 'treino', label: 'Ritmo pego', description: '10 treinos concluídos', check: (s, d) => d.computed.workoutsCompleted >= 10 },
  { id: 'workouts-30', category: 'treino', label: 'Desafio completo', description: 'Os 30 treinos concluídos', check: (s, d) => d.computed.workoutsCompleted >= 30 },
  { id: 'records-5', category: 'treino', label: 'Quebrando recordes', description: '5 recordes pessoais batidos', check: (s, d) => d.computed.recordsBrokenTotal >= 5 },
  { id: 'records-20', category: 'treino', label: 'Sempre superando', description: '20 recordes pessoais batidos', check: (s, d) => d.computed.recordsBrokenTotal >= 20 },

  // ---- Jornada de 90 dias ----
  { id: 'journey-fortalecimento', category: 'jornada', label: 'Fortalecimento', description: 'Chegou à fase de Fortalecimento (dia 31)', check: (s, d) => d.journeyDay != null && d.journeyDay >= 31 },
  { id: 'journey-autonomia', category: 'jornada', label: 'Autonomia', description: 'Chegou à fase de Autonomia (dia 61)', check: (s, d) => d.journeyDay != null && d.journeyDay >= 61 },
  { id: 'journey-completa', category: 'jornada', label: 'Jornada completa', description: 'Completou os 90 dias da jornada', check: (s, d) => d.journeyDay != null && d.journeyDay >= 90 },

  // ---- Hábitos ----
  { id: 'habit-streak-30', category: 'habitos', label: 'Hábito consolidado', description: 'Um hábito com 30 dias seguidos de check-in', check: s => Object.values(s.habits).some(h => habitBestStreak(s, h) >= 30) },
  { id: 'areas-5', category: 'habitos', label: 'Evolução em várias frentes', description: '5 áreas da vida ativadas ao mesmo tempo', check: s => (s.activeAreas || []).length >= 5 },

  // ---- Conhecimento ----
  { id: 'knowledge-first', category: 'conhecimento', label: 'Começando a estudar', description: 'Primeiro item de conhecimento adicionado', check: s => Object.keys(s.knowledgeItems || {}).length >= 1 },
  { id: 'knowledge-mastered', category: 'conhecimento', label: 'Domínio completo', description: 'Um item de conhecimento chegou a "Dominar"', check: s => Object.values(s.knowledgeItems || {}).some(i => i.stage === 'dominar') },

  // ---- Profissional / Business Master ----
  { id: 'business-first', category: 'profissional', label: 'Primeiro conceito', description: 'Aplicou o primeiro conceito do Business Master', check: s => (s.businessConcepts && s.businessConcepts.appliedIds ? s.businessConcepts.appliedIds.length : 0) >= 1 },
  { id: 'business-5', category: 'profissional', label: 'Repertório de negócios', description: 'Aplicou 5 conceitos do Business Master', check: s => (s.businessConcepts && s.businessConcepts.appliedIds ? s.businessConcepts.appliedIds.length : 0) >= 5 },

  // ---- Foco ----
  { id: 'focus-first', category: 'foco', label: 'Primeiro ciclo', description: 'Completou o primeiro ciclo de foco', check: s => (s.focus && s.focus.totalCyclesCompleted) >= 1 },
  { id: 'focus-10', category: 'foco', label: 'Foco treinado', description: 'Completou 10 ciclos de foco', check: s => (s.focus && s.focus.totalCyclesCompleted) >= 10 },
];

export function computeEarnedBadgeIds(state, derived) {
  return BADGES.filter(b => {
    try { return b.check(state, derived); } catch { return false; }
  }).map(b => b.id);
}
