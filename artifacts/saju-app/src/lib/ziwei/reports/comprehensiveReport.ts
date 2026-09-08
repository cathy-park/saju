// 종합 리포트 — 이미 완료된 6개 주제(타고난 성향/재물/커리어/연애/배우자/결혼시기)의 fact
// 생성기와 evidence 추출을 그대로 재사용한다. 새 계산 로직·새 채점 기준은 만들지 않는다(대표
// 지시). 5개 축(핵심 성향/일·재물/연애·배우자/현재 삶의 중심축/앞으로의 주요 시기)으로
// 재구성하되, 단순 이어붙이기가 아니라 synthesis 규칙을 적용한다:
//   1) 중복 제거 — 완전히 같은 문장(meaning)이 여러 리포트에서 나오면 하나만 남긴다.
//   2~3) 같은 방향 병합 / 보완 연결 — synthesizeText()가 이미 하는 일을 그대로 재사용한다
//        (favorable/mixed는 한 문단으로, risk는 "다만/그럼에도" 양보절로 — 이게 곧
//        "A라는 강점이 있지만 동시에 B라는 리스크도 있다"는 기본 통합 방식이다).
//   4) 구조적 통합 — evidence 자체가 "외적 인상"(대표적으로 appearance/socialImpression 도메인)과
//      "내면 구조"(personality/coreImage/coreNature 등) 두 갈래로 실제 구분되고, 그 둘의
//      favorable/risk 우세 방향이 서로 다를 때만 "겉으로는 A, 내면에서는 B" 구조로 쓴다.
//      polarity가 갈린다고 무조건 이 틀을 쓰지 않는다(대표 지시) — 나머지는 2~3)의 기본
//      통합(다만/그럼에도)으로 처리한다.
//
// "핵심 성향"에는 배우자상(personality/coreImage/appearance 등 spouse 도메인)을 절대 섞지
// 않는다 — 그건 "내 성향"이 아니라 "배우자상"이라 의미가 오염된다(대표 지시). spouse의 모든
// 도메인(연애 포함)은 "연애·배우자" 섹션에만 들어간다.
//
// "현재 삶의 중심축"은 fact 개수·polarity 밀도로 새로 판정하지 않는다(새 scoring heuristic이
// 되기 때문 — 대표 지시). 대신 이미 계산된 身宮·현재 大限·결혼시기 리포트의 당해년도 하이라이트만
// 그대로 읽어서 설명한다. 身宮 외에는 근거가 애매하면 그냥 생략한다(억지로 확정하지 않음).
//
// AI 다듬기 호출 예산: 섹션당 정확히 1회, 총 5회. AI에는 여기서 만든 deterministic text/fact
// 묶음만 전달하고(기존 polish-prose.ts 프롬프트가 이미 "사실 목록 밖 해석 금지"를 강제한다),
// 이 파일이 서버 프롬프트를 바꾸지는 않는다.
//
// 품질 패치(2차, 대표 지시): 일·재물/연애·배우자는 같은 궁(財帛宮·事業宮 등)을 "나"(self)와
// "배우자상"(spouse)이 각각 다른 리포트에서 참조할 수 있어 주어가 섞여 보일 위험이 있다.
// 원본 계산·fact.meaning 문자열은 절대 바꾸지 않고, synthesizeScopedSections()의 lead-in
// wrapper("나는 재물 면에서는"/"배우자상에서는" 등)로만 scope를 구분한다. 또한 연애·배우자는
// fact가 37개까지 늘어나 AI synthesis 입력이 장황해지므로, pickTopPerDomain()으로 domain당
// strength 최상위 fact만 합성에 쓰고 나머지는 evidenceFacts로 그대로 근거 토글에 남긴다(새
// 판정 기준이 아니라 각 리포트가 이미 계산해 둔 strength 재사용).
import type { EvidenceItem, PalaceName, RuleSet, ZiweiChart } from "../types";
import { extractNatureEvidence } from "../natureEvidence";
import { extractWealthEvidence } from "../wealthEvidence";
import { extractCareerEvidence } from "../careerEvidence";
import { extractSpouseEvidence } from "../spouseEvidence";
import { coreNatureFacts, lifeDirectionFacts, socialImpressionFacts, lifeAttitudeFacts } from "./natureFacts";
import { coreWealthFacts, incomeStyleFacts, spendingTendencyFacts, wealthVolatilityFacts } from "./wealthFacts";
import { coreCareerFacts, workStyleFacts, collaborationEnvironmentFacts, achievementVolatilityFacts } from "./careerFacts";
import { attractionFacts, expressionFacts, conflictFacts, managementFacts } from "./romanceFacts";
import {
  coreImageFacts as spouseCoreImageFacts,
  personalityFacts as spousePersonalityFacts,
  appearanceFacts as spouseAppearanceFacts,
  careerFacts as spouseCareerFacts,
  wealthFacts as spouseWealthFacts,
  meetingFacts, relationshipFacts, compatibilityFacts,
  synthesizeText,
  type InterpretationFact,
} from "./interpretationFacts";
import { buildMarriageTimingReport, AXIS_LABEL, type MarriageTimingReport } from "./marriageTimingReport";
import { spouseReportTimingYears } from "./spouseReport";

