// 사주 궁합 핵심 요약(11단계) — 이미 계산된 calculateCompatibilityScore()/getCompatibilityReport()
// 결과만 재구성한다. 새 궁합 계산·새 점수·새 판정 로직은 만들지 않는다(대표 지시). 정적 궁합
// 엔진(compatibilityScore.ts/compatibilityReport.ts/branchRelations.ts)만 쓰고, 시기운
// 엔진(dynamicCompatibility.ts/relationshipInteractionActivation.ts)은 이번 단계에서 쓰지
// 않는다 — 현재 관계 흐름/시기 성격은 별도 확장으로 남긴다(대표 지시).
//
// [반드시 지킬 구분 — 대표 지시]
//  1) humanCompatibility(호감, relType 무관) / romanceCompatibility(연애 적합) /
//     marriageCompatibility(결혼 적합)는 서로 다른 축이다 — "한눈에 보는 관계"에서 절대
//     평균·합산하지 않고 각각 독립된 문장으로만 다룬다.
//  2) "끌림·호감"은 humanCompatibility(사람 대 사람 일반 호감, relType 무관)를 억지로 끌어다
//     쓰지 않는다 — humanCompatibility는 친구·동료 사이에도 똑같이 성립하는 축이라 "끌림"의
//     근거로 쓰면 의미가 왜곡된다. 대신 spouseStructureAxisComparison의 image축(매력 궁합 —
//     도화·홍염·오행 등으로 계산되는, 실제로 attraction 의미가 명확한 축)만 쓴다. 이 축이
//     없거나(비로맨틱 relType) 근거가 없으면 섹션을 생략한다.
//  3) "감정·소통"은 spouseStructureAxisComparison의 emotional축(정서 궁합 — 배우자궁 안정·
//     인성/식상 보조로 계산되는, "감정 소통·관계 안정 가능성"을 실제로 설명하는 축)과
//     satisfactionLine(정서적 만족감)만 쓴다. 이 둘 다 배우자궁 기반이라 로맨틱 relType에서만
//     의미가 있다 — 비로맨틱이면 섹션을 생략한다.
//  4) "장기연애·결혼"은 이번 단계에서 marriageCompatibility + (있을 때만) 실제 존재하는
//     getMarriageStructuralView 결과까지만 쓴다. spouseActivationTiming(연도별 활성 시기)은
//     정적 궁합과 시기운을 섞으므로 이번 핵심 요약에서는 제외한다(대표 지시) — 필요하면
//     기존 "결혼운 시기 힌트 비교" 아코디언(이미 있음, 삭제하지 않음)에서 계속 볼 수 있다.
//  5) "갈등 패턴"/"관계 운영 포인트"는 getConflictPoints/getHarmonyPoints/getRelationshipTips
//     (필러 문장으로 3개를 채우는 템플릿 함수)를 쓰지 않는다 — 대신 details[]/adjustmentSteps[]
//     (8개 조정 항목, 실제 근거 있는 원자료)에서 직접 뽑는다. 충/합 개수를 그대로 나열하지
//     않고, DETAIL_PATTERN_LABEL로 "실제 관계에서 어떤 패턴으로 나타나는지"만 옮긴다(원문은
//     evidence에 그대로 보존). 근거가 없으면(해당 방향의 항목이 0개) 섹션을 생략한다 —
//     generic filler로 채우지 않는다.
//  6) activationScore/activationLevel 류의 "크기" 개념은 이 엔진에는 없다(궁합은 애초에
//     0~100 적합도 점수 체계) — 다만 tone(5단계: 이상적/좋은/노력형/긴장형/주의)은 이미
//     명시적 방향을 담은 값이므로 그대로 polarity에 매핑한다(TONE_POLARITY, 새 판단 아님).
import type { CompatibilityResult, CompatibilityTone } from "./compatibilityScore";
import type { AnyCompatibilityReport } from "./reports";
import { getPurposeCompatibilityInterpretation, type CompatibilityInterpretationModel } from "./compatibilityInterpretation";
import { getCompatibilityCardPolicy, type CompatibilityCardPolicy } from "./compatibilityDisplayPolicy";
import { type ReportFact, type Polarity } from "./reportFacts";
import { type SajuEvidenceItem } from "./sajuSummaryFacts";

