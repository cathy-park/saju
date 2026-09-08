import { describe, it, expect } from "vitest";
import { calculateProfileFromBirth, countFiveElements, type BirthInput } from "../sajuEngine";
import { computeSajuPipeline, type SajuPipelineResult } from "../sajuPipeline";
import { analyzeBranchRelations, type BranchRelation } from "../branchRelations";
import { buildSajuSummarySections, type SajuFact } from "../sajuSummaryFacts";
import type { ShinsalInterpretationEntry } from "../shinsalInterpretation";

const BIRTH: BirthInput = {
  name: "테스트", gender: "여", calendarType: "solar",
  year: 1989, month: 2, day: 16, hour: 19, minute: 29, timeUnknown: false,
};

function buildPipeline(): SajuPipelineResult {
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
    gender: "여",
  });
}

function buildRelations(): BranchRelation[] {
  const profile = calculateProfileFromBirth(BIRTH);
  const { year, month, day, hour } = profile.computedPillars;
  return analyzeBranchRelations({ year, month, day, hour });
}

const pipeline = buildPipeline();
const branchRelations = buildRelations();
const shinsalEntries: ShinsalInterpretationEntry[] = [
  { id: "sh-1", name: "도화살", pillar: "일주", anchor: "지지", basisKind: "day_branch", basisLabel: "일지 기준", triggerDetail: "테스트", influenceDomain: "관계", activationStates: [], oneLine: "매력과 인기를 끌기 쉬운 기운이 있습니다" },
];

function factsOf(sections: ReturnType<typeof buildSajuSummarySections>, key: string): SajuFact[] {
  const s = sections.find((x) => x.key === key);
  if (!s) throw new Error(`section not found: ${key}`);
  return s.facts;
}

describe("sajuSummaryFacts — 우선순위 고정 + neutral 보존 + 신살 격리", () => {
  const sections = buildSajuSummarySections(pipeline, branchRelations, shinsalEntries);

  it("6개 섹션이 고정 순서로 나온다", () => {
    expect(sections.map((s) => s.key)).toEqual([
      "atAGlance", "coreNature", "strengths", "cautions", "workWealth", "romanceRelationship",
    ]);
  });

  it("격국.tone이 명시한 값만 그대로 polarity로 쓴다(길=positive/흉=risk/중=neutral) — 새 판단 없음", () => {
    const gukguk = pipeline.interpretation.gukguk;
    if (!gukguk) return; // 이 fixture에서 격국이 미확정이면 스킵(다른 fixture로 재확인 필요)
    const atAGlanceFacts = factsOf(sections, "atAGlance");
    const gukgukFact = atAGlanceFacts.find((f) => f.domain === "gukguk")!;
    const expected = gukguk.tone === "길" ? "positive" : gukguk.tone === "흉" ? "risk" : "neutral";
    expect(gukgukFact.polarity).toBe(expected);
  });

  it("용신은 정의상 positive로 쓴다(엔진이 준 effectiveYongshin 값 그대로, 새 계산 없음)", () => {
    const atAGlanceFacts = factsOf(sections, "atAGlance");
    const yongshinFact = atAGlanceFacts.find((f) => f.domain === "yongshin")!;
    expect(yongshinFact.polarity).toBe("positive");
    expect(yongshinFact.meaning).toContain(pipeline.adjusted.effectiveYongshin);
  });

  it("강약·오행·십성·합충형파해원진은 엔진이 길흉을 명시하지 않으므로 전부 neutral로 보존한다", () => {
    const atAGlanceFacts = factsOf(sections, "atAGlance");
    const strengthFact = atAGlanceFacts.find((f) => f.domain === "strength");
    if (strengthFact) expect(strengthFact.polarity).toBe("neutral");

    for (const key of ["workWealth", "romanceRelationship"] as const) {
      for (const f of factsOf(sections, key)) {
        if (f.domain.startsWith("tenGod")) expect(f.polarity).toBe("neutral");
      }
    }
    const cautionFacts = factsOf(sections, "cautions");
    const interactionFact = cautionFacts.find((f) => f.domain === "interaction");
    if (interactionFact) expect(interactionFact.polarity).toBe("neutral");
  });

  it("신살은 어떤 경우에도 main facts에 들어가지 않고 evidence에만 남는다(대표 지시: 신살=main fallback 금지)", () => {
    const coreNatureSection = sections.find((s) => s.key === "coreNature")!;
    const shinsalInFacts = coreNatureSection.facts.filter((f) => f.domain.startsWith("shinsal"));
    expect(shinsalInFacts.length).toBe(0);
    expect(coreNatureSection.evidence.some((e) => e.category === "shinsal")).toBe(true);

    for (const key of ["atAGlance", "strengths", "cautions", "workWealth", "romanceRelationship"] as const) {
      const hasShinsal = factsOf(sections, key).some((f) => f.domain.startsWith("shinsal"));
      expect(hasShinsal).toBe(false);
    }
  });

  it("'핵심 성향' 본문에 신살이 '참고로'로 섞이지 않는다(참고로 문구 자체를 더 이상 만들지 않음)", () => {
    const coreNatureText = sections.find((s) => s.key === "coreNature")!.text;
    expect(coreNatureText).not.toContain("참고로");
    expect(coreNatureText).not.toContain(shinsalEntries[0].oneLine);
  });

  it("일·재물과 연애·관계는 서로 다른 축을 참조해 같은 문장을 만들지 않지만, 메인 문장에는 기술용어(재성/식상/관성/비겁)를 노출하지 않는다", () => {
    const workWealthText = sections.find((s) => s.key === "workWealth")!.text;
    const romanceText = sections.find((s) => s.key === "romanceRelationship")!.text;
    expect(workWealthText).not.toBe(romanceText);
    for (const term of ["재성", "식상", "관성", "비겁"]) {
      expect(workWealthText).not.toContain(term);
      expect(romanceText).not.toContain(term);
    }
    // 원자료(그룹명)는 evidence에는 그대로 남아있어야 한다.
    const workWealth = sections.find((s) => s.key === "workWealth")!;
    const romance = sections.find((s) => s.key === "romanceRelationship")!;
    expect(workWealth.evidence.some((e) => e.label.includes("재성"))).toBe(true);
    expect(romance.evidence.some((e) => e.label.includes("관성"))).toBe(true);
  });

  it("근거 토글에 쓸 evidence에는 강약 점수/격국명/용신 오행/십성 카운트/합충형파해원진/신살 원자료가 모두 남아있다", () => {
    const categories = new Set(sections.flatMap((s) => s.evidence.map((e) => e.category)));
    expect(categories.has("strength")).toBe(true);
    expect(categories.has("gukguk")).toBe(true);
    expect(categories.has("yongshin")).toBe(true);
    expect(categories.has("tenGod")).toBe(true);
    expect(categories.has("shinsal")).toBe(true);
  });
});

