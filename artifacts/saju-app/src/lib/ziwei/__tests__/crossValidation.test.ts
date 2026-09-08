// 3단계 검증 중 "2) 중간값 교차검증" — parkSoyeon.ts에 기록된, 공신력 있는 외부 계산기
// (Windada, https://fate.windada.com/cgi-bin/fate) 실제 결과와 우리 엔진 출력을 대조한다.
// 이 테스트가 실패하면 엔진의 계산 자체가 틀렸다는 뜻이다(fixture 쪽 숫자를 고치지 말 것 —
// 외부 소스 인용값이므로).
import { describe, it, expect } from "vitest";
import { buildZiweiChart } from "../buildZiweiChart";
import { zhongzhouV1 } from "../ruleSets/zhongzhouV1";
import { PARK_SOYEON_BIRTH, PARK_SOYEON_EXPECTED } from "./fixtures/parkSoyeon";

const chart = buildZiweiChart(PARK_SOYEON_BIRTH, zhongzhouV1);

describe("박소연 fixture — Windada 실계산 결과 교차검증", () => {
  it("음력 변환/간지", () => {
    expect(chart.lunarBirth.year).toBe(PARK_SOYEON_EXPECTED.lunar.year);
    expect(chart.lunarBirth.month).toBe(PARK_SOYEON_EXPECTED.lunar.month);
    expect(chart.lunarBirth.day).toBe(PARK_SOYEON_EXPECTED.lunar.day);
    expect(chart.lunarBirth.isLeapMonth).toBe(PARK_SOYEON_EXPECTED.lunar.isLeapMonth);
    expect(chart.lunarBirth.hourBranch).toBe(PARK_SOYEON_EXPECTED.lunar.hourBranch);
    expect(chart.lunarBirth.yearStem).toBe(PARK_SOYEON_EXPECTED.lunar.yearStem);
    expect(chart.lunarBirth.yearBranch).toBe(PARK_SOYEON_EXPECTED.lunar.yearBranch);
  });

  it("命宮/身宮", () => {
    expect(chart.mingGong.branch).toBe(PARK_SOYEON_EXPECTED.mingGong);
    expect(chart.shenGong.branch).toBe(PARK_SOYEON_EXPECTED.shenGong);
    expect(chart.shenGong.palace).toBe("財帛宮");
  });

  it("五行局", () => {
    expect(chart.fiveElementBureau.name).toBe(PARK_SOYEON_EXPECTED.fiveElementBureau.name);
    expect(chart.fiveElementBureau.element).toBe(PARK_SOYEON_EXPECTED.fiveElementBureau.element);
    expect(chart.fiveElementBureau.number).toBe(PARK_SOYEON_EXPECTED.fiveElementBureau.number);
  });

  function branchOf(starName: string): string | undefined {
    for (const p of chart.palaces) {
      if (p.majorStars.some((s) => s.name === starName) || p.minorStars.some((s) => s.name === starName)) {
        return p.branch;
      }
    }
    return undefined;
  }

  it("14주성 전체 위치", () => {
    for (const [star, expectedBranch] of Object.entries(PARK_SOYEON_EXPECTED.majorStarBranches)) {
      expect(branchOf(star), `${star} 위치`).toBe(expectedBranch);
    }
  });

  it("보조성(左輔右弼/文昌文曲/天魁天鉞/祿存擎羊陀羅/地空地劫) 위치", () => {
    for (const [star, expectedBranch] of Object.entries(PARK_SOYEON_EXPECTED.auxiliaryStarBranches)) {
      expect(branchOf(star), `${star} 위치`).toBe(expectedBranch);
    }
  });

  it("生年四化", () => {
    for (const kind of ["化祿", "化權", "化科", "化忌"] as const) {
      const expected = PARK_SOYEON_EXPECTED.birthYearTransformations[kind];
      const actual = chart.birthYearTransformations[kind];
      expect(actual.star, `${kind} 별`).toBe(expected.star);
      const palace = chart.palaces.find((p) => p.palace === actual.palace)!;
      expect(palace.branch, `${kind} 궁 지지`).toBe(expected.branch);
    }
  });

  it("大限 — 궁별 나이 구간(陰女 순행)", () => {
    for (const [palaceName, [start, end]] of Object.entries(PARK_SOYEON_EXPECTED.majorPeriodAgeRangeByPalace)) {
      const period = chart.majorPeriods.find((p) => p.palace === palaceName)!;
      expect(period, `${palaceName} 대한`).toBeDefined();
      expect(period.ageRange, `${palaceName} 대한 나이구간`).toEqual([start, end]);
    }
  });
});

