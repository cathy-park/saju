// ── 사주 궁합 점수 계산 엔진 ─────────────────────────────────────────────
// 기준점 50 + 7가지 가중 조정 → 0-100 클램프 후 등급 결정
// 구조적 조정(상향/하향)은 등급 티어에만 영향을 미치며 점수 숫자는 변경 없음
//
// 데이터 출처 요약(점검):
// - 메인 7조정: getFinalPillars 기반 일간·일지·월지·지지 교차·오행 보완·십성(일간쌍)·용신.
//   용신·구조 상세 줄만 computePersonPipelineSnapshot(=원국 카드와 동일 스냅샷) 사용.
// - spouseStructureAxisComparison: 스냅샷 evaluations·십성그룹·동일 기둥/신살 입력으로 보조 3축만
//   (메인 점수 미가산). sPal·emotionalLoad·관재/재성 작동은 3축에만 반영되고 7조정에는 직접 미포함.

import type { PersonRecord } from "./storage";
import { getFinalPillars } from "./storage";
import type { FiveElementCount } from "./sajuEngine";
import { computeBranchRelations } from "./branchRelations";
import { getTenGod } from "./tenGods";
import { getController, type FiveElKey } from "./element-color";
import { computePersonPipelineSnapshot } from "./personPipelineSnapshot";
import type { SajuPipelineResult } from "./sajuPipeline";
import {
  computeSpouseStructureAxisBundleFromPersonRecord,
  type SpouseStructureAxisBundle,
} from "./evaluations/spouseStructureAxisBundle";

// ── 기초 상수 ─────────────────────────────────────────────────────────────

const STEM_ELEMENT: Record<string, keyof FiveElementCount> = {
  갑: "목", 을: "목", 병: "화", 정: "화",
  무: "토", 기: "토", 경: "금", 신: "금",
  임: "수", 계: "수",
};
const BRANCH_ELEMENT: Record<string, keyof FiveElementCount> = {
  자: "수", 축: "토", 인: "목", 묘: "목",
  진: "토", 사: "화", 오: "화", 미: "토",
  신: "금", 유: "금", 술: "토", 해: "수",
};
const STEM_YIN_YANG: Record<string, "양" | "음"> = {
  갑: "양", 병: "양", 무: "양", 경: "양", 임: "양",
  을: "음", 정: "음", 기: "음", 신: "음", 계: "음",
};
const GENERATING: ReadonlyArray<readonly [keyof FiveElementCount, keyof FiveElementCount]> = [
  ["목", "화"], ["화", "토"], ["토", "금"], ["금", "수"], ["수", "목"],
];
const CONTROLLING: ReadonlyArray<readonly [keyof FiveElementCount, keyof FiveElementCount]> = [
  ["목", "토"], ["토", "수"], ["수", "화"], ["화", "금"], ["금", "목"],
];

// ── 지지 관계 lookup tables (독립적 — branchRelations.ts와 별도) ──────────

const SIX_HAP: [string, string][] = [
  ["자", "축"], ["인", "해"], ["묘", "술"], ["진", "유"], ["사", "신"], ["오", "미"],
];
const CHUNG_PAIRS: [string, string][] = [
  ["자", "오"], ["축", "미"], ["인", "신"], ["묘", "유"], ["진", "술"], ["사", "해"],
];
const HYEONG_MAP: Record<string, string[]> = {
  인: ["사"], 사: ["신"], 신: ["인"],
  축: ["술"], 술: ["미"], 미: ["축"],
  자: ["묘"], 묘: ["자"],
};
const PA_PAIRS: [string, string][] = [
  ["자", "유"], ["묘", "오"], ["진", "축"], ["술", "미"],
];
const HAE_PAIRS: [string, string][] = [
  ["자", "미"], ["축", "오"], ["인", "사"], ["묘", "진"], ["신", "해"], ["유", "술"],
];
const WONJIN_PAIRS: [string, string][] = [
  ["자", "미"], ["축", "오"], ["인", "유"], ["묘", "신"], ["진", "해"], ["사", "술"],
];
const HALF_TRIAD_GROUPS: string[][] = [
  ["인", "오", "술"], ["사", "유", "축"],
  ["신", "자", "진"], ["해", "묘", "미"],
];

function pairMatch(a: string, b: string, pairs: [string, string][]): boolean {
  return pairs.some(([x, y]) => (a === x && b === y) || (a === y && b === x));
}

function getBranchRels(b1: string, b2: string): string[] {
  const rels: string[] = [];
  if (pairMatch(b1, b2, SIX_HAP))   rels.push("합");
  if (pairMatch(b1, b2, CHUNG_PAIRS)) rels.push("충");
  if (HYEONG_MAP[b1]?.includes(b2)) rels.push("형");
  if (pairMatch(b1, b2, PA_PAIRS))   rels.push("파");
  if (pairMatch(b1, b2, HAE_PAIRS))  rels.push("해");
  if (pairMatch(b1, b2, WONJIN_PAIRS)) rels.push("원진");
  const halfTriad = HALF_TRIAD_GROUPS.some(g => g.includes(b1) && g.includes(b2));
  if (halfTriad && !rels.includes("합")) rels.push("반합");
  return rels;
}

// ── Tone (5등급) ──────────────────────────────────────────────────────────

export type CompatibilityTone =
  | "이상적 궁합" | "좋은 궁합" | "노력형 궁합" | "긴장형 궁합" | "주의 궁합";

export const COMPAT_TONE_COLOR: Record<CompatibilityTone, string> = {
  "이상적 궁합": "text-purple-700",
  "좋은 궁합":   "text-green-700",
  "노력형 궁합": "text-blue-600",
  "긴장형 궁합": "text-orange-600",
  "주의 궁합":   "text-red-600",
};

// ascending: index 0 = worst, 4 = best
const TONE_TIERS: CompatibilityTone[] =
  ["주의 궁합", "긴장형 궁합", "노력형 궁합", "좋은 궁합", "이상적 궁합"];

export function gradeFromScore(score: number): CompatibilityTone {
  if (score >= 80) return "이상적 궁합";
  if (score >= 68) return "좋은 궁합";
  if (score >= 55) return "노력형 궁합";
  if (score >= 40) return "긴장형 궁합";
  return "주의 궁합";
}

function shiftTier(base: CompatibilityTone, delta: number): CompatibilityTone {
  const idx = TONE_TIERS.indexOf(base);
  return TONE_TIERS[Math.max(0, Math.min(TONE_TIERS.length - 1, idx + delta))];
}

