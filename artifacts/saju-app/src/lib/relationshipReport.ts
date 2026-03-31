import type { FiveElementCount } from "./sajuEngine";
import type { DaewoonEntry } from "./luckCycles";

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

// ── 배우자궁(일지) 해석 ──────────────────────────────────────────

export interface SpousePalaceInfo {
  branch: string;
  element: string;
  title: string;
  summary: string;
  strengths: string[];
  cautions: string[];
}

const SPOUSE_PALACE: Record<string, SpousePalaceInfo> = {
  자: {
    branch: "자", element: "수",
    title: "자수 — 감성적이고 직관적인 배우자궁",
    summary: "배우자궁에 수(水) 기운이 흘러 감수성이 풍부하고 직관적인 관계를 형성합니다.",
    strengths: ["감정적 교감이 깊어 정서적 유대가 강합니다", "직관적으로 상대를 이해하는 능력이 있습니다", "유연한 적응력으로 관계를 부드럽게 유지합니다"],
    cautions: ["감정 기복이 관계에 영향을 줄 수 있습니다", "지나친 감수성으로 오해가 생길 수 있습니다"],
  },
  축: {
    branch: "축", element: "토",
    title: "축토 — 성실하고 안정적인 배우자궁",
    summary: "배우자궁에 토(土) 기운이 자리하여 안정감과 신뢰를 중심으로 한 관계를 추구합니다.",
    strengths: ["성실하고 믿음직한 배우자를 선호합니다", "관계에서 안정과 지속성을 중시합니다", "물질적 안정을 함께 쌓아가는 것에 능합니다"],
    cautions: ["변화를 거부하면 관계가 정체될 수 있습니다", "지나친 고집이 갈등을 만들 수 있습니다"],
  },
  인: {
    branch: "인", element: "목",
    title: "인목 — 진취적이고 활동적인 배우자궁",
    summary: "배우자궁에 목(木) 기운이 강하여 활동적이고 성장 지향적인 관계를 형성합니다.",
    strengths: ["진취적인 에너지가 관계에 활력을 줍니다", "함께 성장하고 발전하는 파트너십을 이룹니다", "새로운 시도에 두려움이 없어 도전적인 관계가 가능합니다"],
    cautions: ["충동적인 결정이 관계를 불안정하게 할 수 있습니다", "지나친 독립심이 파트너에게 외로움을 줄 수 있습니다"],
  },
  묘: {
    branch: "묘", element: "목",
    title: "묘목 — 섬세하고 감성적인 배우자궁",
    summary: "배우자궁에 을목(乙木) 기운이 있어 섬세하고 예술적 감수성이 풍부한 관계를 형성합니다.",
    strengths: ["섬세한 배려로 상대를 감동시키는 능력이 있습니다", "예술·문화적 공감대를 나눌 수 있습니다", "감성적인 소통으로 깊은 친밀감을 형성합니다"],
    cautions: ["예민함이 지나치면 상처를 쉽게 받을 수 있습니다", "결단력 부족이 관계 진전을 늦출 수 있습니다"],
  },
  진: {
    branch: "진", element: "토",
    title: "진토 — 든든하고 실용적인 배우자궁",
    summary: "배우자궁에 수기(水氣)를 머금은 토(土)가 있어 실용적이면서도 깊이 있는 관계를 형성합니다.",
    strengths: ["현실적이고 실용적인 파트너십을 구축합니다", "관계의 기반을 탄탄히 다지는 능력이 있습니다", "다양한 상황에 유연하게 적응하는 배우자를 선호합니다"],
    cautions: ["완벽주의적 성향이 상대에게 부담을 줄 수 있습니다", "변화에 대한 저항이 갈등을 만들 수 있습니다"],
  },
  사: {
    branch: "사", element: "화",
    title: "사화 — 지적이고 신중한 배우자궁",
    summary: "배우자궁에 화(火) 기운이 있어 지성과 열정이 균형 잡힌 관계를 추구합니다.",
    strengths: ["지적인 교감과 깊은 대화를 중시합니다", "신중하게 상대를 선택하고 관계에 충실합니다", "목표 지향적인 파트너와 잘 어울립니다"],
    cautions: ["과도한 신중함이 관계 시작을 늦출 수 있습니다", "감정 표현이 부족하게 보일 수 있습니다"],
  },
  오: {
    branch: "오", element: "화",
    title: "오화 — 열정적이고 외향적인 배우자궁",
    summary: "배우자궁에 정화(丁火) 기운이 강하여 열정적이고 활발한 관계를 형성합니다.",
    strengths: ["열정과 에너지로 관계에 생기를 불어넣습니다", "사교적이고 외향적인 배우자와 잘 어울립니다", "감정 표현이 풍부하여 솔직한 관계를 형성합니다"],
    cautions: ["충동적인 감정 표현이 갈등을 만들 수 있습니다", "쉽게 식는 열정에 주의가 필요합니다"],
  },
  미: {
    branch: "미", element: "토",
    title: "미토 — 온화하고 감수성 있는 배우자궁",
    summary: "배우자궁에 목화(木火) 기운이 담긴 미토(未土)가 있어 감수성이 풍부하고 온화한 관계를 추구합니다.",
    strengths: ["온화하고 부드러운 성품으로 갈등을 완화합니다", "예술·문화적 감수성이 풍부한 배우자를 선호합니다", "세심한 배려로 상대를 보살피는 능력이 있습니다"],
    cautions: ["우유부단함이 관계 결정을 어렵게 할 수 있습니다", "감정적 상처에 오래 머물 수 있습니다"],
  },
  신: {
    branch: "신", element: "금",
    title: "신금 — 현실적이고 능력 있는 배우자궁",
    summary: "배우자궁에 금(金) 기운이 있어 현실적이고 능력 있는 파트너십을 추구합니다.",
    strengths: ["현실적인 판단력으로 관계를 안정적으로 유지합니다", "사회적으로 활동적인 배우자와 잘 어울립니다", "함께 성취를 이루는 파트너십에 능합니다"],
    cautions: ["너무 이성적이어서 감정 소통이 부족할 수 있습니다", "경쟁적인 성향이 갈등을 만들 수 있습니다"],
  },
  유: {
    branch: "유", element: "금",
    title: "유금 — 세련되고 완벽주의적인 배우자궁",
    summary: "배우자궁에 신금(辛金) 기운이 있어 세련되고 품격 있는 관계를 추구합니다.",
    strengths: ["높은 심미안으로 품위 있는 관계를 유지합니다", "단정하고 우아한 배우자를 선호합니다", "관계에 있어 품격과 예의를 중시합니다"],
    cautions: ["완벽주의적 성향이 상대에게 부담을 줄 수 있습니다", "비판적인 시각이 관계를 불편하게 만들 수 있습니다"],
  },
  술: {
    branch: "술", element: "토",
    title: "술토 — 충직하고 의리 있는 배우자궁",
    summary: "배우자궁에 금화(金火) 기운이 담긴 술토(戌土)가 있어 충직하고 의리를 중시하는 관계를 형성합니다.",
    strengths: ["한번 믿으면 끝까지 충실한 관계를 유지합니다", "의리와 신뢰를 최우선으로 합니다", "어려울 때 함께하는 든든한 파트너십을 형성합니다"],
    cautions: ["고집이 세어 양보가 어려울 수 있습니다", "변화보다 고수를 선택하다 관계가 정체될 수 있습니다"],
  },
  해: {
    branch: "해", element: "수",
    title: "해수 — 자유롭고 독립적인 배우자궁",
    summary: "배우자궁에 수(水) 기운이 있어 자유롭고 독립적인 관계를 추구합니다.",
    strengths: ["서로의 독립성을 존중하는 성숙한 관계를 형성합니다", "개방적인 사고로 다양한 가능성을 탐색합니다", "자유로운 소통과 넓은 포용력이 있습니다"],
    cautions: ["지나친 독립심이 친밀감 형성을 방해할 수 있습니다", "관계에 대한 구속을 싫어해 헌신이 부족해 보일 수 있습니다"],
  },
};

