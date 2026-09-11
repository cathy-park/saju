import { adaptBirthInputToWestern, type WesternBirthSource } from "../adapter.js";
import { calculateNatalChart } from "../natalChart.js";
import type { WesternIssue } from "../types.js";
import { buildWesternPersonalityReport } from "./report.js";
import type { WesternPersonalityReport } from "./types.js";

export type WesternPersonalityResolution = { ok: true; report: WesternPersonalityReport } | { ok: false; errors: WesternIssue[] };
export function resolveWesternPersonalityForBirth(source: WesternBirthSource): WesternPersonalityResolution {
  const adapted = adaptBirthInputToWestern(source);
  if (!adapted.ok) return adapted;
  const calculated = calculateNatalChart(adapted.input);
  if (!calculated.ok) return { ok: false, errors: calculated.errors };
  return { ok: true, report: buildWesternPersonalityReport(calculated.chart) };
}
