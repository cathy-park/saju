/**
 * 커플 관계 상호작용 활성도 (Relationship Interaction Activation).
 *
 * 개인별 배우자·결혼 활성도/배우자궁 안정도(spouseActivation.ts)와는 독립된 축 —
 * 특정 연도의 대운·세운이 "두 사람 사이의 관계 자체"를 얼마나 활성화·조화·충돌시키는지
 * 계산한다. 새 판정 로직을 만들지 않고, 지지/천간 관계는 branchRelations.ts를,
 * 개인별 연도 활성도·안정도는 spouseActivation.ts(computeSpouseActivationByYearRange)를
 * 그대로 재사용한다.
 *
 * 3축:
 *  - 관계 활성도: 사건·감정·결단이 얼마나 강하게 움직이는가(방향 무관, 근거 크기의 합)
 *  - 관계 조화도: 그 움직임이 서로 가까워지는 방향인지 충돌 방향인지(중립 50에서 가감)
 *  - 관계 안정도: 관계가 성립했을 때 얼마나 지속적으로 유지하기 쉬운가
 *
 * 활성도가 높다고 재회·결혼으로 단정하지 않도록, interpretation은 항상 조화도·개인별
 * 활성도 방향을 함께 언급한다.
 *
 * ── evidence ledger ──────────────────────────────────────────────────
 * 점수를 바로 더하지 않고, 모든 판정을 RelationshipInteractionFactor(evidence)로 먼저
 * 쌓은 뒤 axis(활성/조화/안정) × category별로 재사용한다. UI·clipboard 모두 이 factors
 * 배열을 그대로 읽으므로 화면과 복사 데이터가 항상 같은 근거를 보여준다.
 *
 * ── axis 분리 원칙 ───────────────────────────────────────────────────
 * - 개인 배우자 활성도 동시 상승(personalActivationSync) → axis: activation만
 * - 개인 배우자궁 안정도 동조(personalStabilitySync)     → axis: stability만
 * - 합/용희신 보완 → harmony +, 충형파해원진/기신 강화 → harmony -
 * - 배우자궁 직접 충·형 → stability -, 배우자궁 관련 신규/기존 합 구조 완성 → stability +
 * - 복음(대운·세운 동일 간지) → axis: activation만(중립), harmony/stability는 별도 근거가 결정
 *
 * ── category cap ─────────────────────────────────────────────────────
 * 같은 구조가 여러 경로로 중복 탐지돼 점수가 무제한으로 불어나지 않도록, axis 합산 전에
 * evidence category별로 절댓값 상한을 적용한다(CATEGORY_CAPS).
 *
 * ── 항목 3 vs 7 중복 방지 ────────────────────────────────────────────
 * item①(pushSpousePalaceStrikes)이 배우자궁↔상대 개별 luck point의 육합·충·형·파·해·원진을
 * 전담하고, 삼합·방합(3지 구조)은 여기서 다루지 않는다(default:break). item③/⑦은 오직
 * 삼합·방합만 다루며, "원국에 이미 있던 교차 구조가 강화(③, natalCross 있음)"와
 * "원국에는 없던 새 구조가 이번 운으로 생성(⑦, natalCross 없음)"을 배타적 gate로 나눠
 * 같은 사건이 두 항목에서 동시에 잡히지 않는다. 육합·충 형태의 "신규 구조"는 애초에
 * 대운·세운이 있어야만 성립하는 item①이 이미 전담하므로 ⑦에서 다시 만들지 않는다.
 */

import { type FiveElKey, STEM_TO_ELEMENT, BRANCH_TO_ELEMENT } from "../element-color";
import { computeBranchRelations, computeStemRelations } from "../branchRelations";
import {
  computeSpouseActivationByYearRange,
  type SpouseActivationYearEntry,
  type SpouseActivationYearRangeContext,
} from "./spouseActivation";
import type { DaewoonEntry } from "../luckCycles";
import { getYearGanZhi } from "../luckCycles";

export type InteractionLevel = "높음" | "보통" | "낮음";
export type HarmonyDirection = "조화" | "중립" | "충돌";
export type StabilityLevel = "안정" | "보통" | "불안정";
export type ProgressReadinessLevel = "매우 낮음" | "낮음" | "보통" | "높음" | "매우 높음";
export type EvidenceAxis = "activation" | "harmony" | "stability";
export type EvidenceCategory =
  | "spousePalaceStrike"       // ① 배우자궁 직접 합·충·형·파·해·원진
  | "stemCross"                 // ② 세운·대운 천간 ↔ 상대 일간 합·충
  | "existingCrossReinforced"   // ③ 기존 원국 교차 구조가 삼합·방합으로 강화
  | "newCrossFormed"            // ⑦ 원국엔 없던 삼합·방합 구조가 신규 형성
  | "yongshinGisinCross"        // ④ 용신·희신 보완 / 기신 강화
  | "personalActivationSync"    // ⑤ 개인 배우자 활성도 동조
  | "personalStabilitySync"     // ⑥ 개인 배우자궁 안정도 동조
  | "doubleBrightness";         // 복음(대운·세운 동일 간지)

