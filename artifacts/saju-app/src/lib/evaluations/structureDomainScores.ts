/**
 * 구조 기반 7영역 점수 엔진 (재물·커리어·명예·인간관계·연애/배우자·건강·실행력).
 * 단순 존재 가산 대신 작동력·감당력·안정성 등 가중·결합(기하평균 등)으로 산출.
 */

import type { FiveElementCount } from "../sajuEngine";
import {
  type FiveElKey,
  BRANCH_TO_ELEMENT,
  CONTROLS,
  STEM_TO_ELEMENT,
  getTenGodGroup,
} from "../element-color";
import type { StrengthLevel } from "../interpretSchema";
import { computeBranchRelations, type BranchRelation } from "../branchRelations";
import { getTenGod, type TenGod } from "../tenGods";
import type {
  AdjustedStructure,
  BaseStructure,
  InterpretationResult,
  PipelineInput,
} from "../sajuPipeline";

/** 재물 카드 전용: 최종 점수는 기하평균, 채널은 ‘재성 작동’ 축(보조 지표) — 1차 유형 10종 */
export type WealthStructureClassification =
  | "생산형 재물"
  | "관리형 재물"
  | "투자형 재물"
  | "브랜드형 재물"
  | "관계형 재물"
  | "전문직형 재물"
  | "조직형 재물"
  | "지식형 재물"
  | "콘텐츠형 재물"
  | "후반축적형 재물";

export interface WealthAxisScores {
  /** 재성·용신·월일 뿌리 등 ‘수입 통로’ (과대 체감 방지를 위해 별도 압축) */
  channelScore: number;
  capacityScore: number;
  accumulationScore: number;
}
import type {
  ActivationEvaluation,
  ActivationGrade,
  RelationshipWealthEvaluations,
} from "./relationshipWealthEvaluation";

// ── 지장간 (재성 위치 판단용, relationshipWealthEvaluation과 동일) ─────
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

function stemEl(ch: string): FiveElKey | undefined {
  return STEM_TO_ELEMENT[ch] as FiveElKey | undefined;
}

function branchCarriesWealth(branch: string, wealthEl: FiveElKey): boolean {
  const surf = BRANCH_TO_ELEMENT[branch] as FiveElKey | undefined;
  if (surf === wealthEl) return true;
  for (const h of JIJANGGAN[branch] ?? []) {
    if (stemEl(h) === wealthEl) return true;
  }
  return false;
}

function clamp(n: number, lo = 0, hi = 100): number {
  return Math.max(lo, Math.min(hi, Math.round(n)));
}

function gradeFromScore(s: number): ActivationGrade {
  if (s >= 80) return "강함";
  if (s >= 65) return "양호";
  if (s >= 50) return "보통";
  if (s >= 35) return "약함";
  return "매우약함";
}

/** 세 축 0~100 → 기하평균 (단순 합산 대신 결합) */
function geomMean3(a: number, b: number, c: number): number {
  const x = Math.max(8, Math.min(100, a));
  const y = Math.max(8, Math.min(100, b));
  const z = Math.max(8, Math.min(100, c));
  return clamp(Math.pow(x * y * z, 1 / 3));
}

/**
 * 생산형 재물: 축적 축 가중을 낮춘 결합(채널·감당 대비 축적이 덜 끌어내림).
 * wAcc < 1/3 이면 동일 기하평균보다 축적 페널티 영향이 약해짐.
 */
function geomMean3WealthProduction(a: number, b: number, c: number, wAcc: number): number {
  const wCh = (1 - wAcc) / 2;
  const wCap = (1 - wAcc) / 2;
  const x = Math.max(8, Math.min(100, a));
  const y = Math.max(8, Math.min(100, b));
  const z = Math.max(8, Math.min(100, c));
  const v = Math.pow(x, wCh) * Math.pow(y, wCap) * Math.pow(z, wAcc);
  return clamp(Math.round(v));
}

function strengthFactor(level: StrengthLevel): number {
  const M: Record<StrengthLevel, number> = {
    극신약: 0.12,
    태약: 0.22,
    신약: 0.35,
    중화: 0.5,
    신강: 0.65,
    태강: 0.78,
    극신강: 0.9,
  };
  return M[level] ?? 0.5;
}

function countRel(rels: BranchRelation[], pred: (t: string) => boolean): number {
  return rels.filter((r) => pred(r.type)).length;
}

