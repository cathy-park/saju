// 사주 월별운세 핵심 요약(10단계) — 이미 계산된 computeSajuPipeline()의 timing activation
// 결과(careerActivation/wealthActivation/officerActivation/examCareerActivation/
// contractActivation/timingActivation/spouseActivation)만 재구성한다. 새 점수·새 판정 로직은
// 만들지 않는다(대표 지시). 9단계(sajuSummaryFacts.ts)와 같은 ReportFact/SajuEvidenceItem
// 타입을 그대로 재사용해, [왜 이런 결과인가요?] 토글(SajuCoreSummary.tsx의 SajuEvidenceToggle)도
// 새로 만들지 않고 그대로 쓴다 — factors[] 모양 차이는 이 파일의 adapter(factorsEvidence/
// detectTimingSource)가 흡수한다.
//
// [반드시 지킬 구분 — 대표 지시]
//  1) careerActivation/wealthActivation/officerActivation은 daewoon+saeun만 반영하고 실제로는
//     선택한 월운에 반응하지 않는다(엔진 확인됨) — 이 셋에서 나온 문장은 항상 "(대운·세운 흐름
//     기준)"으로 명시하고 "이번 달" 결론으로 쓰지 않는다. "이번 달" 결론은 실제로 월운을 반영하는
//     timingActivation/examCareerActivation/contractActivation(+spouseActivation, 월운 반영됨)
//     중심으로 구성한다.
//  2) 서로 다른 activation 객체의 magnitude/activationScore는 척도가 달라(그룹별 cap·가중치가
//     모듈마다 다름) 직접 비교하지 않는다. "한눈에 보기"의 대표 축 선정과 "주의할 점"의 근거
//     선택 모두, 각 객체 자신의 categorical level(강함/약함, 우호 우세/부담 우세 등)과 실제
//     월운 반응 여부만으로 고르고, 숫자 크기로 순위를 매기지 않는다.
//  3) activationLevel/activationScore(강함/보통/약함, 높음/낮음)는 "사건이 크게 움직이는가"일
//     뿐 "좋은가"가 아니므로 그 자체를 positive/risk로 매핑하지 않는다(neutral 유지). 방향
//     판정은 오직 이미 방향을 담은 필드(directionLevel/inflowLevel/profitabilityLevel/
//     stabilityLevel)에서만 가져온다.
import type { SajuPipelineResult } from "./sajuPipeline";
import type { ExamSubResult } from "./evaluations/examCareerActivation";
import { type ReportFact, type Polarity } from "./reportFacts";
import { type SajuEvidenceItem } from "./sajuSummaryFacts";

export type SajuMonthlyFact = ReportFact<SajuEvidenceItem>;

export type SajuMonthlySectionKey = "atAGlance" | "workCareer" | "wealth" | "romanceRelationship" | "cautions";

export interface SajuMonthlySummarySection {
  key: SajuMonthlySectionKey;
  title: string;
  /** deterministic 합성 문단 — 화면에 그대로 노출된다. */
  text: string;
  /** hasFacts 판정과 [왜 이런 결과인가요?] 토글 근거로 쓰이는 fact 목록. */
  facts: SajuMonthlyFact[];
  /** [왜 이런 결과인가요?] 토글용 근거 — 원국/대운/세운/월운 출처가 구분된다. */
  evidence: SajuEvidenceItem[];
}

type DirectionalLevel = "우호 우세" | "중립" | "부담 우세" | "유리" | "보통" | "불리" | "안정" | "불안정";
const DIRECTIONAL_POLARITY: Partial<Record<DirectionalLevel, Polarity>> = {
  "우호 우세": "positive", "부담 우세": "risk", "중립": "neutral",
  "유리": "positive", "불리": "risk", "보통": "neutral",
  "안정": "positive", "불안정": "risk",
};
/** directionLevel/inflowLevel/profitabilityLevel/stabilityLevel처럼 이미 방향을 담은 필드만
 * 넘긴다 — activationLevel(강함/보통/약함, 높음/낮음)은 절대 이 함수에 넘기지 않는다(대표 지시
 * #3: 활성도는 방향이 아니다). */
function directionalPolarity(level: string): Polarity {
  return DIRECTIONAL_POLARITY[level as DirectionalLevel] ?? "neutral";
}

const TREND_PLAIN: Record<"상승" | "보통" | "하락", string> = {
  상승: "커지는 흐름",
  하락: "잦아드는 흐름",
  보통: "평소와 비슷한 흐름",
};

