import type { FiveElementCount } from "./sajuEngine";
import type { PersonRecord, RelationshipType } from "./storage";
import { getFinalPillars } from "./storage";
import { getTenGod } from "./tenGods";
import { getSpousePalaceInfo, getRelationshipPattern } from "./relationshipReport";
import {
  calculateCompatibilityScore,
  COMPAT_TONE_COLOR,
  type CompatibilityTone,
  type CompatibilityResult,
} from "./compatibilityScore";
export type { CompatibilityTone } from "./compatibilityScore";
export { COMPAT_TONE_COLOR } from "./compatibilityScore";

const STEM_EL: Record<string, keyof FiveElementCount> = {
  갑: "목", 을: "목", 병: "화", 정: "화",
  무: "토", 기: "토", 경: "금", 신: "금",
  임: "수", 계: "수",
};
const BRANCH_EL: Record<string, keyof FiveElementCount> = {
  자: "수", 축: "토", 인: "목", 묘: "목",
  진: "토", 사: "화", 오: "화", 미: "토",
  신: "금", 유: "금", 술: "토", 해: "수",
};
const EL_GENERATES: Record<keyof FiveElementCount, keyof FiveElementCount> = {
  목: "화", 화: "토", 토: "금", 금: "수", 수: "목",
};
const EL_CONTROLS: Record<keyof FiveElementCount, keyof FiveElementCount> = {
  목: "토", 토: "수", 수: "화", 화: "금", 금: "목",
};

// ── Element relationship ──────────────────────────────────────────

type StemElRel = "비화" | "생" | "피생" | "극" | "피극";

function getStemElRel(stem1: string, stem2: string): StemElRel {
  const e1 = STEM_EL[stem1];
  const e2 = STEM_EL[stem2];
  if (!e1 || !e2) return "비화";
  if (e1 === e2) return "비화";
  if (EL_GENERATES[e1] === e2) return "생";
  if (EL_GENERATES[e2] === e1) return "피생";
  if (EL_CONTROLS[e1] === e2) return "극";
  if (EL_CONTROLS[e2] === e1) return "피극";
  return "비화";
}

// ── 천간합/충 ─────────────────────────────────────────────────────

const STEM_COMBINE: [string, string, string][] = [
  ["갑", "기", "토합"], ["을", "경", "금합"], ["병", "신", "수합"],
  ["정", "임", "목합"], ["무", "계", "화합"],
];
const STEM_CLASH: [string, string][] = [
  ["갑", "경"], ["을", "신"], ["병", "임"], ["정", "계"],
];

function checkStemCombine(s1: string, s2: string): string | null {
  for (const [a, b, label] of STEM_COMBINE) {
    if ((s1 === a && s2 === b) || (s1 === b && s2 === a)) return label;
  }
  return null;
}
function checkStemClash(s1: string, s2: string): boolean {
  return STEM_CLASH.some(([a, b]) => (s1 === a && s2 === b) || (s1 === b && s2 === a));
}

// ── Branch relations between two charts ──────────────────────────

const BRANCH_HAP_6: [string, string][] = [
  ["자", "축"], ["인", "해"], ["묘", "술"], ["진", "유"], ["사", "신"], ["오", "미"],
];
const BRANCH_CHUNG: [string, string][] = [
  ["자", "오"], ["축", "미"], ["인", "신"], ["묘", "유"], ["진", "술"], ["사", "해"],
];
const BRANCH_HYEONG_MAP: Record<string, string[]> = {
  인: ["사"], 사: ["신"], 신: ["인"],
  축: ["술"], 술: ["미"], 미: ["축"],
  자: ["묘"], 묘: ["자"],
  진: ["진"], 오: ["오"], 유: ["유"], 해: ["해"],
};
const BRANCH_PA: [string, string][] = [
  ["자", "유"], ["묘", "오"], ["인", "해"], ["사", "신"], ["진", "축"], ["술", "미"],
];
const BRANCH_HAE: [string, string][] = [
  ["자", "미"], ["축", "오"], ["인", "사"], ["묘", "진"], ["신", "해"], ["유", "술"],
];
const BRANCH_WONJIN: [string, string][] = [
  ["자", "미"], ["축", "오"], ["인", "유"], ["묘", "신"], ["진", "해"], ["사", "술"],
];

function branchRel(b1: string, b2: string): string[] {
  const rels: string[] = [];
  if (BRANCH_HAP_6.some(([a, b]) => (b1 === a && b2 === b) || (b1 === b && b2 === a))) rels.push("합");
  if (BRANCH_CHUNG.some(([a, b]) => (b1 === a && b2 === b) || (b1 === b && b2 === a))) rels.push("충");
  if (BRANCH_HYEONG_MAP[b1]?.includes(b2)) rels.push("형");
  if (BRANCH_PA.some(([a, b]) => (b1 === a && b2 === b) || (b1 === b && b2 === a))) rels.push("파");
  if (BRANCH_HAE.some(([a, b]) => (b1 === a && b2 === b) || (b1 === b && b2 === a))) rels.push("해");
  if (BRANCH_WONJIN.some(([a, b]) => (b1 === a && b2 === b) || (b1 === b && b2 === a))) rels.push("원진");
  return rels;
}

