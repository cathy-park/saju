/**
 * 🏛️ 조직·책임(관성) 활성도 / 작동 방향 — 대운·세운 기반 timing layer.
 *
 * 기존 luckTimingActivation.ts의 officerActivationNow/officerActivationTrend는 문제가 있었다:
 *  - 관성 자체 등장(+12, 크기 신호)과 재생관/상관견관(+6/-8, 이미 방향이 섞인 신호)이 부호
 *    있는 델타 하나로 뭉쳐 있어서, "관성이 강하게 움직인다"와 "그 움직임이 유리하다"가
 *    구분되지 않았다.
 *  - 결정적으로 용신·희신·기신을 전혀 반영하지 않았다(wealthWeightForPillar는 반영하는데
 *    officerWeightForPillar는 officerEl 하나만 받음) — 관성이 이 사람에게 기신이라 실제로는
 *    통제·압박·과책임으로 나타나는 경우도 재생관/상관견관 구조만 없으면 그냥 "+12 상승"으로
 *    표시됐다.
 *
 * 이 모듈은 luckTimingActivation.ts의 officerActivationNow/Trend는 그대로 두고(다른 소비처
 * 호환 유지), 독립된 2축을 새로 계산한다:
 *  - 🏛️ 조직·책임 활성도: 관성 등장(방향 중립, 크기만) + 재생관/상관견관/용희신기신(방향은
 *    있지만 크기도 있는 evidence)를 모두 절댓값으로 합산 — "사건이 얼마나 크게 움직이는가"
 *  - ⚖️ 조직·책임 작동 방향: 위 evidence 중 방향이 있는 것만 부호 합산 — "그 움직임이
 *    직위·신뢰 쪽인지 통제·압박 쪽인지". 관성 등장 자체는 중립이라 방향에는 기여하지 않고,
 *    재생관(우호)과 기신 관성(비우호)이 같은 시기에 동시에 걸리면 서로 상충하는 evidence로
 *    남아 자연스럽게 상쇄된다(둘 중 하나를 임의로 삭제하지 않음).
 */

import {
  type FiveElKey,
  getController,
  getGenerator,
  STEM_TO_ELEMENT,
  BRANCH_TO_ELEMENT,
} from "../element-color";

export type OfficerLevel = "강함" | "보통" | "약함";
export type OfficerDirectionLevel = "우호 우세" | "중립" | "부담 우세";

export interface OfficerEvidenceFactor {
  label: string;
  magnitude: number;
  direction: "우호" | "비우호" | "중립";
}

export interface OfficerActivationResult {
  activationScore: number;
  activationLevel: OfficerLevel;
  directionScore: number;
  directionLevel: OfficerDirectionLevel;
  factors: OfficerEvidenceFactor[];
  interpretation: string;
}

export interface OfficerActivationContext {
  dayStem: string;
  daewoonHangul?: string;
  saeunHangul?: string;
  yongshin: FiveElKey;
  heesin?: FiveElKey;
  gisin?: FiveElKey;
}

/** 근거군별(등장/생조/극제/용신/희신/기신) 절댓값 상한 — 대운+세운·천간+지지가 겹쳐도 한
 * 근거군이 무제한으로 불어나지 않게 한다. */
const CATEGORY_CAP: Record<string, number> = {
  appearance: 18, // 관성 등장(크기만)
  generator: 12,  // 재생관
  controller: 14, // 상관견관
  yongheesin: 10, // 용신·희신 일치
  gisin: 10,      // 기신 일치
};

function clamp100(n: number): number {
  return Math.max(0, Math.min(100, Math.round(n)));
}

function activationLevelFromScore(s: number): OfficerLevel {
  if (s >= 65) return "강함";
  if (s >= 35) return "보통";
  return "약함";
}

function directionLevelFromScore(s: number): OfficerDirectionLevel {
  if (s >= 62) return "우호 우세";
  if (s <= 38) return "부담 우세";
  return "중립";
}

function parsePillar(hangul: string | undefined): { stem?: string; branch?: string } {
  if (!hangul || hangul.length < 2) return {};
  return { stem: hangul[0], branch: hangul[1] };
}

function charElement(kind: "천간" | "지지", ch: string | undefined): FiveElKey | undefined {
  if (!ch) return undefined;
  return (kind === "천간" ? STEM_TO_ELEMENT[ch] : BRANCH_TO_ELEMENT[ch]) as FiveElKey | undefined;
}

interface CategorizedFactor extends OfficerEvidenceFactor {
  category: keyof typeof CATEGORY_CAP;
}