/** factors[] 라벨은 이미 "대운 지지 인(목)→...", "월운 천간...", "배우자궁 세운 충..." 처럼
 * 어느 시점(대운/세운/월운)에서 나온 근거인지 원문 안에 그대로 담고 있다(엔진이 이미 쓴 문자열,
 * 새로 만들지 않음) — 이 함수는 그 문자열에서 출처만 읽어내는 순수 adapter다. 여러 시점이
 * 동시에 언급되면(예: "대운·세운 복음") 더 최신 시점을 우선한다(월운>세운>대운), 아무 시점도
 * 없으면 원국 배경 정보로 본다. */
function detectTimingSource(label: string): SajuEvidenceItem["category"] {
  if (label.includes("월운")) return "wolun";
  if (label.includes("세운")) return "saeun";
  if (label.includes("대운")) return "daewoon";
  return "natal";
}

function factorsEvidence(factors: { label: string }[]): SajuEvidenceItem[] {
  return factors.map((f) => ({ category: detectTimingSource(f.label), label: f.label }));
}

function fact(domain: string, meaning: string, polarity: Polarity, evidence: SajuEvidenceItem[]): SajuMonthlyFact {
  return { id: `${domain}-${evidence.map((e) => e.label).join("|") || meaning}`, domain, meaning, polarity, strength: 1, evidence };
}

function normalizeSentence(text: string): string {
  const trimmed = text.trim();
  return /[.!?]$/.test(trimmed) ? trimmed : `${trimmed}.`;
}

function synthesizeMonthlySection(facts: SajuMonthlyFact[]): { text: string; evidence: SajuEvidenceItem[] } {
  return {
    text: facts.map((f) => normalizeSentence(f.meaning)).join(" "),
    evidence: facts.flatMap((f) => f.evidence),
  };
}

const EXAM_SUBTYPE_LABEL: Record<"examCert" | "hiring" | "competition", string> = {
  examCert: "시험·자격",
  hiring: "채용·선발",
  competition: "공모·심사",
};

function examSubResults(pipeline: SajuPipelineResult): [keyof typeof EXAM_SUBTYPE_LABEL, ExamSubResult][] {
  return [
    ["examCert", pipeline.examCareerActivation.examCert],
    ["hiring", pipeline.examCareerActivation.hiring],
    ["competition", pipeline.examCareerActivation.competition],
  ];
}

/** "이번 달 한눈에 보기" — 실제로 월운에 반응하는 축(contract/exam/spouse/timingActivation
 * trend)만 후보로 두고, 각 축 자신의 categorical level이 "뚜렷한지"만 보고 고른다(대표 지시
 * #2: 모듈 간 magnitude 비교 금지). 후보 우선순위(계약→합격→배우자→트렌드)는 숫자 비교가
 * 아니라 고정 나열 순서이며, 최대 2개까지만 메인에 쓴다. */
function buildAtAGlanceFacts(pipeline: SajuPipelineResult): SajuMonthlyFact[] {
  const candidates: SajuMonthlyFact[] = [];

  const contract = pipeline.contractActivation;
  if (contract.activationLevel !== "약함") {
    candidates.push(fact(
      "contract-highlight",
      `계약·거래 관련 사건이 이번 달 뚜렷하게 움직이는 편입니다(방향: ${contract.directionLevel}).`,
      directionalPolarity(contract.directionLevel),
      factorsEvidence(contract.factors),
    ));
  }

  const notableExam = examSubResults(pipeline).find(([, r]) => r.activationLevel === "강함")
    ?? examSubResults(pipeline).find(([, r]) => r.activationLevel !== "약함");
  if (notableExam) {
    const [key, r] = notableExam;
    candidates.push(fact(
      "exam-highlight",
      `${EXAM_SUBTYPE_LABEL[key]} 관련 흐름이 이번 달 눈에 띄게 움직입니다.`,
      directionalPolarity(r.directionLevel),
      factorsEvidence(r.factors),
    ));
  }

  if (pipeline.spouseActivation && pipeline.spouseActivation.activationLevel !== "낮음") {
    candidates.push(fact(
      "spouse-highlight",
      "연애·배우자 관련 테마가 이번 달 활발하게 움직이는 편입니다.",
      "neutral",
      factorsEvidence(pipeline.spouseActivation.factors),
    ));
  }

  const timing = pipeline.timingActivation;
  if (timing.wealthActivationTrend !== "보통") {
    candidates.push(fact(
      "wealth-trend-highlight",
      `재물 관련 자극이 최근 대비 ${TREND_PLAIN[timing.wealthActivationTrend]} 있습니다.`,
      "neutral",
      [{ category: "wolun", label: `재물 활성도(Now) ${timing.wealthActivationNow}점, 추세 ${timing.wealthActivationTrend}` }],
    ));
  }
  if (timing.officerActivationTrend !== "보통") {
    candidates.push(fact(
      "officer-trend-highlight",
      `조직·책임 관련 자극이 최근 대비 ${TREND_PLAIN[timing.officerActivationTrend]} 있습니다.`,
      "neutral",
      [{ category: "wolun", label: `관성 활성도(Now) ${timing.officerActivationNow}점, 추세 ${timing.officerActivationTrend}` }],
    ));
  }

  if (candidates.length === 0) {
    return [fact("no-highlight", "이번 달은 특별히 강하게 움직이는 영역 없이 무난하게 흘러가는 시기입니다.", "neutral", [])];
  }
  return candidates.slice(0, 2);
}