// ── Unified 5-type compatibility label ────────────────────────────
// CompatibilityTone and COMPAT_TONE_COLOR are re-exported from compatibilityScore.ts above

// Default descriptions (used when no relationshipType given)
const DEFAULT_TONE_DESC: Record<CompatibilityTone, string> = {
  "이상적 궁합": "서로의 에너지가 잘 어우러져 자연스럽게 조화를 이루는 이상적인 궁합입니다.",
  "좋은 궁합":   "큰 마찰 없이 서로를 편안하게 받아들이는 좋은 궁합입니다.",
  "노력형 궁합": "서로 다른 점이 있지만 이해와 노력으로 좋은 관계를 만들어 갈 수 있습니다.",
  "긴장형 궁합": "에너지 방향의 차이가 있어 충분한 소통과 배려가 필요한 관계입니다.",
  "주의 궁합":   "기운의 충돌이 강해 서로 이해하고 맞춰나가는 과정에서 상당한 노력이 요구됩니다.",
};

// Relationship-type specific descriptions
const REL_TYPE_TONE_DESC: Partial<Record<RelationshipType, Record<CompatibilityTone, string>>> = {
  lover: {
    "이상적 궁합": "감정적으로 깊이 공명하는 이상적인 연인 궁합입니다. 함께할수록 서로가 더 빛납니다.",
    "좋은 궁합":   "믿음과 편안함이 있는 연인 관계입니다. 함께하면 마음이 안정됩니다.",
    "노력형 궁합": "서로 다른 에너지가 사랑 안에서 균형을 찾아가는 연인 궁합입니다. 이해의 노력이 사랑을 깊게 합니다.",
    "긴장형 궁합": "끌리는 부분이 있으나 감정 충돌이 잦을 수 있어 충분한 소통이 필요합니다.",
    "주의 궁합":   "강한 에너지 충돌이 있어 연인 관계로 발전할 때 신중함과 깊은 배려가 필요합니다.",
  },
  spouse: {
    "이상적 궁합": "생활 방식과 가치관이 잘 맞아 함께 살아가기에 이상적인 배우자 궁합입니다.",
    "좋은 궁합":   "큰 갈등 없이 가정을 안정적으로 꾸려나갈 수 있는 배우자 궁합입니다.",
    "노력형 궁합": "생활 패턴의 차이가 있지만, 존중과 역할 분담으로 좋은 가정을 만들 수 있습니다.",
    "긴장형 궁합": "생활 방식의 차이가 크므로 상호 존중과 명확한 합의가 특히 중요합니다.",
    "주의 궁합":   "기운의 충돌이 일상에서 자주 나타날 수 있습니다. 배우자로서 강한 상호 이해가 필요합니다.",
  },
  friend: {
    "이상적 궁합": "성격이 잘 맞아 자연스럽게 깊은 우정을 쌓아갈 수 있는 친구 궁합입니다.",
    "좋은 궁합":   "편하고 오래가는 우정을 나눌 수 있는 좋은 친구 관계입니다.",
    "노력형 궁합": "서로 다른 점이 있지만 그 다름을 인정할 때 우정이 더 깊어지는 관계입니다.",
    "긴장형 궁합": "성향 차이가 커서 갈등이 생길 수 있지만, 서로를 존중하면 좋은 관계를 유지할 수 있습니다.",
    "주의 궁합":   "에너지 충돌이 잦을 수 있어 기대치 조절과 충분한 거리 조율이 필요합니다.",
  },
  coworker: {
    "이상적 궁합": "업무 스타일이 잘 맞아 시너지를 내기에 이상적인 동료 궁합입니다.",
    "좋은 궁합":   "협업 시 큰 마찰 없이 안정적으로 성과를 낼 수 있는 동료 관계입니다.",
    "노력형 궁합": "업무 방식의 차이가 있지만, 역할을 명확히 하면 효율적인 협업이 가능합니다.",
    "긴장형 궁합": "일하는 방식의 차이가 커서 충분한 소통과 명확한 역할 분담이 필요합니다.",
    "주의 궁합":   "에너지 방향이 자주 충돌할 수 있어 감정을 분리하고 업무 중심으로 소통하는 것이 중요합니다.",
  },
  family: {
    "이상적 궁합": "가족으로서 기운이 잘 맞아 편안하고 따뜻한 관계를 유지하기 쉬운 궁합입니다.",
    "좋은 궁합":   "가족으로서 큰 갈등 없이 안정적이고 화목한 관계를 유지할 수 있습니다.",
    "노력형 궁합": "성향 차이가 있지만, 가족이라는 유대감이 관계를 더 단단하게 만들어줍니다.",
    "긴장형 궁합": "기운의 충돌이 있을 수 있으나, 가족의 깊은 연결로 극복할 수 있는 관계입니다.",
    "주의 궁합":   "에너지 충돌이 강하게 나타날 수 있으므로, 가족 간의 역할 경계와 배려가 특히 중요합니다.",
  },
  other: {
    "이상적 궁합": "두 사람의 사주 기운이 자연스럽게 어우러집니다. 어떤 관계로 발전하든 좋은 흐름이 기대됩니다.",
    "좋은 궁합":   "서로에게 편안하고 안정적인 에너지를 주고받는 관계입니다. 갈등 없이 잘 어울립니다.",
    "노력형 궁합": "기운의 방향이 달라 이해와 배려가 필요한 관계입니다. 서로를 알아가는 과정이 중요합니다.",
    "긴장형 궁합": "에너지 흐름의 차이가 있어 마찰이 생길 수 있습니다. 소통과 상호 이해가 열쇠입니다.",
    "주의 궁합":   "에너지 충돌이 강해 관계 형성에 신중함이 필요합니다. 서로의 다름을 충분히 이해하는 시간이 필요합니다.",
  },
};

