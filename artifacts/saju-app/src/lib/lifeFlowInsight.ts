import type { PersonRecord } from "./storage";
import { getFinalPillars } from "./storage";
import { getDayGanZhi, getYearGanZhi, getMonthGanZhi, calculateDaewoon } from "./luckCycles";
import { getTenGod } from "./tenGods";
import type { TimingActivationResult } from "./evaluations/luckTimingActivation";

const STEM_ELEMENT: Record<string, string> = {
  갑: "목", 을: "목", 병: "화", 정: "화",
  무: "토", 기: "토", 경: "금", 신: "금",
  임: "수", 계: "수",
};

export type FortuneLevel = "good" | "neutral" | "caution";

export interface LifeFlowCard {
  category: string;
  icon: string;
  level: FortuneLevel;
  summary: string;
  detail: string;
}

export interface OverallFlowSummary {
  emotional: string;
  decisionTiming: string;
  relationshipTendency: string;
  activityFlow: string;
  fullText: string;
}

export interface RelationshipFlowTiming {
  current: string;
  upcoming: string;
}

export interface ConnectionActivation {
  summary: string;
  period: string;
}

// ── Ten-god classification per category ──────────────────────────

type TGCategory = "relationship" | "wealth" | "health" | "performance";

const TG_CATEGORY_LEVEL: Record<TGCategory, Record<string, FortuneLevel>> = {
  relationship: {
    비견: "neutral",
    겁재: "caution",
    식신: "good",
    상관: "neutral",
    편재: "good",
    정재: "good",
    편관: "good",
    정관: "good",
    편인: "neutral",
    정인: "good",
  },
  wealth: {
    비견: "neutral",
    겁재: "caution",
    식신: "good",
    상관: "neutral",
    편재: "good",
    정재: "good",
    편관: "caution",
    정관: "neutral",
    편인: "neutral",
    정인: "neutral",
  },
  health: {
    비견: "neutral",
    겁재: "caution",
    식신: "good",
    상관: "neutral",
    편재: "neutral",
    정재: "neutral",
    편관: "caution",
    정관: "neutral",
    편인: "good",
    정인: "good",
  },
  performance: {
    비견: "neutral",
    겁재: "neutral",
    식신: "good",
    상관: "neutral",
    편재: "good",
    정재: "good",
    편관: "good",
    정관: "good",
    편인: "neutral",
    정인: "neutral",
  },
};

// ── Per-ten-god narrative snippets ────────────────────────────────

const TG_RELATIONSHIP_TEXT: Record<string, { summary: string; detail: string }> = {
  비견: {
    summary: "동등한 위치에서 협력하는 흐름입니다",
    detail: "서로 대등한 관계에서 협력과 공감이 강화됩니다. 새로운 인연보다는 기존 관계 정리에 유리합니다.",
  },
  겁재: {
    summary: "감정 기복과 갈등에 주의가 필요합니다",
    detail: "경쟁적 에너지가 관계에 긴장을 만들 수 있습니다. 중요한 감정 표현은 신중하게 접근하세요.",
  },
  식신: {
    summary: "자연스러운 매력과 표현력이 빛나는 흐름입니다",
    detail: "감정을 자연스럽게 전달할 수 있는 시기입니다. 새로운 만남에서도 편안하게 자신을 표현할 수 있습니다.",
  },
  상관: {
    summary: "감정 표현이 활발하지만 균형이 필요합니다",
    detail: "솔직한 표현이 강해지는 시기입니다. 말과 행동에서 상대방의 반응을 살피며 소통하는 것이 좋습니다.",
  },
  편재: {
    summary: "활발한 대외 교류와 인연운이 강화됩니다",
    detail: "새로운 만남의 가능성이 열리는 흐름입니다. 적극적으로 사람들과 교류하면 좋은 결과를 얻을 수 있습니다.",
  },
  정재: {
    summary: "안정적인 관계 유지와 신뢰 형성에 유리합니다",
    detail: "기존 관계를 더욱 단단하게 다지기 좋은 시기입니다. 진심 어린 표현이 관계를 깊게 만듭니다.",
  },
  편관: {
    summary: "강한 인연 에너지가 관계에 변화를 가져옵니다",
    detail: "관계에서 강한 인상을 주고받는 시기입니다. 자신의 매력을 당당하게 표현하는 것이 도움됩니다.",
  },
  정관: {
    summary: "안정적이고 신뢰 있는 관계 흐름입니다",
    detail: "책임감 있는 관계 태도가 상대방에게 좋은 인상을 줍니다. 관계의 기반을 다지기 좋습니다.",
  },
  편인: {
    summary: "독립적 성향이 강해지는 시기입니다",
    detail: "혼자만의 시간이 편안하게 느껴질 수 있습니다. 관계보다 자신의 내면을 돌보는 것에 집중하기 좋습니다.",
  },
  정인: {
    summary: "따뜻한 보호와 안정 속에 관계가 이어집니다",
    detail: "주변의 도움과 지지를 받을 수 있는 흐름입니다. 기존 관계에서 따뜻한 교감이 강화됩니다.",
  },
};

