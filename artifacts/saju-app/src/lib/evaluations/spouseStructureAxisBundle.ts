/**
 * 배우자 구조 3축(practical / emotional / image) — 원국 복합 단일 인물용.
 * 궁합 엔진에서 두 명 각각에 대해 호출한 뒤 교차 비교할 수 있도록 lib에서 export 합니다.
 */

import type { FiveElementCount } from "../sajuEngine";
import { countFiveElements, type ComputedPillars } from "../sajuEngine";
import {
  BRANCH_TO_ELEMENT,
  STEM_TO_ELEMENT,
  getController,
  getTenGodGroup,
  type FiveElKey,
} from "../element-color";
import { computeBranchRelations } from "../branchRelations";
import { getTenGod, type TenGod } from "../tenGods";
import { getHiddenStems } from "../hiddenStems";
import { calculateShinsalFull } from "../luckCycles";
import { computePersonPipelineSnapshot } from "../personPipelineSnapshot";
import { getSpousePalaceInfo } from "../relationshipReport";
import type { PersonRecord } from "../storage";
import { getFinalPillars } from "../storage";
import type { RelationshipWealthEvaluations } from "./relationshipWealthEvaluation";

// ── 십성 집합(이 파일 전용) ─────────────────────────────────────────────

const SIK_SANG_SET = new Set<TenGod>(["식신", "상관"]);
const IN_SET = new Set<TenGod>(["정인", "편인"]);
const JAE_SET = new Set<TenGod>(["정재", "편재"]);
const SANG_ONLY_SET = new Set<TenGod>(["상관"]);

function countTenGodsInChars(dayStem: string, chars: string[], set: Set<TenGod>): number {
  let n = 0;
  for (const c of chars) {
    const tg = getTenGod(dayStem, c);
    if (tg && set.has(tg)) n++;
  }
  return n;
}

/** 배우자 카드 합성문 등에서 재사용 */
export function countTenGodsOnStems(dayStem: string, stems: string[], set: ReadonlySet<TenGod>): number {
  let n = 0;
  for (const s of stems) {
    const t = getTenGod(dayStem, s);
    if (t && set.has(t)) n++;
  }
  return n;
}

/** 배우자 카드 합성문 등에서 재사용 */
export function countTenGodsOnBranchesWithHidden(
  dayStem: string,
  branches: string[],
  set: ReadonlySet<TenGod>,
): number {
  let n = 0;
  for (const b of branches) {
    const t = getTenGod(dayStem, b);
    if (t && set.has(t)) n++;
    for (const h of getHiddenStems(b)) {
      const t2 = getTenGod(dayStem, h);
      if (t2 && set.has(t2)) n++;
    }
  }
  return n;
}

function dayBranchStressPenalty(dayBranch: string, allBranches: string[]): number {
  const uniq = [...new Set(allBranches.filter(Boolean))];
  if (!dayBranch || uniq.length < 2) return 0;
  const rels = computeBranchRelations(uniq);
  let pen = 0;
  for (const r of rels) {
    if (r.branch1 !== dayBranch && r.branch2 !== dayBranch) continue;
    if (r.type === "지지충" || r.type === "충") pen += 14;
    if (r.type === "형") pen += 9;
    if (r.type === "파" || r.type === "해") pen += 6;
  }
  return Math.min(34, pen);
}

const SPOUSE_GUIMOON_PAIR: Record<string, string> = {
  자: "유",
  유: "자",
  축: "오",
  오: "축",
  인: "미",
  미: "인",
  묘: "신",
  신: "묘",
  진: "해",
  해: "진",
  사: "술",
  술: "사",
};

function spouseDayBranchEmotionalLoad(dayBranch: string, allBranches: string[]): number {
  const uniq = [...new Set(allBranches.filter(Boolean))];
  if (!dayBranch || uniq.length < 2) return 0;
  const rels = computeBranchRelations(uniq);
  let pen = 0;
  for (const r of rels) {
    if (r.branch1 !== dayBranch && r.branch2 !== dayBranch) continue;
    if (r.branch1 === r.branch2) continue;
    if (r.type === "원진") pen += 9;
    if (r.type === "해") pen += 6;
    if (r.type === "형") pen += 5;
    if (r.type === "파") pen += 4;
  }
  const gm = SPOUSE_GUIMOON_PAIR[dayBranch];
  if (gm && uniq.some((b) => b !== dayBranch && b === gm)) pen += 5;
  return Math.min(32, pen);
}

