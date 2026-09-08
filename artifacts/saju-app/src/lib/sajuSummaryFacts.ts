// 사주 개인 원국 핵심 요약 — 이미 계산된 computeSajuPipeline() 결과와 SajuReport.tsx가 이미
// 계산해 둔 신살·합충형파해 리스트를 그대로 재사용해 6개 섹션으로 재구성한다. 새 계산 로직·새
// 채점 기준은 만들지 않는다(대표 지시). 자미두수 리포트와는 공용 타입(ReportFact/Polarity,
// src/lib/reportFacts.ts)만 같이 쓰고, 계산 엔진끼리는 서로 의존하지 않는다. 문장 합성은
// 별도 구현이다 — 아래 synthesizeSajuSection 주석 참고.
//
// fact 생성 우선순위는 항상 고정한다: 일간 강약 → 격국 → 용신·희신 → 오행 → 십성 →
// 합충형파해원진 → 신살(보조).
//
// polarity 원칙(대표 지시 — 엔진이 명시적으로 방향을 준 경우만 positive/risk, 나머지는 neutral):
//   - 격국.tone("길"/"흉"/"중")은 gukguk.ts가 이미 명시한 값 → 길=positive, 흉=risk, 중=neutral.
//   - 용신·희신(adjusted.effectiveYongshin/-Secondary)은 "이 사람에게 필요한/도움이 되는
//     오행"이라는 정의 자체가 방향을 담고 있으므로 positive로 쓴다(새 판단이 아니라 개념 정의).
//   - 강약 설명, 오행/십성 분포, 합충형파해원진, ruleInsights(신강약/십성/조후/궁합 카테고리),
//     신살은 이 자체로 길흉을 명시하는 필드가 없으므로 전부 neutral로 보존한다 — 애매한 구조를
//     positive/risk로 밀어넣지 않는다. "강점"/"주의할 점" 섹션에 배치되더라도 polarity 자체는
//     바꾸지 않는다(섹션 배치는 주제 관련성일 뿐, 새로운 길흉 판단이 아니다).
//
// 신살은 절대 메인 결론(핵심 성향의 방향성)을 뒤집지 않는다 — 항상 neutral이고, 방향성 계산
// (synthesizeSajuSection의 favorable/risk 판정)에는 아예 들어가지 않으며, "핵심 성향" 섹션
// 맨 뒤에 "참고로 ~"로만 붙는다.
import type { SajuPipelineResult } from "./sajuPipeline";
import type { RuleResult } from "./interpretationRules";
import type { BranchRelation } from "./branchRelations";
import type { ShinsalInterpretationEntry } from "./shinsalInterpretation";
import { type ReportFact, type Polarity } from "./reportFacts";

export interface SajuEvidenceItem {
  category: "strength" | "gukguk" | "yongshin" | "fiveElement" | "tenGod" | "interaction" | "shinsal" | "ruleInsight";
  label: string;
}

export type SajuFact = ReportFact<SajuEvidenceItem>;

export type SajuSectionKey = "atAGlance" | "coreNature" | "strengths" | "cautions" | "workWealth" | "romanceRelationship";

export interface SajuSummarySection {
  key: SajuSectionKey;
  title: string;
  /** deterministic 합성 문단 — AI 다듬기 실패/미로그인 시 그대로 노출되는 fallback. */
  text: string;
  /** prose layer에 보낼 fact 목록 — 섹션당 딱 1회만 polishStatementText를 호출한다. */
  facts: SajuFact[];
  /** [왜 이런 결과인가요?] 토글에 쓰는 근거(강약/격국/용신/오행/십성/합충형파해원진/신살 원자료). */
  evidence: SajuEvidenceItem[];
}

const GUKGUK_TONE_POLARITY: Record<"길" | "흉" | "중", Polarity> = { 길: "positive", 흉: "risk", 중: "neutral" };

function ev(category: SajuEvidenceItem["category"], label: string): SajuEvidenceItem {
  return { category, label };
}

function fact(domain: string, meaning: string, polarity: Polarity, evidence: SajuEvidenceItem[]): SajuFact {
  return { id: `${domain}-${evidence.map((e) => e.label).join("|") || meaning}`, domain, meaning, polarity, strength: 1, evidence };
}

/** 자미두수 synthesizeText는 "명사구 조각을 쉼표로 이어붙인 뒤 서술어 하나로 마무리"하는
 * 문체를 전제한다 — 여기서 다루는 fact.meaning은 (엔진이 이미 낸 description/ruleInsights/
 * oneLine이든, 이 파일이 직접 쓴 문장이든) 전부 "습니다/니다"로 끝나는 완결된 문장이라 그
 * 계약과 안 맞는다(억지로 붙이면 "핵심입니다.이 있는 구조입니다." 같은 비문이 된다). 그래서
 * saju는 공용 유틸을 그대로 가져다 쓰지 않고, 같은 전략(우호적/위험 진영 중 우세한 쪽을
 * 주절로, 소수 진영은 "다만" 양보절로)을 완결문 문체에 맞게 자체 구현한다 — 새 계산이 아니라
 * 순수 문장 이어붙이기 방식의 차이일 뿐이다. */
