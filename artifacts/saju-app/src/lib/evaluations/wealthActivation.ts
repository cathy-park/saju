/**
 * 재물 타이밍 3축 (Wealth Activation) — 대운·세운 기반, 원국 재물 점수와 분리.
 *
 * 기존 luckTimingActivation.ts의 wealthActivationNow는 다음 두 가지 문제가 있었다:
 *  1) `clamp100(원국 재물 종합점수 + 이 해의 델타)` 구조라, 원국 점수가 높은 사람은
 *     이 해가 실제로 나빠도 원국 base가 델타를 덮어버려 점수가 잘 안 떨어진다.
 *  2) 델타 계산에 지지 충·형·파·해·원진이 전혀 반영되지 않는다(computeBranchRelations를
 *     한 번도 호출하지 않음) — "재성 충", "재고 형충" 같은 손실 신호가 원천적으로 안 보인다.
 *
 * 이 모듈은 원국 재물 구조(고정 체질)와 연도별 timing(그 해의 흐름)을 분리하고, 3축으로 나눈다:
 *  - 📈 재물 유입도: 방향성 있는 점수. 재성·식상생재·용신/희신 유입은 +, 겁재·재성 뿌리
 *    훼손(충형파해원진)·기신 유입은 -로 반영한다.
 *  - 💰 재물 활성도: 방향 무관, 위 근거들의 크기(절댓값) 합 — "돈 관련 사건이 크다"는 뜻이지
 *    "좋다"는 뜻이 아니다.
 *  - 🏦 재물 안정·축적도: 원국 축적력(accumulationScore)을 제한된 calibration(±20)으로만
 *    반영하고, 이 해의 대운·세운 지지가 "재물 관련 지지"(재성이 뿌리내린 지지·재고 지지)를
 *    충·형·파·해·원진하는지를 새로 체크한다. 일지라는 이유만으로 재물 근거로 쓰지 않는다
 *    — 배우자궁 충은 spouseActivation.ts의 몫이다.
 */

import {
  type FiveElKey,
  CONTROLS,
  getGenerator,
  STEM_TO_ELEMENT,
  BRANCH_TO_ELEMENT,
} from "../element-color";
import { computeBranchRelations } from "../branchRelations";
import { branchCarriesWealth } from "./structureDomainScores";

export type WealthInflowLevel = "유리" | "보통" | "불리";
export type WealthMagnitudeLevel = "높음" | "보통" | "낮음";
export type WealthStabilityLevel = "안정" | "보통" | "불안정";

export interface WealthActivationFactor {
  label: string;
  /** 유입도 계산용 부호 있는 기여값(우호 +, 비우호 -) */
  signedMagnitude: number;
  direction: "우호" | "비우호" | "중립";
}

export interface WealthActivationResult {
  inflowScore: number;
  inflowLevel: WealthInflowLevel;
  activationScore: number;
  activationLevel: WealthMagnitudeLevel;
  stabilityScore: number;
  stabilityLevel: WealthStabilityLevel;
  factors: WealthActivationFactor[];
  interpretation: string;
}

export interface WealthActivationContext {
  dayStem: string;
  /** 원국 4개 지지(연·월·일·시) — 재물 관련 지지(재성 뿌리·재고)를 찾기 위함 */
  allBranches: string[];
  daewoonHangul?: string;
  saeunHangul?: string;
  yongshin: FiveElKey;
  heesin?: FiveElKey;
  gisin?: FiveElKey;
  /** structureDomains.wealth.wealthAxes.accumulationScore — 원국 축적력. 직접 base로 쓰지 않고
   * 제한된 calibration(최대 ±20)으로만 안정·축적도에 반영한다. */
  natalAccumulationScore: number;
}

/** 12운성 묘고(墓庫) — 4개 저장 지지만 존재하는 단순화된 표(토는 별도 고 없음, 논쟁적이라 제외) */
const WEALTH_VAULT_BRANCH_FOR_ELEMENT: Partial<Record<FiveElKey, string>> = {
  수: "진",
  목: "미",
  화: "술",
  금: "축",
};

function clamp100(n: number): number {
  return Math.max(0, Math.min(100, Math.round(n)));
}

function stabilityLevelFromScore(s: number): WealthStabilityLevel {
  if (s >= 65) return "안정";
  if (s >= 35) return "보통";
  return "불안정";
}

function activationLevelFromScore(s: number): WealthMagnitudeLevel {
  if (s >= 65) return "높음";
  if (s >= 35) return "보통";
  return "낮음";
}

function parsePillar(hangul: string | undefined): { stem?: string; branch?: string } {
  if (!hangul || hangul.length < 2) return {};
  return { stem: hangul[0], branch: hangul[1] };
}

