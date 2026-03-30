// ── Global Five-Element Color System ───────────────────────────────
// Single source of truth for element-based colors across the entire app.

export type FiveElKey = "목" | "화" | "토" | "금" | "수";

// Primary hex colors (used for fills, dots, node backgrounds)
export const ELEMENT_HEX: Record<FiveElKey, string> = {
  목: "#4CAF50",
  화: "#E53935",
  토: "#E0A800",
  금: "#9E9E9E",
  수: "#1E88E5",
};

// Light background hex (cards, highlights)
export const ELEMENT_LIGHT_HEX: Record<FiveElKey, string> = {
  목: "#EBF5EE",
  화: "#FBF0EF",
  토: "#FAF3E5",
  금: "#F5F5F5",
  수: "#E8F2FC",
};

// Readable text hex (on white backgrounds)
export const ELEMENT_TEXT_HEX: Record<FiveElKey, string> = {
  목: "#3A7D44",
  화: "#C0504A",
  토: "#A07828",
  금: "#5C7A9E",
  수: "#2B6CB0",
};

// Tailwind class bundles: bg + text + border (for chips/badges)
export const ELEMENT_TW: Record<FiveElKey, string> = {
  목: "bg-green-100 text-green-800 border-green-200",
  화: "bg-red-100 text-red-800 border-red-200",
  토: "bg-yellow-100 text-yellow-800 border-yellow-200",
  금: "bg-gray-100 text-gray-700 border-gray-200",
  수: "bg-blue-100 text-blue-800 border-blue-200",
};

// Tailwind text-only class
export const ELEMENT_TW_TEXT: Record<FiveElKey, string> = {
  목: "text-green-700",
  화: "text-red-600",
  토: "text-yellow-600",
  금: "text-gray-500",
  수: "text-blue-600",
};

// Tailwind bg-only class (for bars, fills)
export const ELEMENT_TW_BG: Record<FiveElKey, string> = {
  목: "bg-green-500",
  화: "bg-red-500",
  토: "bg-yellow-500",
  금: "bg-gray-400",
  수: "bg-blue-500",
};

// ── Character → Element lookup ─────────────────────────────────────

// 天干 (Ten Stems)
export const STEM_TO_ELEMENT: Record<string, FiveElKey> = {
  갑: "목", 을: "목",
  병: "화", 정: "화",
  무: "토", 기: "토",
  경: "금", 신: "금",
  임: "수", 계: "수",
};

// 地支 (Twelve Branches)
export const BRANCH_TO_ELEMENT: Record<string, FiveElKey> = {
  인: "목", 묘: "목",
  사: "화", 오: "화",
  진: "토", 술: "토", 축: "토", 미: "토",
  신: "금", 유: "금",
  해: "수", 자: "수",
};

// Combined lookup — any 天干 or 地支 → element
export function charToElement(ch: string): FiveElKey | null {
  return STEM_TO_ELEMENT[ch] ?? BRANCH_TO_ELEMENT[ch] ?? null;
}

// ── Generating / Controlling cycles ───────────────────────────────

// A → B means A generates B
export const GENERATES: Record<FiveElKey, FiveElKey> = {
  목: "화", 화: "토", 토: "금", 금: "수", 수: "목",
};

// A → B means A controls B
export const CONTROLS: Record<FiveElKey, FiveElKey> = {
  목: "토", 토: "수", 수: "화", 화: "금", 금: "목",
};

// What generates `el`?
export function getGenerator(el: FiveElKey): FiveElKey {
  return (Object.entries(GENERATES) as [FiveElKey, FiveElKey][]).find(([, v]) => v === el)![0];
}

// What controls `el`?
export function getController(el: FiveElKey): FiveElKey {
  return (Object.entries(CONTROLS) as [FiveElKey, FiveElKey][]).find(([, v]) => v === el)![0];
}

// ── Ten-god category label (relative to day master) ───────────────

export type TenGodGroup = "비겁" | "인성" | "식상" | "재성" | "관성";

export function getTenGodGroup(
  dayMasterEl: FiveElKey,
  charEl: FiveElKey,
): TenGodGroup {
  if (charEl === dayMasterEl) return "비겁";
  if (charEl === getGenerator(dayMasterEl)) return "인성";
  if (charEl === GENERATES[dayMasterEl]) return "식상";
  if (charEl === CONTROLS[dayMasterEl]) return "재성";
  return "관성"; // getController(dayMasterEl)
}

// Element Korean name
export const ELEMENT_KO: Record<FiveElKey, string> = {
  목: "목 (木)", 화: "화 (火)", 토: "토 (土)", 금: "금 (金)", 수: "수 (水)",
};
