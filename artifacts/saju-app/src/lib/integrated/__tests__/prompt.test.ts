import { describe, expect, it } from "vitest";
import { buildIntegratedPersonalReport, buildIntegratedRelationshipReport } from "../report";
import { buildHolisticDeterministicText } from "../prompt";
import type { IntegratedSourceFact } from "../types";

const source = (value: Partial<IntegratedSourceFact> & Pick<IntegratedSourceFact, "system" | "module" | "factId" | "meaning">): IntegratedSourceFact => ({
  evidenceRole: "individual-context",
  evidence: [{ id: `${value.system}:raw:${value.factId}`, label: value.factId }],
  ...value,
});

describe("buildHolisticDeterministicText — 21단계 종합 AI holistic 레이어의 fallback 문장", () => {
  it("personal 리포트는 overview 섹션 텍스트를 그대로 쓴다", () => {
    const report = buildIntegratedPersonalReport({ personId: "p", sources: [
      source({ system: "saju", module: "summary", factId: "rule-R05-a", meaning: "독립적으로 판단합니다" }),
      source({ system: "ziwei", module: "comprehensive", factId: "coreNature-0", meaning: "주도적으로 책임집니다" }),
      source({ system: "western", module: "overview", factId: "synthesis:p:core", meaning: "자기 기준을 지킵니다" }),
    ] });
    const overview = report.sections.find((section) => section.key === "overview");
    expect(buildHolisticDeterministicText(report)).toBe(overview?.text);
    expect(buildHolisticDeterministicText(report).length).toBeGreaterThan(0);
  });

  it("relationship 리포트는 relationshipCore 섹션 텍스트를 그대로 쓴다", () => {
    const report = buildIntegratedRelationshipReport({ pairId: "a~b", sources: [
      source({ system: "saju", module: "compatibility", factId: "emotion-a", meaning: "대화를 통해 조율합니다", evidenceRole: "dyadic-evidence" }),
      source({ system: "western", module: "synastry", factId: "communication-a", meaning: "감정을 말로 정리합니다", evidenceRole: "dyadic-evidence" }),
    ] });
    const core = report.sections.find((section) => section.key === "relationshipCore");
    expect(buildHolisticDeterministicText(report)).toBe(core?.text);
  });

  it("fact가 전혀 없어 섹션이 비어 있으면 빈 문자열을 반환한다(새 문장을 지어내지 않음)", () => {
    const report = buildIntegratedPersonalReport({ personId: "p", sources: [] });
    expect(buildHolisticDeterministicText(report)).toBe("");
  });
});
