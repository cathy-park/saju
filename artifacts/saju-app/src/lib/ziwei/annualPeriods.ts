// Annual year labels are lunar years, spanning lunar new year to the next lunar new year.
import { ziweiLunarYearRange } from "./calendarPolicy";
import { BRANCHES, type AnnualPeriod, type Branch, type PalaceName } from "./types";

function mod12(n: number): number {
  return ((n % 12) + 12) % 12;
}

export function yearToBranch(year: number): Branch {
  return BRANCHES[mod12(year - 1984)];
}

export function computeAnnualPeriods(
  years: number[],
  palaceOfBranch: Record<Branch, PalaceName>,
): AnnualPeriod[] {
  return years.map((year) => {
    const branch = yearToBranch(year);
    return { year, palace: palaceOfBranch[branch], branch, ...ziweiLunarYearRange(year) };
  });
}
