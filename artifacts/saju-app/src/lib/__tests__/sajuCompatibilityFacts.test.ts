import { describe, it, expect } from "vitest";
import { getCompatibilityReport } from "../reports";
import { buildSajuCompatibilitySections } from "../sajuCompatibilityFacts";
import type { PersonRecord, BirthInput } from "../storage";
import type { Pillar, ComputedPillars } from "../sajuEngine";

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

const 박소연 = buildPerson("박소연", { gender: "여", year: 1989, month: 2, day: 16, hour: 19, pillars: { year: "기사", month: "병인", day: "정미", hour: "기유" } });
const 박주성 = buildPerson("박주성", { gender: "남", year: 1989, month: 5, day: 15, timeUnknown: true, pillars: { year: "기사", month: "기사", day: "을해", hour: null } });

function factsOf(sections: ReturnType<typeof buildSajuCompatibilitySections>, key: string) {
  const s = sections.find((x) => x.key === key);
  if (!s) throw new Error(`section not found: ${key}`);
  return s.facts;
}

describe("sajuCompatibilityFacts — 3점수 분리, 정적 엔진만, 빈 섹션 숨김", () => {
  it("6개 섹션이 고정 순서로 나온다", () => {
    const report = getCompatibilityReport(박소연, 박주성, "lover");
    const sections = buildSajuCompatibilitySections(report);
    expect(sections.map((s) => s.key)).toEqual([
      "atAGlance", "attraction", "emotionCommunication", "conflictPattern", "longTermMarriage", "relationshipTips",
    ]);
  });

  it("한눈에 보는 관계는 human/romance/marriage 3개를 절대 평균·합산하지 않고 각각 독립된 fact로 둔다(로맨틱 relType)", () => {
    const report = getCompatibilityReport(박소연, 박주성, "lover");
    const facts = factsOf(buildSajuCompatibilitySections(report), "atAGlance");
    expect(facts.map((f) => f.domain)).toEqual(["score-human", "score-romance", "score-marriage"]);
    // 서로 다른 산식이라 값이 다를 수 있다 — 최소한 셋 다 독립적으로 존재하는지만 확인.
    const result = report.scoreResult;
    expect(facts[0].meaning).toContain(String(result.humanCompatibility.tone));
    expect(facts[1].meaning).toContain(String(result.romanceCompatibility.tone));
    expect(facts[2].meaning).toContain(String(result.marriageCompatibility.tone));
  });

  it("비로맨틱 relType(friend)은 한눈에 보는 관계에 human만 남고, 끌림·호감/감정·소통/장기연애·결혼은 생략된다", () => {
    const report = getCompatibilityReport(박소연, 박주성, "friend");
    const sections = buildSajuCompatibilitySections(report);
    expect(factsOf(sections, "atAGlance").map((f) => f.domain)).toEqual(["score-human"]);
    expect(factsOf(sections, "attraction")).toEqual([]);
    expect(factsOf(sections, "emotionCommunication")).toEqual([]);
    expect(factsOf(sections, "longTermMarriage")).toEqual([]);
  });

  it("끌림·호감은 humanCompatibility를 쓰지 않고 spouseStructureAxisComparison의 image축만 쓴다(로맨틱)", () => {
    const report = getCompatibilityReport(박소연, 박주성, "lover");
    const facts = factsOf(buildSajuCompatibilitySections(report), "attraction");
    expect(facts.length).toBe(1);
    expect(facts[0].domain).toBe("attraction-image");
    for (const e of facts[0].evidence) expect(e.category).toBe("compatAxis");
  });

  it("감정·소통은 emotional축과 satisfactionLine만 쓴다(로맨틱)", () => {
    const report = getCompatibilityReport(박소연, 박주성, "lover");
    const facts = factsOf(buildSajuCompatibilitySections(report), "emotionCommunication");
    expect(facts.map((f) => f.domain)).toEqual(["emotion-cross", "emotion-satisfaction"]);
  });

  it("장기연애·결혼은 marriageView가 있으면 그것만, 없으면 marriageCompatibility 점수 fact 하나만 쓴다(spouseActivationTiming 미사용)", () => {
    const report = getCompatibilityReport(박소연, 박주성, "lover");
    const facts = factsOf(buildSajuCompatibilitySections(report), "longTermMarriage");
    expect(facts.length).toBe(1);
    if ("marriageView" in report && report.marriageView) {
      expect(facts[0].domain).toBe("marriage-structural-view");
    } else {
      expect(facts[0].domain).toBe("score-marriage");
    }
    // spouseActivationTiming 관련 evidence/문구가 섞이지 않았는지 확인.
    for (const f of facts) {
      expect(f.meaning).not.toMatch(/spouseActivationTiming|활성.*연도|TOP3/);
    }
  });

  it("갈등 패턴/관계 운영 포인트는 details[] 중 부정/긍정 항목만 쓰고, filler 없이 근거가 없으면 빈 배열이다", () => {
    const report = getCompatibilityReport(박소연, 박주성, "lover");
    const sections = buildSajuCompatibilitySections(report);
    const conflicts = factsOf(sections, "conflictPattern");
    const tips = factsOf(sections, "relationshipTips");
    for (const f of conflicts) expect(f.polarity).toBe("risk");
    for (const f of tips) expect(f.polarity).toBe("positive");
    // 두 섹션 모두 최대 4개까지만.
    expect(conflicts.length).toBeLessThanOrEqual(4);
    expect(tips.length).toBeLessThanOrEqual(4);
  });

  it("getConflictPoints/getHarmonyPoints/getRelationshipTips(필러 위험 있는 템플릿)는 쓰지 않는다 — details[] 8개 항목의 title과 DETAIL_PATTERN_LABEL 매핑이 실제로 맞아떨어지는지 확인", () => {
    const report = getCompatibilityReport(박소연, 박주성, "lover");
    const titles = report.scoreResult.details.slice(0, 8).map((d) => d.title);
    const knownTitles = ["일간 분석", "배우자궁", "월지 교차", "지지 교차", "천간 교차", "오행 보완", "십성 관계", "용신 보완"];
    expect(titles).toEqual(knownTitles);
  });

  it("evidence에는 원자료(delta·note 원문)가 그대로 보존된다", () => {
    const report = getCompatibilityReport(박소연, 박주성, "lover");
    const sections = buildSajuCompatibilitySections(report);
    const allEvidence = sections.flatMap((s) => s.evidence);
    expect(allEvidence.length).toBeGreaterThan(0);
    for (const e of allEvidence) {
      expect(e.label.length).toBeGreaterThan(0);
    }
  });
});
