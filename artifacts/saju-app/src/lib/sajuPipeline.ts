/**
 * ════════════════════════════════════════════════════════
 *  사주 계산 파이프라인 (4-Layer Architecture)
 * ════════════════════════════════════════════════════════
 *
 *  Layer 1 → RawInput        : 생년월일시, 성별
 *  Layer 2 → BaseStructure   : 오행·십성 분포, 신강/신약 점수, 용신
 *  Layer 3 → AdjustedStruct  : 합충형파해, 조후 보정, 수동 재정의
 *  Layer 4 → InterpretResult : 규칙 기반 해석 텍스트 생성
 *
 *  updateSajuProfile() 호출 후 computeSajuPipeline() 한 번 실행하면
 *  모든 파생 값이 자동으로 재계산됩니다.
 * ════════════════════════════════════════════════════════
 */

import type { FiveElementCount } from "./sajuEngine";
import {
  type FiveElKey,
  getController,
  getTenGodGroup,
  STEM_TO_ELEMENT,
  BRANCH_TO_ELEMENT,
} from "./element-color";
import {
  type StrengthLevel,
  type YongshinResult,
  type StrengthResult,
  computeStrengthResult,
  computeStrengthLevel,
  computeStrengthScore,
  computeYongshinFull,
  STRENGTH_SHORT_DESC,
} from "./interpretSchema";
import { applyInterpretationRules, type RuleResult } from "./interpretationRules";
import {
  determineGukguk,
  detectStructurePatterns,
  type GukgukResult,
  type StructurePattern,
} from "./gukguk";
import type { RelationshipWealthEvaluations } from "./evaluations/relationshipWealthEvaluation";
import {
  computeStructureDomainScores,
  deriveRelationshipWealthEvaluationsFromDomains,
  type StructureDomainScoreReport,
} from "./evaluations/structureDomainScores";
import {
  computeLuckTimingActivation,
  type TimingActivationResult,
} from "./evaluations/luckTimingActivation";

// ── 지장간 오행 증폭 (地藏干 Augmentation) ────────────────────────
// Adds hidden stem elements to a five-element count with fractional weights.
// Used ONLY for 용신 (yongshin) calculation to improve element-balance accuracy.
// NOT used for display — the UI always shows the raw surface count.
//
// Weight rationale (여기 0.05 / 중기 0.12 / 본기 0.00):
//   본기 is already captured by the branch's surface element, so weight=0.
//   여기 and 중기 represent the non-본기 qi that standard scoring misses.
const _JIJANGGAN_AUG: Record<string, string[]> = {
  자: ["임", "계"],         축: ["계", "신", "기"],
  인: ["무", "병", "갑"],   묘: ["갑", "을"],
  진: ["을", "계", "무"],   사: ["무", "경", "병"],
  오: ["병", "기", "정"],   미: ["정", "을", "기"],
  신: ["무", "임", "경"],   유: ["경", "신"],
  술: ["신", "정", "무"],   해: ["무", "갑", "임"],
};
const _JZG_AUG_W = [0.05, 0.12, 0.00] as const; // 여기, 중기, 본기

const _STEM_TO_EL_AUG: Record<string, FiveElKey> = {
  갑: "목", 을: "목", 병: "화", 정: "화", 무: "토", 기: "토",
  경: "금", 신: "금", 임: "수", 계: "수",
};

/**
 * Augment a surface five-element count with fractional hidden stem (지장간)
 * contributions. The result reflects the REAL qi balance more accurately
 * than the surface 8-character count alone.
 */
function augmentWithJijanggan(
  base: FiveElementCount,
  allBranches: string[],
): FiveElementCount {
  const result: FiveElementCount = { ...base };
  for (const b of allBranches) {
    const hiddens = _JIJANGGAN_AUG[b] ?? [];
    for (let j = 0; j < hiddens.length; j++) {
      const w = _JZG_AUG_W[Math.min(j, _JZG_AUG_W.length - 1)];
      if (w === 0) continue;
      const el = _STEM_TO_EL_AUG[hiddens[j]];
      if (el) result[el] = (result[el] ?? 0) + w;
    }
  }
  return result;
}

// ── Layer 1: Raw Inputs ────────────────────────────────────────────

