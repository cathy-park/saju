/**
 * 커리어 활성도 (Career Activation) — 대운·세운 기반 timing layer.
 *
 * 기존 "관성 활성도"(officerActivationNow, luckTimingActivation.ts)는 관성 한 축만
 * 본다. 관성은 커리어를 구성하는 일부 요소일 뿐이고, 특히 여성 사주에서는 배우자성과도
 * 겹치므로 관성 활성도를 그대로 "커리어 활성도"로 표시하면 의미가 왜곡된다.
 *
 * 이 모듈은 원국 커리어 점수(structureDomains.career.score, 변경하지 않음)를 기준값으로
 * 두고, 커리어를 구성하는 세 축 — 식상(생산·표현) / 관성(조직·책임) / 인성(학습·전문성) —
 * 이 대운·세운에서 각각 얼마나 자극되는지를 격국(어느 축이 이 사람의 커리어 축인지)과
 * 용신·희신·기신 방향으로 가중해 합산한다. 원국 계산 요소(식상·관성·인성·격국·용신)는
 * 재사용만 하고 새로 만들지 않는다.
 */

import {
  type FiveElKey,
  GENERATES,
  getController,
  getGenerator,
  STEM_TO_ELEMENT,
  BRANCH_TO_ELEMENT,
} from "../element-color";

export type CareerActivationLevel = "높음" | "보통" | "낮음";
export type CareerActivationTrend = "상승" | "보통" | "하락";

export interface CareerActivationFactor {
  label: string;
  magnitude: number;
  direction: "우호" | "비우호" | "중립";
}

export interface CareerActivationResult {
  careerActivationNow: number;
  careerActivationLevel: CareerActivationLevel;
  careerActivationTrend: CareerActivationTrend;
  factors: CareerActivationFactor[];
  interpretation: string;
}

export interface CareerActivationContext {
  dayStem: string;
  /** structureDomains.career.score — 원국 커리어 점수. 여기서 재계산하지 않고 기준값으로만 사용 */
  baseCareerScore: number;
  /** interpretation.gukguk?.name — 어느 축(식상/관성/인성)이 이 사람의 커리어 중심인지 가중하는 데만 사용 */
  gukgukName?: string;
  daewoonHangul?: string;
  saeunHangul?: string;
  yongshin: FiveElKey;
  heesin?: FiveElKey;
  gisin?: FiveElKey;
}

type CareerGroup = "식상" | "관성" | "인성";
const CAREER_GROUP_LABEL: Record<CareerGroup, string> = {
  식상: "식상(생산·표현)",
  관성: "관성(조직·책임)",
  인성: "인성(학습·전문성)",
};
// 근거군별 상한 — 대운+세운 두 기둥이 같은 축을 동시에 강화해도 한 축이 무제한으로
// 불어나지 않도록 제한한다.
const GROUP_CAP = 24;

function clamp100(n: number): number {
  return Math.max(0, Math.min(100, Math.round(n)));
}

function trendFromDelta(delta: number): CareerActivationTrend {
  if (delta >= 8) return "상승";
  if (delta <= -8) return "하락";
  return "보통";
}

function levelFromScore(s: number): CareerActivationLevel {
  if (s >= 65) return "높음";
  if (s >= 35) return "보통";
  return "낮음";
}

function parsePillar(hangul: string | undefined): { stem?: string; branch?: string } {
  if (!hangul || hangul.length < 2) return {};
  return { stem: hangul[0], branch: hangul[1] };
}

function pillarElements(hangul: string | undefined): FiveElKey[] {
  const { stem, branch } = parsePillar(hangul);
  const a = stem ? (STEM_TO_ELEMENT[stem] as FiveElKey | undefined) : undefined;
  const b = branch ? (BRANCH_TO_ELEMENT[branch] as FiveElKey | undefined) : undefined;
  const out: FiveElKey[] = [];
  for (const e of [a, b]) if (e && !out.includes(e)) out.push(e);
  return out;
}

/** 일간 기준 커리어 3축의 오행. 식상=일간이 생하는 오행, 관성=일간을 극하는 오행, 인성=일간을 생하는 오행. */
function careerGroupElement(dm: FiveElKey, group: CareerGroup): FiveElKey {
  if (group === "식상") return GENERATES[dm];
  if (group === "관성") return getController(dm);
  return getGenerator(dm); // 인성
}