/** 관·재 천간 / 지지(표면+지장간) 건수 — 배우자 합성문에서도 사용 */
export function countOfficerWealthStemBranch(
  dayStem: string,
  allStems: string[],
  allBranches: string[],
): {
  gwanStem: number;
  gwanBranchSurface: number;
  gwanBranchHidden: number;
  jaeStem: number;
  jaeBranchSurface: number;
  jaeBranchHidden: number;
} {
  const dm = STEM_TO_ELEMENT[dayStem] as FiveElKey | undefined;
  const z = {
    gwanStem: 0,
    gwanBranchSurface: 0,
    gwanBranchHidden: 0,
    jaeStem: 0,
    jaeBranchSurface: 0,
    jaeBranchHidden: 0,
  };
  if (!dm) return z;
  for (const s of allStems) {
    const el = STEM_TO_ELEMENT[s] as FiveElKey | undefined;
    if (!el) continue;
    const g = getTenGodGroup(dm, el);
    if (g === "관성") z.gwanStem++;
    if (g === "재성") z.jaeStem++;
  }
  for (const b of allBranches) {
    const surf = BRANCH_TO_ELEMENT[b] as FiveElKey | undefined;
    if (surf) {
      const g0 = getTenGodGroup(dm, surf);
      if (g0 === "관성") z.gwanBranchSurface++;
      if (g0 === "재성") z.jaeBranchSurface++;
    }
    for (const h of getHiddenStems(b)) {
      const hel = STEM_TO_ELEMENT[h] as FiveElKey | undefined;
      if (!hel) continue;
      const g1 = getTenGodGroup(dm, hel);
      if (g1 === "관성") z.gwanBranchHidden++;
      if (g1 === "재성") z.jaeBranchHidden++;
    }
  }
  return z;
}

/** 일지에 닿는 합·충·형·파·해·원진·귀문 요약 */
export function spouseDayBranchRelationDigest(dayBranch: string, allBranches: string[]): string {
  const uniq = [...new Set(allBranches.filter(Boolean))];
  if (!dayBranch || uniq.length < 2) return "일지 인접 관계: 정보 부족";
  const rels = computeBranchRelations(uniq);
  const types = new Set<string>();
  for (const r of rels) {
    if (r.branch1 !== dayBranch && r.branch2 !== dayBranch) continue;
    if (r.branch1 === r.branch2) continue;
    if (r.type === "지지충" || r.type === "충") types.add("충");
    else if (r.type === "지지육합" || r.type === "지지삼합" || r.type === "지지방합" || r.type === "합")
      types.add("합");
    else if (r.type === "형") types.add("형");
    else if (r.type === "파") types.add("파");
    else if (r.type === "해") types.add("해");
    else if (r.type === "원진") types.add("원진");
  }
  const gm = SPOUSE_GUIMOON_PAIR[dayBranch];
  if (gm && uniq.some((b) => b !== dayBranch && b === gm)) types.add("귀문쌍");
  if (types.size === 0) return "일지 인접: 합·충·형·파·해·원진·귀문이 두드러지지 않음";
  return `일지 인접 신호: ${[...types].join("·")}`;
}

function spouseBranchCarriesElement(branch: string, el: FiveElKey): boolean {
  const surf = BRANCH_TO_ELEMENT[branch] as FiveElKey | undefined;
  if (surf === el) return true;
  for (const h of getHiddenStems(branch)) {
    if ((STEM_TO_ELEMENT[h] as FiveElKey | undefined) === el) return true;
  }
  return false;
}

function spouseDayBranchHasHap(dayBranch: string, allBranches: string[]): boolean {
  const uniq = [...new Set(allBranches.filter(Boolean))];
  if (!dayBranch || uniq.length < 2) return false;
  const rels = computeBranchRelations(uniq);
  for (const r of rels) {
    if (r.branch1 !== dayBranch && r.branch2 !== dayBranch) continue;
    if (r.branch1 === r.branch2) continue;
    if (
      r.type === "지지육합" ||
      r.type === "지지삼합" ||
      r.type === "지지방합" ||
      r.type === "합"
    ) {
      return true;
    }
  }
  return false;
}

function spouseDayBranchHasHyungEdge(dayBranch: string, allBranches: string[]): boolean {
  const uniq = [...new Set(allBranches.filter(Boolean))];
  if (!dayBranch || uniq.length < 2) return false;
  const rels = computeBranchRelations(uniq);
  for (const r of rels) {
    if (r.branch1 === r.branch2) continue;
    if (r.type !== "형") continue;
    if (r.branch1 === dayBranch || r.branch2 === dayBranch) return true;
  }
  return false;
}

