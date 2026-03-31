import {
  calculateSaju,
  solarToLunar,
  lunarToSolar,
  type SajuResult,
  type SajuOptions,
} from "@fullstackfamily/manseryeok";

// ── 균시차 (Equation of Time) ──────────────────────────────────────────────
// Returns the difference in MINUTES between Apparent Solar Time and Mean Solar
// Time for a given calendar date (Spencer 1971 approximation, accurate ±30 sec).
// Positive value → sun is ahead of mean time (TST > LMT).
// Range: approx −16 min (Nov) to +14 min (Feb).
export function equationOfTimeMins(year: number, month: number, day: number): number {
  // Day-of-year (1 = Jan 1)
  const start = Date.UTC(year, 0, 1);
  const cur   = Date.UTC(year, month - 1, day);
  const N = Math.round((cur - start) / 86400000) + 1;
  const B = (2 * Math.PI / 365) * (N - 81);
  return 9.87 * Math.sin(2 * B) - 7.53 * Math.cos(B) - 1.5 * Math.sin(B);
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
    eotOffsetMins = Math.round(equationOfTimeMins(solarYear, solarMonth, solarDay));
  }

  let rawResult: SajuResult;

  if (input.timeUnknown) {
    rawResult = calculateSaju(solarYear, solarMonth, solarDay, undefined, undefined, options);
  } else {
    // Apply EoT correction to hour/minute before calling library.
    let calcHour   = input.hour   ?? 0;
    let calcMinute = (input.minute ?? 0) + eotOffsetMins;
    // Normalise minutes into valid range (handles cross-hour and cross-day)
    while (calcMinute < 0)   { calcMinute += 60; calcHour -= 1; }
    while (calcMinute >= 60) { calcMinute -= 60; calcHour += 1; }
    calcHour = ((calcHour % 24) + 24) % 24;
    rawResult = calculateSaju(solarYear, solarMonth, solarDay, calcHour, calcMinute, options);
  }

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

  return {
    computedPillars,
    fiveElementDistribution,
    lunarDate,
    solarDate: { year: solarYear, month: solarMonth, day: solarDay },
    rawResult,
    isTimeCorrected: rawResult.isTimeCorrected,
    correctedTime: rawResult.correctedTime,
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
