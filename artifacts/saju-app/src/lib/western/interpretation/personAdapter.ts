import { adaptBirthInputToWestern, type WesternBirthSource } from "../adapter";
import { calculateNatalChart } from "../natalChart";
import type { WesternIssue } from "../types";
import { buildWesternPersonalityReport } from "./report";
import type { WesternPersonalityReport } from "./types";

export type WesternPersonalityResolution = { ok: true; report: WesternPersonalityReport } | { ok: false; errors: WesternIssue[] };
export function resolveWesternPersonalityForBirth(source: WesternBirthSource): WesternPersonalityResolution {
  const adapted = adaptBirthInputToWestern(source);
  if (!adapted.ok) return adapted;
  const calculated = calculateNatalChart(adapted.input);
  if (!calculated.ok) return { ok: false, errors: calculated.errors };
  return { ok: true, report: buildWesternPersonalityReport(calculated.chart) };
}
