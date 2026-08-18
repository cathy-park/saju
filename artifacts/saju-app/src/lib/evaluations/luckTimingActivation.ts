/**
 * 대운·세운 기반 활성화 가중(timing layer).
 * 원국 evaluations 점수는 변경하지 않고, 운 가중치만 더해 Now 점수·추세를 산출한다.
 */

import {
  type FiveElKey,
  CONTROLS,
  getController,
  getGenerator,
  STEM_TO_ELEMENT,
  BRANCH_TO_ELEMENT,
} from "../element-color";
import type { RelationshipWealthEvaluations } from "./relationshipWealthEvaluation";
import { computeBranchRelations } from "../branchRelations";

export type LuckActivationTrend = "상승" | "보통" | "하락";

export interface TimingActivationResult {
  officerActivationNow: number;
  wealthActivationNow: number;
  spousePalaceStabilityNow: number;
  officerActivationTrend: LuckActivationTrend;
  wealthActivationTrend: LuckActivationTrend;
  spouseActivationTrend: LuckActivationTrend;
}

function clamp100(n: number): number {
  return Math.max(0, Math.min(100, Math.round(n)));
}

function trendFromDelta(delta: number): LuckActivationTrend {
  if (delta >= 8) return "상승";
  if (delta <= -8) return "하락";
  return "보통";
}

function parsePillar(hangul: string | undefined): { stem?: string; branch?: string } {
  if (!hangul || hangul.length < 2) return {};
  return { stem: hangul[0], branch: hangul[1] };
}

function stemToEl(ch: string | undefined): FiveElKey | undefined {
  if (!ch) return undefined;
  return STEM_TO_ELEMENT[ch] as FiveElKey | undefined;
}

function branchToEl(ch: string | undefined): FiveElKey | undefined {
  if (!ch) return undefined;
  return BRANCH_TO_ELEMENT[ch] as FiveElKey | undefined;
}

/** 간지에서 stem·branch 오행 유니크 목록 */
function pillarElements(hangul: string | undefined): FiveElKey[] {
  const { stem, branch } = parsePillar(hangul);
  const a = stemToEl(stem);
  const b = branchToEl(branch);
  const out: FiveElKey[] = [];
  const seen = new Set<FiveElKey>();
  for (const e of [a, b]) {
    if (e && !seen.has(e)) {
      seen.add(e);
      out.push(e);
    }
  }
  return out;
}

// 월운·일운은 대운(10년)·세운(1년)보다 영향 지속 기간이 훨씬 짧아, 같은 가중치를 그대로
// 쓰면 과대평가된다 — 절반/그보다 낮은 비율로 깎아서 반영한다(유파마다 비율이 갈리는
// 부분이라 우선 정한 값이며, 필요시 조정 가능).
const WOLUN_SCALE = 0.5;
const ILUN_SCALE = 0.3;

function wealthWeightForPillar(
  hangul: string | undefined,
  wealthEl: FiveElKey,
  yongshin: FiveElKey,
  heesin: FiveElKey | undefined,
  gisin: FiveElKey | undefined,
  scale = 1,
): number {
  const els = pillarElements(hangul);
  if (els.length === 0) return 0;
  let w = 0;
  if (els.some((e) => e === wealthEl)) w += 12;
  if (els.some((e) => e === yongshin)) w += 10;
  if (heesin && els.some((e) => e === heesin)) w += 6;
  if (els.some((e) => e === getGenerator(wealthEl))) w += 6;
  if (els.some((e) => e === getController(wealthEl))) w -= 8;
  if (gisin && els.some((e) => e === gisin)) w -= 6;
  return w * scale;
}

function officerWeightForPillar(
  hangul: string | undefined,
  officerEl: FiveElKey,
  scale = 1,
): number {
  const els = pillarElements(hangul);
  if (els.length === 0) return 0;
  let w = 0;
  if (els.some((e) => e === officerEl)) w += 12;
  if (els.some((e) => e === getGenerator(officerEl))) w += 6;
  if (els.some((e) => e === getController(officerEl))) w -= 8;
  return w * scale;
}

function spouseLuckWeight(
  dayBranch: string | undefined,
  daewoonHangul: string | undefined,
  saeunHangul: string | undefined,
  wolunHangul?: string,
  ilunHangul?: string,
): number {
  if (!dayBranch) return 0;
  const { branch: dwB } = parsePillar(daewoonHangul);
  const { branch: seB } = parsePillar(saeunHangul);
  const { branch: woB } = parsePillar(wolunHangul);
  const { branch: ilB } = parsePillar(ilunHangul);
  let w = 0;
  const luckBranches = [
    dwB ? { branch: dwB, scale: 1 } : null,
    seB ? { branch: seB, scale: 1 } : null,
    woB ? { branch: woB, scale: WOLUN_SCALE } : null,
    ilB ? { branch: ilB, scale: ILUN_SCALE } : null,
  ].filter((b): b is { branch: string; scale: number } => !!b);

  for (const { branch: lb, scale } of luckBranches) {
    const rels = computeBranchRelations([dayBranch, lb]);
    for (const r of rels) {
      if (r.branch1 !== dayBranch && r.branch2 !== dayBranch) continue;
      const other = r.branch1 === dayBranch ? r.branch2 : r.branch1;
      if (other !== lb) continue;
      switch (r.type) {
        case "지지충":
          w -= 15 * scale;
          break;
        case "형":
          w -= 8 * scale;
          break;
        case "파":
          w -= 6 * scale;
          break;
        case "해":
          w -= 4 * scale;
          break;
        case "지지육합":
          w += 8 * scale;
          break;
        default:
          break;
      }
    }
  }

  const trio = [...new Set([dayBranch, dwB, seB, woB, ilB].filter((b): b is string => !!b))];
  if (trio.length >= 2) {
    const rels3 = computeBranchRelations(trio);
    for (const r of rels3) {
      if (r.type !== "지지삼합" && r.type !== "지지방합") continue;
      const touchesDay = r.branch1 === dayBranch || r.branch2 === dayBranch;
      const touchesLuck =
        (!!dwB && (r.branch1 === dwB || r.branch2 === dwB))
        || (!!seB && (r.branch1 === seB || r.branch2 === seB))
        || (!!woB && (r.branch1 === woB || r.branch2 === woB))
        || (!!ilB && (r.branch1 === ilB || r.branch2 === ilB));
      if (touchesDay && touchesLuck) {
        w += 6;
        break;
      }
    }
  }

  return w;
}

