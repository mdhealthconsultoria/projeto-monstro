// Registra que uma entrada foi removida de um mapa/lista, com a hora exata.
// Sem isso, o merge de conflito (js/merge.js) só sabe UNIR os dois lados de
// um mapa — e uma remoção feita num aparelho "ressuscitaria" se o outro
// ainda tiver a mesma chave quando os dois sincronizam. Toda deleção REAL
// (não um flag tipo `archived`/`active`, que já é só um campo e se resolve
// sozinho no merge) nas coleções habitCheckins, dailyTaskCompletions,
// knowledgeItems, days e healthProfile.measurements precisa chamar isto
// dentro do mesmo store.mutate() que faz a remoção.
export function markDeleted(state, collection, key) {
  if (!state.tombstones) state.tombstones = {};
  if (!state.tombstones[collection]) state.tombstones[collection] = {};
  state.tombstones[collection][key] = new Date().toISOString();
}
