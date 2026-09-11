import type { Polarity } from "@/lib/reportFacts";
import type { AspectType, PlanetId, WesternAspect, WesternNatalChart } from "../types.js";
import { ASPECT_PAIR_RULES, ASPECT_TYPE_RULES, ORB_BAND_ORDER, PLANET_ROLE_RULES, orbBand, pairKey } from "./rules/aspectRules.js";
import { HOUSE_RULES } from "./rules/houseRules.js";
import { signRuleAt } from "./rules/signRules.js";
import { ascendantEvidence, aspectEvidence, placementEvidence, pointById } from "./evidence.js";
import { detectChartEmphasis } from "./emphasis.js";
import { synthesizeWesternFacts } from "./synthesis.js";
import type { WesternPersonalityFact, WesternPersonalityReport, WesternPersonalitySection, WesternSectionKey } from "./types.js";

const TITLES: Record<WesternSectionKey, string> = { atAGlance: "한눈에 보는 나", coreNature: "핵심 성향", emotionalInner: "감정·내면", thinkingCommunication: "사고·소통", actionDrive: "행동·추진력", strengths: "강점", cautions: "주의할 점" };

function aspectsFor(chart: WesternNatalChart, id: PlanetId): WesternAspect[] {
  return chart.aspects.filter((aspect) => aspect.point1Id === id || aspect.point2Id === id)
    .sort((a, b) => ORB_BAND_ORDER[orbBand(a.orb)] - ORB_BAND_ORDER[orbBand(b.orb)] || a.orb - b.orb || a.type.localeCompare(b.type));
}

function otherId(aspect: WesternAspect, id: PlanetId): PlanetId { return (aspect.point1Id === id ? aspect.point2Id : aspect.point1Id) as PlanetId; }
function aspectMeaning(aspect: WesternAspect, anchor: PlanetId): string {
  const specific = ASPECT_PAIR_RULES[pairKey(anchor, otherId(aspect, anchor))]?.[aspect.type];
  if (specific) return specific;
  return `${PLANET_ROLE_RULES[anchor].role}과 ${PLANET_ROLE_RULES[otherId(aspect, anchor)].role}가 맞물릴 때 ${ASPECT_TYPE_RULES[aspect.type].connector}`;
}

function placementAspectFact(chart: WesternNatalChart, id: PlanetId, domain: string, aspectIndex = 0): WesternPersonalityFact | null {
  const point = pointById(chart, id), aspect = aspectsFor(chart, id)[aspectIndex];
  if (!aspect) return null;
  const sign = signRuleAt(point.longitude), house = HOUSE_RULES[point.house];
  const relation = ASPECT_TYPE_RULES[aspect.type].relation;
  const polarity: Polarity = relation === "support" ? "positive" : relation === "tension" ? "mixed" : "neutral";
  return {
    id: `${domain}:${id}:${aspect.point1Id}:${aspect.point2Id}:${aspect.type}`, domain,
    meaning: `${sign.style} 방식으로 ${house.arena}에서 ${PLANET_ROLE_RULES[id].action}. ${aspectMeaning(aspect, id)}`,
    polarity, strength: 1,
    concepts: [sign.concept, house.theme, PLANET_ROLE_RULES[id].role],
    evidence: [placementEvidence(point), aspectEvidence(aspect)],
  };
}

function identityFact(chart: WesternNatalChart): WesternPersonalityFact | null {
  const sun = pointById(chart, "sun"), aspect = aspectsFor(chart, "sun")[0];
  if (!aspect) return null;
  const sunSign = signRuleAt(sun.longitude), ascSign = signRuleAt(chart.angles.ascendant.longitude);
  return { id: "core:identity", domain: "identity", meaning: `${sunSign.style} 기준을 중심에 두고, 새로운 상황에서는 ${ascSign.style} 태도로 접근합니다. ${aspectMeaning(aspect, "sun")}`, polarity: "mixed", strength: 1, concepts: [sunSign.concept, ascSign.concept], evidence: [placementEvidence(sun), ascendantEvidence(chart), aspectEvidence(aspect)] };
}

function structuralStrengthFact(chart: WesternNatalChart): WesternPersonalityFact | null {
  const saturn = pointById(chart, "saturn"), uranus = pointById(chart, "uranus");
  const saturnAspect = aspectsFor(chart, "saturn")[1], uranusAspect = aspectsFor(chart, "uranus")[2];
  if (!saturnAspect || !uranusAspect) return null;
  return {
    id: "strength:structure-and-renewal", domain: "strength",
    meaning: "사적인 기반을 다질 때 장기 기준과 책임 구조를 세우면서도, 필요하면 익숙한 방식을 벗어난 선택지로 다시 설계합니다. 막연한 가능성을 지속 가능한 형태로 만드는 힘이 있습니다",
    polarity: "positive", strength: 1, concepts: ["structure", "renewal", "foundation"],
    evidence: [placementEvidence(saturn), aspectEvidence(saturnAspect), placementEvidence(uranus), aspectEvidence(uranusAspect)],
  };
}

function emphasisFacts(chart: WesternNatalChart): WesternPersonalityFact[] {
  const placements = new Map(chart.points.map((point) => [`placement:${point.id}`, placementEvidence(point)]));
  return detectChartEmphasis(chart).map((item) => ({ id: `emphasis:${item.id}`, domain: "emphasis", meaning: item.meaning, polarity: "neutral" as const, strength: 1, concepts: [item.id], evidence: [{ id: `emphasis:${item.id}`, kind: "emphasis" as const, label: `${item.id} repeated across ${item.sourceEvidenceIds.length} independent placements`, sourcePointIds: item.sourceEvidenceIds.flatMap((id) => placements.get(id)?.sourcePointIds ?? []) }] }));
}

function unique<T extends { id: string }>(items: T[]): T[] { return [...new Map(items.map((item) => [item.id, item])).values()]; }
function section(key: WesternSectionKey, facts: (WesternPersonalityFact | null)[]): WesternPersonalitySection {
  const selected = unique(facts.filter((fact): fact is WesternPersonalityFact => !!fact)).slice(0, 4);
  return { key, title: TITLES[key], text: synthesizeWesternFacts(selected), facts: selected, evidence: unique(selected.flatMap((fact) => fact.evidence)) };
}

export function buildWesternPersonalityReport(chart: WesternNatalChart): WesternPersonalityReport {
  const emphasis = detectChartEmphasis(chart);
  const sections = [
    section("atAGlance", emphasisFacts(chart)),
    section("coreNature", [identityFact(chart), placementAspectFact(chart, "pluto", "transformation", 0)]),
    section("emotionalInner", [placementAspectFact(chart, "moon", "emotion", 0)]),
    section("thinkingCommunication", [placementAspectFact(chart, "mercury", "thinking", 0)]),
    section("actionDrive", [placementAspectFact(chart, "mars", "action", 1)]),
    section("strengths", [structuralStrengthFact(chart)]),
    section("cautions", [placementAspectFact(chart, "venus", "caution", 0)]),
  ].filter((item) => item.facts.length > 0);
  return { chart, emphasis, sections };
}