function pushOfficerEvidence(
  factors: CategorizedFactor[],
  luckLabel: "대운" | "세운",
  charKind: "천간" | "지지",
  ch: string | undefined,
  officerEl: FiveElKey,
  yongshin: FiveElKey,
  heesin: FiveElKey | undefined,
  gisin: FiveElKey | undefined,
) {
  const el = charElement(charKind, ch);
  if (!el || !ch) return;
  const tag = `${luckLabel} ${charKind} ${ch}(${el})`;

  if (el === officerEl) {
    factors.push({ label: `${tag} — 관성 등장(사건 크기)`, magnitude: 12, direction: "중립", category: "appearance" });
  }
  if (el === getGenerator(officerEl)) {
    factors.push({ label: `${tag} — 재생관 구조(현실 성과가 지위로 연결)`, magnitude: 6, direction: "우호", category: "generator" });
  }
  if (el === getController(officerEl)) {
    factors.push({ label: `${tag} — 상관견관 구조(규율·권위와 충돌)`, magnitude: 8, direction: "비우호", category: "controller" });
  }
  if (el === yongshin) {
    factors.push({ label: `${tag} — 용신 일치`, magnitude: 6, direction: "우호", category: "yongheesin" });
  } else if (heesin && el === heesin) {
    factors.push({ label: `${tag} — 희신 일치`, magnitude: 3, direction: "우호", category: "yongheesin" });
  }
  if (gisin && el === gisin) {
    factors.push({ label: `${tag} — 기신 일치(부담·통제로 작용 가능)`, magnitude: 7, direction: "비우호", category: "gisin" });
  }
}

function axisTotal(factors: CategorizedFactor[], signed: boolean): number {
  const byCategory = new Map<string, number>();
  for (const f of factors) {
    const value = signed
      ? f.direction === "우호" ? f.magnitude : f.direction === "비우호" ? -f.magnitude : 0
      : f.magnitude;
    byCategory.set(f.category, (byCategory.get(f.category) ?? 0) + value);
  }
  let total = 0;
  for (const [category, sum] of byCategory) {
    const cap = CATEGORY_CAP[category];
    total += Math.max(-cap, Math.min(cap, sum));
  }
  return total;
}

export function computeOfficerActivation(ctx: OfficerActivationContext): OfficerActivationResult {
  const dmEl = STEM_TO_ELEMENT[ctx.dayStem] as FiveElKey | undefined;
  if (!dmEl) {
    return {
      activationScore: 0, activationLevel: "약함",
      directionScore: 50, directionLevel: "중립",
      factors: [],
      interpretation: "일간 정보가 없어 조직·책임 활성도를 계산할 수 없습니다.",
    };
  }
  const officerEl = getController(dmEl);
  const factors: CategorizedFactor[] = [];

  for (const [luckLabel, hangul] of [["대운", ctx.daewoonHangul], ["세운", ctx.saeunHangul]] as const) {
    const { stem, branch } = parsePillar(hangul);
    pushOfficerEvidence(factors, luckLabel, "천간", stem, officerEl, ctx.yongshin, ctx.heesin, ctx.gisin);
    pushOfficerEvidence(factors, luckLabel, "지지", branch, officerEl, ctx.yongshin, ctx.heesin, ctx.gisin);
  }

  const activationRaw = axisTotal(factors, false);
  const activationScore = clamp100(15 + activationRaw);
  const activationLevel = activationLevelFromScore(activationScore);

  const directionRaw = axisTotal(factors, true);
  const directionScore = clamp100(50 + directionRaw);
  const directionLevel = directionLevelFromScore(directionScore);

  const interpretation = buildInterpretation(activationLevel, directionLevel);

  return {
    activationScore, activationLevel, directionScore, directionLevel,
    factors: factors.map(({ label, magnitude, direction }) => ({ label, magnitude, direction })),
    interpretation,
  };
}

function buildInterpretation(activation: OfficerLevel, direction: OfficerDirectionLevel): string {
  if (activation === "약함") {
    return "조직·책임·직위 관련 이슈가 크게 부각되지 않는 평이한 시기입니다.";
  }
  if (activation === "강함" && direction === "우호 우세") {
    return "조직·책임 관련 사건이 강하게 움직이고 방향도 우호적이라, 직위·신뢰가 쌓이기 좋은 시기입니다.";
  }
  if (activation === "강함" && direction === "부담 우세") {
    return "조직·책임 관련 사건이 강하게 움직이지만 방향은 통제·압박 쪽에 가깝습니다. 과책임·규율과의 마찰에 유의가 필요한 시기입니다.";
  }
  if (activation === "강함") {
    return "조직·책임 관련 움직임이 강하지만 우호·부담 요인이 혼재해 방향이 뚜렷하지 않습니다. 아래 근거를 함께 참고하세요.";
  }
  if (direction === "부담 우세") {
    return "큰 사건은 아니지만 방향은 통제·압박 쪽에 가깝습니다. 무리한 책임 확대보다 현재 역할을 유지하는 편이 안전합니다.";
  }
  return "조직·책임 관련 흐름은 무난한 수준입니다.";
}
