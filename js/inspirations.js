// Local content for the daily phrase/verse. Shaped the same way the future
// Supabase `daily_inspirations` table will be, so swapping in a remote
// source later is a data-source change, not a UI change. This module is
// also the offline fallback the spec requires even once that table exists.

const PHRASES = [
  'Todo grande resultado começa pela base.',
  'Consistência vence intensidade.',
  'Mais um dia. Mais um degrau.',
  'A disciplina não pergunta como você se sente.',
  'Você não precisa de motivação, precisa de rotina.',
  'Grandes resultados são construídos dia após dia.',
  'Hoje é só sobre aparecer.',
  'Pequeno progresso ainda é progresso.',
  'Ninguém disfarça consistência.',
  'Faça o que a versão de ontem não fez.',
  'Sem desculpas. Só ação.',
  'A base sustenta tudo o que vem depois.',
  'Evoluir é uma decisão diária, não um evento único.',
  'O corpo, a mente e as pessoas ao redor evoluem juntos.',
  'Você não vê o degrau de hoje, mas ele sustenta o de amanhã.',
  'Feito imperfeito hoje vale mais que perfeito adiado.',
  'A repetição é o que transforma esforço em identidade.',
  'Cuide da base e o topo cuida de si mesmo.',
  'Constância é a forma mais silenciosa de disciplina.',
  'Você está mais perto do que ontem, mesmo sem sentir.',
  'Comece pequeno. Continue grande.',
  'O que você repete, você se torna.',
  'Ninguém evolui sozinho de verdade — busque sua comunidade.',
  'Seu eu de daqui a 30 dias agradece o que você fizer hoje.',
  'Disciplina é liberdade disfarçada de esforço.',
  'Cada check-in é um tijolo na sua base.',
  'Não é sobre motivação. É sobre presença diária.',
  'A evolução completa não pula etapas — ela empilha.',
  'Seja a pessoa que aparece mesmo nos dias difíceis.',
  'Sua base de hoje é o alicerce do seu topo de amanhã.',
];

// Public-domain, classic Portuguese Bible wording (Almeida — tradução
// clássica, domínio público). Short, widely known verses only.
const VERSES = [
  { text: 'Tudo posso naquele que me fortalece.', reference: 'Filipenses 4:13' },
  { text: 'O Senhor é a minha força e o meu escudo; nele confiou o meu coração, e fui socorrido.', reference: 'Salmos 28:7' },
  { text: 'Não te disse eu que, se creres, verás a glória de Deus?', reference: 'João 11:40' },
  { text: 'Esforça-te, e tem bom ânimo; não temas, nem te espantes.', reference: 'Josué 1:9' },
  { text: 'Tudo tem o seu tempo determinado, e há tempo para todo o propósito debaixo do céu.', reference: 'Eclesiastes 3:1' },
  { text: 'Os que esperam no Senhor renovarão as forças.', reference: 'Isaías 40:31' },
  { text: 'Combati o bom combate, acabei a carreira, guardei a fé.', reference: '2 Timóteo 4:7' },
  { text: 'Tudo quanto te vier à mão para fazer, faze-o conforme as tuas forças.', reference: 'Eclesiastes 9:10' },
  { text: 'Porque Deus não nos deu o espírito de temor, mas de fortaleza.', reference: '2 Timóteo 1:7' },
  { text: 'O propósito do homem prudente é o conhecimento.', reference: 'Provérbios 18:15' },
  { text: 'Tudo o que fizerem, façam de todo o coração, como para o Senhor.', reference: 'Colossenses 3:23' },
  { text: 'Não te deixarei, nem te desampararei.', reference: 'Josué 1:5' },
  { text: 'Porque dele, e por ele, e para ele são todas as coisas.', reference: 'Romanos 11:36' },
  { text: 'Confia ao Senhor as tuas obras, e teus pensamentos serão estabelecidos.', reference: 'Provérbios 16:3' },
  { text: 'Sede fortes e corajosos; não temais.', reference: 'Deuteronômio 31:6' },
  { text: 'Melhor é o pouco com justiça do que a abundância de rendas com injustiça.', reference: 'Provérbios 16:8' },
  { text: 'O ferro com o ferro se aguça; assim o homem aguça o rosto do seu amigo.', reference: 'Provérbios 27:17' },
  { text: 'Aquele que anda em integridade anda seguro.', reference: 'Provérbios 10:9' },
  { text: 'Não te fatigues para enriqueceres; dá de mão à tua própria sabedoria.', reference: 'Provérbios 23:4' },
  { text: 'Tudo o que fizeres, faze-o com toda a tua força.', reference: 'Eclesiastes 9:10' },
];

const SOURCE = 'Domínio público (tradução clássica de Almeida)';

function dateSeed(dateStr) {
  let hash = 0;
  for (let i = 0; i < dateStr.length; i++) {
    hash = (hash * 31 + dateStr.charCodeAt(i)) >>> 0;
  }
  return hash;
}

function localDateKey(date, timeZone) {
  try {
    return new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(date);
  } catch {
    return date.toISOString().slice(0, 10);
  }
}

// Deterministic by date + timezone: same message all day, changes at local midnight.
export function pickInspiration({ preference = 'both', date = new Date(), timeZone } = {}) {
  if (preference === 'off') return null;
  const dateKey = localDateKey(date, timeZone);
  const seed = dateSeed(dateKey);

  let type = preference;
  if (preference === 'both') type = seed % 2 === 0 ? 'phrase' : 'verse';

  if (type === 'verse') {
    const v = VERSES[seed % VERSES.length];
    return { type: 'verse', text: v.text, reference: v.reference, source: SOURCE, lang: 'pt-BR' };
  }
  const text = PHRASES[seed % PHRASES.length];
  return { type: 'phrase', text, reference: null, source: 'Skeelo Evolution', lang: 'pt-BR' };
}