/** 일간 제외 천간에서 십성 그룹 매칭 */
function stemGroupCount(dayStem: string, stems: string[], group: string): number {
  const dm = STEM_TO_ELEMENT[dayStem] as FiveElKey | undefined;
  if (!dm) return 0;
  let n = 0;
  for (const s of stems) {
    if (s === dayStem) continue;
    const e = stemEl(s);
    if (e && getTenGodGroup(dm, e) === group) n++;
  }
  return n;
}

function hasTenGodOnStem(dayStem: string, stems: string[], tg: TenGod[]): boolean {
  for (const s of stems) {
    if (s === dayStem) continue;
    const t = getTenGod(dayStem, s);
    if (t && tg.includes(t)) return true;
  }
  return false;
}

function countTenGodChars(dayStem: string, stems: string[], branches: string[], tg: TenGod[]): number {
  let n = 0;
  for (const s of stems) {
    const t = getTenGod(dayStem, s);
    if (t && tg.includes(t)) n++;
  }
  for (const b of branches) {
    const t = getTenGod(dayStem, b);
    if (t && tg.includes(t)) n++;
  }
  return n;
}

function pillarHasWealthLuck(
  hangul: string | undefined,
  wealthEl: FiveElKey,
  yong: FiveElKey,
  hee?: FiveElKey,
): boolean {
  if (!hangul || hangul.length < 2) return false;
  const s = hangul[0];
  const b = hangul[1];
  const els = [stemEl(s), BRANCH_TO_ELEMENT[b] as FiveElKey | undefined].filter(Boolean) as FiveElKey[];
  return els.some((e) => e === wealthEl || e === yong || (hee && e === hee));
}

export interface DomainScoreResult {
  domainKey:
    | "wealth"
    | "career"
    | "honor"
    | "social"
    | "romance"
    | "health"
    | "execution";
  labelKo: string;
  score: number;
  classification: string;
  workingFactors: string[];
  demeritFactors: string[];
  summary: string;
  /** 재물 도메인 전용: 채널(작동)·감당·축적 — 메인 점수는 `score`(기하평균) */
  wealthAxes?: WealthAxisScores;
}

export interface StructureDomainScoreReport {
  wealth: DomainScoreResult;
  career: DomainScoreResult;
  honor: DomainScoreResult;
  social: DomainScoreResult;
  romance: DomainScoreResult;
  health: DomainScoreResult;
  execution: DomainScoreResult;
}

function domain(
  key: DomainScoreResult["domainKey"],
  labelKo: string,
  score: number,
  classification: string,
  working: string[],
  demerit: string[],
  summary: string,
  wealthAxes?: WealthAxisScores,
): DomainScoreResult {
  return {
    domainKey: key,
    labelKo,
    score: clamp(score),
    classification,
    workingFactors: working,
    demeritFactors: demerit,
    summary,
    ...(wealthAxes ? { wealthAxes } : {}),
  };
}

function toActivation(d: DomainScoreResult): ActivationEvaluation {
  const score = clamp(d.score);
  const ax = d.wealthAxes;
  const axisDebug =
    d.domainKey === "wealth" && ax
      ? [
          `보조·재물 채널(작동 통로): ${ax.channelScore}점`,
          `재물 감당력: ${ax.capacityScore}점`,
          `재물 축적력: ${ax.accumulationScore}점`,
        ]
      : [];
  return {
    score,
    grade: gradeFromScore(score),
    positives: [...d.workingFactors],
    negatives: [...d.demeritFactors],
    summary: d.summary,
    debug: [
      ...axisDebug,
      ...d.workingFactors.map((x) => `작동: ${x}`),
      ...d.demeritFactors.map((x) => `감점: ${x}`),
    ],
  };
}

export function deriveRelationshipWealthEvaluationsFromDomains(
  r: StructureDomainScoreReport,
): RelationshipWealthEvaluations {
  return {
    wealthActivation: toActivation(r.wealth),
    officerActivation: toActivation(r.honor),
    spousePalaceStability: toActivation(r.romance),
  };
}

// ═══════════════════════════════════════════════════════════════════
// 1) 재물운 — 채널(작동)·감당·축적 → 기하평균 = 메인 점수
// ═══════════════════════════════════════════════════════════════════

/** 원시 ‘재성 작동’ 합산치를 상단으로 몰리지 않게 완만히 눌러 채널 점수로 사용 */
function compressWealthChannel(raw: number): number {
  const x = clamp(raw);
  if (x <= 50) return x;
  if (x <= 66) return Math.round(50 + (x - 50) * 0.82);
  if (x <= 80) return Math.round(63 + (x - 66) * 0.55);
  return Math.round(71 + (x - 80) * 0.28);
}

