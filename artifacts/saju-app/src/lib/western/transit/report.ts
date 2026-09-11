import { buildWesternPersonalityReport } from "../interpretation/report.js";
import { buildWesternRelationshipReport } from "../interpretation/romance/report.js";
import { HOUSE_RULES } from "../interpretation/rules/houseRules.js";
import { signRuleAt } from "../interpretation/rules/signRules.js";
import type { WesternNatalChart } from "../types.js";
import { PLANET_LABEL } from "./rules.js";
import { calculateTransitTimeline } from "./timeline.js";
import type { NatalLink, TransitEvent, TransitEvidence, TransitFact, TransitQuery, TransitSection, TransitSectionKey, TransitTargetId, WesternTransitReport } from "./types.js";

export const TRANSIT_SELECTION_ORDER = ["background", "trigger", "exact", "close", "active", "natal-fact", "structural-context", "technical"] as const;
const TITLES: Record<TransitSectionKey, string> = {
  overview: "전체 흐름", emotionalRelationships: "감정·관계", workCareer: "일·커리어",
  moneyReality: "재물·현실", actionChange: "행동·변화", adjustments: "주의할 점",
};
const PHASE_ORDER = { exact: 0, close: 1, active: 2 } as const;
const LINK_ORDER = { "natal-fact": 0, "structural-context": 1, technical: 2 } as const;

function pointContext(chart: WesternNatalChart, target: TransitTargetId) {
  if (target === "ascendant" || target === "midheaven") {
    const longitude = target === "ascendant" ? chart.angles.ascendant.longitude : chart.angles.midheaven.longitude;
    return { target, longitude, sign: signRuleAt(longitude).name, house: target === "ascendant" ? 1 : 10 };
  }
  const point = chart.points.find((item) => item.id === target)!;
  return { target, longitude: point.longitude, sign: signRuleAt(point.longitude).name, house: point.house };
}

function natalAspectLabels(chart: WesternNatalChart, target: TransitTargetId): string[] {
  if (target === "ascendant" || target === "midheaven") return [];
  return chart.aspects.filter((aspect) => aspect.point1Id === target || aspect.point2Id === target)
    .sort((a, b) => a.orb - b.orb).slice(0, 3).map((aspect) => `${aspect.point1Id} ${aspect.type} ${aspect.point2Id} orb ${aspect.orb.toFixed(3)}°`);
}

function existingFactIndex(chart: WesternNatalChart): Map<string, string[]> {
  const personality = buildWesternPersonalityReport(chart).sections.flatMap((section) => section.facts);
  const relationship = buildWesternRelationshipReport(chart).sections.flatMap((section) => section.facts);
  const index = new Map<string, Set<string>>();
  for (const fact of [...personality, ...relationship]) for (const evidence of fact.evidence) {
    for (const pointId of evidence.sourcePointIds) {
      const ids = index.get(pointId) ?? new Set<string>(); ids.add(fact.id); index.set(pointId, ids);
    }
  }
  return new Map([...index].map(([key, ids]) => [key, [...ids].sort()]));
}

function natalLink(chart: WesternNatalChart, target: TransitTargetId, facts: Map<string, string[]>): NatalLink {
  const factIds = facts.get(target);
  if (factIds?.length) return { kind: "natal-fact", factIds };
  const context = pointContext(chart, target);
  if (context.sign && context.house) return { kind: "structural-context", context: { target, sign: context.sign, house: context.house, natalAspectLabels: natalAspectLabels(chart, target) } };
  return { kind: "technical" };
}

function ownerFor(event: TransitEvent): TransitSectionKey {
  const target = event.natalTargetId, house = event.natalHouse;
  if (target === "moon" || target === "venus" || house === 5 || house === 7) return "emotionalRelationships";
  if (target === "midheaven" || target === "sun" || house === 6 || house === 10) return "workCareer";
  if (house === 2 || house === 8 || target === "jupiter") return "moneyReality";
  if (target === "mars" || target === "uranus" || [1, 3, 9, 11].includes(house)) return "actionChange";
  return "adjustments";
}

function eventOrder(a: { event: TransitEvent; link: NatalLink }, b: { event: TransitEvent; link: NatalLink }) {
  return (a.event.role === "background" ? 0 : 1) - (b.event.role === "background" ? 0 : 1)
    || PHASE_ORDER[a.event.phase] - PHASE_ORDER[b.event.phase]
    || LINK_ORDER[a.link.kind] - LINK_ORDER[b.link.kind]
    || a.event.id.localeCompare(b.event.id);
}

