/** 사주 시간 보정의 날짜 이월과 감사 정보. 서양차트의 UTC 시각은 변경하지 않는다. */
export interface SolarDateTime {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
}

export interface TimeCalculationAudit {
  schemaVersion: "time-calculation-audit/v1";
  basis: "unknown" | "civil" | "local-mean" | "apparent-solar-approximate" | "equation-only";
  originalSolarDate: Pick<SolarDateTime, "year" | "month" | "day">;
  originalTime: Pick<SolarDateTime, "hour" | "minute"> | null;
  longitude: number;
  longitudeSource: "input" | "legacy-default";
  equationOfTimeMinutesApplied: number;
  libraryInput: SolarDateTime | null;
  effectiveTime: Pick<SolarDateTime, "hour" | "minute"> | null;
  hourBoundaryDistanceMinutes: number | null;
  timezoneVerification: "not-performed-by-this-wrapper";
  longitudeDateRolloverVerification: "delegated-to-library-not-independently-verified";
  warnings: string[];
}

/** 시간대 변환이 아닌 달력 연산. 음력은 호출 전에 양력으로 변환해야 한다. */
export function shiftSolarDateTime(
  year: number, month: number, day: number,
  hour: number, minute: number, offsetMinutes: number,
): SolarDateTime {
  if (![year, month, day, hour, minute, offsetMinutes].every(Number.isFinite)
    || ![year, month, day, hour, minute].every(Number.isInteger)
    || year < 100 || year > 9998 || month < 1 || month > 12 || day < 1 || day > 31
    || hour < 0 || hour > 23 || minute < 0 || minute > 59) {
    throw new RangeError("유효한 양력 날짜와 시각이 필요합니다.");
  }
  const original = new Date(Date.UTC(year, month - 1, day, hour, minute));
  if (original.getUTCFullYear() !== year || original.getUTCMonth() + 1 !== month || original.getUTCDate() !== day) {
    throw new RangeError("존재하지 않는 양력 날짜입니다.");
  }
  const shifted = new Date(original.getTime() + Math.round(offsetMinutes) * 60000);
  if (!Number.isFinite(shifted.getTime()) || shifted.getUTCFullYear() < 100 || shifted.getUTCFullYear() > 9998) {
    throw new RangeError("보정 후 날짜가 지원 범위를 벗어났습니다.");
  }
  return {
    year: shifted.getUTCFullYear(), month: shifted.getUTCMonth() + 1, day: shifted.getUTCDate(),
    hour: shifted.getUTCHours(), minute: shifted.getUTCMinutes(),
  };
}

/** 일반적인 홀수시 시진 경계까지의 분 거리. 출생시각 오차 확률이 아니다. */
export function hourBoundaryDistance(hour: number, minute: number): number {
  if (!Number.isInteger(hour) || !Number.isInteger(minute)
    || hour < 0 || hour > 23 || minute < 0 || minute > 59) throw new RangeError("유효하지 않은 시각입니다.");
  const position = ((hour * 60 + minute - 60) % 120 + 120) % 120;
  return Math.min(position, 120 - position);
}