const TG_WEALTH_TEXT: Record<string, { summary: string; detail: string }> = {
  비견: {
    summary: "자립적인 재물 흐름이 강화됩니다",
    detail: "스스로의 노력으로 재물을 만드는 흐름입니다. 타인의 도움보다 자신의 능력을 믿고 움직이세요.",
  },
  겁재: {
    summary: "지출과 손실에 주의가 필요합니다",
    detail: "충동적인 소비나 리스크 있는 투자는 피하는 것이 좋습니다. 재물 관리에 신중한 시기입니다.",
  },
  식신: {
    summary: "창의적인 활동에서 재물 기회가 열립니다",
    detail: "능력을 표현하는 일이 자연스럽게 수입으로 이어질 수 있습니다. 재능을 발휘할 기회를 찾아보세요.",
  },
  상관: {
    summary: "수입 가능성은 있지만 지출도 늘어날 수 있습니다",
    detail: "적극적인 활동이 수익을 만들 수 있지만, 예상치 못한 지출도 발생할 수 있습니다. 균형을 맞추세요.",
  },
  편재: {
    summary: "적극적인 활동으로 재물 기회가 높아집니다",
    detail: "대외적인 활동과 새로운 시도에서 재물 흐름이 열릴 수 있습니다. 리스크를 계산하며 움직이세요.",
  },
  정재: {
    summary: "성실한 노력이 안정적인 재물을 만듭니다",
    detail: "꾸준한 노력이 좋은 결과로 이어지는 시기입니다. 장기적인 계획을 세우고 실행하기 좋습니다.",
  },
  편관: {
    summary: "지출보다 구조 정리에 집중하는 것이 좋습니다",
    detail: "큰 투자보다는 기존 재물을 안정적으로 관리하는 방향이 좋습니다. 무리한 결정은 자제하세요.",
  },
  정관: {
    summary: "안정적인 수입 흐름이 유지됩니다",
    detail: "책임감 있는 태도가 재물 흐름을 안정적으로 유지시킵니다. 계획적인 저축이 이 시기에 효과적입니다.",
  },
  편인: {
    summary: "재물보다 지식과 내면에 투자하는 흐름입니다",
    detail: "물질적 이득보다 장기적인 역량 개발에 투자하는 것이 유리합니다. 지식과 기술 쌓기에 좋은 시기입니다.",
  },
  정인: {
    summary: "안정적인 흐름 속에 재물이 유지됩니다",
    detail: "큰 이득보다 안정적인 유지가 이 시기의 핵심입니다. 후원이나 지원을 받을 가능성도 있습니다.",
  },
};

const TG_HEALTH_TEXT: Record<string, { summary: string; detail: string }> = {
  비견: {
    summary: "체력 소모는 있지만 회복력이 좋습니다",
    detail: "활동량이 많아지는 시기입니다. 충분한 수분 섭취와 규칙적인 생활 리듬을 유지하세요.",
  },
  겁재: {
    summary: "에너지 소모가 커질 수 있어 휴식이 중요합니다",
    detail: "과로와 스트레스가 쌓이기 쉬운 시기입니다. 무리한 일정은 조정하고 충분한 수면을 취하세요.",
  },
  식신: {
    summary: "생명력이 충만하고 건강 흐름이 좋습니다",
    detail: "몸의 리듬이 자연스럽고 회복력도 좋습니다. 즐거운 활동이 건강에도 긍정적 영향을 줍니다.",
  },
  상관: {
    summary: "감정 소비가 건강에 영향을 줄 수 있습니다",
    detail: "감정 기복이 신체 리듬에 영향을 줄 수 있습니다. 스트레스 해소법을 적극적으로 활용하세요.",
  },
  편재: {
    summary: "활동량이 많아지는 시기입니다",
    detail: "외부 활동이 활발해지는 시기입니다. 충분한 영양 보충과 균형 있는 식사를 유지하세요.",
  },
  정재: {
    summary: "꾸준한 건강 관리로 좋은 상태를 유지합니다",
    detail: "규칙적인 생활 습관이 효과를 발휘하는 시기입니다. 꾸준히 유지하는 것이 핵심입니다.",
  },
  편관: {
    summary: "긴장과 압박으로 신체 에너지 소모에 주의하세요",
    detail: "스트레스성 질환에 주의가 필요합니다. 명상이나 가벼운 운동으로 긴장을 풀어주세요.",
  },
  정관: {
    summary: "규칙적인 생활이 건강을 유지시킵니다",
    detail: "원칙적인 생활 패턴이 건강에 도움이 됩니다. 식사 시간과 수면 패턴을 규칙적으로 지키세요.",
  },
  편인: {
    summary: "휴식과 회복에 좋은 흐름입니다",
    detail: "혼자만의 조용한 시간이 심신 회복에 도움이 됩니다. 과도한 사교 활동보다는 충전의 시간을 가지세요.",
  },
  정인: {
    summary: "보호받는 안정적인 건강 흐름입니다",
    detail: "몸과 마음이 안정적으로 유지되는 시기입니다. 몸이 보내는 신호를 잘 듣고 돌보는 것이 좋습니다.",
  },
};

