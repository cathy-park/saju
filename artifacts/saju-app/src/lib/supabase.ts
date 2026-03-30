import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.warn("[supabase] Missing env vars: VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY - running in local-only mode");
}

const safeUrl = SUPABASE_URL || "https://placeholder.supabase.co";
const safeKey = SUPABASE_ANON_KEY || "placeholder-key";

export const supabase = createClient(safeUrl, safeKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true,
  },
});

export type SupabaseUser = Awaited<ReturnType<typeof supabase.auth.getUser>>["data"]["user"];