// ── 반환 타입 ─────────────────────────────────────────────────────────────

export interface AdjustmentStep {
  category: string;
  delta: number;
  note: string;
}

export interface StructuralTierStep {
  label: string;
  direction: "up" | "down";
}

export interface CompatibilityResult {
  baseScore: number;
  adjustmentSteps: AdjustmentStep[];

  baseType: CompatibilityTone;
  structuralSteps: StructuralTierStep[];
  finalType: CompatibilityTone;
  finalColor: string;

  // backward compat
  totalScore: number;
  score: number;
  grade: string;
  clashCount: number;

  keywords: string[];
  summary: string;
  strengths: string[];
  cautions: string[];
  advice: string[];
  longTermOutlook: string;

  domains: {
    emotionalConnection: number;
    communication: number;
    values: number;
    problemSolving: number;
  };

  details: { title: string; description: string; isPositive: boolean }[];
  elementBalance: { person1: FiveElementCount; person2: FiveElementCount };

  // legacy subscores — kept for clipboard / external callers
  subscores: {
    dayMaster: number;
    spousePalace: number;
    branchInteraction: number;
    elementComplementarity: number;
    tenGodRelation: number;
    monthBranch: number;
    yongshin: number;
  };

  /**
   * 원국 파이프라인 스냅샷과 동일 입력으로 산출한 배우자 구조 3축(보조 비교).
   * calculateCompatibilityScore의 기준점·7조정 합계에는 반영하지 않음.
   */
  spouseStructureAxisComparison: SpouseStructureAxisComparisonBlock | null;
}

export interface SpouseAxisComparisonSentences {
  practical: string;
  emotional: string;
  image: string;
}

/** 축별 두 사람 점수와 차이·방향(메인 점수 미반영, 보조 UI). */
export interface SpouseAxisPairStats {
  person1: number;
  person2: number;
  gap: number;
  min: number;
  max: number;
  average: number;
  higher: "person1" | "person2" | "tie";
}

export interface SpouseStructureAxisComparisonBlock {
  person1: SpouseStructureAxisBundle;
  person2: SpouseStructureAxisBundle;
  /** 축별 수치 비교 */
  stats: {
    practical: SpouseAxisPairStats;
    emotional: SpouseAxisPairStats;
    image: SpouseAxisPairStats;
  };
  /** 축별 교차 해석(점수·갭을 전제로 한 문장) */
  crossSentences: SpouseAxisComparisonSentences;
  /** 생활·역할·약속 등 ‘관계가 굴러가는지’ 쪽 */
  maintenanceLine: string;
  /** 정서 기대·끌림 체감 등 ‘마음이 채워지는지’ 쪽 */
  satisfactionLine: string;
  /** 3축을 한데 묶은 한 문단 */
  holisticSummary: string;
  /** @deprecated UI는 crossSentences 사용 */
  sentences: SpouseAxisComparisonSentences;
}

function computeSpouseAxisPairStats(p1: number, p2: number): SpouseAxisPairStats {
  const gap = Math.abs(p1 - p2);
  const min = Math.min(p1, p2);
  const max = Math.max(p1, p2);
  const average = Math.round(((p1 + p2) / 2) * 10) / 10;
  let higher: SpouseAxisPairStats["higher"];
  if (p1 > p2) higher = "person1";
  else if (p2 > p1) higher = "person2";
  else higher = "tie";
  return { person1: p1, person2: p2, gap, min, max, average, higher };
}

function ptcl(name: string, whenHasBatchim: string, otherwise: string): string {
  if (!name) return otherwise;
  const last = name[name.length - 1];
  if (last < "가" || last > "힣") return otherwise;
  const code = (last.charCodeAt(0) - 0xac00) % 28;
  return code > 0 ? whenHasBatchim : otherwise;
}

function conjAnd(a: string, b: string): string {
  return `${a}${ptcl(a, "과", "와")} ${b}`;
}

/**
 * 스냅샷 3축 교차 비교 블록(갭·방향·유지/만족 분리·종합). 메인 궁합 점수와 분리 유지.
 */
