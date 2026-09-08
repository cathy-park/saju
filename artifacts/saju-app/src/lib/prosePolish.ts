// deterministic 문장(synthesizeText 결과)을 AI로 "자연어만" 다듬는 공통 레이어 — 자미두수와
// 사주가 함께 쓰는 도메인 중립 유틸(공용 타입은 src/lib/reportFacts.ts). 계산/fact 구조는 전혀
// 바꾸지 않는다 — 이미 완성된 문장을 더 자연스럽게 다시 쓰는 후처리 단계일 뿐이다. 새 해석을
// 추가하지 않도록 서버(api/polish-prose.ts) 프롬프트에서 강하게 제한하고, 실패하거나 로그인하지
// 않은 경우 항상 deterministic 문장을 그대로 쓴다(리포트가 절대 깨지지 않는 것을 최우선으로 한다).
import { supabase } from "@/lib/supabase";
import type { ReportFact } from "@/lib/reportFacts";

/** 프롬프트를 바꿀 때마다 올린다 — sourceHash 계산에 포함되어 버전이 바뀌면 캐시가
 * 자동으로 무효화된다(서버가 source_hash·prompt_version 조합으로 재계산·재조회하므로
 * 클라이언트는 이 값만 최신으로 보내면 된다).
 * v2: 앱 전체 공통 AI 해석 출력 원칙(api/polish-prose.ts 참고 — 핵심 결론 2~4개 압축,
 * 유사 fact 병합, 상반 fact 관계 설명, 원자료 나열 대신 성향/행동 표현, 2~4문장) 적용.
 * v3: 메인 문장의 명리 기술용어 노출 방지(전문 용어 대신 fact에 이미 풀어쓴 표현 사용),
 * fact가 1개뿐인 결론은 확정적 어투 대신 완화된 어투 사용, fact가 적어 너무 짧으면 2~3문장
 * 허용(새 내용 추가 없이). */
export const PROSE_PROMPT_VERSION = "v3";

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
