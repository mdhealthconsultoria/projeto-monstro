// Sincronização de fotos de evolução com o Supabase Storage (bucket privado
// "evolution-photos", ver supabase/migrations/0007_evolution_photos_storage.sql).
// Toda chamada aqui é "melhor esforço": se o bucket ainda não existir nesta
// instância do Supabase (migration ainda não rodada), a chamada falha
// silenciosamente e o app continua funcionando 100% local, como sempre
// funcionou — nunca trava nem mostra erro pro usuário por causa disso.
import { supabaseClient } from './supabaseClient.js';

const BUCKET = 'evolution-photos';

function objectPath(userId, day, category) {
  return `${userId}/${day}-${category}`;
}

// Chamadas de rede aqui são todas "melhor esforço, silencioso" por design —
// isso só vale a pena se elas NUNCA prenderem a UI esperando resposta. Um
// timeout curto garante isso mesmo se a rede/host ficar sem responder (já
// aconteceu neste ambiente com outro host externo).
function withTimeout(promise, ms = 8000) {
  return Promise.race([
    promise,
    new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), ms)),
  ]);
}

export async function uploadPhotoCloud(userId, day, category, blob) {
  try {
    const { error } = await withTimeout(supabaseClient.storage
      .from(BUCKET)
      .upload(objectPath(userId, day, category), blob, { upsert: true, contentType: blob.type || 'image/jpeg' }));
    if (error) throw error;
    return true;
  } catch (err) {
    console.error('Falha ao sincronizar foto com a nuvem (fica só local por enquanto)', err);
    return false;
  }
}

export async function deletePhotoCloud(userId, day, category) {
  try {
    const { error } = await withTimeout(supabaseClient.storage.from(BUCKET).remove([objectPath(userId, day, category)]));
    if (error) throw error;
    return true;
  } catch (err) {
    console.error('Falha ao remover foto da nuvem', err);
    return false;
  }
}

// URL assinada de curta duração (bucket é privado) — null se não existir
// ainda ou se o bucket não estiver disponível.
export async function getSignedPhotoUrl(userId, day, category) {
  try {
    const { data, error } = await withTimeout(supabaseClient.storage
      .from(BUCKET)
      .createSignedUrl(objectPath(userId, day, category), 3600));
    if (error || !data) return null;
    return data.signedUrl;
  } catch {
    return null;
  }
}

// Baixa o arquivo como Blob (pra cachear localmente no IndexedDB após
// restaurar num aparelho novo). null se não existir.
export async function downloadPhotoCloud(userId, day, category) {
  try {
    const { data, error } = await withTimeout(supabaseClient.storage.from(BUCKET).download(objectPath(userId, day, category)));
    if (error || !data) return null;
    return data;
  } catch {
    return null;
  }
}

// Apaga todos os arquivos do usuário (usado em "Apagar todos os dados" e
// "Excluir conta") — sem isso, arquivos privados ficariam órfãos no bucket
// (inacessíveis pra sempre depois da conta apagada, mas ainda ocupando
// espaço e representando dado pessoal que deveria ter sido removido).
export async function deleteAllPhotosCloud(userId) {
  try {
    const { data: files, error: listError } = await withTimeout(supabaseClient.storage.from(BUCKET).list(userId));
    if (listError || !files || !files.length) return;
    const paths = files.map(f => `${userId}/${f.name}`);
    await withTimeout(supabaseClient.storage.from(BUCKET).remove(paths));
  } catch (err) {
    console.error('Falha ao apagar fotos da nuvem', err);
  }
}
