// 紫微 위치 + 14주성(十四主星) 전체 배치. 유파 무관 공통 공식(紫微系/天府系 상대배치, 紫微天府
// 대조 공식은 모든 유파가 동일하게 쓴다 — 사화표만 유파별로 갈리며 그건 ruleSet에서 처리).
//
// 안자미성결(安紫微星訣): 음력 생일 D, 오행국수 M에 대해
//   Q = ceil(D / M),  R = Q*M - D
//   base = 寅(index2) + (Q-1)  [순행]
//   R이 짝수(0 포함) → base + R  [순행]
//   R이 홀수 → base - R  [역행]
//
// 검증(2026-09-07, windada.com 실계산 대조):
//   D=11,M=3(木三局) → Q=4,R=1(홀) → base=2+3=5(巳) → 5-1=4(辰). 실제 紫微=辰 일치.
//   D=3,M=6(火六局, 검색으로 확인한 별도 예시) → Q=1,R=3(홀) → base=2+0=2(寅) → 2-3=-1=11(亥).
//   실제 예시의 "紫微定在亥宮"과 일치.
//
// 紫微-天府 대조: 天府 = (4 - 紫微index) mod 12 (寅(2)·申(8)만 서로 같은 자리가 되는 유일한
// 대칭식). 검증: 紫微=辰(4) → 天府=(4-4)=0(子). 실제 天府=子(財帛宮) 일치.
//
// 紫微系(자미 기준 역시계=지지 인덱스 감소 방향) 오프셋: 天機-1,太陽-3,武曲-4,天同-5,廉貞-8.
// 天府系(천부 기준 순시계=지지 인덱스 증가 방향) 오프셋: 太陰+1,貪狼+2,巨門+3,天相+4,天梁+5,七殺+6,破軍+10.
// 전부 위 windada.com 대조 데이터로 14개 별 전부 개별 검증됨(테스트 참고).
import { BRANCHES, type Branch, type FiveElementBureau, type StarPlacement } from "./types";

function mod12(n: number): number {
  return ((n % 12) + 12) % 12;
}

export function computeZiweiPosition(lunarDay: number, bureau: FiveElementBureau): Branch {
  const M = bureau.number;
  const D = lunarDay;
  const Q = Math.ceil(D / M);
  const R = Q * M - D;
  const yinIndex = BRANCHES.indexOf("寅");
  const base = mod12(yinIndex + (Q - 1));
  const result = R % 2 === 0 ? base + R : base - R;
  return BRANCHES[mod12(result)];
}

export function computeTianfuPosition(ziweiBranch: Branch): Branch {
  const z = BRANCHES.indexOf(ziweiBranch);
  return BRANCHES[mod12(4 - z)];
}

const ZIWEI_SYSTEM_OFFSETS: Record<string, number> = {
  紫微: 0, 天機: -1, 太陽: -3, 武曲: -4, 天同: -5, 廉貞: -8,
};
const TIANFU_SYSTEM_OFFSETS: Record<string, number> = {
  天府: 0, 太陰: 1, 貪狼: 2, 巨門: 3, 天相: 4, 天梁: 5, 七殺: 6, 破軍: 10,
};

export interface FourteenMajorStars {
  positions: Record<string, Branch>; // 별 이름 → 지지
}

export function computeFourteenMajorStars(ziweiBranch: Branch): FourteenMajorStars {
  const tianfuBranch = computeTianfuPosition(ziweiBranch);
  const zIndex = BRANCHES.indexOf(ziweiBranch);
  const fIndex = BRANCHES.indexOf(tianfuBranch);
  const positions: Record<string, Branch> = {};
  for (const [star, offset] of Object.entries(ZIWEI_SYSTEM_OFFSETS)) {
    positions[star] = BRANCHES[mod12(zIndex + offset)];
  }
  for (const [star, offset] of Object.entries(TIANFU_SYSTEM_OFFSETS)) {
    positions[star] = BRANCHES[mod12(fIndex + offset)];
  }
  return { positions };
}

/** 묘왕리함(廟旺得利平陷) 상태는 별×궁(지지) 조합별 참조표가 필요하다(유파 무관, 다만 데이터량이
 * 많아 MVP 이후 확장 대상 — 2026-09-07 승인 범위상 이번 단계는 구조만 마련하고 빈 값 반환). */
export function brightnessOf(_star: string, _branch: Branch): string | undefined {
  return undefined;
}

export function toStarPlacements(positions: Record<string, Branch>, branch: Branch): StarPlacement[] {
  return Object.entries(positions)
    .filter(([, b]) => b === branch)
    .map(([name]) => ({ name, brightness: brightnessOf(name, branch) }));
}