function spouseOfficerBranchChungsDayBranch(
  dayBranch: string,
  allBranches: string[],
  officerEl: FiveElKey,
): boolean {
  const uniq = [...new Set(allBranches.filter(Boolean))];
  if (!dayBranch || uniq.length < 2) return false;
  const rels = computeBranchRelations(uniq);
  for (const r of rels) {
    if (r.type !== "지지충" && r.type !== "충") continue;
    const a = r.branch1;
    const b = r.branch2;
    if (a !== dayBranch && b !== dayBranch) continue;
    const other = a === dayBranch ? b : a;
    if (other !== dayBranch && spouseBranchCarriesElement(other, officerEl)) return true;
  }
  return false;
}

export type SpouseStructureAxisScores = {
  practical: number;
  emotional: number;
  image: number;
  wAct: number;
  oAct: number;
  sPal: number;
  stressPen: number;
  emotionalLoad: number;
  sikCount: number;
  injCount: number;
};

export type SpouseStructureAxisDebug = {
  spouseStabilitySource: "computeSpousePalaceStability";
  romanceDomainSurrogateScore: number | null;
  officerWealthStemBranch: ReturnType<typeof countOfficerWealthStemBranch>;
  injStem: number;
  injBranch: number;
  sikStem: number;
  sikBranch: number;
  dayBranchDigest: string;
  practicalFormula: string;
  emotionalFormula: string;
  imageFormula: string;
  evaluationDebugTail: string[];
};

/** 궁합·리포트 교차용 3축만 (0~100) */
export type SpouseStructureAxisBundle = {
  practical: number;
  emotional: number;
  image: number;
};

export function toSpouseStructureAxisBundle(scores: SpouseStructureAxisScores): SpouseStructureAxisBundle {
  return {
    practical: scores.practical,
    emotional: scores.emotional,
    image: scores.image,
  };
}

export type ComputeSpouseStructureAxisBundleInput = {
  dayStem: string;
  dayBranch: string;
  allChars: string[];
  allStems: string[];
  allBranches: string[];
  counts: FiveElementCount;
  evaluations: RelationshipWealthEvaluations | null | undefined;
  shinsalNames: Set<string>;
  spouseElement?: string;
  tenGodGroups?: Record<string, number> | null;
};

export type ComputeSpouseStructureAxisBundleResult = {
  scores: SpouseStructureAxisScores;
  axisDebug: SpouseStructureAxisDebug;
  /** 궁합 등에서 A·B 각각에 대해 교차 비교할 때 사용 */
  spouseStructureAxisBundle: SpouseStructureAxisBundle;
};

/**
 * 배우자 구조 3축 (UI: 현실 궁합 / 정서 궁합 / 매력 궁합) — 원국 복합만 (대운 제외).
 * practical: 생활 안정·책임 구조 가능성 — 재·관·식상·합·재관 연동·일지 재·관성충 등
 * emotional: 감정 소통·관계 안정 가능성 — 배우자궁 안정 가중·관·비겁·상관·합충·형·관성충 등
 * image: 끌림·이미지 매력 형성 구조 — 도화·홍염·금·식상·일지·긴장 완화 등
 */