function classifyWealthStructure(args: {
  gukName: string;
  shengCai: boolean;
  weakBody: boolean;
  strengthFactor: number;
  relWealthStrength: number;
  geob: number;
  channel: number;
  capacity: number;
  accumulation: number;
  final: number;
  hasGw: boolean;
  wealthGroup: number;
  sikGroup: number;
  inGroup: number;
  bijobGroup: number;
  wealthTransparent: boolean;
  officerStemCount: number;
}): WealthStructureClassification {
  const {
    gukName,
    shengCai,
    weakBody,
    strengthFactor: sf,
    relWealthStrength,
    geob,
    channel,
    capacity,
    accumulation,
    final,
    hasGw,
    wealthGroup,
    sikGroup,
    inGroup,
    bijobGroup,
    wealthTransparent,
    officerStemCount,
  } = args;

  const fragileCarry = (weakBody || sf < 0.38) && relWealthStrength > 1.72;

  const unstableRisk =
    final <= 50 ||
    (accumulation <= 41 && !shengCai) ||
    (fragileCarry && capacity <= 54 && accumulation <= 46) ||
    (geob >= 2 && accumulation <= 44 && fragileCarry);

  const opportunityLike =
    channel >= 63 &&
    capacity <= 58 &&
    (weakBody || fragileCarry || relWealthStrength > 1.4) &&
    channel - Math.min(capacity, accumulation) >= 8;

  // 식상생재 + 감당 우선(기존 엔진과 동일 순위) → 세부는 식상·인성·투출
  if (shengCai && capacity >= 58 && channel >= 52 && !fragileCarry && sf >= 0.48) {
    if (sikGroup >= 0.5) return "콘텐츠형 재물";
    if (inGroup >= 0.46) return "지식형 재물";
    if (wealthTransparent && wealthGroup >= 0.38) return "브랜드형 재물";
    return "생산형 재물";
  }

  if (gukName.includes("정재격")) {
    return "전문직형 재물";
  }

  // 변동·과재 부담 → 투자·후반축적·관계형으로 세분
  if (unstableRisk) {
    if (opportunityLike || channel >= 58) return "투자형 재물";
    if (capacity >= 56 && accumulation >= 44) return "후반축적형 재물";
    return "관계형 재물";
  }

  if (opportunityLike) {
    return "관계형 재물";
  }

  if (hasGw && wealthGroup >= 0.34) {
    if (officerStemCount >= 2) return "조직형 재물";
    return "관리형 재물";
  }

  if (final >= 54 && accumulation >= 48 && channel <= 54 && capacity >= 54) {
    return "후반축적형 재물";
  }

  if (bijobGroup + inGroup >= 0.52 && wealthGroup >= 0.28 && channel >= 56) {
    return "관계형 재물";
  }

  if (final >= 58 && capacity >= 56) {
    return "관리형 재물";
  }

  return "관리형 재물";
}

