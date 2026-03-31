import {
  elementBgClass,
  elementBorderClass,
  elementTextClass,
  type FiveElKey,
} from "./element-color";

export type TenGod =
  | "비견" | "겁재"
  | "식신" | "상관"
  | "편재" | "정재"
  | "편관" | "정관"
  | "편인" | "정인";

const STEM_ELEMENT: Record<string, string> = {
  갑: "목", 을: "목",
  병: "화", 정: "화",
  무: "토", 기: "토",
  경: "금", 신: "금",
  임: "수", 계: "수",
};

const STEM_YANG = new Set(["갑", "병", "무", "경", "임"]);
const BRANCH_MAIN_STEM: Record<string, string> = {
  자: "계", 축: "기", 인: "갑", 묘: "을",
  진: "무", 사: "병", 오: "정", 미: "기",
  신: "경", 유: "신", 술: "무", 해: "임",
};

const GENERATING: Record<string, string> = {
  목: "화", 화: "토", 토: "금", 금: "수", 수: "목",
};
const CONTROLLING: Record<string, string> = {
  목: "토", 토: "수", 수: "화", 화: "금", 금: "목",
};

function isYang(stem: string): boolean {
  return STEM_YANG.has(stem);
}

function stemOf(char: string): string | null {
  if (STEM_ELEMENT[char]) return char;
  const branchStem = BRANCH_MAIN_STEM[char];
  return branchStem ?? null;
}

export function getTenGod(dayStem: string, otherChar: string): TenGod | null {
  const target = stemOf(otherChar) ?? otherChar;
  const dayEl = STEM_ELEMENT[dayStem];
  const otherEl = STEM_ELEMENT[target];
  if (!dayEl || !otherEl) return null;

  const dayYang = isYang(dayStem);
  const otherYang = isYang(target);
  const samePolarity = dayYang === otherYang;

  if (dayEl === otherEl) return samePolarity ? "비견" : "겁재";

  if (GENERATING[dayEl] === otherEl) return samePolarity ? "식신" : "상관";
  if (CONTROLLING[dayEl] === otherEl) return samePolarity ? "편재" : "정재";
  if (CONTROLLING[otherEl] === dayEl) return samePolarity ? "편관" : "정관";
  if (GENERATING[otherEl] === dayEl) return samePolarity ? "편인" : "정인";

  return null;
}

export function getTenGodDescription(tg: TenGod): string {
  const desc: Record<TenGod, string> = {
    비견: "자아·독립심·형제",
    겁재: "경쟁·의지력·재물손실",
    식신: "표현·식복·창의성",
    상관: "총명·반항·예술성",
    편재: "사업·변동재·아버지",
    정재: "안정재산·성실·아내",
    편관: "권위·압박·직관",
    정관: "명예·규범·남편",
    편인: "편학문·직관·모성",
    정인: "정학문·보살핌·어머니",
  };
  return desc[tg] ?? "";
}

export const TEN_GOD_KEYWORDS: Record<TenGod, string[]> = {
  비견: ["독립", "자존", "경쟁", "형제"],
  겁재: ["의지", "경쟁", "재물", "집착"],
  식신: ["표현", "식복", "창의", "여유"],
  상관: ["총명", "반항", "예술", "도전"],
  편재: ["사업", "변동", "활동", "아버지"],
  정재: ["안정", "성실", "신뢰", "재산"],
  편관: ["권위", "압박", "카리스마", "압력"],
  정관: ["명예", "규범", "책임", "질서"],
  편인: ["직관", "독창", "편학", "고독"],
  정인: ["보호", "학습", "안정", "회복"],
};

export const TEN_GOD_TOOLTIP: Record<TenGod, { headline: string; lines: string[] }> = {
  비견: { headline: "나와 같은 기운입니다", lines: ["독립", "자존심", "경쟁심", "형제 관계"] },
  겁재: { headline: "나와 비슷하지만 강한 기운입니다", lines: ["강한 의지", "재물 변동", "경쟁", "집착"] },
  식신: { headline: "나에게서 나오는 부드러운 기운입니다", lines: ["표현력", "식복", "창의성", "여유로움"] },
  상관: { headline: "나에게서 나오는 강한 기운입니다", lines: ["총명함", "반항심", "예술성", "도전 정신"] },
  편재: { headline: "내가 지배하는 활동적 기운입니다", lines: ["사업 기질", "변동 재물", "적극성", "아버지"] },
  정재: { headline: "내가 지배하는 안정적 기운입니다", lines: ["안정된 재산", "성실함", "신뢰", "배우자(남)"] },
  편관: { headline: "나를 제어하는 강한 기운입니다", lines: ["권위", "외부 압박", "카리스마", "긴장감"] },
  정관: { headline: "나를 올바르게 이끄는 기운입니다", lines: ["명예", "사회 규범", "책임감", "배우자(여)"] },
  편인: { headline: "나를 돕는 편향된 기운입니다", lines: ["직관력", "독창성", "편학문", "고독"] },
  정인: { headline: "나를 도와주는 기운입니다", lines: ["보호", "학습", "안정", "내면 회복"] },
};

