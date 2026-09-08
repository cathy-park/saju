// 연애 주제 리포트 — wealthReport.ts/careerReport.ts/natureReport.ts와 동일한 구조
// (InterpretationFact → 충돌조정 → synthesizeText 합성, 본문/근거 분리)를 재사용한다.
// evidence는 spouseEvidence.ts를 그대로 재사용하고(새 evidence 파일 없음), domain meaning만
// "배우자상"이 아니라 "나의 연애 방식"에 맞게 새로 설계했다. 계산 엔진은 건드리지 않는다.
import type { EvidenceItem, ZiweiChart } from "../types";
import { extractSpouseEvidence, type SpouseEvidenceBundle } from "../spouseEvidence";
import { synthesizeText, type InterpretationFact } from "./interpretationFacts";
import { attractionFacts, expressionFacts, conflictFacts, managementFacts, type RomanceDomain } from "./romanceFacts";
import type { Confidence, SpouseStatement } from "./spouseReport";

export type RomanceReportSectionKey = RomanceDomain | "finalProfile";

export interface RomanceReportSection {
  key: RomanceReportSectionKey;
  title: string;
  statements: SpouseStatement[];
}

const SECTION_TITLES: Record<RomanceReportSectionKey, string> = {
  attraction: "끌리는 포인트",
  expression: "표현 방식",
  conflict: "갈등 대응",
  management: "관계 운영",
  finalProfile: "최종 연애 프로필",
};

function synthesizeStatements(facts: InterpretationFact[]): SpouseStatement[] {
  if (facts.length === 0) return [];
  const text = synthesizeText(facts);
  const evidence = facts.flatMap((f) => f.evidence);
  const borrowed = facts.some((f) => f.borrowed);
  const confidence: Confidence = borrowed ? "low" : evidence.length >= 3 ? "high" : "medium";
  return [{ text, evidence, confidence, facts }];
}

function buildFinalProfile(evidence: SpouseEvidenceBundle): RomanceReportSection {
  const mingGong = evidence.mingGongRelation.mingGongPalace;
  const fude = evidence.trinePalaces.find((p) => p.palace === "福德宮");
  const majorEvidence: EvidenceItem[] = [
    ...mingGong.majorStars.map((s) => ({ type: "star" as const, value: `${s.name}@${mingGong.palace}` })),
    ...(fude ? fude.majorStars.map((s) => ({ type: "star" as const, value: `${s.name}@${fude.palace}` })) : []),
    ...evidence.oppositePalace.majorStars.map((s) => ({ type: "star" as const, value: `${s.name}@${evidence.oppositePalace.palace}` })),
  ];
  const sihuaEvidence: EvidenceItem[] = evidence.sihuaInScope.map((s) => ({
    type: "transformation" as const, value: `${s.kind}(${s.star})@${s.palace}`,
  }));

  return {
    key: "finalProfile",
    title: SECTION_TITLES.finalProfile,
    statements: [{
      text: "지금까지 살펴본 끌리는 포인트·표현 방식·갈등 대응·관계 운영은 모두 아래에 정리된 구조적 근거에서 나온 것입니다.",
      evidence: [{ type: "palace", value: mingGong.palace }, ...majorEvidence, ...sihuaEvidence],
      confidence: "high",
      facts: [],
    }],
  };
}

export interface RomanceReport {
  personName: string;
  spouseEvidence: SpouseEvidenceBundle;
  sections: RomanceReportSection[];
}

export function buildRomanceReport(chart: ZiweiChart, personName: string): RomanceReport {
  const evidence = extractSpouseEvidence(chart);
  const sections: RomanceReportSection[] = [
    { key: "attraction", title: SECTION_TITLES.attraction, statements: synthesizeStatements(attractionFacts(evidence)) },
    { key: "expression", title: SECTION_TITLES.expression, statements: synthesizeStatements(expressionFacts(evidence)) },
    { key: "conflict", title: SECTION_TITLES.conflict, statements: synthesizeStatements(conflictFacts(evidence)) },
    { key: "management", title: SECTION_TITLES.management, statements: synthesizeStatements(managementFacts(evidence)) },
    buildFinalProfile(evidence),
  ];
  return { personName, spouseEvidence: evidence, sections };
}