const TG_PERFORMANCE_TEXT: Record<string, { summary: string; detail: string }> = {
  비견: {
    summary: "자립적인 성과를 만들기 좋은 흐름입니다",
    detail: "자신의 능력으로 결과를 만드는 시기입니다. 팀보다 개인 역량 발휘에 집중하면 효과적입니다.",
  },
  겁재: {
    summary: "경쟁이 심화되어 집중력이 중요합니다",
    detail: "외부 경쟁이 강해지는 시기입니다. 핵심에 집중하고 불필요한 소모전은 피하세요.",
  },
  식신: {
    summary: "창의적인 작업과 표현에서 성과가 납니다",
    detail: "아이디어를 표현하는 일이 좋은 결과로 이어집니다. 창작, 기획, 교육 관련 활동에 유리합니다.",
  },
  상관: {
    summary: "새로운 방식으로의 도전이 성과를 만듭니다",
    detail: "기존 틀을 벗어난 시도가 주목받을 수 있습니다. 다만 충동적 결정보다는 계획적 도전이 효과적입니다.",
  },
  편재: {
    summary: "적극적인 행동이 성과로 이어지는 흐름입니다",
    detail: "외부 활동과 네트워킹에서 기회가 옵니다. 적극적으로 나서고 새로운 프로젝트에 도전해 보세요.",
  },
  정재: {
    summary: "꾸준한 노력이 착실한 성과를 쌓습니다",
    detail: "성실하게 임한 일이 인정받는 시기입니다. 빠른 성과보다는 장기적 신뢰를 쌓는 방향이 유리합니다.",
  },
  편관: {
    summary: "목표 지향적인 추진력이 발휘되는 흐름입니다",
    detail: "도전적인 목표에 에너지를 집중하면 성과를 낼 수 있습니다. 다만 무리한 일정은 조정하세요.",
  },
  정관: {
    summary: "원칙과 책임감이 명예와 성과를 만듭니다",
    detail: "공식적인 업무와 조직 내 역할에서 인정받기 좋습니다. 원칙을 지키며 성실히 임하세요.",
  },
  편인: {
    summary: "성과보다 학습과 기반 다지기에 유리합니다",
    detail: "결과보다는 역량 축적에 집중하기 좋은 시기입니다. 공부, 연구, 자기계발에 투자하세요.",
  },
  정인: {
    summary: "후원과 지지를 받아 기반이 강화됩니다",
    detail: "주변의 도움을 받아 실력을 쌓을 수 있는 시기입니다. 멘토나 후원자와의 관계를 활용하세요.",
  },
};

// ── Overall flow summary text ─────────────────────────────────────

const ELEMENT_EMOTIONAL: Record<string, string> = {
  목: "성장하고 싶은 에너지가 강합니다",
  화: "열정과 감정 에너지가 활발합니다",
  토: "차분하고 중심을 잡으려는 흐름입니다",
  금: "결단력과 정리 욕구가 강해집니다",
  수: "내면을 돌아보고 성찰하는 흐름입니다",
};

const ELEMENT_DECISION: Record<string, string> = {
  목: "새로운 시작과 도전에 유리한 타이밍입니다",
  화: "빠른 결정보다 신중한 검토가 더 효과적입니다",
  토: "안정적인 판단력으로 중요한 결정을 내리기 좋습니다",
  금: "결단이 필요한 일을 마무리하기 좋은 흐름입니다",
  수: "결정을 서두르기보다 충분히 생각하는 것이 좋습니다",
};