function charElement(kind: "천간" | "지지", ch: string | undefined): FiveElKey | undefined {
  if (!ch) return undefined;
  return (kind === "천간" ? STEM_TO_ELEMENT[ch] : BRANCH_TO_ELEMENT[ch]) as FiveElKey | undefined;
}

/** 이 사람의 원국에서 "재물 관련 지지"(재성이 뿌리내린 지지 + 재고 지지)만 골라낸다. 일지는 자동 포함되지 않는다. */
function wealthRelatedBranches(allBranches: string[], wealthEl: FiveElKey): string[] {
  const vault = WEALTH_VAULT_BRANCH_FOR_ELEMENT[wealthEl];
  return [...new Set(allBranches)].filter(
    (b) => branchCarriesWealth(b, wealthEl) || b === vault,
  );
}

export function computeWealthActivation(ctx: WealthActivationContext): WealthActivationResult {
  const dmEl = STEM_TO_ELEMENT[ctx.dayStem] as FiveElKey | undefined;
  if (!dmEl) {
    return {
      inflowScore: 50, inflowLevel: "보통",
      activationScore: 0, activationLevel: "낮음",
      stabilityScore: clamp100(ctx.natalAccumulationScore),
      stabilityLevel: stabilityLevelFromScore(clamp100(ctx.natalAccumulationScore)),
      factors: [],
      interpretation: "일간 정보가 없어 재물 timing을 계산할 수 없습니다.",
    };
  }

  const wealthEl = CONTROLS[dmEl];
  const factors: WealthActivationFactor[] = [];

  const { stem: dwStem, branch: dwBranch } = parsePillar(ctx.daewoonHangul);
  const { stem: seStem, branch: seBranch } = parsePillar(ctx.saeunHangul);
  const points: Array<{ label: "대운" | "세운"; stem?: string; branch?: string }> = [
    { label: "대운", stem: dwStem, branch: dwBranch },
    { label: "세운", stem: seStem, branch: seBranch },
  ];

  // ① 재성·식상생재·용신·희신 유입(우호) / 겁재·기신 유입(비우호) — 천간·지지 분리 판정
  for (const p of points) {
    for (const [kind, ch] of [["천간", p.stem], ["지지", p.branch]] as const) {
      const el = charElement(kind, ch);
      if (!el || !ch) continue;
      const tag = `${p.label} ${kind} ${ch}(${el})`;
      if (el === wealthEl) {
        factors.push({ label: `${tag} — 재성 유입`, signedMagnitude: 12, direction: "우호" });
      } else if (el === getGenerator(wealthEl)) {
        factors.push({ label: `${tag} — 식상생재(재성을 생하는 기운) 유입`, signedMagnitude: 6, direction: "우호" });
      }
      if (el === ctx.yongshin) {
        factors.push({ label: `${tag} — 용신 유입`, signedMagnitude: 8, direction: "우호" });
      } else if (ctx.heesin && el === ctx.heesin) {
        factors.push({ label: `${tag} — 희신 유입`, signedMagnitude: 5, direction: "우호" });
      }
      if (el === dmEl) {
        factors.push({ label: `${tag} — 비겁(겁재 계열) 유입, 재물 분산·경쟁`, signedMagnitude: 10, direction: "비우호" });
      }
      if (ctx.gisin && el === ctx.gisin) {
        factors.push({ label: `${tag} — 기신 유입`, signedMagnitude: 7, direction: "비우호" });
      }
    }
  }

  // ② 이 해의 대운·세운 지지가 "재물 관련 지지"(재성 뿌리·재고)를 충·형·파·해·원진/육합하는지
  //    — 일지는 그 자체로 재물 근거가 아니라, 재성이 뿌리내렸거나 재고일 때만 대상에 포함된다.
  const wealthBranches = wealthRelatedBranches(ctx.allBranches, wealthEl);
  for (const wb of wealthBranches) {
    for (const p of points) {
      if (!p.branch) continue;
      const rels = computeBranchRelations([wb, p.branch]);
      for (const r of rels) {
        if (r.branch1 !== wb && r.branch2 !== wb) continue;
        const other = r.branch1 === wb ? r.branch2 : r.branch1;
        if (other !== p.branch) continue;
        const tag = `${p.label} ${p.branch} → 재물 지지 ${wb}`;
        switch (r.type) {
          case "지지충":
            factors.push({ label: `${tag} 충 — 재성 뿌리 훼손`, signedMagnitude: 15, direction: "비우호" });
            break;
          case "형":
            factors.push({ label: `${tag} 형 — 재성 뿌리 훼손`, signedMagnitude: 8, direction: "비우호" });
            break;
          case "파":
            factors.push({ label: `${tag} 파 — 재성 뿌리 흔들림`, signedMagnitude: 5, direction: "비우호" });
            break;
          case "해":
            factors.push({ label: `${tag} 해 — 재성 뿌리 흔들림`, signedMagnitude: 4, direction: "비우호" });
            break;
          case "원진":
            factors.push({ label: `${tag} 원진 — 재성 뿌리 흔들림`, signedMagnitude: 4, direction: "비우호" });
            break;
          case "지지육합":
            factors.push({ label: `${tag} 합 — 재물 뿌리 결속`, signedMagnitude: 6, direction: "우호" });
            break;
          default:
            break;
        }
      }
    }
  }

  // ── 3축 산출 ──────────────────────────────────────────────────────
  // 📈 유입도: 방향 있는 순합
  const inflowRaw = factors.reduce((sum, f) => sum + (f.direction === "우호" ? f.signedMagnitude : f.direction === "비우호" ? -f.signedMagnitude : 0), 0);
  const inflowScore = clamp100(50 + inflowRaw);

  // 💰 활성도: 방향 무관 절댓값 합(스포츠 활성도와 동일 패턴, 기본값 15)
  const activationRaw = factors.reduce((sum, f) => sum + Math.abs(f.signedMagnitude), 0);
  const activationScore = clamp100(15 + activationRaw);

  // 🏦 안정·축적도: 원국 축적력은 "제한된 calibration"으로만(50 기준 최대 ±20), 이 해의 재물
  // 지지 충형 신호가 훨씬 크게 반영되도록 설계 — 원국이 연도 흐름을 덮어버리던 기존 버그의 핵심 수정.
  const natalCalibration = Math.max(-20, Math.min(20, (ctx.natalAccumulationScore - 50) * 0.4));
  const stabilityDelta = factors.reduce((sum, f) => {
    if (!f.label.includes("재물 지지")) return sum; // ②(재물 지지 충형해원진/합)만 안정축적에 반영
    return sum + (f.direction === "우호" ? f.signedMagnitude : f.direction === "비우호" ? -f.signedMagnitude : 0);
  }, 0);
  // 겁재 유입은 안정·축적에도 훼손 신호로 소폭 반영(유입 방해뿐 아니라 지키기도 어려워짐)
  const geobDelta = factors
    .filter((f) => f.label.includes("비겁(겁재 계열)"))
    .reduce((sum, f) => sum - f.signedMagnitude * 0.4, 0);
  const stabilityScore = clamp100(50 + natalCalibration + stabilityDelta + geobDelta);

  const inflowLevel: WealthInflowLevel = inflowScore >= 62 ? "유리" : inflowScore <= 38 ? "불리" : "보통";
  const activationLevel = activationLevelFromScore(activationScore);
  const stabilityLevel = stabilityLevelFromScore(stabilityScore);

  const interpretation = buildWealthInterpretation(activationLevel, inflowLevel, stabilityLevel);

  return { inflowScore, inflowLevel, activationScore, activationLevel, stabilityScore, stabilityLevel, factors, interpretation };
}

