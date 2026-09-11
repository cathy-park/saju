import type { PlanetId, WesternAspect, WesternNatalChart, WesternPoint } from "../../types.js";
import { HOUSE_RULES } from "../rules/houseRules.js";
import { ORB_BAND_ORDER, orbBand, pairKey } from "../rules/aspectRules.js";
import { signRuleAt } from "../rules/signRules.js";
import { RelationshipEvidenceAllocator } from "./evidenceOwnership.js";
import { RELATIONSHIP_ASPECT_RULES, RELATIONSHIP_SIGN_RULES, RULER_HOUSE_RULES, SIGN_RULERS } from "./rules.js";
import type { HouseRulership, RelationshipEvidence, RelationshipFact, RelationshipSection, RelationshipSectionKey, WesternRelationshipReport } from "./types.js";

const TITLES: Record<RelationshipSectionKey, string> = {
  overview: "한눈에 보는 연애", attraction: "끌리는 사람", affectionIntimacy: "애정 표현과 친밀감",
  relationshipNeeds: "관계에서 필요한 것", conflictPatterns: "갈등 패턴",
  longTermPartner: "장기연애·배우자", relationshipOperations: "관계 운영 포인트",
};
const clean = (text: string) => text.trim().replace(/[.!?]+$/, "");

function point(chart: WesternNatalChart, id: PlanetId): WesternPoint {
  const found = chart.points.find((item) => item.id === id);
  if (!found) throw new Error(`Missing required point: ${id}`);
  return found;
}
function aspectsFor(chart: WesternNatalChart, id: PlanetId): WesternAspect[] {
  return chart.aspects.filter((aspect) => aspect.point1Id === id || aspect.point2Id === id)
    .sort((a, b) => ORB_BAND_ORDER[orbBand(a.orb)] - ORB_BAND_ORDER[orbBand(b.orb)] || a.orb - b.orb);
}
function aspectBetween(chart: WesternNatalChart, a: PlanetId, b: PlanetId): WesternAspect | undefined {
  return chart.aspects.find((aspect) => (aspect.point1Id === a && aspect.point2Id === b) || (aspect.point1Id === b && aspect.point2Id === a));
}
function aspectRule(aspect: WesternAspect): string {
  const key = `${pairKey(aspect.point1Id as PlanetId, aspect.point2Id as PlanetId)}:${aspect.type}`;
  return RELATIONSHIP_ASPECT_RULES[key] ?? "두 욕구가 함께 작동하는 상황을 구분하고 서로의 속도를 확인해야 합니다";
}
function rulershipAt(longitude: number): HouseRulership {
  const sign = signRuleAt(longitude).name;
  const rulers = SIGN_RULERS[sign];
  return { sign, primaryRuler: rulers.primary, coRulers: rulers.coRulers };
}
function fact(id: string, owner: RelationshipSectionKey, meaning: string, evidence: (RelationshipEvidence | null | undefined)[], concepts: string[], polarity: RelationshipFact["polarity"] = "neutral"): RelationshipFact {
  return { id, domain: "westernRelationship", meaning, polarity, strength: 1, evidence: evidence.filter((item): item is RelationshipEvidence => !!item), primaryOwnerSection: owner, concepts };
}
function section(key: RelationshipSectionKey, facts: RelationshipFact[], referencedFactIds: string[] = []): RelationshipSection {
  const primaryEvidence = [...new Map(facts.flatMap((item) => item.evidence).map((item) => [item.id, item])).values()];
  return { key, title: TITLES[key], text: facts.map((item) => `${clean(item.meaning)}.`).join(" "), facts, primaryEvidence, referencedFactIds };
}
function referenceFact(id: string, owner: RelationshipSectionKey, meaning: string, references: RelationshipFact[]): RelationshipFact {
  return fact(id, owner, meaning, [], references.flatMap((item) => item.concepts));
}

