// ── 사주 궁합 점수 계산 엔진 ─────────────────────────────────────────────
// 기준점 50 + 7가지 가중 조정 → 0-100 클램프 후 등급 결정
// 구조적 조정(상향/하향)은 등급 티어에만 영향을 미치며 점수 숫자는 변경 없음
//
// 데이터 출처 요약(점검):
// - 메인 7조정: getFinalPillars 기반 일간·일지·월지·지지 교차·오행 보완·십성(일간쌍)·용신.
//   용신·구조 상세 줄만 computePersonPipelineSnapshot(=원국 카드와 동일 스냅샷) 사용.
// - spouseStructureAxisComparison: 스냅샷 evaluations·십성그룹·동일 기둥/신살 입력으로 보조 3축만
//   (메인 점수 미가산). sPal·emotionalLoad·관재/재성 작동은 3축에만 반영되고 7조정에는 직접 미포함.

import type { PersonRecord, RelationshipType } from "./storage";
import { getFinalPillars } from "./storage";
import type { FiveElementCount } from "./sajuEngine";
import { computeBranchRelations, computeStemRelations } from "./branchRelations";
import { getTenGod } from "./tenGods";
import { getController, CONTROLS, type FiveElKey } from "./element-color";
import { computePersonPipelineSnapshot } from "./personPipelineSnapshot";
import type { SajuPipelineResult } from "./sajuPipeline";
import { calculateLuckCycles, type DaewoonSuOpts } from "./luckCycles";
import {
  computeSpouseStructureAxisBundleFromPersonRecord,
  type SpouseStructureAxisBundle,
} from "./evaluations/spouseStructureAxisBundle";
import {
  computeSpouseActivationByYearRange,
  topSpouseActivationYears,
  type SpouseActivationYearEntry,
} from "./evaluations/spouseActivation";

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

export function getBranchRels(b1: string, b2: string): string[] {
  const rels: string[] = [];
  if (pairMatch(b1, b2, SIX_HAP))   rels.push("합");
  if (pairMatch(b1, b2, CHUNG_PAIRS)) rels.push("충");
  if (HYEONG_MAP[b1]?.includes(b2)) rels.push("형");
  if (pairMatch(b1, b2, PA_PAIRS))   rels.push("파");
  if (pairMatch(b1, b2, HAE_PAIRS))  rels.push("해");
  if (pairMatch(b1, b2, WONJIN_PAIRS)) rels.push("원진");
  // 2026-09-03 버그 수정: 반합(半合)은 삼합국 중 서로 다른 두 지지가 만났을 때만 성립한다.
  // b1 !== b2 체크가 없으면 두 사람이 우연히 같은 지지를 하나씩 가진 것(예: 둘 다 해)도
  // "같은 삼합 그룹에 속한다"는 이유만으로 반합으로 잘못 잡혔다.
  const halfTriad = b1 !== b2 && HALF_TRIAD_GROUPS.some(g => g.includes(b1) && g.includes(b2));
  if (halfTriad && !rels.includes("합")) rels.push("반합");
  return rels;
}

/** 지지 b가 속한 삼합/반합 그룹의 인덱스(HALF_TRIAD_GROUPS 기준). 없으면 -1. */
function halfTriadGroupIndexOf(b: string): number {
  return HALF_TRIAD_GROUPS.findIndex((g) => g.includes(b));
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

  /**
   * 두 사람 각각의 결혼·배우자 테마 활성도 연도별 표 + TOP3(개인 사주 화면과 동일 계산 함수 재사용).
   */
  spouseActivationTiming: SpouseActivationTimingBlock | null;

  /**
   * [Legacy — Phase 3 3-모델과 별개로 유지, 삭제/rename 없음] 연애 적합도 / 결혼 적합도 —
   * 원국 기반 두 사람 자체의 구조 적합성(0~100). 기존 7조정 delta를 서로 다른 가중치로
   * 재조합한 값이며, 연도별 timing(활성/조화/안정)과는 완전히 분리된다. 통계적 확률이
   * 아니라 구조적 여건을 나타내는 해석용 지표. Phase 3의 romanceCompatibility/
   * marriageCompatibility는 이것을 대체하는 게 아니라 별도 목적별 모델이다.
   */
  romanceMarriageFit: RomanceMarriageFit;

  /**
   * [Legacy — Phase 2, 개발자/내부 감사용] Core(dm+sp+mb)/Aux(bi+stem+ec+tg+yong) 2계층
   * 산출 breakdown(=현재 baseScore/totalScore의 근거). 사용자 노출용 note/summary와는
   * 분리된 디버그 데이터. Phase 3부터는 이 값 자체를 "관계형 종합 점수"로 계속 쓰되,
   * Human/Romance/Marriage 목적별 breakdown은 아래 3개 필드를 따로 참고한다.
   */
  coreAux: CoreAuxBreakdown;

  /**
   * [Phase 3, 신규] 연애·결혼을 전제하지 않은 "사람 대 사람" 상성. Core=dm40%+mb35%+
   * dayBranchAffinity25%(배우자궁 아님, relType 무관), Aux=bi+stem+ec+yong(tenGod 제외).
   * tier shift 없음(배우자궁 모델이 아니므로). 개발자용 breakdown 포함, 사용자 노출
   * note/summary와는 분리해서 다룬다.
   */
  humanCompatibility: HumanCompatibilityBreakdown;

  /**
   * [Phase 3, 신규] 연애 목적 적합도. Core=dm40%+spousePalace35%+mb25%(dm×sp synergy),
   * Aux=bi+stem+ec+tenGod+yong+spouseStarModifier, spousePalaceMultiTension tier shift
   * 적용. 기존 romanceMarriageFit(legacy)과는 별개의 독립 계산이며 서로 더해지지 않는다.
   */
  romanceCompatibility: RomanceCompatibilityBreakdown;

  /**
   * [Phase 3, 신규] 결혼 목적 적합도. Core=spousePalace42.5%+mb32.5%+dm25%(dm×sp synergy,
   * Phase 2 승계), Aux=bi+stem+ec+tenGod+yong+marriageGroupStructureBonus,
   * spousePalaceMultiTension tier shift 적용. 기존 romanceMarriageFit(legacy)과는 별개의
   * 독립 계산이며 서로 더해지지 않는다.
   */
  marriageCompatibility: MarriageCompatibilityBreakdown;
}

export type RelationshipTypeLabel =
  | "연애·결혼 모두 적합"
  | "연애 우세 · 결혼 조율 필요"
  | "연애는 천천히 · 결혼 적합 우세"
  | "연애·결혼 모두 난이도 높음"
  | "조건부 적합(양쪽 다 무난)";

