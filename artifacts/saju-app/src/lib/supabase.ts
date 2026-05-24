import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.warn("[supabase] Missing env vars: VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY - running in local-only mode");
}

type SupabaseLike = ReturnType<typeof createClient>;

function createNoopSupabase(): SupabaseLike {
  // Minimal stub that prevents hard crashes when Supabase env/config is missing
  // or WebCrypto/PKCE features are unavailable on the current runtime.
  const err = () => Promise.reject(new Error("Supabase is not configured"));
  const noopAuth = {
    getSession: async () => ({ data: { session: null }, error: null }),
    onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => {} } } }),
    signInWithOAuth: async () => {},
    signOut: async () => {},
    exchangeCodeForSession: async () => ({ data: { session: null }, error: null }),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    getSessionFromUrl: async (_opts?: any) => ({ data: { session: null }, error: null }),
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return { auth: noopAuth, from: () => ({ select: err, upsert: err, delete: err, insert: err, eq: () => ({}) }) } as any;
}

export const supabase: SupabaseLike = (() => {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) return createNoopSupabase();
  try {
    return createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: {
        flowType: "pkce",
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: true,
      },
    });
  } catch (e) {
    console.warn("[supabase] Failed to initialize client; falling back to noop.", e);
    return createNoopSupabase();
  }
})();

export type SupabaseUser = Awaited<ReturnType<typeof supabase.auth.getUser>>["data"]["user"];