/** 격국명에서 어느 축이 이 사람의 커리어 중심축인지 읽어 가중치만 살짝 준다(격국 재계산 없음). */
function gukgukEmphasis(gukgukName: string | undefined): Record<CareerGroup, number> {
  const w: Record<CareerGroup, number> = { 식상: 1, 관성: 1, 인성: 1 };
  if (!gukgukName) return w;
  if (gukgukName.includes("식") || gukgukName.includes("상관")) w.식상 = 1.35;
  if (gukgukName.includes("관")) w.관성 = 1.35;
  if (gukgukName.includes("인")) w.인성 = 1.35;
  return w;
}

function groupWeightForPillar(
  hangul: string | undefined,
  groupEl: FiveElKey,
  yongshin: FiveElKey,
  heesin: FiveElKey | undefined,
  gisin: FiveElKey | undefined,
): number {
  const els = pillarElements(hangul);
  if (els.length === 0) return 0;
  let w = 0;
  if (els.some((e) => e === groupEl)) w += 10;
  if (els.some((e) => e === getGenerator(groupEl))) w += 5;
  if (els.some((e) => e === getController(groupEl))) w -= 6;
  if (els.some((e) => e === yongshin)) w += 4;
  if (heesin && els.some((e) => e === heesin)) w += 2;
  if (gisin && els.some((e) => e === gisin)) w -= 4;
  return w;
}

export function computeCareerActivation(ctx: CareerActivationContext): CareerActivationResult {
  const dmEl = STEM_TO_ELEMENT[ctx.dayStem] as FiveElKey | undefined;
  if (!dmEl) {
    return {
      careerActivationNow: clamp100(ctx.baseCareerScore),
      careerActivationLevel: levelFromScore(clamp100(ctx.baseCareerScore)),
      careerActivationTrend: "보통",
      factors: [],
      interpretation: "일간 정보가 없어 커리어 활성도를 계산할 수 없습니다.",
    };
  }

  const emphasis = gukgukEmphasis(ctx.gukgukName);
  const factors: CareerActivationFactor[] = [];
  const groupRaw: Record<CareerGroup, number> = { 식상: 0, 관성: 0, 인성: 0 };

  for (const group of ["식상", "관성", "인성"] as CareerGroup[]) {
    const groupEl = careerGroupElement(dmEl, group);
    for (const [luckLabel, hangul] of [["대운", ctx.daewoonHangul], ["세운", ctx.saeunHangul]] as const) {
      const w = groupWeightForPillar(hangul, groupEl, ctx.yongshin, ctx.heesin, ctx.gisin);
      if (w === 0) continue;
      const weighted = w * emphasis[group];
      groupRaw[group] += weighted;
      if (Math.abs(weighted) >= 3) {
        factors.push({
          label: `${luckLabel} ${hangul} → ${CAREER_GROUP_LABEL[group]} ${weighted > 0 ? "자극" : "억제"}`,
          magnitude: Math.round(Math.abs(weighted)),
          direction: weighted > 0 ? "우호" : "비우호",
        });
      }
    }
  }

  let totalDelta = 0;
  for (const group of ["식상", "관성", "인성"] as CareerGroup[]) {
    totalDelta += Math.max(-GROUP_CAP, Math.min(GROUP_CAP, groupRaw[group]));
  }

  const careerActivationNow = clamp100(ctx.baseCareerScore + totalDelta);
  const careerActivationLevel = levelFromScore(careerActivationNow);
  const careerActivationTrend = trendFromDelta(totalDelta);
  const interpretation = buildInterpretation(careerActivationLevel, careerActivationTrend);

  return { careerActivationNow, careerActivationLevel, careerActivationTrend, factors, interpretation };
}

function buildInterpretation(level: CareerActivationLevel, trend: CareerActivationTrend): string {
  if (level === "높음" && trend === "상승") {
    return "직업·프로젝트·역할과 관련된 움직임이 강하게 활성화되는 시기입니다. 새로운 역할 제안, 성과 평가, 조직 변화 등이 두드러질 수 있습니다.";
  }
  if (level === "높음") {
    return "커리어 관련 활동이 활발한 편입니다. 다만 상승 추세가 뚜렷하진 않아, 이미 쌓아온 흐름을 유지하는 성격이 강합니다.";
  }
  if (trend === "하락") {
    return "커리어 관련 자극이 잦아드는 흐름입니다. 새 확장보다는 내실을 다지거나 재정비하기 좋은 시기일 수 있습니다.";
  }
  if (level === "낮음") {
    return "직업·역할·조직 관련 이슈가 크게 부각되지 않는 평이한 시기입니다.";
  }
  return "커리어 관련 흐름은 무난한 수준입니다.";
}
