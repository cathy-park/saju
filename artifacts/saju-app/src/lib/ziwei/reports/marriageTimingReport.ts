// 결혼시기 주제 리포트 — timingEngine의 activation/stability/formalization/volatility 4축과
// 점수·판정 로직은 그대로 재사용한다(계산·가중치 변경 없음, natal 근거를 엔진에 추가하지
// 않음). 배우자 리포트 TimingSection의 raw 신호 테이블은 그대로 두고, 이 리포트는 "하이라이트된
// 해마다 왜 그 해가 뚜렷한지"를 자연어로 설명하는 것이 다르다. "결혼 확정 연도" 단정은 하지
// 않는다(대표 원칙) — 활성화/안정화/공식화 가능성/변동성·주의 4개 라벨로만 구분한다.
//
// 설명 품질 개선(대표 지시, 2차): 각 하이라이트 연도마다 ①타고난 관계 baseline(배우자
// 리포트의 personality/relationship natal fact를 그대로 재사용 — 새 계산 없음, 연도 점수에도
// 영향 없는 설명용 context) ②大限의 작동 ③流年의 작동 ④4축 상태·방향 ⑤유리/주의 요소를
// 구조화된 fact 묶음으로 먼저 만든 뒤 AI에 넘긴다. 메인 문장에는 夫妻宮·化權·大限 같은 표기를
// 노출하지 않고(자연어로 번역), 근거 토글에서만 [원국]/[대한]/[유년] + 실제 궁·별·사화를 보여준다.
//
// AI 다듬기 호출 예산: 연도×축(최대 15×4=60회)으로 호출하지 않는다. 하이라이트된 해 1개당
// 딱 1회만 polishStatementText를 호출한다(facts가 풍부해져도 호출 단위는 그대로 "연도당 1개
// 묶음"이다). sourceHash 캐시는 서버가 facts+deterministicText로 자동 계산하므로 이 파일은
// 캐시 구조를 따로 건드리지 않는다.
import type { EvidenceItem, RuleSet, ZiweiChart } from "../types";
import { extractSpouseEvidence, type SpouseEvidenceBundle } from "../spouseEvidence";
import {
  computeRelationshipTimingSignals, computeTimingHighlights,
  type RelationshipTimingSignal, type TimingHighlights,
} from "../timingEngine";
import { personalityFacts, relationshipFacts, type InterpretationFact } from "./interpretationFacts";
import type { Polarity } from "./starInterpretations";
import { spouseReportTimingYears } from "./spouseReport";

export type TimingAxis = "activation" | "stability" | "formalization" | "volatility";

const AXIS_LABEL: Record<TimingAxis, string> = {
  activation: "관계 활성화",
  stability: "안정화",
  formalization: "공식화 가능성",
  volatility: "변동성·주의",
};

function withSource(items: EvidenceItem[], source: NonNullable<EvidenceItem["source"]>): EvidenceItem[] {
  return items.map((e) => ({ ...e, source }));
}

// ── ①타고난 관계 baseline — 새 계산 없이 배우자 리포트의 natal fact를 그대로 재사용 ──
// personalityFacts/relationshipFacts는 이미 자연어(기술 표기 없음)라 번역이 필요 없다. 다만
// 두 도메인의 fact를 synthesizeText로 전부 이어붙이면 문단 하나가 지나치게 길어져서(연도마다
// 그대로 반복되면 "이 해에 무엇이 특별한지"가 묻힌다), strength가 가장 높은 fact 1개씩만
// 뽑아 짧은 baseline 한 문장으로 묶는다 — fact 내용 자체는 그대로 재사용하고 양만 압축한다.
// 연도와 무관한 고정 context이므로 리포트당 한 번만 계산해서 모든 연도 카드에 동일하게 끼워 넣는다.
function pickStrongest(facts: InterpretationFact[]): InterpretationFact | undefined {
  return [...facts].sort((a, b) => b.strength - a.strength)[0];
}

function buildNatalContextFacts(evidence: SpouseEvidenceBundle): InterpretationFact[] {
  const picked = [pickStrongest(personalityFacts(evidence)), pickStrongest(relationshipFacts(evidence))]
    .filter((f): f is InterpretationFact => !!f);
  if (picked.length === 0) return [];

  const risk = picked.filter((f) => f.polarity === "risk").length;
  const favorable = picked.length - risk;
  return [{
    id: "natal-baseline",
    domain: "timing-natal",
    meaning: `타고난 관계 자리는 ${picked.map((f) => f.meaning).join(", ")} 구조입니다.`,
    polarity: risk > 0 && favorable > 0 ? "mixed" : risk > 0 ? "risk" : "positive",
    strength: picked.length,
    evidence: withSource(picked.flatMap((f) => f.evidence), "natal"),
  }];
}

