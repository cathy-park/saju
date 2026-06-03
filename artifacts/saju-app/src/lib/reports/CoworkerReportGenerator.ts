import type { PersonRecord } from "../storage";
import { getFinalPillars } from "../storage";
import type { CoworkerCompatibilityReport } from "./types";
import {
  getToneDesc,
  getStemElRel,
  STEM_REL_DESC,
  TEN_GOD_COMPAT_DESC,
  checkStemCombine,
  checkStemClash,
  getCrossBranchAnalysis,
  getElementComplement,
  getConflictPoints,
  getHarmonyPoints,
  getRelationshipTips,
  getStyleCompatDesc,
  branchRel,
} from "../compatibilityReport";
import { calculateCompatibilityScore } from "../compatibilityScore";
import { getTenGod } from "../tenGods";
import { getRelationshipPattern } from "../relationshipReport";

export function generateCoworkerReport(
  p1: PersonRecord,
  p2: PersonRecord,
): CoworkerCompatibilityReport {
  const pillars1 = getFinalPillars(p1);
  const pillars2 = getFinalPillars(p2);

  const s1 = pillars1.day?.hangul?.[0] ?? "";
  const s2 = pillars2.day?.hangul?.[0] ?? "";
  const m1 = pillars1.month?.hangul?.[1] ?? "";
  const m2 = pillars2.month?.hangul?.[1] ?? "";
  const el1 = p1.profile.fiveElementDistribution;
  const el2 = p2.profile.fiveElementDistribution;

  const elRel = getStemElRel(s1, s2);
  const monthBranchRels = branchRel(m1, m2);

  const scoreResult = calculateCompatibilityScore(p1, p2, "coworker");
  const tone = scoreResult.finalType;
  const toneColor = scoreResult.finalColor;
  const toneDesc = getToneDesc(tone, "coworker");

  const me2other = s1 && s2 ? getTenGod(s1, s2) : null;
  const other2me = s1 && s2 ? getTenGod(s2, s1) : null;
  const stemRelInfo = STEM_REL_DESC[elRel];

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
    ? "생각과 가치관이 잘 맞아 업무적 소통이 원활하고 협력이 잘 이루어집니다."
    : clashes.length > 0 && combines.length === 0
    ? "의견 충돌이나 소통 방식의 차이가 있을 수 있어, 명확한 기준과 역할 분담이 중요합니다."
    : combines.length > 0 && clashes.length > 0
    ? "서로 통하는 부분도 있지만, 때로는 강하게 부딪히며 시너지를 내는 역동적인 관계입니다."
    : "특별한 천간 합충 관계는 없으며, 무난하고 일상적인 업무 소통이 이루어집니다.";

  const crossBranch = getCrossBranchAnalysis(branches1, branches2);
  const elemComp = getElementComplement(el1, el2);
  
  // 동료/업무 관계의 경우 지지(배우자궁) 대신 월지(사회궁)를 메인으로 분석

  const styleInfo1 = getRelationshipPattern(s1, pillars1.day?.hangul?.[1] ?? "", el1);
  const styleInfo2 = getRelationshipPattern(s2, pillars2.day?.hangul?.[1] ?? "", el2);
  let monthDesc = "";
  if (monthBranchRels.includes("합")) monthDesc = "사회궁(월지)이 합을 이루어, 같은 목표를 향해 시너지를 내기 매우 좋은 파트너입니다.";
  else if (monthBranchRels.includes("충")) monthDesc = "업무를 추진하는 방식이나 사회적 가치관이 정반대일 수 있습니다. 서로의 역할을 명확히 나누는 것이 좋습니다.";
  else monthDesc = "사회적으로 무난하게 협력할 수 있는 평범한 동료 관계입니다.";

  return {
    type: "coworker",
    relType: "coworker",
    tone,
    toneColor,
    toneDesc,
    scoreResult,
    stemRel: {
      label: stemRelInfo.label,
      desc: stemRelInfo.desc.replace(/당신이 상대를 통제하거나 압박/g, "업무적으로 주도권을 쥐려").replace(/사랑/g, "협력"),
      me2other,
      other2me,
      me2otherDesc: me2other ? (TEN_GOD_COMPAT_DESC[me2other] ?? "") : "관계 없음",
      other2meDesc: other2me ? (TEN_GOD_COMPAT_DESC[other2me] ?? "") : "관계 없음",
      elRel,
    },
    monthBranchComp: {
      myMonth: m1,
      otherMonth: m2,
      relations: monthBranchRels,
      desc: monthDesc,
    },
    workStyleComp: {
      person1Style: styleInfo1.style,
      person2Style: styleInfo2.style,
      synergyDesc: getStyleCompatDesc(styleInfo1.style, styleInfo2.style).replace(/연애|이성|사랑/g, "업무")
    },
    stemHarmony: { combines, clashes, overallDesc: stemOverallDesc },
    crossBranch: {
      positive: crossBranch.positive.slice(0, 4),
      negative: crossBranch.negative.slice(0, 4),
      overallDesc: crossBranch.positive.length > crossBranch.negative.length
        ? "전반적인 기운이 조화로워 팀워크를 발휘하기 좋은 인연입니다."
        : crossBranch.negative.length > crossBranch.positive.length
        ? "일부 마찰 요소가 있으니, 감정을 섞지 않고 공적인 룰을 잘 지키는 것이 유리합니다."
        : "업무적 거리를 유지하며 협력하기 좋은 평이한 관계입니다."
    },
    elementComp: { p1Lacks: elemComp.p1Lacks, p2Lacks: elemComp.p2Lacks, p1Comps: elemComp.p1Comps, p2Comps: elemComp.p2Comps, desc: elemComp.desc.replace(/인연/g, "파트너") },
    conflictPoints: getConflictPoints(elRel, monthBranchRels[0] ?? "없음", el1, el2).map((s: string) => s.replace(/배우자궁/g, "사회궁(월지)")),
    harmonyPoints: getHarmonyPoints(elRel, monthBranchRels[0] ?? "없음", el1, el2).map((s: string) => s.replace(/배우자궁/g, "사회궁(월지)")),
    tips: getRelationshipTips(styleInfo1.style, styleInfo2.style, tone).map((s: string) => s.replace(/사랑/g, "협력")), // reusing logic
  };
}
