// Merge de dois snapshots de state (local vs. remoto) depois de um conflito
// de revisão em user_app_state (ver js/store.js#pushWithRetry). Três regras,
// cada uma resolvendo um jeito diferente de perder dado:
//
// 1) Objeto plano (mapa por chave: habits, habitCheckins, knowledgeItems,
//    days, dailyTaskCompletions, ou um registro aninhado como healthProfile)
//    é mesclado chave a chave, recursivamente — uma chave presente só de um
//    lado é sempre preservada.
// 2) Array: a decisão depende do CAMPO (não dá pra tratar todo array igual):
//    - Campo marcado como conjunto de verdade (SET_FIELDS, ver abaixo): união
//      sem duplicata. Existem poucos casos assim no schema e são
//      explicitamente declarados aqui — nunca por inferência.
//    - Itens com `id` estável (dailyTasks, healthProfile.measurements,
//      focus.sessions, etc.): união por id, em empate vence o mais recente.
//    - Qualquer outro array (ex. exercises.pushups.sets — um array
//      POSICIONAL de 5 séries, onde a posição É o número da série) é tratado
//      como um valor atômico: a lista INTEIRA de um lado vence, nunca union
//      elemento a elemento. Um merge por união aqui corrompe dado de verdade
//      — [10,10,10,8,8] virando [10,8] (achatado por "deduplicação" de
//      valores repetidos) é exatamente esse bug.
// 3) Tombstones: um mapa só sabe UNIR as duas chaves — uma remoção (chave
//    apagada de um lado) "ressuscitaria" se o outro lado ainda tiver a
//    mesma chave. js/tombstones.js grava quando algo foi apagado; aqui, depois
//    do merge genérico, qualquer chave com tombstone mais recente que o
//    próprio registro sobrevivente é removida de novo (a não ser que o
//    registro tenha sido recriado DEPOIS do tombstone, aí ele vence).
const SET_FIELDS = new Set(['activeAreas', 'appliedIds', 'daysOfWeek']);

const TOMBSTONE_MAP_COLLECTIONS = new Set(['habitCheckins', 'dailyTaskCompletions', 'knowledgeItems', 'days']);

// Coleções-array com tombstone não vivem na raiz do state — precisam saber
// onde achar o pai pra reescrever o array filtrado.
const ARRAY_TOMBSTONE_PARENTS = {
  measurements: state => state.healthProfile,
};

export function mergeStates(local, remote) {
  const localNewer = toTime(local && local.lastModifiedAt) >= toTime(remote && remote.lastModifiedAt);
  const tombstones = mergeTombstones(local && local.tombstones, remote && remote.tombstones);
  const merged = mergeValue(local, remote, localNewer, []);
  merged.tombstones = tombstones;
  return applyTombstones(merged, tombstones);
}

function toTime(iso) {
  return iso ? new Date(iso).getTime() : 0;
}

function isPlainObject(v) {
  return v !== null && typeof v === 'object' && !Array.isArray(v);
}

// Timestamp de um REGISTRO (objeto com algum campo de data) ou de um valor
// que é, ele mesmo, uma string de data (ex. dailyTaskCompletions[key], que
// guarda só o ISO do momento do check-in, não um objeto).
function recordTimestamp(value) {
  if (typeof value === 'string') return toTime(value);
  if (!value || typeof value !== 'object') return 0;
  return toTime(value.updatedAt || value.completedAt || value.createdAt || value.date || value.startedAt);
}

function mergeTombstones(a, b) {
  const out = {};
  for (const collection of new Set([...Object.keys(a || {}), ...Object.keys(b || {})])) {
    out[collection] = {};
    const ca = (a && a[collection]) || {};
    const cb = (b && b[collection]) || {};
    for (const key of new Set([...Object.keys(ca), ...Object.keys(cb)])) {
      out[collection][key] = toTime(ca[key]) >= toTime(cb[key]) ? ca[key] : cb[key];
    }
  }
  return out;
}

// Pós-processamento: remove do resultado qualquer entrada cujo tombstone
// seja mais recente que o próprio registro. Roda DEPOIS do merge genérico
// (que já uniu os mapas/arrays normalmente).
function applyTombstones(state, tombstones) {
  for (const collection of TOMBSTONE_MAP_COLLECTIONS) {
    const map = state[collection];
    const stones = tombstones[collection];
    if (!map || !stones) continue;
    for (const key of Object.keys(stones)) {
      if (key in map && toTime(stones[key]) >= recordTimestamp(map[key])) delete map[key];
    }
  }
  for (const [collection, getParent] of Object.entries(ARRAY_TOMBSTONE_PARENTS)) {
    const parent = getParent(state);
    const stones = tombstones[collection];
    if (!parent || !Array.isArray(parent[collection]) || !stones) continue;
    parent[collection] = parent[collection].filter(item => {
      if (!item || !(item.id in stones)) return true;
      return recordTimestamp(item) > toTime(stones[item.id]);
    });
  }
  return state;
}

function mergeValue(a, b, aIsNewer, path) {
  if (a === undefined) return b;
  if (b === undefined) return a;
  if (Array.isArray(a) && Array.isArray(b)) return mergeArray(a, b, aIsNewer, path);
  if (isPlainObject(a) && isPlainObject(b)) return mergeObject(a, b, aIsNewer, path);
  return aIsNewer ? a : b;
}

function mergeObject(a, b, aIsNewer, path) {
  const out = {};
  for (const key of new Set([...Object.keys(a), ...Object.keys(b)])) {
    // tombstones é tratado à parte (mergeTombstones), com regra própria
    // (vence o timestamp mais recente por chave, não "o lado mais novo
    // como um todo") — não deixa o merge genérico duplicar isso aqui.
    if (key === 'tombstones' && path.length === 0) continue;
    out[key] = mergeValue(a[key], b[key], aIsNewer, path.concat(key));
  }
  return out;
}

function fieldNameFor(path) {
  return path[path.length - 1];
}

function hasStableId(items) {
  return items.some(item => item && typeof item === 'object' && 'id' in item);
}

function mergeArray(a, b, aIsNewer, path) {
  const field = fieldNameFor(path);

  if (SET_FIELDS.has(field)) {
    const seen = new Set(a);
    const out = [...a];
    for (const v of b) if (!seen.has(v)) { out.push(v); seen.add(v); }
    return out;
  }

  if (hasStableId(a) || hasStableId(b)) {
    const map = new Map();
    for (const item of a) if (item && typeof item === 'object' && 'id' in item) map.set(item.id, item);
    for (const item of b) {
      if (!item || typeof item !== 'object' || !('id' in item)) continue;
      const existing = map.get(item.id);
      map.set(item.id, !existing || recordTimestamp(item) >= recordTimestamp(existing) ? item : existing);
    }
    return [...map.values()];
  }

  // Lista posicional — a posição é significado (índice da série, por
  // exemplo), não um conjunto. Tratar como valor atômico: vence o lado mais
  // recente por inteiro, igual um escalar.
  return aIsNewer ? a : b;
}
