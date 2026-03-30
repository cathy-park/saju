import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { supabase, type SupabaseUser } from "./supabase";
import type { Session } from "@supabase/supabase-js";
import {
  fetchMyProfile,
  fetchPartnerProfiles,
  upsertMyProfile,
  upsertPartnerProfile,
  upsertUserProfile,
} from "./db";
import {
  load as loadLocal,
  saveMyProfile,
  savePerson,
} from "./storage";

interface AuthState {
  user: SupabaseUser | null;
  session: Session | null;
  loading: boolean;
  /** true after the DB → localStorage sync completes for the current user */
  dbSynced: boolean;
  signInWithGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthState>({
  user: null,
  session: null,
  loading: true,
  dbSynced: false,
  signInWithGoogle: async () => {},
  signOut: async () => {},
});

/**
 * Smart bidirectional sync on every login:
 *
 *  1. Mirror auth.users → profiles table
 *  2. Fetch current DB state for this user
 *  3. If DB is missing a record that exists locally → push it up (handles
 *     cases where a previous migration was skipped or failed silently)
 *  4. Pull the final DB state → overwrite localStorage (DB is source of truth)
 */
async function syncWithSupabase(uid: string, userMeta: SupabaseUser): Promise<void> {
  // 1. Mirror auth user metadata
  await upsertUserProfile({
    id: uid,
    email: userMeta.email,
    user_metadata: userMeta.user_metadata as Record<string, unknown>,
  });

  // 2. Fetch current DB state
  const [dbProfile, dbPartners] = await Promise.all([
    fetchMyProfile(uid),
    fetchPartnerProfiles(uid),
  ]);

  // 3. Push local-only data up to DB (fills gaps from failed/skipped migrations)
  const local = loadLocal();

  if (!dbProfile && local.myProfile) {
    console.log("[auth] pushing local myProfile to Supabase");
    await upsertMyProfile(uid, local.myProfile);
  }

  const dbPartnerIds = new Set(dbPartners.map((p) => p.id));
  const localOnlyPartners = local.people.filter((p) => !dbPartnerIds.has(p.id));
  if (localOnlyPartners.length > 0) {
    console.log(`[auth] pushing ${localOnlyPartners.length} local partner(s) to Supabase`);
    await Promise.all(localOnlyPartners.map((p) => upsertPartnerProfile(uid, p)));
  }

  // 4. Pull final DB state → overwrite localStorage (DB wins)
  const [finalProfile, finalPartners] = await Promise.all([
    fetchMyProfile(uid),
    fetchPartnerProfiles(uid),
  ]);

  if (finalProfile) {
    saveMyProfile(finalProfile);
    console.log("[auth] synced myProfile from Supabase");
  }
  for (const p of finalPartners) {
    savePerson(p);
  }
  if (finalPartners.length > 0) {
    console.log(`[auth] synced ${finalPartners.length} partner(s) from Supabase`);
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<SupabaseUser | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [dbSynced, setDbSynced] = useState(false);

  useEffect(() => {
    if (!user) { setDbSynced(false); return; }

    setDbSynced(false);

    syncWithSupabase(user.id, user)
      .catch((err) => console.warn("[auth] DB sync error:", err))
      .finally(() => setDbSynced(true));
  }, [user?.id]);  // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const signInWithGoogle = async () => {
    const redirectTo = `${window.location.origin}/auth/callback`;
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo, queryParams: { prompt: "select_account" } },
    });
  };

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  return (
    <AuthContext.Provider value={{ user, session, loading, dbSynced, signInWithGoogle, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
