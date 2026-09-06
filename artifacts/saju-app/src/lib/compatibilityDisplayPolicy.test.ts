// Phase 3 P0 UI/API 전환 회귀 테스트(2026-09).
// Compatibility.tsx와 clipboardExport.ts가 동일 source of truth(getCompatibilityCardPolicy)를
// 쓰는지, legacy 점수가 사용자 노출 텍스트에서 사라지고 신규 3축이 정확히 한 번만 노출되는지,
// getMarriageView가 marriageCompatibility.final을 쓰는지를 검증한다.
import { describe, it, expect, vi } from "vitest";
import { getCompatibilityCardPolicy } from "./compatibilityDisplayPolicy";
import { buildCompatibilityClipboardText } from "./clipboardExport";
import { calculateCompatibilityScore } from "./compatibilityScore";
import { generateLoverReport } from "./reports/LoverReportGenerator";
import { getMarriageStructuralView, getMarriageView } from "./compatibilityReport";
import * as compatibilityReportModule from "./compatibilityReport";
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
// day=축, 박소연 day=미 → 미·축은 표준 충 관계(compatibilityReport.branchRel 기준) — 구조
// evidence 전용 getMarriageStructuralView 검증용 픽스처.
const 조용민Base = buildPerson("조용민", { gender: "남", year: 1987, month: 11, day: 24, hour: 1, pillars: { year: "정묘", month: "신해", day: "정축", hour: "경자" } });

function clipboardTextFor(p1: PersonRecord, p2: PersonRecord, relType: RelationshipType): string {
  const person2 = withRelType(p2, relType);
  const result = calculateCompatibilityScore(p1, person2, relType);
  return buildCompatibilityClipboardText(p1, person2, result);
}

describe("1~6. getCompatibilityCardPolicy: relType별 카드 노출 정책", () => {
  it("lover/spouse/interest는 세 축 모두 표시한다", () => {
    for (const t of ["lover", "spouse", "interest"] as const) {
      expect(getCompatibilityCardPolicy(t)).toEqual({ showHuman: true, showRomance: true, showMarriage: true });
    }
  });

  it("friend/family/coworker는 인간관계 궁합만 표시한다", () => {
    for (const t of ["friend", "family", "coworker"] as const) {
      expect(getCompatibilityCardPolicy(t)).toEqual({ showHuman: true, showRomance: false, showMarriage: false });
    }
  });

  it("other/undefined도 안전 기본값(Human만)으로 처리한다", () => {
    expect(getCompatibilityCardPolicy("other")).toEqual({ showHuman: true, showRomance: false, showMarriage: false });
    expect(getCompatibilityCardPolicy(undefined)).toEqual({ showHuman: true, showRomance: false, showMarriage: false });
  });
});

describe("7~8. clipboard export: legacy 라벨 제거 + 신규 라벨 정확히 1회 노출", () => {
  it("lover 타입: 연애 궁합/결혼 궁합/인간관계 궁합 데이터 라인이 각각 정확히 1회, legacy 라벨은 없음", () => {
    // "연애 궁합:"은 데이터 라인(💕 연애 궁합: N점 —)과 AI 프롬프트 안내 항목(8번) 둘 다에
    // 나타날 수 있으므로, 여기서는 실제 "점수 데이터 라인"만 정확히 1회인지 확인한다.
    const text = clipboardTextFor(박소연, 현욱Base, "lover");
    expect((text.match(/💕 연애 궁합: \d+점 —/g) ?? []).length).toBe(1);
    expect((text.match(/💍 결혼 궁합: \d+점 —/g) ?? []).length).toBe(1);
    expect((text.match(/🤝 인간관계 궁합: \d+점 —/g) ?? []).length).toBe(1);
    expect(text).not.toMatch(/연애 적합도/);
    expect(text).not.toMatch(/결혼 적합도/);
    expect(text).not.toMatch(/총점:/);
  });

  it("spouse/interest도 lover와 동일하게 세 축 모두 노출한다", () => {
    for (const t of ["spouse", "interest"] as const) {
      const text = clipboardTextFor(박소연, 현욱Base, t);
      expect((text.match(/💕 연애 궁합: \d+점 —/g) ?? []).length).toBe(1);
      expect((text.match(/💍 결혼 궁합: \d+점 —/g) ?? []).length).toBe(1);
    }
  });

  it("friend/family/coworker: 인간관계 궁합만 노출되고 연애/결혼 궁합 라벨은 아예 없음", () => {
    for (const t of ["friend", "family", "coworker"] as const) {
      const text = clipboardTextFor(박소연, 현욱Base, t);
      expect((text.match(/인간관계 궁합:/g) ?? []).length).toBe(1);
      expect(text).not.toMatch(/연애 궁합:/);
      expect(text).not.toMatch(/결혼 궁합:/);
    }
  });
});

