// 재물 주제 리포트 — spouseReport.ts와 동일한 구조(InterpretationFact → 충돌조정 →
// synthesizeText 합성)를 재사용하고, evidence source(財帛宮 삼방사정)와 domain meaning만
// 재물 주제에 맞게 새로 설계했다. 계산 엔진(buildZiweiChart/timingEngine)은 건드리지 않는다.
import type { EvidenceItem, ZiweiChart } from "../types";
import { extractWealthEvidence, type WealthEvidenceBundle } from "../wealthEvidence";
import { synthesizeText, type InterpretationFact } from "./interpretationFacts";
import { coreWealthFacts, incomeStyleFacts, spendingTendencyFacts, wealthVolatilityFacts, type WealthDomain } from "./wealthFacts";
import type { Confidence, SpouseStatement } from "./spouseReport";

export type WealthReportSectionKey = WealthDomain | "finalProfile";

export interface WealthReportSection {
  key: WealthReportSectionKey;
  title: string;
  statements: SpouseStatement[];
}

const SECTION_TITLES: Record<WealthReportSectionKey, string> = {
  coreWealth: "핵심 재물상",
  incomeStyle: "수입·소득 패턴",
  spendingTendency: "소비·관리 성향",
  volatility: "재물 변동성",
  finalProfile: "최종 재물 프로필",
};

function synthesizeStatements(facts: InterpretationFact[]): SpouseStatement[] {
  if (facts.length === 0) return [];
  const text = synthesizeText(facts);
  const evidence = facts.flatMap((f) => f.evidence);
  const borrowed = facts.some((f) => f.borrowed);
  const confidence: Confidence = borrowed ? "low" : evidence.length >= 3 ? "high" : "medium";
  return [{ text, evidence, confidence, facts }];
}

function buildFinalProfile(evidence: WealthEvidenceBundle): WealthReportSection {
  const majorEvidence: EvidenceItem[] = evidence.sanfangSizhengPalaces.flatMap((p) =>
    p.majorStars.map((s) => ({ type: "star" as const, value: `${s.name}@${p.palace}` })));
  const minorEvidence: EvidenceItem[] = evidence.sanfangSizhengPalaces.flatMap((p) =>
    p.minorStars.map((s) => ({ type: "star" as const, value: `${s.name}@${p.palace}` })));
  const sihuaEvidence: EvidenceItem[] = evidence.sihuaInScope.map((s) => ({
    type: "transformation" as const, value: `${s.kind}(${s.star})@${s.palace}`,
  }));

  return {
    key: "finalProfile",
    title: SECTION_TITLES.finalProfile,
    statements: [{
      text: "지금까지 살펴본 재물상·소득 패턴·소비 성향 등은 모두 아래에 정리된 구조적 근거에서 나온 것입니다.",
      evidence: [{ type: "palace", value: evidence.wealthPalace.palace }, ...majorEvidence, ...minorEvidence, ...sihuaEvidence],
      confidence: "high",
      facts: [],
    }],
  };
}

export interface WealthReport {
  personName: string;
  wealthEvidence: WealthEvidenceBundle;
  sections: WealthReportSection[];
}

export function buildWealthReport(chart: ZiweiChart, personName: string): WealthReport {
  const evidence = extractWealthEvidence(chart);
  const sections: WealthReportSection[] = [
    { key: "coreWealth", title: SECTION_TITLES.coreWealth, statements: synthesizeStatements(coreWealthFacts(evidence)) },
    { key: "incomeStyle", title: SECTION_TITLES.incomeStyle, statements: synthesizeStatements(incomeStyleFacts(evidence)) },
    { key: "spendingTendency", title: SECTION_TITLES.spendingTendency, statements: synthesizeStatements(spendingTendencyFacts(evidence)) },
    { key: "volatility", title: SECTION_TITLES.volatility, statements: synthesizeStatements(wealthVolatilityFacts(evidence)) },
    buildFinalProfile(evidence),
  ];
  return { personName, wealthEvidence: evidence, sections };
}
