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

  it("각 yearCard는 natal baseline + 大限/流年 작동 + 축 상태를 모두 묶되, 여전히 연도당 1개 묶음이다(축마다 쪼개지 않음)", () => {
    for (const card of report.yearCards) {
      // 최소한 하이라이트된 축 개수만큼은 fact가 있어야 한다(natal/major/annual이 0개여도 축 fact는 남는다).
      expect(card.facts.length).toBeGreaterThanOrEqual(card.axes.length);
      expect(card.axes.length).toBeGreaterThan(0);
      expect(card.text.length).toBeGreaterThan(0);
      // MAX_FACTS(서버 60개 제한)를 넉넉히 밑돈다 — 연도당 fact가 과도하게 쌓이지 않는지 확인.
      expect(card.facts.length).toBeLessThan(20);
    }
  });

  it("모든 yearCard는 natal baseline(타고난 관계 자리) fact를 최소 1개 이상 포함한다 — 새 계산 없이 배우자 리포트 natal fact를 재사용", () => {
    for (const card of report.yearCards) {
      const natal = card.facts.filter((f) => f.domain === "timing-natal");
      expect(natal.length).toBeGreaterThan(0);
      expect(natal[0].meaning).toContain("타고난 관계 자리");
    }
  });

  it("natal baseline fact는 모든 연도에 대해 동일한 내용이다 — 연도 점수와 무관한 고정 context다", () => {
    const naturalTexts = report.yearCards.map((card) =>
      card.facts.filter((f) => f.domain === "timing-natal").map((f) => f.meaning).join("|"),
    );
    const unique = new Set(naturalTexts);
    expect(unique.size).toBe(1);
  });

  it("card.text와 fact.meaning에 원시 표기(夫妻宮·化祿·化權·化科·化忌·大限·流年)가 노출되지 않는다 — 자연어로만 서술", () => {
    const rawNotationPattern = /夫妻宮|化祿|化權|化科|化忌|大限|流年/;
    for (const card of report.yearCards) {
      expect(card.text).not.toMatch(rawNotationPattern);
      for (const f of card.facts) {
        expect(f.meaning).not.toMatch(rawNotationPattern);
      }
    }
  });

  it("근거 토글(evidence)에는 원시 표기가 그대로 남아 있다 — 메인 문장과 반대로 기술 정보를 보존해야 한다", () => {
    const hasRawNotation = report.yearCards.some((card) =>
      card.evidence.some((e) => /夫妻宮|化祿|化權|化科|化忌/.test(e.value)),
    );
    expect(hasRawNotation).toBe(true);
  });

  it("근거 토글에 동일한 evidence가 중복 표시되지 않는다(화기·擎羊/陀羅가 activation·volatility 등 여러 축에 겹쳐 들어가도 한 번만)", () => {
    for (const card of report.yearCards) {
      const keys = card.evidence.map((e) => `${e.source ?? ""}|${e.type}|${e.value}`);
      expect(new Set(keys).size).toBe(keys.length);
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