export interface RelationshipInteractionFactor {
  /** 화면에 그대로 노출할 짧은 근거 설명. 예: "A 세운 → B 배우자궁 충 (오·자)" */
  label: string;
  /** 근거 크기(항상 양수, category cap 적용 전 원값) */
  magnitude: number;
  direction: "우호" | "비우호" | "중립";
  /** 이 근거가 실제로 반영되는 축(복수 가능) — 축별 재사용/재계산의 기준 */
  axis: EvidenceAxis[];
  /** category cap 적용 단위 */
  category: EvidenceCategory;
  /** 어느 사람/관계에서 나온 근거인지 */
  source: string;
  /** 원국에 이미 있던 구조가 강화된 것인지, 이번 운으로 새로 생긴 구조인지 */
  structureOrigin: "기존" | "신규" | "해당없음";
}

export interface RelationshipInteractionResult {
  activationScore: number;
  activationLevel: InteractionLevel;
  harmonyScore: number;
  harmonyDirection: HarmonyDirection;
  stabilityScore: number;
  stabilityLevel: StabilityLevel;
  factors: RelationshipInteractionFactor[];
  interpretation: string;
  /**
   * '관계 진전 여건' — 새 명리 계산이 아니라 위 3축 + 두 사람 개인 배우자 활성도를
   * 조합한 파생 판정(derived interpretation)이다. 통계적 확률이 아니므로 %로 쓰지 않는다.
   * "관계 사건이 강하다"(activation)와 "연애·결혼으로 진전될 여건이 좋다"(progressReadiness)는
   * 서로 다른 질문이라는 것을 UI/clipboard 모두에서 분리해서 보여주기 위한 필드.
   */
  progressReadinessLevel: ProgressReadinessLevel;
  /** 판정에 실제로 쓰인 근거 문장(오름/내림 요인 모두 포함) */
  progressReadinessReasons: string[];
  /** 진전 여건 판정에 대한 해설 문장 */
  progressReadinessNote: string;
  /** 두 사람 모두 개인 활성도가 낮고 커플 활성도도 낮은 "관계 저활성" 시기인지 */
  isLowActivityPeriod: boolean;
}

// 근거군별 절댓값 상한 — 같은 구조가 여러 경로로 잡혀도 한 카테고리가 점수를 과도하게
// 끌어올리지 못하게 막는다. 값은 각 카테고리에서 현실적으로 동시에 발생 가능한 근거
// 개수 × 개별 magnitude를 감안해 여유 있게, 그러나 무제한은 아니게 설정했다.
const CATEGORY_CAPS: Record<EvidenceCategory, number> = {
  spousePalaceStrike: 30,
  stemCross: 20,
  existingCrossReinforced: 20,
  newCrossFormed: 20,
  yongshinGisinCross: 24,
  personalActivationSync: 12,
  personalStabilitySync: 20,
  doubleBrightness: 8,
};

function clamp100(n: number): number {
  return Math.max(0, Math.min(100, Math.round(n)));
}

function activationLevelFromScore(s: number): InteractionLevel {
  if (s >= 65) return "높음";
  if (s >= 35) return "보통";
  return "낮음";
}

function harmonyDirectionFromScore(s: number): HarmonyDirection {
  if (s >= 62) return "조화";
  if (s <= 38) return "충돌";
  return "중립";
}

function stabilityLevelFromScore(s: number): StabilityLevel {
  if (s >= 65) return "안정";
  if (s >= 35) return "보통";
  return "불안정";
}

function parsePillar(hangul: string | undefined): { stem?: string; branch?: string } {
  if (!hangul || hangul.length < 2) return {};
  return { stem: hangul[0], branch: hangul[1] };
}

/** calculateDaewoon(...)의 원본 배열을 나이 보정한다(spouseActivation.ts의 방식과 동일). */
function adjustDaewoon(daewoon: DaewoonEntry[]): DaewoonEntry[] {
  const dw0 = daewoon[0]?.startAge ?? 0;
  return daewoon.map((entry, i) => ({
    ...entry,
    startAge: dw0 + i * 10,
    endAge: dw0 + i * 10 + 9,
  }));
}