function getToneDesc(tone: CompatibilityTone, relType?: RelationshipType): string {
  return relType
    ? (REL_TYPE_TONE_DESC[relType]?.[tone] ?? DEFAULT_TONE_DESC[tone])
    : DEFAULT_TONE_DESC[tone];
}

// ── Stem relationship interpretation ──────────────────────────────

const STEM_REL_DESC: Record<StemElRel, { label: string; desc: string }> = {
  비화: {
    label: "비화(比和) — 같은 기운",
    desc: "두 분의 일간 오행이 같거나 비슷한 기운입니다. 서로를 잘 이해하고 공감대가 높지만, 같은 약점을 공유하거나 경쟁이 생길 수 있습니다. 서로 다른 분야에서 각자의 강점을 발휘할 때 가장 빛납니다.",
  },
  생: {
    label: "상생(相生) — 내가 상대를 돕는 관계",
    desc: "당신의 일간 기운이 상대의 일간을 자연스럽게 도와줍니다. 당신이 이끌고 상대가 그 에너지를 받아 성장하는 구조로, 헌신적이고 따뜻한 관계가 형성됩니다. 다만 일방적이 되지 않도록 균형이 필요합니다.",
  },
  피생: {
    label: "피생(被生) — 상대가 나를 돕는 관계",
    desc: "상대의 일간 기운이 당신의 일간을 생해주는 구조입니다. 상대로부터 활력과 지원을 받고, 상대는 자연스럽게 당신을 이끌려는 경향이 있습니다. 상대의 지원에 감사하고 의존을 경계할 필요가 있습니다.",
  },
  극: {
    label: "상극(相剋) — 내가 상대를 견제",
    desc: "당신의 일간 기운이 상대를 견제하는 구도입니다. 자신도 모르게 상대를 통제하거나 압박할 수 있습니다. 이 긴장이 서로를 자극해 성장시키는 원동력이 되기도 하지만, 지배-피지배 관계로 흐르지 않도록 주의가 필요합니다.",
  },
  피극: {
    label: "피극(被剋) — 상대가 나를 견제",
    desc: "상대의 일간 기운이 당신을 견제하는 구도입니다. 상대와 함께할 때 압박감이나 자극을 느낄 수 있습니다. 이것이 성장 동기가 되기도 하지만, 심한 경우 자존감에 영향을 줄 수 있으니 건강한 경계 설정이 중요합니다.",
  },
};

const TEN_GOD_COMPAT_DESC: Record<string, string> = {
  비견: "동등한 경쟁자처럼 느껴집니다. 공감은 높지만 양보가 부족할 수 있습니다.",
  겁재: "강한 경쟁의식과 동지적 유대가 공존합니다. 서로 자극을 주는 관계입니다.",
  식신: "자연스럽게 상대에게 마음을 표현하고 돌봐주고 싶은 기운입니다. 따뜻하고 헌신적입니다.",
  상관: "상대를 내 방식으로 가르치거나 이끌고 싶어집니다. 표현이 강렬하고 관계에 활기가 있습니다.",
  편재: "매력적이지만 변덕스러운 인연입니다. 설렘과 불안정이 공존합니다.",
  정재: "안정적이고 실용적인 관계를 추구합니다. 신뢰와 책임감을 중시합니다.",
  편관: "강렬하고 자극적인 인연입니다. 끌림과 긴장이 동시에 작용합니다.",
  정관: "존중과 신뢰 위에 세워진 안정적인 관계입니다. 헌신적이며 격식 있는 사랑입니다.",
  편인: "정신적·영적 연결이 있지만 거리감도 있습니다. 이해하지만 소통이 어려울 때가 있습니다.",
  정인: "상대에게서 보살핌과 가르침을 받습니다. 따뜻하고 안정적인 지원자 같은 존재입니다.",
};

// ── Day branch comparison interpretation ─────────────────────────

