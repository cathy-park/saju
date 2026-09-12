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
    const prompt = buildZiweiCopyPrompt(chart);
    expect(prompt).toContain("# 자미두수 명반 구조");
    expect(prompt).toContain("명궁:");
    expect(prompt).toContain("## 12궁");
    expect(prompt).toContain("삼방:");
    expect(() => JSON.parse(prompt)).toThrow();
  });

  it("fact가 없는 섹션은 제외한다", () => {
    const prompt = buildZiweiCopyPrompt(chart);
    expect(prompt).not.toMatch(/coreWealth-|incomeStyle-|"meaning"|"polarity"/);
  });
});