export interface PersonInteractionContext {
  name: string;
  dayStem: string;
  dayBranch?: string;
  yongshin: FiveElKey;
  heesin?: FiveElKey;
  gisin?: FiveElKey;
  birthYear: number;
  /** calculateLuckCycles(...).daewoon — 나이 보정 전 원본 배열 */
  daewoon: DaewoonEntry[];
}

interface LuckPoint {
  label: "대운" | "세운";
  hangul: string;
  branch: string;
  stem: string;
}

function luckPointsFor(daewoonHangul: string | undefined, saeunHangul: string): LuckPoint[] {
  const points: LuckPoint[] = [];
  if (daewoonHangul && daewoonHangul.length >= 2) {
    points.push({ label: "대운", hangul: daewoonHangul, branch: daewoonHangul[1], stem: daewoonHangul[0] });
  }
  points.push({ label: "세운", hangul: saeunHangul, branch: saeunHangul[1], stem: saeunHangul[0] });
  return points;
}

/** ① 한 사람의 대운·세운 지지가 상대방 배우자궁(일지)을 합·충·형·파·해·원진하는지(2지 관계만). */
function pushSpousePalaceStrikes(
  factors: RelationshipInteractionFactor[],
  sourceName: string,
  sourcePoints: LuckPoint[],
  targetName: string,
  targetBranch: string | undefined,
) {
  if (!targetBranch) return;
  for (const p of sourcePoints) {
    const rels = computeBranchRelations([targetBranch, p.branch]);
    for (const r of rels) {
      if (r.branch1 !== targetBranch && r.branch2 !== targetBranch) continue;
      const other = r.branch1 === targetBranch ? r.branch2 : r.branch1;
      if (other !== p.branch) continue;
      const tag = `${sourceName} ${p.label} → ${targetName} 배우자궁`;
      const source = `${sourceName}${p.label}→${targetName}배우자궁`;
      switch (r.type) {
        case "지지충":
          factors.push({ label: `${tag} 충 (${targetBranch}·${p.branch})`, magnitude: 15, direction: "비우호", axis: ["activation", "harmony", "stability"], category: "spousePalaceStrike", source, structureOrigin: "해당없음" });
          break;
        case "형":
          factors.push({ label: `${tag} 형 (${targetBranch}·${p.branch})`, magnitude: 8, direction: "비우호", axis: ["activation", "harmony", "stability"], category: "spousePalaceStrike", source, structureOrigin: "해당없음" });
          break;
        case "파":
          factors.push({ label: `${tag} 파 (${targetBranch}·${p.branch})`, magnitude: 6, direction: "비우호", axis: ["activation", "harmony"], category: "spousePalaceStrike", source, structureOrigin: "해당없음" });
          break;
        case "해":
          factors.push({ label: `${tag} 해 (${targetBranch}·${p.branch})`, magnitude: 5, direction: "비우호", axis: ["activation", "harmony"], category: "spousePalaceStrike", source, structureOrigin: "해당없음" });
          break;
        case "원진":
          factors.push({ label: `${tag} 원진 (${targetBranch}·${p.branch})`, magnitude: 5, direction: "비우호", axis: ["activation", "harmony"], category: "spousePalaceStrike", source, structureOrigin: "해당없음" });
          break;
        case "지지육합":
          factors.push({ label: `${tag} 합 (${targetBranch}·${p.branch})`, magnitude: 9, direction: "우호", axis: ["activation", "harmony", "stability"], category: "spousePalaceStrike", source, structureOrigin: "해당없음" });
          break;
        default:
          // 지지삼합/지지방합(3지 구조)은 여기서 다루지 않는다 — pushCrossGroupStructures 전담(항목 3/7 중복 방지).
          break;
      }
    }
  }
}

/**
 * ④ 근거 헬퍼 — 대운/세운의 천간 한 글자 또는 지지 한 글자가 상대의 용신·희신·기신 중
 * 무엇에 해당하는지 개별 판정한다. 천간·지지를 분리해서 호출하므로, 천간은 희신을
 * 지지는 기신을 건드리는 경우에도 "어느 글자가 원인인지"가 라벨에 그대로 드러난다.
 */