describe("9. getMarriageStructuralView: 구조 evidence 전용, legacy score threshold와 무관", () => {
  it("dayBranchRel==='충'이면 점수와 무관하게 항상 '자극·성장형'이다", () => {
    expect(getMarriageStructuralView("생", "충")).toEqual({
      type: "자극·성장형",
      typeColor: "text-amber-600",
      desc: expect.stringContaining("배우자궁의 충"),
    });
    // elRel을 바꿔도(생→극) dayBranchRel이 충이면 결과가 동일하다 — 점수 개념 자체가 없음.
    expect(getMarriageStructuralView("극", "충")).toEqual(getMarriageStructuralView("생", "충"));
  });

  it("충이 아니면 구조만으로 라벨을 결정할 수 없어 null을 반환한다(legacy threshold 없이는 미결정)", () => {
    expect(getMarriageStructuralView("생", "합")).toBeNull();
    expect(getMarriageStructuralView("피생", "지지삼합")).toBeNull();
    expect(getMarriageStructuralView("무관", "없음")).toBeNull();
  });

  it("marriageCompatibility.final 값이 바뀌어도(구조 evidence는 동일) structural label은 바뀌지 않는다", () => {
    // getMarriageStructuralView는 애초에 점수를 인자로 받지 않으므로, 동일 구조 입력에
    // 대해 항상 동일한 결과를 낸다 — 신규 Marriage 점수가 어떻게 변해도 영향 없음을 의미.
    const a = getMarriageStructuralView("생", "충");
    const b = getMarriageStructuralView("생", "충");
    expect(a).toEqual(b);
  });

  it("[대조] legacy getMarriageView는 같은 구조(isHap)에서도 점수만 다르면 다른 라벨을 준다 — 그래서 구조 전용으로 분리했다", () => {
    const high = getMarriageView(80, "생", "합");
    const mid = getMarriageView(66, "생", "합");
    const low = getMarriageView(52, "생", "합");
    expect(high.type).toBe("장기 안정형");
    expect(mid.type).toBe("정서적 결합형");
    expect(low.type).toBe("노력형 결합");
    expect(new Set([high.type, mid.type, low.type]).size).toBe(3);
  });
});

describe("10. generateLoverReport가 legacy getMarriageView 대신 getMarriageStructuralView를 쓴다", () => {
  it("day-branch가 충 관계인 픽스처(박소연↔조용민)에서 marriageView가 '자극·성장형'이다", () => {
    const report = generateLoverReport(박소연, 조용민Base, "lover");
    expect((report as any).marriageView?.type).toBe("자극·성장형");
  });

  it("day-branch가 충이 아닌 픽스처(박소연↔현욱)에서는 marriageView가 null이다(legacy score로 억지 결정하지 않음)", () => {
    const report = generateLoverReport(박소연, 현욱Base, "lover");
    expect((report as any).marriageView).toBeNull();
  });

  it("generateLoverReport는 legacy getMarriageView를 호출하지 않는다", () => {
    const spy = vi.spyOn(compatibilityReportModule, "getMarriageView");
    generateLoverReport(박소연, 조용민Base, "lover");
    generateLoverReport(박소연, 현욱Base, "lover");
    expect(spy).not.toHaveBeenCalled();
    spy.mockRestore();
  });
});

describe("11~12. 출생시간 미상(hour=null) 및 clipboard 정책 일치", () => {
  it("clipboard export가 에러 없이 생성되고 hour=null에서도 인간관계·연애·결혼 궁합이 정상 출력된다", () => {
    const text = clipboardTextFor(박소연, 박주성Base, "lover");
    expect(text).toContain("인간관계 궁합:");
    expect(text).toContain("연애 궁합:");
    expect(text).toContain("결혼 궁합:");
  });

  it("calculateCompatibilityScore의 세 신규 필드가 hour=null에서도 유효한 숫자를 낸다(친구 관계 포함)", () => {
    const person2 = withRelType(박주성Base, "friend");
    const r = calculateCompatibilityScore(박소연, person2, "friend");
    for (const m of [r.humanCompatibility, r.romanceCompatibility, r.marriageCompatibility]) {
      expect(Number.isFinite(m.final)).toBe(true);
    }
  });
});

describe("13. 기존 totalScore API field는 backward compatibility상 유지된다", () => {
  it("totalScore/romanceMarriageFit 필드는 여전히 CompatibilityResult에 존재한다(단, UI export 라벨에는 안 씀)", () => {
    const person2 = withRelType(현욱Base, "lover");
    const r = calculateCompatibilityScore(박소연, person2, "lover");
    expect(typeof r.totalScore).toBe("number");
    expect(r.romanceMarriageFit).toBeDefined();
    expect(typeof r.romanceMarriageFit.romanceScore).toBe("number");
  });
});