describe("sajuSummaryFacts — 섹션별 fact 선정(RULE_SECTION_MAP) + 메인/evidence 분리", () => {
  const sections = buildSajuSummarySections(pipeline, branchRelations, shinsalEntries);

  it("R09(극신강 독립·사업형, 신강약 카테고리)는 이제 '핵심 성향'이 아니라 '강점'에 배치된다", () => {
    // 이 fixture는 비겁 강+태강 조건을 만족해 R09가 실제로 발동한다(과거엔 category==='신강약'
    // 필터로 coreNature에 섞여 들어갔던 규칙 — RULE_SECTION_MAP 도입 후 strengths로만 간다).
    const coreNatureFacts = factsOf(sections, "coreNature");
    const strengthFacts = factsOf(sections, "strengths");
    expect(coreNatureFacts.some((f) => f.domain === "rule-R09")).toBe(false);
    expect(strengthFacts.some((f) => f.domain === "rule-R09")).toBe(true);
  });

  it("R11(오행 결핍, 용신 카테고리)은 '주의할 점'에 배치되고 '일·재물'/'연애·관계'에는 섞이지 않는다", () => {
    expect(factsOf(sections, "cautions").some((f) => f.domain === "rule-R11")).toBe(true);
    expect(factsOf(sections, "workWealth").some((f) => f.domain === "rule-R11")).toBe(false);
    expect(factsOf(sections, "romanceRelationship").some((f) => f.domain === "rule-R11")).toBe(false);
  });

  it("모든 섹션의 메인 fact 개수는 0~4개 사이다(전역 우선순위 절단이 아니라 섹션별 선택 — 0개는 '억지로 채우지 않고 섹션을 숨김'을 뜻한다)", () => {
    for (const s of sections) {
      expect(s.facts.length).toBeGreaterThanOrEqual(0);
      expect(s.facts.length).toBeLessThanOrEqual(4);
    }
  });

  it("메인 fact 문장에는 timing 표현(시기/증가한다/전환점/기회가 생긴다)이 없다", () => {
    const timingPattern = /시기|증가한다|전환점|기회가 생긴다/;
    for (const s of sections) {
      for (const f of s.facts) {
        expect(f.meaning).not.toMatch(timingPattern);
      }
    }
  });

  it("'일·재물'/'연애·관계'가 규칙 대신 fallback을 쓸 때도 evidence에는 십성 원자료(카운트)가 그대로 남는다", () => {
    const workWealth = sections.find((s) => s.key === "workWealth")!;
    const romance = sections.find((s) => s.key === "romanceRelationship")!;
    expect(workWealth.evidence.some((e) => e.category === "tenGod")).toBe(true);
    expect(romance.evidence.some((e) => e.category === "tenGod")).toBe(true);
  });
});

