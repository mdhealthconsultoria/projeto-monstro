// Dá um id determinístico (derivado do próprio conteúdo) a itens legados de
// arrays que não tinham `id` antes do merge de conflito existir — sem isso,
// js/merge.js não tem como saber que o MESMO registro visto em dois
// aparelhos é o mesmo item, e trataria o array inteiro como atômico,
// descartando a união real (ver aprendizado: um usuário antigo com 20
// sessões sem id + 1 sessão nova com id perdia as 20 no merge, porque
// qualquer item com id ligava o caminho de união por id, que pulava quem
// não tinha id em vez de preservar).
//
// Determinístico = dois aparelhos migrando o MESMO registro (mesmo
// conteúdo) geram o MESMO id — senão a migração em si criaria uma
// duplicata nova a cada aparelho.
function contentId(value) {
  const str = JSON.stringify(value);
  let hash = 0x811c9dc5; // FNV-1a, 32 bits
  for (let i = 0; i < str.length; i++) {
    hash ^= str.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return `legacy-${(hash >>> 0).toString(36)}`;
}

function backfillIds(items) {
  if (!Array.isArray(items)) return;
  for (const item of items) {
    if (item && typeof item === 'object' && !('id' in item)) {
      item.id = contentId(item);
    }
  }
}

// Roda em todo load (loadForUser) e dentro de mergeStates — idempotente:
// um item que já tem id nunca é tocado de novo.
export function migrateState(state) {
  if (!state) return state;
  if (state.focus) backfillIds(state.focus.sessions);
  if (state.breathing) backfillIds(state.breathing.sessions);
  if (state.knowledgeItems) {
    for (const item of Object.values(state.knowledgeItems)) backfillIds(item.sessions);
  }
  if (state.bodyMetrics) backfillIds(state.bodyMetrics.weights);
  return state;
}