const BRANCH_REL_COMPAT: Record<string, { tone: string; desc: string; stability: string }> = {
  합: {
    tone: "매우 좋음",
    desc: "두 배우자궁이 합(合)을 이루어 강한 결합력과 정서적 유대감이 있습니다. 자연스럽게 끌리고 함께 있을 때 편안함을 느낍니다.",
    stability: "정서적 안정도가 높고 장기적 관계 유지에 유리합니다.",
  },
  충: {
    tone: "활력 있지만 긴장",
    desc: "두 배우자궁이 충(衝)하여 강한 에너지가 충돌합니다. 활력과 자극이 있지만 충돌과 변화가 잦을 수 있습니다.",
    stability: "관계에 기복이 있고 서로 변화를 요구하는 경향이 있습니다. 존중이 핵심입니다.",
  },
  형: {
    tone: "긴장과 자극",
    desc: "두 배우자궁이 형(刑)을 이루어 정서적 긴장이 발생합니다. 서로를 의도치 않게 불편하게 만드는 상황이 생길 수 있습니다.",
    stability: "감정 갈등이 반복될 수 있으므로 명확한 소통과 경계 설정이 필요합니다.",
  },
  파: {
    tone: "균열 주의",
    desc: "두 배우자궁이 파(破)를 이루어 관계에 균열이 생기기 쉬운 구도입니다. 오해나 어긋남이 발생하기 쉽습니다.",
    stability: "관계의 기반을 탄탄히 쌓는 노력이 필요합니다. 작은 것들을 간과하지 않는 것이 중요합니다.",
  },
  해: {
    tone: "방해 요소 존재",
    desc: "두 배우자궁이 해(害)를 이루어 외부 방해나 오해가 관계에 영향을 줄 수 있습니다.",
    stability: "서로를 향한 의심이나 외부 간섭을 경계하는 것이 필요합니다.",
  },
  없음: {
    tone: "무난한 관계",
    desc: "두 배우자궁 사이에 특별한 인연 고리는 없습니다. 극적인 끌림은 없지만 마찰도 적어 안정적입니다.",
    stability: "공통 관심사와 가치관으로 관계를 성장시켜 나갈 수 있습니다.",
  },
};

// ── Element complement ────────────────────────────────────────────

function getElementComplement(el1: FiveElementCount, el2: FiveElementCount): {
  p1Lacks: string[]; p2Lacks: string[];
  p1Comps: string[]; p2Comps: string[];
  desc: string;
} {
  const all: (keyof FiveElementCount)[] = ["목", "화", "토", "금", "수"];
  const p1Lacks = all.filter(e => el1[e] === 0);
  const p2Lacks = all.filter(e => el2[e] === 0);
  const p1Comps = p2Lacks.filter(e => el1[e] > 0);
  const p2Comps = p1Lacks.filter(e => el2[e] > 0);

  let desc = "";
  if (p1Comps.length > 0 && p2Comps.length > 0) {
    desc = `두 분이 서로의 부족한 오행을 채워주는 보완 관계입니다. ${el1}의 ${p1Comps.join("·")} 기운이 상대의 부족함을 채우고, 상대의 ${p2Comps.join("·")} 기운이 당신을 보완합니다. 매우 이상적인 오행 균형입니다.`;
  } else if (p2Comps.length > 0) {
    desc = `상대방의 ${p2Comps.join("·")} 기운이 당신에게 필요한 에너지를 보완해 줍니다. 상대를 통해 당신의 약점을 채울 수 있는 좋은 인연입니다.`;
  } else if (p1Comps.length > 0) {
    desc = `당신의 ${p1Comps.join("·")} 기운이 상대방에게 필요한 에너지를 채워줍니다. 당신이 상대를 완성시켜 주는 역할을 하게 됩니다.`;
  } else if (p1Lacks.length === 0 && p2Lacks.length === 0) {
    desc = "두 분 모두 오행이 균형 잡혀 있습니다. 서로에게 과도하게 의존하지 않고 독립적으로 균형을 유지할 수 있습니다.";
  } else {
    desc = "오행 보완 관계가 완전하지는 않습니다. 서로 다른 강점을 존중하며 부족한 부분을 함께 채워 나가는 노력이 필요합니다.";
  }
  return { p1Lacks, p2Lacks, p1Comps, p2Comps, desc };
}

// ── Marriage viewpoint ────────────────────────────────────────────

