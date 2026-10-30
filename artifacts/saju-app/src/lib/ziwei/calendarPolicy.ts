import { solarToLunarChecked, lunarToSolarChecked } from "../calendarConversion";

/** Ziwei uses the original civil date in Korea, lunar-new-year and midnight boundaries. */
export function ziweiQueryLunarYear(at: Date = new Date()): number {
  if (!Number.isFinite(at.getTime())) throw new RangeError("유효한 조회 일시가 필요합니다.");
  const local = new Date(at.getTime() + 9 * 3600000);
  return solarToLunarChecked(local.getUTCFullYear(), local.getUTCMonth() + 1, local.getUTCDate()).lunar.year;
}
export function ziweiInclusiveAge(birthLunarYear: number, queryLunarYear: number): number {
  return queryLunarYear - birthLunarYear + 1;
}
export function ziweiLunarYearRange(year: number) {
  const start = lunarToSolarChecked(year, 1, 1, false).solar;
  const end = lunarToSolarChecked(year + 1, 1, 1, false).solar;
  const civil = (d: typeof start) => `${d.year}-${String(d.month).padStart(2, "0")}-${String(d.day).padStart(2, "0")}T00:00:00+09:00`;
  return { basis: "lunar-year-inclusive-age" as const, startCivilInclusive: civil(start), endCivilExclusive: civil(end) };
}
