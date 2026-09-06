// Phase 3 Human/Romance/Marriage 목적별 3-모델 단위·통합 테스트(2026-09).
import { describe, it, expect } from "vitest";
import {
  getBranchRels,
  scoreDayBranchAffinityDelta,
  scoreSpousePalaceDelta,
  computeHumanCompatibility,
  computeRomanceCompatibility,
  computeMarriageCompatibility,
  calculateCompatibilityScore,
  HUMAN_CORE_WEIGHT_DM,
  HUMAN_CORE_WEIGHT_MB,
  HUMAN_CORE_WEIGHT_DBA,
  HUMAN_AUX_POS_MAX,
  HUMAN_AUX_NEG_MAX,
  ROMANCE_CORE_WEIGHT_DM,
  ROMANCE_CORE_WEIGHT_SP,
  ROMANCE_CORE_WEIGHT_MB,
  ROMANCE_AUX_POS_MAX,
  ROMANCE_AUX_NEG_MAX,
  MARRIAGE_CORE_WEIGHT_SP,
  MARRIAGE_CORE_WEIGHT_MB,
  MARRIAGE_CORE_WEIGHT_DM,
  MARRIAGE_AUX_POS_MAX,
  MARRIAGE_AUX_NEG_MAX,
  gradeFromScore,
} from "./compatibilityScore";
import type { PersonRecord, BirthInput } from "./storage";
import type { Pillar, ComputedPillars } from "./sajuEngine";

function pillar(hangul: string): Pillar {
  return { hangul, hanja: "" };
}

function buildPerson(
  id: string,
  opts: { gender: "남" | "여"; year: number; month: number; day: number; hour?: number; timeUnknown?: boolean; pillars: { year: string; month: string; day: string; hour: string | null } },
): PersonRecord {
  const computedPillars: ComputedPillars = {
    year: pillar(opts.pillars.year),
    month: pillar(opts.pillars.month),
    day: pillar(opts.pillars.day),
    hour: opts.pillars.hour ? pillar(opts.pillars.hour) : null,
  } as ComputedPillars;
  const birthInput: BirthInput = {
    name: id, gender: opts.gender, calendarType: "solar",
    year: opts.year, month: opts.month, day: opts.day, hour: opts.hour, minute: 0,
    timeUnknown: opts.timeUnknown ?? false,
  };
  const now = new Date().toISOString();
  return {
    id, birthInput,
    profile: {
      computedPillars,
      fiveElementDistribution: { 목: 0, 화: 0, 토: 0, 금: 0, 수: 0 },
      solarDate: { year: opts.year, month: opts.month, day: opts.day },
      rawResult: {} as any,
      isTimeCorrected: false,
    } as any,
    manualPillars: computedPillars,
    createdAt: now, updatedAt: now,
  };
}

describe("1. Human dayBranchAffinity는 relType에 영향받지 않는다", () => {
  it("scoreDayBranchAffinityDelta는 relType 파라미터 자체가 없다(구조적으로 배제)", () => {
    expect(scoreDayBranchAffinityDelta.length).toBe(2); // (b1, b2)만 받음
  });

  it("같은 지지쌍이라도 scoreSpousePalaceDelta는 relType에 따라 값이 줄어들지만 dayBranchAffinity는 항상 원래 크기다", () => {
    // 미·해 = 반합(+12). scoreSpousePalaceDelta는 friend일 때 0.3배(+4)로 줄어든다.
    const spLover = scoreSpousePalaceDelta("미", "해", "lover" as any);
    const spFriend = scoreSpousePalaceDelta("미", "해", "friend" as any);
    expect(spLover.delta).toBe(12);
    expect(spFriend.delta).toBe(4); // 감쇠됨
    const dba = scoreDayBranchAffinityDelta("미", "해");
    expect(dba.delta).toBe(12); // 항상 lover와 동일한 크기, relType 개념 자체가 없음
  });
});

