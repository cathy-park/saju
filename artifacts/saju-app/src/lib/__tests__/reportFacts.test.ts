import { describe, it, expect } from "vitest";
import { synthesizeText, subjectParticle, type ReportFact } from "../reportFacts";

function fact(meaning: string, polarity: ReportFact["polarity"]): ReportFact {
  return { id: meaning, domain: "test", meaning, polarity, strength: 1, evidence: [] };
}

describe("reportFacts — 자미두수/사주가 공유하는 중립 합성 유틸(계산 엔진 결합 없음)", () => {
  it("subjectParticle: 받침 유무로 이/가를 정확히 고른다", () => {
    expect(subjectParticle("사람")).toBe("이");
    expect(subjectParticle("나무")).toBe("가");
  });

  it("synthesizeText: risk만 있으면 그대로 결합한다", () => {
    expect(synthesizeText([fact("갈등 신호", "risk")])).toBe("갈등 신호가 함께 나타납니다.");
  });

  it("synthesizeText: favorable 우세 + risk 소수는 '다만' 양보절로 통합한다", () => {
    const text = synthesizeText([fact("믿음직한 태도", "positive"), fact("꾸준한 성실함", "positive"), fact("고집스러운 면", "risk")]);
    expect(text).toBe("믿음직한 태도, 꾸준한 성실함. 다만 고집스러운 면이 함께 나타납니다.");
  });

  it("계약: neutral fact는 이 함수에 넣으면 favorable 진영으로 취급된다 — 그래서 호출부가 neutral을 미리 걸러내야 한다(사주 리포트가 이 규약을 지킨다)", () => {
    // risk가 없으면 전부 "favorable" 취급되어 합쳐진다 — neutral도 예외가 아니다.
    const text = synthesizeText([fact("애매한 구조", "neutral")]);
    expect(text).toBe("애매한 구조가 함께 나타납니다.");
  });

  it("빈 배열이면 빈 문자열을 반환한다", () => {
    expect(synthesizeText([])).toBe("");
  });
});
