import type { FiveElementCount } from "./sajuEngine";
import {
  type FiveElKey,
  GENERATES,
  CONTROLS,
  getGenerator,
  getController,
  ELEMENT_KO,
} from "./element-color";

// ── Re-export for backward compat ─────────────────────────────────
export { ELEMENT_KO };

// ── Ten-stem → element lookup (for weighted scoring) ─────────────
const STEM_ELEMENT: Record<string, FiveElKey> = {
  갑: "목", 을: "목",
  병: "화", 정: "화",
  무: "토", 기: "토",
  경: "금", 신: "금",
  임: "수", 계: "수",
  인: "목", 묘: "목",
  사: "화", 오: "화",
  진: "토", 술: "토", 축: "토", 미: "토",
  유: "금",
  해: "수", 자: "수",
};

// ── Strength level (7-level for graph visualization) ─────────────

export type StrengthLevel =
  | "극신약" | "태약" | "신약" | "중화" | "신강" | "태강" | "극신강";

export const STRENGTH_LEVELS: StrengthLevel[] = [
  "극신약", "태약", "신약", "중화", "신강", "태강", "극신강",
];

export const STRENGTH_LEVEL_INDEX: Record<StrengthLevel, number> = {
  극신약: 0, 태약: 1, 신약: 2, 중화: 3, 신강: 4, 태강: 5, 극신강: 6,
};

export const STRENGTH_DISPLAY_LABEL: Record<StrengthLevel, string> = {
  극신약: "극신약",
  태약:   "태약",
  신약:   "신약",
  중화:   "중화",
  신강:   "신강",
  태강:   "태강",
  극신강: "극신강",
};

export const STRENGTH_SHORT_DESC: Record<StrengthLevel, string> = {
  극신약: "일간 기운이 매우 부족합니다",
  태약:   "일간 기운이 약합니다",
  신약:   "일간이 다소 약한 편입니다",
  중화:   "일간이 균형 잡혀 있습니다",
  신강:   "일간 기운이 강합니다",
  태강:   "일간 기운이 매우 강합니다",
  극신강: "일간 기운이 극도로 강합니다",
};

// ── Weighted strength scoring ─────────────────────────────────────
//
// Model priority (highest → lowest):
//   1. 월령 (month branch seasonal power)
//   2. 통근 (branch root support)
//   3. 인성/비겁 stem support
//   4. 식상/재성/관성 drain/control

export function computeStrengthScore(
  dayStem: string,
  monthBranch: string | undefined,
  allStems: string[],
  allBranches: string[],
): number {
  const dmEl = STEM_ELEMENT[dayStem] as FiveElKey | undefined;
  if (!dmEl) return 0;

  const genEl  = getGenerator(dmEl);  // 인성 element
  const sikEl  = GENERATES[dmEl];     // 식상 element (dm generates this)
  const jaeEl  = CONTROLS[dmEl];      // 재성 element (dm controls this)
  const gwaEl  = getController(dmEl); // 관성 element (controls dm)

  let score = 0;

  // 1. 월령 (month branch) — highest weight
  if (monthBranch) {
    const mEl = STEM_ELEMENT[monthBranch] as FiveElKey | undefined;
    if (mEl) {
      if (mEl === dmEl)   score += 3;    // 비겁 in season (得令)
      else if (mEl === genEl) score += 2.5; // 인성 in season
      else if (mEl === gwaEl) score -= 2.5; // 관성 in season (失令 worst)
      else if (mEl === sikEl) score -= 1.5; // 식상 in season
      else if (mEl === jaeEl) score -= 1;   // 재성 in season
    }
  }

  // 2. Branch chars — tonggeun bonus (branches have higher weight)
  for (const b of allBranches) {
    const bEl = STEM_ELEMENT[b] as FiveElKey | undefined;
    if (!bEl) continue;
    if (bEl === dmEl)   score += 1.5;
    else if (bEl === genEl) score += 1.5;
    else if (bEl === gwaEl) score -= 1.5;
    else if (bEl === sikEl) score -= 0.8;
    else if (bEl === jaeEl) score -= 0.5;
  }

  // 3. Stem chars (excluding day master stem itself)
  for (const s of allStems) {
    const sEl = STEM_ELEMENT[s] as FiveElKey | undefined;
    if (!sEl) continue;
    if (sEl === dmEl)   score += 1;
    else if (sEl === genEl) score += 1;
    else if (sEl === gwaEl) score -= 1;
    else if (sEl === sikEl) score -= 0.5;
    else if (sEl === jaeEl) score -= 0.3;
  }

  return score;
}

