// 결혼시기 주제 리포트 — timingEngine의 activation/stability/formalization/volatility 4축과
// 점수·판정 로직은 그대로 재사용한다(계산·가중치 변경 없음, natal 근거를 엔진에 추가하지
// 않음). 배우자 리포트 TimingSection의 raw 신호 테이블은 그대로 두고, 이 리포트는 "하이라이트된
// 해마다 왜 그 해가 뚜렷한지"를 자연어로 설명하는 것이 다르다. "결혼 확정 연도" 단정은 하지
// 않는다(대표 원칙) — 활성화/안정화/공식화 가능성/변동성·주의 4개 라벨로만 구분한다.
//
// 21단계 재구성(대표 지시) — 이전 버전은 natal baseline 문장을 연도 카드마다 반복 삽입했고,
// 4축을 각각 한 줄씩("관계 활성화 흐름이 이 해에 뚜렷하게 나타납니다") 독립적으로 서술해
// AxisBadge 라벨과 문장이 사실상 같은 말을 두 번 하는 문제가 있었다. 이번 버전은:
//   ① natal baseline은 리포트 레벨에서 한 번만 계산해 `report.natalBaseline`으로 분리한다
//      (연도 카드 facts/text에는 더 이상 들어가지 않는다 — 화면에서 연도 목록 위에 한 번만
//      노출하는 것은 페이지 컴포넌트 책임).
//   ② 4축을 독립적으로 나열하지 않고, 점수 조합(activation/stability/formalization/volatility의
//      상대적 高/低/0/음수)에 따라 synthesizeAxisCombination()이 1~2문장으로 합성한다. 조합
//      의미는 대표가 지정한 것을 그대로 코드화했다(아래 함수 주석 참고) — 새 점수·가중치는
//      전혀 추가하지 않고 기존 timingEngine 점수의 해석만 바꾼다.
//   ③ 0점은 "특별한 추가 신호 없음"이지 부정적 신호가 아니다 — classify()가 "zero"로 분류한
//      축은 나쁘다는 문구를 만들지 않는다(예: stability↑+formalization 0 → "결혼 신호로
//      단정하지 않는다"이지 "formalization이 없어서 나쁘다"가 아니다).
//   ④ 大限/流年 작동(describeMajorEvidence/describeAnnualEvidence)은 여전히 자연어로 번역해
//      `facts`(AI 다듬기 입력)와 `evidence`(근거 토글)에는 남기지만, deterministic fallback
//      문장(`card.text`)에는 더 이상 나열하지 않는다 — "기술 근거는 [왜 이런 결과인가요?]에서
//      확인"이라는 요구사항에 맞춰, 메인 문장은 축 조합 synthesis 1~2문장으로만 구성한다.
//
// natal baseline은 모든 연도에 고정된 deterministic 문장을 그대로 쓴다(연도별로 다시 만들지
// 않는다).
import type { EvidenceItem, RuleSet, ZiweiChart } from "../types";
import { extractSpouseEvidence, type SpouseEvidenceBundle } from "../spouseEvidence";
import {
  computeRelationshipTimingSignals, computeTimingHighlights, TIMING_HIGHLIGHT_THRESHOLD,
  type RelationshipTimingSignal, type TimingHighlights,
} from "../timingEngine";
import { personalityFacts, relationshipFacts, type InterpretationFact } from "./interpretationFacts";
import type { Polarity } from "./starInterpretations";
import { spouseReportTimingYears } from "./spouseReport";

export type TimingAxis = "activation" | "stability" | "formalization" | "volatility";

export const AXIS_LABEL: Record<TimingAxis, string> = {
  activation: "관계 활성화",
  stability: "안정화",
  formalization: "공식화 가능성",
  volatility: "변동성·주의",
};

function withSource(items: EvidenceItem[], source: NonNullable<EvidenceItem["source"]>): EvidenceItem[] {
  return items.map((e) => ({ ...e, source }));
}

// ── 타고난 관계 baseline — 새 계산 없이 배우자 리포트의 natal fact를 그대로 재사용 ──
// personalityFacts/relationshipFacts는 이미 자연어(기술 표기 없음)라 번역이 필요 없다. 다만
// 두 도메인의 fact를 synthesizeText로 전부 이어붙이면 문단 하나가 지나치게 길어지므로, strength가
// 가장 높은 fact 1개씩만 뽑아 짧은 baseline 한 문장으로 묶는다 — fact 내용 자체는 그대로
// 재사용하고 양만 압축한다. 연도와 무관한 고정 context이므로 리포트당 한 번만 계산한다.
function pickStrongest(facts: InterpretationFact[]): InterpretationFact | undefined {
  return [...facts].sort((a, b) => b.strength - a.strength)[0];
}

export interface NatalBaseline {
  text: string;
  facts: InterpretationFact[];
  evidence: EvidenceItem[];
}