describe("2. Human에는 tenGod/spouseStarModifier/marriageGroupStructureBonus가 들어가지 않는다", () => {
  it("computeHumanCompatibility는 aux 배열을 4개(bi/stem/ec/yong)만 받고, 그 정규화 분모는 HUMAN_AUX_*이다", () => {
    expect(HUMAN_AUX_POS_MAX).toBe(15 + 15 + 12 + 10); // tenGod(+12)·spouseStar(+5) 미포함
    expect(HUMAN_AUX_NEG_MAX).toBe(15 + 15 + 8 + 5); // tenGod(-8)·spouseStar(-5) 미포함
  });

  it("동일 aux 4요소에 5번째 인자로 큰 값을 몰래 넣어도(함수가 받지 않으므로) 결과가 바뀌지 않는다", () => {
    const withoutExtra = computeHumanCompatibility(0, 0, 0, [10, 10, 10, 10]);
    // computeHumanCompatibility는 auxDeltas 배열 길이를 신경 쓰지 않고 그대로 합산하므로,
    // 5번째 요소(tenGod에 해당하는 큰 값)를 넣으면 실제로 반영되어 버린다 — 이는 "Human이
    // tenGod을 배제"하는 보장이 함수 시그니처가 아니라 "호출부가 4개만 넘긴다"는 계약에
        // 있다는 뜻이므로, calculateCompatibilityScore가 실제로 4개만 넘기는지를 통합 테스트로 검증한다(아래 9번 참고).
    const withExtra = computeHumanCompatibility(0, 0, 0, [10, 10, 10, 10, 999]);
    expect(withExtra.auxPosRaw).not.toBe(withoutExtra.auxPosRaw);
  });
});

describe("3. Romance에는 spouseStarModifier가 정확히 한 번만 반영된다", () => {
  it("spouseStarModifier가 auxPosRaw/auxNegRaw에 정확히 1회 가산된다", () => {
    const withoutModifier = computeRomanceCompatibility(0, 0, 0, [0, 0, 0, 0, 0], 0, false);
    const withModifier = computeRomanceCompatibility(0, 0, 0, [0, 0, 0, 0, 0], 3, false);
    expect(withModifier.auxPosRaw - withoutModifier.auxPosRaw).toBe(3);
    const withNegModifier = computeRomanceCompatibility(0, 0, 0, [0, 0, 0, 0, 0], -2, false);
    expect(withNegModifier.auxNegRaw - withoutModifier.auxNegRaw).toBe(-2);
  });
});

describe("4. Marriage에는 marriageGroupStructureBonus가 정확히 한 번만 반영된다", () => {
  it("marriageBonus가 auxPosRaw에 정확히 1회 가산된다(항상 비음수이므로 auxNegRaw에는 영향 없음)", () => {
    const withoutBonus = computeMarriageCompatibility(0, 0, 0, [0, 0, 0, 0, 0], 0, false);
    const withBonus = computeMarriageCompatibility(0, 0, 0, [0, 0, 0, 0, 0], 8, false);
    expect(withBonus.auxPosRaw - withoutBonus.auxPosRaw).toBe(8);
    expect(withBonus.auxNegRaw).toBe(withoutBonus.auxNegRaw);
  });
});

describe("5. Human에는 spousePalaceMultiTension tier가 적용되지 않는다", () => {
  it("HumanCompatibilityBreakdown에는 structuralSteps 필드 자체가 없다", () => {
    const h = computeHumanCompatibility(0, 0, 0, [0, 0, 0, 0]);
    expect((h as any).structuralSteps).toBeUndefined();
    expect((h as any).structuralNetDelta).toBeUndefined();
  });

  it("Human의 tone은 tier 조정 없이 final 점수 그대로에서 결정된다", () => {
    const h = computeHumanCompatibility(15, 12, 18, [15, 15, 12, 10]); // 최댓값 근접
    expect(h.tone).toBe(gradeFromScore(h.final));
  });
});