export function computeStrengthLevel(
  dayStem: string,
  _counts: FiveElementCount,
  monthBranch?: string,
  allStems?: string[],
  allBranches?: string[],
): StrengthLevel {
  // Use weighted model when detailed data is provided
  if (allStems && allBranches) {
    const score = computeStrengthScore(dayStem, monthBranch, allStems, allBranches);
    if (score < -4)   return "극신약";
    if (score < -2)   return "태약";
    if (score < -0.5) return "신약";
    if (score < 2)    return "중화";
    if (score < 4)    return "신강";
    if (score < 6)    return "태강";
    return "극신강";
  }

  // Fallback: simple ratio model (backward compat)
  const el = STEM_ELEMENT[dayStem] as FiveElKey | undefined;
  if (!el) return "중화";
  const gen = getGenerator(el);
  const total = (Object.values(_counts) as number[]).reduce((a, b) => a + b, 0) || 1;
  const supporting = (_counts[el] ?? 0) + (_counts[gen] ?? 0);
  const ratio = supporting / total;
  if (ratio <= 0.12) return "극신약";
  if (ratio <= 0.22) return "태약";
  if (ratio <= 0.32) return "신약";
  if (ratio <= 0.48) return "중화";
  if (ratio <= 0.60) return "신강";
  if (ratio <= 0.72) return "태강";
  return "극신강";
}

// Kept for backward compat
export function computeSupportRatio(dayStem: string, counts: FiveElementCount): number {
  const el = STEM_ELEMENT[dayStem] as FiveElKey | undefined;
  if (!el) return 0.33;
  const generator = getGenerator(el);
  const total = (Object.values(counts) as number[]).reduce((a, b) => a + b, 0) || 1;
  const supporting = (counts[el] ?? 0) + (counts[generator] ?? 0);
  return supporting / total;
}

// ── Yongshin (용신/用神) — 억부용신 model ────────────────────────
//
// Ten-God ↔ Element mapping is always RELATIVE to the Day Master:
//   인성 (Resource)  = element that generates DM    = getGenerator(dmEl)
//   비겁 (Companion) = same element as DM            = dmEl
//   식상 (Output)    = element DM generates          = GENERATES[dmEl]
//   재성 (Wealth)    = element DM controls           = CONTROLS[dmEl]
//   관성 (Officer)   = element that controls DM      = getController(dmEl)
//
// Strength → Yongshin rule (억부용신):
//   신약 (weak)   → 인성, 비겁 (resource/companion)
//   중화 (balanced) → 식상 lean (low confidence)
//   신강 (strong)  → 식상, 재성 (output/wealth)
//   극신강 (very strong) → 관성 (officer is last resort)

export interface YongshinResult {
  primary: FiveElKey;
  secondary?: FiveElKey;
  confidence: "high" | "medium" | "low";
  tenGodGroup: string;
}