function tone(event: TransitEvent): string {
  if (event.type === "square" || event.type === "opposition") return "서로 다른 요구가 맞물려 조정과 선택이 중요해집니다";
  if (event.type === "conjunction") return "해당 주제가 전면에 올라와 새로운 방식으로 다뤄야 합니다";
  return "이미 가진 자원을 연결하고 실제 행동으로 옮기기 쉬워집니다";
}

function targetMeaning(chart: WesternNatalChart, event: TransitEvent, link: NatalLink): string {
  const context = pointContext(chart, event.natalTargetId);
  const base = event.role === "background" ? `${PLANET_LABEL[event.transitPointId]}의 장기 흐름이` : `${PLANET_LABEL[event.transitPointId]}의 단기 움직임이`;
  const area = context.house ? HOUSE_RULES[context.house].arena : "삶의 방향";
  if (link.kind === "natal-fact") return `${base} 기존 차트에서 확인된 ${area}의 패턴을 활성화합니다. ${tone(event)}`;
  if (link.kind === "structural-context") return `${base} ${area} 영역의 실제 출생차트 구조를 건드립니다. ${tone(event)}`;
  return `${base} 출생차트의 특정 지점을 기술적으로 활성화하고 있습니다`;
}

function evidenceFor(event: TransitEvent, link: NatalLink, owner: TransitSectionKey): TransitEvidence {
  return { eventId: event.id, label: `${event.transitPointId} ${event.type} natal ${event.natalTargetId} orb ${event.orb.toFixed(3)}° ${event.applying ? "applying" : "separating"}`, role: event.role, phase: event.phase, natalLink: link, primaryOwnerSection: owner };
}

function factFor(chart: WesternNatalChart, event: TransitEvent, link: NatalLink, owner: TransitSectionKey): TransitFact {
  const evidence = evidenceFor(event, link, owner);
  return { id: `transit-fact:${event.id}`, domain: "westernTransit", meaning: targetMeaning(chart, event, link), polarity: "neutral", strength: 1, evidence: [evidence], primaryOwnerSection: owner, referencedNatalFactIds: link.kind === "natal-fact" ? link.factIds : [] };
}

function section(key: TransitSectionKey, facts: TransitFact[], referencedFactIds: string[] = []): TransitSection {
  return { key, title: TITLES[key], text: facts.map((fact) => `${fact.meaning.replace(/[.!?]+$/, "")}.`).join(" "), facts, primaryEvidence: facts.flatMap((fact) => fact.evidence), referencedFactIds };
}

export function buildWesternTransitReport(chart: WesternNatalChart, query: TransitQuery): WesternTransitReport {
  const timeline = calculateTransitTimeline(chart, query), factIndex = existingFactIndex(chart);
  const linked = timeline.events.map((event) => {
    event.primaryOwnerSection = ownerFor(event);
    return { event, link: natalLink(chart, event.natalTargetId, factIndex) };
  }).sort(eventOrder);
  const backgrounds = linked.filter((item) => item.event.role === "background").slice(0, 8);
  const backgroundTargets = new Set(backgrounds.map((item) => item.event.natalTargetId));
  const triggers = linked.filter((item) => item.event.role === "trigger" && backgroundTargets.has(item.event.natalTargetId)).slice(0, Math.min(4, backgrounds.length));
  const selected = [...backgrounds, ...triggers].sort(eventOrder);
  const grouped = new Map<TransitSectionKey, TransitFact[]>();
  for (const item of selected) {
    const owner = item.event.primaryOwnerSection!;
    const facts = grouped.get(owner) ?? []; facts.push(factFor(chart, item.event, item.link, owner)); grouped.set(owner, facts);
  }
  const details = (["emotionalRelationships", "workCareer", "moneyReality", "actionChange", "adjustments"] as TransitSectionKey[])
    .map((key) => section(key, grouped.get(key) ?? [])).filter((item) => item.facts.length > 0);
  const overviewSources = details.flatMap((item) => item.facts).slice(0, 3);
  const overviewFact: TransitFact = { id: "transit-fact:overview", domain: "westernTransit", meaning: overviewSources.length ? overviewSources.map((fact) => fact.meaning.split(".")[0]).join(". ") : "현재 기간에는 별도로 강조할 장기 흐름이 없습니다", polarity: "neutral", strength: 1, evidence: [], primaryOwnerSection: "overview", referencedNatalFactIds: [] };
  return { timeline, sections: [section("overview", [overviewFact], overviewSources.map((fact) => fact.id)), ...details], selectionOrder: TRANSIT_SELECTION_ORDER };
}
