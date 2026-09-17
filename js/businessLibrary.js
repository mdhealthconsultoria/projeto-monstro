// Business Master — trilha profissional. Conceitos curtos e ORIGINAIS de
// vendas/negociação/liderança/networking/estratégia/execução, escritos do
// zero (não são resumos de nenhum livro específico) com um exercício
// prático cada. Autoavaliação apenas — sem nota, sem prova, sem cobrança.

export const BUSINESS_CATEGORIES = [
  { key: 'vendas', label: 'Vendas' },
  { key: 'negociacao', label: 'Negociação' },
  { key: 'lideranca', label: 'Liderança' },
  { key: 'networking', label: 'Networking' },
  { key: 'estrategia', label: 'Estratégia' },
  { key: 'execucao', label: 'Execução' },
];

export function businessCategoryInfo(key) {
  return BUSINESS_CATEGORIES.find(c => c.key === key) || null;
}

export const BUSINESS_CONCEPTS = [
  {
    id: 'competencia-antes-discurso',
    title: 'Domine antes de discursar',
    category: 'estrategia',
    summary: 'Competência real demonstrada gera mais influência do que qualquer discurso sobre a sua própria competência.',
    exercise: 'Escolha uma habilidade que você mais usa no trabalho. Nas próximas 2 semanas, pratique-a deliberadamente em vez de falar sobre ela.',
  },
  {
    id: 'resultados-primeiro',
    title: 'Deixe o resultado falar primeiro',
    category: 'execucao',
    summary: 'Pedir reconhecimento antes de entregar algo mensurável costuma gerar desconfiança, não credibilidade.',
    exercise: 'Escolha uma entrega pendente e conclua-a antes de comunicar qualquer progresso sobre ela.',
  },
  {
    id: 'ouvir-negociar',
    title: 'Ouça mais do que argumenta',
    category: 'negociacao',
    summary: 'Entender o que a outra parte realmente precisa abre mais espaço numa negociação do que insistir na sua posição inicial.',
    exercise: 'Na próxima negociação, passe o primeiro minuto só fazendo perguntas antes de apresentar sua proposta.',
  },
  {
    id: 'relacoes-antes-de-precisar',
    title: 'Construa relações antes de precisar delas',
    category: 'networking',
    summary: 'Networking eficaz é investimento constante e genuíno — não um pedido de última hora quando você já precisa de algo.',
    exercise: 'Entre em contato com uma pessoa da sua rede esta semana sem pedir nada, só para trocar uma atualização real.',
  },
  {
    id: 'clareza-vence-carisma',
    title: 'Clareza vence carisma',
    category: 'lideranca',
    summary: 'Um time evolui mais rápido com instruções claras e objetivos bem definidos do que com discursos inspiradores vagos.',
    exercise: 'Na próxima vez que pedir algo a alguém, escreva o pedido em uma frase objetiva antes de comunicá-lo.',
  },
  {
    id: 'escolha-batalhas',
    title: 'Escolha suas batalhas',
    category: 'estrategia',
    summary: 'Nem todo conflito ou discordância vale o desgaste. Gaste energia onde o retorno real é maior.',
    exercise: 'Identifique uma discussão que você normalmente entraria esta semana e decida conscientemente deixá-la passar.',
  },
  {
    id: 'peca-diretamente',
    title: 'Peça o que você quer, diretamente',
    category: 'vendas',
    summary: 'Ambiguidade numa proposta comercial quase sempre significa uma oportunidade perdida — o cliente raramente pergunta o que você quis dizer.',
    exercise: 'Na próxima proposta ou pedido, termine com uma pergunta ou chamada de ação explícita, sem rodeios.',
  },
  {
    id: 'documente-entregas',
    title: 'Documente o que você entrega',
    category: 'execucao',
    summary: 'Um histórico registrado de resultados reais protege você e facilita negociações e promoções futuras.',
    exercise: 'Crie uma lista simples (planilha, nota) e registre uma entrega concreta que você fez esta semana.',
  },
  {
    id: 'nao-sem-justificar',
    title: 'Diga não sem se justificar demais',
    category: 'lideranca',
    summary: 'Excesso de explicação numa recusa costuma sinalizar insegurança e convida a mais pressão, não menos.',
    exercise: 'Na próxima vez que precisar recusar algo, use uma frase curta e educada, sem emendar múltiplas justificativas.',
  },
  {
    id: 'feedback-direto',
    title: 'Feedback direto é um presente',
    category: 'lideranca',
    summary: 'Um feedback específico e direto, dado a tempo, vale mais para a outra pessoa do que elogios genéricos ou silêncio educado.',
    exercise: 'Dê um feedback específico (algo que funcionou bem ou que pode melhorar) para alguém do seu time ou rede esta semana.',
  },
  {
    id: 'preco-ancora-valor',
    title: 'Ancore o valor antes do preço',
    category: 'vendas',
    summary: 'Uma proposta apresentada só com número, sem contexto do problema que resolve, é julgada apenas por ser cara ou barata.',
    exercise: 'Na próxima proposta que fizer, descreva o problema e o impacto da solução antes de mencionar qualquer valor.',
  },
  {
    id: 'plano-b-negociacao',
    title: 'Conheça sua melhor alternativa',
    category: 'negociacao',
    summary: 'Saber o que você fará se a negociação não fechar muda como você negocia — reduz a pressão de aceitar qualquer coisa.',
    exercise: 'Antes da próxima negociação importante, escreva por escrito qual é o seu plano caso ela não avance.',
  },
];