export interface RomanceMarriageFit {
  romanceScore: number;
  marriageScore: number;
  relationshipType: RelationshipTypeLabel;
  romanceNote: string;
  marriageNote: string;
  /** 결혼 적합도에 반영된 삼합/방합 교차 결속 근거(있을 때만) */
  marriageGroupStructureNotes: string[];
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
export function scoreDayMasterDelta(s1: string, s2: string, relType?: RelationshipType): { delta: number; note: string } {
  if (!s1 || !s2) return { delta: 0, note: "일간 정보 없음" };
  const e1 = STEM_ELEMENT[s1];
  const e2 = STEM_ELEMENT[s2];
  if (!e1 || !e2) return { delta: 0, note: "오행 미상" };

  const isWorkOrFriend = relType === "friend" || relType === "coworker";

  if (GENERATING.some(([a, b]) => a === e1 && b === e2)) {
    const delta = isWorkOrFriend ? +18 : +15;
    return { delta, note: `${s1}(${e1}) → ${s2}(${e2}) 상생` };
  }
  if (GENERATING.some(([a, b]) => a === e2 && b === e1)) {
    const delta = isWorkOrFriend ? +14 : +12;
    return { delta, note: `${s2}(${e2}) → ${s1}(${e1}) 상생 (피생)` };
  }
  if (e1 === e2) {
    const delta = isWorkOrFriend ? +10 : +8;
    return { delta, note: `${s1}·${s2} 동일 오행 (비화)` };
  }
  if (CONTROLLING.some(([a, b]) => a === e1 && b === e2)) {
    const delta = isWorkOrFriend ? -14 : -10;
    return { delta, note: `${s1}(${e1}) → ${s2}(${e2}) 상극` };
  }
  if (CONTROLLING.some(([a, b]) => a === e2 && b === e1)) {
    const delta = isWorkOrFriend ? -16 : -12;
    return { delta, note: `${s2}(${e2}) → ${s1}(${e1}) 상극 (피극)` };
  }

  return { delta: +4, note: `${s1}·${s2} 간접 관계` };
}

// ═══════════════════════════════════════════════════════════════════════
//  2. 배우자궁(일지) delta  (−18 ~ +18)
// ═══════════════════════════════════════════════════════════════════════
export function scoreSpousePalaceDelta(b1: string, b2: string, relType?: RelationshipType): { delta: number; note: string; spousePalaceTensions: string[] } {
  if (!b1 || !b2) return { delta: 0, note: "일지 정보 없음", spousePalaceTensions: [] };
  const rels = getBranchRels(b1, b2);
  const tensions: string[] = rels.filter(r => ["형","해","원진"].includes(r));
  const hasClash = rels.includes("충");

  let rawDelta = 0;
  let noteSuffix = "";

  if (rels.includes("합")) {
    rawDelta = +18;
    noteSuffix = " 지지합";
  } else if (rels.includes("반합")) {
    rawDelta = +12;
    noteSuffix = " 반합";
  } else if (hasClash) {
    rawDelta = -18;
    noteSuffix = " 충";
  } else if (rels.includes("원진")) {
    rawDelta = -9;
    noteSuffix = " 원진";
  } else if (rels.includes("형")) {
    rawDelta = -8;
    noteSuffix = " 형";
  } else if (rels.includes("해")) {
    rawDelta = -7;
    noteSuffix = " 해";
  } else if (rels.includes("파")) {
    rawDelta = -6;
    noteSuffix = " 파";
  } else {
    rawDelta = +6;
    noteSuffix = " 무관";
  }

  let finalDelta = rawDelta;
  if (relType === "friend" || relType === "coworker") {
    finalDelta = Math.round(rawDelta * 0.3);
  } else if (relType === "family") {
    finalDelta = Math.round(rawDelta * 0.5);
  }

  const note = `${b1}·${b2}${noteSuffix}${finalDelta !== rawDelta ? ` (가중치 조정: ${finalDelta > 0 ? "+" : ""}${finalDelta}점)` : ""}`;

  return {
    delta: finalDelta,
    note,
    spousePalaceTensions: tensions
  };
}

// ═══════════════════════════════════════════════════════════════════════
//  [Phase 3] 일지 일반상성 — Human Compatibility 전용, scoreSpousePalaceDelta
//  wrapper가 아니라 getBranchRels를 직접 사용하는 독립 함수 (−18 ~ +18)
// ═══════════════════════════════════════════════════════════════════════
// scoreSpousePalaceDelta를 감사한 결과, 관계 하나를 "결정"하는 방식은 합/반합/충/원진/
// 형/해/파/무관 순서의 고정 우선순위 if/else 체인이다(동시에 여러 관계가 검출돼도 가장
// 앞선 하나만 채택 — 예: 축·미처럼 충+형이 동시에 성립해도 충만 채택됨). 이 우선순위
// 자체는 애매하지 않고 명시적이므로 그대로 승계한다. Human용으로 가져올 때 바꾸는 것은
// relType 배율(0.3/0.5/1.0) 하나뿐이다 — 그 배율이 "배우자/연애 관계에서만 일지가
// 원래 세기로 의미 있다"는 가정이라 Human(관계 유형 불문)에는 맞지 않기 때문이다.
// getBranchRels가 반환하는 관계 목록을 전부 합산하지 않는 이유: 축·미(충+형), 자·미
// (원진+해) 같은 compound 지지쌍을 단순 합산하면 Phase 1에서 branchInteraction에서
// 제거했던 "같은 위치쌍 관계 과대가산" 문제가 이 축에서 다시 생긴다. 우선순위 방식은
// 이미 그 문제에서 자유롭다(관계 종류 수와 무관하게 항상 정확히 1개의 delta만 나옴).
export function scoreDayBranchAffinityDelta(b1: string, b2: string): { delta: number; note: string } {
  if (!b1 || !b2) return { delta: 0, note: "일지 정보 없음" };
  const rels = getBranchRels(b1, b2);

  let delta = 0;
  let noteSuffix = "";

  if (rels.includes("합")) {
    delta = +18;
    noteSuffix = " 지지합";
  } else if (rels.includes("반합")) {
    delta = +12;
    noteSuffix = " 반합";
  } else if (rels.includes("충")) {
    delta = -18;
    noteSuffix = " 충";
  } else if (rels.includes("원진")) {
    delta = -9;
    noteSuffix = " 원진";
  } else if (rels.includes("형")) {
    delta = -8;
    noteSuffix = " 형";
  } else if (rels.includes("해")) {
    delta = -7;
    noteSuffix = " 해";
  } else if (rels.includes("파")) {
    delta = -6;
    noteSuffix = " 파";
  } else {
    delta = +6;
    noteSuffix = " 무관";
  }

  return { delta, note: `일지 일반상성 ${b1}·${b2}${noteSuffix}` };
}

// ═══════════════════════════════════════════════════════════════════════
//  3. 월지 교차 delta  (−12 ~ +12)
// ═══════════════════════════════════════════════════════════════════════
function scoreMonthBranchDelta(m1: string, m2: string, relType?: RelationshipType): { delta: number; note: string } {
  if (!m1 || !m2) return { delta: 0, note: "월지 정보 없음" };
  const rels = getBranchRels(m1, m2);
  const isWorkOrFriend = relType === "friend" || relType === "coworker";

  let rawDelta = 0;
  let noteSuffix = "";

  if (rels.includes("합")) {
    rawDelta = isWorkOrFriend ? +18 : +12;
    noteSuffix = "합";
  } else if (rels.includes("반합")) {
    rawDelta = isWorkOrFriend ? +12 : +8;
    noteSuffix = "반합";
  } else if (rels.includes("충")) {
    rawDelta = isWorkOrFriend ? -18 : -12;
    noteSuffix = "충";
  } else if (rels.some(r => ["형","해","원진"].includes(r))) {
    rawDelta = isWorkOrFriend ? -10 : -6;
    noteSuffix = rels.filter(r => ["형","해","원진"].includes(r)).join("·");
  } else if (rels.includes("파")) {
    rawDelta = isWorkOrFriend ? -6 : -4;
    noteSuffix = "파";
  } else {
    rawDelta = isWorkOrFriend ? +6 : +4;
    noteSuffix = "무관";
  }

  return {
    delta: rawDelta,
    note: `월지 ${m1}·${m2} ${noteSuffix}`,
  };
}

// ═══════════════════════════════════════════════════════════════════════
//  4. 지지 전체 교차 delta  (−15 ~ +15 cap)
// ═══════════════════════════════════════════════════════════════════════
type PillarKey = "year" | "month" | "day" | "hour";
const PILLAR_WEIGHTS: Record<PillarKey, number> = {
  day: 1.5,
  month: 1.2,
  year: 1.0,
  hour: 0.8
};

// 반합 그룹 2번째 이후 중복 매칭에 적용하는 감쇠율(diminishing return). 0으로 두면 "최초 1회만
// 100% 인정, 그 외 전액 무시"가 되고, 이 값을 쓰면 "그래도 같은 구조가 여러 위치에서 반복
// 확인됐다"는 신호 자체는 아주 약하게 남긴다 — Positive Aux Gate와 같은 "연속적 감쇠" 철학을
// 따른 것이며, 두 방식(0% vs 30%)을 실제 합성 케이스로 비교한 결과는 감사 보고서 참고.
const HALF_TRIAD_REPEAT_DECAY = 0.3;

// 같은 위치쌍(k1,k2)에서 같은 부호(positive/negative)의 관계가 2개 이상 동시에 성립할 때
// (예: 축·미=충+형, 자·미=원진+해) 적용하는 감쇠율. 절댓값이 가장 큰 관계가 1번째(100%),
// 그다음이 2번째(REPEAT_DECAY_2ND), 3번째 이후는 REPEAT_DECAY_3RD_PLUS. 관계 자체는 절대
// 지우지 않고(evidence·note에 전부 남김) 점수 기여만 줄인다 — "복합 관계가 단일 관계보다
// 약간 더 강하게 작동할 수는 있지만 거의 2배 페널티가 되지는 않는다"는 설계 결정.
const COMPOUND_REPEAT_DECAY_2ND = 0.3;
const COMPOUND_REPEAT_DECAY_3RD_PLUS = 0.15;

const RELATION_BASE_SCORE: Record<string, number> = {
  합: 4, 충: -5, 형: -4, 파: -3, 해: -3, 원진: -4,
};

// 절댓값이 같은 관계끼리(형=원진=-4, 파=해=-3) 감쇠 순서를 정할 고정 tiebreak 우선순위.
// getBranchRels의 반환 순서나 테이블 나열 순서가 바뀌어도 이 배열의 인덱스만으로 순서가
// 정해지므로 항상 deterministic하다.
const RELATION_TIEBREAK_ORDER = ["합", "충", "형", "원진", "해", "파"];

/** 절댓값 내림차순 → 동률이면 RELATION_TIEBREAK_ORDER 순으로 정렬(완전히 deterministic). */
export function sortBySeverityDesc(group: { r: string; base: number }[]): { r: string; base: number }[] {
  return [...group].sort((a, b) => {
    const diff = Math.abs(b.base) - Math.abs(a.base);
    if (diff !== 0) return diff;
    return RELATION_TIEBREAK_ORDER.indexOf(a.r) - RELATION_TIEBREAK_ORDER.indexOf(b.r);
  });
}

/**
 * 지지 전체 교차(Aux 후보). 버그 수정 반영:
 *  1) (day,day)/(month,month) 쌍은 배우자궁(scoreSpousePalaceDelta)·월지(scoreMonthBranchDelta)가
 *     이미 전담하므로 여기서는 제외한다(안 그러면 같은 관계가 최대 가중치로 다시 가산됨).
 *  2) 같은 삼합/방합 구조(예: 해묘미)가 여러 (k1,k2) 위치 조합으로 쪼개져 반복 가산되지 않도록,
 *     반합만 그룹 단위로 모아서 그룹당 가장 비중 높은 조합 1개는 100%, 나머지는
 *     HALF_TRIAD_REPEAT_DECAY 비율만 반영한다.
 *  3) [2026-09-05] compound-relation overcounting: 같은 위치쌍에서 서로 다른 관계 유형이
 *     동시에 성립하는 경우(예: 신·인=충+형, 사·신=합+형)가 지지 관계 테이블 구조상 실제로
 *     존재한다(감사 결과 자미·축오=해+원진, 인사·술미=형+해/파, 축미·인신=충+형, 사신=합+형
 *     7개 지지쌍 확인). 이걸 "중복 버그"로 보고 관계 하나를 지우면 명리 해석상 실제로 동시에
 *     성립하는 복합 작용(예: 충이면서 동시에 형)을 잃어버리므로, 관계는 전부 보존하되 같은
 *     부호 그룹 안에서만 위 감쇠율로 점수 기여를 줄인다. 반대 부호(합+파 등)는 서로의 감쇠에
 *     영향을 주지 않고 각자 그룹에서 계산 후 합산 — "좋은 연결과 불편함이 동시에 있다"는
 *     의미를 보존한다.
 */
export function scoreBranchInteractionDelta(
  p1: ReturnType<typeof getFinalPillars>, p2: ReturnType<typeof getFinalPillars>
): { delta: number; note: string; clashCount: number; compoundEvidence: string[] } {
  let raw = 0;
  let clashCount = 0;
  const halfTriadCandidatesByGroup = new Map<number, { weight: number }[]>();
  const compoundEvidence: string[] = [];

  const keys: PillarKey[] = ["year", "month", "day", "hour"];

  for (const k1 of keys) {
    const b1 = p1[k1]?.hangul?.[1];
    if (!b1) continue;
    for (const k2 of keys) {
      // 배우자궁(day↔day)·월지(month↔month)는 이미 별도 채점 — 여기서 다시 전액 가산하지 않는다.
      if (k1 === "day" && k2 === "day") continue;
      if (k1 === "month" && k2 === "month") continue;
      const b2 = p2[k2]?.hangul?.[1];
      if (!b2) continue;

      const rels = getBranchRels(b1, b2);
      const weight = PILLAR_WEIGHTS[k1] * PILLAR_WEIGHTS[k2];

      // 반합은 cross-position 그룹 dedup 대상이라 별도 수집한다(halfTriadCandidatesByGroup).
      // 지지 관계 테이블 전수 검사 결과 반합 그룹과 합/충/형/파/해/원진이 겹치는 지지쌍은
      // 없으므로(halfTriad는 항상 단독으로만 나타남) 두 처리 경로는 서로 배타적이다.
      if (rels.includes("반합")) {
        const gIdx = halfTriadGroupIndexOf(b1);
        const list = halfTriadCandidatesByGroup.get(gIdx) ?? [];
        list.push({ weight });
        halfTriadCandidatesByGroup.set(gIdx, list);
      }

      // exact duplicate만 제거(getBranchRels는 위치쌍당 관계 문자열을 최대 1회만 반환하므로
      // 현재로선 no-op이지만, 명세대로 방어적 dedup을 유지한다).
      const compoundRels = [...new Set(rels.filter((r) => r !== "반합"))];
      if (compoundRels.length === 0) continue;

      // clashCount는 "충 태그 개수"가 아니라 "충이 성립한 위치쌍 개수"다 — 위치쌍 하나에서
      // 충+형이 함께 나와도 이 위치쌍은 1건으로만 센다(화면의 "충돌 N회" 문구와 의미가 맞음).
      if (compoundRels.includes("충")) clashCount++;

      const scored = compoundRels.map((r) => ({ r, base: RELATION_BASE_SCORE[r] ?? 0 }));
      const positives = sortBySeverityDesc(scored.filter((x) => x.base > 0));
      const negatives = sortBySeverityDesc(scored.filter((x) => x.base < 0));

      const attenuatedSum = (group: { r: string; base: number }[]) =>
        group.reduce((sum, x, idx) => {
          const factor = idx === 0 ? 1 : idx === 1 ? COMPOUND_REPEAT_DECAY_2ND : COMPOUND_REPEAT_DECAY_3RD_PLUS;
          return sum + x.base * weight * factor;
        }, 0);

      raw += attenuatedSum(positives) + attenuatedSum(negatives);

      if (compoundRels.length >= 2) {
        compoundEvidence.push(
          `${k1}×${k2}(${b1}·${b2}): ${compoundRels.join("+")} 동시 성립(점수는 감쇠, 관계는 모두 보존)`
        );
      }
    }
  }

  let halfTriadGroupCount = 0;
  for (const candidates of halfTriadCandidatesByGroup.values()) {
    if (candidates.length === 0) continue;
    halfTriadGroupCount++;
    candidates.sort((a, b) => b.weight - a.weight);
    candidates.forEach((c, idx) => {
      const factor = idx === 0 ? 1 : HALF_TRIAD_REPEAT_DECAY;
      raw += 5 * c.weight * factor;
    });
  }

  const delta = Math.max(-15, Math.min(15, Math.round(raw)));
  const note = raw !== 0
    ? `지지 교차: 위치 가중치 적용 총합 ${raw > 0 ? "+" : ""}${Math.round(raw * 10) / 10}점 (충 ${clashCount}회, 반합구조 ${halfTriadGroupCount}종, 복합관계 ${compoundEvidence.length}건, 최종 캡 ±15)`
    : "지지 교차 관계 없음";
  return { delta, note, clashCount, compoundEvidence };
}

// ═══════════════════════════════════════════════════════════════════════
//  4-2. 천간 전체 교차 delta (지지 전체 교차와 대칭) — 일간×일간 쌍은 scoreDayMasterDelta가
//  이미 담당하므로 제외하고 나머지 15쌍만 본다.
//
//  [A안 확정 — null-expectation 감사 결과 반영]
//  이 모듈의 원래 목적은 기존 궁합 계산(scoreDayMasterDelta/elementComplement/yongshinDelta/
//  tenGodDelta)에 없던 "구체적 천간합·천간충"을 deterministic하게 추가하는 것이다. 초판에서는
//  구체 관계가 없는 나머지 쌍에도 오행 상생·상극·비화 점수를 매겨 15쌍 거의 전부가 evidence를
//  만들었는데, synthetic N=5,000 감사 결과 그 설계가 평균 +7.16(양수 83%, overall ±15 cap
//  히트 19.6%)이라는 구조적 양수 편향을 만드는 것으로 확인됐다(비화가 대응 음수 카테고리 없이
//  전체 편향의 약 2/3을 차지, 나머지는 천간합/충의 상극 재분류로 상생:상극 발생빈도가
//  40.3%:22.2%로 벌어진 결과). 이에 따라 숫자 기여를 천간합·천간충으로만 좁혔다: 같은 감사에서
//  A안은 평균 +0.94(중앙값 0, overall cap 히트 0%)로 재현됐고, 잔여 +0.94는 천간합 5종·천간충
//  4종이라는 명리 이론 자체의 개수 비대칭에서 오는 것이라 이번 단계에서는 보정하지 않는다
//  (특정 실제 사례에 맞춘 calibration이 아니라 이론적 의미를 우선한다는 결정).
//  일반 오행 상생·상극·비화는 숫자 0으로 유지하되 참고용 label로만 note에 남긴다.
// ═══════════════════════════════════════════════════════════════════════
type StemRelCategory = "천간합" | "천간충" | "상생" | "상극" | "비화";

export function scoreStemInteractionDelta(
  p1: ReturnType<typeof getFinalPillars>, p2: ReturnType<typeof getFinalPillars>
): {
  delta: number; note: string; pairCount: number; rawTotal: number;
  /** 진단용(런타임 미사용) — 카테고리별 원시 합(카테고리 cap 전). 천간합/천간충만 채워짐 */
  categoryRaw: Partial<Record<StemRelCategory, number>>;
  /** 진단용(런타임 미사용) — 카테고리별 cap(±10) 적용 후 합. 천간합/천간충만 채워짐 */
  categoryCapped: Partial<Record<StemRelCategory, number>>;
} {
  const keys: PillarKey[] = ["year", "month", "day", "hour"];
  const byCategory = new Map<StemRelCategory, number>();
  const genericCount: Partial<Record<"상생" | "상극" | "비화", number>> = {};
  let pairCount = 0;

  for (const k1 of keys) {
    const s1 = p1[k1]?.hangul?.[0];
    if (!s1) continue;
    for (const k2 of keys) {
      if (k1 === "day" && k2 === "day") continue; // 일간×일간은 scoreDayMasterDelta가 전담(중복 방지)
      const s2 = p2[k2]?.hangul?.[0];
      if (!s2) continue;

      const weight = PILLAR_WEIGHTS[k1] * PILLAR_WEIGHTS[k2];

      // ① 구체적 천간합/천간충만 숫자 반영(A안)
      const specific = computeStemRelations([s1, s2]);
      const hasHap = specific.some((r) => r.type === "천간합");
      const hasChung = specific.some((r) => r.type === "천간충");
      if (hasHap) {
        byCategory.set("천간합", (byCategory.get("천간합") ?? 0) + 6 * weight);
        pairCount++;
        continue;
      }
      if (hasChung) {
        byCategory.set("천간충", (byCategory.get("천간충") ?? 0) + -6 * weight);
        pairCount++;
        continue;
      }

      // ② 없으면 오행 상생·상극·비화는 숫자 0, 참고용 카운트만(label-only)
      const e1 = STEM_ELEMENT[s1], e2 = STEM_ELEMENT[s2];
      if (!e1 || !e2) continue;
      let cat: "상생" | "상극" | "비화" | null = null;
      if (e1 === e2) cat = "비화";
      else if (GENERATING.some(([a, b]) => a === e1 && b === e2)) cat = "상생";
      else if (GENERATING.some(([a, b]) => a === e2 && b === e1)) cat = "상생";
      else if (CONTROLLING.some(([a, b]) => a === e1 && b === e2)) cat = "상극";
      else if (CONTROLLING.some(([a, b]) => a === e2 && b === e1)) cat = "상극";
      if (cat) genericCount[cat] = (genericCount[cat] ?? 0) + 1;
    }
  }

  let total = 0;
  const categoryCapped: Partial<Record<StemRelCategory, number>> = {};
  for (const [cat, sum] of byCategory.entries()) {
    const capped = Math.max(-10, Math.min(10, sum)); // category cap(안전장치, 잠정값)
    categoryCapped[cat] = capped;
    total += capped;
  }
  const delta = Math.max(-15, Math.min(15, Math.round(total))); // overall cap(안전장치, 잠정값)

  const parts = [...byCategory.entries()]
    .filter(([, v]) => Math.abs(v) >= 0.5)
    .map(([cat, v]) => `${cat} ${v > 0 ? "+" : ""}${Math.round(v * 10) / 10}`);
  const genericParts = (["상생", "상극", "비화"] as const)
    .filter((cat) => genericCount[cat])
    .map((cat) => `${cat} ${genericCount[cat]}건`);
  const genericSuffix = genericParts.length > 0
    ? ` (그 외 오행 ${genericParts.join(", ")} — 해석 참고용, 점수 미반영)`
    : "";
  const note = parts.length > 0
    ? `천간 교차(일간쌍 제외, 천간합/천간충만 반영): ${parts.join(", ")} → 캡 적용 ${delta > 0 ? "+" : ""}${delta}${genericSuffix}`
    : `천간합/천간충 없음${genericSuffix || " — 오행 교차도 없음"}`;
  return {
    delta, note, pairCount, rawTotal: Math.round(total * 10) / 10,
    categoryRaw: Object.fromEntries(byCategory),
    categoryCapped,
  };
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
  const sa1 = pipe1.spouseActivation;
  const sa2 = pipe2.spouseActivation;
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
    ...(sa1 && sa2
      ? [
          {
            title: "배우자·결혼 활성도(타이밍)",
            description:
              `${n1} 활성 ${sa1.activationScore}점(${sa1.activationLevel})·안정 ${sa1.stabilityScore}점(${sa1.stabilityLevel}) vs ` +
              `${n2} 활성 ${sa2.activationScore}점(${sa2.activationLevel})·안정 ${sa2.stabilityScore}점(${sa2.stabilityLevel}). ` +
              `${n1}: ${sa1.interpretation} ${n2}: ${sa2.interpretation}`,
            isPositive: sa1.stabilityScore + sa2.stabilityScore >= 90,
          },
        ]
      : []),
  ];
}

