/**
 * 배우자·결혼 테마 활성도 (Marriage/Spouse Activation) — 기존 배우자궁 안정도와 독립된 지표.
 *
 * 기존 computeSpousePalaceStability / computeLuckTimingActivation의 spousePalaceStabilityNow는
 * "관계가 얼마나 안정적으로 운영되기 쉬운가"만 본다. 그런데 배우자궁에 강한 충이 들어오면
 * 안정도는 떨어지지만, 배우자궁 자체는 강하게 자극돼서 배우자·결혼 문제가 그 시기에
 * 전면화될 가능성은 오히려 높아진다 — 이 두 가지는 서로 다른 축인데 기존 로직은 안정도
 * 하나로만 뭉뚱그려서, 사용자가 "안정도 낮음"을 "결혼운 없음"으로 오해하는 문제가 있었다.
 *
 * 이 모듈은 기존 계산(spousePalaceStabilityNow 등)을 전혀 건드리지 않고, 그 값을 그대로
 * "안정도" 축으로 재사용하면서 "활성도"(자극의 크기, 방향 무관) 축을 새로 계산해 나란히 보여준다.
 *
 * 반영한 요소(모두 전통 명리에서 실제로 배우자·결혼 사건의 시기적 신호로 쓰이는 것만 채택):
 *  1) 배우자궁(일지)이 대운·세운 지지와 합·충·형·파·해·원진으로 직접 자극되는지
 *  2) 배우자궁 + 대운 + 세운이 삼합·방합을 새로 이루는지
 *  3) 배우자성(여: 관성 / 남: 재성)이 대운·세운에 출현하거나 생조되는지
 *  4) 원국에 있던 배우자성 글자가 대운·세운 천간과 합·충을 이루는지
 *  5) 대운과 세운이 같은 간지(복음)일 때의 강도 증폭
 *  6) 대운·세운이 원국 일주(일간+일지)와 완전히 동일할 때의 강도 증폭 — 일주는 배우자궁(일지)과
 *     자기 자신(일간)이 합쳐진 자리라 5)보다 이 모듈 테마에 더 직접적인 신호로 본다. 연·월·시주가
 *     세운과 겹치는 것은 배우자궁과의 연결이 약해 채택하지 않았다. 5)·6)이 동시에 성립하면(대운=
 *     세운=원국 일주) 가장 강한 값 하나만 숫자에 반영하고 나머지는 라벨만 남긴다(3중 가산 금지).
 * 근거가 약하거나 유파마다 갈리는 요소(예: 신살 다수 결합, 공망 등)는 포함하지 않았다.
 */

import {
  type FiveElKey,
  CONTROLS,
  getController,
  getGenerator,
  STEM_TO_ELEMENT,
  BRANCH_TO_ELEMENT,
} from "../element-color";
import { computeBranchRelations, computeStemRelations } from "../branchRelations";
import { computeLuckTimingActivation } from "./luckTimingActivation";
import type { RelationshipWealthEvaluations } from "./relationshipWealthEvaluation";
import type { DaewoonEntry } from "../luckCycles";

export type ActivationLevel = "높음" | "보통" | "낮음";
export type StabilityLevel = "안정" | "보통" | "불안정";

export interface SpouseActivationFactor {
  /** 화면에 그대로 노출할 짧은 근거 설명. 예: "배우자궁 세운 충 (미·축)" */
  label: string;
  /** 활성도에 더해지는 크기(항상 양수) */
  magnitude: number;
  /** 참고용 방향성 — 안정도 재계산에는 안 쓰고, UI에서 이 근거가 우호적/비우호적인지 표시하는 용도 */
  direction: "우호" | "비우호" | "중립";
}

export interface SpouseActivationResult {
  activationScore: number;
  activationLevel: ActivationLevel;
  /** 기존에 이미 계산된 spousePalaceStabilityNow를 그대로 재사용한 값(재계산 아님) */
  stabilityScore: number;
  stabilityLevel: StabilityLevel;
  factors: SpouseActivationFactor[];
  interpretation: string;
}

function clamp100(n: number): number {
  return Math.max(0, Math.min(100, Math.round(n)));
}

