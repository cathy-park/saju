import { mapIntegratedFact } from "./taxonomy";
import type { IntegratedProvenance, IntegratedReport, IntegratedSection, IntegratedSectionKey, IntegratedSourceFact, IntegratedSynthesisFact, IntegratedSystem, SelectedPeriod, TimingConvergence } from "./types";

const SYSTEMS: IntegratedSystem[] = ["saju", "ziwei", "western"];
const unique = <T>(values: T[]): T[] => [...new Set(values)];
const eligible = (source: IntegratedSourceFact) => source.sourceKind !== "summary" && source.sourceKind !== "operations" && source.sourceKind !== "score" && source.evidence.length > 0;
const sourceKey = (source: IntegratedSourceFact) => `${source.system}:${source.module}:${source.factId}`;
const owner: Record<string, IntegratedSectionKey> = { selfDirection: "coreNature", emotionProcessing: "emotionRelationship", thinkingCommunication: "emotionalCommunication", actionDrive: "workCareer", relationshipNeeds: "emotionRelationship", intimacyConflict: "attractionIntimacy", longTermRelationship: "longTerm", careerResponsibility: "workCareer", moneyReality: "moneyReality", growthChange: "strengthGrowth" };
const titles: Record<IntegratedSectionKey, string> = { overview: "한눈에 보는 나", coreNature: "핵심 성향", emotionRelationship: "감정·관계", workCareer: "일·커리어", moneyReality: "재물·현실", strengthGrowth: "강점과 성장", currentFlow: "현재 흐름", relationshipCore: "관계의 핵심 구조", attractionIntimacy: "끌림·친밀감", emotionalCommunication: "감정·소통", conflictAdjustment: "갈등·조율", longTerm: "장기 지속 구조" };

function normalize(sources: IntegratedSourceFact[]) {
  const accepted = sources.filter(eligible);
  const mapped: IntegratedProvenance[] = [], unmapped: IntegratedSourceFact[] = [];
  for (const source of accepted) { const mapping = mapIntegratedFact(source); mapping ? mapped.push({ ...source, mapping }) : unmapped.push(source); }
  const evidenceIds = accepted.flatMap((source) => source.evidence.map((item) => item.id));
  return { accepted, mapped, unmapped, uniqueEvidence: unique(evidenceIds), duplicated: unique(evidenceIds.filter((id, index) => evidenceIds.indexOf(id) !== index)), excluded: sources.filter((source) => !eligible(source)).map(sourceKey) };
}

function synthesisMeaning(concept: string, kind: IntegratedSynthesisFact["relationKind"], systems: IntegratedSystem[]): string {
  const label: Record<string, string> = { autonomy: "자기 기준을 지키며 주도적으로 선택하는 경향", execution: "생각을 실제 행동과 결과로 연결하는 방식", "relationship-communication": "감정과 생각을 대화로 확인하고 조율하는 방식", attraction: "호감과 친밀감이 형성되는 방식", "conflict-adjustment": "반응 속도와 힘의 강도를 조율하는 방식", "sustainable-structure": "책임과 생활 기반을 함께 세우는 장기 관계 방식", "practical-output": "현실적인 성과와 기반을 만드는 방식" };
  const subject = label[concept] ?? "서로 다른 삶의 측면";
  if (kind === "consensus") return `${systems.length === 2 ? "두 체계" : "여러 체계"}가 공통으로 ${subject}을 가리킵니다. 이는 정확도나 확률의 상승이 아니라 서로 다른 관점에서 같은 방향이 확인된다는 뜻입니다`;
  if (kind === "tension") return `${subject} 안에서 서로 반대되는 요구가 함께 확인되어, 상황에 따라 우선순위를 분명히 할 필요가 있습니다`;
  return `${subject}에 서로 다른 측면이 더해져, 함께 볼 때 행동의 조건과 맥락이 구체화됩니다`;
}

function buildFacts(mapped: IntegratedProvenance[], relationship: boolean): { facts: IntegratedSynthesisFact[]; used: Set<string> } {
  const groups = new Map<string, IntegratedProvenance[]>();
  for (const source of mapped) { const key = `${source.mapping.theme}:${source.mapping.concept}`; groups.set(key, [...(groups.get(key) ?? []), source]); }
  const facts: IntegratedSynthesisFact[] = [], used = new Set<string>();
  for (const [key, all] of [...groups].sort(([a], [b]) => a.localeCompare(b))) {
    const deduped = all.filter((source, index) => all.findIndex((candidate) => candidate.system === source.system && candidate.evidence.some((evidence) => source.evidence.some((own) => own.id === evidence.id))) === index);
    const dyadicSystems = unique(deduped.filter((source) => source.evidenceRole === "dyadic-evidence").map((source) => source.system)).sort();
    const systems = unique(deduped.map((source) => source.system)).sort();
    const directions = unique(deduped.map((source) => source.mapping.direction));
    let kind: IntegratedSynthesisFact["relationKind"] | null = null;
    if ((!relationship && systems.length >= 2 || relationship && dyadicSystems.length >= 2) && directions.length === 1) kind = "consensus";
    else if (systems.length >= 2 && (!relationship || dyadicSystems.length >= 1) && directions.length >= 1) kind = "complement";
    if (!kind) continue;
    const [theme, concept] = key.split(":") as [IntegratedProvenance["mapping"]["theme"], string];
    const primaryOwnerSection = relationship ? (concept === "relationship-communication" ? "emotionalCommunication" : concept === "sustainable-structure" ? "longTerm" : concept === "conflict-adjustment" ? "conflictAdjustment" : "attractionIntimacy") : owner[theme];
    const fact: IntegratedSynthesisFact = { id: `integrated:${relationship ? "relationship" : "personal"}:${theme}:${concept}`, theme, concept, direction: directions.join("+"), meaning: synthesisMeaning(concept, kind, relationship ? dyadicSystems : systems), relationKind: kind, sources: deduped, sourceSystems: systems, dyadicSystems, primaryOwnerSection };
    facts.push(fact); deduped.forEach((source) => used.add(sourceKey(source)));
  }
  return { facts, used };
}

