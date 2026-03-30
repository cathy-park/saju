import type { PersonRecord } from "./storage";
import { getFinalPillars } from "./storage";
import { getDayGanZhi, getYearGanZhi, getMonthGanZhi, calculateDaewoon } from "./luckCycles";
import { getTenGod } from "./tenGods";
import { getTwelveStage } from "./twelveStages";

const STEM_ELEMENT: Record<string, string> = {
  갑: "목", 을: "목", 병: "화", 정: "화",
  무: "토", 기: "토", 경: "금", 신: "금",
  임: "수", 계: "수",
};

const ELEMENT_FLOW_LABEL: Record<string, string> = {
  목: "성장·발전 흐름",
  화: "열정·활기 흐름",
  토: "안정·중심 흐름",
  금: "결단·수확 흐름",
  수: "지혜·내면 흐름",
};

const ELEMENT_COLORS: Record<string, string> = {
  목: "text-green-700 bg-green-50",
  화: "text-red-700 bg-red-50",
  토: "text-yellow-700 bg-yellow-50",
  금: "text-gray-600 bg-gray-100",
  수: "text-blue-700 bg-blue-50",
};

// Ten-god fortune interpretations
const TG_FORTUNE: Record<string, {
  summary: string;
  keywords: string[];
  guidance: string;
}> = {
  비견: {
    summary: "자립과 협력 에너지가 강합니다",
    keywords: ["자립운", "협력", "독립심"],
    guidance: "경쟁보다 협력으로 접근하면 좋은 결과를 얻을 수 있습니다.",
  },
  겁재: {
    summary: "변동과 경쟁 기운이 강한 날입니다",
    keywords: ["경쟁", "변화", "충돌주의"],
    guidance: "재물 관리에 신중하고 충동적 결정을 피하세요.",
  },
  식신: {
    summary: "창의력과 표현력이 빛나는 날입니다",
    keywords: ["창의운", "표현", "식복"],
    guidance: "아이디어를 적극적으로 표현하고 행동으로 옮기기 좋습니다.",
  },
  상관: {
    summary: "표현 욕구가 강하나 감정 기복에 주의하세요",
    keywords: ["표현운", "감정", "주의"],
    guidance: "말과 행동을 신중히 하고 감정 조절에 유의하세요.",
  },
  편재: {
    summary: "활동적 재물 기운이 들어오는 날입니다",
    keywords: ["재운", "활동", "기회"],
    guidance: "적극적인 행동과 대외 활동이 이득을 가져올 수 있습니다.",
  },
  정재: {
    summary: "안정적 재물과 성실한 노력의 날입니다",
    keywords: ["재운", "안정", "계획"],
    guidance: "꼼꼼한 계획과 실행이 좋은 결과를 만드는 날입니다.",
  },
  편관: {
    summary: "강한 에너지와 승부욕이 높아집니다",
    keywords: ["직업운", "도전", "주의"],
    guidance: "목표 지향적으로 움직이되 무리한 대결은 피하세요.",
  },
  정관: {
    summary: "명예와 직업 기운이 좋은 날입니다",
    keywords: ["직업운", "명예", "질서"],
    guidance: "원칙을 지키며 공식적인 일에 집중하기 좋습니다.",
  },
  편인: {
    summary: "직관과 내면의 사유가 활발해집니다",
    keywords: ["직관운", "학문운", "내면"],
    guidance: "혼자만의 시간을 통해 통찰을 얻기 좋은 날입니다.",
  },
  정인: {
    summary: "학문과 안정, 보호 기운이 강한 날입니다",
    keywords: ["학문운", "보호", "안정"],
    guidance: "배움과 계획에 집중하면 에너지가 잘 흘러갑니다.",
  },
};

const DEFAULT_FORTUNE = {
  summary: "평온하고 균형 잡힌 하루입니다",
  keywords: ["안정", "균형", "내실"],
  guidance: "큰 변화보다는 일상을 충실히 보내기 좋은 날입니다.",
};

export function getTenGodFortune(tg: string | undefined): { summary: string; guidance: string } {
  if (!tg) return DEFAULT_FORTUNE;
  return TG_FORTUNE[tg] ?? DEFAULT_FORTUNE;
}

// Gender-specific relationship fortune by ten-god
const RELATIONSHIP_SIGNAL: Record<string, Record<string, string>> = {
  남: {
    편재: "인연·이성운 상승",
    정재: "안정적 관계 진전",
    식신: "매력 발산, 인연운 활발",
    상관: "이성 관심 증가, 감정 기복 주의",
  },
  여: {
    편관: "인연·이성운 상승",
    정관: "안정적 관계 진전",
    식신: "표현력으로 매력 발산",
    상관: "자기표현 강함, 관계 긴장 가능",
  },
};

export interface LuckLayer {
  label: string;
  ganZhi: string;
  hanja: string;
  flowLabel: string;
  element?: string;
  elementColor?: string;
  tenGod?: string;
  branchTenGod?: string;
  twelveStage?: string;
}

export type FortuneTone = "positive" | "neutral" | "caution";

