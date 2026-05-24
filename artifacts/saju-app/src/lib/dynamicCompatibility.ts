/**
 * dynamicCompatibility.ts
 *
 * 동적 궁합 — 두 사람의 현재 운 흐름(대운·세운·월운·일운)을
 * 관계 맥락으로 해석하는 계산 모듈.
 *
 * 정적 궁합(natal compatibility) = 원국 비교 → compatibilityReport.ts
 * 동적 궁합(dynamic compatibility) = 현재 타이밍 비교 → 이 파일
 */

import type { PersonRecord } from "./storage";
import { getFinalPillars } from "./storage";
import { getTenGod } from "./tenGods";
import {
  getDayGanZhi,
  getYearGanZhi,
  getMonthGanZhi,
  calculateDaewoon,
  type GanZhi,
  type DaewoonEntry,
} from "./luckCycles";

// ── Types ──────────────────────────────────────────────────────────

export type FlowOpenness = "open" | "neutral" | "closed";

export interface PersonCurrentFlow {
  name: string;
  daywoon: DaewoonEntry | null;
  sewoon: GanZhi;
  wolwoon: GanZhi;
  ilwoon: GanZhi;
  daywoonTenGod: string | null;
  sewoonTenGod: string | null;
  wolwoonTenGod: string | null;
  ilwoonTenGod: string | null;
  flowOpenness: FlowOpenness;
  flowLabel: string;
  emotionalTendency: string;
  relationshipTendency: string;
  communicationTendency: string;
}

export type AlignmentType = "둘 다 열림" | "한쪽 열림" | "교차 흐름" | "둘 다 안정" | "긴장 구간";
export type TodayLevel = "good" | "neutral" | "caution";

export interface CombinedTimingFlow {
  alignmentType: AlignmentType;
  alignmentDesc: string;
  staticModifier: string;
  todaySummary: string;
  todayLevel: TodayLevel;
}

// ── Ten-god → openness mapping ─────────────────────────────────────

function getFlowOpenness(tg: string | null): FlowOpenness {
  if (!tg) return "neutral";
  if (["식신", "편재", "정재", "편관", "정관"].includes(tg)) return "open";
  if (["겁재", "편인"].includes(tg)) return "closed";
  return "neutral";
}

function getFlowLabel(level: FlowOpenness): string {
  if (level === "open") return "열린 흐름";
  if (level === "closed") return "내향 흐름";
  return "안정 흐름";
}

// ── Ten-god narrative maps ─────────────────────────────────────────

const TG_EMOTIONAL: Record<string, string> = {
  비견: "독립적이고 자기중심적인 감정 흐름",
  겁재: "경쟁적 에너지로 감정 기복이 있을 수 있음",
  식신: "여유롭고 자연스러운 감정 표현",
  상관: "솔직하고 활발하지만 예민한 감정 흐름",
  편재: "활기차고 개방적인 감정 에너지",
  정재: "안정적이고 신중한 감정 흐름",
  편관: "강렬하고 변동이 있는 감정 흐름",
  정관: "안정되고 책임감 있는 감정 흐름",
  편인: "내성적이고 혼자만의 시간을 원하는 흐름",
  정인: "따뜻하고 수용적인 감정 흐름",
};

const TG_RELATIONSHIP: Record<string, string> = {
  비견: "동등한 위치에서 관계를 바라보는 흐름",
  겁재: "관계에서 주도권 경쟁이 생길 수 있는 흐름",
  식신: "자연스럽게 매력이 발산되어 관계가 잘 열리는 흐름",
  상관: "적극적인 표현이 많아지며 관계에 활기가 생기는 흐름",
  편재: "새로운 인연과 만남에 유리한 흐름",
  정재: "기존 관계를 안정적으로 유지하는 데 유리한 흐름",
  편관: "관계에 강한 인상과 변화가 따르는 흐름",
  정관: "신뢰와 책임감으로 관계가 단단해지는 흐름",
  편인: "관계보다 혼자를 원하는 내향적 흐름",
  정인: "주변의 배려와 지지 속에 관계가 이어지는 흐름",
};

