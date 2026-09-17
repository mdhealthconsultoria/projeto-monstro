// Biblioteca de hábitos com evidência — itens fixos, curados, cobrindo as 6
// áreas da vida (model.js#LIFE_AREAS). Cada item vira um hábito real via
// createLibraryHabit() (mesmo padrão de newHabit()/ENGLISH_90_TEMPLATE já
// usado no app).
//
// Regras seguidas ao escrever este conteúdo (não violar ao editar depois):
// - Nunca citar um estudo específico inventado (autor/ano/revista). Só
//   orientações amplas e bem estabelecidas de saúde pública.
// - Evidência classificada com conservadorismo: 'strong' só para o que tem
//   consenso amplo (ex.: atividade física, sono, tabagismo/álcool,
//   alimentação rica em vegetais). 'performance' para hábitos de
//   produtividade/disciplina sem ligação direta com desfechos clínicos.
// - Nunca prometer "mais anos de vida" — usar "associado a", "fator
//   modificável", "hábito relacionado a", nunca garantia.
// - `contraindications`, quando existir, é um aviso simples, não uma lista
//   médica exaustiva.

export const EVIDENCE_LEVELS = {
  strong: { key: 'strong', label: 'Evidência forte', color: '#22c55e', dot: '🟢' },
  moderate: { key: 'moderate', label: 'Evidência moderada', color: '#eab308', dot: '🟡' },
  emerging: { key: 'emerging', label: 'Evidência emergente', color: '#3b82f6', dot: '🔵' },
  performance: { key: 'performance', label: 'Hábito de performance/disciplina', color: '#9ca3af', dot: '⚪' },
};

export function evidenceInfo(level) {
  return EVIDENCE_LEVELS[level] || EVIDENCE_LEVELS.performance;
}

