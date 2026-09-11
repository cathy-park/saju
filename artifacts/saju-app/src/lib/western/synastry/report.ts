import { buildWesternPersonalityReport } from "../interpretation/report.js";
import { buildWesternRelationshipReport } from "../interpretation/romance/report.js";
import { SIGN_RULERS } from "../interpretation/romance/rules.js";
import { signRuleAt } from "../interpretation/rules/signRules.js";
import type { PlanetId, WesternNatalChart, WesternPointId } from "../types.js";
import { norm360 } from "../astronomy.js";
import { calculateSynastryEvidence } from "./calculation.js";
import { SYNASTRY_CORE_PLANETS } from "./rules.js";
import type { CrossAspectEvidence, NatalFactLink, SynastryEvidenceView, SynastryFact, SynastryRawEvidence, SynastryRulerLink, SynastryRulership, SynastrySection, SynastrySectionKey, SynastrySubject, WesternSynastryReport } from "./types.js";

const TITLES: Record<SynastrySectionKey, string> = {
  overview: "한눈에 보는 관계", attraction: "끌림·호감", emotionalSecurity: "감정적 안정", communication: "사고·소통",
  intimacyDesire: "친밀감·욕망", conflictPatterns: "갈등 패턴", longTerm: "장기연애·결혼", operations: "관계 운영 포인트",
};
const BAND_ORDER = { exact: 0, close: 1, supporting: 2 } as const;
const KIND_ORDER = { "cross-aspect": 0, "angle-aspect": 1, "house-overlay": 2 } as const;

