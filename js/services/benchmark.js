// Comparação anônima com pessoas da mesma faixa etária — ver
// supabase/migrations/0009_benchmark.sql. Melhor esforço, silencioso: se a
// migration ainda não tiver rodado, nada disso quebra o app (mesmo espírito
// de photosCloud.js/moderation.js).
import { supabaseClient } from './supabaseClient.js';

const BRACKETS = [
  { min: 18, max: 24, key: '18-24' },
  { min: 25, max: 34, key: '25-34' },
  { min: 35, max: 44, key: '35-44' },
  { min: 45, max: 54, key: '45-54' },
  { min: 55, max: 64, key: '55-64' },
  { min: 65, max: Infinity, key: '65+' },
];

// null = idade desconhecida ou fora de uma faixa plausível — nunca inventa.
export function ageBracketForBirthYear(birthYear, now = new Date()) {
  if (!birthYear) return null;
  const age = now.getFullYear() - birthYear;
  if (age < 18 || age > 120) return null;
  const bracket = BRACKETS.find(b => age >= b.min && age <= b.max);
  return bracket ? bracket.key : null;
}

function isMissingTable(error) {
  return !!error && (error.code === '42P01' || /relation .* does not exist|could not find the table|schema cache|could not find the function/i.test(error.message || ''));
}

// Chamado a partir do fluxo normal de sincronização (store.pushToCloud) — só
// envia se o usuário informou o ano de nascimento e tem pelo menos uma área
// ativa (um score 0 por não ter configurado nada ainda distorceria a média).
export async function syncMyBenchmarkStats(userId, birthYear, montroScore, hasActiveAreas) {
  if (!userId || !hasActiveAreas) return;
  const ageBracket = ageBracketForBirthYear(birthYear);
  if (!ageBracket) return;
  try {
    await supabaseClient.from('benchmark_stats').upsert(
      { user_id: userId, age_bracket: ageBracket, montro_score: montroScore, updated_at: new Date().toISOString() },
      { onConflict: 'user_id' }
    );
  } catch (err) {
    if (!isMissingTable(err)) console.error('Falha ao sincronizar benchmark anônimo', err);
  }
}

// { available: false, sampleSize } | { available: true, sampleSize, average } | null (indisponível/erro)
export async function getMontroBenchmark(ageBracket) {
  if (!ageBracket) return null;
  try {
    const { data, error } = await supabaseClient.rpc('montro_score_benchmark', { p_age_bracket: ageBracket });
    if (error) { if (isMissingTable(error)) return null; throw error; }
    return data;
  } catch {
    return null;
  }
}