function scoreWealth(
  input: PipelineInput,
  base: BaseStructure,
  adjusted: AdjustedStructure,
  rels: BranchRelation[],
  interpretation: InterpretationResult,
): DomainScoreResult {
  const { dayStem, monthBranch, dayBranch, allStems, allBranches } = input;
  const dm = STEM_TO_ELEMENT[dayStem] as FiveElKey | undefined;
  if (!dm) {
    const neutral: WealthAxisScores = { channelScore: 50, capacityScore: 50, accumulationScore: 50 };
    return domain(
      "wealth",
      "재물운",
      50,
      "미산출",
      [],
      ["일간 오행 없음"],
      "일간이 없어 재물 구조 점수를 산출하지 않았습니다.",
      neutral,
    );
  }
  const g = base.tenGodGroups;
  const yong = adjusted.effectiveYongshin;
  const hee = adjusted.effectiveYongshinSecondary;
  const wealthEl = CONTROLS[dm];
  const gukName = interpretation.gukguk?.name ?? "";
  const wealthGroup = g["재성"] ?? 0;

  const working: string[] = [];
  const demerit: string[] = [];

  // ① 재성 작동 (원시) — 이후 압축해 ‘재물 채널’로 표시
  let opRaw = 36;
  const shengCai = (g["식상"] ?? 0) >= 0.45 && wealthGroup >= 0.45;
  if (shengCai) {
    opRaw += 18;
    working.push("식상생재 흐름(식상·재성 동시 존재)");
  }
  const wealthTransparent = stemGroupCount(dayStem, allStems, "재성") >= 1;
  if (wealthTransparent) {
    opRaw += 14;
    working.push("재성 천간 투출(연·월·시)");
  }
  if (getTenGodGroup(dm, yong) === "재성") {
    opRaw += 11;
    working.push("용신이 재성 계열");
  } else if (hee === wealthEl) {
    opRaw += 6;
    working.push("재성이 희신에 포함");
  }
  if (pillarHasWealthLuck(input.timingDaewoonHangul, wealthEl, yong, hee)) {
    opRaw += 9;
    working.push("현재 대운 간지에 재·용 흐름");
  }
  if (monthBranch && branchCarriesWealth(monthBranch, wealthEl)) {
    opRaw += 10;
    working.push("월지에 재성 뿌리(본기·지장간)");
  }
  if (dayBranch && branchCarriesWealth(dayBranch, wealthEl)) {
    opRaw += 8;
    working.push("일지에 재성 뿌리");
  }
  opRaw = clamp(opRaw);
  const channelScore = compressWealthChannel(opRaw);

  // ② 감당력
  let cap = 44;
  const sf = strengthFactor(adjusted.effectiveStrengthLevel);
  const relWealthStrength = wealthGroup / ((g["비겁"] ?? 0) + (g["인성"] ?? 0) + 0.01);
  const weakBody = sf < 0.4 && wealthGroup >= 1.35;

  if (sf >= 0.55 && relWealthStrength < 2.15) {
    cap += 20;
    working.push("신강~중화 대비 재성 과잉 아님 → 감당 여유");
  } else if (sf < 0.42 && relWealthStrength > 1.65) {
    cap -= 20;
    demerit.push("신약·태약 대비 재성 부담이 상대적으로 큼");
  }
  if ((g["식상"] ?? 0) >= 0.45) {
    cap += 10;
    working.push("식상 존재로 재성 설기·생동력 연결");
  }
  if (yong && (getTenGodGroup(dm, yong) === "인성" || getTenGodGroup(dm, yong) === "비겁")) {
    cap += 5;
    working.push("용신이 비겁·인성 계열 — 감당 기반 보강");
  }
  cap = clamp(cap);

  // ③ 축적력
  let acc = 58;
  const geob = countTenGodChars(dayStem, allStems, allBranches, ["겁재"]);
  if (geob >= 1) {
    const pen = Math.min(30, geob * 11);
    acc -= pen;
    demerit.push(`겁재 ${geob}곳 — 재 분산·경쟁 압력`);
  }
  const hyung = countRel(rels, (t) => t === "형");
  const chung = countRel(rels, (t) => t === "지지충" || t === "충");
  const wj = countRel(rels, (t) => t === "원진");
  if (hyung + chung + wj > 0) {
    const pen = Math.min(24, hyung * 5 + chung * 7 + wj * 6);
    acc -= pen;
    demerit.push(`지지 형·충·원진 누적 — 재 축적 변동성`);
  }
  if (dayBranch && hasChungDay(dayBranch, allBranches)) {
    acc -= 11;
    demerit.push("배우자궁(일지) 충 가능성 — 정서·재 안정 흔들림");
  }
  const weak = sf < 0.42 && wealthGroup >= 1.75;
  if (weak) {
    acc -= 16;
    demerit.push("재다신약 성향 — 루트는 있으나 체류·지키기 부담");
  }
  const accDisplayed = clamp(acc);

  const fragileCarry = (weakBody || sf < 0.38) && relWealthStrength > 1.72;
  const productionCandidate =
    shengCai &&
    cap >= 58 &&
    channelScore >= 52 &&
    !fragileCarry &&
    sf >= 0.48;

  /** 종합 기하평균 전용 축(표시 `accumulationScore`는 accDisplayed 그대로) */
  let accForGeom = accDisplayed;
  if (productionCandidate) {
    const mid = (channelScore + cap) / 2;
    const gapPull = Math.min(20, Math.max(0, mid - accDisplayed) * 0.5);
    let persist = 0;
    const sikG = g["식상"] ?? 0;
    if (sikG >= 0.78) persist += 3;
    else if (sikG >= 0.55) persist += 2;
    else persist += 1;
    if (sf >= 0.62) persist += 3;
    else if (sf >= 0.55) persist += 2;
    else if (sf >= 0.48) persist += 1;
    const yg = getTenGodGroup(dm, yong);
    if (yg === "식상" || yg === "재성") persist += 2;
    if (hasTenGodOnStem(dayStem, allStems, ["식신", "상관"])) persist += 2;
    persist = Math.min(10, persist);
    const lift = Math.min(24, gapPull + persist * 0.65);
    accForGeom = clamp(accDisplayed + lift);
    if (lift >= 5) {
      working.push("지속 생산·용신 정합 — 축적 변동을 종합 점수에서 일부 상쇄(표시 축적은 그대로)");
    }
  }

  const final = productionCandidate
    ? geomMean3WealthProduction(channelScore, cap, accForGeom, 0.235)
    : geomMean3(channelScore, cap, accForGeom);
  const hasGw = (g["관성"] ?? 0) >= 0.45;
  const officerStemCount = stemGroupCount(dayStem, allStems, "관성");

  const cls = classifyWealthStructure({
    gukName,
    shengCai,
    weakBody: sf < 0.38 || weakBody,
    strengthFactor: sf,
    relWealthStrength,
    geob,
    channel: channelScore,
    capacity: cap,
    accumulation: accDisplayed,
    final,
    hasGw,
    wealthGroup,
    sikGroup: g["식상"] ?? 0,
    inGroup: g["인성"] ?? 0,
    bijobGroup: g["비겁"] ?? 0,
    wealthTransparent,
    officerStemCount,
  });

  const disclaimer =
    "재물 채널이 강하더라도 실제 감당력과 축적력에 따라 체감은 달라질 수 있습니다. 메인 점수는 세 축의 결합값입니다." +
    (productionCandidate
      ? " 식상생재형은 ‘계속 벌어 들이는’ 루트를 반영해, 표시 축적 점수보다 종합에 덜 깎이도록 가중·보정합니다."
      : "");

  const summary =
    final >= 66
      ? `종합 재물 구조는 비교적 탄력 있습니다. ${disclaimer}`
      : final >= 47
        ? `감당·축적과 통로의 균형이 평균대입니다. ${disclaimer}`
        : `통로 대비 감당·축적이 부담스러울 수 있습니다. ${disclaimer}`;

  const axes: WealthAxisScores = {
    channelScore,
    capacityScore: cap,
    accumulationScore: accDisplayed,
  };

  return domain("wealth", "재물운", final, cls, working, demerit, summary, axes);
}