const POSITIVE_TG = new Set(["식신", "정재", "정관", "정인", "편재"]);
const CAUTION_TG  = new Set(["겁재", "상관", "편관"]);

export function getFortuneTone(dayTG: string | null): FortuneTone {
  if (!dayTG) return "neutral";
  if (POSITIVE_TG.has(dayTG)) return "positive";
  if (CAUTION_TG.has(dayTG)) return "caution";
  return "neutral";
}

// ── Domain Fortune ────────────────────────────────────────────────

export interface DomainFortune {
  domain: "관계" | "재물" | "건강" | "일";
  icon: string;
  level: "good" | "neutral" | "caution";
  label: string;
  hint: string;
}

type DomainRow = [DomainFortune["level"], string, string];

const DOMAIN_MAP: Record<string, [DomainRow, DomainRow, DomainRow, DomainRow]> = {
  비견: [["neutral","보통","독립·협력 에너지"],["neutral","보통","꾸준한 노력 필요"],["good","양호","자기 중심 에너지"],["neutral","보통","독자적 행동 유리"]],
  겁재: [["caution","주의","충돌·경쟁 주의"],["caution","주의","재물 손실 주의"],["neutral","보통","과로 주의"],["caution","주의","충동 결정 자제"]],
  식신: [["good","상승","인연·매력 발산"],["good","상승","식복과 기회 흐름"],["good","활발","활력 넘치는 하루"],["good","상승","창의·표현 발휘"]],
  상관: [["caution","주의","감정 기복 조심"],["neutral","보통","활동적 재물 가능"],["neutral","보통","감정 관리 중요"],["good","창의","표현·아이디어 강함"]],
  편재: [["good","활발","새로운 인연 가능"],["good","상승","활동적 재물운"],["neutral","보통","무리하지 않기"],["good","상승","대외 활동 유리"]],
  정재: [["good","안정","안정적 관계 진전"],["good","상승","성실한 노력의 보상"],["good","양호","꾸준한 체력 유지"],["good","상승","계획 실행에 좋음"]],
  편관: [["caution","긴장","관계 압박 가능"],["neutral","보통","직업 통한 수입"],["caution","주의","스트레스 주의"],["good","상승","승부욕·도전 기운"]],
  정관: [["good","안정","안정적 관계 진전"],["good","안정","공식 경로 수입"],["good","양호","균형 잡힌 컨디션"],["good","상승","명예·질서 기운"]],
  편인: [["neutral","내향","혼자 시간 선호"],["neutral","보통","직관으로 기회 포착"],["good","양호","내면 에너지 충전"],["neutral","보통","독창적 사고 강함"]],
  정인: [["good","안정","보호·신뢰 관계"],["neutral","보통","안정 중심 재물관"],["good","양호","휴식과 회복에 좋음"],["good","상승","학습·계획에 최적"]],
};

const DOMAIN_DEFAULTS: [DomainRow, DomainRow, DomainRow, DomainRow] = [
  ["neutral","보통","평온한 관계 흐름"],
  ["neutral","보통","안정적 재물 흐름"],
  ["neutral","보통","균형 있는 컨디션"],
  ["neutral","보통","일상에 충실한 날"],
];

const DOMAIN_META: [DomainFortune["domain"], string][] = [
  ["관계", "👥"],
  ["재물", "💰"],
  ["건강", "💪"],
  ["일",   "⭐"],
];

export function getDomainFortunes(dayTG: string | null): DomainFortune[] {
  const rows = (dayTG && DOMAIN_MAP[dayTG]) ? DOMAIN_MAP[dayTG] : DOMAIN_DEFAULTS;
  return rows.map(([level, label, hint], i) => ({
    domain: DOMAIN_META[i][0],
    icon:   DOMAIN_META[i][1],
    level,
    label,
    hint,
  }));
}

export interface TodayFortuneData {
  dateLabel: string;
  dayGanZhiStr: string;
  dayGanZhiHanja: string;
  dayElement?: string;
  dayTenGod?: string;
  summary: string;
  keywords: string[];
  guidance: string;
  basisKeywords: string[];
  relationshipSignal?: string;
  luckLayers: LuckLayer[];
  tone: FortuneTone;
  domainFortunes: DomainFortune[];
}