// ═══════════════════════════════════════════════════════════════════════
//  Phase 2: Core/Aux 2계층 종합 궁합 점수
// ═══════════════════════════════════════════════════════════════════════
// 배경: Phase 1까지는 8개 조정값(dm/sp/mb/bi/stem/ec/tg/yong)을 flat하게 더해
// baseScore = 50 + sum이었다. 이 방식은 "핵심축(일간·배우자궁·월지)"과 "보조축(지지/천간
// 교차·오행보완·십성·용신)"을 숫자상 완전히 동등하게 취급해서, 핵심축끼리 서로 충돌해도
// 보조축이 누적되면 총점이 그대로 90점대까지 올라갈 수 있었다(예: 일간이 상극이어도
// 배우자궁·보조축이 좋으면 고득점). Phase 2는 이를 Core(dm+sp+mb, 개별 정규화 후 명시적
// weight로 합산)와 Aux(나머지 5개, positive/negative 분리 정규화 + Core 상태에 따른
// 연속 gate)로 분리한다.
//
// "Core 우선"의 정확한 의미(중요 — 오독 방지용으로 반드시 이 정의를 기준으로 판단할 것):
//  1) Core의 이론상 최대 영향(±CORE_MAX_INFLUENCE=35)이 Aux(±AUX_MAX_INFLUENCE=15)보다
//     크다 — 두 축의 "영향력 상한" 자체가 다르게 설계되어 있다.
//  2) positive Aux는 coreNorm에 따라 20%~95% 사이로 연속적으로 gate된다(hard cutoff
//     없음) — Core가 나쁠수록 Aux가 아무리 좋아도 인정폭이 줄어, 나쁜 Core를 좋은
//     Aux만으로 상위권 궁합으로 뒤집기 어렵게 만드는 것이 목적이다.
//  3) 이것이 "개별 사례마다 |coreContribution| > |auxContribution|이어야 한다"는 뜻은
//     아니다. Core가 중립(coreNorm≈0)인 사례에서는 coreContribution 자체가 작아지는
//     게 정상이고, 그 경우 auxContribution이 최종 점수 변화량의 주요 원인이 될 수
//     있다(실측 예: 박소연↔현욱 coreContribution≈+1.5, auxContribution≈+5.3 — 이건
//     Aux가 Core를 이긴 게 아니라 Core가 "중립 판정"을 내렸을 뿐이다). Core 우선은
//     "최대 영향력 상한 차이 + gate를 통한 역전 제한"으로 구현되는 개념이지, 매
//     케이스의 절댓값 비교로 강제되는 개념이 아니다.
//  4) negative Aux는 gate 없이 100% 그대로 반영한다(A안, 아래 참고) — Core가 나쁘다는
//     이유로 명리적 근거(나쁜 Aux) 자체를 임의로 희석하지 않기 위함이다.

