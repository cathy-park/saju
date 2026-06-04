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
  dayBranch: string; // 일지 추가
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
  timingTurningPoints: {
    title: string;
    desc: string;
    type: "union" | "adjustment" | "caution" | "neutral";
  }[];
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
  편재: "활기차고 자유로운 소통 흐름",
  정재: "신중하고 구체적인 소통을 선호하는 흐름",
  편관: "단호하고 임팩트 있는 말이 나오는 흐름",
  정관: "논리적이고 책임감 있는 소통 흐름",
  편인: "소통보다 혼자 생각하는 시간을 원하는 흐름",
  정인: "듣는 것을 선호하고 상대를 배려하는 소통 흐름",
};

function get<T>(map: Record<string, T>, key: string | null, fallback: T): T {
  return (key && map[key]) ? map[key] : fallback;
}

// ── 지지 관계 룩업 헬퍼 (순환 참조 방지를 위해 자체 내장) ──────────────

type RelationType = "합" | "반합" | "충" | "형" | "해" | "원진" | "무관";

function checkBranchRelation(b1: string, b2: string): RelationType {
  if (!b1 || !b2) return "무관";

  // 1. 육합 (六合)
  const SIX_HAP: [string, string][] = [
    ["자", "축"], ["인", "해"], ["묘", "술"], ["진", "유"], ["사", "신"], ["오", "미"],
  ];
  if (SIX_HAP.some(([x, y]) => (b1 === x && b2 === y) || (b1 === y && b2 === x))) {
    return "합";
  }

  // 2. 반합 (半合 - 삼합의 핵심 왕지 자오묘유를 포함한 2글자 결합)
  const BAN_HAP_PAIRS: [string, string][] = [
    ["인", "오"], ["오", "술"],
    ["사", "유"], ["유", "축"],
    ["신", "자"], ["자", "진"],
    ["해", "묘"], ["묘", "미"]
  ];
  if (BAN_HAP_PAIRS.some(([x, y]) => (b1 === x && b2 === y) || (b1 === y && b2 === x))) {
    return "반합";
  }

  // 3. 충 (沖)
  const CHUNG_PAIRS: [string, string][] = [
    ["자", "오"], ["축", "미"], ["인", "신"], ["묘", "유"], ["진", "술"], ["사", "해"],
  ];
  if (CHUNG_PAIRS.some(([x, y]) => (b1 === x && b2 === y) || (b1 === y && b2 === x))) {
    return "충";
  }

  // 4. 원진 (怨嗔)
  const WONJIN_PAIRS: [string, string][] = [
    ["자", "미"], ["축", "오"], ["인", "유"], ["묘", "신"], ["진", "해"], ["사", "술"],
  ];
  if (WONJIN_PAIRS.some(([x, y]) => (b1 === x && b2 === y) || (b1 === y && b2 === x))) {
    return "원진";
  }

  // 5. 형 (刑)
  const HUNG_PAIRS: [string, string][] = [
    ["자", "묘"],
    ["진", "진"], ["오", "오"], ["유", "유"], ["해", "해"],
    ["인", "사"], ["사", "신"], ["신", "인"],
    ["축", "술"], ["술", "미"], ["미", "축"]
  ];
  if (HUNG_PAIRS.some(([x, y]) => (b1 === x && b2 === y) || (b1 === y && b2 === x))) {
    return "형";
  }

  // 6. 해 (害)
  const HAE_PAIRS: [string, string][] = [
    ["자", "미"], ["축", "오"], ["인", "사"], ["묘", "진"], ["신", "해"], ["유", "술"]
  ];
  if (HAE_PAIRS.some(([x, y]) => (b1 === x && b2 === y) || (b1 === y && b2 === x))) {
    return "해";
  }

  return "무관";
}

// ── Main exports ───────────────────────────────────────────────────

