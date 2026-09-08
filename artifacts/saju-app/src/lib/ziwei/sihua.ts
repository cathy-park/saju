// 生年四化(생년사화) — 년간(10干)에 따라 정확히 4개 별에 化祿/化權/化科/化忌가 붙는다.
// 어느 별에 붙는지는 유파별로 갈리는 항목이라 ruleSet.sihuaTable에서만 가져온다(이 파일은
// 로직만 담당, 데이터는 전혀 갖지 않음).
import type { Branch, RuleSet, SihuaKind, Stem } from "./types";

export interface SihuaAssignment {
  star: string;
  branch: Branch;
  kind: SihuaKind;
}

export function computeBirthYearSihua(
  yearStem: Stem,
  ruleSet: RuleSet,
  starPositions: Record<string, Branch>,
): SihuaAssignment[] {
  const table = ruleSet.sihuaTable[yearStem];
  const kinds: SihuaKind[] = ["化祿", "化權", "化科", "化忌"];
  return kinds.map((kind) => {
    const star = table[kind];
    const branch = starPositions[star];
    if (!branch) {
      throw new Error(`생년사화 대상 별 '${star}'의 위치를 찾을 수 없습니다(${kind}, ${yearStem}干).`);
    }
    return { star, branch, kind };
  });
}
