// ── 사주 데이터 클립보드 내보내기 유틸 ─────────────────────────────
// GPT / Gemini 에 붙여넣기 위한 구조화 텍스트를 생성합니다.

import type { PersonRecord } from "./storage";
import { getFinalPillars } from "./storage";
import { buildInterpretSchema, STRENGTH_DISPLAY_LABEL, type StrengthLevel } from "./interpretSchema";
import { computeBranchRelations } from "./branchRelations";
import { calculateLuckCycles, calculateShinsalFull } from "./luckCycles";
import { getTenGod } from "./tenGods";
import { getTenGodGroup, type FiveElKey } from "./element-color";
import type { CompatibilityResult } from "./compatibilityScore";

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

function getElementBalanceSummary(counts: Record<string, number>): string {
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

export function buildPersonClipboardText(record: PersonRecord): string {
  const input = record.birthInput;
  const pillars = getFinalPillars(record);

  const dayStem   = pillars.day?.hangul?.[0] ?? "";
  const dayBranch = pillars.day?.hangul?.[1] ?? "";
  const allBranches = (["year", "month", "day", "hour"] as const)
    .map((k) => pillars[k]?.hangul?.[1])
    .filter((b): b is string => !!b);
  const allStems = (["year", "month", "day", "hour"] as const)
    .map((k) => pillars[k]?.hangul?.[0])
    .filter((s): s is string => !!s);
  const monthBranch = pillars.month?.hangul?.[1] ?? "";

  const counts = record.profile.fiveElementDistribution;

  const schema = buildInterpretSchema(
    dayStem, counts, monthBranch, dayBranch, allStems, allBranches,
  );

  const strengthLevel: StrengthLevel = record.manualStrengthLevel
    ? (record.manualStrengthLevel as StrengthLevel)
    : schema.strengthLevel;

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

  // 격국: 월지 십성 기반
  const monthTG = dayStem && monthBranch ? getTenGod(dayStem, monthBranch) : null;
  const geokgukMap: Record<string, string> = {
    비견: "비겁격", 겁재: "비겁격",
    식신: "식신격", 상관: "상관격",
    편재: "편재격", 정재: "정재격",
    편관: "편관격", 정관: "정관격",
    편인: "편인격", 정인: "정인격",
  };
  const geokguk = monthTG ? (geokgukMap[monthTG] ?? `${monthTG}격`) : "불명";

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
    }
  }
  const heeshinEl  = schema.yongshinSecondary ?? "";
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

  const luckCycles = calculateLuckCycles(input, record.profile.computedPillars);

  const currentYear = new Date().getFullYear();
  const birthYear = input.year;
  const currentDaewoon = luckCycles.daewoon.find((d) => {
    const dStart = birthYear + d.startAge;
    const dEnd   = birthYear + d.endAge;
    return currentYear >= dStart && currentYear <= dEnd;
  });

  const lines: string[] = [];

  lines.push(`=== 사주 분석 데이터: ${input.name} ===`);
  lines.push("이 데이터에는 화면에서 사용되는 대표 요약 / 균형 해석 / 격국 판단 / 용신 판단 기준이 포함되어 있습니다.");
  lines.push("일반적인 사주 해석이 아니라 구조 중심 해석을 요청합니다.");
  lines.push("본 데이터는 구조 중심 해석 기준(anchor)이 포함된 분석 payload입니다.");
  lines.push("일반적인 사주 설명 대신 구조 기준 유지 해석을 요청합니다.");
  lines.push(`생년월일: ${input.year}년 ${input.month}월 ${input.day}일 (${input.calendarType === "solar" ? "양력" : "음력"})`);
  if (!input.timeUnknown && input.hour != null) {
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

  // 일간
  lines.push(`[일간]`);
  lines.push(`  ${dayStem}(${STEM_EL[dayStem] ?? ""}일간) — ${STRENGTH_DISPLAY_LABEL[strengthLevel] ?? schema.strengthDisplayLabel} [${strengthLevel}]`);
  lines.push(`  ${schema.strengthDesc}`);
  lines.push(`  득령: ${deungryeong ? "O" : "X"}  득지: ${deungjiStr === "yes" ? "O" : deungjiStr === "partial" ? "△" : "X"}  득세: ${deungseStr === "yes" ? "O" : deungseStr === "partial" ? "△" : "X"}`);
  lines.push(`  격국: ${geokguk}`);
  lines.push(`  조후: ${johu}`);
  lines.push("");

  // 대표 요약 (화면 해석 핵심)
  lines.push(`[대표 요약]`);
  const domEl = schema.dominantElement as FiveElKey;
  const dmElKey = (STEM_EL[dayStem] ?? "") as FiveElKey;
  const domGroup = (dmElKey && domEl) ? getTenGodGroup(dmElKey, domEl) : "";
  lines.push(`  대표 오행: ${domEl}`);
  if (domGroup) lines.push(`  대표 십성(그룹): ${domGroup}`);
  lines.push(`  십성 기준(anchor): ${dayStem} 일간 기준`);
  lines.push(`  오행 기준(anchor): ${dayStem} 일간 기준`);
  lines.push(`  오행 균형 해석: ${getElementBalanceSummary(counts)}`);
  lines.push(`  성격 기질 분석 요약: ${schema.strengthDesc} · 대표 오행(${domEl}) 성향이 비교적 또렷하게 드러납니다.`);
  lines.push(`  격국 해석 설명: 월지 기준(${monthBranch}) 십성(${monthTG ?? "불명"}) 흐름으로 ${geokguk} 성향을 참고합니다.`);
  lines.push(`  격국 기준(anchor): 월지 기준 ${geokguk}`);
  lines.push(`  격국 판단 방식(anchor): 월지 중심 정격 판단`);
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
  lines.push(`  용신: ${yongshinEl}  (${schema.yongshinTenGodGroup}격, 신뢰도: ${schema.yongshinConfidence})`);
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
  if (luckCycles.seun[0]) {
    lines.push(`  세운 (${luckCycles.seun[0].year}): ${luckCycles.seun[0].ganZhi.stem}${luckCycles.seun[0].ganZhi.branch}`);
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
  lines.push("- 월지 기준 격국 참고");
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
    lines.push(buildPersonClipboardText(person));
    lines.push("");
  }

  lines.push("---");
  lines.push("이 데이터 기준으로 구조 중심 해석을 해주세요.");
  lines.push("일반적인 사주 설명은 제외해주세요.");

  return lines.join("\n");
}