function getMarriageView(score: number, elRel: StemElRel, dayBranchRel: string): {
  type: string; typeColor: string; desc: string;
} {
  if (score >= 78 && (dayBranchRel === "합" || elRel === "생" || elRel === "피생")) {
    return {
      type: "장기 안정형",
      typeColor: "text-green-700",
      desc: "오행과 배우자궁이 서로 잘 맞아 시간이 지날수록 안정되고 깊어지는 관계입니다. 초기의 설렘이 깊은 신뢰로 성숙할 가능성이 높습니다. 결혼 후 삶의 기반을 함께 쌓아가기에 좋은 궁합입니다.",
    };
  }
  if (score >= 65 && dayBranchRel === "합") {
    return {
      type: "정서적 결합형",
      typeColor: "text-rose-600",
      desc: "배우자궁이 서로 합하여 감정적 유대가 강합니다. 서로에 대한 애착이 깊고 함께 있을 때 편안함을 느낍니다. 다만 너무 강한 정서적 의존이 현실적 문제를 가릴 수 있으니 균형이 필요합니다.",
    };
  }
  if (dayBranchRel === "충") {
    return {
      type: "자극·성장형",
      typeColor: "text-amber-600",
      desc: "배우자궁의 충(衝)이 관계를 역동적으로 만듭니다. 서로를 자극하고 성장시키는 힘이 있지만, 충돌과 변화가 잦아 안정을 찾기까지 시간이 필요합니다. 서로의 차이를 인정하면 오히려 강한 결합력이 됩니다.",
    };
  }
  if (score >= 60 && (elRel === "생" || elRel === "피생")) {
    return {
      type: "보완 성장형",
      typeColor: "text-blue-600",
      desc: "일간의 상생 관계가 서로를 돕는 구도를 만듭니다. 초기에는 일방적으로 느껴질 수 있지만, 시간이 지날수록 균형이 잡히고 서로에게 꼭 필요한 존재가 됩니다. 결혼 생활에서 역할 분담이 잘 되는 유형입니다.",
    };
  }
  if (score >= 50) {
    return {
      type: "노력형 결합",
      typeColor: "text-orange-600",
      desc: "초기 끌림은 강할 수 있지만 장기적으로 의식적인 노력이 필요한 궁합입니다. 서로의 차이가 크므로 소통과 이해의 빈도를 높이는 것이 관계의 핵심입니다. 노력한 만큼 깊어지는 관계입니다.",
    };
  }
  return {
    type: "도전형 결합",
    typeColor: "text-gray-600",
    desc: "쉽지 않은 궁합이지만 불가능하지는 않습니다. 서로에 대한 깊은 이해와 강한 의지가 전제될 때 의미 있는 관계가 됩니다. 결혼 전 충분한 대화와 현실적 조율이 필요합니다.",
  };
}

// ── Style comparison ──────────────────────────────────────────────

const STYLE_COMPAT_DESC: Record<string, Record<string, string>> = {
  "주도적·개척형": {
    "주도적·개척형": "두 사람 모두 주도적입니다. 서로 양보하는 법을 배우는 것이 관계의 핵심 과제입니다.",
    "섬세·배려형": "개척하는 사람과 세심하게 돌보는 사람의 조합으로 서로를 잘 보완합니다.",
    "열정·표현형": "모두 활동적이고 에너지가 강합니다. 관계에 활기가 넘치지만 충돌도 클 수 있습니다.",
    "헌신·감성형": "리더와 헌신적 지지자의 이상적 조합입니다. 상호 존중이 핵심입니다.",
    "안정·신뢰형": "도전자와 안정자의 균형 잡힌 조합입니다. 서로 부족한 부분을 채워 줍니다.",
    "세심·실용형": "꿈꾸는 사람과 실행하는 사람의 좋은 팀워크를 이룹니다.",
    "원칙·강인형": "두 강인한 사람의 만남입니다. 서로의 원칙을 존중하는 것이 중요합니다.",
    "예리·완벽형": "높은 기준을 가진 두 사람. 서로의 기대 수준을 조율하는 것이 필요합니다.",
    "포용·적응형": "도전자와 포용자의 좋은 균형입니다. 상대를 억압하지 않는 것이 중요합니다.",
    "직관·감수성형": "행동과 감성의 조합으로 서로에게서 배울 것이 많습니다.",
  },
  "섬세·배려형": {
    "섬세·배려형": "두 사람 모두 세심합니다. 서로를 배려하다 정작 솔직한 소통이 부족해질 수 있습니다.",
    "열정·표현형": "섬세한 사람과 표현이 풍부한 사람의 조화입니다. 감정적 균형을 찾는 것이 중요합니다.",
    "헌신·감성형": "두 사람 모두 감성적이고 헌신적입니다. 깊은 정서적 유대를 형성하지만 현실적 결정이 늦을 수 있습니다.",
    "안정·신뢰형": "배려하는 사람과 든든한 기반을 제공하는 사람의 좋은 궁합입니다.",
    "세심·실용형": "배려와 실용성이 결합되어 생활에서 잘 맞는 편입니다.",
    "원칙·강인형": "섬세한 감성과 원칙적 강직함이 서로를 보완합니다.",
    "예리·완벽형": "섬세한 두 사람입니다. 서로의 감수성을 존중하는 것이 중요합니다.",
    "포용·적응형": "배려하는 두 사람으로 따뜻한 관계를 형성합니다. 방향 결정이 늦을 수 있습니다.",
    "직관·감수성형": "감성적인 두 사람이라 깊은 공감이 가능하지만 현실적 균형이 필요합니다.",
  },
};

function getStyleCompatDesc(style1: string, style2: string): string {
  return STYLE_COMPAT_DESC[style1]?.[style2]
    ?? STYLE_COMPAT_DESC[style2]?.[style1]
    ?? `${style1} 유형과 ${style2} 유형의 만남으로, 서로의 차이를 강점으로 활용하면 좋은 관계가 됩니다.`;
}

// ── Conflict / Harmony / Tips ────────────────────────────────────