function pushYongshinGisinForChar(
  factors: RelationshipInteractionFactor[],
  sourceName: string,
  target: PersonInteractionContext,
  luckLabel: "대운" | "세운",
  charKind: "천간" | "지지",
  char: string | undefined,
) {
  if (!char) return;
  const el = charKind === "천간" ? (STEM_TO_ELEMENT[char] as FiveElKey | undefined) : (BRANCH_TO_ELEMENT[char] as FiveElKey | undefined);
  if (!el) return;
  const tag = `${sourceName} ${luckLabel} ${charKind} ${char}(${el})`;
  const source = `${sourceName}${luckLabel}${charKind}(${char})`;
  if (el === target.yongshin) {
    factors.push({ label: `${tag} → ${target.name} 용신 보완`, magnitude: 6, direction: "우호", axis: ["activation", "harmony"], category: "yongshinGisinCross", source, structureOrigin: "해당없음" });
  } else if (target.heesin && el === target.heesin) {
    factors.push({ label: `${tag} → ${target.name} 희신 보완`, magnitude: 4, direction: "우호", axis: ["activation", "harmony"], category: "yongshinGisinCross", source, structureOrigin: "해당없음" });
  }
  if (target.gisin && el === target.gisin) {
    factors.push({ label: `${tag} → ${target.name} 기신 강화`, magnitude: 6, direction: "비우호", axis: ["activation", "harmony"], category: "yongshinGisinCross", source, structureOrigin: "해당없음" });
  }
}

/** ② 한 사람의 세운·대운 천간이 상대방 일간과 천간합/충을 이루는지. */
function pushStemCrossRelations(
  factors: RelationshipInteractionFactor[],
  sourceName: string,
  sourcePoints: LuckPoint[],
  targetName: string,
  targetDayStem: string | undefined,
) {
  if (!targetDayStem) return;
  for (const p of sourcePoints) {
    if (p.stem === targetDayStem) continue;
    const rels = computeStemRelations([targetDayStem, p.stem]);
    for (const r of rels) {
      const tag = `${sourceName} ${p.label} 천간(${p.stem}) ↔ ${targetName} 일간`;
      const source = `${sourceName}${p.label}천간↔${targetName}일간`;
      const magnitude = p.label === "세운" ? 7 : 6;
      if (r.type === "천간합") factors.push({ label: `${tag} 합`, magnitude, direction: "우호", axis: ["activation", "harmony"], category: "stemCross", source, structureOrigin: "해당없음" });
      if (r.type === "천간충") factors.push({ label: `${tag} 충`, magnitude, direction: "비우호", axis: ["activation", "harmony"], category: "stemCross", source, structureOrigin: "해당없음" });
    }
  }
}

/**
 * ③+⑦ 두 사람의 배우자궁(일지)이 얽힌 삼합·방합(3지 구조)이 이번 운으로 강화/신규 형성되는지.
 * natalCross(두 원국 일지 사이에 이미 관계가 있었는지)로 "기존 강화(③)"와 "신규 형성(⑦)"을
 * 배타적으로 가른다 — 같은 연도의 같은 구조가 두 카테고리에 동시에 잡히지 않는다.
 * 육합·충(2지 관계)은 pushSpousePalaceStrikes(①)가 이미 전담하므로 여기서 다시 만들지 않는다.
 */
function pushCrossGroupStructures(
  factors: RelationshipInteractionFactor[],
  a: PersonInteractionContext,
  b: PersonInteractionContext,
  aPoints: LuckPoint[],
  bPoints: LuckPoint[],
) {
  if (!a.dayBranch || !b.dayBranch) return;
  const natalCross = computeBranchRelations([a.dayBranch], [b.dayBranch]);
  const hasNatalRelation = natalCross.length > 0;

  const combined = [...new Set([a.dayBranch, b.dayBranch, ...aPoints.map((p) => p.branch), ...bPoints.map((p) => p.branch)])];
  const rels = computeBranchRelations(combined);
  for (const r of rels) {
    if (r.type !== "지지삼합" && r.type !== "지지방합") continue;
    const touchesA = r.branch1 === a.dayBranch || r.branch2 === a.dayBranch;
    const touchesB = r.branch1 === b.dayBranch || r.branch2 === b.dayBranch;
    if (!(touchesA || touchesB)) continue; // 두 원국 배우자궁 중 하나를 가로지르는 구조만 채택
    const isPartial = r.description.includes("흐름");
    const magnitude = isPartial ? 6 : 10;
    if (hasNatalRelation) {
      factors.push({
        label: `${a.name}·${b.name} 배우자궁 교차 기존 구조 강화 (${r.description})`,
        magnitude,
        direction: "우호",
        axis: ["activation", "harmony", "stability"],
        category: "existingCrossReinforced",
        source: `${a.name}·${b.name} 배우자궁 교차`,
        structureOrigin: "기존",
      });
    } else {
      factors.push({
        label: `${a.name}·${b.name} 배우자궁 사이 신규 구조 형성 (${r.description})`,
        magnitude,
        direction: "우호",
        axis: ["activation", "harmony", "stability"],
        category: "newCrossFormed",
        source: `${a.name}·${b.name} 배우자궁 교차`,
        structureOrigin: "신규",
      });
    }
  }
}

