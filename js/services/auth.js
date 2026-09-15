// Active auth implementation. Today this is the local (device-only) adapter;
// swapping to Supabase later means changing only this one line — every view
// imports from here, never from auth.local.js directly.
export * from './auth.local.js';