const ELEMENT_ACTIVITY: Record<string, string> = {
  목: "새로운 프로젝트 시작과 적극적인 활동이 유리합니다",
  화: "에너지를 집중해 빠르게 움직이는 흐름입니다",
  토: "무리한 확장보다 현재의 것을 다지는 데 집중하세요",
  금: "불필요한 것을 정리하고 핵심에 집중하기 좋습니다",
  수: "외적 활동보다 내적 준비와 계획이 더 효과적입니다",
};

// ── Main engine functions ─────────────────────────────────────────

interface LuckContext {
  daewoonTG: string | null;
  seunTG: string | null;
  wolunTG: string | null;
  ilunTG: string | null;
  ilunElement: string | null;
  seunElement: string | null;
  wolunElement: string | null;
}

function getCombinedLevel(
  ctx: LuckContext,
  category: TGCategory
): FortuneLevel {
  const table = TG_CATEGORY_LEVEL[category];
  const scores = { good: 0, neutral: 0, caution: 0 };
  const weights: Array<[string | null, number]> = [
    [ctx.daewoonTG, 1],
    [ctx.seunTG, 2],
    [ctx.wolunTG, 2],
    [ctx.ilunTG, 3],
  ];
  for (const [tg, w] of weights) {
    if (!tg) continue;
    const lvl = table[tg] ?? "neutral";
    scores[lvl] += w;
  }
  if (scores.good >= scores.neutral && scores.good >= scores.caution) return "good";
  if (scores.caution > scores.good) return "caution";
  return "neutral";
}

function getPrimaryTG(ctx: LuckContext): string | null {
  return ctx.ilunTG ?? ctx.wolunTG ?? ctx.seunTG ?? ctx.daewoonTG ?? null;
}

function getSecondaryTG(ctx: LuckContext): string | null {
  return ctx.wolunTG ?? ctx.seunTG ?? null;
}

export function getOverallFlowSummary(ctx: LuckContext, maritalStatus?: string): OverallFlowSummary {
  const el = ctx.ilunElement ?? ctx.wolunElement ?? ctx.seunElement ?? "토";
  const emotional = ELEMENT_EMOTIONAL[el] ?? "전체적으로 안정적인 흐름입니다";
  const decisionTiming = ELEMENT_DECISION[el] ?? "상황에 맞는 판단이 필요한 시기입니다";
  const activityFlow = ELEMENT_ACTIVITY[el] ?? "현재의 흐름에 맞게 활동하세요";

  const primary = getPrimaryTG(ctx);
  let relTend = "관계 교류가 자연스럽게 이어지는 흐름입니다";
  if (primary === "겁재") relTend = "관계에서 긴장이 생기기 쉬운 흐름이니 대화에 신중하세요";
  else if (primary === "식신") relTend = "감정 표현이 자연스러워 관계 교류에 유리합니다";
  else if (primary === "편관") relTend = "강한 인상을 주고받는 시기로 관계 변화 가능성이 있습니다";
  else if (primary === "편인") relTend = "혼자 있고 싶은 에너지가 강해질 수 있습니다";

  // Marital status injects context into the relationship tendency line
  const maritalNote =
    maritalStatus === "기혼" ? " 부부·가정 관계의 안정을 우선시하세요." :
    maritalStatus === "연애중" ? " 파트너와의 감정 교류에 주의를 기울이세요." :
    maritalStatus === "미혼" ? " 새로운 인연의 흐름에 귀 기울이기 좋은 시기입니다." :
    "";

  const fullText = [
    `오늘은 ${emotional}.`,
    `${relTend}.${maritalNote}`,
    `${decisionTiming}.`,
  ].join(" ");

  return { emotional, decisionTiming, relationshipTendency: relTend, activityFlow, fullText };
}

