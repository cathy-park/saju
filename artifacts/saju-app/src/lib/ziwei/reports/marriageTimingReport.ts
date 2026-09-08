// 결혼시기 주제 리포트 — timingEngine의 activation/stability/formalization/volatility 4축을
// 그대로 재사용한다(계산·가중치 변경 없음). 배우자 리포트 TimingSection의 raw 신호 테이블은
// 그대로 두고, 이 리포트는 "하이라이트된 해마다 왜 그 해가 뚜렷한지"를 자연어 카드로 보여주는
// 것이 다르다. "결혼 확정 연도" 단정은 하지 않는다(대표 원칙) — 활성화/안정화/공식화 가능성/
// 변동성·주의 4개 라벨로만 구분한다.
//
// AI 다듬기 호출 예산: 연도×축(최대 15×4=60회)으로 호출하지 않는다. 하이라이트된 해 1개당
// 딱 1회만 polishStatementText를 호출하도록, 그 해에 해당하는 모든 축의 근거를 여기서 먼저
// deterministic하게 하나의 문단(text)과 fact 목록으로 합쳐 둔다(대표 지시).
import type { EvidenceItem, RuleSet, ZiweiChart } from "../types";
import { extractSpouseEvidence } from "../spouseEvidence";
import {
  computeRelationshipTimingSignals, computeTimingHighlights,
  type RelationshipTimingSignal, type TimingHighlights,
} from "../timingEngine";
import type { InterpretationFact } from "./interpretationFacts";
import type { Polarity } from "./starInterpretations";
import { spouseReportTimingYears } from "./spouseReport";

export type TimingAxis = "activation" | "stability" | "formalization" | "volatility";

const AXIS_LABEL: Record<TimingAxis, string> = {
  activation: "관계 활성화",
  stability: "안정화",
  formalization: "공식화 가능성",
  volatility: "변동성·주의",
};

/** 각 축의 성격 — 사실 자체의 좋고 나쁨이 아니라 synthesizeText류 합성이 없는 이 리포트에서
 * prose 서버에 보낼 polarity를 정하기 위한 것뿐이다(활성도는 "사건성"일 뿐 길흉이 아니라는
 * 원칙을 지키기 위해 mixed로 둔다). */
const AXIS_POLARITY: Record<TimingAxis, Polarity> = {
  activation: "mixed",
  stability: "positive",
  formalization: "positive",
  volatility: "risk",
};

const SOURCE_LABEL: Record<NonNullable<EvidenceItem["source"]>, string> = {
  natal: "원국",
  major: "대한",
  annual: "유년",
};

function sourceClause(evidence: EvidenceItem[]): string {
  const sources = Array.from(new Set(evidence.map((e) => e.source).filter((s): s is NonNullable<EvidenceItem["source"]> => !!s)));
  if (sources.length === 0) return "";
  return sources.map((s) => SOURCE_LABEL[s]).join("·") + " 근거로";
}

export interface MarriageTimingYearCard {
  year: number;
  /** 이 해에 하이라이트된 축(가중치 임계치 이상인 축) — 카드에 뱃지로 표시. */
  axes: TimingAxis[];
  /** deterministic 합성 문단 — AI 다듬기 실패/미로그인 시 그대로 노출되는 fallback. */
  text: string;
  /** prose layer에 보낼 fact 목록 — 축 하나당 fact 하나(축×연도로 쪼개지 않는다). */
  facts: InterpretationFact[];
  /** [왜 이런 결과인가요?] 토글에 쓰는 근거 — 축 구분 없이 이 해의 전체 근거를 모은 것. */
  evidence: EvidenceItem[];
}

function buildYearCard(signal: RelationshipTimingSignal, axes: TimingAxis[]): MarriageTimingYearCard {
  const clauses: string[] = [];
  const facts: InterpretationFact[] = [];
  const evidence: EvidenceItem[] = [];

  axes.forEach((axis, i) => {
    const axisResult = signal[axis];
    const clause = sourceClause(axisResult.evidence);
    const sentence = clause
      ? `${AXIS_LABEL[axis]}는 ${clause} 뚜렷하게 나타나는 해입니다`
      : `${AXIS_LABEL[axis]} 신호가 뚜렷하게 나타나는 해입니다`;
    clauses.push(sentence);
    facts.push({
      id: `${signal.year}-${axis}`,
      domain: `timing-${axis}`,
      meaning: sentence,
      polarity: AXIS_POLARITY[axis],
      strength: i + 1,
      evidence: axisResult.evidence,
    });
    evidence.push(...axisResult.evidence);
  });

  return { year: signal.year, axes, text: clauses.join(". ") + ".", facts, evidence };
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
  extractSpouseEvidence(chart); // 궁 구조가 유효한지(夫妻宮 등) 조기 검증 — 반환값은 timingEngine이 내부에서 다시 계산한다.
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

  return { personName, signals, highlights, yearCards };
}