/** dm 코드상 range(lover 기준, scoreDayMasterDelta): 상생 +15 / 피극 -12 */
export const CORE_DM_POS_MAX = 15;
export const CORE_DM_NEG_MIN = 12;
/** sp 코드상 range(lover 기준, scoreSpousePalaceDelta): 합 +18 / 충 -18 */
export const CORE_SP_POS_MAX = 18;
export const CORE_SP_NEG_MIN = 18;
/** mb 코드상 range(lover 기준, scoreMonthBranchDelta): 합 +12 / 충 -12 */
export const CORE_MB_POS_MAX = 12;
export const CORE_MB_NEG_MIN = 12;
/** Aux 5개 컴포넌트(bi/stem/ec/tg/yong) 코드상 하드 clamp의 positive 합 / negative(절댓값) 합 */
export const AUX_POS_MAX = 15 + 15 + 12 + 12 + 10; // bi15 + stem15 + ec12 + tg12 + yong10 = 64
export const AUX_NEG_MAX = 15 + 15 + 8 + 8 + 5; // bi15 + stem15 + ec8 + tg8 + yong5 = 51

/** Core weight: 종합 궁합에서는 세 핵심축을 거의 동급으로 본다(배우자궁 과대가중 지양). */
export const CORE_WEIGHT_DM = 0.35;
export const CORE_WEIGHT_SP = 0.35;
export const CORE_WEIGHT_MB = 0.30;

export const CORE_MAX_INFLUENCE = 35;
export const AUX_MAX_INFLUENCE = 15;

export function clampRange(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}

export function normalizeCoreAxis(raw: number, posMax: number, negMin: number): number {
  return clampRange(raw >= 0 ? raw / posMax : raw / negMin, -1, 1);
}

/**
 * positive Aux gate — coreNorm -1→20%, 0→65%, +1→95%를 잇는 구간선형(연속, hard cutoff
 * 없음). "core가 중립이면 보조 장점의 65%를 인정한다"처럼 그대로 해석 문구로 옮길 수
 * 있도록 piecewise-linear를 baseline으로 채택했다(감사 결과 sigmoid 대비 N=4,000 분포·
 * 5인 회귀 차이가 1%p/1점 안팎으로 미미해, 더 단순하고 설명 가능한 쪽을 택함).
 */
export function positiveAuxGate(coreNorm: number): number {
  return coreNorm <= 0
    ? 0.20 + (0.65 - 0.20) * (coreNorm + 1)
    : 0.65 + (0.95 - 0.65) * coreNorm;
}

/**
 * 두 정규화된(-1~+1) core 축 사이의 연속 synergy. sign-only 고정값(±0.05)이 아니라
 * 강도(sqrt)에 비례시켜 "아주 약한 우호도 최대 보너스" 같은 불연속을 없앤다. dm/sp
 * 자체를 다시 채점하지 않는 아주 작은 interaction term이며, Phase 2(dm×sp)와
 * Phase 3(Human dm×dayBranchAffinity, Marriage dm×spousePalace)가 공유한다.
 */
export function continuousSynergy(a: number, b: number): number {
  if (a > 0 && b > 0) return 0.05 * Math.sqrt(a * b);
  if (a < 0 && b < 0) return -0.05 * Math.sqrt(Math.abs(a * b));
  return 0;
}

/** 개발자/내부 감사용 Core·Aux 세부 breakdown. 사용자 노출 note/summary와는 분리해서 다룬다. */
export interface CoreAuxBreakdown {
  dmNorm: number;
  spNorm: number;
  mbNorm: number;
  coreBase: number;
  synergy: number;
  coreNorm: number;
  auxPosRaw: number;
  auxNegRaw: number;
  auxPosNorm: number;
  auxNegNorm: number;
  gatePos: number;
  coreContribution: number;
  auxContribution: number;
}

export function computeCoreAuxBreakdown(
  dm: number,
  sp: number,
  mb: number,
  auxDeltas: readonly number[], // [bi, stem, ec, tg, yong]
): CoreAuxBreakdown {
  const dmNorm = normalizeCoreAxis(dm, CORE_DM_POS_MAX, CORE_DM_NEG_MIN);
  const spNorm = normalizeCoreAxis(sp, CORE_SP_POS_MAX, CORE_SP_NEG_MIN);
  const mbNorm = normalizeCoreAxis(mb, CORE_MB_POS_MAX, CORE_MB_NEG_MIN);

  const coreBase = dmNorm * CORE_WEIGHT_DM + spNorm * CORE_WEIGHT_SP + mbNorm * CORE_WEIGHT_MB;
  const synergy = continuousSynergy(dmNorm, spNorm);
  const coreNorm = clampRange(coreBase + synergy, -1, 1);

  const auxPosRaw = auxDeltas.filter((x) => x > 0).reduce((a, b) => a + b, 0);
  const auxNegRaw = auxDeltas.filter((x) => x < 0).reduce((a, b) => a + b, 0);
  const auxPosNorm = clampRange(auxPosRaw / AUX_POS_MAX, 0, 1);
  const auxNegNorm = clampRange(Math.abs(auxNegRaw) / AUX_NEG_MAX, 0, 1);

  const gatePos = positiveAuxGate(coreNorm);

  const coreContribution = CORE_MAX_INFLUENCE * coreNorm;
  // negative Aux = A안(100% 반영, gate 없음). Phase 1에서 발견된 branchInteraction 음수
  // 편향은 별도 구조 문제로 관리하며, negative gate를 분포 보정 장치로 쓰지 않는다.
  const auxContribution = AUX_MAX_INFLUENCE * (auxPosNorm * gatePos - auxNegNorm * 1);

  return {
    dmNorm, spNorm, mbNorm, coreBase, synergy, coreNorm,
    auxPosRaw, auxNegRaw, auxPosNorm, auxNegNorm, gatePos,
    coreContribution, auxContribution,
  };
}

