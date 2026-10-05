// Merge de dois snapshots de state (local vs. remoto) depois de um conflito
// de revisão em user_app_state (ver js/store.js#pushToCloud). Política:
//
// - Objeto plano (mapa por chave: habits, habitCheckins, knowledgeItems,
//   days, dailyTaskCompletions, ou um registro aninhado como healthProfile)
//   é mesclado chave a chave, recursivamente — uma chave presente só de um
//   lado é sempre preservada.
// - Array é mesclado por "identidade de registro": objetos com `id` são
//   deduplicados por id (em empate, vence o de timestamp mais recente,
//   olhando updatedAt/completedAt/createdAt/date do próprio registro);
//   valores primitivos (ex. activeAreas, businessConcepts.appliedIds) viram
//   união sem duplicata, pelo mesmo mecanismo.
// - Valor escalar (string/number/boolean/null) em conflito nos dois lados:
//   vence o lado do snapshot inteiro com `lastModifiedAt` mais recente.
//
// Isso é deliberadamente genérico (não conhece os nomes dos campos) — o
// schema do blob cresce a cada fase, e uma lista hardcoded de "quais campos
// são mapas vs. listas" apodreceria rápido.
export function mergeStates(local, remote) {
  const localNewer = toTime(local && local.lastModifiedAt) >= toTime(remote && remote.lastModifiedAt);
  return mergeValue(local, remote, localNewer);
}

function toTime(iso) {
  return iso ? new Date(iso).getTime() : 0;
}

function isPlainObject(v) {
  return v !== null && typeof v === 'object' && !Array.isArray(v);
}

function mergeValue(a, b, aIsNewer) {
  if (a === undefined) return b;
  if (b === undefined) return a;
  if (Array.isArray(a) && Array.isArray(b)) return mergeArray(a, b);
  if (isPlainObject(a) && isPlainObject(b)) return mergeObject(a, b, aIsNewer);
  return aIsNewer ? a : b;
}

function mergeObject(a, b, aIsNewer) {
  const out = {};
  for (const key of new Set([...Object.keys(a), ...Object.keys(b)])) {
    out[key] = mergeValue(a[key], b[key], aIsNewer);
  }
  return out;
}

function recordKey(item) {
  if (item && typeof item === 'object' && 'id' in item) return item.id;
  return JSON.stringify(item);
}

function recordTimestamp(item) {
  if (!item || typeof item !== 'object') return 0;
  return toTime(item.updatedAt || item.completedAt || item.createdAt || item.date);
}

function mergeArray(a, b) {
  const map = new Map();
  for (const item of a) map.set(recordKey(item), item);
  for (const item of b) {
    const key = recordKey(item);
    const existing = map.get(key);
    if (existing === undefined) { map.set(key, item); continue; }
    map.set(key, recordTimestamp(item) >= recordTimestamp(existing) ? item : existing);
  }
  return [...map.values()];
}