export type ComprehensiveSectionKey = "coreNature" | "workWealth" | "romanceSpouse" | "currentFocus" | "upcomingTiming";

export interface ComprehensiveSection {
  key: ComprehensiveSectionKey;
  title: string;
  /** deterministic 합성 문단 — AI 다듬기 실패/미로그인 시 그대로 노출되는 fallback. */
  text: string;
  /** prose layer에 보낼 fact 목록 — 섹션당 딱 1회만 polishStatementText를 호출한다. */
  facts: InterpretationFact[];
  /** [왜 이런 결과인가요?] 토글에 쓰는 근거. */
  evidence: EvidenceItem[];
}

export interface ComprehensiveReport {
  personName: string;
  sections: ComprehensiveSection[];
}

function withSource(items: EvidenceItem[], source: NonNullable<EvidenceItem["source"]>): EvidenceItem[] {
  return items.map((e) => ({ ...e, source }));
}

function dedupeExactMeaning(facts: InterpretationFact[]): InterpretationFact[] {
  const seen = new Set<string>();
  return facts.filter((f) => {
    if (seen.has(f.meaning)) return false;
    seen.add(f.meaning);
    return true;
  });
}

function joinMeanings(facts: InterpretationFact[]): string {
  return facts.map((f) => f.meaning).join(", ");
}

function lean(facts: InterpretationFact[]): "favorable" | "risk" | "neutral" {
  if (facts.length === 0) return "neutral";
  const risk = facts.filter((f) => f.polarity === "risk").length;
  const favorable = facts.length - risk;
  if (favorable === risk) return "neutral";
  return favorable > risk ? "favorable" : "risk";
}

interface SurfaceInnerConfig {
  /** "외적 인상"으로 분류되는 domain 태그(예: appearance, socialImpression). */
  outer: Set<string>;
  /** "내면 구조"로 분류되는 domain 태그(예: personality, coreImage, coreNature). */
  inner: Set<string>;
}

/** 같은 domain의 fact 중 strength가 가장 높은 것 하나만 남긴다 — 새 판정 기준이 아니라, 각
 * 리포트가 이미 finalize()에서 계산해 둔 strength(같은 극성 fact가 몇 개 모였는지)를 그대로
 * 재사용한다. AI synthesis 입력이 지나치게 장황해지는 것을 막기 위한 압축 전용이며, 압축 전
 * 전체 fact/evidence는 호출부에서 별도로 보존한다(근거 토글용). */
function pickTopPerDomain(facts: InterpretationFact[]): InterpretationFact[] {
  const bestByDomain = new Map<string, InterpretationFact>();
  for (const f of facts) {
    const current = bestByDomain.get(f.domain);
    if (!current || f.strength > current.strength) bestByDomain.set(f.domain, f);
  }
  return [...bestByDomain.values()];
}

/** outer/inner 구조 판단 + synthesizeText 위임을 한 fact 풀에 적용한다(대명 없이) —
 * synthesizeSection과 synthesizeScopedSections이 공유하는 핵심 로직. */
