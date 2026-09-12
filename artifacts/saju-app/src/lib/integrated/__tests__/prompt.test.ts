import { describe, expect, it, vi } from "vitest";
import { buildIntegratedPersonalReport, buildIntegratedRelationshipReport } from "../report";
import { buildHolisticDeterministicText, buildIntegratedCopyPrompt, runHolisticSingleFlight } from "../prompt";
import type { IntegratedSourceFact } from "../types";

const source = (value: Partial<IntegratedSourceFact> & Pick<IntegratedSourceFact, "system" | "module" | "factId" | "meaning">): IntegratedSourceFact => ({
  evidenceRole: "individual-context",
  evidence: [{ id: `${value.system}:raw:${value.factId}`, label: value.factId }],
  ...value,
});

describe("buildIntegratedCopyPrompt — 계산 구조 상담용 Markdown", () => {
  it("세 체계 원자료만 합치고 synthesis 및 개발 ID를 제외한다", () => {
    const text = buildIntegratedCopyPrompt({ saju: "출생정보\n사주팔자", ziwei: "명궁: 子", western: "Sun: Aquarius 27°" });
    expect(text).toContain("# 1. 사주\n출생정보");
    expect(text).toContain("# 2. 자미두수\n명궁: 子");
    expect(text).toContain("# 3. 서양점성술\nSun: Aquarius 27°");
    expect(text).not.toMatch(/relationKind|sourceFactId|rule-R|coreWealth-|"synthesisFacts"/);
    expect(() => JSON.parse(text)).toThrow();
  });
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

describe("integrated holistic single-flight", () => {
  it("동일 key의 동시 요청과 완료 후 재요청은 하나의 실행 결과를 재사용한다", async () => {
    const request = vi.fn(async () => "AI result");
    const [first, second] = await Promise.all([
      runHolisticSingleFlight("same-key", request),
      runHolisticSingleFlight("same-key", request),
    ]);
    const third = await runHolisticSingleFlight("same-key", request);
    expect([first, second, third]).toEqual(["AI result", "AI result", "AI result"]);
    expect(request).toHaveBeenCalledTimes(1);
  });

  it("source key가 다르면 각각 별도 요청을 실행한다", async () => {
    const request = vi.fn(async () => "AI result");
    await Promise.all([
      runHolisticSingleFlight("person-a", request),
      runHolisticSingleFlight("person-b", request),
    ]);
    expect(request).toHaveBeenCalledTimes(2);
  });
});
