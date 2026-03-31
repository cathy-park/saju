import { STEM_TO_ELEMENT, BRANCH_TO_ELEMENT, type FiveElKey } from "./element-color";
import { getHiddenStems } from "./hiddenStems";

export type DayMasterStrengthLevel = "태약" | "신약" | "중화" | "신강" | "태강";

export type RootLevel = "none" | "weak root" | "medium root" | "strong root";

export interface DayMasterStrengthResult {
  strengthLevel: DayMasterStrengthLevel;
  strengthScore: number;
  strengthExplanation: string[];
  detail: {
    dayMasterElement?: FiveElKey;
    deukryeong: { score: number; ok: boolean; monthBranch?: string };
    deukji: { score: number; level: RootLevel; rootedBranches: string[]; hiddenRootBranches: string[] };
    deukse: { score: number; sameElementStemCount: number; stems: string[] };
  };
}

const SEASON_BY_ELEMENT: Record<Exclude<FiveElKey, "토">, string[]> = {
  목: ["인", "묘", "진"],
  화: ["사", "오", "미"],
  금: ["신", "유", "술"],
  수: ["해", "자", "축"],
};
const EARTH_SEASON_BRANCHES = ["진", "술", "축", "미"];

function classifyStrength(score: number): DayMasterStrengthLevel {
  if (score <= 1) return "태약";
  if (score <= 2.5) return "신약";
  if (score <= 4) return "중화";
  if (score <= 5.5) return "신강";
  return "태강";
}

export function calculateDayMasterStrength(input: {
  dayStem: string;
  monthBranch?: string;
  stems: string[];    // includes day stem; we will ignore it for 득세
  branches: string[]; // year/month/day/hour branches (if available)
}): DayMasterStrengthResult {
  const { dayStem, monthBranch, stems, branches } = input;
  const dmEl = (STEM_TO_ELEMENT[dayStem] ?? undefined) as FiveElKey | undefined;
  const explanation: string[] = [];

  if (!dmEl) {
    return {
      strengthLevel: "중화",
      strengthScore: 0,
      strengthExplanation: ["일간 오행을 판정할 수 없어 강약을 계산하지 않았습니다."],
      detail: {
        dayMasterElement: undefined,
        deukryeong: { score: 0, ok: false, monthBranch },
        deukji: { score: 0, level: "none", rootedBranches: [], hiddenRootBranches: [] },
        deukse: { score: 0, sameElementStemCount: 0, stems: [] },
      },
    };
  }

  // 1) 득령: month branch seasonal support
  let deukryeongScore = 0;
  let deukryeongOk = false;
  if (monthBranch) {
    if (dmEl === "토") {
      // 토는 사계절(진술축미)에서 특히 강해지는 것으로 처리
      if (EARTH_SEASON_BRANCHES.includes(monthBranch)) {
        deukryeongScore = 2;
        deukryeongOk = true;
        explanation.push(`월지 ${monthBranch}에서 토(土)가 득령`);
      } else {
        deukryeongScore = 1;
        deukryeongOk = true;
        explanation.push(`월지 ${monthBranch}에서 토(土)는 사계절 보조로 득령(보조)`);
      }
    } else {
      const seasonBranches = SEASON_BY_ELEMENT[dmEl];
      if (seasonBranches?.includes(monthBranch)) {
        deukryeongScore = 2;
        deukryeongOk = true;
        explanation.push(`월지 ${monthBranch}에서 ${dmEl}이 득령`);
      }
    }
  }

  // 2) 득지: 통근(지장간/본기 기반)
  const rootedBranches: string[] = [];
  const hiddenRootBranches: string[] = [];

  for (const b of branches) {
    const bEl = (BRANCH_TO_ELEMENT[b] ?? undefined) as FiveElKey | undefined;
    if (bEl === dmEl) {
      rootedBranches.push(b);
      continue;
    }
    const hiddens = getHiddenStems(b);
    const hasHidden = hiddens.some((s) => (STEM_TO_ELEMENT[s] as FiveElKey | undefined) === dmEl);
    if (hasHidden) hiddenRootBranches.push(b);
  }

  let deukjiLevel: RootLevel = "none";
  let deukjiScore = 0;
  if (rootedBranches.length > 0) {
    deukjiLevel = "strong root";
    deukjiScore = 2;
    explanation.push(`지지 ${rootedBranches.join("·")}에서 본기 통근(강)`);
  } else if (hiddenRootBranches.length >= 2) {
    deukjiLevel = "medium root";
    deukjiScore = 1.5;
    explanation.push(`지지 ${hiddenRootBranches.join("·")} 지장간에서 통근(중)`);
  } else if (hiddenRootBranches.length === 1) {
    deukjiLevel = "weak root";
    deukjiScore = 1;
    explanation.push(`지지 ${hiddenRootBranches[0]} 지장간에서 통근(약)`);
  }

  // 3) 득세: same-element stems (비견/겁재 계열) count
  const stemEls = stems.map((s) => (STEM_TO_ELEMENT[s] as FiveElKey | undefined) ?? undefined);
  const sameElTotal = stemEls.filter((el) => el === dmEl).length;
  // Exclude the day master stem itself ONCE (even if the same stem appears multiple times)
  const sameCount = Math.max(0, sameElTotal - 1);
  const sameElStems: string[] = [];
  // Keep stem list for explanation, excluding only one dayStem occurrence.
  let removedDayStemOnce = false;
  for (let i = 0; i < stems.length; i++) {
    const s = stems[i];
    const el = stemEls[i];
    if (!s || el !== dmEl) continue;
    if (!removedDayStemOnce && s === dayStem) {
      removedDayStemOnce = true;
      continue;
    }
    sameElStems.push(s);
  }
  let deukseScore = 0;
  if (sameCount === 1) deukseScore = 1;
  else if (sameCount >= 2) deukseScore = 2;
  if (sameCount > 0) explanation.push(`천간 ${sameElStems.join("·")} 존재로 득세(+${sameCount})`);

  const strengthScore = Number((deukryeongScore + deukjiScore + deukseScore).toFixed(2));
  const strengthLevel = classifyStrength(strengthScore);

  return {
    strengthLevel,
    strengthScore,
    strengthExplanation: explanation,
    detail: {
      dayMasterElement: dmEl,
      deukryeong: { score: deukryeongScore, ok: deukryeongOk, monthBranch },
      deukji: { score: deukjiScore, level: deukjiLevel, rootedBranches, hiddenRootBranches },
      deukse: { score: deukseScore, sameElementStemCount: sameCount, stems: sameElStems },
    },
  };
}

