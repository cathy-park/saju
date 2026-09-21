// 상대 목록 카드·홈 화면 등 여러 곳에서 똑같이 "세 체계 종합 프롬프트를 클릭 즉시
// 복사"하는 버튼을 만들 때 쓰는 공용 상태 훅. 실제 프롬프트 내용은
// buildIntegratedCopyPromptForPerson(IntegratedOverview.tsx와 동일 결과물)을 그대로 쓰고,
// 여기서는 로딩/복사됨 상태와 clipboard 쓰기·토스트만 다룬다.
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { buildIntegratedCopyPromptForPerson } from "@/lib/integrated/copyPrompt";
import { useAuth } from "@/lib/authContext";
import { getMyProfile, getPeople, type PersonRecord } from "@/lib/storage";

export type IntegratedCopyState = "idle" | "loading" | "copied";

/** 호출부가 들고 있는 person은 화면이 마운트된 시점의 스냅샷일 수 있다(홈 화면처럼
 * 컴포넌트가 오래 떠 있는 화면에서 특히) — 프로필을 다른 화면에서 수정해도 이 스냅샷은
 * 갱신되지 않아 방금 저장한 현재 지역이 반영 안 된 채로 복사되는 문제가 있었다. 복사
 * 직전에 항상 localStorage에서 이 사람의 최신 레코드를 다시 읽는다. */
function reloadLatest(person: PersonRecord): PersonRecord {
  const mine = getMyProfile();
  if (mine?.id === person.id) return mine;
  return getPeople().find((p) => p.id === person.id) ?? person;
}

export function useIntegratedCopyToClipboard(person: PersonRecord) {
  const [state, setState] = useState<IntegratedCopyState>("idle");
  const { toast } = useToast();
  const { user } = useAuth();

  const handleClick = async () => {
    if (state === "loading") return;
    setState("loading");
    try {
      const prompt = await buildIntegratedCopyPromptForPerson(reloadLatest(person), user);
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
