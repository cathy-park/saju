import { adaptBirthInputToWestern, type WesternBirthSource } from "../adapter.js";
import { calculateNatalChart } from "../natalChart.js";
import { buildWesternPersonalityReport } from "../interpretation/report.js";
import { buildWesternRelationshipReport } from "../interpretation/romance/report.js";
import { buildWesternTransitReport } from "../transit/report.js";
import type { TransitQuery } from "../transit/types.js";
import { buildWesternSynastryReport } from "../synastry/report.js";
import type { WesternIssue } from "../types.js";
import { buildWesternPersonalSynthesis, buildWesternRelationshipSynthesis } from "./report.js";
import type { WesternPersonalSynthesisReport, WesternRelationshipSynthesisReport } from "./types.js";

type Resolution<T> = { ok: true; report: T } | { ok: false; errors: WesternIssue[] };
export interface SynthesisBirthSubject { personId: string; birth: WesternBirthSource }
function chartFor(birth: WesternBirthSource) {
  const input = adaptBirthInputToWestern(birth); if (!input.ok) return input;
  return calculateNatalChart(input.input);
}
export function resolveWesternPersonalSynthesisForBirth(personId: string, birth: WesternBirthSource, query?: TransitQuery): Resolution<WesternPersonalSynthesisReport> {
  const natal = chartFor(birth); if (!natal.ok) return natal;
  const personality = buildWesternPersonalityReport(natal.chart), romance = buildWesternRelationshipReport(natal.chart);
  const transit = query ? buildWesternTransitReport(natal.chart, query) : undefined;
  return { ok: true, report: buildWesternPersonalSynthesis({ personId, personality, romance, transit }) };
}
export function resolveWesternRelationshipSynthesisForBirths(first: SynthesisBirthSubject, second: SynthesisBirthSubject, query?: TransitQuery): Resolution<WesternRelationshipSynthesisReport> {
  const firstNatal = chartFor(first.birth); if (!firstNatal.ok) return firstNatal;
  const secondNatal = chartFor(second.birth); if (!secondNatal.ok) return secondNatal;
  const subject = (personId: string, chart: typeof firstNatal.chart) => ({ personId, personality: buildWesternPersonalityReport(chart), romance: buildWesternRelationshipReport(chart), ...(query ? { transit: buildWesternTransitReport(chart, query) } : {}) });
  const synastry = buildWesternSynastryReport({ personId: first.personId, chart: firstNatal.chart }, { personId: second.personId, chart: secondNatal.chart });
  return { ok: true, report: buildWesternRelationshipSynthesis({ first: subject(first.personId, firstNatal.chart), second: subject(second.personId, secondNatal.chart), synastry }) };
}
