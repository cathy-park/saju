import { describe, expect, it } from "vitest";
import { buildIntegratedCopyPrompt } from "../prompt";
import { PERSONAL_AREAS, RELATIONSHIP_AREAS } from "../areas";

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