export const HABIT_LIBRARY = [
  // ---- Mente ----
  {
    id: 'lib-respiracao',
    title: 'Respiração guiada (5 min)',
    area: 'mente', category: 'oracao',
    description: 'Alguns minutos de respiração controlada antes de um momento importante do dia.',
    mechanism: 'Associada a redução de tensão percebida e maior sensação de calma no curto prazo.',
    frequency: 'daily', evidenceLevel: 'moderate',
    source: 'Prática amplamente recomendada em programas de manejo de estresse.',
  },
  {
    id: 'lib-meditacao',
    title: 'Meditação/atenção plena (10 min)',
    area: 'mente', category: 'oracao',
    description: 'Um período curto e fixo de atenção plena, sentado e em silêncio.',
    mechanism: 'Associada a menor percepção de estresse e melhor regulação emocional com a prática regular.',
    frequency: 'daily', evidenceLevel: 'moderate',
    source: 'Revisões sobre práticas de mindfulness em saúde comportamental.',
  },
  {
    id: 'lib-telas-noite',
    title: 'Reduzir telas 30 min antes de dormir',
    area: 'mente', category: 'personalizado',
    description: 'Desligar telas de alto brilho pouco antes de deitar.',
    mechanism: 'Associada a melhor qualidade percebida de sono em parte da população.',
    frequency: 'daily', evidenceLevel: 'emerging',
    source: 'Orientações gerais de higiene do sono.',
  },
  {
    id: 'lib-gratidao',
    title: 'Diário de gratidão (3 linhas)',
    area: 'mente', category: 'personalizado',
    description: 'Anotar três coisas boas do dia, por mais simples que sejam.',
    mechanism: 'Hábito de reflexão associado a maior bem-estar percebido em alguns estudos comportamentais.',
    frequency: 'daily', evidenceLevel: 'emerging',
    source: 'Literatura de psicologia positiva.',
  },

  // ---- Físico ----
  {
    id: 'lib-caminhada',
    title: 'Caminhar 30 minutos',
    area: 'fisico', category: 'exercicio',
    description: 'Caminhada em ritmo moderado, pode ser dividida ao longo do dia.',
    mechanism: 'Atividade física regular é um fator modificável de saúde cardiovascular e metabólica.',
    frequency: 'daily', evidenceLevel: 'strong',
    source: 'Diretrizes de atividade física da OMS (recomendação de ~150min/semana de atividade moderada).',
  },
  {
    id: 'lib-forca',
    title: 'Treino de força (2-3x/semana)',
    area: 'fisico', category: 'exercicio',
    description: 'Sessão de exercícios de força — peso corporal, halteres ou academia.',
    mechanism: 'Treinamento de força regular é comportamento protetor pra massa muscular e função ao longo da vida.',
    frequency: 'custom', daysOfWeek: [1, 3, 5], evidenceLevel: 'strong',
    source: 'Diretrizes de atividade física da OMS (recomendação de fortalecimento muscular 2x/semana).',
    contraindications: 'Comece leve se for iniciante; procure orientação profissional se tiver lesão preexistente.',
  },
  {
    id: 'lib-pausas-ativas',
    title: 'Pausa ativa a cada hora sentado',
    area: 'fisico', category: 'exercicio',
    description: 'Levantar e se movimentar por 2-3 minutos a cada hora de trabalho sentado.',
    mechanism: 'Reduzir tempo sedentário contínuo é associado a melhor perfil metabólico, independente do exercício estruturado.',
    frequency: 'daily', evidenceLevel: 'moderate',
    source: 'Pesquisa em comportamento sedentário e saúde metabólica.',
  },
  {
    id: 'lib-mobilidade',
    title: 'Mobilidade/alongamento (10 min)',
    area: 'fisico', category: 'exercicio',
    description: 'Rotina curta de mobilidade articular e alongamento.',
    mechanism: 'Hábito de performance associado a menor rigidez percebida e melhor amplitude de movimento.',
    frequency: 'daily', evidenceLevel: 'performance',
    source: 'Prática comum em preparação física.',
  },

  // ---- Saúde ----
  {
    id: 'lib-sono',
    title: 'Dormir 7-9 horas',
    area: 'saude', category: 'sono',
    description: 'Priorizar uma janela de sono consistente, com horário regular.',
    mechanism: 'Sono adequado é um dos fatores comportamentais de saúde cardiovascular reconhecidos por sociedades médicas.',
    frequency: 'daily', evidenceLevel: 'strong',
    source: 'American Heart Association — Life\'s Essential 8 (sono como componente de saúde cardiovascular).',
  },
  {
    id: 'lib-vegetais',
    title: 'Incluir frutas/vegetais nas refeições',
    area: 'saude', category: 'alimentacao',
    description: 'Adicionar pelo menos uma porção de fruta ou vegetal em cada refeição principal.',
    mechanism: 'Padrão alimentar rico em vegetais é amplamente associado a melhor saúde geral.',
    frequency: 'daily', evidenceLevel: 'strong',
    source: 'Diretrizes alimentares de sociedades de saúde (padrão alimentar, não alimento isolado).',
  },
  {
    id: 'lib-ultraprocessados',
    title: 'Reduzir ultraprocessados e açúcar',
    area: 'saude', category: 'alimentacao',
    description: 'Preferir alimentos in natura ou minimamente processados na maior parte das refeições.',
    mechanism: 'Menor consumo de ultraprocessados é associado a melhor perfil metabólico.',
    frequency: 'daily', evidenceLevel: 'moderate',
    source: 'Diretrizes alimentares baseadas em padrão de processamento dos alimentos.',
  },
  {
    id: 'lib-hidratacao',
    title: 'Hidratação ao longo do dia',
    area: 'saude', category: 'hidratacao',
    description: 'Beber água regularmente, sem depender só da sede pra lembrar.',
    mechanism: 'Hidratação adequada é hábito de performance ligado a energia e função cognitiva no dia a dia.',
    frequency: 'daily', evidenceLevel: 'performance',
    source: 'Orientação geral de bem-estar.',
  },
  {
    id: 'lib-nicotina-alcool',
    title: 'Não fumar / reduzir álcool',
    area: 'saude', category: 'personalizado',
    description: 'Registrar um dia sem nicotina, ou dentro do seu limite de álcool.',
    mechanism: 'Não fumar e reduzir consumo de álcool estão entre os fatores comportamentais mais consistentemente associados a menor risco de saúde.',
    frequency: 'daily', evidenceLevel: 'strong',
    source: 'Consenso amplo de sociedades médicas (CDC, OMS) sobre tabagismo e consumo de álcool.',
  },

  // ---- Profissional ----
  {
    id: 'lib-prioridade-dia',
    title: 'Definir a prioridade do dia',
    area: 'profissional', category: 'trabalho',
    description: 'Escolher, antes de começar a trabalhar, qual é a tarefa mais importante do dia.',
    mechanism: 'Hábito de performance ligado a foco e sensação de progresso no trabalho.',
    frequency: 'daily', evidenceLevel: 'performance',
    source: 'Prática comum em métodos de produtividade.',
  },
  {
    id: 'lib-revisao-semanal',
    title: 'Revisão semanal de metas',
    area: 'profissional', category: 'trabalho',
    description: 'Uma vez por semana, revisar o que avançou e o que precisa de ajuste.',
    mechanism: 'Hábito de performance associado a maior clareza e consistência em objetivos de médio prazo.',
    frequency: 'custom', daysOfWeek: [0], evidenceLevel: 'performance',
    source: 'Prática comum em metodologias de gestão pessoal.',
  },
  {
    id: 'lib-foco-profundo',
    title: 'Bloco de foco profundo (25-50 min)',
    area: 'profissional', category: 'trabalho',
    description: 'Um bloco de tempo sem notificações, dedicado a uma única tarefa.',
    mechanism: 'Hábito de performance associado a maior qualidade de trabalho entregue por sessão.',
    frequency: 'daily', evidenceLevel: 'performance',
    source: 'Prática comum em métodos de trabalho focado (ex.: técnica Pomodoro).',
  },

  // ---- Conhecimento ----
  {
    id: 'lib-leitura',
    title: 'Ler 10 páginas por dia',
    area: 'conhecimento', category: 'leitura',
    description: 'Um pouco de leitura todo dia, de qualquer livro que esteja agregando valor.',
    mechanism: 'Hábito de performance ligado a acúmulo consistente de conhecimento ao longo do tempo.',
    frequency: 'daily', evidenceLevel: 'performance',
    source: 'Prática comum de desenvolvimento pessoal.',
  },
  {
    id: 'lib-estudo-novo',
    title: 'Estudar algo novo (20 min)',
    area: 'conhecimento', category: 'estudos',
    description: 'Tempo dedicado a aprender uma habilidade ou assunto novo.',
    mechanism: 'Aprendizado contínuo é hábito de performance associado a desenvolvimento de novas capacidades.',
    frequency: 'daily', evidenceLevel: 'performance',
    source: 'Prática comum de desenvolvimento pessoal.',
  },
  {
    id: 'lib-ingles',
    title: 'Praticar inglês (check-in diário)',
    area: 'conhecimento', category: 'ingles',
    description: 'Já existe como modelo dedicado — "Inglês — Desafio 90 dias" em Minha Base.',
    mechanism: 'Prática diária consistente é hábito de performance associado a aquisição de idioma.',
    frequency: 'daily', evidenceLevel: 'performance',
    source: 'Prática comum de aprendizado de idiomas.',
    templateId: 'english-90',
  },

  // ---- Social ----
  {
    id: 'lib-conversa-significativa',
    title: 'Conversa significativa com alguém próximo',
    area: 'social', category: 'personalizado',
    description: 'Ligar, visitar ou conversar de verdade com alguém que importa pra você.',
    mechanism: 'Conexão social é associada a melhor bem-estar percebido ao longo da vida.',
    frequency: 'custom', daysOfWeek: [0, 3], evidenceLevel: 'moderate',
    source: 'Consenso amplo em pesquisa de bem-estar sobre relações sociais.',
  },
  {
    id: 'lib-comunidade',
    title: 'Participar de uma comunidade ou desafio',
    area: 'social', category: 'personalizado',
    description: 'Interagir em uma comunidade do app, ou registrar progresso num desafio em grupo.',
    mechanism: 'Hábito de performance — pertencimento a um grupo com objetivo comum ajuda consistência.',
    frequency: 'daily', evidenceLevel: 'performance',
    source: 'Prática comum em programas de mudança de comportamento em grupo.',
  },
];

export function libraryItemsForArea(areaKey) {
  return HABIT_LIBRARY.filter(item => item.area === areaKey);
}
