import { useEffect } from "react";
import { useLocation } from "wouter";
import { supabase } from "@/lib/supabase";
import { Mascot } from "@/components/Mascot";

export default function AuthCallback() {
  const [, setLocation] = useLocation();

  useEffect(() => {
    (async () => {
      try {
        // Handle both flows:
        // - PKCE: `?code=...` (exchangeCodeForSession)
        // - Implicit: `#access_token=...` (getSessionFromUrl)
        const authAny = supabase.auth as unknown as {
          getSessionFromUrl?: (opts?: { storeSession?: boolean }) => Promise<unknown>;
        };

        if (typeof authAny.getSessionFromUrl === "function") {
          await authAny.getSessionFromUrl({ storeSession: true });
        }
      } catch {
        // ignore and fall back to other methods
      }

      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        setLocation("/");
        return;
      }

      // PKCE fallback (when the provider returns a `code`)
      try {
        await supabase.auth.exchangeCodeForSession(window.location.href);
      } catch {
        // ignore; we'll rely on auth state listener in AuthProvider if session appears later
      }
      setLocation("/");
    })();
  }, [setLocation]);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-4">
      <Mascot expression="guiding" size={80} />
      <p className="text-muted-foreground text-sm">로그인 처리 중...</p>
    </div>
  );
}
