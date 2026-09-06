// 월별 커플 관계 상호작용 확장(대운·세운·월운 time-layer engine) 회귀 테스트.
// 연도별 계산은 절대 값이 바뀌면 안 되고(하위호환), 월운은 기존 WOLUN_SCALE=0.5 관례를
// 명시적으로 재사용해야 한다(§5~§8 설계 승인 사항 검증).
import { describe, it, expect } from "vitest";
import {
  computeRelationshipInteractionByYearRange,
  computeRelationshipInteractionForYear,
  computeMonthlyRelationshipInteractions,
  type PersonInteractionContext,
} from "./relationshipInteractionActivation";
import { computeSpouseActivationByYearRange, computeSpouseActivationForMonth } from "./spouseActivation";
import { getMonthGanZhi } from "../luckCycles";
import type { DaewoonEntry } from "../luckCycles";
import type { RelationshipWealthEvaluations, ActivationEvaluation } from "./relationshipWealthEvaluation";

const baseEval: ActivationEvaluation = { score: 50, grade: "보통", positives: [], negatives: [], summary: "", debug: [] };
const evaluations: RelationshipWealthEvaluations = {
  officerActivation: { ...baseEval },
  spousePalaceStability: { ...baseEval },
  wealthActivation: { ...baseEval },
};

function daewoonFixed(stem: string, branch: string): DaewoonEntry[] {
  return Array.from({ length: 10 }, (_, i) => ({
    startAge: i * 10,
    endAge: i * 10 + 9,
    ganZhi: { stem, branch, stemHanja: "", branchHanja: "", hangul: stem + branch, hanja: "" },
  }));
}

const seunEntries = Array.from({ length: 5 }, (_, i) => ({
  year: 2024 + i,
  ganZhi: { hangul: ["갑진", "을사", "병오", "정미", "무신"][i] },
}));

// A 대운(을)↔B 일간(신) = 을신충(base 6), 세운(2026=병오)↔B 일간(신) = 병신합(base 7).
// 월운은 매달 바뀌며 여러 달에서 A 또는 B의 월운 천간이 상대 일간과 합·충을 이룬다(base 3).
const a: PersonInteractionContext = { name: "A", dayStem: "갑", dayBranch: "인", yongshin: "화", gisin: "금", birthYear: 1990, daewoon: daewoonFixed("을", "묘") };
const b: PersonInteractionContext = { name: "B", dayStem: "신", dayBranch: "해", yongshin: "목", gisin: "화", birthYear: 1988, daewoon: daewoonFixed("무", "진") };
const aSpouseCtx = { dayStem: a.dayStem, dayBranch: a.dayBranch, allStems: [a.dayStem], gender: "여" as const, evaluations, yongshin: a.yongshin, gisin: a.gisin, birthYear: a.birthYear, daewoon: a.daewoon, seunEntries };
const bSpouseCtx = { dayStem: b.dayStem, dayBranch: b.dayBranch, allStems: [b.dayStem], gender: "남" as const, evaluations, yongshin: b.yongshin, gisin: b.gisin, birthYear: b.birthYear, daewoon: b.daewoon, seunEntries };

describe("computeMonthlyRelationshipInteractions: 12개월 생성·기본 형태", () => {
  const months = computeMonthlyRelationshipInteractions({ a, b, aSpouseCtx, bSpouseCtx, year: 2026 });

  it("정확히 12개월을 생성하고, 월주는 getMonthGanZhi(연도, 월)와 일치한다", () => {
    expect(months.length).toBe(12);
    months.forEach((m, i) => {
      expect(m.year).toBe(2026);
      expect(m.month).toBe(i + 1);
      expect(m.monthPillar).toBe(getMonthGanZhi(2026, i + 1).hangul);
    });
  });

  it("activation/harmony/stability 점수는 모두 0~100 범위다", () => {
    for (const m of months) {
      expect(m.result.activationScore).toBeGreaterThanOrEqual(0);
      expect(m.result.activationScore).toBeLessThanOrEqual(100);
      expect(m.result.harmonyScore).toBeGreaterThanOrEqual(0);
      expect(m.result.harmonyScore).toBeLessThanOrEqual(100);
      expect(m.result.stabilityScore).toBeGreaterThanOrEqual(0);
      expect(m.result.stabilityScore).toBeLessThanOrEqual(100);
    }
  });

  it("1월(수정된 己丑)을 포함해 동일 입력에 대해 결정적이다", () => {
    const again = computeMonthlyRelationshipInteractions({ a, b, aSpouseCtx, bSpouseCtx, year: 2026 });
    expect(again).toEqual(months);
    expect(months[0].monthPillar).toBe("기축");
  });
});