function activationLevelFromScore(s: number): ActivationLevel {
  if (s >= 65) return "높음";
  if (s >= 35) return "보통";
  return "낮음";
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

function pillarElements(hangul: string | undefined): FiveElKey[] {
  const { stem, branch } = parsePillar(hangul);
  const out: FiveElKey[] = [];
  const a = stem ? (STEM_TO_ELEMENT[stem] as FiveElKey | undefined) : undefined;
  const b = branch ? (BRANCH_TO_ELEMENT[branch] as FiveElKey | undefined) : undefined;
  for (const e of [a, b]) if (e && !out.includes(e)) out.push(e);
  return out;
}

// 월운·일운은 대운(10년)·세운(1년)보다 영향 지속 기간이 훨씬 짧아, 같은 가중치를 그대로
// 쓰면 과대평가된다 — luckTimingActivation.ts와 같은 비율로 깎아서 반영한다.
const WOLUN_SCALE = 0.5;
const ILUN_SCALE = 0.3;

export interface SpouseActivationContext {
  dayStem: string;
  dayBranch?: string;
  /** 원국 4개 천간(연·월·일·시), 배우자성 글자를 찾기 위함 */
  allStems: string[];
  gender: "남" | "여";
  daewoonHangul?: string;
  saeunHangul?: string;
  /** 선택된 월운 간지(한글 2글자, 월운 탭 이상에서만). 대운·세운의 절반 가중 */
  wolunHangul?: string;
  /** 선택된 일운 간지(한글 2글자, 일운 탭에서만). 대운·세운보다 더 낮은 가중 */
  ilunHangul?: string;
  yongshin: FiveElKey;
  heesin?: FiveElKey;
  gisin?: FiveElKey;
  /** computeLuckTimingActivation이 이미 계산해둔 값을 그대로 전달 — 여기서 재계산하지 않는다 */
  spousePalaceStabilityNow: number;
}

export function computeSpouseActivation(ctx: SpouseActivationContext): SpouseActivationResult {
  const factors: SpouseActivationFactor[] = [];
  const dmEl = STEM_TO_ELEMENT[ctx.dayStem] as FiveElKey | undefined;
  const stabilityScore = clamp100(ctx.spousePalaceStabilityNow);

  if (!dmEl) {
    return {
      activationScore: 0,
      activationLevel: "낮음",
      stabilityScore,
      stabilityLevel: stabilityLevelFromScore(stabilityScore),
      factors: [],
      interpretation: "일간 정보가 없어 활성도를 계산할 수 없습니다.",
    };
  }

  const spouseStarEl: FiveElKey = ctx.gender === "여" ? getController(dmEl) : CONTROLS[dmEl];
  const { branch: dwBranch, stem: dwStem } = parsePillar(ctx.daewoonHangul);
  const { branch: seBranch, stem: seStem } = parsePillar(ctx.saeunHangul);
  const { branch: woBranch, stem: woStem } = parsePillar(ctx.wolunHangul);
  const { branch: ilBranch, stem: ilStem } = parsePillar(ctx.ilunHangul);

  // 1) 배우자궁(일지) 직접 자극 — 대운·세운(·월운·일운) 지지와 합·충·형·파·해·원진
  if (ctx.dayBranch) {
    const luckBranches: [string, string | undefined, number][] = [
      ["대운", dwBranch, 1],
      ["세운", seBranch, 1],
      ["월운", woBranch, WOLUN_SCALE],
      ["일운", ilBranch, ILUN_SCALE],
    ];
    for (const [luckLabel, lb, scale] of luckBranches) {
      if (!lb) continue;
      const rels = computeBranchRelations([ctx.dayBranch, lb]);
      for (const r of rels) {
        if (r.branch1 !== ctx.dayBranch && r.branch2 !== ctx.dayBranch) continue;
        const other = r.branch1 === ctx.dayBranch ? r.branch2 : r.branch1;
        if (other !== lb) continue;
        switch (r.type) {
          case "지지충":
            factors.push({ label: `배우자궁 ${luckLabel} 충 (${ctx.dayBranch}·${lb})`, magnitude: 16 * scale, direction: "비우호" });
            break;
          case "형":
            factors.push({ label: `배우자궁 ${luckLabel} 형 (${ctx.dayBranch}·${lb})`, magnitude: 9 * scale, direction: "비우호" });
            break;
          case "파":
            factors.push({ label: `배우자궁 ${luckLabel} 파 (${ctx.dayBranch}·${lb})`, magnitude: 6 * scale, direction: "비우호" });
            break;
          case "해":
            factors.push({ label: `배우자궁 ${luckLabel} 해 (${ctx.dayBranch}·${lb})`, magnitude: 5 * scale, direction: "비우호" });
            break;
          case "원진":
            factors.push({ label: `배우자궁 ${luckLabel} 원진 (${ctx.dayBranch}·${lb})`, magnitude: 5 * scale, direction: "비우호" });
            break;
          case "지지육합":
            factors.push({ label: `배우자궁 ${luckLabel} 합 (${ctx.dayBranch}·${lb})`, magnitude: 8 * scale, direction: "우호" });
            break;
          default:
            break;
        }
      }
    }
  }

  // 2) 배우자궁 + 대운 + 세운(+월운+일운) 삼합·방합 형성
  if (ctx.dayBranch && dwBranch && seBranch) {
    const trio = [...new Set([ctx.dayBranch, dwBranch, seBranch, woBranch, ilBranch].filter((b): b is string => !!b))];
    if (trio.length >= 2) {
      const rels3 = computeBranchRelations(trio);
      for (const r of rels3) {
        if (r.type !== "지지삼합" && r.type !== "지지방합") continue;
        const touchesDay = r.branch1 === ctx.dayBranch || r.branch2 === ctx.dayBranch;
        if (!touchesDay) continue;
        factors.push({ label: `배우자궁 관련 ${r.type} 형성 (${r.description})`, magnitude: 10, direction: "우호" });
      }
    }
  }

  // 3) 배우자성(여: 관성 / 남: 재성) 대운·세운·월운·일운 출현·생조
  const starLabel = ctx.gender === "여" ? "관성" : "재성";
  const isFavorableStarEl = spouseStarEl === ctx.yongshin || spouseStarEl === ctx.heesin;
  const isUnfavorableStarEl = ctx.gisin != null && spouseStarEl === ctx.gisin;
  for (const [luckLabel, pillarHangul, scale] of [
    ["대운", ctx.daewoonHangul, 1],
    ["세운", ctx.saeunHangul, 1],
    ["월운", ctx.wolunHangul, WOLUN_SCALE],
    ["일운", ctx.ilunHangul, ILUN_SCALE],
  ] as const) {
    const els = pillarElements(pillarHangul);
    if (els.length === 0) continue;
    if (els.includes(spouseStarEl)) {
      factors.push({
        label: `배우자성(${starLabel}) ${luckLabel} 출현`,
        magnitude: 10 * scale,
        direction: isFavorableStarEl ? "우호" : isUnfavorableStarEl ? "비우호" : "중립",
      });
    } else if (els.includes(getGenerator(spouseStarEl))) {
      factors.push({ label: `배우자성(${starLabel})을 생조하는 기운 ${luckLabel} 유입`, magnitude: 5 * scale, direction: "우호" });
    }
  }

  // 4) 원국 배우자성 글자와 대운·세운·월운·일운 천간의 합·충
  const spouseStemsInNatal = ctx.allStems.filter((s) => STEM_TO_ELEMENT[s] === spouseStarEl);
  for (const nStem of spouseStemsInNatal) {
    for (const [luckLabel, lStem, scale] of [
      ["대운", dwStem, 1],
      ["세운", seStem, 1],
      ["월운", woStem, WOLUN_SCALE],
      ["일운", ilStem, ILUN_SCALE],
    ] as const) {
      if (!lStem || lStem === nStem) continue;
      const rels = computeStemRelations([nStem, lStem]);
      for (const r of rels) {
        if (r.type === "천간합") {
          factors.push({ label: `원국 배우자성(${nStem}) ${luckLabel} 천간합`, magnitude: 9 * scale, direction: "우호" });
        } else if (r.type === "천간충") {
          factors.push({ label: `원국 배우자성(${nStem}) ${luckLabel} 천간충`, magnitude: 9 * scale, direction: "비우호" });
        }
      }
    }
  }

  // 5)+6) 복음(동일 간지) 계열 — 대운·세운끼리 같은 경우(5) + 대운·세운이 원국 일주(일간+일지,
  // 배우자궁·자기 자신이 합쳐진 자리)와 완전히 같은 경우(6, provisional: 세운=일주 +10 > 대운·세운
  // +8 = 대운=일주 +8). 세 조건은 등가관계라 dw=se이고 se=ilju면 dw=ilju도 자동 성립 — 즉 셋이
  // 동시에 성립하는 경우(대운=세운=원국 일주)만 실제로 겹칠 수 있다. 이때 evidence 라벨은 전부
  // 남기되, 같은 복음 계열이 숫자로 3중 누적되지 않도록 가장 강한 값 하나만 magnitude에 반영하고
  // 나머지는 magnitude 0(라벨은 유지, "중복 방지"로 표시)으로 둔다.
  const iljuHangul = ctx.dayBranch ? `${ctx.dayStem}${ctx.dayBranch}` : "";
  const bokeumHits: { label: string; magnitude: number }[] = [];
  if (ctx.daewoonHangul && ctx.saeunHangul && ctx.daewoonHangul === ctx.saeunHangul) {
    bokeumHits.push({ label: `대운·세운 복음(동일 간지 ${ctx.daewoonHangul}) — 테마 반복으로 강도 증폭`, magnitude: 8 });
  }
  if (iljuHangul && ctx.saeunHangul === iljuHangul) {
    bokeumHits.push({ label: `세운 일주 복음(원국 일주와 완전 동일 ${iljuHangul}) — 배우자궁·자기 테마 재현`, magnitude: 10 });
  }
  if (iljuHangul && ctx.daewoonHangul === iljuHangul) {
    bokeumHits.push({ label: `대운 일주 복음(원국 일주와 완전 동일 ${iljuHangul}) — 배우자궁·자기 테마 재현(10년 배경)`, magnitude: 8 });
  }
  if (bokeumHits.length > 0) {
    bokeumHits.sort((a, b) => b.magnitude - a.magnitude);
    bokeumHits.forEach((hit, i) => {
      factors.push({
        label: i === 0 ? hit.label : `${hit.label} (같은 복음 계열 중복 — 숫자 미반영)`,
        magnitude: i === 0 ? hit.magnitude : 0,
        direction: "중립",
      });
    });
  }

  const magnitudeSum = factors.reduce((sum, f) => sum + f.magnitude, 0);
  // 활성도는 "완전히 무자극"인 해에도 배경 수준의 기본값을 두고, 여기에 위 자극 총합을 더한다.
  const activationScore = clamp100(15 + magnitudeSum);
  const activationLevel = activationLevelFromScore(activationScore);
  const stabilityLevel = stabilityLevelFromScore(stabilityScore);

  const interpretation = buildInterpretation(activationLevel, stabilityLevel);

  return { activationScore, activationLevel, stabilityScore, stabilityLevel, factors, interpretation };
}

function buildInterpretation(activation: ActivationLevel, stability: StabilityLevel): string {
  if (activation === "높음" && stability === "안정") {
    return "배우자·파트너십 테마가 강하게 활성화되면서, 관계를 안정적으로 발전시키기에도 비교적 유리한 시기입니다.";
  }
  if (activation === "높음" && stability === "불안정") {
    return "배우자·파트너십 문제가 강하게 활성화되는 시기입니다. 다만 배우자궁 안정도가 낮아, 안정적인 관계 성사보다는 관계의 시작·종료·재정의·갈등·결단 등 변화 형태로 나타날 가능성도 있습니다.";
  }
  if (activation === "높음" && stability === "보통") {
    return "배우자·파트너십 관련 사건이나 고민이 많아질 수 있는 시기입니다. 안정도는 중간 수준이라, 어떻게 대응하느냐에 따라 관계가 다져질 수도, 흔들릴 수도 있습니다.";
  }
  if (activation === "낮음" && stability === "안정") {
    return "배우자 테마 자체는 상대적으로 조용한 시기이지만, 이미 진행 중인 관계는 안정적으로 유지되기 쉽습니다.";
  }
  if (activation === "낮음" && stability === "불안정") {
    return "배우자 테마가 전면에 크게 나서지는 않지만, 관계 안정도 자체는 낮은 편이라 잔잔한 긴장이 이어질 수 있습니다.";
  }
  if (activation === "보통" && stability === "안정") {
    return "배우자 테마가 무리 없이 흘러가며, 관계를 안정적으로 운영하기에 무난한 시기입니다.";
  }
  if (activation === "보통" && stability === "불안정") {
    return "배우자 관련 이슈가 간간이 떠오를 수 있고, 안정도가 낮아 사소한 마찰이 반복될 여지가 있습니다.";
  }
  return "배우자 테마가 두드러지지도, 크게 흔들리지도 않는 평이한 시기입니다.";
}

// ── 연도별(세운) 배우자·결혼 활성도 표 ──────────────────────────────
// 화면(운세 탭)과 클립보드 복사(개인/궁합 payload)가 서로 다른 로직을 쓰지 않도록,
// "향후 N년 세운별 활성도·안정도"를 계산하는 이 함수 하나만 양쪽에서 공유해서 부른다.

export interface SpouseActivationYearEntry {
  year: number;
  ganZhiHangul: string;
  daewoonHangul?: string;
  activation: SpouseActivationResult;
}

export interface SpouseActivationYearRangeContext {
  dayStem: string;
  dayBranch?: string;
  allStems: string[];
  gender: "남" | "여";
  /** 원국 evaluations — 화면·복사 어디서 호출하든 동일한 원국 값을 넘겨야 두 결과가 일치한다 */
  evaluations: RelationshipWealthEvaluations;
  yongshin: FiveElKey;
  heesin?: FiveElKey;
  gisin?: FiveElKey;
  birthYear: number;
  /** calculateLuckCycles(...).daewoon — 나이 보정 전 원본 배열(이 함수 안에서 보정한다) */
  daewoon: DaewoonEntry[];
  /** calculateLuckCycles(...).seun */
  seunEntries: { year: number; ganZhi: { hangul: string } }[];
  /** 표를 시작할 연도(보통 luckCycles.wolun.year = 실제 올해) */
  fromYear: number;
  /** 표시할 연도 수. 기본 10년 */
  count?: number;
}

export function computeSpouseActivationByYearRange(
  ctx: SpouseActivationYearRangeContext,
): SpouseActivationYearEntry[] {
  const dw0 = ctx.daewoon[0]?.startAge ?? 0;
  const adjustedDw = ctx.daewoon.map((entry, i) => ({
    ...entry,
    startAge: dw0 + i * 10,
    endAge: dw0 + i * 10 + 9,
  }));
  const count = ctx.count ?? 10;

  return ctx.seunEntries
    .filter((e) => e.year >= ctx.fromYear)
    .slice(0, count)
    .map((e) => {
      const age = e.year - ctx.birthYear;
      const dw = adjustedDw.find((d) => age >= d.startAge && age <= d.endAge);
      const timing = computeLuckTimingActivation(
        ctx.evaluations,
        dw?.ganZhi.hangul,
        e.ganZhi.hangul,
        ctx.dayStem,
        ctx.dayBranch,
        ctx.yongshin,
        ctx.heesin,
        ctx.gisin,
      );
      const activation = computeSpouseActivation({
        dayStem: ctx.dayStem,
        dayBranch: ctx.dayBranch,
        allStems: ctx.allStems,
        gender: ctx.gender,
        daewoonHangul: dw?.ganZhi.hangul,
        saeunHangul: e.ganZhi.hangul,
        yongshin: ctx.yongshin,
        heesin: ctx.heesin,
        gisin: ctx.gisin,
        spousePalaceStabilityNow: timing.spousePalaceStabilityNow,
      });
      return { year: e.year, ganZhiHangul: e.ganZhi.hangul, daewoonHangul: dw?.ganZhi.hangul, activation };
    });
}

/** 활성도 기준 내림차순 상위 N개 연도만 뽑는다(랭킹 표시용). */
export function topSpouseActivationYears(
  entries: SpouseActivationYearEntry[],
  n = 3,
): SpouseActivationYearEntry[] {
  return [...entries].sort((a, b) => b.activation.activationScore - a.activation.activationScore).slice(0, n);
}