export function getLifeFlowInsights(
  ctx: LuckContext,
  _gender: string,
  maritalStatus?: string,
  finalShinsalNames?: Set<string>
): LifeFlowCard[] {
  const primary = getPrimaryTG(ctx) ?? "비견";
  const secondary = getSecondaryTG(ctx) ?? primary;

  function makeCard(
    category: TGCategory,
    label: string,
    icon: string,
    tgText: Record<string, { summary: string; detail: string }>,
    defaultSummary: string,
    defaultDetail: string
  ): LifeFlowCard {
    const level = getCombinedLevel(ctx, category);
    const primaryInfo = tgText[primary] ?? { summary: defaultSummary, detail: defaultDetail };
    const secondaryInfo = tgText[secondary];
    const detail = secondaryInfo && secondary !== primary
      ? `${primaryInfo.detail} ${secondaryInfo.summary.charAt(0).toUpperCase() + secondaryInfo.summary.slice(1)}.`
      : primaryInfo.detail;
    return { category: label, icon, level, summary: primaryInfo.summary, detail };
  }

  // Relationship card — adjusted by marital status and shinsal
  function makeRelationshipCard(): LifeFlowCard {
    const level = getCombinedLevel(ctx, "relationship");
    const primaryInfo = TG_RELATIONSHIP_TEXT[primary] ?? {
      summary: "관계가 자연스럽게 이어지는 흐름입니다",
      detail: "기존 관계를 유지하고 새로운 인연에 열려 있으세요.",
    };
    const secondaryInfo = TG_RELATIONSHIP_TEXT[secondary];
    let detail = secondaryInfo && secondary !== primary
      ? `${primaryInfo.detail} ${secondaryInfo.summary.charAt(0).toUpperCase() + secondaryInfo.summary.slice(1)}.`
      : primaryInfo.detail;

    // Marital status context
    if (maritalStatus === "기혼") {
      detail += " 배우자와의 깊은 대화로 관계의 균형을 유지하는 것이 중요합니다.";
    } else if (maritalStatus === "연애중") {
      detail += " 파트너와의 감정 흐름을 섬세하게 살피는 것이 도움이 됩니다.";
    } else if (maritalStatus === "미혼") {
      detail += " 새로운 인연의 흐름에 자연스럽게 열려 있는 자세를 유지하세요.";
    }

    // Shinsal modifier
    const hasDohwa = finalShinsalNames?.has("도화") || finalShinsalNames?.has("홍염");
    const hasYeokma = finalShinsalNames?.has("역마");
    const hasHwagae = finalShinsalNames?.has("화개");
    const hasCheoneul = finalShinsalNames?.has("천을귀인");

    if (hasDohwa) detail += " 도화·홍염 기운이 있어 매력이 발산되고 주목받기 좋은 흐름입니다.";
    if (hasYeokma) detail += " 역마 기운이 있어 관계에서 변화와 새로운 만남이 생기기 쉽습니다.";
    if (hasHwagae) detail += " 화개 기운이 있어 관계보다 내면 성찰을 중시하는 시기일 수 있습니다.";
    if (hasCheoneul) detail += " 천을귀인이 있어 귀인이나 도움을 주는 사람과의 연결 가능성이 높습니다.";

    return { category: "관계운", icon: "❤️", level, summary: primaryInfo.summary, detail };
  }

  return [
    makeRelationshipCard(),
    makeCard(
      "wealth", "재물운", "💰",
      TG_WEALTH_TEXT,
      "안정적인 재물 흐름을 유지하는 시기입니다",
      "지출을 점검하고 장기적인 계획에 집중하세요."
    ),
    makeCard(
      "health", "건강운", "🌿",
      TG_HEALTH_TEXT,
      "균형 있는 생활로 건강을 유지하세요",
      "규칙적인 수면과 식사로 에너지를 관리하세요."
    ),
    makeCard(
      "performance", "일·성과운", "⚡",
      TG_PERFORMANCE_TEXT,
      "성실한 노력이 결실을 맺는 흐름입니다",
      "집중력을 높여 핵심 과제에 에너지를 쏟으세요."
    ),
  ];
}

// ── Shinsal interpretation modifier ────────────────────────────────