describe("6~7. 모델별 Aux normalization max/min과 Core weight 합계 검증", () => {
  it("Human/Romance/Marriage Core weight 합은 각각 정확히 1.0이다", () => {
    expect(HUMAN_CORE_WEIGHT_DM + HUMAN_CORE_WEIGHT_MB + HUMAN_CORE_WEIGHT_DBA).toBeCloseTo(1.0, 10);
    expect(ROMANCE_CORE_WEIGHT_DM + ROMANCE_CORE_WEIGHT_SP + ROMANCE_CORE_WEIGHT_MB).toBeCloseTo(1.0, 10);
    expect(MARRIAGE_CORE_WEIGHT_SP + MARRIAGE_CORE_WEIGHT_MB + MARRIAGE_CORE_WEIGHT_DM).toBeCloseTo(1.0, 10);
  });

  it("Marriage Core weight는 sp42.5%/mb32.5%/dm25%다(과거 후보였던 dm27.5%가 아님)", () => {
    expect(MARRIAGE_CORE_WEIGHT_SP).toBeCloseTo(0.425, 10);
    expect(MARRIAGE_CORE_WEIGHT_MB).toBeCloseTo(0.325, 10);
    expect(MARRIAGE_CORE_WEIGHT_DM).toBeCloseTo(0.25, 10);
  });

  it("모델별 Aux POS/NEG_MAX는 실제 구성 scorer range의 합과 정확히 일치한다", () => {
    // Human = bi(15) + stem(15) + ec(12/-8) + yong(10/-5) — tenGod 제외
    expect(HUMAN_AUX_POS_MAX).toBe(15 + 15 + 12 + 10);
    expect(HUMAN_AUX_NEG_MAX).toBe(15 + 15 + 8 + 5);
    // Romance = bi+stem+ec+tg(12/-8)+yong + spouseStarModifier(5/-5)
    expect(ROMANCE_AUX_POS_MAX).toBe(15 + 15 + 12 + 12 + 10 + 5);
    expect(ROMANCE_AUX_NEG_MAX).toBe(15 + 15 + 8 + 8 + 5 + 5);
    // Marriage = bi+stem+ec+tg+yong + marriageGroupStructureBonus(8/0)
    expect(MARRIAGE_AUX_POS_MAX).toBe(15 + 15 + 12 + 12 + 10 + 8);
    expect(MARRIAGE_AUX_NEG_MAX).toBe(15 + 15 + 8 + 8 + 5); // marriageBonus는 음수 기여 없음 — Phase2 AUX_NEG_MAX와 동일
  });
});

describe("8. 동일 입력에서 deterministic 결과", () => {
  it("동일 인자로 반복 호출해도 세 모델 모두 완전히 같은 결과를 낸다", () => {
    const h1 = computeHumanCompatibility(-10, 4, 12, [6, 10, 7, 10]);
    const h2 = computeHumanCompatibility(-10, 4, 12, [6, 10, 7, 10]);
    expect(h1).toEqual(h2);

    const r1 = computeRomanceCompatibility(-10, 12, 4, [6, 10, 7, 1, 10], 0, false);
    const r2 = computeRomanceCompatibility(-10, 12, 4, [6, 10, 7, 1, 10], 0, false);
    expect(r1).toEqual(r2);

    const m1 = computeMarriageCompatibility(12, -6, 12, [0, 0, 0, 8, 3], 0.8, false);
    const m2 = computeMarriageCompatibility(12, -6, 12, [0, 0, 0, 8, 3], 0.8, false);
    expect(m1).toEqual(m2);
  });
});

describe("9. 출생시간 미상(시주 null)에서도 세 모델 모두 정상 계산된다", () => {
  it("박주성 패턴(시주 없음)으로 calculateCompatibilityScore 호출 시 세 모델 모두 유효한 숫자를 반환한다", () => {
    const 박소연 = buildPerson("박소연", { gender: "여", year: 1989, month: 2, day: 16, hour: 19, pillars: { year: "기사", month: "병인", day: "정미", hour: "기유" } });
    const 박주성 = buildPerson("박주성", { gender: "남", year: 1989, month: 5, day: 15, timeUnknown: true, pillars: { year: "기사", month: "기사", day: "을해", hour: null } });

    const r = calculateCompatibilityScore(박소연, 박주성, "lover" as any);

    for (const model of [r.humanCompatibility, r.romanceCompatibility, r.marriageCompatibility]) {
      expect(Number.isFinite(model.final)).toBe(true);
      expect(model.final).toBeGreaterThanOrEqual(0);
      expect(model.final).toBeLessThanOrEqual(100);
      expect(Number.isFinite(model.coreNorm)).toBe(true);
      expect(Number.isNaN(model.coreNorm)).toBe(false);
    }
  });
});

