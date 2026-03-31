import type { CSSProperties } from "react";

// ── Five-Element (오행) design tokens ──────────────────────────────
// IMPORTANT (design system):
// - Do NOT use raw hex colors in UI.
// - Use theme tokens from `src/index.css` (e.g. element-fire / element-fire-strong).

export type FiveElKey = "목" | "화" | "토" | "금" | "수";

export type ElementTone = "muted" | "base" | "strong";

type ElementToken = "wood" | "fire" | "earth" | "metal" | "water";
export function elementToken(el: FiveElKey): ElementToken {
  switch (el) {
    case "목": return "wood";
    case "화": return "fire";
    case "토": return "earth";
    case "금": return "metal";
    case "수": return "water";
  }
}

export function elementColorVar(el: FiveElKey, tone: ElementTone = "base"): string {
  const t = elementToken(el);
  const suffix = tone === "base" ? "" : `-${tone}`;
  return `hsl(var(--element-${t}${suffix}))`;
}

export function elementBgClass(el: FiveElKey, tone: ElementTone = "base"): string {
  const t = elementToken(el);
  const suffix = tone === "base" ? "" : `-${tone}`;
  return `bg-element-${t}${suffix}`;
}

export function elementTextClass(el: FiveElKey, tone: ElementTone = "base"): string {
  const t = elementToken(el);
  const suffix = tone === "base" ? "" : `-${tone}`;
  return `text-element-${t}${suffix}`;
}

export function elementBorderClass(el: FiveElKey, tone: ElementTone = "base"): string {
  const t = elementToken(el);
  const suffix = tone === "base" ? "" : `-${tone}`;
  return `border-element-${t}${suffix}`;
}

/** Inline colors from CSS variables — works when Tailwind cannot see dynamic class names. */
export function elementChipColors(
  el: FiveElKey,
  cfg: { bg: ElementTone; text: ElementTone; border: ElementTone },
): CSSProperties {
  return {
    backgroundColor: elementColorVar(el, cfg.bg),
    color: elementColorVar(el, cfg.text),
    borderColor: elementColorVar(el, cfg.border),
  };
}

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
