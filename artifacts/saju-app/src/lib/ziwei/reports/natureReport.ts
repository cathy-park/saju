// 타고난 성향 주제 리포트 — wealthReport.ts/careerReport.ts와 동일한 구조(InterpretationFact
// → 충돌조정 → synthesizeText 합성, 본문/근거 분리)를 재사용하고, evidence source(命宮
// 삼방사정+身宮)와 domain meaning만 새로 설계했다. 계산 엔진은 건드리지 않는다.
import type { EvidenceItem, ZiweiChart } from "../types";
import { extractNatureEvidence, type NatureEvidenceBundle } from "../natureEvidence";
import { synthesizeText, type InterpretationFact } from "./interpretationFacts";
import {
  coreNatureFacts, lifeDirectionFacts, socialImpressionFacts, lifeAttitudeFacts,
  type NatureDomain,
} from "./natureFacts";
import type { Confidence, SpouseStatement } from "./spouseReport";

export type NatureReportSectionKey = NatureDomain | "finalProfile";

export interface NatureReportSection {
  key: NatureReportSectionKey;
  title: string;
  statements: SpouseStatement[];
}

const SECTION_TITLES: Record<NatureReportSectionKey, string> = {
  coreNature: "핵심 성향",
  lifeDirection: "후천적 지향",
  socialImpression: "대인·외적 인상",
  lifeAttitude: "삶의 태도·강점과 약점",
  finalProfile: "최종 성향 프로필",
};

function synthesizeStatements(facts: InterpretationFact[]): SpouseStatement[] {
  if (facts.length === 0) return [];
  const text = synthesizeText(facts);
  const evidence = facts.flatMap((f) => f.evidence);
  const borrowed = facts.some((f) => f.borrowed);
  const confidence: Confidence = borrowed ? "low" : evidence.length >= 3 ? "high" : "medium";
  return [{ text, evidence, confidence, facts }];
}

function buildFinalProfile(evidence: NatureEvidenceBundle, facts: InterpretationFact[]): NatureReportSection {
  const majorEvidence: EvidenceItem[] = evidence.sanfangSizhengPalaces.flatMap((p) =>
    p.majorStars.map((s) => ({ type: "star" as const, value: `${s.name}@${p.palace}` })));
  const minorEvidence: EvidenceItem[] = evidence.sanfangSizhengPalaces.flatMap((p) =>
    p.minorStars.map((s) => ({ type: "star" as const, value: `${s.name}@${p.palace}` })));
  const shenGongEvidence: EvidenceItem[] = evidence.shenGongPalace.majorStars.map((s) => ({
    type: "star" as const, value: `${s.name}@${evidence.shenGongPalace.palace}(身宮)`,
  }));
  const sihuaEvidence: EvidenceItem[] = evidence.sihuaInScope.map((s) => ({
    type: "transformation" as const, value: `${s.kind}(${s.star})@${s.palace}`,
  }));

  return {
    key: "finalProfile",
    title: SECTION_TITLES.finalProfile,
    statements: [{
      text: synthesizeText(facts),
      evidence: [
        { type: "palace", value: evidence.naturePalace.palace },
        ...majorEvidence, ...minorEvidence, ...shenGongEvidence, ...sihuaEvidence,
      ],
      confidence: "high",
      facts,
    }],
  };
}

export interface NatureReport {
  personName: string;
  natureEvidence: NatureEvidenceBundle;
  sections: NatureReportSection[];
}

export function buildNatureReport(chart: ZiweiChart, personName: string): NatureReport {
  const evidence = extractNatureEvidence(chart);
  const core = coreNatureFacts(evidence), direction = lifeDirectionFacts(evidence), social = socialImpressionFacts(evidence), attitude = lifeAttitudeFacts(evidence);
  const sections: NatureReportSection[] = [
    { key: "coreNature", title: SECTION_TITLES.coreNature, statements: synthesizeStatements(core) },
    { key: "lifeDirection", title: SECTION_TITLES.lifeDirection, statements: synthesizeStatements(direction) },
    { key: "socialImpression", title: SECTION_TITLES.socialImpression, statements: synthesizeStatements(social) },
    { key: "lifeAttitude", title: SECTION_TITLES.lifeAttitude, statements: synthesizeStatements(attitude) },
    buildFinalProfile(evidence, [...core, ...direction, ...social, ...attitude]),
  ];
  return { personName, natureEvidence: evidence, sections };
}