function composePool(pool: InterpretationFact[], config: SurfaceInnerConfig): string {
  if (pool.length === 0) return "";
  const outer = pool.filter((f) => config.outer.has(f.domain));
  const inner = pool.filter((f) => config.inner.has(f.domain));
  const other = pool.filter((f) => !config.outer.has(f.domain) && !config.inner.has(f.domain));

  const outerLean = lean(outer);
  const innerLean = lean(inner);
  const useSurfaceInner = outer.length > 0 && inner.length > 0 && outerLean !== "neutral" && innerLean !== "neutral" && outerLean !== innerLean;

  if (useSurfaceInner) {
    const otherText = other.length > 0 ? ` ${synthesizeText(other)}` : "";
    return `겉으로는 ${joinMeanings(outer)}이지만, 내면에서는 ${joinMeanings(inner)}인 모습입니다.${otherText}`;
  }
  return synthesizeText(pool);
}

/** 4단계 synthesis를 적용해 한 섹션의 deterministic text + fact 묶음을 만든다. outer/inner
 * 양쪽에 실제 fact가 있고, 그 둘의 favorable/risk 우세 방향이 서로 다를 때만 "겉으로는 A,
 * 내면에서는 B" 구조를 쓴다 — 그 외의 모든 polarity 충돌은 synthesizeText의 기존 양보절
 * (다만/그럼에도)로 통합한다. */
export function synthesizeSection(rawFacts: InterpretationFact[], config: SurfaceInnerConfig): { text: string; facts: InterpretationFact[] } {
  const facts = dedupeExactMeaning(rawFacts);
  if (facts.length === 0) return { text: "", facts: [] };
  return { text: composePool(facts, config), facts };
}

export interface ScopedFactGroup {
  /** 이 그룹의 fact가 누구 이야기인지 문장 앞에 붙이는 자연어 lead-in(예: "나는 재물 면에서는",
   * "배우자상에서는"). 원본 fact.meaning 문자열은 건드리지 않고, 합성 문단에서만 앞에 붙인다
   * (대표 지시: scope는 metadata/wrapper로만 해결, 원본 계산·문구는 그대로). */
  leadIn: string;
  facts: InterpretationFact[];
  outer?: Set<string>;
  inner?: Set<string>;
}

/** 여러 scope(나/배우자상 등)의 fact 그룹을 각각 압축·합성한 뒤 lead-in과 함께 이어붙인다.
 * 같은 궁을 참조하더라도 그룹이 다르면(예: 財帛宮을 읽는 self.wealth vs spouse.wealth) 절대
 * 하나로 합치지 않고 별도 문장으로 유지한다 — 이게 "주어 혼동 방지"의 핵심이다.
 * compress=true면 그룹 내부에서 domain당 strength 최상위 fact만 합성에 쓰고(장황함 방지),
 * 나머지는 evidenceFacts로 그대로 반환해 근거 토글에서 유지한다. */
export function synthesizeScopedSections(
  groups: ScopedFactGroup[],
  compress: boolean,
): { text: string; facts: InterpretationFact[]; evidenceFacts: InterpretationFact[] } {
  const parts: string[] = [];
  const synthesisFacts: InterpretationFact[] = [];
  const evidenceFacts: InterpretationFact[] = [];

  for (const group of groups) {
    const deduped = dedupeExactMeaning(group.facts);
    if (deduped.length === 0) continue;
    evidenceFacts.push(...deduped);
    const pool = compress ? pickTopPerDomain(deduped) : deduped;
    const text = composePool(pool, { outer: group.outer ?? new Set(), inner: group.inner ?? new Set() });
    if (!text) continue;
    parts.push(`${group.leadIn} ${text}`);
    synthesisFacts.push(...pool);
  }

  return { text: parts.join(" "), facts: synthesisFacts, evidenceFacts };
}

// ── 현재 삶의 중심축 — 새 판정 기준 없이 이미 계산된 身宮/大限/결혼시기 하이라이트만 읽는다 ──
const THEME_PALACE_LABEL: Partial<Record<PalaceName, string>> = {
  命宮: "자기 자신을 채우고 성장시키는 것",
  財帛宮: "재물을 만들고 다루는 것",
  事業宮: "일과 성취를 만들어가는 것",
  夫妻宮: "관계를 맺고 지켜가는 것",
  遷移宮: "바깥 활동과 새로운 환경",
  福德宮: "내면의 안정과 취향을 채우는 것",
};

