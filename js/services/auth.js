// Active auth implementation. Now backed by Supabase (real accounts, synced
// across devices). Every view imports from here, never from auth.local.js
// or auth.supabase.js directly, so this is the only line that changes when
// swapping backends.
export * from './auth.supabase.js';
