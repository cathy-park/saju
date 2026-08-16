import { describe, it, expect } from "vitest";
import { getComplementaryInfo } from "./relationshipReport";
import { getSixHapAndSamhapComplement, getSamhapGroupLabel } from "./branchRelations";
import { BRANCH_TO_ELEMENT } from "./element-color";

const ALL_BRANCHES = ["자", "축", "인", "묘", "진", "사", "오", "미", "신", "유", "술", "해"];

describe("relationshipReport COMPLEMENTARY 매핑 — branchRelations.ts와 자기정합성", () => {
  it.each(ALL_BRANCHES)("%s: branches가 육합+삼합 나머지 규칙과 정확히 일치한다", (branch) => {
    const info = getComplementaryInfo(branch);
    expect(info).not.toBeNull();
    const expected = getSixHapAndSamhapComplement(branch);
    // 순서 무관 집합 비교 — 과거 12개 중 6개가 이 집합 자체가 틀려 있었던 버그의 재발 방지.
    expect(new Set(info!.branches)).toEqual(new Set(expected));
    expect(info!.branches).toHaveLength(expected.length);
  });

  it.each(ALL_BRANCHES)("%s: elements가 branches의 오행과 정확히 일치한다(중복 제거)", (branch) => {
    const info = getComplementaryInfo(branch);
    const expectedElements = new Set(info!.branches.map((b) => BRANCH_TO_ELEMENT[b]).filter(Boolean));
    expect(new Set(info!.elements)).toEqual(expectedElements);
  });

  it.each(ALL_BRANCHES)("%s: guidance 문구가 실제 삼합 그룹 이름을 정확히 언급한다", (branch) => {
    const info = getComplementaryInfo(branch);
    const groupLabel = getSamhapGroupLabel(branch);
    expect(groupLabel).not.toBeNull();
    // 과거 巳 항목처럼 guidance가 엉뚱한 삼합 그룹(예: 인오술)을 언급하는 걸 잡아낸다 —
    // 문구는 자유 텍스트라 완벽히 검증할 순 없지만, 최소한 "자기 자신이 속한 그룹 이름"은
    // 반드시 등장해야 한다.
    expect(info!.guidance).toContain(groupLabel);
  });
});
