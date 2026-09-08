import { describe, it, expect } from "vitest";
import { buildZiweiChart } from "../../buildZiweiChart";
import { zhongzhouV1 } from "../../ruleSets/zhongzhouV1";
import { extractSpouseEvidence, type SpouseEvidenceBundle } from "../../spouseEvidence";
import { PARK_SOYEON_BIRTH } from "../../__tests__/fixtures/parkSoyeon";
import { attractionFacts, expressionFacts, conflictFacts, managementFacts } from "../romanceFacts";

const chart = buildZiweiChart(PARK_SOYEON_BIRTH, zhongzhouV1);
const evidence = extractSpouseEvidence(chart);

describe("romanceFacts — 4축(끌림/표현/갈등/관계 운영) 분리", () => {
  it("attraction은 福德宮 주성 기반이고 domain 태그가 attraction이다", () => {
    const facts = attractionFacts(evidence);
    expect(facts.length).toBeGreaterThan(0);
    expect(facts.every((f) => f.domain === "attraction")).toBe(true);
  });

  it("expression은 命宮 주성 기반이고 domain 태그가 expression이다", () => {
    const facts = expressionFacts(evidence);
    expect(facts.length).toBeGreaterThan(0);
    expect(facts.every((f) => f.domain === "expression")).toBe(true);
  });

  it("conflict는 risk 극성만 담는다(化祿·化權·化科 같은 긍정/중립 사화는 섞이지 않는다)", () => {
    const facts = conflictFacts(evidence);
    expect(facts.length).toBeGreaterThan(0);
    expect(facts.every((f) => f.polarity === "risk")).toBe(true);
  });

  it("박소연 fixture(貪狼化權이 夫妻宮에 있음) 기준 management는 化權 fact를 포함한다", () => {
    const facts = managementFacts(evidence);
    const hasQuanFact = facts.some((f) => f.evidence.some((e) => e.type === "transformation" && e.value.startsWith("化權")));
    expect(hasQuanFact).toBe(true);
  });

  it("management는 conflict의 risk 문구(화기·살성)를 재사용하지 않는다", () => {
    const conflictMeanings = new Set(conflictFacts(evidence).map((f) => f.meaning));
    const managementMeanings = managementFacts(evidence).map((f) => f.meaning);
    for (const m of managementMeanings) {
      expect(conflictMeanings.has(m)).toBe(false);
    }
  });

  it("근거가 실제로 부족하면(對宮 空宮 + 化祿·化權·化科 scope 밖) management는 억지로 채우지 않고 빈 배열을 반환한다", () => {
    const emptyOpposite: SpouseEvidenceBundle = {
      ...evidence,
      oppositePalace: { ...evidence.oppositePalace, majorStars: [], minorStars: [] },
      sihuaInScope: evidence.sihuaInScope.filter((s) => s.kind === "化忌"),
    };
    expect(managementFacts(emptyOpposite)).toEqual([]);
  });
});
