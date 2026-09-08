// 大限(대한) — 10년 단위 운세 구간. 시작 나이=五行局 숫자. 陽男陰女는 순행(지지 인덱스 증가
// 방향), 陰男陽女는 역행(지지 인덱스 감소 방향 = 命宮에서 兄弟宮 방향, 즉 12궁 배정과 같은 방향).
//
// 검증(己巳년생 여성 = 陰女 → 순행): 命宮(辰)3-12 → 父母宮(巳)13-22 → 福德宮(午)23-32 → ...
// windada.com 실계산 결과의 대한 age range 전부와 정확히 일치(2026-09-07 확인).
import { BRANCHES, PALACE_NAMES, type Branch, type FiveElementBureau, type MajorPeriod, type PalaceName, type Stem } from "./types";

const YANG_STEMS: Stem[] = ["甲", "丙", "戊", "庚", "壬"];

function mod12(n: number): number {
  return ((n % 12) + 12) % 12;
}

export function isForwardDirection(yearStem: Stem, gender: "남" | "여"): boolean {
  const isYang = YANG_STEMS.includes(yearStem);
  const isMale = gender === "남";
  return (isYang && isMale) || (!isYang && !isMale); // 陽男 또는 陰女 → 순행
}

/** palaceOfBranch: 이미 계산된 branch→palace 매핑(buildZiweiChart가 만든 12궁 배열에서 가져옴). */
export function computeMajorPeriods(
  mingGongBranch: Branch,
  bureau: FiveElementBureau,
  yearStem: Stem,
  gender: "남" | "여",
  palaceOfBranch: Record<Branch, PalaceName>,
): MajorPeriod[] {
  const forward = isForwardDirection(yearStem, gender);
  const mingIndex = BRANCHES.indexOf(mingGongBranch);
  const periods: MajorPeriod[] = [];
  for (let i = 0; i < 12; i++) {
    const branchIndex = mod12(forward ? mingIndex + i : mingIndex - i);
    const branch = BRANCHES[branchIndex];
    const startAge = bureau.number + i * 10;
    periods.push({ ageRange: [startAge, startAge + 9], palace: palaceOfBranch[branch], branch });
  }
  return periods;
}

export { PALACE_NAMES };
