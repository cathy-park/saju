/**
 * 원국 기반 보조 점수: 관성 작동 / 배우자궁 안정 / 재성 작동.
 * 강약·격국·용신 계산에는 사용하지 않으며 해석 보조 지표로만 쓴다.
 */

import type { FiveElementCount } from "../sajuEngine";
import {
  type FiveElKey,
  CONTROLS,
  getController,
  getGenerator,
  getTenGodGroup,
  STEM_TO_ELEMENT,
  BRANCH_TO_ELEMENT,
} from "../element-color";
import { computeBranchRelations, type BranchRelation } from "../branchRelations";

const ELEMENT_KO_SHORT: Record<FiveElKey, string> = {
  목: "목", 화: "화", 토: "토", 금: "금", 수: "수",
};

// ── 지장간 (interpretSchema / pipeline과 동일 순서) ─────────────────
const JIJANGGAN: Record<string, string[]> = {
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

const CHUNG_PARTNER: Record<string, string> = {
  자: "오", 오: "자", 축: "미", 미: "축",
  인: "신", 신: "인", 묘: "유", 유: "묘",
  진: "술", 술: "진", 사: "해", 해: "사",
};

/** 귀문관살 쌍 (일지 스트레스 보조) */
const GUIMOON_PAIR: Record<string, string> = {
  자: "유", 유: "자",
  축: "오", 오: "축",
  인: "미", 미: "인",
  묘: "신", 신: "묘",
  진: "해", 해: "진",
  사: "술", 술: "사",
};

export type ActivationGrade = "매우약함" | "약함" | "보통" | "양호" | "강함";

export interface ActivationEvaluation {
  score: number;
  grade: ActivationGrade;
  positives: string[];
  negatives: string[];
  summary: string;
  /** 가점·감점 근거(검증·리포트용) */
  debug: string[];
}

export interface RelationshipWealthEvaluations {
  officerActivation: ActivationEvaluation;
  spousePalaceStability: ActivationEvaluation;
  wealthActivation: ActivationEvaluation;
}

export interface RelationshipWealthEvaluationInput {
  dayStem: string;
  dayBranch?: string;
  monthBranch?: string;
  allStems: string[];
  allBranches: string[];
  effectiveFiveElements: FiveElementCount;
  yongshinPrimary: FiveElKey;
  yongshinSecondary?: FiveElKey;
  /** 일주 공망 판정용 (예: "정미") */
  dayPillarHangul?: string;
  /** 십성 그룹 카운트(표면 분포) — 설기·재성 보완 판단 */
  tenGodGroups?: Record<string, number>;
}

function clampScore(n: number): number {
  return Math.max(0, Math.min(100, Math.round(n)));
}

function gradeFromScore(s: number): ActivationGrade {
  if (s >= 80) return "강함";
  if (s >= 65) return "양호";
  if (s >= 50) return "보통";
  if (s >= 35) return "약함";
  return "매우약함";
}

function stemEl(ch: string): FiveElKey | undefined {
  return STEM_TO_ELEMENT[ch] as FiveElKey | undefined;
}

function branchSurfaceEl(b: string): FiveElKey | undefined {
  return BRANCH_TO_ELEMENT[b] as FiveElKey | undefined;
}

function branchCarriesElement(branch: string, el: FiveElKey): boolean {
  const surf = branchSurfaceEl(branch);
  if (surf === el) return true;
  const hid = JIJANGGAN[branch] ?? [];
  for (const h of hid) {
    if (stemEl(h) === el) return true;
  }
  return false;
}

/** 시지 추론: [시,일,월,년] 이고 일지가 index 1일 때만 */
function inferHourBranch(allBranches: string[], dayBranch?: string): string | undefined {
  if (allBranches.length >= 4 && dayBranch && allBranches[1] === dayBranch) {
    return allBranches[0];
  }
  return undefined;
}

function isFavorableElement(
  el: FiveElKey,
  primary: FiveElKey,
  secondary?: FiveElKey,
): boolean {
  return el === primary || el === secondary;
}

/** 용신을 극하는 오행(용신 소모)을 단순 구신 후보로 사용 */
function isRoughUnfavorableToYongshin(el: FiveElKey, yongshinPrimary: FiveElKey): boolean {
  return getController(yongshinPrimary) === el;
}

function relationsTouchingBranch(
  rels: BranchRelation[],
  branch: string,
): BranchRelation[] {
  return rels.filter(
    (r) =>
      (r.branch1 === branch || r.branch2 === branch)
      && r.branch1 !== r.branch2,
  );
}

function relationsForDaySelf(rels: BranchRelation[], dayBranch: string): BranchRelation[] {
  return rels.filter((r) => r.branch1 === dayBranch && r.branch2 === dayBranch);
}

function hasChungWithOther(branch: string, allBranches: string[]): boolean {
  const p = CHUNG_PARTNER[branch];
  return !!p && allBranches.some((b) => b !== branch && b === p);
}

function officerStemCount(dayMasterEl: FiveElKey, stems: string[]): number {
  let n = 0;
  for (const s of stems) {
    const e = stemEl(s);
    if (e && getTenGodGroup(dayMasterEl, e) === "관성") n++;
  }
  return n;
}

function wealthStemCount(dayMasterEl: FiveElKey, stems: string[]): number {
  let n = 0;
  for (const s of stems) {
    const e = stemEl(s);
    if (e && getTenGodGroup(dayMasterEl, e) === "재성") n++;
  }
  return n;
}

function officerBranchCount(officerEl: FiveElKey, branches: string[]): number {
  let n = 0;
  for (const b of branches) {
    if (branchCarriesElement(b, officerEl)) n++;
  }
  return n;
}

function wealthBranchCount(wealthEl: FiveElKey, branches: string[]): number {
  let n = 0;
  for (const b of branches) {
    if (branchCarriesElement(b, wealthEl)) n++;
  }
  return n;
}

function countElementInChart(
  el: FiveElKey,
  stems: string[],
  branches: string[],
): number {
  let n = 0;
  for (const s of stems) {
    if (stemEl(s) === el) n++;
  }
  for (const b of branches) {
    if (branchCarriesElement(b, el)) n++;
  }
  return n;
}

/** 대상 오행 또는 그 인성(생기)이 참여하는 지지 합(육·삼·방) 존재 */
function hasSupportiveCombineForElement(
  el: FiveElKey,
  _branches: string[],
  branchRels: BranchRelation[],
): boolean {
  const gen = getGenerator(el);
  const goodTypes = new Set<BranchRelation["type"]>(["지지육합", "지지삼합", "지지방합"]);
  for (const r of branchRels) {
    if (!goodTypes.has(r.type)) continue;
    const a = r.branch1;
    const b = r.branch2;
    if (a === b) continue;
    if (branchCarriesElement(a, el) || branchCarriesElement(b, el)) return true;
    if (branchCarriesElement(a, gen) || branchCarriesElement(b, gen)) return true;
  }
  return false;
}

function branchesWithElement(branches: string[], el: FiveElKey): string[] {
  return branches.filter((b) => branchCarriesElement(b, el));
}

function computeOfficerActivation(ctx: {
  dayStem: string;
  dayMasterEl: FiveElKey;
  officerEl: FiveElKey;
  allStems: string[];
  allBranches: string[];
  monthBranch?: string;
  dayBranch?: string;
  hourBranch?: string;
  yongshinPrimary: FiveElKey;
  yongshinSecondary?: FiveElKey;
  tenGodGroups: Record<string, number>;
  effectiveFiveElements: FiveElementCount;
}): ActivationEvaluation {
  const debug: string[] = [];
  const positives: string[] = [];
  const negatives: string[] = [];
  let raw = 50;

  const { officerEl, dayMasterEl } = ctx;
  const genOff = getGenerator(officerEl);

  const ocStems = officerStemCount(dayMasterEl, ctx.allStems);
  if (ocStems >= 1) {
    raw += 10;
    debug.push(`관성 천간 ${ocStems}개: +10`);
    positives.push("관성 천간 존재");
  } else {
    negatives.push("관성 천간 부재");
    debug.push("관성 천간 없음: 가점 없음");
  }
  if (ocStems >= 2) {
    raw += 5;
    debug.push("관성 천간 다중: +5");
  }

  const ocBranches = officerBranchCount(officerEl, ctx.allBranches);
  if (ocBranches >= 1) {
    raw += 12;
    debug.push(`관성 지지(표면·지장간) ${ocBranches}곳: +12`);
    positives.push("관성 지지 존재");
  } else {
    negatives.push("관성 지지 약함");
  }
  if (ocBranches >= 2) {
    raw += 4;
    debug.push("관성 지지 복수: +4");
  }

  let officerRootHidden = false;
  for (const b of ctx.allBranches) {
    const surf = branchSurfaceEl(b);
    const hid = JIJANGGAN[b] ?? [];
    if (surf !== officerEl && hid.some((h) => stemEl(h) === officerEl)) {
      officerRootHidden = true;
      break;
    }
  }
  if (officerRootHidden) {
    raw += 8;
    debug.push("관성 지장간 통근: +8");
    positives.push("관성 통근(지장간)");
  }

  if (countElementInChart(genOff, ctx.allStems, ctx.allBranches) > 0) {
    raw += 6;
    debug.push(`관성 인성(생기) ${ELEMENT_KO_SHORT[genOff]} 존재: +6`);
    positives.push("관성에 생기(인성) 연결");
  }

  const branchRels = computeBranchRelations(ctx.allBranches);
  if (hasSupportiveCombineForElement(officerEl, ctx.allBranches, branchRels)) {
    raw += 6;
    debug.push("관성 관련 지지 합(육·삼·방) 연계: +6");
    positives.push("관성 쪽 합·생 연계");
  }

  const officerBranchList = branchesWithElement(ctx.allBranches, officerEl);
  let officerChung = false;
  for (const b of officerBranchList) {
    if (hasChungWithOther(b, ctx.allBranches)) {
      officerChung = true;
      break;
    }
  }
  if (officerChung) {
    raw -= 12;
    debug.push("관성 지지 충: −12");
    negatives.push("관성 지지 충");
  } else {
    positives.push("관성 지지 직접 충 없음");
  }

  const stressTypes = new Set<BranchRelation["type"]>(["형", "파", "해"]);
  let stress = 0;
  for (const b of officerBranchList) {
    for (const r of relationsTouchingBranch(branchRels, b)) {
      if (stressTypes.has(r.type)) stress++;
    }
  }
  if (stress > 0) {
    const pen = Math.min(15, stress * 5);
    raw -= pen;
    debug.push(`관성 지지 형·파·해 누적 ${stress}건: −${pen}`);
    negatives.push("관성 지지 형·파·해 부담");
  }

  const 식 = ctx.tenGodGroups["식상"] ?? 0;
  const 재 = ctx.tenGodGroups["재성"] ?? 0;
  const 관 = ctx.tenGodGroups["관성"] ?? 0;
  if (식 + 재 > 관 * 2 + 4) {
    raw -= 8;
    debug.push("식상·재성 과다(설기 우려): −8");
    negatives.push("식상·재성 과다로 관성 설기");
  }

  if (ctx.monthBranch && branchSurfaceEl(ctx.monthBranch) === officerEl) {
    raw += 5;
    debug.push("월령 관성 표면: +5");
  }
  if (ctx.dayBranch && branchSurfaceEl(ctx.dayBranch) === officerEl) {
    raw += 8;
    debug.push("일지 관성 표면: +8");
  }
  if (ctx.hourBranch && branchSurfaceEl(ctx.hourBranch) === officerEl) {
    raw += 4;
    debug.push("시지 관성 표면: +4");
  }

  const officerPresence = countElementInChart(officerEl, ctx.allStems, ctx.allBranches);
  if (officerPresence === 0) {
    raw -= 18;
    debug.push("원국 관성 오행 전무: −18");
    negatives.push("원국에 관성 오행 부재");
  }

  const waterCount =
    (ctx.effectiveFiveElements?.["수"] ?? 0);
  if (officerEl === "수" && waterCount <= 0.5) {
    raw -= 6;
    debug.push("수(관성) 표면 분포 극소: −6");
    negatives.push("수기 표면 극소");
  }

  if (isFavorableElement(officerEl, ctx.yongshinPrimary, ctx.yongshinSecondary)) {
    raw += 10;
    debug.push("관성=용신·희신 계열: +10");
    positives.push("관성이 용신·희신 계열");
  }
  if (isRoughUnfavorableToYongshin(officerEl, ctx.yongshinPrimary)) {
    raw -= 8;
    debug.push("관성이 용신을 극(구신 성향): −8");
    negatives.push("관성이 용신과 상충 성향");
  }

  const score = clampScore(raw);
  const grade = gradeFromScore(score);
  const summary = summarizeOfficer(grade, score, positives, negatives);
  return { score, grade, positives, negatives, summary, debug };
}

function summarizeOfficer(
  grade: ActivationGrade,
  score: number,
  pos: string[],
  neg: string[],
): string {
  if (grade === "강함" || grade === "양호") {
    return `관성 작동 지표는 ${score}점(${grade})으로, 배우자·규범 시그널이 비교적 살아 있는 편입니다.`;
  }
  if (grade === "보통") {
    return `관성 작동은 ${score}점(보통)으로, 뚜렷하지는 않으나 완전히 소멸된 구조는 아닙니다.`;
  }
  return `관성 작동은 ${score}점(${grade})으로, 구조상 약하거나 부담·설기가 커 보조 해석 시 보수적으로 보는 편이 좋습니다.`;
}

function computeSpousePalaceStability(ctx: {
  dayBranch?: string;
  allBranches: string[];
  dayPillarHangul?: string;
  yongshinPrimary: FiveElKey;
  yongshinSecondary?: FiveElKey;
}): ActivationEvaluation {
  const debug: string[] = [];
  const positives: string[] = [];
  const negatives: string[] = [];
  let raw = 50;

  const { dayBranch } = ctx;
  if (!dayBranch) {
    debug.push("일지 없음: 중립 유지");
    const score = clampScore(raw);
    return {
      score,
      grade: gradeFromScore(score),
      positives: ["일지 정보 없음"],
      negatives: [],
      summary: "일지가 없어 배우자궁 안정도는 중립 점수로 두었습니다.",
      debug,
    };
  }

  const branchRels = computeBranchRelations(ctx.allBranches);

  const touching = relationsTouchingBranch(branchRels, dayBranch);
  const selfRels = relationsForDaySelf(branchRels, dayBranch);

  if (hasChungWithOther(dayBranch, ctx.allBranches)) {
    raw -= 22;
    debug.push("일지 충: −22");
    negatives.push("일지 충");
  } else {
    positives.push("일지 충 없음");
  }

  if (selfRels.length > 0 || touching.some((r) => r.type === "형")) {
    raw -= 12;
    debug.push("일지 형(자형 포함): −12");
    negatives.push("일지 형");
  }

  if (touching.some((r) => r.type === "파")) {
    raw -= 10;
    debug.push("일지 파: −10");
    negatives.push("일지 파");
  }

  if (touching.some((r) => r.type === "해")) {
    raw -= 6;
    debug.push("일지 해: −6");
    negatives.push("일지 해");
  }

  if (touching.some((r) => r.type === "원진")) {
    raw -= 8;
    debug.push("일지 원진: −8");
    negatives.push("일지 원진");
  }

  const gm = GUIMOON_PAIR[dayBranch];
  if (gm && ctx.allBranches.some((b) => b !== dayBranch && b === gm)) {
    raw -= 5;
    debug.push("일지 귀문 쌍: −5");
    negatives.push("일지 귀문(귀문관살 쌍)");
  }

  const palaceEl = branchSurfaceEl(dayBranch);
  const combineBonusTypes = new Set<BranchRelation["type"]>(["지지육합", "지지삼합", "지지방합"]);
  const hasPalaceCombine = touching.some((r) => combineBonusTypes.has(r.type));
  const unfavorablePalace =
    palaceEl != null && isRoughUnfavorableToYongshin(palaceEl, ctx.yongshinPrimary);
  if (hasPalaceCombine && !unfavorablePalace) {
    raw += 8;
    debug.push("일지 합(육·삼·방) + 기신합 아님: +8");
    positives.push("일지 합으로 안정 보조");
  } else if (hasPalaceCombine && unfavorablePalace) {
    debug.push("일지 합이나 배우자궁 오행이 구신 성향 → 합 가점 생략");
    negatives.push("기신 성향 배우자궁 합");
  }

  if (ctx.dayPillarHangul) {
    const voidBranches = getVoidBranchesForDay(ctx.dayPillarHangul);
    if (voidBranches?.includes(dayBranch)) {
      raw -= 10;
      debug.push("일지 공망: −10");
      negatives.push("일지 공망");
    }
  }

  if (palaceEl != null) {
    if (isFavorableElement(palaceEl, ctx.yongshinPrimary, ctx.yongshinSecondary)) {
      raw += 10;
      debug.push("배우자궁 오행=용신·희신: +10");
      positives.push("배우자궁이 용신·희신 계열");
    }
    if (isRoughUnfavorableToYongshin(palaceEl, ctx.yongshinPrimary)) {
      raw -= 10;
      debug.push("배우자궁 오행이 용신 극: −10");
      negatives.push("배우자궁이 구신 성향");
    }
  }

  if (negatives.length === 0 && positives.length >= 2) {
    positives.push("배우자궁 복합 스트레스 적음");
  }

  const score = clampScore(raw);
  const grade = gradeFromScore(score);
  const summary = summarizeSpouse(grade, score, positives, negatives);
  return { score, grade, positives, negatives, summary, debug };
}

/** branchRelations.VOID_BY_GANJI와 동일 규칙의 최소 복사 */
function getVoidBranchesForDay(dayPillarHangul: string): string[] | null {
  if (dayPillarHangul.length < 2) return null;
  const ganji = dayPillarHangul.slice(0, 2);
  const VOID_BY_GANJI: Record<string, readonly [string, string]> = {
    갑자: ["술", "해"], 을축: ["술", "해"], 병인: ["술", "해"], 정묘: ["술", "해"],
    무진: ["술", "해"], 기사: ["술", "해"], 경오: ["술", "해"], 신미: ["술", "해"],
    임신: ["술", "해"], 계유: ["술", "해"],
    갑술: ["신", "유"], 을해: ["신", "유"], 병자: ["신", "유"], 정축: ["신", "유"],
    무인: ["신", "유"], 기묘: ["신", "유"], 경진: ["신", "유"], 신사: ["신", "유"],
    임오: ["신", "유"], 계미: ["신", "유"],
    갑신: ["오", "미"], 을유: ["오", "미"], 병술: ["오", "미"], 정해: ["오", "미"],
    무자: ["오", "미"], 기축: ["오", "미"], 경인: ["오", "미"], 신묘: ["오", "미"],
    임진: ["오", "미"], 계사: ["오", "미"],
    갑오: ["진", "사"], 을미: ["진", "사"], 병신: ["진", "사"], 정유: ["진", "사"],
    무술: ["진", "사"], 기해: ["진", "사"], 경자: ["진", "사"], 신축: ["진", "사"],
    임인: ["진", "사"], 계묘: ["진", "사"],
    갑진: ["인", "묘"], 을사: ["인", "묘"], 병오: ["인", "묘"], 정미: ["인", "묘"],
    무신: ["인", "묘"], 기유: ["인", "묘"], 경술: ["인", "묘"], 신해: ["인", "묘"],
    임자: ["인", "묘"], 계축: ["인", "묘"],
    갑인: ["자", "축"], 을묘: ["자", "축"], 병진: ["자", "축"], 정사: ["자", "축"],
    무오: ["자", "축"], 기미: ["자", "축"], 경신: ["자", "축"], 신유: ["자", "축"],
    임술: ["자", "축"], 계해: ["자", "축"],
  };
  const p = VOID_BY_GANJI[ganji];
  return p ? [p[0], p[1]] : null;
}

function summarizeSpouse(
  grade: ActivationGrade,
  score: number,
  pos: string[],
  neg: string[],
): string {
  if (neg.length === 0 || (grade === "강함" || grade === "양호")) {
    return `배우자궁 안정도 ${score}점(${grade})로, 관계 지속·정서 안정 측면에서 무난~유리한 편입니다.`;
  }
  if (grade === "보통") {
    return `배우자궁은 ${score}점(보통)으로 기본은 유지되나 일부 스트레스 요인은 있습니다.`;
  }
  return `배우자궁 안정도 ${score}점(${grade})로, 충·형·공망 등으로 흔들림 요인이 커 보입니다.`;
}

function computeWealthActivation(ctx: {
  dayMasterEl: FiveElKey;
  wealthEl: FiveElKey;
  allStems: string[];
  allBranches: string[];
  yongshinPrimary: FiveElKey;
  yongshinSecondary?: FiveElKey;
  tenGodGroups: Record<string, number>;
}): ActivationEvaluation {
  const { tenGodGroups } = ctx;
  const debug: string[] = [];
  const positives: string[] = [];
  const negatives: string[] = [];
  let raw = 50;

  const { wealthEl, outputEl, dayMasterEl } = ctx;
  const genWealth = getGenerator(wealthEl);

  const wStems = wealthStemCount(dayMasterEl, ctx.allStems);
  if (wStems >= 1) {
    raw += 10;
    debug.push(`재성 천간 ${wStems}개: +10`);
    positives.push("재성 천간 존재");
  } else {
    negatives.push("재성 천간 약함");
  }

  const wBranches = wealthBranchCount(wealthEl, ctx.allBranches);
  if (wBranches >= 1) {
    raw += 12;
    debug.push(`재성 지지 ${wBranches}곳: +12`);
    positives.push("재성 지지 존재");
  } else {
    negatives.push("재성 지지 약함");
  }
  if (wBranches >= 2) {
    raw += 4;
    debug.push("재성 지지 복수: +4");
  }

  let wealthHiddenRoot = false;
  for (const b of ctx.allBranches) {
    const surf = branchSurfaceEl(b);
    const hid = JIJANGGAN[b] ?? [];
    if (surf !== wealthEl && hid.some((h) => stemEl(h) === wealthEl)) {
      wealthHiddenRoot = true;
      break;
    }
  }
  if (wealthHiddenRoot) {
    raw += 8;
    debug.push("재성 지장간 통근: +8");
    positives.push("재성 통근(지장간)");
  }

  const branchRels = computeBranchRelations(ctx.allBranches);
  if (countElementInChart(genWealth, ctx.allStems, ctx.allBranches) > 0) {
    raw += 6;
    debug.push("재성 생기(인성) 존재: +6");
    positives.push("재성에 생기 연결");
  }

  if (hasSupportiveCombineForElement(wealthEl, ctx.allBranches, branchRels)) {
    raw += 6;
    debug.push("재성 관련 합 연계: +6");
    positives.push("재성 쪽 합·연계");
  }

  const wealthBs = branchesWithElement(ctx.allBranches, wealthEl);
  let wealthChung = false;
  for (const b of wealthBs) {
    if (hasChungWithOther(b, ctx.allBranches)) {
      wealthChung = true;
      break;
    }
  }
  if (wealthChung) {
    raw -= 12;
    debug.push("재성 지지 충: −12");
    negatives.push("재성 지지 충");
  }

  let wStress = 0;
  const stressTypes = new Set<BranchRelation["type"]>(["형", "파", "해"]);
  for (const b of wealthBs) {
    for (const r of relationsTouchingBranch(branchRels, b)) {
      if (stressTypes.has(r.type)) wStress++;
    }
  }
  if (wStress > 0) {
    const pen = Math.min(12, wStress * 4);
    raw -= pen;
    debug.push(`재성 지지 형·파·해: −${pen}`);
    negatives.push("재성 지지 형·파·해");
  }

  if (isFavorableElement(wealthEl, ctx.yongshinPrimary, ctx.yongshinSecondary)) {
    raw += 10;
    debug.push("재성=용신·희신: +10");
    positives.push("재성이 용신·희신 계열");
  }
  if (isRoughUnfavorableToYongshin(wealthEl, ctx.yongshinPrimary)) {
    raw -= 8;
    debug.push("재성이 용신 극: −8");
    negatives.push("재성이 용신과 상충 성향");
  }

  const 식 = tenGodGroups["식상"] ?? 0;
  const 재 = tenGodGroups["재성"] ?? 0;
  const hasOutput = 식 > 0;
  const hasWealthPresence = wStems > 0 || wBranches > 0;
  if (hasOutput && (hasWealthPresence || 재 > 0)) {
    raw += 10;
    debug.push("식상+재성 연결 가능: +10");
    positives.push("식상생재 연결 가능");
  } else if (hasOutput && !hasWealthPresence) {
    raw += 15;
    debug.push("재성 표면 약하나 식상 중심 생산 보완: +15");
    positives.push("식상 중심 수익 보완");
  }

  if (hasWealthPresence && !wealthHiddenRoot && wealthChung && wBranches <= 1) {
    raw -= 10;
    debug.push("재성 고립·충 우려: −10");
    negatives.push("재성 뿌리 약·고립");
  }

  const score = clampScore(raw);
  const grade = gradeFromScore(score);
  const summary = summarizeWealth(grade, score, positives, negatives);
  return { score, grade, positives, negatives, summary, debug };
}

function summarizeWealth(
  grade: ActivationGrade,
  score: number,
  pos: string[],
  neg: string[],
): string {
  if (grade === "강함" || grade === "양호") {
    return `재성 작동 지표 ${score}점(${grade})으로, 재물·수익 구조가 비교적 살아 있는 편입니다.`;
  }
  if (grade === "보통") {
    return `재성 작동은 ${score}점(보통)으로, 식상 연계 등으로 보완 여지가 있습니다.`;
  }
  return `재성 작동 ${score}점(${grade})으로, 뿌리·충형 부담이 커 돈맥은 약하게 읽는 편이 안전합니다.`;
}

/**
 * 돈·결혼 해석 보조용 원국 평가(강약·격국·용신 계산과 분리).
 */
export function computeRelationshipWealthEvaluations(
  input: RelationshipWealthEvaluationInput,
): RelationshipWealthEvaluations {
  const dmEl = STEM_TO_ELEMENT[input.dayStem] as FiveElKey | undefined;
  const tenGodGroups = input.tenGodGroups ?? {
    비겁: 0, 식상: 0, 재성: 0, 관성: 0, 인성: 0,
  };

  if (!dmEl) {
    const empty = (summary: string): ActivationEvaluation => ({
      score: 50,
      grade: "보통",
      positives: [],
      negatives: ["일간 오행 미상"],
      summary,
      debug: ["dayStem→오행 매핑 실패"],
    });
    return {
      officerActivation: empty("일간을 식별하지 못해 관성 작동 지표를 중립으로 두었습니다."),
      spousePalaceStability: empty("일간을 식별하지 못해 배우자궁 지표를 중립으로 두었습니다."),
      wealthActivation: empty("일간을 식별하지 못해 재성 작동 지표를 중립으로 두었습니다."),
    };
  }

  const officerEl = getController(dmEl);
  const wealthEl = CONTROLS[dmEl];
  const hourBranch = inferHourBranch(input.allBranches, input.dayBranch);

  const officerActivation = computeOfficerActivation({
    dayStem: input.dayStem,
    dayMasterEl: dmEl,
    officerEl,
    allStems: input.allStems,
    allBranches: input.allBranches,
    monthBranch: input.monthBranch,
    dayBranch: input.dayBranch,
    hourBranch,
    yongshinPrimary: input.yongshinPrimary,
    yongshinSecondary: input.yongshinSecondary,
    tenGodGroups,
    effectiveFiveElements: input.effectiveFiveElements,
  });

  const spousePalaceStability = computeSpousePalaceStability({
    dayBranch: input.dayBranch,
    allBranches: input.allBranches,
    dayPillarHangul: input.dayPillarHangul,
    yongshinPrimary: input.yongshinPrimary,
    yongshinSecondary: input.yongshinSecondary,
  });

  const wealthActivation = computeWealthActivation({
    dayMasterEl: dmEl,
    wealthEl,
    allStems: input.allStems,
    allBranches: input.allBranches,
    yongshinPrimary: input.yongshinPrimary,
    yongshinSecondary: input.yongshinSecondary,
    tenGodGroups,
  });

  return { officerActivation, spousePalaceStability, wealthActivation };
}