export interface PipelineInput {
  dayStem: string;
  monthBranch?: string;
  dayBranch?: string;
  allStems: string[];
  allBranches: string[];
  effectiveFiveElements: FiveElementCount;
  manualStrengthLevel?: string | null;
  manualYongshinData?: Array<{ type: string; elements: string[] }> | null;
  /** Expert options — all optional, defaults match legacy behavior */
  expertOptions?: {
    /** Disable 조후 보정 (seasonal yongshin secondary injection) */
    seasonalAdjustmentOff?: boolean;
  };
  /** 현재 대운 간지(한글 2글자). 없으면 timing 가중치 0 */
  timingDaewoonHangul?: string;
  /** 현재 세운 간지(한글 2글자). 없으면 timing 가중치 0 */
  timingSeunHangul?: string;
}

// ── Layer 2: Base Structure Calculation ───────────────────────────
// heavenly stems / earthly branches / five elements / ten gods / day master strength

export interface BaseStructure {
  fiveElements: FiveElementCount;
  tenGodGroups: Record<string, number>;   // group → raw count (from effectiveFiveElements)
  strengthScore: number;
  strengthLevel: StrengthLevel;
  /** Single source of truth for UI */
  strengthResult: StrengthResult;
  yongshinResult: YongshinResult;
  dayMasterElement: FiveElKey | undefined;
}

function isDevRuntime(): boolean {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const im = (import.meta as any);
    if (im?.env?.DEV === true) return true;
  } catch { /* ignore */ }
  try {
    // eslint-disable-next-line no-undef
    return typeof process !== "undefined" && process.env.NODE_ENV !== "production";
  } catch { /* ignore */ }
  return false;
}

function warnPipelineFallback(context: Record<string, unknown>) {
  if (!isDevRuntime()) return;
  // eslint-disable-next-line no-console
  console.warn("[pipeline-fallback]", context);
}

function computeBaseStructure(input: PipelineInput): BaseStructure {
  const { dayStem, monthBranch, allStems, allBranches, effectiveFiveElements } = input;

  const dayMasterElement = (STEM_TO_ELEMENT[dayStem] ?? undefined) as FiveElKey | undefined;

  // Ten-god group counts from ohaeng
  const tenGodGroups: Record<string, number> = { 비겁: 0, 식상: 0, 재성: 0, 관성: 0, 인성: 0 };
  if (dayMasterElement) {
    for (const el of Object.keys(effectiveFiveElements) as FiveElKey[]) {
      const g = getTenGodGroup(dayMasterElement, el);
      tenGodGroups[g] = (tenGodGroups[g] ?? 0) + (effectiveFiveElements[el] ?? 0);
    }
  }

  const strengthScore = computeStrengthScore(dayStem, monthBranch, allStems, allBranches);
  const strengthLevel = computeStrengthLevel(dayStem, effectiveFiveElements, monthBranch, allStems, allBranches);
  const computedStrength = computeStrengthResult(dayStem, monthBranch, allStems, allBranches);
  if (!computedStrength) {
    warnPipelineFallback({
      kind: "strengthResult",
      reason: "computeStrengthResult returned null; falling back to score/level defaults",
      dayStem,
      monthBranch,
      allStems,
      allBranches,
    });
  }
  const strengthResult: StrengthResult = computedStrength ?? {
    score: strengthScore,
    level: strengthLevel,
    dayMasterState: (strengthLevel === "중화" ? "balanced" : ["신강", "태강", "극신강"].includes(strengthLevel) ? "strong" : "weak"),
    reason: {
      deukryeong: { score: 0, note: monthBranch ? `월지 ${monthBranch}` : "월지 미상" },
      deukji: { score: 0, note: "지지" },
      deukse: { score: 0, note: "천간" },
      adjustments: ["fallback: computeStrengthResult=null"],
    },
    description: "",
    explanation: ["강도 계산 상세가 없어 fallback 경로로 대체되었습니다."],
    strengthDebug: {
      dayStem,
      deukryeong: 0,
      branchContrib: 0,
      stemContrib: 0,
      leakagePenalty: 0,
      yinAdjustment: 0,
      finalScore: strengthScore,
      finalLevel: strengthLevel,
    },
  };

  // Use 지장간-augmented element counts for yongshin.
  // This gives a more accurate picture of the qi balance (including 여기/중기 hidden stems)
  // without changing the displayed 오행 distribution.
  const augmentedForYongshin = augmentWithJijanggan(effectiveFiveElements, allBranches);
  const yongshinResult = computeYongshinFull(dayStem, strengthLevel, augmentedForYongshin);

  return {
    fiveElements: effectiveFiveElements,
    tenGodGroups,
    strengthScore,
    strengthLevel,
    strengthResult,
    yongshinResult,
    dayMasterElement,
  };
}

// ── Layer 3: Structure Adjustment Engine ──────────────────────────
// 합충형파해, 조후 보정, 수동 재정의 반영

