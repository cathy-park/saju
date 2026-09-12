// 종합(/integrated) 화면의 AI holistic 상담이 다뤄야 하는 고정된 다면 영역 목록 —
// 대표 지시(다면 분석 복원). 클라이언트(IntegratedReportView.tsx, 렌더 순서·제목)와
// 서버(api/integrated-holistic.ts, AI에게 줄 키·제목 목록) 양쪽이 이 파일 하나를 그대로
// 쓴다 — 키·제목이 두 곳에 따로 적혀 있으면 또 드리프트가 생긴다.
//
// 이 영역들은 "영역이 있어야 한다"는 뜻이지 "항상 모두 채워야 한다"는 뜻이 아니다 — 실제
// 근거가 없는 영역은 AI 응답에서 빠질 수 있다(빈 내용을 억지로 만들지 않는다).
export interface IntegratedArea {
  key: string;
  title: string;
  /** AI 프롬프트에 영역의 의미를 명확히 알려주기 위한 짧은 설명(대표가 예시로 준 것). */
  hint: string;
  themes: string[];
}

export const PERSONAL_AREAS: IntegratedArea[] = [
  { key: "overview", title: "한눈에 보는 나", hint: "서로 반복되는 핵심 구조 2~4개", themes: ["selfDirection", "emotionProcessing", "actionDrive", "relationshipNeeds", "careerResponsibility", "moneyReality"] },
  { key: "personality", title: "성향", hint: "판단 방식과 삶을 대하는 태도", themes: ["selfDirection", "thinkingCommunication"] },
  { key: "emotionInner", title: "감정·내면", hint: "감정 처리 방식, 안정 욕구와 내적 갈등", themes: ["emotionProcessing"] },
  { key: "romance", title: "연애", hint: "호감, 애정 표현과 친밀감", themes: ["intimacyConflict"] },
  { key: "marriagePartner", title: "결혼·배우자", hint: "장기 관계에서 원하는 구조와 조율", themes: ["relationshipNeeds", "longTermRelationship"] },
  { key: "careerWork", title: "일·커리어", hint: "추진 방식, 책임과 성취 패턴", themes: ["careerResponsibility", "actionDrive"] },
  { key: "wealthReality", title: "재물", hint: "돈을 다루고 기반을 만드는 방식", themes: ["moneyReality"] },
  { key: "healthRhythm", title: "건강·생활 리듬", hint: "확정된 생활 리듬과 회복 관련 근거", themes: [] },
  { key: "currentFlow", title: "현재 흐름", hint: "타고난 구조와 선택 기간의 흐름이 맞물리는 지점", themes: ["growthChange", "relationshipNeeds", "actionDrive", "careerResponsibility", "moneyReality"] },
];

export const RELATIONSHIP_AREAS: IntegratedArea[] = [
  { key: "relationshipCoreStructure", title: "관계의 핵심", hint: "두 사람이 만나는 방식의 전반적인 골격", themes: ["relationshipNeeds", "thinkingCommunication", "intimacyConflict", "longTermRelationship"] },
  { key: "emotionAttachment", title: "감정·애착", hint: "서로에게 느끼는 정서적 안정감과 애착 방식", themes: ["emotionProcessing", "relationshipNeeds"] },
  { key: "communicationConflict", title: "대화·갈등", hint: "대화 방식, 갈등이 생기고 풀리는 패턴", themes: ["thinkingCommunication", "intimacyConflict"] },
  { key: "attractionIntimacy", title: "끌림·친밀감", hint: "서로 끌리는 지점과 친밀감을 쌓는 방식", themes: ["intimacyConflict"] },
  { key: "longTermSustainability", title: "결혼·장기 지속성", hint: "책임, 생활 기반과 오래 유지하기 위한 조율", themes: ["longTermRelationship"] },
  { key: "realityCompatibility", title: "현실·생활 궁합", hint: "생활 방식, 현실적인 조율이 필요한 지점", themes: ["careerResponsibility", "moneyReality"] },
  { key: "currentRelationshipFlow", title: "현재 관계 흐름", hint: "선택 기간에 관계 구조가 활성화되는 지점", themes: ["relationshipNeeds", "intimacyConflict", "longTermRelationship"] },
];

export function areasForScope(scope: "personal" | "relationship"): IntegratedArea[] {
  return scope === "personal" ? PERSONAL_AREAS : RELATIONSHIP_AREAS;
}
