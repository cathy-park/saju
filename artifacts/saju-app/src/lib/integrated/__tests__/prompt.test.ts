import { describe, expect, it, vi, beforeEach } from "vitest";
import { buildIntegratedPersonalReport, buildIntegratedRelationshipReport } from "../report";
import { buildHolisticDeterministicText, buildIntegratedCopyPrompt, runHolisticSingleFlight, polishIntegratedHolistic } from "../prompt";
import type { IntegratedSourceFact } from "../types";
import { PERSONAL_AREAS, RELATIONSHIP_AREAS } from "../areas";

vi.mock("../../supabase", () => ({
  supabase: { auth: { getSession: () => Promise.resolve({ data: { session: { access_token: "test-token" } } }) } },
}));

const source = (value: Partial<IntegratedSourceFact> & Pick<IntegratedSourceFact, "system" | "module" | "factId" | "meaning">): IntegratedSourceFact => ({
  evidenceRole: "individual-context",
  evidence: [{ id: `${value.system}:raw:${value.factId}`, label: value.factId }],
  ...value,
});

describe("buildIntegratedCopyPrompt — 계산 구조 상담용 Markdown", () => {
  it("개인 9개·관계 7개 사용자 주제 계약을 유지한다", () => {
    expect(PERSONAL_AREAS.map((area) => area.title)).toEqual(["한눈에 보는 나", "성향", "감정·내면", "연애", "결혼·배우자", "일·커리어", "재물", "건강·생활 리듬", "현재 흐름"]);
    expect(RELATIONSHIP_AREAS.map((area) => area.title)).toEqual(["관계의 핵심", "감정·애착", "대화·갈등", "끌림·친밀감", "결혼·장기 지속성", "현실·생활 궁합", "현재 관계 흐름"]);
  });
  it("세 체계 원자료만 합치고 synthesis 및 개발 ID를 제외한다", () => {
    const text = buildIntegratedCopyPrompt({ saju: "출생정보\n사주팔자", ziwei: "명궁: 子", western: "Sun: Aquarius 27°" });
    expect(text).toContain("# 1. 사주\n출생정보");
    expect(text).toContain("# 2. 자미두수\n명궁: 子");
    expect(text).toContain("# 3. 서양점성술\nSun: Aquarius 27°");
    expect(text).not.toMatch(/relationKind|sourceFactId|rule-R|coreWealth-|"synthesisFacts"/);
    expect(() => JSON.parse(text)).toThrow();
  });
});

describe("buildHolisticDeterministicText — 21단계 종합 AI holistic 레이어의 fallback 문장", () => {
  it("personal 리포트는 overview 섹션 텍스트를 그대로 쓴다", () => {
    const report = buildIntegratedPersonalReport({ personId: "p", sources: [
      source({ system: "saju", module: "summary", factId: "rule-R05-a", meaning: "독립적으로 판단합니다" }),
      source({ system: "ziwei", module: "comprehensive", factId: "coreNature-0", meaning: "주도적으로 책임집니다" }),
      source({ system: "western", module: "overview", factId: "synthesis:p:core", meaning: "자기 기준을 지킵니다" }),
    ] });
    expect(buildHolisticDeterministicText(report)).toContain("독립적으로 판단합니다");
    expect(buildHolisticDeterministicText(report)).not.toContain("서로 다른 관점");
    expect(buildHolisticDeterministicText(report).length).toBeGreaterThan(0);
  });

  it("relationship 리포트는 relationshipCore 섹션 텍스트를 그대로 쓴다", () => {
    const report = buildIntegratedRelationshipReport({ pairId: "a~b", sources: [
      source({ system: "saju", module: "compatibility", factId: "emotion-a", meaning: "대화를 통해 조율합니다", evidenceRole: "dyadic-evidence" }),
      source({ system: "western", module: "synastry", factId: "communication-a", meaning: "감정을 말로 정리합니다", evidenceRole: "dyadic-evidence" }),
    ] });
    expect(buildHolisticDeterministicText(report)).toContain("대화를 통해 조율합니다");
  });

  it("fact가 전혀 없어 섹션이 비어 있으면 빈 문자열을 반환한다(새 문장을 지어내지 않음)", () => {
    const report = buildIntegratedPersonalReport({ personId: "p", sources: [] });
    expect(buildHolisticDeterministicText(report)).toBe("");
  });
});