/** "일·커리어" — career/officerActivation은 대운·세운 배경으로 명시하고, "이번 달" 결론은
 * examCareerActivation(월운 반영됨)에서만 가져온다. */
function buildWorkCareerFacts(pipeline: SajuPipelineResult): SajuMonthlyFact[] {
  const { careerActivation: career, officerActivation: officer } = pipeline;
  const facts: SajuMonthlyFact[] = [
    fact(
      "career-background",
      `(대운·세운 흐름 기준) ${career.interpretation} ${officer.interpretation}`,
      directionalPolarity(career.directionLevel),
      [...factorsEvidence(career.factors), ...factorsEvidence(officer.factors)],
    ),
  ];

  const notableExam = examSubResults(pipeline).find(([, r]) => r.activationLevel !== "약함");
  if (notableExam) {
    const [key, r] = notableExam;
    facts.push(fact(
      "exam-monthly",
      `(이번 달 기준) ${EXAM_SUBTYPE_LABEL[key]} 관련: ${r.interpretation}`,
      directionalPolarity(r.directionLevel),
      factorsEvidence(r.factors),
    ));
  } else {
    facts.push(fact(
      "exam-monthly-none",
      "(이번 달 기준) 시험·채용·선발과 관련해 특별히 강하게 움직이는 이슈는 없습니다.",
      "neutral",
      [],
    ));
  }
  return facts;
}

/** "재물" — wealthActivation은 대운·세운 배경으로 명시하고, "이번 달" 결론은
 * timingActivation.wealthActivationTrend(월운 반영됨)와 contractActivation(월운 반영됨,
 * 계약·거래 관점)에서 가져온다. */
function buildWealthFacts(pipeline: SajuPipelineResult): SajuMonthlyFact[] {
  const { wealthActivation: wealth, timingActivation: timing, contractActivation: contract } = pipeline;

  const facts: SajuMonthlyFact[] = [
    fact("wealth-background", `(대운·세운 흐름 기준) ${wealth.interpretation}`, directionalPolarity(wealth.inflowLevel), factorsEvidence(wealth.factors)),
    fact(
      "wealth-monthly-trend",
      timing.wealthActivationTrend === "보통"
        ? "(이번 달 기준) 재물 관련 자극은 평소와 비슷한 수준입니다."
        : `(이번 달 기준) 재물 관련 자극이 최근 대비 ${TREND_PLAIN[timing.wealthActivationTrend]} 있습니다.`,
      "neutral",
      [{ category: "wolun", label: `재물 활성도(Now) ${timing.wealthActivationNow}점, 추세 ${timing.wealthActivationTrend}` }],
    ),
  ];

  if (contract.activationLevel !== "약함") {
    const docNote = contract.hasDocumentationEvidence ? "" : " 다만 문서·검토 단계 근거는 약해 체결을 단정하기는 이릅니다.";
    facts.push(fact(
      "contract-monthly",
      `(이번 달 계약·거래 관점) ${contract.interpretation}${docNote}`,
      directionalPolarity(contract.profitabilityLevel),
      factorsEvidence(contract.factors),
    ));
  }
  return facts;
}

/** "연애·관계" — spouseActivation은 대운·세운·월운을 모두 반영하므로(엔진 확인됨) 배경/이번 달을
 * 나누지 않고 그대로 "이번 달 기준"으로 쓴다. 성별 정보가 없어 spouseActivation이 없으면 이
 * 섹션은 빈 facts를 반환한다(화면에는 기존 "근거가 부족합니다" fallback으로 표시됨). */
function buildRomanceFacts(pipeline: SajuPipelineResult): SajuMonthlyFact[] {
  if (!pipeline.spouseActivation) return [];
  const spouse = pipeline.spouseActivation;
  const timing = pipeline.timingActivation;

  const facts: SajuMonthlyFact[] = [
    fact("spouse-monthly", `(이번 달 기준) ${spouse.interpretation}`, "neutral", factorsEvidence(spouse.factors)),
  ];
  if (timing.spouseActivationTrend !== "보통") {
    facts.push(fact(
      "spouse-trend",
      `배우자궁 안정도가 최근 대비 ${TREND_PLAIN[timing.spouseActivationTrend]} 있습니다(현재 안정도 참고치 ${timing.spousePalaceStabilityNow}점).`,
      "neutral",
      [{ category: "wolun", label: `배우자궁 안정도(Now) ${timing.spousePalaceStabilityNow}점, 추세 ${timing.spouseActivationTrend}` }],
    ));
  }
  return facts;
}

