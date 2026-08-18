/**
 * 🎯 합격운(시험·자격 / 채용·임용·조직 선발 / 공모·심사·발표형 선발) — 대운·세운 기반 timing layer.
 *
 * "합격운"을 단일 점수로 뭉치지 않고, 성립 조건이 서로 다른 세 서브타입을 내부적으로
 * 구분해서 각각 계산한다:
 *  - 시험·자격: 인성(공부·자격·문서) 중심 + 관성(발표·공적 인정) 보조
 *  - 채용·임용·조직 선발: 관성(직위·조직 편입) 중심 + 인성·식상(자격·준비/실무 성과) 보조
 *  - 공모·심사·발표형 선발: 식상·관성(제출물·심사 통과) 중심 + 인성(서류·자격) 보조
 *
 * 세 서브타입 모두 careerActivation.ts와 동일한 evidence 수집 방식(tenGodTimingEvidence의
 * pushTenGodGroupEvidence/diminishingAxisTotal)을 재사용하되, 최종 점수는 여기서 서브타입별로
 * 따로 가중한다 — careerActivation·officerActivation의 기존 점수를 그대로 합산하지 않는다.
 *
 * ── 관생인→인생신 연결 구조 + 일간 감당력 ──────────────────────────────────
 * 관성은 오행 순환상 항상 인성을 생한다(관인상생은 구조적으로 항상 성립). 실제로 의미 있는
 * 신호는 "그 시기에 관성과 인성이 함께 나타나는가"다 — 함께 나타나면 압박(관성)이 준비·자격
 * (인성)으로 이어지는 경로가 열린 것으로 보아 우호 evidence를 추가한다. 관성만 나타나고
 * 인성이 없으면, 일간이 그 압박을 감당할 여력이 있는지(신강/신약)에 따라 우호·비우호가
 * 갈린다 — 신약한 일간에 인성 지원 없는 관성은 부담으로, 신강한 일간은 감당 가능으로 본다.
 *
 * ── activation(활성도) vs direction(방향) 분리 ────────────────────────────
 * "합격 가능성이 높다"는 표현을 activation만으로 만들지 않는다. activation은 사건 크기(시험·
 * 선발 관련 이슈가 얼마나 부각되는가)이고, direction은 그 흐름이 우호적인지 경쟁·지연·부담
 * 쪽인지를 나타낸다. 두 값을 함께 참고해야 하며, interpretation 문구도 "합격 가능성 높음"
 * 같은 단정적 표현 대신 활성도·방향을 함께 서술한다.
 */

import {
  type FiveElKey,
  STEM_TO_ELEMENT,
} from "../element-color";
import type { StrengthLevel } from "../interpretSchema";
import {
  type TenGodEvidenceFactor,
  parsePillar,
  charElement,
  pushTenGodGroupEvidence,
  diminishingAxisTotal,
  tenGodGroupElement,
} from "./tenGodTimingEvidence";

export type ExamLevel = "강함" | "보통" | "약함";
export type ExamDirectionLevel = "우호 우세" | "중립" | "부담 우세";

export interface ExamEvidenceFactor {
  label: string;
  magnitude: number;
  direction: "우호" | "비우호" | "중립";
}

export interface ExamSubResult {
  activationScore: number;
  activationLevel: ExamLevel;
  directionScore: number;
  directionLevel: ExamDirectionLevel;
  factors: ExamEvidenceFactor[];
  interpretation: string;
}

export interface ExamCareerActivationResult {
  /** 시험·자격 — 인성 중심 + 관성 보조 */
  examCert: ExamSubResult;
  /** 채용·임용·조직 선발 — 관성 중심 + 인성·식상 보조 */
  hiring: ExamSubResult;
  /** 공모·심사·발표형 선발 — 식상·관성 중심 + 인성 보조 */
  competition: ExamSubResult;
  /** 일간 감당력(강약)에 대한 공통 참고 설명 — 세 서브타입 해석에 함께 참고 */
  dayMasterCapacityNote: string;
}

export interface ExamCareerActivationContext {
  dayStem: string;
  daewoonHangul?: string;
  saeunHangul?: string;
  /** 선택된 월운 간지(한글 2글자). 대운·세운의 절반 가중(WOLUN_SCALE)으로 반영 — 월별 조견표 계산용 */
  wolunHangul?: string;
  yongshin: FiveElKey;
  heesin?: FiveElKey;
  gisin?: FiveElKey;
  /** 일간 강약 — 관성 부담을 감당할 여력이 있는지 판단에만 사용(재계산하지 않음) */
  strengthLevel: StrengthLevel;
}

