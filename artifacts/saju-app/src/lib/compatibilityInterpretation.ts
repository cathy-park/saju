// [Phase 3 P1] 점수 해석 UX — percentile 기반 신규 표시 레이어.
//
// 이 모듈은 compatibilityScore.ts의 산식(gradeFromScore, finalType, Core/Aux 등)을 전혀
// 건드리지 않는다. compatibilityReferenceCDF.ts에 미리 계산되어 체크인된 empirical CDF
// lookup table을 읽기만 하며, 런타임에 simulation을 실행하지 않는다.
//
// referencePercentile은 "전체 인구 중 실제 순위"가 아니라, 고정 seed로 생성한 기준
// 궁합 분포(reference distribution) 대비 상대적 위치다 — 문구에도 이 뉘앙스를 유지한다
// (금지: "전체 사람 중 상위 25%" / 허용: "상위 약 25%").
import {
  HUMAN_SCORE_CDF,
  ROMANCE_SCORE_CDF,
  MARRIAGE_SCORE_CDF,
  COMPATIBILITY_REFERENCE_CDF_METADATA,
} from "./compatibilityReferenceCDF";

// compatibilityScore.ts의 Core/Aux 산식이 확정된 버전 태그.
// compatibilityReferenceCDF.ts의 scoringModelVersion과 반드시 일치해야 한다 — 어긋나면
// CDF가 현재 산식과 다른 분포로 생성된 stale 데이터라는 뜻이다(버전 가드 테스트 참고).
// [Phase 3 P1] Human Compatibility가 dm/mb neutral scorer(relType 무관)를 쓰도록 바뀌어
// friend/coworker Human의 실제 산식이 변경됐으므로 phase3-b4f58a4 → phase3-human-neutral-v1로
// bump했다. lover 기준 분포는 이론상 동일(과 같음이 실측으로도 확인됨)하지만, Human을
// friend/coworker에도 동일 CDF로 노출하는 이상 산식 변경 자체를 버전에 반영해야 한다.
export const COMPATIBILITY_SCORING_VERSION = "phase3-human-neutral-v1";

export type CompatibilityInterpretationModel = "human" | "romance" | "marriage";

export type PercentileGrade =
  | "주의 필요"
  | "다소 낮은 편"
  | "보통"
  | "좋은 편"
  | "매우 좋은 편";

export interface PurposeCompatibilityInterpretation {
  model: CompatibilityInterpretationModel;
  score: number;
  /** 기준 분포(reference distribution) 대비 상대적 위치, 0~100. 실제 인구 통계가 아니다. */
  referencePercentile: number;
  /** 100 - referencePercentile, 반올림된 정수(레거시 필드, 표시용으로는 topPercentDisplay를 쓴다). */
  topPercent: number;
  /** 100 - referencePercentile, 반올림 이전 raw 값. formatTopPercent의 입력이다. */
  topPercentRaw: number;
  /** UI/clipboard가 그대로 "상위 " 뒤에 붙여 쓰는 표시용 문자열(예: "약 27%", "1% 이내"). */
  topPercentDisplay: string;
  grade: PercentileGrade;
  /** 모델별 한 줄 맥락 문장(짧게). */
  contextLine: string;
}

/**
 * topPercentRaw(100 - referencePercentile)를 사용자 표시용 문자열로 변환한다.
 * "상위 " 접두사는 호출부(UI/clipboard)가 붙이고, 이 함수는 그 뒤에 올 부분만 책임진다.
 *
 * - 0 <= raw < 1 (referencePercentile이 99를 초과해 100에 매우 가깝거나 정확히 100인 경우
 *   포함) → "1% 이내". "상위 0%"/"상위 약 0%"처럼 사용자에게 오해를 주는 0%대 표기를
 *   원천적으로 만들지 않기 위한 정책이다.
 * - 그 외 → 정수로 반올림한 "약 N%".
 */
export function formatTopPercent(topPercentRaw: number): string {
  if (topPercentRaw < 1) return "1% 이내";
  return `약 ${Math.round(topPercentRaw)}%`;
}

const CDF_BY_MODEL: Record<CompatibilityInterpretationModel, readonly number[]> = {
  human: HUMAN_SCORE_CDF,
  romance: ROMANCE_SCORE_CDF,
  marriage: MARRIAGE_SCORE_CDF,
};

/**
 * 5구간 percentile 등급(하한 포함, lower-bound-inclusive).
 *   [0, 15)   → 주의 필요
 *   [15, 35)  → 다소 낮은 편
 *   [35, 70)  → 보통
 *   [70, 90)  → 좋은 편
 *   [90, 100] → 매우 좋은 편
 */
