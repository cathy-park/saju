import type { TransitEvent, TransitSection, WesternTransitReport } from "./types";

const TRANSIT_ACTION: Record<TransitEvent["transitPointId"], string> = {
  sun: "당장의 관심이", moon: "감정의 반응이", mercury: "생각과 대화의 속도가", venus: "호감과 관계 감각이", mars: "행동 에너지가",
  jupiter: "기대와 확장의 폭이", saturn: "책임과 현실적인 기준이", uranus: "변화와 독립의 필요가", neptune: "감수성과 이상이", pluto: "근본적으로 바꾸려는 힘이",
};

const TARGET_THEME: Record<TransitEvent["natalTargetId"], string> = {
  sun: "자기 방향", moon: "정서적 안정", mercury: "판단과 소통", venus: "관계에서 원하는 만족과 애정 표현", mars: "행동 속도와 추진 방식",
  jupiter: "성장과 가능성을 보는 기준", saturn: "책임과 경계", uranus: "변화와 독립 욕구", neptune: "이상과 현실의 경계", pluto: "통제와 깊은 변화", ascendant: "자신을 드러내는 방식", midheaven: "사회적 역할과 커리어 방향",
};

export function presentTransitEvent(event: TransitEvent): string {
  const action = TRANSIT_ACTION[event.transitPointId], target = TARGET_THEME[event.natalTargetId];
  if (event.type === "square" || event.type === "opposition") return `${action} 커지는 동안 ${target}과의 균형을 다시 조정하게 됩니다`;
  if (event.type === "conjunction") return `${action} ${target}에 직접 모이므로, 이 주제를 평소보다 분명하게 다루게 됩니다`;
  return `${action} ${target}을 자연스럽게 보완하므로, 이미 가진 장점을 실제 선택으로 옮기기 좋습니다`;
}

/** 18/20단계 adapter가 보존한 stable transit fact ID를 사용자 문장으로 바꾼다. */
export function presentTransitFactId(factId: string): string | null {
  const match = factId.match(/:(sun|moon|mercury|venus|mars|jupiter|saturn|uranus|neptune|pluto):(sun|moon|mercury|venus|mars|jupiter|saturn|uranus|neptune|pluto|ascendant|midheaven):(conjunction|opposition|square|trine|sextile)(?::|$)/);
  if (!match) return null;
  const [, transitPointId, natalTargetId, type] = match as [string, TransitEvent["transitPointId"], TransitEvent["natalTargetId"], TransitEvent["type"]];
  return presentTransitEvent({ transitPointId, natalTargetId, type } as TransitEvent);
}

export function presentTransitSection(report: WesternTransitReport, section: TransitSection): string {
  const events = section.key === "overview"
    ? report.sections.filter((item) => item.key !== "overview").flatMap((item) => item.primaryEvidence).slice(0, 3)
    : section.primaryEvidence.slice(0, 3);
  const byId = new Map(report.timeline.events.map((event) => [event.id, event]));
  return [...new Set(events.map((evidence) => byId.get(evidence.eventId)).filter((event): event is TransitEvent => !!event).map(presentTransitEvent))]
    .map((text) => `${text}.`).join(" ");
}
