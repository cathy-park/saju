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

// ── 지장간 (地藏干) — hidden stems per branch ─────────────────────
// Order: [여기(餘氣), 중기(中氣), 본기(本氣)]  (본기 = last element)
// Used for: strength overlay, yongshin augmentation
const JIJANGGAN: Record<string, string[]> = {
  자: ["임", "계"],           // 壬(여기) 癸(본기)
  축: ["계", "신", "기"],     // 癸(여기) 辛(중기) 己(본기)
  인: ["무", "병", "갑"],     // 戊(여기) 丙(중기) 甲(본기)
  묘: ["갑", "을"],           // 甲(여기) 乙(본기)
  진: ["을", "계", "무"],     // 乙(여기) 癸(중기) 戊(본기)
  사: ["무", "경", "병"],     // 戊(여기) 庚(중기) 丙(본기)
  오: ["병", "기", "정"],     // 丙(여기) 己(중기) 丁(본기)
  미: ["정", "을", "기"],     // 丁(여기) 乙(중기) 己(본기)
  신: ["무", "임", "경"],     // 戊(여기) 壬(중기) 庚(본기)
  유: ["경", "신"],           // 庚(여기) 辛(본기)
  술: ["신", "정", "무"],     // 辛(여기) 丁(중기) 戊(본기)
  해: ["무", "갑", "임"],     // 戊(여기) 甲(중기) 壬(본기)
};
// Weights per jijanggan position: [여기 w, 중기 w, 본기 w]
// 본기 is the same as the branch's main element (already scored in step 1/2),
// so we use SMALL weights here — this is purely an ADDITIVE CORRECTION for
// the non-본기 stems that the surface scoring misses.
const JZG_W = [0.05, 0.12, 0.00] as const; // 본기=0 (not double-counted; main branch already captures it)

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

export type DayMasterState = "weak" | "balanced" | "strong";

export interface StrengthReason {
  deukryeong: { score: number; note: string };
  deukji: { score: number; note: string };
  deukse: { score: number; note: string };
  adjustments: string[];
}

export interface StrengthResult {
  score: number;
  level: StrengthLevel;
  dayMasterState: DayMasterState;
  reason: StrengthReason;
  description: string;
  explanation: string[];
}

function toDayMasterState(level: StrengthLevel): DayMasterState {
  if (level === "중화") return "balanced";
  if (level === "신강" || level === "태강" || level === "극신강") return "strong";
  return "weak";
}

function levelFromScore(score: number): StrengthLevel {
  if (score < -5)   return "극신약";
  if (score < -3)   return "태약";
  if (score < -1.5) return "신약";
  if (score < 1)    return "중화";
  if (score < 3)    return "신강";
  if (score < 5)    return "태강";
  return "극신강";
}

/**
 * Single source of truth for strength:
 * score + level + explanations are computed once here.
 *
 * 득령/득지/득세는 아래와 같이 매핑합니다:
 * - 득령: 월령(월지) 기여 + 월령충 조정
 * - 득지: 지지(통근) 기여 + 일반 지지충 조정 + 지장간 보정
 * - 득세: 천간(비겁/인성 등) 기여
 */
