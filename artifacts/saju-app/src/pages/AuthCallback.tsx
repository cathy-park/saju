import { useEffect } from "react";
import { useLocation } from "wouter";
import { supabase } from "@/lib/supabase";
import { Mascot } from "@/components/Mascot";

export default function AuthCallback() {
  const [, setLocation] = useLocation();

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        setLocation("/");
      } else {
        supabase.auth.exchangeCodeForSession(window.location.href).then(() => {
          setLocation("/");
        });
      }
    });
  }, [setLocation]);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-4">
      <Mascot expression="guiding" size={80} />
      <p className="text-muted-foreground text-sm">로그인 처리 중...</p>
    </div>
  );
}