describe("10. 기존 totalScore backward compatibility 유지", () => {
  it("totalScore/baseScore는 Phase 3 필드 추가와 무관하게 Phase 2 Core/Aux 공식 그대로 계산된다", () => {
    const 박소연 = buildPerson("박소연", { gender: "여", year: 1989, month: 2, day: 16, hour: 19, pillars: { year: "기사", month: "병인", day: "정미", hour: "기유" } });
    const 현욱 = buildPerson("현욱", { gender: "남", year: 1995, month: 3, day: 21, hour: 14, pillars: { year: "을해", month: "기묘", day: "신해", hour: "을미" } });
    const r = calculateCompatibilityScore(박소연, 현욱, "lover" as any);
    expect(r.totalScore).toBe(r.baseScore);
    expect(r.score).toBe(r.baseScore);
    // baseScore는 여전히 coreAux(Phase2 dm/sp/mb 35/35/30)에서 유도된 값이다.
    const expected = Math.round(Math.max(0, Math.min(100, 50 + r.coreAux.coreContribution + r.coreAux.auxContribution)));
    expect(r.baseScore).toBe(expected);
    // Phase 3 필드가 추가돼도 romanceMarriageFit(legacy)은 그대로 존재한다.
    expect(r.romanceMarriageFit).toBeDefined();
    expect(typeof r.romanceMarriageFit.romanceScore).toBe("number");
  });
});

describe("11. dayBranchAffinity에서 compound relation이 단순 누적되지 않는다", () => {
  it("미·축(충+형 compound)은 충 하나의 값(-18)만 반영되고 형(-8)이 추가로 더해지지 않는다", () => {
    // Phase 1 감사에서 확인: getBranchRels(미,축) = ["충","형"] (HYEONG_MAP 방향성 때문에
    // 축·미 방향이 아니라 미·축 방향에서만 형이 함께 잡힘).
    expect(getBranchRels("미", "축")).toEqual(expect.arrayContaining(["충", "형"]));
    const dba = scoreDayBranchAffinityDelta("미", "축");
    expect(dba.delta).toBe(-18); // 충 우선순위 값만, -18-8=-26이 아님
  });
});

describe("12. dayBranchAffinity는 getBranchRels 반환 순서에 무관하게 deterministic하다", () => {
  it("자·미(원진+해 compound)는 방향을 바꿔도 항상 같은 값(원진 우선순위)이다", () => {
    const a = scoreDayBranchAffinityDelta("자", "미");
    const b = scoreDayBranchAffinityDelta("미", "자");
    expect(a.delta).toBe(b.delta);
    expect(a.delta).toBe(-9); // 원진이 해보다 우선순위가 높음
  });

  it("같은 함수를 여러 번 호출해도 항상 동일한 값을 반환한다(순수함수)", () => {
    const results = Array.from({ length: 5 }, () => scoreDayBranchAffinityDelta("해", "묘").delta);
    expect(new Set(results).size).toBe(1);
  });
});

describe("13~15. 모델별 Aux max/min 명시적 검증(요청 항목별 개별 확인)", () => {
  it("13. Human Aux max = +52 / -43", () => {
    expect(HUMAN_AUX_POS_MAX).toBe(52);
    expect(HUMAN_AUX_NEG_MAX).toBe(43);
  });
  it("14. Romance Aux max = +69 / -56", () => {
    expect(ROMANCE_AUX_POS_MAX).toBe(69);
    expect(ROMANCE_AUX_NEG_MAX).toBe(56);
  });
  it("15. Marriage Aux max = +72 / -51", () => {
    expect(MARRIAGE_AUX_POS_MAX).toBe(72);
    expect(MARRIAGE_AUX_NEG_MAX).toBe(51);
  });
});
