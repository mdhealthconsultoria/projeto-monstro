// Local (device-only) auth implementation. No server exists yet — this
// protects the account on THIS device via a hashed password, but it is not
// server-verified identity. Swap this module for auth.supabase.js later
// without touching any view: same exported interface.
import { uid, todayISO } from '../utils.js';
import { hashPassword, verifyPassword } from './crypto.js';
import * as db from '../db.js';
import { clearStateForUser } from '../db.js';

const SESSION_KEY = 'skeelo_session_user_id';
const listeners = new Set();

function sanitize(account) {
  if (!account) return null;
  const { saltHex, hashHex, iterations, ...user } = account;
  return user;
}

function notify(user) {
  for (const fn of listeners) fn(user);
}

export function onAuthChange(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

function normalizeEmail(email) {
  return String(email || '').trim().toLowerCase();
}

export async function signUp({ name, nickname, email, password }) {
  const normalized = normalizeEmail(email);
  if (!name || !normalized || !password) throw new Error('Preencha nome, e-mail e senha.');
  if (password.length < 6) throw new Error('A senha precisa ter pelo menos 6 caracteres.');
  const existing = await db.getAccountByEmail(normalized);
  if (existing) throw new Error('Já existe uma conta com esse e-mail neste dispositivo.');

  const { saltHex, hashHex, iterations } = await hashPassword(password);
  const account = {
    id: uid(),
    name: name.trim(),
    nickname: (nickname || name).trim(),
    email: normalized,
    saltHex,
    hashHex,
    iterations,
    createdAt: todayISO(),
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
    onboardingComplete: false,
    preferences: {
      goal: null,
      inspiration: 'both', // 'phrase' | 'verse' | 'both' | 'off'
      reminderTime: null,
      privacy: { nickname: true, avatar: true, streak: true, level: true, xp: true, workoutsCompleted: true },
    },
  };
  await db.putAccount(account);
  localStorage.setItem(SESSION_KEY, account.id);
  const user = sanitize(account);
  notify(user);
  return { user };
}

export async function signIn({ email, password }) {
  const normalized = normalizeEmail(email);
  const account = await db.getAccountByEmail(normalized);
  if (!account) throw new Error('E-mail ou senha inválidos.');
  const ok = await verifyPassword(password, account);
  if (!ok) throw new Error('E-mail ou senha inválidos.');
  localStorage.setItem(SESSION_KEY, account.id);
  const user = sanitize(account);
  notify(user);
  return { user };
}

export function signOut() {
  localStorage.removeItem(SESSION_KEY);
  notify(null);
}

export async function getSession() {
  const userId = localStorage.getItem(SESSION_KEY);
  if (!userId) return null;
  const account = await db.getAccount(userId);
  if (!account) { localStorage.removeItem(SESSION_KEY); return null; }
  return { user: sanitize(account) };
}

export async function updateProfile(patch) {
  const userId = localStorage.getItem(SESSION_KEY);
  if (!userId) throw new Error('Nenhuma sessão ativa.');
  const account = await db.getAccount(userId);
  if (!account) throw new Error('Conta não encontrada.');
  const merged = { ...account, ...patch };
  if (patch.preferences) merged.preferences = { ...account.preferences, ...patch.preferences };
  if (patch.preferences && patch.preferences.privacy) {
    merged.preferences.privacy = { ...account.preferences.privacy, ...patch.preferences.privacy };
  }
  await db.putAccount(merged);
  const user = sanitize(merged);
  notify(user);
  return user;
}

export async function changePassword({ currentPassword, newPassword }) {
  const userId = localStorage.getItem(SESSION_KEY);
  if (!userId) throw new Error('Nenhuma sessão ativa.');
  const account = await db.getAccount(userId);
  const ok = await verifyPassword(currentPassword, account);
  if (!ok) throw new Error('Senha atual incorreta.');
  if (newPassword.length < 6) throw new Error('A nova senha precisa ter pelo menos 6 caracteres.');
  const { saltHex, hashHex, iterations } = await hashPassword(newPassword);
  await db.putAccount({ ...account, saltHex, hashHex, iterations });
}

export async function deleteAccount() {
  const userId = localStorage.getItem(SESSION_KEY);
  if (!userId) return;
  await clearStateForUser(userId);
  await db.deleteAccount(userId);
  signOut();
}

export async function exportUserData() {
  const userId = localStorage.getItem(SESSION_KEY);
  if (!userId) throw new Error('Nenhuma sessão ativa.');
  const account = await db.getAccount(userId);
  const state = await db.loadState(userId);
  return {
    exportedAt: todayISO(),
    profile: sanitize(account),
    appState: state,
  };
}

// ---- Migration: claim a legacy single-profile install (pre-auth version) ----
export async function hasLegacyData() {
  const legacy = await db.loadState('main');
  return !!(legacy && !legacy.migratedTo && legacy.days);
}

export async function claimLegacyData(userId) {
  const legacy = await db.loadState('main');
  if (!legacy || legacy.migratedTo || !legacy.days) return false;
  await db.saveState(userId, legacy);
  await db.saveState('main', { migratedTo: userId, migratedAt: todayISO() });
  const legacyPhotos = await db.getPhotosForUser(undefined);
  await Promise.all(legacyPhotos.map(p => db.addPhoto({ ...p, userId })));
  return true;
}
