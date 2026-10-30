import type { PersonRecord } from "../storage";
import { computePersonPipelineSnapshot } from "../personPipelineSnapshot";
import { buildSajuSummarySections } from "../sajuSummaryFacts";
import { buildZiweiChart } from "../ziwei/buildZiweiChart";
import type { ZiweiChart } from "../ziwei/types";
import { zhongzhouV1 } from "../ziwei/ruleSets/zhongzhouV1";
import { spouseReportTimingYears } from "../ziwei/reports/spouseReport";
import { buildComprehensiveReport, type ComprehensiveReport } from "../ziwei/reports/comprehensiveReport";

export function buildExistingPersonalReports(person: PersonRecord, at: Date = new Date()) {
  const pipeline = computePersonPipelineSnapshot(person, { at });
  const saju = pipeline ? buildSajuSummarySections(pipeline, [], []) : [];
  let ziwei: ComprehensiveReport | null = null;
  let ziweiChart: ZiweiChart | null = null;
  const input = person.birthInput;
  if (!input.timeUnknown && input.hour !== undefined) {
    ziweiChart = buildZiweiChart({ name: input.name, gender: input.gender, calendarType: input.calendarType, year: input.year, month: input.month, day: input.day, hour: input.hour, minute: input.minute, birthplace: input.birthplace }, zhongzhouV1, spouseReportTimingYears(at));
    ziwei = buildComprehensiveReport(ziweiChart, zhongzhouV1, input.name, at);
  }
  return { saju, ziwei, ziweiChart };
}