export function getSpousePalaceInfo(dayBranch: string): SpousePalaceInfo | null {
  return SPOUSE_PALACE[dayBranch] ?? null;
}

// ── 잘 맞는 배우자 요소 ──────────────────────────────────────────

const COMPLEMENTARY: Record<string, { branches: string[]; elements: string[]; guidance: string }> = {
  자: { branches: ["신", "진", "축"], elements: ["금", "토"], guidance: "금(金) 기운의 배우자가 수(水)를 생하여 궁합이 좋습니다. 신유(申酉)·진술축미(辰戌丑未)와 조화롭습니다." },
  축: { branches: ["사", "유", "자"], elements: ["화", "금", "수"], guidance: "자수(子水)·사화(巳火)·유금(酉金)이 보완 관계에 있습니다. 사유축(巳酉丑) 금국(金局)을 이루면 매우 강한 인연입니다." },
  인: { branches: ["해", "오", "묘"], elements: ["수", "화"], guidance: "해수(亥水)가 목(木)을 생하여 궁합이 좋습니다. 인오술(寅午戌) 화국(火局) 인연으로 활동적인 관계가 됩니다." },
  묘: { branches: ["인", "해", "미"], elements: ["수", "토"], guidance: "해수(亥水)·인목(寅木)과 조화롭습니다. 해묘미(亥卯未) 목국(木局)이 형성되면 성장 지향적인 깊은 인연입니다." },
  진: { branches: ["자", "유", "신"], elements: ["수", "금"], guidance: "자수(子水)·유금(酉金)이 좋은 보완 관계입니다. 신자진(申子辰) 수국(水局)이 되면 조화롭고 안정적인 관계가 됩니다." },
  사: { branches: ["인", "오", "술"], elements: ["목", "화"], guidance: "인목(寅木)·오화(午火)와 잘 어울립니다. 인오술(寅午戌) 화국(火局)이 되면 열정적인 강한 인연입니다." },
  오: { branches: ["인", "술", "미"], elements: ["목", "토"], guidance: "인목(寅木)이 화(火)를 생하여 생기 있는 관계가 됩니다. 인오술(寅午戌) 화국(火局)에서 특히 강한 인연입니다." },
  미: { branches: ["오", "인", "해"], elements: ["화", "목", "수"], guidance: "오화(午火)·인목(寅木)과 조화롭습니다. 해묘미(亥卯未) 목국(木局)이 형성되면 풍요롭고 감성적인 관계입니다." },
  신: { branches: ["자", "진", "사"], elements: ["수", "토", "화"], guidance: "사화(巳火)·자수(子水)와 상호 보완적입니다. 신자진(申子辰) 수국(水局)이 되면 현실적이고 안정적인 관계입니다." },
  유: { branches: ["사", "축", "신"], elements: ["화", "토"], guidance: "사화(巳火)·축토(丑土)와 잘 맞습니다. 사유축(巳酉丑) 금국(金局)이 되면 격조 있고 안정적인 관계입니다." },
  술: { branches: ["인", "오", "해"], elements: ["목", "화", "수"], guidance: "인목(寅木)·오화(午火)와 조화롭습니다. 인오술(寅午戌) 화국(火局)으로 뜨겁고 충실한 인연을 형성합니다." },
  해: { branches: ["묘", "미", "인"], elements: ["목", "화"], guidance: "인목(寅木)·묘목(卯木)이 수(水)의 기운을 받아 성장합니다. 해묘미(亥卯未) 목국(木局)이 되면 자유롭고 창의적인 관계입니다." },
};