/**
 * @param a, b — 두 사람의 기본 정보(용신·희신·기신·대운 등)
 * @param year — 계산할 연도
 * @param aSpouseYear, bSpouseYear — computeSpouseActivationByYearRange로 이미 계산된 개인별 결과 중 해당 연도 항목(재계산하지 않고 재사용)
 */
export function computeRelationshipInteractionForYear(
  a: PersonInteractionContext,
  b: PersonInteractionContext,
  year: number,
  aSpouseYear: SpouseActivationYearEntry | undefined,
  bSpouseYear: SpouseActivationYearEntry | undefined,
): RelationshipInteractionResult {
  const factors: RelationshipInteractionFactor[] = [];

  const ageA = year - a.birthYear;
  const ageB = year - b.birthYear;
  const dwA = adjustDaewoon(a.daewoon).find((d) => ageA >= d.startAge && ageA <= d.endAge);
  const dwB = adjustDaewoon(b.daewoon).find((d) => ageB >= d.startAge && ageB <= d.endAge);
  const seYear = getYearGanZhi(year);

  const aPoints = luckPointsFor(dwA?.ganZhi.hangul, seYear.hangul);
  const bPoints = luckPointsFor(dwB?.ganZhi.hangul, seYear.hangul);

  // ① 배우자궁(일지) 교차 자극(2지 관계)
  pushSpousePalaceStrikes(factors, a.name, aPoints, b.name, b.dayBranch);
  pushSpousePalaceStrikes(factors, b.name, bPoints, a.name, a.dayBranch);

  // ② 세운·대운 천간 ↔ 상대 일간 합·충
  pushStemCrossRelations(factors, a.name, aPoints, b.name, b.dayStem);
  pushStemCrossRelations(factors, b.name, bPoints, a.name, a.dayStem);

  // ③+⑦ 배우자궁이 얽힌 삼합·방합 — 기존 구조 강화 vs 신규 형성을 배타적으로 판정
  pushCrossGroupStructures(factors, a, b, aPoints, bPoints);

  // ④ 한 사람의 운 천간·지지가 상대의 용신·희신을 보완하거나 기신을 강화하는지.
  // 천간·지지를 한데 묶어 "오행이"라고만 쓰면, 천간은 희신을 지지는 기신을 건드리는 경우
  // 같은 대운에 대해 "희신 보완"과 "기신 강화"가 동시에 떠서 모순처럼 보인다 — 어느 글자가
  // 원인인지 천간/지지를 나눠 명시한다.
  for (const [source, target] of [[a, b], [b, a]] as const) {
    const points = source === a ? aPoints : bPoints;
    for (const p of points) {
      pushYongshinGisinForChar(factors, source.name, target, p.label, "천간", p.stem);
      pushYongshinGisinForChar(factors, source.name, target, p.label, "지지", p.branch);
    }
  }

  // ⑤ 두 사람의 개인별 배우자·결혼 활성도가 동시에 높은지 — activation 축에만 반영(harmony 자동 가산 금지)
  const aActLevel: InteractionLevel = aSpouseYear?.activation.activationLevel ?? "낮음";
  const bActLevel: InteractionLevel = bSpouseYear?.activation.activationLevel ?? "낮음";
  const aActHigh = aActLevel === "높음";
  const bActHigh = bActLevel === "높음";
  if (aActHigh && bActHigh) {
    factors.push({ label: `${a.name}·${b.name} 모두 개인 배우자·결혼 활성도 동시 상승`, magnitude: 12, direction: "중립", axis: ["activation"], category: "personalActivationSync", source: "개인 활성도 동조", structureOrigin: "해당없음" });
  } else if (aActHigh || bActHigh) {
    const who = aActHigh ? a.name : b.name;
    factors.push({ label: `${who}만 개인 배우자·결혼 활성도 상승(한쪽 신호)`, magnitude: 5, direction: "중립", axis: ["activation"], category: "personalActivationSync", source: "개인 활성도 동조", structureOrigin: "해당없음" });
  }

  // ⑥ 두 사람의 배우자궁 안정도가 동시에 안정/불안정한지 — stability 축에만 반영(harmony 자동 가산 금지)
  const aStab = aSpouseYear?.activation.stabilityScore ?? 50;
  const bStab = bSpouseYear?.activation.stabilityScore ?? 50;
  const aStabLevel = aSpouseYear?.activation.stabilityLevel ?? "보통";
  const bStabLevel = bSpouseYear?.activation.stabilityLevel ?? "보통";
  if (aStabLevel === "안정" && bStabLevel === "안정") {
    factors.push({ label: `${a.name}·${b.name} 모두 배우자궁 안정도 동시 안정`, magnitude: 10, direction: "우호", axis: ["stability"], category: "personalStabilitySync", source: "개인 안정도 동조", structureOrigin: "해당없음" });
  } else if (aStabLevel === "불안정" && bStabLevel === "불안정") {
    factors.push({ label: `${a.name}·${b.name} 모두 배우자궁 안정도 동시 불안정`, magnitude: 10, direction: "비우호", axis: ["stability"], category: "personalStabilitySync", source: "개인 안정도 동조", structureOrigin: "해당없음" });
  }

  // 복음: 두 사람의 대운이 같은 간지(우연히 같은 시기 같은 테마) — 활성 증폭 근거로만 반영,
  // 조화·안정 방향은 위 근거들이 별도로 결정한다(원칙 [E]).
  if (dwA?.ganZhi.hangul && dwB?.ganZhi.hangul && dwA.ganZhi.hangul === dwB.ganZhi.hangul) {
    factors.push({ label: `${a.name}·${b.name} 대운 복음(동일 간지 ${dwA.ganZhi.hangul}) — 두 사람 모두 같은 테마가 강해지는 시기`, magnitude: 8, direction: "중립", axis: ["activation"], category: "doubleBrightness", source: "대운 복음", structureOrigin: "해당없음" });
  }

  // ── category cap 적용 후 axis별 합산 ──────────────────────────────
  const activationRaw = axisTotal(factors, "activation", false);
  const activationScore = clamp100(15 + activationRaw);

  const harmonyRaw = axisTotal(factors, "harmony", true);
  const harmonyScore = clamp100(50 + harmonyRaw);

  const stabilityRaw = axisTotal(factors, "stability", true);
  const stabilityScore = clamp100((aStab + bStab) / 2 + stabilityRaw * 0.5);

  const activationLevel = activationLevelFromScore(activationScore);
  const harmonyDirection = harmonyDirectionFromScore(harmonyScore);
  const stabilityLevel = stabilityLevelFromScore(stabilityScore);

  const interpretation = buildInteractionInterpretation({
    activationLevel,
    harmonyDirection,
    stabilityLevel,
    aName: a.name,
    bName: b.name,
    aActHigh,
    bActHigh,
  });

  const progressReadiness = deriveProgressReadiness({
    activationScore,
    activationLevel,
    harmonyScore,
    harmonyDirection,
    stabilityScore,
    stabilityLevel,
    aName: a.name,
    bName: b.name,
    aActLevel,
    bActLevel,
  });

  return {
    activationScore, activationLevel, harmonyScore, harmonyDirection, stabilityScore, stabilityLevel, factors, interpretation,
    progressReadinessLevel: progressReadiness.level,
    progressReadinessReasons: progressReadiness.reasons,
    progressReadinessNote: progressReadiness.note,
    isLowActivityPeriod: progressReadiness.isLowActivityPeriod,
  };
}