export function percentileGrade(referencePercentile: number): PercentileGrade {
  if (referencePercentile < 15) return "주의 필요";
  if (referencePercentile < 35) return "다소 낮은 편";
  if (referencePercentile < 70) return "보통";
  if (referencePercentile < 90) return "좋은 편";
  return "매우 좋은 편";
}

const CONTEXT_LINES: Record<CompatibilityInterpretationModel, Record<PercentileGrade, string>> = {
  human: {
    "주의 필요": "기본적인 소통에서부터 서로 의식적인 노력이 필요한 조합입니다.",
    "다소 낮은 편": "가치관이나 소통 방식에서 다소 삐걱거림이 생길 수 있는 조합입니다.",
    "보통": "무난하게 어울리며 큰 갈등 없이 지낼 수 있는 조합입니다.",
    "좋은 편": "서로 편안하게 소통하며 자연스럽게 가까워질 수 있는 조합입니다.",
    "매우 좋은 편": "만나자마자 통하는, 인간적으로 잘 맞는 드문 조합입니다.",
  },
  romance: {
    "주의 필요": "연애 감정으로 이어지기까지 서로 많은 이해와 노력이 필요한 조합입니다.",
    "다소 낮은 편": "설렘과 별개로 연애 스타일 차이를 조율해야 하는 조합입니다.",
    "보통": "무난하게 연애할 수 있는, 특별히 튀지 않는 조합입니다.",
    "좋은 편": "서로에게 자연스럽게 끌리며 연애 궁합이 좋은 조합입니다.",
    "매우 좋은 편": "강하게 끌리고 잘 맞는, 연애 궁합이 뛰어난 조합입니다.",
  },
  marriage: {
    "주의 필요": "결혼 생활의 안정을 위해 서로 각별한 노력과 이해가 필요한 조합입니다.",
    "다소 낮은 편": "결혼 후 생활 방식 차이를 맞춰가는 데 시간이 걸릴 수 있는 조합입니다.",
    "보통": "무난하게 가정을 꾸려갈 수 있는 조합입니다.",
    "좋은 편": "서로를 지지하며 안정적인 가정을 이룰 수 있는 조합입니다.",
    "매우 좋은 편": "결혼 궁합 측면에서 매우 안정적이고 조화로운 조합입니다.",
  },
};

/**
 * score(0~100)에 대응하는 empirical CDF 값을 반환한다. score는 정수로 clamp/round해서
 * lookup하며, 생성 시점의 표본 해상도(정수 0~100)를 그대로 반영한다.
 *
 * [discrete CDF / 동점 정책] referencePercentile은 P(referenceScore <= score) empirical CDF
 * 기준이다. score가 정수(0~100)라 표본 안에 동점이 많이 생기며, 동점자는 항상 동일한
 * referencePercentile을 갖는다(정밀 순위가 아니라 "값 이하 비율"이라는 정의를 그대로
 * 따른 결과다). 이번 단계에서 mid-rank 등 다른 percentile 정의로 바꾸지 않았고, 사용자
 * 문구도 정밀 순위처럼 오해되지 않도록 "기준 분포 상위 약 N%"로만 표시한다.
 */
function lookupCDF(cdf: readonly number[], score: number): number {
  const idx = Math.max(0, Math.min(100, Math.round(score)));
  return cdf[idx];
}

export function getPurposeCompatibilityInterpretation(
  model: CompatibilityInterpretationModel,
  score: number,
): PurposeCompatibilityInterpretation {
  const cdf = CDF_BY_MODEL[model];
  const referencePercentile = Math.round(lookupCDF(cdf, score) * 1000) / 10; // 소수 1자리까지 계산
  const grade = percentileGrade(referencePercentile);
  const topPercentRaw = 100 - referencePercentile;
  const topPercent = Math.round(topPercentRaw);
  return {
    model,
    score,
    referencePercentile,
    topPercent,
    topPercentRaw,
    topPercentDisplay: formatTopPercent(topPercentRaw),
    grade,
    contextLine: CONTEXT_LINES[model][grade],
  };
}

/** stale-CDF 가드: CDF 데이터가 현재 scoring 산식 기준으로 재생성됐는지 확인한다. */
export function isReferenceCDFVersionCurrent(): boolean {
  return COMPATIBILITY_REFERENCE_CDF_METADATA.scoringModelVersion === COMPATIBILITY_SCORING_VERSION;
}