const TG_COMMUNICATION: Record<string, string> = {
  비견: "직접적이고 대등한 소통 방식",
  겁재: "감정이 앞서 충동적인 말이 나올 수 있는 흐름",
  식신: "부드럽고 자연스러운 소통, 공감력이 높은 흐름",
  상관: "말이 많아지고 솔직해지는 흐름 — 균형 주의",
  편재: "활발하고 자유로운 소통 흐름",
  정재: "신중하고 구체적인 소통을 선호하는 흐름",
  편관: "단호하고 임팩트 있는 말이 나오는 흐름",
  정관: "논리적이고 책임감 있는 소통 흐름",
  편인: "소통보다 혼자 생각하는 시간을 원하는 흐름",
  정인: "듣는 것을 선호하고 상대를 배려하는 소통 흐름",
};

function get<T>(map: Record<string, T>, key: string | null, fallback: T): T {
  return (key && map[key]) ? map[key] : fallback;
}

// ── Main exports ───────────────────────────────────────────────────

export function computePersonCurrentFlow(
  record: PersonRecord,
  now: Date,
): PersonCurrentFlow {
  const name = record.birthInput.name;
  const pillars = getFinalPillars(record);
  const dayStem = pillars.day?.hangul?.[0] ?? "";

  const yr = now.getFullYear();
  const mo = now.getMonth() + 1;
  const dy = now.getDate();

  const sewoon = getYearGanZhi(yr);
  const wolwoon = getMonthGanZhi(yr, mo);
  const ilwoon = getDayGanZhi(yr, mo, dy);

  const daewoonList = calculateDaewoon(record.birthInput, record.profile.computedPillars);
  const age = yr - record.birthInput.year;
  const daywoon = daewoonList.find((d) => age >= d.startAge && age <= d.endAge) ?? null;

  const daywoonTenGod = dayStem && daywoon ? getTenGod(dayStem, daywoon.ganZhi.stem) : null;
  const sewoonTenGod = dayStem ? getTenGod(dayStem, sewoon.stem) : null;
  const wolwoonTenGod = dayStem ? getTenGod(dayStem, wolwoon.stem) : null;
  const ilwoonTenGod = dayStem ? getTenGod(dayStem, ilwoon.stem) : null;

  // Primary tone: 세운 is the loudest signal, then 대운
  const primaryTg = sewoonTenGod ?? daywoonTenGod;
  const flowOpenness = getFlowOpenness(primaryTg);

  return {
    name,
    daywoon,
    sewoon,
    wolwoon,
    ilwoon,
    daywoonTenGod,
    sewoonTenGod,
    wolwoonTenGod,
    ilwoonTenGod,
    flowOpenness,
    flowLabel: getFlowLabel(flowOpenness),
    emotionalTendency: get(TG_EMOTIONAL, primaryTg, "중성적인 감정 흐름"),
    relationshipTendency: get(TG_RELATIONSHIP, primaryTg, "관계에서 중립적인 흐름"),
    communicationTendency: get(TG_COMMUNICATION, wolwoonTenGod ?? primaryTg, "중립적인 소통 흐름"),
  };
}

