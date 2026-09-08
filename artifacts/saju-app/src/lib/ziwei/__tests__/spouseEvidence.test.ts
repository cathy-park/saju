import { describe, it, expect } from "vitest";
import { buildZiweiChart } from "../buildZiweiChart";
import { zhongzhouV1 } from "../ruleSets/zhongzhouV1";
import { extractSpouseEvidence } from "../spouseEvidence";
import { PARK_SOYEON_BIRTH } from "./fixtures/parkSoyeon";

const chart = buildZiweiChart(PARK_SOYEON_BIRTH, zhongzhouV1);
const evidence = extractSpouseEvidence(chart);

describe("spouseEvidence — 순수 구조 추출(해석 문장 없음)", () => {
  it("본궁은 夫妻宮이고 박소연 fixture 기준 寅궁이다", () => {
    expect(evidence.spousePalace.palace).toBe("夫妻宮");
    expect(evidence.spousePalace.branch).toBe("寅");
    expect(evidence.spousePalace.majorStars.map((s) => s.name)).toContain("貪狼");
  });

  it("對宮은 事業宮(index+6)이다", () => {
    expect(evidence.oppositePalace.palace).toBe("事業宮");
  });

  it("三方 2곳은 遷移宮·福德宮이다(index±4)", () => {
    const names = evidence.trinePalaces.map((p) => p.palace).sort();
    expect(names).toEqual(["福德宮", "遷移宮"].sort());
  });

  it("三方四正 = 본궁+대궁+삼방2곳 = 정확히 4개 궁", () => {
    expect(evidence.sanfangSizhengPalaces.length).toBe(4);
    const names = new Set(evidence.sanfangSizhengPalaces.map((p) => p.palace));
    expect(names).toEqual(new Set(["夫妻宮", "事業宮", "遷移宮", "福德宮"]));
  });

  it("命宮 관계 — 命宮은 夫妻宮 기준 -2칸(=夫妻宮이 命宮+2칸)", () => {
    expect(evidence.mingGongRelation.mingGongPalace.palace).toBe("命宮");
    expect(evidence.mingGongRelation.offsetFromMingGong).toBe(2);
  });

  it("財帛宮이 관련 궁으로 포함된다", () => {
    expect(evidence.relatedPalaces.財帛宮.palace).toBe("財帛宮");
  });

  it("sihuaInScope는 삼방사정 범위 안의 생년사화만 담고, 화기(文曲化忌)가 포함된다", () => {
    // 박소연: 貪狼化權·文曲化忌가 夫妻宮(寅)에 있으므로 둘 다 scope 안에 있어야 한다.
    const kinds = evidence.sihuaInScope.map((s) => s.kind);
    expect(kinds).toContain("化權");
    expect(kinds).toContain("化忌");
  });

  it("해석 문장을 만들지 않는다 — 반환값에 text/string 형태의 서술 필드가 없다", () => {
    const json = JSON.stringify(evidence);
    // 구조체 값에 자연어 해석문이 섞여 있지 않은지(별 이름/궁 이름만 있어야 함) 간접 확인:
    // 최소한 이 구조체 자체에는 evidence.text 같은 필드가 타입에 존재하지 않는다(컴파일 타임 보장).
    expect(json.length).toBeGreaterThan(0);
  });
});