export function computeSpouseStructureAxisBundle(
  input: ComputeSpouseStructureAxisBundleInput,
): ComputeSpouseStructureAxisBundleResult {
  const ev = input.evaluations;
  const wAct = ev?.wealthActivation?.score ?? 52;
  const oAct = ev?.officerActivation?.score ?? 52;
  const sPal = ev?.spousePalaceStability?.score ?? 52;
  const romanceSurrogate = ev?.spousePalaceRomanceDomainSurrogateScore ?? null;
  const stem = input.dayStem;
  const dayB = input.dayBranch;
  const stressPen = dayBranchStressPenalty(dayB, input.allBranches);
  const emotionalLoad = spouseDayBranchEmotionalLoad(dayB, input.allBranches);
  const ow = countOfficerWealthStemBranch(stem, input.allStems, input.allBranches);
  const dm = STEM_TO_ELEMENT[stem] as FiveElKey | undefined;
  const officerEl = dm ? getController(dm) : undefined;
  const officerChung =
    !!officerEl && spouseOfficerBranchChungsDayBranch(dayB, input.allBranches, officerEl);
  const dayHap = spouseDayBranchHasHap(dayB, input.allBranches);
  const dayHyungEdge = spouseDayBranchHasHyungEdge(dayB, input.allBranches);

  let jaeAdj = 0;
  if (stem && dayB) {
    const tg = getTenGod(stem, dayB);
    if (tg && JAE_SET.has(tg)) jaeAdj = 7;
  }

  const jaeTotal = ow.jaeStem + ow.jaeBranchSurface + ow.jaeBranchHidden;
  const gwanTotal = ow.gwanStem + ow.gwanBranchSurface + ow.gwanBranchHidden;
  const sikAll = countTenGodsInChars(stem, input.allChars, SIK_SANG_SET);
  const sikStem = countTenGodsOnStems(stem, input.allStems, SIK_SANG_SET);
  const sikBranch = countTenGodsOnBranchesWithHidden(stem, input.allBranches, SIK_SANG_SET);
  const shengCaiBonus = sikAll >= 1 && jaeTotal >= 1 ? 9 : sikAll >= 2 ? 4 : 0;
  const caiGuanTogether = jaeTotal >= 1 && gwanTotal >= 1 && oAct >= 50 ? 6 : 0;
  const hapBonus = dayHap ? 6 : 0;

  let practical =
    32 +
    0.24 * wAct +
    0.2 * oAct +
    0.11 * sPal +
    Math.min(13, ow.jaeStem * 2.3 + ow.jaeBranchSurface * 0.95 + ow.jaeBranchHidden * 0.42) +
    jaeAdj +
    shengCaiBonus +
    caiGuanTogether +
    hapBonus -
    0.1 * stressPen;
  if (officerChung) practical -= 5;
  practical = Math.max(0, Math.min(100, Math.round(practical)));

  const injAll = countTenGodsInChars(stem, input.allChars, IN_SET);
  const injStem = countTenGodsOnStems(stem, input.allStems, IN_SET);
  const injBranch = countTenGodsOnBranchesWithHidden(stem, input.allBranches, IN_SET);
  let injBlend = 0;
  if (injAll >= 1 && injAll <= 3) injBlend = 11;
  else if (injAll === 0) injBlend = -7;
  else injBlend = 2;
  injBlend += Math.round((injStem - injBranch) * 0.35);

  const sikBlend = Math.min(15, Math.round(sikAll * 4 + sikStem * 0.55));

  const tGodSum =
    input.tenGodGroups && dm
      ? Object.values(input.tenGodGroups).reduce((a, b) => a + b, 0) || 1
      : 0;
  const bijobRatio =
    tGodSum > 0 && input.tenGodGroups ? (input.tenGodGroups.비겁 ?? 0) / tGodSum : 0;
  const sangOnly = countTenGodsInChars(stem, input.allChars, SANG_ONLY_SET);

  let emotional =
    36 +
    0.48 * sPal +
    0.09 * oAct +
    0.12 * (100 - stressPen) -
    0.82 * emotionalLoad +
    injBlend * 0.65 +
    sikBlend * 0.28;
  emotional -= bijobRatio >= 0.36 ? 14 : bijobRatio >= 0.28 ? 8 : bijobRatio >= 0.22 ? 4 : 0;
  emotional -= sangOnly >= 2 ? 11 : sangOnly === 1 ? 5 : 0;
  emotional -= officerChung ? 6 : 0;
  if (dayHyungEdge) emotional -= 4;
  emotional = Math.max(0, Math.min(100, Math.round(emotional)));

  const total = Object.values(input.counts).reduce((a, b) => a + b, 0) || 1;
  const metalRatio = input.counts.금 / total;
  const woodFire = (input.counts.목 + input.counts.화) / total;
  const calmImage =
    Math.round((100 - stressPen) * 0.05 + (32 - Math.min(32, emotionalLoad)) * 0.1);

  let image =
    24 +
    Math.min(20, Math.round(sikAll * 3.8 + sikBranch * 0.48)) +
    metalRatio * 34 +
    woodFire * 13 +
    calmImage;
  if (input.shinsalNames.has("도화")) image += 14;
  if (input.shinsalNames.has("홍염")) image += 11;
  const spEl = input.spouseElement;
  if (spEl === "금" || spEl === "수") image += 5;
  if (spEl === "화" || spEl === "목") image += 4;
  if (spEl === "토") image += 2;
  if (dayB && ["유", "신", "오", "묘"].includes(dayB)) image += 5;
  else if (dayB && ["자", "해", "미"].includes(dayB)) image += 3;
  if (dayHap) image += 3;

  image = Math.max(0, Math.min(100, Math.round(image)));

  const scores: SpouseStructureAxisScores = {
    practical,
    emotional,
    image,
    wAct,
    oAct,
    sPal,
    stressPen,
    emotionalLoad,
    sikCount: sikAll,
    injCount: injAll,
  };

  const digest = spouseDayBranchRelationDigest(dayB, input.allBranches);
  const evalDbg = ev?.spousePalaceStability?.debug ?? [];

  const axisDebug: SpouseStructureAxisDebug = {
    spouseStabilitySource: "computeSpousePalaceStability",
    romanceDomainSurrogateScore: romanceSurrogate,
    officerWealthStemBranch: ow,
    injStem,
    injBranch,
    sikStem,
    sikBranch,
    dayBranchDigest: digest,
    practicalFormula: `현실궁합≈재·관·식상생재(${shengCaiBonus})·재관연동(${caiGuanTogether})·합(+${hapBonus})·일지재(${jaeAdj})−긴장−관성충(${officerChung ? "Y" : "N"})`,
    emotionalFormula: `정서궁합≈0.48×배우자궁(${sPal})+인·식 보조−정서부담−비겁과다(${bijobRatio.toFixed(2)})−상관(${sangOnly})−형·관충`,
    imageFormula: `매력궁합≈금비율·식상·신살·일지·이미지안정(${calmImage})`,
    evaluationDebugTail: evalDbg.slice(-6),
  };

  return {
    scores,
    axisDebug,
    spouseStructureAxisBundle: toSpouseStructureAxisBundle(scores),
  };
}