const overlaps = (a: { start: string; end: string }, b: { start: string; end: string }) => a.start <= b.end && b.start <= a.end;
function timing(mapped: IntegratedProvenance[], selected?: SelectedPeriod): TimingConvergence[] {
  if (!selected) return [];
  const timed = mapped.filter((source) => source.temporalScope && overlaps(source.temporalScope, selected));
  const groups = new Map<string, IntegratedProvenance[]>();
  for (const source of timed) { const key = `${source.mapping.theme}:${source.mapping.concept}`; groups.set(key, [...(groups.get(key) ?? []), source]); }
  return [...groups].flatMap(([key, sources]) => {
    const systems = unique(sources.map((source) => source.system)); if (systems.length < 2) return [];
    const pair = sources.find((a) => sources.some((b) => a !== b && overlaps(a.temporalScope!, b.temporalScope!))); if (!pair) return [];
    const start = sources.map((source) => source.temporalScope!.start).sort().at(-1)!; const end = sources.map((source) => source.temporalScope!.end).sort()[0];
    const granularities = new Set(sources.map((source) => source.temporalScope!.granularity)); const precision = granularities.has("year") && (granularities.has("month") || granularities.has("instant-window")) ? "연간 배경과 월간 활성" : "서로 겹치는 기간의 활성";
    const [theme, concept] = key.split(":") as [TimingConvergence["theme"], string];
    return [{ id: `integrated:timing:${theme}:${concept}:${start}`, theme, concept, meaning: `${precision}에서 같은 주제가 함께 확인됩니다. 같은 사건을 뜻하지는 않습니다`, sources, overlap: { start, end } }];
  });
}

function sectionsFor(facts: IntegratedSynthesisFact[], scope: "personal" | "relationship", timingFacts: TimingConvergence[]): IntegratedSection[] {
  const keys: IntegratedSectionKey[] = scope === "personal" ? ["coreNature", "emotionRelationship", "workCareer", "moneyReality", "strengthGrowth"] : ["attractionIntimacy", "emotionalCommunication", "conflictAdjustment", "longTerm"];
  const details: IntegratedSection[] = keys.map((key): IntegratedSection => { const selected = facts.filter((fact) => fact.primaryOwnerSection === key); return { key, title: titles[key], text: selected.map((fact) => `${fact.meaning.replace(/[.!?]+$/, "")}.`).join(" "), facts: selected, referencedFactIds: [] }; }).filter((section) => section.facts.length);
  if (timingFacts.length) details.push({ key: "currentFlow", title: titles.currentFlow, text: timingFacts.map((fact) => `${fact.meaning}.`).join(" "), facts: [], referencedFactIds: timingFacts.map((fact) => fact.id) });
  const overviewKey = scope === "personal" ? "overview" : "relationshipCore"; const refs = details.flatMap((section) => section.facts).slice(0, 4).map((fact) => fact.id);
  return [{ key: overviewKey, title: scope === "personal" ? titles.overview : titles.relationshipCore, text: details.slice(0, 3).map((section) => section.text).join(" "), facts: [], referencedFactIds: refs }, ...details];
}

function build(scope: "personal" | "relationship", subjectId: string, sources: IntegratedSourceFact[], selectedPeriod?: SelectedPeriod): IntegratedReport {
  const normalized = normalize(sources); const built = buildFacts(normalized.mapped.filter((source) => !source.temporalScope), scope === "relationship"); const timingConvergences = timing(normalized.mapped, selectedPeriod);
  const availableSystems = unique(sources.map((source) => source.system)).sort();
  return { schemaVersion: "integrated-report/v1", scope, subjectId, availableSystems, missingSystems: SYSTEMS.filter((system) => !availableSystems.includes(system)), sections: sectionsFor(built.facts, scope, timingConvergences), timingConvergences, standaloneFacts: normalized.mapped.filter((source) => !built.used.has(sourceKey(source))), unmappedFacts: normalized.unmapped, sourceAudit: { inputFactCount: sources.length, eligibleFactCount: normalized.accepted.length, uniqueEvidenceCount: normalized.uniqueEvidence.length, excludedFactIds: normalized.excluded, dedupedEvidenceIds: normalized.duplicated } };
}
export const buildIntegratedPersonalReport = (input: { personId: string; sources: IntegratedSourceFact[]; selectedPeriod?: SelectedPeriod }) => build("personal", input.personId, input.sources, input.selectedPeriod);
export const buildIntegratedRelationshipReport = (input: { pairId: string; sources: IntegratedSourceFact[]; selectedPeriod?: SelectedPeriod }) => build("relationship", input.pairId, input.sources, input.selectedPeriod);
