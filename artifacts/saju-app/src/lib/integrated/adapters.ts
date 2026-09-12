import type { SajuSummarySection } from "../sajuSummaryFacts";
import type { SajuCompatibilitySummarySection } from "../sajuCompatibilityFacts";
import type { ComprehensiveReport } from "../ziwei/reports/comprehensiveReport";
import type { WesternPersonalSynthesisReport, WesternRelationshipSynthesisReport } from "../western/synthesis";
import type { IntegratedEvidenceRef, IntegratedSourceFact, TemporalScope } from "./types";

const safe = (value: string) => encodeURIComponent(value.trim().replace(/\s+/g, " "));
const evidence = (system: IntegratedSourceFact["system"], items: { id?: string; label?: string; value?: string; type?: string; source?: string }[]): IntegratedEvidenceRef[] => items.map((item) => {
  const label = item.label ?? item.value ?? item.id ?? "근거";
  return { id: `${system}:${safe(`${item.type ?? "evidence"}|${label}|${item.source ?? ""}`)}`, label };
});

export function adaptSajuPersonal(sections: SajuSummarySection[], personId: string): IntegratedSourceFact[] {
  return sections.filter((section) => section.key !== "atAGlance").flatMap((section) => section.facts.map((fact) => ({ system: "saju" as const, module: "summary", factId: fact.id, personId, meaning: fact.meaning, evidence: evidence("saju", fact.evidence), evidenceRole: "individual-context" as const })));
}

export function adaptSajuRelationship(sections: SajuCompatibilitySummarySection[]): IntegratedSourceFact[] {
  return sections.flatMap((section) => section.facts.map((fact) => ({ system: "saju" as const, module: "compatibility", factId: fact.id, meaning: fact.meaning, evidence: evidence("saju", fact.evidence), evidenceRole: "dyadic-evidence" as const, sourceKind: section.key === "atAGlance" || fact.domain.startsWith("score-") ? "score" as const : undefined })));
}

export function adaptZiweiPersonal(report: ComprehensiveReport, personId: string): IntegratedSourceFact[] {
  return report.sections.flatMap((section) => section.facts.map((fact) => ({ system: "ziwei" as const, module: section.key === "upcomingTiming" ? "timing" : "comprehensive", factId: fact.id, personId, meaning: fact.meaning, evidence: evidence("ziwei", fact.evidence), evidenceRole: "individual-context" as const, sourceKind: fact.evidence.length ? undefined : "summary" as const, ...(section.key === "upcomingTiming" && /^upcoming-(\d{4})$/.test(fact.id) ? { temporalScope: yearScope(Number(fact.id.slice(-4))) } : {}) })));
}

export function adaptZiweiRelationshipContext(report: ComprehensiveReport, personId: string): IntegratedSourceFact[] {
  const section = report.sections.find((item) => item.key === "romanceSpouse");
  return (section?.facts ?? []).map((fact) => ({ system: "ziwei", module: "relationship-context", factId: fact.id, personId, meaning: fact.meaning, evidence: evidence("ziwei", fact.evidence), evidenceRole: "individual-context" }));
}

export function adaptWesternPersonal(report: WesternPersonalSynthesisReport, selectedScope?: TemporalScope): IntegratedSourceFact[] {
  const base = report.sections.filter((section) => section.key !== "overview").flatMap((section) => section.facts.map((fact) => ({ system: "western" as const, module: "overview", factId: fact.id, personId: report.personId, meaning: fact.meaning, evidence: fact.independence.allEvidenceIds.map((id) => ({ id: `western:${id}`, label: id })), evidenceRole: "individual-context" as const, sourceKind: fact.sourceRefs.length ? undefined : "summary" as const })));
  if (!selectedScope) return base;
  const transitIds = [...new Set(report.sections.flatMap((section) => section.facts.flatMap((fact) => fact.timing.transitFactIds)))];
  return [...base, ...transitIds.map((factId) => ({ system: "western" as const, module: "transit", factId, personId: report.personId, meaning: "선택 기간에 기존 관계 욕구와 행동 방식의 조율 지점이 활성화됩니다", evidence: [{ id: `western:${factId}`, label: factId }], evidenceRole: "individual-context" as const, temporalScope: selectedScope }))];
}

export function adaptWesternRelationship(report: WesternRelationshipSynthesisReport): IntegratedSourceFact[] {
  return report.sections.filter((section) => section.key !== "overview" && section.key !== "currentFlow").flatMap((section) => section.facts.map((fact) => ({ system: "western" as const, module: "synastry", factId: fact.id, meaning: fact.meaning, evidence: fact.independence.allEvidenceIds.map((id) => ({ id: `western:${id}`, label: id })), evidenceRole: "dyadic-evidence" as const, sourceKind: fact.sourceRefs.some((ref) => ref.module === "synastry") ? undefined : "summary" as const })));
}

export function yearScope(year: number): TemporalScope { return { start: `${year}-01-01`, end: `${year}-12-31`, timezone: "Asia/Seoul", granularity: "year", sourcePeriodLabel: `${year}년` }; }
