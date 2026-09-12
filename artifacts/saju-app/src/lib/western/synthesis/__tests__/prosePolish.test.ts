import { describe, it, expect } from "vitest";
import { westernSynthesisContentKey } from "../prosePolish";
import type { WesternPersonalSynthesisReport, WesternRelationshipSynthesisReport, WesternSynthesisFact } from "../types";

function fact(id: string): WesternSynthesisFact {
  return {
    id, meaning: `meaning-${id}`, timing: { active: false, transitFactIds: [] },
    sourceRefs: [], independence: {
      allEvidenceIds: [], sharedEvidenceIds: [], uniqueEvidenceByFact: {},
      allSourcesRetainUniqueEvidence: true, independentConsensusEligible: false,
    },
    primaryOwnerSection: "overview",
  };
}

describe("westernSynthesisContentKey — 21단계 Western AI 다듬기 어댑터", () => {
  it("personal synthesis report는 personId를 content key에 포함한다", () => {
    const report: WesternPersonalSynthesisReport = {
      schemaVersion: "western-personal-synthesis/v1",
      personId: "person-1",
      sections: [{ key: "overview", title: "한눈에 보는 나", text: "text", facts: [fact("f1")], primarySourceRefs: [], referencedFactIds: [] }],
    };
    expect(westernSynthesisContentKey(report)).toBe("western-personal-synthesis/v1:person-1:f1");
  });

  it("relationship synthesis report는 pairId를 content key에 포함한다", () => {
    const report: WesternRelationshipSynthesisReport = {
      schemaVersion: "western-relationship-synthesis/v1",
      pairId: "pair-1",
      sections: [{ key: "overview", title: "관계의 핵심 구조", text: "text", facts: [fact("f1"), fact("f2")], primarySourceRefs: [], referencedFactIds: [] }],
    };
    expect(westernSynthesisContentKey(report)).toBe("western-relationship-synthesis/v1:pair-1:f1,f2");
  });

  it("fact 목록이 바뀌면 content key도 바뀐다(트랜싯 갱신 등으로 facts가 달라질 때 캐시를 다시 탄다)", () => {
    const base: WesternPersonalSynthesisReport = {
      schemaVersion: "western-personal-synthesis/v1", personId: "person-1",
      sections: [{ key: "overview", title: "t", text: "text", facts: [fact("f1")], primarySourceRefs: [], referencedFactIds: [] }],
    };
    const updated: WesternPersonalSynthesisReport = {
      ...base,
      sections: [{ key: "overview", title: "t", text: "text", facts: [fact("f1"), fact("f2")], primarySourceRefs: [], referencedFactIds: [] }],
    };
    expect(westernSynthesisContentKey(base)).not.toBe(westernSynthesisContentKey(updated));
  });
});