export function getShinsalInsight(names: Set<string>): string | null {
  const notes: string[] = [];

  if (names.has("도화") || names.has("홍염")) {
    notes.push("도화·홍염 기운이 있어 대인 관계에서 자연스럽게 매력을 발산하고 주목받는 흐름입니다.");
  }
  if (names.has("역마")) {
    notes.push("역마 기운이 활성화되어 이동·변화·새로운 환경과의 접촉이 많아질 수 있습니다.");
  }
  if (names.has("화개")) {
    notes.push("화개 기운이 있어 혼자 성찰하고 내면을 돌아보는 시간이 많아지는 흐름입니다.");
  }
  if (names.has("천을귀인")) {
    notes.push("천을귀인 기운이 있어 어려운 상황에서도 귀인이나 도움이 나타나는 흐름입니다.");
  }
  if (names.has("겁살") || names.has("백호살")) {
    notes.push("겁살·백호살 기운이 있어 예상치 못한 상황에 주의가 필요합니다. 안전에 유의하세요.");
  }
  if (names.has("공망")) {
    notes.push("공망 기운이 있어 시작한 일이 의도대로 맺어지지 않을 수 있습니다. 무리한 추진을 자제하세요.");
  }
  if (names.has("양인살")) {
    notes.push("양인살 기운이 있어 강한 추진력과 결단력이 돋보이지만, 충동적 판단과 갈등 가능성에 유의하세요. 직선적 성향을 조율하면 큰 성과를 낼 수 있습니다.");
  }
  if (names.has("괴강살")) {
    notes.push("괴강살 기운이 있어 독특한 개성과 강한 의지를 지니며, 남다른 집중력으로 전문 분야에서 두각을 나타낼 수 있습니다.");
  }
  if (names.has("장성살")) {
    notes.push("장성살 기운이 있어 리더십과 성취 욕구가 강하게 작동하는 흐름입니다. 목표를 세우고 꾸준히 밀고 나가면 명예로운 결과를 얻을 수 있습니다.");
  }
  if (names.has("반안살")) {
    notes.push("반안살 기운이 있어 안정적으로 실력을 축적하고 보수적으로 기반을 다지는 흐름입니다.");
  }
  if (names.has("문창")) {
    notes.push("문창 기운이 있어 학업·글쓰기·창작 활동에서 좋은 흐름을 기대할 수 있습니다.");
  }
  if (names.has("학당귀인")) {
    notes.push("학당귀인 기운이 있어 학습 능력과 지적 집중력이 강화되는 흐름입니다. 연구·교육·탐구 활동에서 특히 좋은 성과를 거둘 수 있습니다.");
  }
  if (names.has("암록")) {
    notes.push("암록 기운이 있어 드러나지 않는 재물과 비공식적 기회가 숨어 있는 흐름입니다. 주변의 보이지 않는 지원이나 의외의 수입 경로에 주목하세요.");
  }
  if (names.has("복성귀인")) {
    notes.push("복성귀인 기운이 있어 위기 상황에서도 보호받고 회복하는 행운의 흐름이 있습니다.");
  }
  if (names.has("국인귀인")) {
    notes.push("국인귀인 기운이 있어 공적 분야나 조직 내에서 귀인의 도움과 공식적인 지원이 따르는 흐름입니다.");
  }
  if (names.has("천관귀인")) {
    notes.push("천관귀인 기운이 있어 명예·지위·관직 관련 흐름에서 귀인의 도움이 작동합니다.");
  }
  if (names.has("천주귀인")) {
    notes.push("천주귀인 기운이 있어 하늘의 보호와 귀인의 도움이 강하게 흐르는 시기입니다.");
  }

  if (notes.length === 0) return null;
  return notes.join(" ");
}

export function getRelationshipFlowTiming(
  ctx: LuckContext,
  daywoonTGSeries: string[],
  maritalStatus?: string
): RelationshipFlowTiming {
  const dw = ctx.daewoonTG;
  const se = ctx.seunTG;
  const wo = ctx.wolunTG;
  const isMarried = maritalStatus === "기혼";
  const isDating = maritalStatus === "연애중";

  let current: string;
  if (isMarried) {
    if (dw === "편재" || dw === "정재" || dw === "정관") {
      current = "현재 대운에서 부부 관계의 유대가 강화되는 흐름입니다.";
    } else if (dw === "겁재" || dw === "상관") {
      current = "현재 대운에서 가정 내 긴장이 생기기 쉬운 흐름입니다. 배우자와의 대화가 중요합니다.";
    } else {
      current = "현재 흐름에서는 부부 관계 안정화와 가정 균형 유지가 강조됩니다.";
    }
  } else if (isDating) {
    if (dw === "편재" || dw === "정재" || dw === "편관" || dw === "정관" || dw === "식신") {
      current = "현재 대운에서 연애 관계가 더 깊어지고 발전할 수 있는 흐름입니다.";
    } else if (dw === "겁재" || dw === "상관") {
      current = "현재 대운에서 감정 기복이나 갈등이 생기기 쉬운 시기입니다. 소통에 집중하세요.";
    } else {
      current = "현재 흐름에서는 관계 조율과 서로에 대한 이해를 깊게 하는 것이 중요합니다.";
    }
  } else {
    if (dw === "편재" || dw === "정재" || dw === "편관" || dw === "정관" || dw === "식신") {
      current = "현재 대운 흐름에서 인연 활성화 기운이 강하게 흐르고 있습니다.";
    } else if (dw === "겁재" || dw === "상관") {
      current = "현재 대운에서는 관계보다 자신의 내면 정리가 더 중요한 흐름입니다.";
    } else {
      current = "현재 흐름에서는 관계 확장보다 관계 안정화와 내면 준비가 강조됩니다.";
    }
  }

  let upcoming: string;
  if (isMarried) {
    if (wo === "편재" || wo === "정재" || wo === "정관") {
      upcoming = "다가오는 월운에서 가정 관계 흐름이 따뜻하게 활성화될 수 있습니다.";
    } else if (se === "식신") {
      upcoming = "올해 세운에서 가정 내 즐거운 에너지가 흐를 가능성이 있습니다.";
    } else {
      upcoming = "앞으로도 현재의 관계 기조를 유지하며 안정을 다지는 흐름이 이어집니다.";
    }
  } else {
    if (wo === "편재" || wo === "정재" || wo === "편관" || wo === "정관") {
      upcoming = "다가오는 월운에서 새로운 인연 흐름이 활성화될 가능성이 있습니다.";
    } else if (se === "식신" || se === "편재") {
      upcoming = "올해 세운 흐름에서 관계 연결 가능성이 높아집니다.";
    } else if (daywoonTGSeries.some((t) => ["편재", "정재", "편관", "정관"].includes(t))) {
      upcoming = "곧 이어질 운 흐름에서 관계 변화의 시기가 다가올 수 있습니다.";
    } else {
      upcoming = "다가오는 흐름에서도 현재 기조가 유지될 것으로 보입니다.";
    }
  }

  return { current, upcoming };
}

