import { adaptBirthInputToWestern, type WesternBirthSource } from "../adapter.js";
import { calculateNatalChart } from "../natalChart.js";
import type { WesternIssue } from "../types.js";
import { buildWesternTransitReport } from "./report.js";
import type { TransitQuery, WesternTransitReport } from "./types.js";

export type WesternTransitResolution = { ok: true; report: WesternTransitReport } | { ok: false; errors: WesternIssue[] };

export function resolveWesternTransitForBirth(source: WesternBirthSource, query: TransitQuery): WesternTransitResolution {
  const adapted = adaptBirthInputToWestern(source);
  if (!adapted.ok) return adapted;
  const calculated = calculateNatalChart(adapted.input);
  if (!calculated.ok) return { ok: false, errors: calculated.errors };
  return { ok: true, report: buildWesternTransitReport(calculated.chart, query) };
}