describe("§6 STEM_CROSS_BASE 정책: 대운=6·세운=7(기존 그대로)·월운=6×0.5=3(명시)", () => {
  it("연도별 stemCross factor는 대운=6, 세운=7이다(기존 수치 무변경)", () => {
    const result = computeRelationshipInteractionByYearRange({ a, b, aSpouseCtx, bSpouseCtx, fromYear: 2026, count: 1 })[0].result;
    const stemCross = result.factors.filter((f) => f.category === "stemCross");
    const daewoonFactor = stemCross.find((f) => f.source.includes("대운"));
    const saeunFactor = stemCross.find((f) => f.source.includes("세운"));
    expect(daewoonFactor?.magnitude).toBe(6);
    expect(saeunFactor?.magnitude).toBe(7);
  });

  it("월별 stemCross factor 중 월운에서 온 것은 정확히 3(=base 6 × scale 0.5)이다", () => {
    const months = computeMonthlyRelationshipInteractions({ a, b, aSpouseCtx, bSpouseCtx, year: 2026 });
    const wolunStemCrossFactors = months
      .flatMap((m) => m.result.factors)
      .filter((f) => f.category === "stemCross" && f.source.includes("월운"));
    // 이 fixture는 여러 달에서 월운 천간이 상대 일간과 합·충을 이루도록 설계했다 — 실제로 발생해야 한다.
    expect(wolunStemCrossFactors.length).toBeGreaterThan(0);
    for (const f of wolunStemCrossFactors) expect(f.magnitude).toBe(3);
  });

  it("월별 결과에도 대운=6/세운=7은 매달 그대로 유지된다(월운 추가가 기존 축을 바꾸지 않음)", () => {
    const months = computeMonthlyRelationshipInteractions({ a, b, aSpouseCtx, bSpouseCtx, year: 2026 });
    for (const m of months) {
      const stemCross = m.result.factors.filter((f) => f.category === "stemCross");
      const daewoonFactor = stemCross.find((f) => f.source.includes("대운"));
      const saeunFactor = stemCross.find((f) => f.source.includes("세운"));
      expect(daewoonFactor?.magnitude).toBe(6);
      expect(saeunFactor?.magnitude).toBe(7);
    }
  });
});

describe("§7 WOLUN_SCALE=0.5가 spousePalaceStrike에도 동일하게 적용된다", () => {
  it("월운에서 온 spousePalaceStrike factor의 magnitude는 대운·세운 base의 절반이다", () => {
    // 대운·세운 base 표: 충15·형8·파6·해5·원진5·합9
    const HALVES: Record<string, number> = { "충": 7.5, "형": 4, "파": 3, "해": 2.5, "원진": 2.5, "합": 4.5 };
    const months = computeMonthlyRelationshipInteractions({ a, b, aSpouseCtx, bSpouseCtx, year: 2026 });
    const wolunStrikes = months
      .flatMap((m) => m.result.factors)
      .filter((f) => f.category === "spousePalaceStrike" && f.source.includes("월운"));
    for (const f of wolunStrikes) {
      const relType = Object.keys(HALVES).find((k) => f.label.includes(` ${k} (`));
      expect(relType, `라벨에서 관계 종류를 못 찾음: ${f.label}`).toBeTruthy();
      expect(f.magnitude).toBe(HALVES[relType!]);
    }
  });
});