export function getComplementaryInfo(dayBranch: string) {
  return COMPLEMENTARY[dayBranch] ?? null;
}

// ── 결혼운 시기 힌트 ──────────────────────────────────────────

export interface MarriageTimingHint {
  general: string;
  daewoonHint: string;
  favorable: string;
}

const MARRIAGE_GAN_GOD: Record<string, string[]> = {
  남: ["정관", "편관"],
  여: ["정재", "편재"],
};

const RELATIONSHIP_FAVORABLE_GODS_FOR_FEMALE = new Set(["정관", "편관", "정인", "편인"]);
const RELATIONSHIP_FAVORABLE_GODS_FOR_MALE = new Set(["정재", "편재", "식신", "상관"]);

function getTenGodLabel(dayStem: string, stem: string): string {
  const generating: Record<string, string> = { 목: "화", 화: "토", 토: "금", 금: "수", 수: "목" };
  const controlling: Record<string, string> = { 목: "토", 토: "수", 수: "화", 화: "금", 금: "목" };
  const stemEl = ({"갑":"목","을":"목","병":"화","정":"화","무":"토","기":"토","경":"금","신":"금","임":"수","계":"수"} as Record<string,string>)[stem];
  const dayEl = ({"갑":"목","을":"목","병":"화","정":"화","무":"토","기":"토","경":"금","신":"금","임":"수","계":"수"} as Record<string,string>)[dayStem];
  if (!stemEl || !dayEl) return "";
  const yangStems = new Set(["갑","병","무","경","임"]);
  const same = yangStems.has(dayStem) === yangStems.has(stem);
  if (dayEl === stemEl) return same ? "비견" : "겁재";
  if (generating[dayEl] === stemEl) return same ? "식신" : "상관";
  if (controlling[dayEl] === stemEl) return same ? "편재" : "정재";
  if (controlling[stemEl] === dayEl) return same ? "편관" : "정관";
  if (generating[stemEl] === dayEl) return same ? "편인" : "정인";
  return "";
}

