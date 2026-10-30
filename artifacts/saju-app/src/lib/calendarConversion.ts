import { lunarToSolar, solarToLunar } from "@fullstackfamily/manseryeok";

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
