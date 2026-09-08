// 2번째 교차검증 케이스(조용민, 2026-09-07 대표 지시) — 박소연(음녀·木三局·순행)과 성별/
// 오행국/大限 방향이 전부 다른 케이스로 엔진이 특정 케이스에만 우연히 맞은 게 아님을 검증한다.
import { describe, it, expect } from "vitest";
import { buildZiweiChart } from "../buildZiweiChart";
import { zhongzhouV1 } from "../ruleSets/zhongzhouV1";
import { JO_YONGMIN_BIRTH, JO_YONGMIN_EXPECTED } from "./fixtures/joYongmin";

const chart = buildZiweiChart(JO_YONGMIN_BIRTH, zhongzhouV1);

function branchOf(starName: string): string | undefined {
  for (const p of chart.palaces) {
    if (p.majorStars.some((s) => s.name === starName) || p.minorStars.some((s) => s.name === starName)) {
      return p.branch;
    }
  }
  return undefined;
}

describe("조용민 fixture — Windada 실계산 결과 교차검증(2번째 케이스: 음남·金四局·역행)", () => {
  it("음력 변환/간지", () => {
    expect(chart.lunarBirth.year).toBe(JO_YONGMIN_EXPECTED.lunar.year);
    expect(chart.lunarBirth.month).toBe(JO_YONGMIN_EXPECTED.lunar.month);
    expect(chart.lunarBirth.day).toBe(JO_YONGMIN_EXPECTED.lunar.day);
    expect(chart.lunarBirth.hourBranch).toBe(JO_YONGMIN_EXPECTED.lunar.hourBranch);
    expect(chart.lunarBirth.yearStem).toBe(JO_YONGMIN_EXPECTED.lunar.yearStem);
    expect(chart.lunarBirth.yearBranch).toBe(JO_YONGMIN_EXPECTED.lunar.yearBranch);
  });

  it("命宮/身宮", () => {
    expect(chart.mingGong.branch).toBe(JO_YONGMIN_EXPECTED.mingGong);
    expect(chart.shenGong.branch).toBe(JO_YONGMIN_EXPECTED.shenGong);
    expect(chart.shenGong.palace).toBe("福德宮");
  });

  it("五行局(박소연과 다른 局: 金四局)", () => {
    expect(chart.fiveElementBureau).toEqual(JO_YONGMIN_EXPECTED.fiveElementBureau);
  });

  it("14주성 전체 위치", () => {
    for (const [star, expectedBranch] of Object.entries(JO_YONGMIN_EXPECTED.majorStarBranches)) {
      expect(branchOf(star), `${star} 위치`).toBe(expectedBranch);
    }
  });

  it("보조성 9개 전체 위치", () => {
    for (const [star, expectedBranch] of Object.entries(JO_YONGMIN_EXPECTED.auxiliaryStarBranches)) {
      expect(branchOf(star), `${star} 위치`).toBe(expectedBranch);
    }
  });

  it("生年四化(丁干)", () => {
    for (const kind of ["化祿", "化權", "化科", "化忌"] as const) {
      const expected = JO_YONGMIN_EXPECTED.birthYearTransformations[kind];
      const actual = chart.birthYearTransformations[kind];
      expect(actual.star, `${kind} 별`).toBe(expected.star);
      const palace = chart.palaces.find((p) => p.palace === actual.palace)!;
      expect(palace.branch, `${kind} 궁 지지`).toBe(expected.branch);
    }
  });

  it("大限 — 陰男 역행 + 나이 구간(박소연의 陰女 순행과 반대 방향)", () => {
    for (const [palaceName, [start, end]] of Object.entries(JO_YONGMIN_EXPECTED.majorPeriodAgeRangeByPalace)) {
      const period = chart.majorPeriods.find((p) => p.palace === palaceName)!;
      expect(period, `${palaceName} 대한`).toBeDefined();
      expect(period.ageRange, `${palaceName} 대한 나이구간`).toEqual([start, end]);
    }
    // 방향 검증: 命宮(戌,4-13) 다음이 兄弟宮(酉,14-23) — branch 인덱스 감소(역행).
    const mingIdx = chart.palaces.findIndex((p) => p.palace === "命宮");
    const nextByAge = chart.majorPeriods.find((p) => p.ageRange[0] === 14)!;
    expect(nextByAge.palace).toBe("兄弟宮");
    expect(mingIdx).toBeGreaterThanOrEqual(0);
  });
});
