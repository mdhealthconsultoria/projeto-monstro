// All admin-dashboard access lives here. Every underlying call is a
// security-definer RPC that re-checks is_platform_admin() on the server —
// nothing here is a real security boundary by itself, it's just plumbing.
import { supabaseClient } from './supabaseClient.js';

export async function amIAdmin() {
  const { data, error } = await supabaseClient.rpc('is_platform_admin');
  if (error) return false;
  return !!data;
}

export async function overviewStats() {
  const { data, error } = await supabaseClient.rpc('admin_overview_stats');
  if (error) throw new Error(error.message || 'Não foi possível carregar a visão geral.');
  return data;
}

export async function insights() {
  const { data, error } = await supabaseClient.rpc('admin_insights');
  if (error) throw new Error(error.message || 'Não foi possível carregar os insights.');
  return data;
}

export async function searchUsers(query = '') {
  const { data, error } = await supabaseClient.rpc('admin_search_users', { p_query: query });
  if (error) throw new Error(error.message || 'Não foi possível buscar usuários.');
  return data || [];
}

export async function setUserSuspended(userId, suspended) {
  const { error } = await supabaseClient.rpc('admin_set_user_suspended', { p_user_id: userId, p_suspended: suspended });
  if (error) throw new Error(error.message || 'Não foi possível atualizar o usuário.');
}