// ── PersonRecord → 동일 입력(원국 카드·computePersonPipelineSnapshot)으로 3축 산출 ──

/**
 * `getFinalPillars` + `computePersonPipelineSnapshot`의 evaluations·십성 그룹과,
 * 리포트 원국과 동일한 allChars/allStems/allBranches·신살(자동+수동−제외)로 3축을 계산합니다.
 * 궁합 메인 점수와는 별도(보조 비교용).
 */
export function computeSpouseStructureAxisBundleFromPersonRecord(
  record: PersonRecord,
): SpouseStructureAxisBundle | null {
  const pillars = getFinalPillars(record);
  const dayStem = pillars.day?.hangul?.[0] ?? "";
  const dayBranch = pillars.day?.hangul?.[1] ?? "";
  if (!dayStem || !dayBranch) return null;

  const pipe = computePersonPipelineSnapshot(record);
  if (!pipe?.evaluations) return null;

  const allChars = [
    pillars.hour?.hangul?.[0],
    pillars.hour?.hangul?.[1],
    pillars.day?.hangul?.[1],
    pillars.month?.hangul?.[0],
    pillars.month?.hangul?.[1],
    pillars.year?.hangul?.[0],
    pillars.year?.hangul?.[1],
  ].filter((c): c is string => !!c);

  const allStems = [
    pillars.hour?.hangul?.[0],
    dayStem,
    pillars.month?.hangul?.[0],
    pillars.year?.hangul?.[0],
  ].filter((c): c is string => !!c);

  const allBranches = [
    pillars.hour?.hangul?.[1],
    dayBranch,
    pillars.month?.hangul?.[1],
    pillars.year?.hangul?.[1],
  ].filter((c): c is string => !!c);

  const counts = countFiveElements(pillars as ComputedPillars);
  const shinsalMode = record.fortuneOptions?.shinsalMode ?? "default";
  const shinsalFull = calculateShinsalFull(
    dayStem,
    dayBranch,
    record.birthInput.month,
    [
      { pillar: "년주", stem: pillars.year?.hangul?.[0] ?? "", branch: pillars.year?.hangul?.[1] ?? "" },
      { pillar: "월주", stem: pillars.month?.hangul?.[0] ?? "", branch: pillars.month?.hangul?.[1] ?? "" },
      { pillar: "일주", stem: pillars.day?.hangul?.[0] ?? "", branch: pillars.day?.hangul?.[1] ?? "" },
      { pillar: "시주", stem: pillars.hour?.hangul?.[0] ?? "", branch: pillars.hour?.hangul?.[1] ?? "" },
    ],
    shinsalMode,
  );
  const shinsalNames = new Set<string>();
  for (const ps of shinsalFull) {
    for (const n of ps.stemItems) shinsalNames.add(n);
    for (const n of ps.branchItems) shinsalNames.add(n);
    for (const n of ps.pillarItems) shinsalNames.add(n);
  }
  for (const it of record.manualShinsal ?? []) {
    if (it?.name) shinsalNames.add(it.name);
  }
  for (const it of record.excludedAutoShinsal ?? []) {
    if (it?.name) shinsalNames.delete(it.name);
  }

  const spousePalace = getSpousePalaceInfo(dayBranch);

  return computeSpouseStructureAxisBundle({
    dayStem,
    dayBranch,
    allChars,
    allStems,
    allBranches,
    counts,
    evaluations: pipe.evaluations,
    shinsalNames,
    spouseElement: spousePalace?.element,
    tenGodGroups: pipe.base?.tenGodGroups ?? null,
  }).spouseStructureAxisBundle;
}
