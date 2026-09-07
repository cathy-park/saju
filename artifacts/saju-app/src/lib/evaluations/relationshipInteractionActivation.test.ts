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

describe("방향성 배우자궁 안정 기여도(보조지표): 기존 stability와 독립적으로 검증", () => {
  it("기존 a/b fixture(2026)에서 activation/harmony/stability는 이 보조지표 추가 전과 bit-identical이고, directionalStability는 별도 필드로만 존재한다", () => {
    const result = computeRelationshipInteractionByYearRange({ a, b, aSpouseCtx, bSpouseCtx, fromYear: 2026, count: 1 })[0].result;
    // §4의 골든 스냅샷과 동일한 값 — 이 describe 블록 추가가 기존 계산에 아무 영향도 주지 않았음을 재확인.
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
    expect(result.directionalStability.aToB.fromName).toBe("A");
    expect(result.directionalStability.bToA.fromName).toBe("B");
  });

  it("directionalStability에는 spousePalaceStrike 중 stability axis를 가진 factor만 들어가고, 파·해·원진·삼합방합·개인동조·용신기신교차는 절대 섞이지 않는다", () => {
    const months = computeMonthlyRelationshipInteractions({ a, b, aSpouseCtx, bSpouseCtx, year: 2026 });
    const allLabels = months.flatMap((m) => [
      ...m.result.directionalStability.aToB.evidence.map((e) => e.label),
      ...m.result.directionalStability.bToA.evidence.map((e) => e.label),
    ]);
    for (const label of allLabels) {
      const relType = ["충", "형", "합", "파", "해", "원진"].find((k) => label.includes(` ${k} (`));
      expect(relType, `라벨에서 관계 종류를 못 찾음: ${label}`).toBeTruthy();
      expect(["충", "형", "합"]).toContain(relType);
    }
  });

  it("비대칭: A만 B의 배우자궁을 직접 자극하면 A→B만 evidence를 갖고 B→A는 0/hasEvidence=false다", () => {
    const asymA: PersonInteractionContext = { name: "A", dayStem: "갑", dayBranch: "사", yongshin: "화", birthYear: 1990, daewoon: daewoonFixed("경", "오") };
    const asymB: PersonInteractionContext = { name: "B", dayStem: "무", dayBranch: "자", yongshin: "토", birthYear: 1988, daewoon: daewoonFixed("신", "묘") };
    const asymASpouseCtx = { dayStem: asymA.dayStem, dayBranch: asymA.dayBranch, allStems: [asymA.dayStem], gender: "여" as const, evaluations, yongshin: asymA.yongshin, birthYear: asymA.birthYear, daewoon: asymA.daewoon, seunEntries };
    const asymBSpouseCtx = { dayStem: asymB.dayStem, dayBranch: asymB.dayBranch, allStems: [asymB.dayStem], gender: "남" as const, evaluations, yongshin: asymB.yongshin, birthYear: asymB.birthYear, daewoon: asymB.daewoon, seunEntries };
    const result = computeRelationshipInteractionByYearRange({
      a: asymA, b: asymB, aSpouseCtx: asymASpouseCtx, bSpouseCtx: asymBSpouseCtx, fromYear: 2026, count: 1,
    })[0].result;
    const ds = result.directionalStability;
    expect(ds.aToB.hasEvidence).toBe(true);
    expect(ds.aToB.score).toBe(-30);
    expect(ds.aToB.evidence.length).toBe(2);
    expect(ds.aToB.evidence.every((e) => e.direction === "비우호")).toBe(true);
    expect(ds.bToA.hasEvidence).toBe(false);
    expect(ds.bToA.score).toBe(0);
    expect(ds.bToA.evidence.length).toBe(0);
    expect(ds.summary).toContain("A 쪽 대운·세운만");
  });

  it("양방향: A→B, B→A 모두 evidence를 가지면 두 방향 모두 독립적으로 채워진다", () => {
    const biA: PersonInteractionContext = { name: "A", dayStem: "갑", dayBranch: "자", yongshin: "화", birthYear: 1990, daewoon: daewoonFixed("경", "오") };
    const biB: PersonInteractionContext = { name: "B", dayStem: "무", dayBranch: "오", yongshin: "토", birthYear: 1988, daewoon: daewoonFixed("신", "자") };
    const biASpouseCtx = { dayStem: biA.dayStem, dayBranch: biA.dayBranch, allStems: [biA.dayStem], gender: "여" as const, evaluations, yongshin: biA.yongshin, birthYear: biA.birthYear, daewoon: biA.daewoon, seunEntries };
    const biBSpouseCtx = { dayStem: biB.dayStem, dayBranch: biB.dayBranch, allStems: [biB.dayStem], gender: "남" as const, evaluations, yongshin: biB.yongshin, birthYear: biB.birthYear, daewoon: biB.daewoon, seunEntries };
    const result = computeRelationshipInteractionByYearRange({
      a: biA, b: biB, aSpouseCtx: biASpouseCtx, bSpouseCtx: biBSpouseCtx, fromYear: 2026, count: 1,
    })[0].result;
    const ds = result.directionalStability;
    expect(ds.aToB.hasEvidence).toBe(true);
    expect(ds.aToB.score).toBe(-16);
    expect(ds.bToA.hasEvidence).toBe(true);
    expect(ds.bToA.score).toBe(-15);
    // 두 방향의 evidence가 서로 다른 factor 집합에서 나왔는지(교차 오염 없음) 확인.
    expect(ds.aToB.evidence.every((e) => e.label.startsWith("A ") && e.label.includes("B 배우자궁"))).toBe(true);
    expect(ds.bToA.evidence.every((e) => e.label.startsWith("B ") && e.label.includes("A 배우자궁"))).toBe(true);
    expect(ds.summary).toContain("방향");
  });

  it("0건: 방향 분리 가능한 배우자궁 직접 자극 evidence가 아예 없으면 두 방향 모두 0/hasEvidence=false이고, summary는 '영향 없음'이 아니라 '근거 없음'으로 표현한다", () => {
    const zeroA: PersonInteractionContext = { name: "A", dayStem: "갑", dayBranch: "묘", yongshin: "화", birthYear: 1990, daewoon: daewoonFixed("경", "사") };
    const zeroB: PersonInteractionContext = { name: "B", dayStem: "무", dayBranch: "진", yongshin: "토", birthYear: 1988, daewoon: daewoonFixed("신", "축") };
    const zeroASpouseCtx = { dayStem: zeroA.dayStem, dayBranch: zeroA.dayBranch, allStems: [zeroA.dayStem], gender: "여" as const, evaluations, yongshin: zeroA.yongshin, birthYear: zeroA.birthYear, daewoon: zeroA.daewoon, seunEntries };
    const zeroBSpouseCtx = { dayStem: zeroB.dayStem, dayBranch: zeroB.dayBranch, allStems: [zeroB.dayStem], gender: "남" as const, evaluations, yongshin: zeroB.yongshin, birthYear: zeroB.birthYear, daewoon: zeroB.daewoon, seunEntries };
    const result = computeRelationshipInteractionByYearRange({
      a: zeroA, b: zeroB, aSpouseCtx: zeroASpouseCtx, bSpouseCtx: zeroBSpouseCtx, fromYear: 2026, count: 1,
    })[0].result;
    const ds = result.directionalStability;
    expect(ds.aToB).toEqual({ fromName: "A", toName: "B", score: 0, hasEvidence: false, evidence: [] });
    expect(ds.bToA).toEqual({ fromName: "B", toName: "A", score: 0, hasEvidence: false, evidence: [] });
    expect(ds.summary).toContain("근거가 없습니다");
    expect(ds.summary).toContain("관계에 영향이 없다는 뜻은 아닙니다");
  });

  it("cap 초과: 대운+세운+월운이 모두 같은 방향으로 겹치면 raw 합(37.5)이 기존 CATEGORY_CAPS.spousePalaceStrike(30)로 클리핑되지만 evidence 항목은 누락 없이 전부 보존된다", () => {
    const capA: PersonInteractionContext = { name: "A", dayStem: "갑", dayBranch: "사", yongshin: "화", birthYear: 1990, daewoon: daewoonFixed("경", "오") };
    const capB: PersonInteractionContext = { name: "B", dayStem: "무", dayBranch: "자", yongshin: "토", birthYear: 1988, daewoon: daewoonFixed("신", "묘") };
    const capASpouseCtx = { dayStem: capA.dayStem, dayBranch: capA.dayBranch, allStems: [capA.dayStem], gender: "여" as const, evaluations, yongshin: capA.yongshin, birthYear: capA.birthYear, daewoon: capA.daewoon, seunEntries };
    const capBSpouseCtx = { dayStem: capB.dayStem, dayBranch: capB.dayBranch, allStems: [capB.dayStem], gender: "남" as const, evaluations, yongshin: capB.yongshin, birthYear: capB.birthYear, daewoon: capB.daewoon, seunEntries };
    const months = computeMonthlyRelationshipInteractions({ a: capA, b: capB, aSpouseCtx: capASpouseCtx, bSpouseCtx: capBSpouseCtx, year: 2026 });
    const june = months.find((m) => m.month === 6)!;
    expect(june.monthPillar).toBe("갑오");
    const ds = june.result.directionalStability;
    expect(ds.aToB.hasEvidence).toBe(true);
    expect(ds.aToB.score).toBe(-30); // raw -37.5(대운15+세운15+월운7.5)가 cap(30)에 걸려 클리핑됨
    expect(ds.aToB.evidence.length).toBe(3);
    const rawSum = ds.aToB.evidence.reduce((sum, e) => sum + e.magnitude, 0);
    expect(rawSum).toBe(37.5); // evidence 자체는 클리핑 이전 원본 그대로 보존
    expect(ds.bToA.hasEvidence).toBe(false);
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
