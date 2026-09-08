// 시기(timing) 신호 산출 — 원국(canonical payload)과 완전히 분리된 계산 레이어다. 이 파일은
// "2027년에 결혼한다" 같은 문장을 생성하지 않는다. 활성도/안정도/공식화신호/변동성을 각각
// weighted score + evidence로만 산출한다("활성도가 높음 ≠ 결혼하기 좋은 해" 원칙 유지 — 대표 지시).
//
// 축별 방향 설계(대표 재설계 지시, 2026-09-08):
//   - 化祿/化權/化科/化忌를 하나의 count로 합치지 않고 개별 축에 다르게 반영한다.
//     化祿 → activation + formalization(순조롭게 무르익음)
//     化權 → activation만(化權을 공식화 신호로 자동 취급하지 않는다)
//     化科 → formalization만(평판/인정)
//     化忌 → activation + volatility는 올리되 stability는 감점(사건성은 있으나 불안정 신호)
//   - 原局夫妻宮 직접 중첩과 三方四正 진입은 서로 다른 weight를 쓴다(직접 중첩이 더 강한 신호).
//     大限 중첩 → stability, 流年 중첩 → activation.
//   - 擎羊·陀羅가 그 해의 流年夫妻宮 자리에 있으면 activation+volatility를 올리고 stability는
//     감점한다(化忌와 같은 축 방향).
//   - 紅鸞·天喜는 생년 고정이 아니라 "그 해" 기준으로 다시 계산한 유파 공통 공식(연지→卯궁
//     기준 역행)을 적용해 매년 다른 위치를 반영한다.
import {
  BRANCHES, PALACE_NAMES, type Branch, type EvidenceItem, type PalaceName, type RuleSet,
  type SihuaKind, type Stem, type ZiweiChart,
} from "./types";
import { STEMS } from "./types";
import { extractSpouseEvidence } from "./spouseEvidence";
import { computeHongluanTianxi } from "./auxiliaryStars";
import { yearToBranch } from "./annualPeriods";

function mod12(n: number): number {
  return ((n % 12) + 12) % 12;
}
function mod10(n: number): number {
  return ((n % 10) + 10) % 10;
}
function idx(b: Branch): number {
  return BRANCHES.indexOf(b);
}

/** 1984=甲子년 기준으로 해당 연도의 년간을 구한다(annualPeriods.yearToBranch와 같은 기준점). */
export function yearToStem(year: number): Stem {
  return STEMS[mod10(year - 1984)];
}

/** anchorBranch를 그 시기의 "命宮"으로 놓고, 같은 12궁 배정 규칙(지지 감소 방향)으로
 * targetPalace가 원국의 어느 지지에 해당하는지 구한다(大限十二宮/流年十二宮 표준 개념). */
export function derivePalaceBranch(anchorBranch: Branch, targetPalace: PalaceName): Branch {
  const offset = PALACE_NAMES.indexOf(targetPalace);
  return BRANCHES[mod12(idx(anchorBranch) - offset)];
}

const WEIGHT = {
  majorDirectOverlap: 3,
  majorSanfangOverlap: 1.5,
  annualDirectOverlap: 2,
  annualSanfangOverlap: 1,
  annualPalaceFormalization: 1,
  luActivation: 1.5,
  luFormalization: 1.5,
  quanActivation: 1,
  keFormalization: 1.5,
  jiActivation: 1,
  jiVolatility: 1.5,
  jiStabilityPenalty: 1,
  yangTuoActivation: 0.5,
  yangTuoVolatility: 1.5,
  yangTuoStabilityPenalty: 1,
  hongluanTianxiActivation: 1.5,
} as const;

export interface AxisResult {
  score: number;
  evidence: EvidenceItem[];
}

export interface RelationshipTimingSignal {
  year: number;
  activation: AxisResult;
  stability: AxisResult;
  formalization: AxisResult;
  volatility: AxisResult;
}

function buildStarToBranchMap(chart: ZiweiChart): Record<string, Branch> {
  const map: Record<string, Branch> = {};
  for (const p of chart.palaces) {
    for (const s of [...p.majorStars, ...p.minorStars]) map[s.name] = p.branch;
  }
  return map;
}