export function buildSpouseStructureAxisComparisonBlock(
  a: SpouseStructureAxisBundle,
  b: SpouseStructureAxisBundle,
  name1: string,
  name2: string,
): SpouseStructureAxisComparisonBlock {
  const n1 = name1 || "A";
  const n2 = name2 || "B";
  const st = {
    practical: computeSpouseAxisPairStats(a.practical, b.practical),
    emotional: computeSpouseAxisPairStats(a.emotional, b.emotional),
    image: computeSpouseAxisPairStats(a.image, b.image),
  };

  const thrHi = 62;
  const thrLo = 46;
  const bigP = st.practical.gap >= 16;
  const bigE = st.emotional.gap >= 16;
  const bigI = st.image.gap >= 18;

  const higherName = (h: SpouseAxisPairStats["higher"]) =>
    h === "person1" ? n1 : h === "person2" ? n2 : null;

  // ── 현실 궁합: 교차 ──
  let practical: string;
  if (a.practical >= thrHi && b.practical >= thrHi) {
    practical = bigP
      ? `${conjAnd(n1, n2)} 모두 생활 안정 지향성이 높아 큰 틀의 운영 방식은 비슷하지만, 점수 차(${st.practical.gap}점)만큼 책임을 표현하는 방식·우선순위는 어긋날 수 있습니다.`
      : `두 사람 모두 생활 안정 지향성이 높아 운영 방식은 비슷한 편입니다. 다만 누가 먼저 말로 정리하느냐 같은 표현 방식 차이는 여전히 있을 수 있습니다.`;
  } else if (a.practical <= thrLo && b.practical <= thrLo) {
    practical =
      "둘 다 현실 축에서 조건·역할을 먼저 다져야 하는 편이라, 합의와 규칙을 함께 세우는 것이 관계 유지에 직결됩니다.";
  } else if (bigP && st.practical.higher !== "tie") {
    const hi = higherName(st.practical.higher)!;
    const lo = st.practical.higher === "person1" ? n2 : n1;
    practical = `${hi}${ptcl(hi, "은", "는")} 현실·책임 축이 더 뚜렷하고 ${lo}${ptcl(lo, "은", "는")} 상대적으로 변동·조율 여지가 커 보여, 생활 속도와 역할 기대를 맞추는 대화가 필요할 수 있습니다.`;
  } else {
    practical =
      "현실 구조는 완전히 반대는 아니나, 세부 기대치는 말로 한 번씩 확인할수록 부담이 줄어듭니다.";
  }

  // ── 정서 궁합: 교차 ──
  let emotional: string;
  const splitHiLo =
    (a.emotional >= thrHi && b.emotional <= thrLo) || (b.emotional >= thrHi && a.emotional <= thrLo);
  if (bigE && splitHiLo) {
    const hi = a.emotional >= b.emotional ? n1 : n2;
    const lo = a.emotional >= b.emotional ? n2 : n1;
    emotional = `${hi}${ptcl(hi, "은", "는")} 감정 기대치가 상대적으로 높게 읽히고 ${lo}${ptcl(lo, "은", "는")} 억제·점잖음 쪽에 가깝게 읽혀, 서운함이 누적되기 쉬운 교차입니다. 짧은 주기로 감정을 이름 붙여 말하는 연습이 도움이 됩니다.`;
  } else if (a.emotional >= thrHi && b.emotional >= thrHi) {
    emotional =
      "정서 구조는 두 사람 모두 관계 안정·소통 여지가 넓은 편으로, 감정 리듬을 맞추기 비교적 수월할 수 있습니다.";
  } else if (a.emotional <= thrLo && b.emotional <= thrLo) {
    emotional =
      "둘 다 정서 축에서 일지 긴장·부담 신호가 함께 읽히는 편이라, 오해를 줄이려면 감정만이 아니라 사실·요청도 분리해서 말하는 것이 좋습니다.";
  } else if (bigE) {
    emotional = `정서 점수 차가 ${st.emotional.gap}점으로 벌어져 있어, 한쪽이 ‘이미 충분히 했다’고 느낄 때 다른 쪽은 ‘부족하다’고 느끼기 쉽습니다. 기대치를 숫자나 상황 예시로 맞춰 보세요.`;
  } else {
    emotional =
      "정서 구조는 중간대에서 겹치는 부분이 있으나, 속도·기대치는 상황에 따라 조율하면 관계 만족도가 따라옵니다.";
  }

  // ── 매력 궁합: 교차 ──
  let image: string;
  if (bigI) {
    image =
      "서로 끌림을 느끼는 방식이 달라, 초반 설렘과 익숙해진 뒤의 온도차를 의심해 보는 것이 좋습니다. 취향·스킨십·칭찬 표현을 구체적으로 물어보면 간극이 줄어듭니다.";
  } else if (a.image >= thrHi && b.image >= thrHi) {
    image =
      "둘 다 매력·인상 신호가 살아 있는 편이라, 시간이 지나며 익숙함 속에서도 분위기를 다시 맞출 여지가 있습니다.";
  } else if (st.image.average <= thrLo) {
    image =
      "매력 축은 둘 다 한풀 꺾인 편으로 읽힐 수 있어, 관계가 식은 것이 아니라 표현이 잠시 얇아진 것인지 구분해 보는 것이 좋습니다.";
  } else {
    image =
      "끌림 방식이 완전히 같지는 않아도, 표현 방식만 조정하면 인상·호감 체감 차이를 줄이기 쉬운 구간입니다.";
  }

  const crossSentences: SpouseAxisComparisonSentences = { practical, emotional, image };

  // ── 유지 vs 만족 (부모 사례 등: 오래 가는 것 ≠ 마음이 차는 것) ──
  const prAvg = st.practical.average;
  const emAvg = st.emotional.average;
  const imAvg = st.image.average;

  let maintenanceLine: string;
  if (prAvg >= thrHi && st.practical.gap <= 14) {
    maintenanceLine =
      "생활·역할·약속을 굴리는 ‘유지 구조’는 두 사람 모두 비교적 받쳐지는 편으로 읽힙니다. 다툼이 적어도 역할 불만이 쌓일 수는 있으니 역할 점검은 따로 하는 것이 안전합니다.";
  } else if (prAvg <= thrLo) {
    maintenanceLine =
      "현실 축이 둘 다 낮게 잡혀 ‘같이 살아가기’의 조건·규칙을 먼저 합의하지 않으면 유지 자체가 버거워질 수 있는 교차입니다.";
  } else {
    maintenanceLine =
      "유지 구조는 한쪽이 더 끌고 가거나 역할이 기울어질 수 있어, 고정 루틴과 비상 시나리오를 짧게라도 맞춰 두는 것이 좋습니다.";
  }

  let satisfactionLine: string;
  if (emAvg >= thrHi && bigE) {
    satisfactionLine =
      "정서 기대치 차이가 커 ‘만족 구조’만 보면 한쪽은 충분히 했다고 느낄 때 다른 쪽은 허전함을 느끼기 쉽습니다. 관계가 유지되는 것과 정서적으로 잘 맞는 것은 별개일 수 있습니다.";
  } else if (emAvg >= thrHi && !bigE) {
    satisfactionLine =
      "정서·소통 쪽 ‘만족 구조’는 둘 다 여유가 있어 보이는 편입니다. 다만 일상 스트레스가 몰리면 이 여유가 먼저 깎일 수 있으니 방어적으로 쉬는 시간을 남겨 두면 좋습니다.";
  } else if (emAvg <= thrLo) {
    satisfactionLine =
      "만족 구조(정서·끌림 체감)는 둘 다 보수적으로 읽히는 편이라, 사랑의 언어가 달라도 ‘의도는 같다’는 신호를 자주 확인해 주는 것이 중요합니다.";
  } else {
    satisfactionLine =
      "만족 구조는 중간대에서 서로 다른 방식으로 애정을 표현할 가능성이 큽니다. 말·행동·선물 중 무엇이 와닿는지 주기적으로 확인하면 체감 격차가 줄어듭니다.";
  }

  if (imAvg >= thrHi && bigI) {
    satisfactionLine +=
      " 매력·끌림은 ‘같이 높다’와 ‘같이 느낀다’가 다를 수 있어, 인상 형성 방식 차이를 전제로 두는 편이 덜 실망스럽습니다.";
  }

  // ── 종합 한 문단 ──
  let holisticSummary: string;
  const prOk = prAvg >= 58 && st.practical.gap <= 18;
  const emTense = emAvg < 52 || bigE;
  const emOk = emAvg >= 58 && !bigE;

  if (prOk && emTense) {
    holisticSummary = `지금 교차로 보면 두 사람은 현실 운영 감각은 비슷한 편에 가깝지만, 정서 표현 방식 차이로 관계 만족도에는 간극이 생기기 쉬운 구조로 읽힙니다. 즉, 관계가 유지되는 것과 정서적으로 잘 맞는 것은 별개일 수 있으니, 역할은 잘 돌아가도 ‘마음이 비는’ 느낌이 든다면 정서 축을 따로 점검하는 것이 좋습니다.`;
  } else if (!prOk && emOk) {
    holisticSummary = `정서·소통 쪽은 서로 맞추기 쉬운 편으로 읽히나, 생활·조건·책임 축에서 기대가 엇갈리면 일상 피로가 정서를 잠식하기 쉽습니다. 감정은 좋은데 살림이 힘들다는 식의 불균형에 주의하세요.`;
  } else if (prOk && emOk) {
    holisticSummary = `현실·정서 모두 중간 이상에서 크게 벌어지지 않는 편으로, 유지와 만족을 함께 다지기 좋은 교차에 가깝습니다. 그래도 습관화되면 표현이 얇아질 수 있으니 분기마다 한 번은 관계 점검을 권합니다.`;
  } else {
    holisticSummary = `세 축 가운데 특히 낮게 느껴지는 축이 있으면, 그 축부터 짧은 실험(규칙 하나, 대화 포맷 하나)으로 맞추는 것이 전체 체감을 끌어올리기 쉽습니다. 한 번에 세 축을 다 잡으려 하기보다 순서를 정하는 것이 부담이 적습니다.`;
  }

  return {
    person1: a,
    person2: b,
    stats: st,
    crossSentences,
    maintenanceLine,
    satisfactionLine,
    holisticSummary,
    sentences: crossSentences,
  };
}