export type SajuCompatFact = ReportFact<SajuEvidenceItem>;

export type SajuCompatibilitySectionKey =
  | "atAGlance" | "attraction" | "emotionCommunication" | "conflictPattern" | "longTermMarriage" | "relationshipTips";

export interface SajuCompatibilitySummarySection {
  key: SajuCompatibilitySectionKey;
  title: string;
  /** deterministic 합성 문단 — 화면에 그대로 노출된다. */
  text: string;
  /** hasFacts 판정과 [왜 이런 결과인가요?] 토글 근거로 쓰이는 fact 목록. */
  facts: SajuCompatFact[];
  /** [왜 이런 결과인가요?] 토글용 근거. */
  evidence: SajuEvidenceItem[];
}

const TONE_POLARITY: Record<CompatibilityTone, Polarity> = {
  "이상적 궁합": "positive",
  "좋은 궁합": "positive",
  "노력형 궁합": "neutral",
  "긴장형 궁합": "risk",
  "주의 궁합": "risk",
};

function fact(domain: string, meaning: string, polarity: Polarity, evidence: SajuEvidenceItem[]): SajuCompatFact {
  return { id: `${domain}-${evidence.map((e) => e.label).join("|") || meaning}`, domain, meaning, polarity, strength: 1, evidence };
}

function normalizeSentence(text: string): string {
  const trimmed = text.trim();
  return /[.!?]$/.test(trimmed) ? trimmed : `${trimmed}.`;
}

function synthesizeSection(facts: SajuCompatFact[]): { text: string; evidence: SajuEvidenceItem[] } {
  return {
    text: facts.map((f) => normalizeSentence(f.meaning)).join(" "),
    evidence: facts.flatMap((f) => f.evidence),
  };
}

const MODEL_LABEL: Record<CompatibilityInterpretationModel, string> = {
  human: "사람 대 사람 호감",
  romance: "연애 적합도",
  marriage: "결혼 적합도",
};

function scoreFact(model: CompatibilityInterpretationModel, breakdown: { final: number; tone: CompatibilityTone }): SajuCompatFact {
  const label = MODEL_LABEL[model];
  const interp = getPurposeCompatibilityInterpretation(model, breakdown.final);
  return fact(
    `score-${model}`,
    `${label}은 ${breakdown.tone}(상위 ${interp.topPercentDisplay})입니다 — ${interp.contextLine}`,
    TONE_POLARITY[breakdown.tone],
    [{ category: "compatScore", label: `${label} ${breakdown.final}점 · ${breakdown.tone} · 상위 ${interp.topPercentDisplay}` }],
  );
}

/** "한눈에 보는 관계" — human/romance/marriage 3개를 절대 평균·합산하지 않고 각각 독립된
 * fact로만 둔다(대표 지시 #1). 비로맨틱 relType이면 human만 남는다. */
function buildAtAGlanceFacts(result: CompatibilityResult, policy: CompatibilityCardPolicy): SajuCompatFact[] {
  const facts: SajuCompatFact[] = [];
  if (policy.showHuman) facts.push(scoreFact("human", result.humanCompatibility));
  if (policy.showRomance) facts.push(scoreFact("romance", result.romanceCompatibility));
  if (policy.showMarriage) facts.push(scoreFact("marriage", result.marriageCompatibility));
  return facts;
}

/** "끌림·호감" — image축(매력 궁합)만 쓴다(대표 지시 #2). 비로맨틱이거나 축이 없으면 생략. */
function buildAttractionFacts(result: CompatibilityResult, policy: CompatibilityCardPolicy): SajuCompatFact[] {
  if (!policy.showRomance) return [];
  const axis = result.spouseStructureAxisComparison;
  if (!axis) return [];
  return [
    fact("attraction-image", axis.crossSentences.image, "neutral", [
      { category: "compatAxis", label: `매력 궁합(image) — 두 사람 각각 ${axis.person1.image}점 / ${axis.person2.image}점` },
    ]),
  ];
}