function rulership(subject: SynastrySubject): SynastryRulership {
  const sign = signRuleAt(norm360(subject.chart.angles.ascendant.longitude + 180)).name;
  const rulers = SIGN_RULERS[sign];
  return { sign, primaryRuler: rulers.primary, coRulers: rulers.coRulers };
}
function includesPoints(evidence: CrossAspectEvidence, personId: string, pointId: PlanetId, otherPersonId: string, otherPointId: PlanetId) {
  return evidence.points.some((point) => point.personId === personId && point.pointId === pointId) && evidence.points.some((point) => point.personId === otherPersonId && point.pointId === otherPointId);
}
function rulerLinks(subjects: [SynastrySubject, SynastrySubject], crossAspects: CrossAspectEvidence[], rulerships: Record<string, SynastryRulership>): SynastryRulerLink[] {
  const links: SynastryRulerLink[] = [];
  for (const rulerSubject of subjects) {
    const target = subjects.find((subject) => subject.personId !== rulerSubject.personId)!;
    const ruler = rulerships[rulerSubject.personId];
    for (const [rulerPointId, rulerRole] of [[ruler.primaryRuler, "primary"], ...ruler.coRulers.map((point) => [point, "co-ruler"])] as [PlanetId, "primary" | "co-ruler"][]) {
      for (const targetPointId of SYNASTRY_CORE_PLANETS) {
        const cross = crossAspects.find((item) => includesPoints(item, rulerSubject.personId, rulerPointId, target.personId, targetPointId));
        if (cross) links.push({ id: `synastry:${cross.pairId}:ruler:${rulerSubject.personId}.${rulerPointId}->${target.personId}.${targetPointId}:${rulerRole}`, pairId: cross.pairId, rulerPersonId: rulerSubject.personId, rulerPointId, rulerRole, targetPersonId: target.personId, targetPointId, crossAspectId: cross.id });
      }
    }
  }
  return links.sort((a, b) => a.id.localeCompare(b.id));
}
function factIndex(chart: WesternNatalChart): Map<WesternPointId, string[]> {
  const facts = [...buildWesternPersonalityReport(chart).sections.flatMap((section) => section.facts), ...buildWesternRelationshipReport(chart).sections.flatMap((section) => section.facts)];
  const index = new Map<WesternPointId, Set<string>>();
  for (const fact of facts) for (const evidence of fact.evidence) for (const pointId of evidence.sourcePointIds) { const ids = index.get(pointId) ?? new Set<string>(); ids.add(fact.id); index.set(pointId, ids); }
  return new Map([...index].map(([pointId, ids]) => [pointId, [...ids].sort()]));
}
function linkForPoint(subject: SynastrySubject, pointId: PlanetId, indexes: Map<string, Map<WesternPointId, string[]>>): NatalFactLink {
  const factIds = indexes.get(subject.personId)?.get(pointId) ?? [];
  if (factIds.length) return { personId: subject.personId, kind: "natal-fact", factIds };
  const point = subject.chart.points.find((item) => item.id === pointId)!;
  const natalAspectLabels = subject.chart.aspects.filter((aspect) => aspect.point1Id === pointId || aspect.point2Id === pointId).sort((a, b) => a.orb - b.orb).slice(0, 3).map((aspect) => `${aspect.point1Id} ${aspect.type} ${aspect.point2Id} orb ${aspect.orb.toFixed(3)}°`);
  return { personId: subject.personId, kind: "structural-context", factIds: [], context: { sign: signRuleAt(point.longitude).name, house: point.house, natalAspectLabels } };
}
function ownerFor(evidence: SynastryRawEvidence, primaryRulerCrossIds: Set<string>): SynastrySectionKey {
  if (primaryRulerCrossIds.has(evidence.id)) return "longTerm";
  if (evidence.kind === "house-overlay") return evidence.targetHouse === 4 || evidence.targetHouse === 7 || evidence.targetHouse === 10 ? "longTerm" : evidence.targetHouse === 8 ? "intimacyDesire" : "attraction";
  if (evidence.kind === "angle-aspect") {
    if (evidence.sourcePointId === "mercury") return "communication";
    if (evidence.targetAngleId === "descendant" || evidence.targetAngleId === "midheaven" || evidence.sourcePointId === "saturn") return "longTerm";
    return "attraction";
  }
  const points = evidence.points.map((point) => point.pointId);
  if (points.every((point) => point === "mars")) return "conflictPatterns";
  if (points.includes("sun") && points.includes("moon")) return "emotionalSecurity";
  if (points.includes("mercury")) return "communication";
  if (points.includes("venus") && points.includes("mars")) return "intimacyDesire";
  if (points.includes("saturn")) return "longTerm";
  if (points.includes("moon")) return "emotionalSecurity";
  if (points.includes("venus")) return "attraction";
  if (points.includes("mars") && (points.includes("pluto") || points.includes("uranus"))) return "conflictPatterns";
  if (points.includes("mars")) return "intimacyDesire";
  if (points.includes("jupiter") && points.includes("neptune")) return "longTerm";
  return "attraction";
}
function linksFor(evidence: SynastryRawEvidence, subjects: [SynastrySubject, SynastrySubject], indexes: Map<string, Map<WesternPointId, string[]>>): NatalFactLink[] {
  const subject = (id: string) => subjects.find((item) => item.personId === id)!;
  if (evidence.kind === "cross-aspect") return evidence.points.map((point) => linkForPoint(subject(point.personId), point.pointId, indexes));
  if (evidence.kind === "angle-aspect") return [linkForPoint(subject(evidence.sourcePersonId), evidence.sourcePointId, indexes), { personId: evidence.targetPersonId, kind: "structural-context", factIds: [], context: { sign: "angle", house: evidence.targetAngleId === "midheaven" ? 10 : evidence.targetAngleId === "descendant" ? 7 : 1, natalAspectLabels: [] } }];
  const sourceLink = linkForPoint(subject(evidence.sourcePersonId), evidence.sourcePointId, indexes);
  return [sourceLink, { personId: evidence.targetPersonId, kind: "structural-context", factIds: [], context: { sign: "overlay", house: evidence.targetHouse, natalAspectLabels: [] } }];
}
function modifier(type?: string) { return type === "square" || type === "opposition" ? "서로 다른 반응 속도를 조정해야 이 힘을 건설적으로 쓸 수 있습니다" : type === "conjunction" ? "같은 주제가 강하게 부각되므로 경계와 역할을 분명히 할 필요가 있습니다" : "서로의 방식을 연결해 실제 관계에서 활용하기 비교적 수월합니다"; }
function crossMeaning(view: SynastryEvidenceView & { raw: CrossAspectEvidence }): string {
  const points = new Set(view.raw.points.map((point) => point.pointId));
  let sentence: string;
  if (points.has("venus") && points.has("mars")) sentence = "호감을 표현하는 방식과 욕구를 행동으로 옮기는 방식이 맞물립니다";
  else if (points.has("mars") && points.size === 1) sentence = "행동 속도와 주도권을 잡는 방식이 맞물립니다";
  else if (points.has("sun") && points.has("moon")) sentence = "한 사람의 자기표현과 다른 사람의 감정 반응이 맞물립니다";
  else if (points.has("mercury") && points.has("moon")) sentence = "감정을 말로 이해하고 생각을 함께 정리하는 통로가 형성됩니다";
  else if (points.has("mercury")) sentence = "생각과 판단 기준을 대화로 연결하는 통로가 형성됩니다";
  else if (points.has("mars") && points.has("pluto")) sentence = "행동의 강도와 끝까지 밀어붙이는 힘이 맞물립니다";
  else if (points.has("saturn")) sentence = "관계를 지속하는 책임과 현실적인 조율 방식이 구체화됩니다";
  else if (points.has("jupiter") && points.has("neptune")) sentence = "함께 그리고 싶은 가능성과 이상을 현실에서 조율하는 방식이 드러납니다";
  else if (points.has("venus")) sentence = "서로의 호감과 가치 기준이 만나 취향을 나누는 방식이 드러납니다";
  else if (points.has("moon")) sentence = "한 사람의 감정 반응이 다른 사람의 선택과 표현에 직접 닿습니다";
  else sentence = "서로의 자기표현과 변화 욕구가 만나 관계의 자극점이 드러납니다";
  return `${sentence}. ${modifier(view.raw.type)}`;
}
function meaning(view: SynastryEvidenceView): string {
  const raw = view.raw;
  if (raw.kind === "house-overlay") {
    const houseText = { 1: "존재감과 즉각적인 반응", 4: "사적 안정과 생활 기반", 5: "설렘과 놀이의 표현", 7: "파트너십 기대", 8: "깊은 친밀감과 공유의 경계", 10: "사회적 방향과 역할" }[raw.targetHouse];
    return `상대 차트에서 ${houseText}에 해당하는 영역이 활성화됩니다. 이 배치는 다른 상호작용 근거와 함께 볼 때 관계가 체감되는 자리를 구체화합니다`;
  }
  if (raw.kind === "angle-aspect") {
    const target = raw.targetAngleId === "ascendant" ? "존재감과 즉각적인 반응" : raw.targetAngleId === "descendant" ? "파트너십 기대" : "사회적 방향과 역할";
    return `한 사람의 핵심 기능이 상대 차트의 ${target} 지점을 직접 자극합니다. ${modifier(raw.type)}`;
  }
  return crossMeaning(view as SynastryEvidenceView & { raw: CrossAspectEvidence });
}
function label(raw: SynastryRawEvidence) {
  if (raw.kind === "house-overlay") return `${raw.sourcePersonId} ${raw.sourcePointId} → ${raw.targetPersonId} ${raw.targetHouse}H`;
  if (raw.kind === "angle-aspect") return `${raw.sourcePersonId} ${raw.sourcePointId} ${raw.type} ${raw.targetPersonId} ${raw.targetAngleId} orb ${raw.orb.toFixed(3)}°`;
  return `${raw.points[0].personId} ${raw.points[0].pointId} ${raw.type} ${raw.points[1].personId} ${raw.points[1].pointId} orb ${raw.orb.toFixed(3)}°`;
}
function evidenceOrder(a: SynastryRawEvidence, b: SynastryRawEvidence) {
  const aBand = a.kind === "house-overlay" ? 2 : BAND_ORDER[a.orbBand], bBand = b.kind === "house-overlay" ? 2 : BAND_ORDER[b.orbBand];
  return aBand - bBand || KIND_ORDER[a.kind] - KIND_ORDER[b.kind] || a.id.localeCompare(b.id);
}
function section(key: SynastrySectionKey, facts: SynastryFact[], references: string[] = []): SynastrySection { return { key, title: TITLES[key], text: facts.map((fact) => `${fact.meaning.replace(/[.!?]+$/, "")}.`).join(" "), facts, primaryEvidence: facts.flatMap((fact) => fact.evidence), referencedFactIds: references }; }