/** @deprecated buildSpouseStructureAxisComparisonBlock 사용 권장 */
export function buildSpouseAxisComparisonNarrative(
  a: SpouseStructureAxisBundle,
  b: SpouseStructureAxisBundle,
): SpouseAxisComparisonSentences {
  return buildSpouseStructureAxisComparisonBlock(a, b, "", "").crossSentences;
}

// ═══════════════════════════════════════════════════════════════════════
//  1. 일간 관계 delta  (−12 ~ +15)
// ═══════════════════════════════════════════════════════════════════════
function scoreDayMasterDelta(s1: string, s2: string): { delta: number; note: string } {
  if (!s1 || !s2) return { delta: 0, note: "일간 정보 없음" };
  const e1 = STEM_ELEMENT[s1];
  const e2 = STEM_ELEMENT[s2];
  if (!e1 || !e2) return { delta: 0, note: "오행 미상" };

  if (GENERATING.some(([a, b]) => a === e1 && b === e2))
    return { delta: +15, note: `${s1}(${e1}) → ${s2}(${e2}) 상생` };
  if (GENERATING.some(([a, b]) => a === e2 && b === e1))
    return { delta: +12, note: `${s2}(${e2}) → ${s1}(${e1}) 상생 (피생)` };
  if (e1 === e2)
    return { delta: +8, note: `${s1}·${s2} 동일 오행 (비화)` };
  if (CONTROLLING.some(([a, b]) => a === e1 && b === e2))
    return { delta: -10, note: `${s1}(${e1}) → ${s2}(${e2}) 상극` };
  if (CONTROLLING.some(([a, b]) => a === e2 && b === e1))
    return { delta: -12, note: `${s2}(${e2}) → ${s1}(${e1}) 상극 (피극)` };

  return { delta: +4, note: `${s1}·${s2} 간접 관계` };
}

// ═══════════════════════════════════════════════════════════════════════
//  2. 배우자궁(일지) delta  (−18 ~ +18)
// ═══════════════════════════════════════════════════════════════════════
function scoreSpousePalaceDelta(b1: string, b2: string): { delta: number; note: string; spousePalaceClash: boolean; spousePalaceTensions: string[] } {
  if (!b1 || !b2) return { delta: 0, note: "일지 정보 없음", spousePalaceClash: false, spousePalaceTensions: [] };
  const rels = getBranchRels(b1, b2);
  const tensions: string[] = rels.filter(r => ["형","해","원진"].includes(r));
  const hasClash = rels.includes("충");

  if (rels.includes("합"))
    return { delta: +18, note: `${b1}·${b2} 지지합`, spousePalaceClash: false, spousePalaceTensions: tensions };
  if (rels.includes("반합"))
    return { delta: +12, note: `${b1}·${b2} 반합`, spousePalaceClash: false, spousePalaceTensions: tensions };
  if (hasClash)
    return { delta: -18, note: `${b1}·${b2} 충`, spousePalaceClash: true, spousePalaceTensions: tensions };
  if (rels.includes("원진"))
    return { delta: -9, note: `${b1}·${b2} 원진`, spousePalaceClash: false, spousePalaceTensions: tensions };
  if (rels.includes("형"))
    return { delta: -8, note: `${b1}·${b2} 형`, spousePalaceClash: false, spousePalaceTensions: tensions };
  if (rels.includes("해"))
    return { delta: -7, note: `${b1}·${b2} 해`, spousePalaceClash: false, spousePalaceTensions: tensions };
  if (rels.includes("파"))
    return { delta: -6, note: `${b1}·${b2} 파`, spousePalaceClash: false, spousePalaceTensions: tensions };

  return { delta: +6, note: `${b1}·${b2} 무관`, spousePalaceClash: false, spousePalaceTensions: [] };
}

// ═══════════════════════════════════════════════════════════════════════
//  3. 월지 교차 delta  (−12 ~ +12)
// ═══════════════════════════════════════════════════════════════════════
function scoreMonthBranchDelta(m1: string, m2: string): { delta: number; note: string; monthClash: boolean } {
  if (!m1 || !m2) return { delta: 0, note: "월지 정보 없음", monthClash: false };
  const rels = getBranchRels(m1, m2);

  if (rels.includes("합"))   return { delta: +12, note: `월지 ${m1}·${m2} 합`, monthClash: false };
  if (rels.includes("반합")) return { delta: +8,  note: `월지 ${m1}·${m2} 반합`, monthClash: false };
  if (rels.includes("충"))   return { delta: -12, note: `월지 ${m1}·${m2} 충`, monthClash: true };
  if (rels.some(r => ["형","해","원진"].includes(r)))
    return { delta: -6, note: `월지 ${m1}·${m2} ${rels.filter(r => ["형","해","원진"].includes(r)).join("·")}`, monthClash: false };
  if (rels.includes("파"))   return { delta: -4, note: `월지 ${m1}·${m2} 파`, monthClash: false };

  return { delta: +4, note: `월지 ${m1}·${m2} 무관`, monthClash: false };
}

