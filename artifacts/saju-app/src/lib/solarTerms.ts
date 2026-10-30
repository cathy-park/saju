import { SearchSunLongitude } from "astronomy-engine";

export const MONTH_TERM_LONGITUDES = [285, 315, 345, 15, 45, 75, 105, 135, 165, 195, 225, 255] as const;
const cache = new Map<string, number>();
export function solarTermInstant(year: number, longitude: number): Date {
  const key = `${year}:${longitude}`;
  let ms = cache.get(key);
  if (ms === undefined) {
    const result = SearchSunLongitude(longitude, new Date(Date.UTC(year, 0, 1)), 370);
    if (!result) throw new RangeError("절기 시각을 계산할 수 없습니다.");
    ms = result.date.getTime();
    if (cache.size >= 4096) cache.delete(cache.keys().next().value!);
    cache.set(key, ms);
  }
  return new Date(ms);
}
export function surroundingMonthTerms(instant: Date) {
  if (!Number.isFinite(instant.getTime())) throw new RangeError("유효한 실제 시각이 필요합니다.");
  const year = instant.getUTCFullYear();
  return [year - 1, year, year + 1].flatMap(y => MONTH_TERM_LONGITUDES.map(longitude => ({
    year: y, longitude, instant: solarTermInstant(y, longitude),
  }))).sort((a, b) => a.instant.getTime() - b.instant.getTime());
}
const stems = ["갑", "을", "병", "정", "무", "기", "경", "신", "임", "계"];
const branches = ["자", "축", "인", "묘", "진", "사", "오", "미", "신", "유", "술", "해"];
const stemHanja = [..."甲乙丙丁戊己庚辛壬癸"];
const branchHanja = [..."子丑寅卯辰巳午未申酉戌亥"];
const mod = (n: number, d: number) => ((n % d) + d) % d;
export function solarTermYearMonth(instant: Date) {
  const terms = surroundingMonthTerms(instant);
  const active = [...terms].reverse().find(t => t.instant.getTime() <= instant.getTime())!;
  const lichun = [...terms].reverse().find(t => t.longitude === 315 && t.instant.getTime() <= instant.getTime())!;
  const ys = mod(lichun.year - 4, 10), yb = mod(lichun.year - 4, 12);
  const monthOffset = mod(active.longitude + 45, 360) / 30;
  const ms = mod([2, 4, 6, 8, 0][ys % 5] + monthOffset, 10), mb = mod(monthOffset + 2, 12);
  return {
    year: { hangul: stems[ys] + branches[yb], hanja: stemHanja[ys] + branchHanja[yb] },
    month: { hangul: stems[ms] + branches[mb], hanja: stemHanja[ms] + branchHanja[mb] },
    activeTermUtc: active.instant.toISOString(),
    nextTermUtc: terms.find(t => t.instant.getTime() > instant.getTime())!.instant.toISOString(),
  };
}