function hasChungDay(dayBranch: string, all: string[]): boolean {
  const P: Record<string, string> = {
    자: "오",
    오: "자",
    축: "미",
    미: "축",
    인: "신",
    신: "인",
    묘: "유",
    유: "묘",
    진: "술",
    술: "진",
    사: "해",
    해: "사",
  };
  const p = P[dayBranch];
  return !!p && all.some((b) => b === p);
}

// ═══════════════════════════════════════════════════════════════════
// 2) 커리어
// ═══════════════════════════════════════════════════════════════════

function scoreCareer(
  input: PipelineInput,
  base: BaseStructure,
  adjusted: AdjustedStructure,
  interpretation: InterpretationResult,
): DomainScoreResult {
  const { dayStem, allStems, allBranches, monthBranch } = input;
  const dm = STEM_TO_ELEMENT[dayStem] as FiveElKey | undefined;
  if (!dm) {
    return domain("career", "커리어운", 50, "미산출", [], ["일간 오행 없음"], "일간이 없어 커리어 구조 점수를 산출하지 않았습니다.");
  }
  const g = base.tenGodGroups;
  const yong = adjusted.effectiveYongshin;

  const sikCount = countTenGodChars(dayStem, allStems, allBranches, ["식신", "상관"]);
  const sikTou = hasTenGodOnStem(dayStem, allStems, ["식신", "상관"]);
  const gwon = (g["관성"] ?? 0) >= 0.5;
  const ins = (g["인성"] ?? 0) >= 0.5;
  const guk = interpretation.gukguk?.name ?? "";
  const gukStable = !!interpretation.gukguk;

  const scores: Record<string, number> = {
    생산형: 40 + sikCount * 6 + (sikTou ? 14 : 0) + (gukStable ? 10 : 0),
    조직형: 36 + (gwon ? 18 : 0) + (ins ? 10 : 0) + (hasTenGodOnStem(dayStem, allStems, ["정관", "정인"]) ? 12 : 0),
    연구형: 38 + (ins ? 22 : 0) + (g["식상"] ?? 0) * 4,
    사업형: 40 + (g["재성"] ?? 0) * 5 + sikCount * 4 + (sikTou ? 8 : 0),
  };
  let best = "생산형";
  let bestS = scores["생산형"];
  for (const k of Object.keys(scores)) {
    if (scores[k] > bestS) {
      bestS = scores[k];
      best = k;
    }
  }
  const yongMatch =
    (best === "생산형" && getTenGodGroup(dm, yong) === "식상") ||
    (best === "조직형" && (getTenGodGroup(dm, yong) === "관성" || getTenGodGroup(dm, yong) === "인성")) ||
    (best === "연구형" && getTenGodGroup(dm, yong) === "인성") ||
    (best === "사업형" && (getTenGodGroup(dm, yong) === "재성" || getTenGodGroup(dm, yong) === "식상"));
  let struct = clamp(bestS * 0.55 + (yongMatch ? 22 : 6) + (monthBranch ? 8 : 0));

  const working: string[] = [];
  const demerit: string[] = [];
  if (sikCount > 0) working.push(`식상 ${sikCount}자리 — 생산·표현`);
  if (sikTou) working.push("식상 천간 투출");
  if (gwon) working.push("관성 존재 — 조직·책임");
  if (ins) working.push("인성 존재 — 학습·자격");
  if (gukStable) working.push(`격국 안정: ${guk}`);
  if (yongMatch) working.push("용신 방향이 커리어 유형과 정합");
  else demerit.push("용신 방향과 직업 유형 정합은 보통 이하");

  const monthFit = monthBranch
    ? getTenGodGroup(dm, BRANCH_TO_ELEMENT[monthBranch] as FiveElKey) ===
        (best === "조직형" ? "관성" : best === "연구형" ? "인성" : "식상")
    : false;
  if (monthFit) {
    struct += 8;
    working.push("월지 중심 직업 적합도 양호");
  }

  struct = clamp(struct);
  const summary = `${best} 구조에 가깝습니다. 식상·관·인의 밸런스와 격국 안정도가 장기 커리어 탄력을 만듭니다.`;

  return domain("career", "커리어운", struct, `${best} 커리어 구조`, working, demerit, summary);
}

