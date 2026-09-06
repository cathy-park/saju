// ── 사주 데이터 클립보드 내보내기 유틸 ─────────────────────────────
// GPT / Gemini 에 붙여넣기 위한 구조화 텍스트를 생성합니다.

import type { PersonRecord } from "./storage";
import { getFinalPillars } from "./storage";
import { buildInterpretSchema, STRENGTH_DISPLAY_LABEL, type StrengthLevel } from "./interpretSchema";
import { computeBranchRelations } from "./branchRelations";
import {
  calculateLuckCycles,
  calculateShinsalFull,
  getMonthGanZhi,
  getYearGanZhi,
  type DaewoonSuOpts,
  type DaewoonEntry,
} from "./luckCycles";
import { getTenGod } from "./tenGods";
import { getTenGodGroup, getController, type FiveElKey } from "./element-color";
import { computeSpouseActivationByYearRange, topSpouseActivationYears } from "./evaluations/spouseActivation";
import { computeExamCareerActivation } from "./evaluations/examCareerActivation";
import { computeContractActivation } from "./evaluations/contractActivation";
import {
  computeRelationshipInteractionByYearRange,
  dampeningFromCompatibilityTone,
  type PersonInteractionContext,
} from "./evaluations/relationshipInteractionActivation";
import type { CompatibilityResult } from "./compatibilityScore";
import { getCompatibilityCardPolicy } from "./compatibilityDisplayPolicy";
import {
  countFiveElements,
  type ComputedPillars,
  type FiveElementCount,
} from "./sajuEngine";
import { computePersonPipelineSnapshot } from "./personPipelineSnapshot";

// ── 오행 관계 맵 (클립보드 전용) ────────────────────────────────────
const GENERATES_EL: Record<string, string> = {
  목: "화", 화: "토", 토: "금", 금: "수", 수: "목",
};
const CONTROLS_EL: Record<string, string> = {
  목: "토", 화: "금", 토: "수", 금: "목", 수: "화",
};
const GENERATOR_EL: Record<string, string> = {
  화: "목", 토: "화", 금: "토", 수: "금", 목: "수",
};
const CONTROLLER_EL: Record<string, string> = {
  목: "금", 화: "수", 토: "목", 금: "화", 수: "토",
};

const WINTER_BR = ["해", "자", "축"];
const SUMMER_BR = ["사", "오", "미"];

function fmt2(n: number): string {
  return Number(n).toFixed(2);
}

/** 년주·월주·일주·시주 → 디버그 위치 라벨 */
const PILLAR_POS: Record<string, { gan: string; ji: string; whole: string }> = {
  년주: { gan: "년천간", ji: "년지", whole: "년주" },
  월주: { gan: "월천간", ji: "월지", whole: "월주" },
  일주: { gan: "일천간", ji: "일지", whole: "일주" },
  시주: { gan: "시천간", ji: "시지", whole: "시주" },
};

function collectShinsalPositionLines(shinsalFull: { pillar: string; stemItems: string[]; branchItems: string[]; pillarItems: string[] }[]): string[] {
  const rows: string[] = [];
  const seen = new Set<string>();
  for (const ps of shinsalFull) {
    const pos = PILLAR_POS[ps.pillar];
    if (!pos) continue;
    for (const n of ps.branchItems) {
      const key = `${n}|${pos.ji}`;
      if (seen.has(key)) continue;
      seen.add(key);
      rows.push(`  ${n} (${pos.ji})`);
    }
    for (const n of ps.stemItems) {
      const key = `${n}|${pos.gan}`;
      if (seen.has(key)) continue;
      seen.add(key);
      rows.push(`  ${n} (${pos.gan})`);
    }
    for (const n of ps.pillarItems) {
      const key = `${n}|${pos.whole}`;
      if (seen.has(key)) continue;
      seen.add(key);
      rows.push(`  ${n} (${pos.whole})`);
    }
  }
  rows.sort((a, b) => a.localeCompare(b, "ko"));
  return rows;
}

function buildYongshinDebugAnchorLines(
  record: PersonRecord,
  pipelineSnapshot: ReturnType<typeof computePersonPipelineSnapshot> | null,
): string[] {
  const out: string[] = [];
  const manual =
    !!(record.manualYongshinData && record.manualYongshinData.length > 0) || !!record.manualYongshin?.trim();
  if (manual) {
    out.push("  (참고) 수동 용신·용신 데이터가 있으면 화면/요약은 수동값 우선. 아래는 파이프라인 억부·조후 산출 흐름입니다.");
  }
  if (!pipelineSnapshot) {
    out.push("  파이프라인 스냅샷 없음 — 용신 근거 생략.");
    return out;
  }
  const adj = pipelineSnapshot.adjusted;
  const sd = adj.strengthResult.strengthDebug;
  const level = adj.effectiveStrengthLevel;
  const y = adj.effectiveYongshin;
  const h = adj.effectiveYongshinSecondary;
  const yr = adj.yongshinResult;
  const leak = sd ? fmt2(sd.leakagePenalty) : null;
  const leakNote =
    sd && sd.leakagePenalty <= -0.01
      ? `설기(식상·재·관 설기) 차감 ${leak} 반영 → 강약 단계 산출에 반영`
      : sd
        ? `설기 차감 ${leak} (미미)`
        : "";
  out.push(`  강약 단계: ${level}${leakNote ? ` · ${leakNote}` : ""}`);
  out.push(
    `  억부용신 규칙(지장간 가중 count 기준): ${yr.tenGodGroup} 우선 → 용신 ${y}${h ? `, 희신(보조) ${h}` : ""} (신뢰도 ${yr.confidence})`,
  );
  const sn = adj.seasonalAdjustment;
  out.push(
    sn.needsFireBoost || sn.needsWaterBoost
      ? `  조후 보정 발동: ${sn.adjustmentNote}`
      : `  조후: ${sn.adjustmentNote}`,
  );
  return out;
}

function buildDaewoonDebugLine(
  currentDaewoon: { ganZhi: { stem: string; branch: string; hangul?: string } } | undefined,
  yong: string,
  hee: string,
): string | null {
  if (!currentDaewoon) return null;
  const { stem, branch } = currentDaewoon.ganZhi;
  const hangul = currentDaewoon.ganZhi.hangul ?? `${stem}${branch}`;
  const sEl = STEM_EL[stem] ?? "";
  const bEl = STEM_EL[branch] ?? "";
  const hits: string[] = [];
  if (sEl === yong) hits.push(`${sEl}(용신) 천간 유입`);
  else if (hee && sEl === hee) hits.push(`${sEl}(희신) 천간 유입`);
  if (bEl === yong) hits.push(`${bEl}(용신) 지지 유입`);
  else if (hee && bEl === hee) hits.push(`${bEl}(희신) 지지 유입`);
  const rest: string[] = [];
  if (sEl && sEl !== yong && (!hee || sEl !== hee)) rest.push(`${sEl}(천간)`);
  if (bEl && bEl !== yong && (!hee || bEl !== hee)) rest.push(`${bEl}(지지)`);
  const mid = hits.length > 0 ? hits.join(" + ") : "용신·희신과 직접 일치하는 오행 없음(간지 조합은 아래 참고)";
  const tail = rest.length > 0 ? ` · 운에서 추가 기운: ${rest.join(", ")}` : "";
  return `  ${hangul} 대운 → ${mid}${tail}`;
}

function getElementBalanceSummary(counts: FiveElementCount): string {
  const total = Object.values(counts).reduce((a, b) => a + b, 0) || 1;
  const missing = (["목", "화", "토", "금", "수"] as const).filter((el) => (counts[el] ?? 0) === 0);
  const dominant = (["목", "화", "토", "금", "수"] as const).filter((el) => ((counts[el] ?? 0) / total) >= 0.4);
  if (missing.length === 0 && dominant.length === 0) return "오행이 고르게 분포되어 있어요. 상황에 맞춰 유연하게 조절하는 힘이 있습니다.";
  if (missing.length > 0) return `${missing.join("·")} 기운이 상대적으로 부족해요. 해당 기운을 ‘조금씩’ 보완하면 균형 잡는 데 도움이 됩니다.`;
  if (dominant.length > 0) return `${dominant.join("·")} 기운이 강하게 치우쳐 있어요. 장점이 또렷해지는 만큼, 과해지지 않게 페이스 조절이 중요합니다.`;
  return "오행 분포가 한쪽으로 쏠리는 경향이 있어요. 오늘의 컨디션에 맞춰 균형을 의식해보면 좋습니다.";
}

// ── 천간·지지 → 오행 ────────────────────────────────────────────────────
const STEM_EL: Record<string, string> = {
  갑: "목", 을: "목", 병: "화", 정: "화",
  무: "토", 기: "토", 경: "금", 신: "금",
  임: "수", 계: "수",
  인: "목", 묘: "목",
  사: "화", 오: "화",
  진: "토", 술: "토", 축: "토", 미: "토",
  유: "금",
  해: "수", 자: "수",
};

// ── 개인 사주 전체 텍스트 빌드 ─────────────────────────────────────