function buildWealthInterpretation(
  activation: WealthMagnitudeLevel,
  inflow: WealthInflowLevel,
  stability: WealthStabilityLevel,
): string {
  if (activation === "낮음") {
    return "이 해는 돈과 관련된 사건·거래가 크게 움직이지 않는 평이한 시기입니다.";
  }
  if (activation === "높음" && inflow === "유리" && stability === "안정") {
    return "돈의 움직임이 크고 들어오는 방향도 유리하며, 실제로 남기기도 좋은 시기입니다.";
  }
  if (activation === "높음" && inflow === "불리" && stability === "불안정") {
    return "돈과 관련된 사건·거래가 크게 움직이지만 들어오는 방향도 불리하고 남기기도 어려운 시기 — 지출·손실·분산에 주의가 필요합니다.";
  }
  if (activation === "높음" && stability === "불안정") {
    return "돈의 움직임은 매우 크지만 실제로 남기는 힘은 약한 해입니다. 유입이 있어도 지출·손실·분산으로 빠져나가기 쉬우니 지키는 전략이 필요합니다.";
  }
  if (activation === "높음" && inflow === "불리") {
    return "재물 관련 사건은 크게 움직이는데 유입 방향은 불리한 편입니다. 지출·손실 쪽 사건일 가능성에 대비하세요.";
  }
  if (stability === "안정" && activation !== "높음") {
    return "큰 재물 사건은 적지만 기존 자산을 안정적으로 지키기 쉬운 시기입니다.";
  }
  return "재물 활성도, 유입 방향, 안정·축적도를 함께 참고해서 이 해의 재물 흐름 성격을 판단하세요.";
}
