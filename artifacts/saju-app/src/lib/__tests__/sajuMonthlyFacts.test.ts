import { describe, it, expect } from "vitest";
import { calculateProfileFromBirth, countFiveElements, type BirthInput } from "../sajuEngine";
import { computeSajuPipeline, type SajuPipelineResult } from "../sajuPipeline";
import { buildSajuMonthlySections, type SajuMonthlyFact } from "../sajuMonthlyFacts";

const BIRTH: BirthInput = {
  name: "테스트", gender: "여", calendarType: "solar",
  year: 1989, month: 2, day: 16, hour: 19, minute: 29, timeUnknown: false,
};

function buildPipeline(opts: {
  gender?: "남" | "여";
  timingDaewoonHangul?: string;
  timingSeunHangul?: string;
  timingWolunHangul?: string;
} = {}): SajuPipelineResult {
  const profile = calculateProfileFromBirth(BIRTH);
  const { year, month, day, hour } = profile.computedPillars;
  const allStems = [hour?.hangul[0], day.hangul[0], month.hangul[0], year.hangul[0]].filter((c): c is string => !!c);
  const allBranches = [hour?.hangul[1], day.hangul[1], month.hangul[1], year.hangul[1]].filter((c): c is string => !!c);
  return computeSajuPipeline({
    dayStem: day.hangul[0],
    monthBranch: month.hangul[1],
    dayBranch: day.hangul[1],
    dayPillarHangul: day.hangul,
    allStems,
    allBranches,
    effectiveFiveElements: countFiveElements(profile.computedPillars),
    gender: opts.gender ?? "여",
    timingDaewoonHangul: opts.timingDaewoonHangul ?? "경신",
    timingSeunHangul: opts.timingSeunHangul ?? "갑진",
    timingWolunHangul: opts.timingWolunHangul,
  });
}

function factsOf(sections: ReturnType<typeof buildSajuMonthlySections>, key: string): SajuMonthlyFact[] {
  const s = sections.find((x) => x.key === key);
  if (!s) throw new Error(`section not found: ${key}`);
  return s.facts;
}

