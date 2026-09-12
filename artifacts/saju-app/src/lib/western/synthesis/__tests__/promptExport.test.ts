import { describe, it, expect } from "vitest";
import { buildWesternCopyPrompt } from "../promptExport";
import type { WesternPersonalSynthesisReport } from "../types";

const emptyIndependence = {
  allEvidenceIds: [], sharedEvidenceIds: [], uniqueEvidenceByFact: {},
  allSourcesRetainUniqueEvidence: true, independentConsensusEligible: false,
};

describe("buildWesternCopyPrompt — 21단계 서양점성술 AI 해석 프롬프트 복사", () => {
  it("이미 계산된 synthesis report의 fact만 담은 유효한 JSON을 만든다", () => {
    const report: WesternPersonalSynthesisReport = {
      schemaVersion: "western-personal-synthesis/v1",
      personId: "person-1",
      sections: [
        { key: "overview", title: "한눈에 보는 나", text: "text", facts: [
          { id: "f1", meaning: "meaning-1", timing: { active: false, transitFactIds: [] }, sourceRefs: [], independence: emptyIndependence, primaryOwnerSection: "overview" },
        ], primarySourceRefs: [], referencedFactIds: [] },
        { key: "empty", title: "빈 섹션", text: "", facts: [], primarySourceRefs: [], referencedFactIds: [] },
      ],
    };
    const prompt = buildWesternCopyPrompt(report);
    const parsed = JSON.parse(prompt) as { personId: string; sections: { section: string; facts: { meaning: string }[] }[] };
    expect(parsed.personId).toBe("person-1");
    expect(parsed.sections.length).toBe(1);
    expect(parsed.sections[0].facts[0].meaning).toBe("meaning-1");
  });
});