function getConflictPoints(
  elRel: StemElRel, dayBranchRel: string, el1: FiveElementCount, el2: FiveElementCount
): string[] {
  const points: string[] = [];
  if (elRel === "극" || elRel === "피극") {
    points.push("일간의 상극 관계로 인해 서로를 통제하거나 압박하려는 경향이 생길 수 있습니다.");
  }
  if (dayBranchRel === "충") {
    points.push("배우자궁의 충(衝)으로 인해 정서적 충돌이 반복될 수 있습니다. 서로의 표현 방식 차이를 이해하는 것이 중요합니다.");
  }
  if (dayBranchRel === "형") {
    points.push("배우자궁 형(刑)으로 인해 의도치 않은 상처를 주고받기 쉽습니다. 말투와 표현에 주의가 필요합니다.");
  }
  const all: (keyof FiveElementCount)[] = ["목", "화", "토", "금", "수"];
  const bothWeak = all.filter(e => el1[e] === 0 && el2[e] === 0);
  if (bothWeak.length > 0) {
    points.push(`두 사람 모두 ${bothWeak.join("·")} 오행이 부족하여, 해당 기운이 필요한 상황(${bothWeak.map(e => ({ 목: "인내·성장", 화: "열정·표현", 토: "현실·안정", 금: "결단·원칙", 수: "감성·지혜" }[e] ?? "")).join(", ")})에서 공백이 생길 수 있습니다.`);
  }
  if (elRel === "비화") {
    points.push("같은 오행 기운으로 인해 같은 약점을 공유합니다. 비슷한 문제에 함께 부딪히면 서로 지원하기 어려울 수 있습니다.");
  }
  while (points.length < 3) {
    const extras = [
      "가치관이나 생활 습관 차이로 인한 소소한 갈등이 쌓일 수 있습니다. 정기적인 솔직한 대화가 필요합니다.",
      "결정을 내리는 스타일의 차이가 갈등의 원인이 될 수 있습니다. 역할 분담을 명확히 하면 도움이 됩니다.",
      "상대에 대한 기대치가 높아 실망하기 쉬울 수 있습니다. 서로를 있는 그대로 받아들이는 연습이 필요합니다.",
    ];
    points.push(extras[points.length - points.length % 3] ?? extras[0]);
    if (points.length >= 3) break;
  }
  return points.slice(0, 3);
}

function getHarmonyPoints(
  elRel: StemElRel, dayBranchRel: string, el1: FiveElementCount, el2: FiveElementCount
): string[] {
  const points: string[] = [];
  if (elRel === "생" || elRel === "피생") {
    points.push("일간의 상생 관계로 자연스럽게 서로를 돕고 발전시키는 힘이 있습니다.");
  }
  if (dayBranchRel === "합") {
    points.push("배우자궁이 합하여 깊은 정서적 유대와 함께 있을 때의 편안함이 있습니다.");
  }
  const all: (keyof FiveElementCount)[] = ["목", "화", "토", "금", "수"];
  const oneComps = all.filter(e => (el1[e] === 0 && el2[e] > 0) || (el2[e] === 0 && el1[e] > 0));
  if (oneComps.length >= 2) {
    points.push(`서로의 부족한 오행(${oneComps.join("·")})을 채워주는 보완 관계로 함께할수록 더 완성됩니다.`);
  }
  if (elRel === "비화") {
    points.push("같은 오행 기운으로 서로를 깊이 이해하고 공감대가 자연스럽게 형성됩니다.");
  }
  while (points.length < 3) {
    const extras = [
      "서로의 강점이 다른 영역에 있어 삶의 다양한 면에서 협력하기 좋습니다.",
      "상대로부터 자신에게 없는 시각과 에너지를 얻어 개인적 성장이 가능합니다.",
      "서로를 보완하는 특성이 있어, 어려운 상황에서도 팀으로서 잘 대처할 수 있습니다.",
    ];
    points.push(extras[points.length % 3]);
    if (points.length >= 3) break;
  }
  return points.slice(0, 3);
}

function getRelationshipTips(style1: string, style2: string, tone: string): string[] {
  const general = [
    "서로의 차이를 판단하지 말고 '다름'으로 이해하세요. 상대방의 방식에서 배울 점을 찾는 습관이 관계를 깊게 합니다.",
    "정기적으로 두 사람만의 시간을 만들고, 일상의 작은 관심과 표현으로 관계를 유지하세요.",
    "갈등이 생겼을 때 즉각 반응하기보다 상대의 입장에서 먼저 생각해 보는 여유를 갖는 것이 중요합니다.",
  ];
  if (tone.includes("도전") || tone.includes("주의")) {
    return [
      "서로의 근본적인 차이를 인정하는 것에서 시작하세요. 상대를 바꾸려 하기보다 함께 맞춰가는 과정을 즐기세요.",
      "충돌이 생겼을 때 '이기는 것'보다 '해결하는 것'에 집중하세요. 관계는 협력이지 경쟁이 아닙니다.",
      "공통의 목표나 취미를 찾아 함께 시간을 보내세요. 공유하는 경험이 관계의 기반을 만듭니다.",
    ];
  }
  if (tone.includes("기복")) {
    return [
      "좋을 때의 감정을 메모해 두세요. 어려운 시기에 초기의 감정을 떠올리는 것이 도움이 됩니다.",
      "감정 기복이 있는 시기일수록 큰 결정을 미루고 일상의 안정에 집중하세요.",
      "두 사람이 함께하는 루틴을 만들어 안정적인 패턴을 확립하세요.",
    ];
  }
  return general;
}

// ── Cross-chart branch analysis ───────────────────────────────────