function normalizeSentence(text: string): string {
  const trimmed = text.trim();
  return /[.!?]$/.test(trimmed) ? trimmed : `${trimmed}.`;
}

function joinSentences(facts: SajuFact[]): string {
  return facts.map((f) => normalizeSentence(f.meaning)).join(" ");
}

/** neutral fact는 방향성 계산에 넣지 않고 먼저 평이하게 서술한 뒤, 나머지(positive/risk)만
 * 우세한 쪽을 주절로 소수 진영을 "다만" 양보절로 통합한다. shinsalFacts는 항상 neutral이며
 * 항상 맨 뒤에 "참고로"로만 붙어서 방향성 계산에 아예 참여하지 않는다(신살이 결론을 뒤집을 수
 * 없다는 것을 구조적으로 보장). */
function synthesizeSajuSection(facts: SajuFact[], shinsalFacts: SajuFact[] = []): { text: string; facts: SajuFact[] } {
  const neutral = facts.filter((f) => f.polarity === "neutral");
  const favorable = facts.filter((f) => f.polarity === "positive" || f.polarity === "mixed");
  const risk = facts.filter((f) => f.polarity === "risk");

  const neutralText = neutral.length > 0 ? joinSentences(neutral) : "";

  let directionalText = "";
  if (favorable.length > 0 && risk.length > 0) {
    directionalText = favorable.length >= risk.length
      ? `${joinSentences(favorable)} 다만 ${joinSentences(risk)}`
      : `${joinSentences(risk)} 그럼에도 ${joinSentences(favorable)}`;
  } else if (favorable.length > 0 || risk.length > 0) {
    directionalText = joinSentences([...favorable, ...risk]);
  }

  const shinsalText = shinsalFacts.length > 0 ? ` 참고로 ${joinSentences(shinsalFacts)}` : "";

  const text = ([neutralText, directionalText].filter(Boolean).join(" ") + shinsalText).trim();
  return { text, facts: [...facts, ...shinsalFacts] };
}

function ruleInsightFacts(pipeline: SajuPipelineResult, categories: RuleResult["category"][]): SajuFact[] {
  return pipeline.interpretation.rulesApplied
    .filter((r) => r.fired && categories.includes(r.category))
    .map((r) => fact(`rule-${r.ruleId}`, r.interpretation, "neutral", [ev("ruleInsight", `${r.ruleName}(${r.category})`)]));
}

function buildAtAGlanceFacts(pipeline: SajuPipelineResult): SajuFact[] {
  const facts: SajuFact[] = [];
  const sr = pipeline.base.strengthResult;
  if (sr.description) {
    facts.push(fact("strength", sr.description, "neutral", [ev("strength", `강약: ${sr.level}(점수 ${sr.score})`)]));
  }
  const gukguk = pipeline.interpretation.gukguk;
  if (gukguk) {
    facts.push(fact(
      "gukguk",
      `${gukguk.name} 구조를 갖고 있습니다`,
      GUKGUK_TONE_POLARITY[gukguk.tone],
      [ev("gukguk", `격국: ${gukguk.name}(${gukguk.tone})`)],
    ));
  }
  const yongshin = pipeline.adjusted.effectiveYongshin;
  facts.push(fact(
    "yongshin",
    `${yongshin} 기운을 보완하면 도움이 되는 구조입니다`,
    "positive",
    [ev("yongshin", `용신: ${yongshin}`)],
  ));
  return facts;
}

function buildStrengthFacts(pipeline: SajuPipelineResult): SajuFact[] {
  const facts: SajuFact[] = [];
  const gukguk = pipeline.interpretation.gukguk;
  if (gukguk && gukguk.tone === "길") {
    facts.push(fact("gukguk-strength", `${gukguk.name} 구조가 유리하게 작용하는 지점이 있습니다`, "positive", [ev("gukguk", `격국: ${gukguk.name}(길)`)]));
  }
  const yongshin = pipeline.adjusted.effectiveYongshin;
  facts.push(fact("yongshin-strength", `${yongshin} 기운을 키우는 방향이 강점으로 작용합니다`, "positive", [ev("yongshin", `용신: ${yongshin}`)]));
  const secondary = pipeline.adjusted.effectiveYongshinSecondary;
  if (secondary) {
    facts.push(fact("huishin-strength", `${secondary} 기운도 함께 도움이 되는 구조입니다`, "positive", [ev("yongshin", `희신: ${secondary}`)]));
  }
  // 주의: category="용신"인 ruleInsight는 "용신 관련 규칙"일 뿐 항상 긍정적인 내용은 아니다
  // (예: "관성이 부족해 보완이 필요합니다" 같은 gap도 같은 카테고리로 나온다) — 여기 넣으면
  // "강점" 섹션에 부족·gap 문장이 섞여 주제와 어긋난다. 그래서 격국.tone/용신·희신처럼 방향이
  // 명확한 fact만 쓰고, category 기반 ruleInsight는 강점/주의할 점에 넣지 않는다.
  return facts;
}