export function buildPersonClipboardText(
  record: PersonRecord,
  hourMode: "포함" | "제외" | "비교" = "포함",
  excludePrompt: boolean = false,
): string {
  const input = record.birthInput;
  const fullPillars = getFinalPillars(record);
  const excludeHour = hourMode === "제외";
  const pillars = excludeHour
    ? { ...fullPillars, hour: null as typeof fullPillars.hour }
    : fullPillars;

  const dayStem   = pillars.day?.hangul?.[0] ?? "";
  const dayBranch = pillars.day?.hangul?.[1] ?? "";
  const allBranches = (["year", "month", "day", "hour"] as const)
    .map((k) => pillars[k]?.hangul?.[1])
    .filter((b): b is string => !!b);
  const allStems = (["year", "month", "day", "hour"] as const)
    .map((k) => pillars[k]?.hangul?.[0])
    .filter((s): s is string => !!s);
  const monthBranch = pillars.month?.hangul?.[1] ?? "";

  const daewoonSuOpts: DaewoonSuOpts = {
    exactSolarTermBoundaryOn: record.fortuneOptions?.exactSolarTermBoundaryOn ?? true,
    trueSolarTimeOn: record.fortuneOptions?.trueSolarTimeOn ?? false,
  };
  // manualPillars 반영을 위해 raw computedPillars가 아니라 위에서 이미 병합한 pillars를 사용한다.
  const luckCycles = calculateLuckCycles(input, pillars, daewoonSuOpts);
  /** 월운·일운과 동일한 기준일( calculateLuckCycles 내부의 올해 ) */
  const refYear = luckCycles.wolun.year;
  // seun[i].year = refYear - 2 + i 이므로 올해 항목은 항상 인덱스 2
  const seunForCurrentYear =
    luckCycles.seun.find((e) => e.year === refYear) ?? luckCycles.seun[2];

  const pipelineSnapshot = computePersonPipelineSnapshot(record, {
    daewoonSuOpts,
    hourMode,
  });

  const geokguk = pipelineSnapshot?.interpretation.gukguk?.name ?? "불명";

  const counts = record.profile.fiveElementDistribution;

  const schema = buildInterpretSchema(
    dayStem, counts, monthBranch, dayBranch, allStems, allBranches,
  );

  const strengthLevel: StrengthLevel = record.manualStrengthLevel
    ? (record.manualStrengthLevel as StrengthLevel)
    : (pipelineSnapshot?.adjusted.effectiveStrengthLevel ?? schema.strengthLevel);

  const branchRelations = computeBranchRelations(allBranches);

  // ── 구조 지표 계산 ──────────────────────────────────────────────
  const dmEl    = STEM_EL[dayStem] ?? "";
  const inseongEl  = GENERATOR_EL[dmEl]   ?? "";  // 인성 원소
  const sikanEl    = GENERATES_EL[dmEl]   ?? "";  // 식상 원소
  const jaeEl      = CONTROLS_EL[dmEl]    ?? "";  // 재성 원소
  const gwansEl    = CONTROLLER_EL[dmEl]  ?? "";  // 관성 원소

  // 득령 (得令): 월지 오행이 일간 또는 인성 원소 계열
  const monthBranchEl = STEM_EL[monthBranch] ?? "";
  const deungryeong = monthBranchEl === dmEl || monthBranchEl === inseongEl;

  // 득지 (得地): 일지 오행이 일간 또는 인성 계열
  const dayBranchEl = STEM_EL[dayBranch] ?? "";
  const deungjiStr  = dayBranchEl === dmEl || dayBranchEl === inseongEl
    ? "yes"
    : dayBranchEl === sikanEl || dayBranchEl === jaeEl || dayBranchEl === gwansEl
    ? "no"
    : "partial";

  // 득세 (得勢): 사주 전체에서 비겁/인성 개수 vs 식상/재성/관성 개수
  const allChars = [...allStems, ...allBranches];
  const supportCount = allChars.filter(c => { const e = STEM_EL[c]; return e === dmEl || e === inseongEl; }).length;
  const drainCount   = allChars.filter(c => { const e = STEM_EL[c]; return e === sikanEl || e === jaeEl || e === gwansEl; }).length;
  const deungseStr   = supportCount > drainCount ? "yes" : supportCount === drainCount ? "partial" : "no";

  // 조후 필요 오행: 계절 기반 온도 보정 원소
  let johu = "조후 보완 불필요";
  if (WINTER_BR.includes(monthBranch)) {
    johu = "병·정화 — 한냉 해소 필요";
  } else if (SUMMER_BR.includes(monthBranch)) {
    if (["병", "정", "무", "기"].includes(dayStem)) {
      johu = "임·계수 — 조열 해소 필요";
    } else if (["경", "신"].includes(dayStem)) {
      johu = "임수 또는 토 — 조열 해소 필요";
    } else {
      johu = "수 보완 권장";
    }
  }

  // 희신 / 기신 / 구신 — 용신 오행 결정: 수동 설정 우선
  const FIVE_EL_SET = new Set(["목","화","토","금","수"]);
  type FiveElStr = "목"|"화"|"토"|"금"|"수";
  let yongshinEl: FiveElStr = schema.yongshin as FiveElStr;
  {
    const ydata = record.manualYongshinData;
    if (ydata && ydata.length > 0) {
      const primary = ydata.find(y => y.type.includes("억부")) ?? ydata[0];
      if (primary && primary.elements.length > 0 && FIVE_EL_SET.has(primary.elements[0])) {
        yongshinEl = primary.elements[0] as FiveElStr;
      }
    } else if (record.manualYongshin) {
      const match = record.manualYongshin.match(/^[목화토금수]/);
      if (match && FIVE_EL_SET.has(match[0])) yongshinEl = match[0] as FiveElStr;
    } else if (pipelineSnapshot?.adjusted.effectiveYongshin) {
      yongshinEl = pipelineSnapshot.adjusted.effectiveYongshin as FiveElStr;
    }
  }
  const heeshinEl =
    (record.manualYongshinData && record.manualYongshinData.length > 0) || record.manualYongshin
      ? (schema.yongshinSecondary ?? "")
      : (pipelineSnapshot?.adjusted.effectiveYongshinSecondary ?? schema.yongshinSecondary ?? "");
  const isWeak = ["극신약", "태약", "신약"].includes(strengthLevel);
  const gishinEls = isWeak
    ? [sikanEl, jaeEl, gwansEl].filter(Boolean)
    : [dmEl, inseongEl].filter(Boolean);
  const gushinEls = gishinEls.map(e => GENERATOR_EL[e]).filter(Boolean);

  // 배우자궁 충·합
  const dayBranchRels = branchRelations.filter(r =>
    r.description.includes(dayBranch) || r.description.includes("일"),
  );
  const spouseClash = dayBranchRels.some(r => ["충", "형", "파", "해", "원진"].includes(r.type));
  const spouseHarm  = dayBranchRels.some(r => r.type === "합");

  // 지지 관계 카운트
  const relCount = (type: string) => branchRelations.filter(r => r.type === type).length;

  const shinsalFull = calculateShinsalFull(
    dayStem, dayBranch,
    input.month,
    [
      { pillar: "년주", stem: pillars.year?.hangul?.[0] ?? "", branch: pillars.year?.hangul?.[1] ?? "" },
      { pillar: "월주", stem: pillars.month?.hangul?.[0] ?? "", branch: pillars.month?.hangul?.[1] ?? "" },
      { pillar: "일주", stem: pillars.day?.hangul?.[0] ?? "", branch: pillars.day?.hangul?.[1] ?? "" },
      { pillar: "시주", stem: pillars.hour?.hangul?.[0] ?? "", branch: pillars.hour?.hangul?.[1] ?? "" },
    ],
  );

  const birthYear = input.year;
  const currentDaewoon = luckCycles.daewoon.find((d) => {
    const dStart = birthYear + d.startAge;
    const dEnd   = birthYear + d.endAge;
    return refYear >= dStart && refYear <= dEnd;
  });

  // 화면(SajuReport.tsx 운세 탭)과 동일한 함수 — 배우자·결혼 활성도 연도별 표.
  // 계산식을 여기서 새로 만들지 않고 spouseActivation.ts의 순수 함수를 그대로 재사용한다.
  const spouseActivationByYear =
    pipelineSnapshot && input.gender
      ? computeSpouseActivationByYearRange({
          dayStem,
          dayBranch,
          allStems,
          gender: input.gender,
          evaluations: pipelineSnapshot.evaluations,
          yongshin: pipelineSnapshot.adjusted.effectiveYongshin,
          heesin: pipelineSnapshot.adjusted.effectiveYongshinSecondary,
          gisin: getController(pipelineSnapshot.adjusted.effectiveYongshin),
          birthYear,
          daewoon: luckCycles.daewoon,
          seunEntries: luckCycles.seun,
          fromYear: refYear,
        })
      : [];

  const lines: string[] = [];

  lines.push(`=== 사주 분석 데이터: ${input.name} ===`);
  lines.push("이 데이터에는 화면에서 사용되는 대표 요약 / 균형 해석 / 격국 판단 / 용신 판단 기준이 포함되어 있습니다.");
  lines.push("일반적인 사주 해석이 아니라 구조 중심 해석을 요청합니다.");
  lines.push("본 데이터는 구조 중심 해석 기준(anchor)이 포함된 분석 payload입니다.");
  lines.push("일반적인 사주 설명 대신 구조 기준 유지 해석을 요청합니다.");
  lines.push(`생년월일: ${input.year}년 ${input.month}월 ${input.day}일 (${input.calendarType === "solar" ? "양력" : "음력"})`);
  if (!excludeHour && !input.timeUnknown && input.hour != null) {
    lines.push(`출생시: ${String(input.hour).padStart(2, "0")}:${String(input.minute ?? 0).padStart(2, "0")}`);
  } else {
    lines.push(`출생시: 미상`);
  }
  lines.push(`성별: ${input.gender}`);
  if (input.birthplace) lines.push(`출생지: ${input.birthplace}`);
  lines.push("");

  // 사주팔자
  lines.push(`[사주팔자]`);
  const PILLAR_LABELS: Record<string, string> = { year: "년주", month: "월주", day: "일주", hour: "시주" };
  for (const key of ["year", "month", "day", "hour"] as const) {
    const p = pillars[key];
    if (p) lines.push(`  ${PILLAR_LABELS[key]}: ${p.hangul}`);
  }
  lines.push("");
  if (!pipelineSnapshot) {
    lines.push("[경고] 파이프라인 스냅샷을 만들지 못했습니다. 구조 재물·7영역 등 클립보드 블록이 생략될 수 있습니다.");
    lines.push("");
  }

  // 일간
  lines.push(`[일간]`);
  lines.push(`  ${dayStem}(${STEM_EL[dayStem] ?? ""}일간) — ${STRENGTH_DISPLAY_LABEL[strengthLevel] ?? schema.strengthDisplayLabel} [${strengthLevel}]`);
  lines.push(`  ${schema.strengthDesc}`);
  lines.push(`  득령: ${deungryeong ? "O" : "X"}  득지: ${deungjiStr === "yes" ? "O" : deungjiStr === "partial" ? "△" : "X"}  득세: ${deungseStr === "yes" ? "O" : deungseStr === "partial" ? "△" : "X"}`);
  lines.push(`  격국: ${geokguk}`);
  lines.push(`  조후: ${johu}`);
  lines.push("");

  const strengthDebug = pipelineSnapshot?.adjusted.strengthResult.strengthDebug;
  if (strengthDebug) {
    lines.push(`[강약 검증 리포트]`);
    lines.push("");
    lines.push(`일간 기준: ${strengthDebug.dayStem}`);
    lines.push("");
    lines.push(`득령: ${fmt2(strengthDebug.deukryeong)}`);
    lines.push(`득지: ${fmt2(strengthDebug.branchContrib)}`);
    lines.push(`득세: ${fmt2(strengthDebug.stemContrib)}`);
    lines.push("");
    lines.push(`설기 차감: ${fmt2(strengthDebug.leakagePenalty)}`);
    lines.push(`음간 보정: ${fmt2(strengthDebug.yinAdjustment)}`);
    lines.push("");
    lines.push(`최종 점수: ${fmt2(strengthDebug.finalScore)}`);
    lines.push(`최종 단계: ${strengthDebug.finalLevel}`);
    lines.push("");
  }

  const evaluations = pipelineSnapshot?.evaluations;
  if (evaluations) {
    const o = evaluations.officerActivation;
    const s = evaluations.spousePalaceStability;
    const w = evaluations.wealthActivation;
    lines.push(`[관계·재물 구조 지표]`);
    lines.push("");
    lines.push(`관성 작동 점수:`);
    lines.push(`${fmt2(o.score)}`);
    lines.push(`(${o.grade})`);
    lines.push("");
    lines.push(`배우자궁 안정도:`);
    lines.push(`${fmt2(s.score)}`);
    lines.push(`(${s.grade})`);
    lines.push("");
    lines.push(`재물 구조 종합 점수(채널·감당·축적 결합):`);
    lines.push(`${fmt2(w.score)}`);
    lines.push(`(${w.grade})`);
    lines.push("");
    lines.push(`관성 요약:`);
    lines.push(`${o.summary}`);
    lines.push("");
    lines.push(`배우자궁 요약:`);
    lines.push(`${s.summary}`);
    lines.push("");
    lines.push(`재물 구조 요약:`);
    lines.push(`${w.summary}`);
    lines.push("");
  }

  const wStruct = pipelineSnapshot?.structureDomains?.wealth;
  if (wStruct) {
    lines.push(`[원국 재물 구조 (화면 요약과 동일)]`);
    lines.push("");
    lines.push(`최종 재물 구조 점수: ${wStruct.score}점`);
    lines.push(`유형: ${wStruct.classification}`);
    if (wStruct.wealthAxes) {
      lines.push(`보조·재물 채널: ${wStruct.wealthAxes.channelScore}점`);
      lines.push(`재물 감당력: ${wStruct.wealthAxes.capacityScore}점`);
      lines.push(`재물 축적력: ${wStruct.wealthAxes.accumulationScore}점`);
    } else {
      lines.push(`(세부 채널·감당·축적 필드 없음 — 앱/엔진 최신화 필요)`);
    }
    lines.push("");
    lines.push(
      "재물 채널이 강하더라도 실제 감당력과 축적력에 따라 체감은 달라질 수 있습니다.",
    );
    lines.push("");
  }

  const timingActivation = pipelineSnapshot?.timingActivation;
  if (timingActivation) {
    lines.push(`[현재 운 활성화 점수]`);
    lines.push("");
    const careerActivation = pipelineSnapshot?.careerActivation;
    if (careerActivation) {
      lines.push(`현재 커리어 2축 (식상·관성·인성 3축 + 격국·용신 종합, 관성 단일 축과 다름 — 활성도≠전개방향):`);
      lines.push(`  💼 커리어 활성도(방향 무관 사건 크기): ${careerActivation.activationScore}점 (${careerActivation.activationLevel})`);
      lines.push(`  📈 커리어 전개 방향(확장·성과 ↔ 압박·축소): ${careerActivation.directionScore}점 (${careerActivation.directionLevel})`);
      lines.push(`  해석: ${careerActivation.interpretation}`);
      if (careerActivation.factors.length > 0) {
        lines.push(`  근거: ${careerActivation.factors.map((f) => f.label).join(" / ")}`);
      }
      lines.push("");
    }
    const officerActivation = pipelineSnapshot?.officerActivation;
    if (officerActivation) {
      lines.push(`현재 관성 2축(단일 축 — 조직·규율·직위, 위 커리어 활성도의 구성 요소 중 하나 — 활성도≠작동방향):`);
      lines.push(`  🏛️ 조직·책임 활성도(방향 무관 사건 크기): ${officerActivation.activationScore}점 (${officerActivation.activationLevel})`);
      lines.push(`  ⚖️ 조직·책임 작동 방향(재생관/상관견관 + 용신·희신·기신 종합): ${officerActivation.directionScore}점 (${officerActivation.directionLevel})`);
      lines.push(`  해석: ${officerActivation.interpretation}`);
      if (officerActivation.factors.length > 0) {
        lines.push(`  근거: ${officerActivation.factors.map((f) => f.label).join(" / ")}`);
      }
      lines.push("");
    } else {
      lines.push(`현재 관성 활성도(단일 축 — 조직·규율·직위):`);
      lines.push(`${fmt2(timingActivation.officerActivationNow)}`);
      lines.push(`(${timingActivation.officerActivationTrend})`);
      lines.push("");
    }
    const wealthActivation = pipelineSnapshot?.wealthActivation;
    if (wealthActivation) {
      lines.push(`현재 재물 3축(원국 재물 그릇과 분리된 이 해의 timing — 활성도≠유입도≠안정축적도):`);
      lines.push(`  💰 재물 활성도(방향 무관 사건 크기): ${wealthActivation.activationScore}점 (${wealthActivation.activationLevel})`);
      lines.push(`  📈 재물 유입 기회도(수익으로 연결될 기회·채널이 열리는 방향 — 실제 현금 입금 시점과는 다를 수 있음): ${wealthActivation.inflowScore}점 (${wealthActivation.inflowLevel})`);
      lines.push(`  🏦 재물 안정·축적도(남기고 지키기 쉬운 정도): ${wealthActivation.stabilityScore}점 (${wealthActivation.stabilityLevel})`);
      lines.push(`  해석: ${wealthActivation.interpretation}`);
      if (wealthActivation.factors.length > 0) {
        lines.push(`  근거: ${wealthActivation.factors.map((f) => f.label).join(" / ")}`);
      }
      lines.push("");
    } else {
      lines.push(`현재 재물운 활성도(종합·timing):`);
      lines.push(`${fmt2(timingActivation.wealthActivationNow)}`);
      lines.push(`(${timingActivation.wealthActivationTrend})`);
      lines.push("");
    }
    const examCareerActivation = pipelineSnapshot?.examCareerActivation;
    if (examCareerActivation) {
      lines.push(`현재 🎯 합격운(시험·자격 / 채용·임용·조직 선발 / 공모·심사·발표형 선발을 서로 다른 구조로 계산 — 활성도가 높다고 "합격 가능성 높음"을 뜻하지 않음):`);
      for (const [key, label] of [
        ["examCert", "📖 시험·자격"],
        ["hiring", "🏢 채용·임용·조직 선발"],
        ["competition", "🏆 공모·심사·발표형 선발"],
      ] as const) {
        const sub = examCareerActivation[key];
        lines.push(`  ${label} — 활성도 ${sub.activationScore}점(${sub.activationLevel}) / 방향 ${sub.directionScore}점(${sub.directionLevel})`);
        lines.push(`    해석: ${sub.interpretation}`);
      }
      lines.push(`  일간 감당력: ${examCareerActivation.dayMasterCapacityNote}`);
      lines.push("");
    }
    const contractActivation = pipelineSnapshot?.contractActivation;
    if (contractActivation) {
      lines.push(`현재 📝 계약운(식상·재성·관성·인성 4축 — 인성이 없으면 체결로 단정하지 않음, 체결운≠수익성):`);
      lines.push(`  📝 계약 체결운 활성도(방향 무관 사건 크기): ${contractActivation.activationScore}점 (${contractActivation.activationLevel})`);
      lines.push(`  체결 방향: ${contractActivation.directionScore}점 (${contractActivation.directionLevel})`);
      lines.push(`  💰 계약 수익성(재성 축 방향만): ${contractActivation.profitabilityScore}점 (${contractActivation.profitabilityLevel})`);
      lines.push(`  인성(문서·검토·승인) 근거 확인됨: ${contractActivation.hasDocumentationEvidence ? "예" : "아니오 — 체결 단정 금지"}`);
      lines.push(`  해석: ${contractActivation.interpretation}`);
      if (contractActivation.factors.length > 0) {
        lines.push(`  근거: ${contractActivation.factors.map((f) => f.label).join(" / ")}`);
      }
      lines.push("");
    }
    lines.push(`현재 배우자궁 안정도:`);
    lines.push(`${fmt2(timingActivation.spousePalaceStabilityNow)}`);
    lines.push(`(${timingActivation.spouseActivationTrend})`);
    lines.push("");
  }

  // 🎯 합격운 · 📝 계약운 월별 조견표 — 작년·올해·내년(3개년) × 12개월, 대운·세운·월운을
  // 각 달 기준으로 새로 계산해서 표로 제공한다. computeExamCareerActivation/computeContractActivation은
  // 화면(SajuReport.tsx)과 동일한 순수 함수를 그대로 재사용하고 여기서 새로 계산식을 만들지 않는다.
  if (pipelineSnapshot && dayStem) {
    const yongshinForTable = pipelineSnapshot.adjusted.effectiveYongshin;
    const heesinForTable = pipelineSnapshot.adjusted.effectiveYongshinSecondary;
    const gisinForTable = getController(yongshinForTable);
    const strengthForTable = pipelineSnapshot.adjusted.effectiveStrengthLevel;

    const findDaewoonForYear = (year: number): DaewoonEntry | undefined =>
      luckCycles.daewoon.find((d) => year >= birthYear + d.startAge && year <= birthYear + d.endAge);

    lines.push(`[🎯 합격운 · 📝 계약운 월별 조견표] (작년·올해·내년 3개년 × 12개월 — 화면과 동일한 계산식, 대운·세운·월운 종합)`);
    lines.push("");
    for (const year of [refYear - 1, refYear, refYear + 1]) {
      const dw = findDaewoonForYear(year);
      const daewoonHangulForYear = dw ? `${dw.ganZhi.stem}${dw.ganZhi.branch}` : undefined;
      const seYear = getYearGanZhi(year);
      const saeunHangulForYear = `${seYear.stem}${seYear.branch}`;
      lines.push(`■ ${year}년 (대운 ${daewoonHangulForYear ?? "-"} · 세운 ${saeunHangulForYear})`);
      for (let month = 1; month <= 12; month++) {
        const mo = getMonthGanZhi(year, month);
        const wolunHangulForMonth = `${mo.stem}${mo.branch}`;
        const exam = computeExamCareerActivation({
          dayStem, daewoonHangul: daewoonHangulForYear, saeunHangul: saeunHangulForYear,
          wolunHangul: wolunHangulForMonth,
          yongshin: yongshinForTable, heesin: heesinForTable, gisin: gisinForTable,
          strengthLevel: strengthForTable,
        });
        const contract = computeContractActivation({
          dayStem, daewoonHangul: daewoonHangulForYear, saeunHangul: saeunHangulForYear,
          wolunHangul: wolunHangulForMonth,
          yongshin: yongshinForTable, heesin: heesinForTable, gisin: gisinForTable,
        });
        lines.push(
          `  ${month}월(${wolunHangulForMonth}) — 합격운[시험 ${exam.examCert.activationScore}/${exam.examCert.directionLevel} · 채용 ${exam.hiring.activationScore}/${exam.hiring.directionLevel} · 공모 ${exam.competition.activationScore}/${exam.competition.directionLevel}] ` +
          `계약운[체결 ${contract.activationScore}/${contract.directionLevel} · 수익성 ${contract.profitabilityLevel}]`,
        );
      }
      lines.push("");
    }
    lines.push(`※ 위 표의 점수는 활성도(사건 크기)/방향(우호·부담)이며, 숫자가 높다고 "합격/체결"을 뜻하지 않습니다 — 방향과 함께 해석하세요.`);
    lines.push("");
  }

  // 화면(운세 탭)의 "❤️ 배우자·결혼 활성도 / 🏠 배우자궁 안정도" 카드와 동일한
  // computeSpouseActivation 결과(pipelineSnapshot.spouseActivation)를 그대로 옮긴다.
  const spouseActivation = pipelineSnapshot?.spouseActivation;
  if (spouseActivation) {
    lines.push(`[결혼·배우자 활성 구조]`);
    lines.push("");
    lines.push(`현재 결혼·배우자 테마 활성도: ${spouseActivation.activationScore}점 / ${spouseActivation.activationLevel}`);
    const nextYearEntry = spouseActivationByYear[1];
    // activation은 방향 무관 사건 크기 축이므로 상승/하락(가치 판단형 표현) 대신 강화/완화로 표기한다.
    const activationTrend = nextYearEntry
      ? nextYearEntry.activation.activationScore > spouseActivation.activationScore + 7
        ? "강화"
        : nextYearEntry.activation.activationScore < spouseActivation.activationScore - 7
          ? "완화"
          : "보통"
      : "보통";
    lines.push(`추세(내년 대비): ${activationTrend}`);
    lines.push(`현재 배우자궁 안정도: ${spouseActivation.stabilityScore}점 / ${spouseActivation.stabilityLevel}`);
    lines.push("");
    lines.push(`활성도 × 안정도 조합 해석:`);
    lines.push(`  ${spouseActivation.interpretation}`);
    lines.push("");
    lines.push(`활성 근거:`);
    if (spouseActivation.factors.length > 0) {
      for (const f of spouseActivation.factors) {
        lines.push(`  · [${f.direction}] ${f.label}`);
      }
    } else {
      lines.push(`  · (뚜렷한 자극 요소 없음 — 배경 수준 활성도만 적용)`);
    }
    lines.push("");
    lines.push(
      `※ "결혼하기 좋은 해"를 판정하는 점수가 아니라, 배우자·연애·결혼 관련 사건·고민·결단이 얼마나 강하게 움직이는 시기인지를 보여주는 참고 지표입니다. 안정도가 낮다고 활성도까지 낮은 건 아닙니다.`,
    );
    lines.push("");
  }

  const structureDomains = pipelineSnapshot?.structureDomains;
  if (structureDomains) {
    lines.push(`[구조 기반 7영역 점수]`);
    lines.push(
      "각 영역은 단순 존재 가산이 아니라 작동력·감당력·안정성 등 구조 가중·결합(예: 재물 구조=세 축 기하평균)으로 산출됩니다.",
    );
    lines.push("");
    const domainOrder = [
      structureDomains.wealth,
      structureDomains.career,
      structureDomains.honor,
      structureDomains.social,
      structureDomains.romance,
      structureDomains.health,
      structureDomains.execution,
    ] as const;
    for (const d of domainOrder) {
      if (d.domainKey === "wealth" && d.wealthAxes) {
        lines.push(`${d.labelKo} — 최종(메인) ${d.score}점 · 기하평균(채널×감당×축적)`);
        lines.push(`  재물 유형: ${d.classification}`);
        lines.push(`  보조·재물 채널(작동 통로): ${d.wealthAxes.channelScore}점`);
        lines.push(`  재물 감당력: ${d.wealthAxes.capacityScore}점`);
        lines.push(`  재물 축적력: ${d.wealthAxes.accumulationScore}점`);
      } else {
        lines.push(`${d.labelKo} ${d.score}점`);
        lines.push(`  구조 유형: ${d.classification}`);
      }
      lines.push(`  작동 요소:`);
      if (d.workingFactors.length === 0) lines.push(`    · (해당 문구 없음)`);
      else for (const x of d.workingFactors) lines.push(`    · ${x}`);
      lines.push(`  감점 요소:`);
      if (d.demeritFactors.length === 0) lines.push(`    · (해당 문구 없음)`);
      else for (const x of d.demeritFactors) lines.push(`    · ${x}`);
      lines.push(`  요약: ${d.summary}`);
      lines.push("");
    }
  }

  // 대표 요약 (화면 해석 핵심)
  lines.push(`[대표 요약]`);
  const domEl = schema.dominantElement as FiveElKey;
  const dmElKey = (STEM_EL[dayStem] ?? "") as FiveElKey;
  const domGroup = (dmElKey && domEl) ? getTenGodGroup(dmElKey, domEl) : "";
  lines.push(`  대표 오행: ${domEl}`);
  if (domGroup) lines.push(`  대표 십성(그룹): ${domGroup}`);
  lines.push(`  십성 기준(anchor): ${dayStem} 일간 기준`);
  lines.push(`  오행 기준(anchor): ${dayStem}${STEM_EL[dayStem] ?? ""} 일간 기준`);
  lines.push(`  오행 균형 해석: ${getElementBalanceSummary(counts)}`);
  lines.push(`  성격 기질 분석 요약: ${schema.strengthDesc} · 대표 오행(${domEl}) 성향이 비교적 또렷하게 드러납니다.`);
  lines.push(`  격국 해석 설명: 앱 파이프라인 격국(${geokguk})을 참고합니다.`);
  lines.push(`  격국 기준(anchor): ${geokguk} (내격 확정 결과 — determineGukguk)`);
  lines.push(`  격국 판단 방식(anchor): 월지 지장간 투출 기준(determineGukguk)`);

  // 월령 후보(latentGukguk) — 내격이 미확정(격국 없음)일 때만 채워지는 설명용 보조 정보.
  // 재계산 없이 파이프라인이 이미 산출한 값만 옮겨 적는다. 내격 판정을 대체하지 않는다.
  const latentGukguk = pipelineSnapshot?.interpretation.latentGukguk;
  if (latentGukguk) {
    lines.push(`  월령 후보(내격 미확정 보조, latentGukguk): ${latentGukguk.name} — 천간 미투출로 내격 확정 아님`);
    lines.push(`    근거: ${latentGukguk.explanation.join(" / ")}`);
  }

  // 특별격 후보(전왕격·종격, specialPatterns) — 내격을 대체하지 않는 병렬 설명용 보조 정보.
  // 재계산 없이 파이프라인이 이미 산출한 confidence/근거를 그대로 옮겨 적는다.
  const specialPatterns = pipelineSnapshot?.interpretation.specialPatterns ?? [];
  const appliedSpecial = pipelineSnapshot?.adjusted.appliedSpecialGukguk ?? null;
  if (specialPatterns.length > 0) {
    lines.push(`  특별격 후보(전왕격·종격, 내격과 병렬 표시, specialPatterns):`);
    for (const c of specialPatterns) {
      const appliedTag = appliedSpecial?.name === c.name ? " [적용됨 — 용신 순세 취용]" : " [미적용]";
      lines.push(`    ${c.name} [${c.category}] confidence=${c.confidence}${appliedTag}`);
      lines.push(`      성립 근거(supportingEvidence): ${c.supportingEvidence.join(" / ")}`);
      if (c.opposingEvidence.length > 0) {
        lines.push(`      방해 근거(opposingEvidence): ${c.opposingEvidence.join(" / ")}`);
      }
    }
  }

  // 용신 판단 기준: high confidence 특별격이 적용된 경우 순세 취용임을 명시.
  // yongshinEl/heeshinEl 등 기존 계산값은 그대로 두고, 설명 문구만 분기한다(재계산 없음).
  if (appliedSpecial) {
    lines.push(`  용신 해석 설명: 특별격(${appliedSpecial.name}, high) 순세 취용이 적용되어, 일간 강약 기반 억부용신 대신 ${yongshinEl}${heeshinEl ? `(+${heeshinEl})` : ""}을(를) 용신으로 봅니다. ${appliedSpecial.yongshinReason}`);
    lines.push(`  용신 판단 기준(anchor): 특별격 순세 취용(${appliedSpecial.name}, high) — 일간 강약 기반 억부용신 아님`);
  } else {
    lines.push(`  용신 해석 설명: 일간 강약(${strengthLevel}) 흐름에 맞춰 ${yongshinEl}${heeshinEl ? `(+${heeshinEl})` : ""} 쪽을 우선으로 봅니다. (신뢰도: ${schema.yongshinConfidence})`);
    lines.push(`  용신 판단 기준(anchor): 일간 강약 기반 자동 계산`);
  }
  lines.push("");

  // 오행 분포
  lines.push(`[오행 분포]`);
  const elOrder = ["목", "화", "토", "금", "수"] as const;
  for (const el of elOrder) {
    const count = counts[el];
    const bar = "▓".repeat(count) + "░".repeat(Math.max(0, 4 - count));
    lines.push(`  ${el}: ${bar} (${count}개)`);
  }
  lines.push("");

  // 십성 분포
  lines.push(`[십성 분포]`);
  if (dayStem) {
    const tgCount: Record<string, number> = {};
    for (const key of ["year", "month", "hour"] as const) {
      const p = pillars[key];
      if (!p) continue;
      for (const ch of [p.hangul[0], p.hangul[1]]) {
        if (!ch) continue;
        const tg = getTenGod(dayStem, ch);
        if (tg) tgCount[tg] = (tgCount[tg] ?? 0) + 1;
      }
    }
    const tgStr = Object.entries(tgCount).map(([tg, c]) => `${tg}×${c}`).join("  ");
    lines.push(`  ${tgStr || "없음"}`);
  }
  lines.push("");

  // 용신
  lines.push(`[용신]`);
  const ydata = record.manualYongshinData;
  if (ydata && ydata.length > 0) {
    for (const y of ydata) {
      lines.push(`  ${y.type}: ${y.elements.join(", ")}`);
    }
  } else if (record.manualYongshin) {
    lines.push(`  ${record.manualYongshin}`);
  } else {
    lines.push(`  ${schema.yongshinLabel} (자동계산)`);
    if (schema.yongshinSecondary) lines.push(`  희신(보조): ${schema.yongshinSecondary}`);
  }
  lines.push("");

  // 용신 그룹 (희신/기신/구신)
  lines.push(`[희신 / 기신 / 구신]`);
  lines.push(`  용신: ${yongshinEl}  (용신 분류: ${schema.yongshinTenGodGroup}, 신뢰도: ${schema.yongshinConfidence})`);
  lines.push(`  희신: ${heeshinEl || "없음"}`);
  lines.push(`  기신: ${gishinEls.join("·") || "없음"}`);
  lines.push(`  구신: ${[...new Set(gushinEls)].join("·") || "없음"}`);
  lines.push("");

  // 배우자궁
  lines.push(`[배우자궁 (일지)]`);
  lines.push(`  일지: ${dayBranch}  충/극: ${spouseClash ? "있음" : "없음"}  합: ${spouseHarm ? "있음" : "없음"}`);
  lines.push("");

  // 지지 합충형파해
  lines.push(`[지지 합충형파해]`);
  const relTypes = ["합", "충", "형", "파", "해", "원진"];
  const relSummary = relTypes
    .map(t => `${t}×${relCount(t)}`)
    .join("  ");
  lines.push(`  ${relSummary}`);
  if (branchRelations.length > 0) {
    // 삼합·방합(3지 구조)은 지지쌍마다 관계 객체가 하나씩 나와 같은 설명이 여러 번 잡힌다
    // (예: 해자축 방합이 해-자/해-축/자-축 세 쌍으로). type+description이 같으면 표시는 한 번만.
    const seenRelText = new Set<string>();
    for (const rel of branchRelations) {
      const key = `${rel.type}|${rel.description}`;
      if (seenRelText.has(key)) continue;
      seenRelText.add(key);
      lines.push(`  ${rel.type}: ${rel.description}`);
    }
  } else {
    lines.push("  (없음)");
  }
  lines.push("");

  // 신살
  lines.push(`[신살]`);
  const allShinsalNames: string[] = [];
  for (const ps of shinsalFull) {
    allShinsalNames.push(...ps.stemItems, ...ps.branchItems, ...ps.pillarItems);
  }
  const uniqueShinsal = [...new Set(allShinsalNames)].filter(Boolean);
  if (uniqueShinsal.length > 0) {
    lines.push(`  ${uniqueShinsal.join("  ")}`);
  } else {
    lines.push("  없음");
  }
  lines.push("");

  // 운 흐름
  lines.push(`[운 흐름]`);
  if (currentDaewoon) {
    const dStart = birthYear + currentDaewoon.startAge;
    const dEnd   = birthYear + currentDaewoon.endAge;
    lines.push(
      `  현재 대운: ${currentDaewoon.ganZhi.stem}${currentDaewoon.ganZhi.branch}` +
      ` (${dStart}~${dEnd}년)`,
    );
  }
  if (seunForCurrentYear) {
    lines.push(
      `  세운 (${seunForCurrentYear.year}): ${seunForCurrentYear.ganZhi.stem}${seunForCurrentYear.ganZhi.branch}`,
    );
  }
  lines.push("");

  // 대운 전체 목록 — "현재 대운"만으로는 다른 연도·나이를 물어봐도 어느 구간인지
  // AI가 알 수 없으므로, 10개 구간 전체를 나이·연도와 함께 제공한다.
  if (luckCycles.daewoon.length > 0) {
    lines.push(`[대운 전체 목록] (10년 단위 총 ${luckCycles.daewoon.length}개 구간, 각 구간의 시작 연도부터 유효)`);
    for (const d of luckCycles.daewoon) {
      const dStart = birthYear + d.startAge;
      const dEnd = birthYear + d.endAge;
      const isCurrent = currentDaewoon && d.startAge === currentDaewoon.startAge;
      lines.push(
        `  ${d.startAge}~${d.endAge}세 (${dStart}~${dEnd}년): ${d.ganZhi.stem}${d.ganZhi.branch}` +
        (isCurrent ? "  ← 현재" : ""),
      );
    }
    lines.push("");
  }

  // 세운(연간지) 자동 계산 규칙 — 매 연도를 표로 나열하는 대신, 60갑자 순환 규칙과
  // 기준점(1984=갑자년)을 알려줘서 AI가 임의 연도의 세운을 직접 계산하게 한다.
  lines.push(`[세운(연간지) 자동 계산 규칙]`);
  lines.push(`아래 규칙으로 임의 연도 Y의 세운 간지를 직접 계산할 수 있습니다. 사용자가 올해가 아닌 다른 연도·나이를 물으면 이 규칙과 위 [대운 전체 목록]을 함께 사용해 답변하세요.`);
  lines.push(`  기준점: 1984년 = 갑자(甲子)년`);
  lines.push(`  천간 순서(10개, 0부터): 갑,을,병,정,무,기,경,신,임,계`);
  lines.push(`  지지 순서(12개, 0부터): 자,축,인,묘,진,사,오,미,신,유,술,해`);
  lines.push(`  계산: d = Y - 1984  (d가 음수면 천간은 10을, 지지는 12를 더해 양수 나머지로 맞춘다)`);
  lines.push(`    천간 = 천간순서[ d mod 10 ]`);
  lines.push(`    지지 = 지지순서[ d mod 12 ]`);
  lines.push(`  검증 예시: 2024년 → d=40 → 40 mod 10=0(갑) · 40 mod 12=4(진) → 갑진(甲辰)년`);
  lines.push(`  검증 예시: ${seunForCurrentYear?.year ?? refYear}년(올해, 위 [운 흐름]의 세운 값과 반드시 일치해야 함) → ${seunForCurrentYear ? `${seunForCurrentYear.ganZhi.stem}${seunForCurrentYear.ganZhi.branch}` : "위 값 참고"}`);
  lines.push("");

  // 월운(월간지) 조견표 — 절기 경계가 껴 있어 AI가 공식만으로 계산하면 틀리기 쉬우므로,
  // 직접 계산시키지 않고 근시일 범위를 표로 통째로 제공한다.
  {
    const wolunMonths: { year: number; month: number; ganZhi: { stem: string; branch: string } }[] = [];
    let wy = refYear;
    let wm = luckCycles.wolun.month;
    for (let i = 0; i < 24; i++) {
      wolunMonths.push({ year: wy, month: wm, ganZhi: getMonthGanZhi(wy, wm) });
      wm += 1;
      if (wm > 12) { wm = 1; wy += 1; }
    }
    lines.push(`[월운(월간지) 조견표] (이번 달부터 24개월치 — 이 범위 밖의 월은 계산하지 말고 "제공되지 않은 범위"라고 답하세요)`);
    for (const w of wolunMonths) {
      const mark = w.year === luckCycles.wolun.year && w.month === luckCycles.wolun.month ? "  ← 이번 달" : "";
      lines.push(`  ${w.year}년 ${w.month}월: ${w.ganZhi.stem}${w.ganZhi.branch}${mark}`);
    }
    lines.push("");
  }

  // 화면(운세 탭)의 "결혼운 시기 힌트" 카드와 동일한 데이터 — 새 계산식 없이 위에서 이미
  // 구한 spouseActivationByYear(computeSpouseActivationByYearRange)를 그대로 나열한다.
  if (spouseActivationByYear.length > 0) {
    lines.push(`[결혼운 시기 힌트]`);
    lines.push("");
    lines.push(`향후 연도별 배우자·결혼 테마 활성도 / 배우자궁 안정도 (각 연도의 실제 대운 기준):`);
    for (const y of spouseActivationByYear) {
      lines.push(
        `  ${y.year} ${y.ganZhiHangul} — 활성도 ${y.activation.activationScore}점(${y.activation.activationLevel}) / ` +
        `안정도 ${y.activation.stabilityScore}점(${y.activation.stabilityLevel})`,
      );
      lines.push(`    조합: ${y.activation.interpretation}`);
      if (y.activation.factors.length > 0) {
        lines.push(`    활성 근거: ${y.activation.factors.map((f) => f.label).join(" / ")}`);
      }
    }
    lines.push("");
    const top3 = topSpouseActivationYears(spouseActivationByYear, 3);
    if (top3.length > 0) {
      lines.push(
        `배우자·결혼 테마가 특히 강한 연도 TOP${top3.length}: ${top3.map((y) => `${y.year}년(${y.activation.activationScore}점)`).join(" > ")}`,
      );
      lines.push("");
    }
    lines.push(
      `※ 위 표는 "결혼하기 좋은 해" 판정이 아니라, 배우자·결혼 관련 사건·고민·결단이 강하게 발생할 수 있는 해를 보여주는 참고 지표입니다.`,
    );
    lines.push("");
  }

  lines.push("본 분석에는 강약 보정(설기·음간 포함),");
  lines.push("관계·재물 구조 지표(재물 구조=종합),");
  lines.push("대운·세운 활성화 가중이 적용되었습니다.");

  // ── debug anchor (append-only: 기존 payload 순서·필드 유지) ─────────
  lines.push("");
  lines.push("[debug anchor: 신살 발생 위치]");
  const shinsalPosLines = collectShinsalPositionLines(shinsalFull);
  if (shinsalPosLines.length > 0) {
    for (const l of shinsalPosLines) lines.push(l);
  } else {
    lines.push("  (해당 없음 또는 신살 미검출)");
  }

  lines.push("");
  lines.push("[debug anchor: 격국 성립 근거]");
  const gkDbg = pipelineSnapshot?.interpretation.gukguk;
  if (gkDbg) {
    const tEl = gkDbg.transparentStem ? STEM_EL[gkDbg.transparentStem] : "";
    lines.push(
      `  요약: ${gkDbg.name} (월지 ${gkDbg.monthBranch}${gkDbg.transparentStem ? ` · 지장간 투출 천간 ${gkDbg.transparentStem}${tEl ? `=${tEl}` : ""}` : ""})`,
    );
    for (const ex of gkDbg.explanation ?? []) lines.push(`  ${ex}`);
  } else {
    lines.push("  투출 조건 미충족 등으로 격국 미확정(determineGukguk → null).");
  }

  lines.push("");
  lines.push("[debug anchor: 용신 판단 근거]");
  for (const l of buildYongshinDebugAnchorLines(record, pipelineSnapshot)) lines.push(l);

  lines.push("");
  lines.push("[debug anchor: 현재 대운 영향]");
  const dwDbg = buildDaewoonDebugLine(currentDaewoon, yongshinEl, heeshinEl ?? "");
  if (dwDbg) lines.push(dwDbg);
  else lines.push("  현재 대운 구간 없음 또는 데이터 없음.");

  lines.push("");
  lines.push("[debug anchor: 배우자궁 안정도 산출 근거]");
  const spouseDbg = evaluations?.spousePalaceStability?.debug;
  if (spouseDbg && spouseDbg.length > 0) {
    for (const d of spouseDbg) lines.push(`  ${d}`);
  } else {
    lines.push("  (평가 블록 없음 또는 일지 미상으로 중립 처리)");
  }

  if (!excludePrompt) {
    lines.push("");
    lines.push("---");
    lines.push("[AI 해석 요청 프롬프트]");
    lines.push("당신은 20년 경력의 통찰력 있고 따뜻한 명리학 전문가입니다.");
    lines.push("위의 사주 구조 데이터를 바탕으로, 내담자에게 직접 말하듯 다정하고 이해하기 쉬운 현대적인 언어로 다음 목차에 따라 사주를 해석해 주세요.");
    lines.push("");
    lines.push("1. 🔮 지금 당장의 운세 (현재 대운과 올해 세운을 중심으로 '지금 내 운의 흐름이 어떤지' 가장 먼저 브리핑해 주세요. 사용자가 다른 연도·나이를 물으면 위 [대운 전체 목록]과 [세운(연간지) 자동 계산 규칙]을 사용해 그 해의 세운을 직접 계산해서 답하고, 다른 달을 물으면 [월운(월간지) 조견표]에서 찾아 답하세요 — 표 범위 밖의 월과 일 단위(일운)는 데이터가 없으니 계산하지 말고 모른다고 답하세요.)");
    lines.push("2. 💼 돈과 커리어 (어떤 일을 해야 돈을 벌기 좋은지, 내 사주의 재물 그릇과 재물 축적 방식에 대해 상세히 풀어주세요.)");
    lines.push("3. 💕 연애와 결혼운 (어떤 사람과 잘 맞는지, 나의 연애 성향과 다가오는 좋은 연애/결혼 타이밍에 대해 조언해 주세요.)");
    lines.push("4. 🌟 타고난 본성과 무기 (가장 강한 오행과 십성을 바탕으로 내가 가진 가장 강력한 무기와 잠재력을 알려주세요.)");
    lines.push("5. 💡 실생활 개운법 (아쉬운 점을 보완하고 특히 재물운과 연애운을 높이기 위해 일상에서 실천할 수 있는 구체적인 팁 3가지를 제안해 주세요.)");
    lines.push("");
    lines.push("어려운 한자어는 최대한 피하거나 반드시 쉽게 풀어서 설명하고, 희망적이고 긍정적인 조언을 중심으로 작성해 주세요.");
    lines.push("");
    pushInterpretationConsistencyRules(lines);
  }

  return lines.join("\n");
}

