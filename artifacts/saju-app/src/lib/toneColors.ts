/**
 * 앱 전역 공통 "좋음/보통/나쁨" 5색 체계.
 *
 * compatibilityScore.ts의 COMPAT_TONE_COLOR(이상적=보라 · 좋은=초록 · 노력형=파랑 ·
 * 긴장형=주황 · 주의=빨강)를 기준(anchor)으로 삼아, 등급·적합도·안정도처럼 "높을수록 좋은"
 * 지표는 모두 이 팔레트로 통일한다.
 *
 * 주의 — 이 팔레트를 적용하면 안 되는 지표: 배우자·재물·커리어·관성·커플관계 "활성도"처럼
 * 방향과 무관하게 사건의 크기만 재는 지표는 "높다 = 좋다"가 아니므로(이 앱의 핵심 설계
 * 원칙) 이 5색 스펙트럼을 쓰지 않는다. 활성도류는 toneClassesNeutral()의 단일 색조(호박색)
 * 강도 표시만 쓰고, 좋음/나쁨 색상 전환을 하지 않는다. 오행(목화토금수) 같은 정체성 색상도
 * 이 팔레트 대상이 아니다.
 */

export type ToneTier = 0 | 1 | 2 | 3 | 4; // 0=최상(보라) … 4=최하(빨강), COMPAT_TONE_COLOR와 동일 순서

export interface ToneClasses {
  /** 카드/영역 배경+테두리 */
  box: string;
  /** 텍스트 색상 */
  text: string;
  /** 알약형 배지(배경+테두리+텍스트) */
  badge: string;
}

const TONE_5: Record<ToneTier, ToneClasses> = {
  0: {
    box: "border-purple-100 bg-purple-50/60 dark:border-purple-900/40 dark:bg-purple-950/20",
    text: "text-purple-700 dark:text-purple-300",
    badge: "border-purple-300 bg-purple-100 text-purple-700 dark:border-purple-800 dark:bg-purple-900/50 dark:text-purple-300",
  },
  1: {
    box: "border-emerald-100 bg-emerald-50/60 dark:border-emerald-900/40 dark:bg-emerald-950/20",
    text: "text-emerald-700 dark:text-emerald-300",
    badge: "border-emerald-300 bg-emerald-100 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-900/50 dark:text-emerald-300",
  },
  2: {
    box: "border-blue-100 bg-blue-50/60 dark:border-blue-900/40 dark:bg-blue-950/20",
    text: "text-blue-700 dark:text-blue-300",
    badge: "border-blue-300 bg-blue-100 text-blue-700 dark:border-blue-800 dark:bg-blue-900/50 dark:text-blue-300",
  },
  3: {
    box: "border-orange-100 bg-orange-50/60 dark:border-orange-900/40 dark:bg-orange-950/20",
    text: "text-orange-700 dark:text-orange-300",
    badge: "border-orange-300 bg-orange-100 text-orange-700 dark:border-orange-800 dark:bg-orange-900/50 dark:text-orange-300",
  },
  4: {
    box: "border-red-100 bg-red-50/60 dark:border-red-900/40 dark:bg-red-950/20",
    text: "text-red-700 dark:text-red-300",
    badge: "border-red-300 bg-red-100 text-red-700 dark:border-red-800 dark:bg-red-900/50 dark:text-red-300",
  },
};

export function toneClasses(tier: ToneTier): ToneClasses {
  return TONE_5[tier];
}

/** 0~100 점수를 5단계로 변환. 기본 임계값 80/65/45/30(대부분의 등급 지표와 일치). */
export function toneTierFromScore(
  score: number,
  thresholds: readonly [number, number, number, number] = [80, 65, 45, 30],
): ToneTier {
  const [t0, t1, t2, t3] = thresholds;
  if (score >= t0) return 0;
  if (score >= t1) return 1;
  if (score >= t2) return 2;
  if (score >= t3) return 3;
  return 4;
}

/**
 * 이름 붙은 등급 문자열을 5단계로 매핑한다. "높음/낮음"처럼 방향과 무관하게 쓰일 수 있는
 * 단어는 포함하지 않는다 — 활성도류에는 이 함수를 쓰지 말 것(모듈 상단 주의 참고).
 */
const LEVEL_TIER_MAP: Record<string, ToneTier> = {
  "이상적": 0, "이상적 궁합": 0, "매우 높음": 0,
  "좋음": 1, "좋은 궁합": 1, "유리": 1, "안정": 1, "조화": 1,
  "보통": 2, "중립": 2, "노력형 궁합": 2, "노력형": 2,
  "불리": 3, "긴장형 궁합": 3, "긴장형": 3,
  "매우 낮음": 4, "불안정": 4, "충돌": 4, "주의": 4, "주의 궁합": 4,
};
export function toneTierFromLevel(level: string): ToneTier {
  return LEVEL_TIER_MAP[level] ?? 2;
}

/**
 * 활성도류(방향 무관 사건 크기) 전용 — 좋음/나쁨 색조를 쓰지 않고 단일 색조(호박/amber)의
 * 강도만 다르게 준다. "활성도가 높다 = 좋다"로 오독되지 않도록 의도적으로 5색 팔레트와 분리.
 */
export function toneClassesNeutral(intensity: "높음" | "보통" | "낮음"): ToneClasses {
  if (intensity === "높음") {
    return {
      box: "border-amber-200 bg-amber-50/70 dark:border-amber-900/40 dark:bg-amber-950/20",
      text: "text-amber-800 dark:text-amber-300",
      badge: "border-amber-400 bg-amber-100 text-amber-800 dark:border-amber-800 dark:bg-amber-900/50 dark:text-amber-300",
    };
  }
  if (intensity === "보통") {
    return {
      box: "border-amber-100 bg-amber-50/40 dark:border-amber-900/25 dark:bg-amber-950/10",
      text: "text-amber-700 dark:text-amber-400",
      badge: "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900/40 dark:bg-amber-950/30 dark:text-amber-400",
    };
  }
  return {
    box: "border-border/60 bg-muted/20",
    text: "text-muted-foreground",
    badge: "border-border bg-muted/30 text-muted-foreground",
  };
}