/**
 * evidence ledger에서 axis에 해당하는 근거만 골라 category cap을 적용한 뒤 합산한다.
 * signed=false면 activation처럼 방향 무관 크기의 합, signed=true면 harmony/stability처럼
 * 우호(+)·비우호(-)·중립(0)으로 부호를 매겨 합산한다. cap은 category별로 절댓값 기준.
 */
function axisTotal(
  factors: RelationshipInteractionFactor[],
  axis: EvidenceAxis,
  signed: boolean,
): number {
  const byCategory = new Map<EvidenceCategory, number>();
  for (const f of factors) {
    if (!f.axis.includes(axis)) continue;
    const value = signed
      ? f.direction === "우호"
        ? f.magnitude
        : f.direction === "비우호"
          ? -f.magnitude
          : 0
      : f.magnitude;
    byCategory.set(f.category, (byCategory.get(f.category) ?? 0) + value);
  }
  let total = 0;
  for (const [category, sum] of byCategory) {
    const cap = CATEGORY_CAPS[category];
    total += Math.max(-cap, Math.min(cap, sum));
  }
  return total;
}

/**
 * '관계 진전 여건' 파생 판정 — 새 계산이 아니라 이미 산출된 값들을 조합만 한다:
 *  A. 두 사람 개인 배우자·결혼 활성도(aActLevel/bActLevel)
 *  B. 커플 관계 활성도(activationScore/Level)
 *  C. 커플 관계 조화도(harmonyScore/Direction)
 *  D. 커플 관계 안정도(stabilityScore/Level)
 *
 * 조화도(C)와 안정도(D)를 가장 무겁게, 활성도(B)는 상대적으로 가볍게 반영한다 —
 * "사건이 강하다"와 "진전 여건이 좋다"를 분리하는 것이 이 함수의 핵심 목적이기 때문에,
 * 활성도 혼자서 점수를 밀어올리지 못하게 한다. 충돌 방향이면서 활성도가 높은 해는
 * "사건성은 크지만 진전 여건으로 보기엔 위험"하므로 별도 상한을 둔다.
 */