// ═══════════════════════════════════════════════════════════════════════
//  4. 지지 전체 교차 delta  (−15 ~ +15 cap)
// ═══════════════════════════════════════════════════════════════════════
function scoreBranchInteractionDelta(
  br1: string[], br2: string[],
): { delta: number; note: string; clashCount: number } {
  let raw = 0;
  let clashCount = 0;
  const seen = new Set<string>();

  for (const a of br1) {
    for (const b of br2) {
      const key = [a, b].sort().join(",");
      if (seen.has(key)) continue;
      const rels = getBranchRels(a, b);
      const newRels = rels.filter(r => {
        const rk = `${r}|${key}`;
        if (seen.has(rk)) return false;
        seen.add(rk);
        return true;
      });
      for (const r of newRels) {
        if (r === "합")   raw += 4;
        if (r === "반합") raw += 5;
        if (r === "충")   { raw -= 5; clashCount++; }
        if (r === "형")   raw -= 4;
        if (r === "파")   raw -= 3;
        if (r === "해")   raw -= 3;
        if (r === "원진") raw -= 4;
      }
    }
  }

  const delta = Math.max(-15, Math.min(15, raw));
  const note = raw !== 0
    ? `지지 교차: 총 ${raw > 0 ? "+" : ""}${raw}점 (충 ${clashCount}회, 캡 ±15)`
    : "지지 교차 관계 없음";
  return { delta, note, clashCount };
}

// ═══════════════════════════════════════════════════════════════════════
//  5. 오행 보완도 delta  (−8 ~ +12)
// ═══════════════════════════════════════════════════════════════════════
function scoreElementComplementarityDelta(el1: FiveElementCount, el2: FiveElementCount): { delta: number; note: string } {
  const all: Array<keyof FiveElementCount> = ["목", "화", "토", "금", "수"];
  const total1 = all.reduce((s, e) => s + el1[e], 0) || 1;
  const total2 = all.reduce((s, e) => s + el2[e], 0) || 1;
  const r1: Record<string, number> = {};
  const r2: Record<string, number> = {};
  for (const e of all) { r1[e] = el1[e] / total1; r2[e] = el2[e] / total2; }

  let raw = 0;
  for (const e of all) {
    if (r1[e] <= 0.10 && r2[e] >= 0.25) raw += 4;  // partner fills my deficiency
    if (r2[e] <= 0.10 && r1[e] >= 0.25) raw += 3;  // I fill partner's deficiency
    if (r1[e] <= 0.05 && r2[e] <= 0.05) raw -= 3;  // both deficient
    if (r1[e] >= 0.35 && r2[e] >= 0.35) raw -= 2;  // both over-amplify
  }

  const delta = Math.max(-8, Math.min(12, raw));
  const note = delta >= 4 ? "오행 상호 보완 구조 양호"
    : delta <= -4 ? "오행 공동 결핍 또는 과잉"
    : "오행 보완 보통";
  return { delta, note };
}

// ═══════════════════════════════════════════════════════════════════════
//  6. 십성 궁합 delta  (−8 ~ +12)
// ═══════════════════════════════════════════════════════════════════════
function scoreTenGodDelta(s1: string, s2: string): { delta: number; note: string } {
  if (!s1 || !s2) return { delta: 0, note: "일간 정보 없음" };
  const tg12 = getTenGod(s1, s2);
  const tg21 = getTenGod(s2, s1);

  const MAP: Record<string, number> = {
    정재: 12, 정인: 12, 식신: 10,
    정관: 8,  편재: 8,  편인: 6,
    비견: 2,  상관: -4, 편관: -6, 겁재: -8,
  };

  const s12 = tg12 ? (MAP[tg12] ?? 2) : 0;
  const s21 = tg21 ? (MAP[tg21] ?? 2) : 0;
  const raw = Math.round((s12 + s21) / 2);
  const delta = Math.max(-8, Math.min(12, raw));
  const note = tg12 && tg21 ? `${tg12} ↔ ${tg21}` : tg12 ? tg12 : "십성 관계 없음";
  return { delta, note };
}

// ═══════════════════════════════════════════════════════════════════════
//  7. 용신 보완 delta  (−5 ~ +10)
// ═══════════════════════════════════════════════════════════════════════
function scoreYongshinDelta(
  yData1: { type: string; elements: string[] }[] | undefined,
  el2: FiveElementCount,
  yData2: { type: string; elements: string[] }[] | undefined,
  el1: FiveElementCount,
): { delta: number; note: string } {
  const elToKey = (e: string): keyof FiveElementCount | null => {
    const MAP: Record<string, keyof FiveElementCount> = {
      목: "목", 화: "화", 토: "토", 금: "금", 수: "수",
    };
    return MAP[e] ?? null;
  };

  const evalYong = (data: { type: string; elements: string[] }[] | undefined, partner: FiveElementCount): number => {
    if (!data || data.length === 0) return 0;
    let val = 0;
    for (const { type, elements } of data) {
      for (const el of elements) {
        const k = elToKey(el);
        if (!k || partner[k] === undefined) continue;
        const partnerHas = partner[k] > 0;
        if (type === "용신" && partnerHas)  val += 10;
        if (type === "희신" && partnerHas)  val += 6;
        if (type === "기신" && partnerHas)  val -= 5;
      }
    }
    return val;
  };

  const v1 = evalYong(yData1, el2);
  const v2 = evalYong(yData2, el1);
  const raw = v1 !== 0 || v2 !== 0 ? Math.round((v1 + v2) / 2) : 0;
  const delta = Math.max(-5, Math.min(10, raw));

  const note = delta > 5 ? "상대가 내 용신/희신을 지지"
    : delta < -2 ? "상대가 내 기신을 강화"
    : yData1 || yData2 ? "용신 보완 보통"
    : "용신 정보 없음";
  return { delta, note };
}