export function getConnectionActivation(
  ctx: LuckContext,
  gender: string,
  maritalStatus?: string
): ConnectionActivation {
  const tg = ctx.wolunTG ?? ctx.seunTG ?? ctx.ilunTG;
  const femalePositive = ["편관", "정관", "식신", "편재"];
  const malePositive = ["편재", "정재", "식신", "정관"];
  const positive = gender === "여" ? femalePositive : malePositive;

  const isMarried = maritalStatus === "기혼";
  const isDating = maritalStatus === "연애중";

  let summary: string;
  let period: string;

  if (isMarried) {
    if (tg && positive.includes(tg)) {
      summary = "배우자와의 관계 흐름이 따뜻하게 활성화되는 시기입니다.";
      period = "이 시기에 부부 간 솔직한 대화와 감사 표현이 관계를 더욱 단단하게 합니다.";
    } else if (tg === "편인" || tg === "정인") {
      summary = "혼자 성장하고 쉬는 시간이 오히려 관계에 긍정적 영향을 줄 수 있습니다.";
      period = "자신을 돌보는 것이 가정 안정의 기반이 됩니다.";
    } else {
      summary = "현재 흐름은 부부 관계의 일상적인 안정과 균형을 유지하는 시기입니다.";
      period = "큰 변화보다는 꾸준한 신뢰와 배려가 관계를 지켜줍니다.";
    }
  } else if (isDating) {
    if (tg && positive.includes(tg)) {
      summary = "현재 파트너와의 관계가 한 단계 발전할 수 있는 에너지가 흐릅니다.";
      period = "감정을 솔직하게 나누고, 함께하는 경험을 쌓기 좋은 시기입니다.";
    } else if (tg === "편인" || tg === "정인") {
      summary = "지금은 관계보다 개인 내면을 돌보는 것이 더 중요한 흐름입니다.";
      period = "자신을 충분히 이해하는 것이 관계 발전의 기반이 됩니다.";
    } else {
      summary = "지금은 관계를 서두르기보다 현재 흐름을 자연스럽게 유지하는 것이 좋습니다.";
      period = "작은 배려와 소통이 관계를 안정적으로 이끌어줍니다.";
    }
  } else {
    if (tg && positive.includes(tg)) {
      summary = "다가오는 몇 달 동안 새로운 사람과의 연결 가능성이 높아지는 흐름입니다.";
      period = "감정이 자연스럽게 열리는 시기이니 새로운 만남에 조금 더 열려 있어보세요.";
    } else if (tg === "편인" || tg === "정인") {
      summary = "지금은 혼자만의 시간을 통해 내면을 돌아보는 흐름입니다.";
      period = "억지로 관계를 만들기보다 자연스러운 흐름에 맡기는 것이 좋습니다.";
    } else {
      summary = "현재 흐름은 기존 관계를 다지는 데 적합한 시기입니다.";
      period = "새로운 인연보다 깊어지는 관계에 집중하세요.";
    }
  }

  return { summary, period };
}

// ── Master builder ────────────────────────────────────────────────

export interface LifeFlowInsightResult {
  ctx: LuckContext;
  overall: OverallFlowSummary;
  lifeFlows: LifeFlowCard[];
  relationshipTiming: RelationshipFlowTiming;
  connectionActivation: ConnectionActivation;
  maritalStatus?: string;
  shinsalInsight?: string;
}

