// Thin wrapper around the global `supabase` UMD build (loaded via CDN script
// tag in index.html, before this module ever runs). Only the publishable
// key lives here — never the service_role/secret key.
//
// The client is created lazily (on first real use, not at module-evaluation
// time) so that a slow/blocked CDN script never crashes the whole app at
// import time — callers that already handle async errors (every auth.*
// function, store.pushToCloud) surface a clear message instead of a blank
// page.
import { SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY } from '../config.js';

let realClient = null;

function getClient() {
  if (!realClient) {
    if (!window.supabase) {
      throw new Error('Não foi possível carregar a conexão com o servidor. Verifique sua internet e recarregue a página.');
    }
    realClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
      // `cache: 'no-store'` only stops the browser's own cache from reusing a
      // byte-identical GET (e.g. re-reading a profile right after updating
      // it) — it does nothing about an intermediate CDN/edge cache in front
      // of the API, which only a request-header hint can influence. Send
      // both: this data is never safe to cache anywhere.
      //
      // IMPORTANT: `init.headers` here is a real `Headers` instance, not a
      // plain object — `{...init.headers}` silently drops every entry
      // (including the `apikey`/`Authorization` headers supabase-js sets),
      // which breaks auth with a confusing 401. Merge via `new Headers()`.
      global: {
        fetch: (input, init) => {
          const headers = new Headers((init && init.headers) || {});
          headers.set('Cache-Control', 'no-cache');
          headers.set('Pragma', 'no-cache');
          return fetch(input, { ...init, cache: 'no-store', headers });
        },
      },
    });
  }
  return realClient;
}

export const supabaseClient = new Proxy({}, {
  get(_target, prop) {
    return getClient()[prop];
  },
});
