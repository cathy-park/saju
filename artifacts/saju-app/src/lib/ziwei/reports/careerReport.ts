// 커리어 주제 리포트 — wealthReport.ts와 동일한 구조(InterpretationFact → 충돌조정 →
// synthesizeText 합성)를 재사용하고, evidence source(事業宮 삼방사정)와 domain meaning만
// 커리어 주제에 맞게 새로 설계했다. 계산 엔진은 건드리지 않는다.
import type { EvidenceItem, ZiweiChart } from "../types";
import { extractCareerEvidence, type CareerEvidenceBundle } from "../careerEvidence";
import { synthesizeText, type InterpretationFact } from "./interpretationFacts";
import {
  coreCareerFacts, workStyleFacts, collaborationEnvironmentFacts, achievementVolatilityFacts,
  type CareerDomain,
} from "./careerFacts";
import type { Confidence, SpouseStatement } from "./spouseReport";

export type CareerReportSectionKey = CareerDomain | "finalProfile";

export interface CareerReportSection {
  key: CareerReportSectionKey;
  title: string;
  statements: SpouseStatement[];
}

const SECTION_TITLES: Record<CareerReportSectionKey, string> = {
  coreCareer: "핵심 커리어상",
  workStyle: "일하는 방식",
  collaborationEnvironment: "협업·대인 환경",
  achievementVolatility: "성취 변동성",
  finalProfile: "최종 커리어 프로필",
};

function synthesizeStatements(facts: InterpretationFact[]): SpouseStatement[] {
  if (facts.length === 0) return [];
  const text = synthesizeText(facts);
  const evidence = facts.flatMap((f) => f.evidence);
  const borrowed = facts.some((f) => f.meaning.includes("借星"));
  const confidence: Confidence = borrowed ? "low" : evidence.length >= 3 ? "high" : "medium";
  return [{ text, evidence, confidence, facts }];
}

function buildFinalProfile(evidence: CareerEvidenceBundle): CareerReportSection {
  const sanfangMajors = evidence.sanfangSizhengPalaces
    .flatMap((p) => p.majorStars.map((s) => `${s.name}@${p.palace}`))
    .join(", ") || "없음";
  const sanfangMinors = evidence.sanfangSizhengPalaces
    .flatMap((p) => p.minorStars.map((s) => `${s.name}@${p.palace}`))
    .join(", ") || "없음";
  const sihuaNames = evidence.sihuaInScope.map((s) => `${s.star}(${s.kind})`).join(", ") || "없음";

  const text = `事業宮(${evidence.careerPalace.branch}) 삼방사정 主星: ${sanfangMajors} / 보조성: ${sanfangMinors} / 관련 생년사화: ${sihuaNames}`;
  const evidenceItems: EvidenceItem[] = [
    { type: "palace", value: evidence.careerPalace.palace },
    ...evidence.careerPalace.majorStars.map((s) => ({ type: "star" as const, value: `${s.name}@事業宮` })),
  ];

  return {
    key: "finalProfile",
    title: SECTION_TITLES.finalProfile,
    statements: [{ text, evidence: evidenceItems, confidence: "high", facts: [] }],
  };
}

export interface CareerReport {
  personName: string;
  careerEvidence: CareerEvidenceBundle;
  sections: CareerReportSection[];
}

export function buildCareerReport(chart: ZiweiChart, personName: string): CareerReport {
  const evidence = extractCareerEvidence(chart);
  const sections: CareerReportSection[] = [
    { key: "coreCareer", title: SECTION_TITLES.coreCareer, statements: synthesizeStatements(coreCareerFacts(evidence)) },
    { key: "workStyle", title: SECTION_TITLES.workStyle, statements: synthesizeStatements(workStyleFacts(evidence)) },
    { key: "collaborationEnvironment", title: SECTION_TITLES.collaborationEnvironment, statements: synthesizeStatements(collaborationEnvironmentFacts(evidence)) },
    { key: "achievementVolatility", title: SECTION_TITLES.achievementVolatility, statements: synthesizeStatements(achievementVolatilityFacts(evidence)) },
    buildFinalProfile(evidence),
  ];
  return { personName, careerEvidence: evidence, sections };
}