export function getMarriageTimingHint(
  gender: "남" | "여",
  dayStem: string,
  daewoon: DaewoonEntry[]
): MarriageTimingHint {
  const isFemale = gender === "여";
  const favorableGods = isFemale
    ? RELATIONSHIP_FAVORABLE_GODS_FOR_FEMALE
    : RELATIONSHIP_FAVORABLE_GODS_FOR_MALE;

  const general = isFemale
    ? "정관(正官)·편관(偏官) 운이 들어오는 시기에 결혼운이 강화됩니다. 관성(官星)의 흐름을 주목하세요."
    : "정재(正財)·편재(偏財) 운이 들어오는 시기에 인연운이 활성화됩니다. 재성(財星) 흐름을 주목하세요.";

  const now = new Date().getFullYear();
  const currentAge = 30;

  const favorableRanges = daewoon
    .filter((entry) => {
      const stemGod = getTenGodLabel(dayStem, entry.ganZhi.stem);
      return favorableGods.has(stemGod);
    })
    .map((entry) => `${entry.startAge}~${entry.endAge}세`);

  const daewoonHint = favorableRanges.length > 0
    ? `대운 흐름상 ${favorableRanges.join(", ")} 시기에 관계운이 강화될 수 있습니다. (간략 추정, 참고용)`
    : "대운 흐름을 정밀 분석하면 결혼운 시기를 더 구체적으로 파악할 수 있습니다. (간략 추정)";

  const favorable = isFemale
    ? "관성이 풍부한 시기, 일지와 합(合)을 이루는 연도에 인연이 맺어지기 쉽습니다."
    : "재성이 활발한 시기, 인연의 세운(歲運)이 들어오는 해를 주목하세요.";

  return { general, daewoonHint, favorable };
}

// ── 연애/관계 패턴 요약 ──────────────────────────────────────────

export interface RelationshipPattern {
  style: string;
  styleDesc: string;
  spouseStyle: string;
  elemental: string;
  tips: string[];
}

