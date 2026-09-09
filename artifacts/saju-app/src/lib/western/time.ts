/**
 * Adapted from astro-mcp v0.3.1, commit 76039f3 (MIT), src/core/time.ts.
 * Copyright (c) 2026 Wesley Liu. See THIRD_PARTY_NOTICES.md.
 */
import type { DstFold, WesternNatalInput } from "./types";

const WALL_PATTERN = /^(\d{4,})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?$/;
const BRACKET_MS = 25 * 60 * 60 * 1000;

export class WesternInputError extends Error {
  constructor(public readonly code: "INVALID_LOCAL_DATE_TIME" | "INVALID_TIMEZONE" | "NONEXISTENT_LOCAL_TIME" | "AMBIGUOUS_LOCAL_TIME", message: string) { super(message); }
}
function wallClockAt(utcMs: number, timezone: string): number {
  let parts: Intl.DateTimeFormatPart[];
  try {
    parts = new Intl.DateTimeFormat("en-US", {
      timeZone: timezone, year: "numeric", month: "2-digit", day: "2-digit",
      hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false,
    }).formatToParts(new Date(utcMs));
  } catch {
    throw new WesternInputError("INVALID_TIMEZONE", `Unknown or unsupported IANA timezone: ${timezone}`);
  }
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return Date.UTC(+values.year, +values.month - 1, +values.day, +values.hour % 24, +values.minute, +values.second);
}

function parseWallTime(value: string): { wallMs: number; normalized: string } {
  const match = WALL_PATTERN.exec(value);
  if (!match) throw new WesternInputError("INVALID_LOCAL_DATE_TIME", "localDateTime must be an ISO local wall time without an offset");
  const [, ys, mos, ds, hs, mis, ss = "00"] = match;
  const [year, month, day, hour, minute, second] = [ys, mos, ds, hs, mis, ss].map(Number);
  const wallMs = Date.UTC(year, month - 1, day, hour, minute, second);
  const check = new Date(wallMs);
  if (check.getUTCFullYear() !== year || check.getUTCMonth() !== month - 1 || check.getUTCDate() !== day || check.getUTCHours() !== hour || check.getUTCMinutes() !== minute || check.getUTCSeconds() !== second) {
    throw new WesternInputError("INVALID_LOCAL_DATE_TIME", `Invalid calendar date or clock time: ${value}`);
  }
  return { wallMs, normalized: `${ys}-${mos}-${ds}T${hs}:${mis}:${ss}` };
}

export function resolveLocalDateTime(input: Pick<WesternNatalInput, "localDateTime" | "timezone" | "dstFold"> & Partial<Pick<WesternNatalInput, "latitude" | "longitude">>): { utcInstant: string; localDateTime: string; utcOffsetMinutes: number; dstFold?: DstFold } {
  const { wallMs, normalized } = parseWallTime(input.localDateTime);
  // Sampling both sides discovers the offsets before/after an ordinary IANA transition.
  const beforeOffset = wallClockAt(wallMs - BRACKET_MS, input.timezone) - (wallMs - BRACKET_MS);
  const afterOffset = wallClockAt(wallMs + BRACKET_MS, input.timezone) - (wallMs + BRACKET_MS);
  const candidates = [...new Set([wallMs - beforeOffset, wallMs - afterOffset])]
    .filter((instant) => wallClockAt(instant, input.timezone) === wallMs)
    .sort((a, b) => a - b);
  if (candidates.length === 0) throw new WesternInputError("NONEXISTENT_LOCAL_TIME", `${normalized} does not exist in ${input.timezone}`);
  if (candidates.length > 1 && !input.dstFold) throw new WesternInputError("AMBIGUOUS_LOCAL_TIME", `${normalized} occurs twice in ${input.timezone}; dstFold is required`);
  const index = input.dstFold === "later" ? candidates.length - 1 : 0;
  const utcMs = candidates[index];
  return { utcInstant: new Date(utcMs).toISOString(), localDateTime: normalized, utcOffsetMinutes: (wallMs - utcMs) / 60000, ...(candidates.length > 1 ? { dstFold: input.dstFold } : {}) };
}