function yongshinCompatRowsFromPipeline(pipe: SajuPipelineResult): { type: string; elements: string[] }[] {
  const primary = pipe.adjusted.effectiveYongshin as FiveElKey;
  const secondary = pipe.adjusted.effectiveYongshinSecondary as FiveElKey | undefined;
  const gisin = getController(primary);
  const rows: { type: string; elements: string[] }[] = [{ type: "용신", elements: [primary] }];
  if (secondary) rows.push({ type: "희신", elements: [secondary] });
  if (gisin) rows.push({ type: "기신", elements: [gisin] });
  return rows;
}

function mergeYongshinCompatInput(
  manual: PersonRecord["manualYongshinData"],
  pipe: SajuPipelineResult | null,
): { type: string; elements: string[] }[] | undefined {
  if (manual && manual.length > 0) return manual;
  if (pipe) return yongshinCompatRowsFromPipeline(pipe);
  return undefined;
}

function buildStructureCompatDetails(
  pipe1: SajuPipelineResult,
  pipe2: SajuPipelineResult,
  n1: string,
  n2: string,
): CompatibilityResult["details"] {
  const g1 = pipe1.interpretation.gukguk?.name ?? "격국 미확정";
  const g2 = pipe2.interpretation.gukguk?.name ?? "격국 미확정";
  const o1 = pipe1.evaluations.officerActivation;
  const o2 = pipe2.evaluations.officerActivation;
  const s1 = pipe1.evaluations.spousePalaceStability;
  const s2 = pipe2.evaluations.spousePalaceStability;
  const w1 = pipe1.evaluations.wealthActivation;
  const w2 = pipe2.evaluations.wealthActivation;
  const t1 = pipe1.timingActivation;
  const t2 = pipe2.timingActivation;
  return [
    { title: "구조 격국(파이프라인)", description: `${n1}: ${g1} · ${n2}: ${g2}`, isPositive: true },
    {
      title: "관성 작동(원국)",
      description: `${n1} ${o1.score}점(${o1.grade}) vs ${n2} ${o2.score}점(${o2.grade})`,
      isPositive: (o1.score + o2.score) / 2 >= 45,
    },
    {
      title: "배우자궁 안정(원국)",
      description: `${n1} ${s1.score}점(${s1.grade}) vs ${n2} ${s2.score}점(${s2.grade})`,
      isPositive: (s1.score + s2.score) / 2 >= 45,
    },
    {
      title: "재성 작동(원국)",
      description: `${n1} ${w1.score}점(${w1.grade}) vs ${n2} ${w2.score}점(${w2.grade})`,
      isPositive: (w1.score + w2.score) / 2 >= 45,
    },
    {
      title: "올해 운 가중(타이밍)",
      description:
        `${n1}: 관${t1.officerActivationTrend}·재${t1.wealthActivationTrend}·궁${t1.spouseActivationTrend} / ` +
        `${n2}: 관${t2.officerActivationTrend}·재${t2.wealthActivationTrend}·궁${t2.spouseActivationTrend}`,
      isPositive: true,
    },
  ];
}

// ═══════════════════════════════════════════════════════════════════════
//  구조적 등급 조정 (tier shift)
// ═══════════════════════════════════════════════════════════════════════
interface StructuralFlags {
  dayMasterSupportive: boolean;
  spousePalaceClash: boolean;
  spousePalaceMultiTension: boolean;
  branchClashCount: number;
  monthBranchClash: boolean;
}

function computeStructuralSteps(
  flags: StructuralFlags,
  spouseDelta: number,
): { steps: StructuralTierStep[]; netDelta: number } {
  const steps: StructuralTierStep[] = [];
  let net = 0;

  // +1 up: dayMasterSupportive + spouse palace is not negative
  if (flags.dayMasterSupportive && spouseDelta >= 0) {
    steps.push({ label: "일간상생 + 배우자궁 비충", direction: "up" });
    net += 1;
  }
  // −1: spouse palace clash
  if (flags.spousePalaceClash) {
    steps.push({ label: "배우자궁 충", direction: "down" });
    net -= 1;
  }
  // −1: spouse palace has multiple tension relations (원진/해/형 ≥2)
  if (flags.spousePalaceMultiTension) {
    steps.push({ label: "배우자궁 복합 긴장(원진·해·형 중복)", direction: "down" });
    net -= 1;
  }
  // −1: 2+ cross branch clashes
  if (flags.branchClashCount >= 2) {
    steps.push({ label: `지지 충 ${flags.branchClashCount}회`, direction: "down" });
    net -= 1;
  }
  // −1: month branch clash
  if (flags.monthBranchClash) {
    steps.push({ label: "월지 충", direction: "down" });
    net -= 1;
  }

  return { steps, netDelta: Math.max(-2, Math.min(2, net)) };
}

// ── 도메인 점수 (보조 지표) ────────────────────────────────────────────

function buildDomains(
  e1: FiveElementCount, e2: FiveElementCount,
  s1: string, s2: string,
): CompatibilityResult["domains"] {
  const clamp = (v: number) => Math.max(20, Math.min(95, Math.round(v)));
  const avg = (a: number, b: number) => (a + b) / 2;
  return {
    emotionalConnection: clamp(45 + avg(e1["화"], e2["화"]) * 10 + avg(e1["수"], e2["수"]) * 8),
    communication:       clamp(45 + avg(e1["목"], e2["목"]) * 12 + (STEM_YIN_YANG[s1] !== STEM_YIN_YANG[s2] ? 8 : 0)),
    values:              clamp(45 + avg(e1["토"], e2["토"]) * 10 + avg(e1["금"], e2["금"]) * 5),
    problemSolving:      clamp(45 + avg(e1["금"], e2["금"]) * 12 + avg(e1["토"], e2["토"]) * 6),
  };
}

// ── 내러티브 ─────────────────────────────────────────────────────────

