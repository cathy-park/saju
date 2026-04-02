/**
 * 강약·격국·용신·evaluations·timing 간 논리 일관성 검증(읽기 전용).
 * 계산 엔진 로직은 변경하지 않으며, 파이프라인 산출물만 대조한다.
 */

import type { FiveElementCount } from "../sajuEngine";
import {
  type FiveElKey,
  CONTROLS,
  GENERATES,
  getController,
  getGenerator,
  getTenGodGroup,
  STEM_TO_ELEMENT,
  BRANCH_TO_ELEMENT,
} from "../element-color";
import type { StrengthLevel } from "../interpretSchema";
import { STRENGTH_LEVEL_INDEX } from "../interpretSchema";
import type { RelationshipWealthEvaluations } from "./relationshipWealthEvaluation";
import type { TimingActivationResult } from "./luckTimingActivation";
import { computeBranchRelations } from "../branchRelations";

/** luckTimingActivation.ts 가중 규칙과 동기화할 것(검증용 미러) */
function mirrorPillarElements(hangul: string | undefined): FiveElKey[] {
  if (!hangul || hangul.length < 2) return [];
  const stem = hangul[0];
  const branch = hangul[1];
  const a = STEM_TO_ELEMENT[stem] as FiveElKey | undefined;
  const b = BRANCH_TO_ELEMENT[branch] as FiveElKey | undefined;
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

function mirrorWealthPillarWeight(
  hangul: string | undefined,
  wealthEl: FiveElKey,
  yongshin: FiveElKey,
  heesin: FiveElKey | undefined,
  gisin: FiveElKey | undefined,
): number {
  const els = mirrorPillarElements(hangul);
  if (els.length === 0) return 0;
  let w = 0;
  if (els.some((e) => e === wealthEl)) w += 12;
  if (els.some((e) => e === yongshin)) w += 10;
  if (heesin && els.some((e) => e === heesin)) w += 6;
  if (els.some((e) => e === getGenerator(wealthEl))) w += 6;
  if (els.some((e) => e === getController(wealthEl))) w -= 8;
  if (gisin && els.some((e) => e === gisin)) w -= 6;
  return w;
}

function mirrorOfficerPillarWeight(hangul: string | undefined, officerEl: FiveElKey): number {
  const els = mirrorPillarElements(hangul);
  if (els.length === 0) return 0;
  let w = 0;
  if (els.some((e) => e === officerEl)) w += 12;
  if (els.some((e) => e === getGenerator(officerEl))) w += 6;
  if (els.some((e) => e === getController(officerEl))) w -= 8;
  return w;
}

const JIJANGGAN_MIRROR: Record<string, string[]> = {
  자: ["임", "계"],
  축: ["계", "신", "기"],
  인: ["무", "병", "갑"],
  묘: ["갑", "을"],
  진: ["을", "계", "무"],
  사: ["무", "경", "병"],
  오: ["병", "기", "정"],
  미: ["정", "을", "기"],
  신: ["무", "임", "경"],
  유: ["경", "신"],
  술: ["신", "정", "무"],
  해: ["무", "갑", "임"],
};

function countOfficerPresence(dayMasterEl: FiveElKey, officerEl: FiveElKey, stems: string[], branches: string[]): number {
  let n = 0;
  for (const s of stems) {
    const e = STEM_TO_ELEMENT[s] as FiveElKey | undefined;
    if (e && getTenGodGroup(dayMasterEl, e) === "관성") n++;
  }
  for (const b of branches) {
    const surf = BRANCH_TO_ELEMENT[b] as FiveElKey | undefined;
    if (surf === officerEl) n++;
    for (const h of JIJANGGAN_MIRROR[b] ?? []) {
      const he = STEM_TO_ELEMENT[h] as FiveElKey | undefined;
      if (he === officerEl) n++;
    }
  }
  return n;
}

function countWealthPresence(dayMasterEl: FiveElKey, wealthEl: FiveElKey, stems: string[], branches: string[]): number {
  let n = 0;
  for (const s of stems) {
    const e = STEM_TO_ELEMENT[s] as FiveElKey | undefined;
    if (e && getTenGodGroup(dayMasterEl, e) === "재성") n++;
  }
  for (const b of branches) {
    const surf = BRANCH_TO_ELEMENT[b] as FiveElKey | undefined;
    if (surf === wealthEl) n++;
    for (const h of JIJANGGAN_MIRROR[b] ?? []) {
      const he = STEM_TO_ELEMENT[h] as FiveElKey | undefined;
      if (he === wealthEl) n++;
    }
  }
  return n;
}

export type ConsistencyVerdict = "정상" | "주의 필요" | "논리 충돌";

export interface EngineConsistencyCheck {
  /** 표시용 라벨 (요청 10항목) */
  label: string;
  verdict: ConsistencyVerdict;
  reason: string;
}

export interface EngineConsistencyReport {
  checks: EngineConsistencyCheck[];
}

export interface EngineConsistencyInput {
  strengthLevel: StrengthLevel;
  gukgukName: string | null | undefined;
  yongshinPrimary: FiveElKey;
  yongshinSecondary?: FiveElKey;
  /** timing 미러용 기신(미주입 시 getController(yongshin)로 대체) */
  gisin?: FiveElKey;
  dayStem: string;
  dayBranch?: string;
  effectiveFiveElements: FiveElementCount;
  /** 용신 규칙(신약·태강 분기) 재현용 지장간 가중 카운트. 없으면 effectiveFiveElements 사용 */
  countsForYongshinRule?: FiveElementCount;
  tenGodGroups: Record<string, number>;
  evaluations: RelationshipWealthEvaluations;
  timingActivation: TimingActivationResult;
  timingDaewoonHangul?: string;
  timingSeunHangul?: string;
  allStems: string[];
  allBranches: string[];
}

function expectedYongshinPrimarySet(
  dayStem: string,
  level: StrengthLevel,
  counts: FiveElementCount,
): Set<FiveElKey> {
  const dm = STEM_TO_ELEMENT[dayStem] as FiveElKey | undefined;
  if (!dm) return new Set();
  const resourceEl = getGenerator(dm);
  const companionEl = dm;
  const outputEl = GENERATES[dm];
  const wealthEl = CONTROLS[dm];
  const officerEl = getController(dm);
  const idx = STRENGTH_LEVEL_INDEX[level];
  if (idx <= 1) return new Set([resourceEl]);
  if (idx === 2) {
    const rc = counts[resourceEl] ?? 0;
    const cc = counts[companionEl] ?? 0;
    if (rc > 0 && cc > 0) return new Set([resourceEl, companionEl]);
    if (rc >= cc) return new Set([resourceEl]);
    return new Set([companionEl]);
  }
  if (idx === 3) return new Set([outputEl]);
  if (idx === 4) return new Set([outputEl]);
  if (idx === 5) {
    const oc = counts[outputEl] ?? 0;
    const wc = counts[wealthEl] ?? 0;
    if (wc >= oc) return new Set([wealthEl]);
    return new Set([outputEl]);
  }
  return new Set([officerEl]);
}

function checkStrengthVsYongshin(input: EngineConsistencyInput): EngineConsistencyCheck {
  const counts = input.countsForYongshinRule ?? input.effectiveFiveElements;
  const allowed = expectedYongshinPrimarySet(input.dayStem, input.strengthLevel, counts);
  const p = input.yongshinPrimary;
  const idx = STRENGTH_LEVEL_INDEX[input.strengthLevel];
  if (allowed.size === 0) {
    return { label: "강약 vs 용신", verdict: "주의 필요", reason: "일간 오행을 식별하지 못해 기대 용신을 비교하지 못했습니다." };
  }
  if (allowed.has(p)) {
    if (idx === 3) {
      return {
        label: "강약 vs 용신",
        verdict: "주의 필요",
        reason: "중화(중화) 구간은 억부 엔진상 식상 primary·낮은 신뢰도이므로, 해석 시 다른 요소와 함께 읽는 것이 안전합니다.",
      };
    }
    return { label: "강약 vs 용신", verdict: "정상", reason: `신강약(${input.strengthLevel})에 따른 기대 primary 용신 후보에 실제 primary(${p})가 포함됩니다.` };
  }
  return {
    label: "강약 vs 용신",
    verdict: "논리 충돌",
    reason: `신강약(${input.strengthLevel}) 기준 기대 primary는 {${[...allowed].join(",")}} 인데, 실제 용신 primary는 ${p}입니다. (수동 용신/조후 secondary만으로는 설명되지 않는 경우 점검 필요)`,
  };
}

function checkStrengthVsGukguk(input: EngineConsistencyInput): EngineConsistencyCheck {
  const name = input.gukgukName?.trim() ?? "";
  if (!name || name === "격국 없음") {
    return { label: "강약 vs 격국", verdict: "주의 필요", reason: "격국이 확정되지 않아 대조를 생략했습니다." };
  }
  const strongGuk = ["건록격", "양인격"];
  const weakLeanGuk = ["정인격", "편인격"];
  const s = input.strengthLevel;
  const weakLevels = ["극신약", "태약", "신약"];
  const strongLevels = ["신강", "태강", "극신강"];

  if (strongGuk.some((g) => name.includes(g)) && weakLevels.includes(s)) {
    return {
      label: "강약 vs 격국",
      verdict: "논리 충돌",
      reason: `격국(${name})은 일간 기세가 강한 편으로 읽히는데, 신강약은 ${s}로 매우 약한 쪽입니다.`,
    };
  }
  if (weakLeanGuk.some((g) => name.includes(g)) && strongLevels.includes(s)) {
    return {
      label: "강약 vs 격국",
      verdict: "주의 필요",
      reason: `인성 계열 격(${name})과 ${s}(강한 쪽) 동시에 나오면, 격의 ‘학습·보호’ 이미지와 억부 해석을 구분해 설명하는 편이 좋습니다.`,
    };
  }
  return { label: "강약 vs 격국", verdict: "정상", reason: `격국(${name})과 신강약(${s})가 극단적으로 엇갈리지 않습니다.` };
}

function checkGukgukVsYongshin(input: EngineConsistencyInput): EngineConsistencyCheck {
  const name = input.gukgukName?.trim() ?? "";
  if (!name || name === "격국 없음") {
    return { label: "격국 vs 용신", verdict: "주의 필요", reason: "격국 미확정으로 대조 생략." };
  }
  const p = input.yongshinPrimary;
  const dm = STEM_TO_ELEMENT[input.dayStem] as FiveElKey | undefined;
  if (!dm) {
    return { label: "격국 vs 용신", verdict: "주의 필요", reason: "일간 오행 없음." };
  }
  const wealthEl = CONTROLS[dm];
  const outputEl = GENERATES[dm];
  const officerEl = getController(dm);

  if ((name.includes("식신") || name.includes("상관")) && (p === wealthEl || p === officerEl)) {
    return {
      label: "격국 vs 용신",
      verdict: "정상",
      reason: `식상 계열 격과 용신 primary(${p})가 재성·관성 쪽으로 정리되는 전형적 신강 흐름과 맞습니다.`,
    };
  }
  if ((name.includes("정재") || name.includes("편재")) && p !== wealthEl && p !== outputEl) {
    return {
      label: "격국 vs 용신",
      verdict: "주의 필요",
      reason: `재성 격인데 용신 primary가 재성·식상이 아닌 ${p}입니다. 조후·수동 보정 여부를 해석 문구에 남기는 것이 좋습니다.`,
    };
  }
  if ((name.includes("정관") || name.includes("편관")) && p !== officerEl && p !== wealthEl) {
    return {
      label: "격국 vs 용신",
      verdict: "주의 필요",
      reason: `관성 격인데 용신 primary가 관성·재성 계열이 아닌 ${p}입니다.`,
    };
  }
  return { label: "격국 vs 용신", verdict: "정상", reason: `격국(${name})과 용신(${p})의 조합에 뚜렷한 모순이 없습니다.` };
}

function checkOhaengVsEvaluations(input: EngineConsistencyInput): EngineConsistencyCheck {
  const g = input.tenGodGroups;
  const 관 = g["관성"] ?? 0;
  const 재 = g["재성"] ?? 0;
  const o = input.evaluations.officerActivation;
  const w = input.evaluations.wealthActivation;

  const reasons: string[] = [];
  let worst: ConsistencyVerdict = "정상";

  if (관 < 0.1 && o.score >= 58 && !o.negatives.some((n) => n.includes("관성") && n.includes("부재"))) {
    worst = "주의 필요";
    reasons.push(`십성 분포상 관성 비중이 0에 가깝는데 officerActivation 점수는 ${o.score}입니다.`);
  }
  if (재 < 0.1 && w.score >= 58 && !w.negatives.some((n) => n.includes("재성") && (n.includes("약") || n.includes("부재")))) {
    worst = worst === "논리 충돌" ? worst : "주의 필요";
    reasons.push(`십성 분포상 재성 비중이 0에 가깝는데 wealthActivation 점수는 ${w.score}입니다.`);
  }

  if (reasons.length === 0) {
    return {
      label: "오행 분포 vs evaluations",
      verdict: "정상",
      reason: "관성·재성 그룹 분포와 보조 점수(activations)가 극단적으로 어긋나지 않습니다.",
    };
  }
  return {
    label: "오행 분포 vs evaluations",
    verdict: worst,
    reason: reasons.join(" "),
  };
}

function checkEvaluationsVsTiming(input: EngineConsistencyInput): EngineConsistencyCheck {
  const w = input.evaluations.wealthActivation;
  const t = input.timingActivation;
  const wLuck = t.wealthActivationNow - w.score;
  if (w.score < 45 && t.wealthActivationTrend === "상승" && wLuck >= 8) {
    return {
      label: "evaluations vs timingActivation",
      verdict: "주의 필요",
      reason: `원국 재성 작동 점수는 낮은데(${w.score}), 운 가중으로 Now·추세가 크게 상승합니다. ‘원국 약함 + 운 보완’으로 설명 경로를 분리하는 것이 좋습니다.`,
    };
  }
  if (w.negatives.length > w.positives.length + 2 && t.wealthActivationTrend === "상승" && wLuck >= 8) {
    return {
      label: "evaluations vs timingActivation",
      verdict: "주의 필요",
      reason: "wealth 평가 문구는 부정 요인이 많은데 재물 Now 추세만 상승입니다. 텍스트와 타이밍 지표를 동시에 쓸 때 주의가 필요합니다.",
    };
  }
  return {
    label: "evaluations vs timingActivation",
    verdict: "정상",
    reason: "원국 evaluations와 timing 가중 방향이 크게 역행하지 않습니다.",
  };
}

function checkSpouseVsDayBranchStructure(input: EngineConsistencyInput): EngineConsistencyCheck {
  const db = input.dayBranch;
  if (!db) {
    return { label: "배우자궁 안정도 vs 일지 구조", verdict: "주의 필요", reason: "일지 없음." };
  }
  const others = input.allBranches.filter((b) => b && b !== db);
  let harsh = 0;
  for (const ob of others) {
    const rels = computeBranchRelations([db, ob]);
    for (const r of rels) {
      if (r.type === "지지충") harsh += 3;
      else if (r.type === "형") harsh += 2;
      else if (r.type === "파") harsh += 2;
      else if (r.type === "해") harsh += 1;
    }
  }
  const s = input.evaluations.spousePalaceStability.score;
  if (harsh >= 5 && s >= 72) {
    return {
      label: "배우자궁 안정도 vs 일지 구조",
      verdict: "논리 충돌",
      reason: `일지가 타 지지와 충·형·파·해 부담이 큰데(가중합 ${harsh}), 배우자궁 안정도는 ${s}로 높게 나왔습니다.`,
    };
  }
  if (harsh >= 3 && s >= 80) {
    return {
      label: "배우자궁 안정도 vs 일지 구조",
      verdict: "주의 필요",
      reason: `일지 긴장 요소가 있는데 안정도 점수가 ${s}로 높습니다. 합·용신 보정 등으로 점수가 올라갔는지 확인하세요.`,
    };
  }
  return {
    label: "배우자궁 안정도 vs 일지 구조",
    verdict: "정상",
    reason: "일지 주변 충형파해 부담과 배우자궁 안정도 점수가 대체로 맞물립니다.",
  };
}

function checkOfficerVsPresence(input: EngineConsistencyInput): EngineConsistencyCheck {
  const dm = STEM_TO_ELEMENT[input.dayStem] as FiveElKey | undefined;
  if (!dm) {
    return { label: "officerActivation vs 관성 오행 존재", verdict: "주의 필요", reason: "일간 없음." };
  }
  const officerEl = getController(dm);
  const n = countOfficerPresence(dm, officerEl, input.allStems, input.allBranches);
  const sc = input.evaluations.officerActivation.score;
  if (n === 0 && sc >= 55) {
    return {
      label: "officerActivation vs 관성 오행 존재",
      verdict: "논리 충돌",
      reason: `원국에 관성 오행(천간·지지·지장간)이 잡히지 않는데 officerActivation=${sc}입니다.`,
    };
  }
  if (n === 0 && sc >= 45 && sc < 55) {
    return {
      label: "officerActivation vs 관성 오행 존재",
      verdict: "주의 필요",
      reason: `관성 오행 표기는 거의 없으나 점수는 중간대(${sc})입니다. 합·생 연계 가점 위주일 수 있습니다.`,
    };
  }
  return {
    label: "officerActivation vs 관성 오행 존재",
    verdict: "정상",
    reason:
      n === 0
        ? `원국에 관성 오행 가중 카운트 0, officerActivation=${sc}(중·저)로 과대 고점은 아닙니다.`
        : `관성 오행 가중 카운트 ${n}과 officerActivation(${sc})가 대응됩니다.`,
  };
}

function checkWealthVsPresence(input: EngineConsistencyInput): EngineConsistencyCheck {
  const dm = STEM_TO_ELEMENT[input.dayStem] as FiveElKey | undefined;
  if (!dm) {
    return { label: "wealthActivation vs 재성 존재", verdict: "주의 필요", reason: "일간 없음." };
  }
  const wealthEl = CONTROLS[dm];
  const n = countWealthPresence(dm, wealthEl, input.allStems, input.allBranches);
  const sc = input.evaluations.wealthActivation.score;
  if (n === 0 && sc >= 70) {
    return {
      label: "wealthActivation vs 재성 존재",
      verdict: "논리 충돌",
      reason: `재성 오행이 원국에 거의 없는데 wealthActivation=${sc}입니다.`,
    };
  }
  if (n <= 1 && sc >= 90) {
    return {
      label: "wealthActivation vs 재성 존재",
      verdict: "주의 필요",
      reason: `재성 뿌리가 매우 얇은데 점수가 ${sc}로 매우 높습니다. 식상생재·합 연계 가점을 안내 문구에 녹이는 편이 좋습니다.`,
    };
  }
  return {
    label: "wealthActivation vs 재성 존재",
    verdict: "정상",
    reason: `재성 오행 존재(가중 카운트 ${n})와 wealthActivation(${sc})가 대체로 일치합니다.`,
  };
}

/**
 * 대운(세운) 단독 재물 미러가 강한 음(-)인데, 반대 기둥이 보태주지 못하는 상황에서
 * 전체 재물 추세만 상승이면 구현/입력 불일치 의심.
 */
function checkTimingVsDaewoonOhang(input: EngineConsistencyInput): EngineConsistencyCheck {
  const dm = STEM_TO_ELEMENT[input.dayStem] as FiveElKey | undefined;
  if (!dm) {
    return { label: "timingActivation vs 현재 대운 오행", verdict: "주의 필요", reason: "일간 없음." };
  }
  const gisin = input.gisin ?? getController(input.yongshinPrimary);
  const wealthEl = CONTROLS[dm];
  const officerEl = getController(dm);
  const dw = input.timingDaewoonHangul;
  const se = input.timingSeunHangul;
  if (!dw) {
    return { label: "timingActivation vs 현재 대운 오행", verdict: "주의 필요", reason: "대운 간지가 입력되지 않았습니다." };
  }
  const dwW = mirrorWealthPillarWeight(dw, wealthEl, input.yongshinPrimary, input.yongshinSecondary, gisin);
  const seW = se ? mirrorWealthPillarWeight(se, wealthEl, input.yongshinPrimary, input.yongshinSecondary, gisin) : 0;
  const dwO = mirrorOfficerPillarWeight(dw, officerEl);
  const seO = se ? mirrorOfficerPillarWeight(se, officerEl) : 0;
  const officerBonusDw =
    input.evaluations.officerActivation.score < 40 && mirrorPillarElements(dw).includes(officerEl) ? 4 : 0;
  const officerBonusSe =
    input.evaluations.officerActivation.score < 40 && se && mirrorPillarElements(se).includes(officerEl) ? 4 : 0;
  const wealthTr = input.timingActivation.wealthActivationTrend;
  const wealthTotal = dwW + seW;
  const offTr = input.timingActivation.officerActivationTrend;
  const offDw = dwO + officerBonusDw;
  const offSe = se ? seO + officerBonusSe : 0;
  const offTotal = offDw + offSe;
  const bad: string[] = [];
  if (wealthTr === "상승" && dwW <= -12 && seW < 8) {
    bad.push(`재물: 대운(${dw}) 미러 ${dwW}, 세운 ${seW}, 합 ${wealthTotal}인데 추세 상승`);
  }
  if (offTr === "상승" && offDw <= -12 && offSe < 8) {
    bad.push(`관성: 대운 미러(+보너스) ${offDw}, 세운 ${offSe}, 합 ${offTotal}인데 추세 상승`);
  }
  if (bad.length > 0) {
    return {
      label: "timingActivation vs 현재 대운 오행",
      verdict: "논리 충돌",
      reason: bad.join(" / "),
    };
  }
  return {
    label: "timingActivation vs 현재 대운 오행",
    verdict: "정상",
    reason: `대운 ${dw}: 재물미러 ${dwW}, 관성미러(+보너스) ${offDw}. 세운 ${se ?? "없음"}: 재물 ${seW}, 관성 ${offSe}. 전체 재물운가중 ${wealthTotal}(추세 ${wealthTr}), 관성운 ${offTotal}(추세 ${offTr}).`,
  };
}

function checkTimingVsSeunOhang(input: EngineConsistencyInput): EngineConsistencyCheck {
  const dm = STEM_TO_ELEMENT[input.dayStem] as FiveElKey | undefined;
  if (!dm) {
    return { label: "timingActivation vs 현재 세운 오행", verdict: "주의 필요", reason: "일간 없음." };
  }
  const gisin = input.gisin ?? getController(input.yongshinPrimary);
  const wealthEl = CONTROLS[dm];
  const officerEl = getController(dm);
  const dw = input.timingDaewoonHangul;
  const se = input.timingSeunHangul;
  if (!se) {
    return { label: "timingActivation vs 현재 세운 오행", verdict: "주의 필요", reason: "세운 간지가 입력되지 않았습니다." };
  }
  const dwW = dw ? mirrorWealthPillarWeight(dw, wealthEl, input.yongshinPrimary, input.yongshinSecondary, gisin) : 0;
  const seW = mirrorWealthPillarWeight(se, wealthEl, input.yongshinPrimary, input.yongshinSecondary, gisin);
  const dwO = dw ? mirrorOfficerPillarWeight(dw, officerEl) : 0;
  const seO = mirrorOfficerPillarWeight(se, officerEl);
  const officerBonusDw =
    dw && input.evaluations.officerActivation.score < 40 && mirrorPillarElements(dw).includes(officerEl) ? 4 : 0;
  const officerBonusSe =
    input.evaluations.officerActivation.score < 40 && mirrorPillarElements(se).includes(officerEl) ? 4 : 0;
  const wealthTr = input.timingActivation.wealthActivationTrend;
  const wealthTotal = dwW + seW;
  const offTr = input.timingActivation.officerActivationTrend;
  const offDw = dwO + officerBonusDw;
  const offSe = seO + officerBonusSe;
  const offTotal = offDw + offSe;
  const bad: string[] = [];
  if (wealthTr === "상승" && seW <= -12 && dwW < 8) {
    bad.push(`재물: 세운(${se}) 미러 ${seW}, 대운 ${dwW}, 합 ${wealthTotal}인데 추세 상승`);
  }
  if (offTr === "상승" && offSe <= -12 && offDw < 8) {
    bad.push(`관성: 세운 미러(+보너스) ${offSe}, 대운 ${offDw}, 합 ${offTotal}인데 추세 상승`);
  }
  if (bad.length > 0) {
    return {
      label: "timingActivation vs 현재 세운 오행",
      verdict: "논리 충돌",
      reason: bad.join(" / "),
    };
  }
  return {
    label: "timingActivation vs 현재 세운 오행",
    verdict: "정상",
    reason: `세운 ${se}: 재물미러 ${seW}, 관성미러(+보너스) ${offSe}. 대운 ${dw ?? "없음"}: 재물 ${dwW}, 관성 ${offDw}. 합산 재물 ${wealthTotal}(추세 ${wealthTr}), 관성 ${offTotal}(추세 ${offTr}).`,
  };
}

/**
 * 파이프라인 산출물만 받아 10개 축을 검사한다.
 */
export function buildEngineConsistencyReport(input: EngineConsistencyInput): EngineConsistencyReport {
  const checks: EngineConsistencyCheck[] = [
    checkStrengthVsYongshin(input),
    checkStrengthVsGukguk(input),
    checkGukgukVsYongshin(input),
    checkOhaengVsEvaluations(input),
    checkEvaluationsVsTiming(input),
    checkSpouseVsDayBranchStructure(input),
    checkOfficerVsPresence(input),
    checkWealthVsPresence(input),
    checkTimingVsDaewoonOhang(input),
    checkTimingVsSeunOhang(input),
  ];
  return { checks };
}

export function formatEngineConsistencyReportMarkdown(report: EngineConsistencyReport): string {
  const lines = report.checks.map((c) => `${c.label}: ${c.verdict}`);
  const body = report.checks
    .map((c) => `### ${c.label}\n- **판정:** ${c.verdict}\n- **이유:** ${c.reason}\n`)
    .join("\n");
  return `[엔진 충돌 검증 리포트]\n\n${lines.join("\n")}\n\n---\n\n${body}`;
}