// ═══════════════════════════════════════════════════════════════════════
//  구조적 등급 조정 (tier shift)
// ═══════════════════════════════════════════════════════════════════════
// [2026-09 Phase 2 감사] 기존 5개 구조 플래그를 Core/Aux 구조와 대조한 결과:
//  - "일간상생 + 배우자궁 비충"(up), "배우자궁 충"(down), "월지 충"(down)은 각각 dm>0,
//    sp=충, mb=충을 그대로 다시 감지하는 것이라 이제 coreNorm(dm/sp/mb 정규화+가중합)에
//    이미 전액 반영된 신호의 중복 가산이다. 실측(N=4,000, 무작위 유효 사주): 이 3개를
//    포함한 기존 방식은 tier-up 42.1%·tier-down 46.8%라는 비정상적으로 높은 발동률을
//    보였다(거의 매번 한쪽이 발동) — 코드에서 제거했다.
//  - "지지 충 2회 이상"(down, bi.clashCount 기반)도 bi는 이미 Aux negative에 포함돼
//    gate까지 거치는데, 그 위에 또 한 번 하드컷 성격의 -1을 얹는 구조였다. 실측 결과
//    "복합 긴장" 플래그만 남긴 경우 대비 발동률이 4.0%→36.4%로 9배 뛰어(=바로 이
//    플래그가 대부분의 발동을 차지) 사실상 "드문 예외 신호"가 아니라 상시 노이즈에
//    가까웠다. Phase 1~2 전반의 "hard cutoff 금지" 원칙과도 맞지 않아 제거했다.
//  - "배우자궁 복합 긴장(원진·해·형 중복)"만 유지한다: sp의 raw delta는 if/else 우선순위로
//    가장 강한 관계 1개만 반영하므로(Phase 1의 compound-relation 감쇠가 branchInteraction
//    에만 적용되고 배우자궁 자체에는 적용되지 않음), 배우자궁에 형/해/원진이 동시에
//    2개 이상 성립하는 경우는 coreNorm(spNorm)에 없는 정보다. 실측 발동률 4.0%로
//    "드물지만 의미 있는 예외"에 해당해 유지 근거가 있다고 판단했다.
interface StructuralFlags {
  spousePalaceMultiTension: boolean;
}

function computeStructuralSteps(
  flags: StructuralFlags,
  relType?: RelationshipType,
): { steps: StructuralTierStep[]; netDelta: number } {
  const steps: StructuralTierStep[] = [];
  let net = 0;

  const isPersonalLove = relType === "lover" || relType === "spouse" || relType === "interest" || !relType || relType === "other";

  // −1: spouse palace has multiple tension relations (원진/해/형 ≥2) — Core에 없는 유일한 잔존 신호.
  if (flags.spousePalaceMultiTension && isPersonalLove) {
    steps.push({ label: "배우자궁 복합 긴장(원진·해·형 중복)", direction: "down" });
    net -= 1;
  }

  return { steps, netDelta: Math.max(-2, Math.min(2, net)) };
}

// ═══════════════════════════════════════════════════════════════════════
//  [Phase 3] Human / Romance / Marriage 목적별 3-모델
// ═══════════════════════════════════════════════════════════════════════
// 배경: Phase 2의 totalScore(dm35/sp35/mb30)는 "관계 유형 불문 종합 궁합"이 아니라
// 이미 배우자궁이 낀 "연인/배우자 관계형" 점수에 가깝다. Phase 3는 이를 대체하지 않고
// (totalScore·romanceMarriageFit은 legacy로 그대로 유지) 목적이 다른 3개 점수를 추가한다.
//  - Human: "연애·결혼을 전제하지 않았을 때 사람 대 사람으로 얼마나 자연스럽게 맞는가".
//    배우자궁(scoreSpousePalaceDelta)의 relType 가중 대신 scoreDayBranchAffinityDelta
//    (일지 일반상성, 관계 유형 무관)를 쓰고, 배우자성/결혼전용 신호(십성 MAP의 정재·정관
//    편향, spouseStarModifier, marriageGroupStructureBonus)는 전부 제외한다.
//  - Romance: 기존 dm×sp Core에 연애 전용 신호(십성, spouseStarModifier)를 Aux로 포함.
//  - Marriage: 배우자궁 비중을 가장 높게(42.5%) 두고 결혼 전용 신호
//    (marriageGroupStructureBonus)를 Aux로 포함.
// 세 모델 모두 Phase 2와 동일한 정규화(-1~+1)·synergy·piecewise gate·
// finalScore=50+coreContribution+auxContribution 골격을 공유하되, Core 구성/가중치와
// Aux 구성(따라서 AUX_POS_MAX/NEG_MAX)만 모델별로 다르다.

export const HUMAN_CORE_WEIGHT_DM = 0.40;
export const HUMAN_CORE_WEIGHT_MB = 0.35;
export const HUMAN_CORE_WEIGHT_DBA = 0.25;
export const DBA_POS_MAX = 18; // scoreDayBranchAffinityDelta 코드상 range: 합 +18
export const DBA_NEG_MIN = 18; // scoreDayBranchAffinityDelta 코드상 range: 충 -18
// Human Aux = bi + stem + ec + yong (tenGod 제외 — MAP이 정재/정관 등 배우자성과 결부돼
// "사람 대 사람의 중립적 상성" 모델에 그대로 쓰기엔 개념적으로 편향 소지가 있다는 감사
// 결과에 따라 baseline에서 제외. 필요 시 별도 scoreHumanTenGodCompatibility로 재설계 가능).
export const HUMAN_AUX_POS_MAX = 15 + 15 + 12 + 10; // bi15+stem15+ec12+yong10 = 52
export const HUMAN_AUX_NEG_MAX = 15 + 15 + 8 + 5; // bi15+stem15+ec8+yong5 = 43

export const ROMANCE_CORE_WEIGHT_DM = 0.40;
export const ROMANCE_CORE_WEIGHT_SP = 0.35;
export const ROMANCE_CORE_WEIGHT_MB = 0.25;
// Romance Aux = bi+stem+ec+tg+yong + spouseStarModifier. scoreSpouseStarModifier 코드상
// `Math.max(-5, Math.min(5, raw))`로 범위가 정확히 [-5,+5]임을 확인하고 반영했다.
export const ROMANCE_AUX_POS_MAX = 15 + 15 + 12 + 12 + 10 + 5; // = 69
export const ROMANCE_AUX_NEG_MAX = 15 + 15 + 8 + 8 + 5 + 5; // = 56

export const MARRIAGE_CORE_WEIGHT_SP = 0.425;
export const MARRIAGE_CORE_WEIGHT_MB = 0.325;
export const MARRIAGE_CORE_WEIGHT_DM = 0.25; // 합계 0.425+0.325+0.25 = 1.0
// Marriage Aux = bi+stem+ec+tg+yong + marriageGroupStructureBonus. marriageGroupStructureBonus
// 코드상 bonus는 0에서 시작해 항상 비음수 가중치만 누적되고 `Math.min(8, bonus)`로 캡되므로
// 범위는 정확히 [0,+8]이며 NEG_MAX에는 기여하지 않는다(항상 순수 positive-only 보너스).
export const MARRIAGE_AUX_POS_MAX = 15 + 15 + 12 + 12 + 10 + 8; // = 72
export const MARRIAGE_AUX_NEG_MAX = 15 + 15 + 8 + 8 + 5; // = 51 (Phase2 AUX_NEG_MAX와 동일)

export interface HumanCompatibilityBreakdown {
  dmRaw: number; dmNorm: number;
  mbRaw: number; mbNorm: number;
  dayBranchAffinityRaw: number; dayBranchAffinityNorm: number;
  coreBase: number; synergy: number; coreNorm: number; coreContribution: number;
  auxPosRaw: number; auxNegRaw: number; auxPosNorm: number; auxNegNorm: number;
  gatePos: number; auxContribution: number;
  final: number; tone: CompatibilityTone;
}

/** Human Compatibility(연애/결혼 전제 없는 사람 대 사람 상성). tier shift 없음(배우자궁 모델 아님). */
export function computeHumanCompatibility(
  dm: number, mb: number, dba: number,
  auxDeltas: readonly number[], // [bi, stem, ec, yong]
): HumanCompatibilityBreakdown {
  const dmNorm = normalizeCoreAxis(dm, CORE_DM_POS_MAX, CORE_DM_NEG_MIN);
  const mbNorm = normalizeCoreAxis(mb, CORE_MB_POS_MAX, CORE_MB_NEG_MIN);
  const dbaNorm = normalizeCoreAxis(dba, DBA_POS_MAX, DBA_NEG_MIN);

  const coreBase = dmNorm * HUMAN_CORE_WEIGHT_DM + mbNorm * HUMAN_CORE_WEIGHT_MB + dbaNorm * HUMAN_CORE_WEIGHT_DBA;
  const synergy = continuousSynergy(dmNorm, dbaNorm);
  const coreNorm = clampRange(coreBase + synergy, -1, 1);

  const auxPosRaw = auxDeltas.filter((x) => x > 0).reduce((a, b) => a + b, 0);
  const auxNegRaw = auxDeltas.filter((x) => x < 0).reduce((a, b) => a + b, 0);
  const auxPosNorm = clampRange(auxPosRaw / HUMAN_AUX_POS_MAX, 0, 1);
  const auxNegNorm = clampRange(Math.abs(auxNegRaw) / HUMAN_AUX_NEG_MAX, 0, 1);

  const gatePos = positiveAuxGate(coreNorm);
  const coreContribution = CORE_MAX_INFLUENCE * coreNorm;
  const auxContribution = AUX_MAX_INFLUENCE * (auxPosNorm * gatePos - auxNegNorm * 1);
  const final = Math.round(clampRange(50 + coreContribution + auxContribution, 0, 100));

  return {
    dmRaw: dm, dmNorm, mbRaw: mb, mbNorm, dayBranchAffinityRaw: dba, dayBranchAffinityNorm: dbaNorm,
    coreBase, synergy, coreNorm, coreContribution,
    auxPosRaw, auxNegRaw, auxPosNorm, auxNegNorm, gatePos, auxContribution,
    final, tone: gradeFromScore(final),
  };
}

export interface RomanceCompatibilityBreakdown {
  dmRaw: number; dmNorm: number;
  spousePalaceRaw: number; spousePalaceNorm: number;
  mbRaw: number; mbNorm: number;
  coreBase: number; synergy: number; coreNorm: number; coreContribution: number;
  auxPosRaw: number; auxNegRaw: number; auxPosNorm: number; auxNegNorm: number;
  gatePos: number; auxContribution: number;
  spouseStarModifier: number;
  structuralSteps: StructuralTierStep[]; structuralNetDelta: number;
  final: number; baseType: CompatibilityTone; tone: CompatibilityTone;
}