export function computePersonCurrentFlow(
  record: PersonRecord,
  now: Date,
): PersonCurrentFlow {
  const name = record.birthInput.name;
  const pillars = getFinalPillars(record);
  const dayStem = pillars.day?.hangul?.[0] ?? "";
  const dayBranch = pillars.day?.hangul?.[1] ?? "";

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

  // Primary tone: sewoon is the loudest signal, then daewoon
  const primaryTg = sewoonTenGod ?? daywoonTenGod;
  const flowOpenness = getFlowOpenness(primaryTg);

  return {
    name,
    dayBranch,
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
  relType?: string
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

  // Today's summary — based on ilwoon ten-gods
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

  // ── 대운/세운 지지와 양쪽 일지 간 합충 관계 판정 기반 시기 분석 ──────

  const timingTurningPoints: CombinedTimingFlow["timingTurningPoints"] = [];

  const aBranch = a.dayBranch;
  const bBranch = b.dayBranch;
  const sewoonBr = a.sewoon.branch;

  const aSewoonRel = checkBranchRelation(aBranch, sewoonBr);
  const bSewoonRel = checkBranchRelation(bBranch, sewoonBr);

  // 1. 세운(올해) 지지 분석
  const isSewoonUnionA = aSewoonRel === "합" || aSewoonRel === "반합";
  const isSewoonUnionB = bSewoonRel === "합" || bSewoonRel === "반합";

  if (isSewoonUnionA && isSewoonUnionB) {
    timingTurningPoints.push({
      title: relType === "coworker" ? "올해는 협력과 성과의 시기 🤝" : relType === "family" || relType === "friend" ? "올해는 신뢰와 공감의 시기 🍀" : "올해는 결실과 결합의 시기 💍",
      desc: `올해 세운의 기운(${sewoonBr})이 ${a.name}님과 ${b.name}님의 ${relType === "coworker" ? "사회궁(월지)을 모두 좋게 결합해 줍니다" : relType === "family" || relType === "friend" ? "일지를 모두 따뜻하게 결합해 줍니다" : "배우자궁을 모두 좋게 결합(합)해 줍니다"}. 마음의 정서적 일치와 결합이 최고조로 일어나는 때로, ${relType === "coworker" ? "중요한 프로젝트나 협력 관계를 구체화하기에 완벽한 타이밍입니다" : relType === "family" || relType === "friend" ? "서로에 대한 이해와 유대감이 깊어지는 완벽한 타이밍입니다" : "평생의 약속이나 결혼 이야기를 구체화하기에 완벽한 타이밍입니다"}.`,
      type: "union"
    });
  } else if (isSewoonUnionA || isSewoonUnionB) {
    const unionPerson = isSewoonUnionA ? a.name : b.name;
    const unionRel = isSewoonUnionA ? aSewoonRel : bSewoonRel;
    timingTurningPoints.push({
      title: `${unionPerson}님의 ${relType === "coworker" ? "기반이 안정되는 성장기 🌱" : relType === "family" || relType === "friend" ? "마음이 편안해지는 안정기 🍀" : "마음이 안착하는 결실기 🍀"}`,
      desc: `올해 흘러가는 기운이 ${unionPerson}님의 ${relType === "coworker" ? "사회궁(월지)과 따뜻하게 결합(${unionRel})합니다" : relType === "family" || relType === "friend" ? "일지와 따뜻하게 결합(${unionRel})합니다" : "배우자궁과 따뜻하게 결합(${unionRel})합니다"}. 관계의 의구심이 사라지고 마음에 안정이 찾아오며, 동반자로서의 신뢰가 아주 두터워지는 좋은 타이밍입니다.`,
      type: "union"
    });
  }

  const isSewoonAdjA = aSewoonRel === "충" || aSewoonRel === "해";
  const isSewoonAdjB = bSewoonRel === "충" || bSewoonRel === "해";

  if (isSewoonAdjA || isSewoonAdjB) {
    const adjPerson = (isSewoonAdjA && isSewoonAdjB)
      ? "두 사람 모두"
      : isSewoonAdjA ? a.name : b.name;
    const adjRel = isSewoonAdjA ? aSewoonRel : bSewoonRel;
    timingTurningPoints.push({
      title: `${adjPerson}에게 변화와 조정의 시기 ⚡`,
      desc: `올해의 기운이 ${relType === "coworker" ? "사회궁(월지)과 부딪히거나" : relType === "family" || relType === "friend" ? "일지와 부딪히거나" : "배우자궁과 부딪히거나"}(${adjRel}) 자극을 주어 익숙한 패턴에 변화를 가져옵니다. 이동이나 소통 방식의 조율이 필요한 시점이지만, 서로를 보듬어준다면 갈등을 넘어 한 차원 깊은 신뢰를 쌓는 성장기가 될 것입니다.`,
      type: "adjustment"
    });
  }

  const isSewoonCautionA = aSewoonRel === "원진" || aSewoonRel === "형";
  const isSewoonCautionB = bSewoonRel === "원진" || bSewoonRel === "형";

  if (isSewoonCautionA || isSewoonCautionB) {
    const cautionPerson = (isSewoonCautionA && isSewoonCautionB)
      ? "두 사람 모두"
      : isSewoonCautionA ? a.name : b.name;
    const cautionRel = isSewoonCautionA ? aSewoonRel : bSewoonRel;
    timingTurningPoints.push({
      title: `${cautionPerson}의 정서적 조율 구간 ⚠️`,
      desc: `올해 흘러가는 기운이 ${relType === "coworker" ? "사회궁(월지)에 예민한 자극" : relType === "family" || relType === "friend" ? "일지에 예민한 자극" : "배우자궁에 예민한 자극"}(${cautionRel})을 주어 사소한 오해나 서운함이 생기기 쉬운 때입니다. 직설적인 표현 대신 따뜻한 배려와 조용한 믿음으로 대화를 나누며 오해를 방지해야 하는 타이밍입니다.`,
      type: "caution"
    });
  }

  // 2. 대운(대주기) 지지 분석
  const aDaewoonBr = a.daywoon?.ganZhi.branch ?? "";
  const bDaewoonBr = b.daywoon?.ganZhi.branch ?? "";
  const aDaewoonRel = checkBranchRelation(aBranch, aDaewoonBr);
  const bDaewoonRel = checkBranchRelation(bBranch, bDaewoonBr);

  const isDaewoonUnionA = aDaewoonRel === "합" || aDaewoonRel === "반합";
  if (isDaewoonUnionA) {
    timingTurningPoints.push({
      title: `${a.name}님의 ${relType === "coworker" ? "장기적 협력 지지기" : relType === "family" || relType === "friend" ? "장기적 유대 지지기" : "장기적 결실 지지기"}`,
      desc: `현재 흘러가는 대운의 큰 흐름이 ${a.name}님의 ${relType === "coworker" ? "사회궁(월지)을 든든하게 지지하여" : relType === "family" || relType === "friend" ? "일지를 따뜻하게 지지하여" : "배우자궁을 따뜻하게 지지하여"}, 장기적으로 안정된 관계와 결실을 맺는 좋은 배경을 만들어 줍니다.`,
      type: "union"
    });
  }
  const isDaewoonUnionB = bDaewoonRel === "합" || bDaewoonRel === "반합";
  if (isDaewoonUnionB) {
    timingTurningPoints.push({
      title: `${b.name}님의 ${relType === "coworker" ? "장기적 협력 지지기" : relType === "family" || relType === "friend" ? "장기적 유대 지지기" : "장기적 결실 지지기"}`,
      desc: `현재 흘러가는 대운의 큰 흐름이 ${b.name}님의 ${relType === "coworker" ? "사회궁(월지)을 든든하게 지지하여" : relType === "family" || relType === "friend" ? "일지를 따뜻하게 지지하여" : "배우자궁을 따뜻하게 지지하여"}, 장기적으로 안정된 관계와 결실을 맺는 좋은 배경을 만들어 줍니다.`,
      type: "union"
    });
  }

  // 터닝포인트가 없는 경우 기본값 제공
  if (timingTurningPoints.length === 0) {
    timingTurningPoints.push({
      title: "잔잔하고 평온한 관계의 안착 구간 ✨",
      desc: "대운이나 세운에서 강한 충돌이나 요동이 없는 평온한 시기입니다. 특별한 갈등 요인 없이 일상에서 소소한 추억을 차곡차곡 쌓아가며 조화로운 관계를 이어나가기 아주 좋습니다.",
      type: "neutral"
    });
  }

  return { alignmentType, alignmentDesc, staticModifier, todaySummary, todayLevel, timingTurningPoints };
}
