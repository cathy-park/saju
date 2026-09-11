import type { EvidenceIndependence, SynthesisSourceRef } from "./types.js";

const unique = (values: string[]) => [...new Set(values)].sort();
export function analyzeEvidenceIndependence(refs: SynthesisSourceRef[]): EvidenceIndependence {
  const counts = new Map<string, number>();
  for (const ref of refs) for (const id of unique(ref.ultimateEvidenceIds)) counts.set(id, (counts.get(id) ?? 0) + 1);
  const sharedEvidenceIds = [...counts].filter(([, count]) => count > 1).map(([id]) => id).sort();
  const factCounts = new Map<string, number>(); for (const ref of refs) factCounts.set(ref.factId, (factCounts.get(ref.factId) ?? 0) + 1);
  const keyFor = (ref: SynthesisSourceRef) => factCounts.get(ref.factId)! > 1 ? `${ref.personId ?? ref.pairId ?? ref.module}:${ref.factId}` : ref.factId;
  const uniqueEvidenceByFact = Object.fromEntries(refs.map((ref) => [keyFor(ref), unique(ref.ultimateEvidenceIds).filter((id) => counts.get(id) === 1)]));
  const allSourcesRetainUniqueEvidence = refs.length > 0 && refs.every((ref) => uniqueEvidenceByFact[keyFor(ref)]?.length > 0);
  return {
    allEvidenceIds: [...counts.keys()].sort(), sharedEvidenceIds, uniqueEvidenceByFact, allSourcesRetainUniqueEvidence,
    independentConsensusEligible: refs.length >= 2 && new Set(refs.map((ref) => ref.module)).size >= 2 && sharedEvidenceIds.length === 0,
  };
}
