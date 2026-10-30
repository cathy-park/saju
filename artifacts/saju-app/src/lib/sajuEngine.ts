import { lunarToSolarChecked as lunarToSolar } from "./calendarConversion";
import {
  calculateSaju,
  solarToLunar,
  type SajuResult,
  type SajuOptions,
} from "@fullstackfamily/manseryeok";
import { shiftSolarDateTime, hourBoundaryDistance, type TimeCalculationAudit } from "./timeCalculationAudit";

// ── 균시차 (Equation of Time) ──────────────────────────────────────────────
// Returns the difference in MINUTES between Apparent Solar Time and Mean Solar
// Time for a given calendar date using the existing approximate formula.
// No sub-minute accuracy guarantee is asserted; boundary cases need sensitivity tests.
// Positive value → sun is ahead of mean time (TST > LMT).
// Sign convention: apparent minus mean solar time (February negative, November positive).
export function equationOfTimeMins(year: number, month: number, day: number, hour = 12, minute = 0): number {
  // USNO approximate solar coordinates at the original UTC+9 civil instant.
  // Date-only callers default to KST noon. This remains an approximation.
  const D = Date.UTC(year, month - 1, day, hour - 9, minute) / 86400000 + 2440587.5 - 2451545;
  const norm = (n: number) => ((n % 360) + 360) % 360;
  const rad = Math.PI / 180;
  const g = norm(357.529 + 0.98560028 * D) * rad;
  const q = norm(280.459 + 0.98564736 * D);
  const L = (q + 1.915 * Math.sin(g) + 0.020 * Math.sin(2 * g)) * rad;
  const epsilon = (23.439 - 0.00000036 * D) * rad;
  const ra = norm(Math.atan2(Math.cos(epsilon) * Math.sin(L), Math.cos(L)) / rad);
  return (norm(q - ra + 180) - 180) * 4;
}

export interface BirthInput {
  name: string;
  gender: "남" | "여";
  calendarType: "solar" | "lunar";
  year: number;
  month: number;
  day: number;
  hour?: number;
  minute?: number;
  birthplace?: string;
  timeUnknown: boolean;
  longitude?: number;
  leapMonth?: boolean;
  relationshipStatus?: "미혼" | "연애중" | "기혼";
}

export interface Pillar {
  hangul: string;
  hanja: string;
}

export interface ComputedPillars {
  year: Pillar;
  month: Pillar;
  day: Pillar;
  hour: Pillar | null;
}

export interface FiveElementCount {
  목: number;
  화: number;
  토: number;
  금: number;
  수: number;
}

export interface SajuProfile {
  computedPillars: ComputedPillars;
  fiveElementDistribution: FiveElementCount;
  lunarDate?: {
    year: number;
    month: number;
    day: number;
    isLeapMonth: boolean;
  };
  solarDate: {
    year: number;
    month: number;
    day: number;
  };
  rawResult: SajuResult;
  isTimeCorrected: boolean;
  correctedTime?: { hour: number; minute: number };
  timeAudit?: TimeCalculationAudit;
}

const STEM_ELEMENTS: Record<string, keyof FiveElementCount> = {
  갑: "목", 을: "목",
  병: "화", 정: "화",
  무: "토", 기: "토",
  경: "금", 신: "금",
  임: "수", 계: "수",
};

const BRANCH_ELEMENTS: Record<string, keyof FiveElementCount> = {
  자: "수", 축: "토",
  인: "목", 묘: "목",
  진: "토", 사: "화",
  오: "화", 미: "토",
  신: "금", 유: "금",
  술: "토", 해: "수",
};

function getElement(char: string): keyof FiveElementCount | null {
  return STEM_ELEMENTS[char] || BRANCH_ELEMENTS[char] || null;
}

export function countFiveElements(pillars: ComputedPillars): FiveElementCount {
  const counts: FiveElementCount = { 목: 0, 화: 0, 토: 0, 금: 0, 수: 0 };
  const pillarsToCount = [pillars.year, pillars.month, pillars.day, pillars.hour].filter(
    Boolean
  ) as Pillar[];

  for (const pillar of pillarsToCount) {
    const chars = pillar.hangul.split("");
    for (const ch of chars) {
      const el = getElement(ch);
      if (el) counts[el]++;
    }
  }
  return counts;
}

