import { adaptBirthInputToWestern, type WesternBirthSource } from "../adapter.js";
import { calculateNatalChart } from "../natalChart.js";
import type { WesternIssue } from "../types.js";
import { buildWesternSynastryReport } from "./report.js";
import type { WesternSynastryReport } from "./types.js";

export interface SynastryBirthSubject { personId: string; birth: WesternBirthSource }
export type WesternSynastryResolution = { ok: true; report: WesternSynastryReport } | { ok: false; errors: WesternIssue[] };
export function resolveWesternSynastryForBirths(first: SynastryBirthSubject, second: SynastryBirthSubject): WesternSynastryResolution {
  const firstInput = adaptBirthInputToWestern(first.birth); if (!firstInput.ok) return firstInput;
  const secondInput = adaptBirthInputToWestern(second.birth); if (!secondInput.ok) return secondInput;
  const firstChart = calculateNatalChart(firstInput.input); if (!firstChart.ok) return { ok: false, errors: firstChart.errors };
  const secondChart = calculateNatalChart(secondInput.input); if (!secondChart.ok) return { ok: false, errors: secondChart.errors };
  return { ok: true, report: buildWesternSynastryReport({ personId: first.personId, chart: firstChart.chart }, { personId: second.personId, chart: secondChart.chart }) };
}
