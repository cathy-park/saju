import type { WesternAdapterResult } from "./types.js";

export interface WesternBirthSource {
  calendarType: "solar" | "lunar";
  year: number; month: number; day: number;
  hour?: number; minute?: number;
  timeUnknown: boolean;
  latitude?: number; longitude?: number; timezone?: string;
  dstFold?: "earlier" | "later";
  [key: string]: unknown;
}
const pad = (value: number) => String(value).padStart(2, "0");
export function adaptBirthInputToWestern(source: WesternBirthSource): WesternAdapterResult {
  if (source.calendarType !== "solar") return { ok: false, errors: [{ code: "UNSUPPORTED_CALENDAR", field: "calendarType", message: "Western natal input requires an already resolved solar date" }] };
  if (source.timeUnknown || source.hour === undefined || source.minute === undefined) return { ok: false, errors: [{ code: "MISSING_BIRTH_TIME", field: "localDateTime", message: "An exact birth time is required for Placidus houses" }] };
  if (!Number.isFinite(source.latitude) || !Number.isFinite(source.longitude) || !source.timezone) return { ok: false, errors: [{ code: "MISSING_LOCATION_CONTEXT", field: "location", message: "Explicit latitude, longitude, and IANA timezone are required" }] };
  return { ok: true, input: { localDateTime: `${source.year}-${pad(source.month)}-${pad(source.day)}T${pad(source.hour)}:${pad(source.minute)}:00`, latitude: source.latitude!, longitude: source.longitude!, timezone: source.timezone, ...(source.dstFold ? { dstFold: source.dstFold } : {}) } };
}