// ═══════════════════════════════════════════════════════════════════
// 3) 명예 (신뢰·전문성·영향력)
// ═══════════════════════════════════════════════════════════════════

function scoreHonor(
  input: PipelineInput,
  base: BaseStructure,
  interpretation: InterpretationResult,
): DomainScoreResult {
  const { dayStem, allStems, monthBranch } = input;
  const dm = STEM_TO_ELEMENT[dayStem] as FiveElKey | undefined;
  if (!dm) {
    return domain("honor", "명예운", 50, "미산출", [], ["일간 오행 없음"], "일간이 없어 명예 구조 점수를 산출하지 않았습니다.");
  }
  const monthStem = allStems[2];
  let s = 42;
  const w: string[] = [];
  const d: string[] = [];

  if (hasTenGodOnStem(dayStem, allStems, ["정관", "편관"])) {
    s += 16;
    w.push("관성 천간 투출 — 사회·규범 시그널");
  }
  if (hasTenGodOnStem(dayStem, allStems, ["정인", "편인"])) {
    s += 14;
    w.push("인성 천간 투출 — 전문·학식 시그널");
  }
  if (monthStem && ["정관", "편관", "정인", "편인"].includes(getTenGod(dayStem, monthStem) ?? "")) {
    s += 12;
    w.push("월간 십성이 관·인 계열");
  }
  if (interpretation.gukguk) {
    s += 12;
    w.push(`격국 성립: ${interpretation.gukguk.name}`);
  } else d.push("격국 미성립 — 외부 신뢰 축이 흐릿할 수 있음");

  const stemComb = allStems.length >= 2;
  if (stemComb) {
    s += 6;
    w.push("천간 다주 구성 — 네트워크·연결 잠재");
  }

  const hasIns = base.tenGodGroups["인성"]! > 0.2;
  const hasGw = base.tenGodGroups["관성"]! > 0.2;
  if (hasIns && hasGw) {
    s += 10;
    w.push("관인 상생 축(관·인 동시 존재)");
  }

  s = clamp(s);
  const summary =
    "명예는 ‘인기’가 아니라 규범·전문성·신뢰 축입니다. 관·인 투출과 격국이 뒷받침될수록 사회적 인정 구조가 단단해집니다.";

  return domain("honor", "명예운", s, "신뢰·전문성 중심", w, d, summary);
}

// ═══════════════════════════════════════════════════════════════════
// 4) 인간관계
// ═══════════════════════════════════════════════════════════════════

