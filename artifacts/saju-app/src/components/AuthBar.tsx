import { useAuth } from "@/lib/authContext";
import { LogIn, LogOut } from "lucide-react";

export function AuthBar() {
  const { user, loading, signInWithGoogle, signOut } = useAuth();

  if (loading) return null;

  if (!user) {
    return (
      <button
        onClick={signInWithGoogle}
        className="flex items-center gap-1.5 text-[13px] font-semibold text-muted-foreground hover:text-foreground transition-colors px-3 py-1.5 rounded-xl border border-border hover:bg-muted/40"
      >
        <LogIn className="h-3.5 w-3.5" />
        로그인
      </button>
    );
  }

  const displayName = (user.user_metadata?.full_name as string | undefined)
    ?? user.email?.split("@")[0]
    ?? "사용자";
  const avatar = user.user_metadata?.avatar_url as string | undefined;
  const initials = displayName.slice(0, 1).toUpperCase();

  return (
    <div className="flex items-center gap-2">
      {/* Avatar */}
      {avatar ? (
        <img src={avatar} alt={displayName} className="w-7 h-7 rounded-full object-cover ring-2 ring-white" />
      ) : (
        <div className="w-7 h-7 rounded-full bg-primary flex items-center justify-center ring-2 ring-white shrink-0">
          <span className="text-[12px] font-bold text-white">{initials}</span>
        </div>
      )}
      {/* Name */}
      <span className="text-[13px] font-semibold text-foreground max-w-[72px] truncate hidden sm:block">
        {displayName}
      </span>
      {/* Logout */}
      <button
        onClick={signOut}
        title="로그아웃"
        className="p-1.5 rounded-lg text-muted-foreground hover:text-red-500 hover:bg-red-50 transition-colors"
      >
        <LogOut className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

export function GoogleLoginCard() {
  const { signInWithGoogle } = useAuth();
  return (
    <div className="rounded-2xl border border-border bg-white px-4 py-5 flex flex-col items-center gap-3 text-center">
      <p className="text-[15px] font-bold text-foreground">저장 기능을 사용하려면 로그인하세요</p>
      <p className="text-[13px] text-muted-foreground leading-relaxed">
        로그인하면 기기가 바뀌어도<br />사주 데이터가 유지됩니다
      </p>
      <button
        onClick={signInWithGoogle}
        className="flex items-center gap-2.5 px-5 py-2.5 rounded-2xl border border-border bg-white hover:bg-muted/30 transition-colors text-[14px] font-semibold text-foreground w-full max-w-xs justify-center"
      >
        <svg viewBox="0 0 24 24" className="h-4 w-4 shrink-0">
          <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
          <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
          <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
          <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
        </svg>
        Google로 로그인
      </button>
    </div>
  );
}