/** [해석 일관성 규칙] — 제공된 계산 결과를 anchor로 고정하고 AI가 임의로 재계산·역전하지 않도록 하는 공통 지시. 개인·궁합 프롬프트 하단에 동일하게 붙인다. */
function pushInterpretationConsistencyRules(lines: string[]): void {
  lines.push("---");
  lines.push("[해석 일관성 규칙]");
  lines.push("제공된 계산 점수·등급·관계 유형·evidence를 최우선 anchor로 사용한다.");
  lines.push("이미 계산된 점수를 AI가 임의로 재계산하거나 상향·하향하지 않는다.");
  lines.push("동일 데이터라면 핵심 결론이 달라지지 않도록 한다.");
  lines.push("표현 방식은 달라질 수 있으나 좋음/보통/주의, 활성/조화/안정, 인간관계/연애/결혼 궁합의 방향을 뒤집지 않는다.");
  lines.push("evidence가 상충할 경우 한쪽을 임의로 삭제하지 않고 \"우호 요인과 긴장 요인이 공존한다\"고 설명한다.");
  lines.push("코드 결과와 일반 명리 지식이 충돌하면 코드에서 제공된 구조 데이터를 우선하고, 필요하면 한계를 별도로 설명한다.");
}

// ── 궁합 분석 전체 텍스트 빌드 ────────────────────────────────────

