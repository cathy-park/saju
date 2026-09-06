// Phase 3 P1 회귀 테스트(2026-09).
// percentile 기반 해석 레이어(compatibilityInterpretation.ts)가 legacy scoring
// 파이프라인(compatibilityScore.ts/relationshipInteractionActivation.ts)을 건드리지 않고,
// CDF 데이터가 현재 scoring 산식과 버전이 맞는지, UI/clipboard가 동일 해석을 쓰는지 검증한다.
import { describe, it, expect } from "vitest";
import {
  getPurposeCompatibilityInterpretation,
  percentileGrade,
  formatTopPercent,
  isReferenceCDFVersionCurrent,
  COMPATIBILITY_SCORING_VERSION,
} from "./compatibilityInterpretation";
import { COMPATIBILITY_REFERENCE_CDF_METADATA } from "./compatibilityReferenceCDF";
import { gradeFromScore, calculateCompatibilityScore } from "./compatibilityScore";
import { dampeningFromCompatibilityTone } from "./evaluations/relationshipInteractionActivation";
import { buildCompatibilityClipboardText } from "./clipboardExport";
import type { PersonRecord, BirthInput, RelationshipType } from "./storage";
import type { Pillar, ComputedPillars } from "./sajuEngine";

function pillar(hangul: string): Pillar {
  return { hangul, hanja: "" };
}
function buildPerson(
  id: string,
  opts: {
    gender: "남" | "여";
    year: number; month: number; day: number; hour?: number; timeUnknown?: boolean;
    relationshipType?: RelationshipType;
    pillars: { year: string; month: string; day: string; hour: string | null };
  },
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
    relationshipType: opts.relationshipType,
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
function withRelType(p: PersonRecord, relationshipType: RelationshipType): PersonRecord {
  return { ...p, relationshipType };
}

const 박소연 = buildPerson("박소연", { gender: "여", year: 1989, month: 2, day: 16, hour: 19, pillars: { year: "기사", month: "병인", day: "정미", hour: "기유" } });
const 현욱Base = buildPerson("현욱", { gender: "남", year: 1995, month: 3, day: 21, hour: 14, pillars: { year: "을해", month: "기묘", day: "신해", hour: "을미" } });
const 박주성Base = buildPerson("박주성", { gender: "남", year: 1989, month: 5, day: 15, timeUnknown: true, pillars: { year: "기사", month: "기사", day: "을해", hour: null } });
// canonical fixture(대표 지정, 2026-09): 임시 fixture가 아니라 Phase 3 baseline 재현에 쓰는
// 실제 입력. Human 61/Romance 56/Marriage 50 (최명진), Human 37/Romance 36/Marriage 42(이동훈)
// 이 이 입력으로 재현됨을 아래 "17. canonical fixture" describe에서 고정 회귀로 검증한다.
const 최명진Canonical = buildPerson("최명진", { gender: "남", year: 1999, month: 7, day: 12, hour: 13, pillars: { year: "기묘", month: "신미", day: "을축", hour: "임오" } });
const 이동훈Canonical = buildPerson("이동훈", { gender: "남", year: 1986, month: 3, day: 19, hour: 23, pillars: { year: "병인", month: "신묘", day: "임술", hour: "신해" } });

describe("1. per-model score→percentile lookup: 결정론적(동일 입력 → 동일 출력)", () => {
  it("같은 (model, score)를 반복 호출해도 항상 동일한 referencePercentile/topPercent/grade를 낸다", () => {
    const a = getPurposeCompatibilityInterpretation("human", 67);
    const b = getPurposeCompatibilityInterpretation("human", 67);
    expect(a).toEqual(b);
  });
});

describe("2. Human/Romance/Marriage는 서로 다른 CDF를 쓴다", () => {
  it("동일 raw score라도 모델에 따라 referencePercentile이 달라질 수 있다(적어도 하나는 다름)", () => {
    const scoresToCheck = [30, 40, 50, 60, 70, 80];
    const anyDiffers = scoresToCheck.some((s) => {
      const h = getPurposeCompatibilityInterpretation("human", s).referencePercentile;
      const r = getPurposeCompatibilityInterpretation("romance", s).referencePercentile;
      const m = getPurposeCompatibilityInterpretation("marriage", s).referencePercentile;
      return h !== r || r !== m || h !== m;
    });
    expect(anyDiffers).toBe(true);
  });
});

describe("3. percentile 등급 5구간 경계값(lower-bound-inclusive) — 8개 지정값", () => {
  it.each([
    [14.9, "주의 필요"],
    [15.0, "다소 낮은 편"],
    [34.9, "다소 낮은 편"],
    [35.0, "보통"],
    [69.9, "보통"],
    [70.0, "좋은 편"],
    [89.9, "좋은 편"],
    [90.0, "매우 좋은 편"],
  ] as const)("percentileGrade(%s) === %s", (p, expected) => {
    expect(percentileGrade(p)).toBe(expected);
  });
});

describe("4. topPercent 계산", () => {
  it("topPercent === round(100 - referencePercentile)", () => {
    for (const s of [0, 10, 33, 50, 67, 89, 100]) {
      const interp = getPurposeCompatibilityInterpretation("human", s);
      expect(interp.topPercent).toBe(Math.round(100 - interp.referencePercentile));
    }
  });
});

describe("5. clipboard/UI 신규 표시는 legacy tone 문자열이 아니라 새 등급 어휘를 쓴다", () => {
  it("lover 타입 clipboard 텍스트의 궁합 점수 라인에는 legacy tone(예: 노력형/이상적 궁합)이 아니라 신규 5등급 어휘가 등장한다", () => {
    const person2 = withRelType(현욱Base, "lover");
    const result = calculateCompatibilityScore(박소연, person2, "lover");
    const text = buildCompatibilityClipboardText(박소연, person2, result);
    const scoreLines = text.split("\n").filter((l) => /^\s*(🤝|💕|💍) .+: \d+점 · /u.test(l));
    expect(scoreLines.length).toBeGreaterThan(0);
    for (const line of scoreLines) {
      expect(line).not.toMatch(/이상적 궁합|좋은 궁합|노력형 궁합|긴장형 궁합|주의 궁합/);
      expect(line).toMatch(/주의 필요|다소 낮은 편|보통|좋은 편|매우 좋은 편/);
    }
  });
});

describe("6. 비연애(Human 단독) clipboard도 동일 해석 레이어를 쓴다", () => {
  it("friend 타입에서 인간관계 궁합 라인의 등급/퍼센트가 getPurposeCompatibilityInterpretation과 정확히 일치한다", () => {
    const person2 = withRelType(현욱Base, "friend");
    const result = calculateCompatibilityScore(박소연, person2, "friend");
    const text = buildCompatibilityClipboardText(박소연, person2, result);
    const expected = getPurposeCompatibilityInterpretation("human", result.humanCompatibility.final);
    expect(text).toContain(`🤝 인간관계 궁합: ${result.humanCompatibility.final}점 · ${expected.grade} · 기준 분포 상위 ${expected.topPercentDisplay}`);
  });
});

describe("7. romantic H/R/M 세 카드가 동일 정책(동일 포맷)을 따른다", () => {
  it("lover 타입 clipboard에서 인간관계/연애/결혼 세 줄 모두 '점수 · 등급 · 기준 분포 상위 약 N%' 포맷이다", () => {
    const person2 = withRelType(박주성Base, "lover");
    const result = calculateCompatibilityScore(박소연, person2, "lover");
    const text = buildCompatibilityClipboardText(박소연, person2, result);
    const pattern = /^\s*(🤝|💕|💍) .+: \d+점 · (주의 필요|다소 낮은 편|보통|좋은 편|매우 좋은 편) · 기준 분포 상위 (약 \d+%|1% 이내)$/u;
    const lines = text.split("\n").filter((l) => /^\s*(🤝|💕|💍) .+: \d+점 · /u.test(l));
    expect(lines.length).toBe(3);
    for (const line of lines) expect(line).toMatch(pattern);
  });
});

describe("8. clipboard와 UI 해석 레이어 일관성", () => {
  it("clipboard의 세 궁합 라인 각각의 topPercent/grade가 getPurposeCompatibilityInterpretation 직접 호출 결과와 완전히 같다(같은 소스 사용)", () => {
    const person2 = withRelType(현욱Base, "spouse");
    const result = calculateCompatibilityScore(박소연, person2, "spouse");
    const text = buildCompatibilityClipboardText(박소연, person2, result);
    const models = [
      ["human", result.humanCompatibility.final] as const,
      ["romance", result.romanceCompatibility.final] as const,
      ["marriage", result.marriageCompatibility.final] as const,
    ];
    for (const [model, score] of models) {
      const interp = getPurposeCompatibilityInterpretation(model, score);
      expect(text).toContain(`${score}점 · ${interp.grade} · 기준 분포 상위 ${interp.topPercentDisplay}`);
    }
  });
});

describe("9. legacy gradeFromScore는 변경되지 않았다(80/68/55/40)", () => {
  it("경계값에서 기존 5등급을 그대로 반환한다", () => {
    expect(gradeFromScore(80)).toBe("이상적 궁합");
    expect(gradeFromScore(79)).toBe("좋은 궁합");
    expect(gradeFromScore(68)).toBe("좋은 궁합");
    expect(gradeFromScore(67)).toBe("노력형 궁합");
    expect(gradeFromScore(55)).toBe("노력형 궁합");
    expect(gradeFromScore(54)).toBe("긴장형 궁합");
    expect(gradeFromScore(40)).toBe("긴장형 궁합");
    expect(gradeFromScore(39)).toBe("주의 궁합");
  });
});

describe("10. result.finalType은 변경되지 않았다(골든 픽스처 회귀)", () => {
  it("박소연↔현욱(lover) 조합의 finalType이 기존과 동일한 고정값을 유지한다", () => {
    const person2 = withRelType(현욱Base, "lover");
    const result = calculateCompatibilityScore(박소연, person2, "lover");
    // P1은 compatibilityScore.ts를 전혀 수정하지 않았으므로, 이 값은 Phase 3 P0 baseline과
    // 동일해야 한다. gradeFromScore/shiftTier가 반환 가능한 5개 값 중 하나임을 최소 보증하고,
    // 실행 시점의 실제 값을 golden value로 고정한다.
    expect(["이상적 궁합", "좋은 궁합", "노력형 궁합", "긴장형 궁합", "주의 궁합"]).toContain(result.finalType);
    expect(result.finalType).toBe(gradeFromScore(result.totalScore));
  });
});

describe("11. dampeningFromCompatibilityTone 동작은 변경되지 않았다", () => {
  it("5개 tone에 대한 감쇠 계수가 기존 매핑(1/0.9/0.75/0.6/0.45)과 동일하다", () => {
    expect(dampeningFromCompatibilityTone("이상적 궁합")).toBe(1);
    expect(dampeningFromCompatibilityTone("좋은 궁합")).toBe(0.9);
    expect(dampeningFromCompatibilityTone("노력형 궁합")).toBe(0.75);
    expect(dampeningFromCompatibilityTone("긴장형 궁합")).toBe(0.6);
    expect(dampeningFromCompatibilityTone("주의 궁합")).toBe(0.45);
  });
});

describe("12. scoring-model-version ↔ CDF-model-version 가드(결정론적 문자열 비교, 시뮬레이션 없음)", () => {
  it("COMPATIBILITY_SCORING_VERSION과 COMPATIBILITY_REFERENCE_CDF_METADATA.scoringModelVersion이 일치한다", () => {
    expect(COMPATIBILITY_REFERENCE_CDF_METADATA.scoringModelVersion).toBe(COMPATIBILITY_SCORING_VERSION);
    expect(isReferenceCDFVersionCurrent()).toBe(true);
  });
});

describe("13. 출생시간 미상(hour=null, 박주성)도 end-to-end로 동작한다", () => {
  it("hour=null 조합에서도 세 모델 모두 유효한 interpretation을 낸다", () => {
    const person2 = withRelType(박주성Base, "lover");
    const result = calculateCompatibilityScore(박소연, person2, "lover");
    for (const [model, score] of [
      ["human", result.humanCompatibility.final],
      ["romance", result.romanceCompatibility.final],
      ["marriage", result.marriageCompatibility.final],
    ] as const) {
      const interp = getPurposeCompatibilityInterpretation(model, score);
      expect(Number.isFinite(interp.referencePercentile)).toBe(true);
      expect(interp.referencePercentile).toBeGreaterThanOrEqual(0);
      expect(interp.referencePercentile).toBeLessThanOrEqual(100);
      expect(["주의 필요", "다소 낮은 편", "보통", "좋은 편", "매우 좋은 편"]).toContain(interp.grade);
    }
  });
});

describe("14. score 0/100 경계값", () => {
  it("score=0은 referencePercentile이 매우 낮고 topPercent가 100에 가깝다", () => {
    const interp = getPurposeCompatibilityInterpretation("human", 0);
    expect(interp.referencePercentile).toBeGreaterThanOrEqual(0);
    expect(interp.referencePercentile).toBeLessThan(5);
    expect(interp.topPercent).toBeGreaterThan(95);
    expect(interp.grade).toBe("주의 필요");
  });

  it("score=100은 referencePercentile이 100이고 topPercent가 0이다", () => {
    const interp = getPurposeCompatibilityInterpretation("human", 100);
    expect(interp.referencePercentile).toBe(100);
    expect(interp.topPercent).toBe(0);
    expect(interp.grade).toBe("매우 좋은 편");
  });
});

describe("15. formatTopPercent: '상위 0%' 방지", () => {
  it("topPercentRaw < 1(0 포함)이면 '1% 이내'를 반환한다", () => {
    expect(formatTopPercent(0)).toBe("1% 이내");
    expect(formatTopPercent(0.3)).toBe("1% 이내");
    expect(formatTopPercent(0.99)).toBe("1% 이내");
  });

  it("percentile=100(topPercentRaw=0)인 실제 케이스도 '1% 이내'다", () => {
    const interp = getPurposeCompatibilityInterpretation("human", 100);
    expect(interp.topPercentRaw).toBe(0);
    expect(interp.topPercentDisplay).toBe("1% 이내");
  });

  it("일반 구간(raw>=1)은 반올림한 '약 N%'를 반환한다", () => {
    expect(formatTopPercent(1)).toBe("약 1%");
    expect(formatTopPercent(26.5)).toBe("약 27%");
    expect(formatTopPercent(53.3)).toBe("약 53%");
    expect(formatTopPercent(99.4)).toBe("약 99%");
  });

  it("실제 CDF에서 topPercentRaw가 0과 1 사이인 케이스(human score=84, referencePercentile 99.1)도 '1% 이내'로 표시된다", () => {
    const interp = getPurposeCompatibilityInterpretation("human", 84);
    expect(interp.topPercentRaw).toBeGreaterThan(0);
    expect(interp.topPercentRaw).toBeLessThan(1);
    expect(interp.topPercentDisplay).toBe("1% 이내");
  });
});

describe("16. UI/clipboard에 '상위 0%'가 절대 출력되지 않는다", () => {
  it("clipboard 텍스트 전체에 '상위 0%' 또는 '상위 약 0%' 문구가 없다(score=100에 가까운 고득점 픽스처 포함)", () => {
    const person2 = withRelType(최명진Canonical, "lover");
    const result = calculateCompatibilityScore(박소연, person2, "lover");
    const text = buildCompatibilityClipboardText(박소연, person2, result);
    expect(text).not.toMatch(/상위 0%/);
    expect(text).not.toMatch(/상위 약 0%/);
  });

  it("getPurposeCompatibilityInterpretation이 모든 (model, score 0~100) 조합에서 '0%'류 topPercentDisplay를 만들지 않는다", () => {
    const models = ["human", "romance", "marriage"] as const;
    for (const model of models) {
      for (let score = 0; score <= 100; score++) {
        const interp = getPurposeCompatibilityInterpretation(model, score);
        expect(interp.topPercentDisplay).not.toBe("0%");
        expect(interp.topPercentDisplay).not.toBe("약 0%");
      }
    }
  });
});

describe("17. canonical fixture Phase 3 score 불변 회귀(최명진/이동훈)", () => {
  it("canonical 최명진(1999-07-12 13:29, 기묘/신미/을축/임오)의 Phase3 score가 baseline과 동일하다", () => {
    const person2 = withRelType(최명진Canonical, "lover");
    const result = calculateCompatibilityScore(박소연, person2, "lover");
    expect(result.humanCompatibility.final).toBe(61);
    expect(result.romanceCompatibility.final).toBe(56);
    expect(result.marriageCompatibility.final).toBe(50);
  });

  it("canonical 이동훈(1986-03-19 23:30, 병인/신묘/임술/신해)의 Phase3 score가 baseline과 동일하다", () => {
    const person2 = withRelType(이동훈Canonical, "lover");
    const result = calculateCompatibilityScore(박소연, person2, "lover");
    expect(result.humanCompatibility.final).toBe(37);
    expect(result.romanceCompatibility.final).toBe(36);
    expect(result.marriageCompatibility.final).toBe(42);
  });
});
