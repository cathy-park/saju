import { describe, expect, it } from "vitest";
import { buildIntegratedPersonalReport, buildIntegratedRelationshipReport } from "../report";
import type { IntegratedSourceFact } from "../types";

const source = (value: Partial<IntegratedSourceFact> & Pick<IntegratedSourceFact, "system" | "module" | "factId" | "meaning">): IntegratedSourceFact => ({
  evidenceRole: "individual-context",
  evidence: [{ id: `${value.system}:raw:${value.factId}`, label: value.factId }],
  ...value,
});

describe("cross-system integrated synthesis", () => {
  it("requires compatible whitelisted concept and direction for consensus", () => {
    const report = buildIntegratedPersonalReport({ personId: "p", sources: [
      source({ system: "saju", module: "summary", factId: "rule-R05-a", meaning: "독립적으로 판단합니다" }),
      source({ system: "ziwei", module: "comprehensive", factId: "coreNature-0", meaning: "주도적으로 책임집니다" }),
      source({ system: "western", module: "overview", factId: "synthesis:p:core", meaning: "자기 기준을 지킵니다" }),
    ] });
    const consensus = report.sections.flatMap((section) => section.facts).filter((fact) => fact.relationKind === "consensus");
    expect(consensus).toHaveLength(1);
    expect(consensus[0].sourceSystems).toEqual(["saju", "western", "ziwei"]);
  });

  it("does not create tension from broad-theme differences", () => {
    const report = buildIntegratedPersonalReport({ personId: "p", sources: [
      source({ system: "saju", module: "summary", factId: "rule-R11-a", meaning: "결정이 흔들릴 수 있습니다" }),
      source({ system: "western", module: "overview", factId: "synthesis:p:emotion", meaning: "책임을 먼저 처리합니다" }),
    ] });
    expect(report.sections.flatMap((section) => section.facts).some((fact) => fact.relationKind === "tension")).toBe(false);
  });

  it("counts only two actual dyadic systems for relationship consensus", () => {
    const report = buildIntegratedRelationshipReport({ pairId: "a~b", sources: [
      source({ system: "saju", module: "compatibility", factId: "emotion-a", meaning: "대화를 통해 조율합니다", evidenceRole: "dyadic-evidence" }),
      source({ system: "western", module: "synastry", factId: "communication-a", meaning: "감정을 말로 정리합니다", evidenceRole: "dyadic-evidence" }),
      source({ system: "ziwei", module: "relationship-context", factId: "relationship-0", meaning: "대화를 중시합니다", evidenceRole: "individual-context", personId: "a" }),
    ] });
    const fact = report.sections.flatMap((section) => section.facts).find((item) => item.relationKind === "consensus");
    expect(fact?.dyadicSystems).toEqual(["saju", "western"]);
    expect(fact?.sourceSystems).toEqual(["saju", "western", "ziwei"]);
    expect(fact?.meaning).not.toMatch(/세 체계|3체계/);
  });

  it("dedupes same-system evidence and excludes summary, score, and empty evidence", () => {
    const report = buildIntegratedPersonalReport({ personId: "p", sources: [
      source({ system: "ziwei", module: "comprehensive", factId: "coreNature-0", meaning: "주도합니다", evidence: [{ id: "ziwei:star:x", label: "X@명궁" }] }),
      source({ system: "ziwei", module: "comprehensive", factId: "lifeAttitude-0", meaning: "주도합니다", evidence: [{ id: "ziwei:star:x", label: "X@명궁" }] }),
      source({ system: "saju", module: "summary", factId: "score-human", meaning: "90점", sourceKind: "score" }),
      source({ system: "western", module: "overview", factId: "overview", meaning: "요약", sourceKind: "summary", evidence: [] }),
    ] });
    expect(report.sourceAudit.eligibleFactCount).toBe(2);
    expect(report.sourceAudit.uniqueEvidenceCount).toBe(1);
    expect(report.sections.flatMap((section) => section.facts).some((fact) => fact.relationKind === "consensus")).toBe(false);
  });

  it("creates timing convergence only for overlapping scopes and matching concepts", () => {
    const report = buildIntegratedPersonalReport({ personId: "p", sources: [
      source({ system: "ziwei", module: "timing", factId: "upcoming-2026", meaning: "관계 조율이 중요합니다", temporalScope: { start: "2026-01-01", end: "2026-12-31", granularity: "year", timezone: "Asia/Seoul", sourcePeriodLabel: "2026년" } }),
      source({ system: "western", module: "transit", factId: "transit:jupiter:venus:opposition", meaning: "관계 욕구를 조율합니다", temporalScope: { start: "2026-09-01", end: "2026-09-30", granularity: "instant-window", timezone: "Asia/Seoul", sourcePeriodLabel: "2026년 9월" } }),
    ], selectedPeriod: { start: "2026-09-01", end: "2026-09-30", timezone: "Asia/Seoul" } });
    expect(report.timingConvergences).toHaveLength(1);
    expect(report.sections.flatMap((section) => section.facts).some((fact) => fact.sources.some((source) => source.temporalScope))).toBe(false);
    expect(report.timingConvergences[0].meaning).toContain("관계 조율이 중요합니다");
    expect(report.timingConvergences[0].meaning).not.toContain("같은 사건을 뜻하지");
  });

  it("keeps a one-system result as a standalone fact, never consensus", () => {
    const report = buildIntegratedPersonalReport({ personId: "p", sources: [source({ system: "saju", module: "summary", factId: "rule-R06-a", meaning: "빠르게 실행합니다" })] });
    expect(report.sections.flatMap((section) => section.facts).some((fact) => fact.relationKind === "consensus")).toBe(false);
    expect(report.standaloneFacts).toHaveLength(1);
  });
});