export function computeYongshinFull(
  dayStem: string,
  level: StrengthLevel,
  counts: FiveElementCount,
): YongshinResult {
  const dmEl = STEM_ELEMENT[dayStem] as FiveElKey | undefined;
  if (!dmEl) return { primary: "토", confidence: "low", tenGodGroup: "?" };

  const resourceEl  = getGenerator(dmEl);    // 인성
  const companionEl = dmEl;                   // 비겁
  const outputEl    = GENERATES[dmEl];       // 식상
  const wealthEl    = CONTROLS[dmEl];        // 재성
  const officerEl   = getController(dmEl);   // 관성

  const idx = STRENGTH_LEVEL_INDEX[level];

  if (idx === 0) {
    // 극신약 — 인성 needed most urgently
    return { primary: resourceEl, secondary: companionEl, confidence: "high", tenGodGroup: "인성" };
  }
  if (idx === 1) {
    // 태약 — 인성 primary
    return { primary: resourceEl, secondary: companionEl, confidence: "high", tenGodGroup: "인성" };
  }
  if (idx === 2) {
    // 신약 — 인성 or 비겁 depending on chart composition
    const rc = counts[resourceEl] ?? 0;
    const cc = counts[companionEl] ?? 0;
    if (rc > 0 && cc > 0) {
      return { primary: resourceEl, secondary: companionEl, confidence: "high", tenGodGroup: "인성/비겁" };
    }
    if (rc >= cc) {
      return { primary: resourceEl, secondary: companionEl, confidence: "medium", tenGodGroup: "인성" };
    }
    return { primary: companionEl, secondary: resourceEl, confidence: "medium", tenGodGroup: "비겁" };
  }
  if (idx === 3) {
    // 중화 — balanced; slight 식상 lean but confidence is low
    return { primary: outputEl, secondary: resourceEl, confidence: "low", tenGodGroup: "식상" };
  }
  if (idx === 4) {
    // 신강 — 식상 primary, 재성 secondary
    return { primary: outputEl, secondary: wealthEl, confidence: "high", tenGodGroup: "식상" };
  }
  if (idx === 5) {
    // 태강 — 재성 or 식상 (whichever is scarcer)
    const oc = counts[outputEl] ?? 0;
    const wc = counts[wealthEl] ?? 0;
    if (wc >= oc) {
      return { primary: wealthEl, secondary: outputEl, confidence: "high", tenGodGroup: "재성" };
    }
    return { primary: outputEl, secondary: wealthEl, confidence: "high", tenGodGroup: "식상" };
  }
  // 극신강 — 관성 as last resort (strongest control)
  return { primary: officerEl, secondary: wealthEl, confidence: "high", tenGodGroup: "관성" };
}

export function computeYongshin(
  dayStem: string,
  level: StrengthLevel,
  counts: FiveElementCount,
): FiveElKey {
  return computeYongshinFull(dayStem, level, counts).primary;
}

export function computeYongshinLabel(
  dayStem: string,
  level: StrengthLevel,
  counts: FiveElementCount,
): string {
  return computeYongshin(dayStem, level, counts);
}

// ── Dominant element ─────────────────────────────────────────────

export function computeDominantElement(
  monthBranch: string | undefined,
  dayBranch: string | undefined,
  counts: FiveElementCount
): FiveElKey {
  const allEls: FiveElKey[] = ["목", "화", "토", "금", "수"];
  const weighted: Record<FiveElKey, number> = { ...counts } as Record<FiveElKey, number>;

  const mEl = monthBranch ? (STEM_ELEMENT[monthBranch] as FiveElKey | undefined) : undefined;
  if (mEl) weighted[mEl] = (weighted[mEl] ?? 0) + 2;

  const dEl = dayBranch ? (STEM_ELEMENT[dayBranch] as FiveElKey | undefined) : undefined;
  if (dEl) weighted[dEl] = (weighted[dEl] ?? 0) + 1;

  return allEls.reduce((a, b) => (weighted[a] ?? 0) >= (weighted[b] ?? 0) ? a : b);
}

// ── Full interpretation schema ────────────────────────────────────

export interface SajuInterpretSchema {
  strengthLevel: StrengthLevel;
  strengthDisplayLabel: string;
  strengthDesc: string;
  yongshin: FiveElKey;
  yongshinLabel: string;
  yongshinSecondary?: FiveElKey;
  yongshinConfidence: "high" | "medium" | "low";
  yongshinTenGodGroup: string;
  dominantElement: FiveElKey;
  supportRatio: number;
}

export function buildInterpretSchema(
  dayStem: string,
  counts: FiveElementCount,
  monthBranch?: string,
  dayBranch?: string,
  allStems?: string[],
  allBranches?: string[],
): SajuInterpretSchema {
  const strengthLevel = computeStrengthLevel(dayStem, counts, monthBranch, allStems, allBranches);
  const yr = computeYongshinFull(dayStem, strengthLevel, counts);
  return {
    strengthLevel,
    strengthDisplayLabel: STRENGTH_DISPLAY_LABEL[strengthLevel],
    strengthDesc: STRENGTH_SHORT_DESC[strengthLevel],
    yongshin: yr.primary,
    yongshinLabel: yr.primary,
    yongshinSecondary: yr.secondary,
    yongshinConfidence: yr.confidence,
    yongshinTenGodGroup: yr.tenGodGroup,
    dominantElement: computeDominantElement(monthBranch, dayBranch, counts),
    supportRatio: computeSupportRatio(dayStem, counts),
  };
}