describe("구조 불변식(외부 정답 없이도 검증 가능)", () => {
  it("12궁 branch가 전부 서로 다르고 12지지를 모두 포함한다", () => {
    const branches = chart.palaces.map((p) => p.branch);
    expect(new Set(branches).size).toBe(12);
  });

  it("대궁(oppositePalace)은 현재 궁의 +6 위치이고 서로 대칭이다", () => {
    const indexOf = new Map(chart.palaces.map((p, i) => [p.palace, i]));
    for (const p of chart.palaces) {
      const oppIndex = indexOf.get(p.oppositePalace)!;
      const selfIndex = indexOf.get(p.palace)!;
      expect((oppIndex - selfIndex + 12) % 12).toBe(6);
      // 대칭성: 대궁의 대궁은 자기 자신
      const opp = chart.palaces.find((x) => x.palace === p.oppositePalace)!;
      expect(opp.oppositePalace).toBe(p.palace);
    }
  });

  it("삼방(trinePalaces)은 현재 궁의 ±4 위치 두 곳이다", () => {
    const indexOf = new Map(chart.palaces.map((p, i) => [p.palace, i]));
    for (const p of chart.palaces) {
      const selfIndex = indexOf.get(p.palace)!;
      const offsets = p.trinePalaces.map((name) => (indexOf.get(name)! - selfIndex + 12) % 12).sort();
      expect(offsets).toEqual([4, 8]); // +4와 -4(=+8 mod12)
    }
  });

  it("生年四化는 정확히 4개이며 서로 다른 별에 하나씩만 붙는다", () => {
    const allTransformed = chart.palaces.flatMap((p) => p.transformations.map((t) => ({ t, palace: p.palace })));
    expect(allTransformed.length).toBe(4);
    const kinds = new Set(allTransformed.map((x) => x.t));
    expect(kinds.size).toBe(4);
  });

  it("五行局 number는 2~6 범위다", () => {
    expect(chart.fiveElementBureau.number).toBeGreaterThanOrEqual(2);
    expect(chart.fiveElementBureau.number).toBeLessThanOrEqual(6);
  });

  it("身宮은 12궁 중 정확히 하나에만 표시된다", () => {
    const shenGongPalaces = chart.palaces.filter((p) => p.isShenGong);
    expect(shenGongPalaces.length).toBe(1);
    expect(shenGongPalaces[0].palace).toBe(chart.shenGong.palace);
  });

  it("大限 12구간은 겹치지 않고 10년씩 연속이다", () => {
    const sorted = [...chart.majorPeriods].sort((a, b) => a.ageRange[0] - b.ageRange[0]);
    for (let i = 0; i < sorted.length; i++) {
      expect(sorted[i].ageRange[1] - sorted[i].ageRange[0]).toBe(9);
      if (i > 0) expect(sorted[i].ageRange[0]).toBe(sorted[i - 1].ageRange[1] + 1);
    }
  });
});

describe("결정론성(같은 입력 → 항상 같은 출력)", () => {
  it("동일 입력으로 다시 계산해도 완전히 동일한 결과", () => {
    const again = buildZiweiChart(PARK_SOYEON_BIRTH, zhongzhouV1);
    expect(again).toEqual(chart);
  });
});