describe("sajuSummaryFacts — 메인 본문 기술용어 제거 + evidence 보존", () => {
  const sections = buildSajuSummarySections(pipeline, branchRelations, shinsalEntries);
  const TECH_TERMS = ["일간", "재성", "식상", "관성", "비겁", "인성"];

  it("메인 fact 문장 어디에도 명리 기술용어(일간/재성/식상/관성/비겁/인성/격국명)가 노출되지 않는다", () => {
    const gukgukName = pipeline.interpretation.gukguk?.name;
    for (const s of sections) {
      for (const f of s.facts) {
        for (const term of TECH_TERMS) expect(f.meaning).not.toContain(term);
        if (gukgukName) expect(f.meaning).not.toContain(gukgukName);
      }
    }
  });

  it("evidence에는 격국명·강약 등급·규칙 원문이 기술용어 그대로 남아있다(메인에서만 숨김, 정보 손실 없음)", () => {
    const gukguk = pipeline.interpretation.gukguk;
    const atAGlanceEv = sections.find((s) => s.key === "atAGlance")!.evidence;
    if (gukguk) {
      expect(atAGlanceEv.some((e) => e.category === "gukguk" && e.label.includes(gukguk.name))).toBe(true);
    }
    expect(atAGlanceEv.some((e) => e.category === "strength" && e.label.includes(pipeline.base.strengthResult.level))).toBe(true);

    const coreNatureEv = sections.find((s) => s.key === "coreNature")!.evidence;
    expect(coreNatureEv.some((e) => e.category === "ruleInsight")).toBe(true);
  });
});

/** 조용민 실제 원국(신살 12개, 매핑 규칙 0개) 회귀 테스트 — 이 케이스에서 실제로 터졌던
 * 4가지 문제(신살 대량 유입, 강점=용신/희신 회귀, 주의할 점 구조 설명 정체, 일재물/연애관계
 * 박소연과 동일 문장)를 각각 직접 검증한다. */