function buildCautionFacts(pipeline: SajuPipelineResult, branchRelations: BranchRelation[]): SajuFact[] {
  const facts: SajuFact[] = [];
  const gukguk = pipeline.interpretation.gukguk;
  if (gukguk && gukguk.tone === "흉") {
    facts.push(fact("gukguk-caution", `${gukguk.name} 구조상 주의가 필요한 지점이 있습니다`, "risk", [ev("gukguk", `격국: ${gukguk.name}(흉)`)]));
  }
  if (branchRelations.length > 0) {
    const types = [...new Set(branchRelations.map((r) => r.type))].join("·");
    facts.push(fact(
      "interaction",
      `사주 안에 ${types} 관계가 있어 자세히 살펴볼 지점이 있습니다`,
      "neutral",
      branchRelations.map((r) => ev("interaction", `${r.type}: ${r.description}`)),
    ));
  }
  return facts;
}

function buildWorkWealthFacts(pipeline: SajuPipelineResult): SajuFact[] {
  const groups = pipeline.base.tenGodGroups;
  const wealthCount = (groups["재성"] ?? 0) + (groups["식상"] ?? 0);
  return [fact(
    "tenGod-wealth",
    `십성 분포상 재성·식상 비중이 ${wealthCount}개로 나타나는 구조입니다`,
    "neutral",
    [ev("tenGod", `재성 ${groups["재성"] ?? 0} · 식상 ${groups["식상"] ?? 0}`)],
  )];
}

function buildRomanceRelationshipFacts(pipeline: SajuPipelineResult): SajuFact[] {
  const groups = pipeline.base.tenGodGroups;
  const relCount = (groups["관성"] ?? 0) + (groups["비겁"] ?? 0);
  const facts: SajuFact[] = [fact(
    "tenGod-relationship",
    `십성 분포상 관성·비겁 비중이 ${relCount}개로 나타나는 구조입니다`,
    "neutral",
    [ev("tenGod", `관성 ${groups["관성"] ?? 0} · 비겁 ${groups["비겁"] ?? 0}`)],
  )];
  // 주의: category="십성" ruleInsight는 재물·학습·실행력 등 여러 주제에 걸쳐 나오므로(십성
  // 카테고리 하나로 재물/연애를 구분할 수 없다) 여기 넣지 않는다 — "일·재물"에도 마찬가지
  // 이유로 넣지 않았다. category="궁합"은 단일 원국 규칙 엔진(applyInterpretationRules)에는
  // 아직 규칙이 없어 항상 비어 있지만, 향후 궁합 규칙이 추가되면 자동으로 반영되도록 필터는
  // 남겨둔다.
  facts.push(...ruleInsightFacts(pipeline, ["궁합"]));
  return facts;
}

export function buildSajuSummarySections(
  pipeline: SajuPipelineResult,
  branchRelations: BranchRelation[],
  shinsalEntries: ShinsalInterpretationEntry[],
): SajuSummarySection[] {
  const shinsalFacts: SajuFact[] = shinsalEntries.map((s) =>
    fact(`shinsal-${s.id}`, s.oneLine, "neutral", [ev("shinsal", s.name)]),
  );

  const atAGlance = synthesizeSajuSection(buildAtAGlanceFacts(pipeline));
  const coreNature = synthesizeSajuSection(ruleInsightFacts(pipeline, ["신강약", "격국", "조후"]), shinsalFacts);
  const strengths = synthesizeSajuSection(buildStrengthFacts(pipeline));
  const cautions = synthesizeSajuSection(buildCautionFacts(pipeline, branchRelations));
  const workWealth = synthesizeSajuSection(buildWorkWealthFacts(pipeline));
  const romanceRelationship = synthesizeSajuSection(buildRomanceRelationshipFacts(pipeline));

  const sections: [SajuSectionKey, string, { text: string; facts: SajuFact[] }][] = [
    ["atAGlance", "한눈에 보는 나", atAGlance],
    ["coreNature", "핵심 성향", coreNature],
    ["strengths", "강점", strengths],
    ["cautions", "주의할 점", cautions],
    ["workWealth", "일·재물", workWealth],
    ["romanceRelationship", "연애·관계", romanceRelationship],
  ];

  return sections.map(([key, title, { text, facts }]) => ({
    key, title, text, facts, evidence: facts.flatMap((f) => f.evidence),
  }));
}