function buildCurrentFocusSection(chart: ZiweiChart, marriageTiming: MarriageTimingReport): ComprehensiveSection {
  const facts: InterpretationFact[] = [];
  const evidence: EvidenceItem[] = [];

  // 身宮은 정통 이론상 命/財帛/事業/夫妻/遷移/福德宮 중 하나로만 배정되므로 항상 라벨이 있다.
  const shenGongLabel = THEME_PALACE_LABEL[chart.shenGong.palace];
  if (shenGongLabel) {
    facts.push({
      id: "current-shengong",
      domain: "currentFocus",
      meaning: `타고나기를 몸과 마음의 무게가 "${shenGongLabel}"에 실리는 구조입니다.`,
      polarity: "positive",
      strength: 1,
      evidence: [{ type: "palace", value: chart.shenGong.palace, source: "natal" }],
    });
    evidence.push({ type: "palace", value: chart.shenGong.palace, source: "natal" });
  }

  const age = new Date().getFullYear() - chart.birth.year;
  const majorPeriod = chart.majorPeriods.find((p) => age >= p.ageRange[0] && age <= p.ageRange[1]);
  const majorLabel = majorPeriod ? THEME_PALACE_LABEL[majorPeriod.palace] : undefined;
  if (majorPeriod && majorLabel) {
    facts.push({
      id: "current-major",
      domain: "currentFocus",
      meaning: `지금 이어지는 10년 단위 흐름(대한)은 "${majorLabel}" 쪽에 무게가 실리는 시기입니다.`,
      polarity: "positive",
      strength: 1,
      evidence: [],
    });
    evidence.push({ type: "period", value: `大限=${majorPeriod.palace}`, source: "major" });
  }

  const currentYear = spouseReportTimingYears()[0];
  const activeAxes = (["activationYears", "stabilityYears", "formalizationYears", "volatilityYears"] as const)
    .filter((key) => marriageTiming.highlights[key].includes(currentYear));
  if (activeAxes.length > 0) {
    facts.push({
      id: "current-timing",
      domain: "currentFocus",
      meaning: "올해는 관계 관련 신호도 함께 뚜렷하게 나타나고 있습니다.",
      polarity: "mixed",
      strength: 1,
      evidence: [],
    });
    evidence.push({ type: "period", value: `${currentYear}년 결혼시기 신호`, source: "annual" });
  }

  const text = facts.length > 0 ? facts.map((f) => f.meaning).join(" ") : "현재 삶의 중심축을 뚜렷하게 말할 근거가 부족합니다.";
  return { key: "currentFocus", title: "현재 삶의 중심축", text, facts, evidence };
}

// ── 앞으로의 주요 시기 — marriageTimingReport의 yearCards를 재계산 없이 요약만 한다 ──
function buildUpcomingTimingSection(marriageTiming: MarriageTimingReport): ComprehensiveSection {
  const cards = marriageTiming.yearCards.slice(0, 3);
  const facts: InterpretationFact[] = cards.map((card, i) => ({
    id: `upcoming-${card.year}`,
    domain: "upcomingTiming",
    meaning: `${card.year}년에는 ${card.axes.map((a) => AXIS_LABEL[a]).join("·")} 신호가 뚜렷합니다.`,
    polarity: card.axes.includes("volatility") ? "mixed" : "positive",
    strength: i + 1,
    evidence: card.evidence,
  }));

  const total = marriageTiming.yearCards.length;
  const text = facts.length > 0
    ? `${facts.map((f) => f.meaning).join(" ")} 앞으로 15년 동안 총 ${total}개 해에서 뚜렷한 신호가 나타나며, 자세한 연도별 해석은 결혼시기 리포트에서 볼 수 있습니다.`
    : "앞으로 15년 동안 뚜렷한 신호가 나타나는 해가 없습니다.";

  return { key: "upcomingTiming", title: "앞으로의 주요 시기", text, facts, evidence: facts.flatMap((f) => f.evidence) };
}

