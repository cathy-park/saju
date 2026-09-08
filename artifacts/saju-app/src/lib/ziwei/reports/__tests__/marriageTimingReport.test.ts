import { describe, it, expect } from "vitest";
import { buildZiweiChart } from "../../buildZiweiChart";
import { zhongzhouV1 } from "../../ruleSets/zhongzhouV1";
import { PARK_SOYEON_BIRTH } from "../../__tests__/fixtures/parkSoyeon";
import { spouseReportTimingYears } from "../spouseReport";
import { buildMarriageTimingReport } from "../marriageTimingReport";

const years = spouseReportTimingYears();
const chart = buildZiweiChart(PARK_SOYEON_BIRTH, zhongzhouV1, years);
const report = buildMarriageTimingReport(chart, zhongzhouV1, PARK_SOYEON_BIRTH.name);

describe("marriageTimingReport — AI 호출 예산(연도당 1회) 및 '확정' 프레이밍 금지", () => {
  it("signals는 spouseReportTimingYears() 범위 전체(15개년)를 담는다", () => {
    expect(report.signals.length).toBe(years.length);
  });

  it("yearCards는 하이라이트된 '연도' 개수만큼만 존재한다 — 연도×축(최대 60개)이 아니다", () => {
    const highlightedYears = new Set([
      ...report.highlights.activationYears,
      ...report.highlights.stabilityYears,
      ...report.highlights.formalizationYears,
      ...report.highlights.volatilityYears,
    ]);
    expect(report.yearCards.length).toBe(highlightedYears.size);
    expect(report.yearCards.length).toBeLessThanOrEqual(years.length);
  });

  it("각 yearCard는 그 해의 축 개수만큼만 fact를 갖는다(축마다 별도 리포트 섹션으로 쪼개지 않음)", () => {
    for (const card of report.yearCards) {
      expect(card.facts.length).toBe(card.axes.length);
      expect(card.axes.length).toBeGreaterThan(0);
      // fact 하나가 곧 polishStatementText 호출 단위가 아니라, card 전체(facts 배열)가
      // 단일 호출 단위다 — 이 리포트 레이어는 연도당 정확히 1개의 text/facts 묶음만 만든다.
      expect(card.text.length).toBeGreaterThan(0);
    }
  });

  it("yearCard.text와 fact.meaning 어디에도 '확정'류 단정 표현이 없다", () => {
    for (const card of report.yearCards) {
      expect(card.text).not.toMatch(/확정|입니다\.\s*$.*결혼합니다/);
      expect(card.text).not.toMatch(/결혼(할|하는) 해/);
      for (const f of card.facts) {
        expect(f.meaning).not.toMatch(/확정/);
      }
    }
  });

  it("evidence에 source(natal/major/annual)가 있는 항목은 이미 timingEngine이 태깅한 값을 그대로 옮긴 것이다(새로 지어내지 않음)", () => {
    for (const card of report.yearCards) {
      for (const e of card.evidence) {
        if (e.source) expect(["natal", "major", "annual"]).toContain(e.source);
      }
    }
  });
});