/** "감정·소통" — emotional축(정서 궁합)과 satisfactionLine(정서적 만족)만 쓴다(대표 지시 #3).
 * 비로맨틱이거나 축이 없으면 생략. */
function buildEmotionCommunicationFacts(result: CompatibilityResult, policy: CompatibilityCardPolicy): SajuCompatFact[] {
  if (!policy.showRomance) return [];
  const axis = result.spouseStructureAxisComparison;
  if (!axis) return [];
  return [
    fact("emotion-cross", axis.crossSentences.emotional, "neutral", [
      { category: "compatAxis", label: `정서 궁합(emotional) — 두 사람 각각 ${axis.person1.emotional}점 / ${axis.person2.emotional}점` },
    ]),
    fact("emotion-satisfaction", axis.satisfactionLine, "neutral", [
      { category: "compatAxis", label: "정서 만족 라인(satisfactionLine)" },
    ]),
  ];
}

/** 8개 정적 조정 항목(details[]/adjustmentSteps[])을 1:1로 짝지어, 갈등 패턴/관계 운영
 * 포인트 두 섹션이 공통으로 참조하는 원자료로 쓴다. 같은 baseScore 산식 안의 항목들이라
 * delta 크기 비교가 유효하다(10단계처럼 서로 다른 척도의 모듈을 비교하는 문제 없음). */
function coreDetailEntries(result: CompatibilityResult): { title: string; description: string; isPositive: boolean; delta: number }[] {
  return result.details.slice(0, 8).map((d, i) => ({ ...d, delta: result.adjustmentSteps[i]?.delta ?? 0 }));
}

/** details[].title(예: "일간 분석")을 실제 관계 패턴 언어로 옮긴다 — 원문(delta·note)은
 * evidence에 그대로 보존하고, 여기서는 방향(이미 엔진이 정한 isPositive)만 그대로 쓴다. */
const DETAIL_PATTERN_LABEL: Record<string, { positive: string; negative: string }> = {
  "일간 분석": {
    positive: "서로 기질이 잘 맞아 대화·의사결정이 자연스럽게 흘러가는 편입니다.",
    negative: "서로 기질 차이로 주도권이나 결정 방식에서 부딪히기 쉬운 편입니다.",
  },
  "배우자궁": {
    positive: "정서적 친밀감과 안정감을 쌓기 좋은 구조입니다.",
    negative: "정서적 거리감이나 긴장이 생기기 쉬운 구조입니다.",
  },
  "월지 교차": {
    positive: "생활 리듬·가치관이 잘 맞는 편입니다.",
    negative: "생활 리듬·가치관 차이를 조율해야 하는 편입니다.",
  },
  "지지 교차": {
    positive: "일상에서 서로 결속을 다지는 상황이 자주 생기는 편입니다.",
    negative: "일상에서 마찰·엇갈림이 반복되기 쉬운 편입니다.",
  },
  "천간 교차": {
    positive: "대화·소통 방식이 잘 맞물리는 편입니다.",
    negative: "대화·소통 방식에서 엇박자가 나기 쉬운 편입니다.",
  },
  "오행 보완": {
    positive: "서로 부족한 부분을 자연스럽게 채워주는 편입니다.",
    negative: "서로 비슷한 약점이 겹쳐 보완이 잘 안 되는 편입니다.",
  },
  "십성 관계": {
    positive: "역할 분담이 자연스럽게 맞아떨어지는 편입니다.",
    negative: "역할·주도권 분배에서 신경전이 생기기 쉬운 편입니다.",
  },
  "용신 보완": {
    positive: "실질적으로 서로에게 도움이 되는 기운을 주고받는 편입니다.",
    negative: "서로에게 필요한 기운을 채워주지 못하는 편입니다.",
  },
};