/** Romance Compatibility. spousePalaceMultiTension tier shift 적용. */
export function computeRomanceCompatibility(
  dm: number, sp: number, mb: number,
  auxDeltas: readonly number[], // [bi, stem, ec, tg, yong]
  spouseStarModifier: number,
  spousePalaceMultiTension: boolean,
  relType?: RelationshipType,
): RomanceCompatibilityBreakdown {
  const dmNorm = normalizeCoreAxis(dm, CORE_DM_POS_MAX, CORE_DM_NEG_MIN);
  const spNorm = normalizeCoreAxis(sp, CORE_SP_POS_MAX, CORE_SP_NEG_MIN);
  const mbNorm = normalizeCoreAxis(mb, CORE_MB_POS_MAX, CORE_MB_NEG_MIN);

  const coreBase = dmNorm * ROMANCE_CORE_WEIGHT_DM + spNorm * ROMANCE_CORE_WEIGHT_SP + mbNorm * ROMANCE_CORE_WEIGHT_MB;
  const synergy = continuousSynergy(dmNorm, spNorm);
  const coreNorm = clampRange(coreBase + synergy, -1, 1);

  const auxAll = [...auxDeltas, spouseStarModifier];
  const auxPosRaw = auxAll.filter((x) => x > 0).reduce((a, b) => a + b, 0);
  const auxNegRaw = auxAll.filter((x) => x < 0).reduce((a, b) => a + b, 0);
  const auxPosNorm = clampRange(auxPosRaw / ROMANCE_AUX_POS_MAX, 0, 1);
  const auxNegNorm = clampRange(Math.abs(auxNegRaw) / ROMANCE_AUX_NEG_MAX, 0, 1);

  const gatePos = positiveAuxGate(coreNorm);
  const coreContribution = CORE_MAX_INFLUENCE * coreNorm;
  const auxContribution = AUX_MAX_INFLUENCE * (auxPosNorm * gatePos - auxNegNorm * 1);
  const final = Math.round(clampRange(50 + coreContribution + auxContribution, 0, 100));

  const baseType = gradeFromScore(final);
  const { steps: structuralSteps, netDelta: structuralNetDelta } = computeStructuralSteps(
    { spousePalaceMultiTension }, relType,
  );
  const tone = shiftTier(baseType, structuralNetDelta);

  return {
    dmRaw: dm, dmNorm, spousePalaceRaw: sp, spousePalaceNorm: spNorm, mbRaw: mb, mbNorm,
    coreBase, synergy, coreNorm, coreContribution,
    auxPosRaw, auxNegRaw, auxPosNorm, auxNegNorm, gatePos, auxContribution,
    spouseStarModifier, structuralSteps, structuralNetDelta,
    final, baseType, tone,
  };
}

export interface MarriageCompatibilityBreakdown {
  spousePalaceRaw: number; spousePalaceNorm: number;
  mbRaw: number; mbNorm: number;
  dmRaw: number; dmNorm: number;
  coreBase: number; synergy: number; coreNorm: number; coreContribution: number;
  auxPosRaw: number; auxNegRaw: number; auxPosNorm: number; auxNegNorm: number;
  gatePos: number; auxContribution: number;
  marriageGroupStructureBonus: number;
  structuralSteps: StructuralTierStep[]; structuralNetDelta: number;
  final: number; baseType: CompatibilityTone; tone: CompatibilityTone;
}