/**
 * @param baseEvaluations — computeRelationshipWealthEvaluations 결과(원국, 수정 금지)
 * @param currentDaewoon — 현재 대운 간지 한글 2글자 (예 "경오")
 * @param currentSaeun — 현재 세운 간지 한글 2글자 (예 "갑진")
 * @param dayStem — 일간
 * @param dayBranch — 일지
 * @param yongshin — 용신(억부 primary)
 * @param heesin — 희신(secondary, 없으면 undefined)
 * @param gisin — 기신 오행(없으면 용신을 극하는 오행으로 대체)
 * @param currentWolun — 선택된 월운 간지 한글 2글자(월운 탭 이상에서만 전달, 대운·세운의 절반 가중)
 * @param currentIlun — 선택된 일운 간지 한글 2글자(일운 탭에서만 전달, 대운·세운보다 더 낮은 가중)
 */
export function computeLuckTimingActivation(
  baseEvaluations: RelationshipWealthEvaluations,
  currentDaewoon: string | undefined,
  currentSaeun: string | undefined,
  dayStem: string,
  dayBranch: string | undefined,
  yongshin: FiveElKey,
  heesin?: FiveElKey,
  gisin?: FiveElKey,
  currentWolun?: string,
  currentIlun?: string,
): TimingActivationResult {
  const dmEl = STEM_TO_ELEMENT[dayStem] as FiveElKey | undefined;
  const effectiveGisin = gisin ?? (yongshin ? getController(yongshin) : undefined);

  const baseW = baseEvaluations.wealthActivation.score;
  const baseO = baseEvaluations.officerActivation.score;
  const baseS = baseEvaluations.spousePalaceStability.score;

  if (!dmEl) {
    return {
      officerActivationNow: clamp100(baseO),
      wealthActivationNow: clamp100(baseW),
      spousePalaceStabilityNow: clamp100(baseS),
      officerActivationTrend: "보통",
      wealthActivationTrend: "보통",
      spouseActivationTrend: "보통",
    };
  }

  const wealthEl = CONTROLS[dmEl];
  const officerEl = getController(dmEl);

  let wealthLuck =
    wealthWeightForPillar(currentDaewoon, wealthEl, yongshin, heesin, effectiveGisin)
    + wealthWeightForPillar(currentSaeun, wealthEl, yongshin, heesin, effectiveGisin)
    + wealthWeightForPillar(currentWolun, wealthEl, yongshin, heesin, effectiveGisin, WOLUN_SCALE)
    + wealthWeightForPillar(currentIlun, wealthEl, yongshin, heesin, effectiveGisin, ILUN_SCALE);

  let officerLuck =
    officerWeightForPillar(currentDaewoon, officerEl)
    + officerWeightForPillar(currentSaeun, officerEl)
    + officerWeightForPillar(currentWolun, officerEl, WOLUN_SCALE)
    + officerWeightForPillar(currentIlun, officerEl, ILUN_SCALE);

  const officerAppears =
    pillarElements(currentDaewoon).includes(officerEl)
    || pillarElements(currentSaeun).includes(officerEl)
    || pillarElements(currentWolun).includes(officerEl)
    || pillarElements(currentIlun).includes(officerEl);
  if (baseO < 40 && officerAppears) {
    officerLuck += 4;
  }

  const spouseLuck = spouseLuckWeight(dayBranch, currentDaewoon, currentSaeun, currentWolun, currentIlun);

  const wealthNow = clamp100(baseW + wealthLuck);
  const officerNow = clamp100(baseO + officerLuck);
  const spouseNow = clamp100(baseS + spouseLuck);

  // 추세는 clamp 전 운 기여(가중치 합)로 판정 — 상한 100으로 점수 차가 작아져도 운 방향 반영
  return {
    wealthActivationNow: wealthNow,
    officerActivationNow: officerNow,
    spousePalaceStabilityNow: spouseNow,
    wealthActivationTrend: trendFromDelta(wealthLuck),
    officerActivationTrend: trendFromDelta(officerLuck),
    spouseActivationTrend: trendFromDelta(spouseLuck),
  };
}
