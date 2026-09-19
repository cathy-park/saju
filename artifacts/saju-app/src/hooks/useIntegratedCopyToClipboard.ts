// 상대 목록 카드·홈 화면 등 여러 곳에서 똑같이 "세 체계 종합 프롬프트를 클릭 즉시
// 복사"하는 버튼을 만들 때 쓰는 공용 상태 훅. 실제 프롬프트 내용은
// buildIntegratedCopyPromptForPerson(IntegratedOverview.tsx와 동일 결과물)을 그대로 쓰고,
// 여기서는 로딩/복사됨 상태와 clipboard 쓰기·토스트만 다룬다.
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { buildIntegratedCopyPromptForPerson } from "@/lib/integrated/copyPrompt";
import { useAuth } from "@/lib/authContext";
import type { PersonRecord } from "@/lib/storage";

export type IntegratedCopyState = "idle" | "loading" | "copied";

export function useIntegratedCopyToClipboard(person: PersonRecord) {
  const [state, setState] = useState<IntegratedCopyState>("idle");
  const { toast } = useToast();
  const { user } = useAuth();

  const handleClick = async () => {
    if (state === "loading") return;
    setState("loading");
    try {
      const prompt = await buildIntegratedCopyPromptForPerson(person, user);
      await navigator.clipboard.writeText(prompt);
      setState("copied");
      toast({
        title: "세 체계 종합 프롬프트가 복사되었습니다.",
        description: "GPT 또는 Gemini에 붙여넣어 종합 해석을 받을 수 있습니다.",
        duration: 3000,
      });
      setTimeout(() => setState("idle"), 2000);
    } catch {
      setState("idle");
      toast({
        title: "복사 실패",
        description: "잠시 후 다시 시도해주세요.",
        variant: "destructive",
        duration: 3000,
      });
    }
  };

  return { state, handleClick };
}
