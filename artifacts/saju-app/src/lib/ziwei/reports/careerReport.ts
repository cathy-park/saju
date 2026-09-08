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
  const borrowed = facts.some((f) => f.borrowed);
  const confidence: Confidence = borrowed ? "low" : evidence.length >= 3 ? "high" : "medium";
  return [{ text, evidence, confidence, facts }];
}

function buildFinalProfile(evidence: CareerEvidenceBundle): CareerReportSection {
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
      text: "지금까지 살펴본 커리어상·일하는 방식·협업 환경 등은 모두 아래에 정리된 구조적 근거에서 나온 것입니다.",
      evidence: [{ type: "palace", value: evidence.careerPalace.palace }, ...majorEvidence, ...minorEvidence, ...sihuaEvidence],
      confidence: "high",
      facts: [],
    }],
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
