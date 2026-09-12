// 자미두수 "AI 해석 프롬프트 복사" — comprehensiveReport(21단계 이전부터 이미 계산된 종합
// 리포트)가 가진 fact를 그대로 JSON으로 직렬화한다. 새 계산이나 새 사실을 추가하지 않고,
// 사용자가 GPT/Gemini 등 외부 AI에 붙여넣어 추가 해석을 받을 수 있도록 이미 만들어진
// 구조화 데이터만 내보낸다(integrated/prompt.ts의 buildIntegratedCopyPrompt와 같은 원칙).
import type { ComprehensiveReport } from "./comprehensiveReport";

export function buildZiweiCopyPrompt(report: ComprehensiveReport): string {
  const sections = report.sections
    .filter((section) => section.facts.length > 0)
    .map((section) => ({
      section: section.title,
      facts: section.facts.map((fact) => ({ domain: fact.domain, meaning: fact.meaning, polarity: fact.polarity })),
    }));
  return JSON.stringify({
    instruction: "아래는 자미두수 명반에서 이미 확정된 fact만 담은 구조화 데이터입니다. 새로운 계산이나 사실을 추가하지 말고, 이 fact만 바탕으로 자연스러운 상담문으로 표현해주세요.",
    personName: report.personName,
    sections,
  }, null, 2);
}
