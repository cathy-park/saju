import { adaptBirthInputToWestern, type WesternBirthSource } from "../../adapter.js";
import { calculateNatalChart } from "../../natalChart.js";
import type { WesternIssue } from "../../types.js";
import { buildWesternRelationshipReport } from "./report.js";
import type { WesternRelationshipReport } from "./types.js";

export type WesternRelationshipResolution = { ok: true; report: WesternRelationshipReport } | { ok: false; errors: WesternIssue[] };
export function resolveWesternRelationshipForBirth(source: WesternBirthSource): WesternRelationshipResolution {
  const adapted = adaptBirthInputToWestern(source);
  if (!adapted.ok) return adapted;
  const calculated = calculateNatalChart(adapted.input);
  if (!calculated.ok) return { ok: false, errors: calculated.errors };
  return { ok: true, report: buildWesternRelationshipReport(calculated.chart) };
}
