// Domain model: workout cycle, day records, defaults. Pure data helpers, no I/O.

export const TOTAL_DAYS = 30;
export const REST_SECONDS_DEFAULT = 90;

export const WORKOUT_TYPES = {
  A: { key: 'A', name: 'PUSH', label: 'Treino A · PUSH' },
  B: { key: 'B', name: 'PULL', label: 'Treino B · PULL' },
  C: { key: 'C', name: 'LEGS', label: 'Treino C · LEGS' },
};

export function typeForDay(day) {
  const idx = (day - 1) % 3;
  return idx === 0 ? 'A' : idx === 1 ? 'B' : 'C';
}

// Exercise definitions per workout type, in execution order.
export const EXERCISES_BY_TYPE = {
  A: [
    { key: 'pushups', name: 'Flexões', mode: 'reps', setsCount: 5, unit: 'reps' },
    { key: 'pushupIso', name: 'Isometria de Flexão', mode: 'time', setsCount: 3, unit: 's' },
  ],
  B: [
    { key: 'pullups', name: 'Barra Fixa', mode: 'reps', setsCount: 5, unit: 'reps' },
    { key: 'deadHang', name: 'Dead Hang', mode: 'time', setsCount: 3, unit: 's' },
  ],
  C: [
    { key: 'bulgarian', name: 'Agachamento Búlgaro', mode: 'legs', setsCount: 5, unit: 'reps' },
    { key: 'wallSit', name: 'Wall Sit', mode: 'time', setsCount: 3, unit: 's' },
  ],
};

export function emptyExercisesForType(type) {
  const ex = {};
  for (const def of EXERCISES_BY_TYPE[type]) {
    if (def.mode === 'legs') {
      ex[def.key] = { sets: Array.from({ length: def.setsCount }, () => ({ left: null, right: null, weightKg: null })) };
    } else {
      ex[def.key] = { sets: Array.from({ length: def.setsCount }, () => null) };
    }
  }
  return ex;
}

export function emptyDay(day) {
  const type = typeForDay(day);
  return {
    day,
    type,
    exercises: emptyExercisesForType(type),
    checkin: null,
    startedAt: null,
    completedAt: null,
  };
}

export function isDayCompleted(dayRec) {
  return !!(dayRec && dayRec.completedAt);
}

export function isDayStarted(dayRec) {
  return !!(dayRec && dayRec.startedAt);
}

// Life areas — the six dimensions a user can choose to evolve in. Areas the
// user never activated are excluded from the overall Montro Score instead of
// dragging it down (see logic.js#computeMontroScore).
export const LIFE_AREAS = [
  { key: 'mente', label: 'Mente', icon: 'moon', color: '#7c9cff', description: 'Foco, calma e clareza mental.' },
  { key: 'fisico', label: 'Físico', icon: 'bolt', color: '#2b8c80', description: 'Movimento, força e condicionamento.' },
  { key: 'saude', label: 'Saúde', icon: 'heart', color: '#4fd1c5', description: 'Sono, alimentação e hidratação.' },
  { key: 'profissional', label: 'Profissional', icon: 'briefcase', color: '#6e90a8', description: 'Trabalho e geração de valor.' },
  { key: 'conhecimento', label: 'Conhecimento', icon: 'book', color: '#4aa8d8', description: 'Estudo, leitura e novas habilidades.' },
  { key: 'social', label: 'Social', icon: 'share', color: '#4fb8e0', description: 'Comunidade e relacionamentos.' },
];

export function areaFor(key) {
  return LIFE_AREAS.find(a => a.key === key) || null;
}

// Manual health measurements the user can log. Deliberately NOT paired with
// a clinical risk calculator (PREVENT/ASCVD etc.) yet — that needs its own
// careful, separate pass. This is just a private history, like bodyMetrics.
export const HEALTH_MEASUREMENT_TYPES = [
  { key: 'bpSys', label: 'Pressão sistólica', unit: 'mmHg' },
  { key: 'bpDia', label: 'Pressão diastólica', unit: 'mmHg' },
  { key: 'restingHR', label: 'Freq. cardíaca de repouso', unit: 'bpm' },
  { key: 'glucose', label: 'Glicemia em jejum', unit: 'mg/dL' },
  { key: 'hba1c', label: 'HbA1c', unit: '%' },
  { key: 'totalChol', label: 'Colesterol total', unit: 'mg/dL' },
  { key: 'hdl', label: 'HDL', unit: 'mg/dL' },
  { key: 'ldl', label: 'LDL', unit: 'mg/dL' },
  { key: 'triglycerides', label: 'Triglicerídeos', unit: 'mg/dL' },
];

export function healthTypeInfo(key) {
  return HEALTH_MEASUREMENT_TYPES.find(t => t.key === key) || null;
}