// ── ②大限의 작동 — 大限夫妻宮 중첩(stability 축 evidence)을 자연어로 번역 ──
function describeMajorEvidence(e: EvidenceItem): { meaning: string; polarity: Polarity } | null {
  if (e.type !== "period") return null;
  if (e.value.includes("直接 중첩")) {
    return { meaning: "지금 이어지는 10년 단위 큰 흐름이 타고난 관계 자리와 정확히 맞물려 관계의 기반이 단단해지는 시기입니다", polarity: "positive" };
  }
  if (e.value.includes("삼방사정 진입")) {
    return { meaning: "지금 이어지는 10년 단위 큰 흐름이 타고난 관계 자리와 가까운 흐름 안에 들어와 있는 시기입니다", polarity: "positive" };
  }
  return null;
}

// ── ③流年의 작동 — 流年 관련 evidence를 자연어로 번역(化祿/化權/化科/化忌, 擎羊/陀羅, 紅鸞/天喜 포함) ──
function describeAnnualEvidence(e: EvidenceItem): { meaning: string; polarity: Polarity } | null {
  if (e.type === "period" && e.value.startsWith("流年夫妻宮")) {
    return e.value.includes("直接 중첩")
      ? { meaning: "올해가 타고난 관계 자리와 정확히 맞아떨어지는 해입니다", polarity: "positive" }
      : { meaning: "올해가 타고난 관계 자리와 가까운 흐름 안에 들어오는 해입니다", polarity: "positive" };
  }
  if (e.type === "period" && e.value.startsWith("流年宮")) {
    return { meaning: "올해가 관계를 공식적으로 정리하기 좋은 흐름과 겹치는 해입니다", polarity: "positive" };
  }
  if (e.type === "transformation") {
    if (e.value.startsWith("化祿")) return { meaning: "관계에 여유와 순조로움을 더하는 기운이 들어오는 해입니다", polarity: "positive" };
    if (e.value.startsWith("化權")) return { meaning: "관계에서 주도권을 가지려는 기운이 강해지는 해입니다", polarity: "mixed" };
    if (e.value.startsWith("化科")) return { meaning: "관계가 주변에 드러나고 인정받는 기운이 들어오는 해입니다", polarity: "positive" };
    if (e.value.startsWith("化忌")) return { meaning: "관계에서 집착이나 오해가 생기기 쉬운 기운이 들어오는 해입니다", polarity: "risk" };
  }
  if (e.type === "star" && e.value.includes("流年夫妻宮") && (e.value.includes("擎羊") || e.value.includes("陀羅"))) {
    return { meaning: "감정 기복이나 갈등이 두드러질 수 있는 해입니다", polarity: "risk" };
  }
  if (e.type === "star" && e.value.includes("(流年)")) {
    return { meaning: "인연·경사와 관련된 신호가 들어오는 해입니다", polarity: "positive" };
  }
  return null;
}

// ── ④4축 상태·방향 — 이미 있는 임계치(1.5)만 재사용, 새 판정 기준을 만들지 않는다 ──
const HIGHLIGHT_THRESHOLD = 1.5;
function describeAxisState(axis: TimingAxis, score: number): { meaning: string; polarity: Polarity } | null {
  if (score === 0) return null;
  if (score < 0) return { meaning: `${AXIS_LABEL[axis]} 흐름이 이 해에는 약해지는 신호가 있습니다`, polarity: "risk" };
  const strength = score >= HIGHLIGHT_THRESHOLD ? "뚜렷하게" : "약하게";
  const polarity: Polarity = axis === "volatility" ? "risk" : axis === "activation" ? "mixed" : "positive";
  return { meaning: `${AXIS_LABEL[axis]} 흐름이 이 해에 ${strength} 나타납니다`, polarity };
}

function dedupeByMeaning<T extends { meaning: string }>(items: T[]): T[] {
  const seen = new Set<string>();
  return items.filter((item) => {
    if (seen.has(item.meaning)) return false;
    seen.add(item.meaning);
    return true;
  });
}

/** timingEngine은 같은 evidence 객체를 activation·volatility 등 여러 축에 동시에 push하기도
 * 하므로(化忌·擎羊·陀羅 등), 근거 토글에 같은 근거가 중복 표시되지 않도록 정리한다. */