function buildNarrative(
  totalScore: number,
  s1: string, s2: string,
  finalType: CompatibilityTone,
  name1: string, name2: string,
  hasHarmony: boolean,
  hasConflict: boolean,
): { summary: string; strengths: string[]; cautions: string[]; advice: string[]; longTermOutlook: string } {
  const e1 = STEM_ELEMENT[s1];
  const e2 = STEM_ELEMENT[s2];
  const gen12 = GENERATING.some(([a, b]) => a === e1 && b === e2);
  const gen21 = GENERATING.some(([a, b]) => a === e2 && b === e1);
  const sameEl = e1 === e2;
  const yinYangMatch = STEM_YIN_YANG[s1] !== STEM_YIN_YANG[s2];
  const tg = getTenGod(s1, s2) ?? "";

  const summaryMap: Record<CompatibilityTone, string> = {
    "이상적 궁합": `${name1}님과 ${name2}님은 서로의 에너지가 자연스럽게 흐르는 이상적인 구조입니다.`,
    "좋은 궁합":   `두 분의 기운이 큰 마찰 없이 잘 어우러지는 좋은 궁합입니다.`,
    "노력형 궁합": `두 구조 사이에는 긴장과 조화가 공존합니다. 이해와 노력으로 좋은 관계를 만들 수 있습니다.`,
    "긴장형 궁합": `에너지 방향의 차이가 있어 충분한 소통과 조율이 필요한 구조입니다.`,
    "주의 궁합":   `기운의 충돌이 강해 서로 이해하고 맞춰나가는 데 상당한 노력이 요구됩니다.`,
  };

  const strengths: string[] = [];
  if (gen12) strengths.push(`${name1}님(${e1})이 ${name2}님(${e2})의 기운을 상생합니다`);
  if (gen21) strengths.push(`${name2}님(${e2})이 ${name1}님(${e1})을 키워주는 상생 에너지가 있습니다`);
  if (yinYangMatch) strengths.push("음양이 상반되어 서로를 끌어당기는 자연스러운 인력이 있습니다");
  if (hasHarmony) strengths.push("지지 합 구조 — 실제 생활 리듬에서 친밀감이 형성되기 쉽습니다");
  if (sameEl && totalScore >= 55) strengths.push("같은 오행 기운으로 서로의 가치관을 공감하기 쉽습니다");
  if (["정인", "정재", "식신"].includes(tg)) strengths.push(`${name2}님이 ${name1}님에게 ${tg}로 작용 — 심리적 안정과 신뢰 기반`);
  if (strengths.length === 0) strengths.push("서로의 차이가 새로운 시각과 자극이 될 수 있습니다");

  const cautions: string[] = [];
  if (hasConflict) cautions.push("지지 충 구조 — 생활 방식 차이로 반복적 마찰이 생길 수 있습니다");
  if (!yinYangMatch && totalScore < 65) cautions.push("같은 음양 구조로 경쟁하거나 독립성을 강조하는 경향이 있습니다");
  if (sameEl && totalScore < 55) cautions.push("같은 오행이 겹쳐 주도권 충돌로 이어질 수 있습니다");
  if (["편관", "겁재", "상관"].includes(tg)) cautions.push(`${name2}님이 ${name1}님에게 ${tg}로 작용 — 자극과 압박`);
  if (cautions.length === 0 && totalScore >= 65) cautions.push("구조적 위험 요소는 적지만 의식적인 소통이 항상 필요합니다");
  if (cautions.length === 0) cautions.push("구조적 약점을 파악하고 미리 패턴을 인식하는 것이 중요합니다");

  const advice: string[] = [
    totalScore >= 65
      ? "상대의 일간 에너지를 이해하면 불필요한 오해를 줄일 수 있습니다"
      : "충돌 상황에서 '틀린 것'이 아니라 '다른 것'임을 인식하는 것이 첫 번째 조율점입니다",
    hasConflict
      ? "감정 충돌 직후 즉시 결론 내리기보다 24시간 후 대화하면 효과적입니다"
      : "두 사람의 에너지가 활성화되는 시간대를 활용한 대화를 시도해보세요",
    hasHarmony
      ? "자연스럽게 맞는 영역에서 공통 활동을 늘려 긍정 자원을 쌓아두세요"
      : "서로의 강점을 인식하고, 약점은 보완하는 역할 분담을 해보세요",
  ];

  const outlookMap: Record<CompatibilityTone, string> = {
    "이상적 궁합":  "장기적으로 안정적인 발전 가능성이 높습니다. 서로에 대한 이해가 쌓일수록 관계의 질이 높아집니다.",
    "좋은 궁합":    "상호 보완의 잠재력이 있습니다. 초반의 어색함이 해소되면 안정적인 관계로 발전할 수 있습니다.",
    "노력형 궁합":  "지속적인 노력과 상호 이해를 통해 관계를 발전시킬 수 있습니다.",
    "긴장형 궁합":  "관계 유지에 상당한 에너지가 소모될 수 있습니다. 각자의 독립성을 존중하는 것이 도움이 됩니다.",
    "주의 궁합":    "구조적 긴장이 강하지만, 이런 관계가 오히려 서로를 변화시키는 촉매가 될 수도 있습니다.",
  };

  return {
    summary: summaryMap[finalType],
    strengths: strengths.slice(0, 3),
    cautions: cautions.slice(0, 3),
    advice,
    longTermOutlook: outlookMap[finalType],
  };
}

function buildKeywords(
  score: number, s1: string, s2: string,
  hasHarmony: boolean, hasConflict: boolean, clashCount: number,
): string[] {
  const e1 = STEM_ELEMENT[s1];
  const e2 = STEM_ELEMENT[s2];
  const kw: string[] = [];
  if (hasHarmony) kw.push("조화 구조");
  if (hasConflict) kw.push("충돌 요소");
  if (clashCount >= 2) kw.push(`충 ${clashCount}회`);
  if (e1 !== e2) kw.push("오행 보완");
  if (STEM_YIN_YANG[s1] !== STEM_YIN_YANG[s2]) kw.push("음양 조화");
  if (score >= 65 && !hasConflict) kw.push("안정 기반");
  if (score < 50) kw.push("노력 필요");
  return kw.slice(0, 3);
}

// ── Main export ──────────────────────────────────────────────────────────