// 월운은 대운(10년)·세운(1년)보다 영향 지속 기간이 훨씬 짧아, 같은 가중치를 그대로 쓰면
// 과대평가된다 — spouseActivation.ts·luckTimingActivation.ts와 같은 비율로 깎아서 반영한다.
const WOLUN_SCALE = 0.5;

type ExamGroup = "인성" | "관성" | "식상" | "chain" | "capacity";
const CATEGORY_CAP = 28;

function activationLevelFromScore(s: number): ExamLevel {
  if (s >= 50) return "강함";
  if (s >= 35) return "보통";
  return "약함";
}

function directionLevelFromScore(s: number): ExamDirectionLevel {
  if (s >= 62) return "우호 우세";
  if (s <= 38) return "부담 우세";
  return "중립";
}

const WEAK_LEVELS: StrengthLevel[] = ["극신약", "태약", "신약"];
const STRONG_LEVELS: StrengthLevel[] = ["신강", "태강", "극신강"];

/** 서브타입별 인성/관성/식상 가중치 — "중심"은 1.0에 가깝게, "보조"는 절반 이하로 */
const SUBTYPE_EMPHASIS: Record<"examCert" | "hiring" | "competition", Partial<Record<ExamGroup, number>>> = {
  examCert:    { 인성: 1.0, 관성: 0.5, chain: 1.0, capacity: 0.8 },
  hiring:      { 관성: 1.0, 인성: 0.5, 식상: 0.5, chain: 0.8, capacity: 1.0 },
  competition: { 식상: 1.0, 관성: 0.9, 인성: 0.5, chain: 0.6, capacity: 0.7 },
};

function computeSubResult(
  factorsAll: TenGodEvidenceFactor<ExamGroup>[],
  emphasis: Partial<Record<ExamGroup, number>>,
  buildText: (activation: ExamLevel, direction: ExamDirectionLevel) => string,
): ExamSubResult {
  // 이 서브타입에서 가중치가 0인 그룹은 아예 제외(예: 시험·자격에는 식상 미반영)
  const scoped = factorsAll
    .filter((f) => (emphasis[f.category] ?? 0) > 0)
    .map((f) => ({ ...f, magnitude: Math.round(f.magnitude * (emphasis[f.category] ?? 0)) }))
    .filter((f) => f.magnitude > 0);

  const activationRaw = diminishingAxisTotal(scoped, false, CATEGORY_CAP);
  const activationScore = Math.max(0, Math.min(100, Math.round(15 + activationRaw)));
  const activationLevel = activationLevelFromScore(activationScore);

  const directionRaw = diminishingAxisTotal(scoped, true, CATEGORY_CAP);
  const directionScore = Math.max(0, Math.min(100, Math.round(50 + directionRaw)));
  const directionLevel = directionLevelFromScore(directionScore);

  return {
    activationScore, activationLevel, directionScore, directionLevel,
    factors: scoped.map(({ label, magnitude, direction }) => ({ label, magnitude, direction })),
    interpretation: buildText(activationLevel, directionLevel),
  };
}

