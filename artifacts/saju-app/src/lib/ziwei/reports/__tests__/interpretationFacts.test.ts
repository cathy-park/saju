import { describe, it, expect } from "vitest";
import { synthesizeText, type InterpretationFact } from "../interpretationFacts";

function fact(meaning: string, polarity: InterpretationFact["polarity"]): InterpretationFact {
  return { id: meaning, domain: "test", meaning, polarity, strength: 1, evidence: [] };
}

describe("synthesizeText — 주격 조사(이/가) 일치", () => {
  it("받침 있는 단어로 끝나면 '이 함께 나타납니다'를 붙인다(risk만 있는 경우)", () => {
    const text = synthesizeText([fact("집착·오해로 이어지기 쉬운 갈등 신호", "risk")]);
    expect(text).toBe("집착·오해로 이어지기 쉬운 갈등 신호가 함께 나타납니다.");
  });

  it("받침 없는 단어로 끝나면 '가 함께 나타납니다'를 붙인다(favorable만 있는 경우)", () => {
    const text = synthesizeText([fact("믿음직하고 현실 감각 있는 태도", "positive")]);
    expect(text).toBe("믿음직하고 현실 감각 있는 태도가 함께 나타납니다.");
  });

  it("favorable이 우세하면 '다만 {risk}' 절의 조사도 risk 절 마지막 글자에 맞춰 선택한다", () => {
    const text = synthesizeText([
      fact("사교적이고 재주가 많은 기질", "positive"),
      fact("주관이 뚜렷한 성향", "mixed"),
      fact("집착하기 쉬운 면", "risk"),
    ]);
    expect(text).toBe("사교적이고 재주가 많은 기질, 주관이 뚜렷한 성향. 다만 집착하기 쉬운 면이 함께 나타납니다.");
  });

  it("risk가 우세하면 '그럼에도 {favorable}' 절의 조사도 favorable 절 마지막 글자에 맞춰 선택한다", () => {
    const text = synthesizeText([
      fact("말로 인한 오해·구설이 생기기 쉬운 태도", "risk"),
      fact("감정 기복이 있는 태도", "risk"),
      fact("다정한 사람", "positive"),
    ]);
    expect(text).toBe("말로 인한 오해·구설이 생기기 쉬운 태도, 감정 기복이 있는 태도. 그럼에도 다정한 사람이 함께 나타납니다.");
  });

  it("빈 배열이면 빈 문자열을 반환한다(기존 동작 유지)", () => {
    expect(synthesizeText([])).toBe("");
  });
});
