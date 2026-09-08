// 사주 개인 원국 핵심 요약 — 이미 계산된 computeSajuPipeline() 결과와 SajuReport.tsx가 이미
// 계산해 둔 신살·합충형파해 리스트를 그대로 재사용해 6개 섹션으로 재구성한다. 새 계산 로직·새
// 채점 기준은 만들지 않는다(대표 지시). 자미두수 리포트와는 공용 타입(ReportFact/Polarity,
// src/lib/reportFacts.ts)만 같이 쓰고, 계산 엔진끼리는 서로 의존하지 않는다. 문장 합성은
// 별도 구현이다 — 아래 synthesizeSajuSection 주석 참고.
//
// fact 생성 우선순위는 항상 고정한다: 일간 강약 → 격국 → 용신·희신 → 오행 → 십성 →
// 합충형파해원진 → 신살(보조).
//
// [메인 fact vs evidence 분리 — 대표 지시]
// 각 섹션은 "메인"(섹션당 2~4개, AI 다듬기/텍스트 합성에 쓰는 대표 해석)과 "evidence"(원자료
// 전부, [왜 이런 결과인가요?] 토글용)를 분리한다. 메인은 전역 우선순위 상위 N개를 자르는 게
// 아니라, 섹션 목적에 맞는 fact만 고른다(RULE_SECTION_MAP 참고). evidence는 그 섹션이 참조한
// 모든 원자료(강약 점수, 격국명, 용신 오행, 십성 카운트, 합충형파해원진 원문, 신살 원문)를
// 그대로 보존한다 — 메인에서 빠진 fact라도 evidence 자체는 잃지 않는다(대부분은 atAGlance
// 섹션이 강약/격국/용신 원자료를 이미 evidence로 들고 있어 리포트 전체 기준으로는 항상 접근
// 가능하다).
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
// 맨 뒤에 "참고로 ~"로만 붙는다. 신살은 그 어떤 섹션에서도 독립 결론을 만들지 않는다.
import type { SajuPipelineResult } from "./sajuPipeline";
import type { BranchRelation } from "./branchRelations";
import { RELATION_MEANING } from "./branchRelations";
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
  /** prose layer에 보낼 fact 목록(섹션당 2~4개, 섹션 목적에 맞게 선택) — 섹션당 딱 1회만
   * polishStatementText를 호출한다. */
  facts: SajuFact[];
  /** [왜 이런 결과인가요?] 토글에 쓰는 근거(강약/격국/용신/오행/십성/합충형파해원진/신살 원자료).
   * 메인 fact 선택과 무관하게, 이 섹션이 참조한 원자료는 전부 보존한다. */
  evidence: SajuEvidenceItem[];
}

const GUKGUK_TONE_POLARITY: Record<"길" | "흉" | "중", Polarity> = { 길: "positive", 흉: "risk", 중: "neutral" };

/** [원국 성향에 어긋나는 timing 표현 가드] "~시기/증가한다/전환점/기회가 생긴다" 같은 문장은
 * 운세(대운·세운·월운·일운)의 몫이고, 원국 성향(타고난 구조)에는 섞이지 않아야 한다(대표
 * 지시). 지금 붙는 11개 규칙 문장에는 해당 표현이 없지만, 향후 규칙이 늘어날 때를 대비한
 * 방어 필터다 — 이 필터가 걸러도 evidence의 원문 자체는 그대로 남는다(참조만 안 할 뿐). */
const TIMING_LANGUAGE_PATTERN = /시기|증가한다|전환점|기회가 생긴다/;
function isTimingSentence(text: string): boolean {
  return TIMING_LANGUAGE_PATTERN.test(text);
}

/** interpretationRules.ts가 이미 만들어 둔 11개 규칙 해석 문장을 어느 요약 섹션의 "현실 언어"로
 * 배치할지 정하는 매핑이다 — 규칙의 조건/판정 자체(어떤 조건에서 발동하는지)는 전혀 바꾸지
 * 않고, 이미 성립한 해석 문장의 배치만 정한다(새 명리 판단이 아니다). 규칙 하나는 정확히 한
 * 섹션에만 배치해 같은 내용이 여러 섹션에 중복되지 않게 한다(유사 fact 병합 원칙).
 *   R01 압박형 권위 구조   → 주의할 점 (관성 압박·스트레스 과잉 패턴)
 *   R02 계획형 재물 구조   → 일·재물 (재물 감각·계획/전략)
 *   R03 조후 화 필요       → 핵심 성향 (기질·필요 환경)
 *   R04 조후 수 필요       → 핵심 성향 (기질·필요 환경, R03의 반대 계절)
 *   R05 경쟁형 에너지 구조 → 핵심 성향 (자기주도성·판단 방식)
 *   R06 창의형 표현가 구조 → 강점 (실제 잘 쓰이는 능력)
 *   R07 스트레스 과부하    → 주의할 점 (과잉될 때 나타나는 패턴)
 *   R08 균형형 다재다능    → 핵심 성향 (판단·역할 방식)
 *   R09 극신강 독립·사업형 → 강점 (실제 잘 쓰이는 능력)
 *   R10 인성강 학습형      → 강점 (실제 잘 쓰이는 능력)
 *   R11 오행 결핍 보완     → 주의할 점 (공백·보완이 필요한 패턴)
 */