function deriveProgressReadiness(args: {
  activationScore: number;
  activationLevel: InteractionLevel;
  harmonyScore: number;
  harmonyDirection: HarmonyDirection;
  stabilityScore: number;
  stabilityLevel: StabilityLevel;
  aName: string;
  bName: string;
  aActLevel: InteractionLevel;
  bActLevel: InteractionLevel;
}): { level: ProgressReadinessLevel; reasons: string[]; isLowActivityPeriod: boolean; note: string } {
  const {
    activationScore, activationLevel, harmonyScore, harmonyDirection,
    stabilityScore, stabilityLevel, aName, bName, aActLevel, bActLevel,
  } = args;

  let score = harmonyScore * 0.45 + stabilityScore * 0.35 + activationScore * 0.2;

  const personalHighCount = [aActLevel, bActLevel].filter((l) => l === "높음").length;
  const personalLowCount = [aActLevel, bActLevel].filter((l) => l === "낮음").length;
  if (personalHighCount === 2) score += 10;
  if (personalLowCount === 2) score -= 15;

  // 충돌 방향 + 커플 활성도 높음 = 사건은 강하지만 진전 여건으로는 위험한 조합 → 상한
  if (harmonyDirection === "충돌" && activationLevel === "높음") {
    score = Math.min(score, 55);
  }
  score = clamp100(score);

  const level: ProgressReadinessLevel =
    score >= 78 ? "매우 높음" : score >= 62 ? "높음" : score >= 42 ? "보통" : score >= 25 ? "낮음" : "매우 낮음";

  const reasons: string[] = [];
  if (aActLevel === "낮음") reasons.push(`${aName} 배우자·결혼 활성도 낮음`);
  if (bActLevel === "낮음") reasons.push(`${bName} 배우자·결혼 활성도 낮음`);
  if (aActLevel === "높음") reasons.push(`${aName} 배우자·결혼 활성도 높음`);
  if (bActLevel === "높음") reasons.push(`${bName} 배우자·결혼 활성도 높음`);
  reasons.push(`커플 관계 활성도 ${activationLevel}`);
  reasons.push(`커플 관계 조화도 ${harmonyDirection}`);
  reasons.push(`커플 관계 안정도 ${stabilityLevel}`);

  const isLowActivityPeriod = aActLevel === "낮음" && bActLevel === "낮음" && activationLevel === "낮음";

  let note: string;
  if (isLowActivityPeriod) {
    note = `두 사람 모두 개인 배우자·결혼 활성도가 낮고 커플 관계 활성도도 낮아, 이 시기에는 관계가 인생의 주요 이슈로 떠오를 가능성이 상대적으로 낮습니다. 다만 인연 자체가 없다는 뜻은 아니며, 조용히 지나가는 시기로 볼 수 있습니다.`;
  } else if (harmonyDirection === "충돌" && activationLevel === "높음") {
    note = `관계는 강하게 움직일 수 있지만 충돌·정리·재정의 형태일 가능성도 커, 단순한 연애·결혼 진전으로 보기 어렵습니다.`;
  } else if (personalLowCount === 2 && activationLevel !== "낮음") {
    note = `두 사람의 개인 배우자 활성도는 크게 튀지 않는데 커플 관계 활성도만 움직이는 시기입니다. 외부 상황이나 우연한 접점으로 관계 관련 사건은 생길 수 있으나, 연애·결혼을 적극적으로 추진하는 힘은 상대적으로 약한 것으로 해석됩니다.`;
  } else if (level === "매우 높음" || level === "높음") {
    note = personalHighCount === 2
      ? `두 사람 모두 배우자·결혼 테마가 활성화되고, 관계 상호작용의 방향과 유지 기반도 함께 받쳐주는 시기입니다.`
      : `${personalHighCount === 1 ? (aActLevel === "높음" ? aName : bName) + " 쪽 개인 신호가 두드러지지만, " : ""}관계 조화·안정 기반이 뒷받침돼 진전 여건 자체는 양호한 편입니다.`;
  } else if (level === "보통") {
    note = `관계 사건이 아예 없지는 않지만, 조화·안정 기반이 뚜렷하게 유리하지도 불리하지도 않은 중간 구간입니다.`;
  } else {
    note = `현재 조건으로는 관계가 안정적으로 진전되기보다 조율·재정비가 더 필요한 시기로 해석됩니다.`;
  }

  return { level, reasons, isLowActivityPeriod, note };
}