export function calculateCompatibilityScore(
  person1: PersonRecord,
  person2: PersonRecord,
): CompatibilityResult {
  const p1 = getFinalPillars(person1);
  const p2 = getFinalPillars(person2);

  const s1 = p1.day?.hangul?.[0] ?? "";
  const s2 = p2.day?.hangul?.[0] ?? "";
  const b1 = p1.day?.hangul?.[1] ?? "";
  const b2 = p2.day?.hangul?.[1] ?? "";
  const m1 = p1.month?.hangul?.[1] ?? "";
  const m2 = p2.month?.hangul?.[1] ?? "";

  const allBranches = (pillars: ReturnType<typeof getFinalPillars>): string[] =>
    [pillars.year, pillars.month, pillars.day, pillars.hour]
      .filter(Boolean)
      .map((p) => p!.hangul[1])
      .filter(Boolean);

  const br1 = allBranches(p1);
  const br2 = allBranches(p2);

  const elemsFromPillars = (pillars: ReturnType<typeof getFinalPillars>): FiveElementCount => {
    const c: FiveElementCount = { 목: 0, 화: 0, 토: 0, 금: 0, 수: 0 };
    [pillars.year, pillars.month, pillars.day, pillars.hour].filter(Boolean).forEach((p) => {
      p!.hangul.split("").forEach((ch) => {
        const e = STEM_ELEMENT[ch] ?? BRANCH_ELEMENT[ch];
        if (e) c[e]++;
      });
    });
    return c;
  };

  const el1 = elemsFromPillars(p1);
  const el2 = elemsFromPillars(p2);

  const pipe1 = computePersonPipelineSnapshot(person1);
  const pipe2 = computePersonPipelineSnapshot(person2);

  // ── Compute 7 adjustment deltas ──
  const dm   = scoreDayMasterDelta(s1, s2);
  const sp   = scoreSpousePalaceDelta(b1, b2);
  const mb   = scoreMonthBranchDelta(m1, m2);
  const bi   = scoreBranchInteractionDelta(br1, br2);
  const ec   = scoreElementComplementarityDelta(el1, el2);
  const tg   = scoreTenGodDelta(s1, s2);
  const yong = scoreYongshinDelta(
    mergeYongshinCompatInput(person1.manualYongshinData, pipe1), el2,
    mergeYongshinCompatInput(person2.manualYongshinData, pipe2), el1,
  );

  const adjustmentSteps: AdjustmentStep[] = [
    { category: "일간 관계",      delta: dm.delta,   note: dm.note },
    { category: "배우자궁(일지)", delta: sp.delta,   note: sp.note },
    { category: "월지 교차",      delta: mb.delta,   note: mb.note },
    { category: "지지 전체 교차", delta: bi.delta,   note: bi.note },
    { category: "오행 보완도",    delta: ec.delta,   note: ec.note },
    { category: "십성 궁합",      delta: tg.delta,   note: tg.note },
    { category: "용신 보완",      delta: yong.delta, note: yong.note },
  ];

  const totalDelta = adjustmentSteps.reduce((acc, s) => acc + s.delta, 0);
  const baseScore = Math.max(0, Math.min(100, 50 + totalDelta));

  // ── Structural flags ──
  const flags: StructuralFlags = {
    dayMasterSupportive: dm.delta > 0,
    spousePalaceClash: sp.spousePalaceClash,
    spousePalaceMultiTension: sp.spousePalaceTensions.length >= 2,
    branchClashCount: bi.clashCount,
    monthBranchClash: mb.monthClash,
  };

  const baseType = gradeFromScore(baseScore);
  const { steps: structuralSteps, netDelta } = computeStructuralSteps(flags, sp.delta);
  const finalType = shiftTier(baseType, netDelta);
  const finalColor = COMPAT_TONE_COLOR[finalType];

  // ── Narrative / keywords ──
  const allRels = computeBranchRelations(br1, br2);
  const hasHarmonyStructure = allRels.some((r) => r.type === "지지육합" || r.type === "지지삼합" || r.type === "지지방합")
    || GENERATING.some(([a, t]) => a === STEM_ELEMENT[s1] && t === STEM_ELEMENT[s2])
    || GENERATING.some(([a, t]) => a === STEM_ELEMENT[s2] && t === STEM_ELEMENT[s1]);
  const hasConflictStructure = bi.clashCount > 0;

  const narrative = buildNarrative(
    baseScore, s1, s2, finalType,
    person1.birthInput.name, person2.birthInput.name,
    hasHarmonyStructure, hasConflictStructure,
  );
  const keywords = buildKeywords(baseScore, s1, s2, hasHarmonyStructure, hasConflictStructure, bi.clashCount);
  const domains = buildDomains(el1, el2, s1, s2);

  const details: CompatibilityResult["details"] = [
    { title: "일간 분석",  description: dm.note,   isPositive: dm.delta >= 0 },
    { title: "배우자궁",   description: sp.note,   isPositive: sp.delta >= 0 },
    { title: "월지 교차",  description: mb.note,   isPositive: mb.delta >= 0 },
    { title: "지지 교차",  description: bi.note,   isPositive: bi.delta >= 0 },
    { title: "오행 보완",  description: ec.note,   isPositive: ec.delta >= 0 },
    { title: "십성 관계",  description: tg.note,   isPositive: tg.delta >= 0 },
    { title: "용신 보완",  description: yong.note, isPositive: yong.delta >= 0 },
    ...(pipe1 && pipe2 ? buildStructureCompatDetails(pipe1, pipe2, person1.birthInput.name, person2.birthInput.name) : []),
  ];

  const axis1 = computeSpouseStructureAxisBundleFromPersonRecord(person1);
  const axis2 = computeSpouseStructureAxisBundleFromPersonRecord(person2);
  const spouseStructureAxisComparison =
    axis1 && axis2
      ? buildSpouseStructureAxisComparisonBlock(
          axis1,
          axis2,
          person1.birthInput.name,
          person2.birthInput.name,
        )
      : null;

  return {
    baseScore,
    adjustmentSteps,
    baseType,
    structuralSteps,
    finalType,
    finalColor,
    // backward compat
    totalScore: baseScore,
    score: baseScore,
    grade: finalType,
    clashCount: bi.clashCount,
    keywords,
    ...narrative,
    domains,
    details,
    elementBalance: { person1: el1, person2: el2 },
    subscores: {
      dayMaster:              dm.delta,
      spousePalace:           sp.delta,
      branchInteraction:      bi.delta,
      elementComplementarity: ec.delta,
      tenGodRelation:         tg.delta,
      monthBranch:            mb.delta,
      yongshin:               yong.delta,
    },
    spouseStructureAxisComparison,
  };
}

// ── 배우자 3축(단일 원국) — 궁합에서 A/B 각각 산출 후 교차 비교할 때 사용 ──
export {
  computeSpouseStructureAxisBundle,
  computeSpouseStructureAxisBundleFromPersonRecord,
  toSpouseStructureAxisBundle,
} from "./evaluations/spouseStructureAxisBundle";
export type {
  SpouseStructureAxisBundle,
  SpouseStructureAxisScores,
  ComputeSpouseStructureAxisBundleInput,
  ComputeSpouseStructureAxisBundleResult,
} from "./evaluations/spouseStructureAxisBundle";