function buildNatalBaseline(evidence: SpouseEvidenceBundle): NatalBaseline | null {
  const picked = [pickStrongest(personalityFacts(evidence)), pickStrongest(relationshipFacts(evidence))]
    .filter((f): f is InterpretationFact => !!f);
  if (picked.length === 0) return null;

  const risk = picked.filter((f) => f.polarity === "risk").length;
  const favorable = picked.length - risk;
  const fact: InterpretationFact = {
    id: "natal-baseline",
    domain: "timing-natal",
    meaning: `타고난 관계 자리는 ${picked.map((f) => f.meaning).join(", ")} 구조입니다.`,
    polarity: risk > 0 && favorable > 0 ? "mixed" : risk > 0 ? "risk" : "positive",
    strength: picked.length,
    evidence: withSource(picked.flatMap((f) => f.evidence), "natal"),
  };
  return { text: fact.meaning, facts: [fact], evidence: fact.evidence };
}

// ── 大限의 작동 — 大限夫妻宮 중첩(stability 축 evidence)을 자연어로 번역 ──
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

// ── 流年의 작동 — 流年 관련 evidence를 자연어로 번역(化祿/化權/化科/化忌, 擎羊/陀羅, 紅鸞/天喜 포함) ──
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

// ── 4축 조합 synthesis — 대표가 지정한 조합 의미를 그대로 코드화한다. 새 점수·가중치는
// 만들지 않고, timingEngine이 이미 계산한 4개 숫자의 "조합 해석"만 바꾼다. 점수 구간은
// 기존 하이라이트 임계치(TIMING_HIGHLIGHT_THRESHOLD=1.5)를 그대로 재사용한다.
type AxisLevel = "high" | "low" | "zero" | "negative";

function classify(score: number): AxisLevel {
  if (score < 0) return "negative";
  if (score === 0) return "zero";
  if (score >= TIMING_HIGHLIGHT_THRESHOLD) return "high";
  return "low";
}

interface CombinationClause {
  meaning: string;
  polarity: Polarity;
}

/** 연도당 1~2개의 핵심 문장만 만든다 — 4축을 각각 한 줄씩 나열하지 않고, 어떤 축들이 함께
 * 움직이는지로 하나의 해석을 만든다. 규칙 순서는 대표가 지정한 우선순위와 같다(먼저 매칭되는
 * 규칙이 그 해의 대표 서술이 된다 — 서로 배타적인 조건이라 우선순위가 결과를 바꾸지 않는
 * 경우가 대부분이지만, formalization+volatility가 동시에 stability 음수와 겹치는 경우처럼
 * 더 구체적인 규칙이 있으면 그것을 우선한다). */
function synthesizeAxisCombination(signal: RelationshipTimingSignal): CombinationClause[] {
  const a = classify(signal.activation.score);
  const s = classify(signal.stability.score);
  const f = classify(signal.formalization.score);
  const v = classify(signal.volatility.score);

  const clauses: CombinationClause[] = [];

  if (f === "high" && s === "negative") {
    // formalization↑ + stability↓: 관계를 정의/공식화하려는 압력은 강하지만 과정은 불안정
    clauses.push({
      meaning: "관계를 확실히 정하려는 압력이 강해지는 해이지만, 그 과정 자체는 순탄하지만은 않아 서로 조율이 필요해 보입니다",
      polarity: "mixed",
    });
  } else if (a === "high" && v === "high" && s === "negative") {
    // activation↑ + volatility↑ + stability↓: 사건·움직임은 많지만 안정적으로 자리 잡기 어려움
    clauses.push({
      meaning: "관계 안에서 크고 작은 사건과 움직임이 많아지는 해이지만, 그것이 곧바로 안정적으로 자리 잡는 흐름까지 이어지지는 않습니다",
      polarity: "risk",
    });
  } else if (f === "high" && v === "high") {
    // formalization↑ + volatility↑: 관계 정의 이벤트가 강한 시기 — 무조건 호재로 단정하지 않음
    clauses.push({
      meaning: "관계를 정의하는 사건이 뚜렷하게 나타나는 해입니다. 다만 이는 관계를 다지는 방향뿐 아니라 다시 정하거나 정리하는 방향으로도 나타날 수 있어, 한쪽으로 단정하기는 이릅니다",
      polarity: "mixed",
    });
  } else if ((a === "low" || a === "zero") && f === "high") {
    // activation↓ + formalization↑: 큰 사건성 없이 기존 관계가 조용히 공식화될 수도 있음
    clauses.push({
      meaning: "겉으로 큰 사건이 두드러지지 않아도, 이미 있던 관계가 조용히 공식적인 매듭으로 이어질 수 있는 해입니다",
      polarity: "positive",
    });
  } else if (s === "high" && f === "zero") {
    // stability↑ + formalization 0: 편안한 유지 가능성 — 결혼 신호로 단정하지 않음(0=부정 아님)
    clauses.push({
      meaning: "관계를 편안하고 안정적으로 이어가기 좋은 흐름이 있는 해입니다. 다만 이것만으로 관계를 새로 정의하는 신호라고 단정할 수는 없습니다",
      polarity: "positive",
    });
  } else {
    // 위 조합에 해당하지 않으면 이번 해에 뚜렷한(하이라이트 임계치 이상) 축 중 점수가 가장 높은
    // 하나를 골라, 뱃지 라벨을 그대로 반복하지 않는 자연어 한 문장으로 설명한다.
    const axes: TimingAxis[] = ["activation", "stability", "formalization", "volatility"];
    const dominant = axes
      .filter((axis) => classify(signal[axis].score) === "high")
      .sort((x, y) => signal[y].score - signal[x].score)[0];
    if (dominant === "activation") {
      clauses.push({ meaning: "관계 안에서 크고 작은 움직임과 사건이 뚜렷해지는 해입니다", polarity: "mixed" });
    } else if (dominant === "stability") {
      clauses.push({ meaning: "관계가 안정적인 기반 위에 놓이는 해입니다", polarity: "positive" });
    } else if (dominant === "formalization") {
      clauses.push({ meaning: "관계를 공식적으로 정리하기 좋은 흐름이 나타나는 해입니다", polarity: "positive" });
    } else if (dominant === "volatility") {
      clauses.push({ meaning: "감정 기복이나 갈등 신호에 특히 주의가 필요한 해입니다", polarity: "risk" });
    }
  }

  // stability가 음수인데 위 규칙이 그 불안정성을 이미 언급하지 않았다면(1·2번 규칙이 아니라면),
  // 서두르지 않기를 권하는 보조 문장을 하나 더 붙인다 — 여전히 1~2문장 상한을 지킨다.
  const alreadyMentionsInstability = clauses.some((c) => c.meaning.includes("조율") || c.meaning.includes("안정적으로 자리 잡는"));
  if (s === "negative" && !alreadyMentionsInstability) {
    clauses.push({
      meaning: "다만 관계가 자리 잡는 과정에서 흔들림이 있을 수 있어, 서두르기보다 서로 맞춰가는 시간이 필요합니다",
      polarity: "risk",
    });
  }

  return clauses.slice(0, 2);
}

