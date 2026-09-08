import { describe, it, expect } from "vitest";
import { buildZiweiChart } from "../../buildZiweiChart";
import { zhongzhouV1 } from "../../ruleSets/zhongzhouV1";
import { PARK_SOYEON_BIRTH } from "../../__tests__/fixtures/parkSoyeon";
import { spouseReportTimingYears } from "../spouseReport";
import { buildComprehensiveReport, synthesizeSection } from "../comprehensiveReport";
import type { InterpretationFact } from "../interpretationFacts";

function fact(domain: string, meaning: string, polarity: InterpretationFact["polarity"]): InterpretationFact {
  return { id: meaning, domain, meaning, polarity, strength: 1, evidence: [] };
}

const years = spouseReportTimingYears();
const chart = buildZiweiChart(PARK_SOYEON_BIRTH, zhongzhouV1, years);
const report = buildComprehensiveReport(chart, zhongzhouV1, PARK_SOYEON_BIRTH.name);

const SPOUSE_DOMAINS = new Set(["coreImage", "personality", "appearance", "career", "wealth", "meeting", "relationship", "compatibility"]);
const ROMANCE_DOMAINS = new Set(["attraction", "expression", "conflict", "management"]);
const NATURE_DOMAINS = new Set(["coreNature", "lifeDirection", "socialImpression", "lifeAttitude"]);
const WORK_WEALTH_DOMAINS = new Set([
  "coreWealth", "incomeStyle", "spendingTendency", "volatility",
  "coreCareer", "workStyle", "collaborationEnvironment", "achievementVolatility",
]);

function section(key: string) {
  const s = report.sections.find((x) => x.key === key);
  if (!s) throw new Error(`section not found: ${key}`);
  return s;
}

describe("comprehensiveReport — 5개 섹션 구성과 도메인 오염 방지", () => {
  it("정확히 5개 섹션, AI 다듬기 호출 예산도 섹션당 1회이므로 최대 5회다", () => {
    expect(report.sections.map((s) => s.key)).toEqual(["coreNature", "workWealth", "romanceSpouse", "currentFocus", "upcomingTiming"]);
  });

  it("핵심 성향에는 배우자상(spouse)·연애(romance) 도메인이 절대 섞이지 않는다 — nature 계열만", () => {
    const domains = new Set(section("coreNature").facts.map((f) => f.domain));
    for (const d of domains) {
      expect(NATURE_DOMAINS.has(d)).toBe(true);
      expect(SPOUSE_DOMAINS.has(d)).toBe(false);
      expect(ROMANCE_DOMAINS.has(d)).toBe(false);
    }
  });

  it("일·재물에는 배우자의 career/wealth 도메인이 섞이지 않는다 — 내 재물·커리어 리포트만", () => {
    const domains = new Set(section("workWealth").facts.map((f) => f.domain));
    for (const d of domains) {
      expect(WORK_WEALTH_DOMAINS.has(d)).toBe(true);
    }
  });

  it("연애·배우자에는 romance 4축과 배우자 리포트 도메인이 모두 들어간다(제외되지 않음)", () => {
    const domains = new Set(section("romanceSpouse").facts.map((f) => f.domain));
    const hasAnyRomance = [...ROMANCE_DOMAINS].some((d) => domains.has(d));
    const hasAnySpouse = [...SPOUSE_DOMAINS].some((d) => domains.has(d));
    expect(hasAnyRomance).toBe(true);
    expect(hasAnySpouse).toBe(true);
    for (const d of domains) {
      expect(NATURE_DOMAINS.has(d) || WORK_WEALTH_DOMAINS.has(d)).toBe(false);
    }
  });

  it("현재 삶의 중심축은 항상 身宮 기반 fact를 최소 1개 포함한다(박소연 fixture 身宮=財帛宮)", () => {
    const focus = section("currentFocus");
    expect(focus.facts.length).toBeGreaterThan(0);
    expect(focus.facts[0].meaning).toContain("재물을 만들고 다루는 것");
  });

  it("현재 삶의 중심축은 fact 개수·polarity 밀도로 판정하지 않는다 — 大限이 테마 6궁 밖이면 그 fact를 그냥 생략한다", () => {
    const age = new Date().getFullYear() - chart.birth.year;
    const majorPeriod = chart.majorPeriods.find((p) => age >= p.ageRange[0] && age <= p.ageRange[1])!;
    const themePalaces = new Set(["命宮", "財帛宮", "事業宮", "夫妻宮", "遷移宮", "福德宮"]);
    const focus = section("currentFocus");
    const hasMajorFact = focus.facts.some((f) => f.id === "current-major");
    expect(hasMajorFact).toBe(themePalaces.has(majorPeriod.palace));
  });

  it("앞으로의 주요 시기는 yearCards를 재계산하지 않고 상위 3개만 요약한다", () => {
    const upcoming = section("upcomingTiming");
    expect(upcoming.facts.length).toBeLessThanOrEqual(3);
  });
});

describe("synthesizeSection — 겉/내면 구조는 outer·inner가 실제로 갈릴 때만 사용한다", () => {
  it("outer가 favorable, inner가 risk로 실제 갈리면 '겉으로는 ~이지만, 내면에서는 ~' 구조를 쓴다", () => {
    const result = synthesizeSection(
      [fact("appearance", "매력적인 인상", "positive"), fact("personality", "집착하기 쉬운 성향", "risk")],
      { outer: new Set(["appearance"]), inner: new Set(["personality"]) },
    );
    expect(result.text).toContain("겉으로는 매력적인 인상이지만");
    expect(result.text).toContain("내면에서는 집착하기 쉬운 성향인 모습입니다");
  });

  it("outer·inner가 같은 방향(둘 다 favorable)이면 겉/내면 구조를 쓰지 않는다", () => {
    const result = synthesizeSection(
      [fact("appearance", "매력적인 인상", "positive"), fact("personality", "믿음직한 성향", "positive")],
      { outer: new Set(["appearance"]), inner: new Set(["personality"]) },
    );
    expect(result.text).not.toContain("겉으로는");
  });

  it("outer/inner로 분류되지 않는 도메인끼리의 polarity 충돌은 겉/내면이 아니라 강점+리스크 통합 문장(다만/그럼에도)으로 처리한다", () => {
    const result = synthesizeSection(
      [fact("career", "전문성 있는 분야", "positive"), fact("career", "집착·오해로 이어지기 쉬운 신호", "risk")],
      { outer: new Set(), inner: new Set() },
    );
    expect(result.text).not.toContain("겉으로는");
    expect(result.text).toMatch(/다만|그럼에도/);
  });

  it("완전히 같은 문장(meaning)만 중복 제거하고, 문구가 다르면 domain이 겹쳐도 보존한다", () => {
    const result = synthesizeSection(
      [
        fact("career", "전문성 있는 분야", "positive"),
        fact("wealth", "전문성 있는 분야", "positive"), // 다른 domain, 완전히 같은 문장 → 제거
        fact("career", "실무 감각이 뛰어난 분야", "positive"), // 다른 문장 → 보존
      ],
      { outer: new Set(), inner: new Set() },
    );
    expect(result.facts.length).toBe(2);
    expect(result.facts.map((f) => f.meaning)).toEqual(["전문성 있는 분야", "실무 감각이 뛰어난 분야"]);
  });
});
