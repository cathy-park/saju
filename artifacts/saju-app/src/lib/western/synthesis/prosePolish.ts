// 서양점성술 "종합"(개인 전체 흐름/관계 종합) 리포트 전용 AI 다듬기 어댑터 — deterministic
// core(report.ts)는 이 파일을 전혀 모른다. deterministic report → (이 어댑터) → polish-prose
// → 실패 시 deterministic 문장으로 fallback, 순서를 그대로 지킨다(21단계 대표 지시).
//
// WesternSynthesisFact(types.ts)는 domain/polarity가 없다(공용 ReportFact와 다른 shape) —
// 이 리포트는 같은 서양점성술 안의 모듈(성격/연애/트랜싯)끼리의 합의를 표현할 뿐 방향성
// 판정을 갖지 않으므로, integrated/prompt.ts와 같은 원칙으로 polarity를 "neutral"로 고정해
// 공용 polish-prose 어댑터(createPolishRequestCache)에 태운다. 새 계산·새 판정을 추가하지
// 않는다 — 문장 다듬기 입력 형식만 맞춘다.
import type { ReportFact } from "@/lib/reportFacts";
import { createPolishRequestCache } from "@/lib/prosePolish";
import type {
  WesternPersonalSynthesisReport, WesternRelationshipSynthesisReport, WesternSynthesisFact,
} from "./types";

function toReportFact(fact: WesternSynthesisFact): ReportFact<unknown> {
  return {
    id: fact.id,
    domain: fact.primaryOwnerSection,
    meaning: fact.meaning,
    polarity: "neutral",
    strength: 1,
    evidence: [],
  };
}

/** WesternPersonality/Romance/Transit/Synastry는 이미 공용 ReportFact를 써서 prosePolish.ts를
 * 그대로 재사용한다 — 이 함수는 그 네 리포트를 합치는 "종합" 두 페이지(overview,
 * relationshipOverview) 전용이다. */
export function createWesternSynthesisPolishCache(topic: string) {
  const requestPolishedTexts = createPolishRequestCache(topic);

  return function requestWesternSynthesisPolishedTexts(
    report: WesternPersonalSynthesisReport | WesternRelationshipSynthesisReport,
    contentKey: string,
  ): Promise<Record<string, string>> {
    const sections = report.sections
      .filter((section) => section.facts.length > 0)
      .map((section) => ({
        key: section.key,
        text: section.text,
        facts: section.facts.map(toReportFact),
      }));
    return requestPolishedTexts(sections, contentKey);
  };
}

/** 리포트 내용이 실제로 바뀌었을 때만 새 다듬기 요청을 보내도록 하는 content key — 리포트
 * schemaVersion·대상 인물뿐 아니라 실제 fact id 목록까지 포함해, 같은 인물이라도 트랜싯
 * 갱신 등으로 facts가 바뀌면 캐시를 다시 탄다. */
export function westernSynthesisContentKey(
  report: WesternPersonalSynthesisReport | WesternRelationshipSynthesisReport,
): string {
  const subjectId = "personId" in report ? report.personId : report.pairId;
  const factIds = report.sections.flatMap((section) => section.facts.map((fact) => fact.id)).sort().join(",");
  return `${report.schemaVersion}:${subjectId}:${factIds}`;
}