export interface MarriageTimingYearCard {
  year: number;
  /** 이 해에 하이라이트된 축(가중치 임계치 이상인 축) — 카드에 뱃지로 표시. */
  axes: TimingAxis[];
  /** deterministic 합성 문단(1~2문장) — AI 다듬기 실패/미로그인 시 그대로 노출되는 fallback.
   * natal baseline과 大限/流年 raw 서술은 포함하지 않는다(각각 report.natalBaseline과
   * evidence 토글에서 확인). */
  text: string;
  /** 축 조합 synthesis + 大限/流年 작동을 담는 fact 목록(연도 1개당). natal baseline은
   * 포함하지 않는다(모든 연도에 고정이라 — report.natalBaseline이 별도로 있다). */
  facts: InterpretationFact[];
  /** [왜 이런 결과인가요?] 토글에 쓰는 근거(원국/대한/유년 전체) — 축 구분 없이 모은다. */
  evidence: EvidenceItem[];
}

function buildYearCard(signal: RelationshipTimingSignal, axes: TimingAxis[]): MarriageTimingYearCard {
  const combinationClauses = synthesizeAxisCombination(signal);
  const facts: InterpretationFact[] = combinationClauses.map((c, i) => ({
    id: `${signal.year}-combo-${i}`,
    domain: "timing-combination",
    meaning: c.meaning,
    polarity: c.polarity,
    strength: combinationClauses.length - i,
    evidence: [],
  }));
  const evidence: EvidenceItem[] = [];

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

  const text = combinationClauses.map((c) => `${c.meaning}.`).join(" ") || "뚜렷한 근거가 없습니다.";

  return { year: signal.year, axes, text, facts, evidence: dedupeEvidence(evidence) };
}

export interface MarriageTimingReport {
  personName: string;
  /** 전체 연도 범위의 raw 신호 — 배우자 리포트 TimingSection과 같은 표 형태로 그대로 노출할 때 씀. */
  signals: RelationshipTimingSignal[];
  highlights: TimingHighlights;
  /** 타고난 관계/배우자 baseline — 연도 목록 위에서 한 번만 노출한다(연도 카드마다 반복하지
   * 않음). natal fact가 없으면(예: 夫妻宮·對宮 모두 정보 부족) null. */
  natalBaseline: NatalBaseline | null;
  /** 하이라이트된 해만 모은 카드 목록(연도 오름차순, 중복 없음) — AI 다듬기는 이 배열 길이만큼만 호출된다. */
  yearCards: MarriageTimingYearCard[];
}

export function buildMarriageTimingReport(chart: ZiweiChart, ruleSet: RuleSet, personName: string): MarriageTimingReport {
  const spouseEvidence = extractSpouseEvidence(chart);
  const natalBaseline = buildNatalBaseline(spouseEvidence);

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
    .map((s) => buildYearCard(s, axesByYear.get(s.year)!));

  return { personName, signals, highlights, natalBaseline, yearCards };
}