export function buildCompatibilityClipboardText(
  person1: PersonRecord,
  person2: PersonRecord,
  result: CompatibilityResult,
  hourMode1: "포함" | "제외" | "비교" = "포함",
  hourMode2: "포함" | "제외" | "비교" = "포함",
): string {
  const lines: string[] = [];
  const n1 = person1.birthInput.name;
  const n2 = person2.birthInput.name;

  lines.push(`=== 사주 궁합 분석 데이터 ===`);
  lines.push(`${n1} ↔ ${n2}`);
  lines.push("");

  // [Phase 3 P0] 화면(Compatibility.tsx)과 동일한 source of truth(getCompatibilityCardPolicy)로
  // 목적별 궁합만 노출한다. legacy totalScore/romanceMarriageFit은 "궁합 점수" 사용자 export
  // 라벨로 쓰지 않는다(내부 API 필드 자체는 CompatibilityResult에 backward compat로 유지됨).
  const cardPolicy = getCompatibilityCardPolicy(person2.relationshipType);
  lines.push(`[궁합 점수 (목적별 모델)]`);
  lines.push(`  🤝 인간관계 궁합: ${result.humanCompatibility.final}점 — ${result.humanCompatibility.tone}`);
  if (cardPolicy.showRomance) {
    lines.push(`  💕 연애 궁합: ${result.romanceCompatibility.final}점 — ${result.romanceCompatibility.tone}`);
  }
  if (cardPolicy.showMarriage) {
    lines.push(`  💍 결혼 궁합: ${result.marriageCompatibility.final}점 — ${result.marriageCompatibility.tone}`);
  }
  lines.push(`  충(충돌) 횟수: ${result.clashCount}`);
  if (result.keywords.length > 0) {
    lines.push(`  키워드: ${result.keywords.join("  ")}`);
  }
  lines.push(`  (세 점수는 서로 다른 산식이며 평균/합산 값이 아닙니다.)`);
  lines.push("");

  // 세부 조정 항목
  lines.push(`[세부 점수 (기준점 50 + 조정)]`);
  for (const step of result.adjustmentSteps) {
    const sign = step.delta >= 0 ? "+" : "";
    lines.push(`  ${step.category.padEnd(12)}: ${sign}${step.delta}  (${step.note})`);
  }
  if (result.structuralSteps.length > 0) {
    lines.push(`  [등급 조정]`);
    for (const s of result.structuralSteps) {
      lines.push(`    • ${s.label} → ${s.direction === "up" ? "상향" : "하향"}`);
    }
  }
  lines.push("");

  // 궁합 내러티브
  lines.push(`[궁합 요약]`);
  lines.push(`  ${result.summary}`);
  lines.push("");

  lines.push(`[강점]`);
  for (const s of result.strengths) lines.push(`  • ${s}`);
  lines.push("");

  lines.push(`[주의 사항]`);
  for (const c of result.cautions) lines.push(`  • ${c}`);
  lines.push("");

  lines.push(`[조언]`);
  for (const a of result.advice) lines.push(`  • ${a}`);
  lines.push("");

  lines.push(`[장기 전망]`);
  lines.push(`  ${result.longTermOutlook}`);
  lines.push("");

  // 💕 커플 관계 상호작용도(연도별) — 화면(Compatibility.tsx)과 동일한 계산 함수를 재사용.
  // 개인별 배우자 활성도/안정도와는 별개로 "두 사람 사이의 관계 자체"가 그 해 얼마나
  // 활성화·조화·충돌·안정적인지를 보여준다.
  {
    const pipe1 = computePersonPipelineSnapshot(person1);
    const pipe2 = computePersonPipelineSnapshot(person2);
    // manualPillars 반영을 위해 raw computedPillars가 아니라 getFinalPillars()로 병합한 값을 사용한다.
    const lc1 = calculateLuckCycles(person1.birthInput, getFinalPillars(person1));
    const lc2 = calculateLuckCycles(person2.birthInput, getFinalPillars(person2));
    if (pipe1?.evaluations && pipe2?.evaluations) {
      const y1 = pipe1.adjusted.effectiveYongshin;
      const y2 = pipe2.adjusted.effectiveYongshin;
      const aCtx: PersonInteractionContext = {
        name: n1,
        dayStem: pipe1.input.dayStem,
        dayBranch: pipe1.input.dayBranch,
        yongshin: y1,
        heesin: pipe1.adjusted.effectiveYongshinSecondary,
        gisin: getController(y1),
        birthYear: person1.birthInput.year,
        daewoon: lc1.daewoon,
      };
      const bCtx: PersonInteractionContext = {
        name: n2,
        dayStem: pipe2.input.dayStem,
        dayBranch: pipe2.input.dayBranch,
        yongshin: y2,
        heesin: pipe2.adjusted.effectiveYongshinSecondary,
        gisin: getController(y2),
        birthYear: person2.birthInput.year,
        daewoon: lc2.daewoon,
      };
      const interactionByYear = computeRelationshipInteractionByYearRange({
        a: aCtx,
        b: bCtx,
        aSpouseCtx: {
          dayStem: pipe1.input.dayStem,
          dayBranch: pipe1.input.dayBranch,
          allStems: pipe1.input.allStems,
          gender: person1.birthInput.gender,
          evaluations: pipe1.evaluations,
          yongshin: y1,
          heesin: pipe1.adjusted.effectiveYongshinSecondary,
          gisin: getController(y1),
          birthYear: person1.birthInput.year,
          daewoon: lc1.daewoon,
          seunEntries: lc1.seun,
        },
        bSpouseCtx: {
          dayStem: pipe2.input.dayStem,
          dayBranch: pipe2.input.dayBranch,
          allStems: pipe2.input.allStems,
          gender: person2.birthInput.gender,
          evaluations: pipe2.evaluations,
          yongshin: y2,
          heesin: pipe2.adjusted.effectiveYongshinSecondary,
          gisin: getController(y2),
          birthYear: person2.birthInput.year,
          daewoon: lc2.daewoon,
          seunEntries: lc2.seun,
        },
        fromYear: lc1.wolun.year,
        count: 10,
        baseCompatibilityDampening: dampeningFromCompatibilityTone(result.finalType),
      });
      if (interactionByYear.length > 0) {
        lines.push(`[커플 관계 상호작용도(연도별)]`);
        lines.push(`  개인별 배우자 활성도/안정도와는 별개로, 그 해 대운·세운이 두 사람 사이의 관계 자체를 얼마나 활성화·조화·충돌시키는지 보여줍니다. 활성도가 높다고 재회·결혼으로 단정하지 마세요.`);
        for (const { year, result: r } of interactionByYear) {
          lines.push(
            `  ${year}년 — 관계 활성 ${r.activationScore}점(${r.activationLevel}) / 조화 ${r.harmonyScore}점(${r.harmonyDirection}) / 안정 ${r.stabilityScore}점(${r.stabilityLevel})`,
          );
          lines.push(`    ${r.interpretation}`);
          lines.push(`    💕 관계 진전 여건: ${r.progressReadinessLevel} — ${r.progressReadinessNote}`);
          lines.push(`      (진전 여건은 확률이 아니라 구조적 여건을 나타내는 해석용 등급입니다. 근거: ${r.progressReadinessReasons.join(" / ")})`);
          if (r.isLowActivityPeriod) {
            lines.push(`    💤 관계 저활성 구간 — 두 사람 모두 배우자 테마와 커플 상호작용이 조용한 시기입니다(인연이 없다는 뜻은 아님).`);
          }
          if (r.factors.length > 0) {
            lines.push(`    근거: ${r.factors.map((f) => f.label).join(" / ")}`);
          }
        }
        lines.push("");
      }
    }
  }

  // 각 사람의 개인 사주 데이터 (간략, 프롬프트 제외)
  lines.push(buildPersonClipboardText(person1, hourMode1, true));
  lines.push("");
  lines.push(buildPersonClipboardText(person2, hourMode2, true));
  lines.push("");

  lines.push("---");
  lines.push("[새 궁합 전용 프롬프트]");
  lines.push("당신은 20년 경력의 따뜻하고 현실적인 명리 상담가입니다.");
  lines.push("아래 두 사람의 사주 구조와 궁합 데이터를 바탕으로, 단순 개인 사주 해석이 아니라 반드시 “두 사람의 관계성 중심”으로 해석해 주세요.");
  lines.push("개인 운세, 커리어, 재물운, 개운법은 길게 반복하지 말고, 궁합 판단에 필요한 부분만 짧게 활용해 주세요.");
  lines.push("");
  lines.push("특히 아래 요소를 중심으로 해석해 주세요.");
  lines.push("- 일간 관계");
  lines.push("- 배우자궁 일지 관계");
  lines.push("- 월지 관계");
  lines.push("- 지지 전체의 합·충·형·파·해·원진");
  lines.push("- 삼합국 / 반합 구조");
  lines.push("- 용신·희신·기신 보완 여부");
  lines.push("- 연애 관점");
  lines.push("- 결혼 관점");
  lines.push("- 생활 리듬과 현실 조율");
  lines.push("- 갈등 패턴과 해결법");
  lines.push("");
  lines.push("해석은 일반인이 이해하기 쉽게, 어려운 명리 용어는 반드시 쉬운 말로 풀어 설명해 주세요.");
  lines.push("표만 나열하지 말고 실제 연애 상황에 빗대어 자연스럽게 상담하듯 설명해 주세요.");
  lines.push("");
  lines.push("※ 아래 목차는 해석의 기준일 뿐, 모든 항목을 기계적으로 동일한 분량으로 나열하지 말고, 이 궁합에서 실제로 중요한 부분에 더 비중을 두어 자연스럽게 상담하듯 풀어주세요.");
  lines.push("※ 제공된 원국 데이터와 궁합 데이터가 우선입니다. 생년월일로 만세력을 새로 계산하지 말고, 제공된 천간·지지를 기준으로 합·충·형·파·해·원진·삼합국·방합 관계만 재검토해 주세요.");
  lines.push("");
  lines.push("────────────────────");
  lines.push("[궁합 해석 목차]");
  lines.push("1. 💞 두 사람의 전체 궁합 요약: 이 관계가 편안형인지, 긴장형인지, 성장형인지 설명하고, 왜 끌리는지 왜 조율이 필요한지 풀어주세요.");
  lines.push("2. 🔥 일간 관계와 기본 성향: 서로의 말투, 감정 표현, 자존심 등 성향이 어떻게 맞물리는지 봐주세요.");
  lines.push("3. 🏠 배우자궁 관점: 일지 관계(충·합·형·파·해·원진)를 중심으로 연애/결혼 생활을 설명해주세요. 충이 있다면 재정렬하는 자극제로 풀이될 수 있는지도요.");
  lines.push("4. 🌙 월지와 생활 리듬: 실제 생활 리듬, 일상 감각, 일정 조율 등 현실적인 부분에서의 편안함/불편함을 해석해주세요.");
  lines.push("5. 🧩 합·충·형·파·해·원진 종합 해석: 각 작용이 실제 관계에서 어떤 장면으로 나타나는지 예시를 들고, 좋은 작용은 살리고 불편한 건 어떻게 조율할지 알려주세요.");
  lines.push("6. 🌳 삼합국 / 반합 구조 해석: 해묘미, 사유축 등 합국이 있다면 그게 감정적인지 현실적인지 구분하고, 서로의 용신/기신 여부를 반영해주세요.");
  lines.push("7. 💡 용신·희신·기신 보완 관계: 상대가 내 용희신을 채워주는지, 기신을 자극해 부담을 주는지 체감되는 선에서 설명해주세요.");
  // [Phase 3 P0] 연애/결혼 궁합 데이터가 실제로 export되는 relType(showRomance)에서만
  // 해당 항목을 프롬프트에 포함한다 — 데이터 없는 항목을 해석하라고 지시하면 안 됨.
  if (cardPolicy.showRomance) {
    lines.push("8. 💕 연애 궁합: 연애 초반의 끌림, 설렘, 서운함이 생길 수 있는 포인트를 짚어주세요.");
    lines.push("9. 💍 결혼 궁합: 일, 생활 리듬, 가족관계 등 장기 배우자로서의 가능성과 꼭 필요한 조율 조건을 알려주세요.");
  }
  lines.push("10. ⏰ 현실 운영 궁합: 장거리, 바쁜 일정, 연락 텀, 만남 주기 등 독립성과 안정성을 유지할 꿀팁을 주세요.");
  lines.push("11. ⚠️ 갈등 패턴: 두 사람이 다툴 때 생기는 오해 패턴, 대화법, 서운함 표현의 주의점을 알려주세요.");
  lines.push("12. 🌱 관계를 좋게 만드는 실전 조언: 서운함을 말하는 방식, 장기 관계로 가기 위한 습관을 구체적으로 제안해주세요.");
  lines.push("13. 🔮 최종 전망: 무조건 좋다/나쁘다 단정하지 말고, 어떤 조건이 충족되면 좋아질지 현실적으로 전망해주세요.");
  lines.push("14. 💒 대운·세운의 배우자/결혼 활성 흐름: 두 사람 각각의 결혼·배우자 테마 활성도와 배우자궁 안정도를 구분해서 해석하고, 현재 대운 안에서 관계·결혼 이슈가 특히 강하게 움직이는 연도를 비교해주세요. 활성도가 높다고 결혼 적기로 단정하지 말고, 활성도 × 안정도 조합에 따라 안정적 발전인지, 관계 변화·재편·결단이 강한 시기인지 구분해주세요.");
  lines.push("15. 💕 연도별 커플 관계 상호작용 흐름: [커플 관계 상호작용도(연도별)]의 관계 활성도·조화도·안정도를 반드시 함께 해석해주세요. 개인별 배우자 활성도/안정도와 커플 자체의 상호작용 지표를 혼동하지 말고, 관계 활성도(그 해 두 사람 사이의 사건·감정·결정이 얼마나 강하게 움직이는가) / 관계 조화도(그 움직임이 연결·보완 방향인지 충돌·소모 방향인지) / 관계 안정도(관계가 실제 성립했을 때 얼마나 안정적으로 유지되기 쉬운지)를 구분해주세요. 활성도가 높다는 이유만으로 재회·결혼·연애 성사를 단정하지 말고, 세 축과 두 사람 각각의 배우자·결혼 활성도/안정도, 그리고 '관계 진전 여건' 등급을 함께 종합해서 해석해주세요.");
  if (cardPolicy.showRomance) {
    // [Phase 3 P0] 데이터 섹션 이름이 [연애 적합도 / 결혼 적합도]에서 [궁합 점수 (목적별
    // 모델)]로 바뀌었으므로 참조도 함께 갱신한다(더 이상 존재하지 않는 섹션명을 가리키면
    // AI가 근거 없이 지어낼 위험이 있음).
    lines.push("16. 💕💍 연애 궁합 · 결혼 궁합: [궁합 점수 (목적별 모델)]의 연애 궁합·결혼 궁합 값은 두 사람 원국 자체의 구조 적합성이며, 연도별 timing과는 완전히 분리된 값입니다. 연애 궁합은 '연인으로서 끌리고 관계가 형성·유지되기 쉬운가'를, 결혼 궁합은 '장기 배우자로 생활·책임·갈등을 운영하기 쉬운가'를 뜻합니다. 두 점수와 관계 유형을 함께 언급하되, 확률이 아니라 구조적 여건이라는 점을 분명히 하고, 위 연도별 timing 항목(14·15번)과 섞어서 하나로 뭉뚱그리지 말아주세요.");
  }
  lines.push("");
  lines.push("────────────────────");
  lines.push("[누락 방지 규칙]");
  lines.push("아래 궁합 데이터에 표시된 합·충·형·파·해·원진 태그만 그대로 해석하지 말고, 두 사람의 사주 원국 전체 지지 8글자를 직접 교차 검토하여 누락된 관계가 없는지 재확인해 주세요.");
  lines.push("특히 다음 항목은 반드시 재검토해 주세요.");
  lines.push("1. 삼합국/반합 재검토: 해묘미, 인오술, 사유축, 신자진이 두 사람 원국 전체에서 완성되거나 반합이 되는지 확인하고, 상대가 빈 글자를 보완한다면 별도 해석하세요.");
  lines.push("2. 방합 재검토: 인묘진, 사오미, 신유술, 해자축 방합 흐름을 확인하세요.");
  lines.push("3. 합과 파의 동시성 확인: 인해합이면서 인해파도 성립하는 경우처럼, 복합적인 작용을 같이 설명해주세요.");
  lines.push("4. 배우자궁(일지) 관계 별도 확인: 일지끼리 합/충/형/파/해/원진은 일반 교차보다 중요하게 해석하고, 충·형이라도 무조건 나쁘다 단정 말고 조율 과제로 풀어주세요.");
  lines.push("5. 월지 관계 별도 확인: 두 사람 월지끼리의 관계(생활 리듬, 편안함)를 따로 해석해주세요.");
  lines.push("6. 천간합/천간충 재검토: 천간 전체에서 합/충/극이 있는지 확인하고 사고방식, 감정 흐름으로 설명해주세요.");
  lines.push("7. 용신·희신·기신과 연결해서 재해석: 합국이라도 누군가에겐 희신(현실감), 누군가에겐 기신(압박)일 수 있음을 반영하고, 충이라도 용신을 깨는지 자극하는지 구분하세요.");
  lines.push("8. 화면 표시 태그와 재검토 결과 분리: 제공된 태그 외에 추가 발견된 관계는 '원국 전체를 교차하면 이런 흐름도 함께 볼 수 있습니다'라고 자연스럽게 설명해주세요.");
  lines.push("9. 종합 판단 우선: 단편적인 합/충 개수에 연연하지 말고 전체적인 끌림, 안정감, 갈등, 결혼 가능성을 종합적으로 해석하세요.");
  lines.push("");
  lines.push("────────────────────");
  lines.push("[출력 스타일 및 규칙]");
  lines.push("- 개인 사주 데이터는 참고로만 쓰시고 철저히 관계성 중심(궁합)으로만 해석할 것.");
  lines.push("- 개인용 운세(오늘운세, 커리어, 개인적 개운법 등)는 절대 중복 삽입하지 말 것.");
  lines.push("- 따뜻하고 상담하듯 자연스러운 문장식(산문)으로 작성할 것 (표 남용 금지).");
  lines.push("");
  pushInterpretationConsistencyRules(lines);

  return lines.join("\n");
}