function getCrossBranchAnalysis(
  p1Branches: string[], p2Branches: string[]
): { positive: { desc: string }[]; negative: { desc: string }[] } {
  const positive: { desc: string }[] = [];
  const negative: { desc: string }[] = [];
  const seen = new Set<string>();

  for (const b1 of p1Branches) {
    for (const b2 of p2Branches) {
      const rels = branchRel(b1, b2);
      for (const rel of rels) {
        const key = `${rel}|${[b1, b2].sort().join(",")}`;
        if (seen.has(key)) continue;
        seen.add(key);
        if (rel === "합")  positive.push({ desc: `${b1}·${b2} 합(合) — 강한 인연의 고리, 자연스러운 결합력` });
        if (rel === "충")  negative.push({ desc: `${b1}·${b2} 충(衝) — 충돌과 변화, 서로 다른 방향을 향함` });
        if (rel === "형")  negative.push({ desc: `${b1}·${b2} 형(刑) — 정서적 긴장, 의도치 않은 상처` });
        if (rel === "파")  negative.push({ desc: `${b1}·${b2} 파(破) — 관계 균열, 어긋남 주의` });
        if (rel === "해")  negative.push({ desc: `${b1}·${b2} 해(害) — 방해·오해 요소, 불필요한 갈등 주의` });
        if (rel === "원진") negative.push({ desc: `${b1}·${b2} 원진(怨嗔) — 반목·피로감, 시간이 지날수록 멀어지는 기운` });
      }
    }
  }
  return { positive, negative };
}

// ── Main function ─────────────────────────────────────────────────

export interface FullCompatibilityReport {
  // A
  tone: string;
  toneColor: string;
  toneDesc: string;
  // B
  stemRel: {
    label: string;
    desc: string;
    me2other: string | null;
    other2me: string | null;
    me2otherDesc: string;
    other2meDesc: string;
    elRel: StemElRel;
  };
  // C
  branchComp: {
    myBranch: string;
    otherBranch: string;
    relations: string[];
    tone: string;
    desc: string;
    stability: string;
    myPalaceTitle: string;
    otherPalaceTitle: string;
  };
  // D
  stemHarmony: {
    combines: string[];
    clashes: string[];
    overallDesc: string;
  };
  // E
  crossBranch: {
    positive: { desc: string }[];
    negative: { desc: string }[];
    overallDesc: string;
  };
  // F
  elementComp: {
    p1Lacks: string[];
    p2Lacks: string[];
    p1Comps: string[];
    p2Comps: string[];
    desc: string;
  };
  // G
  styleComp: {
    person1Style: string;
    person2Style: string;
    dynamicsDesc: string;
  };
  // H
  marriageView: {
    type: string;
    typeColor: string;
    desc: string;
  };
  // I
  structural: {
    spousePalaceClash: boolean;
    spousePalaceMultiTension: boolean;
    branchClashCount: number;
    dayMasterSupportive: boolean;
    monthBranchClash: boolean;
  };
  conflictPoints: string[];
  harmonyPoints: string[];
  tips: string[];
  // J — unified score result (single source of truth)
  scoreResult: CompatibilityResult;
}