function timingSignalForYear(chart: ZiweiChart, ruleSet: RuleSet, year: number): RelationshipTimingSignal {
  const spouseEvidence = extractSpouseEvidence(chart);
  const natalSpouseBranch = spouseEvidence.spousePalace.branch;
  const sanfangBranches = new Set(spouseEvidence.sanfangSizhengPalaces.map((p) => p.branch));

  const age = year - chart.birth.year;
  const majorPeriod = chart.majorPeriods.find((p) => age >= p.ageRange[0] && age <= p.ageRange[1]);
  const annualPeriod = chart.annualPeriods.find((p) => p.year === year);
  if (!majorPeriod) throw new Error(`대한 구간을 찾을 수 없습니다(year=${year}, age=${age}).`);
  if (!annualPeriod) throw new Error(`유년 정보가 없습니다(year=${year}) — buildZiweiChart 호출 시 annualYears에 포함시켜야 합니다.`);

  const majorSpouseBranch = derivePalaceBranch(majorPeriod.branch, "夫妻宮");
  const annualSpouseBranch = derivePalaceBranch(annualPeriod.branch, "夫妻宮");

  const activation: AxisResult = { score: 0, evidence: [] };
  const stability: AxisResult = { score: 0, evidence: [] };
  const formalization: AxisResult = { score: 0, evidence: [] };
  const volatility: AxisResult = { score: 0, evidence: [] };

  function add(axis: AxisResult, delta: number, item: EvidenceItem) {
    axis.score += delta;
    axis.evidence.push(item);
  }

  // 大限夫妻宮 — 直接 중첩 vs 三方四正 진입을 다른 weight로, stability 축에 반영.
  if (majorSpouseBranch === natalSpouseBranch) {
    add(stability, WEIGHT.majorDirectOverlap, { type: "period", value: `大限夫妻宮=${majorSpouseBranch}(원국 夫妻宮 직접 중첩)` });
  } else if (sanfangBranches.has(majorSpouseBranch)) {
    add(stability, WEIGHT.majorSanfangOverlap, { type: "period", value: `大限夫妻宮=${majorSpouseBranch}(원국 삼방사정 진입)` });
  }

  // 流年夫妻宮 — 直接 중첩 vs 三方四正 진입을 다른 weight로, activation 축에 반영.
  if (annualSpouseBranch === natalSpouseBranch) {
    add(activation, WEIGHT.annualDirectOverlap, { type: "period", value: `流年夫妻宮=${annualSpouseBranch}(원국 夫妻宮 직접 중첩)` });
  } else if (sanfangBranches.has(annualSpouseBranch)) {
    add(activation, WEIGHT.annualSanfangOverlap, { type: "period", value: `流年夫妻宮=${annualSpouseBranch}(원국 삼방사정 진입)` });
  }

  // 그 해의 流年宮 자체가 夫妻宮/官祿(對宮) 축과 같은 지지에 놓이는지 — formalization.
  if (annualPeriod.branch === natalSpouseBranch || annualPeriod.branch === spouseEvidence.oppositePalace.branch) {
    add(formalization, WEIGHT.annualPalaceFormalization, { type: "period", value: `流年宮 branch=${annualPeriod.branch}(夫妻/官祿 축과 일치)` });
  }

  // 流年四化 — 化祿/化權/化科/化忌를 각각 다른 축에 개별 반영(하나로 합치지 않음).
  const stem = yearToStem(year);
  const table = ruleSet.sihuaTable[stem];
  const starToBranch = buildStarToBranchMap(chart);
  const kinds: SihuaKind[] = ["化祿", "化權", "化科", "化忌"];
  for (const kind of kinds) {
    const star = table[kind];
    const branch = starToBranch[star];
    if (!branch || !sanfangBranches.has(branch)) continue;
    const natalPalace = chart.palaces.find((p) => p.branch === branch)!.palace;
    const ev: EvidenceItem = { type: "transformation", value: `${kind}(${star})@${natalPalace}` };
    if (kind === "化祿") {
      add(activation, WEIGHT.luActivation, ev);
      add(formalization, WEIGHT.luFormalization, ev);
    } else if (kind === "化權") {
      add(activation, WEIGHT.quanActivation, ev);
    } else if (kind === "化科") {
      add(formalization, WEIGHT.keFormalization, ev);
    } else {
      add(activation, WEIGHT.jiActivation, ev);
      add(volatility, WEIGHT.jiVolatility, ev);
      add(stability, -WEIGHT.jiStabilityPenalty, ev);
    }
  }

  // 擎羊·陀羅가 이 해의 流年夫妻宮 자리(원국상 고정 위치)에 있으면 化忌와 같은 축 방향.
  const annualSpousePalaceObj = chart.palaces.find((p) => p.branch === annualSpouseBranch)!;
  for (const star of annualSpousePalaceObj.minorStars) {
    if (star.name !== "擎羊" && star.name !== "陀羅") continue;
    const ev: EvidenceItem = { type: "star", value: `${star.name}@${annualSpousePalaceObj.palace}(流年夫妻宮)` };
    add(activation, WEIGHT.yangTuoActivation, ev);
    add(volatility, WEIGHT.yangTuoVolatility, ev);
    add(stability, -WEIGHT.yangTuoStabilityPenalty, ev);
  }

  // 流年 紅鸞·天喜 — 생년 고정이 아니라 "그 해"의 연지를 기준으로 다시 계산.
  const annualHongluanTianxi = computeHongluanTianxi(yearToBranch(year));
  (Object.entries(annualHongluanTianxi) as [string, Branch][]).forEach(([name, branch]) => {
    if (branch === annualSpouseBranch || branch === natalSpouseBranch) {
      add(activation, WEIGHT.hongluanTianxiActivation, { type: "star", value: `${name}(流年)@${branch}` });
    }
  });

  return { year, activation, stability, formalization, volatility };
}

export function computeRelationshipTimingSignals(
  chart: ZiweiChart,
  ruleSet: RuleSet,
  years: number[],
): RelationshipTimingSignal[] {
  return years.map((year) => timingSignalForYear(chart, ruleSet, year));
}