export interface AdjustedStructure extends BaseStructure {
  effectiveStrengthLevel: StrengthLevel;
  effectiveYongshin: FiveElKey;
  effectiveYongshinSecondary?: FiveElKey;
  isStrengthOverridden: boolean;
  isYongshinOverridden: boolean;
  seasonalAdjustment: SeasonalAdjustment;
}

export interface SeasonalAdjustment {
  season: "봄" | "여름" | "가을" | "겨울" | "환절기";
  seasonElement: FiveElKey;
  needsFireBoost: boolean;   // 겨울/수 강 → 화 필요
  needsWaterBoost: boolean;  // 여름/화 강 → 수 필요
  adjustmentNote: string;
}

const BRANCH_SEASON: Record<string, SeasonalAdjustment["season"]> = {
  인: "봄", 묘: "봄", 진: "봄",
  사: "여름", 오: "여름", 미: "여름",
  신: "가을", 유: "가을", 술: "가을",
  해: "겨울", 자: "겨울", 축: "겨울",
};

const SEASON_ELEMENT: Record<SeasonalAdjustment["season"], FiveElKey> = {
  봄: "목", 여름: "화", 가을: "금", 겨울: "수", 환절기: "토",
};

function computeSeasonalAdjustment(
  monthBranch: string | undefined,
  effectiveFiveElements: FiveElementCount,
): SeasonalAdjustment {
  const season = (monthBranch ? BRANCH_SEASON[monthBranch] : undefined) ?? "환절기";
  const seasonElement = SEASON_ELEMENT[season];
  const total = Object.values(effectiveFiveElements).reduce((a, b) => a + b, 0) || 1;
  const waterRatio = (effectiveFiveElements["수"] ?? 0) / total;
  const fireRatio  = (effectiveFiveElements["화"] ?? 0) / total;

  // 조후 보정 규칙
  const needsFireBoost  = season === "겨울" && waterRatio > 0.35;
  const needsWaterBoost = season === "여름" && fireRatio > 0.35;

  const adjustmentNote = needsFireBoost
    ? "겨울(월지 기준) + 수(水) 비율 편중 → 조후(온도) 보정: 화(火) 보강 필요 (오행 결핍과 별개)"
    : needsWaterBoost
    ? "여름(월지 기준) + 화(火) 비율 편중 → 조후(온도) 보정: 수(水) 보강 필요 (오행 결핍과 별개)"
    : `${season}(월지 기준) — 조후(온도/비율) 보정 규칙 미발동 (오행 결핍과 별개)`;

  return { season, seasonElement, needsFireBoost, needsWaterBoost, adjustmentNote };
}

function computeAdjustedStructure(
  input: PipelineInput,
  base: BaseStructure,
): AdjustedStructure {
  const isStrengthOverridden = !!(input.manualStrengthLevel);
  const isYongshinOverridden = !!(input.manualYongshinData && input.manualYongshinData.length > 0);

  const effectiveStrengthLevel = isStrengthOverridden
    ? (input.manualStrengthLevel as StrengthLevel)
    : base.strengthLevel;

  const effectiveStrengthResult: StrengthResult = {
    ...base.strengthResult,
    level: effectiveStrengthLevel,
    dayMasterState: effectiveStrengthLevel === "중화"
      ? "balanced"
      : ["신강", "태강", "극신강"].includes(effectiveStrengthLevel) ? "strong" : "weak",
    description: STRENGTH_SHORT_DESC[effectiveStrengthLevel] ?? base.strengthResult.description,
    strengthDebug: {
      ...base.strengthResult.strengthDebug,
      finalLevel: effectiveStrengthLevel,
      finalScore: base.strengthResult.score,
    },
  };

  // Recompute yongshin from effective strength level using 지장간-augmented counts
  const _augForRecalc = augmentWithJijanggan(input.effectiveFiveElements, input.allBranches);
  const recalcYongshin = computeYongshinFull(input.dayStem, effectiveStrengthLevel, _augForRecalc);
  let effectiveYongshin = recalcYongshin.primary;
  let effectiveYongshinSecondary = recalcYongshin.secondary;

  const seasonalAdjustment = computeSeasonalAdjustment(input.monthBranch, input.effectiveFiveElements);

  // ── 조후용신 연결 (調候用神) ──────────────────────────────────────
  // If seasonal adjustment is needed and the user hasn't manually overridden,
  // inject the 조후용신 as secondary (or promote to primary if very strong).
  //
  // Rule:
  //   • 겨울 + 수 편중 → 화(火) 필요 (warming 조후)
  //   • 여름 + 화 편중 → 수(水) 필요 (cooling 조후)
  //
  // We only ADD the 조후 element as secondary if it isn't already present.
  // If the 억부용신 already agrees with 조후, no change is needed.
  // Expert option: can be disabled via seasonalAdjustmentOff.
  if (!isYongshinOverridden && !input.expertOptions?.seasonalAdjustmentOff) {
    if (seasonalAdjustment.needsFireBoost) {
      // 조후: 화(火) 필요
      if (effectiveYongshin !== "화") {
        // 억부 primary isn't 화 — inject 화 as secondary or swap if very imbalanced
        if (effectiveYongshinSecondary !== "화") {
          effectiveYongshinSecondary = "화";
        }
      }
    } else if (seasonalAdjustment.needsWaterBoost) {
      // 조후: 수(水) 필요
      if (effectiveYongshin !== "수") {
        if (effectiveYongshinSecondary !== "수") {
          effectiveYongshinSecondary = "수";
        }
      }
    }
  }

  return {
    ...base,
    strengthResult: effectiveStrengthResult,
    effectiveStrengthLevel,
    effectiveYongshin,
    effectiveYongshinSecondary,
    isStrengthOverridden,
    isYongshinOverridden,
    seasonalAdjustment,
  };
}