export const TEN_GOD_ELEMENT: Record<string, string> = {
  갑: "木", 을: "木", 병: "火", 정: "火",
  무: "土", 기: "土", 경: "金", 신: "金",
  임: "水", 계: "水",
};

// ── 십성 → 오행 변환 (일간 기준) ──────────────────────────────────

const STEM_ELEMENT_MAP: Record<string, string> = {
  갑: "목", 을: "목", 병: "화", 정: "화",
  무: "토", 기: "토", 경: "금", 신: "금",
  임: "수", 계: "수",
};

const GENERATING_MAP: Record<string, string> = {
  목: "화", 화: "토", 토: "금", 금: "수", 수: "목",
};
const CONTROLLING_MAP: Record<string, string> = {
  목: "토", 토: "수", 수: "화", 화: "금", 금: "목",
};

/** Day stem element → each Ten God group element */
export function getTenGodGroupElements(dayStem: string): Record<TenGod, string> {
  const d = STEM_ELEMENT_MAP[dayStem] ?? "";
  const gen = GENERATING_MAP[d] ?? "";
  const ctrl = CONTROLLING_MAP[d] ?? "";
  const genBy = (Object.entries(GENERATING_MAP).find(([, v]) => v === d)?.[0]) ?? "";
  const ctrlBy = (Object.entries(CONTROLLING_MAP).find(([, v]) => v === d)?.[0]) ?? "";
  return {
    비견: d,   겁재: d,
    식신: gen, 상관: gen,
    편재: ctrl, 정재: ctrl,
    편관: ctrlBy, 정관: ctrlBy,
    편인: genBy, 정인: genBy,
  };
}

/** Convert manual ten-god counts to FiveElementCount */
export function tenGodCountsToFiveElements(
  counts: Partial<Record<TenGod, number>>,
  dayStem: string,
): Record<string, number> {
  const groupEl = getTenGodGroupElements(dayStem);
  const result: Record<string, number> = { 목: 0, 화: 0, 토: 0, 금: 0, 수: 0 };
  for (const [tg, cnt] of Object.entries(counts) as [TenGod, number][]) {
    const el = groupEl[tg];
    if (el && cnt) result[el] = (result[el] ?? 0) + cnt;
  }
  return result;
}

/** Auto-count ten gods from pillar stems and branches */
export function autoCountTenGods(
  dayStem: string,
  chars: string[],
): Record<TenGod, number> {
  const result: Record<TenGod, number> = {
    비견: 0, 겁재: 0, 식신: 0, 상관: 0,
    편재: 0, 정재: 0, 편관: 0, 정관: 0,
    편인: 0, 정인: 0,
  };
  for (const c of chars) {
    const tg = getTenGod(dayStem, c);
    if (tg && tg !== (chars.find((x) => x === dayStem) ? "비견" : null)) {
      // just count all (including 비견 for dayStem itself)
    }
    if (tg) result[tg] += 1;
  }
  return result;
}

export const TEN_GOD_GROUPS: Record<string, TenGod[]> = {
  비겁: ["비견", "겁재"],
  식상: ["식신", "상관"],
  재성: ["편재", "정재"],
  관성: ["편관", "정관"],
  인성: ["편인", "정인"],
};

export const ALL_TEN_GOD_NAMES: TenGod[] = [
  "비견", "겁재", "식신", "상관",
  "편재", "정재", "편관", "정관",
  "편인", "정인",
];

// ── 십성 → 오행 색상 헬퍼 ─────────────────────────────────────────
// 십성 색상은 반드시 오행(五行)에서 파생됩니다.
// 매핑: 비견/겁재→일간 동일 오행, 식신/상관→일간이 生하는 오행,
//       편재/정재→일간이 剋하는 오행, 편관/정관→일간을 剋하는 오행,
//       편인/정인→일간을 生하는 오행

/** 십성의 오행(FiveElKey)을 반환합니다. dayStem이 없으면 null. */
export function getTenGodElement(tenGod: TenGod | string, dayStem: string): FiveElKey | null {
  if (!dayStem) return null;
  const map = getTenGodGroupElements(dayStem);
  const el = map[tenGod as TenGod];
  return el ? (el as FiveElKey) : null;
}

/**
 * 십성의 Tailwind 색상 클래스(bg + text)를 반환합니다.
 * 항상 오행 색상에서 파생됩니다.
 * @param tenGod 십성 이름
 * @param dayStem 일간 천간 (예: "갑", "병" 등)
 * @returns Tailwind className 문자열
 */
export function getTenGodTw(tenGod: TenGod | string, dayStem: string): string {
  const el = getTenGodElement(tenGod, dayStem);
  if (!el) return "bg-muted text-muted-foreground";
  return `${elementBgClass(el, "muted")} ${elementTextClass(el, "strong")} border ${elementBorderClass(el, "base")}`;
}

/** @deprecated 인라인 스타일 색상은 사용하지 않습니다. */
export function getTenGodColors(): never {
  throw new Error("getTenGodColors has been removed. Use theme tokens via getTenGodTw().");
}