export function buildFullCompatibilityReport(
  p1: PersonRecord,
  p2: PersonRecord,
  relType?: RelationshipType
): FullCompatibilityReport {
  const pillars1 = getFinalPillars(p1);
  const pillars2 = getFinalPillars(p2);

  const s1 = pillars1.day?.hangul?.[0] ?? "";
  const s2 = pillars2.day?.hangul?.[0] ?? "";
  const b1 = pillars1.day?.hangul?.[1] ?? "";
  const b2 = pillars2.day?.hangul?.[1] ?? "";
  const el1 = p1.profile.fiveElementDistribution;
  const el2 = p2.profile.fiveElementDistribution;

  const elRel = getStemElRel(s1, s2);
  const dayBranchRels = branchRel(b1, b2);
  const dayBranchRelLabel = dayBranchRels[0] ?? "없음";

  // ── Single source of truth: compute score once ──────────────────
  const scoreResult = calculateCompatibilityScore(p1, p2);
  const score = scoreResult.baseScore;
  const tone = scoreResult.finalType;
  const toneColor = scoreResult.finalColor;
  const toneDesc = getToneDesc(tone, relType);

  // ── Structural flags (derived from scoreResult) ─────────────────
  const spousePalaceClash = scoreResult.structuralSteps.some(s => s.label === "배우자궁 충");
  const spousePalaceMultiTension = scoreResult.structuralSteps.some(s => s.label.includes("복합 긴장"));
  const dayMasterSupportive = scoreResult.adjustmentSteps[0].delta > 0;
  const crossClashCount = scoreResult.clashCount;
  const monthBranchClash = (scoreResult.adjustmentSteps.find(s => s.category === "월지 교차")?.delta ?? 0) < 0;

  const structural = {
    spousePalaceClash,
    spousePalaceMultiTension,
    branchClashCount: crossClashCount,
    dayMasterSupportive,
    monthBranchClash,
  };

  const me2other = s1 && s2 ? getTenGod(s1, s2) : null;
  const other2me = s1 && s2 ? getTenGod(s2, s1) : null;
  const stemRelInfo = STEM_REL_DESC[elRel];

  const branchComp = BRANCH_REL_COMPAT[dayBranchRelLabel] ?? BRANCH_REL_COMPAT["없음"];
  const myPalace = b1 ? getSpousePalaceInfo(b1) : null;
  const otherPalace = b2 ? getSpousePalaceInfo(b2) : null;

  // Cross-chart stems
  const stems1 = [pillars1.year, pillars1.month, pillars1.day, pillars1.hour].filter(Boolean).map(p => p!.hangul[0]);
  const stems2 = [pillars2.year, pillars2.month, pillars2.day, pillars2.hour].filter(Boolean).map(p => p!.hangul[0]);
  const branches1 = [pillars1.year, pillars1.month, pillars1.day, pillars1.hour].filter(Boolean).map(p => p!.hangul[1]);
  const branches2 = [pillars2.year, pillars2.month, pillars2.day, pillars2.hour].filter(Boolean).map(p => p!.hangul[1]);

  const combines: string[] = [];
  const clashes: string[] = [];
  const seenStemCombine = new Set<string>();
  const seenStemClash = new Set<string>();
  for (const s of stems1) {
    for (const t of stems2) {
      const c = checkStemCombine(s, t);
      const combKey = [s, t].sort().join(",");
      if (c && !seenStemCombine.has(combKey)) {
        seenStemCombine.add(combKey);
        combines.push(`${s}·${t} ${c}`);
      }
      const clashKey = [s, t].sort().join(",");
      if (checkStemClash(s, t) && !seenStemClash.has(clashKey)) {
        seenStemClash.add(clashKey);
        clashes.push(`${s}·${t} 충(衝)`);
      }
    }
  }
  const stemOverallDesc = combines.length > 0 && clashes.length === 0
    ? "천간이 합하는 부분이 있어 서로 끌리는 에너지가 있습니다."
    : clashes.length > 0 && combines.length === 0
    ? "천간의 충이 있어 관계에 긴장감이 존재합니다."
    : combines.length > 0 && clashes.length > 0
    ? "천간에 합과 충이 공존하여 끌림과 긴장이 동시에 작용합니다."
    : "특별한 천간 합충 관계는 없으며, 자연스러운 상호작용이 이루어집니다.";

  const crossBranch = getCrossBranchAnalysis(branches1, branches2);
  const crossOverall = crossBranch.positive.length > crossBranch.negative.length
    ? "두 사주 지지 사이에 좋은 인연의 고리가 더 많습니다. 자연스럽게 조화로운 관계를 형성할 가능성이 높습니다."
    : crossBranch.negative.length > crossBranch.positive.length
    ? "지지 사이에 긴장 요소가 있습니다. 서로의 차이를 이해하고 배려하는 노력이 필요합니다."
    : "지지 관계가 균형적입니다. 좋은 점과 주의할 점이 공존하는 관계입니다.";

  const elemComp = getElementComplement(el1, el2);
  const styleInfo1 = getRelationshipPattern(s1, b1, el1);
  const styleInfo2 = getRelationshipPattern(s2, b2, el2);
  const marriageView = getMarriageView(score, elRel, dayBranchRelLabel);
  const conflictPoints = getConflictPoints(elRel, dayBranchRelLabel, el1, el2);
  const harmonyPoints = getHarmonyPoints(elRel, dayBranchRelLabel, el1, el2);
  const tips = getRelationshipTips(styleInfo1.style, styleInfo2.style, tone);

  return {
    tone, toneColor, toneDesc,
    structural,
    scoreResult,
    stemRel: {
      label: stemRelInfo.label,
      desc: stemRelInfo.desc,
      me2other, other2me,
      me2otherDesc: me2other ? (TEN_GOD_COMPAT_DESC[me2other] ?? "") : "관계 없음",
      other2meDesc: other2me ? (TEN_GOD_COMPAT_DESC[other2me] ?? "") : "관계 없음",
      elRel,
    },
    branchComp: {
      myBranch: b1,
      otherBranch: b2,
      relations: dayBranchRels,
      tone: branchComp.tone,
      desc: branchComp.desc,
      stability: branchComp.stability,
      myPalaceTitle: myPalace?.title ?? `${b1}(${b1 ? "일지" : "-"})`,
      otherPalaceTitle: otherPalace?.title ?? `${b2}(${b2 ? "일지" : "-"})`,
    },
    stemHarmony: { combines, clashes, overallDesc: stemOverallDesc },
    crossBranch: { positive: crossBranch.positive.slice(0, 4), negative: crossBranch.negative.slice(0, 4), overallDesc: crossOverall },
    elementComp: { p1Lacks: elemComp.p1Lacks, p2Lacks: elemComp.p2Lacks, p1Comps: elemComp.p1Comps, p2Comps: elemComp.p2Comps, desc: elemComp.desc },
    styleComp: {
      person1Style: styleInfo1.style,
      person2Style: styleInfo2.style,
      dynamicsDesc: getStyleCompatDesc(styleInfo1.style, styleInfo2.style),
    },
    marriageView,
    conflictPoints,
    harmonyPoints,
    tips,
  };
}
