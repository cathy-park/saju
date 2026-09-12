import type { IntegratedSourceFact, TaxonomyMapping } from "./types";

interface Rule { id: string; system: IntegratedSourceFact["system"]; module: RegExp; fact: RegExp; mapping: Omit<TaxonomyMapping, "ruleId"> }
const rule = (id: string, system: Rule["system"], module: RegExp, fact: RegExp, theme: TaxonomyMapping["theme"], concept: string, direction: string): Rule => ({ id, system, module, fact, mapping: { theme, concept, direction } });

/** Explicit whitelist only. Meanings and keywords are deliberately not inspected. */
export const INTEGRATED_TAXONOMY_RULES: readonly Rule[] = [
  rule("saju.summary.r05", "saju", /^summary$/, /^rule-R05-/, "selfDirection", "autonomy", "independent"),
  rule("saju.summary.r09", "saju", /^summary$/, /^rule-R09-/, "selfDirection", "autonomy", "independent"),
  rule("saju.summary.r06", "saju", /^summary$/, /^rule-R06-/, "actionDrive", "execution", "initiating"),
  rule("saju.summary.r11", "saju", /^summary$/, /^rule-R11-/, "actionDrive", "decision-consistency", "variable"),
  rule("saju.summary.work", "saju", /^summary$/, /^(tenGod-wealth|work|career)/, "careerResponsibility", "practical-output", "building"),
  rule("saju.summary.relationship", "saju", /^summary$/, /^(tenGod-relationship|romance)/, "relationshipNeeds", "relational-autonomy", "independent"),
  rule("saju.compat.communication", "saju", /^compatibility$/, /^(emotion|communication|satisfaction)/, "thinkingCommunication", "relationship-communication", "connecting"),
  rule("saju.compat.attraction", "saju", /^compatibility$/, /^attraction-/, "intimacyConflict", "attraction", "engaging"),
  rule("saju.compat.conflict", "saju", /^compatibility$/, /^(conflict|adjustment)/, "intimacyConflict", "conflict-adjustment", "adjusting"),
  rule("saju.compat.long", "saju", /^compatibility$/, /^(long|marriage)/, "longTermRelationship", "sustainable-structure", "building"),
  rule("ziwei.nature.leadership", "ziwei", /^comprehensive$/, /^(coreNature-0|lifeAttitude-0)$/, "selfDirection", "autonomy", "independent"),
  rule("ziwei.nature.foundation", "ziwei", /^comprehensive$/, /^(lifeDirection-0|lifeAttitude-1)$/, "careerResponsibility", "practical-output", "building"),
  rule("ziwei.work", "ziwei", /^comprehensive$/, /^(coreCareer|workStyle|achievementVolatility)-/, "careerResponsibility", "work-responsibility", "building"),
  rule("ziwei.wealth", "ziwei", /^comprehensive$/, /^(coreWealth|incomeStyle|spendingTendency|wealthVolatility)-/, "moneyReality", "resource-management", "building"),
  rule("ziwei.relationship.communication", "ziwei", /^(comprehensive|relationship-context)$/, /^(conflict|management|relationship)-/, "thinkingCommunication", "relationship-communication", "connecting"),
  rule("ziwei.relationship.long", "ziwei", /^(comprehensive|relationship-context)$/, /^(coreImage|compatibility|personality)-/, "longTermRelationship", "partner-context", "supporting"),
  rule("ziwei.timing.relationship", "ziwei", /^timing$/, /^upcoming-2026$/, "relationshipNeeds", "relationship-adjustment", "adjusting"),
  rule("western.overview.core", "western", /^overview$/, /^synthesis:[^:]+:core$/, "selfDirection", "autonomy", "independent"),
  rule("western.overview.emotion", "western", /^overview$/, /^synthesis:[^:]+:emotion$/, "emotionProcessing", "emotional-clarity", "clarifying"),
  rule("western.overview.action", "western", /^overview$/, /^synthesis:[^:]+:action$/, "actionDrive", "execution", "deliberate"),
  rule("western.overview.strength", "western", /^overview$/, /^synthesis:[^:]+:strength$/, "growthChange", "sustainable-change", "building"),
  rule("western.synastry.communication", "western", /^synastry$/, /communication|mercury.*moon|moon.*mercury/, "thinkingCommunication", "relationship-communication", "connecting"),
  rule("western.synastry.emotional", "western", /^synastry$/, /:emotional$/, "thinkingCommunication", "relationship-communication", "connecting"),
  rule("western.synastry.attraction", "western", /^synastry$/, /attraction|mars.*venus|venus.*mars/, "intimacyConflict", "attraction", "engaging"),
  rule("western.synastry.conflict-synthesis", "western", /^synastry$/, /:conflict$/, "intimacyConflict", "conflict-adjustment", "adjusting"),
  rule("western.synastry.conflict", "western", /^synastry$/, /conflict|mars.*mars|mars.*pluto/, "intimacyConflict", "conflict-adjustment", "adjusting"),
  rule("western.synastry.long-synthesis", "western", /^synastry$/, /:long-term$/, "longTermRelationship", "sustainable-structure", "building"),
  rule("western.synastry.long", "western", /^synastry$/, /long|saturn/, "longTermRelationship", "sustainable-structure", "building"),
  rule("western.transit.relationship", "western", /^transit$/, /jupiter:(venus:opposition|mars:square)/, "relationshipNeeds", "relationship-adjustment", "adjusting"),
];

export function mapIntegratedFact(source: IntegratedSourceFact): TaxonomyMapping | null {
  const match = INTEGRATED_TAXONOMY_RULES.find((candidate) => candidate.system === source.system && candidate.module.test(source.module) && candidate.fact.test(source.factId));
  return match ? { ruleId: match.id, ...match.mapping } : null;
}