describe("integrated holistic single-flight", () => {
  it("동일 key의 동시 요청과 완료 후 재요청은 하나의 실행 결과를 재사용한다", async () => {
    const request = vi.fn(async () => "AI result");
    const [first, second] = await Promise.all([
      runHolisticSingleFlight("same-key", request),
      runHolisticSingleFlight("same-key", request),
    ]);
    const third = await runHolisticSingleFlight("same-key", request);
    expect([first, second, third]).toEqual(["AI result", "AI result", "AI result"]);
    expect(request).toHaveBeenCalledTimes(1);
  });

  it("source key가 다르면 각각 별도 요청을 실행한다", async () => {
    const request = vi.fn(async () => "AI result");
    await Promise.all([
      runHolisticSingleFlight("person-a", request),
      runHolisticSingleFlight("person-b", request),
    ]);
    expect(request).toHaveBeenCalledTimes(2);
  });
});

describe("polishIntegratedHolistic — 최초 진입 동시 요청 중복 제거(실제 회귀 재현)", () => {
  // 모듈 스코프 single-flight 캐시가 테스트 간에도 유지되므로(그게 이 기능의 목적이다),
  // 테스트끼리 서로 간섭하지 않도록 personId(=facts 내용)를 테스트마다 다르게 준다.
  const buildReport = (personId: string) => buildIntegratedPersonalReport({ personId, sources: [
    source({ system: "saju", module: "summary", factId: "rule-R05-a", meaning: "독립적으로 판단합니다" }),
    source({ system: "ziwei", module: "comprehensive", factId: "coreNature-0", meaning: "주도적으로 책임집니다" }),
    source({ system: "western", module: "overview", factId: `synthesis:${personId}:core`, meaning: "자기 기준을 지킵니다" }),
  ] });

  beforeEach(() => { vi.restoreAllMocks(); });

  it("같은 report로 동시에 두 번 호출해도 /api/integrated-holistic은 1회만 호출된다", async () => {
    const report = buildReport("p-dedupe-concurrent");
    const fetchMock = vi.fn(async () => ({
      ok: true,
      json: async () => ({ areas: [{ key: "personality", text: "통합된 핵심 성향 설명입니다." }] }),
    }));
    vi.stubGlobal("fetch", fetchMock);

    const [first, second] = await Promise.all([polishIntegratedHolistic(report), polishIntegratedHolistic(report)]);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(first).toEqual(second);
    expect(first.some((area) => area.key === "personality" && area.text === "통합된 핵심 성향 설명입니다.")).toBe(true);
    expect(first.some((area) => area.key === "overview")).toBe(true);
  });

  it("완료된 뒤 재진입(새 report 인스턴스, 같은 내용)해도 다시 호출하지 않고 캐시된 결과를 쓴다", async () => {
    const report = buildReport("p-dedupe-reentry");
    const fetchMock = vi.fn(async () => ({
      ok: true,
      json: async () => ({ areas: [{ key: "personality", text: "통합된 핵심 성향 설명입니다." }] }),
    }));
    vi.stubGlobal("fetch", fetchMock);

    await polishIntegratedHolistic(report);
    // 같은 내용을 다시 계산한 새 report 객체(리렌더로 report가 새 참조가 되는 상황을 재현).
    const sameContentReport = buildReport("p-dedupe-reentry");
    await polishIntegratedHolistic(sameContentReport);

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("내용이 다른 report(다른 사람)는 별도로 1회씩 호출된다", async () => {
    // 두 report 모두 "실제로 synthesis fact가 만들어지는" 조합(buildReport, 위 테스트들에서
    // 이미 검증됨)을 쓰되 personId만 다르게 해서 순수하게 "내용이 다르면 key도 다르다"만
    // 검증한다 — 임의로 다른 fact 조합을 쓰면 한쪽이 우연히 fact 0개가 되어(관계 없는 방향
    // 차이는 tension으로도 합쳐지지 않는 기존 규칙 때문에) fetch 자체를 안 타는 거짓 통과가
    // 될 수 있다.
    const reportA = buildReport("p-a-distinct");
    const reportB = buildReport("p-b-distinct");
    const fetchMock = vi.fn(async () => ({
      ok: true,
      json: async () => ({ areas: [{ key: "personality", text: "설명" }] }),
    }));
    vi.stubGlobal("fetch", fetchMock);

    await Promise.all([polishIntegratedHolistic(reportA), polishIntegratedHolistic(reportB)]);

    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
