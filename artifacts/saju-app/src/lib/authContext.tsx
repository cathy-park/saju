import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { supabase, type SupabaseUser } from "./supabase";
import type { Session } from "@supabase/supabase-js";
import {
  fetchMyProfile,
  fetchPartnerProfiles,
  upsertMyProfile,
  upsertPartnerProfile,
  upsertUserProfile,
  deleteMyProfileFromDb,
  deletePartnerProfile,
} from "./db";
import {
  load as loadLocal,
  saveMyProfile,
  savePerson,
  getPendingDeletes,
  clearPendingDelete,
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
async function syncWithSupabase(uid: string, userMeta: SupabaseUser | null): Promise<void> {
  const errors: string[] = [];

  // 1. Mirror auth user metadata (best-effort)
  try {
    await upsertUserProfile({
      id: uid,
      email: userMeta?.email ?? undefined,
      user_metadata: (userMeta?.user_metadata ?? {}) as Record<string, unknown>,
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

  // 3. Push local data to DB when:
  //    (a) DB has no profile yet, OR
  //    (b) DB profile exists but local is NEWER (last edited more recently on this device)
  const local = loadLocal();

  const localNewer =
    local.myProfile &&
    dbProfile &&
    local.myProfile.id === dbProfile.id &&
    local.myProfile.updatedAt > dbProfile.updatedAt;

  if ((local.myProfile && !dbProfile) || localNewer) {
    console.log("[auth] pushing local myProfile to Supabase", localNewer ? "(local is newer)" : "(DB missing)");
    try {
      await upsertMyProfile(uid, local.myProfile!);
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

  // 3.5. 로컬에서 삭제됐지만 DB 삭제가 아직 반영 안 됐을 수 있는 id(로그아웃 상태에서 삭제했거나,
  // 삭제 직후 즉시 DB 호출이 실패한 경우)를 재시도한다. 이걸 안 하면 아래 4번 pull이 "DB에는
  // 있는데 로컬엔 없다"고 보고 되살려버린다(삭제한 사람이 다시 나타나는 버그의 원인).
  const pendingDeletes = getPendingDeletes();
  for (const delId of pendingDeletes) {
    try {
      if (dbProfile?.id === delId) await deleteMyProfileFromDb(uid);
      else await deletePartnerProfile(delId);
      clearPendingDelete(delId);
    } catch (e) {
      console.warn(`[auth] pending delete retry failed for ${delId} (will retry next sync):`, e);
    }
  }

  // 4. Pull final DB state → merge with localStorage (DB wins for known records, local wins for local-only)
  try {
    const [finalProfile, finalPartners] = await Promise.all([
      fetchMyProfile(uid),
      fetchPartnerProfiles(uid),
    ]);

    // 위 재시도가 실패해 DB에 여전히 남아있을 수 있는 tombstone은 여기서도 한 번 더 걸러
    // 되살아나지 않게 막는다(재시도는 다음 sync에서 계속됨).
    const stillPending = new Set(getPendingDeletes());

    if (finalProfile && !stillPending.has(finalProfile.id)) {
      saveMyProfile(finalProfile);
      console.log("[auth] synced myProfile from Supabase ✓");
    }

    const finalDbIds = new Set(finalPartners.map((p) => p.id));
    // Save DB partners (DB wins for these records) — pending-delete tombstone이 남아있는 건 제외
    for (const p of finalPartners) {
      if (stillPending.has(p.id)) continue;
      savePerson(p);
    }
    // Preserve any local-only partners that didn't make it to DB (local fallback)
    const localAfterSync = loadLocal();
    const stillLocalOnly = local.people.filter((p) => !finalDbIds.has(p.id));
    for (const p of stillLocalOnly) {
      if (!localAfterSync.people.some((lp) => lp.id === p.id)) {
        savePerson(p);
        console.warn(`[auth] preserved local-only partner: ${p.birthInput?.name ?? p.id}`);
      }
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

    // Re-sync when the user switches back to this tab/window
    // so cross-device edits are reflected immediately.
    function handleVisibility() {
      if (document.visibilityState === "visible") {
        supabase.auth.getSession().then(({ data: { session } }) => {
          const u = session?.user ?? null;
          if (u) {
            setDbSynced(false);
            syncWithSupabase(u.id, u)
              .catch((err) => console.warn("[auth] visibility sync error:", err))
              .finally(() => setDbSynced(true));
          }
        });
      }
    }
    document.addEventListener("visibilitychange", handleVisibility);

    return () => {
      subscription.unsubscribe();
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, []);

  const signInWithGoogle = async () => {
    const baseUrl = import.meta.env.BASE_URL ?? "/";
    const normalizedBase = baseUrl.endsWith("/") ? baseUrl : `${baseUrl}/`;
    // Redirect back to the app root instead of a deep-link.
    // This avoids 404s on hosts that aren't configured for SPA rewrites.
    // Supabase will still parse the session from the URL on load.
    const redirectTo = new URL(normalizedBase, window.location.origin).toString();
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
