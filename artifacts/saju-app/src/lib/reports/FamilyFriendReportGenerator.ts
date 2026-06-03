import type { PersonRecord, RelationshipType } from "../storage";
import { getFinalPillars } from "../storage";
import type { FamilyFriendCompatibilityReport } from "./types";
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

export function generateFamilyFriendReport(
  p1: PersonRecord,
  p2: PersonRecord,
  relType: "family" | "friend" | "other"
): FamilyFriendCompatibilityReport {
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

  const scoreResult = calculateCompatibilityScore(p1, p2, relType);
  const tone = scoreResult.finalType;
  const toneColor = scoreResult.finalColor;
  const toneDesc = getToneDesc(tone, relType);

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
  const relNoun = relType === "family" ? "가족" : relType === "friend" ? "친구" : "사람";
  
  const stemOverallDesc = combines.length > 0 && clashes.length === 0
    ? `천간이 합하는 기운이 있어 서로 통하는 ${relNoun}으로서 깊은 공감대를 형성합니다.`
    : clashes.length > 0 && combines.length === 0
    ? `성향이나 가치관 차이로 가끔 부딪힐 수 있으나, 서로 다름을 인정하면 든든한 ${relNoun}이 됩니다.`
    : combines.length > 0 && clashes.length > 0
    ? `잘 맞을 때는 아주 잘 맞고 부딪힐 때는 크게 부딪히는 역동적인 ${relNoun} 관계입니다.`
    : `천간에 큰 충돌 없이 편안하고 무난하게 지낼 수 있는 자연스러운 관계입니다.`;

  const crossBranch = getCrossBranchAnalysis(branches1, branches2);
  const elemComp = getElementComplement(el1, el2);
  const styleInfo1 = getRelationshipPattern(s1, b1, el1);
  const styleInfo2 = getRelationshipPattern(s2, b2, el2);

  return {
    type: relType,
    relType,
    tone,
    toneColor,
    toneDesc,
    scoreResult,
    stemRel: {
      label: stemRelInfo.label,
      desc: stemRelInfo.desc.replace(/연인/g, relNoun),
      me2other,
      other2me,
      me2otherDesc: me2other ? (TEN_GOD_COMPAT_DESC[me2other] ?? "") : "관계 없음",
      other2meDesc: other2me ? (TEN_GOD_COMPAT_DESC[other2me] ?? "") : "관계 없음",
      elRel,
    },
    dynamicsComp: {
      person1Style: styleInfo1.style,
      person2Style: styleInfo2.style,
      desc: getStyleCompatDesc(styleInfo1.style, styleInfo2.style).replace(/연애|이성/g, "관계").replace(/사랑/g, "애정")
    },
    stemHarmony: { combines, clashes, overallDesc: stemOverallDesc },
    crossBranch: {
      positive: crossBranch.positive.slice(0, 4),
      negative: crossBranch.negative.slice(0, 4),
      overallDesc: crossBranch.positive.length > crossBranch.negative.length
        ? "전반적인 기운이 조화로워 편안하고 따뜻한 유대감을 형성하기 좋습니다."
        : crossBranch.negative.length > crossBranch.positive.length
        ? "기운이 다소 엇갈리는 면이 있으므로, 각자의 프라이버시와 경계를 존중하는 것이 좋습니다."
        : "좋은 점과 다소 긴장되는 점이 공존하는 현실적이고 친근한 관계입니다."
    },
    elementComp: { p1Lacks: elemComp.p1Lacks, p2Lacks: elemComp.p2Lacks, p1Comps: elemComp.p1Comps, p2Comps: elemComp.p2Comps, desc: elemComp.desc },
    conflictPoints: getConflictPoints(elRel, dayBranchRels[0] ?? "없음", el1, el2).map((s: string) => s.replace(/배우자궁/g, "일지").replace(/결혼/g, "관계")),
    harmonyPoints: getHarmonyPoints(elRel, dayBranchRels[0] ?? "없음", el1, el2).map((s: string) => s.replace(/배우자궁/g, "일지").replace(/결혼/g, "관계")),
    tips: getRelationshipTips(styleInfo1.style, styleInfo2.style, tone).map((s: string) => s.replace(/사랑/g, "유대감")),
  };
}