export function buildWesternRelationshipReport(chart: WesternNatalChart): WesternRelationshipReport {
  const allocator = new RelationshipEvidenceAllocator();
  const fifthCusp = chart.houses.find((house) => house.number === 5)!.cuspLongitude;
  const seventhCusp = chart.houses.find((house) => house.number === 7)!.cuspLongitude;
  const fifth = rulershipAt(fifthCusp), seventh = rulershipAt(seventhCusp);
  const venus = point(chart, "venus"), mars = point(chart, "mars"), moon = point(chart, "moon");

  const attractionFact = fact("relationship:attraction-style", "attraction",
    `${RELATIONSHIP_SIGN_RULES[signRuleAt(venus.longitude).name].affection} 방식으로 호감을 표현하며, ${RELATIONSHIP_SIGN_RULES[fifth.sign].attraction} 사람과의 설렘에 반응합니다`,
    [allocator.claimPlacement(venus, "attraction"), allocator.claimCusp(5, fifth.sign, "attraction")], ["affection-style", "attraction"]);

  const venusMars = aspectBetween(chart, "venus", "mars");
  const affectionFacts = [fact("relationship:affection-drive", "affectionIntimacy",
    venusMars ? aspectRule(venusMars) : `${RELATIONSHIP_SIGN_RULES[signRuleAt(mars.longitude).name].affection} 방식으로 원하는 친밀감에 다가갑니다`,
    [allocator.claimPlacement(mars, "affectionIntimacy"), venusMars && allocator.claimAspect(venusMars, "affectionIntimacy")], ["affection", "desire"], "mixed")];
  const fifthRuler = point(chart, fifth.primaryRuler);
  const fifthRulerAspect = aspectsFor(chart, fifth.primaryRuler).find((aspect) => {
    const key = `${pairKey(aspect.point1Id as PlanetId, aspect.point2Id as PlanetId)}:${aspect.type}`;
    return !["saturn:neptune:conjunction", "moon:saturn:opposition", "venus:pluto:square", "mars:pluto:opposition"].includes(key);
  });
  affectionFacts.push(fact("relationship:fifth-ruler", "affectionIntimacy",
    `설렘을 이어갈 때는 ${RULER_HOUSE_RULES[fifthRuler.house]}을 실제 관계 안에서 확인해야 마음이 오래갑니다`,
    [allocator.claimPlacement(fifthRuler, "affectionIntimacy", "fifth-ruler"), fifthRulerAspect && allocator.claimAspect(fifthRulerAspect, "affectionIntimacy")], ["romance-continuity", HOUSE_RULES[fifthRuler.house].theme]));

  const moonSaturn = aspectBetween(chart, "moon", "saturn"), moonNeptune = aspectBetween(chart, "moon", "neptune");
  const needFacts = [fact("relationship:emotional-safety", "relationshipNeeds",
    moonSaturn ? aspectRule(moonSaturn) : `${RELATIONSHIP_SIGN_RULES[signRuleAt(moon.longitude).name].partnership} 관계에서 마음이 안정됩니다`,
    [allocator.claimPlacement(moon, "relationshipNeeds"), moonSaturn && allocator.claimAspect(moonSaturn, "relationshipNeeds")], ["emotional-safety", "responsibility"], "mixed")];
  if (moonNeptune) needFacts.push(fact("relationship:emotional-clarity", "relationshipNeeds", aspectRule(moonNeptune), [allocator.claimAspect(moonNeptune, "relationshipNeeds")], ["empathy", "clarity"], "mixed"));

  const venusPluto = aspectBetween(chart, "venus", "pluto"), marsPluto = aspectBetween(chart, "mars", "pluto");
  const conflictFacts: RelationshipFact[] = [];
  if (venusPluto) conflictFacts.push(fact("relationship:depth-boundary", "conflictPatterns", aspectRule(venusPluto), [allocator.claimPlacement(point(chart, "pluto"), "conflictPatterns"), allocator.claimAspect(venusPluto, "conflictPatterns")], ["depth", "boundary"], "mixed"));
  if (marsPluto) conflictFacts.push(fact("relationship:power-pacing", "conflictPatterns", aspectRule(marsPluto), [allocator.claimAspect(marsPluto, "conflictPatterns")], ["power", "pacing"], "mixed"));

  const primaryRuler = point(chart, seventh.primaryRuler);
  const rulerAspects = aspectsFor(chart, seventh.primaryRuler).slice(0, 2);
  const primaryEvidence: (RelationshipEvidence | null)[] = [allocator.claimCusp(7, seventh.sign, "longTermPartner"), allocator.claimPlacement(primaryRuler, "longTermPartner", "primary-ruler")];
  for (const aspect of rulerAspects) primaryEvidence.push(allocator.claimAspect(aspect, "longTermPartner"));
  const longTermFacts = [fact("relationship:seventh-ruler", "longTermPartner",
    `${RELATIONSHIP_SIGN_RULES[seventh.sign].partnership} 관계를 원하며, 장기적으로는 ${RULER_HOUSE_RULES[primaryRuler.house]}을 이어갈 수 있는지가 중요합니다${rulerAspects.length ? `. ${rulerAspects.map(aspectRule).join(". ")}` : ""}`,
    primaryEvidence, ["partnership", HOUSE_RULES[primaryRuler.house].theme], "mixed")];
  const coRuler = seventh.coRulers[0];
  if (coRuler) {
    const coPoint = point(chart, coRuler), coAspect = aspectsFor(chart, coRuler).find((aspect) => pairKey(aspect.point1Id as PlanetId, aspect.point2Id as PlanetId) === "saturn:neptune") ?? aspectsFor(chart, coRuler)[0];
    longTermFacts.push(fact("relationship:seventh-co-ruler", "longTermPartner",
      coAspect ? aspectRule(coAspect) : "공감과 이상은 현실적인 약속과 경계를 갖출 때 장기 관계를 보완합니다",
      [allocator.claimPlacement(coPoint, "longTermPartner", "co-ruler"), coAspect && allocator.claimAspect(coAspect, "longTermPartner")], ["co-ruler", "sustainable-ideal"]));
  }

  const overviewSources = [attractionFact, needFacts[0], conflictFacts[0], longTermFacts[0]].filter(Boolean);
  const overviewFact = referenceFact("relationship:overview", "overview",
    "자기다운 교류와 분명한 끌림을 중요하게 여기며, 가까워질수록 정서적 안전과 현실적인 지속 가능성을 함께 확인하는 연애 구조입니다", overviewSources);
  const operationSources = [affectionFacts[0], ...needFacts, ...conflictFacts, ...longTermFacts].slice(0, 4);
  const operationsFact = referenceFact("relationship:operations", "relationshipOperations",
    "호감의 속도와 행동의 속도를 맞추고, 짐작한 감정보다 실제 필요를 확인하며, 갈등이 힘겨루기가 되기 전에 멈출 기준을 합의하는 것이 중요합니다", operationSources);

  const sections = [
    section("overview", [overviewFact], overviewSources.map((item) => item.id)),
    section("attraction", [attractionFact]), section("affectionIntimacy", affectionFacts),
    section("relationshipNeeds", needFacts), section("conflictPatterns", conflictFacts),
    section("longTermPartner", longTermFacts),
    section("relationshipOperations", [operationsFact], operationSources.map((item) => item.id)),
  ].filter((item) => item.facts.length > 0);
  return { chart, rulership: { fifth, seventh }, sections };
}