// ── Layer 4: Rule-Based Interpretation Engine ─────────────────────
// 입력 변화 → 규칙 자동 실행 → 해석 텍스트 재생성

export interface InterpretationResult {
  rulesApplied: RuleResult[];
  ruleInsights: string[];          // 규칙에서 생성된 핵심 통찰
  /** Single source of truth for 格局 (격국) */
  gukguk: GukgukResult | null;
  /** 구조 패턴 (식신생재/관인상생 등) */
  structurePatterns: StructurePattern[];
  /** UI short label (derived from gukguk only) */
  structureType: string;
  yongshinCharacterKey: string;    // 용신 오행 한글
  seasonalNote: string;            // 조후 보정 메모
}

function buildInterpretationResult(
  input: PipelineInput,
  adjusted: AdjustedStructure,
): InterpretationResult {
  const { tenGodGroups, effectiveStrengthLevel, effectiveYongshin, seasonalAdjustment } = adjusted;
  const total = Object.values(tenGodGroups).reduce((a, b) => a + b, 0) || 1;

  // Normalized ten-god group ratios (0~1)
  const ratios: Record<string, number> = {};
  for (const [g, v] of Object.entries(tenGodGroups)) ratios[g] = v / total;

  const ruleCtx = {
    dayStem: input.dayStem,
    strengthLevel: effectiveStrengthLevel,
    tenGodRatios: ratios,
    seasonalAdjustment,
    effectiveYongshin,
  };

  const { results: rulesApplied } = applyInterpretationRules(ruleCtx);
  const ruleInsights = rulesApplied
    .filter((r) => r.fired)
    .map((r) => r.interpretation);

  const gukguk = (input.monthBranch
    ? determineGukguk(input.dayStem, input.monthBranch, input.allStems)
    : null);
  const structurePatterns = detectStructurePatterns(input.dayStem, input.allStems, input.allBranches, input.monthBranch);
  const structureType = gukguk?.name ?? "격국 없음";

  return {
    rulesApplied,
    ruleInsights,
    gukguk,
    structurePatterns,
    structureType,
    yongshinCharacterKey: effectiveYongshin,
    seasonalNote: seasonalAdjustment.adjustmentNote,
  };
}

export interface EngineDiagnostics {
  strength: {
    source: "interpretSchema.computeStrengthResult";
    score: number;
    level: StrengthLevel;
    deukRyeong: StrengthResult["reason"]["deukryeong"];
    deukJi: StrengthResult["reason"]["deukji"];
    deukSe: StrengthResult["reason"]["deukse"];
    adjustments: string[];
  };
  gukguk: {
    source: "gukguk.determineGukguk";
    method: "투출 기준(월지 지장간 → 천간 투출)";
    name: string;
    reason: string[];
  };
  yongshin: {
    source: "interpretSchema.computeYongshinFull";
    method: "강도 기반(억부) + 지장간 가중(용신 계산에만) + 조후 secondary 주입(조건부)";
    primary: FiveElKey;
    secondary?: FiveElKey;
    countsBasis: {
      display: "천간+지지(지장간 미포함, 가중치 없음)";
      yongshin: "천간+지지 + 지장간(여기/중기) 가중치 포함";
    };
  };
  johu: {
    source: "sajuPipeline.computeSeasonalAdjustment";
    method: "계절(월지)+수/화 비율 threshold(결핍 기준 아님)";
    adjusted: boolean;
    reason: string;
  };
}