const RULE_SECTION_MAP: Record<string, SajuSectionKey> = {
  R01: "cautions",
  R02: "workWealth",
  R03: "coreNature",
  R04: "coreNature",
  R05: "coreNature",
  R06: "strengths",
  R07: "cautions",
  R08: "coreNature",
  R09: "strengths",
  R10: "strengths",
  R11: "cautions",
};

/** interpretationRules.ts가 이미 낸 문장 중 timing 표현이 없고, 이 섹션에 배치된 규칙(fired)만
 * 골라 SajuFact로 감싼다. ruleId는 "이미 성립한 규칙의 의미를 현실 언어로 옮기는" 용도로만
 * 쓰고, 여기서 새로 명리 판단을 내리지 않는다. */
function mappedRuleFacts(pipeline: SajuPipelineResult, section: SajuSectionKey): SajuFact[] {
  return pipeline.interpretation.rulesApplied
    .filter((r) => r.fired && RULE_SECTION_MAP[r.ruleId] === section && !isTimingSentence(r.interpretation))
    .map((r) => fact(`rule-${r.ruleId}`, r.interpretation, "neutral", [ev("ruleInsight", `${r.ruleName}(${r.category})`)]));
}

/** interpretationRules.ts R11이 이미 쓰는 십성 그룹→개념 매핑을 그대로 재사용한다(새 정의
 * 아님) — 재성·식상, 관성·비겁 같은 원자료(비중 숫자)를 "몇 개다"라고 나열하지 않고, 그
 * 숫자가 가리키는 이미 확립된 개념으로만 옮겨 표현한다(대표 지시: 원자료 나열 금지). */
const TEN_GOD_CONCEPT_LABEL: Record<string, string> = {
  비겁: "독립·의지", 식상: "표현·창의", 재성: "재물·현실", 관성: "명예·규범", 인성: "학습·보호",
};

function ev(category: SajuEvidenceItem["category"], label: string): SajuEvidenceItem {
  return { category, label };
}

function fact(domain: string, meaning: string, polarity: Polarity, evidence: SajuEvidenceItem[]): SajuFact {
  return { id: `${domain}-${evidence.map((e) => e.label).join("|") || meaning}`, domain, meaning, polarity, strength: 1, evidence };
}

/** 재성·식상(일·재물) 또는 관성·비겁(연애·관계) 두 십성 그룹의 비중 원자료를, 규칙이 하나도
 * 안 뜬 경우의 guaranteed fallback으로 문장화한다. 두 그룹 모두 이미 정의된 개념 라벨로만
 * 표현하고, 새로운 강약 판정을 추가하지 않는다(원자료는 evidence에 그대로 남긴다). */