describe("§4 하위호환: 연도별 함수는 월운 추가 전과 완전히 동일하다", () => {
  it("computeRelationshipInteractionForYear의 결과는 computeRelationshipInteractionByYearRange 항목과 정확히 같다", () => {
    const aYear = computeSpouseActivationByYearRange({ ...aSpouseCtx, fromYear: 2026, count: 1 })[0];
    const bYear = computeSpouseActivationByYearRange({ ...bSpouseCtx, fromYear: 2026, count: 1 })[0];
    const direct = computeRelationshipInteractionForYear(a, b, 2026, aYear, bYear, 1);
    const viaRange = computeRelationshipInteractionByYearRange({ a, b, aSpouseCtx, bSpouseCtx, fromYear: 2026, count: 1 })[0].result;
    expect(direct).toEqual(viaRange);
  });

  it("연도별 결과에는 월운 관련 factor가 전혀 없다(source에 '월운' 없음)", () => {
    const result = computeRelationshipInteractionByYearRange({ a, b, aSpouseCtx, bSpouseCtx, fromYear: 2026, count: 1 })[0].result;
    expect(result.factors.some((f) => f.source.includes("월운") || f.label.includes("월운"))).toBe(false);
  });

  it("골든 스냅샷: 이 fixture의 2026년 연도별 점수는 이번 리팩터 전후로 바뀌지 않는다", () => {
    const result = computeRelationshipInteractionByYearRange({ a, b, aSpouseCtx, bSpouseCtx, fromYear: 2026, count: 1 })[0].result;
    // computeRelationshipInteractionCore 추출 리팩터가 계산 결과를 조금도 바꾸지 않았음을
    // 고정하기 위한 스냅샷 — 리팩터 직후 실제 실행 결과를 그대로 기록했다(추측값 아님).
    expect({
      activationScore: result.activationScore,
      activationLevel: result.activationLevel,
      harmonyScore: result.harmonyScore,
      harmonyDirection: result.harmonyDirection,
      stabilityScore: result.stabilityScore,
      stabilityLevel: result.stabilityLevel,
    }).toEqual({
      activationScore: 72,
      activationLevel: "높음",
      harmonyScore: 83,
      harmonyDirection: "조화",
      stabilityScore: 62,
      stabilityLevel: "보통",
    });
  });
});

describe("§8 월별 개인 spouse snapshot이 실제 그 달의 월운을 반영한다", () => {
  it("computeSpouseActivationForMonth는 달마다 다른 wolunHangul을 실제로 사용한다(서로 다른 월 → 다른 결과 가능)", () => {
    const jan = computeSpouseActivationForMonth({ ...bSpouseCtx, year: 2026, month: 1 });
    const feb = computeSpouseActivationForMonth({ ...bSpouseCtx, year: 2026, month: 2 });
    // B의 1월(己丑)·2월(庚寅) 월운은 서로 다른 간지이므로 최소 factor 구성이 달라야 한다.
    expect(JSON.stringify(jan.factors)).not.toBe(JSON.stringify(feb.factors));
  });

  it("월별 개인 snapshot의 activation/stability는 0~100 범위이며 결정적이다", () => {
    for (let m = 1; m <= 12; m++) {
      const r1 = computeSpouseActivationForMonth({ ...aSpouseCtx, year: 2026, month: m });
      const r2 = computeSpouseActivationForMonth({ ...aSpouseCtx, year: 2026, month: m });
      expect(r1).toEqual(r2);
      expect(r1.activationScore).toBeGreaterThanOrEqual(0);
      expect(r1.activationScore).toBeLessThanOrEqual(100);
      expect(r1.stabilityScore).toBeGreaterThanOrEqual(0);
      expect(r1.stabilityScore).toBeLessThanOrEqual(100);
    }
  });

  it("월별 커플 계산의 ⑤⑥(개인 활성도·안정도 동조) 근거는 연간 스냅샷이 아니라 해당 월 스냅샷에서 온다", () => {
    // aSpouseCtx/bSpouseCtx를 월별 계산에 넘기면, 내부적으로 매달 새로 computeSpouseActivationForMonth를
    // 호출해야 한다 — 연간 스냅샷 하나를 12번 재사용하면 안 된다는 것을, 월별 personal snapshot이
    // 실제로 달라지는지로 간접 검증한다(위 테스트에서 이미 1월≠2월 확인됨). 여기서는 월별 커플 결과
    // 자체가 매달 달라지는지(즉 개인 스냅샷 재사용이 아니라 매달 재계산됨)를 다시 확인한다.
    const months = computeMonthlyRelationshipInteractions({ a, b, aSpouseCtx, bSpouseCtx, year: 2026 });
    const uniqueSignatures = new Set(months.map((m) => JSON.stringify(m.result.factors)));
    expect(uniqueSignatures.size).toBeGreaterThan(1);
  });
});

