// Real auth backed by Supabase. Same exported interface as auth.local.js —
// views never import either file directly, only auth.js.
import { supabaseClient } from './supabaseClient.js';
import { todayISO } from '../utils.js';
import * as legacy from './auth.local.js';

const listeners = new Set();

function notify(user) {
  for (const fn of listeners) fn(user);
}

export function onAuthChange(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

async function fetchProfile(userId, { retry = true } = {}) {
  const { data, error } = await supabaseClient.from('profiles').select('*').eq('id', userId).maybeSingle();
  if (error) throw error;
  if (!data && retry) {
    // The signup trigger runs server-side and is normally instant, but give
    // it one short retry in case of replication lag right after signUp().
    await new Promise(r => setTimeout(r, 500));
    return fetchProfile(userId, { retry: false });
  }
  return data;
}

function profileRowToUser(session, profile) {
  return {
    id: session.user.id,
    email: session.user.email,
    name: profile ? profile.name : '',
    nickname: profile ? profile.nickname : '',
    timezone: profile ? profile.timezone : (Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'),
    onboardingComplete: profile ? profile.onboarding_complete === true : false,
    preferences: (profile && profile.preferences && Object.keys(profile.preferences).length ? profile.preferences : null) || {
      goal: null, inspiration: 'both', reminderTime: null,
      privacy: { nickname: true, avatar: true, streak: true, level: true, xp: true, workoutsCompleted: true },
    },
  };
}

async function buildUser(session) {
  const profile = await fetchProfile(session.user.id);
  return profileRowToUser(session, profile);
}

export async function signUp({ name, nickname, email, password }) {
  if (!name || !email || !password) throw new Error('Preencha nome, e-mail e senha.');
  if (password.length < 6) throw new Error('A senha precisa ter pelo menos 6 caracteres.');
  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';

  const { data, error } = await supabaseClient.auth.signUp({
    email: email.trim().toLowerCase(),
    password,
    options: { data: { name: name.trim(), nickname: (nickname || name).trim(), timezone } },
  });
  if (error) throw new Error(translateAuthError(error));

  if (!data.session) {
    // Email confirmation is required before the account can log in.
    return { user: null, needsEmailConfirmation: true };
  }
  const user = await buildUser(data.session);
  notify(user);
  return { user };
}

export async function signIn({ email, password }) {
  const { data, error } = await supabaseClient.auth.signInWithPassword({ email: email.trim().toLowerCase(), password });
  if (error) throw new Error(translateAuthError(error));
  const user = await buildUser(data.session);
  notify(user);
  return { user };
}

export async function signOut() {
  await supabaseClient.auth.signOut();
  notify(null);
}

export async function getSession() {
  const { data } = await supabaseClient.auth.getSession();
  if (!data.session) return null;
  return { user: await buildUser(data.session) };
}

export async function updateProfile(patch) {
  const { data: sessionData } = await supabaseClient.auth.getSession();
  if (!sessionData.session) throw new Error('Nenhuma sessão ativa.');
  const userId = sessionData.session.user.id;

  const current = await fetchProfile(userId);
  const dbPatch = {};
  if (patch.name !== undefined) dbPatch.name = patch.name;
  if (patch.nickname !== undefined) dbPatch.nickname = patch.nickname;
  if (patch.onboardingComplete !== undefined) dbPatch.onboarding_complete = patch.onboardingComplete;
  if (patch.preferences) {
    const mergedPrefs = { ...(current && current.preferences), ...patch.preferences };
    if (patch.preferences.privacy) {
      mergedPrefs.privacy = { ...((current && current.preferences && current.preferences.privacy) || {}), ...patch.preferences.privacy };
    }
    dbPatch.preferences = mergedPrefs;
  }

  // .select().single() returns the row as written, in the very same response
  // as the write itself — this is the only read guaranteed to reflect this
  // write immediately, sidestepping whatever routes a plain follow-up GET
  // through (proxy/edge layers a client can't see or control).
  const { data: updatedRow, error } = await supabaseClient.from('profiles').update(dbPatch).eq('id', userId).select().single();
  if (error) throw new Error(error.message);

  const user = profileRowToUser(sessionData.session, updatedRow);
  notify(user);
  return user;
}

export async function changePassword({ currentPassword, newPassword }) {
  const { data: sessionData } = await supabaseClient.auth.getSession();
  if (!sessionData.session) throw new Error('Nenhuma sessão ativa.');
  if (newPassword.length < 6) throw new Error('A nova senha precisa ter pelo menos 6 caracteres.');

  const email = sessionData.session.user.email;
  const { error: verifyError } = await supabaseClient.auth.signInWithPassword({ email, password: currentPassword });
  if (verifyError) throw new Error('Senha atual incorreta.');

  const { error } = await supabaseClient.auth.updateUser({ password: newPassword });
  if (error) throw new Error(error.message);
}

export async function requestPasswordReset(email) {
  const { error } = await supabaseClient.auth.resetPasswordForEmail(email.trim().toLowerCase(), {
    redirectTo: window.location.origin + window.location.pathname,
  });
  if (error) throw new Error(error.message);
}

export async function deleteAccount() {
  const { data: sessionData } = await supabaseClient.auth.getSession();
  if (!sessionData.session) return;
  const userId = sessionData.session.user.id;
  // Removing the auth.users row itself requires an admin/service-role call,
  // which only a server-side function can safely do — not built yet. For now
  // this clears all of the user's own data (allowed by RLS) and signs out.
  await supabaseClient.from('user_app_state').delete().eq('user_id', userId);
  await supabaseClient.from('profiles').delete().eq('id', userId);
  await signOut();
}

export async function exportUserData() {
  const { data: sessionData } = await supabaseClient.auth.getSession();
  if (!sessionData.session) throw new Error('Nenhuma sessão ativa.');
  const userId = sessionData.session.user.id;
  const profile = await fetchProfile(userId);
  const { data: stateRow } = await supabaseClient.from('user_app_state').select('state').eq('user_id', userId).maybeSingle();
  return {
    exportedAt: todayISO(),
    profile,
    appState: stateRow ? stateRow.state : null,
  };
}

// Legacy local data (from before any account existed) is still checked and
// claimed from the browser's own IndexedDB — independent of which auth
// backend is active — and, once claimed, also pushed up to Supabase.
export const hasLegacyData = legacy.hasLegacyData;

export async function claimLegacyData(userId) {
  const claimed = await legacy.claimLegacyData(userId);
  if (!claimed) return false;
  const { loadState } = await import('../db.js');
  const state = await loadState(userId);
  if (state) {
    await supabaseClient.from('user_app_state').upsert({ user_id: userId, state }, { onConflict: 'user_id' });
  }
  return true;
}

function translateAuthError(error) {
  const msg = (error && error.message) || '';
  if (/already registered|already exists/i.test(msg)) return 'Já existe uma conta com esse e-mail.';
  if (/invalid login credentials/i.test(msg)) return 'E-mail ou senha inválidos.';
  if (/email not confirmed/i.test(msg)) return 'Confirme seu e-mail antes de entrar — verifique sua caixa de entrada.';
  return msg || 'Não foi possível completar a operação.';
}