interface CautionSource {
  key: string;
  riskLabel: string;
  level: string;
  factors: { label: string; direction: "우호" | "비우호" | "중립" }[];
}

/** "주의할 점" — 모듈 간 magnitude 비교 없이, 각 축이 "자기 자신의" directionLevel/inflowLevel/
 * profitabilityLevel/stabilityLevel로 이미 부담·불리·불안정 신호를 낸 경우에만 그 축 내부에서
 * 비우호 factor 하나를 월운→세운→대운 우선순위로 인용한다. 최대 3개까지만 메인에 쓰고, 하나도
 * 없으면 "특별히 주의할 신호 없음"으로 명시한다. */
function buildCautionFacts(pipeline: SajuPipelineResult): SajuMonthlyFact[] {
  const sources: CautionSource[] = [
    { key: "career", riskLabel: "커리어(대운·세운 배경)", level: pipeline.careerActivation.directionLevel, factors: pipeline.careerActivation.factors },
    { key: "officer", riskLabel: "조직·책임(대운·세운 배경)", level: pipeline.officerActivation.directionLevel, factors: pipeline.officerActivation.factors },
    { key: "wealth-inflow", riskLabel: "재물 유입(대운·세운 배경)", level: pipeline.wealthActivation.inflowLevel, factors: pipeline.wealthActivation.factors },
    { key: "wealth-stability", riskLabel: "재물 안정성(대운·세운 배경)", level: pipeline.wealthActivation.stabilityLevel, factors: pipeline.wealthActivation.factors },
    { key: "contract-direction", riskLabel: "계약 체결(이번 달)", level: pipeline.contractActivation.directionLevel, factors: pipeline.contractActivation.factors },
    { key: "contract-profit", riskLabel: "계약 수익성(이번 달)", level: pipeline.contractActivation.profitabilityLevel, factors: pipeline.contractActivation.factors },
    { key: "exam-cert", riskLabel: "시험·자격(이번 달)", level: pipeline.examCareerActivation.examCert.directionLevel, factors: pipeline.examCareerActivation.examCert.factors },
    { key: "exam-hiring", riskLabel: "채용·선발(이번 달)", level: pipeline.examCareerActivation.hiring.directionLevel, factors: pipeline.examCareerActivation.hiring.factors },
    { key: "exam-competition", riskLabel: "공모·심사(이번 달)", level: pipeline.examCareerActivation.competition.directionLevel, factors: pipeline.examCareerActivation.competition.factors },
  ];
  if (pipeline.spouseActivation) {
    sources.push({
      key: "spouse-stability",
      riskLabel: "배우자궁 안정성(이번 달)",
      level: pipeline.spouseActivation.stabilityLevel,
      factors: pipeline.spouseActivation.factors,
    });
  }

  const facts: SajuMonthlyFact[] = [];
  for (const src of sources) {
    if (facts.length >= 3) break;
    if (directionalPolarity(src.level) !== "risk") continue;
    const risky = src.factors.filter((f) => f.direction === "비우호");
    if (risky.length === 0) continue;
    const pick = risky.find((f) => detectTimingSource(f.label) === "wolun")
      ?? risky.find((f) => detectTimingSource(f.label) === "saeun")
      ?? risky[0];
    facts.push(fact(
      `caution-${src.key}`,
      `${src.riskLabel} 쪽에서 부담 신호가 있습니다 — ${pick.label}.`,
      "risk",
      factorsEvidence(risky),
    ));
  }

  if (facts.length === 0) {
    return [fact("no-caution", "이번 시기에 특별히 주의할 만큼 부담이 큰 신호는 없습니다.", "neutral", [])];
  }
  return facts;
}

export function buildSajuMonthlySections(pipeline: SajuPipelineResult): SajuMonthlySummarySection[] {
  const sections: [SajuMonthlySectionKey, string, SajuMonthlyFact[]][] = [
    ["atAGlance", "이번 달 한눈에 보기", buildAtAGlanceFacts(pipeline)],
    ["workCareer", "일·커리어", buildWorkCareerFacts(pipeline)],
    ["wealth", "재물", buildWealthFacts(pipeline)],
    ["romanceRelationship", "연애·관계", buildRomanceFacts(pipeline)],
    ["cautions", "주의할 점", buildCautionFacts(pipeline)],
  ];

  return sections.map(([key, title, facts]) => {
    const { text, evidence } = synthesizeMonthlySection(facts);
    return { key, title, text, facts, evidence };
  });
}
