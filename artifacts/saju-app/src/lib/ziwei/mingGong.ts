// 命宮/身宮 안법(安命身法) — 유파 무관 공통 공식. "寅궁에서 출발해 음력월수만큼 순행,
// 命宮은 그 자리에서 시지만큼 역행/身宮은 순행"하는 표준 안명궁법이다.
//
// 공식(0-based 지지 인덱스, 子=0..亥=11, 寅=2):
//   命宮 = (寅(2) + (음력월-1) - 시지인덱스) mod 12
//   身宮 = (寅(2) + (음력월-1) + 시지인덱스) mod 12
//
// 검증: 1989년 음력 1월 11일 戌시(戌=인덱스10) → 命宮=(2+0-10)mod12=4=辰, 身宮=(2+0+10)mod12=0=子.
// windada.com 실계산 결과(命宮=戊辰, 身宮=財帛宮=丙子)와 정확히 일치(2026-09-07 확인,
// ruleSets/zhongzhouV1.ts 주석 참고).
import { BRANCHES, type Branch, type LunarBirth } from "./types";

const YIN_INDEX = BRANCHES.indexOf("寅"); // 2

function mod12(n: number): number {
  return ((n % 12) + 12) % 12;
}

export function computeMingGong(lunar: LunarBirth): Branch {
  const hourIndex = BRANCHES.indexOf(lunar.hourBranch);
  return BRANCHES[mod12(YIN_INDEX + (lunar.month - 1) - hourIndex)];
}

export function computeShenGong(lunar: LunarBirth): Branch {
  const hourIndex = BRANCHES.indexOf(lunar.hourBranch);
  return BRANCHES[mod12(YIN_INDEX + (lunar.month - 1) + hourIndex)];
}