describe("sajuMonthlyFacts — 5개 섹션 고정 순서, 배경/이번달 구분, 모듈 간 magnitude 비교 없음", () => {
  it("5개 섹션이 고정 순서로 나온다", () => {
    const pipeline = buildPipeline({ timingWolunHangul: "을사" });
    const sections = buildSajuMonthlySections(pipeline);
    expect(sections.map((s) => s.key)).toEqual([
      "atAGlance", "workCareer", "wealth", "romanceRelationship", "cautions",
    ]);
  });

  it("career/officer/wealthActivation은 대운·세운만 반영하므로, 월운만 바꿔도 두 값이 동일하다(엔진 확인용 회귀 테스트)", () => {
    const withWolunA = buildPipeline({ timingWolunHangul: "을사" });
    const withWolunB = buildPipeline({ timingWolunHangul: "신해" });
    expect(withWolunA.careerActivation.interpretation).toBe(withWolunB.careerActivation.interpretation);
    expect(withWolunA.officerActivation.interpretation).toBe(withWolunB.officerActivation.interpretation);
    expect(withWolunA.wealthActivation.interpretation).toBe(withWolunB.wealthActivation.interpretation);
  });

  it("일·커리어/재물 섹션의 대운·세운 배경 문장은 항상 '(대운·세운 흐름 기준)'으로 명시하고, evidence 출처도 daewoon/saeun만 쓴다(wolun 아님)", () => {
    const pipeline = buildPipeline({ timingWolunHangul: "을사" });
    const sections = buildSajuMonthlySections(pipeline);

    const careerBackground = factsOf(sections, "workCareer").find((f) => f.domain === "career-background")!;
    expect(careerBackground.meaning).toContain("(대운·세운 흐름 기준)");
    for (const e of careerBackground.evidence) {
      expect(["daewoon", "saeun"]).toContain(e.category);
    }

    const wealthBackground = factsOf(sections, "wealth").find((f) => f.domain === "wealth-background")!;
    expect(wealthBackground.meaning).toContain("(대운·세운 흐름 기준)");
    for (const e of wealthBackground.evidence) {
      expect(["daewoon", "saeun"]).toContain(e.category);
    }
  });

  it("이번 달 결론(examCareerActivation/timingActivation 기반)은 '(이번 달' 접두사로 배경과 구분된다", () => {
    const pipeline = buildPipeline({ timingWolunHangul: "을사" });
    const sections = buildSajuMonthlySections(pipeline);

    const workCareerMonthlyFacts = factsOf(sections, "workCareer").filter((f) => f.domain.startsWith("exam-monthly"));
    expect(workCareerMonthlyFacts.length).toBeGreaterThan(0);
    for (const f of workCareerMonthlyFacts) expect(f.meaning).toContain("(이번 달");

    const wealthMonthlyTrend = factsOf(sections, "wealth").find((f) => f.domain === "wealth-monthly-trend")!;
    expect(wealthMonthlyTrend.meaning).toContain("(이번 달 기준)");
  });

  it("activationLevel(강함/보통/약함, 높음/낮음) 자체는 방향이 아니므로 positive/risk로 매핑되지 않는다 — 트렌드 fact는 항상 neutral", () => {
    const pipeline = buildPipeline({ timingWolunHangul: "을사" });
    const sections = buildSajuMonthlySections(pipeline);
    const trendFacts = factsOf(sections, "wealth").filter((f) => f.domain.startsWith("wealth-monthly-trend"));
    for (const f of trendFacts) expect(f.polarity).toBe("neutral");
  });

  it("한눈에 보기는 실제로 월운에 반응하는 축(contract/exam/spouse/timingActivation trend)만 후보로 쓰고, 후보가 없으면 '무난한 시기' 문구로 폴백한다", () => {
    const pipeline = buildPipeline({ timingWolunHangul: "을사" });
    const sections = buildSajuMonthlySections(pipeline);
    const atAGlance = factsOf(sections, "atAGlance");
    expect(atAGlance.length).toBeGreaterThan(0);
    expect(atAGlance.length).toBeLessThanOrEqual(2);
    const allowedDomains = [
      "contract-highlight", "exam-highlight", "spouse-highlight",
      "wealth-trend-highlight", "officer-trend-highlight", "no-highlight",
    ];
    for (const f of atAGlance) expect(allowedDomains).toContain(f.domain);
  });

  it("연애·관계는 gender가 없으면(spouseActivation 미계산) 빈 facts를 반환해 '근거 부족' fallback으로 표시된다", () => {
    const base = buildPipeline().input;
    const noGenderPipeline = computeSajuPipeline({
      dayStem: base.dayStem,
      monthBranch: base.monthBranch,
      dayBranch: base.dayBranch,
      dayPillarHangul: base.dayPillarHangul,
      allStems: base.allStems,
      allBranches: base.allBranches,
      effectiveFiveElements: base.effectiveFiveElements,
      timingDaewoonHangul: "경신",
      timingSeunHangul: "갑진",
      timingWolunHangul: "을사",
    });
    expect(noGenderPipeline.spouseActivation).toBeUndefined();
    const sections = buildSajuMonthlySections(noGenderPipeline);
    const romance = sections.find((s) => s.key === "romanceRelationship")!;
    expect(romance.facts).toEqual([]);
    expect(romance.text).toBe("");
  });

  it("연애·관계는 gender가 있으면 '(이번 달 기준)'으로 명시된 fact를 만든다(spouseActivation은 월운도 반영함)", () => {
    const pipeline = buildPipeline({ gender: "여", timingWolunHangul: "을사" });
    const sections = buildSajuMonthlySections(pipeline);
    const romance = factsOf(sections, "romanceRelationship");
    expect(romance.length).toBeGreaterThan(0);
    const monthly = romance.find((f) => f.domain === "spouse-monthly")!;
    expect(monthly.meaning).toContain("(이번 달 기준)");
  });

  it("주의할 점은 각 축 자신의 directionLevel/inflowLevel/stabilityLevel이 이미 부담·불리·불안정일 때만 등장하고, 전부 polarity=risk다(무난하면 neutral 폴백)", () => {
    const pipeline = buildPipeline({ timingWolunHangul: "을사" });
    const sections = buildSajuMonthlySections(pipeline);
    const cautions = factsOf(sections, "cautions");
    expect(cautions.length).toBeGreaterThan(0);
    expect(cautions.length).toBeLessThanOrEqual(3);
    for (const f of cautions) {
      expect(["risk", "neutral"]).toContain(f.polarity);
      if (f.domain !== "no-caution") expect(f.polarity).toBe("risk");
    }
  });

  it("계약·시험 activation은 월운 유무에 따라 factors가 달라질 수 있다(월운이 실제로 파이프라인에 전달됨을 확인)", () => {
    const withoutWolun = buildPipeline({ timingWolunHangul: undefined });
    const withWolun = buildPipeline({ timingWolunHangul: "을사" });
    expect(withoutWolun.input.timingWolunHangul).toBeUndefined();
    expect(withWolun.input.timingWolunHangul).toBe("을사");
    // 월운이 있을 때만 월운 태그가 붙은 evidence가 나올 수 있다(반드시 나온다는 보장은 아니므로
    // 존재 여부가 아니라 "월운 없을 때는 월운 태그가 절대 없다"만 강하게 검증한다).
    const noWolunFactors = [
      ...withoutWolun.contractActivation.factors,
      ...withoutWolun.examCareerActivation.examCert.factors,
      ...withoutWolun.examCareerActivation.hiring.factors,
      ...withoutWolun.examCareerActivation.competition.factors,
    ];
    for (const f of noWolunFactors) expect(f.label).not.toContain("월운");
  });
});
