import { describe, it, expect } from "vitest";
import { buildZiweiChart } from "../../buildZiweiChart";
import { zhongzhouV1 } from "../../ruleSets/zhongzhouV1";
import { PARK_SOYEON_BIRTH } from "../../__tests__/fixtures/parkSoyeon";
import { spouseReportTimingYears } from "../spouseReport";
import { buildComprehensiveReport } from "../comprehensiveReport";
import { buildZiweiCopyPrompt } from "../promptExport";

describe("buildZiweiCopyPrompt — 21단계 자미두수 AI 해석 프롬프트 복사", () => {
  const chart = buildZiweiChart(PARK_SOYEON_BIRTH, zhongzhouV1, spouseReportTimingYears());
  const report = buildComprehensiveReport(chart, zhongzhouV1, PARK_SOYEON_BIRTH.name);

  it("이미 계산된 comprehensiveReport의 fact만 담은 유효한 JSON을 만든다", () => {
    const prompt = buildZiweiCopyPrompt(report);
    const parsed = JSON.parse(prompt);
    expect(parsed.personName).toBe(PARK_SOYEON_BIRTH.name);
    expect(Array.isArray(parsed.sections)).toBe(true);
    expect(parsed.sections.length).toBeGreaterThan(0);
  });

  it("fact가 없는 섹션은 제외한다", () => {
    const prompt = buildZiweiCopyPrompt(report);
    const parsed = JSON.parse(prompt) as { sections: { facts: unknown[] }[] };
    for (const section of parsed.sections) {
      expect(section.facts.length).toBeGreaterThan(0);
    }
  });
});
