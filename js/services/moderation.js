// Denúncias e bloqueio — ver supabase/migrations/0008_community_moderation.sql.
// Mesma separação das outras features: views nunca falam com supabaseClient
// direto, só por aqui.
import { supabaseClient } from './supabaseClient.js';

async function requireUserId() {
  const { data } = await supabaseClient.auth.getSession();
  if (!data.session) throw new Error('Nenhuma sessão ativa.');
  return data.session.user.id;
}

// A migration 0008 pode ainda não ter sido rodada nesta instância do
// Supabase — nesse caso a tabela não existe. Pra LEITURAS, isso deve
// degradar pra "nada aqui ainda" (mesmo espírito do photosCloud.js),
// não quebrar a tela inteira da comunidade pra todo mundo. Pra ESCRITAS
// (a pessoa clicou em algo esperando um resultado), mostra um aviso
// honesto em vez de deixar vazar o erro cru do Postgres.
function isMissingTable(error) {
  return !!error && (error.code === '42P01' || /relation .* does not exist|could not find the table|schema cache/i.test(error.message || ''));
}

function friendlyError(error, fallback) {
  if (!error) return new Error(fallback);
  if (isMissingTable(error)) return new Error('Essa função ainda não está disponível — em breve.');
  if (!navigator.onLine) return new Error('Sem conexão. Verifique a internet e tente de novo.');
  if (/row-level security|permission denied/i.test(error.message || '')) {
    return new Error('Você não tem permissão para fazer isso.');
  }
  return new Error(error.message || fallback);
}

// ---- Denúncias ----
export async function reportPost(communityId, postId, reason) {
  if (!reason || !reason.trim()) throw new Error('Descreva o motivo da denúncia.');
  const userId = await requireUserId();
  const { error } = await supabaseClient.from('community_reports').insert({
    community_id: communityId, reporter_id: userId,
    target_type: 'post', target_post_id: postId, reason: reason.trim(),
  });
  if (error) throw friendlyError(error, 'Não foi possível enviar a denúncia.');
}

export async function reportMember(communityId, targetUserId, reason) {
  if (!reason || !reason.trim()) throw new Error('Descreva o motivo da denúncia.');
  const userId = await requireUserId();
  const { error } = await supabaseClient.from('community_reports').insert({
    community_id: communityId, reporter_id: userId,
    target_type: 'member', target_user_id: targetUserId, reason: reason.trim(),
  });
  if (error) throw friendlyError(error, 'Não foi possível enviar a denúncia.');
}

// Só devolve algo pra quem for owner/admin/moderator da comunidade — RLS
// garante isso mesmo se a tela chamar por engano.
export async function listReports(communityId, status = 'pending') {
  const { data, error } = await supabaseClient.from('community_reports')
    .select('*, reporter:profiles!community_reports_reporter_profile_fkey(name, nickname), post:community_posts(body), target:profiles!community_reports_target_user_profile_fkey(name, nickname)')
    .eq('community_id', communityId).eq('status', status)
    .order('created_at', { ascending: false });
  if (error) { if (isMissingTable(error)) return []; throw friendlyError(error, 'Não foi possível carregar as denúncias.'); }
  return data || [];
}

export async function resolveReport(reportId, status) {
  const userId = await requireUserId();
  const { error } = await supabaseClient.from('community_reports')
    .update({ status, resolved_by: userId, resolved_at: new Date().toISOString() })
    .eq('id', reportId);
  if (error) throw friendlyError(error, 'Não foi possível atualizar a denúncia.');
}

// ---- Bloqueio ----
export async function myBlockedUsers() {
  const userId = await requireUserId();
  const { data, error } = await supabaseClient.from('blocked_users')
    .select('blocked_id, created_at, profile:profiles!blocked_users_blocked_profile_fkey(name, nickname)')
    .eq('blocker_id', userId);
  if (error) { if (isMissingTable(error)) return []; throw friendlyError(error, 'Não foi possível carregar sua lista de bloqueios.'); }
  return data || [];
}

export async function blockUser(targetUserId) {
  const userId = await requireUserId();
  if (userId === targetUserId) throw new Error('Você não pode bloquear a si mesmo.');
  const { error } = await supabaseClient.from('blocked_users')
    .insert({ blocker_id: userId, blocked_id: targetUserId });
  if (error) {
    if (/duplicate key/i.test(error.message || '')) return; // já bloqueado, silencioso
    throw friendlyError(error, 'Não foi possível bloquear.');
  }
}

export async function unblockUser(targetUserId) {
  const userId = await requireUserId();
  const { error } = await supabaseClient.from('blocked_users')
    .delete().eq('blocker_id', userId).eq('blocked_id', targetUserId);
  if (error) throw friendlyError(error, 'Não foi possível desbloquear.');
}
