import { lunarToSolar, solarToLunar, calculateSaju } from "@fullstackfamily/manseryeok";

export const isKnownCalendarSourceGap = (year: number, month: number, day: number) =>
  year === 1956 && month === 12 && day === 31;

/** One documented missing source row, not a generic invalid-date fallback.
 * HKO 1956 calendar: solar 1956-12-31 = ordinary lunar 1956-11-30.
 * Independent Korean calendar agrees. Existing adjacent rows confirm the
 * lunar transition, year/month pillars, daily cycle and integer Julian day.
 * https://www.hko.gov.hk/en/gts/time/calendar/pdf/files/1956e.pdf
 */
export function solarToLunarChecked(year: number, month: number, day: number): ReturnType<typeof solarToLunar> {
  if (!isKnownCalendarSourceGap(year, month, day)) return solarToLunar(year, month, day);
  const before = solarToLunar(1956, 12, 30);
  const after = solarToLunar(1957, 1, 1);
  if (before.lunar.year !== 1956 || before.lunar.month !== 11 || before.lunar.day !== 29 || before.lunar.isLeapMonth
    || after.lunar.year !== 1956 || after.lunar.month !== 12 || after.lunar.day !== 1 || after.lunar.isLeapMonth
    || before.gapja.dayPillar !== "신미" || after.gapja.dayPillar !== "계유"
    || before.gapja.yearPillar !== after.gapja.yearPillar || before.gapja.monthPillar !== after.gapja.monthPillar
    || after.julianDay - before.julianDay !== 2) {
    throw new Error("달력 원본 자료가 변경되어 누락 행 보완을 재검토해야 합니다.");
  }
  return {
    solar: { year, month, day },
    lunar: { year: 1956, month: 11, day: 30, isLeapMonth: false },
    gapja: { ...before.gapja, dayPillar: "임신", dayPillarHanja: "壬申" },
    julianDay: before.julianDay + 1,
  };
}

/** Reuse the dependency's hour calculation for an existing same-day-stem
 * anchor; replace only the verified missing row's calendar pillars.
 */
export function calculateSajuChecked(...args: Parameters<typeof calculateSaju>): ReturnType<typeof calculateSaju> {
  const [year, month, day, hour, minute, options] = args;
  if (!isKnownCalendarSourceGap(year, month, day)) return calculateSaju(...args);
  const row = solarToLunarChecked(year, month, day);
  const anchor = calculateSaju(1956, 12, 21, hour, minute, options);
  if (anchor.dayPillar[0] !== row.gapja.dayPillar[0]) throw new Error("시주 계산 기준 일간이 일치하지 않습니다.");
  return { ...anchor, ...row.gapja, gapja: row.gapja };
}

/**
 * manseryeok 1.0.8 searches only the solar year with the same number as the
 * requested lunar year. Late lunar months can fall in the following solar
 * January/February. Search existing source rows; never synthesize missing rows.
 */
export function lunarToSolarChecked(
  year: number,
  month: number,
  day: number,
  leap = false,
): ReturnType<typeof lunarToSolar> {
  if (
    ![year, month, day].every(Number.isInteger) ||
    year < 1900 ||
    year > 2050 ||
    month < 1 ||
    month > 12 ||
    day < 1 ||
    day > 30
  ) {
    throw new RangeError("지원 범위의 유효한 음력 날짜가 필요합니다.");
  }
  if (year === 1956 && month === 11 && day === 30 && !leap) {
    const row = solarToLunarChecked(1956, 12, 31);
    return { lunar: { year, month, day, isLeapMonth: false }, solar: row.solar, gapja: row.gapja };
  }
  try {
    return lunarToSolar(year, month, day, leap);
  } catch (originalError) {
    if (year >= 2050) throw originalError;
    const start = Date.UTC(year + 1, 0, 1);
    for (let offset = 0; offset < 60; offset++) {
      const date = new Date(start + offset * 86400000);
      let row;
      try {
        row = solarToLunar(
          date.getUTCFullYear(),
          date.getUTCMonth() + 1,
          date.getUTCDate(),
        );
      } catch {
        continue;
      }
      const lunar = row.lunar;
      if (
        lunar.year === year &&
        lunar.month === month &&
        lunar.day === day &&
        lunar.isLeapMonth === leap
      ) {
        return {
          lunar: { year, month, day, isLeapMonth: leap },
          solar: row.solar,
          gapja: row.gapja,
        };
      }
    }
    throw originalError;
  }
}