const MAX_DETAIL_FACTS = 4;

/** "갈등 패턴" — details[] 중 isPositive===false만, 실제 패턴 언어로. 없으면 섹션 생략. */
function buildConflictFacts(result: CompatibilityResult): SajuCompatFact[] {
  const negatives = coreDetailEntries(result)
    .filter((d) => !d.isPositive)
    .sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta))
    .slice(0, MAX_DETAIL_FACTS);
  return negatives.map((d) => fact(
    `conflict-${d.title}`,
    DETAIL_PATTERN_LABEL[d.title]?.negative ?? `${d.title} 쪽에서 마찰이 생기기 쉬운 편입니다.`,
    "risk",
    [{ category: "compatDetail", label: `${d.title}: ${d.description}` }],
  ));
}

/** "관계 운영 포인트" — details[] 중 isPositive===true만, 실제 활용 언어로. 없으면 섹션 생략.
 * dynamicCompatibility(시기운) 없이 정적 positive evidence만 쓴다(대표 지시). */
function buildRelationshipTipsFacts(result: CompatibilityResult): SajuCompatFact[] {
  const positives = coreDetailEntries(result)
    .filter((d) => d.isPositive)
    .sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta))
    .slice(0, MAX_DETAIL_FACTS);
  return positives.map((d) => fact(
    `tip-${d.title}`,
    DETAIL_PATTERN_LABEL[d.title]?.positive ?? `${d.title} 쪽은 의식적으로 활용하면 좋은 지점입니다.`,
    "positive",
    [{ category: "compatDetail", label: `${d.title}: ${d.description}` }],
  ));
}

/** "장기연애·결혼" — marriageCompatibility + (있을 때만) getMarriageStructuralView 결과까지만
 * 쓴다(대표 지시 #4, spouseActivationTiming 제외). marriageView가 있으면 그 구조적 설명을
 * 메인으로 쓰고(더 구체적), 없으면 점수 fact 하나만으로 짧게 유지한다 — 억지 filler 없음. */
function buildLongTermMarriageFacts(report: AnyCompatibilityReport, policy: CompatibilityCardPolicy): SajuCompatFact[] {
  if (!policy.showMarriage) return [];
  const result = report.scoreResult;
  const marriageView = "marriageView" in report ? report.marriageView : null;

  if (marriageView) {
    return [fact(
      "marriage-structural-view",
      marriageView.desc,
      TONE_POLARITY[result.marriageCompatibility.tone],
      [
        { category: "compatMarriage", label: `결혼 관점: ${marriageView.type}` },
        { category: "compatScore", label: `결혼 적합도 ${result.marriageCompatibility.final}점 · ${result.marriageCompatibility.tone}` },
      ],
    )];
  }
  return [scoreFact("marriage", result.marriageCompatibility)];
}

export function buildSajuCompatibilitySections(report: AnyCompatibilityReport): SajuCompatibilitySummarySection[] {
  const result = report.scoreResult;
  const policy = getCompatibilityCardPolicy(report.relType);

  const sections: [SajuCompatibilitySectionKey, string, SajuCompatFact[]][] = [
    ["atAGlance", "한눈에 보는 관계", buildAtAGlanceFacts(result, policy)],
    ["attraction", "끌림·호감", buildAttractionFacts(result, policy)],
    ["emotionCommunication", "감정·소통", buildEmotionCommunicationFacts(result, policy)],
    ["conflictPattern", "갈등 패턴", buildConflictFacts(result)],
    ["longTermMarriage", "장기연애·결혼", buildLongTermMarriageFacts(report, policy)],
    ["relationshipTips", "관계 운영 포인트", buildRelationshipTipsFacts(result)],
  ];

  return sections.map(([key, title, facts]) => {
    const { text, evidence } = synthesizeSection(facts);
    return { key, title, text, facts, evidence };
  });
}