function tenGodPairFact(
  domain: string,
  groupA: string,
  groupB: string,
  groups: Record<string, number>,
  sentence: (labelA: string, labelB: string) => string,
): SajuFact {
  const labelA = `${groupA}(${TEN_GOD_CONCEPT_LABEL[groupA]})`;
  const labelB = `${groupB}(${TEN_GOD_CONCEPT_LABEL[groupB]})`;
  return fact(domain, sentence(labelA, labelB), "neutral", [
    ev("tenGod", `${groupA} ${groups[groupA] ?? 0} · ${groupB} ${groups[groupB] ?? 0}`),
  ]);
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

/** "강점" 섹션 목표(대표 지시): 실제 잘 쓰이는 능력. R06/R09/R10(창의·독립사업·학습형)처럼
 * 이미 능력을 직접 서술하는 규칙이 하나라도 뜨면 그것을 그대로 쓰고, 하나도 안 뜨면(예:
 * 박소연처럼 강약이 중간대가 아니고 특정 십성이 두드러지지 않는 경우) 기존 구조적 강점(격국
 * 길·용신/희신)으로 fallback한다 — 두 출처를 동시에 합치지 않아 섹션이 2~4개를 넘지 않는다. */
function buildStrengthFacts(pipeline: SajuPipelineResult): SajuFact[] {
  const mapped = mappedRuleFacts(pipeline, "strengths");
  if (mapped.length > 0) return mapped;

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
  return facts;
}

/** "주의할 점" 섹션 목표(대표 지시): 과잉될 때 나타나는 현실 패턴. R01/R07/R11(압박형 권위·
 * 스트레스 과부하·오행 결핍)을 우선 쓰고, 합충형파해원진은 관계 타입 명칭만 나열하지 않고
 * RELATION_MEANING(이미 확립된 개념 사전, branchRelations.ts)으로 의미를 붙여서만 메인에
 * 쓴다. 매핑된 규칙도 없고 의미 있는 합충형파해원진도 없을 때만 격국(흉)으로 fallback한다. */
function buildCautionFacts(pipeline: SajuPipelineResult, branchRelations: BranchRelation[]): SajuFact[] {
  const facts = mappedRuleFacts(pipeline, "cautions");

  const meaningfulTypes = [...new Set(branchRelations.map((r) => r.type))].filter((t) => RELATION_MEANING[t]);
  if (meaningfulTypes.length > 0) {
    const clause = meaningfulTypes.map((t) => `${t}(${RELATION_MEANING[t]})`).join("·");
    facts.push(fact(
      "interaction",
      `${clause} 흐름이 있어, 관계·환경 변화에 따라 긴장이나 마찰이 커질 수 있는 지점입니다`,
      "neutral",
      branchRelations.map((r) => ev("interaction", `${r.type}: ${r.description}`)),
    ));
  }

  if (facts.length === 0) {
    const gukguk = pipeline.interpretation.gukguk;
    if (gukguk && gukguk.tone === "흉") {
      facts.push(fact("gukguk-caution", `${gukguk.name} 구조상 주의가 필요한 지점이 있습니다`, "risk", [ev("gukguk", `격국: ${gukguk.name}(흉)`)]));
    }
  }
  return facts;
}

/** "일·재물" 섹션 목표(대표 지시): 일하는 방식·성과·수익·관리. R02(계획형 재물 구조)가 뜨면
 * 그걸 그대로 쓰고, 안 뜨면 재성·식상 비중을 개념 라벨로만 옮긴 guaranteed fallback을 쓴다
 * (원자료 "비중이 N개" 나열 금지). */
function buildWorkWealthFacts(pipeline: SajuPipelineResult): SajuFact[] {
  const mapped = mappedRuleFacts(pipeline, "workWealth");
  if (mapped.length > 0) return mapped;

  const groups = pipeline.base.tenGodGroups;
  return [tenGodPairFact(
    "tenGod-wealth", "재성", "식상", groups,
    (a, b) => `${a}과 ${b} 기운이 함께 나타나, 현실적인 감각과 실행력을 함께 활용해 성과를 만들어가는 방식입니다.`,
  )];
}

/** "연애·관계" 섹션 목표(대표 지시): 끌림·표현·갈등·관계 운영. 지금은 이 주제를 직접 다루는
 * 규칙이 없어(향후 궁합 규칙 추가 대비 자리는 남겨둠) 관성·비겁 비중을 개념 라벨로만 옮긴
 * guaranteed fallback을 쓴다. */
function buildRomanceRelationshipFacts(pipeline: SajuPipelineResult): SajuFact[] {
  const mapped = mappedRuleFacts(pipeline, "romanceRelationship");
  if (mapped.length > 0) return mapped;

  const groups = pipeline.base.tenGodGroups;
  return [tenGodPairFact(
    "tenGod-relationship", "관성", "비겁", groups,
    (a, b) => `${a}과 ${b} 기운이 함께 나타나, 관계에서 책임·안정과 자율·독립을 함께 추구하는 편입니다.`,
  )];
}

export function buildSajuSummarySections(
  pipeline: SajuPipelineResult,
  branchRelations: BranchRelation[],
  shinsalEntries: ShinsalInterpretationEntry[],
): SajuSummarySection[] {
  const shinsalFacts: SajuFact[] = shinsalEntries.map((s) =>
    fact(`shinsal-${s.id}`, s.oneLine, "neutral", [ev("shinsal", s.name)]),
  );

  // 핵심 성향: R03/R04(조후)·R05(경쟁형)·R08(균형형)을 우선 쓰고, 하나도 안 뜨면(드문 경우)
  // atAGlance의 강약 설명을 최소 fallback으로 재사용해 섹션이 비지 않게 한다.
  const coreNatureMapped = mappedRuleFacts(pipeline, "coreNature");
  const coreNatureFacts = coreNatureMapped.length > 0 ? coreNatureMapped : buildAtAGlanceFacts(pipeline).filter((f) => f.domain === "strength");

  const atAGlance = synthesizeSajuSection(buildAtAGlanceFacts(pipeline));
  const coreNature = synthesizeSajuSection(coreNatureFacts, shinsalFacts);
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
