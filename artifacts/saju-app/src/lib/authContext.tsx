import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { supabase, type SupabaseUser } from "./supabase";
import type { Session } from "@supabase/supabase-js";
import {
  fetchMyProfile,
  fetchPartnerProfiles,
  migrateLocalToSupabase,
  upsertUserProfile,
} from "./db";
import { saveMyProfile, savePerson } from "./storage";

interface AuthState {
  user: SupabaseUser | null;
  session: Session | null;
  loading: boolean;
  /** true after the first DB → localStorage sync completes for the current user */
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

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<SupabaseUser | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [dbSynced, setDbSynced] = useState(false);

  // ── Sync DB → localStorage whenever the logged-in user changes ──
  useEffect(() => {
    if (!user) { setDbSynced(false); return; }

    setDbSynced(false);
    const uid = user.id;

    (async () => {
      try {
        // 1. Mirror auth.users → profiles table
        await upsertUserProfile({
          id: uid,
          email: user.email,
          user_metadata: user.user_metadata as Record<string, unknown>,
        });

        // 2. Push any local-only data up to Supabase (one-time migration)
        await migrateLocalToSupabase(uid);

        // 3. Pull latest profile from DB → overwrite localStorage
        const [dbProfile, dbPartners] = await Promise.all([
          fetchMyProfile(uid),
          fetchPartnerProfiles(uid),
        ]);
        if (dbProfile) saveMyProfile(dbProfile);
        for (const p of dbPartners) savePerson(p);
      } catch (err) {
        console.warn("[auth] DB sync error:", err);
      } finally {
        setDbSynced(true);
      }
    })();
  }, [user?.id]);   // eslint-disable-line react-hooks/exhaustive-deps

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
