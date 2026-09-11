import type { WesternPersonalityReport } from "../interpretation/types.js";
import type { WesternRelationshipReport } from "../interpretation/romance/types.js";
import type { WesternTransitReport } from "../transit/types.js";
import type { WesternSynastryReport } from "../synastry/types.js";
import type { SynthesisSourceRef } from "./types.js";

const unique = (values: string[]) => [...new Set(values)].sort();
const natalId = (personId: string, evidenceId: string) => `natal:${personId}:${evidenceId}`;

export function personalitySources(personId: string, report: WesternPersonalityReport): SynthesisSourceRef[] {
  const emphasis = new Map(report.emphasis.map((item) => [`emphasis:${item.id}`, item.sourceEvidenceIds]));
  return report.sections.filter((section) => section.key !== "atAGlance").flatMap((section) => section.facts).filter((fact) => fact.evidence.length > 0).map((fact) => ({
    module: "personality", personId, factId: fact.id,
    ultimateEvidenceIds: unique(fact.evidence.flatMap((evidence) => emphasis.get(evidence.id) ?? [evidence.id]).map((id) => natalId(personId, id))),
  }));
}
export function romanceSources(personId: string, report: WesternRelationshipReport): SynthesisSourceRef[] {
  return report.sections.filter((section) => section.key !== "overview" && section.key !== "relationshipOperations").flatMap((section) => section.facts).filter((fact) => fact.evidence.length > 0).map((fact) => ({
    module: "romance", personId, factId: fact.id, ultimateEvidenceIds: unique(fact.evidence.map((evidence) => natalId(personId, evidence.id))),
  }));
}
export function transitSources(personId: string, report?: WesternTransitReport): SynthesisSourceRef[] {
  if (!report) return [];
  const reference = Date.parse(report.timeline.query.referenceUtcInstant);
  return report.timeline.events.filter((event) => Date.parse(event.windowStart) <= reference && reference <= Date.parse(event.windowEnd)).sort((a, b) => a.id.localeCompare(b.id)).map((event) => ({
    module: "transit", personId, factId: `transit-fact:${event.id}`,
    ultimateEvidenceIds: [`transit:${personId}:${event.id}`],
    linkedNatalFactIds: event.natalLink?.kind === "natal-fact" ? unique(event.natalLink.factIds.map((id) => `${personId}:${id}`)) : [], role: "activation",
  }));
}
export function synastrySources(report: WesternSynastryReport): SynthesisSourceRef[] {
  return report.sections.filter((section) => section.key !== "overview" && section.key !== "operations").flatMap((section) => section.facts).filter((fact) => fact.evidence.length > 0).map((fact) => ({
    module: "synastry", pairId: report.pairId, factId: fact.id,
    ultimateEvidenceIds: unique(fact.evidence.map((evidence) => evidence.raw.id)),
    linkedNatalFactIds: unique(fact.evidence.flatMap((evidence) => evidence.natalLinks.flatMap((link) => link.factIds.map((id) => `${link.personId}:${id}`)))),
  }));
}