// Jornada de 90 dias: uma jornada estruturada de treinamento/consolidação
// sobre o app inteiro (não só o desafio de calistenia). Deliberadamente NÃO
// afirmamos que 90 dias formam um hábito automaticamente — é uma jornada de
// treinamento, não uma garantia (ver copy nas telas).
export const JOURNEY_TOTAL_DAYS = 90;
export const JOURNEY_PHASES = [
  { key: 'construcao', label: 'Construção', range: [1, 30], description: 'Criar rotina, aprender o sistema e começar pequeno. O objetivo aqui é formar consistência, não perfeição.' },
  { key: 'fortalecimento', label: 'Fortalecimento', range: [31, 60], description: 'Aumentar a dificuldade aos poucos, consolidar comportamentos e ganhar mais autonomia sobre a rotina.' },
  { key: 'autonomia', label: 'Autonomia', range: [61, 90], description: 'Reduzir a dependência de lembretes e estímulos externos, mantendo os hábitos por conta própria.' },
];

export function journeyPhaseForDay(day) {
  if (day == null) return null;
  return JOURNEY_PHASES.find(p => day >= p.range[0] && day <= p.range[1]) || JOURNEY_PHASES[JOURNEY_PHASES.length - 1];
}

// Sistema de Conhecimento: cada item (matéria/livro/curso/artigo) avança por
// um fluxo de domínio fixo — autoavançado pelo usuário, não é uma prova
// automática (não inventamos avaliação nenhuma sobre o que ele realmente sabe).
export const KNOWLEDGE_TYPES = [
  { key: 'materia', label: 'Matéria' },
  { key: 'livro', label: 'Livro' },
  { key: 'curso', label: 'Curso' },
  { key: 'artigo', label: 'Artigo' },
  { key: 'outro', label: 'Outro' },
];

export function knowledgeTypeInfo(key) {
  return KNOWLEDGE_TYPES.find(t => t.key === key) || KNOWLEDGE_TYPES[KNOWLEDGE_TYPES.length - 1];
}

export const KNOWLEDGE_STAGES = [
  { key: 'estudar', label: 'Estudar' },
  { key: 'testar', label: 'Testar' },
  { key: 'aplicar', label: 'Aplicar' },
  { key: 'revisar', label: 'Revisar' },
  { key: 'ensinar', label: 'Ensinar / Produzir' },
  { key: 'dominar', label: 'Dominar' },
];

export function knowledgeStageIndex(key) {
  const i = KNOWLEDGE_STAGES.findIndex(s => s.key === key);
  return i === -1 ? 0 : i;
}

export function nextKnowledgeStage(key) {
  const i = knowledgeStageIndex(key);
  return KNOWLEDGE_STAGES[Math.min(i + 1, KNOWLEDGE_STAGES.length - 1)].key;
}

export function defaultState() {
  return {
    version: 2,
    startDate: null,
    days: {},
    tests: { day1: null, day30: null },
    activeSession: null,
    habits: {},
    habitCheckins: {},
    dailyTasks: [],
    dailyTaskCompletions: {},
    bodyMetrics: { heightCm: null, weights: [] },
    breathing: { reminderTime: null, lastCompletedAt: null, sessions: [] },
    bodyDiaryConsent: false,
    activeAreas: [],
    healthProfile: {
      sex: null, // 'M' | 'F' | null (prefere não informar)
      birthYear: null,
      smoker: null, // boolean | null
      alcoholLevel: null, // 'none' | 'moderate' | 'high' | null
      conditions: [], // texto livre, autorrelatado
      measurements: [], // { id, type, value, date }
    },
    focus: {
      endAt: null,
      pausedRemaining: null, // seconds left, set only while paused
      mode: 'work', // 'work' | 'break'
      currentDurationMin: null, // duration (minutes) of the queued/running session
      objective: '',
      cyclesCompleted: 0, // since the last long break
      totalCyclesCompleted: 0,
      sessions: [], // { date, mode, durationMin, objective, completedAt }
      settings: { workMin: 25, breakMin: 5, longBreakMin: 15, cyclesUntilLong: 4 },
    },
    journey90: { startDate: null },
    businessConcepts: { appliedIds: [] }, // Business Master — autoavaliação, sem nota/prova
    knowledgeItems: {}, // { id, title, type, stage, sessions: [{date, minutes, note}], createdAt, archived }
    lastModifiedAt: null,
  };
}

export const LEVELS = [
  { level: 1, name: 'INÍCIO', min: 0 },
  { level: 2, name: 'DISCIPLINA', min: 300 },
  { level: 3, name: 'CONSISTÊNCIA', min: 800 },
  { level: 4, name: 'FORÇA', min: 1500 },
  { level: 5, name: 'MONSTRO', min: 2500 },
];

export function levelForXP(xp) {
  let current = LEVELS[0];
  for (const l of LEVELS) {
    if (xp >= l.min) current = l;
  }
  const idx = LEVELS.indexOf(current);
  const next = LEVELS[idx + 1] || null;
  return {
    ...current,
    next,
    xpIntoLevel: xp - current.min,
    xpForNext: next ? next.min - current.min : null,
    progress: next ? (xp - current.min) / (next.min - current.min) : 1,
  };
}