function buildInteractionInterpretation(args: {
  activationLevel: InteractionLevel;
  harmonyDirection: HarmonyDirection;
  stabilityLevel: StabilityLevel;
  aName: string;
  bName: string;
  aActHigh: boolean;
  bActHigh: boolean;
}): string {
  const { activationLevel, harmonyDirection, stabilityLevel, aName, bName, aActHigh, bActHigh } = args;

  if (activationLevel === "낮음") {
    return "이 해는 두 사람 관계에 특별한 사건·자극이 크지 않은 평이한 시기입니다.";
  }

  const bothPersonal = aActHigh && bActHigh ? `${aName}·${bName} 개인 배우자 활성도도 함께 높아지는 해라 신호가 겹칩니다.` :
    aActHigh || bActHigh ? `다만 개인 배우자 활성도는 ${aActHigh ? aName : bName} 쪽에서만 두드러져, 관계 사건이 한쪽 주도로 나타날 수 있습니다.` :
    "개인 배우자 활성도는 크게 튀지 않아, 관계 자체보다 상황적 요인으로 사건이 발생할 가능성이 있습니다.";

  if (harmonyDirection === "조화" && stabilityLevel === "안정") {
    return `관계 관련 사건·감정이 강하게 움직이면서 방향도 서로 가까워지는 쪽이라, 관계를 다지기에 유리한 시기로 볼 수 있습니다. ${bothPersonal} 다만 활성도가 높다고 결혼·재회로 단정하지 말고, 위 근거의 방향성을 함께 참고하세요.`;
  }
  if (harmonyDirection === "충돌" && stabilityLevel === "불안정") {
    return `관계 이슈가 강하게 표면화되면서 방향도 충돌 쪽이고 지속성도 낮은 시기입니다. 갈등·이별·재정의 등 관계가 흔들리는 형태로 나타날 가능성이 있습니다. ${bothPersonal}`;
  }
  if (harmonyDirection === "충돌") {
    return `관계 관련 사건이 강하게 움직이지만 방향은 충돌·긴장 쪽에 가깝습니다. 활성도만 보고 좋은 시기로 오해하지 말고, 소통 방식에 주의가 필요합니다. ${bothPersonal}`;
  }
  if (harmonyDirection === "조화") {
    return `관계 사건이 활발히 움직이고 방향도 우호적이지만, 안정도는 ${stabilityLevel === "보통" ? "중간" : "낮은"} 편이라 결실로 이어지려면 지속적인 노력이 필요합니다. ${bothPersonal}`;
  }
  return `관계 관련 사건·감정이 강하게 움직이는 시기이지만 방향은 뚜렷하지 않습니다(우호·비우호 요인 혼재). ${bothPersonal}`;
}

/** 두 사람의 연도별 관계 상호작용도를 계산한다(화면·복사 공용). */
export interface RelationshipInteractionYearRangeContext {
  a: PersonInteractionContext;
  b: PersonInteractionContext;
  /** computeSpouseActivationByYearRange 호출에 필요한 나머지 컨텍스트(개인별) */
  aSpouseCtx: Omit<SpouseActivationYearRangeContext, "fromYear" | "count">;
  bSpouseCtx: Omit<SpouseActivationYearRangeContext, "fromYear" | "count">;
  fromYear: number;
  count?: number;
}

export interface RelationshipInteractionYearEntry {
  year: number;
  result: RelationshipInteractionResult;
}

export function computeRelationshipInteractionByYearRange(
  ctx: RelationshipInteractionYearRangeContext,
): RelationshipInteractionYearEntry[] {
  const count = ctx.count ?? 10;
  const aSpouseByYear = computeSpouseActivationByYearRange({ ...ctx.aSpouseCtx, fromYear: ctx.fromYear, count });
  const bSpouseByYear = computeSpouseActivationByYearRange({ ...ctx.bSpouseCtx, fromYear: ctx.fromYear, count });

  return aSpouseByYear.map((aYear) => {
    const bYear = bSpouseByYear.find((y) => y.year === aYear.year);
    const result = computeRelationshipInteractionForYear(ctx.a, ctx.b, aYear.year, aYear, bYear);
    return { year: aYear.year, result };
  });
}
