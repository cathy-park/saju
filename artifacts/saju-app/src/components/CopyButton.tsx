import { useState } from "react";
import { Clipboard, Check } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

interface CopyButtonProps {
  buildText: () => string;
  label?: string;
  /** 21단계 — 자미두수·서양점성술 리포트도 이 컴포넌트를 재사용하면서 토스트 문구가
   * "사주 분석 데이터가..."로 고정돼 있던 문제를 고쳤다. 기본값은 기존 사주/궁합 호출부와
   * 완전히 동일한 문구를 유지한다(하위 호환). */
  toastTitle?: string;
}

export function CopyButton({ buildText, label = "분석 전체 복사", toastTitle = "사주 분석 데이터가 복사되었습니다." }: CopyButtonProps) {
  const [copied, setCopied] = useState(false);
  const { toast } = useToast();

  const handleCopy = async () => {
    try {
      const text = buildText();
      await navigator.clipboard.writeText(text);
      setCopied(true);
      toast({
        title: toastTitle,
        description: "GPT 또는 Gemini에 붙여넣어 추가 해석을 받을 수 있습니다.",
        duration: 3000,
      });
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast({
        title: "복사 실패",
        description: "클립보드 접근 권한을 확인해주세요.",
        variant: "destructive",
        duration: 3000,
      });
    }
  };

  return (
    <button
      type="button"
      onClick={handleCopy}
      className={cn(
        "flex min-h-11 w-full items-center justify-center gap-1.5 rounded-xl border px-4 text-sm font-semibold shadow-none transition-colors",
        copied
          ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-700"
          : "border-border bg-muted/40 text-foreground hover:bg-muted/60",
      )}
    >
      {copied
        ? <Check size={15} strokeWidth={2.5} />
        : <Clipboard size={15} strokeWidth={2} />
      }
      {copied ? "복사됨!" : label}
    </button>
  );
}