export function getFortuneForDate(
  record: PersonRecord,
  year: number,
  month: number,
  day: number,
): TodayFortuneData {
  const pillars = getFinalPillars(record);
  const dayStem = pillars.day?.hangul?.[0] ?? "";
  const gender = record.birthInput.gender;

  const dayGZ = getDayGanZhi(year, month, day);
  const monthGZ = getMonthGanZhi(year, month);
  const yearGZ = getYearGanZhi(year);
  const daewoon = calculateDaewoon(record.birthInput, record.profile.computedPillars);

  const birthYear = record.birthInput.year;
  const age = year - birthYear;
  const currentDW = daewoon.find((d) => age >= d.startAge && age <= d.endAge);

  const dayTG = dayStem ? getTenGod(dayStem, dayGZ.stem) : null;
  const fortuneBase = dayTG ? (TG_FORTUNE[dayTG] ?? DEFAULT_FORTUNE) : DEFAULT_FORTUNE;

  const relSignalMap = gender ? RELATIONSHIP_SIGNAL[gender] : {};
  const relSignal = dayTG && relSignalMap ? relSignalMap[dayTG] : undefined;

  const dayEl = STEM_ELEMENT[dayGZ.stem];

  // Build basis keywords (explains why today is this way)
  const basisKeywords: string[] = [];
  if (dayTG) basisKeywords.push(`${dayTG} 작용 활성`);
  if (dayEl) basisKeywords.push(`${dayEl} 기운 흐름`);
  if (currentDW) {
    const dwTG = dayStem ? getTenGod(dayStem, currentDW.ganZhi.stem) : null;
    if (dwTG && dwTG !== dayTG) basisKeywords.push(`대운 ${dwTG} 작용`);
  }

  const layers: LuckLayer[] = [];

  if (currentDW) {
    const el = STEM_ELEMENT[currentDW.ganZhi.stem];
    const tg = dayStem ? getTenGod(dayStem, currentDW.ganZhi.stem) : null;
    const btg = dayStem ? getTenGod(dayStem, currentDW.ganZhi.branch) : null;
    const ts = dayStem ? getTwelveStage(dayStem, currentDW.ganZhi.branch) : null;
    layers.push({
      label: "대운",
      ganZhi: currentDW.ganZhi.hangul,
      hanja: currentDW.ganZhi.hanja,
      flowLabel: el ? ELEMENT_FLOW_LABEL[el] : "전환기",
      element: el,
      elementColor: el ? ELEMENT_COLORS[el] : undefined,
      tenGod: tg ?? undefined,
      branchTenGod: btg ?? undefined,
      twelveStage: ts ?? undefined,
    });
  }

  const yearEl = STEM_ELEMENT[yearGZ.stem];
  const yearTG = dayStem ? getTenGod(dayStem, yearGZ.stem) : null;
  const yearBTG = dayStem ? getTenGod(dayStem, yearGZ.branch) : null;
  const yearTS = dayStem ? getTwelveStage(dayStem, yearGZ.branch) : null;
  layers.push({
    label: "세운",
    ganZhi: yearGZ.hangul,
    hanja: yearGZ.hanja,
    flowLabel: yearEl ? ELEMENT_FLOW_LABEL[yearEl] : "변화 흐름",
    element: yearEl,
    elementColor: yearEl ? ELEMENT_COLORS[yearEl] : undefined,
    tenGod: yearTG ?? undefined,
    branchTenGod: yearBTG ?? undefined,
    twelveStage: yearTS ?? undefined,
  });

  const monthEl = STEM_ELEMENT[monthGZ.stem];
  const monthTG = dayStem ? getTenGod(dayStem, monthGZ.stem) : null;
  const monthBTG = dayStem ? getTenGod(dayStem, monthGZ.branch) : null;
  const monthTS = dayStem ? getTwelveStage(dayStem, monthGZ.branch) : null;
  layers.push({
    label: "월운",
    ganZhi: monthGZ.hangul,
    hanja: monthGZ.hanja,
    flowLabel: monthEl ? ELEMENT_FLOW_LABEL[monthEl] : "월간 흐름",
    element: monthEl,
    elementColor: monthEl ? ELEMENT_COLORS[monthEl] : undefined,
    tenGod: monthTG ?? undefined,
    branchTenGod: monthBTG ?? undefined,
    twelveStage: monthTS ?? undefined,
  });

  const dayBTG = dayStem ? getTenGod(dayStem, dayGZ.branch) : null;
  const dayTS = dayStem ? getTwelveStage(dayStem, dayGZ.branch) : null;
  layers.push({
    label: "일운",
    ganZhi: dayGZ.hangul,
    hanja: dayGZ.hanja,
    flowLabel: dayEl ? ELEMENT_FLOW_LABEL[dayEl] : "일간 흐름",
    element: dayEl,
    elementColor: dayEl ? ELEMENT_COLORS[dayEl] : undefined,
    tenGod: dayTG ?? undefined,
    branchTenGod: dayBTG ?? undefined,
    twelveStage: dayTS ?? undefined,
  });

  return {
    dateLabel: `${year}년 ${month}월 ${day}일`,
    dayGanZhiStr: dayGZ.hangul,
    dayGanZhiHanja: dayGZ.hanja,
    dayElement: dayEl,
    dayTenGod: dayTG ?? undefined,
    summary: fortuneBase.summary,
    keywords: fortuneBase.keywords,
    guidance: fortuneBase.guidance,
    basisKeywords,
    relationshipSignal: relSignal,
    luckLayers: layers,
    tone: getFortuneTone(dayTG),
    domainFortunes: getDomainFortunes(dayTG),
  };
}

export function getTodayFortuneCard(record: PersonRecord): TodayFortuneData {
  const now = new Date();
  return getFortuneForDate(record, now.getFullYear(), now.getMonth() + 1, now.getDate());
}

export { ELEMENT_COLORS as FORTUNE_ELEMENT_COLORS };