// ── Full Pipeline Result ───────────────────────────────────────────

export interface SajuPipelineResult {
  input: PipelineInput;
  base: BaseStructure;       // Layer 2
  adjusted: AdjustedStructure; // Layer 3
  interpretation: InterpretationResult; // Layer 4
  diagnostics: EngineDiagnostics;
  /** 원국 기반 보조 지표(관성·배우자궁·재성) — 구조 7영역에서 도출 */
  evaluations: RelationshipWealthEvaluations;
  /** 구조 기반 7영역(재물·커리어·명예·인간관계·연애·건강·실행력) */
  structureDomains: StructureDomainScoreReport;
  /** 대운·세운 가중 활성화(원국 evaluations는 변경하지 않음) */
  timingActivation: TimingActivationResult;
}

/**
 * computeSajuPipeline()
 *
 * 사주 데이터 수정 시 항상 이 함수 하나로 모든 파생값 재계산.
 *
 * updateSajuProfile() 호출 후 effectiveFiveElements 변화가 감지되면
 * React useMemo를 통해 자동 재실행됩니다.
 *
 * 계산 순서:
 *   1. recalculateFiveElements   (effectiveFiveElements 입력으로 수신)
 *   2. recalculateTenGods        (computeBaseStructure)
 *   3. applyStrengthCalculation  (computeBaseStructure)
 *   4. applySeasonalAdjustment   (computeAdjustedStructure)
 *   5. recalculateYongshin       (computeAdjustedStructure)
 *   6. generateInterpretation    (buildInterpretationResult)
 */
export function computeSajuPipeline(input: PipelineInput): SajuPipelineResult {
  const base        = computeBaseStructure(input);
  const adjusted    = computeAdjustedStructure(input, base);
  const interpretation = buildInterpretationResult(input, adjusted);
  const strength = adjusted.strengthResult;

  const structureDomains = computeStructureDomainScores({
    input,
    base,
    adjusted,
    interpretation,
  });
  const evaluations = deriveRelationshipWealthEvaluationsFromDomains(structureDomains);

  if (isDevRuntime()) {
    // eslint-disable-next-line no-console
    console.log("[structureDomains]", structureDomains);
    // eslint-disable-next-line no-console
    console.log("[evaluations: derived from structureDomains]", evaluations);
  }

  const timingActivation = computeLuckTimingActivation(
    evaluations,
    input.timingDaewoonHangul,
    input.timingSeunHangul,
    input.dayStem,
    input.dayBranch,
    adjusted.effectiveYongshin,
    adjusted.effectiveYongshinSecondary,
    getController(adjusted.effectiveYongshin),
  );

  if (isDevRuntime()) {
    // eslint-disable-next-line no-console
    console.log("[timingActivation]", timingActivation);
  }

  const diagnostics: EngineDiagnostics = {
    strength: {
      source: "interpretSchema.computeStrengthResult",
      score: strength.score,
      level: strength.level,
      deukRyeong: strength.reason.deukryeong,
      deukJi: strength.reason.deukji,
      deukSe: strength.reason.deukse,
      adjustments: strength.reason.adjustments ?? [],
    },
    gukguk: {
      source: "gukguk.determineGukguk",
      method: "투출 기준(월지 지장간 → 천간 투출)",
      name: interpretation.gukguk?.name ?? "격국 없음",
      reason: interpretation.gukguk?.explanation ?? ["투출이 확인되지 않아 격국을 확정하지 않았습니다."],
    },
    yongshin: {
      source: "interpretSchema.computeYongshinFull",
      method: "강도 기반(억부) + 지장간 가중(용신 계산에만) + 조후 secondary 주입(조건부)",
      primary: adjusted.effectiveYongshin,
      secondary: adjusted.effectiveYongshinSecondary,
      countsBasis: {
        display: "천간+지지(지장간 미포함, 가중치 없음)",
        yongshin: "천간+지지 + 지장간(여기/중기) 가중치 포함",
      },
    },
    johu: {
      source: "sajuPipeline.computeSeasonalAdjustment",
      method: "계절(월지)+수/화 비율 threshold(결핍 기준 아님)",
      adjusted: interpretation.seasonalNote.includes("보강 필요"),
      reason: interpretation.seasonalNote,
    },
  };
  return { input, base, adjusted, interpretation, diagnostics, evaluations, structureDomains, timingActivation };
}
