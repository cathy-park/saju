// 서양점성술 "AI 해석 프롬프트 복사" — WesternPersonalSynthesisReport(성격·연애·트랜싯을
// 이미 종합한 리포트)의 fact를 그대로 JSON으로 직렬화한다. 새 계산·새 판정을 추가하지 않고,
// 이미 계산된 구조화 데이터만 내보낸다(ziwei/reports/promptExport.ts, integrated/prompt.ts와
// 같은 원칙).
import type { WesternPersonalSynthesisReport } from "./types";

export function buildWesternCopyPrompt(report: WesternPersonalSynthesisReport): string {
  const sections = report.sections
    .filter((section) => section.facts.length > 0)
    .map((section) => ({
      section: section.title,
      facts: section.facts.map((fact) => ({ meaning: fact.meaning, relationKind: fact.relationKind })),
    }));
  return JSON.stringify({
    instruction: "아래는 서양점성술 출생차트에서 이미 확정된 fact만 담은 구조화 데이터입니다. 새로운 계산이나 사실을 추가하지 말고, 이 fact만 바탕으로 자연스러운 상담문으로 표현해주세요.",
    personId: report.personId,
    sections,
  }, null, 2);
}
