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

  it("신살은 항상 neutral이고, '핵심 성향' 섹션에만 참고로 붙는다 — 다른 섹션엔 신살 fact가 없다", () => {
    const coreNatureFacts = factsOf(sections, "coreNature");
    const shinsalInCore = coreNatureFacts.filter((f) => f.domain.startsWith("shinsal"));
    expect(shinsalInCore.length).toBe(shinsalEntries.length);
    for (const f of shinsalInCore) expect(f.polarity).toBe("neutral");

    for (const key of ["atAGlance", "strengths", "cautions", "workWealth", "romanceRelationship"] as const) {
      const hasShinsal = factsOf(sections, key).some((f) => f.domain.startsWith("shinsal"));
      expect(hasShinsal).toBe(false);
    }
  });

  it("신살 하나만 있고 나머지가 전부 긍정적이어도, 신살이 '핵심 성향'의 방향성 결론을 만들지 않는다(참고 문구로만 뒤에 붙음)", () => {
    // 신살은 neutral이라 synthesizeText(방향성 계산)에 들어가지 않는다 — coreNature 텍스트가
    // "다만/그럼에도" 같은 대립 구조 없이도 신살 참고 문장을 뒤에 붙일 수 있어야 한다.
    const coreNatureText = sections.find((s) => s.key === "coreNature")!.text;
    expect(coreNatureText).toContain("참고로");
    expect(coreNatureText).toContain(shinsalEntries[0].oneLine);
  });

  it("일·재물과 연애·관계는 서로 다른 십성 축(재성·식상 vs 관성·비겁)을 참조하고 같은 문장을 만들지 않는다", () => {
    const workWealthText = sections.find((s) => s.key === "workWealth")!.text;
    const romanceText = sections.find((s) => s.key === "romanceRelationship")!.text;
    expect(workWealthText).not.toBe(romanceText);
    expect(workWealthText).toContain("재성");
    expect(romanceText).toContain("관성");
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

  it("모든 섹션의 메인 fact 개수는 1~4개 사이다(전역 우선순위 절단이 아니라 섹션별 선택이라 자연스럽게 이 범위에 있어야 한다)", () => {
    for (const s of sections) {
      expect(s.facts.length).toBeGreaterThanOrEqual(1);
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
