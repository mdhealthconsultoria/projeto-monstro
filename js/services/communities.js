// All Supabase access for communities/desafios lives here — views never talk
// to supabaseClient directly for this feature, same separation as auth.js.
import { supabaseClient } from './supabaseClient.js';

function slugify(name) {
  const base = name.trim().toLowerCase()
    .normalize('NFD').replace(new RegExp('[\\u0300-\\u036f]', 'g'), '')
    .replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
  return `${base || 'comunidade'}-${Math.random().toString(36).slice(2, 7)}`;
}

async function requireUserId() {
  const { data } = await supabaseClient.auth.getSession();
  if (!data.session) throw new Error('Nenhuma sessão ativa.');
  return data.session.user.id;
}

function friendlyError(error, fallback) {
  if (!error) return new Error(fallback);
  if (!navigator.onLine) return new Error('Sem conexão. Verifique a internet e tente de novo.');
  if (/row-level security|permission denied/i.test(error.message || '')) {
    return new Error('Você não tem permissão para fazer isso.');
  }
  return new Error(error.message || fallback);
}

// Both public and private communities are discoverable by name/category —
// visibility only gates membership, posts and challenges, not the basic
// listing (name/description/member count aren't sensitive).
export async function searchCommunities(query = '', category = null) {
  let req = supabaseClient.from('communities').select('*').order('member_count', { ascending: false });
  if (query && query.trim()) req = req.ilike('name', `%${query.trim()}%`);
  if (category) req = req.eq('category', category);
  const { data, error } = await req.limit(40);
  if (error) throw friendlyError(error, 'Não foi possível buscar comunidades.');
  return data || [];
}

export async function getCommunity(id) {
  const { data, error } = await supabaseClient.from('communities').select('*').eq('id', id).maybeSingle();
  if (error) throw friendlyError(error, 'Não foi possível carregar a comunidade.');
  return data;
}

export async function myMembership(communityId) {
  const userId = await requireUserId();
  const { data, error } = await supabaseClient.from('community_members').select('*')
    .eq('community_id', communityId).eq('user_id', userId).maybeSingle();
  if (error) throw friendlyError(error, 'Não foi possível verificar sua participação.');
  return data;
}

export async function myCommunities() {
  const userId = await requireUserId();
  const { data, error } = await supabaseClient.from('community_members')
    .select('role, status, community:communities(*)')
    .eq('user_id', userId).eq('status', 'active');
  if (error) throw friendlyError(error, 'Não foi possível carregar suas comunidades.');
  return (data || []).filter(r => r.community);
}

export async function createCommunity({ name, description, category, visibility }) {
  if (!name || !name.trim()) throw new Error('Dê um nome à comunidade.');
  const userId = await requireUserId();
  const { data, error } = await supabaseClient.from('communities').insert({
    name: name.trim(),
    slug: slugify(name),
    description: (description || '').trim(),
    category: category || 'outro',
    visibility: visibility === 'private' ? 'private' : 'public',
    created_by: userId,
  }).select().single();
  if (error) throw friendlyError(error, 'Não foi possível criar a comunidade.');
  return data;
}

export async function joinCommunity(communityId) {
  const userId = await requireUserId();
  const community = await getCommunity(communityId);
  if (!community) throw new Error('Comunidade não encontrada.');
  const status = community.visibility === 'private' ? 'pending' : 'active';
  const { data, error } = await supabaseClient.from('community_members')
    .insert({ community_id: communityId, user_id: userId, role: 'member', status })
    .select().single();
  if (error) {
    if (/duplicate key/i.test(error.message || '')) throw new Error('Você já solicitou entrada nesta comunidade.');
    throw friendlyError(error, 'Não foi possível entrar na comunidade.');
  }
  return data;
}

export async function deleteCommunity(communityId) {
  const { error } = await supabaseClient.from('communities').delete().eq('id', communityId);
  if (error) throw friendlyError(error, 'Não foi possível excluir a comunidade.');
}

export async function leaveCommunity(communityId) {
  const userId = await requireUserId();
  const { error } = await supabaseClient.from('community_members')
    .delete().eq('community_id', communityId).eq('user_id', userId);
  if (error) throw friendlyError(error, 'Não foi possível sair da comunidade.');
}

export async function listPendingRequests(communityId) {
  const { data, error } = await supabaseClient.from('community_members')
    .select('*, profile:profiles(name, nickname)')
    .eq('community_id', communityId).eq('status', 'pending').order('joined_at', { ascending: true });
  if (error) throw friendlyError(error, 'Não foi possível carregar pedidos pendentes.');
  return data || [];
}

export async function listMembers(communityId) {
  const { data, error } = await supabaseClient.from('community_members')
    .select('*, profile:profiles(name, nickname)')
    .eq('community_id', communityId).eq('status', 'active').order('joined_at', { ascending: true });
  if (error) throw friendlyError(error, 'Não foi possível carregar os membros.');
  return data || [];
}

export async function approveMember(communityId, userId) {
  const { error } = await supabaseClient.from('community_members')
    .update({ status: 'active' }).eq('community_id', communityId).eq('user_id', userId);
  if (error) throw friendlyError(error, 'Não foi possível aprovar o pedido.');
}

export async function rejectMember(communityId, userId) {
  const { error } = await supabaseClient.from('community_members')
    .delete().eq('community_id', communityId).eq('user_id', userId);
  if (error) throw friendlyError(error, 'Não foi possível recusar o pedido.');
}

