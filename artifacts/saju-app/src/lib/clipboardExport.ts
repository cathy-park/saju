// ── 사주 데이터 클립보드 내보내기 유틸 ─────────────────────────────
// GPT / Gemini 에 붙여넣기 위한 구조화 텍스트를 생성합니다.

import type { PersonRecord } from "./storage";
import { getFinalPillars } from "./storage";
import { buildInterpretSchema, STRENGTH_DISPLAY_LABEL, type StrengthLevel } from "./interpretSchema";
import { computeBranchRelations } from "./branchRelations";
import {
  calculateLuckCycles,
  calculateShinsalFull,
  type DaewoonSuOpts,
} from "./luckCycles";
import { getTenGod } from "./tenGods";
import { getTenGodGroup, type FiveElKey } from "./element-color";
import type { CompatibilityResult } from "./compatibilityScore";
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

  const cp = record.profile.computedPillars;
  const daewoonSuOpts: DaewoonSuOpts = {
    exactSolarTermBoundaryOn: record.fortuneOptions?.exactSolarTermBoundaryOn ?? true,
    trueSolarTimeOn: record.fortuneOptions?.trueSolarTimeOn ?? false,
  };
  const luckCycles = calculateLuckCycles(input, cp, daewoonSuOpts);
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
    lines.push(`재물운 종합 점수(채널·감당·축적 결합):`);
    lines.push(`${fmt2(w.score)}`);
    lines.push(`(${w.grade})`);
    lines.push("");
    lines.push(`관성 요약:`);
    lines.push(`${o.summary}`);
    lines.push("");
    lines.push(`배우자궁 요약:`);
    lines.push(`${s.summary}`);
    lines.push("");
    lines.push(`재물운 요약:`);
    lines.push(`${w.summary}`);
    lines.push("");
  }

  const wStruct = pipelineSnapshot?.structureDomains?.wealth;
  if (wStruct) {
    lines.push(`[구조 기반 재물운 (화면 요약과 동일)]`);
    lines.push("");
    lines.push(`최종 재물운: ${wStruct.score}점`);
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
    lines.push(`현재 관성 활성도:`);
    lines.push(`${fmt2(timingActivation.officerActivationNow)}`);
    lines.push(`(${timingActivation.officerActivationTrend})`);
    lines.push("");
    lines.push(`현재 재물운 활성도(종합·timing):`);
    lines.push(`${fmt2(timingActivation.wealthActivationNow)}`);
    lines.push(`(${timingActivation.wealthActivationTrend})`);
    lines.push("");
    lines.push(`현재 배우자궁 안정도:`);
    lines.push(`${fmt2(timingActivation.spousePalaceStabilityNow)}`);
    lines.push(`(${timingActivation.spouseActivationTrend})`);
    lines.push("");
  }

  const structureDomains = pipelineSnapshot?.structureDomains;
  if (structureDomains) {
    lines.push(`[구조 기반 7영역 점수]`);
    lines.push(
      "각 영역은 단순 존재 가산이 아니라 작동력·감당력·안정성 등 구조 가중·결합(예: 재물운=세 축 기하평균)으로 산출됩니다.",
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
  lines.push(`  격국 기준(anchor): ${geokguk}`);
  lines.push(`  격국 판단 방식(anchor): 월지 지장간 투출 기준(determineGukguk)`);
  lines.push(`  용신 해석 설명: 일간 강약(${strengthLevel}) 흐름에 맞춰 ${yongshinEl}${heeshinEl ? `(+${heeshinEl})` : ""} 쪽을 우선으로 봅니다. (신뢰도: ${schema.yongshinConfidence})`);
  lines.push(`  용신 판단 기준(anchor): 일간 강약 기반 자동 계산`);
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
    for (const rel of branchRelations) {
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
  lines.push(
    `  월운: ${luckCycles.wolun.ganZhi.stem}${luckCycles.wolun.ganZhi.branch}` +
    ` (${luckCycles.wolun.year}년 ${luckCycles.wolun.month}월)`,
  );
  lines.push(
    `  일운: ${luckCycles.ilun.ganZhi.stem}${luckCycles.ilun.ganZhi.branch}` +
    ` (${luckCycles.ilun.year}년 ${luckCycles.ilun.month}월 ${luckCycles.ilun.day}일)`,
  );
  lines.push("");

  lines.push("---");
  lines.push("[해석 기준]");
  lines.push("");
  lines.push("이 분석은 다음 기준을 따릅니다:");
  lines.push("");
  lines.push("- 십성 기준: 일간 기준");
  lines.push("- 일간 강약 중심 구조 해석");
  lines.push("- 파이프라인 격국(determineGukguk) 참고");
  lines.push("- 자동 계산된 용신 체계 사용");
  lines.push("- 오행 균형 중심 해석");
  lines.push("- 신살은 보조 해석으로만 사용");
  lines.push("");
  lines.push("대표 구조 우선순위:");
  lines.push("");
  lines.push("1순위: 일간 강약");
  lines.push("2순위: 격국 흐름");
  lines.push("3순위: 용신 판단");
  lines.push("4순위: 오행 균형");
  lines.push("5순위: 신살 보조 해석");
  lines.push("");
  lines.push("일반적인 사주 설명이 아니라");
  lines.push("위 구조 기준을 유지한 해석을 요청합니다.");
  lines.push("");
  lines.push("본 분석은 자동 계산된 구조 해석 결과이며 전통 명리학 유파별 해석 차이가 있을 수 있습니다.");
  lines.push("");
  lines.push(`[엔진 계산 기준]`);
  lines.push("");
  lines.push("strengthDebug: enabled");
  lines.push("structureDomainScores: enabled (7 domains, structure-weighted)");
  lines.push("relationshipWealthEvaluations: derived from structureDomains");
  lines.push("timingActivation: enabled");
  lines.push("");
  lines.push("engineVersion: structure-v1.5-wealth-ui+clipboard-summary");
  lines.push("");
  lines.push("본 분석에는 강약 보정(설기·음간 포함),");
  lines.push("관계·재물 구조 지표(재물운=종합),");
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

  return lines.join("\n");
}

// ── 궁합 분석 전체 텍스트 빌드 ────────────────────────────────────

export function buildCompatibilityClipboardText(
  person1: PersonRecord,
  person2: PersonRecord,
  result: CompatibilityResult,
): string {
  const lines: string[] = [];
  const n1 = person1.birthInput.name;
  const n2 = person2.birthInput.name;

  lines.push(`=== 사주 궁합 분석 데이터 ===`);
  lines.push(`${n1} ↔ ${n2}`);
  lines.push("");

  // 궁합 점수
  lines.push(`[궁합 점수]`);
  lines.push(`  총점: ${result.totalScore}/100 — ${result.grade}`);
  lines.push(`  충(충돌) 횟수: ${result.clashCount}`);
  if (result.keywords.length > 0) {
    lines.push(`  키워드: ${result.keywords.join("  ")}`);
  }
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

  // 각 사람의 개인 사주 데이터 (간략)
  for (const person of [person1, person2]) {
    lines.push(buildPersonClipboardText(person, "포함")); // 궁합은 항상 포함 기준으로 간략 추가
    lines.push("");
  }

  lines.push("---");
  lines.push("이 데이터 기준으로 구조 중심 해석을 해주세요.");
  lines.push("일반적인 사주 설명은 제외해주세요.");

  return lines.join("\n");
}
