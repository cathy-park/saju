// 배우자(夫妻宮) 주제 리포트 — 계산 엔진(engine)이 만든 canonical payload + evidence를
// interpretationFacts.ts의 semantic fact 레이어를 거쳐 사람이 읽는 문장으로 합성한다.
// (재설계, 2026-09-08 대표 지시) 카테고리별 canned text를 그대로 나열하던 이전 방식을 폐기하고,
// 도메인마다 evidence 소스를 다르게 두어(성격=본궁+사화+삼방, 외모=본궁+對宮, 직업=본궁+官祿축+
// 삼방, 경제=재물구조, 만남=삼방·官祿축, 연애관계모습=사화·보조성 전용) 같은 문장이 여러 섹션에
// 재사용되지 않도록 domain ownership을 분리했다.
import type { EvidenceItem, ZiweiChart } from "../types";
import { extractSpouseEvidence, type SpouseEvidenceBundle } from "../spouseEvidence";
import { computeRelationshipTimingSignals, type RelationshipTimingSignal } from "../timingEngine";
import { zhongzhouV1 } from "../ruleSets/zhongzhouV1";
import {
  resolveGoverningMajors, synthesizeText,
  coreImageFacts, personalityFacts, appearanceFacts, careerFacts, wealthFacts,
  meetingFacts, relationshipFacts, compatibilityFacts,
  type InterpretationFact,
} from "./interpretationFacts";

export type Confidence = "high" | "medium" | "low";
export interface SpouseStatement {
  text: string;
  evidence: EvidenceItem[];
  confidence: Confidence;
  /** 이 문장 합성에 실제로 쓰인 fact 원본(근거 토글 UI가 fact 단위로도 보여줄 수 있도록). */
  facts: InterpretationFact[];
}

export type SpouseReportSectionKey =
  | "coreImage" | "personality" | "appearance" | "career" | "wealth" | "ageGap"
  | "meeting" | "relationship" | "compatibilityWell" | "compatibilityAvoid" | "matchProfile";

export interface SpouseReportSection {
  key: SpouseReportSectionKey;
  title: string;
  statements: SpouseStatement[];
}

const SECTION_TITLES: Record<SpouseReportSectionKey, string> = {
  coreImage: "핵심 배우자상",
  personality: "성격",
  appearance: "외모·첫인상·스타일",
  career: "직업·사회적 위치",
  wealth: "경제력·돈을 다루는 방식",
  ageGap: "나이차",
  meeting: "만남 환경",
  relationship: "연애 관계 모습",
  compatibilityWell: "잘 맞는 배우자",
  compatibilityAvoid: "피해야 할 배우자",
  matchProfile: "최종 배우자 프로필",
};

/** facts가 있으면 여러 별/사화/보조성을 하나의 결합 문단으로 합성해 1개 statement를 만든다
 * (facts가 비어 있으면 빈 배열 — "근거 부족" 처리는 report 조립부에서 한다). borrowed(對宮
 * 借星) facts가 섞여 있으면 confidence를 낮춘다. */
function synthesizeStatements(facts: InterpretationFact[]): SpouseStatement[] {
  if (facts.length === 0) return [];
  const text = synthesizeText(facts);
  const evidence = facts.flatMap((f) => f.evidence);
  const borrowed = facts.some((f) => f.meaning.includes("借星"));
  const confidence: Confidence = borrowed ? "low" : facts.length >= 3 ? "high" : "medium";
  return [{ text, evidence, confidence, facts }];
}

const AGE_GAP_FALLBACK: SpouseStatement = {
  text: "이 명반만으로 연령차를 특정하기 어렵습니다.",
  evidence: [],
  confidence: "low",
  facts: [],
};