export function computeStrengthResult(
  dayStem: string,
  monthBranch: string | undefined,
  allStems: string[],
  allBranches: string[],
): StrengthResult | null {
  const dmEl = STEM_ELEMENT[dayStem] as FiveElKey | undefined;
  if (!dmEl) return null;

  const genEl  = getGenerator(dmEl);  // 인성 element
  const sikEl  = GENERATES[dmEl];     // 식상 element (dm generates this)
  const jaeEl  = CONTROLS[dmEl];      // 재성 element (dm controls this)
  const gwaEl  = getController(dmEl); // 관성 element (controls dm)

  const adjustments: string[] = [];

  // 1) 득령: 월령 기여
  let deukryeong = 0;
  let monthContribRaw = 0;
  if (monthBranch) {
    const mEl = STEM_ELEMENT[monthBranch] as FiveElKey | undefined;
    if (mEl) {
      monthContribRaw =
        mEl === dmEl  ? 3
        : mEl === genEl ? 2.5
        : mEl === gwaEl ? -2.5
        : mEl === sikEl ? -1.5
        : mEl === jaeEl ? -1
        : 0;
      deukryeong += monthContribRaw;
    }
  }

  // 2) 득지: 지지 기여(본기)
  let branchContrib = 0;
  for (const b of allBranches) {
    const bEl = STEM_ELEMENT[b] as FiveElKey | undefined;
    if (!bEl) continue;
    branchContrib +=
      bEl === dmEl  ? 1.5
      : bEl === genEl ? 1.5
      : bEl === gwaEl ? -1.5
      : bEl === sikEl ? -0.8
      : bEl === jaeEl ? -0.5
      : 0;
  }

  // 3) 득세: 천간 기여 (일간 자체 1회 제외)
  let stemContrib = 0;
  for (const s of allStems) {
    if (s === dayStem) continue;
    const sEl = STEM_ELEMENT[s] as FiveElKey | undefined;
    if (!sEl) continue;
    stemContrib +=
      sEl === dmEl  ? 1
      : sEl === genEl ? 1
      : sEl === gwaEl ? -1
      : sEl === sikEl ? -0.5
      : sEl === jaeEl ? -0.3
      : 0;
  }

  // 4) 충(沖) 보정: 득령/득지 약화
  const CHUNG_OPPOSITE: Record<string, string> = {
    자: "오", 오: "자", 축: "미", 미: "축",
    인: "신", 신: "인", 묘: "유", 유: "묘",
    진: "술", 술: "진", 사: "해", 해: "사",
  };

  // 4a) 월령충: 득령에 반영
  if (monthBranch) {
    const mChungPartner = CHUNG_OPPOSITE[monthBranch];
    const mOtherBranches = allBranches.filter(b => b !== monthBranch);
    if (mChungPartner && mOtherBranches.includes(mChungPartner) && monthContribRaw !== 0) {
      const delta = monthContribRaw * 0.4;
      deukryeong -= delta;
      adjustments.push(`월령충(${monthBranch}↔${mChungPartner})로 득령 영향 약화`);
    }
  }

  // 4b) 일반 지지충: 득지에 반영
  let nonMonthChungUndo = 0;
  for (const b of allBranches) {
    if (b === monthBranch) continue;
    const partner = CHUNG_OPPOSITE[b];
    if (!partner || !allBranches.includes(partner)) continue;
    const bEl = STEM_ELEMENT[b] as FiveElKey | undefined;
    if (!bEl) continue;
    const contrib =
      bEl === dmEl  ? 1.5
      : bEl === genEl ? 1.5
      : bEl === gwaEl ? -1.5
      : bEl === sikEl ? -0.8
      : bEl === jaeEl ? -0.5
      : 0;
    nonMonthChungUndo += contrib * 0.4;
  }
  if (nonMonthChungUndo !== 0) {
    branchContrib -= nonMonthChungUndo;
    adjustments.push("지지충으로 통근/지지 영향 일부 약화");
  }

  // 5) 지장간 통근 보정: 득지에 반영
  let hiddenOverlay = 0;
  for (const b of allBranches) {
    const mainEl = STEM_ELEMENT[b] as FiveElKey | undefined;
    const hiddens = JIJANGGAN[b] ?? [];
    for (let j = 0; j < hiddens.length; j++) {
      const w = JZG_W[Math.min(j, JZG_W.length - 1)];
      if (w === 0) continue;
      const hEl = STEM_ELEMENT[hiddens[j]] as FiveElKey | undefined;
      if (!hEl || hEl === mainEl) continue;
      hiddenOverlay +=
        hEl === dmEl ? w * 1.5
        : hEl === genEl ? w * 1.0
        : hEl === gwaEl ? -w * 1.0
        : hEl === sikEl ? -w * 0.5
        : hEl === jaeEl ? -w * 0.3
        : 0;
    }
  }
  branchContrib += hiddenOverlay;

  const score = Number((deukryeong + branchContrib + stemContrib).toFixed(2));
  if (!Number.isFinite(score)) return null;

  const level = levelFromScore(score);
  const dayMasterState = toDayMasterState(level);

  const explanation: string[] = [];
  if (monthBranch) {
    if (deukryeong > 0.2) explanation.push(`득령: 월지(${monthBranch}) 기운이 일간(${dmEl})을 돕습니다`);
    else if (deukryeong < -0.2) explanation.push(`득령: 월지(${monthBranch}) 기운이 일간(${dmEl})에 부담으로 작용합니다`);
    else explanation.push(`득령: 월지(${monthBranch}) 영향이 크지 않습니다`);
  }
  if (branchContrib > 0.3) explanation.push("득지: 지지 통근/지장간 보정으로 일간을 지지합니다");
  else if (branchContrib < -0.3) explanation.push("득지: 지지 구성에서 소모/제어 기운이 상대적으로 큽니다");
  else explanation.push("득지: 지지 통근 영향이 크지 않습니다");
  if (stemContrib > 0.2) explanation.push("득세: 천간에서 비겁·인성의 지지가 있습니다");
  else if (stemContrib < -0.2) explanation.push("득세: 천간에서 관성·식상·재성의 부담이 있습니다");
  else explanation.push("득세: 천간 영향이 크지 않습니다");

  const description = STRENGTH_SHORT_DESC[level] ?? "";

  return {
    score,
    level,
    dayMasterState,
    reason: {
      deukryeong: { score: Number(deukryeong.toFixed(2)), note: monthBranch ? `월지 ${monthBranch}` : "월지 미상" },
      deukji: { score: Number(branchContrib.toFixed(2)), note: "지지(통근/지장간/충 보정 포함)" },
      deukse: { score: Number(stemContrib.toFixed(2)), note: "천간(일간 제외)" },
      adjustments,
    },
    description,
    explanation,
  };
}

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
  return computeStrengthResult(dayStem, monthBranch, allStems, allBranches)?.score ?? 0;
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
    return computeStrengthResult(dayStem, monthBranch, allStems, allBranches)?.level ?? "중화";
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
