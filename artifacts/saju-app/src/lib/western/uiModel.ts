import type { PersonRecord } from "../storage";
import type { WesternBirthSource } from "./adapter";

export const westernRoutes = {
  personal: (personId: string) => ({
    overview: `/western/${personId}/overview`,
    personality: `/western/${personId}/personality`,
    romance: `/western/${personId}/romance`,
    transit: `/western/${personId}/transit`,
  }),
  relationship: (personId: string, otherPersonId: string) => ({
    overview: `/western/${personId}/synastry/${otherPersonId}/overview`,
    details: `/western/${personId}/synastry/${otherPersonId}/details`,
  }),
};

export function westernBirthSource(person: PersonRecord): WesternBirthSource {
  const location = person.westernLocation;
  return {
    ...person.birthInput,
    latitude: location?.latitude,
    longitude: location?.longitude,
    timezone: location?.timezone,
  };
}

const MONTH = /^\d{4}-(0[1-9]|1[0-2])$/;

export function monthFromSearch(search: string, fallback: string): string {
  const value = new URLSearchParams(search).get("month") ?? "";
  return MONTH.test(value) ? value : fallback;
}

export function shiftMonth(value: string, amount: number): string {
  const [year, month] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1 + amount, 1));
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}

export function monthRange(value: string): { start: string; end: string } {
  const [year, month] = value.split("-").map(Number);
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return { start: `${value}-01`, end: `${value}-${String(lastDay).padStart(2, "0")}` };
}

export function monthInTimezone(timezone: string, now = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: timezone, year: "numeric", month: "2-digit" }).formatToParts(now);
  const part = (type: Intl.DateTimeFormatPartTypes) => parts.find((item) => item.type === type)?.value ?? "";
  return `${part("year")}-${part("month")}`;
}

export function validateWesternLocation(location: NonNullable<PersonRecord["westernLocation"]>): string | null {
  if (!location.placeLabel.trim()) return "출생지 표시 이름을 입력해주세요.";
  if (!Number.isFinite(location.latitude) || location.latitude < -90 || location.latitude > 90) return "위도는 -90~90 사이여야 합니다.";
  if (!Number.isFinite(location.longitude) || location.longitude < -180 || location.longitude > 180) return "경도는 -180~180 사이여야 합니다.";
  if (!location.timezone.includes("/")) return "대륙/도시 형식의 IANA 시간대를 입력해주세요.";
  try {
    new Intl.DateTimeFormat("en", { timeZone: location.timezone }).format(new Date());
  } catch {
    return "지원되는 IANA 시간대를 입력해주세요.";
  }
  return null;
}
