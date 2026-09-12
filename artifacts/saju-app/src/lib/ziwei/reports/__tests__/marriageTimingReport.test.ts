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

  it("각 yearCard는 축 조합 synthesis + 大限/流年 작동을 묶되, 여전히 연도당 1개 묶음이다(축마다 쪼개지 않음)", () => {
    for (const card of report.yearCards) {
      expect(card.facts.length).toBeGreaterThan(0);
      expect(card.axes.length).toBeGreaterThan(0);
      expect(card.text.length).toBeGreaterThan(0);
      // MAX_FACTS(서버 60개 제한)를 넉넉히 밑돈다 — 연도당 fact가 과도하게 쌓이지 않는지 확인.
      expect(card.facts.length).toBeLessThan(20);
    }
  });

  it("natal baseline은 연도 카드가 아니라 리포트 레벨에 한 번만 존재한다", () => {
    expect(report.natalBaseline).not.toBeNull();
    expect(report.natalBaseline!.text).toContain("타고난 관계 자리");
    for (const card of report.yearCards) {
      const natalInCard = card.facts.filter((f) => f.domain === "timing-natal");
      expect(natalInCard.length).toBe(0);
    }
  });

  it("연도 카드 text는 축 조합 synthesis 문장(1~2개)만 담는다 — natal baseline을 반복하지 않는다", () => {
    for (const card of report.yearCards) {
      expect(card.text).not.toContain("타고난 관계 자리");
      // 문장 개수(마침표 기준)가 1~2개를 넘지 않는다.
      const sentenceCount = card.text.split(".").filter((s) => s.trim().length > 0).length;
      expect(sentenceCount).toBeLessThanOrEqual(2);
    }
  });

  it("연도 카드 text가 AxisBadge 라벨 문구를 그대로 반복하지 않는다 — 뱃지와 prose가 같은 말을 두 번 하지 않는다", () => {
    const badgeEchoPatterns = [
      /관계 활성화 흐름이 이 해에 (뚜렷하게|약하게) 나타납니다/,
      /안정화 흐름이 이 해에 (뚜렷하게|약하게) 나타납니다/,
      /공식화 가능성 흐름이 이 해에 (뚜렷하게|약하게) 나타납니다/,
      /변동성·주의 흐름이 이 해에 (뚜렷하게|약하게) 나타납니다/,
    ];
    for (const card of report.yearCards) {
      for (const pattern of badgeEchoPatterns) {
        expect(card.text).not.toMatch(pattern);
      }
    }
  });

  it("card.text와 fact.meaning에 원시 표기(夫妻宮·化祿·化權·化科·化忌·大限·流年)가 노출되지 않는다 — 자연어로만 서술", () => {
    const rawNotationPattern = /夫妻宮|化祿|化權|化科|化忌|大限|流年/;
    for (const card of report.yearCards) {
      expect(card.text).not.toMatch(rawNotationPattern);
      for (const f of card.facts) {
        expect(f.meaning).not.toMatch(rawNotationPattern);
      }
    }
    expect(report.natalBaseline!.text).not.toMatch(rawNotationPattern);
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
      expect(card.text).not.toMatch(/확정/);
      expect(card.text).not.toMatch(/결혼(할|하는) 해/);
      for (const f of card.facts) {
        expect(f.meaning).not.toMatch(/확정/);
      }
    }
  });

  it("formalization↑ + volatility↑ 조합은 무조건 호재로 단정하지 않는다(재정의·결별 가능성도 함께 언급)", () => {
    const candidate = report.yearCards.find((card) =>
      card.axes.includes("formalization") && card.axes.includes("volatility"),
    );
    if (candidate) {
      expect(candidate.text).toMatch(/단정하기는 이릅니다|재정의|정리하는 방향/);
    }
  });

  it("stability↑ + formalization 0 조합은 결혼 신호로 단정하지 않는다(0=부정적 신호 아님)", () => {
    const candidate = report.yearCards.find((card) => {
      const signal = report.signals.find((s) => s.year === card.year)!;
      return signal.stability.score >= 1.5 && signal.formalization.score === 0;
    });
    if (candidate) {
      expect(candidate.text).toMatch(/단정할 수는 없습니다|단정하지/);
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