describe("sajuSummaryFacts — 조용민(신살 다수 + 규칙 0개) 회귀 방지", () => {
  const joBirth: BirthInput = {
    name: "조용민", gender: "남", calendarType: "solar",
    year: 1987, month: 11, day: 24, hour: 1, minute: 20, timeUnknown: false,
  };
  const joProfile = calculateProfileFromBirth(joBirth);
  const joPillars = joProfile.computedPillars;
  const joPipeline = computeSajuPipeline({
    dayStem: joPillars.day.hangul[0],
    monthBranch: joPillars.month.hangul[1],
    dayBranch: joPillars.day.hangul[1],
    dayPillarHangul: joPillars.day.hangul,
    allStems: [joPillars.hour?.hangul[0], joPillars.day.hangul[0], joPillars.month.hangul[0], joPillars.year.hangul[0]].filter((c): c is string => !!c),
    allBranches: [joPillars.hour?.hangul[1], joPillars.day.hangul[1], joPillars.month.hangul[1], joPillars.year.hangul[1]].filter((c): c is string => !!c),
    effectiveFiveElements: countFiveElements(joPillars),
    gender: "남",
  });
  const joBranchRelations = analyzeBranchRelations(joPillars);
  // 실제로 문제를 일으켰던 것과 같은 모양(다수 신살, 그중 하나는 timing 표현 포함)으로 재현.
  const joShinsalEntries: ShinsalInterpretationEntry[] = Array.from({ length: 12 }, (_, i) => ({
    id: `sh-${i}`, name: `신살${i}`, pillar: "일주", anchor: "지지",
    basisKind: "day_branch", basisLabel: "일지 기준", triggerDetail: "t",
    influenceDomain: "관계", activationStates: [],
    oneLine: i === 0 ? "만남과 이동의 기회가 늘어나는 시기입니다" : `신살${i} 관련 기운이 있습니다`,
  }));
  const joSections = buildSajuSummarySections(joPipeline, joBranchRelations, joShinsalEntries);

  it("규칙이 0개 뜨는 케이스라도 신살이 main에 전혀 섞이지 않는다(구 버전 회귀: 12개가 그대로 유입됐었음)", () => {
    expect(joPipeline.interpretation.rulesApplied.some((r) => r.fired)).toBe(false); // 이 fixture는 규칙 0개가 전제
    for (const s of joSections) {
      expect(s.facts.some((f) => f.domain.startsWith("shinsal"))).toBe(false);
      expect(s.text).not.toContain("참고로");
    }
  });

  it("timing 표현이 포함된 신살이 있어도(구 버전 회귀 원인) main 문장에는 나타나지 않는다", () => {
    for (const s of joSections) {
      expect(s.text).not.toMatch(/시기|증가한다|전환점|기회가 늘어나는/);
    }
  });

  it("'강점'은 용신·희신으로 채워지지 않는다 — 실제 능력 fact가 없으면 섹션이 비어(숨김) 있다(구 버전 회귀: 용신/희신 문구로 채워졌었음)", () => {
    const strengths = joSections.find((s) => s.key === "strengths")!;
    expect(strengths.facts.some((f) => f.domain.includes("yongshin"))).toBe(false);
    expect(strengths.facts.some((f) => f.domain.includes("huishin"))).toBe(false);
    expect(strengths.facts.length).toBe(0); // 조용민은 격국도 없고 강점 규칙도 안 떠서 숨김이 맞다
  });

  it("'주의할 점'은 합충형파해 명칭·구조 설명이 아니라 행동 패턴 문장으로 나온다", () => {
    const cautions = joSections.find((s) => s.key === "cautions")!;
    expect(cautions.text.length).toBeGreaterThan(0);
    expect(cautions.text).not.toMatch(/^세 지지가 결합해 오행 기운을 강화하는 구조적 흐름/);
  });

  it("일·재물/연애·관계는 박소연과 문장이 다를 수도, 같을 수도 있다 — '항상 같은 고정 템플릿'이던 구 버전 회귀가 아니라, 실제 십성 비율(STRONG/WEAK 판정)에 근거해 같음/다름이 결정된다", () => {
    const parkSections = buildSajuSummarySections(pipeline, branchRelations, shinsalEntries);
    const parkWorkWealth = parkSections.find((s) => s.key === "workWealth")!.text;
    const joWorkWealth = joSections.find((s) => s.key === "workWealth")!.text;
    // 박소연은 식상(STRONG)·재성(WEAK)으로 뚜렷이 갈려 dominant 문장이 나오고,
    // 조용민은 재성·식상·관성·비겁이 고르게 분포해(모두 MEDIUM) balanced 문장이 나온다 —
    // 그래서 이번엔 실제로 달라야 한다(우연이 아니라 근거가 다르기 때문).
    expect(parkWorkWealth).not.toBe(joWorkWealth);
  });
});

/** 김민지·박주성·심다인 실제 원국 회귀 테스트 — "일·재물/연애·관계가 5개 중 2개 그룹만 보다
 * 보니 generic 문장으로 수렴", "주의할 점에 합(긍정) 계열이 섞여 polarity/section 오류",
 * "gukguk 설명의 세부 십성명(정관/편재)·구체 직업명이 메인에 재노출"이라는 3가지 회귀를
 * 각각 직접 재현·고정한다. */
function buildFor(birth: BirthInput) {
  const profile = calculateProfileFromBirth(birth);
  const { year, month, day, hour } = profile.computedPillars;
  const allStems = [hour?.hangul[0], day.hangul[0], month.hangul[0], year.hangul[0]].filter((c): c is string => !!c);
  const allBranches = [hour?.hangul[1], day.hangul[1], month.hangul[1], year.hangul[1]].filter((c): c is string => !!c);
  const p = computeSajuPipeline({
    dayStem: day.hangul[0], monthBranch: month.hangul[1], dayBranch: day.hangul[1],
    dayPillarHangul: day.hangul, allStems, allBranches,
    effectiveFiveElements: countFiveElements(profile.computedPillars), gender: birth.gender === "여" ? "여" : "남",
  });
  const br = analyzeBranchRelations({ year, month, day, hour });
  return buildSajuSummarySections(p, br, []);
}

