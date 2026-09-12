import { describe, it, expect } from "vitest";
import { buildZiweiChart } from "../../buildZiweiChart";
import { zhongzhouV1 } from "../../ruleSets/zhongzhouV1";
import { PARK_SOYEON_BIRTH } from "../../__tests__/fixtures/parkSoyeon";
import { spouseReportTimingYears } from "../spouseReport";
import { buildComprehensiveReport } from "../comprehensiveReport";
import { buildZiweiCopyPrompt } from "../promptExport";
import { buildNatureReport } from "../natureReport";
import { buildSpouseReport } from "../spouseReport";

describe("buildZiweiCopyPrompt — 21단계 자미두수 AI 해석 프롬프트 복사", () => {
  const chart = buildZiweiChart(PARK_SOYEON_BIRTH, zhongzhouV1, spouseReportTimingYears());
  const report = buildComprehensiveReport(chart, zhongzhouV1, PARK_SOYEON_BIRTH.name);

  it("이미 계산된 comprehensiveReport의 fact만 담은 유효한 JSON을 만든다", () => {
    const prompt = buildZiweiCopyPrompt(chart);
    expect(prompt).toContain("# 자미두수 명반 구조");
    expect(prompt).toContain("명궁:");
    expect(prompt).toContain("## 12궁");
    expect(prompt).toContain("삼방:");
    expect(prompt).toContain("현재 대한:");
    expect(prompt).toContain("현재 유년:");
    expect(() => JSON.parse(prompt)).toThrow();
  });

  it("최종 프로필은 계산 과정 설명이 아니라 실제 fact를 합성한다", () => {
    const nature = buildNatureReport(chart, PARK_SOYEON_BIRTH.name).sections.at(-1)?.statements[0];
    const spouse = buildSpouseReport(chart, PARK_SOYEON_BIRTH.name).sections.at(-1)?.statements[0];
    expect(nature?.facts.length).toBeGreaterThan(0);
    expect(spouse?.facts.length).toBeGreaterThan(0);
    expect(`${nature?.text}\n${spouse?.text}`).not.toMatch(/지금까지 살펴본|구조적 근거에서 나온/);
  });

  it("fact가 없는 섹션은 제외한다", () => {
    const prompt = buildZiweiCopyPrompt(chart);
    expect(prompt).not.toMatch(/coreWealth-|incomeStyle-|"meaning"|"polarity"/);
  });
});