export interface BuildLifeFlowInsightsOptions {
  finalShinsalNames?: Set<string>;
  /** 미지정 시 `new Date()`와 동일(기존 동작). 리포트에서는 luckCycles.wolun/ilun과 맞출 것. */
  calendarYear?: number;
  calendarMonth?: number;
  calendarDay?: number;
  /** 대운·세운 활성화 레이어 — 전체 요약 문장에 덧붙입니다. */
  timingActivation?: TimingActivationResult | null;
}

function mergeTimingIntoOverall(
  overall: OverallFlowSummary,
  timing: TimingActivationResult | null | undefined,
): OverallFlowSummary {
  if (!timing) return overall;
  const parts: string[] = [];
  if (timing.officerActivationTrend === "상승") {
    parts.push("올해 운에서 관계·사회적 역할(관성) 쪽 활성 가중이 오르는 흐름입니다.");
  } else if (timing.officerActivationTrend === "하락") {
    parts.push("올해 운에서 관성 가중은 약해져, 인연이 ‘저절로’ 굳기보다는 관계를 설계해야 하는 쪽에 가깝습니다.");
  }
  if (timing.wealthActivationTrend === "상승") {
    parts.push("재성 활성 가중이 올라 현실·수입 흐름이 원국보다 다소 유리하게 붙는 편입니다.");
  } else if (timing.wealthActivationTrend === "하락") {
    parts.push("재성 활성 가중은 낮아, 무리한 지출·확장보다 현금·리스크 관리 쪽이 맞습니다.");
  }
  if (timing.spouseActivationTrend === "하락") {
    parts.push("배우자궁 안정도는 운에서 흔들릴 수 있어, 관계 유지·약속 이행에 신경 쓸 때입니다.");
  } else if (timing.spouseActivationTrend === "상승") {
    parts.push("배우자궁(관계 기반) 안정 가중이 운에서 조금 보강되는 편입니다.");
  }
  if (parts.length === 0) return overall;
  const extra = parts.join(" ");
  return {
    ...overall,
    fullText: `${overall.fullText} ${extra}`,
    activityFlow: `${overall.activityFlow} (${extra})`,
  };
}

export function buildLifeFlowInsights(
  record: PersonRecord,
  options?: BuildLifeFlowInsightsOptions,
): LifeFlowInsightResult | null {
  const pillars = getFinalPillars(record);
  const dayStem = pillars.day?.hangul?.[0] ?? "";
  if (!dayStem) return null;

  const gender = record.birthInput.gender ?? "남";
  const maritalStatus = record.maritalStatus;
  const finalShinsalNames = options?.finalShinsalNames;

  const now = new Date();
  const year = options?.calendarYear ?? now.getFullYear();
  const month = options?.calendarMonth ?? now.getMonth() + 1;
  const day = options?.calendarDay ?? now.getDate();

  const dayGZ = getDayGanZhi(year, month, day);
  const monthGZ = getMonthGanZhi(year, month);
  const yearGZ = getYearGanZhi(year);
  const daewoon = calculateDaewoon(record.birthInput, record.profile.computedPillars);
  const age = year - record.birthInput.year;
  const currentDW = daewoon.find((d) => age >= d.startAge && age <= d.endAge);

  const ctx: LuckContext = {
    daewoonTG: currentDW ? getTenGod(dayStem, currentDW.ganZhi.stem) : null,
    seunTG: getTenGod(dayStem, yearGZ.stem),
    wolunTG: getTenGod(dayStem, monthGZ.stem),
    ilunTG: getTenGod(dayStem, dayGZ.stem),
    ilunElement: STEM_ELEMENT[dayGZ.stem] ?? null,
    seunElement: STEM_ELEMENT[yearGZ.stem] ?? null,
    wolunElement: STEM_ELEMENT[monthGZ.stem] ?? null,
  };

  const daywoonTGSeries = daewoon
    .filter((d) => d.startAge > age)
    .slice(0, 3)
    .map((d) => getTenGod(dayStem, d.ganZhi.stem) ?? "");

  const shinsalInsightText = finalShinsalNames && finalShinsalNames.size > 0
    ? getShinsalInsight(finalShinsalNames) ?? undefined
    : undefined;

  const overallBase = getOverallFlowSummary(ctx, maritalStatus);
  const overall = mergeTimingIntoOverall(overallBase, options?.timingActivation);

  return {
    ctx,
    overall,
    lifeFlows: getLifeFlowInsights(ctx, gender, maritalStatus, finalShinsalNames),
    relationshipTiming: getRelationshipFlowTiming(ctx, daywoonTGSeries, maritalStatus),
    connectionActivation: getConnectionActivation(ctx, gender, maritalStatus),
    maritalStatus,
    shinsalInsight: shinsalInsightText,
  };
}
