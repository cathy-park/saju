import type { PersonRecord, RelationshipType } from "../storage";
import { getFinalPillars } from "../storage";
import type { LoverCompatibilityReport } from "./types";
import {
  getToneDesc,
  getStemElRel,
  STEM_REL_DESC,
  TEN_GOD_COMPAT_DESC,
  BRANCH_REL_COMPAT,
  checkStemCombine,
  checkStemClash,
  getCrossBranchAnalysis,
  getElementComplement,
  getMarriageView,
  getConflictPoints,
  getHarmonyPoints,
  getRelationshipTips,
  getStyleCompatDesc,
  branchRel,
} from "../compatibilityReport";
import { getSpousePalaceInfo, getRelationshipPattern } from "../relationshipReport";
import { calculateCompatibilityScore } from "../compatibilityScore";
import { getTenGod } from "../tenGods";

export function generateLoverReport(
  p1: PersonRecord,
  p2: PersonRecord,
  relType: "lover" | "spouse" | "interest"
): LoverCompatibilityReport {
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

  const scoreResult = calculateCompatibilityScore(p1, p2, relType);
  const tone = scoreResult.finalType;
  const toneColor = scoreResult.finalColor;
  // Use romantic tone descriptors
  const toneDesc = getToneDesc(tone, relType);

  const me2other = s1 && s2 ? getTenGod(s1, s2) : null;
  const other2me = s1 && s2 ? getTenGod(s2, s1) : null;
  const stemRelInfo = STEM_REL_DESC[elRel];

  const branchComp = BRANCH_REL_COMPAT[dayBranchRelLabel] ?? BRANCH_REL_COMPAT["없음"];
  const myPalace = b1 ? getSpousePalaceInfo(b1) : null;
  const otherPalace = b2 ? getSpousePalaceInfo(b2) : null;

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
    ? "천간이 합하는 부분이 있어 연인으로서 강하게 끌리는 에너지가 있습니다."
    : clashes.length > 0 && combines.length === 0
    ? "천간의 충이 있어 관계에 긴장감이 존재하며, 서로에게 자극이 되는 연애입니다."
    : combines.length > 0 && clashes.length > 0
    ? "천간에 합과 충이 공존하여 강렬한 끌림과 긴장이 동시에 작용합니다."
    : "특별한 천간 합충 관계는 없으며, 자연스러운 호감과 상호작용이 이루어집니다.";

  const crossBranch = getCrossBranchAnalysis(branches1, branches2);
  const elemComp = getElementComplement(el1, el2);
  const styleInfo1 = getRelationshipPattern(s1, b1, el1);
  const styleInfo2 = getRelationshipPattern(s2, b2, el2);
  const marriageView = getMarriageView(scoreResult.baseScore, elRel, dayBranchRelLabel);
  const conflictPoints = getConflictPoints(elRel, dayBranchRelLabel, el1, el2);
  const harmonyPoints = getHarmonyPoints(elRel, dayBranchRelLabel, el1, el2);
  const tips = getRelationshipTips(styleInfo1.style, styleInfo2.style, tone);

  return {
    type: relType,
    relType,
    tone,
    toneColor,
    toneDesc,
    scoreResult,
    stemRel: {
      label: stemRelInfo.label,
      desc: stemRelInfo.desc,
      me2other,
      other2me,
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
      myPalaceTitle: myPalace?.title ?? `${b1}(일지)`,
      otherPalaceTitle: otherPalace?.title ?? `${b2}(일지)`,
    },
    stemHarmony: { combines, clashes, overallDesc: stemOverallDesc },
    crossBranch: {
      positive: crossBranch.positive.slice(0, 4),
      negative: crossBranch.negative.slice(0, 4),
      overallDesc: crossBranch.positive.length > crossBranch.negative.length
        ? "두 분의 지지 사이에 긍정적인 인연의 고리가 더 많습니다. 자연스럽게 조화로운 연인/배우자 관계를 형성할 수 있습니다."
        : crossBranch.negative.length > crossBranch.positive.length
        ? "지지 사이에 다소 긴장 요소가 있습니다. 서로의 차이를 이해하고 양보하는 노력이 필요합니다."
        : "지지 관계가 균형적입니다. 좋은 점과 주의할 점이 공존하는 현실적인 관계입니다."
    },
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
