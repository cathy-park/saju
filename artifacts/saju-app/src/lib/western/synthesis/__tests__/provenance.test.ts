import { describe, expect, it } from "vitest";
import { analyzeEvidenceIndependence, type SynthesisSourceRef } from "../index.js";

const ref = (factId: string, ids: string[]): SynthesisSourceRef => ({ module: "personality", personId: "p", factId, ultimateEvidenceIds: ids });

describe("synthesis provenance independence", () => {
  it("rejects independent consensus when source facts share the same raw evidence", () => {
    const result = analyzeEvidenceIndependence([ref("personality", ["natal:p:aspect:venus:mars:square"]), { ...ref("romance", ["natal:p:aspect:venus:mars:square"]), module: "romance" }]);
    expect(result.independentConsensusEligible).toBe(false);
    expect(result.sharedEvidenceIds).toEqual(["natal:p:aspect:venus:mars:square"]);
  });

  it("allows synthesis with partial overlap only when every source retains unique evidence", () => {
    const partial = analyzeEvidenceIndependence([ref("a", ["shared", "only-a"]), { ...ref("b", ["shared", "only-b"]), module: "romance" }]);
    expect(partial.allSourcesRetainUniqueEvidence).toBe(true);
    expect(partial.uniqueEvidenceByFact).toEqual({ a: ["only-a"], b: ["only-b"] });
    const swallowed = analyzeEvidenceIndependence([ref("a", ["shared", "only-a"]), { ...ref("b", ["shared"]), module: "romance" }]);
    expect(swallowed.allSourcesRetainUniqueEvidence).toBe(false);
  });

  it("does not count linked natal provenance in transit or synastry as new raw evidence", () => {
    const transit: SynthesisSourceRef = { module: "transit", personId: "p", factId: "t", ultimateEvidenceIds: ["transit:p:event"], linkedNatalFactIds: ["natal-fact"] };
    const synastry: SynthesisSourceRef = { module: "synastry", pairId: "a~b", factId: "s", ultimateEvidenceIds: ["synastry:a~b:cross"], linkedNatalFactIds: ["natal-fact"] };
    const result = analyzeEvidenceIndependence([transit, synastry]);
    expect(result.allEvidenceIds).toEqual(["synastry:a~b:cross", "transit:p:event"]);
  });

  it("keeps same fact IDs from two people distinct in derived provenance", () => {
    const result = analyzeEvidenceIndependence([
      { ...ref("relationship:emotional-safety", ["natal:a:moon"]), personId: "a", module: "romance" },
      { ...ref("relationship:emotional-safety", ["natal:b:moon"]), personId: "b", module: "romance" },
    ]);
    expect(result.uniqueEvidenceByFact).toEqual({ "a:relationship:emotional-safety": ["natal:a:moon"], "b:relationship:emotional-safety": ["natal:b:moon"] });
    expect(result.allSourcesRetainUniqueEvidence).toBe(true);
  });
});