export function computeCombinedTimingFlow(
  a: PersonCurrentFlow,
  b: PersonCurrentFlow,
  staticCompatScore: number,
): CombinedTimingFlow {
  const aO = a.flowOpenness;
  const bO = b.flowOpenness;

  let alignmentType: AlignmentType;
  let alignmentDesc: string;

  if (aO === "open" && bO === "open") {
    alignmentType = "둘 다 열림";
    alignmentDesc = `${a.name}와 ${b.name} 모두 현재 관계에 열린 에너지를 갖고 있습니다. 서로에게 자연스럽게 다가가기 좋은 타이밍으로, 감정 표현과 중요한 대화를 나누기에 유리합니다.`;
  } else if (aO === "closed" && bO === "closed") {
    alignmentType = "둘 다 안정";
    alignmentDesc = `${a.name}와 ${b.name} 모두 현재 내향적인 에너지 흐름에 있습니다. 서로의 공간을 존중하며 조용한 동반 관계가 편안한 시기입니다. 큰 결정보다 일상의 안정에 집중하세요.`;
  } else if (aO === "open" && bO === "closed") {
    alignmentType = "교차 흐름";
    alignmentDesc = `${a.name}은 열린 흐름이지만 ${b.name}은 내향적인 흐름입니다. ${a.name}의 적극적인 표현이 ${b.name}에게 다소 빠르게 느껴질 수 있어 속도 조절이 중요합니다.`;
  } else if (aO === "closed" && bO === "open") {
    alignmentType = "교차 흐름";
    alignmentDesc = `${b.name}은 열린 흐름이지만 ${a.name}은 내향적인 흐름입니다. ${b.name}의 표현이 ${a.name}에게 부담으로 느껴지지 않도록 여유를 두세요.`;
  } else if (aO === "open" || bO === "open") {
    alignmentType = "한쪽 열림";
    const openPerson = aO === "open" ? a.name : b.name;
    alignmentDesc = `${openPerson}의 관계 에너지가 활성화된 시기입니다. ${openPerson}이 먼저 마음을 열고 다가가는 것이 효과적이며, 상대방도 자연스럽게 따라올 수 있는 흐름입니다.`;
  } else {
    alignmentType = "긴장 구간";
    alignmentDesc = `두 사람 모두 각자의 리듬에 집중하는 시기입니다. 관계 발전보다 서로를 이해하며 안정을 유지하는 것이 우선이며, 작은 배려가 큰 힘이 됩니다.`;
  }

  // Static compatibility modifier text
  let staticModifier: string;
  if (staticCompatScore >= 70) {
    staticModifier = "기본 궁합이 좋아 현재 흐름이 맞을 때 시너지가 배로 납니다.";
  } else if (staticCompatScore >= 55) {
    staticModifier = "기본 궁합은 노력형으로, 현재 흐름이 맞을 때 적극적으로 소통하면 효과적입니다.";
  } else {
    staticModifier = "기본 궁합에 긴장 요소가 있어, 현재 타이밍에도 소통 방식에 주의가 필요합니다.";
  }

  // Today's summary — based on 일운 ten-gods
  const aTg = a.ilwoonTenGod;
  const bTg = b.ilwoonTenGod;
  const goodSet = new Set(["식신", "정재", "편재", "정관"]);
  const sharpSet = new Set(["겁재", "편관", "상관"]);

  let todaySummary: string;
  let todayLevel: TodayLevel;

  if (aTg && bTg && goodSet.has(aTg) && goodSet.has(bTg)) {
    todaySummary = "오늘은 두 사람 모두 편안하게 소통하기 좋은 흐름입니다";
    todayLevel = "good";
  } else if (aTg && bTg && sharpSet.has(aTg) && sharpSet.has(bTg)) {
    todaySummary = "오늘은 두 사람 모두 날카로운 흐름 — 말 한마디가 오해로 이어지지 않도록 주의하세요";
    todayLevel = "caution";
  } else if ((aTg === "편인") || (bTg === "편인")) {
    const who = aTg === "편인" ? a.name : b.name;
    todaySummary = `오늘은 ${who}이 혼자만의 시간을 원하는 흐름 — 가벼운 대화 위주로 접근하는 것이 좋습니다`;
    todayLevel = "neutral";
  } else if ((aTg && sharpSet.has(aTg)) || (bTg && sharpSet.has(bTg))) {
    const who = aTg && sharpSet.has(aTg) ? a.name : b.name;
    todaySummary = `오늘은 ${who}의 에너지가 날카로운 편 — 감정 표현 시 상대 반응을 살피며 소통하세요`;
    todayLevel = "caution";
  } else if ((aTg && goodSet.has(aTg)) || (bTg && goodSet.has(bTg))) {
    const who = aTg && goodSet.has(aTg) ? a.name : b.name;
    todaySummary = `오늘은 ${who}이 먼저 마음을 표현하기 좋은 날입니다`;
    todayLevel = "good";
  } else {
    todaySummary = "오늘은 두 사람 모두 차분하고 안정적인 일상 흐름입니다";
    todayLevel = "neutral";
  }

  return { alignmentType, alignmentDesc, staticModifier, todaySummary, todayLevel };
}