export interface TimeCorrectOpts {
  /** Apply longitude-based Local Mean Time correction (default: true) */
  localMeridianOn?: boolean;
  /** Apply Equation of Time (균시차) on top of LMT correction (default: false) */
  trueSolarTimeOn?: boolean;
}

export function calculateProfileFromBirth(input: BirthInput, timeOpts?: TimeCorrectOpts): SajuProfile {
  if (!["solar", "lunar"].includes(input.calendarType) || !["남", "여"].includes(input.gender)) throw new RangeError("유효한 달력과 성별이 필요합니다.");
  if (!Number.isInteger(input.year) || input.year < 1900 || input.year > 2050) throw new RangeError("지원 연도는 1900~2050년입니다.");
  if (input.leapMonth) throw new RangeError("음력 윤달은 양력으로 변환해 입력해 주세요.");
  if (input.longitude != null && (!Number.isFinite(input.longitude) || Math.abs(input.longitude) > 180)) throw new RangeError("유효한 경도가 필요합니다.");
  if (!input.timeUnknown && (input.hour == null || input.minute == null)) throw new RangeError("출생 시각과 분이 필요합니다.");
  if (input.calendarType === "solar") shiftSolarDateTime(input.year, input.month, input.day, input.timeUnknown ? 0 : input.hour!, input.timeUnknown ? 0 : input.minute!, 0);
  let solarYear = input.year;
  let solarMonth = input.month;
  let solarDay = input.day;

  let lunarDate: SajuProfile["lunarDate"] | undefined;

  if (input.calendarType === "lunar") {
    const converted = lunarToSolar(
      input.year,
      input.month,
      input.day,
      false
    );
    solarYear = converted.solar.year;
    solarMonth = converted.solar.month;
    solarDay = converted.solar.day;

    lunarDate = {
      year: input.year,
      month: input.month,
      day: input.day,
      isLeapMonth: false,
    };
  } else {
    const converted = solarToLunar(input.year, input.month, input.day);
    lunarDate = {
      year: converted.lunar.year,
      month: converted.lunar.month,
      day: converted.lunar.day,
      isLeapMonth: converted.lunar.isLeapMonth,
    };
  }

  // ── Time-correction logic ──────────────────────────────────────────
  // localMeridianOn defaults to true (library already applies it).
  // trueSolarTimeOn defaults to false (adds EoT on top of LMT).
  const localMeridianOn = timeOpts?.localMeridianOn ?? true;
  const trueSolarTimeOn = !input.timeUnknown && (timeOpts?.trueSolarTimeOn ?? false);

  const options: SajuOptions = {
    longitude: input.longitude ?? 127,
    // Let library handle LMT correction only when localMeridianOn AND time is known.
    applyTimeCorrection: !input.timeUnknown && localMeridianOn,
  };

  // Equation of Time (균시차) offset in minutes — applied when trueSolarTimeOn.
  let eotOffsetMins = 0;
  if (trueSolarTimeOn) {
    eotOffsetMins = Math.round(equationOfTimeMins(solarYear, solarMonth, solarDay, input.hour, input.minute));
  }

  // The dependency only normalizes a single negative minute/hour and discards
  // date rollover. Apply both offsets here, then call its uncorrected calculator.
  const longitudeOffsetMins = !input.timeUnknown && localMeridianOn
    ? -Math.round((135 - (input.longitude ?? 127)) * 4) : 0;
  const libraryInput = input.timeUnknown ? null : shiftSolarDateTime(
    solarYear, solarMonth, solarDay, input.hour!, input.minute!, eotOffsetMins + longitudeOffsetMins,
  );
  const rawResult: SajuResult = input.timeUnknown
    ? calculateSaju(solarYear, solarMonth, solarDay, undefined, undefined, { ...options, applyTimeCorrection: false })
    : calculateSaju(libraryInput!.year, libraryInput!.month, libraryInput!.day, libraryInput!.hour, libraryInput!.minute, { ...options, applyTimeCorrection: false });
  // Preserve legacy fields: these describe the longitude correction only.
  rawResult.isTimeCorrected = longitudeOffsetMins !== 0;
  if (rawResult.isTimeCorrected) rawResult.correctedTime = { hour: libraryInput!.hour, minute: libraryInput!.minute };

  const computedPillars: ComputedPillars = {
    year: { hangul: rawResult.yearPillar, hanja: rawResult.yearPillarHanja },
    month: { hangul: rawResult.monthPillar, hanja: rawResult.monthPillarHanja },
    day: { hangul: rawResult.dayPillar, hanja: rawResult.dayPillarHanja },
    hour: input.timeUnknown
      ? null
      : rawResult.hourPillar
      ? {
          hangul: rawResult.hourPillar,
          hanja: rawResult.hourPillarHanja ?? "",
        }
      : null,
  };

  const fiveElementDistribution = countFiveElements(computedPillars);

  // 원본 출생시각은 보존하고 보정의 단계/한계를 별도 노출한다.
  const effectiveTime = libraryInput ? { hour: libraryInput.hour, minute: libraryInput.minute } : null;
  const warnings: string[] = ["SOLAR_TERM_INSTANT_NOT_SUPPORTED", "SAJU_FIXED_UTC9_TIMEZONE_NOT_VERIFIED"];
  if (!input.timeUnknown && localMeridianOn && input.longitude == null) warnings.push("DEFAULT_LONGITUDE_USED");
  if (trueSolarTimeOn) warnings.push("EQUATION_OF_TIME_APPROXIMATION");
  if (trueSolarTimeOn && !localMeridianOn) warnings.push("EOT_WITHOUT_LONGITUDE_NOT_TRUE_SOLAR_TIME");
  if (!input.timeUnknown && localMeridianOn && !effectiveTime) warnings.push("CORRECTED_TIME_UNAVAILABLE");
  const boundary = effectiveTime ? hourBoundaryDistance(effectiveTime.hour, effectiveTime.minute) : null;
  if (boundary !== null && boundary <= 5) warnings.push("HOUR_BRANCH_BOUNDARY_WITHIN_5_MINUTES");
  const timeAudit: TimeCalculationAudit = {
    schemaVersion: "time-calculation-audit/v1",
    basis: input.timeUnknown ? "unknown" : trueSolarTimeOn
      ? (localMeridianOn ? "apparent-solar-approximate" : "equation-only")
      : (localMeridianOn ? "local-mean" : "civil"),
    originalSolarDate: { year: solarYear, month: solarMonth, day: solarDay },
    originalTime: input.timeUnknown ? null : { hour: input.hour ?? 0, minute: input.minute ?? 0 },
    longitude: input.longitude ?? 127,
    longitudeSource: input.longitude == null ? "legacy-default" : "input",
    equationOfTimeMinutesApplied: eotOffsetMins,
    libraryInput,
    effectiveTime,
    effectiveSolarDateTime: libraryInput,
    longitudeMinutesApplied: longitudeOffsetMins,
    hourBoundaryDistanceMinutes: boundary,
    timezoneVerification: "not-performed-by-this-wrapper",
    longitudeDateRolloverVerification: "wrapper-calendar-arithmetic",
    warnings,
  };

  return {
    computedPillars,
    fiveElementDistribution,
    lunarDate,
    solarDate: { year: solarYear, month: solarMonth, day: solarDay },
    rawResult,
    isTimeCorrected: rawResult.isTimeCorrected,
    correctedTime: rawResult.correctedTime,
    timeAudit,
  };
}

export const ELEMENT_COLORS: Record<keyof FiveElementCount, string> = {
  목: "text-green-600",
  화: "text-red-500",
  토: "text-yellow-600",
  금: "text-gray-500",
  수: "text-blue-600",
};

export const ELEMENT_BG_COLORS: Record<keyof FiveElementCount, string> = {
  목: "bg-green-100 text-green-800",
  화: "bg-red-100 text-red-800",
  토: "bg-yellow-100 text-yellow-800",
  금: "bg-gray-100 text-gray-700",
  수: "bg-blue-100 text-blue-800",
};