function buildFinalProfile(evidence: SpouseEvidenceBundle): SpouseReportSection {
  const { stars, sourcePalace, borrowed } = resolveGoverningMajors(evidence);
  const starNames = stars.map((s) => s.name).join(", ") || "없음";
  const sanfangMajors = evidence.sanfangSizhengPalaces
    .flatMap((p) => p.majorStars.map((s) => `${s.name}@${p.palace}`))
    .join(", ") || "없음";
  const sanfangMinors = evidence.sanfangSizhengPalaces
    .flatMap((p) => p.minorStars.map((s) => `${s.name}@${p.palace}`))
    .join(", ") || "없음";
  const sihuaNames = evidence.sihuaInScope.map((s) => `${s.star}(${s.kind})`).join(", ") || "없음";

  const text =
    `배우자궁(${evidence.spousePalace.branch}) 기준 主星: ${starNames}` +
    `${borrowed ? ` (對宮 ${sourcePalace}에서 借星)` : ""}` +
    ` / 三方四正 主星: ${sanfangMajors} / 三方四正 보조성: ${sanfangMinors} / 관련 생년사화: ${sihuaNames}`;

  return {
    key: "matchProfile",
    title: SECTION_TITLES.matchProfile,
    statements: [{
      text,
      evidence: [
        { type: "palace", value: evidence.spousePalace.palace },
        ...stars.map((s) => ({ type: "star" as const, value: `${s.name}@${sourcePalace}` })),
      ],
      confidence: "high",
      facts: [],
    }],
  };
}

export interface SpouseTimingSection {
  title: string;
  signals: RelationshipTimingSignal[];
  /** activation·stability·formalization 3축 점수가 모두 양수인 해만 "참고해볼 만한 해"로 표시
   * (결혼 확정 예측 아님 — 대표 원칙 유지). */
  notableYears: number[];
}

/** buildZiweiChart(..., annualYears) 호출 시 넘겨야 하는 연도 범위 — 이 리포트의 결혼 활성
 * 시기 섹션이 다루는 범위와 반드시 같아야 한다(다르면 chart.annualPeriods에 해당 연도가 없어
 * timingEngine이 에러를 던진다). */
export function spouseReportTimingYears(): number[] {
  const currentYear = new Date().getFullYear();
  return Array.from({ length: 15 }, (_, i) => currentYear + i);
}

function buildTimingSection(chart: ZiweiChart): SpouseTimingSection {
  const years = spouseReportTimingYears();
  const signals = computeRelationshipTimingSignals(chart, zhongzhouV1, years);
  const notableYears = signals
    .filter((s) => s.activation.score > 0 && s.stability.score > 0 && s.formalization.score > 0)
    .map((s) => s.year);
  return { title: "결혼 활성 시기(연도별 신호)", signals, notableYears };
}

export interface SpouseReport {
  personName: string;
  spouseEvidence: SpouseEvidenceBundle;
  sections: SpouseReportSection[];
  timing: SpouseTimingSection;
}

export function buildSpouseReport(chart: ZiweiChart, personName: string): SpouseReport {
  const evidence = extractSpouseEvidence(chart);

  const compatFacts = compatibilityFacts(evidence);

  const sections: SpouseReportSection[] = [
    { key: "coreImage", title: SECTION_TITLES.coreImage, statements: synthesizeStatements(coreImageFacts(evidence)) },
    { key: "personality", title: SECTION_TITLES.personality, statements: synthesizeStatements(personalityFacts(evidence)) },
    { key: "appearance", title: SECTION_TITLES.appearance, statements: synthesizeStatements(appearanceFacts(evidence)) },
    { key: "career", title: SECTION_TITLES.career, statements: synthesizeStatements(careerFacts(evidence)) },
    { key: "wealth", title: SECTION_TITLES.wealth, statements: synthesizeStatements(wealthFacts(evidence)) },
    { key: "ageGap", title: SECTION_TITLES.ageGap, statements: [AGE_GAP_FALLBACK] },
    { key: "meeting", title: SECTION_TITLES.meeting, statements: synthesizeStatements(meetingFacts(evidence)) },
    { key: "relationship", title: SECTION_TITLES.relationship, statements: synthesizeStatements(relationshipFacts(evidence)) },
    { key: "compatibilityWell", title: SECTION_TITLES.compatibilityWell, statements: synthesizeStatements(compatFacts.filter((f) => f.polarity !== "risk")) },
    { key: "compatibilityAvoid", title: SECTION_TITLES.compatibilityAvoid, statements: synthesizeStatements(compatFacts.filter((f) => f.polarity === "risk")) },
    buildFinalProfile(evidence),
  ];

  return {
    personName,
    spouseEvidence: evidence,
    sections,
    timing: buildTimingSection(chart),
  };
}
