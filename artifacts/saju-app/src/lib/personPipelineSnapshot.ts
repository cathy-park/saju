/**
 * PersonRecord → 동일 refYear(월운 연도)·세운·대운 간지로 파이프라인 스냅샷.
 * 리포트·궁합·복사 payload가 같은 타이밍 입력을 쓰도록 공통화합니다.
 */

import type { ComputedPillars } from "./sajuEngine";
import { countFiveElements } from "./sajuEngine";
import type { PersonRecord } from "./storage";
import { getFinalPillars } from "./storage";
import { calculateLuckCycles, type DaewoonSuOpts } from "./luckCycles";
import { computeSajuPipeline, type SajuPipelineResult } from "./sajuPipeline";

export function computePersonPipelineSnapshot(
  record: PersonRecord,
  opts?: { daewoonSuOpts?: DaewoonSuOpts },
): SajuPipelineResult | null {
  const pillars = getFinalPillars(record);
  const dayStem = pillars.day?.hangul?.[0] ?? "";
  if (!dayStem) return null;

  const input = record.birthInput;
  const daewoonSuOpts: DaewoonSuOpts =
    opts?.daewoonSuOpts ?? {
      exactSolarTermBoundaryOn: record.fortuneOptions?.exactSolarTermBoundaryOn ?? true,
      trueSolarTimeOn: record.fortuneOptions?.trueSolarTimeOn ?? false,
    };

  const luckCycles = calculateLuckCycles(input, record.profile.computedPillars, daewoonSuOpts);
  const refYear = luckCycles.wolun.year;
  const seunEntry = luckCycles.seun.find((e) => e.year === refYear) ?? luckCycles.seun[2];

  const dw0 = luckCycles.daewoon[0]?.startAge ?? 0;
  const adjustedDw = luckCycles.daewoon.map((entry, i) => ({
    ...entry,
    startAge: dw0 + i * 10,
    endAge: dw0 + i * 10 + 9,
  }));
  const age = refYear - input.year;
  const curDw = adjustedDw.find((e) => age >= e.startAge && age <= e.endAge);

  const allStems = [
    pillars.hour?.hangul?.[0],
    dayStem,
    pillars.month?.hangul?.[0],
    pillars.year?.hangul?.[0],
  ].filter((c): c is string => !!c);
  const allBranches = [
    pillars.hour?.hangul?.[1],
    pillars.day?.hangul?.[1],
    pillars.month?.hangul?.[1],
    pillars.year?.hangul?.[1],
  ].filter((c): c is string => !!c);

  const monthBranch = pillars.month?.hangul?.[1];
  const dayBranch = pillars.day?.hangul?.[1];

  return computeSajuPipeline({
    dayStem,
    monthBranch,
    dayBranch,
    dayPillarHangul: pillars.day?.hangul?.join("") || undefined,
    allStems,
    allBranches,
    effectiveFiveElements: countFiveElements(pillars as ComputedPillars),
    manualStrengthLevel: record.manualStrengthLevel ?? null,
    manualYongshinData: record.manualYongshinData ?? null,
    expertOptions: {
      seasonalAdjustmentOff: record.fortuneOptions?.seasonalAdjustmentOff === true,
    },
    timingDaewoonHangul: curDw?.ganZhi.hangul,
    timingSeunHangul: seunEntry?.ganZhi.hangul,
  });
}