export function buildWesternSynastryReport(first: SynastrySubject, second: SynastrySubject): WesternSynastryReport {
  const subjects = [first, second].sort((a, b) => a.personId.localeCompare(b.personId)) as [SynastrySubject, SynastrySubject];
  const evidence = calculateSynastryEvidence(subjects[0], subjects[1]);
  const rulerships = Object.fromEntries(subjects.map((subject) => [subject.personId, rulership(subject)]));
  const links = rulerLinks(subjects, evidence.crossAspects, rulerships), primaryRulerCrossIds = new Set(links.filter((link) => link.rulerRole === "primary").map((link) => link.crossAspectId));
  const indexes = new Map(subjects.map((subject) => [subject.personId, factIndex(subject.chart)]));
  const raw = [...evidence.crossAspects, ...evidence.angleAspects, ...evidence.overlays].sort(evidenceOrder);
  const grouped = new Map<SynastrySectionKey, SynastryEvidenceView[]>();
  for (const item of raw) {
    const owner = ownerFor(item, primaryRulerCrossIds); item.primaryOwnerSection = owner;
    const views = grouped.get(owner) ?? [];
    if (views.length < 4) views.push({ id: item.id, label: label(item), raw: item, natalLinks: linksFor(item, subjects, indexes), primaryOwnerSection: owner });
    grouped.set(owner, views);
  }
  const detailKeys: SynastrySectionKey[] = ["attraction", "emotionalSecurity", "communication", "intimacyDesire", "conflictPatterns", "longTerm"];
  const details = detailKeys.map((key) => {
    const views = grouped.get(key) ?? [];
    const facts = views.map((view): SynastryFact => ({ id: `synastry-fact:${view.id}`, domain: "westernSynastry", meaning: meaning(view), polarity: "neutral", strength: 1, evidence: [view], primaryOwnerSection: key, concepts: [key] }));
    return section(key, facts);
  });
  const detailFacts = details.flatMap((item) => item.facts);
  const overviewSources = details.map((item) => item.facts[0]).filter(Boolean).slice(0, 4);
  const overviewFact: SynastryFact = { id: `synastry-fact:${evidence.pairId}:overview`, domain: "westernSynastry", meaning: overviewSources.map((fact) => fact.meaning.split(".")[0]).join(". "), polarity: "neutral", strength: 1, evidence: [], primaryOwnerSection: "overview", concepts: ["overview"] };
  const operationSources = [details[1], details[2], details[3], details[4]].flatMap((item) => item.facts.slice(0, 1));
  const operationsFact: SynastryFact = { id: `synastry-fact:${evidence.pairId}:operations`, domain: "westernSynastry", meaning: "감정의 반응 속도와 대화 방식을 확인하고, 친밀감과 갈등이 같은 힘겨루기로 번지기 전에 역할과 경계를 합의하는 것이 중요합니다", polarity: "neutral", strength: 1, evidence: [], primaryOwnerSection: "operations", concepts: ["operations"] };
  return { schemaVersion: "western-synastry/v1", pairId: evidence.pairId, subjects, evidence, rulership: rulerships, rulerLinks: links, sections: [section("overview", [overviewFact], overviewSources.map((fact) => fact.id)), ...details, section("operations", [operationsFact], operationSources.map((fact) => fact.id))] };
}
