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
import { toast } from "@/hooks/use-toast";

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
 *  3. If DB is missing a record that exists locally → push it up
 *  4. Pull the final DB state → overwrite localStorage (DB is source of truth)
 *
 * Each step is isolated so one failure doesn't block the rest.
 */
async function syncWithSupabase(uid: string, userMeta: SupabaseUser): Promise<void> {
  const errors: string[] = [];

  // 1. Mirror auth user metadata (best-effort)
  try {
    await upsertUserProfile({
      id: uid,
      email: userMeta.email,
      user_metadata: userMeta.user_metadata as Record<string, unknown>,
    });
  } catch (e) {
    console.warn("[auth] upsertUserProfile failed:", e);
  }

  // 2. Fetch current DB state
  let dbProfile: Awaited<ReturnType<typeof fetchMyProfile>> = null;
  let dbPartners: Awaited<ReturnType<typeof fetchPartnerProfiles>> = [];
  try {
    [dbProfile, dbPartners] = await Promise.all([
      fetchMyProfile(uid),
      fetchPartnerProfiles(uid),
    ]);
    console.log("[auth] DB fetch: profile=", dbProfile ? "✓" : "none", "partners=", dbPartners.length);
  } catch (e) {
    console.error("[auth] DB fetch failed:", e);
    errors.push("데이터 불러오기 실패");
  }

  // 3. Push local-only data up to DB (fills gaps from failed/skipped migrations)
  const local = loadLocal();

  if (!dbProfile && local.myProfile) {
    console.log("[auth] pushing local myProfile to Supabase");
    try {
      await upsertMyProfile(uid, local.myProfile);
    } catch (e) {
      const msg = (e as Error)?.message ?? "알 수 없는 오류";
      console.error("[auth] push myProfile failed:", msg);
      errors.push(`내 사주 저장 실패 (${msg.substring(0, 80)})`);
    }
  }

  const dbPartnerIds = new Set(dbPartners.map((p) => p.id));
  const localOnlyPartners = local.people.filter((p) => !dbPartnerIds.has(p.id));
  if (localOnlyPartners.length > 0) {
    console.log(`[auth] pushing ${localOnlyPartners.length} local partner(s) to Supabase`);
    const results = await Promise.allSettled(
      localOnlyPartners.map((p) => upsertPartnerProfile(uid, p))
    );
    const failed = results.filter((r) => r.status === "rejected");
    if (failed.length > 0) {
      const failMsgs = failed.map((r) => (r as PromiseRejectedResult).reason?.message ?? "?").join("; ");
      console.error("[auth] push partners failed:", failMsgs);
      errors.push(`상대 저장 실패 (${failMsgs.substring(0, 80)})`);
    }
  }

  // 4. Pull final DB state → overwrite localStorage (DB wins)
  try {
    const [finalProfile, finalPartners] = await Promise.all([
      fetchMyProfile(uid),
      fetchPartnerProfiles(uid),
    ]);

    if (finalProfile) {
      saveMyProfile(finalProfile);
      console.log("[auth] synced myProfile from Supabase ✓");
    }
    for (const p of finalPartners) {
      savePerson(p);
    }
    if (finalPartners.length > 0) {
      console.log(`[auth] synced ${finalPartners.length} partner(s) from Supabase ✓`);
    }
  } catch (e) {
    console.error("[auth] final DB pull failed:", e);
    errors.push("동기화 마무리 실패");
  }

  if (errors.length > 0) {
    toast({
      title: "클라우드 동기화 오류",
      description: errors.join(" · "),
      variant: "destructive",
    });
    throw new Error(errors.join(", "));
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
      .catch((err) => console.warn("[auth] sync completed with errors:", err))
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