describe("sajuSummaryFacts — 김민지·박주성·심다인 회귀 방지(5개 십성 분포 + 주의할 점 polarity + gukguk 세부 십성명)", () => {
  const kim = buildFor({ name: "t", gender: "여", calendarType: "solar", year: 1989, month: 8, day: 15, hour: 10, minute: 3, timeUnknown: false });
  const park = buildFor({ name: "t", gender: "남", calendarType: "solar", year: 1989, month: 5, day: 15, hour: 0, minute: 0, timeUnknown: true });
  const sim = buildFor({ name: "t", gender: "여", calendarType: "solar", year: 1995, month: 3, day: 4, hour: 16, minute: 30, timeUnknown: false });

  it("일·재물/연애·관계는 5개 십성 그룹 전체를 보고 판단한다 — 김민지·박주성은 서로 다른 그룹이 STRONG이라 서로 다른 문장이 나온다(구 버전 회귀: 둘 다 balanced로 수렴했었음)", () => {
    const kimWorkWealth = kim.find((s) => s.key === "workWealth")!.text;
    const parkWorkWealth = park.find((s) => s.key === "workWealth")!.text;
    expect(kimWorkWealth).not.toBe(parkWorkWealth);
    // 김민지는 비겁만 STRONG(단일 문장) — 식상·재성 라벨이 섞이지 않아야 한다.
    expect(kimWorkWealth).not.toContain("표현·창의");
    expect(kimWorkWealth).not.toContain("재물·현실");
    // 박주성은 식상+재성이 함께 STRONG(결합 문장)이어야 한다.
    expect(parkWorkWealth).toContain("표현·창의");
    expect(parkWorkWealth).toContain("재물·현실");
  });

  it("STRONG인 그룹이 2개 이상이면(박소연: 비겁+식상) 결합 문장을 쓰고, 1개뿐이면(김민지: 비겁만) 단일 문장을 쓴다", () => {
    const parkSoyeonSections = buildSajuSummarySections(pipeline, branchRelations, shinsalEntries);
    const parkSoyeonWorkWealth = parkSoyeonSections.find((s) => s.key === "workWealth")!.text;
    expect(parkSoyeonWorkWealth).toContain("독립·의지");
    expect(parkSoyeonWorkWealth).toContain("표현·창의");
    const kimWorkWealth = kim.find((s) => s.key === "workWealth")!.text;
    expect(kimWorkWealth).not.toContain("표현·창의"); // 김민지는 식상이 STRONG이 아니므로 안 섞인다
  });

  it("'주의할 점'에는 합 계열(조화·긍정)이 섞이지 않는다 — 김민지는 천간합·지지육합이 있지만 실제로 캡션에 쓰이는 건 형(갈등) 뿐이어야 한다(구 버전 회귀: 합 계열 문장이 주의할 점에 들어갔었음)", () => {
    const kimCautions = kim.find((s) => s.key === "cautions")!.text;
    expect(kimCautions).not.toContain("잘 맞아떨어지는");
    expect(kimCautions).not.toContain("편안하고 밀착된");
    // evidence에는 천간합·지지육합 원자료가 여전히 남아있어야 한다(정보 손실 없음).
    const kimCautionsEv = kim.find((s) => s.key === "cautions")!.evidence;
    expect(kimCautionsEv.some((e) => e.label.startsWith("천간합"))).toBe(true);
  });

  it("gukguk 설명의 세부 십성명(정관/편재)과 구체 직업명은 메인에 노출되지 않는다 — evidence에는 원문 그대로 남는다", () => {
    const kimAtAGlance = kim.find((s) => s.key === "atAGlance")!;
    expect(kimAtAGlance.text).not.toContain("정관");
    expect(kimAtAGlance.text).not.toMatch(/공직|법조|관리직/);
    expect(kimAtAGlance.evidence.some((e) => e.category === "gukguk" && e.label.includes("정관"))).toBe(true);

    const simAtAGlance = sim.find((s) => s.key === "atAGlance")!;
    expect(simAtAGlance.text).not.toContain("편재");
    expect(simAtAGlance.text).not.toMatch(/무역|금융|인연이 깊습니다/);
    expect(simAtAGlance.evidence.some((e) => e.category === "gukguk" && e.label.includes("편재"))).toBe(true);
  });
});