/** Marriage Compatibility. spousePalaceMultiTension tier shift 적용. */
export function computeMarriageCompatibility(
  sp: number, mb: number, dm: number,
  auxDeltas: readonly number[], // [bi, stem, ec, tg, yong]
  marriageBonus: number,
  spousePalaceMultiTension: boolean,
  relType?: RelationshipType,
): MarriageCompatibilityBreakdown {
  const spNorm = normalizeCoreAxis(sp, CORE_SP_POS_MAX, CORE_SP_NEG_MIN);
  const mbNorm = normalizeCoreAxis(mb, CORE_MB_POS_MAX, CORE_MB_NEG_MIN);
  const dmNorm = normalizeCoreAxis(dm, CORE_DM_POS_MAX, CORE_DM_NEG_MIN);

  const coreBase = spNorm * MARRIAGE_CORE_WEIGHT_SP + mbNorm * MARRIAGE_CORE_WEIGHT_MB + dmNorm * MARRIAGE_CORE_WEIGHT_DM;
  // Marriage synergy: sp×mb(장기 공동생활 전용 신규 규칙)로 바꾸는 안을 검토했으나 기존
  // 코드/Phase 1~2에 선례가 없는 임의 규칙이 되므로, 근거가 약해 Phase 2와 동일한 dm×sp를
  // 그대로 승계한다(신규 규칙 임의 도입 금지 원칙 — 2026-09 설계 결정).
  const synergy = continuousSynergy(dmNorm, spNorm);
  const coreNorm = clampRange(coreBase + synergy, -1, 1);

  const auxAll = [...auxDeltas, marriageBonus];
  const auxPosRaw = auxAll.filter((x) => x > 0).reduce((a, b) => a + b, 0);
  const auxNegRaw = auxAll.filter((x) => x < 0).reduce((a, b) => a + b, 0);
  const auxPosNorm = clampRange(auxPosRaw / MARRIAGE_AUX_POS_MAX, 0, 1);
  const auxNegNorm = clampRange(Math.abs(auxNegRaw) / MARRIAGE_AUX_NEG_MAX, 0, 1);

  const gatePos = positiveAuxGate(coreNorm);
  const coreContribution = CORE_MAX_INFLUENCE * coreNorm;
  const auxContribution = AUX_MAX_INFLUENCE * (auxPosNorm * gatePos - auxNegNorm * 1);
  const final = Math.round(clampRange(50 + coreContribution + auxContribution, 0, 100));

  const baseType = gradeFromScore(final);
  const { steps: structuralSteps, netDelta: structuralNetDelta } = computeStructuralSteps(
    { spousePalaceMultiTension }, relType,
  );
  const tone = shiftTier(baseType, structuralNetDelta);

  return {
    spousePalaceRaw: sp, spousePalaceNorm: spNorm, mbRaw: mb, mbNorm, dmRaw: dm, dmNorm,
    coreBase, synergy, coreNorm, coreContribution,
    auxPosRaw, auxNegRaw, auxPosNorm, auxNegNorm, gatePos, auxContribution,
    marriageGroupStructureBonus: marriageBonus, structuralSteps, structuralNetDelta,
    final, baseType, tone,
  };
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

/** 두 사람 각각의 연도별 배우자·결혼 활성도 + 활성도 TOP3(개인 사주 화면과 동일 함수 재사용). */
export interface SpouseActivationTimingBlock {
  person1: { years: SpouseActivationYearEntry[]; top: SpouseActivationYearEntry[] };
  person2: { years: SpouseActivationYearEntry[]; top: SpouseActivationYearEntry[] };
}

function buildSpouseActivationYearsForPerson(
  pipe: SajuPipelineResult | null,
  record: PersonRecord,
): { years: SpouseActivationYearEntry[]; top: SpouseActivationYearEntry[] } | null {
  if (!pipe || !pipe.spouseActivation) return null;
  const daewoonSuOpts: DaewoonSuOpts = {
    exactSolarTermBoundaryOn: record.fortuneOptions?.exactSolarTermBoundaryOn ?? true,
    trueSolarTimeOn: record.fortuneOptions?.trueSolarTimeOn ?? false,
  };
  // manualPillars 반영을 위해 raw computedPillars가 아니라 getFinalPillars()로 병합한 값을 사용한다.
  const luckCycles = calculateLuckCycles(record.birthInput, getFinalPillars(record), daewoonSuOpts);
  const yongshin = pipe.adjusted.effectiveYongshin;
  const years = computeSpouseActivationByYearRange({
    dayStem: pipe.input.dayStem,
    dayBranch: pipe.input.dayBranch,
    allStems: pipe.input.allStems,
    gender: record.birthInput.gender,
    evaluations: pipe.evaluations,
    yongshin,
    heesin: pipe.adjusted.effectiveYongshinSecondary,
    gisin: getController(yongshin),
    birthYear: record.birthInput.year,
    daewoon: luckCycles.daewoon,
    seunEntries: luckCycles.seun,
    fromYear: luckCycles.wolun.year,
  });
  return { years, top: topSpouseActivationYears(years, 3) };
}

// ── 연애 적합도 / 결혼 적합도 (원국 기반, 연도별 timing과 분리) ────────────
// 삼합·방합 그룹의 대표 오행(원국 삼합/방합 이론의 표준 배속). 삼합/방합을 분리해 두어
// 그룹 문자열(예: "신유술")을 split("")한 배열이 곧 그 그룹의 3개 지지가 된다.
const SAMHAP_GROUP_ELEMENT: Record<string, FiveElKey> = {
  인오술: "화", 사유축: "금", 신자진: "수", 해묘미: "목",
};
const BANGHAP_GROUP_ELEMENT: Record<string, FiveElKey> = {
  인묘진: "목", 사오미: "화", 신유술: "금", 해자축: "수",
};

/**
 * 결혼 적합도의 삼합/방합 가산 — 있다는 사실만으로 무조건 +5를 주지 않는다.
 * 1) 진짜 "두 사람 교차 형성"만 인정한다: 그룹을 이루는 지지 중 실제로 사용된 지지들
 *    (unionPresent)을 한 사람의 원국 혼자만으로 전부 커버한다면(=상대가 아무것도 보태지
 *    않는다면) 그건 원래 그 사람 개인 원국에 있던 구조이므로 커플 bonus에서 제외한다.
 *    지지 문자가 두 사람 모두에게 우연히 겹친다는 이유만으로 "교차"로 오인하지 않도록,
 *    branchRelations의 pair 단위 결과를 쓰지 않고 그룹 단위로 직접 판정한다.
 * 2) 완성(3지 모두 사용) vs 흐름(2지만 사용)을 구분해 흐름은 훨씬 낮은 가중치.
 * 3) 그 합국 오행이 각자의 용신·희신인지 기신인지 확인해서, 한쪽 기신을 강하게 만드는
 *    합국이면 가산을 줄이거나(한쪽만 기신) 아예 주지 않는다(양쪽 다 기신).
 */
function marriageGroupStructureBonus(
  br1: string[], br2: string[],
  y1: FiveElKey, h1: FiveElKey | undefined, g1: FiveElKey,
  y2: FiveElKey, h2: FiveElKey | undefined, g2: FiveElKey,
): { bonus: number; notes: string[] } {
  const set1 = new Set(br1);
  const set2 = new Set(br2);
  let bonus = 0;
  const notes: string[] = [];

  const allGroups: Array<[string, FiveElKey, "삼합" | "방합"]> = [
    ...Object.entries(SAMHAP_GROUP_ELEMENT).map(([k, v]) => [k, v, "삼합"] as [string, FiveElKey, "삼합" | "방합"]),
    ...Object.entries(BANGHAP_GROUP_ELEMENT).map(([k, v]) => [k, v, "방합"] as [string, FiveElKey, "삼합" | "방합"]),
  ];

  for (const [groupKey, el, relLabel] of allGroups) {
    const members = groupKey.split("");
    const presentInP1 = members.filter((m) => set1.has(m));
    const presentInP2 = members.filter((m) => set2.has(m));
    const unionPresent = [...new Set([...presentInP1, ...presentInP2])];
    if (unionPresent.length < 2) continue; // 흐름도 안 되는 상태

    // 한쪽 원국 혼자서 unionPresent를 전부 커버하면 상대는 아무것도 보태지 않은 것
    // — 원래 그 사람 개인 원국의 기존 구조이므로 커플 cross-formation이 아니다.
    const p1CoversAlone = unionPresent.every((m) => presentInP1.includes(m));
    const p2CoversAlone = unionPresent.every((m) => presentInP2.includes(m));
    if (p1CoversAlone || p2CoversAlone) continue;

    const isPartial = unionPresent.length === 2;
    const groupDesc = `${groupKey} ${relLabel}${isPartial ? " 흐름" : ""}`;
    const baseWeight = isPartial ? 2 : 5;

    const p1Fav = el === y1 || (!!h1 && el === h1);
    const p2Fav = el === y2 || (!!h2 && el === h2);
    const p1Gi = el === g1;
    const p2Gi = el === g2;

    let weight: number;
    let tag: string;
    if (p1Gi && p2Gi) {
      weight = 0;
      tag = "양쪽 모두 기신 강화 — 가산 없음";
    } else if (p1Gi || p2Gi) {
      weight = baseWeight * 0.4;
      tag = "한쪽 기신 부담 — 가산 축소";
    } else if (p1Fav || p2Fav) {
      weight = baseWeight;
      tag = "용신·희신 우호";
    } else {
      weight = baseWeight * 0.5;
      tag = "중립(용희신·기신 무관)";
    }
    if (weight > 0) {
      bonus += weight;
      notes.push(`${groupDesc}(${el}행, 교차 형성) — ${tag}`);
    }
  }
  return { bonus: Math.min(8, bonus), notes: [...new Set(notes)] };
}

/**
 * 일간 기준 십성 — 상대 원국 전체(연/월/시 3개, 일간쌍 제외)를 "내 일간이 상대 3글자를 어떻게
 * 보는가"로 해석만 제공한다. 일간↔일간은 scoreTenGodDelta가 전담하고, 나머지 3×2=6개 평가는
 * stemInteractionDelta가 다루는 15쌍 중 "일간이 낀" 6쌍과 정확히 겹치므로, 여기서는 숫자를
 * 전혀 더하지 않고(0점) 해석 라벨만 남겨 이중 가산을 원천 차단한다.
 */
function buildStemTenGodLabels(
  p1: ReturnType<typeof getFinalPillars>, p2: ReturnType<typeof getFinalPillars>,
  s1: string, s2: string, n1: string, n2: string,
): string[] {
  const labels: string[] = [];
  const otherKeys: PillarKey[] = ["year", "month", "hour"];
  const collect = (selfName: string, selfDayStem: string, otherName: string, other: ReturnType<typeof getFinalPillars>) => {
    const found: string[] = [];
    for (const k of otherKeys) {
      const stem = other[k]?.hangul?.[0];
      if (!stem) continue;
      const tg = getTenGod(selfDayStem, stem);
      if (tg) found.push(`${k === "year" ? "연" : k === "month" ? "월" : "시"}간=${tg}`);
    }
    if (found.length > 0) {
      labels.push(`${selfName}의 일간 기준 ${otherName} 원국: ${found.join(", ")}`);
    }
  };
  collect(n1, s1, n2, p2);
  collect(n2, s2, n1, p1);
  return labels;
}

/**
 * 배우자성 ↔ 실제 상대 대응도 — 큰 독립 점수가 아니라 romanceRaw에만 들어가는 소폭 modifier다.
 * "recognition"(상대 일간이 내 배우자성 오행에 해당 — 배우자/연애 대상으로 인식되기 쉬운 구조적
 * 신호, 그 자체로는 작은 +2)과 "quality"(그 배우자성 오행이 내 용신·희신인지 기신인지)를 서로
 * 다른 evidence로 분리해 둔다. quality가 기신이어도 recognition을 지우거나 부호를 뒤집지 않고
 * "인식은 되지만 quality는 상쇄됨"이 그대로 보이도록 둘 다 남긴다. quality는 recognition이 성립할
 * 때만(=실제로 상대 일간이 배우자성에 해당할 때만) 의미가 있으므로 recognition 미성립 시 계산하지
 * 않는다.
 */
interface SpouseStarEvidence { label: string; magnitude: number; direction: "우호" | "비우호" }

function spouseStarEvidenceOneWay(
  selfName: string, selfDayStem: string, selfGender: "남" | "여" | undefined,
  otherName: string, otherDayStem: string,
  selfYongshin: FiveElKey, selfHeesin: FiveElKey | undefined, selfGisin: FiveElKey,
): SpouseStarEvidence[] {
  const dmEl = STEM_ELEMENT[selfDayStem];
  const otherEl = STEM_ELEMENT[otherDayStem];
  if (!dmEl || !otherEl || !selfGender) return [];
  const spouseStarEl: FiveElKey = selfGender === "여" ? getController(dmEl) : CONTROLS[dmEl];
  if (otherEl !== spouseStarEl) return [];

  const evidence: SpouseStarEvidence[] = [
    {
      label: `${otherName}의 일간이 ${selfName}의 배우자성(${spouseStarEl})에 해당 — 배우자·연애 대상으로 인식되기 쉬움`,
      magnitude: 2,
      direction: "우호",
    },
  ];
  if (spouseStarEl === selfYongshin || spouseStarEl === selfHeesin) {
    evidence.push({
      label: `${selfName}의 배우자성 오행(${spouseStarEl})이 용신/희신과 일치 — quality 우호`,
      magnitude: 2.5,
      direction: "우호",
    });
  } else if (spouseStarEl === selfGisin) {
    evidence.push({
      label: `${selfName}의 배우자성 오행(${spouseStarEl})이 기신과 겹침 — quality 비우호(인식 자체는 유지)`,
      magnitude: 3.5,
      direction: "비우호",
    });
  }
  return evidence;
}

export function scoreSpouseStarModifier(
  n1: string, s1: string, gender1: "남" | "여" | undefined, y1: FiveElKey, h1: FiveElKey | undefined, g1: FiveElKey,
  n2: string, s2: string, gender2: "남" | "여" | undefined, y2: FiveElKey, h2: FiveElKey | undefined, g2: FiveElKey,
): { modifier: number; evidence: SpouseStarEvidence[] } {
  const evidence = [
    ...spouseStarEvidenceOneWay(n1, s1, gender1, n2, s2, y1, h1, g1),
    ...spouseStarEvidenceOneWay(n2, s2, gender2, n1, s1, y2, h2, g2),
  ];
  const raw = evidence.reduce((acc, e) => acc + (e.direction === "우호" ? e.magnitude : -e.magnitude), 0);
  const modifier = Math.max(-5, Math.min(5, raw)); // 전체 cap ±5
  return { modifier, evidence };
}

function classifyRelationshipType(romance: number, marriage: number): RelationshipTypeLabel {
  const romanceHigh = romance >= 65;
  const marriageHigh = marriage >= 65;
  const romanceLow = romance < 45;
  const marriageLow = marriage < 45;
  if (romanceHigh && marriageHigh) return "연애·결혼 모두 적합";
  if (romanceLow && marriageLow) return "연애·결혼 모두 난이도 높음";
  if (romanceHigh && !marriageHigh) return "연애 우세 · 결혼 조율 필요";
  if (!romanceHigh && marriageHigh) return "연애는 천천히 · 결혼 적합 우세";
  return "조건부 적합(양쪽 다 무난)";
}

/**
 * scoreSpousePalaceDelta/scoreMonthBranchDelta의 "무관"(두 지지 사이에 아무 관계도 없음)
 * 기본값은 +6/+4 같은 flat 양수를 돌려주는데, 이건 "명확한 우호 구조"가 아니라 "특별한
 * 악재가 없다"는 뜻이다. 적합도 공식에서 그대로 증폭(×1.8 등)하면 "충이 없음"이 "강한
 * 적합성"으로 둔갑하므로, neutral 케이스는 훨씬 작은 값으로 눌러서 넘긴다.
 */
function normalizeNeutralDelta(delta: number, note: string): number {
  return note.includes("무관") ? delta * 0.2 : delta;
}

function buildRomanceMarriageFit(
  dmDelta: number, spDeltaRaw: number, spNote: string, mbDeltaRaw: number, mbNote: string, biDelta: number,
  ecDelta: number, tgDelta: number, yongDelta: number, stemDelta: number, spouseStarModifier: number,
  avgSpousePalaceStability: number,
  br1: string[], br2: string[],
  y1: FiveElKey, h1: FiveElKey | undefined, g1: FiveElKey,
  y2: FiveElKey, h2: FiveElKey | undefined, g2: FiveElKey,
): RomanceMarriageFit {
  const spDelta = normalizeNeutralDelta(spDeltaRaw, spNote);
  const mbDelta = normalizeNeutralDelta(mbDeltaRaw, mbNote);

  const romanceRaw =
    dmDelta * 1.2 + tgDelta * 1.2 + biDelta * 1.3 + yongDelta * 1.1 +
    ecDelta * 1.0 + mbDelta * 0.8 + spDelta * 0.4 + stemDelta * 1.1 + spouseStarModifier;
  const romanceScore = Math.max(0, Math.min(100, Math.round(50 + romanceRaw)));

  const { bonus: groupBonus, notes: marriageGroupStructureNotes } = marriageGroupStructureBonus(
    br1, br2, y1, h1, g1, y2, h2, g2,
  );
  // netDelta는 sp/bi/mb/dm에서 이미 파생된 boolean 요약이라 별도로 더하면 같은 근거를
  // 중복 가산하게 되므로 사용하지 않는다(투명성 보고 참고). 배우자성 modifier는 "관계 형성/끌림"
  // 의미가 강해 romanceRaw에만 반영하고 marriageRaw에는 더하지 않는다(설계 승인 사항).
  const marriageRaw =
    spDelta * 1.8 + (avgSpousePalaceStability - 50) * 0.3 + yongDelta * 1.3 + mbDelta * 1.1 +
    biDelta * 0.9 + dmDelta * 0.5 + ecDelta * 0.5 + tgDelta * 0.3 + stemDelta * 0.4 + groupBonus;
  const marriageScore = Math.max(0, Math.min(100, Math.round(50 + marriageRaw)));

  const relationshipType = classifyRelationshipType(romanceScore, marriageScore);

  const romanceNote = romanceScore >= 65
    ? "연인으로서 서로 끌리고 관계를 형성·유지하기 쉬운 구조입니다."
    : romanceScore < 45
      ? "연애 감정의 자연스러운 형성·유지에는 서로 조율이 필요한 구조입니다."
      : "연애 적합도는 무난한 중간 수준입니다.";
  const marriageNote = marriageScore >= 65
    ? "장기 배우자로서 생활·책임·갈등을 운영하기 비교적 수월한 구조입니다."
    : marriageScore < 45
      ? "장기 배우자 관계에서는 생활·책임·갈등 운영에 조율이 더 필요한 구조입니다."
      : "결혼 적합도는 무난한 중간 수준입니다.";

  return { romanceScore, marriageScore, relationshipType, romanceNote, marriageNote, marriageGroupStructureNotes };
}

// ── Main export ──────────────────────────────────────────────────────────

export function calculateCompatibilityScore(
  person1: PersonRecord,
  person2: PersonRecord,
  relType?: RelationshipType,
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
  const dm   = scoreDayMasterDelta(s1, s2, relType);
  const sp   = scoreSpousePalaceDelta(b1, b2, relType);
  const mb   = scoreMonthBranchDelta(m1, m2, relType);
  const bi   = scoreBranchInteractionDelta(p1, p2);
  const stem = scoreStemInteractionDelta(p1, p2);
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
    { category: "천간 전체 교차", delta: stem.delta, note: stem.note },
    { category: "오행 보완도",    delta: ec.delta,   note: ec.note },
    { category: "십성 궁합",      delta: tg.delta,   note: tg.note },
    { category: "용신 보완",      delta: yong.delta, note: yong.note },
  ];

  // ── Phase 2: Core(dm+sp+mb)/Aux(bi+stem+ec+tg+yong) 2계층 ──
  const coreAux = computeCoreAuxBreakdown(dm.delta, sp.delta, mb.delta, [
    bi.delta, stem.delta, ec.delta, tg.delta, yong.delta,
  ]);
  const baseScore = Math.round(
    clampRange(50 + coreAux.coreContribution + coreAux.auxContribution, 0, 100),
  );

  // ── Structural flags ── (Core/Aux와 중복되는 4개 플래그는 감사 후 제거 — computeStructuralSteps 주석 참고)
  const flags: StructuralFlags = {
    spousePalaceMultiTension: sp.spousePalaceTensions.length >= 2,
  };

  const baseType = gradeFromScore(baseScore);
  const { steps: structuralSteps, netDelta } = computeStructuralSteps(flags, relType);
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

  const spouseStarResult = (() => {
    if (!pipe1 || !pipe2) return { modifier: 0, evidence: [] as SpouseStarEvidence[] };
    const y1v = pipe1.adjusted.effectiveYongshin;
    const y2v = pipe2.adjusted.effectiveYongshin;
    return scoreSpouseStarModifier(
      person1.birthInput.name, s1, person1.birthInput.gender, y1v, pipe1.adjusted.effectiveYongshinSecondary, getController(y1v),
      person2.birthInput.name, s2, person2.birthInput.gender, y2v, pipe2.adjusted.effectiveYongshinSecondary, getController(y2v),
    );
  })();

  // ── [Phase 3] Human / Romance / Marriage 목적별 3-모델 ── (독립 계산, legacy
  // totalScore·romanceMarriageFit은 변경하지 않음. marriageGroupStructureBonus는
  // romanceMarriageFit 내부에서도 별도로 계산되므로 여기서 다시 호출해도 이중 가산이
  // 아니다 — 순수 함수를 서로 다른 두 결과 필드에 각각 쓰는 것뿐이다.)
  const dba = scoreDayBranchAffinityDelta(b1, b2);
  const spousePalaceMultiTension = sp.spousePalaceTensions.length >= 2;

  const marriageGroupBonusValue = (() => {
    if (!pipe1 || !pipe2) return 0;
    const y1v = pipe1.adjusted.effectiveYongshin;
    const y2v = pipe2.adjusted.effectiveYongshin;
    return marriageGroupStructureBonus(
      br1, br2,
      y1v, pipe1.adjusted.effectiveYongshinSecondary, getController(y1v),
      y2v, pipe2.adjusted.effectiveYongshinSecondary, getController(y2v),
    ).bonus;
  })();

  const humanCompatibility = computeHumanCompatibility(
    dm.delta, mb.delta, dba.delta,
    [bi.delta, stem.delta, ec.delta, yong.delta],
  );
  const romanceCompatibility = computeRomanceCompatibility(
    dm.delta, sp.delta, mb.delta,
    [bi.delta, stem.delta, ec.delta, tg.delta, yong.delta],
    spouseStarResult.modifier,
    spousePalaceMultiTension,
    relType,
  );
  const marriageCompatibility = computeMarriageCompatibility(
    sp.delta, mb.delta, dm.delta,
    [bi.delta, stem.delta, ec.delta, tg.delta, yong.delta],
    marriageGroupBonusValue,
    spousePalaceMultiTension,
    relType,
  );

  const romanceMarriageFit: RomanceMarriageFit = (() => {
    if (!pipe1 || !pipe2) {
      return buildRomanceMarriageFit(
        dm.delta, sp.delta, sp.note, mb.delta, mb.note, bi.delta, ec.delta, tg.delta, yong.delta,
        stem.delta, spouseStarResult.modifier,
        50, br1, br2, "목", undefined, "금", "목", undefined, "금",
      );
    }
    const y1v = pipe1.adjusted.effectiveYongshin;
    const y2v = pipe2.adjusted.effectiveYongshin;
    const avgSpousePalaceStability =
      (pipe1.evaluations.spousePalaceStability.score + pipe2.evaluations.spousePalaceStability.score) / 2;
    return buildRomanceMarriageFit(
      dm.delta, sp.delta, sp.note, mb.delta, mb.note, bi.delta, ec.delta, tg.delta, yong.delta,
      stem.delta, spouseStarResult.modifier,
      avgSpousePalaceStability, br1, br2,
      y1v, pipe1.adjusted.effectiveYongshinSecondary, getController(y1v),
      y2v, pipe2.adjusted.effectiveYongshinSecondary, getController(y2v),
    );
  })();

  const stemTenGodLabels = buildStemTenGodLabels(p1, p2, s1, s2, person1.birthInput.name, person2.birthInput.name);

  const details: CompatibilityResult["details"] = [
    { title: "일간 분석",  description: dm.note,   isPositive: dm.delta >= 0 },
    { title: "배우자궁",   description: sp.note,   isPositive: sp.delta >= 0 },
    { title: "월지 교차",  description: mb.note,   isPositive: mb.delta >= 0 },
    { title: "지지 교차",  description: bi.note,   isPositive: bi.delta >= 0 },
    { title: "천간 교차",  description: stem.note, isPositive: stem.delta >= 0 },
    { title: "오행 보완",  description: ec.note,   isPositive: ec.delta >= 0 },
    { title: "십성 관계",  description: tg.note,   isPositive: tg.delta >= 0 },
    { title: "용신 보완",  description: yong.note, isPositive: yong.delta >= 0 },
    ...(stemTenGodLabels.length > 0
      ? [{ title: "십성(원국 전체, 해석 참고용)", description: stemTenGodLabels.join(" / "), isPositive: true }]
      : []),
    ...(spouseStarResult.evidence.length > 0
      ? [{
          title: "배우자성 대응(연애 적합도 소폭 반영)",
          description: spouseStarResult.evidence.map((e) => e.label).join(" / "),
          isPositive: spouseStarResult.modifier >= 0,
        }]
      : []),
    ...(pipe1 && pipe2 ? buildStructureCompatDetails(pipe1, pipe2, person1.birthInput.name, person2.birthInput.name) : []),
  ];

  const spouseActivationYears1 = buildSpouseActivationYearsForPerson(pipe1, person1);
  const spouseActivationYears2 = buildSpouseActivationYearsForPerson(pipe2, person2);
  const spouseActivationTiming: SpouseActivationTimingBlock | null =
    spouseActivationYears1 && spouseActivationYears2
      ? { person1: spouseActivationYears1, person2: spouseActivationYears2 }
      : null;

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
    spouseActivationTiming,
    romanceMarriageFit,
    coreAux,
    humanCompatibility,
    romanceCompatibility,
    marriageCompatibility,
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