export async function removeMember(communityId, userId) {
  const { error } = await supabaseClient.from('community_members')
    .delete().eq('community_id', communityId).eq('user_id', userId);
  if (error) throw friendlyError(error, 'Não foi possível remover o membro.');
}

export async function setMemberRole(communityId, userId, role) {
  const { error } = await supabaseClient.from('community_members')
    .update({ role }).eq('community_id', communityId).eq('user_id', userId);
  if (error) throw friendlyError(error, 'Não foi possível alterar o papel do membro.');
}

export async function listPosts(communityId) {
  const { data, error } = await supabaseClient.from('community_posts')
    .select('*, profile:profiles(name, nickname)')
    .eq('community_id', communityId).order('created_at', { ascending: false }).limit(50);
  if (error) throw friendlyError(error, 'Não foi possível carregar o mural.');
  return data || [];
}

export async function createPost(communityId, body) {
  if (!body || !body.trim()) throw new Error('Escreva algo antes de publicar.');
  const userId = await requireUserId();
  const { data, error } = await supabaseClient.from('community_posts')
    .insert({ community_id: communityId, user_id: userId, body: body.trim() }).select().single();
  if (error) throw friendlyError(error, 'Não foi possível publicar.');
  return data;
}

export async function deletePost(postId) {
  const { error } = await supabaseClient.from('community_posts').delete().eq('id', postId);
  if (error) throw friendlyError(error, 'Não foi possível apagar a publicação.');
}

export async function listChallenges(communityId) {
  const { data, error } = await supabaseClient.from('challenges')
    .select('*').eq('community_id', communityId).order('starts_at', { ascending: false });
  if (error) throw friendlyError(error, 'Não foi possível carregar os desafios.');
  return data || [];
}

export async function getChallenge(id) {
  const { data, error } = await supabaseClient.from('challenges').select('*').eq('id', id).maybeSingle();
  if (error) throw friendlyError(error, 'Não foi possível carregar o desafio.');
  return data;
}

export async function createChallenge(communityId, { title, description, actionType, startsAt, endsAt, pointsPerAction, maxParticipants }) {
  if (!title || !title.trim()) throw new Error('Dê um título ao desafio.');
  if (!startsAt || !endsAt || new Date(endsAt) <= new Date(startsAt)) {
    throw new Error('A data de término precisa ser depois da data de início.');
  }
  const userId = await requireUserId();
  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  const { data, error } = await supabaseClient.from('challenges').insert({
    community_id: communityId,
    title: title.trim(),
    description: (description || '').trim(),
    action_type: actionType,
    starts_at: new Date(startsAt).toISOString(),
    ends_at: new Date(endsAt).toISOString(),
    timezone,
    points_per_action: Math.max(1, Number(pointsPerAction) || 10),
    max_participants: maxParticipants ? Number(maxParticipants) : null,
    created_by: userId,
  }).select().single();
  if (error) throw friendlyError(error, 'Não foi possível criar o desafio.');
  return data;
}

export async function currentUserId() {
  return requireUserId();
}

export async function myTodayScore(challengeId) {
  const userId = await requireUserId();
  const today = new Intl.DateTimeFormat('en-CA').format(new Date());
  const { data, error } = await supabaseClient.from('challenge_daily_scores').select('*')
    .eq('challenge_id', challengeId).eq('user_id', userId).eq('date', today).maybeSingle();
  if (error) throw friendlyError(error, 'Não foi possível verificar seu progresso de hoje.');
  return data;
}

export async function myParticipation(challengeId) {
  const userId = await requireUserId();
  const { data, error } = await supabaseClient.from('challenge_participants').select('*')
    .eq('challenge_id', challengeId).eq('user_id', userId).maybeSingle();
  if (error) throw friendlyError(error, 'Não foi possível verificar sua participação no desafio.');
  return data;
}

export async function joinChallenge(challengeId) {
  const userId = await requireUserId();
  const { data, error } = await supabaseClient.from('challenge_participants')
    .upsert({ challenge_id: challengeId, user_id: userId, status: 'active' }, { onConflict: 'challenge_id,user_id' })
    .select().single();
  if (error) throw friendlyError(error, 'Não foi possível entrar no desafio.');
  return data;
}

export async function leaveChallenge(challengeId) {
  const userId = await requireUserId();
  const { error } = await supabaseClient.from('challenge_participants')
    .update({ status: 'left' }).eq('challenge_id', challengeId).eq('user_id', userId);
  if (error) throw friendlyError(error, 'Não foi possível sair do desafio.');
}

// Only entry point that can write points — validated server-side (window,
// action type, fixed value, one-per-day) by record_challenge_action().
export async function recordChallengeAction(challengeId, actionType) {
  const { data, error } = await supabaseClient.rpc('record_challenge_action', {
    p_challenge_id: challengeId, p_action_type: actionType,
  });
  if (error) throw friendlyError(error, 'Não foi possível registrar seu progresso.');
  return data;
}

export async function getRanking(challengeId) {
  const { data, error } = await supabaseClient.from('challenge_daily_scores')
    .select('user_id, points, profile:profiles(nickname, name)')
    .eq('challenge_id', challengeId);
  if (error) throw friendlyError(error, 'Não foi possível carregar o ranking.');
  const totals = new Map();
  for (const row of (data || [])) {
    const key = row.user_id;
    const entry = totals.get(key) || { userId: key, points: 0, name: (row.profile && (row.profile.nickname || row.profile.name)) || 'Participante' };
    entry.points += row.points;
    totals.set(key, entry);
  }
  return [...totals.values()].sort((a, b) => b.points - a.points);
}