const DAY_MASTER_STYLE: Record<string, { style: string; desc: string; spouse: string }> = {
  갑: { style: "주도적·개척형", desc: "목표를 향해 직진하는 스타일로, 관계에서도 리더 역할을 선호합니다.", spouse: "자신을 지지하고 따라줄 수 있는 배우자를 선호합니다." },
  을: { style: "섬세·배려형", desc: "부드럽고 유연하게 관계를 이어가며, 상대의 감정에 예민하게 반응합니다.", spouse: "든든하고 안정적인 버팀목이 되어줄 배우자를 바랍니다." },
  병: { style: "열정·표현형", desc: "감정을 솔직하게 표현하고 관계에 열정적으로 임합니다.", spouse: "함께 빛날 수 있는 활발하고 사교적인 배우자를 선호합니다." },
  정: { style: "헌신·감성형", desc: "깊은 감성과 헌신으로 관계를 이어가며, 정서적 교감을 중시합니다.", spouse: "자신의 마음을 알아주고 정서적 안정을 주는 배우자를 바랍니다." },
  무: { style: "안정·신뢰형", desc: "묵직하고 신뢰감 있는 관계를 추구하며, 오랜 인연을 소중히 합니다.", spouse: "함께 삶의 기반을 쌓아갈 현실적인 배우자를 선호합니다." },
  기: { style: "세심·실용형", desc: "세심하게 배려하며 실용적인 관계를 유지합니다.", spouse: "능력 있고 믿음직한 배우자를 선호합니다." },
  경: { style: "원칙·강인형", desc: "분명한 원칙과 강인한 의지로 관계를 이어가며, 솔직한 표현을 선호합니다.", spouse: "단호하고 자신감 있는 배우자를 높이 평가합니다." },
  신: { style: "예리·완벽형", desc: "예리한 감각과 높은 기준으로 관계를 평가하며, 품위를 중시합니다.", spouse: "세련되고 지적인 배우자를 선호합니다." },
  임: { style: "포용·적응형", desc: "유연하게 상황에 적응하며 넓은 포용력으로 관계를 유지합니다.", spouse: "자유를 이해하고 지적인 대화가 가능한 배우자를 선호합니다." },
  계: { style: "직관·감수성형", desc: "날카로운 직관과 풍부한 감수성으로 관계를 이어가며, 깊은 정서적 연결을 추구합니다.", spouse: "정서적으로 공감하고 깊이 있는 대화가 가능한 배우자를 선호합니다." },
};

function getElementalRelationshipDesc(counts: FiveElementCount): string {
  const total = Object.values(counts).reduce((a, b) => a + b, 0) || 1;
  const dominant = (["목","화","토","금","수"] as const).filter((el) => counts[el] / total >= 0.35);
  if (dominant.includes("화")) return "화(火) 기운이 강하여 관계에서 열정적이고 표현이 풍부합니다.";
  if (dominant.includes("수")) return "수(水) 기운이 강하여 감성적이고 직관적인 관계를 형성합니다.";
  if (dominant.includes("목")) return "목(木) 기운이 강하여 성장 지향적이고 진취적인 관계를 형성합니다.";
  if (dominant.includes("금")) return "금(金) 기운이 강하여 원칙적이고 신뢰감 있는 관계를 선호합니다.";
  if (dominant.includes("토")) return "토(土) 기운이 강하여 안정적이고 신뢰를 중시하는 관계를 형성합니다.";
  return "오행이 균형을 이루어 다양한 유형의 파트너와 잘 어울릴 수 있습니다.";
}

export function getRelationshipPattern(
  dayStem: string,
  dayBranch: string,
  counts: FiveElementCount
): RelationshipPattern {
  const styleInfo = DAY_MASTER_STYLE[dayStem];
  const spousePalace = SPOUSE_PALACE[dayBranch];
  const elementalDesc = getElementalRelationshipDesc(counts);

  const tips: string[] = [
    styleInfo?.desc ?? "",
    spousePalace?.summary ?? "",
    elementalDesc,
  ].filter(Boolean);

  return {
    style: styleInfo?.style ?? "균형형",
    styleDesc: styleInfo?.desc ?? "",
    spouseStyle: styleInfo?.spouse ?? "",
    elemental: elementalDesc,
    tips,
  };
}