describe("§7 pushCrossGroupStructures: 기존 전례(삼합·방합 완성 보너스는 scale 미적용) 유지", () => {
  it("월운 branch가 삼합·방합 완성에 참여해도 magnitude는 여전히 flat 10(완성) 또는 3(흐름)이다", () => {
    const months = computeMonthlyRelationshipInteractions({ a, b, aSpouseCtx, bSpouseCtx, year: 2026 });
    const crossGroupFactors = months
      .flatMap((m) => m.result.factors)
      .filter((f) => f.category === "existingCrossReinforced" || f.category === "newCrossFormed");
    for (const f of crossGroupFactors) {
      expect([3, 10]).toContain(f.magnitude);
    }
  });
});

describe("두 사람 순서(swap) 대칭성", () => {
  it("a/b를 서로 바꿔도 activation/harmony/stability 점수는 동일하다(연도별)", () => {
    const forward = computeRelationshipInteractionByYearRange({ a, b, aSpouseCtx, bSpouseCtx, fromYear: 2026, count: 1 })[0].result;
    const swapped = computeRelationshipInteractionByYearRange({
      a: b, b: a, aSpouseCtx: bSpouseCtx, bSpouseCtx: aSpouseCtx, fromYear: 2026, count: 1,
    })[0].result;
    expect(swapped.activationScore).toBe(forward.activationScore);
    expect(swapped.harmonyScore).toBe(forward.harmonyScore);
    expect(swapped.stabilityScore).toBe(forward.stabilityScore);
  });

  it("a/b를 서로 바꿔도 activation/harmony/stability 점수는 동일하다(월별, 1~12월 전부)", () => {
    const forward = computeMonthlyRelationshipInteractions({ a, b, aSpouseCtx, bSpouseCtx, year: 2026 });
    const swapped = computeMonthlyRelationshipInteractions({
      a: b, b: a, aSpouseCtx: bSpouseCtx, bSpouseCtx: aSpouseCtx, year: 2026,
    });
    for (let i = 0; i < 12; i++) {
      expect(swapped[i].result.activationScore).toBe(forward[i].result.activationScore);
      expect(swapped[i].result.harmonyScore).toBe(forward[i].result.harmonyScore);
      expect(swapped[i].result.stabilityScore).toBe(forward[i].result.stabilityScore);
    }
  });
});

describe("선택적 입력 누락(개인 배우자궁·희신 없음)에도 안전하다", () => {
  it("dayBranch·heesin이 없는 사람도 크래시 없이 0~100 범위 결과를 낸다", () => {
    const noBranch: PersonInteractionContext = { name: "C", dayStem: "무", yongshin: "수", birthYear: 1995, daewoon: daewoonFixed("기", "축") };
    const noBranchSpouseCtx = { dayStem: noBranch.dayStem, allStems: [noBranch.dayStem], gender: "남" as const, evaluations, yongshin: noBranch.yongshin, birthYear: noBranch.birthYear, daewoon: noBranch.daewoon, seunEntries };
    const months = computeMonthlyRelationshipInteractions({ a, b: noBranch, aSpouseCtx, bSpouseCtx: noBranchSpouseCtx, year: 2026 });
    expect(months.length).toBe(12);
    for (const m of months) {
      expect(m.result.activationScore).toBeGreaterThanOrEqual(0);
      expect(m.result.activationScore).toBeLessThanOrEqual(100);
    }
  });
});
