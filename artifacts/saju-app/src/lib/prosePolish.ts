// deterministic 문장(synthesizeText 결과)을 AI로 "자연어만" 다듬는 공통 레이어 — 자미두수와
// 사주가 함께 쓰는 도메인 중립 유틸(공용 타입은 src/lib/reportFacts.ts). 계산/fact 구조는 전혀
// 바꾸지 않는다 — 이미 완성된 문장을 더 자연스럽게 다시 쓰는 후처리 단계일 뿐이다. 새 해석을
// 추가하지 않도록 서버(api/polish-prose.ts) 프롬프트에서 강하게 제한하고, 실패하거나 로그인하지
// 않은 경우 항상 deterministic 문장을 그대로 쓴다(리포트가 절대 깨지지 않는 것을 최우선으로 한다).
import { supabase } from "@/lib/supabase";
import type { ReportFact } from "@/lib/reportFacts";
import { SHARED_PROSE_PROMPT_VERSION } from "@/lib/prosePromptVersion";

/** api/polish-prose.ts의 공유 프롬프트를 바꿀 때마다 올려야 하는 값은 이제
 * src/lib/prosePromptVersion.ts(SHARED_PROSE_PROMPT_VERSION) 하나뿐이다 — 사주·자미두수·
 * 서양점성술·종합이 전부 그 상수를 그대로 재노출한다(21단계, 캐시 버전 드리프트 방지).
 * 과거 버전 이력(v2: 핵심 결론 2~4개 압축 등 공통 원칙 적용, v3: 명리 기술용어 노출 방지·
 * 완화된 어투)은 prosePromptVersion.ts에 통합 기록한다. */
export const PROSE_PROMPT_VERSION = SHARED_PROSE_PROMPT_VERSION;

export interface PolishResult {
  text: string;
  source: "cache" | "ai" | "fallback";
}

const FALLBACK = (text: string): PolishResult => ({ text, source: "fallback" });

/** facts + deterministic 문장을 서버(api/polish-prose)로 보내 자연어로 다듬는다. 로그인하지
 * 않았거나, 네트워크/서버/AI 오류가 나면 예외 없이 deterministic 문장을 그대로 반환한다. */
export async function polishStatementText(
  facts: ReportFact<unknown>[],
  deterministicText: string,
  topic: string,
  sectionKey: string,
): Promise<PolishResult> {
  if (facts.length === 0 || !deterministicText) return FALLBACK(deterministicText);

  try {
    const { data: { session } } = await supabase.auth.getSession();
    const token = session?.access_token;
    if (!token) return FALLBACK(deterministicText);

    const res = await fetch("/api/polish-prose", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({
        facts: facts.map((f) => ({ domain: f.domain, meaning: f.meaning, polarity: f.polarity })),
        deterministicText,
        topic,
        sectionKey,
        promptVersion: PROSE_PROMPT_VERSION,
      }),
    });
    if (!res.ok) return FALLBACK(deterministicText);

    const data = (await res.json()) as { prose?: string; cached?: boolean };
    if (typeof data.prose !== "string" || !data.prose.trim()) return FALLBACK(deterministicText);

    return { text: data.prose, source: data.cached ? "cache" : "ai" };
  } catch {
    return FALLBACK(deterministicText);
  }
}

/** 9단계(원국 핵심 요약)에서 처음 만든 패턴: 컴포넌트가 언마운트·재마운트돼도(예: 로그인 직후
 * auth↔DB 동기화로 상위 record 객체가 통째로 교체되는 경우) 같은 content key에 대해 다듬기
 * 요청을 다시 보내지 않도록, 요청 자체를 모듈 스코프 캐시(Map)로 감싼다. React state와 달리
 * 언마운트로 사라지지 않는다. 10단계(월별운세 요약)도 이 팩토리로 자신만의 캐시 인스턴스를
 * 만들어 그대로 재사용한다(토픽별로 별도 캐시를 두므로 서로 섞이지 않는다). */
export function createPolishRequestCache(topic: string) {
  const cache = new Map<string, Promise<Record<string, string>>>();

  return function requestPolishedTexts(
    sections: { key: string; text: string; facts: ReportFact<unknown>[] }[],
    contentKey: string,
  ): Promise<Record<string, string>> {
    const cached = cache.get(contentKey);
    if (cached) return cached;

    const promise = (async () => {
      const results: Record<string, string> = {};
      await Promise.all(
        sections.map(async (section) => {
          if (section.facts.length === 0) return;
          const result = await polishStatementText(section.facts, section.text, topic, section.key);
          if (result.source !== "fallback") results[section.key] = result.text;
        }),
      );
      return results;
    })();

    cache.set(contentKey, promise);
    return promise;
  };
}
