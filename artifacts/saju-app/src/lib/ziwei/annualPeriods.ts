// 流年(유년) — 해당 연도의 지지와 같은 지지를 가진 궁이 그 해의 流年宮이다(유파 무관 공통 규칙).
// 주의(알려진 단순화): 정밀 만세력은 입춘(立春) 절입 시각을 연 경계로 쓰지만, 이 구현은
// 달력 연도를 그대로 쓴다(1984=甲子년 기준 (year-1984) mod 12). 입춘 근접 시점(1~2월) 생일의
// 경계 케이스는 2차 확장에서 sajuEngine.ts의 절기 계산과는 별도로 자미두수 자체 절기 처리를
// 붙일 때 정교화한다 — 지금 당장은 사주 엔진을 참조하지 않는다는 원칙을 우선한다.
import { BRANCHES, type AnnualPeriod, type Branch, type PalaceName } from "./types";

function mod12(n: number): number {
  return ((n % 12) + 12) % 12;
}

export function yearToBranch(year: number): Branch {
  return BRANCHES[mod12(year - 1984)];
}

export function computeAnnualPeriods(
  years: number[],
  palaceOfBranch: Record<Branch, PalaceName>,
): AnnualPeriod[] {
  return years.map((year) => {
    const branch = yearToBranch(year);
    return { year, palace: palaceOfBranch[branch], branch };
  });
}