function scoreSocial(
  input: PipelineInput,
  base: BaseStructure,
  rels: BranchRelation[],
): DomainScoreResult {
  const { dayStem, allStems, allBranches, dayBranch } = input;
  const bijob = countTenGodChars(dayStem, allStems, allBranches, ["비견", "겁재"]);
  const hap = countRel(rels, (t) => t.includes("합"));
  const chung = countRel(rels, (t) => t === "지지충" || t === "충");
  const hyung = countRel(rels, (t) => t === "형");
  const wj = countRel(rels, (t) => t === "원진");

  let type = "협업 안정형";
  let raw = 52 + hap * 4 - chung * 5 - hyung * 4 - wj * 4;
  if (bijob >= 3 && chung + hyung < 2) {
    type = "독립 최적형";
    raw += 8;
  } else if (hap >= 3 && chung <= 1) {
    type = "관계 확장형";
    raw += 10;
  } else if (chung + hyung + wj >= 4) {
    type = "관계 스트레스형";
    raw -= 14;
  }

  const dayStable = dayBranch && !hasChungDay(dayBranch, allBranches);
  if (dayStable) raw += 8;

  const w: string[] = [];
  const d: string[] = [];
  w.push(`비겁·겁재 합산 ${bijob} — 자아·경계`);
  if (hap) w.push(`합 ${hap}건 — 연대·협력`);
  if (chung) d.push(`충 ${chung}건`);
  if (hyung) d.push(`형 ${hyung}건`);
  if (wj) d.push(`원진 ${wj}건`);

  raw = clamp(raw);
  const summary =
    type === "관계 스트레스형"
      ? "관계망은 넓을수록 에너지 소모가 큽니다. 소수 깊은 연결과 명확한 경계가 유리합니다."
      : "협업·독립·확장 중 현재 팔자는 " + type + "에 가깝습니다.";

  return domain("social", "인간관계운", raw, type, w, d, summary);
}

// ═══════════════════════════════════════════════════════════════════
// 5) 연애 / 배우자
// ═══════════════════════════════════════════════════════════════════

function scoreRomance(
  input: PipelineInput,
  base: BaseStructure,
  rels: BranchRelation[],
): DomainScoreResult {
  const { dayStem, dayBranch, allBranches } = input;
  const w: string[] = [];
  const d: string[] = [];
  let s = 55;

  if (!dayBranch) {
    return domain("romance", "연애·배우자운", 50, "정보 부족", [], ["일지 없음"], "일지가 없어 배우자궁 평가를 중립으로 둡니다.");
  }

  if (hasChungDay(dayBranch, allBranches)) {
    s -= 20;
    d.push("일지 충 — 관계 변동·긴장");
  } else w.push("일지 직접 충 없음");

  const touch = rels.filter(
    (r) =>
      (r.branch1 === dayBranch || r.branch2 === dayBranch) &&
      r.branch1 !== r.branch2,
  );
  if (touch.some((r) => r.type.includes("합"))) {
    s += 10;
    w.push("일지 관련 합 — 유대 보조");
  }
  if (touch.some((r) => r.type === "형")) {
    s -= 10;
    d.push("일지 형");
  }
  if (touch.some((r) => r.type === "원진")) {
    s -= 8;
    d.push("일지 원진");
  }

  const gw = base.tenGodGroups["관성"] ?? 0;
  const jw = base.tenGodGroups["재성"] ?? 0;
  if (gw >= 0.5) {
    s += 8;
    w.push("관성 작동 — 규범·파트너 시그널");
  }
  if (jw >= 0.5) {
    s += 6;
    w.push("재성 작동 — 현실·안정 시그널");
  }

  s = clamp(s);
  const cls = s >= 62 ? "관계 안정 우세형" : s >= 45 ? "조건부 안정형" : "구조적 스트레스형";
  const summary =
    "연애 ‘횟수’가 아니라 일지·합충형·관재 작동으로 본 관계 운영 난이도입니다.";

  return domain("romance", "연애·배우자운", s, cls, w, d, summary);
}

// ═══════════════════════════════════════════════════════════════════
// 6) 건강 (체력 지속성)
// ═══════════════════════════════════════════════════════════════════