function dedupeEvidence(items: EvidenceItem[]): EvidenceItem[] {
  const seen = new Set<string>();
  return items.filter((e) => {
    const key = `${e.source ?? ""}|${e.type}|${e.value}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export interface MarriageTimingYearCard {
  year: number;
  /** 이 해에 하이라이트된 축(가중치 임계치 이상인 축) — 카드에 뱃지로 표시. */
  axes: TimingAxis[];
  /** deterministic 합성 문단 — AI 다듬기 실패/미로그인 시 그대로 노출되는 fallback. */
  text: string;
  /** prose layer에 보낼 fact 목록 — natal baseline + 大限/流年 작동 + 축 상태를 모두 담되,
   * 연도 1개당 이 배열 전체로 polishStatementText를 딱 1회만 호출한다. */
  facts: InterpretationFact[];
  /** [왜 이런 결과인가요?] 토글에 쓰는 근거(원국/대한/유년 전체) — 축 구분 없이 모은다. */
  evidence: EvidenceItem[];
}

function buildYearCard(
  signal: RelationshipTimingSignal,
  axes: TimingAxis[],
  natalFacts: InterpretationFact[],
): MarriageTimingYearCard {
  const facts: InterpretationFact[] = [...natalFacts.map((f, i) => ({ ...f, id: `${signal.year}-${f.id}-${i}` }))];
  const evidence: EvidenceItem[] = natalFacts.flatMap((f) => f.evidence);

  const majorDescs = dedupeByMeaning(
    signal.stability.evidence.map(describeMajorEvidence).filter((d): d is NonNullable<typeof d> => !!d),
  );
  majorDescs.forEach((d, i) => {
    facts.push({ id: `${signal.year}-major-${i}`, domain: "timing-major", meaning: d.meaning, polarity: d.polarity, strength: 1, evidence: [] });
  });
  evidence.push(...withSource(signal.stability.evidence.filter((e) => describeMajorEvidence(e)), "major"));

  const annualPool = [...signal.activation.evidence, ...signal.formalization.evidence, ...signal.volatility.evidence];
  const annualDescs = dedupeByMeaning(
    annualPool.map(describeAnnualEvidence).filter((d): d is NonNullable<typeof d> => !!d),
  );
  annualDescs.forEach((d, i) => {
    facts.push({ id: `${signal.year}-annual-${i}`, domain: "timing-annual", meaning: d.meaning, polarity: d.polarity, strength: 1, evidence: [] });
  });
  evidence.push(...withSource(annualPool.filter((e) => describeAnnualEvidence(e)), "annual"));

  const axisFacts = axes
    .map((axis) => ({ axis, desc: describeAxisState(axis, signal[axis].score) }))
    .filter((x): x is { axis: TimingAxis; desc: NonNullable<ReturnType<typeof describeAxisState>> } => !!x.desc);
  axisFacts.forEach(({ axis, desc }, i) => {
    facts.push({ id: `${signal.year}-axis-${axis}-${i}`, domain: `timing-${axis}`, meaning: desc.meaning, polarity: desc.polarity, strength: i + 1, evidence: [] });
  });

  const clauses = [
    ...natalFacts.map((f) => f.meaning),
    ...majorDescs.map((d) => d.meaning),
    ...annualDescs.map((d) => d.meaning),
    ...axisFacts.map((x) => x.desc.meaning),
  ];

  return { year: signal.year, axes, text: clauses.join(" ") || "뚜렷한 근거가 없습니다.", facts, evidence: dedupeEvidence(evidence) };
}

export interface MarriageTimingReport {
  personName: string;
  /** 전체 연도 범위의 raw 신호 — 배우자 리포트 TimingSection과 같은 표 형태로 그대로 노출할 때 씀. */
  signals: RelationshipTimingSignal[];
  highlights: TimingHighlights;
  /** 하이라이트된 해만 모은 카드 목록(연도 오름차순, 중복 없음) — AI 다듬기는 이 배열 길이만큼만 호출된다. */
  yearCards: MarriageTimingYearCard[];
}

export function buildMarriageTimingReport(chart: ZiweiChart, ruleSet: RuleSet, personName: string): MarriageTimingReport {
  const spouseEvidence = extractSpouseEvidence(chart);
  const natalFacts = buildNatalContextFacts(spouseEvidence);

  const years = spouseReportTimingYears();
  const signals = computeRelationshipTimingSignals(chart, ruleSet, years);
  const highlights = computeTimingHighlights(signals);

  const axesByYear = new Map<number, TimingAxis[]>();
  (Object.entries(highlights) as [keyof TimingHighlights, number[]][]).forEach(([key, yearsForAxis]) => {
    const axis = key.replace(/Years$/, "") as TimingAxis;
    for (const year of yearsForAxis) {
      const list = axesByYear.get(year) ?? [];
      list.push(axis);
      axesByYear.set(year, list);
    }
  });

  const yearCards = signals
    .filter((s) => axesByYear.has(s.year))
    .map((s) => buildYearCard(s, axesByYear.get(s.year)!, natalFacts));

  return { personName, signals, highlights, yearCards };
}
