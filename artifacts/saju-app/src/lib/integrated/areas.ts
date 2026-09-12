// 종합(/integrated) 화면의 AI holistic 상담이 다뤄야 하는 고정된 다면 영역 목록 —
// 대표 지시(다면 분석 복원). 클라이언트(IntegratedReportView.tsx, 렌더 순서·제목)와
// 서버(api/integrated-holistic.ts, AI에게 줄 키·제목 목록) 양쪽이 이 파일 하나를 그대로
// 쓴다 — 키·제목이 두 곳에 따로 적혀 있으면 또 드리프트가 생긴다.
//
// 이 7개는 "영역이 있어야 한다"는 뜻이지 "항상 7개 다 채워야 한다"는 뜻이 아니다 — 실제
// 근거가 없는 영역은 AI 응답에서 빠질 수 있다(빈 내용을 억지로 만들지 않는다).
export interface IntegratedArea {
  key: string;
  title: string;
  /** AI 프롬프트에 영역의 의미를 명확히 알려주기 위한 짧은 설명(대표가 예시로 준 것). */
  hint: string;
}

export const PERSONAL_AREAS: IntegratedArea[] = [
  { key: "coreNatureAndLife", title: "핵심 성향과 삶의 방식", hint: "전반적인 성격 구조와 삶을 대하는 태도" },
  { key: "emotionInner", title: "감정과 내면", hint: "감정 처리 방식, 불안/안정, 내적 갈등" },
  { key: "relationshipRomance", title: "관계·연애·배우자", hint: "친밀감, 관계 욕구, 갈등 방식, 배우자 기준" },
  { key: "careerWork", title: "일·커리어", hint: "추진 방식, 리더십, 조직/독립성, 성취 패턴" },
  { key: "wealthReality", title: "재물·현실 감각", hint: "돈을 다루는 방식, 축적/확장 성향, 현실 판단" },
  { key: "strengthWeaknessGrowth", title: "강점·약점·성장 포인트", hint: "반복되는 강점과 취약점, 보완 방향" },
  { key: "currentFlow", title: "현재 흐름", hint: "타고난(natal) 구조와 지금 시기(timing)가 어떻게 맞물리는지" },
];

export const RELATIONSHIP_AREAS: IntegratedArea[] = [
  { key: "relationshipCoreStructure", title: "관계의 핵심 구조", hint: "두 사람이 만나는 방식의 전반적인 골격" },
  { key: "emotionAttachment", title: "감정·애착", hint: "서로에게 느끼는 정서적 안정감과 애착 방식" },
  { key: "communicationConflict", title: "대화·갈등", hint: "대화 방식, 갈등이 생기고 풀리는 패턴" },
  { key: "attractionIntimacy", title: "끌림·친밀감", hint: "서로 끌리는 지점과 친밀감을 쌓는 방식" },
  { key: "longTermSustainability", title: "장기 지속성", hint: "관계를 오래 유지하는 데 영향을 주는 구조" },
  { key: "realityCompatibility", title: "현실·생활 궁합", hint: "생활 방식, 현실적인 조율이 필요한 지점" },
  { key: "currentRelationshipFlow", title: "현재 관계 흐름", hint: "지금 시기에 두 사람의 관계에 맞물리는 흐름" },
];

export function areasForScope(scope: "personal" | "relationship"): IntegratedArea[] {
  return scope === "personal" ? PERSONAL_AREAS : RELATIONSHIP_AREAS;
}