function scoreHealth(
  input: PipelineInput,
  adjusted: AdjustedStructure,
  rels: BranchRelation[],
): DomainScoreResult {
  const fe = input.effectiveFiveElements;
  const total = Object.values(fe).reduce((a, b) => a + b, 0) || 1;
  const ratios = (["목", "화", "토", "금", "수"] as const).map((e) => (fe[e] ?? 0) / total);
  const maxR = Math.max(...ratios);
  const minR = Math.min(...ratios);
  let s = 58;
  const w: string[] = [];
  const d: string[] = [];

  if (maxR < 0.38) {
    s += 12;
    w.push("특정 오행 과다 편중 없음");
  } else {
    s -= 10;
    d.push("특정 오행 과다 — 한쪽 기관·리듬 부담 가능");
  }
  if (minR < 0.01) {
    s -= 12;
    d.push("결핍 오행 — 보완 리듬 권장");
  }

  const sa = adjusted.seasonalAdjustment;
  if (!sa.needsFireBoost && !sa.needsWaterBoost) {
    s += 8;
    w.push("조후 극단 보정 미발동");
  } else {
    d.push("조후 보정 발동 — 계절·온도 밸런스 이슈");
  }

  const hyung = countRel(rels, (t) => t === "형");
  const chung = countRel(rels, (t) => t === "지지충" || t === "충");
  if (hyung + chung > 2) {
    s -= 12;
    d.push("형·충 다발 — 긴장·회복 리듬 흔들림");
  }

  const bal = adjusted.effectiveStrengthLevel === "중화";
  if (bal) {
    s += 8;
    w.push("일간 강약 중화 — 에너지 기복 상대적 완충");
  }

  s = clamp(s);
  const summary = "건강은 ‘체력 한 방’이 아니라 오행·조후·형충과 강약이 만드는 지속성 축입니다.";

  return domain("health", "건강운", s, "체력 지속성 중심", w, d, summary);
}

// ═══════════════════════════════════════════════════════════════════
// 7) 실행력
// ═══════════════════════════════════════════════════════════════════

function scoreExecution(
  input: PipelineInput,
  interpretation: InterpretationResult,
  adjusted: AdjustedStructure,
  monthBranch?: string,
): DomainScoreResult {
  const { dayStem, allStems, allBranches } = input;
  const sik = countTenGodChars(dayStem, allStems, allBranches, ["식신", "상관"]);
  const sikTou = hasTenGodOnStem(dayStem, allStems, ["식신", "상관"]);
  const strong = strengthFactor(adjusted.effectiveStrengthLevel) >= 0.62;
  const yangin = interpretation.gukguk?.name === "양인격";
  const geob = countTenGodChars(dayStem, allStems, allBranches, ["겁재"]) >= 1;

  let s = 44 + sik * 5 + (sikTou ? 14 : 0) + (strong ? 14 : 0) + (yangin ? 10 : 0) + (geob ? 6 : 0);
  const mb = monthBranch;
  if (mb && ["인", "사", "오"].includes(mb)) {
    s += 8;
  }
  s = clamp(s);

  const w: string[] = [];
  const d: string[] = [];
  if (sik) w.push(`식상 ${sik} — 아이디어·출력`);
  if (sikTou) w.push("식상 투출 — 표면 실행 시그널");
  if (strong) w.push("신강 축 — 밀어붙이는 힘");
  if (yangin) w.push("양인격 — 돌파·각성 에너지");
  if (geob) w.push("겁재 — 속도·경쟁 동력(부작용 병행 가능)");
  if (!sikTou && sik <= 1) d.push("식상 투출 약함 — 실행은 루틴화가 필요");

  const summary =
    "실행력은 운이 아니라 식상·신강·양인·겁재와 월기 에너지가 만드는 ‘행동 가능성’ 지표입니다.";

  const cls =
    s >= 72 ? "돌파·속도 우세형" : s >= 52 ? "균형 실행형" : "끌어올림 필요형";

  return domain("execution", "실행력 점수", s, cls, w, d, summary);
}

// ═══════════════════════════════════════════════════════════════════
// Public API
// ═══════════════════════════════════════════════════════════════════

export function computeStructureDomainScores(args: {
  input: PipelineInput;
  base: BaseStructure;
  adjusted: AdjustedStructure;
  interpretation: InterpretationResult;
}): StructureDomainScoreReport {
  const { input, base, adjusted, interpretation } = args;
  const rels = computeBranchRelations(input.allBranches);

  return {
    wealth: scoreWealth(input, base, adjusted, rels, interpretation),
    career: scoreCareer(input, base, adjusted, interpretation),
    honor: scoreHonor(input, base, interpretation),
    social: scoreSocial(input, base, rels),
    romance: scoreRomance(input, base, rels),
    health: scoreHealth(input, adjusted, rels),
    execution: scoreExecution(input, interpretation, adjusted, input.monthBranch),
  };
}