export function computeExamCareerActivation(ctx: ExamCareerActivationContext): ExamCareerActivationResult {
  const dmEl = STEM_TO_ELEMENT[ctx.dayStem] as FiveElKey | undefined;
  const emptySub: ExamSubResult = {
    activationScore: 0, activationLevel: "약함",
    directionScore: 50, directionLevel: "중립",
    factors: [],
    interpretation: "일간 정보가 없어 합격운을 계산할 수 없습니다.",
  };
  if (!dmEl) {
    return { examCert: emptySub, hiring: emptySub, competition: emptySub, dayMasterCapacityNote: "" };
  }

  const seongEl = tenGodGroupElement(dmEl, "인성");
  const gwanEl = tenGodGroupElement(dmEl, "관성");
  const sikEl = tenGodGroupElement(dmEl, "식상");

  const factors: TenGodEvidenceFactor<ExamGroup>[] = [];

  const points: Array<{ label: "대운" | "세운" | "월운"; stem?: string; branch?: string; scale: number }> = [
    { label: "대운", ...parsePillar(ctx.daewoonHangul), scale: 1 },
    { label: "세운", ...parsePillar(ctx.saeunHangul), scale: 1 },
    { label: "월운", ...parsePillar(ctx.wolunHangul), scale: WOLUN_SCALE },
  ];

  // ① 인성·관성·식상 각각의 등장/생조/극제/용희신·기신 evidence (careerActivation과 동일 우선순위 로직 재사용)
  for (const [group, groupEl, label] of [
    ["인성", seongEl, "인성(공부·자격·문서)"],
    ["관성", gwanEl, "관성(발표·공적 인정)"],
    ["식상", sikEl, "식상(실무 성과·제출물)"],
  ] as const) {
    for (const p of points) {
      for (const [kind, ch] of [["천간", p.stem], ["지지", p.branch]] as const) {
        const el = charElement(kind, ch);
        if (!el || !ch) continue;
        const tag = `${p.label} ${kind} ${ch}(${el}) → ${label}`;
        pushTenGodGroupEvidence(factors, tag, group, el, groupEl, ctx.yongshin, ctx.heesin, ctx.gisin, p.scale);
      }
    }
  }

  // ② 관생인→인생신 연결 구조 + 일간 감당력 — 대운·세운 각 기둥 단위로 판정
  const isWeak = WEAK_LEVELS.includes(ctx.strengthLevel);
  const isStrong = STRONG_LEVELS.includes(ctx.strengthLevel);
  let anyOfficerFound = false;
  let anyChainFound = false;
  for (const p of points) {
    const els = [charElement("천간", p.stem), charElement("지지", p.branch)].filter(Boolean) as FiveElKey[];
    const officerPresent = els.includes(gwanEl);
    const sealPresent = els.includes(seongEl);
    if (!officerPresent) continue;
    anyOfficerFound = true;
    if (sealPresent) {
      anyChainFound = true;
      factors.push({
        label: `${p.label} 관성·인성 동시 출현 — 관생인→인생신 연결 구조(압박이 자격·준비로 이어짐)`,
        magnitude: Math.round(8 * p.scale), direction: "우호", category: "chain",
      });
    } else if (isWeak) {
      factors.push({
        label: `${p.label} 관성만 출현(인성 지원 없음) — 일간이 약해 감당하기 버거운 부담`,
        magnitude: Math.round(6 * p.scale), direction: "비우호", category: "capacity",
      });
    } else if (isStrong) {
      factors.push({
        label: `${p.label} 관성 출현, 일간이 강해 감당할 여력 있음`,
        magnitude: Math.round(4 * p.scale), direction: "우호", category: "capacity",
      });
    }
  }

  const dayMasterCapacityNote = !anyOfficerFound
    ? "이 시기에는 관성 자극이 뚜렷하지 않습니다."
    : anyChainFound
      ? "관성과 인성이 함께 나타나, 압박이 준비·자격으로 이어질 수 있는 시기입니다."
      : isWeak
        ? "관성이 나타나지만 인성의 뒷받침이 없고 일간도 약해, 부담이 크게 느껴질 수 있는 시기입니다."
        : isStrong
          ? "관성이 나타나지만 일간이 강해 그 압박을 감당할 여력이 있는 시기입니다."
          : "관성이 나타나지만 인성의 뒷받침은 약한 시기입니다.";

  const examCert = computeSubResult(factors, SUBTYPE_EMPHASIS.examCert, (a, d) =>
    buildExamInterpretation("시험·자격", a, d));
  const hiring = computeSubResult(factors, SUBTYPE_EMPHASIS.hiring, (a, d) =>
    buildExamInterpretation("채용·임용·조직 선발", a, d));
  const competition = computeSubResult(factors, SUBTYPE_EMPHASIS.competition, (a, d) =>
    buildExamInterpretation("공모·심사·발표형 선발", a, d));

  return { examCert, hiring, competition, dayMasterCapacityNote };
}

function buildExamInterpretation(label: string, activation: ExamLevel, direction: ExamDirectionLevel): string {
  if (activation === "약함") {
    return `이 시기는 ${label} 관련 이슈가 크게 부각되지 않는 평이한 흐름입니다.`;
  }
  if (activation === "강함" && direction === "우호 우세") {
    return `${label} 관련 사건이 강하게 움직이고 방향도 우호적입니다. 다만 활성도가 높다는 것은 관련 이슈가 크게 부각된다는 뜻이지, 그 자체로 합격·선발을 의미하지 않습니다 — 준비 상태와 함께 참고하세요.`;
  }
  if (activation === "강함" && direction === "부담 우세") {
    return `${label} 관련 사건이 강하게 움직이지만 방향은 경쟁·지연·부담 쪽에 가깝습니다. 준비 과정에서 마찰이나 예상보다 높은 난이도에 대비가 필요한 시기입니다.`;
  }
  if (activation === "강함") {
    return `${label} 관련 움직임이 강하지만 우호·부담 요인이 혼재해 방향이 뚜렷하지 않습니다. 아래 근거를 함께 참고하세요.`;
  }
  if (direction === "부담 우세") {
    return `큰 사건은 아니지만 방향은 경쟁·부담 쪽에 가깝습니다. 무리한 도전보다 준비를 다지는 편이 안전합니다.`;
  }
  return `${label} 관련 흐름은 무난한 수준입니다.`;
}