export function buildComprehensiveReport(chart: ZiweiChart, ruleSet: RuleSet, personName: string): ComprehensiveReport {
  const natureEvidence = extractNatureEvidence(chart);
  const wealthEvidence = extractWealthEvidence(chart);
  const careerEvidence = extractCareerEvidence(chart);
  const spouseEvidence = extractSpouseEvidence(chart);
  const marriageTiming = buildMarriageTimingReport(chart, ruleSet, personName);

  // ── 핵심 성향(nature 계열만 — 배우자상 절대 섞지 않음) ──
  const natureFactsAll = [
    ...coreNatureFacts(natureEvidence), ...lifeDirectionFacts(natureEvidence),
    ...socialImpressionFacts(natureEvidence), ...lifeAttitudeFacts(natureEvidence),
  ];
  const coreNature = synthesizeSection(natureFactsAll, {
    outer: new Set(["socialImpression"]),
    inner: new Set(["coreNature", "lifeDirection", "lifeAttitude"]),
  });

  // ── 일·재물(내 재물·커리어 리포트만 — 배우자의 career/wealth 도메인은 "연애·배우자"로).
  // 재물/커리어는 둘 다 "나"의 이야기지만 주제가 다르므로 각각 "나는 재물 면에서는"/
  // "나는 일에서는" lead-in으로 분리한다 — 연애·배우자 섹션의 spouse.wealth/spouse.career와
  // 같은 궁을 참조하더라도 주어가 섞이지 않도록 하기 위함(대표 지시).
  const wealthFactsAll = [
    ...coreWealthFacts(wealthEvidence), ...incomeStyleFacts(wealthEvidence),
    ...spendingTendencyFacts(wealthEvidence), ...wealthVolatilityFacts(wealthEvidence),
  ];
  const careerFactsAll = [
    ...coreCareerFacts(careerEvidence), ...workStyleFacts(careerEvidence),
    ...collaborationEnvironmentFacts(careerEvidence), ...achievementVolatilityFacts(careerEvidence),
  ];
  const workWealth = synthesizeScopedSections(
    [
      { leadIn: "나는 재물 면에서는", facts: wealthFactsAll },
      { leadIn: "나는 일에서는", facts: careerFactsAll },
    ],
    false,
  );

  // ── 연애·배우자(romance 4축="나"의 연애 방식 + 배우자 리포트 전체 도메인="배우자상"). 37개
  // fact를 전부 근거로는 유지하되, AI synthesis 입력은 그룹별 domain당 strength 최상위 fact만
  // 써서 메인 문장이 장황해지지 않게 한다(compress=true). ──
  const romanceFactsAll = [
    ...attractionFacts(spouseEvidence), ...expressionFacts(spouseEvidence),
    ...conflictFacts(spouseEvidence), ...managementFacts(spouseEvidence),
  ];
  const spouseFactsAll = [
    ...spouseCoreImageFacts(spouseEvidence), ...spousePersonalityFacts(spouseEvidence), ...spouseAppearanceFacts(spouseEvidence),
    ...spouseCareerFacts(spouseEvidence), ...spouseWealthFacts(spouseEvidence),
    ...meetingFacts(spouseEvidence), ...relationshipFacts(spouseEvidence), ...compatibilityFacts(spouseEvidence),
  ];
  const romanceSpouse = synthesizeScopedSections(
    [
      { leadIn: "나는 연애에서는", facts: romanceFactsAll },
      { leadIn: "배우자상에서는", facts: spouseFactsAll, outer: new Set(["appearance"]), inner: new Set(["personality"]) },
    ],
    true,
  );

  const currentFocus = buildCurrentFocusSection(chart, marriageTiming);
  const upcomingTiming = buildUpcomingTimingSection(marriageTiming);

  const sections: ComprehensiveSection[] = [
    { key: "coreNature", title: "핵심 성향", text: coreNature.text, facts: coreNature.facts, evidence: withSource(coreNature.facts.flatMap((f) => f.evidence), "natal") },
    { key: "workWealth", title: "일·재물", text: workWealth.text, facts: workWealth.facts, evidence: withSource(workWealth.evidenceFacts.flatMap((f) => f.evidence), "natal") },
    { key: "romanceSpouse", title: "연애·배우자", text: romanceSpouse.text, facts: romanceSpouse.facts, evidence: withSource(romanceSpouse.evidenceFacts.flatMap((f) => f.evidence), "natal") },
    currentFocus,
    upcomingTiming,
  ];

  return { personName, sections };
}
